# Workout Library Refactor: Technical Architecture & Implementation Guide

**Status**: Ready for Implementation
**Date**: 2025-11-02
**Reviewed By**: Claude Code (Principal Engineer)

---

## Executive Summary

This document provides a comprehensive technical architecture for refactoring the training plan generation system from LLM-generated workouts to a deterministic, code-based workout selection system using a pre-built library.

**Key Findings**:
- ✅ Proposed 2-phase workflow is architecturally sound
- ✅ Workout library schema is well-designed with minor enhancements needed
- ✅ WorkoutSelector algorithm approach is correct but needs refinement
- ⚠️ Several edge cases identified that require attention
- ⚠️ Duration adjustment algorithm needs constraint-based optimization approach

**Strategic Recommendations**:
1. Implement workout library with versioning from day one
2. Use constraint-based optimization for duration adjustment (not greedy algorithm)
3. Add workout rotation mechanism to prevent monotony
4. Include validation suite with property-based testing
5. Design for extensibility (custom workouts, athlete preferences)

---

## 1. Architecture Review

### 1.1 Proposed 2-Phase Workflow Evaluation

**APPROVED with modifications**

#### Current 3-Phase System
```
Phase 1: create_plan_overview (LLM)
  → Weekly overview with phases, TSS, training_days

Phase 2: add_week_details (LLM × 12)
  → LLM generates workouts from scratch
  → ~13 LLM calls total, ~60 seconds, ~$0.25

Phase 3: finalize_plan (Code)
  → Validates and saves
```

#### Proposed 2-Phase System
```
Phase 1: create_plan_overview (LLM × 1)
  → Weekly overview with phases, TSS, training_days, hard/easy distribution
  → Enhanced to include more constraints

Phase 2: finalize_plan (Pure Python)
  → WorkoutSelector reads weekly_overview
  → Selects workouts from library
  → Adjusts durations to hit TSS/time targets
  → Validates and saves
  → ~1 LLM call, ~10 seconds, ~$0.02
```

**Analysis**:
- ✅ **Correct separation of concerns**: LLM handles strategic planning, code handles tactical execution
- ✅ **Significant performance improvement**: 90%+ reduction in cost and time
- ✅ **Improved testability**: Pure Python logic is easily unit tested
- ✅ **Deterministic output**: Same inputs produce same workouts
- ⚠️ **Loss of flexibility**: Cannot generate novel workouts (acceptable tradeoff)

**Recommendation**: Proceed with 2-phase workflow. The loss of flexibility is acceptable given the quality/consistency gains.

---

### 1.2 Architectural Patterns

#### Pattern 1: Strategy Pattern for Workout Selection
```
WorkoutSelector uses phase-based strategy to select workouts:
- Each phase (Foundation, Build, Recovery, Peak, Taper) has different selection criteria
- WORKOUT_MATRIX defines available workouts per phase × intensity
- Allows easy extension with new phases or workout types
```

#### Pattern 2: Builder Pattern for Workout Construction
```
Workout library stores "templates" with variable components
WorkoutSelector "builds" concrete workouts by:
1. Selecting template from library
2. Adjusting variable components (sets, duration)
3. Calculating final TSS and duration
4. Generating segment structure
```

#### Pattern 3: Constraint Satisfaction for Duration Adjustment
```
Problem: Given N workouts with variable components, adjust them to:
- Hit target weekly TSS (±5%)
- Hit target weekly hours (±5%)
- Respect min/max constraints per workout
- Maintain appropriate hard/easy balance

Solution: Constraint-based optimization (see Section 3.3)
```

---

## 2. Technical Recommendations

### 2.1 Workout Library Schema Review

**Overall Assessment**: Well-designed, needs minor enhancements

#### Proposed Schema (from spec)
```json
{
  "id": "vo2max_classic",
  "name": "VO2 Max intervals",
  "detailed_description": "...",
  "type": "vo2max",
  "intensity": "hard",
  "suitable_phases": ["Build", "Peak"],
  "suitable_weekdays": ["Tuesday", "Wednesday", "Thursday"],
  "base_structure": { ... },
  "variable_components": { ... },
  "base_duration_min": 55,
  "base_tss": 85,
  "tss_calculation": "fixed"
}
```

#### Recommended Enhancements

**1. Add metadata for workout characteristics**
```json
{
  "characteristics": {
    "requires_outdoor": false,
    "requires_flat_terrain": false,
    "fatigue_cost": "high",  // high, medium, low
    "technical_difficulty": "moderate",  // easy, moderate, hard
    "equipment": ["trainer", "power_meter"]
  }
}
```

**2. Add progression metadata**
```json
{
  "progression": {
    "can_progress_to": ["vo2max_advanced"],
    "progression_rule": "increase_sets",
    "progression_increment": 1
  }
}
```

**3. Enhanced variable_components structure**
```json
{
  "variable_components": {
    "type": "sets",  // or "duration" or "both"
    "adjustable_field": "main_set.sets",  // JSON path to field
    "min_value": 4,
    "max_value": 8,
    "default_value": 5,
    "step_size": 1,
    "tss_per_unit": 17,  // TSS change per unit increase
    "duration_per_unit_min": 6  // Duration change per unit
  }
}
```

**4. Add versioning and audit fields**
```json
{
  "version": "1.0.0",
  "created_date": "2025-11-02",
  "last_modified": "2025-11-02",
  "author": "cycling-ai-system",
  "tags": ["intervals", "high_intensity", "build_phase"]
}
```

**5. Complete Enhanced Schema**

```json
{
  "id": "vo2max_classic",
  "name": "VO2 Max intervals",
  "detailed_description": "Ideally perform this on your trainer...",

  "type": "vo2max",
  "intensity": "hard",

  "suitable_phases": ["Build", "Peak"],
  "suitable_weekdays": ["Tuesday", "Wednesday", "Thursday"],

  "characteristics": {
    "requires_outdoor": false,
    "requires_flat_terrain": false,
    "fatigue_cost": "high",
    "technical_difficulty": "moderate",
    "equipment": ["trainer", "power_meter"]
  },

  "base_structure": {
    "warmup": {
      "type": "warmup",
      "duration_min": 15,
      "power_low_pct": 50,
      "power_high_pct": 65,
      "description": "Easy spin"
    },
    "main_set": {
      "type": "interval",
      "sets": 5,
      "work": {
        "duration_min": 3,
        "power_low_pct": 110,
        "power_high_pct": 120,
        "description": "VO2 max effort"
      },
      "recovery": {
        "duration_min": 3,
        "power_low_pct": 50,
        "power_high_pct": 60,
        "description": "Easy recovery"
      }
    },
    "cooldown": {
      "type": "cooldown",
      "duration_min": 10,
      "power_low_pct": 50,
      "power_high_pct": 55,
      "description": "Cool down"
    }
  },

  "variable_components": {
    "type": "sets",
    "adjustable_field": "main_set.sets",
    "min_value": 4,
    "max_value": 8,
    "default_value": 5,
    "step_size": 1,
    "tss_per_unit": 17,
    "duration_per_unit_min": 6
  },

  "base_duration_min": 55,
  "base_tss": 85,
  "tss_calculation": "dynamic",

  "progression": {
    "can_progress_to": ["vo2max_advanced"],
    "progression_rule": "increase_sets",
    "progression_increment": 1
  },

  "version": "1.0.0",
  "created_date": "2025-11-02",
  "last_modified": "2025-11-02",
  "author": "cycling-ai-system",
  "tags": ["intervals", "high_intensity", "vo2max", "build_phase"]
}
```

---

### 2.2 WorkoutSelector Algorithm Assessment

**Current Proposal**: Simple round-robin selection from phase-appropriate pool

**Issues Identified**:
1. No workout variety mechanism (will repeat same workouts)
2. No consideration of athlete preferences
3. No consideration of workout characteristics (outdoor/indoor)
4. No progression logic week-to-week
5. No handling of scheduling conflicts (e.g., back-to-back hard days)

**Recommendation**: Enhanced selection algorithm with multiple strategies

---

### 2.3 Duration Adjustment Strategy

**Current Proposal**: Greedy adjustment algorithm

**Critical Issue**: Greedy algorithm cannot guarantee finding valid solutions within constraints

**Recommendation**: Use constraint-based optimization approach

#### Problem Definition

Given:
- N workouts with variable components
- Target weekly TSS: T_tss (with tolerance ±5%)
- Target weekly hours: T_hours (with tolerance ±5%)
- Each workout i has:
  - Base TSS: b_tss_i
  - Base duration: b_dur_i
  - Variable component type: type_i (sets, duration, or both)
  - Min/max constraints: [min_i, max_i]
  - TSS per unit: tss_unit_i
  - Duration per unit: dur_unit_i

Find:
- Adjustment value for each workout: adj_i
- Such that:
  1. sum(b_tss_i + adj_i × tss_unit_i) ∈ [T_tss × 0.95, T_tss × 1.05]
  2. sum(b_dur_i + adj_i × dur_unit_i) ∈ [T_hours × 60 × 0.95, T_hours × 60 × 1.05]
  3. min_i ≤ b_val_i + adj_i ≤ max_i for all i

This is a **Linear Programming** problem - solvable optimally.

#### Recommended Approach: Two-Phase Optimization

**Phase 1: Flexible Duration Workouts**
```python
# Adjust endurance/recovery workouts (fully variable duration)
flexible_workouts = [w for w in workouts if w.variable_type == "duration"]

for workout in flexible_workouts:
    # Calculate TSS and duration contribution needed
    tss_contribution = (target_tss - current_tss) / len(flexible_workouts)
    duration_contribution = (target_hours - current_hours) / len(flexible_workouts)

    # Adjust to meet both constraints (weighted average)
    # Use TSS as primary constraint, duration as secondary
    adjustment = solve_for_adjustment(
        workout,
        tss_target=tss_contribution,
        duration_target=duration_contribution,
        weight_tss=0.7,
        weight_duration=0.3
    )

    # Apply adjustment within min/max bounds
    workout.adjusted_value = clamp(
        workout.base_value + adjustment,
        workout.min_value,
        workout.max_value
    )
```

