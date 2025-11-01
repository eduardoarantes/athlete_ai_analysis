"""
Finalize training plan tool - Phase 3 of two-phase plan generation.

Assembles complete training plan from overview + all week details.
Called once after all weeks have been added.
"""
from __future__ import annotations

import json
import logging
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

logger = logging.getLogger(__name__)


class FinalizePlanTool(BaseTool):
    """
    Tool for finalizing training plan (Phase 3 of 2-phase generation).

    Assembles complete plan from overview + all week details, validates,
    and saves to output directory.
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="finalize_plan",
            description=(
                "PHASE 3: Assemble and save complete training plan. "
                "Loads overview + all week details, validates structure, "
                "and saves final plan JSON. Call this ONCE after ALL weeks "
                "have been added via add_week_details."
            ),
            category="analysis",
            returns={
                "type": "object",
                "format": "json",
                "description": "Complete training plan with all weeks assembled",
            },
            parameters=[
                ToolParameter(
                    name="plan_id",
                    type="string",
                    description="Plan ID from create_plan_overview",
                    required=True,
                ),
            ],
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute plan finalization.

        Args:
            **kwargs: Tool parameters (plan_id)

        Returns:
            ToolExecutionResult with complete training plan
        """
        logger.info("=" * 80)
        logger.info("TOOL EXECUTION START: finalize_plan")
        logger.info("=" * 80)

        try:
            # Extract parameters
            plan_id = kwargs.get("plan_id")

            logger.info(f"Parameters:")
            logger.info(f"  - plan_id: {plan_id}")

            # Validate required parameters
            if not plan_id:
                raise ValueError("plan_id is required")

            # Load overview
            temp_dir = Path("/tmp")
            overview_file = temp_dir / f"{plan_id}_overview.json"

            if not overview_file.exists():
                raise ValueError(
                    f"Plan overview not found for plan_id={plan_id}. "
                    f"You must call create_plan_overview first."
                )

            logger.info(f"Loading overview from: {overview_file}")
            with open(overview_file, "r") as f:
                overview_data = json.load(f)

            # Convert to int (LLM may pass as float)
            total_weeks = int(overview_data["total_weeks"])
            weeks_completed = int(overview_data.get("weeks_completed", 0))

            logger.info(f"Overview loaded: {total_weeks} weeks planned, {weeks_completed} completed")

            # Check if all weeks have been added
            if weeks_completed < total_weeks:
                raise ValueError(
                    f"Incomplete plan: Only {weeks_completed}/{total_weeks} weeks have been added. "
                    f"Call add_week_details for remaining {total_weeks - weeks_completed} weeks first."
                )

            # Load all week details
            weekly_plan = []
            for week_num in range(1, total_weeks + 1):
                week_file = temp_dir / f"{plan_id}_week_{week_num}.json"

                if not week_file.exists():
                    raise ValueError(
                        f"Week {week_num} details not found. "
                        f"Call add_week_details for week {week_num}."
                    )

                logger.info(f"Loading week {week_num} from: {week_file}")
                with open(week_file, "r") as f:
                    week_data = json.load(f)

                # Merge overview metadata with week details
                week_overview = overview_data["weekly_overview"][week_num - 1]
                merged_week = {
                    **week_overview,  # phase, target_tss, etc.
                    "workouts": week_data["workouts"],  # detailed workouts
                }

                weekly_plan.append(merged_week)

            logger.info(f"All {total_weeks} weeks loaded successfully")

            # Assemble complete training plan
            complete_plan = {
                "athlete_profile_json": overview_data["athlete_profile_json"],
                "total_weeks": total_weeks,
                "target_ftp": overview_data["target_ftp"],
                "coaching_notes": overview_data["coaching_notes"],
                "monitoring_guidance": overview_data["monitoring_guidance"],
                "weekly_plan": weekly_plan,
            }

            # Load athlete profile for validation and saving
            logger.info("Loading athlete profile...")
            athlete_profile = load_athlete_profile(overview_data["athlete_profile_json"])

            # Validate plan structure using core validation
            logger.info("Validating complete plan structure...")
            from cycling_ai.core.training import validate_training_plan

            available_days = athlete_profile.get_training_days()
            weekly_hours = athlete_profile.get_weekly_training_hours()

            valid, errors = validate_training_plan(
                complete_plan,
                available_days=available_days,
                weekly_hours=weekly_hours
            )
            if not valid:
                error_msg = "Plan validation failed:\n" + "\n".join(
                    f"  - {err}" for err in errors
                )
                raise ValueError(error_msg)

            logger.info("Plan validation passed")

            # Save complete plan using core finalize function
            logger.info("Saving complete training plan...")

            output_path = finalize_training_plan(
                athlete_profile=athlete_profile,
                total_weeks=total_weeks,
                target_ftp=overview_data["target_ftp"],
                weekly_plan=weekly_plan,
                coaching_notes=overview_data["coaching_notes"],
                monitoring_guidance=overview_data["monitoring_guidance"],
            )

            logger.info(f"Training plan saved to: {output_path}")

            # Clean up temp files
            logger.info("Cleaning up temporary files...")
            overview_file.unlink()
            for week_num in range(1, total_weeks + 1):
                week_file = temp_dir / f"{plan_id}_week_{week_num}.json"
                if week_file.exists():
                    week_file.unlink()

            logger.info("Temporary files cleaned up")
            logger.info("=" * 80)
            logger.info("TOOL EXECUTION COMPLETE: finalize_plan")
            logger.info("=" * 80)

            # Return complete plan
            return ToolExecutionResult(
                success=True,
                data=complete_plan,
                format="json",
                metadata={
                    "plan_id": plan_id,
                    "total_weeks": total_weeks,
                    "output_path": str(output_path),
                    "total_workouts": sum(len(week["workouts"]) for week in weekly_plan),
                },
            )

        except ValueError as e:
            logger.error(f"Parameter validation error: {str(e)}")
            logger.info("=" * 80)
            logger.info("TOOL EXECUTION FAILED: finalize_plan")
            logger.info("=" * 80)
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Parameter validation error: {str(e)}"],
            )
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}", exc_info=True)
            logger.info("=" * 80)
            logger.info("TOOL EXECUTION FAILED: finalize_plan")
            logger.info("=" * 80)
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Unexpected error: {str(e)}"],
            )


# Register tool with global registry
register_tool(FinalizePlanTool())
