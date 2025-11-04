"""Tests for library-based training planning phase (Phase 3b alternative)."""

import json
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch

import pytest

from cycling_ai.core.workout_library.loader import WorkoutLibraryLoader
from cycling_ai.core.workout_library.models import Workout
from cycling_ai.orchestration.phases.training_planning_library import (
    LibraryBasedTrainingPlanningWeeks,
)
from cycling_ai.tools.base import ToolExecutionResult


@pytest.fixture
def mock_workout() -> Workout:
    """Create a mock workout for testing."""
    return Workout(
        id="test-workout-1",
        name="Test Endurance Ride",
        detailed_description="A test workout",
        type="endurance",
        intensity="easy",
        suitable_phases=["Base", "Build"],
        suitable_weekdays=["Monday", "Wednesday", "Friday"],
        segments=[
            {
                "type": "warmup",
                "duration_min": 10,
                "power_low_pct": 50,
                "power_high_pct": 60,
                "description": "Easy warmup",
            },
            {
                "type": "steady",
                "duration_min": 45,
                "power_low_pct": 65,
                "power_high_pct": 75,
                "description": "Steady endurance",
            },
            {
                "type": "cooldown",
                "duration_min": 10,
                "power_low_pct": 50,
                "power_high_pct": 60,
                "description": "Easy cooldown",
            },
        ],
        base_duration_min=65,
        base_tss=65,
        variable_components=None,
        source_file="test_workout.json",
        source_format="json",
    )


@pytest.fixture
def weekly_overview_data() -> dict:
    """Create sample weekly overview data from Phase 3a."""
    return {
        "weekly_overview": [
            {
                "week": 1,
                "phase": "Base",
                "training_days": [
                    {"weekday": "Monday", "type": "endurance", "target_tss": 65},
                    {"weekday": "Wednesday", "type": "sweet_spot", "target_tss": 85},
                    {"weekday": "Friday", "type": "endurance", "target_tss": 70},
                    {"weekday": "Saturday", "type": "endurance", "target_tss": 90},
                ],
            },
            {
                "week": 2,
                "phase": "Base",
                "training_days": [
                    {"weekday": "Monday", "type": "endurance", "target_tss": 70},
                    {"weekday": "Wednesday", "type": "sweet_spot", "target_tss": 90},
                    {"weekday": "Friday", "type": "endurance", "target_tss": 75},
                    {"weekday": "Saturday", "type": "endurance", "target_tss": 95},
                ],
            },
        ]
    }


@pytest.fixture
def temp_overview_file(tmp_path: Path, weekly_overview_data: dict) -> Path:
    """Create temporary overview file."""
    plan_id = "test-plan-123"
    overview_path = tmp_path / f"{plan_id}_overview.json"

    with open(overview_path, "w") as f:
        json.dump(weekly_overview_data, f)

    return overview_path