**Phase 2: Interval Set Workouts**
```python
# Adjust interval workouts (discrete sets)
interval_workouts = [w for w in workouts if w.variable_type == "sets"]

# Recalculate gaps after Phase 1
tss_gap = target_tss - calculate_current_tss(workouts)
duration_gap = target_hours * 60 - calculate_current_duration(workouts)

# Use integer linear programming for discrete adjustments
adjustments = solve_ilp(
    workouts=interval_workouts,
    tss_gap=tss_gap,
    duration_gap=duration_gap,
    constraints=[w.min_value, w.max_value for w in interval_workouts]
)

for workout, adj in zip(interval_workouts, adjustments):
    workout.adjusted_value = workout.base_value + adj
```

**Phase 3: Validation and Fallback**
```python
# Check if solution meets constraints
final_tss = calculate_total_tss(workouts)
final_duration = calculate_total_duration(workouts)

if not within_tolerance(final_tss, target_tss, tolerance=0.05):
    # Fallback: Relax constraints or warn user
    logger.warning(f"Could not meet TSS target within 5%. Final: {final_tss}, Target: {target_tss}")

if not within_tolerance(final_duration, target_hours * 60, tolerance=0.05):
    logger.warning(f"Could not meet duration target within 5%. Final: {final_duration}, Target: {target_hours * 60}")
```

---

### 2.4 Phase-Based Workout Matrix Review

**Current Proposal**:
```python
WORKOUT_MATRIX = {
    "Foundation": {
        "hard": ["tempo_steady", "sweet_spot_intervals"],
        "easy": ["endurance_z2", "recovery_spin"]
    },
    "Build": {
        "hard": ["threshold_intervals", "vo2max_classic", "sweet_spot_intervals"],
        "easy": ["endurance_z2", "tempo_steady"]
    },
    # ...
}
```

**Assessment**: ✅ Good foundation, needs refinement

**Recommendations**:

1. **Add workout priorities/weights**
```python
WORKOUT_MATRIX = {
    "Foundation": {
        "hard": {
            "tempo_steady": {"weight": 0.4, "priority": 1},
            "sweet_spot_intervals": {"weight": 0.6, "priority": 2}
        },
        "easy": {
            "endurance_z2": {"weight": 0.8, "priority": 1},
            "recovery_spin": {"weight": 0.2, "priority": 2}
        }
    },
    # ...
}
```

2. **Add weekday preferences**
```python
WEEKDAY_PREFERENCES = {
    "hard": ["Tuesday", "Thursday", "Saturday"],  # Prefer mid-week and weekend
    "easy": ["Monday", "Wednesday", "Friday", "Sunday"]
}
```

3. **Add workout combination rules**
```python
COMBINATION_RULES = {
    "vo2max_classic": {
        "min_recovery_days_after": 2,
        "cannot_follow": ["threshold_continuous"],
        "best_paired_with": ["endurance_z2", "recovery_spin"]
    }
}
```

---

## 3. Implementation Considerations

### 3.1 Edge Cases Identified

#### Edge Case 1: Insufficient Training Days
**Scenario**: Athlete has 3 training days, plan requires 4 hard workouts per week

**Solution**:
```python
def validate_weekly_capacity(week_overview: dict) -> tuple[bool, str]:
    """Validate that training days can accommodate hard/easy distribution."""
    training_days = len(week_overview["training_days"])
    required_days = week_overview["hard_days"] + week_overview["easy_days"]

    if required_days > training_days:
        return False, (
            f"Week {week_overview['week_number']}: "
            f"Required {required_days} workouts but only {training_days} training days available"
        )

    return True, ""
```

**Mitigation**: Add validation in Phase 1 (create_plan_overview) to ensure LLM respects athlete's available days.

---

#### Edge Case 2: TSS Target Unreachable
**Scenario**: Target TSS is 400, but available workouts max out at 350 TSS

**Solution**:
```python
def check_tss_feasibility(
    workouts: list[Workout],
    target_tss: float,
    tolerance: float = 0.10
) -> tuple[bool, float, float]:
    """Check if target TSS is reachable with available workouts."""
    max_possible_tss = sum(
        w.base_tss + (w.max_value - w.base_value) * w.tss_per_unit
        for w in workouts
    )
    min_possible_tss = sum(
        w.base_tss + (w.min_value - w.base_value) * w.tss_per_unit
        for w in workouts
    )

    if target_tss > max_possible_tss * (1 + tolerance):
        return False, max_possible_tss, target_tss
    elif target_tss < min_possible_tss * (1 - tolerance):
        return False, min_possible_tss, target_tss

    return True, min_possible_tss, max_possible_tss
```

**Mitigation**:
1. Validate feasibility before adjustment
2. If infeasible, log warning and adjust target to max_possible_tss
3. Consider adding "filler" workout (extra endurance ride) if needed

---

#### Edge Case 3: Conflicting Duration and TSS Constraints
**Scenario**: Target TSS requires high-intensity work, but target hours requires long duration (low intensity)

**Solution**: Prioritize TSS over duration (TSS is more important for training load)

```python
def resolve_constraint_conflict(
    tss_gap: float,
    duration_gap: float,
    workouts: list[Workout]
) -> str:
    """Determine which constraint to prioritize when conflicts arise."""
    # Calculate required intensity factor
    required_if = calculate_required_intensity_factor(tss_gap, duration_gap)

    if required_if > 1.2:  # Unrealistically high
        return "prioritize_tss"  # Hit TSS even if duration is off
    elif required_if < 0.5:  # Unrealistically low
        return "prioritize_duration"  # Hit duration even if TSS is off
    else:
        return "balance"  # Try to hit both
```

---

#### Edge Case 4: Back-to-Back Hard Days
**Scenario**: Scheduling algorithm places two VO2 max workouts on consecutive days

**Solution**: Add scheduling constraint validator

```python
def validate_workout_spacing(
    weekly_assignments: list[WorkoutAssignment]
) -> list[str]:
    """Validate that hard workouts are properly spaced."""
    errors = []

    # Sort by weekday
    sorted_workouts = sorted(weekly_assignments, key=lambda w: WEEKDAY_ORDER[w.weekday])

    for i in range(len(sorted_workouts) - 1):
        current = sorted_workouts[i]
        next_workout = sorted_workouts[i + 1]

        # Check for back-to-back high-intensity workouts
        if (current.workout.intensity == "hard" and
            next_workout.workout.intensity == "hard" and
            current.workout.characteristics["fatigue_cost"] == "high" and
            next_workout.workout.characteristics["fatigue_cost"] == "high"):

            errors.append(
                f"High-fatigue workouts on consecutive days: "
                f"{current.weekday} ({current.workout.name}) → "
                f"{next_workout.weekday} ({next_workout.workout.name})"
            )

    return errors
```

**Mitigation**: Implement smart scheduling that spaces hard workouts appropriately.

---

#### Edge Case 5: Workout Library Empty for Phase
**Scenario**: Taper phase has no suitable hard workouts in library

**Solution**: Graceful fallback to previous phase workouts

```python
def select_workout_with_fallback(
    phase: str,
    intensity: str,
    library: WorkoutLibrary
) -> Workout:
    """Select workout with fallback to previous phases."""
    candidates = library.get_workouts_for_phase(phase, intensity)

    if not candidates:
        # Fallback order
        fallback_phases = PHASE_FALLBACK_MAP.get(phase, [])
        for fallback_phase in fallback_phases:
            candidates = library.get_workouts_for_phase(fallback_phase, intensity)
            if candidates:
                logger.warning(
                    f"No {intensity} workouts for phase {phase}, "
                    f"using workouts from {fallback_phase}"
                )
                break

    if not candidates:
        raise ValueError(f"No suitable {intensity} workouts found for phase {phase}")

    return random.choice(candidates)
```

---

### 3.2 Algorithm Improvements

#### Improvement 1: Workout Rotation Strategy

**Problem**: Round-robin selection leads to predictable, monotonous plans

**Solution**: Weighted random selection with history tracking

```python
class WorkoutRotationStrategy:
    """Manages workout variety through weighted random selection."""

    def __init__(self, lookback_weeks: int = 3):
        self.lookback_weeks = lookback_weeks
        self.workout_history: deque[str] = deque(maxlen=lookback_weeks * 7)

    def select_workout(
        self,
        candidates: list[Workout],
        phase: str,
        week_number: int
    ) -> Workout:
        """Select workout with variety consideration."""
        # Calculate recency penalty for each candidate
        weights = []
        for workout in candidates:
            recent_count = self.workout_history.count(workout.id)

            # Reduce weight based on recency (exponential decay)
            base_weight = 1.0
            recency_penalty = 0.5 ** recent_count  # Halve weight per recent use

            # Apply phase-specific weight from WORKOUT_MATRIX
            phase_weight = WORKOUT_MATRIX[phase][workout.intensity].get(
                workout.id, {}
            ).get("weight", 1.0)

            final_weight = base_weight * recency_penalty * phase_weight
            weights.append(final_weight)

        # Weighted random selection
        selected = random.choices(candidates, weights=weights, k=1)[0]

        # Track selection
        self.workout_history.append(selected.id)

        return selected
```

---

#### Improvement 2: Progressive Overload Algorithm

**Problem**: No week-to-week progression in workout difficulty

**Solution**: Incremental progression based on plan phase and week number

