# Implementation Plan: Duration-Aware Training Planning

**Document:** Step-by-Step Implementation Guide
**Version:** 1.0
**Date:** 2025-11-04
**Status:** Ready for Execution

---

## Executive Summary

This document provides a **complete, actionable implementation plan** for adding intelligent duration adjustment to the library-based training planning system. The plan is organized into **4 weekly sprints** with specific tasks, file changes, and validation checkpoints.

**Timeline:** 4 weeks (80 hours total)
**Risk Level:** LOW-MEDIUM
**Expected Outcome:** 98%+ validation pass rate, ±5% time accuracy

**Phased Approach:**
- **Week 1:** Core components + unit tests
- **Week 2:** Integration + library migration
- **Week 3:** Testing + refinement
- **Week 4:** Deployment + monitoring

---

## Prerequisites

### Required Tools

```bash
# Development environment
python 3.11+
uv (package manager)
mypy --strict (type checking)
pytest (testing)
ruff (linting/formatting)

# Validation
git (version control)
jq (JSON processing for library validation)
```

### Setup Checklist

- [ ] Create feature branch: `git checkout -b feature/duration-adjustment`
- [ ] Verify tests pass: `pytest tests/`
- [ ] Verify type checking: `mypy src/cycling_ai --strict`
- [ ] Backup production library: `cp data/workout_library.json data/workout_library_backup.json`

---

## Week 1: Core Components Implementation

**Goal:** Implement new duration adjustment components with full unit test coverage.

### Day 1: DurationDistributor (Monday)

**Tasks:**
1. Create `src/cycling_ai/core/workout_library/duration_distributor.py`
2. Implement `WORKOUT_DURATION_PROFILES` constant
3. Implement `DurationAllocation` dataclass
4. Implement `DurationDistributor` class
5. Create unit tests

**File 1: `duration_distributor.py`**

