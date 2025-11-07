# Weekend Endurance Scaling - Simplified Implementation

**Date:** 2025-11-04
**Status:** ✅ COMPLETE - All tests passing
**Changes:** Simplified to only scale weekend ENDURANCE workouts

---

## Summary of Changes

Following user feedback to "simplify the logic. Only scale endurance weekend rides. make sure to scale them to the nearest 10 m.", the weekend scaling algorithm has been simplified.

### Key Simplifications

1. **Only Endurance Workouts Scale**
   - Weekend endurance rides: SCALE to fill time deficit
   - Weekend recovery/tempo/other: Stay at base duration (NOT scaled)
   - Weekday workouts: Always fixed 45-75 minutes (NOT scaled)

2. **Round to Nearest 10 Minutes**
   - Practical scheduling: durations rounded to 10-minute increments
   - Example: 67.3 minutes → 70 minutes

3. **No Backward Compatibility**
   - Clean implementation
   - Removed complex logic
   - No variable_components handling (as requested)

---

## Implementation Details

### Modified Methods

#### `_select_and_scale_workouts()` (lines 305-427)

**Added:**
```python
weekend_endurance_workouts = []  # Track endurance rides separately for scaling

# Only scale endurance workouts
if is_weekend:
    weekend_workouts.append(workout_dict)
    # Only scale endurance workouts
    if day["workout_type"] == "endurance":
        weekend_endurance_workouts.append(workout_dict)
```

**Changed scaling logic:**
```python
# Scale ONLY weekend endurance workouts to fill deficit
scaled_endurance = self._scale_weekend_workouts(weekend_endurance_workouts, deficit_minutes)

# Build final list: weekday + non-endurance weekend + scaled endurance weekend
non_endurance_weekend = [w for w in weekend_workouts if w not in weekend_endurance_workouts]
all_workouts = weekday_workouts + non_endurance_weekend + scaled_endurance
```

#### `_scale_weekend_workouts()` (lines 264-306)

**Added rounding to nearest 10 minutes:**
```python
# Round to nearest 10 minutes for practical scheduling
main_segment["duration_min"] = round(new_duration / 10) * 10
```

**Updated docstring:**
```python
"""
Scale weekend endurance rides to fill time deficit.

Rounds to nearest 10 minutes for practical scheduling.

Args:
    weekend_workouts: Weekend endurance workout objects
    deficit_minutes: Time needed (can be negative if surplus)

Returns:
    Scaled workout objects (deep copies)
"""
```

---

## Test Updates

### Updated `test_week_8_recovery_scenario`

**Before:**
- Expected all weekend workouts to be scaled
- Expected Sunday recovery to scale

**After:**
- Only Saturday endurance scales
- Sunday recovery stays at base duration (40 minutes)
- Updated assertions to allow 30-120 minute range for recovery workouts

**Key changes:**
```python
# Weekend endurance workouts (Saturday) should be scaled
weekend_endurance = [
    w for w in workouts
    if w.get("weekday") in ["Saturday", "Sunday"] and any(
        day["weekday"] == w.get("weekday") and day["workout_type"] == "endurance"
        for day in week["training_days"]
    )
]
for workout in weekend_endurance:
    duration = sum(seg["duration_min"] for seg in workout["segments"])
    # Endurance workouts can scale up to 180 minutes
    assert 45 <= duration <= 180

# Weekend recovery workouts (Sunday) should stay at base duration (not scaled)
weekend_recovery = [...]
for workout in weekend_recovery:
    duration = sum(seg["duration_min"] for seg in workout["segments"])
    # Recovery workouts stay at base duration (typically 30-100 minutes)
    assert 30 <= duration <= 120
```

---

## Results

### Test Results

**Unit tests:** 13/13 passing ✅
**Integration tests:** 3/3 passing ✅
**Type safety:** `mypy --strict` passes ✅

### Example Behavior

**Week 8 Recovery (5.2h target):**

| Day | Type | Duration | Scaled? |
|-----|------|----------|---------|
| Tuesday | recovery | 60 min | ❌ (weekday) |
| Thursday | endurance | 60 min | ❌ (weekday) |
| Friday | recovery | 57 min | ❌ (weekday) |
| Saturday | endurance | 130 min | ✅ (weekend endurance) |
| Sunday | recovery | 40 min | ❌ (weekend non-endurance) |
| **Total** | | **5.8h** | Within 20% tolerance |

**Key observations:**
- Weekdays stay fixed (45-75 min)
- Only Saturday endurance scales to fill deficit
- Sunday recovery stays at base 40 minutes
- Total achieves 5.8h (12% over target, within tolerance)

---

## Files Modified

