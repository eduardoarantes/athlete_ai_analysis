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
from pathlib import Path
from typing import Any

import fitdecode


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
                "duration_min": float(self.work_step.duration_value / 60),
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
                "duration_min": float(self.recovery_step.duration_value / 60),
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
    base_duration_min: float
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

    def parse_workout_file(
        self,
        fit_path: Path | str,
        ftp: float,
    ) -> ParsedWorkout:
        """
        Parse FIT workout file into ParsedWorkout object.

        Args:
            fit_path: Path to FIT workout file
            ftp: Athlete's FTP for power percentage calculations

        Returns:
            ParsedWorkout object ready for library format conversion

        Raises:
            FileNotFoundError: If FIT file doesn't exist
            ValueError: If FIT file is invalid or not a workout file

        Example:
            >>> parser = FitWorkoutParser()
            >>> workout = parser.parse_workout_file("vo2max.fit", ftp=260)
            >>> workout.metadata.name
            'VO2 Max intervals'
        """
        fit_path = Path(fit_path)

        # Validate file exists
        if not fit_path.exists():
            raise FileNotFoundError(f"FIT file not found: {fit_path}")

        # Validate FTP
        if ftp <= 0:
            raise ValueError(f"Invalid FTP: {ftp}. Must be positive.")

        # Parse FIT file - need to read multiple times, so don't use context manager
        # Extract metadata
        try:
            fit_file_metadata = fitdecode.FitReader(str(fit_path))
            metadata = self._extract_metadata(fit_file_metadata)
        except Exception as e:
            raise ValueError(f"Failed to parse FIT file metadata: {e}") from e

        # Extract steps (need fresh reader since iterator is consumed)
        try:
            fit_file_steps = fitdecode.FitReader(str(fit_path))
            steps = self._extract_steps(fit_file_steps)
        except Exception as e:
            raise ValueError(f"Failed to parse FIT file steps: {e}") from e

        # Validate workout structure
        self._validate_workout_structure(metadata, steps)

        # Build segments from steps
        segments = self._build_segments(steps, ftp)

        # Calculate duration and TSS
        duration = self._calculate_total_duration(segments)
        tss = self._calculate_base_tss(segments, ftp)

        return ParsedWorkout(
            metadata=metadata,
            segments=segments,
            base_duration_min=duration,
            base_tss=tss,
        )

    def _extract_metadata(self, fit_file: fitdecode.FitReader) -> FitWorkoutMetadata:
        """
        Extract workout metadata from FIT file.

        Processes file_id and workout messages to get:
        - Workout name
        - Sport type
        - Number of steps
        - Creation time (optional)

        Args:
            fit_file: Parsed FIT file

        Returns:
            FitWorkoutMetadata object

        Raises:
            ValueError: If required metadata is missing
        """
        name = ""
        sport = "cycling"
        num_steps = 0
        manufacturer = None
        time_created = None

        # Extract from workout message
        for frame in fit_file:
            if not isinstance(frame, fitdecode.FitDataMessage):
                continue

            if frame.name == "workout":
                for field in frame.fields:
                    if field.name == "wkt_name" and field.value:
                        name = str(field.value)
                    elif field.name == "sport" and field.value:
                        sport = str(field.value)
                    elif field.name == "num_valid_steps" and field.value:
                        num_steps = int(field.value)

            elif frame.name == "file_id":
                for field in frame.fields:
                    if field.name == "manufacturer" and field.value:
                        manufacturer = str(field.value)
                    elif field.name == "time_created" and field.value:
                        time_created = field.value

        # Validate required fields
        if not name:
            raise ValueError(
                "Workout name not found in FIT file. "
                "This may not be a valid workout file."
            )

        if num_steps == 0:
            raise ValueError(
                "Number of steps not found in FIT file. "
                "This may not be a valid workout file."
            )

        return FitWorkoutMetadata(
            name=name,
            sport=sport,
            num_steps=num_steps,
            manufacturer=manufacturer,
            time_created=time_created,
        )

    def _extract_steps(self, fit_file: fitdecode.FitReader) -> list[FitWorkoutStep]:
        """
        Extract all workout steps from FIT file.

        Processes workout_step messages to extract:
        - Duration and type
        - Intensity level
        - Power targets (zone or custom)
        - Repeat structures

        Args:
            fit_file: Parsed FIT file

        Returns:
            List of FitWorkoutStep objects in order
        """
        steps: list[FitWorkoutStep] = []

        for frame in fit_file:
            if not isinstance(frame, fitdecode.FitDataMessage):
                continue

            if frame.name == "workout_step":
                step_data: dict[str, Any] = {}

                # Extract all fields from the frame
                for field in frame.fields:
                    if field.value is not None:
                        step_data[field.name] = field.value

                # Build FitWorkoutStep from extracted data
                step = self._build_step_from_data(step_data)
                steps.append(step)

        # Sort by message_index to ensure correct order
        steps.sort(key=lambda s: s.message_index)

        return steps

    def _build_step_from_data(self, data: dict[str, Any]) -> FitWorkoutStep:
        """
        Build FitWorkoutStep from raw field data.

        Args:
            data: Dictionary of field name -> value from FIT message

        Returns:
            FitWorkoutStep object
        """
        # Map intensity string to enum
        intensity_map = {
            "warmup": FitIntensity.WARMUP,
            "active": FitIntensity.ACTIVE,
            "rest": FitIntensity.REST,
            "cooldown": FitIntensity.COOLDOWN,
        }

        intensity_str = str(data.get("intensity", "")).lower()
        intensity = intensity_map.get(intensity_str)

        # Map duration type
        duration_type_map = {
            "time": FitDurationType.TIME,
            "distance": FitDurationType.DISTANCE,
            "open": FitDurationType.OPEN,
            "repeat_until_steps_cmplt": FitDurationType.REPEAT_UNTIL_STEPS_COMPLETE,
        }

        duration_type_str = str(data.get("duration_type", "")).lower()
        duration_type = duration_type_map.get(duration_type_str, FitDurationType.TIME)

        # Map target type
        target_type_map = {
            "power": FitTargetType.POWER,
            "heart_rate": FitTargetType.HEART_RATE,
            "open": FitTargetType.OPEN,
        }

        target_type_str = str(data.get("target_type", "")).lower()
        target_type = target_type_map.get(target_type_str, FitTargetType.OPEN)

        # Extract duration value based on duration type
        if duration_type == FitDurationType.TIME:
            duration_value = float(data.get("duration_time", 0))
        elif duration_type == FitDurationType.REPEAT_UNTIL_STEPS_COMPLETE:
            # For repeat steps, duration_value should be the repeat count
            duration_value = float(data.get("repeat_steps", 0))
        else:
            duration_value = float(data.get("duration_value", 0))

        # Extract repeat_steps for repeat structures
        repeat_steps_value = None
        if duration_type == FitDurationType.REPEAT_UNTIL_STEPS_COMPLETE:
            repeat_steps_value = data.get("repeat_steps")
            if repeat_steps_value is not None:
                repeat_steps_value = int(repeat_steps_value)

        return FitWorkoutStep(
            message_index=int(data.get("message_index", 0)),
            intensity=intensity,
            duration_type=duration_type,
            duration_value=duration_value,
            target_type=target_type,
            target_power_zone=data.get("target_power_zone"),
            custom_power_low=data.get("custom_target_power_low"),
            custom_power_high=data.get("custom_target_power_high"),
            repeat_from=data.get("duration_step"),
            repeat_to=None,  # Not directly in FIT messages
            repeat_steps=repeat_steps_value,
            step_name=str(data.get("wkt_step_name", "")),
        )

    def _convert_step_to_segment(
        self,
        step: FitWorkoutStep,
        ftp: float,
    ) -> dict[str, Any] | None:
        """
        Convert single FIT step to segment.

        Handles simple steps (warmup, cooldown, steady).
        Repeat steps are handled separately.

        Args:
            step: FitWorkoutStep to convert
            ftp: Athlete's FTP for percentage calculations

        Returns:
            Segment dictionary or None if step should be skipped
        """
        # Skip repeat steps (handled separately)
        if step.is_repeat_step():
            return None

        # Skip OPEN duration steps (no specific duration)
        if step.duration_type == FitDurationType.OPEN:
            return None

        # Map intensity to segment type
        segment_type = self._map_intensity_to_type(step.intensity)

        # Convert duration to minutes
        duration_min = float(step.duration_value / 60)

        # Get power percentages
        power_low_pct = self._get_power_pct(step, ftp, is_low=True)
        power_high_pct = self._get_power_pct(step, ftp, is_low=False)

        return {
            "type": segment_type,
            "duration_min": duration_min,
            "power_low_pct": power_low_pct,
            "power_high_pct": power_high_pct,
            "description": step.step_name or segment_type.capitalize(),
        }

    def _map_intensity_to_type(self, intensity: FitIntensity | None) -> str:
        """
        Map FIT intensity to our segment type.

        Args:
            intensity: FIT intensity enum

        Returns:
            Segment type string
        """
        if intensity == FitIntensity.WARMUP:
            return "warmup"
        elif intensity == FitIntensity.COOLDOWN:
            return "cooldown"
        elif intensity == FitIntensity.ACTIVE:
            return "steady"  # Simple active segments
        elif intensity == FitIntensity.REST:
            return "recovery"
        else:
            return "steady"  # Default

    def _get_power_pct(
        self,
        step: FitWorkoutStep,
        ftp: float,
        is_low: bool,
    ) -> int:
        """
        Get power percentage from step.

        Handles both power zones and custom power ranges.

        Args:
            step: FitWorkoutStep
            ftp: Athlete's FTP
            is_low: True for lower bound, False for upper bound

        Returns:
            Power as percentage of FTP
        """
        if step.has_custom_power():
            # Use custom power range
            watts = step.custom_power_low if is_low else step.custom_power_high
            if watts is None:
                return 75  # Default to moderate effort
            
            # Handle common offset of 1000 (e.g., 1150 = 150W)
            # If watts are unreasonably high (>1000) and not a sprint (<30s), assume offset
            # Or if > 1000 and > 400% FTP, definitely offset
            if watts >= 1000:
                # Check if it's likely an offset
                # 1000W is very high for sustained power. 
                # If it's > 1000, it's almost certainly an offset for most riders
                # unless it's a very short sprint.
                # But even for sprints, 1000+ is rare for average riders.
                # Safe heuristic: if > 1000, subtract 1000.
                watts -= 1000
                
            return int((watts / ftp) * 100)

        elif step.has_power_zone():
            # Use power zone
            zone = step.target_power_zone
            if zone is None:
                return 75  # Default to moderate effort
            return self._zone_to_percentage(zone, is_low)

        else:
            # No power target
            return 50  # Default to easy effort

    def _zone_to_percentage(self, zone: int, is_low: bool) -> int:
        """
        Convert power zone number to FTP percentage.

        Uses standard Coggan/Allen power zone model.

        Args:
            zone: Zone number (1-7)
            is_low: True for lower bound, False for upper

        Returns:
            Power percentage
        """
        # Standard zone definitions (Coggan/Allen model)
        zone_ranges = {
            1: (0, 55),  # Active Recovery
            2: (56, 75),  # Endurance
            3: (76, 90),  # Tempo
            4: (91, 105),  # Threshold
            5: (106, 120),  # VO2 Max
            6: (121, 150),  # Anaerobic
            7: (151, 200),  # Neuromuscular
        }

        if zone not in zone_ranges:
            return 75  # Default to Z2

        low, high = zone_ranges[zone]
        return low if is_low else high

    def _build_segments(
        self,
        steps: list[FitWorkoutStep],
        ftp: float,
    ) -> list[dict[str, Any]]:
        """
        Build workout segments from FIT steps.

        This is the core transformation logic that:
        1. Identifies repeat structures
        2. Groups work/recovery pairs into intervals
        3. Converts simple steps to segments
        4. Handles power zone or custom power ranges

        Args:
            steps: List of FitWorkoutStep objects
            ftp: Athlete's FTP for percentage calculations

        Returns:
            List of segment dictionaries
        """
        segments: list[dict[str, Any]] = []
        processed_indices: set[int] = set()

        i = 0
        while i < len(steps):
            # Skip if already processed (part of a repeat structure)
            if i in processed_indices:
                i += 1
                continue

            step = steps[i]

            if step.is_repeat_step():
                # Handle repeat structure
                repeat_segment = self._handle_repeat_structure(steps, i, ftp)
                segments.append(repeat_segment)

                # Mark the steps that are part of this repeat as processed
                if step.repeat_from is not None:
                    # Mark steps from repeat_from to current index as processed
                    for j in range(step.repeat_from, i):
                        processed_indices.add(j)

                i += 1
            else:
                # Simple step (warmup, cooldown, steady)
                segment = self._convert_step_to_segment(step, ftp)
                if segment:  # Skip None (like OPEN steps)
                    segments.append(segment)
                i += 1

        return segments

    def _handle_repeat_structure(
        self,
        steps: list[FitWorkoutStep],
        repeat_index: int,
        ftp: float,
    ) -> dict[str, Any]:
        """
        Handle repeat/interval structure.

        FIT repeat structure:
          Step N: work interval
          Step N+1: recovery interval
          Step N+2: repeat (repeat_steps=X, repeat from N)

        Our format:
          {
            "type": "interval",
            "sets": X,
            "work": {...},
            "recovery": {...}
          }

        Args:
            steps: All workout steps
            repeat_index: Index of the repeat step
            ftp: Athlete's FTP

        Returns:
            Interval segment dictionary

        Raises:
            ValueError: If repeat structure is invalid
        """
        repeat_step = steps[repeat_index]

        if not repeat_step.is_repeat_step():
            raise ValueError(f"Step {repeat_index} is not a repeat step")

        # The repeat step tells us how many times to repeat
        repeat_count = repeat_step.repeat_steps or 0

        # Find the work and recovery steps
        # repeat_from tells us which step to start repeating from
        work_step = None
        recovery_step = None

        if repeat_step.repeat_from is not None:
            # Use the repeat_from field to find the start of the repeat sequence
            start_index = repeat_step.repeat_from

            # Usually there are 2 steps: work and recovery
            if start_index < len(steps):
                work_step = steps[start_index]

            if start_index + 1 < len(steps) and start_index + 1 < repeat_index:
                recovery_step = steps[start_index + 1]
        else:
            # Fallback: search backward for work/recovery steps
            for j in range(repeat_index - 1, -1, -1):
                if steps[j].intensity == FitIntensity.ACTIVE and work_step is None:
                    work_step = steps[j]
                elif steps[j].intensity == FitIntensity.REST and recovery_step is None:
                    recovery_step = steps[j]

                if work_step and recovery_step:
                    break

        if not work_step:
            raise ValueError(f"Repeat step at {repeat_index} has no work interval")

        # Build interval segment
        segment: dict[str, Any] = {
            "type": "interval",
            "sets": repeat_count,
            "work": {
                "duration_min": float(work_step.duration_value / 60),
                "power_low_pct": self._get_power_pct(work_step, ftp, is_low=True),
                "power_high_pct": self._get_power_pct(work_step, ftp, is_low=False),
                "description": work_step.step_name or "Work",
            },
        }

        if recovery_step:
            segment["recovery"] = {
                "duration_min": float(recovery_step.duration_value / 60),
                "power_low_pct": self._get_power_pct(recovery_step, ftp, is_low=True),
                "power_high_pct": self._get_power_pct(
                    recovery_step, ftp, is_low=False
                ),
                "description": recovery_step.step_name or "Recovery",
            }

        return segment

    def _calculate_total_duration(self, segments: list[dict[str, Any]]) -> float:
        """
        Calculate total workout duration in minutes.

        Args:
            segments: List of segment dictionaries

        Returns:
            Total duration in minutes
        """
        total = 0

        for seg in segments:
            if seg["type"] == "interval":
                # Interval: work + recovery * sets
                work_min = seg["work"]["duration_min"]
                recovery_min = seg.get("recovery", {}).get("duration_min", 0)
                sets = seg["sets"]
                total += (work_min + recovery_min) * sets
            else:
                # Simple segment
                total += seg.get("duration_min", 0)

        return total

    def _calculate_base_tss(
        self,
        segments: list[dict[str, Any]],
        ftp: float,
    ) -> float:
        """
        Calculate base TSS for workout.

        Uses simplified TSS calculation based on power and duration.

        Args:
            segments: List of segment dictionaries
            ftp: Athlete's FTP

        Returns:
            Estimated TSS
        """
        total_tss = 0.0

        for seg in segments:
            if seg["type"] == "interval":
                # Calculate TSS for work intervals
                work = seg["work"]
                work_min = work["duration_min"]
                work_power_pct = (work["power_low_pct"] + work["power_high_pct"]) / 2
                work_if = work_power_pct / 100.0
                work_tss = (work_min / 60.0) * work_if * work_if * 100

                # Calculate TSS for recovery
                recovery = seg.get("recovery")
                recovery_tss = 0.0
                if recovery:
                    recovery_min = recovery["duration_min"]
                    recovery_power_pct = (
                        recovery["power_low_pct"] + recovery["power_high_pct"]
                    ) / 2
                    recovery_if = recovery_power_pct / 100.0
                    recovery_tss = (
                        (recovery_min / 60.0) * recovery_if * recovery_if * 100
                    )

                # Total for all sets
                sets = seg["sets"]
                total_tss += (work_tss + recovery_tss) * sets
            else:
                # Simple segment
                duration_min = seg.get("duration_min", 0)
                power_pct = (
                    seg.get("power_low_pct", 75) + seg.get("power_high_pct", 75)
                ) / 2
                intensity_factor = power_pct / 100.0
                tss = (duration_min / 60.0) * intensity_factor * intensity_factor * 100
                total_tss += tss

        return round(total_tss, 1)

    def _validate_workout_structure(
        self,
        metadata: FitWorkoutMetadata,
        steps: list[FitWorkoutStep],
    ) -> None:
        """
        Validate workout has logical structure.

        Args:
            metadata: Workout metadata
            steps: List of workout steps

        Raises:
            ValueError: If structure is invalid

        Note:
            Basic validation for CARD_002. More thorough validation
            will be added in CARD_003.
        """
        # For now, just validate we have metadata
        # Step validation will be added in CARD_003 when steps are extracted
        if not metadata.name:
            raise ValueError("Workout must have a name")

        if metadata.num_steps <= 0:
            raise ValueError("Workout must have at least one step")