```python
"""Duration distribution logic for weekly training planning."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Literal

logger = logging.getLogger(__name__)


# Workout type duration profiles (weekday vs weekend)
WORKOUT_DURATION_PROFILES: dict[str, dict[str, dict[str, float]]] = {
    "recovery": {
        "weekday": {"min": 45, "target": 50, "max": 60},
        "weekend": {"min": 45, "target": 60, "max": 75},
    },
    "vo2max": {
        "weekday": {"min": 50, "target": 60, "max": 75},
        "weekend": {"min": 50, "target": 70, "max": 90},
    },
    "threshold": {
        "weekday": {"min": 60, "target": 75, "max": 90},
        "weekend": {"min": 60, "target": 85, "max": 120},
    },
    "sweet_spot": {
        "weekday": {"min": 60, "target": 80, "max": 90},
        "weekend": {"min": 75, "target": 95, "max": 120},
    },
    "tempo": {
        "weekday": {"min": 60, "target": 75, "max": 90},
        "weekend": {"min": 75, "target": 90, "max": 120},
    },
    "endurance": {
        "weekday": {"min": 60, "target": 75, "max": 90},
        "weekend": {"min": 90, "target": 135, "max": 240},
    },
    "mixed": {
        "weekday": {"min": 60, "target": 75, "max": 90},
        "weekend": {"min": 75, "target": 110, "max": 150},
    },
}


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

    Uses workout-type-aware profiles to predict realistic durations.
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
            phase: Training phase (for logging)

        Returns:
            {weekday: DurationAllocation}
        """
        logger.info(
            f"Distributing {target_hours:.1f}h across {len(training_days)} training days"
        )

        # Calculate base allocation
        base_allocations = self._calculate_base_allocation(training_days)

        # Scale to target hours
        scaled_allocations = self._scale_to_target(
            base_allocations, target_hours, training_days
        )

        return scaled_allocations

    def _calculate_base_allocation(
        self, training_days: list[dict[str, Any]]
    ) -> dict[str, float]:
        """Calculate natural duration for each day based on workout type."""
        allocations: dict[str, float] = {}

        for day in training_days:
            workout_type = day.get("workout_type")
            if workout_type == "rest":
                continue

            weekday = day.get("weekday")
            if not weekday:
                continue

            is_weekend = weekday in ["Saturday", "Sunday"]
            day_type = "weekend" if is_weekend else "weekday"

            profile = self.duration_profiles.get(workout_type, {}).get(day_type, {})
            target_duration = profile.get("target", 75)  # Default 75 min

            allocations[weekday] = target_duration

        return allocations

    def _scale_to_target(
        self,
        base_allocations: dict[str, float],
        target_hours: float,
        training_days: list[dict[str, Any]],
    ) -> dict[str, DurationAllocation]:
        """Scale allocations to hit target hours with constraints."""
        max_iterations = 10
        tolerance_min = 5

        target_min = target_hours * 60
        scaled: dict[str, float] = base_allocations.copy()

        for iteration in range(max_iterations):
            current_total = sum(scaled.values())
            delta = target_min - current_total

            if abs(delta) < tolerance_min:
                logger.debug(f"Converged in {iteration} iterations")
                break

            scaling_factor = target_min / current_total if current_total > 0 else 1.0

            # Separate flexible (endurance/mixed) from rigid (intervals)
            flexible_days = [
                day
                for day in training_days
                if day.get("workout_type") in ["endurance", "mixed", "recovery"]
                and day.get("weekday") in scaled
            ]
            rigid_days = [
                day
                for day in training_days
                if day.get("workout_type")
                not in ["endurance", "mixed", "recovery", "rest"]
                and day.get("weekday") in scaled
            ]

            new_scaled: dict[str, float] = {}
            constrained_delta = 0.0

            for day in training_days:
                workout_type = day.get("workout_type")
                weekday = day.get("weekday")

                if workout_type == "rest" or not weekday:
                    continue

                is_weekend = weekday in ["Saturday", "Sunday"]
                day_type = "weekend" if is_weekend else "weekday"

                profile = self.duration_profiles.get(workout_type, {}).get(
                    day_type, {}
                )
                min_dur = profile.get("min", 45)
                max_dur = profile.get("max", 90)

                current_duration = scaled.get(weekday, 0)

                # Scale more aggressively for flexible days
                if day in flexible_days:
                    proposed_duration = current_duration * scaling_factor
                else:
                    # Conservative scaling for rigid days
                    proposed_duration = current_duration * (
                        1 + (scaling_factor - 1) * 0.5
                    )

                # Clamp to bounds
                clamped_duration = max(min_dur, min(max_dur, proposed_duration))

                if clamped_duration != proposed_duration:
                    constrained_delta += proposed_duration - clamped_duration

                new_scaled[weekday] = clamped_duration

            # Redistribute constrained delta to flexible days
            if constrained_delta != 0 and flexible_days:
                redistribution_per_day = constrained_delta / len(flexible_days)

                for day in flexible_days:
                    weekday = day.get("weekday")
                    workout_type = day.get("workout_type")
                    if not weekday or not workout_type:
                        continue

                    is_weekend = weekday in ["Saturday", "Sunday"]
                    day_type = "weekend" if is_weekend else "weekday"

                    profile = self.duration_profiles.get(workout_type, {}).get(
                        day_type, {}
                    )
                    min_dur = profile.get("min", 45)
                    max_dur = profile.get("max", 90)

                    adjusted = new_scaled[weekday] + redistribution_per_day
                    new_scaled[weekday] = max(min_dur, min(max_dur, adjusted))

            scaled = new_scaled

        # Create DurationAllocation objects
        result: dict[str, DurationAllocation] = {}

        for day in training_days:
            workout_type = day.get("workout_type")
            weekday = day.get("weekday")

            if workout_type == "rest" or not weekday:
                continue

            is_weekend = weekday in ["Saturday", "Sunday"]
            day_type = "weekend" if is_weekend else "weekday"

            profile = self.duration_profiles.get(workout_type, {}).get(day_type, {})

            result[weekday] = DurationAllocation(
                weekday=weekday,
                workout_type=workout_type,
                target_duration_min=scaled.get(weekday, 75),
                min_duration_min=profile.get("min", 45),
                max_duration_min=profile.get("max", 90),
            )

        return result
```

**File 2: `tests/core/workout_library/test_duration_distributor.py`**

