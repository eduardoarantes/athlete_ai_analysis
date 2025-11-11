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
        training_days_objects: Week overview training days (with workout_type)
        week_number: Current week number (for logging)

    Returns:
        (recovery_workout_index_or_none, recovery_weekday_or_none)
    """
    # Count non-rest training days
    training_days_count = sum(
        1
        for day in training_days_objects
        if isinstance(day, dict) and day.get("workout_type") != "rest"
    )

    # Only applies to 6-day weeks
    if training_days_count != 6:
        return (None, None)

    # Find first recovery workout in training_days_objects
    recovery_weekday = None
    for day in training_days_objects:
        if isinstance(day, dict) and day.get("workout_type") == "recovery":
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
        filtered_workouts = [
            workout for idx, workout in enumerate(workouts) if idx != exclude_workout_index
        ]
    else:
        filtered_workouts = workouts

    # Exclude strength workouts from cycling volume calculations
    cycling_workouts = [
        workout for workout in filtered_workouts
        if not ("strength" in workout.get("description", "").lower() or
                any("strength" in seg.get("type", "").lower() for seg in workout.get("segments", [])))
    ]

    # Calculate total duration (handle None values from library workouts)
    total_duration_min = sum(
        sum((seg.get("duration_min") or 0) for seg in workout.get("segments", []))
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
    Identify if a workout is an endurance ride.

    Checks:
    1. Description/name keywords (endurance, z2, easy, base, aerobic)
    2. Segment types (steady, endurance) AND power < 80% FTP
    3. At least 50% of segments are endurance type OR
       At least 70% of duration is in endurance zones

    Args:
        workout: Workout dictionary with segments, description, name

    Returns:
        True if workout is endurance ride
    """
    # Check for keywords in description
    description = workout.get("description", "").lower()
    keywords = ["endurance", "z2", "zone 2", "easy", "base", "aerobic"]
    if any(keyword in description for keyword in keywords):
        return True

    # Analyze segments
    segments = workout.get("segments", [])
    if not segments:
        return False

    endurance_segment_count = 0
    total_segment_count = len(segments)
    endurance_duration = 0
    total_duration = 0

    for seg in segments:
        duration = seg.get("duration_min") or 0
        total_duration += duration

        # Check if segment is endurance type with low power
        seg_type = seg.get("type", "").lower()
        power_low = seg.get("power_low_pct", 100)

        # Endurance types: steady, endurance
        # Power threshold: < 80% FTP
        is_endurance_type = seg_type in ["steady", "endurance"]
        is_low_power = power_low < 80

        if is_endurance_type and is_low_power:
            endurance_segment_count += 1
            endurance_duration += duration

    # Calculate ratios
    if total_segment_count == 0 or total_duration == 0:
        return False

    segment_ratio = endurance_segment_count / total_segment_count
    duration_ratio = endurance_duration / total_duration

    # Return True if either threshold met
    return segment_ratio >= 0.5 or duration_ratio >= 0.7


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

        # Calculate total duration (handle None values)
        total_duration = sum((seg.get("duration_min") or 0) for seg in workout.get("segments", []))

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