```python
def apply_progressive_overload(
    workout: Workout,
    week_number: int,
    phase: str,
    total_weeks: int
) -> Workout:
    """Apply progressive overload to workout based on week and phase."""
    # Calculate progression factor (0.0 to 1.0)
    phase_progress = calculate_phase_progress(week_number, phase, total_weeks)

    if workout.progression and workout.progression["progression_rule"]:
        rule = workout.progression["progression_rule"]
        increment = workout.progression["progression_increment"]

        if rule == "increase_sets":
            # Gradually increase sets as phase progresses
            additional_sets = int(phase_progress * increment)
            workout.base_value = min(
                workout.base_value + additional_sets,
                workout.max_value
            )

        elif rule == "increase_duration":
            # Gradually increase duration as phase progresses
            additional_duration = int(phase_progress * increment * 10)  # 10 min increments
            workout.base_duration_min = min(
                workout.base_duration_min + additional_duration,
                workout.variable_components["max_value"]
            )

        elif rule == "increase_intensity":
            # Increase power targets slightly (not implemented in library yet)
            pass

    return workout
```

---

#### Improvement 3: Smart Weekday Assignment

**Problem**: No logic for optimal workout timing (e.g., long rides on weekends)

**Solution**: Priority-based weekday assignment

```python
def assign_workouts_to_weekdays(
    week_overview: dict,
    selected_workouts: list[Workout]
) -> list[WorkoutAssignment]:
    """Assign workouts to specific weekdays intelligently."""
    available_days = week_overview["training_days"]

    # Categorize workouts by characteristics
    long_workouts = [w for w in selected_workouts if w.base_duration_min > 120]
    hard_workouts = [w for w in selected_workouts if w.intensity == "hard" and w not in long_workouts]
    easy_workouts = [w for w in selected_workouts if w.intensity == "easy" and w not in long_workouts]

    assignments = []
    used_days = set()

    # Priority 1: Assign long workouts to weekends (if available)
    weekend_days = [d for d in available_days if d in ["Saturday", "Sunday"]]
    for workout in long_workouts:
        if weekend_days:
            day = weekend_days.pop(0)
            assignments.append(WorkoutAssignment(weekday=day, workout=workout))
            used_days.add(day)

    # Priority 2: Assign hard workouts to preferred days (mid-week, remaining weekend)
    preferred_hard_days = [d for d in available_days if d in ["Tuesday", "Thursday"] and d not in used_days]
    preferred_hard_days.extend([d for d in weekend_days if d not in used_days])

    for workout in hard_workouts:
        if preferred_hard_days:
            day = preferred_hard_days.pop(0)
        else:
            # Fallback to any available day
            remaining = [d for d in available_days if d not in used_days]
            day = remaining.pop(0)

        assignments.append(WorkoutAssignment(weekday=day, workout=workout))
        used_days.add(day)

    # Priority 3: Assign easy workouts to remaining days
    for workout in easy_workouts:
        remaining = [d for d in available_days if d not in used_days]
        day = remaining.pop(0)
        assignments.append(WorkoutAssignment(weekday=day, workout=workout))
        used_days.add(day)

    # Validate spacing (no back-to-back hard days if possible)
    errors = validate_workout_spacing(assignments)
    if errors:
        logger.warning(f"Workout spacing issues: {errors}")
        # Attempt to reschedule (not shown here)

    return sorted(assignments, key=lambda a: WEEKDAY_ORDER[a.weekday])
```

---

### 3.3 Testability and Maintainability

#### Unit Testing Strategy

**Test Categories**:
1. **Workout Library Tests** - Schema validation, loading, querying
2. **Selection Logic Tests** - Phase-appropriate selection, variety, progression
3. **Adjustment Algorithm Tests** - TSS/duration targeting, constraint satisfaction
4. **Integration Tests** - End-to-end workflow with various athlete profiles
5. **Property-Based Tests** - Invariant checking across random inputs

**Example Test Suite Structure**:

```python
# tests/core/test_workout_library.py
class TestWorkoutLibrary:
    def test_load_library_valid_schema(self):
        """Test that workout library loads and validates against schema."""
        library = WorkoutLibrary.load("data/workout_library.json")
        assert len(library.workouts) > 0

        for workout in library.workouts:
            # Validate required fields
            assert workout.id
            assert workout.name
            assert workout.type in VALID_WORKOUT_TYPES
            assert workout.intensity in ["hard", "easy"]

    def test_get_workouts_for_phase(self):
        """Test filtering workouts by phase and intensity."""
        library = WorkoutLibrary.load("data/workout_library.json")

        build_hard = library.get_workouts_for_phase("Build", "hard")
        assert len(build_hard) > 0

        for workout in build_hard:
            assert "Build" in workout.suitable_phases
            assert workout.intensity == "hard"


# tests/core/test_workout_selector.py
class TestWorkoutSelector:
    def test_assign_workouts_foundation_phase(self):
        """Test workout assignment for Foundation phase."""
        week_overview = {
            "week_number": 1,
            "phase": "Foundation",
            "training_days": ["Tuesday", "Thursday", "Saturday", "Sunday"],
            "hard_days": 1,
            "easy_days": 3,
            "target_tss": 200,
            "total_hours": 5.0
        }

        selector = WorkoutSelector(library_path="data/workout_library.json")
        assignments = selector.assign_weekly_workouts(week_overview, ftp=250)

        # Validate assignments
        assert len(assignments) == 4  # 4 training days
        assert sum(1 for a in assignments if a.workout.intensity == "hard") == 1
        assert sum(1 for a in assignments if a.workout.intensity == "easy") == 3

        # Validate TSS and duration targets (±5%)
        total_tss = sum(a.adjusted_tss for a in assignments)
        total_duration = sum(a.adjusted_duration_min for a in assignments)

        assert 190 <= total_tss <= 210  # 200 ± 5%
        assert 285 <= total_duration <= 315  # 300 min ± 5%

    def test_workout_variety_across_weeks(self):
        """Test that workout selection varies across weeks."""
        selector = WorkoutSelector(library_path="data/workout_library.json")

        workout_ids = []
        for week in range(1, 5):
            week_overview = {
                "week_number": week,
                "phase": "Build",
                "training_days": ["Tuesday", "Thursday", "Saturday"],
                "hard_days": 2,
                "easy_days": 1,
                "target_tss": 250,
                "total_hours": 6.0
            }

            assignments = selector.assign_weekly_workouts(week_overview, ftp=250)
            week_ids = [a.workout.id for a in assignments]
            workout_ids.extend(week_ids)

        # Check that we have variety (not same 3 workouts repeated 4 times)
        unique_workouts = set(workout_ids)
        assert len(unique_workouts) >= 6  # At least 6 different workouts across 4 weeks


# tests/core/test_duration_adjustment.py
class TestDurationAdjustment:
    def test_adjustment_meets_tss_target(self):
        """Test that duration adjustment hits TSS target."""
        workouts = [
            Workout(id="endurance_z2", base_tss=60, base_duration=90, ...),
            Workout(id="threshold_intervals", base_tss=85, base_duration=75, ...),
        ]

        adjuster = DurationAdjuster()
        adjusted = adjuster.adjust_to_targets(
            workouts=workouts,
            target_tss=200,
            target_hours=4.0,
            tolerance=0.05
        )

        total_tss = sum(w.adjusted_tss for w in adjusted)
        assert 190 <= total_tss <= 210

    def test_adjustment_respects_constraints(self):
        """Test that adjustments respect min/max constraints."""
        workout = Workout(
            id="vo2max",
            variable_components={
                "min_value": 4,
                "max_value": 8,
                "base_value": 5
            }
        )

        # Request large increase
        adjuster = DurationAdjuster()
        adjusted = adjuster.adjust_single_workout(
            workout=workout,
            target_increase_tss=100  # Unrealistic
        )

        # Should cap at max_value
        assert adjusted.adjusted_value <= 8


# tests/integration/test_training_plan_generation.py
@pytest.mark.integration
class TestTrainingPlanGeneration:
    def test_full_workflow_4_week_plan(self, athlete_profile):
        """Test complete training plan generation workflow."""
        # Phase 1: Create overview (would be LLM call in production)
        overview = create_plan_overview_mock(weeks=4, phase="Foundation")

        # Phase 2: Finalize plan (WorkoutSelector)
        selector = WorkoutSelector(library_path="data/workout_library.json")

        complete_plan = {"weeks": []}
        for week_overview in overview["weekly_overview"]:
            assignments = selector.assign_weekly_workouts(
                week_overview=week_overview,
                ftp=athlete_profile.ftp
            )

            complete_plan["weeks"].append({
                "week_number": week_overview["week_number"],
                "phase": week_overview["phase"],
                "workouts": [a.to_dict() for a in assignments]
            })

        # Validate complete plan
        assert len(complete_plan["weeks"]) == 4

        for week in complete_plan["weeks"]:
            assert "week_number" in week
            assert "phase" in week
            assert "workouts" in week
            assert len(week["workouts"]) > 0
```

---

#### Property-Based Testing (Hypothesis)

Use property-based testing to validate invariants:

```python
from hypothesis import given, strategies as st

@given(
    target_tss=st.floats(min_value=100, max_value=600),
    target_hours=st.floats(min_value=2.0, max_value=12.0),
    num_workouts=st.integers(min_value=3, max_value=6)
)
def test_adjustment_always_finds_solution_within_tolerance(
    target_tss, target_hours, num_workouts
):
    """Property: Adjustment algorithm should always find solution within 10% tolerance."""
    # Generate random workouts
    workouts = generate_random_workouts(num_workouts)

    adjuster = DurationAdjuster()
    adjusted = adjuster.adjust_to_targets(
        workouts=workouts,
        target_tss=target_tss,
        target_hours=target_hours,
        tolerance=0.10  # 10% tolerance
    )

    total_tss = sum(w.adjusted_tss for w in adjusted)
    total_hours = sum(w.adjusted_duration_min for w in adjusted) / 60

    # Property: Should be within 10% of targets (or fail gracefully)
    if adjusted:  # If solution found
        assert 0.9 * target_tss <= total_tss <= 1.1 * target_tss
        assert 0.9 * target_hours <= total_hours <= 1.1 * target_hours
```

