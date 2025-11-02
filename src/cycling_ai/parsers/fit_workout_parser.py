"""
FIT Workout File Parser

Parses FIT workout files (structured workout definitions) into our internal
workout library format. Supports workouts from Garmin, Wahoo, TrainingPeaks, etc.

Usage:
    parser = FitWorkoutParser()
    workout = parser.parse_workout_file("workout.fit", ftp=260)
    library_format = workout.to_library_format()
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any


class FitIntensity(Enum):
    """FIT intensity types (mapped from FIT SDK)."""

    WARMUP = "warmup"
    ACTIVE = "active"
    REST = "rest"
    COOLDOWN = "cooldown"


class FitDurationType(Enum):
    """FIT duration types."""

    TIME = "time"
    DISTANCE = "distance"
    OPEN = "open"
    REPEAT_UNTIL_STEPS_COMPLETE = "repeat_until_steps_cmplt"


class FitTargetType(Enum):
    """FIT target types."""

    POWER = "power"
    HEART_RATE = "heart_rate"
    OPEN = "open"


@dataclass
class FitWorkoutMetadata:
    """
    Metadata extracted from FIT file_id and workout messages.

    Attributes:
        name: Workout name from FIT file
        sport: Sport type (cycling, running, etc.)
        num_steps: Total number of workout steps
        manufacturer: Device manufacturer (optional)
        time_created: Timestamp when workout was created (optional)
    """

    name: str
    sport: str
    num_steps: int
    manufacturer: str | None = None
    time_created: datetime | None = None

    def __post_init__(self) -> None:
        """Validate metadata after initialization."""
        if not self.name:
            raise ValueError("Workout name cannot be empty")
        if self.num_steps <= 0:
            raise ValueError(f"Invalid step count: {self.num_steps}")
        if not self.sport:
            raise ValueError("Sport cannot be empty")


@dataclass
class FitWorkoutStep:
    """
    Single step from FIT workout.

    Represents one workout_step message from the FIT file.
    Each step defines a segment with duration, intensity, and target.

    Attributes:
        message_index: Step sequence number (0-indexed)
        intensity: Intensity classification (warmup, active, rest, cooldown)
        duration_type: How duration is measured (time, distance, open, repeat)
        duration_value: Duration value (seconds for TIME, step count for REPEAT)
        target_type: What metric to target (power, heart rate, open)
        target_power_zone: Power zone number (1-7) if using zones
        custom_power_low: Lower power bound in watts if using custom range
        custom_power_high: Upper power bound in watts if using custom range
        repeat_from: Start step index for repeat structures
        repeat_to: End step index for repeat structures
        repeat_steps: Number of repetitions for repeat structures
        step_name: Human-readable step name
    """

    message_index: int
    intensity: FitIntensity | None
    duration_type: FitDurationType
    duration_value: float
    target_type: FitTargetType

    # Power targets (only one set will be populated)
    target_power_zone: int | None = None
    custom_power_low: int | None = None
    custom_power_high: int | None = None

    # Repeat structure (only for REPEAT steps)
    repeat_from: int | None = None
    repeat_to: int | None = None
    repeat_steps: int | None = None

    step_name: str = ""

    def is_repeat_step(self) -> bool:
        """
        Check if this is a repeat structure step.

        Returns:
            True if step is a repeat control step
        """
        return self.duration_type == FitDurationType.REPEAT_UNTIL_STEPS_COMPLETE

    def has_power_zone(self) -> bool:
        """
        Check if step uses power zone (not custom range).

        Returns:
            True if step targets a power zone (1-7)
        """
        return self.target_power_zone is not None and self.target_power_zone > 0

    def has_custom_power(self) -> bool:
        """
        Check if step uses custom power range.

        Returns:
            True if step targets a specific wattage range
        """
        return (
            self.custom_power_low is not None and self.custom_power_high is not None
        )

    def __post_init__(self) -> None:
        """Validate step data after initialization."""
        if self.message_index < 0:
            raise ValueError(f"Invalid message_index: {self.message_index}")

        if self.duration_value < 0:
            raise ValueError(f"Invalid duration_value: {self.duration_value}")

        # Validate repeat step has repeat_steps
        if self.is_repeat_step() and (
            self.repeat_steps is None or self.repeat_steps <= 0
        ):
            raise ValueError(
                f"Repeat step at index {self.message_index} "
                f"missing valid repeat_steps value"
            )


@dataclass
class FitRepeatStructure:
    """
    Represents a repeat/interval structure in FIT workout.

    Groups work and recovery steps into an interval set.

    Attributes:
        repeat_count: Number of times to repeat the interval
        work_step: The work interval step
        recovery_step: The recovery step (optional)
    """

    repeat_count: int
    work_step: FitWorkoutStep
    recovery_step: FitWorkoutStep | None = None

    def to_interval_segment(self, ftp: float) -> dict[str, Any]:
        """
        Convert repeat structure to interval segment.

        Args:
            ftp: Functional Threshold Power for % calculations

        Returns:
            Interval segment dictionary matching library format
        """
        segment: dict[str, Any] = {
            "type": "interval",
            "sets": self.repeat_count,
            "work": {
                "duration_min": int(self.work_step.duration_value / 60),
                "power_low_pct": self._calculate_power_pct(
                    self.work_step.custom_power_low or 0, ftp
                ),
                "power_high_pct": self._calculate_power_pct(
                    self.work_step.custom_power_high or 0, ftp
                ),
                "description": self.work_step.step_name or "Work",
            },
        }

        if self.recovery_step:
            segment["recovery"] = {
                "duration_min": int(self.recovery_step.duration_value / 60),
                "power_low_pct": self._calculate_power_pct(
                    self.recovery_step.custom_power_low or 0, ftp
                ),
                "power_high_pct": self._calculate_power_pct(
                    self.recovery_step.custom_power_high or 0, ftp
                ),
                "description": self.recovery_step.step_name or "Recovery",
            }

        return segment

    @staticmethod
    def _calculate_power_pct(watts: int, ftp: float) -> int:
        """
        Calculate power as percentage of FTP.

        Args:
            watts: Power in watts
            ftp: Functional Threshold Power

        Returns:
            Power as integer percentage

        Raises:
            ValueError: If FTP is invalid
        """
        if ftp <= 0:
            raise ValueError(f"Invalid FTP: {ftp}")
        return int((watts / ftp) * 100)

    def __post_init__(self) -> None:
        """Validate repeat structure."""
        if self.repeat_count <= 0:
            raise ValueError(f"Invalid repeat_count: {self.repeat_count}")


@dataclass
class ParsedWorkout:
    """
    Complete parsed workout ready for library format.

    Represents a fully processed workout that can be converted
    to the workout library JSON format.

    Attributes:
        metadata: Workout metadata from FIT file
        segments: List of segment dictionaries
        base_duration_min: Total workout duration in minutes
        base_tss: Estimated Training Stress Score
    """

    metadata: FitWorkoutMetadata
    segments: list[dict[str, Any]]
    base_duration_min: int
    base_tss: float

    def to_library_format(self) -> dict[str, Any]:
        """
        Convert to workout library JSON format.

        Returns:
            Dictionary matching workout library schema
        """
        workout_id = self._generate_workout_id()
        workout_type = self._infer_workout_type()
        intensity = self._infer_intensity()

        return {
            "id": workout_id,
            "name": self.metadata.name,
            "detailed_description": "",  # Not available from FIT
            "type": workout_type,
            "intensity": intensity,
            "suitable_phases": self._get_suitable_phases(intensity),
            "suitable_weekdays": ["Tuesday", "Wednesday", "Thursday"],
            "segments": self.segments,
            "base_duration_min": self.base_duration_min,
            "base_tss": self.base_tss,
            "variable_components": self._detect_variable_components(),
        }

    def _generate_workout_id(self) -> str:
        """
        Generate unique workout ID from name.

        Converts workout name to snake_case identifier.

        Returns:
            Snake-case workout ID (max 50 chars)
        """
        name = self.metadata.name.lower()
        name = re.sub(r"[^\w\s-]", "", name)
        name = re.sub(r"[-\s]+", "_", name)
        return name[:50]  # Limit length

    def _infer_workout_type(self) -> str:
        """
        Infer workout type from segments.

        Analyzes power percentages in main intervals to classify workout.

        Returns:
            Workout type (vo2max, threshold, sweet_spot, tempo, endurance)
        """
        # Find interval segments
        interval_segs = [s for s in self.segments if s.get("type") == "interval"]

        if not interval_segs:
            return "endurance"  # Default for non-interval workouts

        # Get power from first interval
        work = interval_segs[0].get("work", {})
        power_high = work.get("power_high_pct", 75)

        # Classify based on power percentage
        if power_high >= 106:
            return "vo2max"
        elif power_high >= 91:
            return "threshold"
        elif power_high >= 88:
            return "sweet_spot"
        elif power_high >= 76:
            return "tempo"
        else:
            return "endurance"

    def _infer_intensity(self) -> str:
        """
        Determine if workout is hard or easy.

        Returns:
            Intensity level ("hard" or "easy")
        """
        workout_type = self._infer_workout_type()

        hard_types = ["vo2max", "threshold", "sweet_spot"]
        return "hard" if workout_type in hard_types else "easy"

    def _get_suitable_phases(self, intensity: str) -> list[str]:
        """
        Get training phases suitable for this workout.

        Args:
            intensity: Workout intensity ("hard" or "easy")

        Returns:
            List of suitable phase names
        """
        if intensity == "hard":
            return ["Build", "Peak"]
        else:
            return ["Foundation", "Build", "Recovery"]

    def _detect_variable_components(self) -> dict[str, Any]:
        """
        Detect which components can be adjusted.

        Checks if workout has intervals (adjust sets) or
        steady segments (adjust duration).

        Returns:
            Variable components configuration
        """
        # Check for intervals
        interval_segs = [s for s in self.segments if s.get("type") == "interval"]

        if interval_segs:
            # Interval workout - sets are adjustable
            sets = interval_segs[0].get("sets", 5)
            return {
                "adjustable_field": "sets",
                "min_value": max(3, sets - 2),
                "max_value": sets + 3,
                "tss_per_unit": 15,  # Estimate
            }
        else:
            # Steady workout - duration is adjustable
            return {
                "adjustable_field": "duration",
                "min_value": 60,
                "max_value": 180,
                "tss_per_unit": 1,  # TSS per minute
            }

    def __post_init__(self) -> None:
        """Validate parsed workout."""
        if not self.segments:
            raise ValueError("Workout has no segments")

        if self.base_duration_min <= 0:
            raise ValueError(f"Invalid duration: {self.base_duration_min}")

        if self.base_tss < 0:
            raise ValueError(f"Invalid TSS: {self.base_tss}")


class FitWorkoutParser:
    """
    Parse FIT workout files into workout library format.

    This parser handles FIT files containing workout definitions
    (not activity recordings). It extracts structured workout data
    and converts it to our internal workout library schema.

    Usage:
        parser = FitWorkoutParser()
        workout = parser.parse_workout_file(
            fit_path="workout.fit",
            ftp=260
        )
        library_format = workout.to_library_format()

    Attributes:
        None (stateless parser)
    """

    def __init__(self) -> None:
        """Initialize parser."""
        pass
