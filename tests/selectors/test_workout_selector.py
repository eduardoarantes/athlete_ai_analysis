"""Tests for WorkoutSelector class."""

import json
from pathlib import Path

import pytest

from cycling_ai.selectors.workout_selector import (
    SelectedWorkout,
    WorkoutRequirements,
    WorkoutSelector,
)


@pytest.fixture
def test_library_path(tmp_path: Path) -> Path:
    """Create a test workout library."""
    library = {
        "version": "1.0.0",
        "description": "Test workout library",
        "workouts": [
            {
                "id": "vo2_classic",
                "name": "VO2 Max Classic",
                "detailed_description": "Classic VO2 max intervals",
                "type": "vo2max",
                "intensity": "hard",
                "suitable_phases": ["Build", "Peak"],
                "suitable_weekdays": ["Tuesday", "Wednesday", "Thursday"],
                "segments": [
                    {
                        "type": "warmup",
                        "duration_min": 10,
                        "power_low_pct": 50,
                        "power_high_pct": 65,
                        "description": "Warmup",
                    },
                    {
                        "type": "interval",
                        "sets": 5,
                        "work": {
                            "duration_min": 3,
                            "power_low_pct": 110,
                            "power_high_pct": 120,
                            "description": "VO2 work",
                        },
                        "recovery": {
                            "duration_min": 3,
                            "power_low_pct": 50,
                            "power_high_pct": 60,
                            "description": "Recovery",
                        },
                    },
                    {
                        "type": "cooldown",
                        "duration_min": 10,
                        "power_low_pct": 50,
                        "power_high_pct": 55,
                        "description": "Cooldown",
                    },
                ],
                "base_duration_min": 50,
                "base_tss": 85,
                "variable_components": {
                    "adjustable_field": "sets",
                    "min_value": 3,
                    "max_value": 8,
                    "tss_per_unit": 15,
                    "duration_per_unit_min": 6,
                },
            },
            {
                "id": "threshold_2x20",
                "name": "Threshold 2x20",
                "detailed_description": "Classic threshold intervals",
                "type": "threshold",
                "intensity": "hard",
                "suitable_phases": ["Build", "Peak"],
                "suitable_weekdays": ["Tuesday", "Wednesday", "Thursday"],
                "segments": [
                    {
                        "type": "warmup",
                        "duration_min": 15,
                        "power_low_pct": 50,
                        "power_high_pct": 75,
                        "description": "Warmup",
                    },
                    {
                        "type": "interval",
                        "sets": 2,
                        "work": {
                            "duration_min": 20,
                            "power_low_pct": 95,
                            "power_high_pct": 100,
                            "description": "Threshold",
                        },
                        "recovery": {
                            "duration_min": 5,
                            "power_low_pct": 50,
                            "power_high_pct": 60,
                            "description": "Recovery",
                        },
                    },
                    {
                        "type": "cooldown",
                        "duration_min": 10,
                        "power_low_pct": 50,
                        "power_high_pct": 55,
                        "description": "Cooldown",
                    },
                ],
                "base_duration_min": 70,
                "base_tss": 95,
                "variable_components": {
                    "adjustable_field": "sets",
                    "min_value": 2,
                    "max_value": 4,
                    "tss_per_unit": 40,
                    "duration_per_unit_min": 25,
                },
            },
            {
                "id": "endurance_2hr",
                "name": "2hr Endurance",
                "detailed_description": "Long endurance ride",
                "type": "endurance",
                "intensity": "easy",
                "suitable_phases": ["Foundation", "Build", "Recovery"],
                "suitable_weekdays": ["Saturday", "Sunday"],
                "segments": [
                    {
                        "type": "steady",
                        "duration_min": 120,
                        "power_low_pct": 56,
                        "power_high_pct": 75,
                        "description": "Endurance",
                    }
                ],
                "base_duration_min": 120,
                "base_tss": 95,
                "variable_components": {
                    "adjustable_field": "duration",
                    "min_value": 60,
                    "max_value": 240,
                    "tss_per_unit": 0.8,
                    "duration_per_unit_min": 1,
                },
            },
            {
                "id": "recovery_ride",
                "name": "Recovery Ride",
                "detailed_description": "Easy recovery spin",
                "type": "recovery",
                "intensity": "easy",
                "suitable_phases": ["Recovery"],
                "suitable_weekdays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
                "segments": [
                    {
                        "type": "steady",
                        "duration_min": 30,
                        "power_low_pct": 45,
                        "power_high_pct": 55,
                        "description": "Easy spin",
                    }
                ],
                "base_duration_min": 30,
                "base_tss": 20,
            },
        ],
    }

    library_path = tmp_path / "test_library.json"
    with open(library_path, "w") as f:
        json.dump(library, f)

    return library_path


@pytest.fixture
def selector(test_library_path: Path) -> WorkoutSelector:
    """Create a WorkoutSelector with test library."""
    return WorkoutSelector(library_path=test_library_path)


