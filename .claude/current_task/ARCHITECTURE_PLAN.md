# Updated Architecture Plan: Duration-Aware Training Planning

**Document:** Architecture Specification
**Version:** 1.0
**Date:** 2025-11-04
**Status:** Design Complete

---

## Executive Summary

This document specifies the **updated architecture** for the library-based training planning system with integrated duration adjustment. The design preserves existing strengths (fast, deterministic, type-safe) while adding intelligent duration management capabilities.

**Key Architectural Changes:**
1. **New Module:** `duration_adjustment.py` - Core duration logic
2. **Enhanced Module:** `training_planning_library.py` - Integration point
3. **Updated Module:** `selector.py` - Extensibility-aware selection
4. **New Module:** `workout_scaler.py` - Segment-level scaling operations
5. **Migration Scripts:** Library enhancement automation

**Design Principles:**
- **Minimal invasiveness:** 90% of code unchanged
- **Backward compatibility:** All changes opt-in via configuration
- **Type safety:** Full `mypy --strict` compliance
- **Testability:** Each component independently testable
- **Performance:** Target <2 seconds per week (current: <1s)

---

## Current vs. Proposed Architecture

### Current Architecture (Simplified)

```
LibraryBasedTrainingPlanningWeeks
├── _load_weekly_overview()
├── For each week:
│   ├── Calculate avg duration (40/60 split)
│   ├── For each day:
│   │   └── WorkoutSelector.select_workout()
│   │       ├── Filter by phase
│   │       ├── Score candidates
│   │       └── Return base workout
│   └── AddWeekTool.execute()
│       ├── Validate time budget
│       └── Auto-fix (reduce only)
```

**Problem:** No duration adjustment between selection and validation.

### Proposed Architecture

```
LibraryBasedTrainingPlanningWeeks
├── _load_weekly_overview()
├── For each week:
│   ├── DurationDistributor.distribute_weekly_hours()  ← NEW
│   │   ├── Calculate base allocation (workout-type-aware)
│   │   └── Scale to target with bounds
│   ├── For each day:
│   │   ├── WorkoutSelector.select_workout()  ← ENHANCED
│   │   │   ├── Filter by phase + extensibility
│   │   │   ├── Score candidates (bonus for extensible)
│   │   │   └── Return base workout
│   │   └── WorkoutScaler.adjust_to_target()  ← NEW
│   │       ├── Check if adjustment needed
│   │       ├── Use variable_components if available
│   │       └── Fallback to segment scaling
│   ├── DurationRefiner.refine_weekly_total()  ← NEW
│   │   ├── Calculate deficit/surplus
│   │   └── Redistribute to flexible workouts
│   └── AddWeekTool.execute()
│       ├── Validate time budget (should pass 98%+)
│       └── Auto-fix (reduce/extend both supported)  ← ENHANCED
```

**Solution:** Three-phase adjustment pipeline before validation.

---

## Component Specifications

### Component 1: DurationDistributor (NEW)

**File:** `src/cycling_ai/core/workout_library/duration_distributor.py`

**Responsibilities:**
- Calculate workout-type-aware base durations
- Scale to weekly target with constraints
- Respect min/max bounds per workout type and day type

**Interface:**

