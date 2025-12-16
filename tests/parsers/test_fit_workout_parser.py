"""Unit tests for FIT workout parser data classes."""

from datetime import datetime

import pytest

from cycling_ai.parsers.fit_workout_parser import (
    FitDurationType,
    FitIntensity,
    FitRepeatStructure,
    FitTargetType,
    FitWorkoutMetadata,
    FitWorkoutStep,
    ParsedWorkout,
)


class TestFitWorkoutMetadata:
    """Test FitWorkoutMetadata data class."""

    def test_valid_metadata(self):
        """Test creating valid metadata."""
        metadata = FitWorkoutMetadata(
            name="Test Workout",
            sport="cycling",
            num_steps=5,
        )

        assert metadata.name == "Test Workout"
        assert metadata.sport == "cycling"
        assert metadata.num_steps == 5
        assert metadata.manufacturer is None
        assert metadata.time_created is None

    def test_metadata_with_optional_fields(self):
        """Test metadata with optional fields."""
        now = datetime.now()
        metadata = FitWorkoutMetadata(
            name="Test Workout",
            sport="cycling",
            num_steps=5,
            manufacturer="Garmin",
            time_created=now,
        )

        assert metadata.manufacturer == "Garmin"
        assert metadata.time_created == now

    def test_empty_name_raises_error(self):
        """Test that empty name raises ValueError."""
        with pytest.raises(ValueError, match="Workout name cannot be empty"):
            FitWorkoutMetadata(name="", sport="cycling", num_steps=5)

    def test_zero_steps_raises_error(self):
        """Test that zero steps raises ValueError."""
        with pytest.raises(ValueError, match="Invalid step count"):
            FitWorkoutMetadata(name="Test", sport="cycling", num_steps=0)

    def test_negative_steps_raises_error(self):
        """Test that negative steps raises ValueError."""
        with pytest.raises(ValueError, match="Invalid step count"):
            FitWorkoutMetadata(name="Test", sport="cycling", num_steps=-1)

    def test_empty_sport_raises_error(self):
        """Test that empty sport raises ValueError."""
        with pytest.raises(ValueError, match="Sport cannot be empty"):
            FitWorkoutMetadata(name="Test", sport="", num_steps=5)


class TestFitWorkoutStep:
    """Test FitWorkoutStep data class."""

    def test_valid_step(self):
        """Test creating valid workout step."""
        step = FitWorkoutStep(
            message_index=0,
            intensity=FitIntensity.WARMUP,
            duration_type=FitDurationType.TIME,
            duration_value=600.0,
            target_type=FitTargetType.POWER,
            custom_power_low=150,
            custom_power_high=180,
            step_name="Warmup",
        )

        assert step.message_index == 0
        assert step.intensity == FitIntensity.WARMUP
        assert step.duration_value == 600.0
        assert step.step_name == "Warmup"

    def test_is_repeat_step(self):
        """Test repeat step detection."""
        step = FitWorkoutStep(
            message_index=5,
            intensity=None,
            duration_type=FitDurationType.REPEAT_UNTIL_STEPS_COMPLETE,
            duration_value=5,
            target_type=FitTargetType.OPEN,
            repeat_steps=5,
        )

        assert step.is_repeat_step() is True

    def test_is_not_repeat_step(self):
        """Test non-repeat step detection."""
        step = FitWorkoutStep(
            message_index=0,
            intensity=FitIntensity.ACTIVE,
            duration_type=FitDurationType.TIME,
            duration_value=600,
            target_type=FitTargetType.POWER,
        )

        assert step.is_repeat_step() is False

    def test_has_power_zone(self):
        """Test power zone detection."""
        step = FitWorkoutStep(
            message_index=0,
            intensity=FitIntensity.ACTIVE,
            duration_type=FitDurationType.TIME,
            duration_value=600,
            target_type=FitTargetType.POWER,
            target_power_zone=4,
        )

        assert step.has_power_zone() is True
        assert step.has_custom_power() is False

    def test_has_custom_power(self):
        """Test custom power range detection."""
        step = FitWorkoutStep(
            message_index=0,
            intensity=FitIntensity.ACTIVE,
            duration_type=FitDurationType.TIME,
            duration_value=600,
            target_type=FitTargetType.POWER,
            custom_power_low=225,
            custom_power_high=250,
        )

        assert step.has_power_zone() is False
        assert step.has_custom_power() is True

    def test_negative_message_index_raises_error(self):
        """Test that negative message_index raises ValueError."""
        with pytest.raises(ValueError, match="Invalid message_index"):
            FitWorkoutStep(
                message_index=-1,
                intensity=FitIntensity.ACTIVE,
                duration_type=FitDurationType.TIME,
                duration_value=600,
                target_type=FitTargetType.POWER,
            )

    def test_negative_duration_raises_error(self):
        """Test that negative duration raises ValueError."""
        with pytest.raises(ValueError, match="Invalid duration_value"):
            FitWorkoutStep(
                message_index=0,
                intensity=FitIntensity.ACTIVE,
                duration_type=FitDurationType.TIME,
                duration_value=-100,
                target_type=FitTargetType.POWER,
            )

    def test_repeat_step_missing_repeat_steps_raises_error(self):
        """Test that repeat step without repeat_steps raises ValueError."""
        with pytest.raises(ValueError, match="missing valid repeat_steps"):
            FitWorkoutStep(
                message_index=5,
                intensity=None,
                duration_type=FitDurationType.REPEAT_UNTIL_STEPS_COMPLETE,
                duration_value=5,
                target_type=FitTargetType.OPEN,
                repeat_steps=None,
            )


