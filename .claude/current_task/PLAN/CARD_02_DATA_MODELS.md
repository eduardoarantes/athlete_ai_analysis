# CARD 02: Implement Data Models

**Estimated Time:** 3 hours
**Priority:** Critical
**Dependencies:** CARD_01 (fixtures)

---

## Objective

Implement all data models using `@dataclass` with full type hints. Follow TDD: write tests first, then implement to pass tests.

---

## Acceptance Criteria

- [ ] All 6 data models implemented
- [ ] Full type hints on all fields
- [ ] `mypy --strict` compliance
- [ ] Test coverage 100% on data models
- [ ] All edge cases tested

---

## File Changes

### New Files
1. `src/cycling_ai/core/workout_comparison.py` (create, add data models only)
2. `tests/core/test_workout_comparison.py` (create, add data model tests)

---

## Implementation Steps (TDD)

### Step 1: Create Module Files

```bash
touch src/cycling_ai/core/workout_comparison.py
touch tests/core/test_workout_comparison.py
```

Add module docstring to `workout_comparison.py`:
```python
"""
Workout comparison business logic.

This module provides algorithms for comparing planned training workouts
against actual executed workouts, calculating compliance scores, and
identifying patterns in workout adherence.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
```

### Step 2: TDD - PlannedWorkout

**2a. Write Test First**

In `tests/core/test_workout_comparison.py`:

```python
import pytest
from datetime import datetime
from cycling_ai.core.workout_comparison import PlannedWorkout


class TestPlannedWorkout:
    """Test PlannedWorkout data model."""

    def test_create_planned_workout_required_fields(self):
        """Test creating PlannedWorkout with required fields."""
        workout = PlannedWorkout(
            date=datetime(2024, 11, 4),
            weekday="Monday",
            workout_type="endurance",
            total_duration_minutes=80.0,
            planned_tss=65.0,
            segments=[
                {"type": "warmup", "duration_min": 10, "power_low_pct": 50},
                {"type": "steady", "duration_min": 60, "power_low_pct": 70},
                {"type": "cooldown", "duration_min": 10, "power_low_pct": 50},
            ],
            description="Easy endurance ride",
        )

        assert workout.date == datetime(2024, 11, 4)
        assert workout.weekday == "Monday"
        assert workout.workout_type == "endurance"
        assert workout.total_duration_minutes == 80.0
        assert workout.planned_tss == 65.0
        assert len(workout.segments) == 3
        assert workout.description == "Easy endurance ride"

    def test_planned_workout_zone_distribution_auto_calculated(self):
        """Test that zone distribution is auto-calculated if not provided."""
        workout = PlannedWorkout(
            date=datetime(2024, 11, 4),
            weekday="Monday",
            workout_type="endurance",
            total_duration_minutes=80.0,
            planned_tss=65.0,
            segments=[
                {"type": "warmup", "duration_min": 10, "power_low_pct": 50, "power_high_pct": 60},
                {"type": "steady", "duration_min": 60, "power_low_pct": 65, "power_high_pct": 75},
                {"type": "cooldown", "duration_min": 10, "power_low_pct": 45, "power_high_pct": 55},
            ],
            description="Endurance",
        )

        # Should auto-calculate zone distribution
        assert isinstance(workout.zone_distribution, dict)
        # Z1 (0-55%): warmup 10min + cooldown 10min = 20min
        # Z2 (56-75%): steady 60min
        assert workout.zone_distribution.get("Z1", 0) > 0
        assert workout.zone_distribution.get("Z2", 0) > 0

    def test_planned_workout_avg_power_pct_calculated(self):
        """Test that average power percentage is calculated."""
        workout = PlannedWorkout(
            date=datetime(2024, 11, 4),
            weekday="Monday",
            workout_type="threshold",
            total_duration_minutes=60.0,
            planned_tss=85.0,
            segments=[
                {"type": "warmup", "duration_min": 10, "power_low_pct": 50, "power_high_pct": 60},
                {"type": "interval", "duration_min": 40, "power_low_pct": 95, "power_high_pct": 105},
                {"type": "cooldown", "duration_min": 10, "power_low_pct": 45, "power_high_pct": 55},
            ],
            description="Threshold",
        )

        assert workout.target_avg_power_pct is not None
        # Weighted average should be around 80-85%
        assert 75 <= workout.target_avg_power_pct <= 90
```

**2b. Implement PlannedWorkout**

In `src/cycling_ai/core/workout_comparison.py`:

