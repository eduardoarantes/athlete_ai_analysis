"""Tests for JSON workout parser."""
import json
import tempfile
from pathlib import Path

import pytest

from cycling_ai.parsers.json_workout_parser import JsonWorkoutParser


@pytest.fixture
def parser():
    """Create parser instance."""
    return JsonWorkoutParser()


@pytest.fixture
def simple_workout_json():
    """Simple endurance workout JSON."""
    return {
        "title": "Aerobic Endurance Ride",
        "description": "Ride mainly in Z2 today. You should be able to maintain conversation at this intensity.",
        "userTags": "Cycling,CyclingRoad",
        "workout_structure": [
            {
                "length": {"unit": "repetition", "value": 1},
                "steps": [
                    {
                        "intensityClass": "active",
                        "length": {"unit": "second", "value": 3600},
                        "name": "Active",
                        "openDuration": False,
                        "targets": [{"maxValue": 75, "minValue": 56}],
                    }
                ],
                "type": "step",
            }
        ],
        "coachComments": None,
    }


@pytest.fixture
def interval_workout_json():
    """Interval workout with repetitions."""
    return {
        "title": "40/20s (5min)",
        "description": "Aim is to accumulate time in zone 5.",
        "userTags": "Cycling,CyclingVirtualActivity,Virtual",
        "workout_structure": [
            {
                "type": "step",
                "length": {"unit": "repetition", "value": 1},
                "steps": [
                    {
                        "type": "step",
                        "intensityClass": "warmUp",
                        "length": {"unit": "second", "value": 600},
                        "targets": [{"minValue": 50, "maxValue": 65}],
                        "name": "Warmup",
                    }
                ],
            },
            {
                "type": "repetition",
                "length": {"unit": "repetition", "value": 5},
                "steps": [
                    {
                        "type": "step",
                        "intensityClass": "active",
                        "length": {"unit": "second", "value": 40},
                        "targets": [{"minValue": 115, "maxValue": 130}],
                        "name": "40s hard",
                    },
                    {
                        "type": "step",
                        "intensityClass": "rest",
                        "length": {"unit": "second", "value": 20},
                        "targets": [{"minValue": 42.5}],
                        "name": "Rest",
                    },
                ],
            },
            {
                "type": "step",
                "length": {"unit": "repetition", "value": 1},
                "steps": [
                    {
                        "type": "step",
                        "intensityClass": "coolDown",
                        "length": {"unit": "second", "value": 300},
                        "targets": [{"minValue": 50, "maxValue": 60}],
                        "name": "Cool Down",
                    }
                ],
            },
        ],
        "coachComments": None,
    }


