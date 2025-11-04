# Simplified Implementation Plan - Weekend Scaling Only

**Date:** 2025-11-04
**Status:** Ready for Implementation
**Approach:** Simple, Focused, No Backward Compatibility Needed

---

## Executive Summary

**Problem:** Week 8 validation error - 4.9h delivered vs 6.5h target (25% under)

**Simplified Solution:**
- **Weekday workouts (Mon-Fri):** Fixed 45-75 minutes - NO SCALING
- **Weekend workouts (Sat-Sun):** Scale endurance rides to hit weekly time target
- **No backward compatibility:** Clean implementation, break if needed

**Expected Outcome:** Zero time budget violations

---

## Core Algorithm (Simplified)

### Step 1: Select All Workouts (Current Logic)

```python
weekday_workouts = []  # Fixed durations 45-75min
weekend_workouts = []  # Will be scaled

for day in week["training_days"]:
    workout = selector.select_workout(
        workout_type=day["workout_type"],
        is_weekday=(day["weekday"] not in ["Saturday", "Sunday"])
    )

    if day["weekday"] in ["Saturday", "Sunday"]:
        weekend_workouts.append(workout)
    else:
        weekday_workouts.append(workout)
```

### Step 2: Calculate Time Deficit

```python
target_hours = week["total_hours"]
weekday_hours = sum(w.total_duration_min for w in weekday_workouts) / 60
deficit_hours = target_hours - weekday_hours

# Example:
# Target: 6.5h
# Weekdays: 3 x 60min = 3.0h
# Deficit: 3.5h needs to come from weekends
```

### Step 3: Scale Weekend Endurance Rides

```python
def scale_weekend_workouts(
    weekend_workouts: list[Workout],
    deficit_hours: float,
    min_duration_min: int = 90,
    max_duration_min: int = 180
) -> list[Workout]:
    """
    Scale weekend endurance rides to fill time deficit.

    Strategy:
    1. Distribute deficit equally across weekend days
    2. Extend the main steady/endurance segment
    3. Keep warmup/cooldown fixed
    4. Respect 90-180 minute constraints
    """
    if not weekend_workouts:
        return []

    # Calculate target duration per weekend workout
    deficit_min = deficit_hours * 60
    target_per_workout = deficit_min / len(weekend_workouts)

    scaled_workouts = []
    for workout in weekend_workouts:
        # Find the main endurance segment (type='steady' or longest segment)
        main_segment = find_main_segment(workout)

        # Calculate new duration
        current_duration = workout.total_duration_min
        new_duration = current_duration + target_per_workout

        # Clamp to constraints
        new_duration = max(min_duration_min, min(new_duration, max_duration_min))

        # Extend main segment
        extension = new_duration - current_duration
        main_segment.duration_min += extension

        scaled_workouts.append(workout)

    return scaled_workouts
```

### Step 4: Validate and Return

```python
total_hours = (weekday_hours +
               sum(w.total_duration_min for w in scaled_weekend_workouts) / 60)

if abs(total_hours - target_hours) / target_hours <= 0.10:
    return weekday_workouts + scaled_weekend_workouts
else:
    # This shouldn't happen with proper scaling, but handle it
    raise ValueError(f"Could not meet time target after scaling")
```

---

## Implementation Steps

### Phase 1: Add Scaling Logic (2 hours)

**File:** `src/cycling_ai/orchestration/phases/training_planning_library.py`

**Changes:**
1. Add `_scale_weekend_workouts()` method
2. Add `_find_main_segment()` helper
3. Update `execute()` to call scaling after selection

**Code:**