class TestLibraryBasedTrainingPlanningWeeks:
    """Test library-based training planning phase."""

    def test_load_weekly_overview_success(
        self, tmp_path: Path, weekly_overview_data: dict
    ) -> None:
        """Test loading weekly_overview from Phase 3a output."""
        plan_id = "test-plan-123"
        overview_path = tmp_path / f"{plan_id}_overview.json"

        with open(overview_path, "w") as f:
            json.dump(weekly_overview_data, f)

        phase = LibraryBasedTrainingPlanningWeeks()

        # Patch the module's Path to return tmp_path when constructing /tmp path
        with patch(
            "cycling_ai.orchestration.phases.training_planning_library.Path"
        ) as mock_path_class:
            mock_path_class.return_value = tmp_path
            overview = phase._load_weekly_overview(plan_id)

        assert len(overview) == 2
        assert overview[0]["week"] == 1
        assert overview[0]["phase"] == "Base"
        assert len(overview[0]["training_days"]) == 4

    def test_load_weekly_overview_missing_file(self, tmp_path: Path) -> None:
        """Test error when overview file is missing."""
        phase = LibraryBasedTrainingPlanningWeeks()

        with patch(
            "cycling_ai.orchestration.phases.training_planning_library.Path"
        ) as mock_path_class:
            mock_path_class.return_value = tmp_path

            with pytest.raises(FileNotFoundError, match="Phase 3a overview not found"):
                phase._load_weekly_overview("nonexistent-plan")

    def test_load_weekly_overview_invalid_format(self, tmp_path: Path) -> None:
        """Test error when overview file has invalid format."""
        plan_id = "test-plan-123"
        overview_path = tmp_path / f"{plan_id}_overview.json"

        # Write invalid data (missing weekly_overview key)
        with open(overview_path, "w") as f:
            json.dump({"wrong_key": []}, f)

        phase = LibraryBasedTrainingPlanningWeeks()

        with patch(
            "cycling_ai.orchestration.phases.training_planning_library.Path"
        ) as mock_path_class:
            mock_path_class.return_value = tmp_path

            with pytest.raises(ValueError, match="missing 'weekly_overview' key"):
                phase._load_weekly_overview(plan_id)

    @patch("cycling_ai.orchestration.phases.training_planning_library.WorkoutSelector")
    @patch("cycling_ai.orchestration.phases.training_planning_library.AddWeekDetailsTool")
    def test_execute_single_week(
        self,
        mock_tool_class: Mock,
        mock_selector_class: Mock,
        tmp_path: Path,
        weekly_overview_data: dict,
        mock_workout: Workout,
    ) -> None:
        """Test executing library-based selection for a single week."""
        plan_id = "test-plan-123"

        # Setup overview file
        overview_path = tmp_path / f"{plan_id}_overview.json"
        with open(overview_path, "w") as f:
            json.dump(weekly_overview_data, f)

        # Mock selector to return workout
        mock_selector = Mock()
        mock_selector.select_workout.return_value = mock_workout
        mock_selector_class.return_value = mock_selector

        # Mock tool to return success
        mock_tool = Mock()
        mock_tool.execute.return_value = ToolExecutionResult(
            success=True,
            data=json.dumps({"week_number": 1}),
            format="json",
        )
        mock_tool_class.return_value = mock_tool

        phase = LibraryBasedTrainingPlanningWeeks()

        with patch(
            "cycling_ai.orchestration.phases.training_planning_library.Path"
        ) as mock_path_class:
            mock_path_class.return_value = tmp_path
            result = phase.execute(plan_id)

        assert result["success"] is True
        assert result["weeks_added"] == 2  # 2 weeks in overview

        # Verify selector was called correct number of times (4 + 4 = 8 training days)
        assert mock_selector.select_workout.call_count == 8

        # Verify tool was called twice (once per week)
        assert mock_tool.execute.call_count == 2

    @patch("cycling_ai.orchestration.phases.training_planning_library.WorkoutSelector")
    def test_workout_selection_with_variety_tracking(
        self,
        mock_selector_class: Mock,
        tmp_path: Path,
        weekly_overview_data: dict,
        mock_workout: Workout,
    ) -> None:
        """Test that variety tracker is used during workout selection."""
        plan_id = "test-plan-123"

        # Setup overview file (single week)
        overview_data = {"weekly_overview": [weekly_overview_data["weekly_overview"][0]]}
        overview_path = tmp_path / f"{plan_id}_overview.json"
        with open(overview_path, "w") as f:
            json.dump(overview_data, f)

        # Mock selector
        mock_selector = Mock()
        mock_selector.select_workout.return_value = mock_workout
        mock_selector.variety_tracker = Mock()
        mock_selector_class.return_value = mock_selector

        # Mock tool
        with patch(
            "cycling_ai.orchestration.phases.training_planning_library.AddWeekDetailsTool"
        ) as mock_tool_class:
            mock_tool = Mock()
            mock_tool.execute.return_value = ToolExecutionResult(
                success=True, data=json.dumps({"week_number": 1}), format="json"
            )
            mock_tool_class.return_value = mock_tool

            phase = LibraryBasedTrainingPlanningWeeks()

            with patch("cycling_ai.orchestration.phases.training_planning_library.Path") as mock_path_class:
                mock_path_class.return_value = tmp_path
                phase.execute(plan_id)

        # Verify variety tracker was called for each workout
        assert mock_selector.variety_tracker.add_workout.call_count == 4

    @patch("cycling_ai.orchestration.phases.training_planning_library.WorkoutSelector")
    @patch("cycling_ai.orchestration.phases.training_planning_library.AddWeekDetailsTool")
    def test_tool_execution_failure(
        self,
        mock_tool_class: Mock,
        mock_selector_class: Mock,
        tmp_path: Path,
        weekly_overview_data: dict,
        mock_workout: Workout,
    ) -> None:
        """Test error handling when tool execution fails."""
        plan_id = "test-plan-123"

        # Setup overview file
        overview_path = tmp_path / f"{plan_id}_overview.json"
        with open(overview_path, "w") as f:
            json.dump(weekly_overview_data, f)

        # Mock selector
        mock_selector = Mock()
        mock_selector.select_workout.return_value = mock_workout
        mock_selector_class.return_value = mock_selector

        # Mock tool to return failure
        mock_tool = Mock()
        mock_tool.execute.return_value = ToolExecutionResult(
            success=False,
            data="",
            format="json",
            errors=["Validation failed: Time budget exceeded"],
        )
        mock_tool_class.return_value = mock_tool

        phase = LibraryBasedTrainingPlanningWeeks()

        with patch("cycling_ai.orchestration.phases.training_planning_library.Path") as mock_path_class:
            mock_path_class.return_value = tmp_path

            with pytest.raises(RuntimeError, match="Failed to add week 1"):
                phase.execute(plan_id)

    @patch("cycling_ai.orchestration.phases.training_planning_library.WorkoutSelector")
    def test_no_matching_workouts(
        self,
        mock_selector_class: Mock,
        tmp_path: Path,
        weekly_overview_data: dict,
    ) -> None:
        """Test handling when selector returns None (no matching workouts)."""
        plan_id = "test-plan-123"

        # Setup overview file
        overview_path = tmp_path / f"{plan_id}_overview.json"
        with open(overview_path, "w") as f:
            json.dump(weekly_overview_data, f)

        # Mock selector to return None
        mock_selector = Mock()
        mock_selector.select_workout.return_value = None
        mock_selector_class.return_value = mock_selector

        phase = LibraryBasedTrainingPlanningWeeks()

        with patch("cycling_ai.orchestration.phases.training_planning_library.Path") as mock_path_class:
            mock_path_class.return_value = tmp_path

            with pytest.raises(RuntimeError, match="No matching workout found"):
                phase.execute(plan_id)

    @patch("cycling_ai.orchestration.phases.training_planning_library.WorkoutSelector")
    @patch("cycling_ai.orchestration.phases.training_planning_library.AddWeekDetailsTool")
    def test_execute_preserves_workout_order(
        self,
        mock_tool_class: Mock,
        mock_selector_class: Mock,
        tmp_path: Path,
        weekly_overview_data: dict,
        mock_workout: Workout,
    ) -> None:
        """Test that workouts are added in correct order (weekday order)."""
        plan_id = "test-plan-123"

        # Setup overview file (single week)
        overview_data = {"weekly_overview": [weekly_overview_data["weekly_overview"][0]]}
        overview_path = tmp_path / f"{plan_id}_overview.json"
        with open(overview_path, "w") as f:
            json.dump(overview_data, f)

        # Mock selector
        mock_selector = Mock()
        mock_selector.select_workout.return_value = mock_workout
        mock_selector_class.return_value = mock_selector

        # Mock tool
        mock_tool = Mock()
        mock_tool.execute.return_value = ToolExecutionResult(
            success=True, data=json.dumps({"week_number": 1}), format="json"
        )
        mock_tool_class.return_value = mock_tool

        phase = LibraryBasedTrainingPlanningWeeks()

        with patch("cycling_ai.orchestration.phases.training_planning_library.Path") as mock_path_class:
            mock_path_class.return_value = tmp_path
            phase.execute(plan_id)

        # Verify tool was called with workouts in order
        call_args = mock_tool.execute.call_args
        workouts = call_args.kwargs["workouts"]
        assert len(workouts) == 4

        # Workouts should match training_days order
        assert workouts[0]["weekday"] == "Monday"
        assert workouts[1]["weekday"] == "Wednesday"
        assert workouts[2]["weekday"] == "Friday"
        assert workouts[3]["weekday"] == "Saturday"

    def test_integration_with_real_workout_library(
        self, tmp_path: Path, weekly_overview_data: dict
    ) -> None:
        """Integration test with real WorkoutLibraryLoader."""
        plan_id = "test-plan-123"

        # Setup overview file (single week)
        overview_data = {"weekly_overview": [weekly_overview_data["weekly_overview"][0]]}
        overview_path = tmp_path / f"{plan_id}_overview.json"
        with open(overview_path, "w") as f:
            json.dump(overview_data, f)

        # Mock only the add_week_tool
        with patch(
            "cycling_ai.orchestration.phases.training_planning_library.AddWeekDetailsTool"
        ) as mock_tool_class:
            mock_tool = Mock()
            mock_tool.execute.return_value = ToolExecutionResult(
                success=True, data=json.dumps({"week_number": 1}), format="json"
            )
            mock_tool_class.return_value = mock_tool

            phase = LibraryBasedTrainingPlanningWeeks()

            with patch("cycling_ai.orchestration.phases.training_planning_library.Path") as mock_path_class:
                mock_path_class.return_value = tmp_path

                # This should use real WorkoutSelector and WorkoutLibraryLoader
                result = phase.execute(plan_id)

            assert result["success"] is True
            assert result["weeks_added"] == 1

            # Verify real workouts were selected
            call_args = mock_tool.execute.call_args
            workouts = call_args.kwargs["workouts"]
            assert len(workouts) == 4

            # Each workout should have required fields from real library
            for workout in workouts:
                assert "name" in workout
                assert "type" in workout
                assert "segments" in workout
                assert "base_tss" in workout
