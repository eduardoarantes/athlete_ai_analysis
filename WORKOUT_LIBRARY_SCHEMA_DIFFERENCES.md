# Workout Library Schema vs add_week_tool Requirements

**Date:** 2025-11-04
**Status:** Schema Mismatch Analysis

---

## Executive Summary

The workout library schema and the `add_week_tool` validation have **incompatible expectations** for workout structure. This document details the exact differences and provides solutions.

---

## 1. SEGMENT STRUCTURE DIFFERENCES

### What Workout Library Provides

```python
class WorkoutSegment(BaseModel):
    """A segment can be simple OR interval-based."""
    type: Literal["warmup", "interval", "recovery", "cooldown", "steady", "tempo"]

    # For SIMPLE segments (warmup, cooldown, steady, recovery, tempo)
    duration_min: float | None = None
    power_low_pct: int | None = None
    power_high_pct: int | None = None
    description: str | None = None

    # For INTERVAL sets
    sets: int | None = None
    work: IntervalPart | None = None
    recovery: IntervalPart | None = None
```

**Example Simple Segment:**
```json
{
  "type": "warmup",
  "duration_min": 20.0,
  "power_low_pct": 45,
  "power_high_pct": 55,
  "description": "Warm up"
}
```

**Example Interval Segment:**
```json
{
  "type": "interval",
  "duration_min": null,  // ❌ NOT SET
  "sets": 4,
  "work": {
    "duration_min": 10.0,
    "power_low_pct": 90,
    "power_high_pct": 97,
    "description": "Sweet Spot"
  },
  "recovery": {
    "duration_min": 5.0,
    "power_low_pct": 45,
    "power_high_pct": 55,
    "description": "Rest"
  }
}
```

### What add_week_tool Expects

**Required Fields (line 734):**
```python
required_fields = ["type", "duration_min", "power_low_pct", "description"]
```

**Validation:**
```python
for field in required_fields:
    if field not in segment:
        raise ValueError(f"Segment missing required field: '{field}'")
```

### ❌ PROBLEM 1: Interval Segments Have duration_min=None

**Issue:** Interval segments have `duration_min: null` because the duration is calculated as:
```
total_duration = sets * (work.duration_min + recovery.duration_min)
```

**Impact:** The tool expects ALL segments to have `duration_min` set explicitly.

**Error:** Line 106 tries to sum `None + None` when calculating total duration:
```python
total_duration_min = sum(
    sum(seg.get("duration_min", 0) for seg in workout.get("segments", []))
    for workout in filtered_workouts
)
```

This fails because `seg.get("duration_min", 0)` returns `None` (not `0`) when the key exists but value is `None`.

---

## 2. OPTIONAL FIELDS THAT MAY BE NONE

### What Workout Library Provides

**130 out of 222 workouts** have optional fields set to `None`:

```python
class Workout(BaseModel):
    id: str
    name: str
    detailed_description: str | None = None          # ❌ Can be None
    type: Literal[...]
    intensity: Literal[...]
    suitable_phases: list[Literal[...]] | None = None  # ❌ Can be None
    suitable_weekdays: list[Literal[...]] | None = None  # ❌ Can be None
    segments: list[WorkoutSegment]
    base_duration_min: float
    base_tss: float
    variable_components: VariableComponents | None = None
    source_file: str | None = None                   # ❌ Can be None
    source_format: str | None = None                 # ❌ Can be None
```

### What add_week_tool Expects

**Required Fields (line 713-715):**
```python
if "weekday" not in workout:
    raise ValueError(f"Workout {i + 1} missing 'weekday' field")
if "description" not in workout:
    raise ValueError(f"Workout {i + 1} missing 'description' field")
```

### ❌ PROBLEM 2: Description Field Mismatch

**Library field:** `detailed_description` (optional)
**Tool expects:** `description` (required)

**Current workaround in Phase 3b:**
```python
workout_dict["description"] = workout.detailed_description or workout.name
```