---

### 3.4 Data Structures and Type Safety

#### Core Data Classes

```python
from dataclasses import dataclass, field
from typing import Literal, Optional
from datetime import datetime
from pathlib import Path

@dataclass
class WorkoutCharacteristics:
    """Metadata about workout characteristics."""
    requires_outdoor: bool = False
    requires_flat_terrain: bool = False
    fatigue_cost: Literal["high", "medium", "low"] = "medium"
    technical_difficulty: Literal["easy", "moderate", "hard"] = "moderate"
    equipment: list[str] = field(default_factory=lambda: ["trainer", "power_meter"])


@dataclass
class VariableComponents:
    """Defines variable/adjustable components of a workout."""
    type: Literal["sets", "duration", "both"]
    adjustable_field: str  # JSON path: "main_set.sets"
    min_value: float
    max_value: float
    default_value: float
    step_size: float = 1.0
    tss_per_unit: float = 0.0  # TSS change per unit
    duration_per_unit_min: float = 0.0  # Duration change per unit


@dataclass
class WorkoutProgression:
    """Defines progression rules for workout."""
    can_progress_to: list[str] = field(default_factory=list)
    progression_rule: Literal["increase_sets", "increase_duration", "increase_intensity", "none"] = "none"
    progression_increment: float = 1.0


@dataclass
class WorkoutSegment:
    """Single segment of a workout."""
    type: Literal["warmup", "interval", "work", "recovery", "cooldown", "steady", "tempo"]
    duration_min: int
    power_low_pct: float
    power_high_pct: float
    description: str


@dataclass
class WorkoutStructure:
    """Complete workout structure with all segments."""
    warmup: Optional[dict] = None
    main_set: Optional[dict] = None
    cooldown: Optional[dict] = None


@dataclass
class Workout:
    """Complete workout definition from library."""
    id: str
    name: str
    detailed_description: str
    type: str
    intensity: Literal["hard", "easy"]

    suitable_phases: list[str]
    suitable_weekdays: list[str]

    characteristics: WorkoutCharacteristics
    base_structure: WorkoutStructure
    variable_components: VariableComponents

    base_duration_min: int
    base_tss: float
    tss_calculation: Literal["dynamic", "fixed"] = "dynamic"

    progression: Optional[WorkoutProgression] = None

    # Metadata
    version: str = "1.0.0"
    created_date: str = field(default_factory=lambda: datetime.now().isoformat())
    last_modified: str = field(default_factory=lambda: datetime.now().isoformat())
    author: str = "cycling-ai-system"
    tags: list[str] = field(default_factory=list)

    def calculate_tss(self, duration_min: int, adjusted_value: float, ftp: float) -> float:
        """Calculate TSS for adjusted workout."""
        if self.tss_calculation == "fixed":
            return self.base_tss

        # Calculate based on adjusted parameters
        value_change = adjusted_value - self.variable_components.default_value
        tss_change = value_change * self.variable_components.tss_per_unit

        return self.base_tss + tss_change


@dataclass
class WorkoutAssignment:
    """Workout assigned to specific weekday with adjustments."""
    weekday: str
    workout: Workout
    adjusted_value: float  # Adjusted variable component value (sets or duration)
    adjusted_duration_min: int
    adjusted_tss: float
    segments: list[WorkoutSegment]

    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            "weekday": self.weekday,
            "name": self.workout.name,
            "detailed_description": self.workout.detailed_description,
            "total_duration_min": self.adjusted_duration_min,
            "tss": self.adjusted_tss,
            "segments": [
                {
                    "type": seg.type,
                    "duration_min": seg.duration_min,
                    "power_low_pct": seg.power_low_pct,
                    "power_high_pct": seg.power_high_pct,
                    "description": seg.description
                }
                for seg in self.segments
            ]
        }


@dataclass
class WorkoutLibrary:
    """Container for all workouts."""
    workouts: list[Workout] = field(default_factory=list)
    version: str = "1.0.0"

    @classmethod
    def load(cls, path: Path) -> "WorkoutLibrary":
        """Load workout library from JSON file."""
        with open(path) as f:
            data = json.load(f)

        # Validate schema version
        if data.get("version", "1.0.0") != cls.version:
            logger.warning(f"Library version mismatch: {data.get('version')} != {cls.version}")

        # Parse workouts
        workouts = []
        for workout_data in data.get("workouts", []):
            workout = cls._parse_workout(workout_data)
            workouts.append(workout)

        return cls(workouts=workouts, version=data.get("version", "1.0.0"))

    @staticmethod
    def _parse_workout(data: dict) -> Workout:
        """Parse single workout from dict."""
        return Workout(
            id=data["id"],
            name=data["name"],
            detailed_description=data["detailed_description"],
            type=data["type"],
            intensity=data["intensity"],
            suitable_phases=data["suitable_phases"],
            suitable_weekdays=data["suitable_weekdays"],
            characteristics=WorkoutCharacteristics(**data.get("characteristics", {})),
            base_structure=WorkoutStructure(**data.get("base_structure", {})),
            variable_components=VariableComponents(**data["variable_components"]),
            base_duration_min=data["base_duration_min"],
            base_tss=data["base_tss"],
            tss_calculation=data.get("tss_calculation", "dynamic"),
            progression=WorkoutProgression(**data["progression"]) if "progression" in data else None,
            version=data.get("version", "1.0.0"),
            created_date=data.get("created_date", datetime.now().isoformat()),
            last_modified=data.get("last_modified", datetime.now().isoformat()),
            author=data.get("author", "cycling-ai-system"),
            tags=data.get("tags", [])
        )

    def get_workouts_for_phase(
        self,
        phase: str,
        intensity: Literal["hard", "easy"]
    ) -> list[Workout]:
        """Get all workouts suitable for phase and intensity."""
        return [
            w for w in self.workouts
            if phase in w.suitable_phases and w.intensity == intensity
        ]

    def get_workout_by_id(self, workout_id: str) -> Optional[Workout]:
        """Get workout by ID."""
        for workout in self.workouts:
            if workout.id == workout_id:
                return workout
        return None
```

---

## 4. Answers to Open Questions

### Question 1: Workout Variety

**Question**: How to prevent same workout every week?

**Answer**: Implement **weighted random selection with history tracking** (see Section 3.2, Improvement 1)

**Strategy**:
1. Track last 3 weeks of workout selections in rotation manager
2. Apply exponential decay penalty to recently used workouts (0.5^n)
3. Use weighted random selection (not deterministic round-robin)
4. Combine recency penalty with phase-specific weights from WORKOUT_MATRIX

**Benefits**:
- Ensures variety while respecting phase-appropriate workouts
- Probabilistic approach prevents predictable patterns
- Configurable lookback window (3 weeks by default)
- Still deterministic with seed for testing

**Configuration**:
```python
selector = WorkoutSelector(
    library_path="data/workout_library.json",
    variety_strategy="weighted_random",
    lookback_weeks=3,
    random_seed=42  # For deterministic testing
)
```

---

### Question 2: Custom Workouts

**Question**: How to support athlete-specific workouts?

**Answer**: **Layered library approach with merge strategy**

**Implementation**:

1. **System Library** (`data/workout_library.json`)
   - Core workouts maintained by system
   - Version controlled
   - Updated with system releases

2. **User Library** (`~/.cycling-ai/custom_workouts.json`)
   - Athlete-specific workouts
   - Same schema as system library
   - Loaded and merged at runtime

3. **Merge Strategy**:
```python
class WorkoutLibrary:
    @classmethod
    def load_with_custom(
        cls,
        system_path: Path,
        custom_path: Optional[Path] = None
    ) -> "WorkoutLibrary":
        """Load system library and merge with custom workouts."""
        # Load system library
        system_lib = cls.load(system_path)

        # Load custom library if exists
        if custom_path and custom_path.exists():
            custom_lib = cls.load(custom_path)

            # Merge: custom workouts override system workouts with same ID
            workout_map = {w.id: w for w in system_lib.workouts}

            for custom_workout in custom_lib.workouts:
                if custom_workout.id in workout_map:
                    logger.info(f"Overriding system workout: {custom_workout.id}")
                workout_map[custom_workout.id] = custom_workout

            system_lib.workouts = list(workout_map.values())

        return system_lib
```

**User Experience**:
```bash
# Create custom workout
cycling-ai workout create --name "My Custom VO2" --template vo2max_classic

# Edit custom workout
cycling-ai workout edit --id my_custom_vo2

# List custom workouts
cycling-ai workout list --custom

# Generate plan using custom workouts
cycling-ai generate --profile profile.json --custom-workouts ~/.cycling-ai/custom_workouts.json
```

---

### Question 3: Workout Progression

**Question**: How to progress workouts week-to-week?

**Answer**: **Phase-based progressive overload with multiple strategies**

**Progression Strategies**:

1. **Increase Volume** (Foundation/Build phases)
   - Gradually increase sets: 4 → 5 → 6 → 7 → 8
   - Gradually increase duration: 60 → 75 → 90 → 105 → 120 min
   - Linear progression based on week number within phase

2. **Increase Intensity** (Peak phase)
   - Increase power targets: 110% → 115% → 120% FTP
   - Decrease recovery time: 3 min → 2.5 min → 2 min
   - Implemented via workout variants in library

3. **Maintain then Taper** (Taper phase)
   - Maintain intensity, reduce volume
   - Week 1: 100% volume, Week 2: 75%, Week 3: 50%

**Implementation** (see Section 3.2, Improvement 2):

```python
def apply_progressive_overload(
    workout: Workout,
    week_number: int,
    phase: str,
    total_weeks: int
) -> Workout:
    """Apply progressive overload based on phase progression."""
    phase_progress = calculate_phase_progress(week_number, phase, total_weeks)
    # ... (full implementation in Section 3.2)
```

