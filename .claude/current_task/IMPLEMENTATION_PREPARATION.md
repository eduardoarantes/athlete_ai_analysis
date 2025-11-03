# Week Validation Improvements - Implementation Preparation

**Status:** Ready for Execution
**Created:** 2025-11-03
**Feature:** Enhanced week validation with 6-day recovery handling and auto-fix capability
**Plan Document:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/plans/WEEK_VALIDATION_IMPROVEMENTS.md`

---

## Executive Summary

This implementation adds intelligent week validation to the `add_week_tool.py` that:

1. **Validates 6-day weeks with recovery in dual scenarios** - Tests with and without optional recovery
2. **Auto-fixes time budget violations** - Reduces weekend endurance rides when time exceeds limits
3. **Preserves LLM intent** - Non-destructive approach that exhausts all validation options before modifying workouts
4. **Configurable behavior** - Auto-fix enabled by default, can be disabled for strict validation

**Key Insight:** The current implementation (lines 263-332) performs simple validation. We're replacing it with a sophisticated multi-scenario validation system that tries validation first, then auto-fixes only if necessary.

---

## Architecture Overview

### Current State Analysis

**File:** `src/cycling_ai/tools/wrappers/add_week_tool.py` (448 lines)

**Current Validation Logic (lines 263-332):**
- Calculates total hours and TSS
- Validates against targets with phase-aware tolerances
- Raises error immediately on violation
- No auto-fix capability
- No multi-scenario handling

**Key Dependencies:**
- `calculate_weekly_tss()` from `src/cycling_ai/core/tss.py` (lines 84-105)
- Phase-aware tolerance thresholds (lines 267-280)
- Validation error messages (lines 325-332)

### Target State Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  add_week_details (execute)                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         v
         ┌───────────────────────────────┐
         │  _detect_optional_recovery    │ ← NEW
         │  (6-day week with recovery?)  │
         └──────────────┬────────────────┘
                        │
         ┌──────────────┴───────────────┐
         │                              │
         v                              v
  ┌──────────────────┐        ┌──────────────────┐
  │ Scenario 1:      │        │ Scenario 2:      │
  │ All workouts     │        │ Exclude recovery │ ← NEW
  └────────┬─────────┘        └────────┬─────────┘
           │                           │
           v                           v
  ┌─────────────────────────────────────────────┐
  │  _calculate_week_metrics()                  │ ← NEW
  │  (Calculate hours + TSS, optional exclude)  │
  └────────────────────┬────────────────────────┘
                       │
                       v
  ┌─────────────────────────────────────────────┐
  │  _validate_time_and_tss()                   │ ← NEW
  │  (Phase-aware tolerances)                   │
  └────────────────────┬────────────────────────┘
                       │
         ┌─────────────┴──────────────┐
         │                            │
         v                            v
  ┌─────────────┐            ┌────────────────┐
  │ Any scenario│            │ All scenarios  │
  │ passed?     │            │ failed?        │
  └──────┬──────┘            └────────┬───────┘
         │ YES                        │ YES
         v                            v
  ┌─────────────┐            ┌────────────────────┐
  │ Save week   │            │ _attempt_auto_fix()│ ← NEW
  │ Mark recovery│           │ (weekend endurance)│
  │ as optional │            └────────┬───────────┘
  └─────────────┘                     │
                          ┌───────────┴────────────┐
                          │                        │
                          v                        v
                   ┌─────────────┐         ┌─────────────┐
                   │ Fix passed? │         │ Fix failed? │
                   └──────┬──────┘         └──────┬──────┘
                          │ YES                   │ YES
                          v                       v
                   ┌─────────────┐         ┌─────────────┐
                   │ Save with   │         │ Raise error │
                   │ modified    │         │ with LLM    │
                   │ workouts    │         │ feedback    │
                   └─────────────┘         └─────────────┘
```

---

## Implementation Strategy

### Phase 1: Add Helper Functions (6 functions)

All helper functions will be added at module level, before the `AddWeekDetailsTool` class definition (before line 51).

#### Function 1: `_detect_optional_recovery_workout()`

**Purpose:** Detect if week has 6 training days with at least 1 recovery workout

**Location:** Add at line 51 (before class definition)

**Signature:**
```python
def _detect_optional_recovery_workout(
    workouts: list[dict[str, Any]],
    training_days_objects: list[dict[str, Any]],
    week_number: int
) -> tuple[int | None, str | None]:
    """
    Detect if this is a 6-day week with at least 1 recovery workout.

    If multiple recovery workouts exist, returns the first one.

    Args:
        workouts: List of workout dictionaries
        training_days_objects: Week overview training days (with workout_type)
        week_number: Current week number (for logging)

    Returns:
        (recovery_workout_index_or_none, recovery_weekday_or_none)
    """
```