This works, but it's a band-aid.

---

## 3. SEGMENT POWER ZONES

### What Workout Library Provides

```python
# Simple segments
power_low_pct: int | None = None
power_high_pct: int | None = None
```

**For interval segments**, power is in the `work` and `recovery` sub-objects, NOT in the segment itself.

### What add_week_tool Expects

**Required Fields:**
```python
required_fields = ["type", "duration_min", "power_low_pct", "description"]
```

### ❌ PROBLEM 3: Interval Segments Missing power_low_pct

**Issue:** Interval segments don't have `power_low_pct` at the segment level. They have it in `work.power_low_pct` and `recovery.power_low_pct`.

**Impact:** Validation fails because the tool expects `power_low_pct` in every segment.

---

## 4. COMPLETE COMPARISON TABLE

| Field | Workout Library | add_week_tool | Compatible? |
|-------|-----------------|---------------|-------------|
| **Workout Level** |
| `id` | ✅ Required | ❌ Not used | ⚠️ N/A |
| `name` | ✅ Required | ❌ Not used | ⚠️ N/A |
| `description` | ❌ Missing (has `detailed_description`) | ✅ Required | ❌ NO |
| `detailed_description` | ✅ Optional | ❌ Not expected | ⚠️ Extra field |
| `type` | ✅ Required | ❌ Not validated | ✅ OK |
| `intensity` | ✅ Required | ❌ Not validated | ✅ OK |
| `weekday` | ❌ Not in model (added in Phase 3b) | ✅ Required | ⚠️ Must add |
| `segments` | ✅ Required (list) | ✅ Required (list) | ✅ OK |
| `base_duration_min` | ✅ Required | ❌ Not used | ⚠️ Extra field |
| `base_tss` | ✅ Required | ❌ Not used (calculates own) | ⚠️ Extra field |
| **Segment Level** |
| `type` | ✅ Required | ✅ Required | ✅ OK |
| `duration_min` | ⚠️ Optional (None for intervals) | ✅ Required | ❌ NO |
| `power_low_pct` | ⚠️ Optional (None for intervals) | ✅ Required | ❌ NO |
| `power_high_pct` | ⚠️ Optional (None for intervals) | ❌ Not validated | ⚠️ OK |
| `description` | ⚠️ Optional | ✅ Required | ❌ NO |
| `sets` | ⚠️ Optional (for intervals) | ❌ Not expected | ⚠️ Extra field |
| `work` | ⚠️ Optional (for intervals) | ❌ Not expected | ⚠️ Extra field |
| `recovery` | ⚠️ Optional (for intervals) | ❌ Not expected | ⚠️ Extra field |

**Legend:**
- ✅ OK = Field present and compatible
- ❌ NO = Field incompatible or causes errors
- ⚠️ N/A = Field not relevant for comparison
- ⚠️ Extra field = Present but not used (harmless)
- ⚠️ Must add = Must be added in transformation

---

## 5. ROOT CAUSES SUMMARY

### Root Cause 1: Two Different Segment Models

**Workout Library:** Supports 2 segment types
- Simple segments (warmup, cooldown, steady, tempo, recovery)
- Interval sets (work/recovery repeated N times)

**add_week_tool:** Only understands simple segments
- All segments must have explicit `duration_min`, `power_low_pct`, `description`

### Root Cause 2: Field Naming Mismatch

| Workout Library | add_week_tool |
|-----------------|---------------|
| `detailed_description` (workout-level) | `description` (workout-level) |
| `description` (segment-level, optional) | `description` (segment-level, required) |

### Root Cause 3: None vs Missing

**Python issue:**
```python
segment = {"duration_min": None}
segment.get("duration_min", 0)  # Returns None, not 0!
```

The tool uses `.get(field, default)` which only returns the default if the key is **missing**, not if the value is `None`.

---

## 6. SOLUTIONS

### Solution 1: Transform Interval Segments (RECOMMENDED)

