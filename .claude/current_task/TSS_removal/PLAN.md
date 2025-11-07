# TSS Restriction Removal and Time-Based Constraints Implementation Plan

**Date:** 2025-11-04
**Status:** Preparation Complete - Ready for Implementation
**Complexity:** Medium (touching multiple layers but well-isolated changes)
**Estimated Effort:** 6-8 hours implementation + 2-3 hours testing

---

## Executive Summary

### Current State
The training plan generation system currently uses **TSS (Training Stress Score)** as the primary constraint for:
- Weekly workout volume targets
- Individual workout selection from library
- Validation of generated plans
- LLM prompts and instructions

TSS is calculated based on power zones and duration, requiring FTP-based intensity calculations throughout the codebase.

### Target State
Remove TSS-based restrictions and replace with **time-based constraints**:
- **Weekday workouts**: 45-90 minutes
- **Weekend workouts**: Longer endurance rides (90-180 minutes recommended)
- **Weekly time budget**: Total hours per week (already exists, will become primary constraint)
- Simplify codebase by removing TSS calculation dependencies where not needed

### Key Insight
TSS calculation (`src/cycling_ai/core/tss.py`) should be **retained** for:
- Performance reporting and analytics
- Training load monitoring
- Post-workout analysis

But **removed** from:
- Plan generation constraints
- Workout library filtering
- LLM validation prompts
- Weekly plan validation (except as informational metric)

---

## Architecture Impact Analysis

### Components Affected

```
┌─────────────────────────────────────────────────────────────┐
│                   IMPACT ASSESSMENT                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  HIGH IMPACT (Core Changes Required):                        │
│  ├─ LLM Prompts (training_planning*.txt)                    │
│  ├─ Workout Selector (WorkoutSelector class)                │
│  ├─ Training Planning Phase 3b (library selection)          │
│  └─ add_week_tool validation logic                          │
│                                                               │
│  MEDIUM IMPACT (Refactor/Simplification):                   │
│  ├─ WorkoutRequirements dataclass                           │
│  ├─ Weekly overview generation (Phase 3a)                   │
│  └─ Validation helper functions                             │
│                                                               │
│  LOW/NO IMPACT (Keep As-Is):                                │
│  ├─ core/tss.py (keep for analytics)                        │
│  ├─ Performance reporting                                    │
│  └─ Historical data analysis                                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Detailed File-by-File Changes

### 1. LLM Prompts (HIGH PRIORITY)

#### File: `prompts/default/1.2/training_planning.txt`
**Current State:**
- Lines 18-19: References `TSS targets per week`
- Lines 42: `"target_tss": 250`
- Lines 174-204: TSS validation requirements
- Lines 342-368: TSS quality checks

**Changes Required:**
```diff
-TSS targets per week
+Weekly time budget and daily time ranges

-    "target_tss": 250,
+    "target_hours": 6.5,

-✅ **Weekly time budget**: ~{weekly_time_budget_hours} hours per week (±10%)
+✅ **Weekday workouts**: 45-90 minutes each
+✅ **Weekend workouts**: 90-180 minutes (longer endurance rides)
+✅ **Weekly time budget**: ~{weekly_time_budget_hours} hours per week (±10%)

-2. **Estimate weekly TSS**:
-   - Quick estimate: Z2 ride (70% FTP) for 1h ≈ 50 TSS
-   - Quick estimate: Threshold work (95% FTP) for 1h ≈ 90 TSS
-   - Quick estimate: VO2 intervals (110% FTP) for 1h ≈ 120 TSS
-   - Check: Is this within ±25% of target_tss from overview?
+2. **Check workout durations**:
+   - Weekday workouts: 45-90 min range
+   - Weekend workouts: 90-180 min for endurance
+   - High-intensity workouts: typically 60-75 min (with warmup/cooldown)
```

**Lines to Remove:** 342-368 (TSS estimation section)
**Lines to Add:** Time-based quality checks after line 347

---

#### File: `prompts/default/1.2/training_planning_overview_user.txt`
**Current State:**
- Lines 48: `"target_tss": 280`
- Lines 66: `"target_tss": 305`
- Lines 84: `"target_tss": 320`

**Changes Required:**
```diff
 {
   "week_number": 1,
   "phase": "Foundation",
   "phase_rationale": "Establish aerobic base",
   "weekly_focus": "Endurance building",
   "weekly_watch_points": "Monitor fatigue and recovery",
   "training_days": [...],
-  "target_tss": 280,
   "total_hours": 6.8
 }