**Implementation Notes:**
- Count non-rest training days from `training_days_objects`
- Return `(None, None)` if not exactly 6 training days
- Return `(None, None)` if no recovery workout_type found
- Find first recovery day's weekday
- Match weekday to workout in `workouts` list
- Return `(workout_index, weekday)` for first recovery

**Dependencies:** None

**Test Coverage:**
- 6 days, 1 recovery → Returns (index, weekday)
- 6 days, 2 recoveries → Returns first recovery
- 6 days, 0 recoveries → Returns (None, None)
- 5 days, 1 recovery → Returns (None, None)
- 7 days, 1 recovery → Returns (None, None)

---

#### Function 2: `_calculate_week_metrics()`

**Purpose:** Calculate total hours and TSS for a week, optionally excluding a workout

**Location:** Add after `_detect_optional_recovery_workout()`

**Signature:**
```python
def _calculate_week_metrics(
    workouts: list[dict[str, Any]],
    current_ftp: float,
    exclude_workout_index: int | None = None
) -> tuple[float, float]:
    """
    Calculate total hours and TSS for a week.

    Args:
        workouts: List of workout dictionaries
        current_ftp: Athlete's FTP
        exclude_workout_index: Optional workout index to exclude from calculation

    Returns:
        (total_hours, actual_tss)
    """
```

**Implementation Notes:**
- Filter workouts if `exclude_workout_index` provided
- Sum all segment durations → convert to hours
- Call `calculate_weekly_tss()` from `cycling_ai.core.tss`
- Return both metrics as tuple

**Dependencies:**
- `calculate_weekly_tss` from `src/cycling_ai/core/tss.py`

**Test Coverage:**
- Calculate with all workouts
- Calculate excluding index 0
- Calculate excluding index 2
- Empty workouts list → (0.0, 0.0)

---

#### Function 3: `_validate_time_and_tss()`

**Purpose:** Validate time and TSS against targets with phase-aware tolerances

**Location:** Add after `_calculate_week_metrics()`

**Signature:**
```python
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

    Args:
        total_hours: Calculated total hours
        actual_tss: Calculated TSS
        target_hours: Target hours (optional)
        target_tss: Target TSS (optional)
        week_number: Week number for error messages
        is_recovery_week: If True, use stricter tolerances

    Returns:
        (warnings, errors)
    """
```

**Implementation Notes:**
- Extract tolerance logic from current lines 267-314
- Return warnings and errors as separate lists
- Use same phase-aware thresholds:
  - Recovery: time (8%, 15%), TSS (12%, 20%)
  - Normal: time (10%, 20%), TSS (15%, 25%)
- Return empty lists if no targets provided

**Dependencies:** None (pure logic)

**Test Coverage:**
- Within tolerance → ([], [])
- Warning threshold exceeded → ([warning], [])
- Error threshold exceeded → ([], [error])
- Recovery week stricter → Test with 16% difference (error for recovery, warning for normal)
- No targets → ([], [])

---

#### Function 4: `_is_endurance_workout()`

**Purpose:** Identify if a workout is an endurance ride

**Location:** Add after `_validate_time_and_tss()`

**Signature:**
```python
def _is_endurance_workout(workout: dict[str, Any]) -> bool:
    """
    Identify if a workout is an endurance ride.

    Checks:
    1. Description/name keywords (endurance, z2, easy, base, aerobic)
    2. Segment types (steady, endurance) AND power < 80% FTP
    3. At least 50% of segments are endurance type OR
       At least 70% of duration is in endurance zones

    Args:
        workout: Workout dictionary with segments, description, name

    Returns:
        True if workout is endurance ride
    """
```

**Implementation Notes:**
- Check for keywords: ["endurance", "z2", "zone 2", "easy", "base", "aerobic"]
- If keyword found → return True
- Analyze segments for type + power_low_pct < 80
- Calculate segment_ratio and duration_ratio
- Return True if segment_ratio >= 0.5 OR duration_ratio >= 0.7

**Dependencies:** None

**Test Coverage:**
- Keyword in description → True
- 80% segments endurance type → True
- 75% duration in endurance zones → True
- High-power intervals → False
- Empty segments → False

---

#### Function 5: `_find_weekend_endurance_rides()`

**Purpose:** Find endurance rides scheduled on weekends

**Location:** Add after `_is_endurance_workout()`