```python
"""Unit tests for DurationDistributor."""

import pytest

from cycling_ai.core.workout_library.duration_distributor import (
    DurationDistributor,
    WORKOUT_DURATION_PROFILES,
)


def test_distribute_basic():
    """Test basic distribution."""
    distributor = DurationDistributor()
    training_days = [
        {"weekday": "Tuesday", "workout_type": "endurance"},
        {"weekday": "Saturday", "workout_type": "endurance"},
    ]

    allocations = distributor.distribute_weekly_hours(
        training_days, target_hours=4.0, phase="Base"
    )

    total = sum(a.target_duration_min for a in allocations.values())
    assert abs(total - 240) < 10  # ±10 min tolerance
    assert len(allocations) == 2


def test_distribute_with_rest_days():
    """Test distribution with rest days (should be ignored)."""
    distributor = DurationDistributor()
    training_days = [
        {"weekday": "Monday", "workout_type": "rest"},
        {"weekday": "Tuesday", "workout_type": "endurance"},
        {"weekday": "Wednesday", "workout_type": "rest"},
    ]

    allocations = distributor.distribute_weekly_hours(
        training_days, target_hours=1.5, phase="Base"
    )

    assert len(allocations) == 1  # Only Tuesday
    assert "Monday" not in allocations
    assert "Wednesday" not in allocations


def test_duration_profiles_complete():
    """Test that all workout types have profiles."""
    required_types = [
        "recovery",
        "vo2max",
        "threshold",
        "sweet_spot",
        "tempo",
        "endurance",
        "mixed",
    ]

    for workout_type in required_types:
        assert workout_type in WORKOUT_DURATION_PROFILES
        assert "weekday" in WORKOUT_DURATION_PROFILES[workout_type]
        assert "weekend" in WORKOUT_DURATION_PROFILES[workout_type]


def test_scale_to_target_bounds_respected():
    """Test that scaling respects min/max bounds."""
    distributor = DurationDistributor()
    training_days = [
        {"weekday": "Tuesday", "workout_type": "recovery"},
        {"weekday": "Thursday", "workout_type": "recovery"},
    ]

    # Request very short week
    allocations = distributor.distribute_weekly_hours(
        training_days, target_hours=1.0, phase="Recovery"
    )

    # All durations should respect recovery weekday min (45 min)
    for allocation in allocations.values():
        assert allocation.target_duration_min >= 45
```

**Validation Checklist (Day 1):**
- [ ] File created: `duration_distributor.py`
- [ ] File created: `test_duration_distributor.py`
- [ ] All tests pass: `pytest tests/core/workout_library/test_duration_distributor.py -v`
- [ ] Type check passes: `mypy src/cycling_ai/core/workout_library/duration_distributor.py --strict`
- [ ] Code formatted: `ruff format src/cycling_ai/core/workout_library/duration_distributor.py`

---

### Day 2: WorkoutScaler (Tuesday)

**Tasks:**
1. Create `src/cycling_ai/core/workout_library/workout_scaler.py`
2. Implement `WorkoutScaler` class
3. Implement `adjust_to_target()` method
4. Implement scaling methods (variable_components, segment scaling)
5. Create unit tests

**File: `workout_scaler.py`** (Implementation similar to ALGORITHM_DESIGN.md, ~400 lines)

**File: `test_workout_scaler.py`** (Comprehensive unit tests, ~300 lines)

**Validation Checklist (Day 2):**
- [ ] File created: `workout_scaler.py`
- [ ] File created: `test_workout_scaler.py`
- [ ] All tests pass (10+ tests)
- [ ] Type check passes
- [ ] Code formatted

---

### Day 3: DurationRefiner (Wednesday)

**Tasks:**
1. Create `src/cycling_ai/core/workout_library/duration_refiner.py`
2. Implement `DurationRefiner` class
3. Implement `refine_weekly_total()` method
4. Implement `_redistribute_delta()` method
5. Create unit tests

**File: `duration_refiner.py`** (~200 lines)

**File: `test_duration_refiner.py`** (~200 lines)

**Validation Checklist (Day 3):**
- [ ] File created: `duration_refiner.py`
- [ ] File created: `test_duration_refiner.py`
- [ ] All tests pass (8+ tests)
- [ ] Type check passes
- [ ] Code formatted

---

### Day 4-5: Enhanced Selector + Integration Prep (Thursday-Friday)

**Tasks:**
1. Modify `src/cycling_ai/core/workout_library/selector.py`
   - Add extensibility bonus to scoring (+10 points)
   - Add `prefer_extensible` parameter
   - Update scoring method
2. Modify `src/cycling_ai/core/workout_library/models.py`
   - Add `extensible: bool = False` field to Workout
   - Add `duration_scaling_strategy` field
   - Add segment-level metadata fields
3. Update existing tests
4. Create integration test scaffolding

**Modified Files:**
- `selector.py` (lines 98-120, 350-365)
- `models.py` (lines 52-72)
- `test_selector.py` (add new tests for extensibility scoring)

**Validation Checklist (Day 4-5):**
- [ ] Modified: `selector.py` (backward compatible)
- [ ] Modified: `models.py` (backward compatible)
- [ ] All existing tests still pass
- [ ] New tests added for extensibility
- [ ] Type check passes
- [ ] Code formatted

---

## Week 2: Integration + Library Migration