```

**Impact:** Remove all `target_tss` fields from examples (lines 48, 66, 84)

---

#### File: `prompts/default/1.2/training_planning_user.txt`
**Current State:**
- Lines 38: `"target_tss": 280`

**Changes Required:**
- Remove `target_tss` from example (line 38)
- Emphasize time budget and daily duration ranges

---

### 2. Workout Selector (HIGH PRIORITY)

#### File: `src/cycling_ai/selectors/workout_selector.py`

**Current State:**
- Line 24-34: `WorkoutRequirements` dataclass with `target_tss` and `target_duration_min`
- Line 38-52: `SelectedWorkout` dataclass with `tss` field
- Lines 105-136: `select_workout()` method filters by TSS
- Lines 171-230: `_select_best_candidate()` scores by TSS fit
- Lines 231-393: `_adjust_workout()` adjusts to hit TSS targets

**Changes Required:**

##### 2a. Refactor WorkoutRequirements (lines 23-35)
```python
@dataclass
class WorkoutRequirements:
    """Requirements for workout selection."""

    weekday: str
    phase: str  # Foundation, Build, Peak, Recovery, Taper
    workout_type: str | None = None  # vo2max, threshold, sweet_spot, tempo, endurance, recovery
    intensity: str | None = None  # hard, easy
    # REMOVED: target_tss: float | None = None
    target_duration_min: float | None = None
    # REMOVED: tss_tolerance_pct: float = 0.15
    duration_tolerance_pct: float = 0.20  # 20% tolerance

    # NEW: Time-based constraints
    min_duration_min: float | None = None  # Minimum duration (e.g., 45 for weekdays)
    max_duration_min: float | None = None  # Maximum duration (e.g., 90 for weekdays)
```

##### 2b. Update SelectedWorkout (lines 38-52)
```python
@dataclass
class SelectedWorkout:
    """A selected workout with adjustments applied."""

    workout_id: str
    name: str
    detailed_description: str
    workout_type: str
    intensity: str
    weekday: str
    segments: list[dict[str, Any]]
    duration_min: float
    # REMOVED: tss: float
    adjusted: bool  # True if variable components were adjusted
    adjustment_details: dict[str, Any] | None = None
```

##### 2c. Update _select_best_candidate() scoring (lines 190-229)
```python
def _select_best_candidate(
    self, candidates: list[dict[str, Any]], requirements: WorkoutRequirements
) -> dict[str, Any]:
    """
    Score candidates and select best match.

    Scoring factors (higher = better):
    - Weekday match: +100 if in suitable_weekdays, 0 otherwise
    - Duration fit: -abs(target_duration - base_duration) if target specified
    - Duration constraints: -1000 if outside min/max range (hard constraint)
    - Adjustability: +10 if has variable_components

    Args:
        candidates: List of candidate workouts
        requirements: Workout selection requirements

    Returns:
        Best-matching workout
    """
    scored_candidates: list[tuple[float, dict[str, Any]]] = []

    for workout in candidates:
        score = 0.0

        # Weekday match (highly weighted)
        suitable_weekdays = workout.get("suitable_weekdays", [])
        if requirements.weekday in suitable_weekdays:
            score += 100

        # REMOVED: TSS fit scoring (was lines 200-204)

        # NEW: Duration constraint enforcement
        base_duration = workout.get("base_duration_min", 0)

        # Hard constraint: min/max duration
        if requirements.min_duration_min and base_duration < requirements.min_duration_min:
            score -= 1000  # Heavily penalize workouts below minimum
        if requirements.max_duration_min and base_duration > requirements.max_duration_min:
            score -= 1000  # Heavily penalize workouts above maximum

        # Duration fit (if target specified)
        if requirements.target_duration_min is not None:
            duration_diff = abs(requirements.target_duration_min - base_duration)
            # Penalize by duration difference (less penalty = better fit)
            score -= duration_diff

        # Adjustability bonus
        if workout.get("variable_components"):
            score += 10

        scored_candidates.append((score, workout))

    # Sort by score (descending) and return best
    scored_candidates.sort(key=lambda x: x[0], reverse=True)

    if not scored_candidates:
        raise ValueError("No candidates to select from")

    best_score, best_workout = scored_candidates[0]

    logger.debug(
        f"Selected workout '{best_workout['name']}' with score {best_score:.1f}"
    )

    return best_workout