**In Phase 3b**, before passing to `add_week_tool`, transform interval segments:

```python
for segment in workout_dict.get("segments", []):
    if segment.get("duration_min") is None:
        # Calculate duration for interval sets
        if segment.get("sets") and segment.get("work") and segment.get("recovery"):
            work_dur = segment["work"].get("duration_min", 0) or 0
            recovery_dur = segment["recovery"].get("duration_min", 0) or 0
            segment["duration_min"] = segment["sets"] * (work_dur + recovery_dur)
        else:
            segment["duration_min"] = 0

    # Copy power zones from work interval if missing
    if segment.get("power_low_pct") is None and segment.get("work"):
        segment["power_low_pct"] = segment["work"].get("power_low_pct", 50)
        segment["power_high_pct"] = segment["work"].get("power_high_pct", 60)

    # Ensure description exists
    if not segment.get("description"):
        segment["description"] = f"{segment['type'].title()} segment"
```

**Pros:** Minimal changes, maintains backward compatibility
**Cons:** Band-aid solution, doesn't fix root issue

### Solution 2: Modify add_week_tool Validation (BETTER)

Update validation to handle both segment types:

```python
# Instead of:
required_fields = ["type", "duration_min", "power_low_pct", "description"]

# Use:
required_fields = ["type"]
optional_fields = {
    "duration_min": 0,
    "power_low_pct": 50,
    "description": "Workout segment"
}

for field in required_fields:
    if field not in segment:
        raise ValueError(f"Segment missing required field: '{field}'")

# Fill in optional fields with defaults
for field, default in optional_fields.items():
    if segment.get(field) is None:
        segment[field] = default
```

**Also fix the None handling:**
```python
# Instead of:
total_duration_min = sum(
    sum(seg.get("duration_min", 0) for seg in workout.get("segments", []))
    for workout in filtered_workouts
)

# Use:
total_duration_min = sum(
    sum(seg.get("duration_min") or 0 for seg in workout.get("segments", []))
    for workout in filtered_workouts
)
```

**Pros:** Fixes root cause, more robust
**Cons:** Modifies existing tool (requires testing)

### Solution 3: Create New Tool for Library Workouts

Create `add_week_library_tool` that understands the library schema:

```python
class AddWeekLibraryTool(BaseTool):
    """Version of add_week_tool that works with library workouts."""

    def _validate_segment(self, segment: dict) -> None:
        # Handle both simple and interval segments
        if segment.get("sets"):
            # Interval segment - validate work/recovery
            ...
        else:
            # Simple segment - validate duration/power
            ...
```

**Pros:** Clean separation, no risk to existing functionality
**Cons:** Code duplication, two similar tools

---

## 7. RECOMMENDED APPROACH

**Phase 1: Quick Fix** (Implement in Phase 3b - DONE PARTIALLY)
- Transform interval segments to have calculated `duration_min`
- Transform interval segments to have `power_low_pct` from work
- Add `description` field with fallback to name
- ✅ Already implemented in training_planning_library.py

**Phase 2: Fix None Handling** (Modify add_week_tool)
- Change `seg.get("duration_min", 0)` to `seg.get("duration_min") or 0`
- Change `seg.get("power_low_pct", 50)` to `seg.get("power_low_pct") or 50`
- This fixes the `None + None` error

**Phase 3: Relax Validation** (Modify add_week_tool - OPTIONAL)
- Make `description` optional with default value
- Make `power_low_pct` optional for interval segments
- This makes the tool more flexible

---

## 8. NEXT STEPS

1. ✅ **Analyze differences** (This document)
2. ⏭️ **Implement Phase 2 fix** (None handling in add_week_tool)
3. ⏭️ **Test full integration** (Phase 3a → 3b → add_week_tool)
4. ⏭️ **Document workarounds** (For users)
5. ⏭️ **Consider Phase 3** (Relax validation - optional)

---

**Author:** Claude Code
**Date:** 2025-11-04
**Version:** 1.0