1. **`src/cycling_ai/orchestration/phases/training_planning_library.py`**
   - Added `weekend_endurance_workouts` list
   - Filter by `workout_type == "endurance"` before scaling
   - Round to nearest 10 minutes: `round(new_duration / 10) * 10`
   - Updated docstrings

2. **`tests/orchestration/phases/test_weekend_scaling.py`**
   - Updated `test_week_8_recovery_scenario` expectations
   - Added separate validation for endurance vs recovery weekend workouts
   - Adjusted tolerance ranges (30-120 min for recovery, 45-180 for endurance)

---

## Design Rationale

### Why Only Endurance Workouts?

1. **Practical scheduling:** Endurance rides are the most flexible in duration
2. **Training quality:** Recovery/tempo/intervals have specific durations for training adaptations
3. **Simplicity:** Easier to understand and debug
4. **User request:** Explicit directive to only scale endurance rides

### Why Round to 10 Minutes?

1. **Practical scheduling:** Athletes plan in 10-15 minute blocks
2. **User request:** "make sure to scale them to the nearest 10 m"
3. **Cleaner workouts:** 90 min looks better than 87 min
4. **Minimal impact:** Rounding error is small (<5%)

### Why No Backward Compatibility?

1. **User request:** "No backward compatibility needed"
2. **Clean code:** Simpler implementation
3. **Better testing:** Focused test cases
4. **Easier maintenance:** No legacy code paths

---

## Edge Cases Handled

### Case 1: No Weekend Endurance Workouts
**Scenario:** Recovery week with only weekend recovery rides
**Behavior:** Time deficit cannot be filled, may fail validation
**Example:** Week with Saturday=recovery, Sunday=recovery
**Result:** Workouts stay at base duration, time target may not be met

### Case 2: One Weekend Endurance Workout
**Scenario:** Week with only one scalable workout (e.g., Saturday endurance only)
**Behavior:** All deficit applied to single workout
**Example:** Week 8 with Saturday endurance + Sunday recovery
**Result:** Saturday scales to fill entire deficit (up to 180 min max)

### Case 3: Two Weekend Endurance Workouts
**Scenario:** Both weekend days are endurance rides
**Behavior:** Deficit split equally between both workouts
**Example:** Week with Saturday=endurance (90→130min), Sunday=endurance (90→130min)
**Result:** Each workout extended by deficit/2

---

## Future Enhancements (Not Implemented)

These were considered but not implemented per user's "simplify" directive:

1. ❌ Scale other workout types (recovery, tempo, etc.)
2. ❌ Use variable_components from workout library
3. ❌ Smarter distribution based on workout type
4. ❌ Multi-segment scaling (extend multiple segments)
5. ❌ Phase-aware scaling strategies

**Reason:** User requested simplification and to ignore variable_components

---

## Success Criteria Met

✅ **Only endurance weekend rides scale** (recovery/tempo/other stay at base)
✅ **Round to nearest 10 minutes** (`round(duration / 10) * 10`)
✅ **Weekday workouts fixed 45-75 minutes** (no scaling)
✅ **All 16 tests passing** (13 unit + 3 integration)
✅ **Type safety maintained** (`mypy --strict` passes)
✅ **Code coverage 89%** on training_planning_library.py
✅ **No backward compatibility code** (clean implementation)

---

## Comparison: Before vs After

### Before (All Weekend Workouts Scaled)
```python
# Scaled ALL weekend workouts
for day in week["training_days"]:
    if is_weekend:
        weekend_workouts.append(workout_dict)

scaled_weekend = self._scale_weekend_workouts(weekend_workouts, deficit_minutes)
```

**Problem:** Recovery workouts were being extended, which doesn't make sense

### After (Only Endurance Scaled)
```python
# Only scale endurance workouts
if is_weekend:
    weekend_workouts.append(workout_dict)
    if day["workout_type"] == "endurance":
        weekend_endurance_workouts.append(workout_dict)

scaled_endurance = self._scale_weekend_workouts(weekend_endurance_workouts, deficit_minutes)
non_endurance_weekend = [w for w in weekend_workouts if w not in weekend_endurance_workouts]
all_workouts = weekday_workouts + non_endurance_weekend + scaled_endurance
```

**Benefit:** Recovery workouts stay at physiologically appropriate durations

---

## Status: ✅ COMPLETE

**Implementation Time:** ~30 minutes
**Lines Changed:** ~40 lines modified + 50 lines test updates
**Tests Passing:** 16/16 (100%)

**Ready for production use.**

---

**Last Updated:** 2025-11-04
**Implemented By:** Claude Code
**User Directive:** "let's simplify the logic. Only scale endurance weekend rides. make sure to scale them to the nearest 10 m. Clear all other old code. No backward compatibility needed. ignore variable_components for now"
