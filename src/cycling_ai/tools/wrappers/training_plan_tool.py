"""
Training plan generation tool wrapper.

Wraps core.training.generate_training_plan() as a BaseTool for LLM provider integration.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from cycling_ai.core.athlete import load_athlete_profile
from cycling_ai.core.training import generate_training_plan
from cycling_ai.tools.base import (
    BaseTool,
    ToolDefinition,
    ToolExecutionResult,
    ToolParameter,
)
from cycling_ai.tools.registry import register_tool


class TrainingPlanTool(BaseTool):
    """
    Tool for generating progressive training plans.

    Creates periodized week-by-week plans with Foundation, Build, Recovery,
    and Peak phases tailored to athlete's availability and goals.
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="generate_training_plan",
            description=(
                "Generate a progressive, periodized training plan based on athlete's "
                "current fitness, goals, and availability. Creates structured week-by-week "
                "plan with Foundation (base building), Build (intensity), Recovery (adaptation), "
                "and Peak (performance) phases. Includes specific workouts with power targets, "
                "SVG visualizations, and personalized recommendations based on age, training status, "
                "and available training days."
            ),
            category="analysis",
            parameters=[
                ToolParameter(
                    name="athlete_profile_json",
                    type="string",
                    description=(
                        "Path to athlete_profile.json. Required for FTP, age, "
                        "training availability (days/week), and goals."
                    ),
                    required=True,
                ),
                ToolParameter(
                    name="total_weeks",
                    type="integer",
                    description=(
                        "Duration of training plan in weeks. Minimum 4, maximum 24. "
                        "Longer plans allow for more gradual progression."
                    ),
                    required=False,
                    default=12,
                    min_value=4,
                    max_value=24,
                ),
                ToolParameter(
                    name="target_ftp",
                    type="number",
                    description=(
                        "Target FTP in watts. If not provided, defaults to +6% of current FTP. "
                        "Should be realistic based on plan duration and current fitness."
                    ),
                    required=False,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": (
                    "JSON object containing: athlete_profile, ftp_progression, power_zones, "
                    "weekly_workouts (with SVG visualizations), plan_text (formatted markdown), "
                    "llm_context for personalized coaching recommendations."
                ),
            },
            version="1.0.0",
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute training plan generation.

        Args:
            **kwargs: Tool parameters (athlete_profile_json, total_weeks, target_ftp)

        Returns:
            ToolExecutionResult with training plan data or errors
        """
        try:
            # Validate parameters against tool definition
            self.validate_parameters(**kwargs)

            # Extract parameters
            athlete_profile_json = kwargs["athlete_profile_json"]
            total_weeks = kwargs.get("total_weeks", 12)
            target_ftp = kwargs.get("target_ftp")

            # Validate profile path
            profile_path = Path(athlete_profile_json)
            if not profile_path.exists():
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[
                        f"Athlete profile not found at path: {athlete_profile_json}"
                    ],
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

            # Get available training days from profile
            available_days = athlete_profile.get_training_days_count()

            # Generate training plan
            result_json = generate_training_plan(
                current_ftp=athlete_profile.ftp,
                available_days_per_week=available_days,
                target_ftp=target_ftp,
                total_weeks=total_weeks,
                athlete_age=athlete_profile.age,
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
                    errors=[f"Invalid JSON returned from training plan: {str(e)}"],
                )

            # Return successful result
            return ToolExecutionResult(
                success=True,
                data=result_data,
                format="json",
                metadata={
                    "athlete": athlete_profile.name,
                    "current_ftp": athlete_profile.ftp,
                    "target_ftp": result_data.get("target_ftp"),
                    "total_weeks": total_weeks,
                    "available_days": available_days,
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
register_tool(TrainingPlanTool())