```python
@dataclass
class DurationAllocation:
    """Duration allocation for a single training day."""
    weekday: str
    workout_type: str
    target_duration_min: float
    min_duration_min: float
    max_duration_min: float


class DurationDistributor:
    """
    Distributes weekly hours intelligently across training days.

    Uses workout-type-aware profiles to predict realistic durations
    before workout selection.
    """

    def __init__(self) -> None:
        """Initialize with duration profiles."""
        self.duration_profiles = WORKOUT_DURATION_PROFILES

    def distribute_weekly_hours(
        self,
        training_days: list[dict[str, Any]],
        target_hours: float,
        phase: str,
    ) -> dict[str, DurationAllocation]:
        """
        Distribute target hours across training days.

        Args:
            training_days: List of {weekday, workout_type} dicts
            target_hours: Weekly target (e.g., 6.5)
            phase: Training phase (for phase-specific adjustments)

        Returns:
            {weekday: DurationAllocation}
        """
        # Phase 1: Calculate base allocation
        base_allocations = self._calculate_base_allocation(training_days)

        # Phase 2: Scale to target with bounds
        scaled_allocations = self._scale_to_target(
            base_allocations,
            target_hours,
            training_days,
        )

        return scaled_allocations

    def _calculate_base_allocation(
        self,
        training_days: list[dict[str, Any]],
    ) -> dict[str, float]:
        """Calculate natural duration for each day."""
        # Implementation from ALGORITHM_DESIGN.md
        ...

    def _scale_to_target(
        self,
        base_allocations: dict[str, float],
        target_hours: float,
        training_days: list[dict[str, Any]],
    ) -> dict[str, DurationAllocation]:
        """Scale allocations to hit target hours."""
        # Implementation from ALGORITHM_DESIGN.md
        ...
```

**Dependencies:**
- `cycling_ai.core.workout_library.models` (for type hints)
- `logging` (for debug output)

**Type Safety:** Full `mypy --strict` compliance

**Testing:**
```python
def test_distribution_basic():
    distributor = DurationDistributor()
    training_days = [
        {"weekday": "Tuesday", "workout_type": "endurance"},
        {"weekday": "Saturday", "workout_type": "endurance"},
    ]
    allocations = distributor.distribute_weekly_hours(
        training_days, target_hours=4.0, phase="Base"
    )
    total = sum(a.target_duration_min for a in allocations.values())
    assert abs(total - 240) < 5  # ±5 min tolerance
```

---

### Component 2: WorkoutScaler (NEW)

**File:** `src/cycling_ai/core/workout_library/workout_scaler.py`

**Responsibilities:**
- Adjust workout duration to match target
- Use `variable_components` metadata when available
- Fallback to segment proportional scaling
- Preserve workout structure and power zones

**Interface:**

```python
class WorkoutScaler:
    """
    Scales workout durations intelligently.

    Supports two methods:
    1. Variable components scaling (preferred)
    2. Segment proportional scaling (fallback)
    """

    def adjust_to_target(
        self,
        workout: Workout,
        target_duration_min: float,
        tolerance_pct: float = 0.10,
    ) -> Workout:
        """
        Adjust workout to match target duration.

        Args:
            workout: Base workout from library
            target_duration_min: Target duration
            tolerance_pct: Tolerance before adjustment (default 10%)

        Returns:
            Adjusted workout (deep copy)
        """
        from copy import deepcopy

        # Check if adjustment needed
        diff_pct = abs(workout.base_duration_min - target_duration_min) / target_duration_min
        if diff_pct <= tolerance_pct:
            return deepcopy(workout)

        # Method 1: Use variable_components
        if workout.variable_components:
            return self._adjust_with_variable_components(workout, target_duration_min)

        # Method 2: Segment scaling
        if workout.extensible:
            return self._adjust_with_segment_scaling(workout, target_duration_min)

        # Cannot adjust - return original
        logger.warning(
            f"Cannot adjust workout {workout.id}: "
            f"No variable_components and not extensible"
        )
        return deepcopy(workout)

    def _adjust_with_variable_components(
        self,
        workout: Workout,
        target_duration_min: float,
    ) -> Workout:
        """Adjust using variable_components metadata."""
        # Implementation from ALGORITHM_DESIGN.md
        ...

    def _adjust_with_segment_scaling(
        self,
        workout: Workout,
        target_duration_min: float,
    ) -> Workout:
        """Adjust by scaling main segments proportionally."""
        # Implementation from ALGORITHM_DESIGN.md
        ...

    def scale_segment(
        self,
        segment: WorkoutSegment,
        scaling_factor: float,
    ) -> WorkoutSegment:
        """
        Scale a single segment respecting bounds.

        Uses segment.min_duration_min and segment.max_duration_min if available.
        """
        ...
```

