"""
Performance analysis tool wrapper.

Wraps core.performance.analyze_performance() as a BaseTool for LLM provider integration.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from cycling_ai.core.athlete import load_athlete_profile
from cycling_ai.core.performance import analyze_performance
from cycling_ai.tools.base import (
    BaseTool,
    ToolDefinition,
    ToolExecutionResult,
    ToolParameter,
)
from cycling_ai.tools.registry import register_tool


class PerformanceAnalysisTool(BaseTool):
    """
    Tool for analyzing cycling performance from Strava CSV data.

    Compares recent period with equivalent prior period to identify trends,
    provides monthly breakdown, and highlights best performances.
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="analyze_performance",
            description=(
                "Analyze cycling performance from Strava CSV export comparing time periods. "
                "Compares recent period (e.g., last 6 months) with equivalent prior period "
                "(e.g., 6 months before that) to identify trends. Provides comprehensive "
                "statistics including weekly averages, monthly breakdown, power/HR trends, "
                "and highlights of best performances. Uses athlete profile for personalized "
                "analysis context (age, FTP, goals, training status)."
            ),
            category="analysis",
            parameters=[
                ToolParameter(
                    name="csv_file_path",
                    type="string",
                    description=(
                        "Absolute path to Strava activities CSV export file. "
                        "Must be a valid Strava export containing Activity Date, "
                        "Distance, Moving Time, Average Power, etc."
                    ),
                    required=True,
                ),
                ToolParameter(
                    name="athlete_profile_json",
                    type="string",
                    description=(
                        "Path to athlete_profile.json containing athlete data "
                        "(name, age, weight, FTP, goals, training availability). "
                        "Required for personalized analysis and insights."
                    ),
                    required=True,
                ),
                ToolParameter(
                    name="period_months",
                    type="integer",
                    description=(
                        "Number of months for each comparison period. Default is 6. "
                        "Recent period: last N months, Previous period: N months before that. "
                        "For example, period_months=6 compares last 6 months vs months 7-12."
                    ),
                    required=False,
                    default=6,
                    min_value=1,
                    max_value=24,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": (
                    "JSON object containing: athlete_profile (name, age, FTP, goals), "
                    "recent_period stats (rides, distance, time, power, HR), "
                    "previous_period stats, monthly_breakdown (month-by-month trends), "
                    "trends (percentage changes), best_power_rides (top 5 by power), "
                    "longest_rides (top 10 by distance)."
                ),
            },
            version="1.0.0",
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute performance analysis.

        Args:
            **kwargs: Tool parameters (csv_file_path, athlete_profile_json, period_months)

        Returns:
            ToolExecutionResult with analysis data or errors
        """
        try:
            # Validate parameters against tool definition
            self.validate_parameters(**kwargs)

            # Extract and validate parameters
            csv_file_path = kwargs["csv_file_path"]
            athlete_profile_json = kwargs["athlete_profile_json"]
            period_months = kwargs.get("period_months", 6)

            # Validate file existence
            csv_path = Path(csv_file_path)
            if not csv_path.exists():
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"CSV file not found at path: {csv_file_path}"],
                )

            if not csv_path.is_file():
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Path is not a file: {csv_file_path}"],
                )

            profile_path = Path(athlete_profile_json)
            if not profile_path.exists():
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Athlete profile not found at path: {athlete_profile_json}"],
                )

            # Load athlete profile
            try:
                athlete_profile = load_athlete_profile(profile_path)
            except Exception as e:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Error loading athlete profile: {str(e)}"],
                )

            # Execute core business logic
            result_json = analyze_performance(
                csv_file_path=str(csv_path),
                athlete_name=athlete_profile.name,
                athlete_age=athlete_profile.age,
                athlete_weight_kg=athlete_profile.weight_kg,
                athlete_ftp=athlete_profile.ftp,
                athlete_max_hr=athlete_profile.max_hr,
                period_months=period_months,
                athlete_profile=athlete_profile,
            )

            # Parse and validate result JSON
            try:
                result_data = json.loads(result_json)
            except json.JSONDecodeError as e:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Invalid JSON returned from analysis: {str(e)}"],
                )

            # Return successful result
            return ToolExecutionResult(
                success=True,
                data=result_data,
                format="json",
                metadata={
                    "athlete": athlete_profile.name,
                    "period_months": period_months,
                    "source": "strava_csv",
                    "activities_analyzed": result_data.get("recent_period", {}).get(
                        "total_rides", 0
                    )
                    + result_data.get("previous_period", {}).get("total_rides", 0),
                },
            )

        except ValueError as e:
            # Parameter validation errors
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Parameter validation error: {str(e)}"],
            )
        except Exception as e:
            # Unexpected errors
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Unexpected error during execution: {str(e)}"],
            )


# Register tool on module import
register_tool(PerformanceAnalysisTool())
