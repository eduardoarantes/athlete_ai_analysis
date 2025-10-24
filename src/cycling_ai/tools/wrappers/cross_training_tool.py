"""
Cross-training analysis tool wrapper.

Wraps core.cross_training.analyze_cross_training_impact() as a BaseTool for LLM provider integration.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from cycling_ai.core.cross_training import analyze_cross_training_impact
from cycling_ai.core.utils import load_and_categorize_activities
from cycling_ai.tools.base import (
    BaseTool,
    ToolDefinition,
    ToolExecutionResult,
    ToolParameter,
)
from cycling_ai.tools.registry import register_tool


class CrossTrainingTool(BaseTool):
    """
    Tool for analyzing cross-training impact on cycling performance.

    Examines how strength training, running, swimming, and other activities
    affect cycling through load distribution and interference patterns.
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="analyze_cross_training_impact",
            description=(
                "Analyze how non-cycling activities (strength training, running, swimming) "
                "impact cycling performance. Examines training load distribution across "
                "activity categories, detects potential interference events (e.g., strength "
                "before hard cycling), analyzes weekly load balance, and provides timing "
                "recommendations. Includes personalized guidance based on athlete age, "
                "recovery capacity, and goals."
            ),
            category="analysis",
            parameters=[
                ToolParameter(
                    name="csv_file_path",
                    type="string",
                    description=(
                        "Path to Strava activities CSV export containing ALL activity types "
                        "(cycling, running, strength training, swimming, etc.). Must include "
                        "complete activity history for meaningful cross-training analysis."
                    ),
                    required=True,
                ),
                ToolParameter(
                    name="analysis_period_weeks",
                    type="integer",
                    description=(
                        "Number of weeks to analyze (looking back from today). "
                        "Longer periods provide more data for pattern detection."
                    ),
                    required=False,
                    default=12,
                    min_value=4,
                    max_value=52,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": (
                    "JSON object containing: activity_distribution (by category), "
                    "load_balance (cycling vs strength vs cardio percentages), "
                    "weekly_loads (week-by-week TSS breakdown), interference_analysis "
                    "(timing conflicts), performance_insights (correlations)."
                ),
            },
            version="1.0.0",
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute cross-training analysis.

        Args:
            **kwargs: Tool parameters (csv_file_path, analysis_period_weeks)

        Returns:
            ToolExecutionResult with cross-training analysis or errors
        """
        try:
            # Validate parameters against tool definition
            self.validate_parameters(**kwargs)

            # Extract parameters
            csv_file_path = kwargs["csv_file_path"]
            analysis_period_weeks = kwargs.get("analysis_period_weeks", 12)

            # Validate CSV path
            csv_path = Path(csv_file_path)
            if not csv_path.exists():
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"CSV file not found at path: {csv_file_path}"],
                )

            # Load and categorize activities
            try:
                df = load_and_categorize_activities(str(csv_path))
            except Exception as e:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Error loading/categorizing activities: {str(e)}"],
                )

            # Execute cross-training analysis
            result_json = analyze_cross_training_impact(
                df=df,
                analysis_period_weeks=analysis_period_weeks,
            )

            # Parse and validate result JSON
            try:
                result_data = json.loads(result_json)
            except json.JSONDecodeError as e:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Invalid JSON returned from cross-training analysis: {str(e)}"],
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
                    "analysis_period_weeks": analysis_period_weeks,
                    "total_activities": result_data.get("analysis_period", {}).get(
                        "total_activities", 0
                    ),
                    "interference_events": result_data.get("interference_analysis", {}).get(
                        "total_events", 0
                    ),
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
register_tool(CrossTrainingTool())