**Signature:**
```python
def _find_weekend_endurance_rides(workouts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Find endurance rides on weekends.

    Args:
        workouts: List of workout dictionaries

    Returns:
        List of dicts with:
        - workout_index: int
        - weekday: str
        - duration_min: int
        - workout: dict (reference to original workout)
    """
```

**Implementation Notes:**
- Weekend days: {"Saturday", "Sunday"}
- Filter by weekday
- Use `_is_endurance_workout()` to validate
- Calculate total duration from segments
- Return list sorted by duration (longest first)

**Dependencies:**
- `_is_endurance_workout()`

**Test Coverage:**
- Saturday endurance → Found
- Sunday endurance → Found
- Saturday intervals → Not found
- Monday endurance → Not found
- Multiple weekend endurance → Returns sorted by duration

---

#### Function 6: `_attempt_auto_fix()`

**Purpose:** Auto-fix time budget violations by reducing weekend endurance rides

**Location:** Add after `_find_weekend_endurance_rides()`

**Signature:**
```python
def _attempt_auto_fix(
    workouts: list[dict[str, Any]],
    target_hours: float | None,
    current_ftp: float,
    week_number: int
) -> tuple[list[dict[str, Any]] | None, str]:
    """
    Attempt to auto-fix time budget violations by reducing endurance rides.

    NON-DESTRUCTIVE: Returns new list, doesn't modify original.

    Strategy:
    1. Find longest weekend endurance ride
    2. Remove warmup/cooldown segments
    3. Reduce main block by 15-minute intervals (minimum 60 min)
    4. Stop if total hours <= target_hours

    Args:
        workouts: Original workout list (NOT modified)
        target_hours: Target hours to achieve
        current_ftp: FTP for TSS calculation
        week_number: Week number for logging

    Returns:
        (modified_workouts_or_none, log_message)
        - Returns (None, reason) if fix not possible or not needed
        - Returns (new_workouts, log) if fix successful
    """
```

**Implementation Notes:**
- Return `(None, "No target hours")` if no target
- Calculate current hours
- Return `(None, "Already within budget")` if already under
- Use `_find_weekend_endurance_rides()` to find candidates
- Return `(None, "No weekend endurance")` if none found
- Deep copy workouts (NOT in-place modification)
- Remove warmup/cooldown segments
- Reduce main segments by 15 min iterations (max 10 iterations)
- Stop at 60 min minimum
- Return `(None, "Auto-fix insufficient")` if still over target
- Return `(modified_workouts, detailed_log)` on success

**Dependencies:**
- `_find_weekend_endurance_rides()`

**Test Coverage:**
- No target → (None, log)
- Already under budget → (None, log)
- No weekend endurance → (None, log)
- Warmup/cooldown removal fixes → (modified, log)
- Main block reduction needed → (modified, log)
- Hits 60 min minimum → (None, log)
- Successful reduction → Verify new hours match target

---

### Phase 2: Refactor `execute()` Method Validation

**Target Section:** Lines 263-332 in `add_week_tool.py`

**Current Code Block:**
```python
# Calculate actual weekly metrics
total_duration_min = sum(
    sum(seg.get("duration_min", 0) for seg in workout.get("segments", []))
    for workout in workouts
)
total_hours = total_duration_min / 60.0

# Calculate actual TSS
actual_tss = calculate_weekly_tss(workouts, current_ftp)

# Validation warnings/errors
validation_warnings = []
validation_errors = []

# Phase-aware tolerance: stricter for Recovery/Taper weeks
# ... (lines 267-314)

# Log warnings
if validation_warnings:
    for warning in validation_warnings:
        logger.warning(warning)

# Fail if validation errors
if validation_errors:
    error_msg = "\n".join(validation_errors)
    logger.error(f"Week {week_number} validation failed:\n{error_msg}")
    raise ValueError(...)
```

**Replacement Strategy:**

Replace lines 253-332 with new multi-scenario validation logic:

```python
# --- Multi-Scenario Validation with Auto-Fix ---

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
    logger.info(
        f"6-day week with recovery detected. Validating both scenarios:\n"
        f"  - All workouts: {total_hours_full:.1f}h, {actual_tss_full:.0f} TSS\n"
        f"  - Without recovery: {total_hours_no_rec:.1f}h, {actual_tss_no_rec:.0f} TSS"
    )

# Determine if week is valid (at least one scenario passes)
valid_scenarios = [s for s in scenario_results if len(s["errors"]) == 0]

if not valid_scenarios:
    # All scenarios failed - check if auto-fix is enabled
    auto_fix_enabled = kwargs.get("auto_fix", True)  # Default: enabled

    if auto_fix_enabled:
        logger.info(f"Week {week_number} validation failed in all scenarios. Attempting auto-fix...")

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
        else:
            logger.info(f"Auto-fix not possible: {fix_log}")

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

# Log warnings from best scenario
if validation_warnings:
    for warning in validation_warnings:
        logger.warning(warning)

# Mark recovery workout as optional (UI metadata only)
if is_six_day_with_recovery and best_scenario["name"] == "without_recovery":
    workouts[recovery_workout_idx]["optional"] = True
    workouts[recovery_workout_idx]["optional_reason"] = "Recovery workout in 6-day week"
    logger.info(
        f"Recovery workout on {recovery_weekday} marked as optional "
        f"(week validated with 5 workouts)"
    )

# --- End Multi-Scenario Validation ---
```

