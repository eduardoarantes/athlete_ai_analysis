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
from cycling_ai.core.workout_library.structure_helpers import (
    calculate_structure_duration,
    create_strength_structure,
    get_main_segment_from_structure,
)
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
            f"Initialized LibraryBasedTrainingPlanningWeeks with {len(library.workouts)} workouts (temp={temperature})"
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
                raise ValueError(f"Week data missing 'week_number' or 'week' field: {week_data}")
            if not phase:
                raise ValueError(f"Week {week_num} missing 'phase' field")
            if not training_days:
                raise ValueError(f"Week {week_num} missing 'training_days' field")

            # Select and scale workouts to hit time budget
            # This automatically handles:
            # - Weekday workouts: fixed 45-75min
            # - Weekend workouts: scale to fill time deficit
            logger.info(
                f"[PHASE 3b-LIBRARY] Week {week_num}: "
                f"Selecting workouts (phase={phase}, target_hours={target_hours:.1f}h)"
            )

            selected_workouts = self._select_and_scale_workouts(week_data)

            # 4. Call add_week_tool
            result = self.add_week_tool.execute(
                plan_id=plan_id,
                week_number=week_num,
                workouts=selected_workouts,
            )

            if not result.success:
                errors = result.errors or ["Unknown error"]
                raise RuntimeError(f"Failed to add week {week_num}: {', '.join(errors)}")

            weeks_added += 1
            logger.info(f"[PHASE 3b-LIBRARY] Week {week_num} added successfully")

        logger.info(f"[PHASE 3b-LIBRARY] Completed: {weeks_added} weeks added successfully")

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
            workout_type: Workout type (endurance, sweetspot, etc.)
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

    def _create_strength_workout(self, weekday: str) -> dict[str, Any]:
        """
        Create a simple strength training workout structure.

        Args:
            weekday: Day of week (Monday, Tuesday, etc.)

        Returns:
            Strength workout dict matching expected workout format
        """
        return {
            "weekday": weekday,
            "name": "Strength Training",
            "description": "Strength Training",
            "workout_type": "strength",  # Explicit type for validation
            "source": "library",  # Strength workouts are pre-defined templates
            "library_workout_id": "strength_default",
            "structure": create_strength_structure(duration_min=45),
        }

    def _is_strength_workout(self, workout: dict[str, Any]) -> bool:
        """
        Check if workout is a strength workout.

        Uses explicit workout_type field (preferred for library workouts).
        Falls back to keyword matching for backward compatibility.

        Args:
            workout: Workout dictionary

        Returns:
            True if strength workout, False if cycling workout
        """
        # Use explicit workout_type if available (prevents mis-classification)
        workout_type = workout.get("workout_type")
        if workout_type:
            return bool(workout_type == "strength")

        # Fallback: keyword matching (old behavior for custom plans)
        description = workout.get("description", "").lower()
        return "strength" in description

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
            raise ValueError(f"Invalid JSON in overview file {overview_path}: {e}") from e

        if "weekly_overview" not in data:
            raise ValueError(f"Invalid overview format: missing 'weekly_overview' key in {overview_path}")

        weekly_overview: list[dict[str, Any]] = data["weekly_overview"]
        return weekly_overview

    def _find_main_segment(self, workout: dict[str, Any]) -> dict[str, Any] | None:
        """
        Find the main workout segment (highest intensity active segment).

        Used for duration adjustments and workout scaling with WorkoutStructure format.

        Args:
            workout: Workout dictionary with structure

        Returns:
            Dict with segment info (segment_index, step, power_low_pct, power_high_pct, duration_min)
            or None if no suitable segment found
        """
        structure = workout.get("structure")
        if not structure:
            return None

        return get_main_segment_from_structure(structure)

    def _scale_weekend_workouts(
        self,
        weekend_workouts: list[dict[str, Any]],
        deficit_minutes: float,
    ) -> list[dict[str, Any]]:
        """
        Scale weekend endurance rides to fill time deficit.

        Rounds to nearest 10 minutes for practical scheduling.
        Works with WorkoutStructure format.

        Args:
            weekend_workouts: Weekend endurance workout objects
            deficit_minutes: Time needed (can be negative if surplus)

        Returns:
            Scaled workout objects (deep copies)
        """
        if not weekend_workouts or abs(deficit_minutes) < 1:
            return weekend_workouts

        # Distribute deficit equally
        extension_per_workout = deficit_minutes / len(weekend_workouts)

        scaled_workouts = []
        for workout in weekend_workouts:
            # Clone workout (don't modify library)
            workout_copy = json.loads(json.dumps(workout))

            # Find main segment (highest intensity active step)
            main_segment_info = self._find_main_segment(workout_copy)

            if not main_segment_info:
                # No main segment found, return as-is
                scaled_workouts.append(workout_copy)
                continue

            # Extract step to modify
            segment_index = main_segment_info["segment_index"]
            step_info = main_segment_info["step"]
            current_duration = main_segment_info["duration_min"]

            # Calculate new duration
            new_duration = current_duration + extension_per_workout

            # Clamp to reasonable bounds
            new_duration = max(10, min(new_duration, 150))  # 10-150min for step

            # Round to nearest 10 minutes for practical scheduling
            new_duration = round(new_duration / 10) * 10

            # Update the step duration in the structure
            structure = workout_copy.get("structure", {})
            segments = structure.get("structure", [])
            if segment_index < len(segments):
                segment = segments[segment_index]
                # Find and update the step
                for step in segment.get("steps", []):
                    # Match by name and current duration
                    if step.get("name") == step_info.get("name"):
                        # Set value based on unit (new_duration is in minutes)
                        unit = step["length"].get("unit", "minute")
                        if unit == "second":
                            step["length"]["value"] = new_duration * 60
                        elif unit == "hour":
                            step["length"]["value"] = new_duration / 60
                        else:  # minute or other
                            step["length"]["value"] = new_duration
                        break

            scaled_workouts.append(workout_copy)

        return scaled_workouts

    def _select_and_scale_workouts(self, week: dict[str, Any]) -> list[dict[str, Any]]:
        """
        Select workouts and scale weekends to hit time target.

        Strategy:
        1. Select weekday workouts with fixed 45-75min constraint
        2. Select weekend workouts with BASE duration (90min min)
        3. Calculate deficit after weekday selection
        4. Scale ONLY weekend ENDURANCE workouts to fill deficit

        Args:
            week: Week data with training_days and total_hours

        Returns:
            List of workout objects ready for add_week_tool
        """
        target_hours = week["total_hours"]

        weekday_workouts = []
        weekend_workouts = []
        weekend_cycling_workouts = []  # Track cycling workouts for scaling (excludes strength)
        current_week_workout_ids: list[str] = []  # Track IDs used in this week (hard constraint)

        # Select all workouts (now supporting multiple workout_types per day)
        for day in week["training_days"]:
            workout_types = day.get("workout_types", [])

            logger.info(f"Week {week.get('week_number')}, {day['weekday']}: Processing workout_types={workout_types}")

            # Skip rest days
            if "rest" in workout_types:
                logger.info("  → Skipping rest day")
                continue

            is_weekend = day["weekday"] in ["Saturday", "Sunday"]
            is_recovery_week = week.get("phase") == "Recovery"

            # Adjust duration ranges for recovery weeks
            # Recovery weeks have lower volume, so select shorter base workouts
            if is_recovery_week:
                weekend_target = 60
                weekend_min = 45
                weekend_max = 90
            else:
                weekend_target = 90
                weekend_min = 90
                weekend_max = 100

            # Process each workout type for this day
            for workout_type in workout_types:
                logger.info(f"  → Processing workout_type='{workout_type}'")
                if workout_type == "strength":
                    # Create simple strength workout structure
                    workout_dict = self._create_strength_workout(day["weekday"])
                    logger.info(f"    ✓ Created strength workout for {day['weekday']}")
                else:
                    # Select cycling workout from library
                    logger.info(
                        f"    → Selecting cycling workout: type={workout_type}, "
                        f"phase={week['phase']}, weekday={day['weekday']}, "
                        f"recovery_week={is_recovery_week}"
                    )
                    workout = self.selector.select_workout(
                        target_type=workout_type,
                        target_phase=week["phase"],
                        target_weekday=day["weekday"],
                        target_duration_min=weekend_target if is_weekend else 60,
                        min_duration_min=weekend_min if is_weekend else 45,
                        max_duration_min=weekend_max if is_weekend else 75,
                        temperature=self.temperature,
                        exclude_ids=current_week_workout_ids,  # Prevent same workout in same week
                    )

                    if workout is None:
                        logger.error(
                            f"    ✗ No matching workout found for week {week.get('week_number')}, "
                            f"day {day['weekday']}, type {workout_type}, phase {week['phase']}"
                        )
                        raise RuntimeError(
                            f"No matching workout found for week {week.get('week_number')}, "
                            f"day {day['weekday']}, type {workout_type}, phase {week['phase']}"
                        )

                    duration = calculate_structure_duration(workout.structure) if workout.structure else 0
                    logger.info(
                        f"    ✓ Selected workout: {workout.name} (id={workout.id}, "
                        f"duration={duration:.0f}min)"
                    )

                    # Update trackers immediately after selection
                    self.selector.variety_tracker.add_workout(workout.id)
                    current_week_workout_ids.append(workout.id)

                    # Convert to dict
                    workout_dict = workout.model_dump()
                    workout_dict["weekday"] = day["weekday"]
                    workout_dict["description"] = workout.detailed_description or workout.name
                    # Preserve original workout_type from library for validation
                    # This prevents mis-classification of cycling workouts with "strength" in name
                    workout_dict["workout_type"] = workout.type
                    # Track workout source for debugging/admin purposes
                    workout_dict["source"] = "library"
                    workout_dict["library_workout_id"] = workout.id

                # Add workout to appropriate list
                workout_category = "weekend" if is_weekend else "weekday"
                is_strength_workout = self._is_strength_workout(workout_dict)
                logger.info(
                    f"    ✓ Adding to {workout_category}_workouts: "
                    f"type={'STRENGTH' if is_strength_workout else 'CYCLING'}, "
                    f"description={workout_dict.get('description', 'N/A')[:50]}"
                )

                if is_weekend:
                    weekend_workouts.append(workout_dict)
                    # Scale all cycling workouts (not just endurance)
                    # Strength workouts are excluded from scaling
                    if workout_type != "strength" and not is_strength_workout:
                        weekend_cycling_workouts.append(workout_dict)
                else:
                    weekday_workouts.append(workout_dict)

        # Calculate current durations (EXCLUDE strength workouts from time budget)
        # Per design: strength workouts don't count toward weekly cycling hours
        weekday_minutes = sum(
            calculate_structure_duration(w.get("structure", {}))
            for w in weekday_workouts
            if not self._is_strength_workout(w)
        )

        weekend_minutes_before = sum(
            calculate_structure_duration(w.get("structure", {}))
            for w in weekend_workouts
            if not self._is_strength_workout(w)
        )

        # Calculate deficit (how much more time we need)
        target_minutes = target_hours * 60
        current_total = weekday_minutes + weekend_minutes_before
        deficit_minutes = target_minutes - current_total

        # Scale all weekend cycling workouts to fill deficit
        scaled_cycling = self._scale_weekend_workouts(weekend_cycling_workouts, deficit_minutes)

        # Replace cycling workouts in weekend_workouts with scaled versions
        # Build final list: weekday + non-cycling weekend (strength) + scaled cycling weekend
        non_cycling_weekend = [w for w in weekend_workouts if w not in weekend_cycling_workouts]
        all_workouts = weekday_workouts + non_cycling_weekend + scaled_cycling

        # Log for debugging (cycling time only, strength excluded from budget)
        actual_cycling_minutes = sum(
            calculate_structure_duration(w.get("structure", {}))
            for w in all_workouts
            if not self._is_strength_workout(w)
        )
        actual_strength_minutes = sum(
            calculate_structure_duration(w.get("structure", {}))
            for w in all_workouts
            if self._is_strength_workout(w)
        )
        actual_total_minutes = actual_cycling_minutes + actual_strength_minutes

        logger.info(
            f"Week {week.get('week_number')}: "
            f"Target {target_minutes / 60:.1f}h (cycling only), "
            f"Weekdays {weekday_minutes / 60:.1f}h, "
            f"Weekends (before) {weekend_minutes_before / 60:.1f}h, "
            f"Deficit {deficit_minutes / 60:.1f}h, "
            f"Weekends (after) {(actual_cycling_minutes - weekday_minutes) / 60:.1f}h, "
            f"Cycling {actual_cycling_minutes / 60:.1f}h, "
            f"Strength {actual_strength_minutes / 60:.1f}h, "
            f"Total {actual_total_minutes / 60:.1f}h"
        )

        # Debug: Log each workout being returned
        logger.info(f"Returning {len(all_workouts)} workouts to add_week_tool:")
        for i, w in enumerate(all_workouts):
            workout_dur = calculate_structure_duration(w.get("structure", {}))
            is_strength = self._is_strength_workout(w)
            logger.info(
                f"  [{i + 1}] {w.get('weekday')}: {w.get('description', 'N/A')[:40]} "
                f"({workout_dur:.0f}min, type={'STRENGTH' if is_strength else 'CYCLING'})"
            )

        return all_workouts
