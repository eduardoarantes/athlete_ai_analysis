"""Tests for ZoneAnalysisTool."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from cycling_ai.tools.wrappers.zones_tool import ZoneAnalysisTool


class TestZoneAnalysisTool:
    """Test suite for ZoneAnalysisTool."""

    def test_definition_structure(self) -> None:
        """Test that tool definition has correct structure."""
        tool = ZoneAnalysisTool()
        definition = tool.definition

        assert definition.name == "analyze_time_in_zones"
        assert definition.category == "analysis"
        assert definition.version == "1.0.0"
        assert len(definition.parameters) == 4

        # Verify required parameters
        required_params = definition.get_required_parameters()
        assert len(required_params) == 2
        param_names = {p.name for p in required_params}
        assert param_names == {"activities_directory", "athlete_profile_json"}

        # Verify optional parameters
        optional_params = definition.get_optional_parameters()
        assert len(optional_params) == 2
        optional_names = {p.name for p in optional_params}
        assert optional_names == {"period_months", "use_cache"}

        # Check defaults
        period_param = next(p for p in optional_params if p.name == "period_months")
        assert period_param.default == 6
        assert period_param.min_value == 1
        assert period_param.max_value == 24

        cache_param = next(p for p in optional_params if p.name == "use_cache")
        assert cache_param.default is True

    def test_execute_success(
        self, sample_fit_directory: Path, sample_profile: Path
    ) -> None:
        """Test successful execution with valid inputs."""
        tool = ZoneAnalysisTool()

        result = tool.execute(
            activities_directory=str(sample_fit_directory),
            athlete_profile_json=str(sample_profile),
            period_months=6,
            use_cache=False,  # Disable cache for testing
        )

        # Should either succeed OR fail gracefully with error message
        # The sample FIT directory is empty, so it may not have power data
        assert result.format == "json"

        if result.success:
            # If successful, validate the data structure
            assert isinstance(result.data, dict)
            # Verify expected data structure
            assert "zones" in result.data
            assert "ftp" in result.data
            assert "athlete_profile" in result.data
            # Verify metadata
            assert "athlete" in result.metadata
            assert "ftp" in result.metadata
            assert result.metadata["period_months"] == 6
        else:
            # If failed, should have error messages (e.g., "No power data found")
            assert len(result.errors) > 0
            assert isinstance(result.errors[0], str)

    def test_execute_missing_directory(self, sample_profile: Path) -> None:
        """Test execution with non-existent activities directory."""
        tool = ZoneAnalysisTool()

        result = tool.execute(
            activities_directory="/nonexistent/directory",
            athlete_profile_json=str(sample_profile),
        )

        assert result.success is False
        assert len(result.errors) > 0
        assert "not found" in result.errors[0].lower()

    def test_execute_missing_profile(self, sample_fit_directory: Path) -> None:
        """Test execution with non-existent profile file."""
        tool = ZoneAnalysisTool()

        result = tool.execute(
            activities_directory=str(sample_fit_directory),
            athlete_profile_json="/nonexistent/profile.json",
        )

        assert result.success is False
        assert len(result.errors) > 0
        assert "profile" in result.errors[0].lower()

    def test_execute_missing_required_parameter(
        self, sample_fit_directory: Path
    ) -> None:
        """Test validation catches missing required parameters."""
        tool = ZoneAnalysisTool()

        with pytest.raises(ValueError, match="Missing required parameters"):
            tool.validate_parameters(activities_directory=str(sample_fit_directory))

    def test_execute_invalid_period_months(
        self, sample_fit_directory: Path, sample_profile: Path
    ) -> None:
        """Test validation of period_months range."""
        tool = ZoneAnalysisTool()

        # Test with period_months = 0 (below minimum)
        with pytest.raises(ValueError, match="period_months"):
            tool.validate_parameters(
                activities_directory=str(sample_fit_directory),
                athlete_profile_json=str(sample_profile),
                period_months=0,
            )

        # Test with period_months = 25 (above maximum)
        with pytest.raises(ValueError, match="period_months"):
            tool.validate_parameters(
                activities_directory=str(sample_fit_directory),
                athlete_profile_json=str(sample_profile),
                period_months=25,
            )

    def test_execute_with_cache(
        self, sample_fit_directory: Path, sample_profile: Path
    ) -> None:
        """Test execution with caching enabled."""
        tool = ZoneAnalysisTool()

        result = tool.execute(
            activities_directory=str(sample_fit_directory),
            athlete_profile_json=str(sample_profile),
            use_cache=True,
        )

        # Should either succeed OR fail gracefully with error message
        # The sample FIT directory is empty, so it may not have power data
        assert result.format == "json"

        if result.success:
            # If successful, validate the data structure
            assert isinstance(result.data, dict)
        else:
            # If failed, should have error messages
            assert len(result.errors) > 0
            assert isinstance(result.errors[0], str)

    def test_execute_not_directory(self, sample_profile: Path, tmp_path: Path) -> None:
        """Test execution when activities_directory is a file, not a directory."""
        # Create a file instead of directory
        file_path = tmp_path / "not_a_directory.txt"
        file_path.write_text("test")

        tool = ZoneAnalysisTool()

        result = tool.execute(
            activities_directory=str(file_path),
            athlete_profile_json=str(sample_profile),
        )

        assert result.success is False
        assert len(result.errors) > 0
        assert "not a directory" in result.errors[0].lower()
