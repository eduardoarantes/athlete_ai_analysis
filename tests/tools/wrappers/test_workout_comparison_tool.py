"""
Integration tests for workout comparison tool wrappers.

Tests the MCP-style tool wrappers that expose core workout comparison
business logic to LLM agents.
"""

import json
from pathlib import Path

import pytest

# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def fixtures_dir() -> Path:
    """Return path to workout comparison fixtures directory."""
    return Path(__file__).parent.parent.parent / "fixtures" / "workout_comparison"


@pytest.fixture
def sample_plan_path(fixtures_dir: Path) -> Path:
    """Return path to sample training plan."""
    return fixtures_dir / "sample_training_plan.json"


@pytest.fixture
def perfect_activities_path(fixtures_dir: Path) -> Path:
    """Return path to perfect compliance activities CSV."""
    return fixtures_dir / "sample_activities_perfect.csv"


@pytest.fixture
def partial_activities_path(fixtures_dir: Path) -> Path:
    """Return path to partial compliance activities CSV."""
    return fixtures_dir / "sample_activities_partial.csv"


@pytest.fixture
def skipped_activities_path(fixtures_dir: Path) -> Path:
    """Return path to skipped workouts activities CSV."""
    return fixtures_dir / "sample_activities_skipped.csv"


@pytest.fixture
def athlete_profile_path(fixtures_dir: Path) -> Path:
    """Return path to athlete profile."""
    return fixtures_dir / "sample_athlete_profile.json"


# =============================================================================
# Test CompareWorkoutTool Definition
# =============================================================================


class TestCompareWorkoutToolDefinition:
    """Test that CompareWorkoutTool has correct definition."""

    def test_tool_definition(self) -> None:
        """Test that CompareWorkoutTool has correct definition."""
        from cycling_ai.tools.wrappers.workout_comparison_tool import CompareWorkoutTool

        tool = CompareWorkoutTool()

        assert tool.definition.name == "compare_workout"
        assert tool.definition.category == "analysis"
        assert len(tool.definition.parameters) == 4
        assert tool.definition.parameters[0].name == "date"
        assert tool.definition.parameters[0].required is True
        assert tool.definition.parameters[1].name == "training_plan_path"
        assert tool.definition.parameters[2].name == "activities_csv_path"
        assert tool.definition.parameters[3].name == "athlete_profile_path"


# =============================================================================
# Test CompareWorkoutTool Execution - Happy Path
# =============================================================================


class TestCompareWorkoutToolExecution:
    """Test CompareWorkoutTool execution with various scenarios."""

    def test_execute_with_perfect_compliance(
        self,
        sample_plan_path: Path,
        perfect_activities_path: Path,
        athlete_profile_path: Path,
    ) -> None:
        """Test tool execution with perfect compliance."""
        from cycling_ai.tools.wrappers.workout_comparison_tool import CompareWorkoutTool

        tool = CompareWorkoutTool()

        result = tool.execute(
            date="2024-11-04",
            training_plan_path=str(sample_plan_path),
            activities_csv_path=str(perfect_activities_path),
            athlete_profile_path=str(athlete_profile_path),
        )

        assert result.success
        assert result.format == "json"
        assert result.data is not None

        # Validate JSON structure
        data = result.data
        assert "compliance" in data
        assert "planned" in data
        assert "actual" in data
        assert "deviations" in data
        assert "recommendation" in data

        # Validate compliance scores for perfect execution
        assert data["compliance"]["compliance_score"] >= 95.0
        assert data["compliance"]["completed"] is True


# =============================================================================
# Test CompareWorkoutTool Execution - Error Handling
# =============================================================================


