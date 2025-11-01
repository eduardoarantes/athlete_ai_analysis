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

from cycling_ai.core.tss import calculate_weekly_tss
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

            # Get week-specific targets from overview
            week_overview = next(
                (w for w in overview_data.get("weekly_overview", []) if w.get("week_number") == week_number),
                None
            )

            if not week_overview:
                logger.warning(f"No overview found for week {week_number}, skipping target validation")
                week_overview = {}

            target_tss = week_overview.get("target_tss")
            target_hours = week_overview.get("total_hours")
            current_ftp = overview_data.get("target_ftp", 250)  # Default FTP if not provided
            week_phase = week_overview.get("phase", "").lower()

            # Calculate actual weekly metrics
            total_duration_min = sum(
                sum(seg.get("duration_min", 0) for seg in workout.get("segments", []))
                for workout in workouts
            )
            total_hours = total_duration_min / 60.0

            # Calculate actual TSS
            actual_tss = calculate_weekly_tss(workouts, current_ftp)

            # Validation warnings/errors
            validation_warnings = []
            validation_errors = []

            # Phase-aware tolerance: stricter for Recovery/Taper weeks
            is_recovery_week = week_phase in ["recovery", "taper"]
            if is_recovery_week:
                # Recovery weeks: tighter tolerances to ensure reduced volume
                time_warn_threshold = 8   # ±8% warning
                time_error_threshold = 15  # ±15% error (stricter than normal 20%)
                tss_warn_threshold = 12   # ±12% warning
                tss_error_threshold = 20  # ±20% error (stricter than normal 25%)
            else:
                # Normal weeks: standard tolerances
                time_warn_threshold = 10
                time_error_threshold = 20
                tss_warn_threshold = 15
                tss_error_threshold = 25

            # Check weekly time budget with phase-aware tolerances
            if target_hours:
                time_diff_pct = abs(total_hours - target_hours) / target_hours * 100
                if time_diff_pct > time_error_threshold:
                    phase_note = " (Recovery week - stricter tolerance)" if is_recovery_week else ""
                    validation_errors.append(
                        f"Week {week_number} time budget violation: "
                        f"Planned {total_hours:.1f}h vs target {target_hours:.1f}h "
                        f"({time_diff_pct:.0f}% difference, max {time_error_threshold}% allowed{phase_note})"
                    )
                elif time_diff_pct > time_warn_threshold:
                    validation_warnings.append(
                        f"Week {week_number} time budget warning: "
                        f"Planned {total_hours:.1f}h vs target {target_hours:.1f}h "
                        f"({time_diff_pct:.0f}% difference, recommend ±{time_warn_threshold}%)"
                    )

            # Check weekly TSS target with phase-aware tolerances
            if target_tss:
                tss_diff_pct = abs(actual_tss - target_tss) / target_tss * 100
                if tss_diff_pct > tss_error_threshold:
                    phase_note = " (Recovery week - stricter tolerance)" if is_recovery_week else ""
                    validation_errors.append(
                        f"Week {week_number} TSS target violation: "
                        f"Actual {actual_tss:.0f} TSS vs target {target_tss:.0f} TSS "
                        f"({tss_diff_pct:.0f}% difference, max {tss_error_threshold}% allowed{phase_note})"
                    )
                elif tss_diff_pct > tss_warn_threshold:
                    validation_warnings.append(
                        f"Week {week_number} TSS target warning: "
                        f"Actual {actual_tss:.0f} TSS vs target {target_tss:.0f} TSS "
                        f"({tss_diff_pct:.0f}% difference, recommend ±{tss_warn_threshold}%)"
                    )

            # Log warnings
            if validation_warnings:
                for warning in validation_warnings:
                    logger.warning(warning)

            # Fail if validation errors
            if validation_errors:
                error_msg = "\n".join(validation_errors)
                logger.error(f"Week {week_number} validation failed:\n{error_msg}")
                raise ValueError(
                    f"Week {week_number} validation failed. Please adjust workouts:\n{error_msg}\n\n"
                    f"Suggestions:\n"
                    f"- To reduce time: Shorten segment durations or remove recovery segments\n"
                    f"- To increase time: Add warmup/cooldown or extend main set duration\n"
                    f"- To reduce TSS: Lower power targets or shorten high-intensity intervals\n"
                    f"- To increase TSS: Raise power targets or extend work intervals"
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

            # Track completed weeks as a set (not a count) to handle retries correctly
            completed_weeks = set(overview_data.get("weeks_completed_list", []))
            completed_weeks.add(week_number)
            overview_data["weeks_completed_list"] = sorted(list(completed_weeks))
            overview_data["weeks_completed"] = len(completed_weeks)  # Update count from unique weeks

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

            # Build success message with validation metrics
            success_message = f"Week {week_number} details added. {weeks_completed}/{total_weeks} weeks complete."

            # Add validation summary
            validation_summary = []
            if target_hours:
                time_status = "✓" if abs(total_hours - target_hours) / target_hours * 100 <= 10 else "⚠"
                validation_summary.append(
                    f"{time_status} Time: {total_hours:.1f}h (target: {target_hours:.1f}h)"
                )
            if target_tss:
                tss_status = "✓" if abs(actual_tss - target_tss) / target_tss * 100 <= 15 else "⚠"
                validation_summary.append(
                    f"{tss_status} TSS: {actual_tss:.0f} (target: {target_tss:.0f})"
                )

            if validation_summary:
                success_message += "\n" + " | ".join(validation_summary)

            if validation_warnings:
                success_message += f"\n⚠ Warnings: {len(validation_warnings)}"

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
                    "message": success_message,
                    "validation": {
                        "target_hours": target_hours,
                        "actual_hours": round(total_hours, 1),
                        "target_tss": target_tss,
                        "actual_tss": round(actual_tss, 1),
                        "warnings": validation_warnings,
                        "within_tolerance": len(validation_warnings) == 0,
                    },
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