def test_load_library(selector: WorkoutSelector) -> None:
    """Test library loading."""
    assert len(selector.workouts) == 4
    assert selector.workouts[0]["id"] == "vo2_classic"


def test_library_not_found() -> None:
    """Test error handling for missing library."""
    with pytest.raises(FileNotFoundError, match="Workout library not found"):
        WorkoutSelector(library_path="/nonexistent/path.json")


def test_select_workout_by_type(selector: WorkoutSelector) -> None:
    """Test selecting workout by type."""
    requirements = WorkoutRequirements(
        weekday="Tuesday", phase="Build", workout_type="vo2max"
    )

    workout = selector.select_workout(requirements)

    assert workout is not None
    assert workout.workout_type == "vo2max"
    assert workout.name == "VO2 Max Classic"


def test_select_workout_by_intensity(selector: WorkoutSelector) -> None:
    """Test selecting workout by intensity."""
    requirements = WorkoutRequirements(
        weekday="Monday", phase="Recovery", intensity="easy"
    )

    workout = selector.select_workout(requirements)

    assert workout is not None
    assert workout.intensity == "easy"


def test_select_workout_prefers_weekday_match(selector: WorkoutSelector) -> None:
    """Test that selector prefers workouts matching weekday."""
    # Saturday - should prefer endurance (Saturday in suitable_weekdays)
    # over VO2 (not in suitable_weekdays)
    requirements = WorkoutRequirements(
        weekday="Saturday", phase="Build", intensity="easy"
    )

    workout = selector.select_workout(requirements)

    assert workout is not None
    assert "Saturday" in selector.workouts[2]["suitable_weekdays"]  # endurance_2hr


def test_select_workout_no_match(selector: WorkoutSelector) -> None:
    """Test that None is returned when no match found."""
    requirements = WorkoutRequirements(
        weekday="Monday", phase="Taper", workout_type="vo2max"  # No VO2 workouts for Taper
    )

    workout = selector.select_workout(requirements)

    assert workout is None


def test_adjust_workout_tss_increase(selector: WorkoutSelector) -> None:
    """Test adjusting workout TSS upward."""
    requirements = WorkoutRequirements(
        weekday="Tuesday",
        phase="Build",
        workout_type="vo2max",
        target_tss=115,  # Base is 85, need +30 (~2 sets)
    )

    workout = selector.select_workout(requirements)

    assert workout is not None
    assert workout.adjusted is True
    assert workout.tss > 85  # Should be increased
    assert workout.tss <= 130  # But within max_value (8 sets)
    assert workout.adjustment_details is not None
    assert workout.adjustment_details["field"] == "sets"


def test_adjust_workout_tss_decrease(selector: WorkoutSelector) -> None:
    """Test adjusting workout TSS downward."""
    requirements = WorkoutRequirements(
        weekday="Tuesday",
        phase="Build",
        workout_type="vo2max",
        target_tss=70,  # Base is 85, need -15 (~1 set)
    )

    workout = selector.select_workout(requirements)

    assert workout is not None
    assert workout.adjusted is True
    assert workout.tss < 85  # Should be decreased
    assert workout.tss >= 55  # But within min_value (3 sets)


def test_adjust_workout_duration(selector: WorkoutSelector) -> None:
    """Test adjusting workout by duration."""
    requirements = WorkoutRequirements(
        weekday="Saturday",
        phase="Foundation",
        workout_type="endurance",
        target_duration_min=180,  # Base is 120, need +60
    )

    workout = selector.select_workout(requirements)

    assert workout is not None
    assert workout.adjusted is True
    assert workout.duration_min > 120  # Should be increased
    assert abs(workout.duration_min - 180) < 30  # Close to target


def test_adjust_workout_within_tolerance(selector: WorkoutSelector) -> None:
    """Test that workout within tolerance is not adjusted."""
    requirements = WorkoutRequirements(
        weekday="Tuesday",
        phase="Build",
        workout_type="vo2max",
        target_tss=87,  # Within 15% of 85 (base)
        tss_tolerance_pct=0.15,
    )

    workout = selector.select_workout(requirements)

    assert workout is not None
    assert workout.adjusted is False  # Should not adjust
    assert workout.tss == 85  # Original TSS


def test_adjust_workout_respects_min_max(selector: WorkoutSelector) -> None:
    """Test that adjustments respect min/max constraints."""
    requirements = WorkoutRequirements(
        weekday="Tuesday",
        phase="Build",
        workout_type="vo2max",
        target_tss=200,  # Way above max (8 sets = ~130 TSS)
    )

    workout = selector.select_workout(requirements)

    assert workout is not None
    assert workout.adjusted is True
    # Should clamp to max_value (8 sets)
    # 8 sets × 15 TSS/set + base = 85 + (3 sets × 15) = 130
    assert workout.tss <= 130


def test_get_workouts_by_type(selector: WorkoutSelector) -> None:
    """Test filtering workouts by type."""
    vo2_workouts = selector.get_workouts_by_type("vo2max")

    assert len(vo2_workouts) == 1
    assert vo2_workouts[0]["id"] == "vo2_classic"


