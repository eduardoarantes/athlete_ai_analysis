"""
Tests for HTML report generation in ReportGenerationTool.

Tests the new HTML output mode added in Phase 3.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from cycling_ai.tools.wrappers.report_tool import ReportGenerationTool


@pytest.fixture
def sample_performance_data() -> dict[str, Any]:
    """Sample performance analysis data."""
    return {
        "athlete_profile": {
            "name": "Test Athlete",
            "age": 35,
            "ftp": 250,
            "power_to_weight": 3.5,
            "goals": "Improve FTP",
        },
        "recent_period": {
            "total_rides": 50,
            "total_distance_km": 1500.0,
            "total_time_hours": 75.0,
            "avg_power": 200,
        },
        "previous_period": {
            "total_rides": 45,
            "total_distance_km": 1350.0,
            "total_time_hours": 67.5,
            "avg_power": 195,
        },
        "trends": {
            "avg_power_change_pct": 2.5,
            "distance_change_pct": 11.1,
        },
    }


@pytest.fixture
def sample_zones_data() -> dict[str, Any]:
    """Sample zone analysis data."""
    return {
        "zones": {
            "Z1": {"time_hours": 50.0, "percentage": 40.0},
            "Z2": {"time_hours": 40.0, "percentage": 32.0},
            "Z3": {"time_hours": 20.0, "percentage": 16.0},
            "Z4": {"time_hours": 10.0, "percentage": 8.0},
            "Z5": {"time_hours": 5.0, "percentage": 4.0},
        },
        "easy_percent": 72.0,
        "moderate_percent": 16.0,
        "hard_percent": 12.0,
    }


@pytest.fixture
def sample_training_plan() -> dict[str, Any]:
    """Sample training plan data."""
    return {
        "total_weeks": 10,
        "current_ftp": 250,
        "target_ftp": 275,
        "ftp_gain": 25,
        "ftp_gain_percent": 10.0,
        "plan_text": "# 10-Week Training Plan\n\nWeek 1: Base building...",
    }


class TestReportToolHTMLGeneration:
    """Tests for HTML report generation."""

    def test_html_mode_creates_three_files(
        self,
        tmp_path: Path,
        sample_performance_data: dict[str, Any],
        sample_zones_data: dict[str, Any],
    ) -> None:
        """Test that HTML mode creates 3 HTML files."""
        tool = ReportGenerationTool()
        output_dir = tmp_path / "reports"

        result = tool.execute(
            performance_analysis_json=json.dumps(sample_performance_data),
            zones_analysis_json=json.dumps(sample_zones_data),
            output_dir=str(output_dir),
            output_format="html",
        )

        # Assert success
        assert result.success is True
        assert result.data is not None

        # Assert 3 files created
        assert result.data["files_created"] == 3
        assert len(result.data["output_files"]) == 3

        # Assert files exist
        index_file = output_dir / "index.html"
        insights_file = output_dir / "coaching_insights.html"
        dashboard_file = output_dir / "performance_dashboard.html"

        assert index_file.exists()
        assert insights_file.exists()
        assert dashboard_file.exists()

        # Assert files are HTML
        for file_path in [index_file, insights_file, dashboard_file]:
            content = file_path.read_text()
            assert content.startswith("<html") or content.startswith("<!DOCTYPE")
            assert "</html>" in content

    def test_html_files_contain_valid_html(
        self,
        tmp_path: Path,
        sample_performance_data: dict[str, Any],
        sample_zones_data: dict[str, Any],
    ) -> None:
        """Test that generated HTML files have valid structure."""
        tool = ReportGenerationTool()
        output_dir = tmp_path / "reports"

        result = tool.execute(
            performance_analysis_json=json.dumps(sample_performance_data),
            zones_analysis_json=json.dumps(sample_zones_data),
            output_dir=str(output_dir),
            output_format="html",
        )

        assert result.success is True

        # Check index.html structure
        index_file = output_dir / "index.html"
        index_content = index_file.read_text()
        assert "<html" in index_content
        assert "<head>" in index_content
        assert "<body>" in index_content
        assert "</html>" in index_content

        # Check for embedded CSS
        assert "<style>" in index_content or "style=" in index_content

        # Check for athlete name
        assert "Test Athlete" in index_content

    def test_markdown_mode_still_works(
        self,
        tmp_path: Path,
        sample_performance_data: dict[str, Any],
        sample_zones_data: dict[str, Any],
    ) -> None:
        """Test backward compatibility with Markdown mode."""
        tool = ReportGenerationTool()
        output_file = tmp_path / "report.md"

        result = tool.execute(
            performance_analysis_json=json.dumps(sample_performance_data),
            zones_analysis_json=json.dumps(sample_zones_data),
            output_path=str(output_file),
            output_format="markdown",
        )

        assert result.success is True
        assert output_file.exists()
        assert output_file.suffix == ".md"

        # Check it's actually Markdown
        content = output_file.read_text()
        assert "# Cycling Performance Report" in content
        assert "## Athlete Profile" in content

    def test_legacy_output_path_parameter(
        self,
        tmp_path: Path,
        sample_performance_data: dict[str, Any],
        sample_zones_data: dict[str, Any],
    ) -> None:
        """Test backward compatibility with output_path parameter."""
        tool = ReportGenerationTool()
        output_file = tmp_path / "report.md"

        # Call without output_format (should default to markdown for output_path)
        result = tool.execute(
            performance_analysis_json=json.dumps(sample_performance_data),
            zones_analysis_json=json.dumps(sample_zones_data),
            output_path=str(output_file),
        )

        assert result.success is True
        assert output_file.exists()

    def test_output_dir_parameter(
        self,
        tmp_path: Path,
        sample_performance_data: dict[str, Any],
        sample_zones_data: dict[str, Any],
    ) -> None:
        """Test new output_dir parameter creates directory."""
        tool = ReportGenerationTool()
        output_dir = tmp_path / "new_dir" / "reports"

        result = tool.execute(
            performance_analysis_json=json.dumps(sample_performance_data),
            zones_analysis_json=json.dumps(sample_zones_data),
            output_dir=str(output_dir),
            output_format="html",
        )

        assert result.success is True
        assert output_dir.exists()
        assert output_dir.is_dir()

    def test_invalid_output_format(
        self,
        tmp_path: Path,
        sample_performance_data: dict[str, Any],
        sample_zones_data: dict[str, Any],
    ) -> None:
        """Test error handling for invalid output format."""
        tool = ReportGenerationTool()

        result = tool.execute(
            performance_analysis_json=json.dumps(sample_performance_data),
            zones_analysis_json=json.dumps(sample_zones_data),
            output_dir=str(tmp_path),
            output_format="invalid",
        )

        assert result.success is False
        assert "Invalid output_format" in result.errors[0]

    def test_missing_output_parameter(
        self,
        sample_performance_data: dict[str, Any],
        sample_zones_data: dict[str, Any],
    ) -> None:
        """Test error when neither output_dir nor output_path provided."""
        tool = ReportGenerationTool()

        result = tool.execute(
            performance_analysis_json=json.dumps(sample_performance_data),
            zones_analysis_json=json.dumps(sample_zones_data),
            output_format="html",
        )

        assert result.success is False
        assert "output_dir" in result.errors[0]

    def test_html_with_training_plan(
        self,
        tmp_path: Path,
        sample_performance_data: dict[str, Any],
        sample_zones_data: dict[str, Any],
        sample_training_plan: dict[str, Any],
    ) -> None:
        """Test HTML generation includes training plan data."""
        tool = ReportGenerationTool()
        output_dir = tmp_path / "reports"

        result = tool.execute(
            performance_analysis_json=json.dumps(sample_performance_data),
            zones_analysis_json=json.dumps(sample_zones_data),
            training_plan_json=json.dumps(sample_training_plan),
            output_dir=str(output_dir),
            output_format="html",
        )

        assert result.success is True

        # Check that training plan is mentioned in index
        index_content = (output_dir / "index.html").read_text()
        assert "training" in index_content.lower() or "10" in index_content

    def test_html_files_are_self_contained(
        self,
        tmp_path: Path,
        sample_performance_data: dict[str, Any],
        sample_zones_data: dict[str, Any],
    ) -> None:
        """Test that HTML files have no external dependencies."""
        tool = ReportGenerationTool()
        output_dir = tmp_path / "reports"

        result = tool.execute(
            performance_analysis_json=json.dumps(sample_performance_data),
            zones_analysis_json=json.dumps(sample_zones_data),
            output_dir=str(output_dir),
            output_format="html",
        )

        assert result.success is True

        # Check files don't have external CSS links
        for filename in ["index.html", "coaching_insights.html", "performance_dashboard.html"]:
            content = (output_dir / filename).read_text()
            # Should not have external CSS references
            assert 'rel="stylesheet"' not in content or "<style>" in content
            # Should have embedded styles
            assert "<style>" in content

    def test_result_metadata_contains_output_info(
        self,
        tmp_path: Path,
        sample_performance_data: dict[str, Any],
        sample_zones_data: dict[str, Any],
    ) -> None:
        """Test that result contains metadata about generated files."""
        tool = ReportGenerationTool()
        output_dir = tmp_path / "reports"

        result = tool.execute(
            performance_analysis_json=json.dumps(sample_performance_data),
            zones_analysis_json=json.dumps(sample_zones_data),
            output_dir=str(output_dir),
            output_format="html",
        )

        assert result.success is True
        assert result.data is not None
        assert "output_files" in result.data
        assert "output_format" in result.data
        assert "files_created" in result.data
        assert "output_directory" in result.data

        assert result.data["output_format"] == "html"
        assert result.data["files_created"] == 3
        assert result.data["output_directory"] == str(output_dir)
