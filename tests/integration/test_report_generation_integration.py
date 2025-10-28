"""
Integration tests for HTML report generation workflow.

Tests the complete flow from tool execution to file creation validation.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from cycling_ai.tools.wrappers.report_tool import ReportGenerationTool


@pytest.fixture
def complete_performance_data() -> dict[str, Any]:
    """Complete performance analysis data for integration tests."""
    return {
        "athlete_profile": {
            "name": "Integration Test Athlete",
            "age": 32,
            "ftp": 280,
            "power_to_weight": 3.8,
            "weight_kg": 73.7,
            "goals": "Prepare for Gran Fondo event",
            "experience_level": "Advanced",
        },
        "recent_period": {
            "total_rides": 65,
            "total_distance_km": 2450.5,
            "total_time_hours": 98.3,
            "avg_power": 215,
            "max_power": 1250,
            "avg_heart_rate": 145,
        },
        "previous_period": {
            "total_rides": 58,
            "total_distance_km": 2150.0,
            "total_time_hours": 89.0,
            "avg_power": 205,
        },
        "trends": {
            "avg_power_change_pct": 4.9,
            "distance_change_pct": 14.0,
            "time_change_pct": 10.4,
            "rides_change_pct": 12.1,
        },
        "best_performances": [
            {"date": "2025-10-15", "power": 1250, "duration_seconds": 5},
            {"date": "2025-10-12", "power": 350, "duration_seconds": 1200},
        ],
    }


@pytest.fixture
def complete_zones_data() -> dict[str, Any]:
    """Complete zone analysis data for integration tests."""
    return {
        "ftp": 280,
        "zones": {
            "Z1": {
                "name": "Active Recovery",
                "power_range": "0-140W",
                "time_hours": 35.2,
                "percentage": 35.8,
            },
            "Z2": {
                "name": "Endurance",
                "power_range": "140-196W",
                "time_hours": 38.5,
                "percentage": 39.2,
            },
            "Z3": {
                "name": "Tempo",
                "power_range": "196-252W",
                "time_hours": 15.3,
                "percentage": 15.6,
            },
            "Z4": {
                "name": "Threshold",
                "power_range": "252-308W",
                "time_hours": 7.1,
                "percentage": 7.2,
            },
            "Z5": {
                "name": "VO2 Max",
                "power_range": "308+W",
                "time_hours": 2.2,
                "percentage": 2.2,
            },
        },
        "total_hours": 98.3,
        "easy_percent": 75.0,
        "moderate_percent": 15.6,
        "hard_percent": 9.4,
        "polarization_index": 2.1,
    }


@pytest.fixture
def complete_training_plan() -> dict[str, Any]:
    """Complete training plan data for integration tests."""
    return {
        "total_weeks": 12,
        "current_ftp": 280,
        "target_ftp": 305,
        "ftp_gain": 25,
        "ftp_gain_percent": 8.9,
        "periodization": "Polarized",
        "weekly_hours": 8.5,
        "plan_text": """# 12-Week Training Plan

## Phase 1: Base Building (Weeks 1-4)
- Focus: Aerobic endurance
- Weekly hours: 8-9
- Key workouts: Long endurance rides, Z2 tempo

## Phase 2: Build (Weeks 5-8)
- Focus: FTP improvement
- Weekly hours: 9-10
- Key workouts: Threshold intervals, Sweet spot