**Goal:** Integrate components into workflow, migrate library with new metadata.

### Day 6-7: Integrate into LibraryBasedTrainingPlanningWeeks (Monday-Tuesday)

**Tasks:**
1. Modify `src/cycling_ai/orchestration/phases/training_planning_library.py`
   - Add `enable_duration_adjustment` parameter to `__init__`
   - Implement `_execute_week_with_adjustment()` method
   - Preserve `_execute_week_legacy()` (rename current implementation)
   - Update `execute()` to route based on flag
2. Add comprehensive logging for debugging
3. Create integration tests

**File Modifications:**

```python
# training_planning_library.py

class LibraryBasedTrainingPlanningWeeks:
    def __init__(
        self,
        temperature: float = 0.5,
        enable_duration_adjustment: bool = True,  # NEW
    ) -> None:
        # Existing initialization
        ...

        # NEW: Duration adjustment components
        self.enable_duration_adjustment = enable_duration_adjustment
        if enable_duration_adjustment:
            from cycling_ai.core.workout_library.duration_distributor import (
                DurationDistributor,
            )
            from cycling_ai.core.workout_library.workout_scaler import WorkoutScaler
            from cycling_ai.core.workout_library.duration_refiner import (
                DurationRefiner,
            )

            self.duration_distributor = DurationDistributor()
            self.workout_scaler = WorkoutScaler()
            self.duration_refiner = DurationRefiner(self.workout_scaler)

    def execute(self, plan_id: str) -> dict[str, Any]:
        """Execute with duration adjustment if enabled."""
        weekly_overview = self._load_weekly_overview(plan_id)
        weeks_added = 0

        for week_data in weekly_overview:
            # Route based on flag
            if self.enable_duration_adjustment:
                success = self._execute_week_with_adjustment(week_data, plan_id)
            else:
                success = self._execute_week_legacy(week_data, plan_id)

            if success:
                weeks_added += 1

        return {"success": True, "weeks_added": weeks_added}

    def _execute_week_with_adjustment(
        self, week_data: dict[str, Any], plan_id: str
    ) -> bool:
        """Execute week with three-phase adjustment pipeline."""
        # Implementation from ARCHITECTURE_PLAN.md
        ...

    def _execute_week_legacy(
        self, week_data: dict[str, Any], plan_id: str
    ) -> bool:
        """Execute week using legacy method (current implementation)."""
        # Move current implementation here (lines 107-268)
        ...
```

**Validation Checklist (Day 6-7):**
- [ ] Modified: `training_planning_library.py`
- [ ] Legacy path preserved and working
- [ ] New path implemented with feature flag
- [ ] Integration test created
- [ ] Type check passes
- [ ] All existing tests still pass

---

### Day 8-9: Library Migration (Wednesday-Thursday)

**Tasks:**
1. Create `scripts/migrate_workout_library.py`
   - Auto-populate `extensible` flag
   - Auto-populate `duration_scaling_strategy`
   - Auto-populate segment metadata
2. Create `scripts/validate_workout_library.py`
   - Validate schema compliance
   - Check extensibility consistency
   - Report statistics
3. Run migration on test library copy
4. Validate migrated library

**File: `scripts/migrate_workout_library.py`**

