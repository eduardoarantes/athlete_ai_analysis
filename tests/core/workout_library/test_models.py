"""Tests for workout library Pydantic models."""

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from cycling_ai.core.workout_library.models import (
    Workout,
    WorkoutLibrary,
    WorkoutSegment,
    VariableComponents,
)


class TestWorkoutSegment:
    """Test WorkoutSegment model validation."""

    def test_valid_segment(self) -> None:
        """Test creating a valid workout segment."""
        segment = WorkoutSegment(
            type="warmup",
            duration_min=10.0,
            power_low_pct=50,
            power_high_pct=60,
            description="Warm up easy",
        )

        assert segment.type == "warmup"
        assert segment.duration_min == 10.0
        assert segment.power_low_pct == 50
        assert segment.power_high_pct == 60

    def test_all_segment_types(self) -> None:
        """Test all valid segment types."""
        valid_types = ["warmup", "interval", "recovery", "cooldown", "steady"]

        for seg_type in valid_types:
            segment = WorkoutSegment(
                type=seg_type,
                duration_min=5.0,
                power_low_pct=50,
                power_high_pct=60,
                description="Test",
            )
            assert segment.type == seg_type

    def test_invalid_segment_type(self) -> None:
        """Test that invalid segment type raises error."""
        with pytest.raises(ValidationError) as exc_info:
            WorkoutSegment(
                type="invalid_type",
                duration_min=5.0,
                power_low_pct=50,
                power_high_pct=60,
                description="Test",
            )

        assert "type" in str(exc_info.value)

    def test_missing_required_fields(self) -> None:
        """Test that missing type field raises error."""
        with pytest.raises(ValidationError) as exc_info:
            WorkoutSegment(
                duration_min=10.0,
                power_low_pct=50,
                power_high_pct=60,
                description="Test",
            )

        assert "type" in str(exc_info.value)


class TestVariableComponents:
    """Test VariableComponents model validation."""

    def test_valid_duration_adjustment(self) -> None:
        """Test creating valid variable components for duration."""
        var_comp = VariableComponents(
            adjustable_field="duration", min_value=30.0, max_value=90.0
        )

        assert var_comp.adjustable_field == "duration"
        assert var_comp.min_value == 30.0
        assert var_comp.max_value == 90.0

    def test_valid_sets_adjustment(self) -> None:
        """Test creating valid variable components for sets."""
        var_comp = VariableComponents(
            adjustable_field="sets",
            min_value=3.0,
            max_value=8.0,
            tss_per_unit=16.9,
            duration_per_unit_min=17.0,
        )

        assert var_comp.adjustable_field == "sets"
        assert var_comp.tss_per_unit == 16.9
        assert var_comp.duration_per_unit_min == 17.0

    def test_invalid_adjustable_field(self) -> None:
        """Test that invalid adjustable field raises error."""
        with pytest.raises(ValidationError) as exc_info:
            VariableComponents(adjustable_field="invalid", min_value=10.0, max_value=20.0)

        assert "adjustable_field" in str(exc_info.value)


