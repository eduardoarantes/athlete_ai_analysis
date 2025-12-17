"""
Zone analysis tool wrapper.

Wraps core.zones.analyze_time_in_zones() as a BaseTool for LLM provider integration.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from cycling_ai.core.athlete import load_athlete_profile
from cycling_ai.core.zones import analyze_time_in_zones
from cycling_ai.tools.base import (
    BaseTool,
    ToolDefinition,
    ToolExecutionResult,
    ToolParameter,
)
from cycling_ai.tools.registry import register_tool


class ZoneAnalysisTool(BaseTool):
    """
    Tool for analyzing time-in-zones from FIT files.

    Reads second-by-second power data from .fit/.fit.gz files to provide
    accurate zone distribution analysis and polarization metrics.
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="analyze_time_in_zones",
            description=(
                "Analyze actual time spent in power zones by reading FIT files. "
                "Provides accurate zone distribution (Z1-Z5) by processing second-by-second "
                "power data rather than using ride averages. Includes polarization analysis "
                "(easy/moderate/hard distribution) and personalized recommendations based on "
                "athlete age, goals, and training status. Uses caching for performance."
            ),
            category="analysis",
            parameters=[
                ToolParameter(
                    name="activities_directory",
                    type="string",
                    description=(
                        "Path to directory containing .fit or .fit.gz files. "
                        "Can be organized in subdirectories (e.g., ride/2024-01/). "
                        "All .fit files will be processed recursively."
                    ),
                    required=True,
                ),
                ToolParameter(
                    name="athlete_profile_json",
                    type="string",
                    description=(
                        "Path to athlete_profile.json. Required for FTP value "
                        "and personalized zone recommendations."
                    ),
                    required=True,
                ),
                ToolParameter(
                    name="period_months",
                    type="integer",
                    description=(
                        "Number of months to analyze (looking back from today). "
                        "Only FIT files within this period will be processed."
                    ),
                    required=False,
                    default=6,
                    min_value=1,
                    max_value=24,
                ),
                ToolParameter(
                    name="use_cache",
                    type="boolean",
                    description=(
                        "Use cached zone data if available. Cache is stored per FTP value. "
                        "Set to false to force re-processing of all FIT files."
                    ),
                    required=False,
                    default=True,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": (
                    "JSON object containing: ftp, zones (Z1-Z5 with time/percentage), "
                    "polarization analysis (easy/moderate/hard percentages), "
                    "athlete_profile context, llm_context for personalized recommendations."
                ),
            },
            version="1.0.0",
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute zone analysis.

        Args:
            **kwargs: Tool parameters (activities_directory, athlete_profile_json, period_months, use_cache)

        Returns:
            ToolExecutionResult with zone distribution data or errors
        """
        try:
            # Validate parameters against tool definition
            self.validate_parameters(**kwargs)

            # Extract parameters
            activities_directory = kwargs["activities_directory"]
            athlete_profile_json = kwargs["athlete_profile_json"]
            period_months = kwargs.get("period_months", 6)
            use_cache = kwargs.get("use_cache", True)

            # Validate paths
            activities_path = Path(activities_directory)
            if not activities_path.exists():
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Activities directory not found at path: {activities_directory}"],
                )

            if not activities_path.is_dir():
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Path is not a directory: {activities_directory}"],
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

            # Execute zone analysis
            result_json = analyze_time_in_zones(
                activities_directory=str(activities_path),
                athlete_ftp=athlete_profile.ftp,
                period_months=period_months,
                max_files=None,  # Process all files
                use_cache=use_cache,
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
                    errors=[f"Invalid JSON returned from zone analysis: {str(e)}"],
                )

            # Check for error in result data
            if "error" in result_data:
                return ToolExecutionResult(
                    success=False,
                    data=result_data,
                    format="json",
                    errors=[result_data["error"]],
                )

            # Return successful result
            return ToolExecutionResult(
                success=True,
                data=result_data,
                format="json",
                metadata={
                    "athlete": athlete_profile.name,
                    "ftp": athlete_profile.ftp,
                    "period_months": period_months,
                    "files_processed": result_data.get("files_processed", 0),
                    "cache_used": result_data.get("source") == "cached",
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
register_tool(ZoneAnalysisTool())