**Dependencies:**
- `cycling_ai.core.workout_library.models` (Workout, WorkoutSegment)
- `copy.deepcopy` (for non-destructive modifications)

**Type Safety:** Full `mypy --strict` compliance

**Testing:**
```python
def test_adjust_with_variable_components():
    workout = create_test_workout_with_variable_components(
        base_duration=90,
        min_duration=60,
        max_duration=150,
    )
    scaler = WorkoutScaler()
    adjusted = scaler.adjust_to_target(workout, target_duration_min=120)

    assert adjusted.base_duration_min == 120
    assert len(adjusted.segments) == len(workout.segments)
    # Verify structure preservation
    assert all(
        adj.type == orig.type
        for adj, orig in zip(adjusted.segments, workout.segments)
    )
```

---

### Component 3: DurationRefiner (NEW)

**File:** `src/cycling_ai/core/workout_library/duration_refiner.py`

**Responsibilities:**
- Iteratively refine weekly total duration
- Redistribute deficit/surplus across flexible workouts
- Converge to ±5% accuracy

**Interface:**

```python
class DurationRefiner:
    """
    Refines weekly workout durations to hit exact targets.

    Uses iterative redistribution to converge on target hours.
    """

    def __init__(self, scaler: WorkoutScaler) -> None:
        """Initialize with workout scaler."""
        self.scaler = scaler

    def refine_weekly_total(
        self,
        workouts: list[Workout],
        target_hours: float,
        training_days: list[dict[str, Any]],
        max_iterations: int = 5,
        tolerance_pct: float = 0.05,
    ) -> list[Workout]:
        """
        Iteratively adjust workouts to hit weekly target.

        Args:
            workouts: Selected workouts (already adjusted once)
            target_hours: Weekly target
            training_days: Training day metadata
            max_iterations: Maximum refinement iterations
            tolerance_pct: Convergence tolerance (default ±5%)

        Returns:
            Refined workouts
        """
        target_min = target_hours * 60
        tolerance_min = target_min * tolerance_pct

        refined = workouts.copy()

        for iteration in range(max_iterations):
            current_total = sum(w.base_duration_min for w in refined)
            delta = target_min - current_total

            # Check convergence
            if abs(delta) < tolerance_min:
                logger.info(
                    f"Converged in {iteration} iterations: "
                    f"{current_total / 60:.2f}h (target: {target_hours:.2f}h)"
                )
                break

            # Redistribute delta to flexible workouts
            refined = self._redistribute_delta(refined, delta, training_days)

        return refined

    def _redistribute_delta(
        self,
        workouts: list[Workout],
        delta_min: float,
        training_days: list[dict[str, Any]],
    ) -> list[Workout]:
        """Redistribute duration delta across flexible workouts."""
        # Implementation from ALGORITHM_DESIGN.md
        ...
```

**Dependencies:**
- `cycling_ai.core.workout_library.workout_scaler` (WorkoutScaler)
- `cycling_ai.core.workout_library.models` (Workout)

**Type Safety:** Full `mypy --strict` compliance

**Testing:**
```python
def test_refine_convergence():
    workouts = [create_test_workout(d) for d in [60, 70, 90, 120, 110]]
    # Total: 450 min = 7.5h

    refiner = DurationRefiner(scaler=WorkoutScaler())
    refined = refiner.refine_weekly_total(
        workouts,
        target_hours=7.0,
        training_days=[...],
    )

    total = sum(w.base_duration_min for w in refined)
    assert abs(total - 420) < 21  # Within ±5%
```

---

### Component 4: Enhanced LibraryBasedTrainingPlanningWeeks

**File:** `src/cycling_ai/orchestration/phases/training_planning_library.py` (MODIFIED)

**Changes:**
1. Add duration adjustment pipeline
2. Integrate new components
3. Preserve backward compatibility (opt-in via flag)

**Modified Interface:**