**Integration Points:**
- Line 250: `current_ftp = overview_data.get("target_ftp", 250)`
- Line 251: `week_phase = week_overview.get("phase", "").lower()`
- Line 268: `is_recovery_week = week_phase in ["recovery", "taper"]`
- Line 198: `training_days_objects` already extracted
- Line 334: Continue with existing `week_data` creation

**Key Changes:**
1. Replace simple calculation with multi-scenario system
2. Add auto-fix capability with detailed logging
3. Add recovery workout marking
4. Preserve all existing validation logic (just refactored)

---

### Phase 3: Add `auto_fix` Parameter to Tool Definition

**Target:** `AddWeekDetailsTool.definition` property (lines 60-124)

**Current Parameters End:** Line 122 (after `workouts` parameter)

**Add New Parameter:**

After line 122, before the closing `]`:

```python
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

**Note:** This parameter is optional and defaults to `True` in the validation logic (line in new code: `auto_fix_enabled = kwargs.get("auto_fix", True)`)

---

### Phase 4: Update Result Data Structure

**Target:** Lines 334-420 (week data and result construction)

**Current Code (line 335-338):**
```python
# Create week data structure
week_data = {
    "week_number": week_number,
    "workouts": workouts,
}
```

**Enhanced Version:**
```python
# Create week data structure
week_data = {
    "week_number": week_number,
    "workouts": workouts,  # May contain workouts with "optional": True
}
```

**Current Result Data (lines 394-413):**
```python
return ToolExecutionResult(
    success=True,
    data={
        "plan_id": plan_id,
        "week_number": week_number,
        "workouts_added": len(workouts),
        "weeks_completed": weeks_completed,
        "weeks_remaining": weeks_remaining,
        "total_weeks": total_weeks,
        "next_step": next_step,
        "message": success_message,
        "validation": {
            "target_hours": target_hours,
            "actual_hours": round(total_hours, 1),
            "target_tss": target_tss,
            "actual_tss": round(actual_tss, 1),
            "warnings": validation_warnings,
            "within_tolerance": len(validation_warnings) == 0,
        },
    },
    ...
)
```

**Enhanced Version:**
```python
return ToolExecutionResult(
    success=True,
    data={
        "plan_id": plan_id,
        "week_number": week_number,
        "workouts_added": len(workouts),
        "weeks_completed": weeks_completed,
        "weeks_remaining": weeks_remaining,
        "total_weeks": total_weeks,
        "next_step": next_step,
        "message": success_message,
        "validation": {
            "scenario_used": best_scenario["name"],  # NEW
            "auto_fixed": best_scenario.get("auto_fixed", False),  # NEW
            "fix_log": best_scenario.get("fix_log"),  # NEW
            "target_hours": target_hours,
            "actual_hours": round(total_hours, 1),
            "target_tss": target_tss,
            "actual_tss": round(actual_tss, 1),
            "warnings": validation_warnings,
            "within_tolerance": len(validation_warnings) == 0,
        },
    },
    ...
)
```

---

## File Modification Summary

### Modified Files

#### 1. `src/cycling_ai/tools/wrappers/add_week_tool.py`

**Current:** 448 lines
**Expected:** ~750 lines (+300 lines)

**Changes:**
1. **Add 6 helper functions** (lines 25-250, ~225 lines):
   - `_detect_optional_recovery_workout()` (~30 lines)
   - `_calculate_week_metrics()` (~20 lines)
   - `_validate_time_and_tss()` (~50 lines)
   - `_is_endurance_workout()` (~35 lines)
   - `_find_weekend_endurance_rides()` (~25 lines)
   - `_attempt_auto_fix()` (~65 lines)

2. **Add `auto_fix` parameter** to tool definition (line 122+, ~8 lines)

3. **Refactor validation logic** in `execute()` method (lines 253-332 → ~120 lines)

4. **Enhance result data** with validation metadata (lines 394-413, +3 fields)

**Integration Points:**
- Import section (line 8-22): No changes needed
- Helper functions: Add before class definition (line 51)
- Tool parameters: Add at end of parameters list (line 122)
- Validation logic: Replace lines 253-332
- Result data: Enhance validation dict (lines 405-412)

---

### New Test Files

#### 1. `tests/tools/wrappers/test_add_week_tool_validation.py`

**Expected:** ~800-1000 lines (comprehensive test coverage)

**Test Structure:**

```python
"""
Unit tests for add_week_tool.py validation enhancements.

Tests:
- 6-day week recovery detection
- Multi-scenario validation
- Auto-fix functionality
- Endurance workout identification
"""
import json
import tempfile
from pathlib import Path
import pytest