```

##### 2d. Simplify _adjust_workout() (lines 231-393)
**Current:** Adjusts based on TSS or duration
**New:** Adjust only based on duration constraints

```python
def _adjust_workout(
    self, workout: dict[str, Any], requirements: WorkoutRequirements
) -> SelectedWorkout:
    """
    Adjust workout variable components to fit duration constraints.

    Variable components can be:
    - "sets": Number of interval repetitions
    - "duration": Length of main segment

    Args:
        workout: Base workout from library
        requirements: Target requirements (duration-based)

    Returns:
        SelectedWorkout with adjustments applied
    """
    base_duration = workout["base_duration_min"]
    variable_components = workout.get("variable_components")

    # Check if adjustment is needed
    needs_adjustment = False
    target_duration = None

    # Determine target duration
    if requirements.target_duration_min:
        target_duration = requirements.target_duration_min
    elif requirements.min_duration_min and base_duration < requirements.min_duration_min:
        target_duration = requirements.min_duration_min
        needs_adjustment = True
    elif requirements.max_duration_min and base_duration > requirements.max_duration_min:
        target_duration = requirements.max_duration_min
        needs_adjustment = True

    # Check if within tolerance
    if target_duration and requirements.duration_tolerance_pct:
        duration_diff_pct = abs(base_duration - target_duration) / target_duration * 100
        if duration_diff_pct > (requirements.duration_tolerance_pct * 100):
            needs_adjustment = True

    # If no targets or no adjustability or no adjustment needed, return as-is
    if not variable_components or not needs_adjustment or not target_duration:
        return SelectedWorkout(
            workout_id=workout["id"],
            name=workout["name"],
            detailed_description=workout.get("detailed_description", ""),
            workout_type=workout["type"],
            intensity=workout["intensity"],
            weekday=requirements.weekday,
            segments=workout["segments"],
            duration_min=base_duration,
            adjusted=False,
            adjustment_details=None,
        )

    # Calculate adjustment needed
    adjustable_field = variable_components["adjustable_field"]
    min_value = variable_components["min_value"]
    max_value = variable_components["max_value"]
    duration_per_unit = variable_components.get("duration_per_unit_min", 0)

    if duration_per_unit == 0:
        # Cannot adjust without duration_per_unit
        return SelectedWorkout(
            workout_id=workout["id"],
            name=workout["name"],
            detailed_description=workout.get("detailed_description", ""),
            workout_type=workout["type"],
            intensity=workout["intensity"],
            weekday=requirements.weekday,
            segments=workout["segments"],
            duration_min=base_duration,
            adjusted=False,
            adjustment_details=None,
        )

    # Calculate units to adjust
    duration_diff = target_duration - base_duration
    units_adjustment = round(duration_diff / duration_per_unit)
    adjusted_value = self._calculate_base_value(workout, adjustable_field) + units_adjustment

    # Clamp to min/max
    adjusted_value = max(min_value, min(max_value, adjusted_value))

    # Calculate new duration
    units_delta = adjusted_value - self._calculate_base_value(workout, adjustable_field)
    new_duration = base_duration + (units_delta * duration_per_unit)

    # Apply adjustment to segments
    adjusted_segments = self._apply_adjustment(
        workout["segments"], adjustable_field, adjusted_value
    )

    return SelectedWorkout(
        workout_id=workout["id"],
        name=workout["name"],
        detailed_description=workout.get("detailed_description", ""),
        workout_type=workout["type"],
        intensity=workout["intensity"],
        weekday=requirements.weekday,
        segments=adjusted_segments,
        duration_min=new_duration,
        adjusted=True,
        adjustment_details={
            "field": adjustable_field,
            "original_value": self._calculate_base_value(workout, adjustable_field),
            "adjusted_value": adjusted_value,
            "original_duration_min": base_duration,
            "adjusted_duration_min": new_duration,
        },
    )