```python
class LibraryBasedTrainingPlanningWeeks:
    """
    Phase 3b: Library-based workout selection with duration adjustment.

    NEW FEATURE: Intelligent duration adjustment ensures weekly time targets met.
    """

    def __init__(
        self,
        temperature: float = 0.5,
        enable_duration_adjustment: bool = True,  # NEW PARAMETER
    ) -> None:
        """
        Initialize library-based training planning phase.

        Args:
            temperature: Stochastic sampling temperature
            enable_duration_adjustment: Enable intelligent duration adjustment
                (default: True, set to False for legacy behavior)
        """
        # Existing initialization
        loader = WorkoutLibraryLoader()
        library = loader.get_library()
        self.selector = WorkoutSelector(library)
        self.temperature = temperature
        self.add_week_tool = AddWeekDetailsTool()

        # NEW: Duration adjustment components
        self.enable_duration_adjustment = enable_duration_adjustment
        if enable_duration_adjustment:
            self.duration_distributor = DurationDistributor()
            self.workout_scaler = WorkoutScaler()
            self.duration_refiner = DurationRefiner(self.workout_scaler)

    def execute(self, plan_id: str) -> dict[str, Any]:
        """
        Execute library-based workout selection for all weeks.

        NOW INCLUDES: Intelligent duration adjustment for 98%+ validation pass rate.
        """
        weekly_overview = self._load_weekly_overview(plan_id)
        weeks_added = 0

        for week_data in weekly_overview:
            # Process week with duration adjustment
            if self.enable_duration_adjustment:
                result = self._execute_week_with_adjustment(week_data, plan_id)
            else:
                result = self._execute_week_legacy(week_data, plan_id)  # OLD PATH

            if result.success:
                weeks_added += 1

        return {"success": True, "weeks_added": weeks_added}

    def _execute_week_with_adjustment(
        self,
        week_data: dict[str, Any],
        plan_id: str,
    ) -> ToolExecutionResult:
        """
        Execute week with duration adjustment pipeline.

        Three-phase approach:
        1. Smart distribution
        2. Selection + adjustment
        3. Iterative refinement
        """
        week_num = week_data["week_number"]
        phase = week_data["phase"]
        training_days = week_data["training_days"]
        target_hours = week_data["total_hours"]

        # PHASE 1: Smart Distribution
        logger.info(f"[PHASE 1] Distributing {target_hours:.1f}h across training days")
        allocations = self.duration_distributor.distribute_weekly_hours(
            training_days, target_hours, phase
        )

        # PHASE 2: Selection + Adjustment
        logger.info(f"[PHASE 2] Selecting and adjusting workouts")
        selected_workouts = []

        for day in training_days:
            if day["workout_type"] == "rest":
                continue

            allocation = allocations[day["weekday"]]

            # Select base workout
            base_workout = self.selector.select_workout(
                target_type=day["workout_type"],
                target_phase=phase,
                target_weekday=day["weekday"],
                target_duration_min=allocation.target_duration_min,
                min_duration_min=allocation.min_duration_min,
                max_duration_min=allocation.max_duration_min,
                temperature=self.temperature,
            )

            if base_workout is None:
                raise RuntimeError(
                    f"No workout found for {day['weekday']} {day['workout_type']}"
                )

            # Adjust to target duration
            adjusted_workout = self.workout_scaler.adjust_to_target(
                workout=base_workout,
                target_duration_min=allocation.target_duration_min,
            )

            selected_workouts.append(adjusted_workout)
            self.selector.variety_tracker.add_workout(adjusted_workout.id)

        # PHASE 3: Iterative Refinement
        logger.info(f"[PHASE 3] Refining weekly total")
        refined_workouts = self.duration_refiner.refine_weekly_total(
            workouts=selected_workouts,
            target_hours=target_hours,
            training_days=training_days,
        )

        # Calculate final metrics
        total_duration = sum(w.base_duration_min for w in refined_workouts)
        total_hours = total_duration / 60.0
        logger.info(
            f"Week {week_num}: {total_hours:.2f}h "
            f"(target: {target_hours:.2f}h, "
            f"error: {abs(total_hours - target_hours) / target_hours * 100:.1f}%)"
        )

        # Convert to add_week_tool format and validate
        workouts_dicts = self._convert_to_tool_format(refined_workouts, training_days)
        return self.add_week_tool.execute(
            plan_id=plan_id,
            week_number=week_num,
            workouts=workouts_dicts,
        )

    def _execute_week_legacy(
        self,
        week_data: dict[str, Any],
        plan_id: str,
    ) -> ToolExecutionResult:
        """
        Execute week using legacy method (no duration adjustment).

        Preserved for backward compatibility and A/B testing.
        """
        # Existing implementation (lines 107-268 from current file)
        ...
```

