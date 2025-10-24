"""Tests for ReportGenerationTool."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from cycling_ai.tools.wrappers.report_tool import ReportGenerationTool


class TestReportGenerationTool:
    """Test suite for ReportGenerationTool."""

    def test_definition_structure(self) -> None:
        """Test that tool definition has correct structure."""
        tool = ReportGenerationTool()
        definition = tool.definition

        assert definition.name == "generate_report"
        assert definition.category == "reporting"
        assert definition.version == "1.0.0"
        assert len(definition.parameters) == 4

        # Verify required parameters
        required_params = definition.get_required_parameters()
        assert len(required_params) == 3
        required_names = {p.name for p in required_params}
        assert required_names == {
            "performance_analysis_json",
            "zones_analysis_json",
            "output_path",
        }

        # Verify optional parameters
        optional_params = definition.get_optional_parameters()
        assert len(optional_params) == 1
        assert optional_params[0].name == "training_plan_json"

    def test_execute_success(self, tmp_path: Path) -> None:
        """Test successful execution with valid inputs."""
        tool = ReportGenerationTool()

        # Create sample analysis JSONs
        performance_data = {
            "athlete_profile": {
                "name": "Test Athlete",
                "age": 35,
                "ftp": 250,
                "power_to_weight": 3.3,
                "goals": "Improve FTP",
            },
            "recent_period": {
                "total_rides": 20,
                "total_distance_km": 500,
                "total_time_hours": 25,
                "avg_power": 200,
            },
            "previous_period": {
                "total_rides": 18,
                "total_distance_km": 450,
            },
            "trends": {
                "distance": 11.1,
                "time": 8.5,
            },
        }

        zones_data = {
            "ftp": 250,
            "zones": {
                "Z1": {"time_hours": 10.0, "percentage": 40.0},
                "Z2": {"time_hours": 7.5, "percentage": 30.0},
                "Z3": {"time_hours": 5.0, "percentage": 20.0},
            },
            "easy_percent": 70.0,
            "moderate_percent": 20.0,
            "hard_percent": 10.0,
        }

        output_file = tmp_path / "report.md"

        result = tool.execute(
            performance_analysis_json=json.dumps(performance_data),
            zones_analysis_json=json.dumps(zones_data),
            output_path=str(output_file),
        )

        assert result.success is True
        assert result.format == "json"
        assert isinstance(result.data, dict)
        assert "report_path" in result.data
        assert output_file.exists()
        assert "generated_at" in result.metadata

        # Verify report content
        content = output_file.read_text()
        assert "Test Athlete" in content
        assert "Performance Analysis" in content
        assert "Power Zone Distribution" in content

    def test_execute_with_training_plan(self, tmp_path: Path) -> None:
        """Test execution with optional training plan."""
        tool = ReportGenerationTool()

        performance_data = {
            "athlete_profile": {"name": "Test", "age": 30, "ftp": 200}
        }
        zones_data = {"ftp": 200, "zones": {}}
        training_plan_data = {
            "total_weeks": 12,
            "current_ftp": 200,
            "target_ftp": 220,
            "ftp_gain": 20,
            "ftp_gain_percent": 10.0,
        }

        output_file = tmp_path / "report_with_plan.md"

        result = tool.execute(
            performance_analysis_json=json.dumps(performance_data),
            zones_analysis_json=json.dumps(zones_data),
            training_plan_json=json.dumps(training_plan_data),
            output_path=str(output_file),
        )

        assert result.success is True
        assert output_file.exists()

        # Verify training plan section
        content = output_file.read_text()
        assert "Training Plan" in content
        assert "12 weeks" in content

    def test_execute_missing_required_parameter(self) -> None:
        """Test validation catches missing required parameters."""
        tool = ReportGenerationTool()

        with pytest.raises(ValueError, match="Missing required parameters"):
            tool.validate_parameters(
                performance_analysis_json="{}",
                # Missing zones_analysis_json and output_path
            )

    def test_execute_invalid_json(self, tmp_path: Path) -> None:
        """Test execution with malformed JSON input."""
        tool = ReportGenerationTool()

        output_file = tmp_path / "report.md"

        result = tool.execute(
            performance_analysis_json="invalid json{",
            zones_analysis_json="{}",
            output_path=str(output_file),
        )

        assert result.success is False
        assert len(result.errors) > 0
        assert "json" in result.errors[0].lower()

    def test_execute_creates_parent_directories(self, tmp_path: Path) -> None:
        """Test that missing parent directories are created."""
        tool = ReportGenerationTool()

        output_file = tmp_path / "subdir" / "another" / "report.md"

        performance_data = {"athlete_profile": {"name": "Test", "ftp": 200}}
        zones_data = {"ftp": 200}

        result = tool.execute(
            performance_analysis_json=json.dumps(performance_data),
            zones_analysis_json=json.dumps(zones_data),
            output_path=str(output_file),
        )

        assert result.success is True
        assert output_file.exists()
        assert output_file.parent.exists()
