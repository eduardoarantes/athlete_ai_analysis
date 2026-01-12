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
from cycling_ai.core.workout_library.structure_helpers import (
    calculate_structure_duration,
    extract_power_target,
    get_main_segment_from_structure,
    has_valid_structure,
)
from cycling_ai.tools.base import (
    BaseTool,
    ToolDefinition,
    ToolExecutionResult,
    ToolParameter,
)
from cycling_ai.tools.registry import register_tool

logger = logging.getLogger(__name__)


# ============================================================================
# Helper Functions for WorkoutStructure Validation
# ============================================================================


def _validate_workout_structure(workout: dict[str, Any], workout_index: int) -> None:
    """
    Validate a workout has valid structure.

    Args:
        workout: Workout dictionary with structure field
        workout_index: Index of workout in workouts array (for error messages)

    Raises:
        ValueError: If structure is invalid or missing required fields
    """
    if "structure" not in workout:
        raise ValueError(
            f"Workout {workout_index + 1} missing 'structure' field. "
            "All workouts must have a WorkoutStructure."
        )

    structure = workout["structure"]
    if not has_valid_structure(structure):
        raise ValueError(
            f"Workout {workout_index + 1} has invalid or empty structure. "
            "Structure must have at least one segment with steps."
        )

    # Extract structure data
    if hasattr(structure, "structure"):
        segments = structure.structure
    else:
        segments = structure.get("structure", [])

    # Validate each segment has valid steps
    for seg_idx, segment in enumerate(segments):
        seg_dict = segment if isinstance(segment, dict) else segment.model_dump()

        seg_type = seg_dict.get("type")
        if not seg_type:
            raise ValueError(
                f"Workout {workout_index + 1}, segment {seg_idx + 1} missing 'type' field"
            )

        if seg_type not in ["step", "repetition"]:
            raise ValueError(
                f"Workout {workout_index + 1}, segment {seg_idx + 1} has invalid type '{seg_type}'. "
                "Must be 'step' or 'repetition'"
            )

        steps = seg_dict.get("steps", [])
        if not steps:
            raise ValueError(
                f"Workout {workout_index + 1}, segment {seg_idx + 1} has no steps"
            )

        # Validate each step
        for step_idx, step in enumerate(steps):
            step_dict = step if isinstance(step, dict) else step.model_dump()

            if "name" not in step_dict:
                raise ValueError(
                    f"Workout {workout_index + 1}, segment {seg_idx + 1}, step {step_idx + 1} missing 'name'"
                )

            if "intensityClass" not in step_dict:
                raise ValueError(
                    f"Workout {workout_index + 1}, segment {seg_idx + 1}, step {step_idx + 1} missing 'intensityClass'"
                )

            if "length" not in step_dict:
                raise ValueError(
                    f"Workout {workout_index + 1}, segment {seg_idx + 1}, step {step_idx + 1} missing 'length'"
                )

            if "targets" not in step_dict:
                raise ValueError(
                    f"Workout {workout_index + 1}, segment {seg_idx + 1}, step {step_idx + 1} missing 'targets'"
                )


def _is_strength_workout_from_structure(workout: dict[str, Any]) -> bool:
    """
    Determine if a workout is a strength workout based on structure.

    Checks workout_type field first, then falls back to checking if all
    power targets are zero (strength training has no power targets).

    Args:
        workout: Workout dictionary

    Returns:
        True if strength workout, False if cycling workout
    """
    # Check explicit workout_type field first
    workout_type = workout.get("workout_type")
    if workout_type:
        return workout_type == "strength"

    # Check description for "strength" keyword
    if "strength" in workout.get("description", "").lower():
        return True

    # Check structure - strength workouts have all zero power targets
    structure = workout.get("structure")
    if not structure or not has_valid_structure(structure):
        return False

    if hasattr(structure, "structure"):
        segments = structure.structure
    else:
        segments = structure.get("structure", [])

    # Check if all power targets are zero
    for segment in segments:
        seg_dict = segment if isinstance(segment, dict) else segment.model_dump()
        steps = seg_dict.get("steps", [])

        for step in steps:
            step_dict = step if isinstance(step, dict) else step.model_dump()
            targets = step_dict.get("targets", [])

            for target in targets:
                target_dict = target if isinstance(target, dict) else target.model_dump()
                if target_dict.get("type") == "power":
                    max_value = target_dict.get("maxValue", 0)
                    if max_value > 0:
                        return False  # Has non-zero power, so it's cycling

    return True  # All power targets are zero, so it's strength