**Progression Configuration in Library**:
```json
{
  "id": "threshold_intervals",
  "progression": {
    "can_progress_to": ["threshold_continuous"],
    "progression_rule": "increase_sets",
    "progression_increment": 1
  }
}
```

---

### Question 4: Library Versioning

**Question**: How to version workout library?

**Answer**: **Semantic versioning with migration strategy**

**Versioning Scheme**:
- **MAJOR.MINOR.PATCH** (e.g., 1.2.3)
- **MAJOR**: Breaking schema changes (requires migration)
- **MINOR**: New workouts or non-breaking schema additions
- **PATCH**: Bug fixes, description updates

**Schema Version Management**:

```json
{
  "library_version": "1.2.0",
  "schema_version": "1.0.0",
  "compatible_app_versions": [">=0.1.0", "<2.0.0"],
  "workouts": [...]
}
```

**Migration Strategy**:

```python
class LibraryMigration:
    """Handles library schema migrations."""

    @staticmethod
    def migrate(library_data: dict, from_version: str, to_version: str) -> dict:
        """Migrate library from one version to another."""
        migrations = {
            ("1.0.0", "1.1.0"): LibraryMigration._migrate_1_0_to_1_1,
            ("1.1.0", "1.2.0"): LibraryMigration._migrate_1_1_to_1_2,
        }

        migration_key = (from_version, to_version)
        if migration_key not in migrations:
            raise ValueError(f"No migration path from {from_version} to {to_version}")

        migration_func = migrations[migration_key]
        return migration_func(library_data)

    @staticmethod
    def _migrate_1_0_to_1_1(data: dict) -> dict:
        """Migrate from 1.0.0 to 1.1.0: Add characteristics field."""
        for workout in data["workouts"]:
            if "characteristics" not in workout:
                workout["characteristics"] = {
                    "requires_outdoor": False,
                    "requires_flat_terrain": False,
                    "fatigue_cost": "medium",
                    "technical_difficulty": "moderate",
                    "equipment": ["trainer", "power_meter"]
                }

        data["schema_version"] = "1.1.0"
        return data
```

**Backward Compatibility Check**:

```python
class WorkoutLibrary:
    @classmethod
    def load(cls, path: Path) -> "WorkoutLibrary":
        """Load library with version compatibility check."""
        with open(path) as f:
            data = json.load(f)

        library_version = data.get("schema_version", "1.0.0")

        if not cls._is_compatible(library_version):
            # Attempt migration
            logger.info(f"Migrating library from {library_version} to {cls.SCHEMA_VERSION}")
            data = LibraryMigration.migrate(data, library_version, cls.SCHEMA_VERSION)

        return cls._parse(data)

    @classmethod
    def _is_compatible(cls, library_version: str) -> bool:
        """Check if library version is compatible with current schema."""
        # Use semantic versioning rules
        lib_major = int(library_version.split('.')[0])
        schema_major = int(cls.SCHEMA_VERSION.split('.')[0])

        return lib_major == schema_major  # Major version must match
```

**Versioning Best Practices**:
1. Always include `schema_version` in library JSON
2. Document breaking changes in CHANGELOG.md
3. Provide migration scripts for major version bumps
4. Test migrations with property-based tests
5. Keep old library versions in git for rollback

---

## 5. Risk Assessment

### Risk Matrix

| Risk | Likelihood | Impact | Severity | Mitigation |
|------|-----------|--------|----------|------------|
| TSS targets unreachable with library workouts | Medium | High | **HIGH** | Feasibility check before adjustment + fallback to closest achievable |
| Workout monotony (same workouts repeated) | High | Medium | **MEDIUM** | Weighted random selection with history tracking |
| Edge case: Conflicting TSS/duration constraints | Medium | Medium | **MEDIUM** | Prioritize TSS, log warnings, relax tolerance to 10% |
| Custom workouts break schema validation | Low | High | **MEDIUM** | Strict schema validation on load, clear error messages |
| Library version incompatibility after upgrade | Low | High | **MEDIUM** | Migration system + backward compatibility checks |
| Back-to-back hard workouts causing injury | Low | Critical | **MEDIUM** | Workout spacing validation + smart scheduling algorithm |
| Insufficient training days for requirements | Low | High | **MEDIUM** | Validate in Phase 1 (LLM overview), reject impossible plans early |
| Integer linear programming solver failure | Very Low | Medium | **LOW** | Fallback to greedy algorithm with relaxed constraints |

---

### Mitigation Strategies

#### High-Priority Mitigations

**1. TSS Feasibility Guard**
```python
def validate_tss_feasibility(
    weekly_overview: dict,
    library: WorkoutLibrary
) -> tuple[bool, str]:
    """Validate that target TSS is achievable before starting."""
    phase = weekly_overview["phase"]
    hard_days = weekly_overview["hard_days"]
    easy_days = weekly_overview["easy_days"]
    target_tss = weekly_overview["target_tss"]

    # Get available workouts
    hard_workouts = library.get_workouts_for_phase(phase, "hard")
    easy_workouts = library.get_workouts_for_phase(phase, "easy")

    # Calculate max possible TSS
    max_hard_tss = max(w.base_tss + (w.max_value - w.base_value) * w.tss_per_unit
                       for w in hard_workouts)
    max_easy_tss = max(w.base_tss + (w.max_value - w.base_value) * w.tss_per_unit
                       for w in easy_workouts)

    max_possible_tss = (hard_days * max_hard_tss) + (easy_days * max_easy_tss)

    if target_tss > max_possible_tss * 1.05:
        return False, (
            f"Target TSS {target_tss} unreachable. "
            f"Max possible: {max_possible_tss:.0f} with current library."
        )

    return True, ""
```

**2. Comprehensive Validation Suite**
```python
def validate_complete_plan(
    plan: dict,
    athlete_profile: AthleteProfile,
    library: WorkoutLibrary
) -> ValidationResult:
    """Comprehensive validation of complete training plan."""
    errors = []
    warnings = []

    for week in plan["weeks"]:
        # Check TSS feasibility
        feasible, msg = validate_tss_feasibility(week, library)
        if not feasible:
            errors.append(msg)

        # Check workout spacing
        spacing_errors = validate_workout_spacing(week["workouts"])
        errors.extend(spacing_errors)

        # Check training days match athlete availability
        for workout in week["workouts"]:
            if workout["weekday"] not in athlete_profile.get_training_days():
                errors.append(
                    f"Week {week['week_number']}: Workout on {workout['weekday']} "
                    f"but athlete not available"
                )

        # Check weekly volume
        weekly_hours = sum(w["total_duration_min"] for w in week["workouts"]) / 60
        max_hours = athlete_profile.get_weekly_training_hours()
        if weekly_hours > max_hours * 1.2:  # 20% tolerance
            warnings.append(
                f"Week {week['week_number']}: {weekly_hours:.1f}h exceeds "
                f"athlete's available {max_hours:.1f}h by >20%"
            )

    return ValidationResult(
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings
    )
```

**3. Graceful Degradation**
```python
class WorkoutSelector:
    def assign_weekly_workouts(
        self,
        week_overview: dict,
        ftp: float,
        strict: bool = False
    ) -> list[WorkoutAssignment]:
        """Assign workouts with graceful degradation on failure."""
        try:
            # Attempt optimal assignment
            assignments = self._assign_optimal(week_overview, ftp)

            # Validate
            if self._validate_assignments(assignments, week_overview):
                return assignments

        except Exception as e:
            logger.warning(f"Optimal assignment failed: {e}")

        if strict:
            raise ValueError("Could not assign workouts within strict constraints")

        # Fallback: Relaxed constraints (10% tolerance instead of 5%)
        logger.info("Falling back to relaxed constraints (10% tolerance)")
        try:
            assignments = self._assign_optimal(
                week_overview,
                ftp,
                tolerance=0.10
            )
            return assignments
        except Exception as e:
            logger.error(f"Relaxed assignment also failed: {e}")
            raise
```

---

### Migration Complexity Assessment

**Migration Path**: Current 3-phase → New 2-phase system

**Complexity**: **MEDIUM** (3-4 weeks of development + testing)

**Breaking Changes**:
1. ❌ `add_week_details` tool removed (breaks existing prompts)
2. ✅ `finalize_plan` tool signature unchanged (backward compatible)
3. ✅ Output format unchanged (same JSON structure)

**Migration Steps**:

**Phase 1: Library Creation** (Week 1)
- Create workout library JSON with 10-15 core workouts
- Implement WorkoutLibrary class with schema validation
- Write unit tests for library loading and querying
- **Deliverable**: `data/workout_library.json` + `WorkoutLibrary` class

**Phase 2: Selector Implementation** (Week 2)
- Implement `WorkoutSelector` class with basic selection logic
- Implement duration adjustment algorithm (2-phase optimization)
- Implement workout rotation strategy
- Write unit tests for selection and adjustment
- **Deliverable**: Fully tested `WorkoutSelector` class

**Phase 3: Integration** (Week 3)
- Update `finalize_plan` tool to use `WorkoutSelector`
- Remove `add_week_details` tool
- Update prompts for 2-phase workflow
- Update orchestration layer if needed
- **Deliverable**: Working 2-phase system

**Phase 4: Testing & Validation** (Week 4)
- End-to-end testing with various athlete profiles
- Performance benchmarking (speed, cost, quality)
- Edge case testing (conflicting constraints, insufficient days, etc.)
- Documentation updates
- **Deliverable**: Production-ready system with documentation

**Rollback Strategy**:
- Keep old 3-phase system in separate branch
- Use feature flag to switch between old/new systems
- Monitor first 50 plan generations for issues
- Gradual rollout: 10% → 50% → 100% of users

