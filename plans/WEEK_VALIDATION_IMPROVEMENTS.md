# Week Validation Improvements Plan

**Status:** Planning Complete - Ready for Implementation
**Created:** 2025-11-03
**Feature:** Enhanced week validation with 6-day recovery handling and auto-fix capability

---

## Overview

This plan enhances the week validation logic in `add_week_tool.py` to:

1. **Handle 6-day weeks with recovery** - Validate with and without optional recovery workout
2. **Auto-fix time budget violations** - Automatically reduce weekend endurance rides when time exceeds limits
3. **Preserve LLM intent** - Non-destructive approach that tries all options before modifying workouts

---

## Design Principles

1. **Non-destructive validation** - Never modify LLM workouts during validation
2. **Try-without-modification first** - Validate multiple scenarios before failing
3. **Auto-fix is configurable** - Default to auto-fix, but allow strict mode
4. **Recovery marking is UI-only** - Flag for presentation, but validate both ways
5. **Weekend-only for endurance reduction** - If no weekend endurance, fail normally

---

## Feature 1: 6-Workout-Day Recovery Detection

### Goal
If a week has 6 training days and at least one is "recovery", validate the week in **two scenarios**:
1. **With all 6 workouts** (recovery included)
2. **With 5 workouts** (recovery excluded)

If **either** scenario passes validation, mark the week as valid and flag the recovery workout for UI display.

**Note:** If multiple recovery workouts exist in a 6-day week, the **first recovery workout** is used for optional marking.

### Implementation Location
`src/cycling_ai/tools/wrappers/add_week_tool.py`

### Algorithm

```python
def _detect_optional_recovery_workout(
    workouts: list[dict],
    training_days_objects: list[dict],
    week_number: int
) -> tuple[int | None, str | None]:
    """
    Detect if this is a 6-day week with at least 1 recovery workout.

    If multiple recovery workouts exist, returns the first one.

    Returns:
        (recovery_workout_index_or_none, recovery_weekday_or_none)
    """
    # Count non-rest training days from overview
    training_days = [
        day for day in training_days_objects
        if day.get("workout_type") != "rest"
    ]

    if len(training_days) != 6:
        return (None, None)  # Not a 6-day week

    # Check if there are any recovery days
    recovery_days = [
        day for day in training_days
        if day.get("workout_type") == "recovery"
    ]

    if len(recovery_days) == 0:
        return (None, None)  # No recovery days

    # Use the first recovery day if multiple exist
    recovery_weekday = recovery_days[0]["weekday"]

    # Find the recovery workout in the actual workouts list
    for i, workout in enumerate(workouts):
        if workout.get("weekday") == recovery_weekday:
            return (i, recovery_weekday)

    return (None, None)


def _calculate_week_metrics(
    workouts: list[dict],
    current_ftp: float,
    exclude_workout_index: int | None = None
) -> tuple[float, float]:
    """
    Calculate total hours and TSS for a week.

    Args:
        workouts: List of workouts
        current_ftp: Athlete's FTP
        exclude_workout_index: Optional index to exclude from calculation

    Returns:
        (total_hours, actual_tss)
    """
    workouts_to_count = [
        w for i, w in enumerate(workouts)
        if exclude_workout_index is None or i != exclude_workout_index
    ]

    total_duration_min = sum(
        sum(seg.get("duration_min", 0) for seg in workout.get("segments", []))
        for workout in workouts_to_count
    )
    total_hours = total_duration_min / 60.0

    actual_tss = calculate_weekly_tss(workouts_to_count, current_ftp)

    return (total_hours, actual_tss)


def _validate_time_and_tss(
    total_hours: float,
    actual_tss: float,
    target_hours: float | None,
    target_tss: float | None,
    week_number: int,
    is_recovery_week: bool
) -> tuple[list[str], list[str]]:
    """
    Validate time and TSS against targets.

    Returns:
        (warnings, errors)
    """
    validation_warnings = []
    validation_errors = []

    # Phase-aware tolerances
    if is_recovery_week:
        time_warn_threshold = 8
        time_error_threshold = 15
        tss_warn_threshold = 12
        tss_error_threshold = 20
    else:
        time_warn_threshold = 10
        time_error_threshold = 20
        tss_warn_threshold = 15
        tss_error_threshold = 25

    # Check time budget
    if target_hours:
        time_diff_pct = abs(total_hours - target_hours) / target_hours * 100
        if time_diff_pct > time_error_threshold:
            phase_note = " (Recovery week - stricter tolerance)" if is_recovery_week else ""
            validation_errors.append(
                f"Week {week_number} time budget violation: "
                f"Planned {total_hours:.1f}h vs target {target_hours:.1f}h "
                f"({time_diff_pct:.0f}% difference, max {time_error_threshold}% allowed{phase_note})"
            )
        elif time_diff_pct > time_warn_threshold:
            validation_warnings.append(
                f"Week {week_number} time budget warning: "
                f"Planned {total_hours:.1f}h vs target {target_hours:.1f}h "
                f"({time_diff_pct:.0f}% difference, recommend ±{time_warn_threshold}%)"
            )

    # Check TSS target
    if target_tss:
        tss_diff_pct = abs(actual_tss - target_tss) / target_tss * 100
        if tss_diff_pct > tss_error_threshold:
            phase_note = " (Recovery week - stricter tolerance)" if is_recovery_week else ""
            validation_errors.append(
                f"Week {week_number} TSS target violation: "
                f"Actual {actual_tss:.0f} TSS vs target {target_tss:.0f} TSS "
                f"({tss_diff_pct:.0f}% difference, max {tss_error_threshold}% allowed{phase_note})"
            )
        elif tss_diff_pct > tss_warn_threshold:
            validation_warnings.append(
                f"Week {week_number} TSS target warning: "
                f"Actual {actual_tss:.0f} TSS vs target {target_tss:.0f} TSS "
                f"({tss_diff_pct:.0f}% difference, recommend ±{tss_warn_threshold}%)"
            )

    return (validation_warnings, validation_errors)
```