# ============================================================================
# Helper Functions for Week Validation
# ============================================================================


def _detect_optional_recovery_workout(
    workouts: list[dict[str, Any]], training_days_objects: list[dict[str, Any]], week_number: int
) -> tuple[int | None, str | None]:
    """
    Detect if this is a 6-day week with at least 1 recovery workout.

    If multiple recovery workouts exist, returns the first one.

    Args:
        workouts: List of workout dictionaries
        training_days_objects: Week overview training days (with workout_types array)
        week_number: Current week number (for logging)

    Returns:
        (recovery_workout_index_or_none, recovery_weekday_or_none)
    """
    # Count non-rest training days (days with at least one non-rest workout type)
    training_days_count = sum(
        1 for day in training_days_objects if isinstance(day, dict) and "rest" not in day.get("workout_types", [])
    )

    # Only applies to 6-day weeks
    if training_days_count != 6:
        return (None, None)

    # Find first recovery workout in training_days_objects
    recovery_weekday = None
    for day in training_days_objects:
        if isinstance(day, dict) and "recovery" in day.get("workout_types", []):
            recovery_weekday = day.get("weekday")
            break

    if not recovery_weekday:
        return (None, None)

    # Match recovery weekday to workout in workouts list
    for idx, workout in enumerate(workouts):
        if workout.get("weekday") == recovery_weekday:
            logger.info(
                f"Week {week_number}: Detected 6-day week with recovery workout "
                f"on {recovery_weekday} (workout index {idx})"
            )
            return (idx, recovery_weekday)

    # Recovery day defined but no matching workout (shouldn't happen)
    return (None, None)


def _calculate_week_metrics(
    workouts: list[dict[str, Any]], current_ftp: float, exclude_workout_index: int | None = None
) -> tuple[float, float]:
    """
    Calculate total hours and TSS for a week.

    Args:
        workouts: List of workout dictionaries
        current_ftp: Athlete's FTP
        exclude_workout_index: Optional workout index to exclude from calculation

    Returns:
        (total_hours, actual_tss)
    """
    # Filter workouts if needed
    if exclude_workout_index is not None:
        filtered_workouts = [workout for idx, workout in enumerate(workouts) if idx != exclude_workout_index]
    else:
        filtered_workouts = workouts

    # Exclude strength workouts from cycling volume calculations
    cycling_workouts = []
    for workout in filtered_workouts:
        if not _is_strength_workout_from_structure(workout):
            cycling_workouts.append(workout)

    # Calculate total duration from structure
    total_duration_min = sum(
        calculate_structure_duration(workout.get("structure", {}))
        for workout in cycling_workouts
    )
    total_hours = total_duration_min / 60.0

    # Calculate TSS
    actual_tss = calculate_weekly_tss(cycling_workouts, current_ftp)

    return (total_hours, actual_tss)


