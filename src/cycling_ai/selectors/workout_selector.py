"""
Workout Selector - Intelligent workout selection from library.

Selects and adjusts workouts from the 222-workout library based on:
- Training phase (Foundation, Build, Peak, Recovery, Taper)
- Target duration and duration constraints (weekday/weekend limits)
- Available weekdays
- Workout type and intensity requirements
- Variable component adjustments (sets/duration)
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class WorkoutRequirements:
    """Requirements for workout selection."""

    weekday: str
    phase: str  # Foundation, Build, Peak, Recovery, Taper
    workout_type: str | None = None  # vo2max, threshold, sweet_spot, tempo, endurance, recovery
    intensity: str | None = None  # hard, easy
    target_duration_min: float | None = None  # Target duration in minutes
    duration_tolerance_pct: float = 0.20  # 20% tolerance for target duration
    # Duration constraints (hard limits)
    min_duration_min: float | None = None  # Minimum acceptable duration
    max_duration_min: float | None = None  # Maximum acceptable duration


@dataclass
class SelectedWorkout:
    """A selected workout with adjustments applied."""

    workout_id: str
    name: str
    detailed_description: str
    workout_type: str
    intensity: str
    weekday: str
    segments: list[dict[str, Any]]
    duration_min: float
    adjusted: bool  # True if variable components were adjusted
    adjustment_details: dict[str, Any] | None = None


class WorkoutSelector:
    """
    Selects and adjusts workouts from the workout library.

    The selector filters workouts based on requirements, scores candidates
    by fit quality, and adjusts variable components to hit targets.

    Example:
        >>> selector = WorkoutSelector()
        >>> requirements = WorkoutRequirements(
        ...     weekday="Tuesday",
        ...     phase="Build",
        ...     workout_type="vo2max",
        ...     intensity="hard",
        ...     target_duration_min=60,
        ...     min_duration_min=45,
        ...     max_duration_min=90
        ... )
        >>> workout = selector.select_workout(requirements)
        >>> print(f"{workout.name}: {workout.duration_min} min")
    """

    def __init__(self, library_path: Path | str | None = None):
        """
        Initialize workout selector.

        Args:
            library_path: Path to workout library JSON file.
                         Defaults to data/workout_library.json
        """
        if library_path is None:
            # Default to data/workout_library.json in project root
            library_path = Path(__file__).parent.parent.parent.parent / "data" / "workout_library.json"

        self.library_path = Path(library_path)
        self.workouts = self._load_library()

        logger.info(f"Loaded {len(self.workouts)} workouts from library")

    def _load_library(self) -> list[dict[str, Any]]:
        """Load workout library from JSON file."""
        if not self.library_path.exists():
            raise FileNotFoundError(
                f"Workout library not found: {self.library_path}\nPlease ensure the library file exists."
            )

        with open(self.library_path) as f:
            library = json.load(f)

        workouts: list[dict[str, Any]] = library.get("workouts", [])
        return workouts

    def select_workout(self, requirements: WorkoutRequirements) -> SelectedWorkout | None:
        """
        Select best-matching workout from library.

        Selection process:
        1. Filter workouts by phase, type, intensity
        2. Score candidates by weekday match, duration fit
        3. Select highest-scoring workout
        4. Adjust variable components if needed to hit duration target

        Args:
            requirements: Workout selection requirements

        Returns:
            SelectedWorkout with adjustments, or None if no match found
        """
        # Filter candidates
        candidates = self._filter_candidates(requirements)

        if not candidates:
            logger.warning(
                f"No workouts found matching: phase={requirements.phase}, "
                f"type={requirements.workout_type}, intensity={requirements.intensity}"
            )
            return None

        # Score and select best candidate
        best_workout = self._select_best_candidate(candidates, requirements)

        # Adjust variable components if needed
        return self._adjust_workout(best_workout, requirements)

    def _filter_candidates(self, requirements: WorkoutRequirements) -> list[dict[str, Any]]:
        """
        Filter workouts by phase, type, intensity.

        Args:
            requirements: Workout selection requirements

        Returns:
            List of candidate workouts that match filters
        """
        candidates = self.workouts

        # Filter by phase
        candidates = [w for w in candidates if requirements.phase in w.get("suitable_phases", [])]

        # Filter by workout type (if specified)
        if requirements.workout_type:
            candidates = [w for w in candidates if w.get("type") == requirements.workout_type]

        # Filter by intensity (if specified)
        if requirements.intensity:
            candidates = [w for w in candidates if w.get("intensity") == requirements.intensity]

        return candidates

    def _select_best_candidate(
        self, candidates: list[dict[str, Any]], requirements: WorkoutRequirements
    ) -> dict[str, Any]:
        """
        Score candidates and select best match.

        Scoring factors (higher = better):
        - Weekday match: +100 if in suitable_weekdays, 0 otherwise
        - Duration constraints: -1000 if outside min/max range (hard constraint)
        - Duration fit: -abs(target_duration - base_duration) if target specified
        - Adjustability: +10 if has variable_components

        Args:
            candidates: List of candidate workouts
            requirements: Workout selection requirements

        Returns:
            Best-matching workout
        """
        scored_candidates: list[tuple[float, dict[str, Any]]] = []

        for workout in candidates:
            score = 0.0

            # Weekday match (highly weighted)
            suitable_weekdays = workout.get("suitable_weekdays", [])
            if requirements.weekday in suitable_weekdays:
                score += 100

            # Duration constraint enforcement (hard limits)
            base_duration = workout.get("base_duration_min", 0)

            # Hard constraint: min/max duration
            if requirements.min_duration_min and base_duration < requirements.min_duration_min:
                score -= 1000  # Heavily penalize workouts below minimum
            if requirements.max_duration_min and base_duration > requirements.max_duration_min:
                score -= 1000  # Heavily penalize workouts above maximum

            # Duration fit (if target specified)
            if requirements.target_duration_min is not None:
                duration_diff = abs(requirements.target_duration_min - base_duration)
                # Penalize by duration difference (less penalty = better fit)
                score -= duration_diff

            # Adjustability bonus
            if workout.get("variable_components"):
                score += 10

            scored_candidates.append((score, workout))

        # Sort by score (descending) and return best
        scored_candidates.sort(key=lambda x: x[0], reverse=True)

        if not scored_candidates:
            raise ValueError("No candidates to select from")

        best_score, best_workout = scored_candidates[0]

        logger.debug(f"Selected workout '{best_workout['name']}' with score {best_score:.1f}")

        return best_workout

    def _adjust_workout(self, workout: dict[str, Any], requirements: WorkoutRequirements) -> SelectedWorkout:
        """
        Adjust workout variable components to fit duration constraints.

        Variable components can be:
        - "sets": Number of interval repetitions
        - "duration": Length of main segment

        Args:
            workout: Base workout from library
            requirements: Target requirements (duration-based)

        Returns:
            SelectedWorkout with adjustments applied
        """
        base_duration = workout["base_duration_min"]
        variable_components = workout.get("variable_components")

        # Check if adjustment is needed
        needs_adjustment = False
        target_duration = None

        # Determine target duration
        if requirements.target_duration_min:
            target_duration = requirements.target_duration_min
        elif requirements.min_duration_min and base_duration < requirements.min_duration_min:
            target_duration = requirements.min_duration_min
            needs_adjustment = True
        elif requirements.max_duration_min and base_duration > requirements.max_duration_min:
            target_duration = requirements.max_duration_min
            needs_adjustment = True

        # Check if within tolerance
        if target_duration and requirements.duration_tolerance_pct:
            duration_diff_pct = abs(base_duration - target_duration) / target_duration
            if duration_diff_pct > requirements.duration_tolerance_pct:
                needs_adjustment = True

        # If no targets or no adjustability or no adjustment needed, return as-is
        if not variable_components or not needs_adjustment or not target_duration:
            return SelectedWorkout(
                workout_id=workout["id"],
                name=workout["name"],
                detailed_description=workout.get("detailed_description", ""),
                workout_type=workout["type"],
                intensity=workout["intensity"],
                weekday=requirements.weekday,
                segments=workout["segments"],
                duration_min=base_duration,
                adjusted=False,
                adjustment_details=None,
            )

        # Calculate adjustment needed
        adjustable_field = variable_components["adjustable_field"]
        min_value = variable_components["min_value"]
        max_value = variable_components["max_value"]
        duration_per_unit = variable_components.get("duration_per_unit_min", 0)

        if duration_per_unit == 0:
            # Cannot adjust without duration_per_unit
            return SelectedWorkout(
                workout_id=workout["id"],
                name=workout["name"],
                detailed_description=workout.get("detailed_description", ""),
                workout_type=workout["type"],
                intensity=workout["intensity"],
                weekday=requirements.weekday,
                segments=workout["segments"],
                duration_min=base_duration,
                adjusted=False,
                adjustment_details=None,
            )

        # Calculate units to adjust
        duration_diff = target_duration - base_duration
        units_adjustment = round(duration_diff / duration_per_unit)
        adjusted_value = self._calculate_base_value(workout, adjustable_field) + units_adjustment

        # Clamp to min/max
        adjusted_value = max(min_value, min(max_value, adjusted_value))

        # Calculate new duration
        units_delta = adjusted_value - self._calculate_base_value(workout, adjustable_field)
        new_duration = base_duration + (units_delta * duration_per_unit)

        # Apply adjustment to segments
        adjusted_segments = self._apply_adjustment(workout["segments"], adjustable_field, adjusted_value)

        return SelectedWorkout(
            workout_id=workout["id"],
            name=workout["name"],
            detailed_description=workout.get("detailed_description", ""),
            workout_type=workout["type"],
            intensity=workout["intensity"],
            weekday=requirements.weekday,
            segments=adjusted_segments,
            duration_min=new_duration,
            adjusted=True,
            adjustment_details={
                "field": adjustable_field,
                "original_value": self._calculate_base_value(workout, adjustable_field),
                "adjusted_value": adjusted_value,
                "original_duration_min": base_duration,
                "adjusted_duration_min": new_duration,
            },
        )

    def _calculate_base_value(self, workout: dict[str, Any], adjustable_field: str) -> int | float:
        """
        Calculate the base value for the adjustable field.

        Args:
            workout: Workout from library
            adjustable_field: "sets" or "duration"

        Returns:
            Base value (e.g., number of sets or duration in minutes)
        """
        if adjustable_field == "sets":
            # Find the interval segment and get its sets
            for segment in workout["segments"]:
                if segment.get("type") == "interval":
                    sets_value: int = int(segment.get("sets", 1))
                    return sets_value
            return 1  # Default if no interval segment found

        elif adjustable_field == "duration":
            # Find the main work segment and get its duration
            # Usually the longest steady/tempo/interval segment
            max_duration = 0
            for segment in workout["segments"]:
                if segment["type"] in ["steady", "tempo", "interval"]:
                    duration = segment.get("duration_min", 0)
                    if segment["type"] == "interval":
                        # For intervals, calculate total work time
                        sets = segment.get("sets", 1)
                        work_duration = segment.get("work", {}).get("duration_min", 0)
                        duration = sets * work_duration
                    if duration > max_duration:
                        max_duration = duration
            return max_duration

        return 0

    def _apply_adjustment(
        self,
        segments: list[dict[str, Any]],
        adjustable_field: str,
        adjusted_value: int | float,
    ) -> list[dict[str, Any]]:
        """
        Apply adjustment to workout segments.

        Args:
            segments: Original workout segments
            adjustable_field: "sets" or "duration"
            adjusted_value: New value to apply

        Returns:
            Adjusted segments (deep copy)
        """
        import copy

        adjusted_segments = copy.deepcopy(segments)

        if adjustable_field == "sets":
            # Adjust interval segment sets
            for segment in adjusted_segments:
                if segment.get("type") == "interval":
                    segment["sets"] = int(adjusted_value)
                    break

        elif adjustable_field == "duration":
            # Adjust main work segment duration
            max_duration_idx = -1
            max_duration = 0

            for idx, segment in enumerate(adjusted_segments):
                if segment["type"] in ["steady", "tempo", "interval"]:
                    duration = segment.get("duration_min", 0)
                    if segment["type"] == "interval":
                        sets = segment.get("sets", 1)
                        work_duration = segment.get("work", {}).get("duration_min", 0)
                        duration = sets * work_duration
                    if duration > max_duration:
                        max_duration = duration
                        max_duration_idx = idx

            if max_duration_idx >= 0:
                segment = adjusted_segments[max_duration_idx]
                if segment["type"] == "interval":
                    # Adjust work duration in interval
                    if "work" in segment:
                        sets = segment.get("sets", 1)
                        segment["work"]["duration_min"] = float(adjusted_value) / sets
                else:
                    # Adjust segment duration directly
                    segment["duration_min"] = float(adjusted_value)

        return adjusted_segments

    def get_workouts_by_type(self, workout_type: str) -> list[dict[str, Any]]:
        """
        Get all workouts of a specific type.

        Args:
            workout_type: Workout type (vo2max, threshold, sweet_spot, etc.)

        Returns:
            List of workouts matching the type
        """
        return [w for w in self.workouts if w.get("type") == workout_type]

    def get_workouts_by_phase(self, phase: str) -> list[dict[str, Any]]:
        """
        Get all workouts suitable for a training phase.

        Args:
            phase: Training phase (Foundation, Build, Peak, Recovery, Taper)

        Returns:
            List of workouts suitable for the phase
        """
        return [w for w in self.workouts if phase in w.get("suitable_phases", [])]

    def get_workout_stats(self) -> dict[str, Any]:
        """
        Get statistics about the workout library.

        Returns:
            Dictionary with counts by type, phase, intensity
        """
        from collections import Counter

        types = Counter(w.get("type") for w in self.workouts)
        intensities = Counter(w.get("intensity") for w in self.workouts)

        phases: dict[str, int] = {}
        for workout in self.workouts:
            for phase in workout.get("suitable_phases", []):
                phases[phase] = phases.get(phase, 0) + 1

        return {
            "total_workouts": len(self.workouts),
            "by_type": dict(types),
            "by_intensity": dict(intensities),
            "by_phase": phases,
            "avg_duration_min": sum(w.get("base_duration_min", 0) for w in self.workouts) / len(self.workouts)
            if self.workouts
            else 0,
            "avg_tss": sum(w.get("base_tss", 0) for w in self.workouts) / len(self.workouts) if self.workouts else 0,
        }