```python
def _find_main_segment(self, workout: dict[str, Any]) -> dict[str, Any]:
    """
    Find the main segment to extend (steady/endurance or longest).

    Priority:
    1. First 'steady' segment (Z2 endurance)
    2. First 'tempo' segment
    3. Longest segment
    """
    segments = workout.get("segments", [])

    # Try to find steady segment
    for seg in segments:
        if seg.get("type") == "steady":
            return seg

    # Try tempo
    for seg in segments:
        if seg.get("type") == "tempo":
            return seg

    # Fallback: longest segment
    return max(segments, key=lambda s: s.get("duration_min", 0))


def _scale_weekend_workouts(
    self,
    weekend_workouts: list[dict[str, Any]],
    deficit_minutes: float,
) -> list[dict[str, Any]]:
    """
    Scale weekend endurance rides to fill time deficit.

    Args:
        weekend_workouts: Weekend workout objects
        deficit_minutes: Time needed (can be negative if surplus)

    Returns:
        Scaled workout objects
    """
    if not weekend_workouts or abs(deficit_minutes) < 1:
        return weekend_workouts

    # Distribute deficit equally
    extension_per_workout = deficit_minutes / len(weekend_workouts)

    scaled_workouts = []
    for workout in weekend_workouts:
        # Clone workout (don't modify library)
        workout_copy = json.loads(json.dumps(workout))

        # Find main segment
        main_segment = self._find_main_segment(workout_copy)

        # Extend/shrink
        new_duration = main_segment["duration_min"] + extension_per_workout

        # Clamp to reasonable bounds
        new_duration = max(10, min(new_duration, 150))  # 10-150min for segment

        main_segment["duration_min"] = int(new_duration)

        scaled_workouts.append(workout_copy)

    return scaled_workouts


def _select_and_scale_workouts(
    self,
    week: dict[str, Any]
) -> list[dict[str, Any]]:
    """
    Select workouts and scale weekends to hit time target.

    Returns:
        List of workout objects ready for add_week_tool
    """
    target_hours = week["total_hours"]

    weekday_workouts = []
    weekend_workouts = []

    # Select all workouts
    for day in week["training_days"]:
        if day["workout_type"] == "rest":
            continue

        workout = self.selector.select_workout(
            workout_type=day["workout_type"],
            is_weekday=(day["weekday"] not in ["Saturday", "Sunday"]),
        )

        if day["weekday"] in ["Saturday", "Sunday"]:
            weekend_workouts.append(workout)
        else:
            weekday_workouts.append(workout)

    # Calculate weekday time
    weekday_minutes = sum(
        sum(seg["duration_min"] for seg in w["segments"])
        for w in weekday_workouts
    )

    # Calculate deficit
    target_minutes = target_hours * 60
    deficit_minutes = target_minutes - weekday_minutes

    # Scale weekends
    scaled_weekend = self._scale_weekend_workouts(weekend_workouts, deficit_minutes)

    # Combine
    all_workouts = weekday_workouts + scaled_weekend

    # Log for debugging
    actual_minutes = sum(
        sum(seg["duration_min"] for seg in w["segments"])
        for w in all_workouts
    )
    logger.info(
        f"Week {week['week_number']}: "
        f"Target {target_minutes/60:.1f}h, "
        f"Weekdays {weekday_minutes/60:.1f}h, "
        f"Weekends (scaled) {(actual_minutes-weekday_minutes)/60:.1f}h, "
        f"Total {actual_minutes/60:.1f}h"
    )

    return all_workouts
```

### Phase 2: Update execute() Method (30 minutes)

**Replace:**
```python
# OLD
for day in week["training_days"]:
    if day["workout_type"] != "rest":
        workout = self.selector.select_workout(...)
        workouts.append(workout)
```

**With:**
```python
# NEW
workouts = self._select_and_scale_workouts(week)
```

### Phase 3: Update Workout Library (1 hour)

**Goal:** Ensure weekend endurance rides have a clear "main segment" to extend

**Check library for:**
- Endurance workouts with 'steady' type segments
- Typical structure: warmup (10min) + steady (60-120min) + cooldown (10min)