**Migration Strategy:**
- New code paths only activated when `enable_duration_adjustment=True`
- Legacy path preserved for rollback
- A/B testing support via configuration flag

---

### Component 5: Enhanced WorkoutSelector

**File:** `src/cycling_ai/core/workout_library/selector.py` (MODIFIED)

**Changes:**
1. Add extensibility bonus to scoring
2. Prioritize workouts with `variable_components`
3. Filter by `extensible` flag when needed

**Modified Methods:**

```python
class WorkoutSelector:
    """
    Selects workouts from library.

    ENHANCED: Now prioritizes extensible workouts for better duration matching.
    """

    def score_workout(
        self,
        workout: Workout,
        target_type: str,
        target_phase: str,
        target_weekday: str,
        target_duration_min: float,
        min_duration_min: float | None,
        max_duration_min: float | None,
        variety_history: list[str],
    ) -> float:
        """
        Score workout based on multiple criteria.

        ENHANCED: +10 points for extensible workouts (105 points total).
        """
        score = 0.0

        # [Existing scoring logic unchanged - lines 125-156]
        ...

        # NEW: Extensibility bonus (10 points)
        if workout.extensible or workout.variable_components:
            score += 10

        return score

    def select_workout(
        self,
        target_type: str,
        target_phase: str,
        target_weekday: str,
        target_duration_min: float,
        min_duration_min: float | None = None,
        max_duration_min: float | None = None,
        temperature: float = 0.5,
        seed: int | None = None,
        prefer_extensible: bool = True,  # NEW PARAMETER
    ) -> Workout | None:
        """
        Select best-matching workout from library.

        ENHANCED: Prioritizes extensible workouts when prefer_extensible=True.
        """
        # Filter candidates by phase (mandatory)
        candidates = [
            w for w in self.library.workouts
            if w.suitable_phases and target_phase in w.suitable_phases
        ]

        # NEW: Pre-filter to extensible if requested and available
        if prefer_extensible:
            extensible_candidates = [
                w for w in candidates
                if w.extensible or w.variable_components
            ]
            if extensible_candidates:
                candidates = extensible_candidates
                logger.debug(
                    f"Filtered to {len(extensible_candidates)} extensible workouts"
                )

        # [Existing scoring and selection logic unchanged - lines 388-417]
        ...
```

---

## Data Flow Diagram

### Complete Week Processing Flow