```

**Lines to Remove:**
- Line 31: `target_tss` parameter
- Line 33: `tss_tolerance_pct` parameter
- Lines 278-327: TSS-based adjustment logic (entire if block)
- Line 50: `tss` field from SelectedWorkout

**Lines to Modify:**
- Lines 171-230: Replace TSS scoring with duration constraints
- Lines 231-393: Simplify to duration-only adjustment

---

### 3. Training Planning Phase 3b (HIGH PRIORITY)

#### File: `src/cycling_ai/orchestration/phases/training_planning_library.py`

**Current State:**
- Line 111: `weekly_target_tss = week_data.get("target_tss", 300)`
- Lines 129-133: Calculate `per_day_tss`
- Line 148: Pass `target_tss=per_day_tss` to selector
- Lines 201-206: Call `_adjust_weekly_tss()`
- Lines 260-347: `_adjust_weekly_tss()` method (TSS scaling)

**Changes Required:**

##### 3a. Remove TSS calculations (lines 111, 129-133, 138, 148)
```python
def execute(self, plan_id: str) -> dict[str, Any]:
    """Execute library-based workout selection for all weeks."""
    logger.info("[PHASE 3b-LIBRARY] Starting library-based workout selection")
    logger.info(f"[PHASE 3b-LIBRARY] plan_id: {plan_id}")

    # 1. Load weekly_overview from Phase 3a
    weekly_overview = self._load_weekly_overview(plan_id)
    logger.info(f"[PHASE 3b-LIBRARY] Loaded {len(weekly_overview)} weeks from overview")

    # 2. Select workouts for each week
    weeks_added = 0
    for week_data in weekly_overview:
        week_num = week_data.get("week_number", week_data.get("week"))
        phase = week_data.get("phase")
        training_days = week_data.get("training_days", [])
        target_hours = week_data.get("total_hours", 7.0)  # Changed from target_tss

        # Validate required fields
        if week_num is None:
            raise ValueError(
                f"Week data missing 'week_number' or 'week' field: {week_data}"
            )
        if not phase:
            raise ValueError(f"Week {week_num} missing 'phase' field")
        if not training_days:
            raise ValueError(f"Week {week_num} missing 'training_days' field")

        # Filter out rest days
        non_rest_days = [
            day for day in training_days
            if day.get("workout_type") != "rest"
        ]

        # REMOVED: TSS calculation (was lines 129-133)
        # NEW: Calculate target duration per day based on weekly hours and day type
        weekday_training_days = [
            d for d in non_rest_days
            if d["weekday"] not in ["Saturday", "Sunday"]
        ]
        weekend_training_days = [
            d for d in non_rest_days
            if d["weekday"] in ["Saturday", "Sunday"]
        ]

        # Distribute hours: weekends get more time for long endurance
        # Example: 7 hours/week with 3 weekdays + 2 weekends
        # Weekdays: 60-75 min each, Weekends: 90-120 min each
        num_weekdays = len(weekday_training_days)
        num_weekends = len(weekend_training_days)

        # Simple distribution: 40% to weekdays, 60% to weekends (if weekends exist)
        if num_weekends > 0:
            weekday_hours = target_hours * 0.4
            weekend_hours = target_hours * 0.6
            avg_weekday_duration_min = (weekday_hours * 60 / num_weekdays) if num_weekdays > 0 else 60
            avg_weekend_duration_min = (weekend_hours * 60 / num_weekends) if num_weekends > 0 else 120
        else:
            # All weekdays - distribute evenly
            avg_weekday_duration_min = (target_hours * 60 / num_weekdays) if num_weekdays > 0 else 60
            avg_weekend_duration_min = 0

        logger.info(
            f"[PHASE 3b-LIBRARY] Week {week_num}: "
            f"Selecting {len(non_rest_days)} workouts (phase={phase}, "
            f"target_hours={target_hours:.1f}h, "
            f"avg_weekday_duration={avg_weekday_duration_min:.0f}min, "
            f"avg_weekend_duration={avg_weekend_duration_min:.0f}min)"
        )

        # Select workout for each non-rest training day
        selected_workouts: list[dict[str, Any]] = []
        for day in non_rest_days:
            is_weekend = day["weekday"] in ["Saturday", "Sunday"]

            # Set duration constraints based on day type
            if is_weekend:
                min_duration = 90  # Weekend minimum
                max_duration = 180  # Weekend maximum
                target_duration = avg_weekend_duration_min
            else:
                min_duration = 45  # Weekday minimum
                max_duration = 90  # Weekday maximum
                target_duration = avg_weekday_duration_min

            workout = self._select_workout_for_day(
                weekday=day["weekday"],
                workout_type=day["workout_type"],
                phase=phase,
                target_duration_min=target_duration,
                min_duration_min=min_duration,
                max_duration_min=max_duration,
            )

            if workout is None:
                raise RuntimeError(
                    f"[PHASE 3b-LIBRARY] Week {week_num}: "
                    f"No workout found for {day['weekday']} "
                    f"(type={day['workout_type']}, phase={phase})"
                )

            selected_workouts.append(workout)

        # REMOVED: TSS adjustment (was lines 201-206)
        # NEW: Simple duration validation
        total_duration_min = sum(
            sum(seg.get("duration_min", 0) for seg in w.get("segments", []))
            for w in selected_workouts
        )
        total_hours = total_duration_min / 60.0

        logger.info(
            f"[PHASE 3b-LIBRARY] Week {week_num}: "
            f"Total duration {total_hours:.1f}h (target {target_hours:.1f}h)"
        )

        # 4. Call add_week_tool (validation happens inside tool)
        result = self.add_week_tool.execute(...)
        # ... rest of method