class TestFitRepeatStructure:
    """Test FitRepeatStructure data class."""

    def test_valid_repeat_structure(self):
        """Test creating valid repeat structure."""
        work_step = FitWorkoutStep(
            message_index=1,
            intensity=FitIntensity.ACTIVE,
            duration_type=FitDurationType.TIME,
            duration_value=180,
            target_type=FitTargetType.POWER,
            custom_power_low=250,
            custom_power_high=270,
        )

        recovery_step = FitWorkoutStep(
            message_index=2,
            intensity=FitIntensity.REST,
            duration_type=FitDurationType.TIME,
            duration_value=180,
            target_type=FitTargetType.POWER,
            custom_power_low=100,
            custom_power_high=120,
        )

        repeat = FitRepeatStructure(
            repeat_count=5, work_step=work_step, recovery_step=recovery_step
        )

        assert repeat.repeat_count == 5
        assert repeat.work_step == work_step
        assert repeat.recovery_step == recovery_step

    def test_to_interval_segment(self):
        """Test conversion to interval segment."""
        work_step = FitWorkoutStep(
            message_index=1,
            intensity=FitIntensity.ACTIVE,
            duration_type=FitDurationType.TIME,
            duration_value=180,  # 3 minutes
            target_type=FitTargetType.POWER,
            custom_power_low=260,  # 100% FTP
            custom_power_high=286,  # 110% FTP
            step_name="Hard",
        )

        recovery_step = FitWorkoutStep(
            message_index=2,
            intensity=FitIntensity.REST,
            duration_type=FitDurationType.TIME,
            duration_value=180,
            target_type=FitTargetType.POWER,
            custom_power_low=130,  # 50% FTP
            custom_power_high=156,  # 60% FTP
            step_name="Easy",
        )

        repeat = FitRepeatStructure(
            repeat_count=5, work_step=work_step, recovery_step=recovery_step
        )

        segment = repeat.to_interval_segment(ftp=260)

        assert segment["type"] == "interval"
        assert segment["sets"] == 5
        assert segment["work"]["duration_min"] == 3
        assert segment["work"]["power_low_pct"] == 100
        assert segment["work"]["power_high_pct"] == 110
        assert segment["work"]["description"] == "Hard"
        assert segment["recovery"]["duration_min"] == 3
        assert segment["recovery"]["power_low_pct"] == 50
        assert segment["recovery"]["power_high_pct"] == 60
        assert segment["recovery"]["description"] == "Easy"

    def test_calculate_power_pct(self):
        """Test power percentage calculation."""
        assert FitRepeatStructure._calculate_power_pct(260, 260) == 100
        assert FitRepeatStructure._calculate_power_pct(286, 260) == 110
        assert FitRepeatStructure._calculate_power_pct(130, 260) == 50

    def test_calculate_power_pct_invalid_ftp(self):
        """Test error when FTP is invalid."""
        with pytest.raises(ValueError, match="Invalid FTP"):
            FitRepeatStructure._calculate_power_pct(260, 0)

        with pytest.raises(ValueError, match="Invalid FTP"):
            FitRepeatStructure._calculate_power_pct(260, -10)

    def test_invalid_repeat_count_raises_error(self):
        """Test that invalid repeat count raises ValueError."""
        work_step = FitWorkoutStep(
            message_index=1,
            intensity=FitIntensity.ACTIVE,
            duration_type=FitDurationType.TIME,
            duration_value=180,
            target_type=FitTargetType.POWER,
            custom_power_low=250,
            custom_power_high=270,
        )

        with pytest.raises(ValueError, match="Invalid repeat_count"):
            FitRepeatStructure(repeat_count=0, work_step=work_step)