```
Input: weekly_overview (Phase 3a)
  │
  ├─ week_number: 8
  ├─ phase: "Recovery"
  ├─ total_hours: 6.5
  └─ training_days: [
       {weekday: "Tuesday", workout_type: "endurance"},
       {weekday: "Wednesday", workout_type: "recovery"},
       {weekday: "Thursday", workout_type: "tempo"},
       {weekday: "Saturday", workout_type: "endurance"},
       {weekday: "Sunday", workout_type: "endurance"}
     ]

↓ [PHASE 1: DurationDistributor.distribute_weekly_hours()]

allocations: {
  "Tuesday": DurationAllocation(
    target_duration_min=61,
    min_duration_min=60,
    max_duration_min=90
  ),
  "Wednesday": DurationAllocation(
    target_duration_min=45,
    min_duration_min=45,
    max_duration_min=60
  ),
  "Thursday": DurationAllocation(
    target_duration_min=62,
    min_duration_min=60,
    max_duration_min=90
  ),
  "Saturday": DurationAllocation(
    target_duration_min=111,
    min_duration_min=90,
    max_duration_min=180
  ),
  "Sunday": DurationAllocation(
    target_duration_min=111,
    min_duration_min=90,
    max_duration_min=180
  )
}
Total: 390 min = 6.5h ✓

↓ [PHASE 2: For each day]

Tuesday (endurance):
  WorkoutSelector.select_workout(target_duration=61)
    ↓ Selects: "endurance_z2_60" (60 min, extensible=True)
  WorkoutScaler.adjust_to_target(60 → 61)
    ↓ Adjusted: 61 min (1 min extension)

Wednesday (recovery):
  WorkoutSelector.select_workout(target_duration=45)
    ↓ Selects: "recovery_easy_45" (45 min, extensible=False)
  WorkoutScaler.adjust_to_target(45 → 45)
    ↓ Adjusted: 45 min (no change)

Thursday (tempo):
  WorkoutSelector.select_workout(target_duration=62)
    ↓ Selects: "tempo_steady_65" (65 min, extensible=True)
  WorkoutScaler.adjust_to_target(65 → 62)
    ↓ Adjusted: 62 min (3 min reduction)

Saturday (endurance):
  WorkoutSelector.select_workout(target_duration=111)
    ↓ Selects: "endurance_z2_120" (120 min, extensible=True)
  WorkoutScaler.adjust_to_target(120 → 111)
    ↓ Adjusted: 111 min (9 min reduction)

Sunday (endurance):
  WorkoutSelector.select_workout(target_duration=111)
    ↓ Selects: "endurance_z2_90" (90 min, extensible=True)
  WorkoutScaler.adjust_to_target(90 → 111)
    ↓ Adjusted: 111 min (21 min extension)

selected_workouts: [61, 45, 62, 111, 111] = 390 min ✓

↓ [PHASE 3: DurationRefiner.refine_weekly_total()]

Iteration 1:
  Current total: 390 min
  Target: 390 min
  Delta: 0 min
  → Converged! ✓

refined_workouts: [61, 45, 62, 111, 111] = 390 min = 6.5h ✓

↓ [VALIDATION: AddWeekTool.execute()]

Validation:
  Total hours: 6.5h
  Target hours: 6.5h
  Error: 0.0% ✓
  Status: PASSED ✓

Output: Week 8 saved successfully
```

---

## Integration Points

### Integration Point 1: CLI Configuration

**File:** `src/cycling_ai/cli/commands/generate.py`

**Change:**

```python
@click.option(
    "--duration-adjustment/--no-duration-adjustment",
    default=True,
    help="Enable intelligent duration adjustment (default: enabled)",
)
def generate(
    ...,
    duration_adjustment: bool,
):
    """Generate training plan."""

    # Create phase with configuration
    library_phase = LibraryBasedTrainingPlanningWeeks(
        temperature=0.5,
        enable_duration_adjustment=duration_adjustment,
    )
```

**Usage:**

```bash
# Default: duration adjustment enabled
cycling-ai generate --profile profile.json

# Disable for testing/comparison
cycling-ai generate --profile profile.json --no-duration-adjustment
```

### Integration Point 2: Environment Configuration

**File:** `src/cycling_ai/config/settings.py`

**Addition:**

```python
class Settings(BaseSettings):
    # Existing settings...

    # NEW: Duration adjustment settings
    enable_duration_adjustment: bool = True
    duration_adjustment_tolerance_pct: float = 0.05  # ±5%
    duration_refinement_max_iterations: int = 5
```

### Integration Point 3: Logging & Monitoring

**File:** `src/cycling_ai/orchestration/phases/training_planning_library.py`

**Enhanced Logging:**

```python
logger.info(
    f"Week {week_num} PHASE 1 COMPLETE: "
    f"Allocated {sum(a.target_duration_min for a in allocations.values())/60:.2f}h "
    f"across {len(allocations)} days"
)

logger.info(
    f"Week {week_num} PHASE 2 COMPLETE: "
    f"Selected {len(selected_workouts)} workouts, "
    f"total {sum(w.base_duration_min for w in selected_workouts)/60:.2f}h "
    f"(avg adjustment: {avg_adjustment:.1f} min)"
)

logger.info(
    f"Week {week_num} PHASE 3 COMPLETE: "
    f"Refined to {total_hours:.2f}h in {iterations} iterations "
    f"(error: {error_pct:.1f}%)"
)
```