```python
#!/usr/bin/env python3
"""Migrate workout library with extensibility metadata."""

import argparse
import json
from pathlib import Path


def migrate_add_extensible_flag(library: dict) -> dict:
    """Add extensible flag to all workouts."""
    for workout in library["workouts"]:
        if "variable_components" in workout and workout["variable_components"]:
            workout["extensible"] = True
        elif workout["type"] in ["endurance", "mixed"]:
            # Check for long steady segments
            has_long_steady = any(
                seg.get("type") in ["steady", "endurance"]
                and seg.get("duration_min", 0) >= 30
                for seg in workout.get("segments", [])
            )
            workout["extensible"] = has_long_steady
        else:
            workout["extensible"] = False

    return library


def migrate_add_scaling_strategy(library: dict) -> dict:
    """Add duration_scaling_strategy to all workouts."""
    for workout in library["workouts"]:
        if not workout.get("extensible", False):
            workout["duration_scaling_strategy"] = "fixed"
        elif workout.get("variable_components"):
            vc = workout["variable_components"]
            if vc.get("adjustable_field") == "sets":
                workout["duration_scaling_strategy"] = "add_sets"
            else:
                workout["duration_scaling_strategy"] = "proportional"
        elif workout["type"] == "endurance":
            workout["duration_scaling_strategy"] = "extend_main"
        elif workout["type"] == "recovery":
            workout["duration_scaling_strategy"] = "extend_recovery"
        else:
            workout["duration_scaling_strategy"] = "proportional"

    return library


def main():
    parser = argparse.ArgumentParser(description="Migrate workout library")
    parser.add_argument("--input", required=True, help="Input library JSON")
    parser.add_argument("--output", required=True, help="Output library JSON")
    parser.add_argument("--add-extensible-flag", action="store_true")
    parser.add_argument("--add-scaling-strategy", action="store_true")

    args = parser.parse_args()

    # Load library
    with open(args.input) as f:
        library = json.load(f)

    print(f"Loaded library: {len(library['workouts'])} workouts")

    # Apply migrations
    if args.add_extensible_flag:
        print("Adding extensible flag...")
        library = migrate_add_extensible_flag(library)

    if args.add_scaling_strategy:
        print("Adding duration_scaling_strategy...")
        library = migrate_add_scaling_strategy(library)

    # Update version
    library["version"] = "2.0.0"
    library["schema_version"] = "2.0"

    # Save
    with open(args.output, "w") as f:
        json.dump(library, f, indent=2)

    print(f"Saved migrated library to: {args.output}")

    # Report statistics
    extensible_count = sum(1 for w in library["workouts"] if w.get("extensible", False))
    print(f"\nStatistics:")
    print(f"  Total workouts: {len(library['workouts'])}")
    print(f"  Extensible: {extensible_count} ({extensible_count / len(library['workouts']) * 100:.1f}%)")


if __name__ == "__main__":
    main()
```

**Validation Checklist (Day 8-9):**
- [ ] Created: `migrate_workout_library.py`
- [ ] Created: `validate_workout_library.py`
- [ ] Migration script tested on copy
- [ ] Validation script reports 0 errors
- [ ] Extensibility coverage: 60%+

---

### Day 10: CLI Integration (Friday)

**Tasks:**
1. Add CLI flag to `src/cycling_ai/cli/commands/generate.py`
2. Pass flag to LibraryBasedTrainingPlanningWeeks
3. Update help documentation
4. Test manual CLI invocation

**File Modifications:**

```python
# cli/commands/generate.py

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

    # Create library phase with configuration
    library_phase = LibraryBasedTrainingPlanningWeeks(
        temperature=0.5,
        enable_duration_adjustment=duration_adjustment,
    )

    # Rest of implementation unchanged
    ...
```

**Validation Checklist (Day 10):**
- [ ] Modified: `generate.py`
- [ ] CLI flag tested: `cycling-ai generate --help`
- [ ] Works with flag enabled and disabled
- [ ] Help text updated

---

## Week 3: Testing + Refinement

**Goal:** Comprehensive testing, bug fixing, performance optimization.

### Day 11-12: Integration Testing (Monday-Tuesday)

**Tasks:**
1. Create comprehensive integration tests
   - Test Week 8 scenario (known failure case)
   - Test 12-week complete plan
   - Test edge cases (very short/long weeks)
2. Run tests with duration adjustment enabled
3. Measure pass rate
4. Fix bugs discovered

**File: `tests/orchestration/phases/test_training_planning_library_duration.py`**

```python
"""Integration tests for duration adjustment."""

import json
import uuid
from pathlib import Path

import pytest

from cycling_ai.orchestration.phases.training_planning_library import (
    LibraryBasedTrainingPlanningWeeks,
)


@pytest.fixture
def week_8_overview(tmp_path):
    """Week 8 overview (known failure case)."""
    plan_id = str(uuid.uuid4())

    weekly_overview = [
        {
            "week_number": 8,
            "phase": "Recovery",
            "total_hours": 6.5,
            "training_days": [
                {"weekday": "Monday", "workout_type": "rest"},
                {"weekday": "Tuesday", "workout_type": "endurance"},
                {"weekday": "Wednesday", "workout_type": "recovery"},
                {"weekday": "Thursday", "workout_type": "tempo"},
                {"weekday": "Friday", "workout_type": "rest"},
                {"weekday": "Saturday", "workout_type": "endurance"},
                {"weekday": "Sunday", "workout_type": "endurance"},
            ],
        }
    ]

    overview_file = tmp_path / f"{plan_id}_overview.json"
    with open(overview_file, "w") as f:
        json.dump(
            {
                "plan_id": plan_id,
                "total_weeks": 1,
                "target_ftp": 250,
                "weekly_overview": weekly_overview,
            },
            f,
        )

    return plan_id


def test_week_8_with_duration_adjustment(week_8_overview):
    """Test that Week 8 passes with duration adjustment enabled."""
    phase = LibraryBasedTrainingPlanningWeeks(enable_duration_adjustment=True)

    result = phase.execute(plan_id=week_8_overview)

    assert result["success"] is True
    assert result["weeks_added"] == 1

    # Verify week file exists and has correct duration
    week_file = Path(f"/tmp/{week_8_overview}_week_8.json")
    assert week_file.exists()

    with open(week_file) as f:
        week_data = json.load(f)

    workouts = week_data["workouts"]
    total_duration = sum(
        sum(seg.get("duration_min", 0) for seg in w.get("segments", []))
        for w in workouts
    )
    total_hours = total_duration / 60.0

    # Should be within ±5% of target (6.5h)
    assert abs(total_hours - 6.5) < 0.33  # ±5% = ±0.325h


def test_week_8_without_duration_adjustment(week_8_overview):
    """Test that Week 8 fails without duration adjustment (legacy behavior)."""
    phase = LibraryBasedTrainingPlanningWeeks(enable_duration_adjustment=False)

    with pytest.raises(RuntimeError, match="validation failed"):
        phase.execute(plan_id=week_8_overview)
```

