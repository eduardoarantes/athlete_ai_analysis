# CARD_001: Set Up Module Structure and Data Classes

**Status**: Ready for Implementation
**Priority**: P0 (Foundation)
**Estimated Time**: 1.5 hours
**Dependencies**: None

---

## Objective

Create the module structure for the FIT workout parser and implement all data classes with full type safety. This establishes the foundation for the parser implementation.

---

## Tasks

### 1. Create Module Structure

**Directory**: `src/cycling_ai/parsers/`

```bash
# Create new parsers package
mkdir -p src/cycling_ai/parsers
touch src/cycling_ai/parsers/__init__.py
touch src/cycling_ai/parsers/fit_workout_parser.py
```

**File**: `src/cycling_ai/parsers/__init__.py`

```python
"""
Parsers package for importing workout data from external formats.

This package provides parsers for various workout file formats:
- FIT workout files (Garmin, Wahoo, TrainingPeaks)
- Future: ZWO files (Zwift)
- Future: MRC files (TrainerRoad)
"""

from .fit_workout_parser import (
    FitWorkoutParser,
    FitWorkoutMetadata,
    FitWorkoutStep,
    FitRepeatStructure,
    ParsedWorkout,
    FitIntensity,
    FitDurationType,
    FitTargetType,
)

__all__ = [
    "FitWorkoutParser",
    "FitWorkoutMetadata",
    "FitWorkoutStep",
    "FitRepeatStructure",
    "ParsedWorkout",
    "FitIntensity",
    "FitDurationType",
    "FitTargetType",
]
```

### 2. Implement Enumerations

**File**: `src/cycling_ai/parsers/fit_workout_parser.py`

Add these enumerations at the top of the file:

```python
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

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
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
```

### 3. Implement FitWorkoutMetadata

```python
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
```

### 4. Implement FitWorkoutStep

```python
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
            self.custom_power_low is not None
            and self.custom_power_high is not None
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
```

### 5. Implement FitRepeatStructure

```python
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
```

### 6. Implement ParsedWorkout

```python
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
        import re

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
```

---

## Testing

### Unit Tests

**File**: `tests/parsers/test_fit_workout_parser.py`