```python
@dataclass
class PlannedWorkout:
    """
    Planned workout extracted from training plan JSON.

    Attributes:
        date: Workout date
        weekday: Day name (e.g., "Monday")
        workout_type: Type derived from segments ("endurance", "threshold", "vo2max", "recovery", "tempo")
        total_duration_minutes: Total planned duration
        planned_tss: Planned Training Stress Score
        segments: Raw segment data from plan
        description: Workout description
        zone_distribution: Minutes in each power zone (auto-calculated)
        target_avg_power_pct: Average target power across segments (auto-calculated)
    """

    date: datetime
    weekday: str
    workout_type: str
    total_duration_minutes: float
    planned_tss: float
    segments: list[dict[str, Any]]
    description: str

    zone_distribution: dict[str, float] = field(default_factory=dict)
    target_avg_power_pct: float | None = None

    def __post_init__(self) -> None:
        """Calculate derived fields after initialization."""
        if not self.zone_distribution:
            self.zone_distribution = self._calculate_zone_distribution()
        if self.target_avg_power_pct is None:
            self.target_avg_power_pct = self._calculate_avg_power_pct()

    def _calculate_zone_distribution(self) -> dict[str, float]:
        """
        Calculate time in each zone from segments.

        Zone mapping (% of FTP):
        - Z1: 0-55%
        - Z2: 56-75%
        - Z3: 76-90%
        - Z4: 91-105%
        - Z5: 106%+
        """
        zones: dict[str, float] = {}

        for segment in self.segments:
            duration = segment.get("duration_min", 0)
            power_low = segment.get("power_low_pct", 0)
            power_high = segment.get("power_high_pct", power_low)

            # Use average power for zone classification
            avg_power = (power_low + power_high) / 2.0

            # Map to zone
            if avg_power <= 55:
                zone = "Z1"
            elif avg_power <= 75:
                zone = "Z2"
            elif avg_power <= 90:
                zone = "Z3"
            elif avg_power <= 105:
                zone = "Z4"
            else:
                zone = "Z5"

            zones[zone] = zones.get(zone, 0) + duration

        return zones

    def _calculate_avg_power_pct(self) -> float:
        """Calculate weighted average target power across segments."""
        if not self.segments:
            return 0.0

        total_power_weighted = 0.0
        total_duration = 0.0

        for segment in self.segments:
            duration = segment.get("duration_min", 0)
            power_low = segment.get("power_low_pct", 0)
            power_high = segment.get("power_high_pct", power_low)

            avg_power = (power_low + power_high) / 2.0
            total_power_weighted += avg_power * duration
            total_duration += duration

        if total_duration == 0:
            return 0.0

        return round(total_power_weighted / total_duration, 1)
```

**2c. Run Tests**

```bash
pytest tests/core/test_workout_comparison.py::TestPlannedWorkout -v
```

### Step 3: TDD - ActualWorkout

**3a. Write Tests** (similar pattern to PlannedWorkout)
**3b. Implement ActualWorkout** (simpler, mostly just data holder)
**3c. Run Tests**

### Step 4: TDD - ComplianceMetrics

**4a. Write Tests**
**4b. Implement ComplianceMetrics**
**4c. Run Tests**

### Step 5: TDD - WorkoutComparison

**5a. Write Tests**
**5b. Implement WorkoutComparison**
**5c. Run Tests**

### Step 6: TDD - WeeklyPattern

**6a. Write Tests**
**6b. Implement WeeklyPattern**
**6c. Run Tests**

### Step 7: TDD - WeeklyComparison

**7a. Write Tests**
**7b. Implement WeeklyComparison**
**7c. Run Tests**

---

## Type Checking

After implementing all models:

```bash
mypy src/cycling_ai/core/workout_comparison.py --strict
```

Expected: Zero errors

---

## Test Coverage

```bash
pytest tests/core/test_workout_comparison.py --cov=src/cycling_ai/core/workout_comparison --cov-report=term-missing
```

Expected: 100% coverage on data models

---

## Acceptance Testing

**Manual Checks:**
1. All dataclasses use `@dataclass` decorator
2. All fields have type hints
3. Default values use `field(default_factory=...)` for mutable types
4. `__post_init__` used for calculated fields
5. All public methods have docstrings

**Automated Checks:**
```bash
# Type checking
mypy src/cycling_ai/core/workout_comparison.py --strict

# Tests pass
pytest tests/core/test_workout_comparison.py::TestPlannedWorkout -v
pytest tests/core/test_workout_comparison.py::TestActualWorkout -v
pytest tests/core/test_workout_comparison.py::TestComplianceMetrics -v
pytest tests/core/test_workout_comparison.py::TestWorkoutComparison -v
pytest tests/core/test_workout_comparison.py::TestWeeklyPattern -v
pytest tests/core/test_workout_comparison.py::TestWeeklyComparison -v

# Coverage 100%
pytest tests/core/test_workout_comparison.py --cov=src/cycling_ai/core/workout_comparison --cov-report=term
```

---

## Notes

- Use existing patterns from `core/athlete.py` (dataclass with methods)
- Follow zone definitions from architecture (Z1: 0-55%, Z2: 56-75%, etc.)
- Handle optional fields gracefully (use `None` as default)
- Validate data in `__post_init__` if needed
- Keep models simple - no complex business logic here

---

**Ready for Implementation:** YES (after CARD_01 complete)
**Blocked:** NO