```

##### 3b. Update _select_workout_for_day() signature (lines 233-259)
```python
def _select_workout_for_day(
    self,
    weekday: str,
    workout_type: str,
    phase: str,
    target_duration_min: float,
    min_duration_min: float,
    max_duration_min: float,
) -> Workout | None:
    """
    Select workout for a specific training day.

    Args:
        weekday: Day of week (Monday, Tuesday, etc.)
        workout_type: Workout type (endurance, sweet_spot, etc.)
        phase: Training phase (Base, Build, etc.)
        target_duration_min: Target duration in minutes
        min_duration_min: Minimum acceptable duration
        max_duration_min: Maximum acceptable duration

    Returns:
        Selected and adjusted workout, or None if no match found
    """
    return self.selector.select_workout_for_day(
        target_type=workout_type,
        target_phase=phase,
        target_weekday=weekday,
        target_duration_min=target_duration_min,
        min_duration_min=min_duration_min,
        max_duration_min=max_duration_min,
        temperature=self.temperature,
    )
```

##### 3c. Remove _adjust_weekly_tss() method (lines 260-347)
**Action:** Delete entire method - no longer needed

**Lines to Remove:**
- 111: `weekly_target_tss` assignment
- 129-133: `per_day_tss` calculation
- 138: TSS reference in log message
- 148: `target_tss` parameter
- 201-206: TSS adjustment call
- 260-347: Entire `_adjust_weekly_tss()` method

**Lines to Add:**
- Duration-based constraints logic (see 3a above)
- Simple duration validation logging

---

### 4. Week Validation Tool (HIGH PRIORITY)

#### File: `src/cycling_ai/tools/wrappers/add_week_tool.py`

**Current State:**
- Lines 117-191: `_validate_time_and_tss()` function validates both time and TSS
- Lines 174-189: TSS validation with error thresholds
- Lines 772-934: Main validation logic checks TSS compliance

**Changes Required:**

##### 4a. Rename and simplify validation function (lines 117-191)
```python
def _validate_time_budget(
    total_hours: float,
    target_hours: float | None,
    week_number: int,
    is_recovery_week: bool,
) -> tuple[list[str], list[str]]:
    """
    Validate weekly time budget against target.

    NOTE: TSS is no longer validated - it's calculated for informational purposes only.

    Args:
        total_hours: Calculated total hours
        target_hours: Target hours (optional)
        week_number: Week number for error messages
        is_recovery_week: If True, use stricter tolerances

    Returns:
        (warnings, errors)
    """
    warnings: list[str] = []
    errors: list[str] = []

    # Phase-aware tolerance: stricter for Recovery/Taper weeks
    if is_recovery_week:
        time_warn_threshold = 8  # ±8% warning
        time_error_threshold = 15  # ±15% error (stricter than normal 20%)
    else:
        time_warn_threshold = 10
        time_error_threshold = 20

    # Check weekly time budget with phase-aware tolerances
    if target_hours:
        time_diff_pct = abs(total_hours - target_hours) / target_hours * 100
        if time_diff_pct > time_error_threshold:
            phase_note = " (Recovery week - stricter tolerance)" if is_recovery_week else ""
            errors.append(
                f"Week {week_number} time budget violation: "
                f"Planned {total_hours:.1f}h vs target {target_hours:.1f}h "
                f"({time_diff_pct:.0f}% difference, "
                f"max {time_error_threshold}% allowed{phase_note})"
            )
        elif time_diff_pct > time_warn_threshold:
            warnings.append(
                f"Week {week_number} time budget warning: "
                f"Planned {total_hours:.1f}h vs target {target_hours:.1f}h "
                f"({time_diff_pct:.0f}% difference, recommend ±{time_warn_threshold}%)"
            )

    # REMOVED: TSS validation (was lines 174-189)

    return (warnings, errors)