def _validate_time_budget(
    total_hours: float,
    target_hours: float | None,
    week_number: int,
    is_recovery_week: bool,
) -> tuple[list[str], list[str]]:
    """
    Validate weekly time budget against target.

    NOTE: TSS is no longer validated - it's calculated for informational purposes only.

    Args:
        total_hours: Calculated total hours
        target_hours: Target hours (optional)
        week_number: Week number for error messages
        is_recovery_week: If True, use stricter tolerances

    Returns:
        (warnings, errors)
    """
    warnings: list[str] = []
    errors: list[str] = []

    # Phase-aware tolerance: Recovery/Taper weeks need more flexibility
    # Duration-based workout selection cannot reliably hit narrow targets
    if is_recovery_week:
        time_warn_threshold = 8  # ±8% warning
        time_error_threshold = 25  # ±25% error (recovery weeks need more flexibility)
    else:
        time_warn_threshold = 10
        time_error_threshold = 20

    # Check weekly time budget with phase-aware tolerances
    if target_hours:
        time_diff_pct = abs(total_hours - target_hours) / target_hours * 100
        if time_diff_pct > time_error_threshold:
            phase_note = " (Recovery week)" if is_recovery_week else ""
            errors.append(
                f"Week {week_number} time budget violation: "
                f"Planned {total_hours:.1f}h vs target {target_hours:.1f}h "
                f"({time_diff_pct:.0f}% difference, "
                f"max {time_error_threshold}% allowed{phase_note})"
            )
        elif time_diff_pct > time_warn_threshold:
            warnings.append(
                f"Week {week_number} time budget warning: "
                f"Planned {total_hours:.1f}h vs target {target_hours:.1f}h "
                f"({time_diff_pct:.0f}% difference, recommend ±{time_warn_threshold}%)"
            )

    return (warnings, errors)


def _is_endurance_workout(workout: dict[str, Any]) -> bool:
    """
    Identify if a workout is an endurance ride based on structure.

    Checks:
    1. Description/name keywords (endurance, z2, easy, base, aerobic)
    2. Power targets - at least 70% of duration has power < 80% FTP

    Args:
        workout: Workout dictionary with structure

    Returns:
        True if workout is endurance ride
    """
    # Check for keywords in description
    description = workout.get("description", "").lower()
    keywords = ["endurance", "z2", "zone 2", "easy", "base", "aerobic"]
    if any(keyword in description for keyword in keywords):
        return True

    # Analyze structure
    structure = workout.get("structure")
    if not structure or not has_valid_structure(structure):
        return False

    if hasattr(structure, "structure"):
        segments = structure.structure
    else:
        segments = structure.get("structure", [])

    endurance_duration = 0.0
    total_duration = 0.0

    from cycling_ai.core.workout_library.structure_helpers import convert_step_length_to_minutes

    for segment in segments:
        seg_dict = segment if isinstance(segment, dict) else segment.model_dump()
        repetitions = seg_dict.get("length", {}).get("value", 1)
        steps = seg_dict.get("steps", [])

        for step in steps:
            step_dict = step if isinstance(step, dict) else step.model_dump()

            # Calculate step duration
            length = step_dict.get("length", {})
            duration = convert_step_length_to_minutes(length) * repetitions
            total_duration += duration

            # Check power target
            targets = step_dict.get("targets", [])
            power_min, power_max = extract_power_target(targets)

            # Endurance zone: < 80% FTP
            if power_max < 80:
                endurance_duration += duration

    # Calculate duration ratio
    if total_duration == 0:
        return False

    duration_ratio = endurance_duration / total_duration

    # Return True if at least 70% is in endurance zones
    return duration_ratio >= 0.7