### Integration Logic

Replace current validation block (lines 263-332 in `add_week_tool.py`) with:

```python
# Detect optional recovery workout in 6-day weeks
recovery_workout_idx, recovery_weekday = _detect_optional_recovery_workout(
    workouts, training_days_objects, week_number
)

is_six_day_with_recovery = recovery_workout_idx is not None

# Calculate metrics for both scenarios
scenario_results = []

# Scenario 1: Include all workouts (default)
total_hours_full, actual_tss_full = _calculate_week_metrics(
    workouts, current_ftp, exclude_workout_index=None
)
warnings_full, errors_full = _validate_time_and_tss(
    total_hours_full, actual_tss_full,
    target_hours, target_tss, week_number, is_recovery_week
)
scenario_results.append({
    "name": "all_workouts",
    "total_hours": total_hours_full,
    "actual_tss": actual_tss_full,
    "warnings": warnings_full,
    "errors": errors_full
})

# Scenario 2: If 6-day week with recovery, also validate without recovery
if is_six_day_with_recovery:
    total_hours_no_rec, actual_tss_no_rec = _calculate_week_metrics(
        workouts, current_ftp, exclude_workout_index=recovery_workout_idx
    )
    warnings_no_rec, errors_no_rec = _validate_time_and_tss(
        total_hours_no_rec, actual_tss_no_rec,
        target_hours, target_tss, week_number, is_recovery_week
    )
    scenario_results.append({
        "name": "without_recovery",
        "total_hours": total_hours_no_rec,
        "actual_tss": actual_tss_no_rec,
        "warnings": warnings_no_rec,
        "errors": errors_no_rec
    })

# Determine if week is valid (at least one scenario passes)
valid_scenarios = [s for s in scenario_results if len(s["errors"]) == 0]

if not valid_scenarios:
    # All scenarios failed - check if auto-fix is enabled
    auto_fix_enabled = kwargs.get("auto_fix", True)  # Default: enabled

    if auto_fix_enabled:
        # Try auto-fix for the full workout scenario
        modified_workouts, fix_log = _attempt_auto_fix(
            workouts, target_hours, current_ftp, week_number
        )

        if modified_workouts is not None:
            # Re-validate with fixed workouts
            total_hours_fixed, actual_tss_fixed = _calculate_week_metrics(
                modified_workouts, current_ftp
            )
            warnings_fixed, errors_fixed = _validate_time_and_tss(
                total_hours_fixed, actual_tss_fixed,
                target_hours, target_tss, week_number, is_recovery_week
            )

            if len(errors_fixed) == 0:
                # Auto-fix succeeded!
                workouts = modified_workouts
                logger.info(f"Auto-fix applied: {fix_log}")
                valid_scenarios = [{
                    "name": "auto_fixed",
                    "total_hours": total_hours_fixed,
                    "actual_tss": actual_tss_fixed,
                    "warnings": warnings_fixed,
                    "errors": errors_fixed,
                    "auto_fixed": True,
                    "fix_log": fix_log
                }]

if not valid_scenarios:
    # Still failed after auto-fix attempt - raise error with LLM feedback
    error_msg = "\n".join(scenario_results[0]["errors"])
    logger.error(f"Week {week_number} validation failed:\n{error_msg}")
    raise ValueError(
        f"Week {week_number} validation failed. Please adjust workouts:\n{error_msg}\n\n"
        f"Suggestions:\n"
        f"- To reduce time: Shorten segment durations or remove recovery segments\n"
        f"- To increase time: Add warmup/cooldown or extend main set duration\n"
        f"- To reduce TSS: Lower power targets or shorten high-intensity intervals\n"
        f"- To increase TSS: Raise power targets or extend work intervals"
    )

# Use the best valid scenario for final metrics
best_scenario = valid_scenarios[0]
total_hours = best_scenario["total_hours"]
actual_tss = best_scenario["actual_tss"]
validation_warnings = best_scenario["warnings"]

# Mark recovery workout as optional (UI metadata)
if is_six_day_with_recovery:
    workouts[recovery_workout_idx]["optional"] = True
    workouts[recovery_workout_idx]["optional_reason"] = "Recovery workout in 6-day week"
```