```

##### 4b. Update _calculate_week_metrics() to optionally return TSS (lines 82-115)
```python
def _calculate_week_metrics(
    workouts: list[dict[str, Any]],
    current_ftp: float,
    exclude_workout_index: int | None = None,
    calculate_tss: bool = False,
) -> tuple[float, float | None]:
    """
    Calculate total hours and optionally TSS for a week.

    Args:
        workouts: List of workout dictionaries
        current_ftp: Athlete's FTP
        exclude_workout_index: Optional workout index to exclude from calculation
        calculate_tss: If True, calculate TSS (default False for performance)

    Returns:
        (total_hours, actual_tss_or_none)
    """
    # Filter workouts if needed
    if exclude_workout_index is not None:
        filtered_workouts = [
            workout for idx, workout in enumerate(workouts) if idx != exclude_workout_index
        ]
    else:
        filtered_workouts = workouts

    # Calculate total duration (handle None values from library workouts)
    total_duration_min = sum(
        sum((seg.get("duration_min") or 0) for seg in workout.get("segments", []))
        for workout in filtered_workouts
    )
    total_hours = total_duration_min / 60.0

    # Optionally calculate TSS (for informational purposes only)
    actual_tss = None
    if calculate_tss:
        actual_tss = calculate_weekly_tss(filtered_workouts, current_ftp)

    return (total_hours, actual_tss)
```

##### 4c. Update main validation logic (lines 772-934)
**Changes:**
- Replace calls to `_validate_time_and_tss()` with `_validate_time_budget()`
- Remove `target_tss` parameter handling
- Calculate TSS only for informational logging (not validation)
- Update error messages to remove TSS references

```python
# Around line 751: Remove target_tss extraction
# OLD:
target_tss = week_overview.get("target_tss")
target_hours = week_overview.get("total_hours")

# NEW:
target_hours = week_overview.get("total_hours")

# Around line 774: Update metrics calculation
# OLD:
total_hours_full, actual_tss_full = _calculate_week_metrics(
    workouts, current_ftp, exclude_workout_index=None
)

# NEW:
total_hours_full, actual_tss_full = _calculate_week_metrics(
    workouts, current_ftp, exclude_workout_index=None, calculate_tss=True
)

# Around line 777: Update validation call
# OLD:
warnings_full, errors_full = _validate_time_and_tss(
    total_hours_full,
    actual_tss_full,
    target_hours,
    target_tss,
    week_number,
    is_recovery_week,
)

# NEW:
warnings_full, errors_full = _validate_time_budget(
    total_hours_full,
    target_hours,
    week_number,
    is_recovery_week,
)

# Around line 1007: Update status display (keep TSS as informational)
# Keep TSS display but mark as "(info only)"
if target_tss:
    tss_status = "ℹ"  # Changed from ✓/⚠ to info symbol
    validation_summary.append(
        f"{tss_status} TSS: {actual_tss:.0f} (informational only)"
    )
```

**Lines to Remove:**
- 174-189: TSS validation logic
- All references to `target_tss` as a validation constraint
- TSS-related error messages in validation failures

**Lines to Modify:**
- 117: Rename function to `_validate_time_budget`
- 82: Add `calculate_tss` parameter
- 751: Remove `target_tss` extraction
- 777: Remove TSS parameters from validation call
- 1007: Change TSS display to informational only

---

### 5. Core TSS Module (NO CHANGES - KEEP FOR ANALYTICS)

#### File: `src/cycling_ai/core/tss.py`

**Status:** **KEEP AS-IS**

**Rationale:**
- TSS is still valuable for **performance reporting**
- Used in analytics and historical data analysis
- Not part of the constraint removal - only its usage in validation

**No changes required to this file.**

---

### 6. Test Updates (HIGH PRIORITY)

#### Files to Update:
- `tests/tools/wrappers/test_add_week_tool_validation.py`
- `tests/selectors/test_workout_selector.py`
- `tests/orchestration/phases/test_training_planning_library.py`
- `tests/orchestration/phases/test_training_planning_library_12weeks.py`

**Changes Required:**

##### 6a. test_add_week_tool_validation.py
```python
# Update test cases to remove TSS validation
# OLD test:
def test_validate_time_and_tss_within_tolerance():
    warnings, errors = _validate_time_and_tss(
        total_hours=7.0,
        actual_tss=300,
        target_hours=7.0,
        target_tss=300,
        week_number=1,
        is_recovery_week=False,
    )
    assert len(warnings) == 0
    assert len(errors) == 0