from cycling_ai.tools.wrappers.add_week_tool import (
    AddWeekDetailsTool,
    _detect_optional_recovery_workout,
    _calculate_week_metrics,
    _validate_time_and_tss,
    _is_endurance_workout,
    _find_weekend_endurance_rides,
    _attempt_auto_fix,
)

# Test fixtures
@pytest.fixture
def temp_dir():
    """Create temporary directory for test files."""
    ...

@pytest.fixture
def sample_workouts():
    """Sample workouts for testing."""
    ...

@pytest.fixture
def sample_overview_data():
    """Sample plan overview data."""
    ...

# Test classes
class TestDetectOptionalRecoveryWorkout:
    """Tests for _detect_optional_recovery_workout()"""

    def test_six_day_with_one_recovery(self):
        """6 days, 1 recovery → Returns (index, weekday)"""
        ...

    def test_six_day_with_multiple_recoveries(self):
        """6 days, 2+ recoveries → Returns first recovery"""
        ...

    def test_six_day_no_recovery(self):
        """6 days, 0 recoveries → Returns (None, None)"""
        ...

    def test_five_day_with_recovery(self):
        """5 days, 1 recovery → Returns (None, None)"""
        ...

    def test_seven_day_with_recovery(self):
        """7 days → Returns (None, None)"""
        ...

class TestCalculateWeekMetrics:
    """Tests for _calculate_week_metrics()"""

    def test_calculate_all_workouts(self):
        """Calculate with all workouts"""
        ...

    def test_calculate_exclude_workout(self):
        """Calculate excluding specific workout"""
        ...

    def test_empty_workouts(self):
        """Empty list → (0.0, 0.0)"""
        ...

class TestValidateTimeAndTSS:
    """Tests for _validate_time_and_tss()"""

    def test_within_tolerance(self):
        """Within tolerance → ([], [])"""
        ...

    def test_warning_threshold(self):
        """Warning threshold exceeded → ([warning], [])"""
        ...

    def test_error_threshold(self):
        """Error threshold exceeded → ([], [error])"""
        ...

    def test_recovery_week_stricter(self):
        """Recovery week uses stricter tolerances"""
        ...

    def test_no_targets(self):
        """No targets → ([], [])"""
        ...

class TestIsEnduranceWorkout:
    """Tests for _is_endurance_workout()"""

    def test_keyword_detection(self):
        """Keyword in description → True"""
        ...

    def test_segment_type_ratio(self):
        """80% endurance segments → True"""
        ...

    def test_duration_ratio(self):
        """75% duration in endurance zones → True"""
        ...

    def test_high_power_intervals(self):
        """High-power intervals → False"""
        ...

    def test_empty_segments(self):
        """Empty segments → False"""
        ...

class TestFindWeekendEnduranceRides:
    """Tests for _find_weekend_endurance_rides()"""

    def test_saturday_endurance(self):
        """Saturday endurance → Found"""
        ...

    def test_sunday_endurance(self):
        """Sunday endurance → Found"""
        ...

    def test_saturday_intervals(self):
        """Saturday intervals → Not found"""
        ...

    def test_monday_endurance(self):
        """Monday endurance → Not found"""
        ...

    def test_multiple_weekend_endurance(self):
        """Multiple weekend rides → Sorted by duration"""
        ...

class TestAttemptAutoFix:
    """Tests for _attempt_auto_fix()"""

    def test_no_target(self):
        """No target → (None, reason)"""
        ...

    def test_already_under_budget(self):
        """Already under budget → (None, reason)"""
        ...

    def test_no_weekend_endurance(self):
        """No weekend endurance → (None, reason)"""
        ...

    def test_warmup_cooldown_removal_fixes(self):
        """Removing warmup/cooldown brings under budget → Success"""
        ...

    def test_main_block_reduction_needed(self):
        """Main block reduction needed → Success"""
        ...

    def test_hits_minimum_duration(self):
        """Hits 60 min minimum → (None, reason)"""
        ...

    def test_non_destructive(self):
        """Original workouts not modified"""
        ...