class TestParsedWorkout:
    """Test ParsedWorkout data class."""

    def test_generate_workout_id(self):
        """Test workout ID generation."""
        metadata = FitWorkoutMetadata(
            name="VO2 Max intervals - 5x3min", sport="cycling", num_steps=7
        )

        # Need at least one segment to pass validation
        segments = [{"type": "warmup", "duration_min": 15}]

        workout = ParsedWorkout(
            metadata=metadata, segments=segments, base_duration_min=55, base_tss=85
        )

        workout_id = workout._generate_workout_id()

        assert workout_id == "vo2_max_intervals_5x3min"
        assert len(workout_id) <= 50

    def test_infer_workout_type_vo2max(self):
        """Test inferring VO2 max workout type."""
        metadata = FitWorkoutMetadata(name="VO2 Max", sport="cycling", num_steps=5)

        segments = [
            {
                "type": "interval",
                "sets": 5,
                "work": {"power_high_pct": 115},
            }
        ]

        workout = ParsedWorkout(
            metadata=metadata, segments=segments, base_duration_min=55, base_tss=85
        )

        assert workout._infer_workout_type() == "vo2max"

    def test_infer_workout_type_threshold(self):
        """Test inferring threshold workout type."""
        metadata = FitWorkoutMetadata(name="Threshold", sport="cycling", num_steps=5)

        segments = [
            {
                "type": "interval",
                "sets": 2,
                "work": {"power_high_pct": 95},
            }
        ]

        workout = ParsedWorkout(
            metadata=metadata, segments=segments, base_duration_min=55, base_tss=85
        )

        assert workout._infer_workout_type() == "threshold"

    def test_infer_workout_type_endurance(self):
        """Test inferring endurance workout type."""
        metadata = FitWorkoutMetadata(
            name="Endurance", sport="cycling", num_steps=1
        )

        segments = [
            {
                "type": "steady",
                "duration_min": 60,
            }
        ]

        workout = ParsedWorkout(
            metadata=metadata, segments=segments, base_duration_min=60, base_tss=50
        )

        assert workout._infer_workout_type() == "endurance"

    def test_infer_intensity_hard(self):
        """Test inferring hard intensity."""
        metadata = FitWorkoutMetadata(name="VO2 Max", sport="cycling", num_steps=5)

        segments = [
            {
                "type": "interval",
                "sets": 5,
                "work": {"power_high_pct": 115},
            }
        ]

        workout = ParsedWorkout(
            metadata=metadata, segments=segments, base_duration_min=55, base_tss=85
        )

        assert workout._infer_intensity() == "hard"

    def test_infer_intensity_easy(self):
        """Test inferring easy intensity."""
        metadata = FitWorkoutMetadata(
            name="Endurance", sport="cycling", num_steps=1
        )

        segments = [
            {
                "type": "steady",
                "duration_min": 60,
            }
        ]

        workout = ParsedWorkout(
            metadata=metadata, segments=segments, base_duration_min=60, base_tss=50
        )

        assert workout._infer_intensity() == "easy"

    def test_to_library_format(self):
        """Test conversion to library format."""
        metadata = FitWorkoutMetadata(
            name="Threshold workout", sport="cycling", num_steps=5
        )

        segments = [
            {"type": "warmup", "duration_min": 15},
            {"type": "interval", "sets": 2, "work": {"power_high_pct": 95}},
            {"type": "cooldown", "duration_min": 10},
        ]

        workout = ParsedWorkout(
            metadata=metadata, segments=segments, base_duration_min=55, base_tss=85
        )

        library_format = workout.to_library_format()

        assert "id" in library_format
        assert library_format["name"] == "Threshold workout"
        assert library_format["type"] == "threshold"
        assert library_format["intensity"] == "hard"
        assert library_format["segments"] == segments
        assert library_format["base_duration_min"] == 55
        assert library_format["base_tss"] == 85
        assert "suitable_phases" in library_format
        assert "variable_components" in library_format

    def test_invalid_empty_segments_raises_error(self):
        """Test that empty segments raises ValueError."""
        metadata = FitWorkoutMetadata(name="Test", sport="cycling", num_steps=5)

        # Empty segments should be invalid, but we allow it for building
        # The validation will happen when converting to library format if needed
        # For now, test with at least validation at construction
        # Actually, looking at the spec, empty segments should error in __post_init__
        with pytest.raises(ValueError, match="Workout has no segments"):
            ParsedWorkout(
                metadata=metadata, segments=[], base_duration_min=55, base_tss=85
            )

    def test_invalid_duration_raises_error(self):
        """Test that invalid duration raises ValueError."""
        metadata = FitWorkoutMetadata(name="Test", sport="cycling", num_steps=5)
        segments = [{"type": "warmup", "duration_min": 15}]

        with pytest.raises(ValueError, match="Invalid duration"):
            ParsedWorkout(
                metadata=metadata, segments=segments, base_duration_min=0, base_tss=85
            )

    def test_invalid_tss_raises_error(self):
        """Test that invalid TSS raises ValueError."""
        metadata = FitWorkoutMetadata(name="Test", sport="cycling", num_steps=5)
        segments = [{"type": "warmup", "duration_min": 15}]

        with pytest.raises(ValueError, match="Invalid TSS"):
            ParsedWorkout(
                metadata=metadata, segments=segments, base_duration_min=55, base_tss=-10
            )