# NEW test:
def test_validate_time_budget_within_tolerance():
    warnings, errors = _validate_time_budget(
        total_hours=7.0,
        target_hours=7.0,
        week_number=1,
        is_recovery_week=False,
    )
    assert len(warnings) == 0
    assert len(errors) == 0

# Remove all test_*_tss_* functions
# Keep only test_*_time_* functions
```

##### 6b. test_workout_selector.py
```python
# Update WorkoutRequirements fixtures
def test_select_workout_by_duration():
    """Test workout selection based on duration constraints."""
    requirements = WorkoutRequirements(
        weekday="Tuesday",
        phase="Build",
        workout_type="threshold",
        intensity="hard",
        # REMOVED: target_tss=85,
        target_duration_min=60,
        min_duration_min=45,
        max_duration_min=90,
    )

    selector = WorkoutSelector()
    workout = selector.select_workout(requirements)

    assert workout is not None
    assert 45 <= workout.duration_min <= 90  # Within range
    assert workout.workout_type == "threshold"
```

##### 6c. test_training_planning_library.py
```python
# Update mock weekly_overview to remove target_tss
@pytest.fixture
def mock_weekly_overview():
    return [
        {
            "week_number": 1,
            "phase": "Foundation",
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "endurance"},
                {"weekday": "Wednesday", "workout_type": "recovery"},
                {"weekday": "Thursday", "workout_type": "rest"},
                {"weekday": "Friday", "workout_type": "tempo"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "rest"},
            ],
            # REMOVED: "target_tss": 285,
            "total_hours": 6.5,
        }
    ]
```

**Test Files to Update:**
- Remove all TSS assertion checks
- Update fixtures to remove `target_tss` fields
- Add duration constraint tests
- Update validation tests to check time only

---

## Time-Based Constraint Specifications

### Weekday Constraints
```python
WEEKDAY_MIN_DURATION_MIN = 45  # Minimum for Mon-Fri workouts
WEEKDAY_MAX_DURATION_MIN = 90  # Maximum for Mon-Fri workouts
WEEKDAY_TARGET_DURATION_MIN = 60  # Typical target for weekdays
```

### Weekend Constraints
```python
WEEKEND_MIN_DURATION_MIN = 90  # Minimum for Sat-Sun workouts
WEEKEND_MAX_DURATION_MIN = 180  # Maximum for Sat-Sun workouts
WEEKEND_TARGET_ENDURANCE_MIN = 120  # Typical target for long endurance
```

### Workout Type Duration Guidelines
```python
# High-intensity workouts (typically shorter)
VO2MAX_DURATION_MIN = 45-75  # With warmup/cooldown
THRESHOLD_DURATION_MIN = 60-90  # With warmup/cooldown

# Moderate-intensity workouts
SWEET_SPOT_DURATION_MIN = 60-90
TEMPO_DURATION_MIN = 60-90