class TestAddWeekDetailsToolIntegration:
    """Integration tests for complete workflow"""

    def test_six_day_passes_with_all_workouts(self):
        """6 days, 1 recovery, passes with all → No optional marking"""
        ...

    def test_six_day_passes_without_recovery(self):
        """6 days, 1 recovery, passes without → Recovery marked optional"""
        ...

    def test_six_day_fails_both_scenarios_auto_fix(self):
        """6 days, fails both → Auto-fix applied"""
        ...

    def test_auto_fix_disabled(self):
        """auto_fix=False → No auto-fix, error raised"""
        ...

    def test_auto_fix_successful(self):
        """Auto-fix reduces endurance ride → Success"""
        ...

    def test_auto_fix_insufficient(self):
        """Auto-fix can't reach target → Error raised"""
        ...
```

**Test Data Requirements:**
- Sample plan overview with `target_hours`, `target_tss`, `training_days`
- Sample workouts with various configurations (5-day, 6-day, 7-day)
- Sample endurance workouts (weekend, weekday)
- Sample interval workouts (high power)
- Sample recovery workouts

**Fixtures:**
- `temp_dir`: Temporary directory for plan files
- `sample_overview_data`: Plan overview JSON
- `sample_workouts_6_day_recovery`: 6-day week with 1 recovery
- `sample_workouts_6_day_multiple_recovery`: 6-day week with 2 recoveries
- `sample_workouts_5_day`: 5-day week
- `sample_weekend_endurance`: Weekend endurance workout
- `sample_high_power_workout`: Interval workout

---

## Testing Strategy

### Unit Tests (New File)

**File:** `tests/tools/wrappers/test_add_week_tool_validation.py`

**Coverage Goals:**
- Helper functions: 100% coverage
- Integration scenarios: 95% coverage
- Edge cases: All covered

**Test Categories:**

1. **Recovery Detection Tests** (5 tests)
   - 6-day with 1 recovery
   - 6-day with multiple recoveries
   - 6-day no recovery
   - 5-day with recovery
   - 7-day with recovery

2. **Metrics Calculation Tests** (3 tests)
   - All workouts
   - Exclude specific workout
   - Empty list

3. **Validation Tests** (5 tests)
   - Within tolerance
   - Warning threshold
   - Error threshold
   - Recovery week stricter
   - No targets

4. **Endurance Detection Tests** (5 tests)
   - Keyword detection
   - Segment type ratio
   - Duration ratio
   - High power intervals
   - Empty segments

5. **Weekend Endurance Finding Tests** (5 tests)
   - Saturday endurance
   - Sunday endurance
   - Saturday intervals
   - Monday endurance
   - Multiple weekend rides

6. **Auto-Fix Tests** (7 tests)
   - No target
   - Already under budget
   - No weekend endurance
   - Warmup/cooldown removal
   - Main block reduction
   - Minimum duration hit
   - Non-destructive

7. **Integration Tests** (6 tests)
   - 6-day passes all workouts
   - 6-day passes without recovery
   - 6-day fails both, auto-fix
   - Auto-fix disabled
   - Auto-fix successful
   - Auto-fix insufficient

**Total:** ~36 test cases

### Integration Testing

**Existing Tests to Update:**
- Check if `tests/tools/wrappers/test_add_week_tool.py` exists (currently doesn't)
- If exists, update to handle new validation flow
- If not exists, consider creating basic integration tests

**Manual Testing:**
1. Run with real LLM (Anthropic Claude)
2. Test 6-day week generation
3. Test auto-fix with oversized weeks
4. Test auto-fix disabled mode
5. Verify UI displays optional recovery correctly

---

## Dependencies & Risks

### Dependencies

**Internal:**
- `calculate_weekly_tss()` from `src/cycling_ai/core/tss.py` (already used)
- No new external dependencies needed

**Data Flow:**
- `training_days_objects` must be list of dicts with `workout_type` field
  - Verified in git history: Changed to this format in commit `54b747b`
  - Current format: `[{"weekday": "Monday", "workout_type": "endurance"}, ...]`

### Potential Risks

#### Risk 1: Deep Copy Performance
**Issue:** Deep copying workouts for auto-fix may be slow for large weeks
**Mitigation:**
- Workout objects are small (typically 3-6 workouts per week)
- Segments typically < 10 per workout
- Performance impact negligible
**Severity:** LOW

#### Risk 2: LLM May Not Understand Optional Recovery
**Issue:** LLM might be confused by `optional: true` metadata
**Mitigation:**
- This is UI-only metadata, doesn't affect validation
- LLM sees the workout was accepted
- Documentation should clarify this is for UI rendering
**Severity:** LOW

#### Risk 3: Auto-Fix Might Over-Reduce Endurance Rides
**Issue:** Reducing to 60 min minimum might be too aggressive
**Mitigation:**
- 60 min is minimum effective endurance ride duration
- LLM can regenerate if needed
- Auto-fix can be disabled
**Severity:** MEDIUM - Monitor in testing

#### Risk 4: Endurance Detection May Miss Edge Cases
**Issue:** Complex workouts might not be detected correctly
**Mitigation:**
- Uses multiple heuristics (keywords + power + duration)
- Conservative thresholds (50% segments OR 70% duration)
- If misdetected, auto-fix won't trigger (safe failure)
**Severity:** LOW

#### Risk 5: Backward Compatibility
**Issue:** Existing plans might break with new validation
**Mitigation:**
- New validation is MORE permissive (tries multiple scenarios)
- Auto-fix helps marginal cases pass
- Existing plans won't be affected (already saved)
**Severity:** VERY LOW

### Testing Validation

**Pre-Implementation Checklist:**
- [ ] Verify `training_days_objects` format in existing data
- [ ] Confirm `calculate_weekly_tss()` signature hasn't changed
- [ ] Check for any mypy type issues with new functions

**Post-Implementation Checklist:**
- [ ] All 36 unit tests pass
- [ ] Type checking: `mypy src/cycling_ai/tools/wrappers/add_week_tool.py --strict`
- [ ] Integration test with real LLM
- [ ] Test with existing plan data (backward compatibility)
- [ ] UI displays optional recovery correctly

---

## Implementation Checklist

### Phase 1: Add Helper Functions
- [ ] Add `_detect_optional_recovery_workout()` (line 25)
- [ ] Add `_calculate_week_metrics()` (after above)
- [ ] Add `_validate_time_and_tss()` (after above)
- [ ] Add `_is_endurance_workout()` (after above)
- [ ] Add `_find_weekend_endurance_rides()` (after above)
- [ ] Add `_attempt_auto_fix()` (after above)
- [ ] Add type hints: `from typing import Any` (line 12)

### Phase 2: Refactor Validation Logic
- [ ] Replace lines 253-332 with multi-scenario validation
- [ ] Add logging for scenario validation
- [ ] Add logging for auto-fix attempts
- [ ] Add logging for recovery workout marking

### Phase 3: Add Configuration Parameter
- [ ] Add `auto_fix` parameter to tool definition (line 122+)
- [ ] Update tool description to mention auto-fix

### Phase 4: Update Result Data
- [ ] Add `scenario_used` to validation dict
- [ ] Add `auto_fixed` to validation dict
- [ ] Add `fix_log` to validation dict

### Phase 5: Testing
- [ ] Create `tests/tools/wrappers/test_add_week_tool_validation.py`
- [ ] Write recovery detection tests (5 tests)
- [ ] Write metrics calculation tests (3 tests)
- [ ] Write validation tests (5 tests)
- [ ] Write endurance detection tests (5 tests)
- [ ] Write weekend endurance finding tests (5 tests)
- [ ] Write auto-fix tests (7 tests)
- [ ] Write integration tests (6 tests)
- [ ] Run full test suite: `pytest tests/tools/wrappers/test_add_week_tool_validation.py -v`
- [ ] Run type checking: `mypy src/cycling_ai/tools/wrappers/add_week_tool.py --strict`
- [ ] Run coverage: `pytest --cov=src/cycling_ai/tools/wrappers/add_week_tool.py --cov-report=html`

### Phase 6: Documentation
- [ ] Update CLAUDE.md with new validation behavior
- [ ] Update function docstrings
- [ ] Add inline comments for complex logic
- [ ] Update plan document with implementation status

### Phase 7: Integration Testing
- [ ] Test with Anthropic Claude (real LLM)
- [ ] Test 6-day week generation
- [ ] Test auto-fix with oversized weeks
- [ ] Test auto-fix disabled mode
- [ ] Test backward compatibility with existing plans

---

## Key Implementation Notes

### Type Safety Requirements

**All functions must have complete type hints:**
```python
def _detect_optional_recovery_workout(
    workouts: list[dict[str, Any]],  # NOT list[dict]
    training_days_objects: list[dict[str, Any]],
    week_number: int
) -> tuple[int | None, str | None]:  # NOT tuple[Optional[int], Optional[str]]
```

**Use `from typing import Any` (already imported at line 12)**

### Logging Best Practices

**Use structured logging:**
```python
logger.info(
    f"6-day week with recovery detected:\n"
    f"  - Recovery workout: {recovery_weekday} (index {recovery_workout_idx})\n"
    f"  - Scenario 1: {total_hours_full:.1f}h, {actual_tss_full:.0f} TSS\n"
    f"  - Scenario 2: {total_hours_no_rec:.1f}h, {actual_tss_no_rec:.0f} TSS"
)
```

**Log auto-fix attempts:**
```python
logger.info(f"Auto-fix applied: {fix_log}")
logger.info(f"Auto-fix not possible: {fix_log}")
```

### Error Messages for LLM

**Provide actionable feedback:**
```python
raise ValueError(
    f"Week {week_number} validation failed. Please adjust workouts:\n{error_msg}\n\n"
    f"Suggestions:\n"
    f"- To reduce time: Shorten segment durations or remove recovery segments\n"
    f"- To increase time: Add warmup/cooldown or extend main set duration\n"
    f"- To reduce TSS: Lower power targets or shorten high-intensity intervals\n"
    f"- To increase TSS: Raise power targets or extend work intervals"
)
```

### Non-Destructive Pattern

**CRITICAL: Never modify original data during validation:**
```python
# BAD - modifies original
workouts[0]["duration_min"] -= 15