def _attempt_auto_fix(
    workouts: list[dict[str, Any]], target_hours: float | None, current_ftp: float, week_number: int
) -> tuple[list[dict[str, Any]] | None, str]:
    """
    Attempt to auto-fix time budget violations by reducing endurance rides.

    NON-DESTRUCTIVE: Returns new list, doesn't modify original.

    Strategy:
    1. Find longest weekend endurance ride
    2. Remove warmup/cooldown segments
    3. Reduce main block by 15-minute intervals (minimum 60 min)
    4. Stop if total hours <= target_hours

    Args:
        workouts: Original workout list (NOT modified)
        target_hours: Target hours to achieve
        current_ftp: FTP for TSS calculation
        week_number: Week number for logging

    Returns:
        (modified_workouts_or_none, log_message)
        - Returns (None, reason) if fix not possible or not needed
        - Returns (new_workouts, log) if fix successful
    """
    # Check if target exists
    if not target_hours:
        return (None, "No target hours specified")

    # Calculate current hours
    current_hours, _ = _calculate_week_metrics(workouts, current_ftp)

    logger.info(
        f"Week {week_number}: AUTO-FIX attempting to reduce time from "
        f"{current_hours:.2f}h to {target_hours:.2f}h"
    )

    # Check if already under budget
    if current_hours <= target_hours:
        logger.info(
            f"Week {week_number}: Already within budget, no fix needed"
        )
        return (None, f"Already within budget: {current_hours:.1f}h <= {target_hours:.1f}h")

    # Find weekend endurance rides
    weekend_rides = _find_weekend_endurance_rides(workouts)

    if not weekend_rides:
        logger.warning(
            f"Week {week_number}: No weekend endurance rides found to reduce"
        )
        return (None, "No weekend endurance rides to reduce")

    # Target the longest weekend ride
    target_ride = weekend_rides[0]
    target_index = target_ride["workout_index"]
    target_weekday = target_ride["weekday"]

    logger.info(
        f"Week {week_number}: Found {len(weekend_rides)} weekend endurance ride(s)"
    )
    logger.info(
        f"Week {week_number}: Targeting longest ride on {target_weekday} "
        f"({target_ride['duration_min']} min)"
    )

    # Deep copy workouts (non-destructive)
    import copy

    workouts_copy = copy.deepcopy(workouts)

    # Get the workout to modify
    workout_to_modify = workouts_copy[target_index]
    original_segments = workout_to_modify.get("segments", [])

    # Step 1: Try removing warmup/cooldown
    logger.info(
        f"Week {week_number}: Step 1 - Attempting to remove warmup/cooldown segments"
    )
    modified_segments = []
    removed_segments = []

    for seg in original_segments:
        seg_type = seg.get("type", "").lower()
        if seg_type not in ["warmup", "cooldown"]:
            modified_segments.append(seg)
        else:
            removed_segments.append(
                f"{seg_type} ({seg.get('duration_min', 0)} min)"
            )

    if removed_segments:
        logger.info(
            f"Week {week_number}:   Removed: {', '.join(removed_segments)}"
        )
    else:
        logger.info(
            f"Week {week_number}:   No warmup/cooldown segments to remove"
        )

    # Update segments
    workout_to_modify["segments"] = modified_segments

    # Check if warmup/cooldown removal is enough
    test_hours, _ = _calculate_week_metrics(workouts_copy, current_ftp)

    logger.info(
        f"Week {week_number}:   After warmup/cooldown removal: {test_hours:.2f}h "
        f"(target: {target_hours:.2f}h)"
    )

    if test_hours <= target_hours:
        log_msg = (
            f"Auto-fix successful: Removed warmup/cooldown from {target_weekday} endurance ride. "
            f"Time reduced: {current_hours:.1f}h → {test_hours:.1f}h (target: {target_hours:.1f}h)"
        )
        logger.info(f"Week {week_number}: ✓ {log_msg}")
        return (workouts_copy, log_msg)

    # Step 2: Reduce main segments by 15-minute intervals
    logger.info(
        f"Week {week_number}: Step 2 - Reducing main endurance segments "
        f"by {15} min intervals (min: {60} min)"
    )

    # Find the longest endurance segment
    reduction_increment = 15  # minutes
    min_endurance_duration = 60  # minimum duration
    max_iterations = 10

    for iteration in range(max_iterations):
        logger.info(
            f"Week {week_number}:   Iteration {iteration + 1}/{max_iterations}: "
            f"Current {test_hours:.2f}h, target {target_hours:.2f}h"
        )
        # Find longest endurance segment
        longest_seg_idx = None
        longest_duration = 0

        for idx, seg in enumerate(modified_segments):
            seg_type = seg.get("type", "").lower()
            power_low = seg.get("power_low_pct") or 100
            duration = seg.get("duration_min") or 0

            # Endurance segment with low power
            if (
                seg_type in ["steady", "endurance"]
                and power_low < 80
                and duration > longest_duration
            ):
                longest_duration = duration
                longest_seg_idx = idx

        # Check if we can reduce
        if longest_seg_idx is None:
            logger.warning(
                f"Week {week_number}:   No more endurance segments to reduce"
            )
            break

        if longest_duration - reduction_increment < min_endurance_duration:
            # Hit minimum duration
            log_msg = (
                f"Auto-fix insufficient: Cannot reduce below {min_endurance_duration} min minimum. "
                f"Current: {test_hours:.1f}h, Target: {target_hours:.1f}h"
            )
            logger.warning(f"Week {week_number}: ✗ {log_msg}")
            return (None, log_msg)

        # Reduce the segment
        logger.info(
            f"Week {week_number}:     Reducing segment {longest_seg_idx} "
            f"from {longest_duration} min to {longest_duration - reduction_increment} min"
        )
        modified_segments[longest_seg_idx]["duration_min"] -= reduction_increment
        workout_to_modify["segments"] = modified_segments

        # Check if we've reached target
        test_hours, _ = _calculate_week_metrics(workouts_copy, current_ftp)

        if test_hours <= target_hours:
            reduction_amount = current_hours - test_hours
            log_msg = (
                f"Auto-fix successful: Reduced {target_weekday} endurance ride "
                f"by {reduction_amount * 60:.0f} min. "
                f"Time reduced: {current_hours:.1f}h → {test_hours:.1f}h "
                f"(target: {target_hours:.1f}h)"
            )
            logger.info(f"Week {week_number}: ✓ {log_msg}")
            return (workouts_copy, log_msg)

    # Exceeded max iterations
    logger.warning(
        f"Week {week_number}: Exceeded {max_iterations} iterations, "
        f"still at {test_hours:.2f}h (target: {target_hours:.2f}h)"
    )
    log_msg = (
        f"Auto-fix insufficient: Exceeded max iterations. "
        f"Current: {test_hours:.1f}h, Target: {target_hours:.1f}h"
    )
    return (None, log_msg)


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
                        "segments (array with type, duration_min, power_low_pct, "
                        "power_high_pct, description). "
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
                ToolParameter(
                    name="auto_fix",
                    type="boolean",
                    description=(
                        "Enable automatic fixing of time budget violations "
                        "by reducing endurance rides. "
                        "Default: true. Set to false for strict validation mode."
                    ),
                    required=False,
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
                    f"Plan overview not found for plan_id={plan_id}. "
                    f"You must call create_plan_overview first."
                )

            logger.info(f"Loading overview from: {overview_file}")
            with open(overview_file) as f:
                overview_data = json.load(f)

            total_weeks = overview_data["total_weeks"]

            # Validate week_number
            if week_number < 1 or week_number > total_weeks:
                raise ValueError(
                    f"week_number must be between 1 and {total_weeks}, got {week_number}"
                )

            # Get week-specific targets from overview (needed for training_days validation)
            week_overview = next(
                (
                    w
                    for w in overview_data.get("weekly_overview", [])
                    if w.get("week_number") == week_number
                ),
                None,
            )

            if not week_overview:
                logger.warning(
                    f"No overview found for week {week_number}, skipping target validation"
                )
                week_overview = {}

            # Get designated training days for this week
            # (extract weekdays from objects, exclude rest days)
            training_days_objects = week_overview.get("training_days", [])
            if training_days_objects:
                # Extract weekday strings for non-rest days only (filter out None values)
                training_days_raw = [
                    day_obj.get("weekday")
                    for day_obj in training_days_objects
                    if isinstance(day_obj, dict) and day_obj.get("workout_type") != "rest"
                ]
                # Filter out None values for type safety
                training_days = [day for day in training_days_raw if day is not None]
            else:
                training_days = []
                logger.warning(
                    f"No training_days found in week {week_number} overview, "
                    f"skipping training day validation"
                )

            # Validate workouts structure
            for i, workout in enumerate(workouts):
                if "weekday" not in workout:
                    raise ValueError(f"Workout {i + 1} missing 'weekday' field")
                if "description" not in workout:
                    raise ValueError(f"Workout {i + 1} missing 'description' field")
                if "segments" not in workout or not workout["segments"]:
                    raise ValueError(
                        f"Workout {i + 1} missing 'segments' array or array is empty. "
                        f"Each workout must have at least one segment."
                    )

                # Validate workout is on designated training day
                workout_weekday = workout.get("weekday")
                if training_days and workout_weekday not in training_days:
                    raise ValueError(
                        f"Workout {i + 1} scheduled on '{workout_weekday}' but this week's "
                        f"training_days are: {', '.join(training_days)}. "
                        f"You can ONLY schedule workouts on designated training days. "
                        f"Other days are rest days."
                    )

                # Check if this is a strength workout (infer from workout description)
                is_strength_workout = (
                    "strength" in workout.get("description", "").lower() or
                    any("strength" in seg.get("type", "").lower() for seg in workout.get("segments", []))
                )

                # Validate each segment (skip power zone validation for strength workouts)
                for j, segment in enumerate(workout["segments"]):
                    if is_strength_workout:
                        # Strength workouts don't need power zones
                        required_fields = ["type", "duration_min", "description"]
                    else:
                        # Cycling workouts need power zones
                        required_fields = ["type", "duration_min", "power_low_pct", "description"]

                    for field in required_fields:
                        if field not in segment:
                            raise ValueError(
                                f"Workout {i + 1}, segment {j + 1} missing "
                                f"required field: '{field}'"
                            )

            # Validate number of workouts matches number of training days
            # Allow extra workouts if they are strength workouts (supplementary training)
            if training_days:
                # Count non-strength workouts
                non_strength_workouts = [
                    w for w in workouts
                    if not ("strength" in w.get("description", "").lower() or
                            any("strength" in seg.get("type", "").lower() for seg in w.get("segments", [])))
                ]

                if len(non_strength_workouts) != len(training_days):
                    strength_count = len(workouts) - len(non_strength_workouts)
                    raise ValueError(
                        f"Week {week_number} has {len(non_strength_workouts)} cycling workouts "
                        f"({strength_count} strength) but {len(training_days)} training days. "
                        f"You must create exactly one cycling workout for each training day: "
                        f"{', '.join(training_days)}. "
                        f"Strength workouts can be added as supplementary training on any training day."
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
            logger.info(
                f"Week {week_number}: Validating scenario 1 (all workouts)"
            )
            total_hours_full, actual_tss_full = _calculate_week_metrics(
                workouts, current_ftp, exclude_workout_index=None
            )
            logger.info(
                f"  - Calculated: {total_hours_full:.2f}h, {actual_tss_full:.0f} TSS (info only)"
            )
            if target_hours is not None:
                logger.info(
                    f"  - Target: {target_hours:.2f}h"
                )
            else:
                logger.info("  - Target: Not specified in overview")
            warnings_full, errors_full = _validate_time_budget(
                total_hours_full,
                target_hours,
                week_number,
                is_recovery_week,
            )
            if errors_full:
                logger.warning(
                    f"  - Scenario 1 FAILED with {len(errors_full)} error(s)"
                )
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
                logger.info(
                    f"  - Calculated: {total_hours_no_rec:.2f}h, "
                    f"{actual_tss_no_rec:.0f} TSS (info only)"
                )
                warnings_no_rec, errors_no_rec = _validate_time_budget(
                    total_hours_no_rec,
                    target_hours,
                    week_number,
                    is_recovery_week,
                )
                if errors_no_rec:
                    logger.warning(
                        f"  - Scenario 2 FAILED with {len(errors_no_rec)} error(s)"
                    )
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
                logger.warning(
                    f"Week {week_number}: VALIDATION FAILED in all "
                    f"{len(scenario_results)} scenario(s)"
                )

            if not valid_scenarios:
                # All scenarios failed - check if auto-fix is enabled
                auto_fix_enabled = kwargs.get("auto_fix", True)  # Default: enabled

                if auto_fix_enabled:
                    logger.info(
                        f"Week {week_number}: Auto-fix is enabled, attempting to fix..."
                    )

                    # Try auto-fix for the full workout scenario
                    modified_workouts, fix_log = _attempt_auto_fix(
                        workouts, target_hours, current_ftp, week_number
                    )

                    if modified_workouts is not None:
                        logger.info(
                            f"Week {week_number}: Re-validating after auto-fix modifications"
                        )
                        # Re-validate with fixed workouts
                        total_hours_fixed, actual_tss_fixed = _calculate_week_metrics(
                            modified_workouts, current_ftp
                        )
                        warnings_fixed, errors_fixed = _validate_time_budget(
                            total_hours_fixed,
                            target_hours,
                            week_number,
                            is_recovery_week,
                        )

                        if len(errors_fixed) == 0:
                            # Auto-fix succeeded!
                            workouts = modified_workouts
                            logger.info(
                                f"Week {week_number}: ✓ AUTO-FIX SUCCESSFUL - "
                                f"Week now passes validation"
                            )
                            logger.info(f"Week {week_number}: {fix_log}")
                            valid_scenarios = [
                                {
                                    "name": "auto_fixed",
                                    "total_hours": total_hours_fixed,
                                    "actual_tss": actual_tss_fixed,
                                    "warnings": warnings_fixed,
                                    "errors": errors_fixed,
                                    "auto_fixed": True,
                                    "fix_log": fix_log,
                                }
                            ]
                    else:
                        logger.info(f"Auto-fix not possible: {fix_log}")

            if not valid_scenarios:
                # Still failed after auto-fix attempt - raise error with LLM feedback
                error_msg = "\n".join(scenario_results[0]["errors"])
                logger.error(f"Week {week_number} validation failed:\n{error_msg}")
                raise ValueError(
                    f"Week {week_number} validation failed. "
                    f"Please adjust workouts:\n{error_msg}\n\n"
                    f"Suggestions:\n"
                    f"- To reduce time: Shorten segment durations or remove recovery segments\n"
                    f"- To increase time: Add warmup/cooldown or extend main set duration"
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
                    f"Recovery workout on {recovery_weekday} marked as optional "
                    f"(week validated with 5 workouts)"
                )

            # --- End Multi-Scenario Validation ---

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
                else (
                    "All weeks complete! Your work in this phase is done. "
                    "The plan will be finalized automatically."
                )
            )

            # Build success message with validation metrics
            success_message = (
                f"Week {week_number} details added. {weeks_completed}/{total_weeks} weeks complete."
            )

            # Add validation summary
            validation_summary = []
            if target_hours:
                time_diff_pct_check = abs(total_hours - target_hours) / target_hours * 100
                time_status = "✓" if time_diff_pct_check <= 10 else "⚠"
                validation_summary.append(
                    f"{time_status} Time: {total_hours:.1f}h (target: {target_hours:.1f}h)"
                )
            # TSS is informational only (no validation)
            validation_summary.append(
                f"ℹ TSS: {actual_tss:.0f} (info only)"
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