class TestWorkout:
    """Test Workout model validation."""

    def test_valid_workout(self) -> None:
        """Test creating a valid workout."""
        workout = Workout(
            id="test_workout_1",
            name="Test Endurance Ride",
            detailed_description="A simple endurance ride for testing",
            type="endurance",
            intensity="easy",
            suitable_phases=["Base", "Build"],
            suitable_weekdays=["Monday", "Wednesday", "Friday"],
            segments=[
                WorkoutSegment(
                    type="warmup",
                    duration_min=10.0,
                    power_low_pct=50,
                    power_high_pct=60,
                    description="Warm up",
                ),
                WorkoutSegment(
                    type="steady",
                    duration_min=60.0,
                    power_low_pct=65,
                    power_high_pct=75,
                    description="Steady endurance",
                ),
                WorkoutSegment(
                    type="cooldown",
                    duration_min=10.0,
                    power_low_pct=50,
                    power_high_pct=60,
                    description="Cool down",
                ),
            ],
            base_duration_min=80.0,
            base_tss=65.5,
            variable_components=None,
            source_file="test.json",
            source_format="json",
        )

        assert workout.id == "test_workout_1"
        assert workout.type == "endurance"
        assert len(workout.segments) == 3
        assert workout.base_duration_min == 80.0

    def test_all_workout_types(self) -> None:
        """Test all valid workout types."""
        valid_types = ["endurance", "tempo", "sweetspot", "threshold", "vo2max", "recovery", "mixed"]

        for workout_type in valid_types:
            workout = Workout(
                id=f"test_{workout_type}",
                name=f"Test {workout_type}",
                detailed_description=f"Test {workout_type} workout",
                type=workout_type,
                intensity="moderate",
                suitable_phases=["Base"],
                suitable_weekdays=["Monday"],
                segments=[],
                base_duration_min=60.0,
                base_tss=50.0,
                source_file="test.json",
                source_format="json",
            )
            assert workout.type == workout_type

    def test_all_intensity_levels(self) -> None:
        """Test all valid intensity levels."""
        valid_intensities = ["easy", "moderate", "hard", "very_hard"]

        for intensity in valid_intensities:
            workout = Workout(
                id="test_workout",
                name="Test",
                detailed_description="Test",
                type="endurance",
                intensity=intensity,
                suitable_phases=["Base"],
                suitable_weekdays=["Monday"],
                segments=[],
                base_duration_min=60.0,
                base_tss=50.0,
                source_file="test.json",
                source_format="json",
            )
            assert workout.intensity == intensity

    def test_all_phases(self) -> None:
        """Test all valid training phases."""
        valid_phases = ["Base", "Build", "Peak", "Taper"]

        for phase in valid_phases:
            workout = Workout(
                id="test_workout",
                name="Test",
                detailed_description="Test",
                type="endurance",
                intensity="moderate",
                suitable_phases=[phase],
                suitable_weekdays=["Monday"],
                segments=[],
                base_duration_min=60.0,
                base_tss=50.0,
                source_file="test.json",
                source_format="json",
            )
            assert phase in workout.suitable_phases

    def test_all_weekdays(self) -> None:
        """Test all valid weekdays."""
        valid_weekdays = [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
        ]

        for weekday in valid_weekdays:
            workout = Workout(
                id="test_workout",
                name="Test",
                detailed_description="Test",
                type="endurance",
                intensity="moderate",
                suitable_phases=["Base"],
                suitable_weekdays=[weekday],
                segments=[],
                base_duration_min=60.0,
                base_tss=50.0,
                source_file="test.json",
                source_format="json",
            )
            assert weekday in workout.suitable_weekdays

    def test_optional_variable_components(self) -> None:
        """Test that variable_components is optional."""
        workout = Workout(
            id="test_workout",
            name="Test",
            detailed_description="Test",
            type="endurance",
            intensity="moderate",
            suitable_phases=["Base"],
            suitable_weekdays=["Monday"],
            segments=[],
            base_duration_min=60.0,
            base_tss=50.0,
            source_file="test.json",
            source_format="json",
        )

        assert workout.variable_components is None

    def test_workout_with_variable_components(self) -> None:
        """Test workout with variable components."""
        workout = Workout(
            id="test_workout",
            name="Test",
            detailed_description="Test",
            type="endurance",
            intensity="moderate",
            suitable_phases=["Base"],
            suitable_weekdays=["Monday"],
            segments=[],
            base_duration_min=60.0,
            base_tss=50.0,
            variable_components=VariableComponents(
                adjustable_field="duration", min_value=30.0, max_value=90.0
            ),
            source_file="test.json",
            source_format="json",
        )

        assert workout.variable_components is not None
        assert workout.variable_components.adjustable_field == "duration"

    def test_invalid_workout_type(self) -> None:
        """Test that invalid workout type raises error."""
        with pytest.raises(ValidationError) as exc_info:
            Workout(
                id="test_workout",
                name="Test",
                detailed_description="Test",
                type="invalid_type",
                intensity="moderate",
                suitable_phases=["Base"],
                suitable_weekdays=["Monday"],
                segments=[],
                base_duration_min=60.0,
                base_tss=50.0,
                source_file="test.json",
                source_format="json",
            )

        assert "type" in str(exc_info.value)


class TestWorkoutLibrary:
    """Test WorkoutLibrary model validation."""

    def test_valid_library(self) -> None:
        """Test creating a valid workout library."""
        library = WorkoutLibrary(
            version="1.0.0",
            description="Test library",
            workouts=[
                Workout(
                    id="workout_1",
                    name="Test 1",
                    detailed_description="Test",
                    type="endurance",
                    intensity="easy",
                    suitable_phases=["Base"],
                    suitable_weekdays=["Monday"],
                    segments=[],
                    base_duration_min=60.0,
                    base_tss=50.0,
                    source_file="test.json",
                    source_format="json",
                ),
                Workout(
                    id="workout_2",
                    name="Test 2",
                    detailed_description="Test",
                    type="tempo",
                    intensity="moderate",
                    suitable_phases=["Build"],
                    suitable_weekdays=["Wednesday"],
                    segments=[],
                    base_duration_min=75.0,
                    base_tss=80.0,
                    source_file="test.json",
                    source_format="json",
                ),
            ],
        )

        assert library.version == "1.0.0"
        assert len(library.workouts) == 2
        assert library.workouts[0].id == "workout_1"
        assert library.workouts[1].id == "workout_2"

    def test_empty_library(self) -> None:
        """Test creating an empty library."""
        library = WorkoutLibrary(version="1.0.0", description="Empty library", workouts=[])

        assert len(library.workouts) == 0

    def test_load_real_library_json(self) -> None:
        """Test loading real workout library JSON file."""
        library_path = (
            Path(__file__).parent.parent.parent.parent / "data" / "workout_library.json"
        )

        if not library_path.exists():
            pytest.skip(f"Workout library not found at {library_path}")

        with open(library_path, "r", encoding="utf-8") as f:
            library_data = json.load(f)

        # Validate with Pydantic
        library = WorkoutLibrary(**library_data)

        # Verify structure
        assert library.version is not None
        assert library.description is not None
        assert len(library.workouts) > 0

        # Verify first workout is valid
        first_workout = library.workouts[0]
        assert first_workout.id is not None
        assert first_workout.type in [
            "endurance",
            "tempo",
            "sweetspot",
            "threshold",
            "vo2max",
            "recovery",
            "mixed",
        ]
        assert len(first_workout.segments) > 0