# Low-intensity workouts (typically longer)
ENDURANCE_DURATION_MIN = 60-180  # Weekdays shorter, weekends longer
RECOVERY_DURATION_MIN = 30-60  # Short and easy
```

---

## Implementation Strategy

### Phase 1: Preparation (Complete)
- ✅ Analyze codebase for TSS usage
- ✅ Map validation logic
- ✅ Identify all affected files
- ✅ Create comprehensive plan

### Phase 2: Core Changes (Priority Order)
1. **LLM Prompts** (1-2 hours)
   - Update all 3 prompt files
   - Remove TSS references
   - Add time-based constraints
   - Test prompt rendering

2. **Workout Selector** (2-3 hours)
   - Refactor WorkoutRequirements
   - Update SelectedWorkout
   - Modify selection scoring
   - Simplify adjustment logic
   - Add duration constraint enforcement

3. **Training Planning Phase 3b** (1-2 hours)
   - Remove TSS calculations
   - Add duration distribution logic
   - Update method signatures
   - Remove TSS adjustment method

4. **Week Validation Tool** (1-2 hours)
   - Rename validation function
   - Remove TSS validation
   - Keep TSS calculation for informational purposes
   - Update error messages

### Phase 3: Testing (2-3 hours)
1. **Unit Tests**
   - Update test fixtures
   - Remove TSS assertions
   - Add duration constraint tests
   - Ensure 100% pass rate

2. **Integration Tests**
   - Test full training plan generation
   - Verify duration constraints enforced
   - Check validation logic
   - Test with real workout library

3. **Manual Testing**
   - Generate 12-week plan
   - Verify workout durations
   - Check weekday vs weekend distribution
   - Validate HTML output

### Phase 4: Documentation (1 hour)
- Update CLAUDE.md
- Document new constraints
- Update user guides
- Mark deprecated TSS validation docs

---

## Risk Assessment

### HIGH RISK: Breaking Changes
**Risk:** Existing training plans or saved states reference `target_tss`
**Mitigation:** Add backwards compatibility check that ignores `target_tss` if present

**Risk:** LLM cache may return old prompts with TSS references
**Mitigation:** Update prompt version numbers, clear LLM response cache

### MEDIUM RISK: Test Failures
**Risk:** Many tests currently assert on TSS values
**Mitigation:** Comprehensive test update plan (Phase 3)

**Risk:** Integration tests may fail with new constraints
**Mitigation:** Update test fixtures before running tests

### LOW RISK: Performance Impact
**Risk:** Duration-based selection may be slower than TSS-based
**Mitigation:** Duration scoring is simpler than TSS calculation (likely faster)

---

## Rollback Plan

If implementation causes critical failures:

1. **Revert Git Commits**
   ```bash
   git revert <commit-hash-range>
   git push origin feature/fit-workout-parser
   ```

2. **Restore Prompts**
   - Keep backup of original prompts in `/prompts/default/1.2/backup/`
   - Restore original files

3. **Database/State Cleanup**
   - No database changes in this feature
   - Clear any cached LLM responses
   - Delete any partial training plans generated during testing

---

## Success Criteria

### Functional Requirements
- ✅ Training plans generate without TSS validation errors
- ✅ Weekday workouts respect 45-90 min constraint
- ✅ Weekend workouts allow 90-180 min endurance rides
- ✅ Weekly time budget still validated (primary constraint)
- ✅ All 253 existing tests pass (after updates)

### Code Quality Requirements
- ✅ `mypy --strict` passes (no type errors)
- ✅ `ruff check` passes (no linting errors)
- ✅ Test coverage maintained at 85%+
- ✅ No deprecation warnings

### User-Facing Requirements
- ✅ Generated plans have appropriate workout durations
- ✅ Workout library selection works correctly
- ✅ HTML reports display duration-based metrics
- ✅ No TSS-related error messages shown to users

---

## Deprecated Code to Remove (Post-Implementation)

After successful implementation and testing, consider removing:

### Immediate Removal (Safe)
- `.claude/current_task/TSS_VALIDATION_FIX.md` (outdated documentation)
- TSS-related test fixtures that are no longer used
- Old commented-out TSS code

### Future Removal (Requires Careful Review)
- `src/cycling_ai/core/tss.py` - **KEEP FOR NOW** (used in analytics)
- TSS calculation in workout library metadata - **KEEP** (informational)
- Historical TSS validation logic - **ARCHIVE** (may need for reference)

---

## Summary for Executor

### Quick Start
1. Start with **LLM prompts** (lowest risk, easiest to verify)
2. Move to **workout selector** (core logic change)
3. Update **training planning phase** (depends on selector)
4. Modify **validation tool** (depends on all above)
5. Update **all tests** (comprehensive verification)
6. Run **integration tests** (end-to-end validation)

### Key Principles
- **Remove TSS from constraints**, keep for analytics
- **Time-based constraints are simpler** than TSS calculations
- **Weekday vs weekend** duration rules are the core change
- **Backwards compatibility** for any existing `target_tss` fields (ignore them)
- **Test thoroughly** before marking complete

### Files Summary
**High Priority Changes:**
- `prompts/default/1.2/training_planning.txt` (lines 18-19, 42, 174-368)
- `prompts/default/1.2/training_planning_overview_user.txt` (lines 48, 66, 84)
- `prompts/default/1.2/training_planning_user.txt` (line 38)
- `src/cycling_ai/selectors/workout_selector.py` (lines 23-52, 171-393)
- `src/cycling_ai/orchestration/phases/training_planning_library.py` (lines 111, 129-148, 201-347)
- `src/cycling_ai/tools/wrappers/add_week_tool.py` (lines 82, 117-191, 751-1007)

**Test Files to Update:**
- `tests/tools/wrappers/test_add_week_tool_validation.py`
- `tests/selectors/test_workout_selector.py`
- `tests/orchestration/phases/test_training_planning_library.py`
- `tests/orchestration/phases/test_training_planning_library_12weeks.py`

**No Changes Required:**
- `src/cycling_ai/core/tss.py` (keep for analytics)

---

**End of Implementation Plan**