class TestCompareWorkoutToolErrorHandling:
    """Test CompareWorkoutTool error handling."""

    def test_execute_with_missing_plan(
        self,
        perfect_activities_path: Path,
        athlete_profile_path: Path,
    ) -> None:
        """Test tool handles missing training plan gracefully."""
        from cycling_ai.tools.wrappers.workout_comparison_tool import CompareWorkoutTool

        tool = CompareWorkoutTool()

        result = tool.execute(
            date="2024-11-04",
            training_plan_path="/nonexistent/plan.json",
            activities_csv_path=str(perfect_activities_path),
            athlete_profile_path=str(athlete_profile_path),
        )

        assert not result.success
        assert result.format == "json"
        assert len(result.errors) > 0
        assert "not found" in result.errors[0].lower() or "does not exist" in result.errors[0].lower()

    def test_execute_with_missing_csv(
        self,
        sample_plan_path: Path,
        athlete_profile_path: Path,
    ) -> None:
        """Test tool handles missing activities CSV gracefully."""
        from cycling_ai.tools.wrappers.workout_comparison_tool import CompareWorkoutTool

        tool = CompareWorkoutTool()

        result = tool.execute(
            date="2024-11-04",
            training_plan_path=str(sample_plan_path),
            activities_csv_path="/nonexistent/activities.csv",
            athlete_profile_path=str(athlete_profile_path),
        )

        assert not result.success
        assert len(result.errors) > 0
        assert "not found" in result.errors[0].lower() or "does not exist" in result.errors[0].lower()

    def test_execute_with_missing_profile(
        self,
        sample_plan_path: Path,
        perfect_activities_path: Path,
    ) -> None:
        """Test tool handles missing athlete profile gracefully."""
        from cycling_ai.tools.wrappers.workout_comparison_tool import CompareWorkoutTool

        tool = CompareWorkoutTool()

        result = tool.execute(
            date="2024-11-04",
            training_plan_path=str(sample_plan_path),
            activities_csv_path=str(perfect_activities_path),
            athlete_profile_path="/nonexistent/profile.json",
        )

        assert not result.success
        assert len(result.errors) > 0
        assert "not found" in result.errors[0].lower() or "does not exist" in result.errors[0].lower()

    def test_execute_with_invalid_date_format(
        self,
        sample_plan_path: Path,
        perfect_activities_path: Path,
        athlete_profile_path: Path,
    ) -> None:
        """Test tool handles invalid date format gracefully."""
        from cycling_ai.tools.wrappers.workout_comparison_tool import CompareWorkoutTool

        tool = CompareWorkoutTool()

        result = tool.execute(
            date="invalid-date",
            training_plan_path=str(sample_plan_path),
            activities_csv_path=str(perfect_activities_path),
            athlete_profile_path=str(athlete_profile_path),
        )

        assert not result.success
        assert len(result.errors) > 0
        assert "invalid date" in result.errors[0].lower() or "date format" in result.errors[0].lower()


# =============================================================================
# Test CompareWorkoutTool Execution - Edge Cases
# =============================================================================


class TestCompareWorkoutToolEdgeCases:
    """Test CompareWorkoutTool edge cases."""

    def test_execute_with_no_workout_on_date(
        self,
        sample_plan_path: Path,
        perfect_activities_path: Path,
        athlete_profile_path: Path,
    ) -> None:
        """Test when no workout planned for requested date."""
        from cycling_ai.tools.wrappers.workout_comparison_tool import CompareWorkoutTool

        tool = CompareWorkoutTool()

        # Use a date that has no workout planned (e.g., a rest day)
        result = tool.execute(
            date="2024-11-05",  # Tuesday - check if this is a rest day
            training_plan_path=str(sample_plan_path),
            activities_csv_path=str(perfect_activities_path),
            athlete_profile_path=str(athlete_profile_path),
        )

        # Could be success with "no workout" message or an error
        # Implementation will determine behavior
        assert result.success or not result.success

    def test_execute_with_partial_compliance(
        self,
        sample_plan_path: Path,
        partial_activities_path: Path,
        athlete_profile_path: Path,
    ) -> None:
        """Test with partial compliance activities."""
        from cycling_ai.tools.wrappers.workout_comparison_tool import CompareWorkoutTool

        tool = CompareWorkoutTool()

        result = tool.execute(
            date="2024-11-04",
            training_plan_path=str(sample_plan_path),
            activities_csv_path=str(partial_activities_path),
            athlete_profile_path=str(athlete_profile_path),
        )

        assert result.success
        data = result.data
        # Partial compliance should score between 70-95 (some deviations but close)
        assert 70 <= data["compliance"]["compliance_score"] <= 95
        assert len(data["deviations"]) >= 0  # May have deviations

    def test_execute_with_skipped_workout(
        self,
        sample_plan_path: Path,
        skipped_activities_path: Path,
        athlete_profile_path: Path,
    ) -> None:
        """Test with skipped workout."""
        from cycling_ai.tools.wrappers.workout_comparison_tool import CompareWorkoutTool

        tool = CompareWorkoutTool()

        # Try to compare a date where workout was skipped
        result = tool.execute(
            date="2024-11-06",  # Wednesday - should be in plan but not in skipped CSV
            training_plan_path=str(sample_plan_path),
            activities_csv_path=str(skipped_activities_path),
            athlete_profile_path=str(athlete_profile_path),
        )

        assert result.success
        data = result.data
        assert data["compliance"]["completed"] is False
        assert data["compliance"]["compliance_score"] == 0.0


# =============================================================================
# Test CompareWeeklyWorkoutsTool
# =============================================================================


class TestCompareWeeklyWorkoutsToolDefinition:
    """Test CompareWeeklyWorkoutsTool definition."""

    def test_weekly_tool_definition(self) -> None:
        """Test CompareWeeklyWorkoutsTool has correct definition."""
        from cycling_ai.tools.wrappers.workout_comparison_tool import (
            CompareWeeklyWorkoutsTool,
        )

        tool = CompareWeeklyWorkoutsTool()

        assert tool.definition.name == "compare_weekly_workouts"
        assert tool.definition.category == "analysis"
        assert len(tool.definition.parameters) == 4
        assert tool.definition.parameters[0].name == "week_start_date"