---

## 6. Detailed Technical Architecture

### 6.1 Class Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       WorkoutLibrary                             │
├─────────────────────────────────────────────────────────────────┤
│ - workouts: list[Workout]                                        │
│ - version: str                                                   │
│ - _workout_index: dict[str, Workout]                            │
├─────────────────────────────────────────────────────────────────┤
│ + load(path: Path) -> WorkoutLibrary                            │
│ + get_workouts_for_phase(phase, intensity) -> list[Workout]    │
│ + get_workout_by_id(id: str) -> Workout | None                 │
│ + validate_schema() -> ValidationResult                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ contains
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Workout                                 │
├─────────────────────────────────────────────────────────────────┤
│ - id: str                                                        │
│ - name: str                                                      │
│ - type: str                                                      │
│ - intensity: Literal["hard", "easy"]                            │
│ - suitable_phases: list[str]                                    │
│ - base_structure: WorkoutStructure                              │
│ - variable_components: VariableComponents                       │
│ - characteristics: WorkoutCharacteristics                       │
│ - base_tss: float                                               │
│ - base_duration_min: int                                        │
├─────────────────────────────────────────────────────────────────┤
│ + calculate_tss(duration, adjusted_value, ftp) -> float        │
│ + generate_segments(adjusted_value) -> list[WorkoutSegment]    │
│ + can_adjust_to(target_tss, target_duration) -> bool           │
└─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                      WorkoutSelector                             │
├─────────────────────────────────────────────────────────────────┤
│ - library: WorkoutLibrary                                        │
│ - rotation_strategy: WorkoutRotationStrategy                     │
│ - duration_adjuster: DurationAdjuster                           │
│ - validator: WorkoutValidator                                    │
├─────────────────────────────────────────────────────────────────┤
│ + assign_weekly_workouts(overview, ftp) -> list[Assignment]    │
│ - _select_workouts(phase, intensity, count) -> list[Workout]   │
│ - _assign_to_weekdays(workouts, days) -> list[Assignment]      │
│ - _adjust_durations(assignments, targets) -> list[Assignment]  │
│ - _validate_assignments(assignments, overview) -> bool          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ uses
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  WorkoutRotationStrategy                         │
├─────────────────────────────────────────────────────────────────┤
│ - workout_history: deque[str]                                   │
│ - lookback_weeks: int                                           │
│ - random_seed: int | None                                       │
├─────────────────────────────────────────────────────────────────┤
│ + select_workout(candidates, phase, week) -> Workout           │
│ - _calculate_weights(candidates) -> list[float]                │
│ - _apply_recency_penalty(workout_id) -> float                  │
└─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                     DurationAdjuster                             │
├─────────────────────────────────────────────────────────────────┤
│ - tolerance: float                                               │
│ - max_iterations: int                                           │
├─────────────────────────────────────────────────────────────────┤
│ + adjust_to_targets(workouts, target_tss, target_hours) -> list│
│ - _adjust_flexible_workouts(workouts, gaps) -> None            │
│ - _adjust_interval_workouts(workouts, gaps) -> None            │
│ - _solve_optimization(workouts, targets) -> list[float]        │
│ - _validate_solution(workouts, targets) -> ValidationResult     │
└─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                   WorkoutAssignment                              │
├─────────────────────────────────────────────────────────────────┤
│ - weekday: str                                                   │
│ - workout: Workout                                               │
│ - adjusted_value: float                                          │
│ - adjusted_duration_min: int                                     │
│ - adjusted_tss: float                                            │
│ - segments: list[WorkoutSegment]                                │
├─────────────────────────────────────────────────────────────────┤
│ + to_dict() -> dict                                             │
│ + validate() -> ValidationResult                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 6.2 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PHASE 1: LLM Overview (1 call)                    │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │   weekly_overview[]     │
                    │  (12 week objects)      │
                    │  - phase                │
                    │  - training_days        │
                    │  - target_tss           │
                    │  - hard/easy days       │
                    │  - total_hours          │
                    └───────────┬─────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              PHASE 2: finalize_plan (Pure Python)                    │
│                                                                       │
│  FOR EACH week in weekly_overview:                                   │
│                                                                       │
│    ┌──────────────────────────────────────────────────────┐         │
│    │  1. WorkoutSelector.select_workouts()                │         │
│    │     - Query library for phase-appropriate workouts   │         │
│    │     - Use rotation strategy for variety              │         │
│    │     - Apply progressive overload                     │         │
│    └─────────────────┬────────────────────────────────────┘         │
│                      │                                               │
│                      ▼                                               │
│    ┌──────────────────────────────────────────────────────┐         │
│    │  2. WorkoutSelector.assign_to_weekdays()             │         │
│    │     - Match workouts to specific days                │         │
│    │     - Long workouts → weekends                       │         │
│    │     - Hard workouts → mid-week + weekends            │         │
│    │     - Validate spacing                               │         │
│    └─────────────────┬────────────────────────────────────┘         │
│                      │                                               │
│                      ▼                                               │
│    ┌──────────────────────────────────────────────────────┐         │
│    │  3. DurationAdjuster.adjust_to_targets()             │         │
│    │     Phase 3.1: Adjust flexible workouts (endurance)  │         │
│    │     Phase 3.2: Adjust interval workouts (sets)       │         │
│    │     Phase 3.3: Validate solution                     │         │
│    └─────────────────┬────────────────────────────────────┘         │
│                      │                                               │
│                      ▼                                               │
│    ┌──────────────────────────────────────────────────────┐         │
│    │  4. Generate final segments from adjusted workouts   │         │
│    │     - Expand base_structure with adjusted values     │         │
│    │     - Calculate power targets from FTP               │         │
│    │     - Create WorkoutAssignment objects               │         │
│    └─────────────────┬────────────────────────────────────┘         │
│                      │                                               │
│                      ▼                                               │
│    ┌──────────────────────────────────────────────────────┐         │
│    │  5. Validate weekly assignments                      │         │
│    │     - TSS within tolerance (±5%)                     │         │
│    │     - Duration within tolerance (±5%)                │         │
│    │     - No back-to-back hard days                      │         │
│    │     - All days in athlete's available days           │         │
│    └──────────────────────────────────────────────────────┘         │
│                                                                       │
└───────────────────────────────┬───────────────────────────────────── ┘
                                │
                                ▼
                   ┌─────────────────────────┐
                   │   complete_plan.json    │
                   │  - athlete_profile      │
                   │  - plan_metadata        │
                   │  - coaching_notes       │
                   │  - weekly_plan[]        │
                   │    - workouts[]         │
                   │      - segments[]       │
                   └───────────┬─────────────┘
                               │
                               ▼
                   ┌─────────────────────────┐
                   │   HTML Report           │
                   │   Generation            │
                   └─────────────────────────┘
```

---

### 6.3 Algorithm Pseudocode Refinements

#### Algorithm 1: Workout Selection with Variety

```python
def select_workouts(
    phase: str,
    hard_days: int,
    easy_days: int,
    week_number: int,
    library: WorkoutLibrary,
    rotation_strategy: WorkoutRotationStrategy
) -> list[Workout]:
    """
    Select workouts for the week with variety and progression.

    Returns:
        List of selected workouts (hard + easy)
    """
    selected = []

    # Get candidate pools
    hard_candidates = library.get_workouts_for_phase(phase, "hard")
    easy_candidates = library.get_workouts_for_phase(phase, "easy")

    # Check availability
    if len(hard_candidates) == 0 or len(easy_candidates) == 0:
        raise ValueError(f"Insufficient workouts in library for phase {phase}")

    # Select hard workouts
    for i in range(hard_days):
        # Use rotation strategy for variety
        workout = rotation_strategy.select_workout(
            candidates=hard_candidates,
            phase=phase,
            week_number=week_number
        )

        # Apply progressive overload
        workout = apply_progressive_overload(
            workout=workout,
            week_number=week_number,
            phase=phase
        )

        selected.append(workout)

        # Remove from candidates to prevent immediate repeat
        hard_candidates = [w for w in hard_candidates if w.id != workout.id]

    # Select easy workouts
    for i in range(easy_days):
        workout = rotation_strategy.select_workout(
            candidates=easy_candidates,
            phase=phase,
            week_number=week_number
        )

        selected.append(workout)
        easy_candidates = [w for w in easy_candidates if w.id != workout.id]

    return selected
```

---

#### Algorithm 2: Smart Weekday Assignment

```python
def assign_to_weekdays(
    workouts: list[Workout],
    available_days: list[str]
) -> list[WorkoutAssignment]:
    """
    Assign workouts to specific weekdays intelligently.

    Strategy:
    1. Long workouts → weekends (more time available)
    2. Hard workouts → Tuesday/Thursday/Saturday (spaced)
    3. Easy workouts → remaining days
    4. Validate spacing (no back-to-back high-fatigue)
    """
    assignments = []
    used_days = []

    # Sort workouts by duration (longest first)
    workouts_sorted = sorted(workouts, key=lambda w: w.base_duration_min, reverse=True)

    # Categorize days
    weekend_days = [d for d in available_days if d in ["Saturday", "Sunday"]]
    midweek_days = [d for d in available_days if d in ["Tuesday", "Wednesday", "Thursday"]]
    other_days = [d for d in available_days if d not in weekend_days + midweek_days]

    # Priority queue of available days
    day_queue = weekend_days + midweek_days + other_days

    for workout in workouts_sorted:
        # Find best day for this workout
        best_day = None
        best_score = -1

        for day in day_queue:
            if day in used_days:
                continue

            # Calculate score for this day
            score = 0

            # Prefer weekends for long workouts (>90 min)
            if workout.base_duration_min > 90 and day in weekend_days:
                score += 10

            # Prefer mid-week for hard workouts
            if workout.intensity == "hard" and day in midweek_days:
                score += 5

            # Check spacing with already assigned workouts
            spacing_penalty = calculate_spacing_penalty(
                day=day,
                workout=workout,
                existing_assignments=assignments,
                used_days=used_days
            )
            score -= spacing_penalty

            if score > best_score:
                best_score = score
                best_day = day

        if best_day is None:
            # Fallback: use first available day
            best_day = [d for d in day_queue if d not in used_days][0]

        assignments.append(WorkoutAssignment(
            weekday=best_day,
            workout=workout,
            adjusted_value=workout.variable_components.default_value,
            adjusted_duration_min=workout.base_duration_min,
            adjusted_tss=workout.base_tss,
            segments=[]  # Will be populated after adjustment
        ))

        used_days.append(best_day)

    # Sort by weekday order
    weekday_order = {
        "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
        "Friday": 4, "Saturday": 5, "Sunday": 6
    }
    assignments.sort(key=lambda a: weekday_order[a.weekday])

    return assignments