def _find_weekend_endurance_rides(workouts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Find endurance rides on weekends.

    Args:
        workouts: List of workout dictionaries

    Returns:
        List of dicts with:
        - workout_index: int
        - weekday: str
        - duration_min: int
        - workout: dict (reference to original workout)
    """
    weekend_days = {"Saturday", "Sunday"}
    weekend_endurance_rides = []

    for idx, workout in enumerate(workouts):
        weekday = workout.get("weekday")

        # Check if weekend
        if weekday not in weekend_days:
            continue

        # Check if endurance
        if not _is_endurance_workout(workout):
            continue

        # Calculate total duration from structure
        total_duration = calculate_structure_duration(workout.get("structure", {}))

        weekend_endurance_rides.append(
            {
                "workout_index": idx,
                "weekday": weekday,
                "duration_min": total_duration,
                "workout": workout,
            }
        )

    # Sort by duration (longest first)
    weekend_endurance_rides.sort(key=lambda x: x["duration_min"], reverse=True)

    return weekend_endurance_rides


# _attempt_auto_fix deleted - See Issue #117
# The workout library should have workouts at appropriate durations instead of
# modifying workouts after selection. This prevents fragile segment manipulation.


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
    elif hasattr(obj, "items") and callable(obj.items):
        # Handle protobuf message-like objects with items()
        return {key: _convert_to_native_types(value) for key, value in obj.items()}
    elif hasattr(obj, "__iter__"):
        # Handle protobuf RepeatedComposite and similar iterable types
        return [_convert_to_native_types(item) for item in obj]
    else:
        # Unknown type - return as-is
        return obj


class AddWeekDetailsTool(BaseTool):
    """
    Tool for adding weekly workout details (Phase 2 of 2-phase generation).

    Adds detailed workouts with structure for a single week to an existing plan.
    Must be called once for each week in the plan.
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="add_week_details",
            description=(
                "PHASE 2: Add detailed workouts for ONE week to the training plan. "
                "Specify week_number and provide full workout array with WorkoutStructure. "
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
                        "Each workout must have: weekday (Monday-Sunday), description, "
                        "and structure (WorkoutStructure with segments and steps). "
                        "The structure MUST follow the WorkoutStructure format with "
                        "primaryIntensityMetric, primaryLengthMetric, and structure array."
                    ),
                    required=True,
                    items={
                        "type": "object",
                        "properties": {
                            "weekday": {"type": "string"},
                            "description": {"type": "string"},
                            "structure": {
                                "type": "object",
                                "description": "WorkoutStructure with segments and steps",
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

            logger.info("Parameters:")
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
                    f"Plan overview not found for plan_id={plan_id}. You must call create_plan_overview first."
                )

            logger.info(f"Loading overview from: {overview_file}")
            with open(overview_file) as f:
                overview_data = json.load(f)

            total_weeks = overview_data["total_weeks"]

            # Validate week_number
            if week_number < 1 or week_number > total_weeks:
                raise ValueError(f"week_number must be between 1 and {total_weeks}, got {week_number}")

            # Get week-specific targets from overview (needed for training_days validation)
            week_overview = next(
                (w for w in overview_data.get("weekly_overview", []) if w.get("week_number") == week_number),
                None,
            )

            if not week_overview:
                logger.warning(f"No overview found for week {week_number}, skipping target validation")
                week_overview = {}

            # Get designated training days for this week
            # Build a map of weekday -> list of expected workout_types
            training_days_objects = week_overview.get("training_days", [])
            expected_workout_types_by_day: dict[str, list[str]] = {}

            if training_days_objects:
                for day_obj in training_days_objects:
                    if not isinstance(day_obj, dict):
                        continue
                    weekday = day_obj.get("weekday")
                    workout_types = day_obj.get("workout_types", [])

                    # Only include days that have non-rest workouts
                    if weekday and workout_types and "rest" not in workout_types:
                        expected_workout_types_by_day[weekday] = workout_types
            else:
                logger.warning(
                    f"No training_days found in week {week_number} overview, skipping training day validation"
                )

            # Validate workouts structure
            for i, workout in enumerate(workouts):
                if "weekday" not in workout:
                    raise ValueError(f"Workout {i + 1} missing 'weekday' field")
                if "description" not in workout:
                    raise ValueError(f"Workout {i + 1} missing 'description' field")
                if "structure" not in workout or not workout["structure"]:
                    raise ValueError(
                        f"Workout {i + 1} missing 'structure' field or structure is empty. "
                        f"Each workout must have a valid WorkoutStructure."
                    )

                # Validate workout is on designated training day
                workout_weekday = workout.get("weekday")
                if expected_workout_types_by_day and workout_weekday not in expected_workout_types_by_day:
                    raise ValueError(
                        f"Workout {i + 1} scheduled on '{workout_weekday}' but this week's "
                        f"training_days are: {', '.join(sorted(expected_workout_types_by_day.keys()))}. "
                        f"You can ONLY schedule workouts on designated training days. "
                        f"Other days are rest days."
                    )

                # Validate workout structure
                _validate_workout_structure(workout, i)

            # Validate workout counts match expected workout_types
            if expected_workout_types_by_day:
                # Group workouts by weekday
                workouts_by_day: dict[str, list[dict[str, Any]]] = {}
                for workout in workouts:
                    weekday = workout.get("weekday")
                    if weekday:
                        if weekday not in workouts_by_day:
                            workouts_by_day[weekday] = []
                        workouts_by_day[weekday].append(workout)

                # Validate each day has the correct number and types of workouts
                for weekday, expected_types in expected_workout_types_by_day.items():
                    day_workouts = workouts_by_day.get(weekday, [])

                    # Count expected cycling vs strength
                    expected_cycling = sum(1 for wt in expected_types if wt != "strength")
                    expected_strength = sum(1 for wt in expected_types if wt == "strength")

                    # Count actual cycling vs strength
                    actual_cycling = 0
                    actual_strength = 0
                    for workout in day_workouts:
                        # Use structure-based strength workout detection
                        is_strength = _is_strength_workout_from_structure(workout)
                        if is_strength:
                            actual_strength += 1
                        else:
                            actual_cycling += 1

                    # Validate counts match
                    if actual_cycling != expected_cycling or actual_strength != expected_strength:
                        raise ValueError(
                            f"Week {week_number}, {weekday}: Expected {expected_types} "
                            f"({expected_cycling} cycling, {expected_strength} strength) "
                            f"but got {actual_cycling} cycling and {actual_strength} strength workouts. "
                            f"You must provide exactly the workout types specified in training_days."
                        )

            target_hours = week_overview.get("total_hours")
            current_ftp = overview_data.get("target_ftp", 250)  # Default FTP if not provided
            week_phase = week_overview.get("phase", "").lower()

            # --- Multi-Scenario Validation with Auto-Fix ---

            is_recovery_week = week_phase in ["recovery", "taper"]

            # Detect optional recovery workout in 6-day weeks
            recovery_workout_idx, recovery_weekday = _detect_optional_recovery_workout(
                workouts, training_days_objects, week_number
            )

            is_six_day_with_recovery = recovery_workout_idx is not None

            # Calculate metrics for both scenarios
            scenario_results: list[dict[str, Any]] = []

            # Scenario 1: Include all workouts (default)
            logger.info(f"Week {week_number}: Validating scenario 1 (all workouts)")
            total_hours_full, actual_tss_full = _calculate_week_metrics(
                workouts, current_ftp, exclude_workout_index=None
            )
            logger.info(f"  - Calculated: {total_hours_full:.2f}h, {actual_tss_full:.0f} TSS (info only)")
            if target_hours is not None:
                logger.info(f"  - Target: {target_hours:.2f}h")
            else:
                logger.info("  - Target: Not specified in overview")
            warnings_full, errors_full = _validate_time_budget(
                total_hours_full,
                target_hours,
                week_number,
                is_recovery_week,
            )
            if errors_full:
                logger.warning(f"  - Scenario 1 FAILED with {len(errors_full)} error(s)")
            else:
                logger.info("  - Scenario 1 PASSED")

            scenario_results.append(
                {
                    "name": "all_workouts",
                    "total_hours": total_hours_full,
                    "actual_tss": actual_tss_full,
                    "warnings": warnings_full,
                    "errors": errors_full,
                }
            )

            # Scenario 2: If 6-day week with recovery, also validate without recovery
            if is_six_day_with_recovery:
                logger.info(
                    f"Week {week_number}: Validating scenario 2 (excluding recovery on "
                    f"{workouts[recovery_workout_idx]['weekday']})"
                )
                total_hours_no_rec, actual_tss_no_rec = _calculate_week_metrics(
                    workouts, current_ftp, exclude_workout_index=recovery_workout_idx
                )
                logger.info(f"  - Calculated: {total_hours_no_rec:.2f}h, {actual_tss_no_rec:.0f} TSS (info only)")
                warnings_no_rec, errors_no_rec = _validate_time_budget(
                    total_hours_no_rec,
                    target_hours,
                    week_number,
                    is_recovery_week,
                )
                if errors_no_rec:
                    logger.warning(f"  - Scenario 2 FAILED with {len(errors_no_rec)} error(s)")
                else:
                    logger.info("  - Scenario 2 PASSED")

                scenario_results.append(
                    {
                        "name": "without_recovery",
                        "total_hours": total_hours_no_rec,
                        "actual_tss": actual_tss_no_rec,
                        "warnings": warnings_no_rec,
                        "errors": errors_no_rec,
                    }
                )

            # Determine if week is valid (at least one scenario passes)
            valid_scenarios = [s for s in scenario_results if len(s["errors"]) == 0]

            if valid_scenarios:
                logger.info(
                    f"Week {week_number}: VALIDATION PASSED "
                    f"({len(valid_scenarios)}/{len(scenario_results)} scenario(s) passed)"
                )
            else:
                logger.warning(f"Week {week_number}: VALIDATION FAILED in all {len(scenario_results)} scenario(s)")

            if not valid_scenarios:
                # All scenarios failed - raise error with LLM feedback
                error_msg = "\n".join(scenario_results[0]["errors"])
                logger.error(f"Week {week_number} validation failed:\n{error_msg}")
                raise ValueError(
                    f"Week {week_number} validation failed. "
                    f"Please adjust workouts:\n{error_msg}\n\n"
                    f"Suggestions:\n"
                    f"- To reduce time: Shorten step durations or remove recovery steps\n"
                    f"- To increase time: Add warmup/cooldown steps or extend main work duration"
                )

            # Use the best valid scenario for final metrics
            best_scenario = valid_scenarios[0]
            total_hours = best_scenario["total_hours"]
            actual_tss = best_scenario["actual_tss"]
            validation_warnings = best_scenario["warnings"]

            # Log warnings from best scenario
            if validation_warnings:
                for warning in validation_warnings:
                    logger.warning(warning)

            # Mark recovery workout as optional (UI metadata only)
            if is_six_day_with_recovery and best_scenario["name"] == "without_recovery":
                workouts[recovery_workout_idx]["optional"] = True
                workouts[recovery_workout_idx]["optional_reason"] = "Recovery workout in 6-day week"
                logger.info(
                    f"Recovery workout on {recovery_weekday} marked as optional (week validated with 5 workouts)"
                )

            # --- End Multi-Scenario Validation ---

            # Mark workouts without source as LLM-generated
            for workout in workouts:
                if "source" not in workout:
                    workout["source"] = "llm"

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
            overview_data["weeks_completed_list"] = sorted(completed_weeks)
            # Update count from unique weeks
            overview_data["weeks_completed"] = len(completed_weeks)

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
                else ("All weeks complete! Your work in this phase is done. The plan will be finalized automatically.")
            )

            # Build success message with validation metrics
            success_message = f"Week {week_number} details added. {weeks_completed}/{total_weeks} weeks complete."

            # Add validation summary
            validation_summary = []
            if target_hours:
                time_diff_pct_check = abs(total_hours - target_hours) / target_hours * 100
                time_status = "✓" if time_diff_pct_check <= 10 else "⚠"
                validation_summary.append(f"{time_status} Time: {total_hours:.1f}h (target: {target_hours:.1f}h)")
            # TSS is informational only (no validation)
            validation_summary.append(f"ℹ TSS: {actual_tss:.0f} (info only)")

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
                        "scenario_used": best_scenario["name"],
                        "auto_fixed": best_scenario.get("auto_fixed", False),
                        "fix_log": best_scenario.get("fix_log"),
                        "target_hours": target_hours,
                        "actual_hours": round(total_hours, 1),
                        "actual_tss": round(actual_tss, 1),  # Informational only
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
