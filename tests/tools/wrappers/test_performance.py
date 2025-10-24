"""Tests for PerformanceAnalysisTool."""
from __future__ import annotations

from pathlib import Path

import pytest

from cycling_ai.tools.wrappers.performance import PerformanceAnalysisTool


class TestPerformanceAnalysisTool:
    """Test suite for PerformanceAnalysisTool."""

    def test_definition_structure(self) -> None:
        """Test that tool definition has correct structure."""
        tool = PerformanceAnalysisTool()
        definition = tool.definition

        assert definition.name == "analyze_performance"
        assert definition.category == "analysis"
        assert definition.version == "1.0.0"
        assert len(definition.parameters) == 3

        # Verify required parameters
        required_params = definition.get_required_parameters()
        assert len(required_params) == 2
        param_names = {p.name for p in required_params}
        assert param_names == {"csv_file_path", "athlete_profile_json"}

        # Verify optional parameters
        optional_params = definition.get_optional_parameters()
        assert len(optional_params) == 1
        assert optional_params[0].name == "period_months"
        assert optional_params[0].default == 6

    def test_execute_success(self, sample_csv: Path, sample_profile: Path) -> None:
        """Test successful execution with valid inputs."""
        tool = PerformanceAnalysisTool()

        result = tool.execute(
            csv_file_path=str(sample_csv),
            athlete_profile_json=str(sample_profile),
            period_months=6,
        )

        assert result.success is True
        assert result.format == "json"
        assert isinstance(result.data, dict)

        # Verify expected data structure
        assert "athlete_profile" in result.data
        assert "recent_period" in result.data
        assert "previous_period" in result.data

        # Verify metadata
        assert "athlete" in result.metadata
        assert result.metadata["period_months"] == 6

    def test_execute_missing_csv(self, sample_profile: Path) -> None:
        """Test execution with non-existent CSV file."""
        tool = PerformanceAnalysisTool()

        result = tool.execute(
            csv_file_path="/nonexistent/activities.csv",
            athlete_profile_json=str(sample_profile),
        )

        assert result.success is False
        assert len(result.errors) > 0
        assert "not found" in result.errors[0].lower()

    def test_execute_missing_profile(self, sample_csv: Path) -> None:
        """Test execution with non-existent profile file."""
        tool = PerformanceAnalysisTool()

        result = tool.execute(
            csv_file_path=str(sample_csv),
            athlete_profile_json="/nonexistent/profile.json",
        )

        assert result.success is False
        assert len(result.errors) > 0
        assert "profile" in result.errors[0].lower()

    def test_execute_missing_required_parameter(self, sample_csv: Path) -> None:
        """Test validation catches missing required parameters."""
        tool = PerformanceAnalysisTool()

        with pytest.raises(ValueError, match="Missing required parameters"):
            tool.validate_parameters(csv_file_path=str(sample_csv))

    def test_execute_directory_instead_of_file(
        self, sample_profile: Path, tmp_path: Path
    ) -> None:
        """Test execution with directory path instead of file."""
        tool = PerformanceAnalysisTool()

        result = tool.execute(
            csv_file_path=str(tmp_path),  # directory, not file
            athlete_profile_json=str(sample_profile),
        )

        assert result.success is False
        assert len(result.errors) > 0
        assert "not a file" in result.errors[0].lower()