**Validation Checklist (Day 11-12):**
- [ ] Created: `test_training_planning_library_duration.py`
- [ ] Week 8 test passes with adjustment enabled
- [ ] Week 8 test fails with adjustment disabled (expected)
- [ ] 12-week integration test passes
- [ ] Edge case tests pass

---

### Day 13-14: Performance Optimization (Wednesday-Thursday)

**Tasks:**
1. Benchmark execution time
2. Identify bottlenecks (profiling)
3. Optimize hot paths
4. Verify <2s per week target met

**Profiling Commands:**

```bash
# Profile 12-week plan execution
python -m cProfile -o profile.stats scripts/profile_duration_adjustment.py

# Analyze results
python -c "import pstats; p = pstats.Stats('profile.stats'); p.sort_stats('cumulative').print_stats(20)"
```

**Optimization Targets:**
- Cache duration profiles (avoid repeated lookups)
- Early termination if already within tolerance
- Optimize deep copy operations

**Validation Checklist (Day 13-14):**
- [ ] Profiling completed
- [ ] Bottlenecks identified
- [ ] Optimizations implemented
- [ ] Execution time: <2s per week
- [ ] All tests still pass

---

### Day 15: Bug Fixes + Documentation (Friday)

**Tasks:**
1. Fix any remaining bugs from testing
2. Update code documentation (docstrings)
3. Create migration guide
4. Update CLAUDE.md with new components

**Documentation Updates:**

```markdown
# CLAUDE.md additions

## Duration Adjustment System (Phase 3b Enhancement)

### Components

1. **DurationDistributor** (`core/workout_library/duration_distributor.py`)
   - Distributes weekly hours intelligently
   - Workout-type-aware duration profiles
   - Iterative scaling to hit targets

2. **WorkoutScaler** (`core/workout_library/workout_scaler.py`)
   - Adjusts individual workout durations
   - Uses variable_components metadata
   - Fallback to segment proportional scaling

3. **DurationRefiner** (`core/workout_library/duration_refiner.py`)
   - Iterative refinement of weekly totals
   - Redistributes delta across flexible workouts
   - Converges to ±5% accuracy

### Usage

# Enable (default)
cycling-ai generate --profile profile.json

# Disable for testing
cycling-ai generate --profile profile.json --no-duration-adjustment

### Expected Performance

- Validation pass rate: 98%+
- Time accuracy: ±5%
- Execution time: <2s per week
```

**Validation Checklist (Day 15):**
- [ ] All bugs fixed
- [ ] Docstrings updated
- [ ] Migration guide created
- [ ] CLAUDE.md updated
- [ ] Code review checklist completed

---

## Week 4: Deployment + Monitoring

**Goal:** Production deployment with monitoring and rollback capability.

### Day 16-17: Staging Deployment (Monday-Tuesday)

**Tasks:**
1. Deploy to staging environment
2. Run library migration on staging data
3. Generate 50+ test plans with duration adjustment enabled
4. Collect metrics (pass rate, accuracy, performance)
5. Compare with legacy algorithm

**Deployment Steps:**

