"""
Workout comparison tool wrappers.

Provides MCP-style tools for comparing planned training workouts
against actual executed workouts, exposing core business logic
to LLM agents.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from cycling_ai.core.athlete import load_athlete_profile
from cycling_ai.core.workout_comparison import WorkoutComparer
from cycling_ai.tools.base import (
    BaseTool,
    ToolDefinition,
    ToolExecutionResult,
    ToolParameter,
)
from cycling_ai.tools.registry import register_tool

logger = logging.getLogger(__name__)


class CompareWorkoutTool(BaseTool):
    """
    Tool for comparing a single planned workout against actual execution.

    This tool analyzes how well an athlete executed a specific day's planned workout,
    providing compliance metrics, deviations, and actionable recommendations.
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="compare_workout",
            description=(
                "Compare a planned workout against actual execution for a specific date. "
                "Analyzes compliance (completion, duration, intensity, TSS), identifies "
                "deviations, and provides coaching recommendations. Use this for daily "
                "workout compliance analysis."
            ),
            category="analysis",
            parameters=[
                ToolParameter(
                    name="date",
                    type="string",
                    description="Date of workout to compare (YYYY-MM-DD format)",
                    required=True,
                ),
                ToolParameter(
                    name="training_plan_path",
                    type="string",
                    description="Path to training plan JSON file (output from finalize_training_plan)",
                    required=True,
                ),
                ToolParameter(
                    name="activities_csv_path",
                    type="string",
                    description="Path to activities CSV file or Parquet cache",
                    required=True,
                ),
                ToolParameter(
                    name="athlete_profile_path",
                    type="string",
                    description="Path to athlete_profile.json (for FTP and zone calculations)",
                    required=True,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": "WorkoutComparison with compliance metrics, deviations, and recommendation",
            },
            version="1.0.0",
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute workout comparison.

        Args:
            date: Date string in YYYY-MM-DD format
            training_plan_path: Path to training plan JSON
            activities_csv_path: Path to activities CSV or Parquet
            athlete_profile_path: Path to athlete profile JSON

        Returns:
            ToolExecutionResult with WorkoutComparison as JSON
        """
        try:
            # Extract and validate parameters
            date = kwargs.get("date")
            training_plan_path = kwargs.get("training_plan_path")
            activities_csv_path = kwargs.get("activities_csv_path")
            athlete_profile_path = kwargs.get("athlete_profile_path")

            if not all([date, training_plan_path, activities_csv_path, athlete_profile_path]):
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=["Missing required parameters. All parameters are required."],
                )

            logger.info(f"[COMPARE WORKOUT TOOL] Comparing workout for date: {date}")

            # Validate date format
            try:
                parsed_date = datetime.strptime(str(date), "%Y-%m-%d")
                logger.debug(f"[COMPARE WORKOUT TOOL] Parsed date: {parsed_date}")
            except ValueError:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[
                        f"Invalid date format: {date}. Expected format: YYYY-MM-DD (e.g., 2024-11-04)"
                    ],
                )

            # Validate file paths
            plan_path = Path(str(training_plan_path))
            if not plan_path.exists():
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Training plan file does not exist: {training_plan_path}"],
                )

            csv_path = Path(str(activities_csv_path))
            if not csv_path.exists():
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Activities file does not exist: {activities_csv_path}"],
                )

            profile_path = Path(str(athlete_profile_path))
            if not profile_path.exists():
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Athlete profile file does not exist: {athlete_profile_path}"],
                )

            # Load athlete profile
            profile = load_athlete_profile(profile_path)
            logger.debug(f"[COMPARE WORKOUT TOOL] Loaded profile, FTP: {profile.ftp}")

            # Initialize WorkoutComparer
            comparer = WorkoutComparer(
                plan_path=plan_path,
                activities_path=csv_path,
                ftp=int(profile.ftp),
            )

            # Execute comparison
            comparison = comparer.compare_daily_workout(str(date))

            if comparison is None:
                return ToolExecutionResult(
                    success=True,
                    data={"message": f"No workout planned for {date}"},
                    format="json",
                    metadata={"date": str(date)},
                )

            # Serialize to JSON
            result_data: dict[str, Any] = {
                "date": comparison.date.strftime("%Y-%m-%d"),
                "planned": {
                    "weekday": comparison.planned.weekday,
                    "type": comparison.planned.workout_type,
                    "duration_minutes": comparison.planned.total_duration_minutes,
                    "tss": comparison.planned.planned_tss,
                    "zone_distribution": comparison.planned.zone_distribution,
                    "target_avg_power_pct": comparison.planned.target_avg_power_pct,
                },
                "actual": None,
                "compliance": {
                    "completed": comparison.metrics.completed,
                    "compliance_score": comparison.metrics.compliance_score,
                    "completion_score": comparison.metrics.completion_score,
                    "duration_score": comparison.metrics.duration_score,
                    "intensity_score": comparison.metrics.intensity_score,
                    "tss_score": comparison.metrics.tss_score,
                    "duration_compliance_pct": comparison.metrics.duration_compliance_pct,
                    "tss_compliance_pct": comparison.metrics.tss_compliance_pct,
                },
                "deviations": comparison.deviations,
                "recommendation": comparison.recommendation,
            }

            # Add actual workout data if completed
            if comparison.actual:
                result_data["actual"] = {
                    "completed": True,
                    "activity_name": comparison.actual.activity_name,
                    "activity_type": comparison.actual.activity_type,
                    "duration_minutes": comparison.actual.duration_minutes,
                    "tss": comparison.actual.actual_tss,
                    "zone_distribution": comparison.actual.zone_distribution,
                    "average_power": comparison.actual.average_power,
                    "normalized_power": comparison.actual.normalized_power,
                }

            return ToolExecutionResult(
                success=True,
                data=result_data,
                format="json",
                metadata={
                    "date": str(date),
                    "compliance_score": comparison.metrics.compliance_score,
                    "completed": comparison.metrics.completed,
                },
            )

        except Exception as e:
            logger.error(f"[COMPARE WORKOUT TOOL] Error: {str(e)}", exc_info=True)
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Unexpected error during execution: {str(e)}"],
            )


class CompareWeeklyWorkoutsTool(BaseTool):
    """
    Tool for comparing an entire week of planned vs actual workouts.

    Provides aggregated compliance metrics, pattern identification,
    and weekly coaching insights.
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="compare_weekly_workouts",
            description=(
                "Compare an entire week of planned workouts against actual execution. "
                "Provides weekly compliance metrics, identifies patterns (e.g., skipping "
                "hard workouts, weekend warrior), and generates weekly coaching insights. "
                "Use this for weekly compliance analysis and pattern detection."
            ),
            category="analysis",
            parameters=[
                ToolParameter(
                    name="week_start_date",
                    type="string",
                    description="Start date of week to analyze (Monday, YYYY-MM-DD format)",
                    required=True,
                ),
                ToolParameter(
                    name="training_plan_path",
                    type="string",
                    description="Path to training plan JSON file",
                    required=True,
                ),
                ToolParameter(
                    name="activities_csv_path",
                    type="string",
                    description="Path to activities CSV file or Parquet cache",
                    required=True,
                ),
                ToolParameter(
                    name="athlete_profile_path",
                    type="string",
                    description="Path to athlete_profile.json",
                    required=True,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": "WeeklyComparison with aggregated metrics and patterns",
            },
            version="1.0.0",
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute weekly comparison.

        Args:
            week_start_date: Week start date string in YYYY-MM-DD format (Monday)
            training_plan_path: Path to training plan JSON
            activities_csv_path: Path to activities CSV or Parquet
            athlete_profile_path: Path to athlete profile JSON

        Returns:
            ToolExecutionResult with WeeklyComparison as JSON
        """
        try:
            # Extract and validate parameters
            week_start_date = kwargs.get("week_start_date")
            training_plan_path = kwargs.get("training_plan_path")
            activities_csv_path = kwargs.get("activities_csv_path")
            athlete_profile_path = kwargs.get("athlete_profile_path")

            if not all(
                [week_start_date, training_plan_path, activities_csv_path, athlete_profile_path]
            ):
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=["Missing required parameters. All parameters are required."],
                )

            logger.info(
                f"[COMPARE WEEKLY WORKOUTS TOOL] Comparing week starting: {week_start_date}"
            )

            # Validate date format
            try:
                parsed_date = datetime.strptime(str(week_start_date), "%Y-%m-%d")
                logger.debug(f"[COMPARE WEEKLY WORKOUTS TOOL] Parsed week start: {parsed_date}")
            except ValueError:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[
                        f"Invalid date format: {week_start_date}. Expected format: YYYY-MM-DD (e.g., 2024-11-04)"
                    ],
                )

            # Validate file paths
            plan_path = Path(str(training_plan_path))
            if not plan_path.exists():
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Training plan file does not exist: {training_plan_path}"],
                )

            csv_path = Path(str(activities_csv_path))
            if not csv_path.exists():
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Activities file does not exist: {activities_csv_path}"],
                )

            profile_path = Path(str(athlete_profile_path))
            if not profile_path.exists():
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Athlete profile file does not exist: {athlete_profile_path}"],
                )

            # Load athlete profile
            profile = load_athlete_profile(profile_path)
            logger.debug(f"[COMPARE WEEKLY WORKOUTS TOOL] Loaded profile, FTP: {profile.ftp}")

            # Initialize WorkoutComparer
            comparer = WorkoutComparer(
                plan_path=plan_path,
                activities_path=csv_path,
                ftp=int(profile.ftp),
            )

            # Execute weekly comparison
            weekly_comparison = comparer.compare_weekly_workouts(str(week_start_date))

            # Serialize to JSON
            result_data: dict[str, Any] = {
                "week_number": weekly_comparison.week_number,
                "week_start_date": weekly_comparison.week_start_date.strftime("%Y-%m-%d"),
                "week_end_date": weekly_comparison.week_end_date.strftime("%Y-%m-%d"),
                "summary": {
                    "workouts_planned": weekly_comparison.workouts_planned,
                    "workouts_completed": weekly_comparison.workouts_completed,
                    "completion_rate_pct": weekly_comparison.completion_rate_pct,
                    "avg_compliance_score": weekly_comparison.avg_compliance_score,
                    "total_planned_tss": weekly_comparison.total_planned_tss,
                    "total_actual_tss": weekly_comparison.total_actual_tss,
                    "tss_compliance_pct": weekly_comparison.tss_compliance_pct,
                    "total_planned_duration_minutes": weekly_comparison.total_planned_duration_minutes,
                    "total_actual_duration_minutes": weekly_comparison.total_actual_duration_minutes,
                    "duration_compliance_pct": weekly_comparison.duration_compliance_pct,
                },
                "daily_comparisons": [
                    {
                        "date": comp.date.strftime("%Y-%m-%d"),
                        "compliance_score": comp.metrics.compliance_score,
                        "completed": comp.metrics.completed,
                        "workout_type": comp.planned.workout_type,
                    }
                    for comp in weekly_comparison.daily_comparisons
                ],
                "patterns": [
                    {
                        "pattern_type": pattern.pattern_type,
                        "description": pattern.description,
                        "severity": pattern.severity,
                        "affected_workouts": [
                            date.strftime("%Y-%m-%d") for date in pattern.affected_workouts
                        ],
                    }
                    for pattern in weekly_comparison.patterns
                ],
                "weekly_recommendation": weekly_comparison.weekly_recommendation,
            }

            return ToolExecutionResult(
                success=True,
                data=result_data,
                format="json",
                metadata={
                    "week_start_date": str(week_start_date),
                    "workouts_planned": weekly_comparison.workouts_planned,
                    "workouts_completed": weekly_comparison.workouts_completed,
                    "completion_rate_pct": weekly_comparison.completion_rate_pct,
                    "avg_compliance_score": weekly_comparison.avg_compliance_score,
                },
            )

        except Exception as e:
            logger.error(f"[COMPARE WEEKLY WORKOUTS TOOL] Error: {str(e)}", exc_info=True)
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Unexpected error during execution: {str(e)}"],
            )


# Register tools for auto-discovery
register_tool(CompareWorkoutTool())
register_tool(CompareWeeklyWorkoutsTool())