def calculate_spacing_penalty(
    day: str,
    workout: Workout,
    existing_assignments: list[WorkoutAssignment],
    used_days: list[str]
) -> float:
    """Calculate penalty for placing workout on this day based on spacing."""
    penalty = 0.0

    weekday_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    day_index = weekday_order.index(day)

    for assignment in existing_assignments:
        assigned_day_index = weekday_order.index(assignment.weekday)
        day_gap = abs(day_index - assigned_day_index)

        # Penalty for adjacent hard workouts
        if (workout.intensity == "hard" and
            assignment.workout.intensity == "hard" and
            day_gap == 1):
            penalty += 20  # Heavy penalty

        # Penalty for two high-fatigue workouts within 2 days
        if (workout.characteristics.fatigue_cost == "high" and
            assignment.workout.characteristics.fatigue_cost == "high" and
            day_gap <= 2):
            penalty += 10

    return penalty
```

---

#### Algorithm 3: Two-Phase Duration Adjustment (Refined)

```python
def adjust_to_targets(
    assignments: list[WorkoutAssignment],
    target_tss: float,
    target_hours: float,
    ftp: float,
    tolerance: float = 0.05
) -> list[WorkoutAssignment]:
    """
    Adjust workout durations to hit TSS and time targets.

    Two-phase approach:
    1. Adjust flexible workouts (fully variable duration)
    2. Adjust interval workouts (discrete sets)

    Returns:
        Adjusted assignments with updated durations and TSS
    """
    # Categorize workouts
    flexible = [a for a in assignments if a.workout.variable_components.type == "duration"]
    intervals = [a for a in assignments if a.workout.variable_components.type == "sets"]
    fixed = [a for a in assignments if a.workout.variable_components.type == "both"]

    # Calculate current totals
    current_tss = sum(a.adjusted_tss for a in assignments)
    current_hours = sum(a.adjusted_duration_min for a in assignments) / 60

    # Calculate gaps
    tss_gap = target_tss - current_tss
    hours_gap = target_hours - current_hours

    # PHASE 1: Adjust flexible workouts (endurance, recovery)
    if flexible:
        # Distribute gaps evenly across flexible workouts
        tss_per_workout = tss_gap / len(flexible)
        hours_per_workout = hours_gap / len(flexible)

        for assignment in flexible:
            workout = assignment.workout

            # Calculate required duration change
            # Strategy: Weighted average of TSS and time requirements
            # Weight TSS more heavily (70/30) since it's more important

            # Calculate duration needed for TSS target
            avg_intensity = (workout.base_structure["main_set"]["power_low_pct"] +
                           workout.base_structure["main_set"]["power_high_pct"]) / 2 / 100
            intensity_factor = avg_intensity

            # TSS = duration_hours × IF² × 100
            # Solve for duration: duration_hours = TSS / (IF² × 100)
            target_tss_for_this = assignment.adjusted_tss + tss_per_workout
            duration_for_tss = (target_tss_for_this / (intensity_factor**2 * 100)) * 60  # minutes

            # Calculate duration needed for time target
            target_duration_for_this = assignment.adjusted_duration_min + (hours_per_workout * 60)

            # Weighted average
            target_duration = (0.7 * duration_for_tss) + (0.3 * target_duration_for_this)

            # Clamp to min/max
            min_dur = workout.variable_components.min_value
            max_dur = workout.variable_components.max_value
            adjusted_duration = clamp(target_duration, min_dur, max_dur)

            # Calculate new TSS for adjusted duration
            adjusted_tss = (adjusted_duration / 60) * (intensity_factor**2) * 100

            # Update assignment
            assignment.adjusted_duration_min = int(adjusted_duration)
            assignment.adjusted_tss = adjusted_tss
            assignment.adjusted_value = adjusted_duration

    # Recalculate gaps after Phase 1
    current_tss = sum(a.adjusted_tss for a in assignments)
    current_hours = sum(a.adjusted_duration_min for a in assignments) / 60
    tss_gap = target_tss - current_tss
    hours_gap = target_hours - current_hours

    # PHASE 2: Adjust interval workouts (discrete sets)
    if intervals and abs(tss_gap) > (target_tss * tolerance):
        # Use integer linear programming for discrete adjustments
        adjustments = solve_integer_optimization(
            workouts=intervals,
            tss_gap=tss_gap,
            hours_gap=hours_gap
        )

        for assignment, adj in zip(intervals, adjustments):
            workout = assignment.workout
            vc = workout.variable_components

            new_sets = clamp(
                vc.default_value + adj,
                vc.min_value,
                vc.max_value
            )

            # Calculate new duration and TSS
            sets_change = new_sets - vc.default_value
            duration_change = sets_change * vc.duration_per_unit_min
            tss_change = sets_change * vc.tss_per_unit

            assignment.adjusted_value = new_sets
            assignment.adjusted_duration_min = int(workout.base_duration_min + duration_change)
            assignment.adjusted_tss = workout.base_tss + tss_change

    # PHASE 3: Validation
    final_tss = sum(a.adjusted_tss for a in assignments)
    final_hours = sum(a.adjusted_duration_min for a in assignments) / 60

    tss_error = abs(final_tss - target_tss) / target_tss
    hours_error = abs(final_hours - target_hours) / target_hours

    if tss_error > tolerance:
        logger.warning(
            f"TSS target not met within {tolerance*100}% tolerance. "
            f"Target: {target_tss}, Actual: {final_tss:.1f}, Error: {tss_error*100:.1f}%"
        )

    if hours_error > tolerance:
        logger.warning(
            f"Duration target not met within {tolerance*100}% tolerance. "
            f"Target: {target_hours}h, Actual: {final_hours:.2f}h, Error: {hours_error*100:.1f}%"
        )

    # Generate segments for each adjusted workout
    for assignment in assignments:
        assignment.segments = generate_segments(
            workout=assignment.workout,
            adjusted_value=assignment.adjusted_value,
            ftp=ftp
        )

    return assignments


def solve_integer_optimization(
    workouts: list[WorkoutAssignment],
    tss_gap: float,
    hours_gap: float
) -> list[int]:
    """
    Solve integer linear programming problem for discrete adjustments.

    Minimize: |sum(adj_i * tss_per_unit_i) - tss_gap| + |sum(adj_i * dur_per_unit_i) - hours_gap * 60|
    Subject to: min_i <= base_i + adj_i <= max_i for all i
    """
    # For simplicity, use greedy approach with integer adjustments
    # (Full ILP solver would use scipy.optimize.linprog or pulp library)

    adjustments = [0] * len(workouts)

    # Sort workouts by TSS per unit (most efficient first)
    indexed_workouts = list(enumerate(workouts))
    indexed_workouts.sort(
        key=lambda iw: iw[1].workout.variable_components.tss_per_unit,
        reverse=True
    )

    remaining_tss_gap = tss_gap

    for idx, assignment in indexed_workouts:
        workout = assignment.workout
        vc = workout.variable_components

        # Calculate how many sets to add/remove
        if remaining_tss_gap > 0:
            # Need more TSS, increase sets
            max_increase = vc.max_value - vc.default_value
            sets_needed = remaining_tss_gap / vc.tss_per_unit
            sets_increase = int(min(sets_needed, max_increase))
            adjustments[idx] = sets_increase
            remaining_tss_gap -= sets_increase * vc.tss_per_unit
        else:
            # Need less TSS, decrease sets (rare)
            max_decrease = vc.default_value - vc.min_value
            sets_needed = abs(remaining_tss_gap) / vc.tss_per_unit
            sets_decrease = int(min(sets_needed, max_decrease))
            adjustments[idx] = -sets_decrease
            remaining_tss_gap += sets_decrease * vc.tss_per_unit

    return adjustments
```

---

### 6.4 Error Handling Strategy

#### Error Hierarchy

```python
class WorkoutLibraryError(Exception):
    """Base exception for workout library errors."""
    pass


class LibrarySchemaError(WorkoutLibraryError):
    """Workout library schema validation failed."""
    pass


class LibraryVersionError(WorkoutLibraryError):
    """Incompatible library version."""
    pass


class WorkoutSelectionError(WorkoutLibraryError):
    """Could not select appropriate workouts."""
    pass


class DurationAdjustmentError(WorkoutLibraryError):
    """Could not adjust workouts to meet targets."""
    pass


class WorkoutSpacingError(WorkoutLibraryError):
    """Workout spacing validation failed."""
    pass