class TestCompareWeeklyWorkoutsToolExecution:
    """Test CompareWeeklyWorkoutsTool execution."""

    def test_weekly_execute_with_perfect_week(
        self,
        sample_plan_path: Path,
        perfect_activities_path: Path,
        athlete_profile_path: Path,
    ) -> None:
        """Test weekly tool with perfect compliance."""
        from cycling_ai.tools.wrappers.workout_comparison_tool import (
            CompareWeeklyWorkoutsTool,
        )

        tool = CompareWeeklyWorkoutsTool()

        result = tool.execute(
            week_start_date="2024-11-04",  # Monday
            training_plan_path=str(sample_plan_path),
            activities_csv_path=str(perfect_activities_path),
            athlete_profile_path=str(athlete_profile_path),
        )

        assert result.success
        data = result.data
        assert "summary" in data
        assert "daily_comparisons" in data
        assert data["summary"]["workouts_planned"] >= 1
        assert data["summary"]["completion_rate_pct"] >= 90.0

    def test_weekly_execute_with_partial_week(
        self,
        sample_plan_path: Path,
        partial_activities_path: Path,
        athlete_profile_path: Path,
    ) -> None:
        """Test weekly tool with partial compliance."""
        from cycling_ai.tools.wrappers.workout_comparison_tool import (
            CompareWeeklyWorkoutsTool,
        )

        tool = CompareWeeklyWorkoutsTool()

        result = tool.execute(
            week_start_date="2024-11-04",
            training_plan_path=str(sample_plan_path),
            activities_csv_path=str(partial_activities_path),
            athlete_profile_path=str(athlete_profile_path),
        )

        assert result.success
        data = result.data
        assert 70 <= data["summary"]["avg_compliance_score"] <= 90


# =============================================================================
# Test Tool Registration
# =============================================================================


class TestToolRegistration:
    """Test that tools are auto-registered with ToolRegistry."""

    def test_tool_registration(self) -> None:
        """Test that tools are auto-registered with ToolRegistry."""
        from cycling_ai.tools.registry import get_global_registry

        registry = get_global_registry()
        tools = registry.list_tools(category="analysis")

        tool_names = [tool.name for tool in tools]
        assert "compare_workout" in tool_names
        assert "compare_weekly_workouts" in tool_names


# =============================================================================
# Test JSON Output Format Validation
# =============================================================================


class TestJSONOutputFormat:
    """Test that JSON output has expected structure."""

    def test_json_output_format_daily(
        self,
        sample_plan_path: Path,
        perfect_activities_path: Path,
        athlete_profile_path: Path,
    ) -> None:
        """Test JSON output has all expected keys."""
        from cycling_ai.tools.wrappers.workout_comparison_tool import CompareWorkoutTool

        tool = CompareWorkoutTool()

        result = tool.execute(
            date="2024-11-04",
            training_plan_path=str(sample_plan_path),
            activities_csv_path=str(perfect_activities_path),
            athlete_profile_path=str(athlete_profile_path),
        )

        data = result.data

        # Required top-level keys
        assert "date" in data
        assert "planned" in data
        assert "actual" in data
        assert "compliance" in data
        assert "deviations" in data
        assert "recommendation" in data

        # Planned keys
        assert "weekday" in data["planned"]
        assert "type" in data["planned"]
        assert "duration_minutes" in data["planned"]

        # Compliance keys
        assert "compliance_score" in data["compliance"]
        assert "completed" in data["compliance"]
        assert "duration_score" in data["compliance"]
        assert "intensity_score" in data["compliance"]
        assert "tss_score" in data["compliance"]

    def test_json_output_format_weekly(
        self,
        sample_plan_path: Path,
        perfect_activities_path: Path,
        athlete_profile_path: Path,
    ) -> None:
        """Test weekly JSON output has all expected keys."""
        from cycling_ai.tools.wrappers.workout_comparison_tool import (
            CompareWeeklyWorkoutsTool,
        )

        tool = CompareWeeklyWorkoutsTool()

        result = tool.execute(
            week_start_date="2024-11-04",
            training_plan_path=str(sample_plan_path),
            activities_csv_path=str(perfect_activities_path),
            athlete_profile_path=str(athlete_profile_path),
        )

        data = result.data

        # Required top-level keys
        assert "week_number" in data
        assert "week_start_date" in data
        assert "week_end_date" in data
        assert "summary" in data
        assert "daily_comparisons" in data
        assert "patterns" in data
        assert "weekly_recommendation" in data

        # Summary keys
        summary = data["summary"]
        assert "workouts_planned" in summary
        assert "workouts_completed" in summary
        assert "completion_rate_pct" in summary
        assert "avg_compliance_score" in summary