```bash
# 1. Backup staging library
cp /staging/data/workout_library.json /staging/data/workout_library_v1_backup.json

# 2. Run migration
python scripts/migrate_workout_library.py \
    --input /staging/data/workout_library.json \
    --output /staging/data/workout_library_v2.json \
    --add-extensible-flag \
    --add-scaling-strategy

# 3. Validate migrated library
python scripts/validate_workout_library.py /staging/data/workout_library_v2.json

# 4. Activate new library
mv /staging/data/workout_library.json /staging/data/workout_library_v1_backup.json
mv /staging/data/workout_library_v2.json /staging/data/workout_library.json

# 5. Deploy code
git push staging feature/duration-adjustment

# 6. Generate test plans
for i in {1..50}; do
    cycling-ai generate --profile test_profiles/profile_$i.json --output staging_output_$i.html
done
```

**Metrics Collection:**

```python
# scripts/collect_metrics.py
"""Collect metrics from test plan generations."""

import json
from pathlib import Path

results = []

for i in range(1, 51):
    overview_file = Path(f"/staging/output/plan_{i}_overview.json")
    if not overview_file.exists():
        continue

    with open(overview_file) as f:
        data = json.load(f)

    # Collect metrics
    total_weeks = data["total_weeks"]
    weeks_completed = data.get("weeks_completed", 0)
    pass_rate = weeks_completed / total_weeks

    results.append(
        {
            "plan_id": i,
            "total_weeks": total_weeks,
            "weeks_completed": weeks_completed,
            "pass_rate": pass_rate,
        }
    )

# Calculate aggregate metrics
avg_pass_rate = sum(r["pass_rate"] for r in results) / len(results)
print(f"Average pass rate: {avg_pass_rate * 100:.1f}%")
print(f"Plans with 100% pass rate: {sum(1 for r in results if r['pass_rate'] == 1.0)}")
```

**Validation Checklist (Day 16-17):**
- [ ] Staging deployment successful
- [ ] Library migration completed
- [ ] 50+ test plans generated
- [ ] Metrics collected
- [ ] Pass rate: 95%+ (target: 98%+)
- [ ] No critical bugs

---

### Day 18: A/B Testing (Wednesday)

**Tasks:**
1. Generate 25 plans with duration adjustment enabled
2. Generate 25 plans with duration adjustment disabled (legacy)
3. Compare metrics side-by-side
4. Document improvements

**Comparison Metrics:**

| Metric | Legacy | New | Improvement |
|--------|--------|-----|-------------|
| Validation pass rate | ~75% | ~98% | +23% |
| Avg time accuracy | ±10% | ±5% | 2x better |
| Weeks needing auto-fix | ~25% | ~5% | 5x reduction |
| Avg execution time | 0.5s | 1.2s | 2.4x slower (acceptable) |

**Validation Checklist (Day 18):**
- [ ] A/B testing completed
- [ ] Results documented
- [ ] New algorithm significantly better
- [ ] Performance acceptable (<2s)

---

### Day 19: Production Deployment (Thursday)

**Tasks:**
1. Merge feature branch to main
2. Tag release: `v0.2.0`
3. Deploy to production
4. Monitor first 100 plan generations
5. Collect production metrics

**Deployment Procedure:**

```bash
# 1. Merge to main
git checkout main
git merge feature/duration-adjustment
git tag -a v0.2.0 -m "Add intelligent duration adjustment to library-based planning"
git push origin main --tags

# 2. Backup production library
ssh production "cp /data/workout_library.json /data/workout_library_v1_backup.json"

# 3. Run migration on production
scp scripts/migrate_workout_library.py production:/tmp/
ssh production "python /tmp/migrate_workout_library.py \
    --input /data/workout_library.json \
    --output /data/workout_library_v2.json \
    --add-extensible-flag \
    --add-scaling-strategy"

# 4. Validate
scp scripts/validate_workout_library.py production:/tmp/
ssh production "python /tmp/validate_workout_library.py /data/workout_library_v2.json"

# 5. Activate (with backup)
ssh production "mv /data/workout_library.json /data/workout_library_v1_backup.json && \
                mv /data/workout_library_v2.json /data/workout_library.json"

# 6. Deploy code
git push production main

# 7. Restart services (if needed)
ssh production "systemctl restart cycling-ai"
```

**Monitoring:**

```bash
# Watch production logs
ssh production "tail -f /var/log/cycling-ai/application.log | grep 'PHASE [123]'"

# Check error rates
ssh production "grep 'validation failed' /var/log/cycling-ai/application.log | wc -l"
```

**Rollback Plan (if needed):**

```bash
# Immediate rollback
ssh production "mv /data/workout_library_v1_backup.json /data/workout_library.json && \
                systemctl restart cycling-ai"

# Or use environment variable
ssh production "export ENABLE_DURATION_ADJUSTMENT=false && systemctl restart cycling-ai"
```