```

#### Error Handling Pattern

```python
class WorkoutSelector:
    def assign_weekly_workouts(
        self,
        week_overview: dict,
        ftp: float
    ) -> list[WorkoutAssignment]:
        """Main entry point with comprehensive error handling."""
        try:
            # Step 1: Validate inputs
            self._validate_inputs(week_overview, ftp)

            # Step 2: Select workouts
            selected = self._select_workouts(week_overview)

            # Step 3: Assign to weekdays
            assignments = self._assign_to_weekdays(selected, week_overview["training_days"])

            # Step 4: Adjust durations
            adjusted = self._adjust_durations(assignments, week_overview, ftp)

            # Step 5: Validate result
            self._validate_result(adjusted, week_overview)

            return adjusted

        except LibrarySchemaError as e:
            logger.error(f"Library schema error: {e}")
            raise WorkoutSelectionError(
                "Workout library is corrupted or invalid. "
                "Please reinstall or contact support."
            ) from e

        except WorkoutSelectionError as e:
            logger.error(f"Selection failed: {e}")
            # Try fallback strategy
            try:
                logger.info("Attempting fallback selection strategy...")
                return self._select_workouts_fallback(week_overview, ftp)
            except Exception as fallback_e:
                logger.error(f"Fallback also failed: {fallback_e}")
                raise WorkoutSelectionError(
                    f"Could not select workouts: {e}\n"
                    f"Fallback also failed: {fallback_e}"
                ) from e

        except DurationAdjustmentError as e:
            logger.warning(f"Duration adjustment failed: {e}")
            # Return non-adjusted workouts with warning
            logger.info("Returning workouts without duration adjustment")
            return assignments  # Non-adjusted

        except WorkoutSpacingError as e:
            logger.warning(f"Workout spacing issue: {e}")
            # Continue with warning (not fatal)
            return adjusted

        except Exception as e:
            logger.exception(f"Unexpected error in workout assignment: {e}")
            raise WorkoutSelectionError(
                f"Unexpected error during workout assignment: {e}"
            ) from e
```

---

### 6.5 Validation Approach

#### Multi-Level Validation

**Level 1: Schema Validation** (on library load)
```python
def validate_library_schema(library_data: dict) -> ValidationResult:
    """Validate workout library against JSON schema."""
    errors = []

    required_top_level = ["library_version", "schema_version", "workouts"]
    for field in required_top_level:
        if field not in library_data:
            errors.append(f"Missing required field: {field}")

    for workout in library_data.get("workouts", []):
        # Validate required fields
        required_workout_fields = [
            "id", "name", "type", "intensity", "suitable_phases",
            "base_structure", "variable_components", "base_tss", "base_duration_min"
        ]
        for field in required_workout_fields:
            if field not in workout:
                errors.append(f"Workout {workout.get('id', '?')}: Missing field '{field}'")

        # Validate intensity values
        if workout.get("intensity") not in ["hard", "easy"]:
            errors.append(
                f"Workout {workout['id']}: "
                f"Invalid intensity '{workout.get('intensity')}' (must be 'hard' or 'easy')"
            )

        # Validate variable_components
        vc = workout.get("variable_components", {})
        if "type" not in vc or vc["type"] not in ["sets", "duration", "both"]:
            errors.append(
                f"Workout {workout['id']}: "
                f"Invalid variable_components.type '{vc.get('type')}'"
            )

        # Validate min <= default <= max
        if vc.get("min_value", 0) > vc.get("default_value", 0):
            errors.append(
                f"Workout {workout['id']}: "
                f"min_value ({vc['min_value']}) > default_value ({vc['default_value']})"
            )

        if vc.get("default_value", 0) > vc.get("max_value", 999):
            errors.append(
                f"Workout {workout['id']}: "
                f"default_value ({vc['default_value']}) > max_value ({vc['max_value']})"
            )

    return ValidationResult(
        is_valid=len(errors) == 0,
        errors=errors
    )
```

**Level 2: Assignment Validation** (after workout selection)
```python
def validate_assignments(
    assignments: list[WorkoutAssignment],
    week_overview: dict
) -> ValidationResult:
    """Validate weekly workout assignments."""
    errors = []
    warnings = []

    # Check count
    expected_count = week_overview["hard_days"] + week_overview["easy_days"]
    if len(assignments) != expected_count:
        errors.append(
            f"Expected {expected_count} workouts, got {len(assignments)}"
        )

    # Check hard/easy distribution
    hard_count = sum(1 for a in assignments if a.workout.intensity == "hard")
    easy_count = sum(1 for a in assignments if a.workout.intensity == "easy")

    if hard_count != week_overview["hard_days"]:
        errors.append(
            f"Expected {week_overview['hard_days']} hard workouts, got {hard_count}"
        )

    if easy_count != week_overview["easy_days"]:
        errors.append(
            f"Expected {week_overview['easy_days']} easy workouts, got {easy_count}"
        )

    # Check weekdays
    available_days = week_overview["training_days"]
    for assignment in assignments:
        if assignment.weekday not in available_days:
            errors.append(
                f"Workout assigned to {assignment.weekday} "
                f"but athlete only available on {available_days}"
            )

    # Check for duplicate days
    used_days = [a.weekday for a in assignments]
    if len(used_days) != len(set(used_days)):
        duplicates = [d for d in used_days if used_days.count(d) > 1]
        errors.append(f"Duplicate weekdays: {duplicates}")

    # Check spacing
    spacing_errors = validate_workout_spacing(assignments)
    warnings.extend(spacing_errors)

    return ValidationResult(
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings
    )
```

**Level 3: TSS/Duration Validation** (after adjustment)
```python
def validate_targets(
    assignments: list[WorkoutAssignment],
    target_tss: float,
    target_hours: float,
    tolerance: float = 0.05
) -> ValidationResult:
    """Validate that adjusted workouts meet TSS and duration targets."""
    errors = []
    warnings = []

    actual_tss = sum(a.adjusted_tss for a in assignments)
    actual_hours = sum(a.adjusted_duration_min for a in assignments) / 60

    tss_error = abs(actual_tss - target_tss) / target_tss
    hours_error = abs(actual_hours - target_hours) / target_hours

    if tss_error > tolerance:
        msg = (
            f"TSS target not met: "
            f"Target {target_tss}, Actual {actual_tss:.1f} "
            f"({tss_error*100:.1f}% error, tolerance {tolerance*100}%)"
        )
        if tss_error > 0.10:
            errors.append(msg)
        else:
            warnings.append(msg)

    if hours_error > tolerance:
        msg = (
            f"Duration target not met: "
            f"Target {target_hours}h, Actual {actual_hours:.2f}h "
            f"({hours_error*100:.1f}% error, tolerance {tolerance*100}%)"
        )
        if hours_error > 0.10:
            errors.append(msg)
        else:
            warnings.append(msg)

    return ValidationResult(
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings
    )
```

---

## 7. Summary and Next Steps

### 7.1 Key Recommendations Summary

**Architecture**:
✅ Approve 2-phase workflow (create_plan_overview → finalize_plan)
✅ Implement WorkoutSelector with enhanced features (rotation, progression, smart scheduling)
✅ Use constraint-based optimization for duration adjustment (not greedy)

**Workout Library**:
✅ Enhance schema with characteristics, progression, versioning
✅ Start with 10-15 core workouts covering all phases
✅ Implement versioning from day one (semantic versioning)
✅ Support custom workouts via layered library approach

**Algorithms**:
✅ Weighted random selection with history tracking (variety)
✅ Smart weekday assignment (long rides → weekends, spacing validation)
✅ Two-phase duration adjustment (flexible → intervals)
✅ Progressive overload based on phase progression

**Testing**:
✅ Comprehensive test suite (unit, integration, property-based)
✅ Multi-level validation (schema, assignment, targets)
✅ Error handling with graceful degradation

**Migration**:
✅ 4-week implementation plan
✅ Feature flag for gradual rollout
✅ Rollback strategy with old system in separate branch

---

### 7.2 Implementation Priority

**Phase 1: Foundation (Week 1)**
1. Create workout library JSON with 10 workouts
2. Implement WorkoutLibrary class with schema validation
3. Write unit tests for library loading

**Phase 2: Core Logic (Week 2)**
4. Implement WorkoutSelector with basic selection
5. Implement DurationAdjuster with 2-phase optimization
6. Implement WorkoutRotationStrategy
7. Write unit tests for all components

**Phase 3: Integration (Week 3)**
8. Update finalize_plan tool to use WorkoutSelector
9. Remove add_week_details tool
10. Update prompts for 2-phase workflow
11. Integration testing

**Phase 4: Polish & Deploy (Week 4)**
12. End-to-end testing with various profiles
13. Performance benchmarking
14. Documentation updates
15. Gradual rollout with monitoring

---

### 7.3 Success Criteria

**Performance Metrics**:
- ✅ LLM calls reduced from 13 → 1 (92% reduction)
- ✅ Generation time reduced from 60s → 10s (83% faster)
- ✅ Cost reduced from $0.25 → $0.02 (92% cheaper)

**Quality Metrics**:
- ✅ TSS accuracy within ±5% of target
- ✅ Duration accuracy within ±5% of target
- ✅ No back-to-back high-fatigue workouts
- ✅ Workout variety: At least 6 unique workouts across 4-week period
- ✅ All tests passing (100% pass rate)

**User Experience Metrics**:
- ✅ Plan generation success rate >95%
- ✅ Zero complaints about workout monotony
- ✅ Positive feedback on workout variety

---

### 7.4 Final Recommendation

**APPROVE FOR IMPLEMENTATION**

The proposed workout library refactor is architecturally sound, addresses all major concerns, and provides significant benefits in cost, speed, and maintainability. The enhancements recommended in this document (rotation strategy, progressive overload, smart scheduling, comprehensive validation) will ensure a production-quality implementation.

**Estimated Effort**: 3-4 weeks (1 senior engineer)
**Risk Level**: Low-Medium (mitigated by comprehensive testing and gradual rollout)
**ROI**: High (92% cost reduction, 83% speed improvement, significantly improved maintainability)

Proceed with implementation following the 4-phase plan outlined in Section 7.2.

---

**Document Version**: 1.0
**Author**: Claude Code (Principal Engineer & Architect)
**Date**: 2025-11-02
**Status**: Ready for Implementation
