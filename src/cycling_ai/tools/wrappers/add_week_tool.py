"""
Add week details tool - Phase 2 of two-phase plan generation.

Adds detailed workout structure for a single week to an existing plan.
Called once per week (e.g., 12 times for a 12-week plan).
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from cycling_ai.tools.base import (
    BaseTool,
    ToolDefinition,
    ToolExecutionResult,
    ToolParameter,
)
from cycling_ai.tools.registry import register_tool

logger = logging.getLogger(__name__)


def _convert_to_native_types(obj: Any) -> Any:
    """
    Recursively convert protobuf objects to native Python types.

    Handles RepeatedComposite (list-like), protobuf messages (dict-like),
    and nested structures.
    """
    if isinstance(obj, (str, bytes, int, float, bool, type(None))):
        # Primitive types - return as-is
        return obj
    elif isinstance(obj, dict):
        return {key: _convert_to_native_types(value) for key, value in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [_convert_to_native_types(item) for item in obj]
    elif hasattr(obj, 'items') and callable(getattr(obj, 'items')):
        # Handle protobuf message-like objects with items()
        return {key: _convert_to_native_types(value) for key, value in obj.items()}
    elif hasattr(obj, '__iter__'):
        # Handle protobuf RepeatedComposite and similar iterable types
        return [_convert_to_native_types(item) for item in obj]
    else:
        # Unknown type - return as-is
        return obj


class AddWeekDetailsTool(BaseTool):
    """
    Tool for adding weekly workout details (Phase 2 of 2-phase generation).

    Adds detailed workouts with segments for a single week to an existing plan.
    Must be called once for each week in the plan.
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="add_week_details",
            description=(
                "PHASE 2: Add detailed workouts for ONE week to the training plan. "
                "Specify week_number and provide full workout array with segments. "
                "Call this tool ONCE FOR EACH WEEK (e.g., 12 times for 12-week plan). "
                "Use the plan_id returned by create_plan_overview."
            ),
            category="analysis",
            returns={
                "type": "object",
                "format": "json",
                "description": "Week details saved with progress tracking",
            },
            parameters=[
                ToolParameter(
                    name="plan_id",
                    type="string",
                    description="Plan ID returned by create_plan_overview",
                    required=True,
                ),
                ToolParameter(
                    name="week_number",
                    type="integer",
                    description="Week number (1 to total_weeks)",
                    required=True,
                    min_value=1,
                    max_value=52,
                ),
                ToolParameter(
                    name="workouts",
                    type="array",
                    description=(
                        "Array of workout objects for this week. "
                        "ONLY include training days, NOT rest days. "
                        "Each workout: weekday (Monday-Sunday), description, "
                        "segments (array with type, duration_min, power_low_pct, power_high_pct, description). "
                        "Each segment MUST have all required fields."
                    ),
                    required=True,
                    items={
                        "type": "object",
                        "properties": {
                            "weekday": {"type": "string"},
                            "description": {"type": "string"},
                            "segments": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "type": {"type": "string"},
                                        "duration_min": {"type": "integer"},
                                        "power_low_pct": {"type": "number"},
                                        "power_high_pct": {"type": "number"},
                                        "description": {"type": "string"},
                                    },
                                },
                            },
                        },
                    },
                ),
            ],
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute add week details.

        Args:
            **kwargs: Tool parameters (plan_id, week_number, workouts)

        Returns:
            ToolExecutionResult with success status and progress info
        """
        logger.info("=" * 80)
        logger.info("TOOL EXECUTION START: add_week_details")
        logger.info("=" * 80)

        try:
            # Extract parameters
            plan_id = kwargs.get("plan_id")
            week_number_raw = kwargs.get("week_number")
            workouts_raw = kwargs.get("workouts", [])

            # Convert to proper types (LLM may pass numbers as float)
            week_number = int(week_number_raw) if week_number_raw else None

            # Convert protobuf objects to native Python types
            workouts = _convert_to_native_types(workouts_raw)

            logger.info(f"Parameters:")
            logger.info(f"  - plan_id: {plan_id}")
            logger.info(f"  - week_number: {week_number}")
            logger.info(f"  - workouts: {len(workouts)} workouts provided")

            # Validate required parameters
            if not plan_id:
                raise ValueError("plan_id is required")
            if not week_number:
                raise ValueError("week_number is required")
            if not workouts:
                raise ValueError("workouts array is required (empty array is OK for rest weeks)")

            # Load existing overview
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

            total_weeks = overview_data["total_weeks"]

            # Validate week_number
            if week_number < 1 or week_number > total_weeks:
                raise ValueError(
                    f"week_number must be between 1 and {total_weeks}, got {week_number}"
                )

            # Validate workouts structure
            for i, workout in enumerate(workouts):
                if "weekday" not in workout:
                    raise ValueError(f"Workout {i+1} missing 'weekday' field")
                if "description" not in workout:
                    raise ValueError(f"Workout {i+1} missing 'description' field")
                if "segments" not in workout or not workout["segments"]:
                    raise ValueError(
                        f"Workout {i+1} missing 'segments' array or array is empty. "
                        f"Each workout must have at least one segment."
                    )

                # Validate each segment
                for j, segment in enumerate(workout["segments"]):
                    required_fields = ["type", "duration_min", "power_low_pct", "description"]
                    for field in required_fields:
                        if field not in segment:
                            raise ValueError(
                                f"Workout {i+1}, segment {j+1} missing required field: '{field}'"
                            )

            # Create week data structure
            week_data = {
                "week_number": week_number,
                "workouts": workouts,
            }

            # Save week details to separate file
            week_file = temp_dir / f"{plan_id}_week_{week_number}.json"

            logger.info(f"Saving week {week_number} details to: {week_file}")
            with open(week_file, "w") as f:
                json.dump(week_data, f, indent=2)

            # Update overview progress counter
            overview_data["weeks_completed"] = overview_data.get("weeks_completed", 0) + 1
            with open(overview_file, "w") as f:
                json.dump(overview_data, f, indent=2)

            weeks_completed = overview_data["weeks_completed"]
            weeks_remaining = total_weeks - weeks_completed

            logger.info(f"Week {week_number} saved successfully")
            logger.info(f"Progress: {weeks_completed}/{total_weeks} weeks completed")
            logger.info("=" * 80)
            logger.info("TOOL EXECUTION COMPLETE: add_week_details")
            logger.info("=" * 80)

            # Return success with progress info
            next_step = (
                f"Call add_week_details for remaining {weeks_remaining} week(s)"
                if weeks_remaining > 0
                else "All weeks complete! Your work in this phase is done. The plan will be finalized automatically."
            )

            return ToolExecutionResult(
                success=True,
                data={
                    "plan_id": plan_id,
                    "week_number": week_number,
                    "workouts_added": len(workouts),
                    "weeks_completed": weeks_completed,
                    "weeks_remaining": weeks_remaining,
                    "total_weeks": total_weeks,
                    "next_step": next_step,
                    "message": f"Week {week_number} details added. {weeks_completed}/{total_weeks} weeks complete.",
                },
                format="json",
                metadata={
                    "plan_id": plan_id,
                    "week_number": week_number,
                    "progress_percent": (weeks_completed / total_weeks) * 100,
                },
            )

        except ValueError as e:
            logger.error(f"Parameter validation error: {str(e)}")
            logger.info("=" * 80)
            logger.info("TOOL EXECUTION FAILED: add_week_details")
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
            logger.info("TOOL EXECUTION FAILED: add_week_details")
            logger.info("=" * 80)
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Unexpected error: {str(e)}"],
            )


# Register tool with global registry
register_tool(AddWeekDetailsTool())