---

## Error Handling Strategy

### Error Case 1: No Extensible Workouts Available

**Scenario:** Library has no extensible workouts for a specific workout type/phase.

**Handling:**

```python
# In DurationRefiner._redistribute_delta()
flexible_workouts = [w for w in workouts if w.extensible]

if not flexible_workouts:
    logger.warning(
        f"Week {week_num}: No extensible workouts available for refinement. "
        f"Accepting current total: {current_total/60:.2f}h "
        f"(target: {target_hours:.2f}h)"
    )
    # Accept best effort, let validation handle it
    return workouts
```

**Outcome:** Graceful degradation to best-effort matching.

### Error Case 2: Cannot Converge Within Tolerance

**Scenario:** Refinement iterations exhaust without reaching ±5% tolerance.

**Handling:**

```python
# In DurationRefiner.refine_weekly_total()
if iteration == max_iterations - 1:
    logger.warning(
        f"Week {week_num}: Refinement did not converge in {max_iterations} iterations. "
        f"Final total: {current_total/60:.2f}h "
        f"(target: {target_hours:.2f}h, error: {error_pct:.1f}%)"
    )
    # Return best effort, validation will catch if >20% error
```

**Outcome:** Best-effort result, validation will error if truly problematic.

### Error Case 3: Validation Still Fails After Adjustment

**Scenario:** Even with adjustment, week fails validation (>20% error).

**Handling:**

```python
# In LibraryBasedTrainingPlanningWeeks._execute_week_with_adjustment()
result = self.add_week_tool.execute(...)

if not result.success:
    logger.error(
        f"Week {week_num} VALIDATION FAILED despite duration adjustment: "
        f"{result.errors}"
    )

    # Provide actionable error message
    raise RuntimeError(
        f"Week {week_num} validation failed after adjustment. "
        f"This indicates library coverage gap or invalid constraints.\n"
        f"Errors: {result.errors}\n\n"
        f"Suggestions:\n"
        f"1. Check if workout library has sufficient coverage for this week\n"
        f"2. Review Phase 3a target_hours (may be unrealistic)\n"
        f"3. Run with --no-duration-adjustment to see if legacy path works\n"
        f"4. Check logs for adjustment details"
    )
```

**Outcome:** Clear error with debugging guidance.

---

## Performance Analysis

### Expected Performance Impact

| Operation | Current | Proposed | Delta |
|-----------|---------|----------|-------|
| Load library | 50 ms | 60 ms | +20% (extensibility checks) |
| Distribute hours | N/A | 10 ms | +10 ms (new) |
| Select workout | 50 ms | 60 ms | +20% (extensibility scoring) |
| Adjust workout | N/A | 20 ms | +20 ms (new) |
| Refine week | N/A | 30 ms | +30 ms (new) |
| Validate week | 100 ms | 100 ms | 0% (unchanged) |
| **Per week total** | **~500 ms** | **~780 ms** | **+56%** |
| **12-week plan** | **~6 s** | **~9.4 s** | **+56%** |

**Conclusion:** Still well under 2-second-per-week target, overall <10s for 12-week plan.

### Optimization Opportunities

1. **Cache duration profiles:** Load once, reuse across weeks
2. **Parallel workout selection:** Select all days simultaneously (threading)
3. **Early termination:** Skip refinement if Phase 2 already within tolerance
4. **Memoize scaling:** Cache scaled variants to avoid recomputation

---

## Testing Strategy

### Unit Tests (New)

```python
# tests/core/workout_library/test_duration_distributor.py
def test_distribute_basic()
def test_distribute_with_constraints()
def test_scale_to_target()

# tests/core/workout_library/test_workout_scaler.py
def test_adjust_with_variable_components()
def test_adjust_with_segment_scaling()
def test_adjust_no_change_within_tolerance()

# tests/core/workout_library/test_duration_refiner.py
def test_refine_convergence()
def test_refine_no_flexible_workouts()
def test_refine_max_iterations()
```

