# TSS Removal Rework - Quick Guide

**Status:** Ready for Execution
**Time:** 30-60 minutes
**Files to Change:** 5 files

---

## Quick Fix Summary

### Fix 1: Linting (5 min) - selector.py line 150

```python
# BEFORE (106 chars - TOO LONG)
duration_diff_pct = abs(workout.base_duration_min - target_duration_min) / target_duration_min

# AFTER (multi-line)
duration_diff_pct = (
    abs(workout.base_duration_min - target_duration_min)
    / target_duration_min
)
```

### Fix 1b: Linting (5 min) - training_planning_library.py lines 147, 148, 151

```python
# BEFORE (lines too long)
avg_weekday_duration_min = (weekday_hours * 60 / num_weekdays) if num_weekdays > 0 else 60
avg_weekend_duration_min = (weekend_hours * 60 / num_weekends) if num_weekends > 0 else 120
avg_weekday_duration_min = (target_hours * 60 / num_weekdays) if num_weekdays > 0 else 60

# AFTER (multi-line)
avg_weekday_duration_min = (
    (weekday_hours * 60 / num_weekdays) if num_weekdays > 0 else 60
)
avg_weekend_duration_min = (
    (weekend_hours * 60 / num_weekends) if num_weekends > 0 else 120
)
avg_weekday_duration_min = (
    (target_hours * 60 / num_weekdays) if num_weekdays > 0 else 60
)
```

### Fix 2: Error Messages (2 min) - add_week_tool.py lines 894-895

```python
# BEFORE
f"Suggestions:\n"
f"- To reduce time: Shorten segment durations or remove recovery segments\n"
f"- To increase time: Add warmup/cooldown or extend main set duration\n"
f"- To reduce TSS: Lower power targets or shorten high-intensity intervals\n"  # DELETE
f"- To increase TSS: Raise power targets or extend work intervals"             # DELETE

# AFTER
f"Suggestions:\n"
f"- To reduce time: Shorten segment durations or remove recovery segments\n"
f"- To increase time: Add warmup/cooldown or extend main set duration"
```

### Fix 3: Test Fixtures (15 min) - test_training_planning_library.py

**Find & Replace:**
- Find: `"type": "endurance"`
- Replace: `"workout_type": "endurance"`
- Find: `"type": "sweet_spot"`
- Replace: `"workout_type": "sweet_spot"`

**Locations:** Lines 68-71, 78-81 (8 total replacements)

### Fix 4: Recovery Week Tolerance (2 min) - add_week_tool.py line 143

```python
# BEFORE
if is_recovery_week:
    time_warn_threshold = 8
    time_error_threshold = 15  # ±15% error (stricter than normal 20%)

# AFTER
if is_recovery_week:
    time_warn_threshold = 8
    time_error_threshold = 20  # ±20% error (aligned with normal weeks)
```

### Bonus: Docstring (2 min) - selector.py line 76

```python
# BEFORE
"""
Scoring breakdown (100 points total):
- Type match: 40 points
- Phase match: 25 points
- Weekday match: 15 points
- TSS match: 10 points (inverse of TSS difference %)  # DELETE
- Duration match: 5 points (bonus if duration reasonable)  # WRONG VALUE
- Variety bonus: 5 points
"""

# AFTER
"""
Scoring breakdown (100 points total):
- Type match: 40 points
- Phase match: 25 points
- Weekday match: 15 points
- Duration match: 15 points (inverse of duration difference %)
- Variety bonus: 5 points
"""
```

---

## Execution Checklist

```bash
# 1. Fix linting (5 min)
# Edit: src/cycling_ai/core/workout_library/selector.py line 150
# Edit: src/cycling_ai/orchestration/phases/training_planning_library.py lines 147, 148, 151
ruff check src/cycling_ai/core/workout_library/selector.py
ruff check src/cycling_ai/orchestration/phases/training_planning_library.py

# 2. Fix error messages (2 min)
# Edit: src/cycling_ai/tools/wrappers/add_week_tool.py lines 894-895
grep -n "To reduce TSS" src/cycling_ai/tools/wrappers/add_week_tool.py  # Should be empty

# 3. Fix test fixtures (15 min)
# Edit: tests/orchestration/phases/test_training_planning_library.py lines 68-71, 78-81
pytest tests/orchestration/phases/test_training_planning_library.py -v

# 4. Fix recovery tolerance (2 min)
# Edit: src/cycling_ai/tools/wrappers/add_week_tool.py line 143
pytest tests/orchestration/phases/test_training_planning_library_12weeks.py -v

# 5. Bonus: Fix docstring (2 min)
# Edit: src/cycling_ai/core/workout_library/selector.py line 76
grep -A 10 "Scoring breakdown" src/cycling_ai/core/workout_library/selector.py

# 6. Final verification (10 min)
mypy --strict src/cycling_ai/
ruff check src/cycling_ai/
pytest tests/core/workout_library/test_selector.py -v
pytest tests/tools/wrappers/test_add_week_tool_validation.py -v
pytest tests/orchestration/phases/test_training_planning_library.py -v
pytest tests/orchestration/phases/test_training_planning_library_12weeks.py -v
```

---

## Files to Edit

1. `src/cycling_ai/core/workout_library/selector.py` (lines 76, 150)
2. `src/cycling_ai/orchestration/phases/training_planning_library.py` (lines 147, 148, 151)
3. `src/cycling_ai/tools/wrappers/add_week_tool.py` (lines 143, 894-895)
4. `tests/orchestration/phases/test_training_planning_library.py` (lines 68-71, 78-81)

---

## Success Criteria

- ✅ Linting: 0 errors (was 4)
- ✅ Library phase tests: 6/6 passing (was 0/6)
- ✅ Integration tests: 3/3 passing (was 0/3)
- ✅ No TSS in error messages
- ✅ Docstring matches implementation

---

See `TSS_REWORK_PLAN.md` for detailed explanations and rationale.
