"""
Unit tests for finalize_plan_tool.py - Phase 3c training plan finalization.

Tests the complete workflow:
1. Load overview from temp file
2. Load all week details from temp files
3. Validate plan structure
4. Build properly formatted plan with plan_metadata
5. Save to output directory
6. Return correct format for Phase 4
"""
import json
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from cycling_ai.core import training
from cycling_ai.tools.wrappers.finalize_plan_tool import FinalizePlanTool


@pytest.fixture
def temp_dir():
    """Create temporary directory for test files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def mock_athlete_profile():
    """Mock athlete profile."""
    profile = MagicMock()
    profile.name = "Test Athlete"
    profile.ftp = 250
    profile.age = 35
    profile.gender = "M"
    profile.weight_kg = 70
    profile.max_hr = 180
    profile.training_availability = {"weekdays": 5, "weekend_hours": 10}
    profile.goals = ["Improve FTP"]
    profile.current_training_status = "Active"
    profile.get_training_days.return_value = ["Monday", "Tuesday", "Thursday", "Saturday", "Sunday"]
    profile.get_weekly_training_hours.return_value = 7.0
    return profile


@pytest.fixture
def overview_data():
    """Sample overview data from Phase 3a."""
    return {
        "plan_id": "test_plan_123",
        "athlete_profile_json": "/path/to/athlete_profile.json",
        "total_weeks": 2,
        "target_ftp": 265,
        "coaching_notes": "Focus on building aerobic base",
        "monitoring_guidance": "Track weekly TSS and recovery",
        "weekly_overview": [
            {
                "week_number": 1,
                "phase": "Foundation",
                "phase_rationale": "Build base",
                "weekly_focus": "Aerobic endurance",
                "weekly_watch_points": "Monitor fatigue",
                "target_tss": 350,
                "training_days": [
                    {"weekday": "Monday", "workout_type": "endurance"},
                    {"weekday": "Tuesday", "workout_type": "rest"},
                    {"weekday": "Wednesday", "workout_type": "endurance"},
                    {"weekday": "Thursday", "workout_type": "tempo"},
                    {"weekday": "Friday", "workout_type": "rest"},
                    {"weekday": "Saturday", "workout_type": "endurance"},
                    {"weekday": "Sunday", "workout_type": "endurance"},
                ],
                "total_hours": 6.5,
            },
            {
                "week_number": 2,
                "phase": "Foundation",
                "phase_rationale": "Continue base",
                "weekly_focus": "Aerobic endurance",
                "weekly_watch_points": "Monitor fatigue",
                "target_tss": 370,
                "training_days": [
                    {"weekday": "Monday", "workout_type": "endurance"},
                    {"weekday": "Tuesday", "workout_type": "rest"},
                    {"weekday": "Wednesday", "workout_type": "recovery"},
                    {"weekday": "Thursday", "workout_type": "tempo"},
                    {"weekday": "Friday", "workout_type": "rest"},
                    {"weekday": "Saturday", "workout_type": "endurance"},
                    {"weekday": "Sunday", "workout_type": "endurance"},
                ],
                "total_hours": 7.0,
            },
        ],
        "weeks_completed": 2,
    }


@pytest.fixture
def week_details():
    """Sample week details from Phase 3b."""
    return [
        {
            "workouts": [
                {
                    "weekday": "Monday",
                    "description": "Z2 endurance ride",
                    "segments": [
                        {
                            "type": "warmup",
                            "duration_min": 10,
                            "power_low_pct": 50,
                            "power_high_pct": 65,
                            "description": "Easy spin",
                        },
                        {
                            "type": "steady",
                            "duration_min": 50,
                            "power_low_pct": 56,
                            "power_high_pct": 75,
                            "description": "Z2 aerobic",
                        },
                    ],
                },
                {
                    "weekday": "Thursday",
                    "description": "Tempo intervals",
                    "segments": [
                        {
                            "type": "warmup",
                            "duration_min": 10,
                            "power_low_pct": 50,
                            "power_high_pct": 65,
                            "description": "Warm up",
                        },
                        {
                            "type": "interval",
                            "duration_min": 20,
                            "power_low_pct": 88,
                            "power_high_pct": 93,
                            "description": "Tempo effort",
                        },
                        {
                            "type": "cooldown",
                            "duration_min": 10,
                            "power_low_pct": 50,
                            "power_high_pct": 60,
                            "description": "Cool down",
                        },
                    ],
                },
            ]
        },
        {
            "workouts": [
                {
                    "weekday": "Tuesday",
                    "description": "Z2 ride",
                    "segments": [
                        {
                            "type": "steady",
                            "duration_min": 60,
                            "power_low_pct": 56,
                            "power_high_pct": 75,
                            "description": "Z2 steady",
                        }
                    ],
                }
            ]
        },
    ]


def create_temp_files(temp_dir: Path, plan_id: str, overview_data: dict, week_details: list):
    """Create temporary files for testing."""
    # Create overview file
    overview_file = temp_dir / f"{plan_id}_overview.json"
    with open(overview_file, "w") as f:
        json.dump(overview_data, f)

    # Create week files
    for week_num, week_data in enumerate(week_details, start=1):
        week_file = temp_dir / f"{plan_id}_week_{week_num}.json"
        with open(week_file, "w") as f:
            json.dump(week_data, f)

    return overview_file


class TestFinalizePlanTool:
    """Test suite for FinalizePlanTool."""

    def test_tool_definition(self):
        """Test tool definition is correct."""
        tool = FinalizePlanTool()

        assert tool.definition.name == "finalize_plan"
        assert "PHASE 3" in tool.definition.description
        assert tool.definition.category == "analysis"
        assert tool.definition.returns["type"] == "object"
        assert tool.definition.returns["format"] == "json"

        # Check parameters
        params = {p.name: p for p in tool.definition.parameters}
        assert "plan_id" in params
        assert params["plan_id"].required is True
        assert params["plan_id"].type == "string"

    @patch("cycling_ai.tools.wrappers.finalize_plan_tool.Path")
    @patch("cycling_ai.tools.wrappers.finalize_plan_tool.load_athlete_profile")
    @patch("cycling_ai.tools.wrappers.finalize_plan_tool.finalize_training_plan")
    def test_execute_success(
        self,
        mock_finalize_training_plan,
        mock_load_athlete_profile,
        mock_path_class,
        temp_dir,
        overview_data,
        week_details,
        mock_athlete_profile,
    ):
        """Test successful plan finalization."""
        # Setup mocks
        plan_id = "test_plan_123"

        # Mock Path to use temp_dir for /tmp and home directory
        def path_constructor(path_str):
            if path_str == "/tmp":
                return temp_dir
            return Path(path_str)

        mock_path_class.side_effect = path_constructor
        mock_path_class.home.return_value = temp_dir

        # Create temp files
        create_temp_files(temp_dir, plan_id, overview_data, week_details)

        # Mock athlete profile
        mock_load_athlete_profile.return_value = mock_athlete_profile

        # Mock finalize_training_plan to return properly formatted JSON
        expected_plan_data = {
            "athlete_profile": {
                "name": "Test Athlete",
                "ftp": 250.0,
                "age": 35,
                "gender": "M",
                "weight_kg": 70,
                "power_to_weight": 3.57,
                "max_hr": 180,
                "training_availability": {"weekdays": 5, "weekend_hours": 10},
                "goals": ["Improve FTP"],
                "current_training_status": "Active",
                "available_training_days": ["Monday", "Tuesday", "Thursday", "Saturday", "Sunday"],
                "weekly_training_hours": 7.0,
            },
            "plan_metadata": {
                "total_weeks": 2,
                "current_ftp": 250.0,
                "target_ftp": 265.0,
                "ftp_gain_watts": 15.0,
                "ftp_gain_percent": 6.0,
                "plan_type": "LLM-designed personalized plan",
            },
            "coaching_notes": "Focus on building aerobic base",
            "monitoring_guidance": "Track weekly TSS and recovery",
            "weekly_plan": [
                {
                    "week_number": 1,
                    "phase": "Foundation",
                    "phase_rationale": "Build base",
                    "weekly_focus": "Aerobic endurance",
                    "weekly_watch_points": "Monitor fatigue",
                    "target_tss": 350,
                    "training_days": [
                        {"weekday": "Monday", "workout_type": "endurance"},
                        {"weekday": "Tuesday", "workout_type": "rest"},
                        {"weekday": "Wednesday", "workout_type": "endurance"},
                        {"weekday": "Thursday", "workout_type": "tempo"},
                        {"weekday": "Friday", "workout_type": "rest"},
                        {"weekday": "Saturday", "workout_type": "endurance"},
                        {"weekday": "Sunday", "workout_type": "endurance"},
                    ],
                    "total_hours": 6.5,
                    "workouts": week_details[0]["workouts"],
                },
                {
                    "week_number": 2,
                    "phase": "Foundation",
                    "phase_rationale": "Continue base",
                    "weekly_focus": "Aerobic endurance",
                    "weekly_watch_points": "Monitor fatigue",
                    "target_tss": 370,
                    "training_days": [
                        {"weekday": "Monday", "workout_type": "endurance"},
                        {"weekday": "Tuesday", "workout_type": "rest"},
                        {"weekday": "Wednesday", "workout_type": "recovery"},
                        {"weekday": "Thursday", "workout_type": "tempo"},
                        {"weekday": "Friday", "workout_type": "rest"},
                        {"weekday": "Saturday", "workout_type": "endurance"},
                        {"weekday": "Sunday", "workout_type": "endurance"},
                    ],
                    "total_hours": 7.0,
                    "workouts": week_details[1]["workouts"],
                },
            ],
        }

        mock_finalize_training_plan.return_value = json.dumps(expected_plan_data)

        # Execute tool
        tool = FinalizePlanTool()
        result = tool.execute(plan_id=plan_id)

        # Assertions
        assert result.success is True
        assert result.format == "json"
        assert isinstance(result.data, dict)

        # Check data has correct structure
        assert "plan_metadata" in result.data
        assert "weekly_plan" in result.data
        assert "coaching_notes" in result.data
        assert "monitoring_guidance" in result.data
        assert "athlete_profile" in result.data

        # Check plan_metadata structure
        plan_metadata = result.data["plan_metadata"]
        assert plan_metadata["total_weeks"] == 2
        assert plan_metadata["current_ftp"] == 250.0
        assert plan_metadata["target_ftp"] == 265.0
        assert "ftp_gain_watts" in plan_metadata
        assert "ftp_gain_percent" in plan_metadata

        # Check weekly_plan has merged data
        weekly_plan = result.data["weekly_plan"]
        assert len(weekly_plan) == 2
        assert weekly_plan[0]["week_number"] == 1
        assert "workouts" in weekly_plan[0]
        assert len(weekly_plan[0]["workouts"]) == 2  # 2 workouts in week 1

        # Check metadata
        assert result.metadata["plan_id"] == plan_id
        assert result.metadata["total_weeks"] == 2
        assert "output_path" in result.metadata
        assert result.metadata["total_workouts"] == 3  # 2 + 1

        # Check file was saved
        output_dir = temp_dir / ".cycling-ai" / "training_plans"
        assert output_dir.exists()
        saved_files = list(output_dir.glob("*.json"))
        assert len(saved_files) == 1
        assert f"training_plan_Test_Athlete_{plan_id}.json" in saved_files[0].name

        # Verify temp files were cleaned up
        assert not (temp_dir / f"{plan_id}_overview.json").exists()
        assert not (temp_dir / f"{plan_id}_week_1.json").exists()
        assert not (temp_dir / f"{plan_id}_week_2.json").exists()

    def test_execute_missing_plan_id(self):
        """Test error when plan_id is missing."""
        tool = FinalizePlanTool()
        result = tool.execute()

        assert result.success is False
        assert result.data is None
        assert len(result.errors) > 0
        assert "plan_id is required" in result.errors[0]

    @patch("cycling_ai.tools.wrappers.finalize_plan_tool.Path")
    def test_execute_missing_overview_file(self, mock_path_class, temp_dir):
        """Test error when overview file doesn't exist."""
        def path_side_effect(path_str):
            if path_str == "/tmp":
                return temp_dir
            return Path(path_str)

        mock_path_class.side_effect = path_side_effect

        tool = FinalizePlanTool()
        result = tool.execute(plan_id="nonexistent_plan")

        assert result.success is False
        assert result.data is None
        assert len(result.errors) > 0
        assert "Plan overview not found" in result.errors[0]

    @patch("cycling_ai.tools.wrappers.finalize_plan_tool.load_athlete_profile")
    @patch("cycling_ai.tools.wrappers.finalize_plan_tool.Path")
    def test_execute_incomplete_weeks(
        self, mock_path_class, mock_load_athlete_profile, temp_dir, overview_data, week_details
    ):
        """Test error when not all weeks have been added."""
        def path_side_effect(path_str):
            if path_str == "/tmp":
                return temp_dir
            return Path(path_str)

        mock_path_class.side_effect = path_side_effect

        plan_id = "test_plan_123"

        # Create overview with 2 weeks required but only 1 week completed
        incomplete_overview = overview_data.copy()
        incomplete_overview["weeks_completed"] = 1

        # Create temp files - overview + only 1 week file
        overview_file = temp_dir / f"{plan_id}_overview.json"
        with open(overview_file, "w") as f:
            json.dump(incomplete_overview, f)

        week_file = temp_dir / f"{plan_id}_week_1.json"
        with open(week_file, "w") as f:
            json.dump(week_details[0], f)

        tool = FinalizePlanTool()
        result = tool.execute(plan_id=plan_id)

        assert result.success is False
        assert result.data is None
        assert len(result.errors) > 0
        assert "Incomplete plan" in result.errors[0]
        assert "1/2 weeks" in result.errors[0]

    @patch("cycling_ai.core.training.validate_training_plan")
    @patch("cycling_ai.tools.wrappers.finalize_plan_tool.load_athlete_profile")
    @patch("cycling_ai.tools.wrappers.finalize_plan_tool.Path")
    def test_execute_validation_failure(
        self,
        mock_path_class,
        mock_load_athlete_profile,
        mock_validate_training_plan,
        temp_dir,
        overview_data,
        week_details,
        mock_athlete_profile,
    ):
        """Test error when plan validation fails."""
        def path_constructor(path_str):
            if path_str == "/tmp":
                return temp_dir
            return Path(path_str)

        mock_path_class.side_effect = path_constructor
        mock_path_class.home.return_value = temp_dir

        plan_id = "test_plan_123"
        create_temp_files(temp_dir, plan_id, overview_data, week_details)

        mock_load_athlete_profile.return_value = mock_athlete_profile

        # Mock validation to fail
        mock_validate_training_plan.return_value = (
            False,
            ["Week 1: Missing workouts", "Week 2: Invalid duration"],
        )

        tool = FinalizePlanTool()
        result = tool.execute(plan_id=plan_id)

        assert result.success is False
        assert result.data is None
        assert len(result.errors) > 0
        assert "Plan validation failed" in result.errors[0]
        assert "Week 1: Missing workouts" in result.errors[0]

    @patch("cycling_ai.tools.wrappers.finalize_plan_tool.Path")
    @patch("cycling_ai.tools.wrappers.finalize_plan_tool.load_athlete_profile")
    @patch("cycling_ai.tools.wrappers.finalize_plan_tool.finalize_training_plan")
    def test_output_file_path_in_result(
        self,
        mock_finalize_training_plan,
        mock_load_athlete_profile,
        mock_path_class,
        temp_dir,
        overview_data,
        week_details,
        mock_athlete_profile,
    ):
        """Test that output_file_path is added to result data."""
        def path_constructor(path_str):
            if path_str == "/tmp":
                return temp_dir
            return Path(path_str)

        mock_path_class.side_effect = path_constructor
        mock_path_class.home.return_value = temp_dir

        plan_id = "test_plan_123"
        create_temp_files(temp_dir, plan_id, overview_data, week_details)

        mock_load_athlete_profile.return_value = mock_athlete_profile

        # Mock finalize to return minimal valid plan
        minimal_plan = {
            "athlete_profile": {"name": "Test"},
            "plan_metadata": {"total_weeks": 2},
            "coaching_notes": "",
            "monitoring_guidance": "",
            "weekly_plan": [],
        }
        mock_finalize_training_plan.return_value = json.dumps(minimal_plan)

        tool = FinalizePlanTool()
        result = tool.execute(plan_id=plan_id)

        assert result.success is True
        assert "output_file_path" in result.data
        assert "training_plan_Test_Athlete_test_plan_123.json" in result.data["output_file_path"]