### Integration Tests (Modified)

```python
# tests/orchestration/phases/test_training_planning_library.py
def test_week_8_with_adjustment()  # Should now PASS
def test_12_week_plan_with_adjustment()  # All weeks pass
def test_duration_adjustment_disabled()  # Legacy path still works
def test_duration_adjustment_accuracy()  # ±5% target
```

### Acceptance Tests

```python
def test_full_12_week_plan_validation_pass_rate():
    """Test that 12-week plan passes validation 100% of time."""
    for _ in range(10):  # Run 10 times
        plan = generate_12_week_plan(enable_duration_adjustment=True)
        assert plan.validation_pass_rate == 1.0  # 100%

def test_duration_accuracy():
    """Test that weeks are within ±5% of target."""
    plan = generate_12_week_plan(enable_duration_adjustment=True)
    for week in plan.weeks:
        error_pct = abs(week.total_hours - week.target_hours) / week.target_hours
        assert error_pct < 0.05  # ±5%
```

---

## Deployment Strategy

### Phase 1: Development (Week 1-2)

1. Implement new components (DurationDistributor, WorkoutScaler, DurationRefiner)
2. Add unit tests (100% coverage on new code)
3. Integrate into LibraryBasedTrainingPlanningWeeks with feature flag
4. Add integration tests

### Phase 2: Testing (Week 3)

1. Run library migration (add extensibility metadata)
2. Test with real 12-week plans
3. A/B test: new vs. legacy algorithm
4. Validate pass rate: target 98%+

### Phase 3: Staged Rollout (Week 4)

1. Deploy to staging environment
2. Monitor first 100 plan generations
3. Collect metrics: pass rate, accuracy, performance
4. If metrics meet targets → production rollout

### Phase 4: Production (Week 5)

1. Deploy with feature flag enabled by default
2. Monitor production metrics
3. Keep legacy path available for 2 weeks
4. If stable → remove legacy path

### Rollback Plan

```bash
# Immediate rollback (if critical issues)
# Set environment variable to disable new algorithm
export ENABLE_DURATION_ADJUSTMENT=false

# Or use CLI flag
cycling-ai generate --no-duration-adjustment

# Or revert deployment
git revert <commit-hash>
```

---

## Future Enhancements

### Enhancement 1: ML-Based Duration Prediction

Train model to predict optimal durations based on:
- Historical successful plans
- Athlete profile characteristics
- Phase and week number

**Expected improvement:** Reduce refinement iterations from 1-2 to 0-1.

### Enhancement 2: Workout Composition Engine

Combine multiple workouts into single session:
```
60 min tempo + 30 min endurance → 90 min mixed workout
```

**Expected improvement:** Handle very long weeks (>12h) more effectively.

### Enhancement 3: Dynamic Duration Profiles

Learn athlete-specific duration preferences:
```
Athlete A prefers: 60 min weekday, 150 min weekend
Athlete B prefers: 75 min weekday, 120 min weekend
```

**Expected improvement:** Higher satisfaction, fewer manual adjustments.

---

## Conclusion

The proposed architecture provides a **clean, modular, and maintainable** solution to the duration adjustment problem. Key design decisions:

1. **New components are isolated:** Easy to test and maintain independently
2. **Existing code minimally modified:** <10% of codebase changed
3. **Backward compatible:** Legacy path preserved for safety
4. **Type-safe:** Full mypy compliance maintained
5. **Performant:** <2s per week, <10s for 12-week plan

**Expected outcomes:**
- 98%+ validation pass rate (vs current 75-85%)
- ±5% time accuracy (vs current ±10-15%)
- Zero breaking changes
- Production-ready within 4 weeks

**Recommendation:** APPROVE for implementation.

---

**Document Status:** COMPLETE
**Next Document:** IMPLEMENTATION_PLAN.md