```python
"""Unit tests for FIT workout parser data classes."""

import pytest
from datetime import datetime
from cycling_ai.parsers.fit_workout_parser import (
    FitWorkoutMetadata,
    FitWorkoutStep,
    FitRepeatStructure,
    ParsedWorkout,
    FitIntensity,
    FitDurationType,
    FitTargetType,
)


class TestFitWorkoutMetadata:
    """Test FitWorkoutMetadata data class."""

    def test_valid_metadata(self):
        """Test creating valid metadata."""
        metadata = FitWorkoutMetadata(
            name="Test Workout",
            sport="cycling",
            num_steps=5,
        )

        assert metadata.name == "Test Workout"
        assert metadata.sport == "cycling"
        assert metadata.num_steps == 5
        assert metadata.manufacturer is None
        assert metadata.time_created is None

    def test_metadata_with_optional_fields(self):
        """Test metadata with optional fields."""
        now = datetime.now()
        metadata = FitWorkoutMetadata(
            name="Test Workout",
            sport="cycling",
            num_steps=5,
            manufacturer="Garmin",
            time_created=now,
        )

        assert metadata.manufacturer == "Garmin"
        assert metadata.time_created == now

    def test_empty_name_raises_error(self):
        """Test that empty name raises ValueError."""
        with pytest.raises(ValueError, match="Workout name cannot be empty"):
            FitWorkoutMetadata(name="", sport="cycling", num_steps=5)

    def test_zero_steps_raises_error(self):
        """Test that zero steps raises ValueError."""
        with pytest.raises(ValueError, match="Invalid step count"):
            FitWorkoutMetadata(name="Test", sport="cycling", num_steps=0)

    def test_negative_steps_raises_error(self):
        """Test that negative steps raises ValueError."""
        with pytest.raises(ValueError, match="Invalid step count"):
            FitWorkoutMetadata(name="Test", sport="cycling", num_steps=-1)


class TestFitWorkoutStep:
    """Test FitWorkoutStep data class."""

    def test_valid_step(self):
        """Test creating valid workout step."""
        step = FitWorkoutStep(
            message_index=0,
            intensity=FitIntensity.WARMUP,
            duration_type=FitDurationType.TIME,
            duration_value=600.0,
            target_type=FitTargetType.POWER,
            custom_power_low=150,
            custom_power_high=180,
            step_name="Warmup",
        )

        assert step.message_index == 0
        assert step.intensity == FitIntensity.WARMUP
        assert step.duration_value == 600.0
        assert step.step_name == "Warmup"

    def test_is_repeat_step(self):
        """Test repeat step detection."""
        step = FitWorkoutStep(
            message_index=5,
            intensity=None,
            duration_type=FitDurationType.REPEAT_UNTIL_STEPS_COMPLETE,
            duration_value=5,
            target_type=FitTargetType.OPEN,
            repeat_steps=5,
        )

        assert step.is_repeat_step() is True

    def test_is_not_repeat_step(self):
        """Test non-repeat step detection."""
        step = FitWorkoutStep(
            message_index=0,
            intensity=FitIntensity.ACTIVE,
            duration_type=FitDurationType.TIME,
            duration_value=600,
            target_type=FitTargetType.POWER,
        )

        assert step.is_repeat_step() is False

    def test_has_power_zone(self):
        """Test power zone detection."""
        step = FitWorkoutStep(
            message_index=0,
            intensity=FitIntensity.ACTIVE,
            duration_type=FitDurationType.TIME,
            duration_value=600,
            target_type=FitTargetType.POWER,
            target_power_zone=4,
        )

        assert step.has_power_zone() is True
        assert step.has_custom_power() is False

    def test_has_custom_power(self):
        """Test custom power range detection."""
        step = FitWorkoutStep(
            message_index=0,
            intensity=FitIntensity.ACTIVE,
            duration_type=FitDurationType.TIME,
            duration_value=600,
            target_type=FitTargetType.POWER,
            custom_power_low=225,
            custom_power_high=250,
        )

        assert step.has_power_zone() is False
        assert step.has_custom_power() is True

    def test_negative_message_index_raises_error(self):
        """Test that negative message_index raises ValueError."""
        with pytest.raises(ValueError, match="Invalid message_index"):
            FitWorkoutStep(
                message_index=-1,
                intensity=FitIntensity.ACTIVE,
                duration_type=FitDurationType.TIME,
                duration_value=600,
                target_type=FitTargetType.POWER,
            )

    def test_repeat_step_missing_repeat_steps_raises_error(self):
        """Test that repeat step without repeat_steps raises ValueError."""
        with pytest.raises(ValueError, match="missing valid repeat_steps"):
            FitWorkoutStep(
                message_index=5,
                intensity=None,
                duration_type=FitDurationType.REPEAT_UNTIL_STEPS_COMPLETE,
                duration_value=5,
                target_type=FitTargetType.OPEN,
                repeat_steps=None,
            )


class TestFitRepeatStructure:
    """Test FitRepeatStructure data class."""

    def test_valid_repeat_structure(self):
        """Test creating valid repeat structure."""
        work_step = FitWorkoutStep(
            message_index=1,
            intensity=FitIntensity.ACTIVE,
            duration_type=FitDurationType.TIME,
            duration_value=180,
            target_type=FitTargetType.POWER,
            custom_power_low=250,
            custom_power_high=270,
        )

        recovery_step = FitWorkoutStep(
            message_index=2,
            intensity=FitIntensity.REST,
            duration_type=FitDurationType.TIME,
            duration_value=180,
            target_type=FitTargetType.POWER,
            custom_power_low=100,
            custom_power_high=120,
        )

        repeat = FitRepeatStructure(
            repeat_count=5, work_step=work_step, recovery_step=recovery_step
        )

        assert repeat.repeat_count == 5
        assert repeat.work_step == work_step
        assert repeat.recovery_step == recovery_step

    def test_to_interval_segment(self):
        """Test conversion to interval segment."""
        work_step = FitWorkoutStep(
            message_index=1,
            intensity=FitIntensity.ACTIVE,
            duration_type=FitDurationType.TIME,
            duration_value=180,  # 3 minutes
            target_type=FitTargetType.POWER,
            custom_power_low=260,  # 100% FTP
            custom_power_high=286,  # 110% FTP
            step_name="Hard",
        )

        recovery_step = FitWorkoutStep(
            message_index=2,
            intensity=FitIntensity.REST,
            duration_type=FitDurationType.TIME,
            duration_value=180,
            target_type=FitTargetType.POWER,
            custom_power_low=130,  # 50% FTP
            custom_power_high=156,  # 60% FTP
            step_name="Easy",
        )

        repeat = FitRepeatStructure(
            repeat_count=5, work_step=work_step, recovery_step=recovery_step
        )

        segment = repeat.to_interval_segment(ftp=260)

        assert segment["type"] == "interval"
        assert segment["sets"] == 5
        assert segment["work"]["duration_min"] == 3
        assert segment["work"]["power_low_pct"] == 100
        assert segment["work"]["power_high_pct"] == 110
        assert segment["recovery"]["duration_min"] == 3
        assert segment["recovery"]["power_low_pct"] == 50
        assert segment["recovery"]["power_high_pct"] == 60


class TestParsedWorkout:
    """Test ParsedWorkout data class."""

    def test_generate_workout_id(self):
        """Test workout ID generation."""
        metadata = FitWorkoutMetadata(
            name="VO2 Max intervals - 5x3min", sport="cycling", num_steps=7
        )

        workout = ParsedWorkout(
            metadata=metadata, segments=[], base_duration_min=55, base_tss=85
        )

        workout_id = workout._generate_workout_id()

        assert workout_id == "vo2_max_intervals_5x3min"
        assert len(workout_id) <= 50

    def test_infer_workout_type_vo2max(self):
        """Test inferring VO2 max workout type."""
        metadata = FitWorkoutMetadata(
            name="VO2 Max", sport="cycling", num_steps=5
        )

        segments = [
            {
                "type": "interval",
                "sets": 5,
                "work": {"power_high_pct": 115},
            }
        ]

        workout = ParsedWorkout(
            metadata=metadata, segments=segments, base_duration_min=55, base_tss=85
        )

        assert workout._infer_workout_type() == "vo2max"

    def test_infer_workout_type_threshold(self):
        """Test inferring threshold workout type."""
        metadata = FitWorkoutMetadata(
            name="Threshold", sport="cycling", num_steps=5
        )

        segments = [
            {
                "type": "interval",
                "sets": 2,
                "work": {"power_high_pct": 95},
            }
        ]

        workout = ParsedWorkout(
            metadata=metadata, segments=segments, base_duration_min=55, base_tss=85
        )

        assert workout._infer_workout_type() == "threshold"

    def test_infer_intensity_hard(self):
        """Test inferring hard intensity."""
        metadata = FitWorkoutMetadata(
            name="VO2 Max", sport="cycling", num_steps=5
        )

        segments = [
            {
                "type": "interval",
                "sets": 5,
                "work": {"power_high_pct": 115},
            }
        ]

        workout = ParsedWorkout(
            metadata=metadata, segments=segments, base_duration_min=55, base_tss=85
        )

        assert workout._infer_intensity() == "hard"

    def test_to_library_format(self):
        """Test conversion to library format."""
        metadata = FitWorkoutMetadata(
            name="Threshold workout", sport="cycling", num_steps=5
        )

        segments = [
            {"type": "warmup", "duration_min": 15},
            {"type": "interval", "sets": 2, "work": {"power_high_pct": 95}},
            {"type": "cooldown", "duration_min": 10},
        ]

        workout = ParsedWorkout(
            metadata=metadata, segments=segments, base_duration_min=55, base_tss=85
        )

        library_format = workout.to_library_format()

        assert "id" in library_format
        assert library_format["name"] == "Threshold workout"
        assert library_format["type"] == "threshold"
        assert library_format["intensity"] == "hard"
        assert library_format["segments"] == segments
        assert library_format["base_duration_min"] == 55
        assert library_format["base_tss"] == 85
```

