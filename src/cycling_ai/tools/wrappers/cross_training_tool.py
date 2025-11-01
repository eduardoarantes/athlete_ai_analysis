"""
Cross-training analysis tool wrapper.

Wraps core.cross_training.analyze_cross_training_impact() as a BaseTool for LLM provider integration.
"""
from __future__ import annotations

import json
import logging
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

logger = logging.getLogger(__name__)


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
                    name="cache_file_path",
                    type="string",
                    description=(
                        "Path to Parquet cache file with categorized activities (RECOMMENDED). "
                        "Cache must include cross-training categorization (activity_category, "
                        "muscle_focus, etc.). Generated automatically by prepare_cache tool."
                    ),
                    required=False,
                ),
                ToolParameter(
                    name="csv_file_path",
                    type="string",
                    description=(
                        "Path to activities CSV file containing ALL activity types (cycling, "
                        "running, strength training, swimming, etc.). LEGACY: Use cache_file_path "
                        "instead for better performance. Optional if cache_file_path is provided."
                    ),
                    required=False,
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

        Supports two modes:
        1. Cache mode (RECOMMENDED): Load from Parquet cache with FIT file data
        2. CSV mode (LEGACY): Load from activities CSV file

        Args:
            **kwargs: Tool parameters (csv_file_path OR cache_file_path, analysis_period_weeks)

        Returns:
            ToolExecutionResult with cross-training analysis or errors
        """
        # Log job start with clear header
        logger.info("=" * 80)
        logger.info("TOOL EXECUTION START: analyze_cross_training_impact")
        logger.info("=" * 80)

        try:
            # Extract parameters
            csv_file_path = kwargs.get("csv_file_path")
            cache_file_path = kwargs.get("cache_file_path")
            analysis_period_weeks = kwargs.get("analysis_period_weeks", 12)

            logger.info(f"Parameters:")
            logger.info(f"  - cache_file_path: {cache_file_path}")
            logger.info(f"  - csv_file_path: {csv_file_path}")
            logger.info(f"  - analysis_period_weeks: {analysis_period_weeks}")

            # Must provide either CSV or cache path
            if not csv_file_path and not cache_file_path:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=["Must provide either csv_file_path or cache_file_path"],
                )

            # Load activities from appropriate source
            if cache_file_path:
                # Cache mode: load from Parquet
                cache_path = Path(cache_file_path)
                if not cache_path.exists():
                    return ToolExecutionResult(
                        success=False,
                        data=None,
                        format="json",
                        errors=[f"Cache file not found at path: {cache_file_path}"],
                    )

                try:
                    import pandas as pd

                    logger.info(f"Loading cache from: {cache_path}")
                    df = pd.read_parquet(cache_path)
                    logger.info(f"Loaded {len(df)} activities from cache")

                    # Verify cache has cross-training categorization
                    required_columns = ["activity_category", "muscle_focus", "fatigue_impact", "recovery_hours", "intensity_category"]
                    missing_columns = [col for col in required_columns if col not in df.columns]

                    logger.info(f"Validating required columns: {required_columns}")
                    if missing_columns:
                        logger.error(f"Missing columns: {missing_columns}")

                    if missing_columns:
                        return ToolExecutionResult(
                            success=False,
                            data=None,
                            format="json",
                            errors=[
                                f"Cache file missing cross-training columns: {', '.join(missing_columns)}. "
                                "Please regenerate cache with cross-training categorization."
                            ],
                        )

                    # Rename columns to match cross_training.py expectations
                    column_mapping = {
                        "Activity Date": "date",
                        "Activity Type": "type",
                        "Activity Name": "name",
                        "Elapsed Time": "elapsed_time",
                        "Average Heart Rate": "avg_hr",
                        "Average Watts": "avg_watts",
                        "Weighted Average Power": "weighted_power",
                    }
                    df = df.rename(columns=column_mapping)

                except Exception as e:
                    return ToolExecutionResult(
                        success=False,
                        data=None,
                        format="json",
                        errors=[f"Error loading cache file: {str(e)}"],
                    )
            else:
                # CSV mode: load and categorize from CSV
                csv_path = Path(csv_file_path)
                if not csv_path.exists():
                    return ToolExecutionResult(
                        success=False,
                        data=None,
                        format="json",
                        errors=[f"CSV file not found at path: {csv_file_path}"],
                    )

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
            total_activities = result_data.get("analysis_period", {}).get("total_activities", 0)
            interference_events = result_data.get("interference_analysis", {}).get("total_events", 0)

            logger.info(f"Analysis completed successfully:")
            logger.info(f"  - Total activities analyzed: {total_activities}")
            logger.info(f"  - Interference events detected: {interference_events}")
            logger.info("=" * 80)
            logger.info("TOOL EXECUTION COMPLETE: analyze_cross_training_impact")
            logger.info("=" * 80)

            return ToolExecutionResult(
                success=True,
                data=result_data,
                format="json",
                metadata={
                    "analysis_period_weeks": analysis_period_weeks,
                    "total_activities": total_activities,
                    "interference_events": interference_events,
                },
            )

        except ValueError as e:
            # Parameter validation errors
            logger.error(f"Parameter validation error: {str(e)}")
            logger.info("=" * 80)
            logger.info("TOOL EXECUTION FAILED: analyze_cross_training_impact")
            logger.info("=" * 80)
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Parameter validation error: {str(e)}"],
            )
        except Exception as e:
            # Unexpected errors
            logger.error(f"Unexpected error during execution: {str(e)}")
            logger.info("=" * 80)
            logger.info("TOOL EXECUTION FAILED: analyze_cross_training_impact")
            logger.info("=" * 80)
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Unexpected error during execution: {str(e)}"],
            )


# Register tool on module import
register_tool(CrossTrainingTool())