---

## Feature 2: Auto-Fix - Endurance Ride Time Reduction

### Goal
When validation fails due to time constraints, attempt to auto-fix by reducing the longest weekend endurance ride. **Only attempt this if a weekend endurance ride exists.**

### Implementation Location
`src/cycling_ai/tools/wrappers/add_week_tool.py`

### Algorithm

```python
def _attempt_auto_fix(
    workouts: list[dict],
    target_hours: float | None,
    current_ftp: float,
    week_number: int
) -> tuple[list[dict] | None, str]:
    """
    Attempt to auto-fix time budget violations by reducing endurance rides.

    Returns NON-DESTRUCTIVE fix (returns new list, doesn't modify original).

    Returns:
        (modified_workouts_or_none, log_message)
    """
    if target_hours is None:
        return (None, "No target hours to fix against")

    # Calculate current total
    current_total_min = sum(
        sum(seg.get("duration_min", 0) for seg in w.get("segments", []))
        for w in workouts
    )
    current_hours = current_total_min / 60.0

    if current_hours <= target_hours:
        return (None, "No fix needed, already within budget")

    # Find weekend endurance rides
    weekend_endurance = _find_weekend_endurance_rides(workouts)

    if not weekend_endurance:
        return (None, "No weekend endurance rides found to reduce")

    # Sort by duration (longest first)
    weekend_endurance.sort(
        key=lambda x: x["duration_min"],
        reverse=True
    )

    # Work on a copy to avoid modifying original
    workouts_copy = [dict(w) for w in workouts]
    for w in workouts_copy:
        w["segments"] = [dict(seg) for seg in w.get("segments", [])]

    target_idx = weekend_endurance[0]["workout_index"]
    target_workout = workouts_copy[target_idx]

    original_duration = sum(seg["duration_min"] for seg in target_workout["segments"])
    log_steps = []

    # Step 1: Remove warmup/cooldown
    segments = target_workout["segments"]
    new_segments = [
        seg for seg in segments
        if seg.get("type") not in ["warmup", "cooldown"]
    ]

    if len(new_segments) < len(segments):
        removed_time = original_duration - sum(seg["duration_min"] for seg in new_segments)
        target_workout["segments"] = new_segments
        current_total_min -= removed_time
        log_steps.append(f"Removed warmup/cooldown: -{removed_time} min")

    # Step 2: Reduce main block if still over (15 min intervals, min 60 min)
    iteration = 0
    max_iterations = 10

    while current_total_min / 60.0 > target_hours and iteration < max_iterations:
        # Find steady/endurance segments
        main_segments = [
            seg for seg in target_workout["segments"]
            if seg.get("type") in ["steady", "endurance"]
        ]

        if not main_segments:
            break

        # Find longest main segment
        longest_main = max(main_segments, key=lambda s: s.get("duration_min", 0))

        if longest_main["duration_min"] <= 60:  # Minimum 60 min
            log_steps.append(f"Stopped: main block at minimum (60 min)")
            break

        # Reduce by 15 min
        longest_main["duration_min"] -= 15
        current_total_min -= 15
        log_steps.append(f"Reduced main block: -15 min (now {longest_main['duration_min']} min)")
        iteration += 1

    final_hours = current_total_min / 60.0
    new_duration = sum(seg["duration_min"] for seg in target_workout["segments"])

    # Check if fix was successful
    if final_hours > target_hours:
        return (None, f"Auto-fix insufficient: {final_hours:.1f}h still > {target_hours:.1f}h")

    message = (
        f"AUTO-FIX: Reduced {target_workout.get('weekday', 'weekend')} endurance ride "
        f"from {original_duration} min to {new_duration} min. "
        f"Week total: {final_hours:.1f}h (target: {target_hours:.1f}h). "
        f"Steps: {' → '.join(log_steps)}"
    )

    return (workouts_copy, message)


def _find_weekend_endurance_rides(workouts: list[dict]) -> list[dict]:
    """
    Find endurance rides on weekends.

    Returns:
        List of dicts with: workout_index, weekday, duration_min, workout
    """
    weekend_days = {"Saturday", "Sunday"}
    results = []

    for i, workout in enumerate(workouts):
        weekday = workout.get("weekday")
        if weekday not in weekend_days:
            continue

        if not _is_endurance_workout(workout):
            continue

        duration_min = sum(seg.get("duration_min", 0) for seg in workout.get("segments", []))

        results.append({
            "workout_index": i,
            "weekday": weekday,
            "duration_min": duration_min,
            "workout": workout
        })

    return results


def _is_endurance_workout(workout: dict) -> bool:
    """
    Identify if a workout is an endurance ride.

    Checks:
    1. Segment types (steady, endurance)
    2. Power levels (< 80% FTP)
    3. Description keywords (endurance, z2, easy, base)
    """
    segments = workout.get("segments", [])

    if not segments:
        return False

    # Check 1: Description keywords
    description = workout.get("description", "").lower()
    name = workout.get("name", "").lower()
    combined_text = f"{description} {name}"

    endurance_keywords = ["endurance", "z2", "zone 2", "easy", "base", "aerobic"]
    if any(keyword in combined_text for keyword in endurance_keywords):
        return True

    # Check 2: Segment analysis
    endurance_segment_count = 0
    total_duration = 0
    endurance_duration = 0

    for seg in segments:
        seg_type = seg.get("type", "").lower()
        duration = seg.get("duration_min", 0)
        power_pct = seg.get("power_low_pct", 0)

        total_duration += duration

        # Endurance segments: type is "steady" or "endurance" AND power < 80%
        if seg_type in ["steady", "endurance"] and power_pct < 80:
            endurance_segment_count += 1
            endurance_duration += duration

    # Consider it endurance if:
    # - At least 50% of segments are endurance type
    # - OR at least 70% of duration is in endurance zones
    if total_duration == 0:
        return False

    segment_ratio = endurance_segment_count / len(segments)
    duration_ratio = endurance_duration / total_duration

    return segment_ratio >= 0.5 or duration_ratio >= 0.7
```

