"""Workout selector with stochastic sampling and variety tracking."""

import logging
from collections import deque
from copy import deepcopy

import numpy as np

from cycling_ai.core.workout_library.models import Workout, WorkoutLibrary

logger = logging.getLogger(__name__)


# Type compatibility matrix
# If exact match not found, use compatible types with partial credit
TYPE_COMPATIBILITY: dict[str, list[str]] = {
    "endurance": ["recovery", "mixed"],
    "recovery": ["endurance", "mixed"],
    "tempo": ["sweetspot", "mixed"],
    "sweetspot": ["tempo", "mixed"],
    "threshold": ["vo2max", "mixed"],
    "vo2max": ["threshold", "mixed"],
    "mixed": ["endurance", "recovery", "tempo", "sweetspot", "threshold", "vo2max"],
}

# Phase name mapping for LLM variations
# Maps alternative phase names to canonical library phase names
PHASE_NAME_MAPPING: dict[str, str] = {
    "Base": "Foundation",  # LLM often uses "Base" instead of "Foundation"
    "base": "Foundation",
    "foundation": "Foundation",
    "Build": "Build",
    "build": "Build",
    "Peak": "Peak",
    "peak": "Peak",
    "Recovery": "Recovery",
    "recovery": "Recovery",
    "Taper": "Taper",
    "taper": "Taper",
}


class VarietyTracker:
    """
    Tracks recently used workouts to prevent repetition.

    Maintains a rolling window of the last N workout IDs used.
    Default window is 20 workouts (approximately 4 weeks at 5 workouts/week).
    """

    def __init__(self, window_size: int = 20) -> None:
        """
        Initialize variety tracker.

        Args:
            window_size: Number of recent workouts to track (default 20 for 4-week coverage)
        """
        self.window_size = window_size
        self._recent_workouts: deque[str] = deque(maxlen=window_size)

    def add_workout(self, workout_id: str) -> None:
        """
        Add workout ID to tracking history.

        Args:
            workout_id: Unique workout identifier
        """
        self._recent_workouts.append(workout_id)

    def get_recent_ids(self) -> list[str]:
        """
        Get list of recently used workout IDs.

        Returns:
            List of workout IDs in chronological order
        """
        return list(self._recent_workouts)

    def reset(self) -> None:
        """Clear tracking history."""
        self._recent_workouts.clear()