def test_get_workouts_by_phase(selector: WorkoutSelector) -> None:
    """Test filtering workouts by phase."""
    build_workouts = selector.get_workouts_by_phase("Build")

    assert len(build_workouts) == 3  # vo2, threshold, endurance
    ids = [w["id"] for w in build_workouts]
    assert "vo2_classic" in ids
    assert "threshold_2x20" in ids
    assert "endurance_2hr" in ids


def test_get_workout_stats(selector: WorkoutSelector) -> None:
    """Test getting library statistics."""
    stats = selector.get_workout_stats()

    assert stats["total_workouts"] == 4
    assert stats["by_type"]["vo2max"] == 1
    assert stats["by_type"]["threshold"] == 1
    assert stats["by_type"]["endurance"] == 1
    assert stats["by_type"]["recovery"] == 1
    assert stats["by_intensity"]["hard"] == 2
    assert stats["by_intensity"]["easy"] == 2
    assert stats["by_phase"]["Build"] == 3
    assert stats["by_phase"]["Recovery"] == 2
    assert stats["avg_duration_min"] == (50 + 70 + 120 + 30) / 4
    assert stats["avg_tss"] == (85 + 95 + 95 + 20) / 4


def test_selected_workout_dataclass() -> None:
    """Test SelectedWorkout dataclass creation."""
    workout = SelectedWorkout(
        workout_id="test_id",
        name="Test Workout",
        detailed_description="Test description",
        workout_type="vo2max",
        intensity="hard",
        weekday="Tuesday",
        segments=[],
        duration_min=60,
        tss=85,
        adjusted=False,
    )

    assert workout.workout_id == "test_id"
    assert workout.name == "Test Workout"
    assert workout.adjusted is False
    assert workout.adjustment_details is None


def test_workout_requirements_defaults() -> None:
    """Test WorkoutRequirements default values."""
    req = WorkoutRequirements(weekday="Tuesday", phase="Build")

    assert req.weekday == "Tuesday"
    assert req.phase == "Build"
    assert req.workout_type is None
    assert req.intensity is None
    assert req.target_tss is None
    assert req.target_duration_min is None
    assert req.tss_tolerance_pct == 0.15
    assert req.duration_tolerance_pct == 0.20


def test_calculate_base_value_sets(selector: WorkoutSelector) -> None:
    """Test _calculate_base_value for sets adjustment."""
    workout = selector.workouts[0]  # vo2_classic with 5 sets
    base_value = selector._calculate_base_value(workout, "sets")

    assert base_value == 5


def test_calculate_base_value_duration(selector: WorkoutSelector) -> None:
    """Test _calculate_base_value for duration adjustment."""
    workout = selector.workouts[2]  # endurance_2hr with 120 min steady
    base_value = selector._calculate_base_value(workout, "duration")

    assert base_value == 120


def test_apply_adjustment_sets(selector: WorkoutSelector) -> None:
    """Test _apply_adjustment for sets field."""
    original_segments = selector.workouts[0]["segments"]
    adjusted_segments = selector._apply_adjustment(original_segments, "sets", 7)

    # Find interval segment
    interval_seg = next(s for s in adjusted_segments if s["type"] == "interval")
    assert interval_seg["sets"] == 7

    # Original should be unchanged (deep copy)
    original_interval = next(s for s in original_segments if s["type"] == "interval")
    assert original_interval["sets"] == 5


def test_apply_adjustment_duration(selector: WorkoutSelector) -> None:
    """Test _apply_adjustment for duration field."""
    original_segments = selector.workouts[2]["segments"]
    adjusted_segments = selector._apply_adjustment(original_segments, "duration", 180)

    # Find steady segment
    steady_seg = next(s for s in adjusted_segments if s["type"] == "steady")
    assert steady_seg["duration_min"] == 180

    # Original should be unchanged
    original_steady = next(s for s in original_segments if s["type"] == "steady")
    assert original_steady["duration_min"] == 120


def test_select_workout_full_requirements(selector: WorkoutSelector) -> None:
    """Test selecting workout with all requirement fields specified."""
    requirements = WorkoutRequirements(
        weekday="Tuesday",
        phase="Build",
        workout_type="vo2max",
        intensity="hard",
        target_tss=100,
        target_duration_min=60,
        tss_tolerance_pct=0.10,
        duration_tolerance_pct=0.15,
    )

    workout = selector.select_workout(requirements)

    assert workout is not None
    assert workout.workout_type == "vo2max"
    assert workout.intensity == "hard"
    # Should be adjusted to hit targets
    assert workout.adjusted is True


def test_real_library_exists() -> None:
    """Test that the real workout library exists and can be loaded."""
    # Use default path
    selector = WorkoutSelector()

    assert len(selector.workouts) > 0
    # Should have multiple types
    stats = selector.get_workout_stats()
    assert len(stats["by_type"]) > 0