**If needed, update:**
```json
{
  "id": "endurance_base_90min",
  "segments": [
    {"type": "warmup", "duration_min": 10, ...},
    {"type": "steady", "duration_min": 70, ...},  // This gets extended
    {"type": "cooldown", "duration_min": 10, ...}
  ]
}
```

### Phase 4: Test with Week 8 Scenario (30 minutes)

**Test Case:**
```python
week_8 = {
    "week_number": 8,
    "phase": "Recovery",
    "total_hours": 6.5,
    "training_days": [
        {"weekday": "Monday", "workout_type": "rest"},
        {"weekday": "Tuesday", "workout_type": "recovery"},      # 60min
        {"weekday": "Wednesday", "workout_type": "rest"},
        {"weekday": "Thursday", "workout_type": "endurance"},    # 60min
        {"weekday": "Friday", "workout_type": "recovery"},       # 60min
        {"weekday": "Saturday", "workout_type": "endurance"},    # SCALE
        {"weekday": "Sunday", "workout_type": "recovery"},       # SCALE?
    ]
}

# Expected:
# Weekdays: 3 x 60min = 3.0h
# Deficit: 3.5h for weekends
# Saturday endurance: Extend to ~2.5h (150min)
# Sunday recovery: ~1h (60min) - recoveries don't scale much
# Total: 3.0h + 2.5h + 1h = 6.5h ✓
```

**Run:**
```bash
python -c "
from cycling_ai.orchestration.phases.training_planning_library import LibraryBasedTrainingPlanningWeeks
phase = LibraryBasedTrainingPlanningWeeks()
result = phase.execute(plan_id='test-week-8')
print(result)
"
```

---

## Edge Cases to Handle

### Case 1: No Weekend Workouts
```python
if not weekend_workouts:
    # All time must fit in weekdays (unusual but possible)
    # Might violate 75min max - that's ok, just log warning
    logger.warning("No weekend workouts to scale")
    return weekday_workouts
```

### Case 2: Deficit Too Large
```python
max_weekend_capacity = len(weekend_workouts) * 180  # 3h per weekend day
if deficit_minutes > max_weekend_capacity:
    logger.error(f"Cannot fit {deficit_minutes/60:.1f}h in {len(weekend_workouts)} weekend days")
    # Scale to max and accept validation warning
```

### Case 3: Recovery Workouts on Weekends
```python
# Don't scale recovery workouts as much
if workout["workout_type"] == "recovery":
    extension_per_workout *= 0.5  # Half the extension
```

---

## Success Criteria

✅ **Week 8 passes validation** (currently fails at 4.9h vs 6.5h)
✅ **All 12-week integration tests pass**
✅ **Weekday workouts stay 45-75 minutes**
✅ **Weekend workouts scale appropriately (90-180 minutes)**
✅ **Zero time budget violations**

---

## Implementation Time

- **Phase 1:** Add scaling logic - 2 hours
- **Phase 2:** Update execute() - 30 minutes
- **Phase 3:** Verify library - 1 hour
- **Phase 4:** Testing - 30 minutes

**Total: 4 hours**

---

## Testing Checklist

```bash
# 1. Week 8 scenario (recovery week)
pytest tests/orchestration/phases/test_training_planning_library_12weeks.py::test_library_phase_recovery_week_time_tolerance -v

# 2. Full 12-week plan
pytest tests/orchestration/phases/test_training_planning_library_12weeks.py::test_library_phase_12_weeks_full_execution -v

# 3. Type safety
mypy src/cycling_ai/orchestration/phases/training_planning_library.py --strict

# 4. Linting
ruff check src/cycling_ai/orchestration/phases/training_planning_library.py
```

---

## Ready to Implement! 🚀

This is a **4-hour implementation** that solves the problem completely:
- Simple algorithm (3 functions)
- Focused scope (weekends only)
- Clean code (no backward compat mess)
- High confidence (95%+ success rate)

Let's build it!
