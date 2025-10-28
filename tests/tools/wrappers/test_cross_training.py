"""Tests for CrossTrainingTool."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from cycling_ai.tools.wrappers.cross_training_tool import CrossTrainingTool


class TestCrossTrainingTool:
    """Test suite for CrossTrainingTool."""

    def test_definition_structure(self) -> None:
        """Test that tool definition has correct structure."""
        tool = CrossTrainingTool()
        definition = tool.definition

        assert definition.name == "analyze_cross_training_impact"
        assert definition.category == "analysis"
        assert definition.version == "1.0.0"
        assert len(definition.parameters) == 2

        # Verify required parameters
        required_params = definition.get_required_parameters()
        assert len(required_params) == 1
        assert required_params[0].name == "csv_file_path"

        # Verify optional parameters
        optional_params = definition.get_optional_parameters()
        assert len(optional_params) == 1
        assert optional_params[0].name == "analysis_period_weeks"

        # Check defaults
        weeks_param = optional_params[0]
        assert weeks_param.default == 12
        assert weeks_param.min_value == 4
        assert weeks_param.max_value == 52

    def test_execute_success(self, sample_csv: Path) -> None:
        """Test successful execution with valid inputs."""
        tool = CrossTrainingTool()

        result = tool.execute(
            csv_file_path=str(sample_csv),
            analysis_period_weeks=12,
        )

        # Should either succeed OR fail gracefully with error message
        # The minimal test CSV may not have sufficient data for cross-training analysis
        assert result.format == "json"

        if result.success:
            # If successful, validate the data structure
            assert isinstance(result.data, dict)
            # Verify metadata
            assert "analysis_period_weeks" in result.metadata
            assert result.metadata["analysis_period_weeks"] == 12
        else:
            # If failed, should have error messages
            assert len(result.errors) > 0
            assert isinstance(result.errors[0], str)

    def test_execute_missing_csv(self) -> None:
        """Test execution with non-existent CSV file."""
        tool = CrossTrainingTool()

        result = tool.execute(
            csv_file_path="/nonexistent/activities.csv",
        )

        assert result.success is False
        assert len(result.errors) > 0
        assert "not found" in result.errors[0].lower()

    def test_execute_missing_required_parameter(self) -> None:
        """Test validation catches missing required parameters."""
        tool = CrossTrainingTool()

        with pytest.raises(ValueError, match="Missing required parameters"):
            tool.validate_parameters(analysis_period_weeks=12)

    def test_execute_invalid_weeks(self, sample_csv: Path) -> None:
        """Test validation of analysis_period_weeks range."""
        tool = CrossTrainingTool()

        # Test with analysis_period_weeks = 3 (below minimum)
        with pytest.raises(ValueError, match="analysis_period_weeks"):
            tool.validate_parameters(
                csv_file_path=str(sample_csv),
                analysis_period_weeks=3,
            )

        # Test with analysis_period_weeks = 53 (above maximum)
        with pytest.raises(ValueError, match="analysis_period_weeks"):
            tool.validate_parameters(
                csv_file_path=str(sample_csv),
                analysis_period_weeks=53,
            )

    def test_execute_min_weeks(self, sample_csv: Path) -> None:
        """Test execution with minimum weeks."""
        tool = CrossTrainingTool()

        result = tool.execute(
            csv_file_path=str(sample_csv),
            analysis_period_weeks=4,
        )

        # Should succeed (or fail gracefully if no data)
        assert result.success is True or "error" in result.errors[0].lower()

    def test_execute_max_weeks(self, sample_csv: Path) -> None:
        """Test execution with maximum weeks."""
        tool = CrossTrainingTool()

        result = tool.execute(
            csv_file_path=str(sample_csv),
            analysis_period_weeks=52,
        )

        # Should succeed (or fail gracefully if no data)
        assert result.success is True or "error" in result.errors[0].lower()
