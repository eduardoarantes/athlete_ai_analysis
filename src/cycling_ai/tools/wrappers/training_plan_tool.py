"""
Training plan finalization tool wrapper.

Wraps core.training.finalize_training_plan() as a BaseTool for LLM provider integration.
The LLM designs the plan using create_workout and calculate_power_zones tools,
then uses this tool to save the complete plan.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from cycling_ai.core.athlete import load_athlete_profile
from cycling_ai.core.training import finalize_training_plan
from cycling_ai.tools.base import (
    BaseTool,
    ToolDefinition,
    ToolExecutionResult,
    ToolParameter,
)
from cycling_ai.tools.registry import register_tool


class TrainingPlanTool(BaseTool):
    """
    Tool for finalizing LLM-designed training plans.

    Validates and saves a complete training plan designed by the LLM agent.
    The LLM is responsible for creating individual workouts (using create_workout)
    and organizing them into a weekly structure.
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="finalize_training_plan",
            description=(
                "Finalize and save your complete training plan design. Use this tool to submit "
                "your entire training plan in one call. Include: "
                "1) All weeks with their phases and rationale, "
                "2) All workouts with segments (warm-up, intervals, recovery, cool-down), "
                "3) Coaching notes explaining your design decisions, "
                "4) Monitoring guidance for the athlete. "
                "This tool validates your plan and saves it for report generation."
            ),
            category="analysis",
            parameters=[
                ToolParameter(
                    name="athlete_profile_json",
                    type="string",
                    description=(
                        "Path to athlete_profile.json. Required for athlete metadata and validation."
                    ),
                    required=True,
                ),
                ToolParameter(
                    name="total_weeks",
                    type="integer",
                    description=(
                        "Total duration of your plan in weeks (4-24). Must match the number of weeks "
                        "in your weekly_plan array."
                    ),
                    required=True,
                    min_value=4,
                    max_value=24,
                ),
                ToolParameter(
                    name="target_ftp",
                    type="number",
                    description=(
                        "Target FTP goal in watts. Should be realistic based on plan duration, "
                        "athlete's current fitness, and performance trends. Explain your rationale "
                        "for this target in coaching_notes."
                    ),
                    required=True,
                ),
                ToolParameter(
                    name="weekly_plan",
                    type="array",
                    description=(
                        "Array of week objects (one per week). Each week must include: "
                        "week_number (1 to total_weeks), phase (e.g., 'Foundation', 'Build', 'Recovery', 'Peak'), "
                        "phase_rationale (why this phase for this week), "
                        "workouts (object mapping day names like 'Monday', 'Wednesday' to workout objects), "
                        "weekly_focus (key training focus for the week), "
                        "monitoring_notes (what athlete should watch this week). "
                        "Each workout object must contain: name, description, segments (array of segment objects). "
                        "Each segment must have: type (warmup/interval/recovery/cooldown/steady), duration_min, "
                        "power_low (watts), power_high (watts, optional), description."
                    ),
                    required=True,
                    items={
                        "type": "OBJECT",
                        "properties": {
                            "week_number": {
                                "type": "INTEGER",
                                "description": "Week number (1 to total_weeks)"
                            },
                            "phase": {
                                "type": "STRING",
                                "description": "Training phase (e.g., Foundation, Build, Recovery, Peak)"
                            },
                            "phase_rationale": {
                                "type": "STRING",
                                "description": "Explanation of why this phase for this week"
                            },
                            "workouts": {
                                "type": "OBJECT",
                                "description": "Object mapping day names to workout objects with name, description, and segments"
                            },
                            "weekly_focus": {
                                "type": "STRING",
                                "description": "Key training focus for the week"
                            },
                            "monitoring_notes": {
                                "type": "STRING",
                                "description": "What athlete should monitor this week"
                            }
                        },
                        "required": ["week_number", "phase", "workouts", "weekly_focus"]
                    },
                ),
                ToolParameter(
                    name="coaching_notes",
                    type="string",
                    description=(
                        "Your overall coaching guidance for this plan. Explain: "
                        "- Why you chose this structure and periodization "
                        "- How this plan addresses the athlete's specific needs and performance trends "
                        "- Key success factors and considerations "
                        "- How the plan aligns with the athlete's goals "
                        "Be specific and reference the actual performance data you analyzed."
                    ),
                    required=True,
                ),
                ToolParameter(
                    name="monitoring_guidance",
                    type="string",
                    description=(
                        "What the athlete should monitor throughout the plan: "
                        "- Key performance indicators to track "
                        "- Warning signs that might require plan adjustment "
                        "- When to consider rest or recovery "
                        "- Specific metrics relevant to this athlete's situation"
                    ),
                    required=True,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": (
                    "Complete validated training plan with athlete profile, plan metadata, "
                    "coaching notes, monitoring guidance, and weekly structure."
                ),
            },
            version="2.0.0",
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute training plan finalization.

        Args:
            **kwargs: Tool parameters

        Returns:
            ToolExecutionResult with finalized plan or errors
        """
        try:
            # Validate parameters against tool definition
            self.validate_parameters(**kwargs)

            # Extract parameters
            athlete_profile_json = kwargs["athlete_profile_json"]
            total_weeks = int(kwargs["total_weeks"])
            target_ftp = float(kwargs["target_ftp"])
            weekly_plan = kwargs["weekly_plan"]
            coaching_notes = kwargs["coaching_notes"]
            monitoring_guidance = kwargs["monitoring_guidance"]

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

            # Validate weekly_plan is a list
            if not isinstance(weekly_plan, list):
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=["weekly_plan must be an array of week objects"],
                )

            # Finalize the plan
            try:
                result_json = finalize_training_plan(
                    athlete_profile=athlete_profile,
                    total_weeks=total_weeks,
                    target_ftp=target_ftp,
                    weekly_plan=weekly_plan,
                    coaching_notes=coaching_notes,
                    monitoring_guidance=monitoring_guidance,
                )
            except ValueError as e:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Plan validation error: {str(e)}"],
                )

            # Parse result JSON
            try:
                result_data = json.loads(result_json)
            except json.JSONDecodeError as e:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Invalid JSON from finalize_training_plan: {str(e)}"],
                )

            # Return successful result
            return ToolExecutionResult(
                success=True,
                data=result_data,
                format="json",
                metadata={
                    "athlete": athlete_profile.name,
                    "current_ftp": athlete_profile.ftp,
                    "target_ftp": target_ftp,
                    "total_weeks": total_weeks,
                    "weeks_in_plan": len(weekly_plan),
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