class TestFitWorkoutParser:
    """Test FitWorkoutParser class."""

    @pytest.fixture
    def parser(self):
        """Create parser instance."""
        from cycling_ai.parsers.fit_workout_parser import FitWorkoutParser

        return FitWorkoutParser()

    @pytest.fixture
    def sample_fit_dir(self):
        """Path to sample FIT files."""
        from pathlib import Path

        fit_dir = Path(".claude/fit_samples")
        if not fit_dir.exists():
            pytest.skip("FIT sample files not available at .claude/fit_samples")
        return fit_dir

    def test_init(self, parser):
        """Test parser initialization."""
        assert parser is not None

    def test_parse_workout_file_missing_file(self, parser):
        """Test error when file doesn't exist."""
        with pytest.raises(FileNotFoundError, match="FIT file not found"):
            parser.parse_workout_file("nonexistent.fit", ftp=260)

    def test_parse_workout_file_invalid_ftp_zero(self, parser, sample_fit_dir):
        """Test error when FTP is zero."""
        fit_path = sample_fit_dir / "2025-11-04_MinuteMons.fit"

        with pytest.raises(ValueError, match="Invalid FTP"):
            parser.parse_workout_file(fit_path, ftp=0)

    def test_parse_workout_file_invalid_ftp_negative(self, parser, sample_fit_dir):
        """Test error when FTP is negative."""
        fit_path = sample_fit_dir / "2025-11-04_MinuteMons.fit"

        with pytest.raises(ValueError, match="Invalid FTP"):
            parser.parse_workout_file(fit_path, ftp=-100)

    def test_extract_metadata_minute_monster(self, parser, sample_fit_dir):
        """Test metadata extraction from real FIT file."""
        import fitdecode

        fit_path = sample_fit_dir / "2025-11-04_MinuteMons.fit"
        fit_file = fitdecode.FitReader(str(fit_path))

        metadata = parser._extract_metadata(fit_file)

        assert metadata.name == "Minute Monster (Power)"
        assert metadata.sport == "cycling"
        assert metadata.num_steps == 14
        assert metadata.manufacturer == "peaksware"
        assert metadata.time_created is not None

    def test_extract_metadata_vo2max_booster(self, parser, sample_fit_dir):
        """Test metadata extraction from VO2 Max workout."""
        import fitdecode

        fit_path = sample_fit_dir / "2025-11-05_VO2MaxBoos.fit"
        fit_file = fitdecode.FitReader(str(fit_path))

        metadata = parser._extract_metadata(fit_file)

        assert "vo2" in metadata.name.lower()
        assert metadata.sport == "cycling"
        assert metadata.num_steps == 23

    def test_validate_workout_structure_valid(self, parser):
        """Test validation passes for valid workout."""
        metadata = FitWorkoutMetadata(
            name="Test Workout",
            sport="cycling",
            num_steps=5,
        )

        steps: list[FitWorkoutStep] = []

        # Should not raise
        parser._validate_workout_structure(metadata, steps)

    def test_extract_steps_minute_monster(self, parser, sample_fit_dir):
        """Test step extraction from Minute Monster workout."""
        import fitdecode

        fit_path = sample_fit_dir / "2025-11-04_MinuteMons.fit"
        fit_file = fitdecode.FitReader(str(fit_path))

        steps = parser._extract_steps(fit_file)

        # Based on manual analysis, Minute Monster has 14 steps
        assert len(steps) == 14

        # Check first step (warmup)
        assert steps[0].message_index == 0
        assert steps[0].intensity == FitIntensity.WARMUP
        assert steps[0].duration_type == FitDurationType.TIME
        assert steps[0].duration_value > 0

        # Check for repeat steps
        repeat_steps = [s for s in steps if s.is_repeat_step()]
        assert len(repeat_steps) > 0

    def test_extract_steps_with_power_zones(self, parser, sample_fit_dir):
        """Test extraction of steps with power zone targets."""
        import fitdecode

        # Use a workout file that has power zone targets
        fit_path = sample_fit_dir / "2025-11-04_MinuteMons.fit"
        fit_file = fitdecode.FitReader(str(fit_path))

        steps = parser._extract_steps(fit_file)

        # At least some steps should have custom power ranges
        steps_with_power = [
            s for s in steps if s.has_custom_power() or s.has_power_zone()
        ]
        assert len(steps_with_power) > 0

    def test_extract_steps_sorted_by_index(self, parser, sample_fit_dir):
        """Test that extracted steps are sorted by message_index."""
        import fitdecode

        fit_path = sample_fit_dir / "2025-11-04_MinuteMons.fit"
        fit_file = fitdecode.FitReader(str(fit_path))

        steps = parser._extract_steps(fit_file)

        # Check steps are sorted
        for i in range(len(steps) - 1):
            assert steps[i].message_index <= steps[i + 1].message_index

    def test_convert_step_to_segment_warmup(self, parser):
        """Test converting warmup step to segment."""
        ftp = 260

        step = FitWorkoutStep(
            message_index=0,
            intensity=FitIntensity.WARMUP,
            duration_type=FitDurationType.TIME,
            duration_value=900,  # 15 minutes
            target_type=FitTargetType.POWER,
            custom_power_low=130,  # 50% FTP
            custom_power_high=169,  # 65% FTP
            step_name="Warm up",
        )

        segment = parser._convert_step_to_segment(step, ftp)

        assert segment is not None
        assert segment["type"] == "warmup"
        assert segment["duration_min"] == 15
        assert segment["power_low_pct"] == 50
        assert segment["power_high_pct"] == 65
        assert segment["description"] == "Warm up"

    def test_convert_step_to_segment_cooldown(self, parser):
        """Test converting cooldown step to segment."""
        ftp = 260

        step = FitWorkoutStep(
            message_index=10,
            intensity=FitIntensity.COOLDOWN,
            duration_type=FitDurationType.TIME,
            duration_value=600,  # 10 minutes
            target_type=FitTargetType.POWER,
            custom_power_low=104,  # 40% FTP
            custom_power_high=130,  # 50% FTP
            step_name="Cool Down",
        )

        segment = parser._convert_step_to_segment(step, ftp)

        assert segment is not None
        assert segment["type"] == "cooldown"
        assert segment["duration_min"] == 10
        assert segment["power_low_pct"] == 40
        assert segment["power_high_pct"] == 50

    def test_convert_step_to_segment_skip_repeat(self, parser):
        """Test that repeat steps are skipped."""
        ftp = 260

        step = FitWorkoutStep(
            message_index=3,
            intensity=None,
            duration_type=FitDurationType.REPEAT_UNTIL_STEPS_COMPLETE,
            duration_value=5,
            target_type=FitTargetType.OPEN,
            repeat_steps=5,
        )

        segment = parser._convert_step_to_segment(step, ftp)
        assert segment is None

    def test_convert_step_to_segment_skip_open(self, parser):
        """Test that OPEN duration steps are skipped."""
        ftp = 260

        step = FitWorkoutStep(
            message_index=13,
            intensity=FitIntensity.COOLDOWN,
            duration_type=FitDurationType.OPEN,
            duration_value=0,
            target_type=FitTargetType.OPEN,
        )

        segment = parser._convert_step_to_segment(step, ftp)
        assert segment is None

    def test_get_power_pct_custom_range(self, parser):
        """Test power percentage from custom range."""
        ftp = 250

        step = FitWorkoutStep(
            message_index=0,
            intensity=FitIntensity.ACTIVE,
            duration_type=FitDurationType.TIME,
            duration_value=600,
            target_type=FitTargetType.POWER,
            custom_power_low=225,  # 90% FTP
            custom_power_high=250,  # 100% FTP
        )

        assert parser._get_power_pct(step, ftp, is_low=True) == 90
        assert parser._get_power_pct(step, ftp, is_low=False) == 100

    def test_get_power_pct_zone(self, parser):
        """Test power percentage from zone."""
        ftp = 260

        step = FitWorkoutStep(
            message_index=0,
            intensity=FitIntensity.ACTIVE,
            duration_type=FitDurationType.TIME,
            duration_value=600,
            target_type=FitTargetType.POWER,
            target_power_zone=4,  # Threshold zone
        )

        assert parser._get_power_pct(step, ftp, is_low=True) == 91
        assert parser._get_power_pct(step, ftp, is_low=False) == 105

    def test_zone_to_percentage(self, parser):
        """Test power zone to percentage conversion."""
        # Zone 2 (Endurance): 56-75%
        assert parser._zone_to_percentage(2, is_low=True) == 56
        assert parser._zone_to_percentage(2, is_low=False) == 75

        # Zone 4 (Threshold): 91-105%
        assert parser._zone_to_percentage(4, is_low=True) == 91
        assert parser._zone_to_percentage(4, is_low=False) == 105

        # Zone 5 (VO2 Max): 106-120%
        assert parser._zone_to_percentage(5, is_low=True) == 106
        assert parser._zone_to_percentage(5, is_low=False) == 120

        # Invalid zone defaults to Z2
        assert parser._zone_to_percentage(99, is_low=True) == 75

    def test_parse_complete_workout_minute_monster(self, parser, sample_fit_dir):
        """Test complete parsing of Minute Monster workout."""
        fit_path = sample_fit_dir / "2025-11-04_MinuteMons.fit"
        ftp = 1200

        workout = parser.parse_workout_file(fit_path, ftp)

        # Check metadata
        assert workout.metadata.name == "Minute Monster (Power)"
        assert workout.metadata.sport == "cycling"

        # Check we have segments
        assert len(workout.segments) > 0

        # Check has warmup
        assert any(s["type"] == "warmup" for s in workout.segments)

        # Check has intervals
        interval_segs = [s for s in workout.segments if s["type"] == "interval"]
        assert len(interval_segs) > 0

        # Check has cooldown
        assert any(s["type"] == "cooldown" for s in workout.segments)

        # Check duration
        assert workout.base_duration_min > 0

        # Check TSS
        assert workout.base_tss > 0

        # Check library format conversion
        library_format = workout.to_library_format()
        assert "id" in library_format
        assert library_format["name"] == "Minute Monster (Power)"
        assert "segments" in library_format
        assert "base_tss" in library_format

    def test_parse_complete_workout_vo2max_booster(self, parser, sample_fit_dir):
        """Test complete parsing of VO2 Max Booster workout."""
        fit_path = sample_fit_dir / "2025-11-05_VO2MaxBoos.fit"
        ftp = 1200

        workout = parser.parse_workout_file(fit_path, ftp)

        assert "vo2" in workout.metadata.name.lower()
        assert workout.metadata.num_steps == 23

        # Should have multiple interval sets
        interval_segments = [s for s in workout.segments if s["type"] == "interval"]
        assert len(interval_segments) > 0

        # Verify library format
        library_format = workout.to_library_format()
        assert library_format["type"] in ["vo2max", "threshold", "sweetspot"]
        assert library_format["intensity"] in ["hard", "easy"]

    def test_parse_all_sample_files(self, parser, sample_fit_dir):
        """Test parsing all sample FIT files."""
        import glob

        fit_files = glob.glob(str(sample_fit_dir / "*.fit"))
        assert len(fit_files) >= 4

        ftp = 1200

        for fit_file in fit_files:
            # Each file should parse successfully
            workout = parser.parse_workout_file(fit_file, ftp)

            # Basic validations
            assert workout.metadata.name
            assert workout.metadata.num_steps > 0
            assert len(workout.segments) > 0
            assert workout.base_duration_min > 0
            assert workout.base_tss > 0

            # Library format should be valid
            library_format = workout.to_library_format()
            assert "id" in library_format
            assert "name" in library_format
            assert "segments" in library_format