# GOOD - creates copy
workouts_copy = [dict(w) for w in workouts]
for w in workouts_copy:
    w["segments"] = [dict(seg) for seg in w.get("segments", [])]
```

---

## Expected Outcomes

### Success Criteria

1. **All tests pass** - 36 unit tests + integration tests
2. **Type checking passes** - `mypy --strict` with no errors
3. **Coverage target met** - 95%+ for new code
4. **LLM integration works** - Test with Anthropic Claude
5. **Backward compatible** - Existing plans work unchanged
6. **UI displays correctly** - Optional recovery shown with badge

### Performance Expectations

- **Validation time:** < 100ms per week (negligible overhead)
- **Auto-fix time:** < 50ms (single deep copy + iteration)
- **Total overhead:** < 150ms per week (acceptable)

### Quality Metrics

- **Code coverage:** 95%+ on new functions
- **Type safety:** 100% type hint coverage
- **Documentation:** All functions have docstrings
- **Tests:** All edge cases covered

---

## Next Steps for Executor Agent

1. **Start with Phase 1** - Add all 6 helper functions
   - Each function is independent
   - Test as you go with temporary test scripts
   - Verify type hints are correct

2. **Phase 2** - Refactor validation logic
   - Replace lines 253-332 in one atomic change
   - Test with existing plan data
   - Verify logging output

3. **Phase 3** - Add parameter
   - Simple addition to tool definition
   - No complex logic

4. **Phase 4** - Update result data
   - Add 3 fields to validation dict
   - Verify JSON serialization

5. **Phase 5** - Write comprehensive tests
   - Start with unit tests for helper functions
   - Then integration tests
   - Run coverage report

6. **Phase 6** - Documentation and cleanup
   - Update CLAUDE.md
   - Clean up any TODOs
   - Final type checking

7. **Phase 7** - Integration testing
   - Test with real LLM
   - Manual testing scenarios
   - Performance validation

---

## Questions & Clarifications

### Q1: Should auto-fix apply to TSS violations?
**A:** No. Auto-fix only targets time budget violations by reducing duration. TSS violations are harder to auto-fix because they require changing power targets, which alters workout intent more significantly. Keep auto-fix focused on duration reduction.

### Q2: What if multiple recovery workouts exist in 6-day week?
**A:** Use the **first** recovery workout found for optional marking. This is simpler and predictable. Document this behavior clearly.

### Q3: Should we support weekday endurance reduction as fallback?
**A:** No. Keep it weekend-only for predictability. If no weekend endurance exists, auto-fix returns `(None, "No weekend endurance")` and validation fails with LLM feedback.

### Q4: What's the minimum endurance ride duration?
**A:** 60 minutes. This is the minimum effective endurance ride duration. Below this, the workout loses its endurance training value.

### Q5: Should optional recovery affect TSS calculation?
**A:** No. The UI flag is metadata only. TSS and hours are calculated based on the scenario that passed validation (which may or may not include the recovery workout).

---

**End of Implementation Preparation Document**

**Ready for Execution:** YES
**Estimated Implementation Time:** 4-6 hours
**Estimated Testing Time:** 3-4 hours
**Total:** 7-10 hours

**Executor Agent:** Proceed with Phase 1 - Add helper functions. Test each function individually before moving to Phase 2.
