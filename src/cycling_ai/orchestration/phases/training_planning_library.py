"""
Library-Based Training Planning Phase (Phase 3b Alternative).

This phase replaces LLM-based workout generation with deterministic
workout selection from a curated library.

Pattern:
- Phase 3a creates weekly_overview (LLM generates structure)
- Phase 3b-library selects specific workouts from library (no LLM)
- Phase 3c finalizes plan (Python only)

Benefits:
- Faster execution (<1 second vs 30+ seconds per week)
- Zero token usage (no LLM calls)
- Consistent, proven workout quality
- Variety tracking prevents repetition
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from cycling_ai.core.workout_library.loader import WorkoutLibraryLoader
from cycling_ai.core.workout_library.models import Workout
from cycling_ai.core.workout_library.selector import WorkoutSelector
from cycling_ai.tools.wrappers.add_week_tool import AddWeekDetailsTool

logger = logging.getLogger(__name__)


class LibraryBasedTrainingPlanningWeeks:
    """
    Phase 3b: Library-based workout selection.

    Replaces LLM-based workout generation with deterministic selection
    from curated workout library.

    Usage:
        phase = LibraryBasedTrainingPlanningWeeks(temperature=0.5)
        result = phase.execute(plan_id="uuid-from-phase-3a")

    Execution Flow:
        1. Load weekly_overview from Phase 3a (/tmp/{plan_id}_overview.json)
        2. For each week, for each training_day:
           - Select workout using WorkoutSelector
           - Track variety with variety_tracker
        3. Call add_week_details tool with selected workouts
        4. Return success result

    Error Handling:
        - Missing overview file → FileNotFoundError
        - No matching workouts → RuntimeError
        - Tool execution failure → RuntimeError
    """

    def __init__(self, temperature: float = 0.5) -> None:
        """
        Initialize library-based training planning phase.

        Args:
            temperature: Stochastic sampling temperature (0=deterministic, 0.5=balanced)
        """
        # Load workout library
        loader = WorkoutLibraryLoader()
        library = loader.get_library()

        # Initialize selector with variety tracking
        self.selector = WorkoutSelector(library)
        self.temperature = temperature

        # Initialize tool
        self.add_week_tool = AddWeekDetailsTool()

        logger.info(
            f"Initialized LibraryBasedTrainingPlanningWeeks "
            f"with {len(library.workouts)} workouts (temp={temperature})"
        )

    def execute(self, plan_id: str) -> dict[str, Any]:
        """
        Execute library-based workout selection for all weeks.

        Args:
            plan_id: Training plan UUID from Phase 3a

        Returns:
            Result dictionary with:
            - success: bool
            - weeks_added: int (number of weeks successfully added)

        Raises:
            FileNotFoundError: If overview file doesn't exist
            RuntimeError: If workout selection or tool execution fails
        """
        logger.info("[PHASE 3b-LIBRARY] Starting library-based workout selection")
        logger.info(f"[PHASE 3b-LIBRARY] plan_id: {plan_id}")

        # 1. Load weekly_overview from Phase 3a
        weekly_overview = self._load_weekly_overview(plan_id)
        logger.info(f"[PHASE 3b-LIBRARY] Loaded {len(weekly_overview)} weeks from overview")

        # 2. Select workouts for each week
        weeks_added = 0
        for week_data in weekly_overview:
            week_num = week_data.get("week_number", week_data.get("week"))
            phase = week_data.get("phase")
            training_days = week_data.get("training_days", [])
            target_hours = week_data.get("total_hours", 7.0)

            # Validate required fields
            if week_num is None:
                raise ValueError(
                    f"Week data missing 'week_number' or 'week' field: {week_data}"
                )
            if not phase:
                raise ValueError(f"Week {week_num} missing 'phase' field")
            if not training_days:
                raise ValueError(f"Week {week_num} missing 'training_days' field")

            # Filter out rest days
            non_rest_days = [
                day for day in training_days
                if day.get("workout_type") != "rest"
            ]

            # Calculate target duration per day based on weekly hours and day type
            weekday_training_days = [
                d for d in non_rest_days
                if d["weekday"] not in ["Saturday", "Sunday"]
            ]
            weekend_training_days = [
                d for d in non_rest_days
                if d["weekday"] in ["Saturday", "Sunday"]
            ]

            # Distribute hours: weekends get more time for long endurance
            # Simple distribution: 40% to weekdays, 60% to weekends (if weekends exist)
            num_weekdays = len(weekday_training_days)
            num_weekends = len(weekend_training_days)

            if num_weekends > 0:
                weekday_hours = target_hours * 0.4
                weekend_hours = target_hours * 0.6
                avg_weekday_duration_min = (
                    (weekday_hours * 60 / num_weekdays) if num_weekdays > 0 else 60
                )
                avg_weekend_duration_min = (
                    (weekend_hours * 60 / num_weekends) if num_weekends > 0 else 120
                )
            else:
                # All weekdays - distribute evenly
                avg_weekday_duration_min = (
                    (target_hours * 60 / num_weekdays) if num_weekdays > 0 else 60
                )
                avg_weekend_duration_min = 0

            logger.info(
                f"[PHASE 3b-LIBRARY] Week {week_num}: "
                f"Selecting {len(non_rest_days)} workouts (phase={phase}, "
                f"target_hours={target_hours:.1f}h, "
                f"avg_weekday_duration={avg_weekday_duration_min:.0f}min, "
                f"avg_weekend_duration={avg_weekend_duration_min:.0f}min)"
            )

            # Select workout for each non-rest training day
            selected_workouts: list[dict[str, Any]] = []
            for day in non_rest_days:
                is_weekend = day["weekday"] in ["Saturday", "Sunday"]

                # Set duration constraints based on day type
                if is_weekend:
                    min_duration = 90  # Weekend minimum
                    max_duration = 180  # Weekend maximum
                    target_duration = avg_weekend_duration_min
                else:
                    min_duration = 45  # Weekday minimum
                    max_duration = 90  # Weekday maximum
                    target_duration = avg_weekday_duration_min

                workout = self._select_workout_for_day(
                    weekday=day["weekday"],
                    workout_type=day["workout_type"],
                    phase=phase,
                    target_duration_min=target_duration,
                    min_duration_min=min_duration,
                    max_duration_min=max_duration,
                )

                if workout is None:
                    raise RuntimeError(
                        f"No matching workout found for week {week_num}, "
                        f"day {day['weekday']}, type {day['workout_type']}, phase {phase}"
                    )

                # Convert to dict and add required fields for add_week_tool
                workout_dict = workout.model_dump()
                workout_dict["weekday"] = day["weekday"]
                # add_week_tool expects 'description', use detailed_description or fallback to name
                workout_dict["description"] = (
                    workout.detailed_description or workout.name
                )

                # Ensure all segments have duration_min calculated (for interval sets)
                for segment in workout_dict.get("segments", []):
                    if segment.get("duration_min") is None:
                        if segment.get("sets") and segment.get("work") and segment.get("recovery"):
                            # Calculate duration for interval sets
                            work_duration = segment["work"].get("duration_min", 0) or 0
                            recovery_duration = segment["recovery"].get("duration_min", 0) or 0
                            segment["duration_min"] = segment["sets"] * (
                                work_duration + recovery_duration
                            )
                        else:
                            # Fallback: set to 0 if we can't calculate
                            segment["duration_min"] = 0

                    # Copy power zones from work interval if missing (for interval segments)
                    if segment.get("power_low_pct") is None and segment.get("work"):
                        segment["power_low_pct"] = segment["work"].get("power_low_pct", 50)
                        if segment.get("power_high_pct") is None:
                            segment["power_high_pct"] = segment["work"].get(
                                "power_high_pct", 60
                            )

                    # Ensure description exists
                    if not segment.get("description"):
                        segment["description"] = f"{segment['type'].title()} segment"

                selected_workouts.append(workout_dict)

                # Track variety
                self.selector.variety_tracker.add_workout(workout.id)

                logger.debug(
                    f"[PHASE 3b-LIBRARY] Week {week_num}, {day['weekday']}: "
                    f"Selected {workout.name} (duration={workout.base_duration_min:.0f}min)"
                )

            # 3. Validate total duration against target
            total_duration_min = sum(
                sum(seg.get("duration_min", 0) for seg in w.get("segments", []))
                for w in selected_workouts
            )
            total_hours = total_duration_min / 60.0

            logger.info(
                f"[PHASE 3b-LIBRARY] Week {week_num}: "
                f"Total duration {total_hours:.1f}h (target {target_hours:.1f}h)"
            )

            # 4. Call add_week_tool
            result = self.add_week_tool.execute(
                plan_id=plan_id,
                week_number=week_num,
                workouts=selected_workouts,
            )

            if not result.success:
                errors = result.errors or ["Unknown error"]
                raise RuntimeError(
                    f"Failed to add week {week_num}: {', '.join(errors)}"
                )

            weeks_added += 1
            logger.info(f"[PHASE 3b-LIBRARY] Week {week_num} added successfully")

        logger.info(
            f"[PHASE 3b-LIBRARY] Completed: {weeks_added} weeks added successfully"
        )

        return {
            "success": True,
            "weeks_added": weeks_added,
        }

    def _select_workout_for_day(
        self,
        weekday: str,
        workout_type: str,
        phase: str,
        target_duration_min: float,
        min_duration_min: float,
        max_duration_min: float,
    ) -> Workout | None:
        """
        Select workout for a specific training day.

        Args:
            weekday: Day of week (Monday, Tuesday, etc.)
            workout_type: Workout type (endurance, sweet_spot, etc.)
            phase: Training phase (Base, Build, etc.)
            target_duration_min: Target duration in minutes
            min_duration_min: Minimum acceptable duration
            max_duration_min: Maximum acceptable duration

        Returns:
            Selected and adjusted workout, or None if no match found
        """
        return self.selector.select_workout(
            target_type=workout_type,
            target_phase=phase,
            target_weekday=weekday,
            target_duration_min=target_duration_min,
            min_duration_min=min_duration_min,
            max_duration_min=max_duration_min,
            temperature=self.temperature,
        )

    def _load_weekly_overview(self, plan_id: str) -> list[dict[str, Any]]:
        """
        Load weekly_overview from Phase 3a output.

        Phase 3a creates: /tmp/{plan_id}_overview.json
        Format: {"weekly_overview": [{"week_number": 1, "phase": "Base", "training_days": [...]}]}

        Args:
            plan_id: Plan UUID from Phase 3a

        Returns:
            List of week data dictionaries

        Raises:
            FileNotFoundError: If overview file doesn't exist
            ValueError: If overview file has invalid format
        """
        overview_path = Path("/tmp") / f"{plan_id}_overview.json"

        if not overview_path.exists():
            raise FileNotFoundError(
                f"Phase 3a overview not found: {overview_path}\n"
                "Ensure Phase 3a (training_planning_overview) completed successfully."
            )

        try:
            with open(overview_path) as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            raise ValueError(
                f"Invalid JSON in overview file {overview_path}: {e}"
            ) from e

        if "weekly_overview" not in data:
            raise ValueError(
                f"Invalid overview format: missing 'weekly_overview' key in {overview_path}"
            )

        weekly_overview: list[dict[str, Any]] = data["weekly_overview"]
        return weekly_overview