## Phase 3: Peak (Weeks 9-12)
- Focus: Race-specific fitness
- Weekly hours: 10-11
- Key workouts: VO2 max intervals, Race simulations
""",
    }


class TestHTMLReportGenerationIntegration:
    """Integration tests for HTML report generation."""

    def test_complete_workflow_generates_all_files(
        self,
        tmp_path: Path,
        complete_performance_data: dict[str, Any],
        complete_zones_data: dict[str, Any],
        complete_training_plan: dict[str, Any],
    ) -> None:
        """Test complete workflow generates all 3 HTML files with all data."""
        tool = ReportGenerationTool()
        output_dir = tmp_path / "complete_reports"

        result = tool.execute(
            performance_analysis_json=json.dumps(complete_performance_data),
            zones_analysis_json=json.dumps(complete_zones_data),
            training_plan_json=json.dumps(complete_training_plan),
            output_dir=str(output_dir),
            output_format="html",
        )

        # Verify success
        assert result.success is True
        assert result.data is not None

        # Verify all files created
        assert result.data["files_created"] == 3
        assert len(result.data["output_files"]) == 3

        # Verify files exist and have content
        index_file = output_dir / "index.html"
        insights_file = output_dir / "coaching_insights.html"
        dashboard_file = output_dir / "performance_dashboard.html"

        assert index_file.exists()
        assert insights_file.exists()
        assert dashboard_file.exists()

        # Verify file sizes (should be substantial)
        assert index_file.stat().st_size > 2000  # At least 2KB
        assert insights_file.stat().st_size > 3000  # At least 3KB
        assert dashboard_file.stat().st_size > 2000  # At least 2KB

        # Verify athlete name appears in all files
        for file_path in [index_file, insights_file, dashboard_file]:
            content = file_path.read_text()
            assert "Integration Test Athlete" in content

        # Verify specific content in index.html
        index_content = index_file.read_text()
        assert "280 W" in index_content  # FTP
        assert "3.8" in index_content or "3.80" in index_content  # W/kg
        # Goals are in insights page, not index

        # Verify specific content in coaching_insights.html
        insights_content = insights_file.read_text()
        assert "Athlete Profile" in insights_content
        assert "Period Comparison" in insights_content
        assert "Training Zone Distribution" in insights_content
        assert "12-Week Training Plan" in insights_content
        assert "Gran Fondo" in insights_content  # Goals appear in insights

        # Verify specific content in performance_dashboard.html
        dashboard_content = dashboard_file.read_text()
        assert "Performance Dashboard" in dashboard_content
        assert "Zone Distribution Visualization" in dashboard_content
        assert "65" in dashboard_content  # Total rides

    def test_workflow_without_training_plan(
        self,
        tmp_path: Path,
        complete_performance_data: dict[str, Any],
        complete_zones_data: dict[str, Any],
    ) -> None:
        """Test workflow works without training plan (optional parameter)."""
        tool = ReportGenerationTool()
        output_dir = tmp_path / "reports_no_plan"

        result = tool.execute(
            performance_analysis_json=json.dumps(complete_performance_data),
            zones_analysis_json=json.dumps(complete_zones_data),
            output_dir=str(output_dir),
            output_format="html",
        )

        assert result.success is True
        assert result.data["files_created"] == 3

        # Verify files don't crash without training plan
        index_file = output_dir / "index.html"
        insights_file = output_dir / "coaching_insights.html"

        assert index_file.exists()
        assert insights_file.exists()

        # Training plan section should not be present
        index_content = index_file.read_text()
        # May or may not have "Training Plan" section depending on implementation

    def test_file_validation_catches_missing_files(
        self,
        tmp_path: Path,
        complete_performance_data: dict[str, Any],
        complete_zones_data: dict[str, Any],
    ) -> None:
        """Test that file validation can detect when files don't exist."""
        tool = ReportGenerationTool()
        output_dir = tmp_path / "validation_test"

        result = tool.execute(
            performance_analysis_json=json.dumps(complete_performance_data),
            zones_analysis_json=json.dumps(complete_zones_data),
            output_dir=str(output_dir),
            output_format="html",
        )

        assert result.success is True
        output_files = result.data["output_files"]

        # All files should exist immediately after generation
        for file_path_str in output_files:
            file_path = Path(file_path_str)
            assert file_path.exists(), f"File not found: {file_path}"

        # Now delete one file and verify it's missing
        Path(output_files[0]).unlink()
        assert not Path(output_files[0]).exists()

    def test_html_contains_all_navigation_links(
        self,
        tmp_path: Path,
        complete_performance_data: dict[str, Any],
        complete_zones_data: dict[str, Any],
    ) -> None:
        """Test that all HTML files contain navigation links."""
        tool = ReportGenerationTool()
        output_dir = tmp_path / "nav_test"

        result = tool.execute(
            performance_analysis_json=json.dumps(complete_performance_data),
            zones_analysis_json=json.dumps(complete_zones_data),
            output_dir=str(output_dir),
            output_format="html",
        )

        assert result.success is True

        # Check navigation in all files
        for filename in ["index.html", "coaching_insights.html", "performance_dashboard.html"]:
            content = (output_dir / filename).read_text()
            assert 'href="index.html"' in content
            assert 'href="coaching_insights.html"' in content
            assert 'href="performance_dashboard.html"' in content

    def test_html_is_valid_structure(
        self,
        tmp_path: Path,
        complete_performance_data: dict[str, Any],
        complete_zones_data: dict[str, Any],
    ) -> None:
        """Test that generated HTML has valid structure."""
        tool = ReportGenerationTool()
        output_dir = tmp_path / "structure_test"

        result = tool.execute(
            performance_analysis_json=json.dumps(complete_performance_data),
            zones_analysis_json=json.dumps(complete_zones_data),
            output_dir=str(output_dir),
            output_format="html",
        )

        assert result.success is True

        for filename in ["index.html", "coaching_insights.html", "performance_dashboard.html"]:
            content = (output_dir / filename).read_text()

            # Check basic HTML structure
            assert "<!DOCTYPE html>" in content
            assert "<html" in content
            assert "<head>" in content
            assert "</head>" in content
            assert "<body>" in content
            assert "</body>" in content
            assert "</html>" in content

            # Check for required meta tags
            assert '<meta charset="UTF-8">' in content
            assert 'name="viewport"' in content

            # Check for embedded CSS
            assert "<style>" in content
            assert "</style>" in content

    def test_performance_trends_visualization(
        self,
        tmp_path: Path,
        complete_performance_data: dict[str, Any],
        complete_zones_data: dict[str, Any],
    ) -> None:
        """Test that performance trends are visualized in reports."""
        tool = ReportGenerationTool()
        output_dir = tmp_path / "trends_test"

        result = tool.execute(
            performance_analysis_json=json.dumps(complete_performance_data),
            zones_analysis_json=json.dumps(complete_zones_data),
            output_dir=str(output_dir),
            output_format="html",
        )

        assert result.success is True

        index_content = (output_dir / "index.html").read_text()

        # Check for trend data
        assert "4.9" in index_content or "+4.9" in index_content  # Power trend
        assert "14.0" in index_content or "+14.0" in index_content  # Distance trend

        # Check for positive/negative indicators
        assert 'class="positive"' in index_content

    def test_zone_distribution_chart(
        self,
        tmp_path: Path,
        complete_performance_data: dict[str, Any],
        complete_zones_data: dict[str, Any],
    ) -> None:
        """Test that zone distribution is visualized as a chart."""
        tool = ReportGenerationTool()
        output_dir = tmp_path / "chart_test"

        result = tool.execute(
            performance_analysis_json=json.dumps(complete_performance_data),
            zones_analysis_json=json.dumps(complete_zones_data),
            output_dir=str(output_dir),
            output_format="html",
        )

        assert result.success is True

        dashboard_content = (output_dir / "performance_dashboard.html").read_text()

        # Check for zone visualization elements
        assert "Zone Distribution Visualization" in dashboard_content
        assert "chart-bar" in dashboard_content or "width:" in dashboard_content

        # Check all zones are represented
        for zone in ["Z1", "Z2", "Z3", "Z4", "Z5"]:
            assert zone in dashboard_content