---

## Feature 3: Configuration Option

### Goal
Make auto-fix configurable with default enabled.

### Implementation

Add configuration parameter to tool:

```python
# In AddWeekDetailsTool.definition property, add parameter:
ToolParameter(
    name="auto_fix",
    type="boolean",
    description=(
        "Enable automatic fixing of time budget violations by reducing endurance rides. "
        "Default: true. Set to false for strict validation mode."
    ),
    required=False,
),
```

This allows the LLM (or user via config) to disable auto-fix:

```python
# Agent can call with:
add_week_details(plan_id="...", week_number=3, workouts=[...], auto_fix=False)
```

---

## Validation Flow (Complete)

```
1. Validate workout structure (existing)
   ↓
2. Detect if 6-day week with recovery
   ↓
3. Calculate metrics for scenarios:
   - Scenario A: All workouts included
   - Scenario B: Recovery excluded (if applicable)
   ↓
4. Validate each scenario (time/TSS)
   ↓
5. Check if ANY scenario passes:
   - YES → Mark recovery as optional (if applicable), save week ✓
   - NO → Proceed to auto-fix (if enabled)
   ↓
6. Auto-fix attempt (only if no scenario passed):
   - Find weekend endurance ride
   - Create modified copy (non-destructive)
   - Remove warmup/cooldown
   - Reduce main block (15 min intervals, min 60 min)
   - Re-validate
   ↓
7. Final check:
   - Auto-fix passed → Save modified workouts with log ✓
   - Auto-fix failed → Raise validation error with LLM feedback ✗
```

---

## Data Structure Changes

### Week Data Saved to JSON

```json
{
  "week_number": 3,
  "workouts": [
    {
      "weekday": "Monday",
      "description": "Recovery spin",
      "optional": true,  // NEW: UI flag for recovery workouts
      "optional_reason": "Recovery workout in 6-day week",  // NEW
      "segments": [...]
    },
    // ... other workouts
  ],
  "validation": {
    "scenario_used": "without_recovery",  // NEW: which scenario passed
    "auto_fixed": false,  // NEW: was auto-fix applied
    "fix_log": null,  // NEW: auto-fix log if applied
    "target_hours": 7.5,
    "actual_hours": 7.3,
    "target_tss": 450,
    "actual_tss": 445,
    "warnings": [],
    "within_tolerance": true
  }
}
```