class WorkoutSelector:
    """
    Selects workouts from library using multi-criteria scoring and stochastic sampling.

    Scoring breakdown (100 points total):
    - Type match: 40 points (exact match) or 20 points (compatible match)
    - Phase match: 25 points (if phase in suitable_phases)
    - Weekday match: 15 points (if weekday in suitable_weekdays)
    - Duration match: 15 points (inverse of duration difference %)
    - Variety bonus: 5 points (if NOT in recent history)

    Uses temperature-based stochastic sampling:
    - temperature=0.0: Deterministic (always best score)
    - temperature=0.5: Balanced (RECOMMENDED)
    - temperature=1.0: High randomness
    - temperature=2.0: Nearly uniform
    """

    def __init__(self, library: WorkoutLibrary) -> None:
        """
        Initialize workout selector.

        Args:
            library: Loaded workout library
        """
        self.library = library
        self.variety_tracker = VarietyTracker()  # Uses default window_size=20 (4 weeks)

        logger.info(f"Initialized WorkoutSelector with {len(library.workouts)} workouts")

    def score_workout(
        self,
        workout: Workout,
        target_type: str,
        target_phase: str,
        target_weekday: str,
        target_duration_min: float,
        min_duration_min: float | None,
        max_duration_min: float | None,
        variety_history: list[str],
    ) -> float:
        """
        Score workout based on multiple criteria.

        Args:
            workout: Candidate workout
            target_type: Target workout type
            target_phase: Target training phase
            target_weekday: Target weekday
            target_duration_min: Target duration in minutes
            min_duration_min: Minimum acceptable duration (hard constraint)
            max_duration_min: Maximum acceptable duration (hard constraint)
            variety_history: List of recently used workout IDs

        Returns:
            Score (0-100, higher is better, -1000 if violates hard constraints)
        """
        score = 0.0

        # Hard constraint: Duration limits
        if min_duration_min and workout.base_duration_min < min_duration_min:
            return -1000.0  # Heavily penalize
        if max_duration_min and workout.base_duration_min > max_duration_min:
            return -1000.0  # Heavily penalize

        # Type match (40 points for exact, 20 for compatible)
        if workout.type == target_type:
            score += 40
        elif target_type in TYPE_COMPATIBILITY.get(workout.type, []):
            score += 20

        # Phase match (25 points)
        if workout.suitable_phases and target_phase in workout.suitable_phases:
            score += 25

        # Weekday match (15 points)
        if workout.suitable_weekdays and target_weekday in workout.suitable_weekdays:
            score += 15

        # Duration match (15 points, inverse of percentage difference)
        if target_duration_min > 0:
            duration_diff_pct = (
                abs(workout.base_duration_min - target_duration_min) / target_duration_min
            )
            # Score inversely proportional to difference (0% diff = 15 pts, 100% diff = 0 pts)
            duration_score = max(0, 15 * (1 - min(duration_diff_pct, 1.0)))
            score += duration_score

        # Variety bonus (5 points if NOT recently used)
        if workout.id not in variety_history:
            score += 5

        return score

    def select_workout_stochastic(
        self,
        candidates: list[Workout],
        scores: list[float],
        temperature: float = 0.5,
        seed: int | None = None,
    ) -> Workout:
        """
        Select workout using temperature-based stochastic sampling.

        Uses softmax with temperature:
        probabilities = exp(scores/T) / sum(exp(scores/T))

        Args:
            candidates: List of candidate workouts
            scores: Corresponding scores for each candidate
            temperature: Controls randomness (0=deterministic, 2=uniform)
            seed: Random seed for reproducibility

        Returns:
            Selected workout
        """
        if not candidates:
            raise ValueError("No candidates to select from")

        if len(candidates) != len(scores):
            raise ValueError("Candidates and scores must have same length")

        # Set seed if provided
        if seed is not None:
            np.random.seed(seed)

        # Temperature = 0: deterministic (pick best)
        if temperature == 0.0:
            best_idx = int(np.argmax(scores))
            return candidates[best_idx]

        # Apply softmax with temperature
        scores_array = np.array(scores)
        # Subtract max for numerical stability
        exp_scores = np.exp((scores_array - np.max(scores_array)) / temperature)
        probabilities = exp_scores / np.sum(exp_scores)

        # Sample from distribution
        selected_idx = np.random.choice(len(candidates), p=probabilities)
        return candidates[int(selected_idx)]

    def adjust_workout_tss(
        self,
        workout: Workout,
        target_tss: float,
        tolerance_pct: float = 0.15,
    ) -> Workout:
        """
        Adjust workout using variable_components to hit target TSS.

        Args:
            workout: Base workout from library
            target_tss: Target TSS to achieve
            tolerance_pct: Tolerance percentage (default 15%)

        Returns:
            Adjusted workout (deep copy with modifications)
        """
        # Check if adjustment needed
        tss_diff_pct = abs(workout.base_tss - target_tss) / target_tss
        if tss_diff_pct <= tolerance_pct:
            # Within tolerance, no adjustment needed
            return deepcopy(workout)

        # Check if workout has variable components
        if workout.variable_components is None:
            logger.warning(
                f"Workout {workout.id} cannot be adjusted "
                f"(no variable_components), using original TSS"
            )
            return deepcopy(workout)

        # Calculate adjustment needed
        var_comp = workout.variable_components
        adjustable_field = var_comp.adjustable_field

        if adjustable_field == "duration":
            # For duration adjustments, scale proportionally
            scaling_factor = target_tss / workout.base_tss
            new_duration = workout.base_duration_min * scaling_factor

            # Clamp to min/max bounds
            new_duration = max(var_comp.min_value, min(var_comp.max_value, new_duration))

            # Calculate new TSS based on duration change
            new_tss = workout.base_tss * (new_duration / workout.base_duration_min)

            # Create adjusted workout
            adjusted_workout = deepcopy(workout)
            adjusted_workout.base_tss = new_tss
            adjusted_workout.base_duration_min = new_duration

            logger.info(
                f"Adjusted workout {workout.id}: "
                f"TSS {workout.base_tss:.0f} → {new_tss:.0f}, "
                f"Duration {workout.base_duration_min:.0f} → {new_duration:.0f} min"
            )
            return adjusted_workout

        elif adjustable_field == "sets":
            # For sets adjustments, use per-unit TSS and duration
            tss_per_unit = var_comp.tss_per_unit or 0
            duration_per_unit = var_comp.duration_per_unit_min or 0

            if tss_per_unit == 0:
                logger.warning(f"Workout {workout.id} has tss_per_unit=0, cannot adjust TSS")
                return deepcopy(workout)

            # Calculate units needed
            tss_diff = target_tss - workout.base_tss
            units_needed = tss_diff / tss_per_unit
            current_value = self._get_current_value(workout)
            new_value = current_value + units_needed

            # Clamp to min/max bounds
            new_value = max(var_comp.min_value, min(var_comp.max_value, new_value))

            # Calculate actual TSS and duration after adjustment
            units_delta = new_value - current_value
            new_tss = workout.base_tss + (units_delta * tss_per_unit)
            new_duration = workout.base_duration_min + (units_delta * duration_per_unit)

            # Create adjusted workout (deep copy)
            adjusted_workout = deepcopy(workout)
            adjusted_workout.base_tss = new_tss
            adjusted_workout.base_duration_min = new_duration

            logger.info(
                f"Adjusted workout {workout.id}: "
                f"TSS {workout.base_tss:.0f} → {new_tss:.0f}, "
                f"Duration {workout.base_duration_min:.0f} → {new_duration:.0f} min"
            )
            return adjusted_workout
        else:
            logger.warning(f"Unknown adjustable_field: {adjustable_field}, using original")
            return deepcopy(workout)

    def _get_current_value(self, workout: Workout) -> float:
        """
        Get current value of adjustable field.

        For 'sets': Find interval segment and return its sets count
        For 'duration': Find main work segment and return its duration

        Args:
            workout: Workout to inspect

        Returns:
            Current value of adjustable field
        """
        if workout.variable_components is None:
            return 0.0

        adjustable_field = workout.variable_components.adjustable_field

        if adjustable_field == "sets":
            # Find interval segment
            for segment in workout.segments:
                if segment.type == "interval" and segment.sets is not None:
                    return float(segment.sets)
            return 0.0

        elif adjustable_field == "duration":
            # Find main work segment (longest steady/interval segment)
            max_duration = 0.0
            for segment in workout.segments:
                if segment.type in ["steady", "interval"]:
                    if segment.duration_min is not None:
                        max_duration = max(max_duration, segment.duration_min)
                    elif segment.sets and segment.work:
                        # Interval total duration
                        total = segment.sets * segment.work.duration_min
                        max_duration = max(max_duration, total)
            return max_duration

        return 0.0

    def select_workout(
        self,
        target_type: str,
        target_phase: str,
        target_weekday: str,
        target_duration_min: float,
        min_duration_min: float | None = None,
        max_duration_min: float | None = None,
        temperature: float = 0.5,
        seed: int | None = None,
        exclude_ids: list[str] | None = None,
    ) -> Workout | None:
        """
        Select best-matching workout from library.

        Args:
            target_type: Target workout type
            target_phase: Target training phase
            target_weekday: Target weekday
            target_duration_min: Target duration in minutes
            min_duration_min: Minimum acceptable duration (hard constraint)
            max_duration_min: Maximum acceptable duration (hard constraint)
            temperature: Sampling temperature (0=deterministic, 0.5=balanced)
            seed: Random seed for reproducibility
            exclude_ids: List of workout IDs to exclude (hard constraint for same-week duplicates)

        Returns:
            Selected and adjusted workout, or None if no candidates found
        """
        # Normalize phase name using mapping (Base → Foundation, etc.)
        normalized_phase = PHASE_NAME_MAPPING.get(target_phase, target_phase)
        if normalized_phase != target_phase:
            logger.info(
                f"Mapped phase '{target_phase}' → '{normalized_phase}' for library compatibility"
            )

        # Filter candidates by phase (mandatory)
        candidates = [
            w
            for w in self.library.workouts
            if w.suitable_phases and normalized_phase in w.suitable_phases
        ]

        # Filter out excluded workout IDs (hard constraint for same-week duplicates)
        if exclude_ids:
            candidates = [w for w in candidates if w.id not in exclude_ids]
            logger.debug(f"Filtered out {len(exclude_ids)} excluded workout IDs")

        if not candidates:
            logger.warning(
                f"No workouts found for phase={normalized_phase} (original: {target_phase})"
            )
            return None

        # Score all candidates
        variety_history = self.variety_tracker.get_recent_ids()
        scores = [
            self.score_workout(
                workout=w,
                target_type=target_type,
                target_phase=normalized_phase,  # Use normalized phase for scoring
                target_weekday=target_weekday,
                target_duration_min=target_duration_min,
                min_duration_min=min_duration_min,
                max_duration_min=max_duration_min,
                variety_history=variety_history,
            )
            for w in candidates
        ]

        # Select using stochastic sampling
        selected = self.select_workout_stochastic(
            candidates=candidates,
            scores=scores,
            temperature=temperature,
            seed=seed,
        )

        logger.info(
            f"Selected workout: {selected.name} "
            f"(type={selected.type}, duration={selected.base_duration_min:.0f}min)"
        )

        return selected