class TestJsonWorkoutParser:
    """Test JSON workout parser."""

    def test_parser_initialization(self, parser):
        """Test parser can be created."""
        assert parser is not None
        assert isinstance(parser, JsonWorkoutParser)

    def test_generate_id(self, parser):
        """Test ID generation from title."""
        assert parser._generate_id("VO2 Max Intervals") == "vo2_max_intervals"
        assert parser._generate_id("40/20s (5min)") == "4020s_5min"
        assert parser._generate_id("Above & Below Threshold") == "above_below_threshold"

    def test_infer_workout_type_vo2max(self, parser):
        """Test VO2max type inference."""
        workout_type = parser._infer_workout_type(
            "VO2 Max Booster", "This is a VO2max workout", "Cycling"
        )
        assert workout_type == "vo2max"

    def test_infer_workout_type_threshold(self, parser):
        """Test threshold type inference."""
        workout_type = parser._infer_workout_type(
            "FTP Test", "Test your threshold power", "Cycling"
        )
        assert workout_type == "threshold"

    def test_infer_workout_type_endurance(self, parser):
        """Test endurance type inference."""
        workout_type = parser._infer_workout_type(
            "Aerobic Endurance", "Easy Z2 ride", "Cycling"
        )
        assert workout_type == "endurance"

    def test_infer_intensity_hard(self, parser):
        """Test hard intensity inference."""
        assert parser._infer_intensity("vo2max", "") == "hard"
        assert parser._infer_intensity("threshold", "") == "hard"

    def test_infer_intensity_easy(self, parser):
        """Test easy intensity inference."""
        assert parser._infer_intensity("endurance", "") == "easy"
        assert parser._infer_intensity("recovery", "") == "easy"

    def test_parse_simple_workout(self, parser, simple_workout_json):
        """Test parsing simple workout."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            json.dump(simple_workout_json, f)
            temp_path = Path(f.name)

        try:
            result = parser.parse_workout_file(temp_path)

            # Check basic fields
            assert result["id"] == "aerobic_endurance_ride"
            assert result["name"] == "Aerobic Endurance Ride"
            assert result["type"] == "endurance"
            assert result["intensity"] == "easy"
            assert result["source_format"] == "json"

            # Check segments
            assert len(result["segments"]) == 1
            segment = result["segments"][0]
            assert segment["type"] == "steady"
            assert segment["duration_min"] == 60  # 3600 seconds = 60 minutes
            assert segment["power_low_pct"] == 56
            assert segment["power_high_pct"] == 75

            # Check duration and TSS
            assert result["base_duration_min"] == 60
            assert result["base_tss"] > 0

        finally:
            temp_path.unlink()

    def test_parse_interval_workout(self, parser, interval_workout_json):
        """Test parsing interval workout."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            json.dump(interval_workout_json, f)
            temp_path = Path(f.name)

        try:
            result = parser.parse_workout_file(temp_path)

            # Check basic fields
            assert result["id"] == "4020s_5min"
            assert result["name"] == "40/20s (5min)"
            assert result["type"] == "vo2max"  # Should infer from description
            assert result["intensity"] == "hard"

            # Check segments (warmup, interval, cooldown)
            assert len(result["segments"]) == 3

            # Warmup
            warmup = result["segments"][0]
            assert warmup["type"] == "warmup"
            assert warmup["duration_min"] == 10  # 600 seconds

            # Interval
            interval = result["segments"][1]
            assert interval["type"] == "interval"
            assert interval["sets"] == 5
            assert interval["work"]["duration_min"] == pytest.approx(0.67, rel=0.1)  # 40s
            assert interval["work"]["power_low_pct"] == 115
            assert interval["work"]["power_high_pct"] == 130
            assert interval["recovery"]["duration_min"] == pytest.approx(
                0.33, rel=0.1
            )  # 20s
            assert interval["recovery"]["power_low_pct"] == 42

            # Cooldown
            cooldown = result["segments"][2]
            assert cooldown["type"] == "cooldown"
            assert cooldown["duration_min"] == 5  # 300 seconds

            # Check variable components
            assert result["variable_components"] is not None
            assert result["variable_components"]["adjustable_field"] == "sets"

        finally:
            temp_path.unlink()

    def test_calculate_duration(self, parser):
        """Test duration calculation."""
        segments = [
            {"type": "warmup", "duration_min": 10},
            {
                "type": "interval",
                "sets": 5,
                "work": {"duration_min": 3},
                "recovery": {"duration_min": 3},
            },
            {"type": "cooldown", "duration_min": 10},
        ]

        duration = parser._calculate_duration(segments)
        assert duration == 50  # 10 + (3+3)*5 + 10 = 50

    def test_calculate_tss_simple(self, parser):
        """Test TSS calculation for simple workout."""
        segments = [
            {
                "type": "steady",
                "duration_min": 60,
                "power_low_pct": 65,
                "power_high_pct": 75,
            }
        ]

        tss = parser._calculate_tss(segments, 60)
        # Average power: 70% FTP
        # IF = 0.70
        # TSS = 1 hour * 0.70^2 * 100 = 49
        assert tss == pytest.approx(49, rel=0.1)

    def test_calculate_tss_intervals(self, parser):
        """Test TSS calculation for interval workout."""
        segments = [
            {
                "type": "interval",
                "sets": 5,
                "work": {
                    "duration_min": 3,
                    "power_low_pct": 110,
                    "power_high_pct": 120,
                },
                "recovery": {
                    "duration_min": 3,
                    "power_low_pct": 50,
                    "power_high_pct": 60,
                },
            }
        ]

        tss = parser._calculate_tss(segments, 30)
        # This should be higher TSS due to high intensity intervals
        assert tss > 30  # Higher than normalized power would suggest

    def test_infer_suitable_phases(self, parser):
        """Test suitable phase inference."""
        phases = parser._infer_suitable_phases("vo2max", "hard")
        assert "Build" in phases or "Peak" in phases

        phases = parser._infer_suitable_phases("endurance", "easy")
        assert "Foundation" in phases or "Base" in phases

        phases = parser._infer_suitable_phases("recovery", "easy")
        assert "Recovery" in phases

    def test_infer_suitable_weekdays(self, parser):
        """Test suitable weekday inference."""
        # Hard workouts: mid-week
        weekdays = parser._infer_suitable_weekdays("vo2max", "hard")
        assert "Tuesday" in weekdays or "Wednesday" in weekdays

        # Endurance: weekends
        weekdays = parser._infer_suitable_weekdays("endurance", "easy")
        assert "Saturday" in weekdays or "Sunday" in weekdays

    def test_parse_missing_file(self, parser):
        """Test parsing non-existent file."""
        with pytest.raises(FileNotFoundError):
            parser.parse_workout_file("/nonexistent/file.json")

    def test_parse_missing_title(self, parser):
        """Test parsing JSON without title."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            json.dump({"workout_structure": []}, f)
            temp_path = Path(f.name)

        try:
            with pytest.raises(ValueError, match="Missing 'title'"):
                parser.parse_workout_file(temp_path)
        finally:
            temp_path.unlink()

    def test_parse_missing_workout_structure(self, parser):
        """Test parsing JSON without workout_structure."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            json.dump({"title": "Test"}, f)
            temp_path = Path(f.name)

        try:
            with pytest.raises(ValueError, match="Missing 'workout_structure'"):
                parser.parse_workout_file(temp_path)
        finally:
            temp_path.unlink()

    def test_variable_components_intervals(self, parser):
        """Test variable components identification for intervals."""
        segments = [
            {
                "type": "interval",
                "sets": 5,
                "work": {
                    "duration_min": 3,
                    "power_low_pct": 110,
                    "power_high_pct": 120,
                },
                "recovery": {
                    "duration_min": 3,
                    "power_low_pct": 50,
                    "power_high_pct": 60,
                },
            }
        ]

        var_comp = parser._identify_variable_components(segments)
        assert var_comp is not None
        assert var_comp["adjustable_field"] == "sets"
        assert var_comp["min_value"] == 3  # 5 - 2
        assert var_comp["max_value"] == 8  # 5 + 3

    def test_variable_components_long_steady(self, parser):
        """Test variable components for long steady workout."""
        segments = [{"type": "steady", "duration_min": 60, "power_low_pct": 65, "power_high_pct": 75}]

        var_comp = parser._identify_variable_components(segments)
        assert var_comp is not None
        assert var_comp["adjustable_field"] == "duration"
        assert var_comp["min_value"] == 42  # 60 * 0.7
        assert var_comp["max_value"] == 78  # 60 * 1.3