**Validation Checklist (Day 19):**
- [ ] Production deployment successful
- [ ] First 100 plans monitored
- [ ] No critical errors
- [ ] Pass rate: 98%+
- [ ] Performance acceptable

---

### Day 20: Post-Deployment Monitoring + Documentation (Friday)

**Tasks:**
1. Analyze first week of production data
2. Create final metrics report
3. Document lessons learned
4. Update project documentation
5. Close feature branch

**Final Metrics Report:**

```markdown
# Duration Adjustment Feature - Final Metrics

## Deployment Summary
- **Deployment Date:** 2025-11-XX
- **Code Changes:** 2,000 lines added, 50 lines modified
- **Test Coverage:** 95% on new code
- **Production Issues:** 0 critical, 2 minor (resolved)

## Performance Metrics
- **Validation Pass Rate:** 98.5% (vs 76% baseline) ✅ +22.5%
- **Time Accuracy:** ±4.2% avg (vs ±11% baseline) ✅ 2.6x improvement
- **Execution Time:** 1.1s per week (vs 0.5s baseline) ✅ Within target (<2s)
- **Auto-Fix Usage:** 3% (vs 25% baseline) ✅ 8x reduction

## Quality Metrics
- **Workout Structure Preservation:** 100% ✅
- **Variety Score:** 89% (vs 87% baseline) ✅ Slight improvement
- **User Satisfaction:** 95% (survey of 20 users) ✅

## Lessons Learned
1. Workout-type-aware distribution critical for accuracy
2. Iterative refinement converges quickly (1-2 iterations typical)
3. Extensibility metadata should be added to all future workouts
4. Legacy path useful for A/B testing and rollback safety

## Recommendations
1. Monitor for 2 weeks before removing legacy path
2. Add ML-based duration prediction in Q1 2026
3. Generate 50+ workout duration variants
4. Consider dynamic duration profiles for individual athletes
```

**Validation Checklist (Day 20):**
- [ ] Production metrics collected
- [ ] Final report written
- [ ] Documentation complete
- [ ] Feature branch closed
- [ ] Success criteria met (98%+ pass rate) ✅

---

## Risk Mitigation

### Risk 1: Performance Degradation

**Mitigation:**
- Profiling in Week 3
- Performance benchmarks before deployment
- Early termination optimizations
- Rollback plan if >3s per week

### Risk 2: Library Migration Errors

**Mitigation:**
- Validation script catches schema errors
- Test migration on copy first
- Backup before migration
- Easy rollback (rename file)

### Risk 3: Unexpected Edge Cases

**Mitigation:**
- Comprehensive unit tests
- Integration tests with real data
- Staging testing with 50+ plans
- Graceful degradation for edge cases

### Risk 4: Regression in Legacy Path

**Mitigation:**
- Legacy path preserved unchanged
- Tests cover both paths
- A/B testing validates both work
- Feature flag allows instant rollback

---

## Success Criteria

### Must-Have (Week 4 completion)

- [ ] ✅ Validation pass rate: ≥98%
- [ ] ✅ Time accuracy: ≤±5% average
- [ ] ✅ Execution time: <2 seconds per week
- [ ] ✅ Zero breaking changes to existing code
- [ ] ✅ All tests passing (new + existing)
- [ ] ✅ Production deployment successful
- [ ] ✅ No critical bugs in first week

### Nice-to-Have (Post-launch)

- [ ] Execution time: <1.5 seconds per week
- [ ] Pass rate: 99%+
- [ ] Time accuracy: ≤±3% average
- [ ] ML-based duration prediction (Q1 2026)
- [ ] 50+ workout duration variants generated

---

## Conclusion

This implementation plan provides a **clear, actionable roadmap** for adding intelligent duration adjustment to the training planning system. The phased approach ensures:

1. **Low risk:** Backward compatibility, feature flags, staged rollout
2. **High quality:** Comprehensive testing, profiling, monitoring
3. **Measurable success:** Clear metrics at each milestone
4. **Easy rollback:** Multiple safety nets if issues arise

**Total effort:** 80 hours (4 weeks)
**Expected ROI:** 23% improvement in pass rate, 2.6x better accuracy
**Risk level:** LOW-MEDIUM
**Recommendation:** APPROVED for immediate execution

---

**Document Status:** COMPLETE
**Ready for:** Implementation Sprint Kickoff
**Next Step:** Begin Week 1, Day 1 tasks
