"""Tests for TrainingPlanTool."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from cycling_ai.tools.wrappers.training_plan_tool import TrainingPlanTool


class TestTrainingPlanTool:
    """Test suite for TrainingPlanTool."""

    def test_definition_structure(self) -> None:
        """Test that tool definition has correct structure."""
        tool = TrainingPlanTool()
        definition = tool.definition

        assert definition.name == "generate_training_plan"
        assert definition.category == "analysis"
        assert definition.version == "1.0.0"
        assert len(definition.parameters) == 3

        # Verify required parameters
        required_params = definition.get_required_parameters()
        assert len(required_params) == 1
        assert required_params[0].name == "athlete_profile_json"

        # Verify optional parameters
        optional_params = definition.get_optional_parameters()
        assert len(optional_params) == 2
        optional_names = {p.name for p in optional_params}
        assert optional_names == {"total_weeks", "target_ftp"}

        # Check defaults
        weeks_param = next(p for p in optional_params if p.name == "total_weeks")
        assert weeks_param.default == 12
        assert weeks_param.min_value == 4
        assert weeks_param.max_value == 24

    def test_execute_success(self, sample_profile: Path) -> None:
        """Test successful execution with valid inputs."""
        tool = TrainingPlanTool()

        result = tool.execute(
            athlete_profile_json=str(sample_profile),
            total_weeks=12,
        )

        assert result.success is True
        assert result.format == "json"
        assert isinstance(result.data, dict)

        # Verify expected data structure
        assert "current_ftp" in result.data
        assert "target_ftp" in result.data
        assert "weekly_workouts" in result.data or "plan_text" in result.data

        # Verify metadata
        assert "athlete" in result.metadata
        assert "current_ftp" in result.metadata
        assert result.metadata["total_weeks"] == 12

    def test_execute_with_target_ftp(self, sample_profile: Path) -> None:
        """Test execution with custom target FTP."""
        tool = TrainingPlanTool()

        result = tool.execute(
            athlete_profile_json=str(sample_profile),
            total_weeks=12,
            target_ftp=270.0,
        )

        assert result.success is True
        assert result.data["target_ftp"] == 270.0

    def test_execute_missing_profile(self) -> None:
        """Test execution with non-existent profile file."""
        tool = TrainingPlanTool()

        result = tool.execute(
            athlete_profile_json="/nonexistent/profile.json",
        )

        assert result.success is False
        assert len(result.errors) > 0
        assert "profile" in result.errors[0].lower()

    def test_execute_missing_required_parameter(self) -> None:
        """Test validation catches missing required parameters."""
        tool = TrainingPlanTool()

        with pytest.raises(ValueError, match="Missing required parameters"):
            tool.validate_parameters(total_weeks=12)

    def test_execute_invalid_weeks(self, sample_profile: Path) -> None:
        """Test validation of total_weeks range."""
        tool = TrainingPlanTool()

        # Test with total_weeks = 3 (below minimum)
        with pytest.raises(ValueError, match="total_weeks"):
            tool.validate_parameters(
                athlete_profile_json=str(sample_profile),
                total_weeks=3,
            )

        # Test with total_weeks = 25 (above maximum)
        with pytest.raises(ValueError, match="total_weeks"):
            tool.validate_parameters(
                athlete_profile_json=str(sample_profile),
                total_weeks=25,
            )

    def test_execute_min_weeks(self, sample_profile: Path) -> None:
        """Test execution with minimum weeks."""
        tool = TrainingPlanTool()

        result = tool.execute(
            athlete_profile_json=str(sample_profile),
            total_weeks=4,
        )

        assert result.success is True
        assert result.metadata["total_weeks"] == 4

    def test_execute_max_weeks(self, sample_profile: Path) -> None:
        """Test execution with maximum weeks."""
        tool = TrainingPlanTool()

        result = tool.execute(
            athlete_profile_json=str(sample_profile),
            total_weeks=24,
        )

        assert result.success is True
        assert result.metadata["total_weeks"] == 24
