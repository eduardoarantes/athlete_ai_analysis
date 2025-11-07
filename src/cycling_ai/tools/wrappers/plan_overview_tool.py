"""
Training plan overview tool - Phase 1 of two-phase plan generation.

Creates high-level plan structure with weekly overview (phases, TSS, focus).
Part of the two-phase approach to avoid massive JSON generation in one call.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime
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


class PlanOverviewTool(BaseTool):
    """
    Tool for creating training plan overview (Phase 1 of 2-phase generation).

    Generates high-level structure: periodization, weekly phases, TSS targets,
    coaching notes. Returns plan_id for subsequent week detail calls.
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="create_plan_overview",
            description=(
                "PHASE 1: Create high-level training plan overview. "
                "Generate periodization strategy, weekly phase assignments, TSS targets, "
                "and coaching guidance. Returns plan_id for adding weekly details. "
                "This is the FIRST tool you must call when creating a training plan."
            ),
            category="analysis",
            returns={
                "type": "object",
                "format": "json",
                "description": "Plan overview with generated plan_id for next phase",
            },
            parameters=[
                ToolParameter(
                    name="athlete_profile_json",
                    type="string",
                    description="Path to athlete_profile.json for athlete metadata",
                    required=True,
                ),
                ToolParameter(
                    name="total_weeks",
                    type="integer",
                    description="Total number of weeks in the plan (4-24)",
                    required=True,
                    min_value=4,
                    max_value=24,
                ),
                ToolParameter(
                    name="target_ftp",
                    type="number",
                    description="Target FTP goal in watts",
                    required=True,
                ),
                ToolParameter(
                    name="weekly_overview",
                    type="array",
                    description=(
                        "Array of weekly overview objects (one per week). "
                        "Each week: week_number (1..total_weeks), phase (Foundation/Build/Recovery/Peak/Taper), "
                        "phase_rationale (why this phase), weekly_focus (key focus), "
                        "weekly_watch_points (monitoring points), "
                        "training_days (array of 7 day objects with weekday and workout_type), "
                        "target_tss (weekly TSS), total_hours (target weekly hours)"
                    ),
                    required=True,
                    items={
                        "type": "object",
                        "properties": {
                            "week_number": {"type": "integer"},
                            "phase": {"type": "string"},
                            "phase_rationale": {"type": "string"},
                            "weekly_focus": {"type": "string"},
                            "weekly_watch_points": {"type": "string"},
                            "training_days": {
                                "type": "array",
                                "minItems": 7,
                                "maxItems": 7,
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "weekday": {
                                            "type": "string",
                                            "enum": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
                                            "description": "Day of the week"
                                        },
                                        "workout_type": {
                                            "type": "string",
                                            "enum": ["rest", "recovery", "endurance", "tempo", "sweet_spot", "threshold", "vo2max", "mixed"],
                                            "description": "Workout type from library (or rest)"
                                        },
                                        "optional": {
                                            "type": "boolean",
                                            "description": "Whether this training day is optional (default: false)"
                                        }
                                    },
                                    "required": ["weekday", "workout_type"]
                                },
                                "description": "All 7 weekdays with prescribed workout types from library"
                            },
                            "target_tss": {"type": "number"},
                            "total_hours": {"type": "number"},
                        },
                    },
                ),
                ToolParameter(
                    name="coaching_notes",
                    type="string",
                    description="Overall coaching strategy and rationale (200-400 words)",
                    required=True,
                ),
                ToolParameter(
                    name="monitoring_guidance",
                    type="string",
                    description="KPIs to track and warning signs (150-300 words)",
                    required=True,
                ),
            ],
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute plan overview creation.

        Args:
            **kwargs: Tool parameters (athlete_profile_json, total_weeks, etc.)

        Returns:
            ToolExecutionResult with plan_id for subsequent calls
        """
        logger.info("=" * 80)
        logger.info("TOOL EXECUTION START: create_plan_overview")
        logger.info("=" * 80)

        try:
            # Extract parameters
            athlete_profile_json = kwargs.get("athlete_profile_json")
            total_weeks_raw = kwargs.get("total_weeks")
            target_ftp_raw = kwargs.get("target_ftp")
            weekly_overview_raw = kwargs.get("weekly_overview", [])
            coaching_notes = kwargs.get("coaching_notes", "")
            monitoring_guidance = kwargs.get("monitoring_guidance", "")

            # Convert to proper types (LLM may pass numbers as float)
            total_weeks = int(total_weeks_raw) if total_weeks_raw else None
            target_ftp = float(target_ftp_raw) if target_ftp_raw else None

            # Convert protobuf objects to native Python types
            weekly_overview = _convert_to_native_types(weekly_overview_raw)

            logger.info(f"Parameters:")
            logger.info(f"  - athlete_profile_json: {athlete_profile_json}")
            logger.info(f"  - total_weeks: {total_weeks}")
            logger.info(f"  - target_ftp: {target_ftp}")
            logger.info(f"  - weekly_overview entries: {len(weekly_overview)}")

            # Validate required parameters
            if not athlete_profile_json:
                raise ValueError("athlete_profile_json is required")
            if not total_weeks:
                raise ValueError("total_weeks is required")

            # Validate plan duration early (fail fast)
            if total_weeks < 4 or total_weeks > 24:
                raise ValueError(
                    f"Plan duration must be between 4 and 24 weeks. Got {total_weeks} weeks.\n"
                    f"For testing, use at least 4 weeks. For real plans, 8-16 weeks is recommended."
                )

            if not target_ftp:
                raise ValueError("target_ftp is required")
            if not weekly_overview:
                raise ValueError("weekly_overview is required")
            if len(weekly_overview) != total_weeks:
                raise ValueError(
                    f"weekly_overview must have exactly {total_weeks} entries, got {len(weekly_overview)}"
                )

            # Validate training_days in each week
            valid_weekdays = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
            valid_workout_types = {"rest", "recovery", "endurance", "tempo", "sweet_spot", "threshold", "vo2max", "mixed"}
            hard_workout_types = {"threshold", "vo2max", "sweet_spot"}

            for i, week in enumerate(weekly_overview):
                week_num = week.get("week_number", i + 1)
                training_days = week.get("training_days", [])

                if not training_days:
                    raise ValueError(
                        f"Week {week_num} missing 'training_days' array. "
                        f"You must specify ALL 7 weekdays with workout types."
                    )

                if len(training_days) != 7:
                    raise ValueError(
                        f"Week {week_num} has {len(training_days)} training day entries. "
                        f"Must have exactly 7 entries (one for each weekday)."
                    )

                # Collect weekdays and workout types for validation
                weekdays_seen = set()
                non_rest_days = 0
                hard_days_count = 0

                for day_obj in training_days:
                    # Validate structure
                    if not isinstance(day_obj, dict):
                        raise ValueError(
                            f"Week {week_num}: training_days entries must be objects with 'weekday' and 'workout_type'. "
                            f"Got: {day_obj}"
                        )

                    weekday = day_obj.get("weekday")
                    workout_type_raw = day_obj.get("workout_type")

                    if not weekday:
                        raise ValueError(
                            f"Week {week_num}: training day entry missing 'weekday' field: {day_obj}"
                        )

                    if not workout_type_raw:
                        raise ValueError(
                            f"Week {week_num}: training day entry missing 'workout_type' field: {day_obj}"
                        )

                    # Normalize workout_type to lowercase (LLMs sometimes return "Endurance" instead of "endurance")
                    workout_type = workout_type_raw.lower() if isinstance(workout_type_raw, str) else workout_type_raw

                    # Validate weekday
                    if weekday not in valid_weekdays:
                        raise ValueError(
                            f"Week {week_num} has invalid weekday '{weekday}'. "
                            f"Must be one of: {', '.join(sorted(valid_weekdays))}"
                        )

                    # Check for duplicate weekdays
                    if weekday in weekdays_seen:
                        raise ValueError(
                            f"Week {week_num} has duplicate weekday: {weekday}"
                        )
                    weekdays_seen.add(weekday)

                    # Validate workout_type
                    if workout_type not in valid_workout_types:
                        raise ValueError(
                            f"Week {week_num}, {weekday} has invalid workout_type '{workout_type_raw}' "
                            f"(normalized to '{workout_type}'). "
                            f"Must be one of (case-insensitive): {', '.join(sorted(valid_workout_types))}"
                        )

                    # Update the day_obj with normalized value
                    day_obj["workout_type"] = workout_type

                    # Count non-rest days and hard days
                    if workout_type != "rest":
                        non_rest_days += 1
                        if workout_type in hard_workout_types:
                            hard_days_count += 1

                # Validate all weekdays present
                if weekdays_seen != valid_weekdays:
                    missing = valid_weekdays - weekdays_seen
                    raise ValueError(
                        f"Week {week_num} missing weekdays: {', '.join(sorted(missing))}. "
                        f"Must include all 7 weekdays."
                    )

                # Validate training day count
                if non_rest_days > 5:
                    raise ValueError(
                        f"Week {week_num} has {non_rest_days} non-rest days. "
                        f"Maximum is 5 training days to ensure adequate rest and recovery (minimum 2 rest days)."
                    )

                if non_rest_days < 2:
                    logger.warning(
                        f"Week {week_num} has only {non_rest_days} training days. "
                        f"Consider adding more training volume."
                    )

                # Validate hard day count
                if hard_days_count > 3:
                    raise ValueError(
                        f"Week {week_num} has {hard_days_count} hard days (threshold/vo2max/sweet_spot). "
                        f"Maximum is 3 hard days per week to ensure adequate recovery."
                    )

                logger.debug(
                    f"Week {week_num} validation passed: "
                    f"{non_rest_days} training days ({hard_days_count} hard, {non_rest_days - hard_days_count} easy/moderate)"
                )

            # Generate unique plan ID
            plan_id = str(uuid.uuid4())
            logger.info(f"Generated plan_id: {plan_id}")

            # Create overview data structure
            overview_data = {
                "plan_id": plan_id,
                "athlete_profile_json": athlete_profile_json,
                "total_weeks": total_weeks,
                "target_ftp": target_ftp,
                "weekly_overview": weekly_overview,
                "coaching_notes": coaching_notes,
                "monitoring_guidance": monitoring_guidance,
                "weeks_completed": 0,  # Track progress
                "created_at": str(datetime.now()),
            }

            # Save overview to temp file
            temp_dir = Path("/tmp")
            overview_file = temp_dir / f"{plan_id}_overview.json"

            logger.info(f"Saving overview to: {overview_file}")
            with open(overview_file, "w") as f:
                json.dump(overview_data, f, indent=2)

            logger.info(f"Overview saved successfully")
            logger.info("=" * 80)
            logger.info("TOOL EXECUTION COMPLETE: create_plan_overview")
            logger.info("=" * 80)

            # Return plan_id and summary
            return ToolExecutionResult(
                success=True,
                data={
                    "plan_id": plan_id,
                    "total_weeks": total_weeks,
                    "target_ftp": target_ftp,
                    "overview_file": str(overview_file),
                    "next_step": f"Call add_week_details for weeks 1-{total_weeks}",
                    "message": f"Plan overview created successfully. Next: add details for {total_weeks} weeks.",
                },
                format="json",
                metadata={
                    "plan_id": plan_id,
                    "total_weeks": total_weeks,
                    "weeks_remaining": total_weeks,
                },
            )

        except ValueError as e:
            logger.error(f"Parameter validation error: {str(e)}")
            logger.info("=" * 80)
            logger.info("TOOL EXECUTION FAILED: create_plan_overview")
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
            logger.info("TOOL EXECUTION FAILED: create_plan_overview")
            logger.info("=" * 80)
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Unexpected error: {str(e)}"],
            )


# Register tool with global registry
register_tool(PlanOverviewTool())