---

## Testing Strategy

### Test Cases

#### 1. 6-day week scenarios:
- ✅ 6 days, 1 recovery, passes with all workouts → No recovery marking needed
- ✅ 6 days, 1 recovery, passes without recovery → Recovery marked optional
- ✅ 6 days, 1 recovery, fails both scenarios → Proceeds to auto-fix
- ✅ 6 days, 2+ recoveries, uses first recovery for optional marking → First recovery marked optional
- ✅ 6 days, 0 recovery → Normal validation (no special handling)
- ✅ 5 days → Normal validation

#### 2. Auto-fix scenarios:
- ✅ Weekend endurance exists, warmup/cooldown removal fixes → Success
- ✅ Weekend endurance exists, needs main block reduction → Success (reduced by 15 min intervals)
- ✅ Weekend endurance exists, hits 60 min minimum → Stops, may still fail
- ✅ No weekend endurance → Auto-fix skipped, error raised
- ✅ Auto-fix disabled (`auto_fix=false`) → No auto-fix attempt, error raised

#### 3. Edge cases:
- ✅ Multiple weekend endurance rides → Picks longest
- ✅ Endurance ride with no warmup/cooldown → Goes straight to main block reduction
- ✅ Endurance ride < 60 min → Cannot reduce, auto-fix fails
- ✅ Time under target → No auto-fix needed

---

## File Changes Summary

### Modified Files

**`src/cycling_ai/tools/wrappers/add_week_tool.py`** (~500 lines → ~700 lines)
- Add 4 new helper functions:
  - `_detect_optional_recovery_workout()`
  - `_calculate_week_metrics()`
  - `_validate_time_and_tss()`
  - `_attempt_auto_fix()`
  - `_find_weekend_endurance_rides()`
  - `_is_endurance_workout()`
- Refactor validation logic in `execute()` method
- Add `auto_fix` parameter to tool definition

### New Test Files

**`tests/tools/test_add_week_tool_validation.py`** (new file)
- 15-20 test cases covering all scenarios listed above

### UI Changes (Future)

**`templates/training_plan_viewer.html`**
- Display `optional` flag on workouts
- Show "Optional Recovery" badge or similar UI indicator

---

## Implementation Checklist

- [ ] Add helper functions to `add_week_tool.py`
- [ ] Refactor `execute()` method validation logic
- [ ] Add `auto_fix` parameter to tool definition
- [ ] Update validation error messages
- [ ] Write comprehensive test suite
- [ ] Test with real LLM workflow (Anthropic/OpenAI)
- [ ] Update UI to display optional recovery workouts
- [ ] Update documentation
- [ ] Update CLAUDE.md with new validation behavior

---

## Comparison: V1 vs V2

| Aspect | V1 (Original Plan) | V2 (Final Plan) |
|--------|-------------------|-----------------|
| **Recovery marking** | Unclear if affects validation | Validate both ways, UI-only flag |
| **Endurance detection** | Power-based only | Power + description keywords |
| **Weekend-only** | Fallback to any day | Strict weekend-only, no fallback |
| **Auto-fix approach** | Modify during validation | Non-destructive copy, only if needed |
| **LLM workflow** | Auto-fix always | Try scenarios → auto-fix → LLM feedback |
| **Configuration** | Always-on | Configurable (default on) |
| **Data preservation** | Modified in-place | Original preserved until all options exhausted |

---

## Benefits

✅ **Validates 6-day weeks intelligently** - Checks with and without recovery
✅ **Only auto-fixes when necessary** - Tries validation scenarios first
✅ **Preserves LLM intent** - Never modifies original data until all options exhausted
✅ **Weekend-only reduction** - Focused, predictable behavior
✅ **Configurable behavior** - Can disable auto-fix for strict validation
✅ **Rich endurance detection** - Uses power zones AND keywords
✅ **UI metadata only** - Recovery marking doesn't affect validation logic
✅ **Clear audit trail** - Logs all auto-fix operations

---

## Next Steps

1. **Implementation** - Code the helper functions and integration logic
2. **Testing** - Write comprehensive test suite
3. **Integration Testing** - Test with real LLM agents
4. **UI Update** - Add optional workout display to training plan viewer
5. **Documentation** - Update user guide and technical docs

---

**End of Plan**