---

## Acceptance Criteria

- [ ] Module structure created (`src/cycling_ai/parsers/`)
- [ ] All enumerations implemented (FitIntensity, FitDurationType, FitTargetType)
- [ ] FitWorkoutMetadata data class implemented with validation
- [ ] FitWorkoutStep data class implemented with helper methods
- [ ] FitRepeatStructure data class implemented
- [ ] ParsedWorkout data class implemented with library format conversion
- [ ] All unit tests pass
- [ ] Type checking passes (`mypy --strict`)
- [ ] Code formatting passes (`ruff format`, `ruff check`)

---

## Files Modified

- **New**: `src/cycling_ai/parsers/__init__.py`
- **New**: `src/cycling_ai/parsers/fit_workout_parser.py` (data classes only)
- **New**: `tests/parsers/test_fit_workout_parser.py`
- **New**: `tests/parsers/__init__.py`

---

## Notes

- This card focuses solely on data structures - no parsing logic yet
- All classes must have full type hints for mypy --strict compliance
- Validation in `__post_init__` ensures data integrity
- Helper methods (`is_repeat_step()`, `has_power_zone()`) improve readability
- Library format conversion logic prepares for final output

---

**Ready to Implement**: Yes
**Blocked By**: None
**Next Card**: CARD_002 (FIT File Reading and Metadata Extraction)
