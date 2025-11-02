# FIT Workout File Parser - Implementation Plan

**Status**: Planning Phase Complete
**Date**: 2025-11-02
**Prepared By**: Task Implementation Preparation Architect

---

## Executive Summary

This plan details the implementation of a **FIT workout file parser** that reads structured workout files (`.fit` format) and converts them into our internal workout library format. The parser will enable importing proven workouts from external sources (TrainingPeaks, Garmin Connect, Wahoo, etc.) into our workout library system.

### Key Objectives
1. Parse FIT workout files containing workout definitions (not activity recordings)
2. Support all FIT workout message types (FileId, Workout, WorkoutStep)
3. Handle complex interval/repeat structures correctly
4. Convert power zones and custom power ranges to our format
5. Map FIT intensity types to our segment types
6. Full type safety (mypy --strict compliance)
7. Comprehensive unit and integration tests

### Context
This parser is part of the larger **Workout Library Refactor** initiative (see `plans/WORKOUT_LIBRARY_REFACTOR.md`). The workout library system will store pre-built workouts that can be:
- Imported from FIT files (this parser)
- Exported to FIT files (future feature)
- Selected by code for training plan generation (replacing LLM-generated workouts)

---

## Git Context Analysis

### Recent Changes
Based on `git diff origin/main --stat`, the current branch has:
- Deleted extensive documentation files (cleanup phase)
- Modified `logs/notification.json` (logging changes)
- Modified `src/cycling_ai/core/workout_builder.py` (workout structure updates)
- Modified `src/cycling_ai/tools/wrappers/training_plan_tool.py` (training plan updates)
- New files: `docs/AWS_BEDROCK_INTEGRATION_PLAN.md`, `plans/WORKOUT_DETAILED_DESCRIPTIONS_PLAN.md`

### Recent Commits
Recent work has focused on:
1. **Workout descriptions**: Converting markdown to HTML, adding detailed coaching notes
2. **UI enhancements**: Power profile visualizations, modal improvements
3. **Training plan validation**: Per-week validation, strategic day selection, recovery week handling

### Integration Point
This parser will integrate with:
- **Workout Builder**: Existing `WorkoutSegment` and `Workout` classes in `src/cycling_ai/core/workout_builder.py`
- **Power Zones**: Centralized zone calculations in `src/cycling_ai/core/power_zones.py`
- **TSS Calculation**: Existing TSS calculations in `src/cycling_ai/core/tss.py`
- **Workout Library**: Future `data/workout_library.json` (from refactor plan)

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FIT Workout Parser                        │
└─────────────────────────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         v               v               v
┌─────────────────┐ ┌──────────────┐ ┌─────────────────┐
│  FIT File       │ │  Parser      │ │  Workout        │
│  Reader         │ │  Logic       │ │  Builder        │
│  (fitparse)     │ │              │ │  (core)         │
└─────────────────┘ └──────────────┘ └─────────────────┘
         │               │               │
         v               v               v
┌─────────────────────────────────────────────────────────────┐
│              Workout Library Format                          │
│  {                                                           │
│    "id": "vo2max_classic",                                   │
│    "name": "VO2 Max intervals",                              │
│    "segments": [...]                                         │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
```

### Module Structure

```
src/cycling_ai/parsers/
├── __init__.py              # Package initialization
└── fit_workout_parser.py    # Main parser implementation

New Module: fit_workout_parser.py
├── Data Classes (Type Safety)
│   ├── FitWorkoutMetadata
│   ├── FitWorkoutStep
│   ├── FitRepeatStructure
│   └── ParsedWorkout
│
├── Parser Class
│   ├── FitWorkoutParser
│   │   ├── parse_workout_file()      # Main entry point
│   │   ├── _extract_metadata()       # Parse file_id and workout messages
│   │   ├── _extract_steps()          # Parse workout_step messages
│   │   ├── _build_segments()         # Convert steps to segments
│   │   └── _handle_repeats()         # Process repeat structures
│
├── Conversion Functions
│   ├── _map_intensity_to_type()      # FIT Intensity → segment type
│   ├── _convert_power_target()       # Zone/custom → power range
│   ├── _convert_duration()           # Seconds → minutes
│   └── _generate_workout_id()        # Create unique workout ID
│
└── Validation Functions
    ├── _validate_fit_file()          # Check FIT file validity
    ├── _validate_workout_structure() # Ensure logical structure
    └── _validate_power_ranges()      # Check power values make sense
```

---

## Data Flow

### Input: FIT Workout File

```python
# FIT File Structure (from sample analysis)
FileIdMessage:
  type: workout
  manufacturer: peaksware
  time_created: 2025-11-01 14:45:25

WorkoutMessage:
  wkt_name: "VO2 Max Booster - 6 x 30/15 - 3 repeats"
  sport: cycling
  num_valid_steps: 23

WorkoutStepMessage[] (simplified):
  Step 0: warmup, 10min @ 1107-1134W
  Step 1: work, 3min @ 1294-1307W
  Step 2: recovery, 3min @ 1134-1160W
  Step 3: repeat steps 1-2, 5 times
  Step 4: cooldown, 10min @ 1107-1134W
```

### Output: Workout Library Format

```python
{
  "id": "vo2max_booster_6x30_15",
  "name": "VO2 Max Booster - 6 x 30/15 - 3 repeats",
  "detailed_description": "",  # Not available in FIT, leave empty
  "type": "vo2max",
  "intensity": "hard",
  "suitable_phases": ["Build", "Peak"],  # Inferred from intensity
  "suitable_weekdays": ["Tuesday", "Wednesday", "Thursday"],  # Default
  "segments": [
    {
      "type": "warmup",
      "duration_min": 10,
      "power_low_pct": 80,  # Calculated from FTP
      "power_high_pct": 85,
      "description": "Warm up"
    },
    {
      "type": "interval",
      "sets": 5,
      "work": {
        "duration_min": 3,
        "power_low_pct": 110,
        "power_high_pct": 115,
        "description": "Hard"
      },
      "recovery": {
        "duration_min": 3,
        "power_low_pct": 80,
        "power_high_pct": 85,
        "description": "Easy"
      }
    },
    {
      "type": "cooldown",
      "duration_min": 10,
      "power_low_pct": 80,
      "power_high_pct": 85,
      "description": "Cool Down"
    }
  ],
  "base_duration_min": 55,
  "base_tss": 85,
  "variable_components": {
    "adjustable_field": "sets",
    "min_value": 4,
    "max_value": 8,
    "tss_per_unit": 17
  }
}
```

### Transformation Pipeline

```
┌───────────────────┐
│  FIT File         │
│  (binary format)  │
└─────────┬─────────┘
          │
          v
┌───────────────────────────────┐
│  fitparse.FitFile             │
│  - Reads binary format        │
│  - Extracts messages          │
│  - Returns Python objects     │
└─────────┬─────────────────────┘
          │
          v
┌───────────────────────────────┐
│  FitWorkoutParser             │
│  Step 1: Extract Metadata     │
│    - workout name             │
│    - sport type               │
│    - step count               │
└─────────┬─────────────────────┘
          │
          v
┌───────────────────────────────┐
│  Step 2: Extract Steps        │
│    - duration                 │
│    - intensity                │
│    - power targets            │
│    - repeat structures        │
└─────────┬─────────────────────┘
          │
          v
┌───────────────────────────────┐
│  Step 3: Build Segments       │
│    - Group steps logically    │
│    - Detect intervals         │
│    - Handle repeats           │
│    - Convert units            │
└─────────┬─────────────────────┘
          │
          v
┌───────────────────────────────┐
│  Step 4: Add Metadata         │
│    - Infer workout type       │
│    - Calculate base TSS       │
│    - Determine suitable phases│
└─────────┬─────────────────────┘
          │
          v
┌───────────────────────────────┐
│  Workout Library Format       │
│  (JSON-serializable dict)     │
└───────────────────────────────┘
```

---

## Implementation Strategy

### Design Principles

Following Uncle Bob's SOLID principles and Python best practices:

1. **Single Responsibility Principle**
   - `FitWorkoutParser`: Parse FIT files only
   - Conversion functions: Handle specific transformations
   - Validation functions: Validate specific aspects

2. **Open/Closed Principle**
   - Parser extensible for new FIT message types
   - Conversion functions can be added without modifying core

3. **Dependency Inversion Principle**
   - Parser depends on abstractions (data classes), not concrete implementations
   - Easy to swap fitparse for alternative library if needed

4. **Type Safety First**
   - All functions have full type hints
   - Data classes for structured data
   - `mypy --strict` compliance mandatory

5. **Fail Fast**
   - Validate inputs immediately
   - Clear error messages
   - Don't attempt to "fix" bad data

### Python Best Practices

1. **PEP 8 Compliance**
   - 100-character line length (project standard)
   - Proper import organization (stdlib, third-party, local)
   - Clear naming conventions

2. **Modern Python Patterns**
   - Use `dataclasses` for data structures
   - Use `pathlib.Path` for file operations
   - Use `from __future__ import annotations` for forward references
   - Use `dict[str, Any]` over `Dict[str, Any]` (Python 3.9+)

3. **Pythonic Idioms**
   - List comprehensions over loops (where readable)
   - Context managers for resources
   - Generator expressions for large sequences
   - Explicit is better than implicit

---

## Data Classes Design

### FitWorkoutMetadata

```python
from dataclasses import dataclass
from datetime import datetime

@dataclass
class FitWorkoutMetadata:
    """Metadata extracted from FIT file_id and workout messages."""

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
```

### FitWorkoutStep

```python
from enum import Enum
from typing import Optional

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
class FitWorkoutStep:
    """Single step from FIT workout."""

    message_index: int
    intensity: FitIntensity | None
    duration_type: FitDurationType
    duration_value: float  # Seconds for TIME, step count for REPEAT
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
        """Check if this is a repeat structure step."""
        return self.duration_type == FitDurationType.REPEAT_UNTIL_STEPS_COMPLETE

    def has_power_zone(self) -> bool:
        """Check if step uses power zone (not custom range)."""
        return self.target_power_zone is not None and self.target_power_zone > 0

    def has_custom_power(self) -> bool:
        """Check if step uses custom power range."""
        return (
            self.custom_power_low is not None
            and self.custom_power_high is not None
        )
```

### FitRepeatStructure

```python
@dataclass
class FitRepeatStructure:
    """Represents a repeat/interval structure in FIT workout."""

    repeat_count: int
    work_step: FitWorkoutStep
    recovery_step: FitWorkoutStep | None = None

    def to_interval_segment(self, ftp: float) -> dict[str, Any]:
        """
        Convert repeat structure to interval segment.

        Args:
            ftp: Functional Threshold Power for % calculations

        Returns:
            Interval segment dictionary
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
                "description": self.work_step.step_name,
            }
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
                "description": self.recovery_step.step_name,
            }

        return segment

    @staticmethod
    def _calculate_power_pct(watts: int, ftp: float) -> int:
        """Calculate power as percentage of FTP."""
        if ftp <= 0:
            raise ValueError(f"Invalid FTP: {ftp}")
        return int((watts / ftp) * 100)
```

### ParsedWorkout

```python
@dataclass
class ParsedWorkout:
    """Complete parsed workout ready for library format."""

    metadata: FitWorkoutMetadata
    segments: list[dict[str, Any]]
    base_duration_min: int
    base_tss: float

    def to_library_format(self) -> dict[str, Any]:
        """
        Convert to workout library JSON format.

        Returns:
            Dictionary in workout library schema
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
        """Generate unique workout ID from name."""
        # Convert name to snake_case ID
        import re
        name = self.metadata.name.lower()
        name = re.sub(r'[^\w\s-]', '', name)
        name = re.sub(r'[-\s]+', '_', name)
        return name[:50]  # Limit length

    def _infer_workout_type(self) -> str:
        """Infer workout type from segments."""
        # Logic to determine if VO2max, threshold, sweet spot, etc.
        # Based on power percentages in main intervals
        pass

    def _infer_intensity(self) -> str:
        """Determine if workout is hard or easy."""
        # Based on workout type and power zones
        pass

    def _get_suitable_phases(self, intensity: str) -> list[str]:
        """Get training phases suitable for this workout."""
        if intensity == "hard":
            return ["Build", "Peak"]
        else:
            return ["Foundation", "Build", "Recovery"]

    def _detect_variable_components(self) -> dict[str, Any]:
        """Detect which components can be adjusted."""
        # Check if workout has intervals (adjust sets)
        # or steady segments (adjust duration)
        pass
```

---

## Core Parser Implementation

### FitWorkoutParser Class

```python
from pathlib import Path
from typing import Any
import fitparse

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

        # Parse FIT file
        try:
            fit_file = fitparse.FitFile(str(fit_path))
        except Exception as e:
            raise ValueError(f"Failed to parse FIT file: {e}") from e

        # Extract metadata and steps
        metadata = self._extract_metadata(fit_file)
        steps = self._extract_steps(fit_file)

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

    def _extract_metadata(
        self,
        fit_file: fitparse.FitFile
    ) -> FitWorkoutMetadata:
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
        for record in fit_file.get_messages("workout"):
            for field in record:
                if field.name == "wkt_name":
                    name = field.value
                elif field.name == "sport":
                    sport = str(field.value)
                elif field.name == "num_valid_steps":
                    num_steps = int(field.value)

        # Extract from file_id message
        for record in fit_file.get_messages("file_id"):
            for field in record:
                if field.name == "manufacturer":
                    manufacturer = str(field.value)
                elif field.name == "time_created":
                    time_created = field.value

        if not name:
            raise ValueError("Workout name not found in FIT file")

        if num_steps == 0:
            raise ValueError("Number of steps not found in FIT file")

        return FitWorkoutMetadata(
            name=name,
            sport=sport,
            num_steps=num_steps,
            manufacturer=manufacturer,
            time_created=time_created,
        )

    def _extract_steps(
        self,
        fit_file: fitparse.FitFile
    ) -> list[FitWorkoutStep]:
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

        for record in fit_file.get_messages("workout_step"):
            step_data = {}

            # Extract all fields
            for field in record:
                if field.value is not None:
                    step_data[field.name] = field.value

            # Build FitWorkoutStep
            step = self._build_step_from_data(step_data)
            steps.append(step)

        # Sort by message_index
        steps.sort(key=lambda s: s.message_index)

        return steps

    def _build_step_from_data(
        self,
        data: dict[str, Any]
    ) -> FitWorkoutStep:
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
        duration_type = duration_type_map.get(
            duration_type_str, FitDurationType.TIME
        )

        # Map target type
        target_type_map = {
            "power": FitTargetType.POWER,
            "heart_rate": FitTargetType.HEART_RATE,
            "open": FitTargetType.OPEN,
        }

        target_type_str = str(data.get("target_type", "")).lower()
        target_type = target_type_map.get(target_type_str, FitTargetType.OPEN)

        # Extract duration value
        if duration_type == FitDurationType.TIME:
            duration_value = float(data.get("duration_time", 0))
        elif duration_type == FitDurationType.REPEAT_UNTIL_STEPS_COMPLETE:
            duration_value = float(data.get("repeat_steps", 0))
        else:
            duration_value = float(data.get("duration_value", 0))

        return FitWorkoutStep(
            message_index=int(data.get("message_index", 0)),
            intensity=intensity,
            duration_type=duration_type,
            duration_value=duration_value,
            target_type=target_type,
            target_power_zone=data.get("target_power_zone"),
            custom_power_low=data.get("custom_target_power_low"),
            custom_power_high=data.get("custom_target_power_high"),
            repeat_from=data.get("repeat_from"),
            repeat_to=data.get("repeat_to"),
            repeat_steps=data.get("repeat_steps"),
            step_name=str(data.get("wkt_step_name", "")),
        )

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
        """
        if len(steps) != metadata.num_steps:
            raise ValueError(
                f"Step count mismatch: metadata says {metadata.num_steps}, "
                f"found {len(steps)} steps"
            )

        # Check for duplicate message indices
        indices = [s.message_index for s in steps]
        if len(indices) != len(set(indices)):
            raise ValueError("Duplicate message indices found")

        # Validate repeat structures
        for i, step in enumerate(steps):
            if step.is_repeat_step():
                # Check repeat_steps is set
                if step.repeat_steps is None or step.repeat_steps <= 0:
                    raise ValueError(
                        f"Step {i}: repeat step missing repeat_steps value"
                    )

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
        i = 0

        while i < len(steps):
            step = steps[i]

            if step.is_repeat_step():
                # Handle repeat structure
                repeat_segment = self._handle_repeat_structure(
                    steps, i, ftp
                )
                segments.append(repeat_segment)
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
          Step N+2: repeat (repeat_steps=X, repeat from N to N+1)

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
            raise ValueError(
                f"Step {repeat_index} is not a repeat step"
            )

        # The repeat step tells us how many times to repeat
        # and which step to start from (duration_step or implicit)
        repeat_count = repeat_step.repeat_steps or 0

        # Find the work and recovery steps before the repeat step
        # Typically: repeat step points back to work/recovery pair

        # Strategy: Look backward from repeat step for work/recovery
        work_step = None
        recovery_step = None

        # Search backward for work interval (ACTIVE intensity)
        for j in range(repeat_index - 1, -1, -1):
            if steps[j].intensity == FitIntensity.ACTIVE:
                work_step = steps[j]
                break

        # Search backward for recovery (REST intensity)
        for j in range(repeat_index - 1, -1, -1):
            if steps[j].intensity == FitIntensity.REST:
                recovery_step = steps[j]
                break

        if not work_step:
            raise ValueError(
                f"Repeat step at {repeat_index} has no work interval"
            )

        # Build interval segment
        segment: dict[str, Any] = {
            "type": "interval",
            "sets": repeat_count,
            "work": {
                "duration_min": int(work_step.duration_value / 60),
                "power_low_pct": self._get_power_pct(
                    work_step, ftp, is_low=True
                ),
                "power_high_pct": self._get_power_pct(
                    work_step, ftp, is_low=False
                ),
                "description": work_step.step_name or "Work",
            }
        }

        if recovery_step:
            segment["recovery"] = {
                "duration_min": int(recovery_step.duration_value / 60),
                "power_low_pct": self._get_power_pct(
                    recovery_step, ftp, is_low=True
                ),
                "power_high_pct": self._get_power_pct(
                    recovery_step, ftp, is_low=False
                ),
                "description": recovery_step.step_name or "Recovery",
            }

        return segment

    def _convert_step_to_segment(
        self,
        step: FitWorkoutStep,
        ftp: float,
    ) -> dict[str, Any] | None:
        """
        Convert single FIT step to segment.

        Args:
            step: FitWorkoutStep to convert
            ftp: Athlete's FTP

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
        duration_min = int(step.duration_value / 60)

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

    def _map_intensity_to_type(
        self,
        intensity: FitIntensity | None
    ) -> str:
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
            return "interval"  # or "steady" depending on context
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
            watts = (
                step.custom_power_low if is_low
                else step.custom_power_high
            )
            return int((watts / ftp) * 100)

        elif step.has_power_zone():
            # Use power zone
            # Note: This requires zone definitions
            # For now, return placeholder
            zone = step.target_power_zone
            # TODO: Implement zone -> percentage mapping
            return self._zone_to_percentage(zone, is_low)

        else:
            # No power target
            return 50  # Default to easy effort

    def _zone_to_percentage(
        self,
        zone: int,
        is_low: bool
    ) -> int:
        """
        Convert power zone number to FTP percentage.

        Args:
            zone: Zone number (1-7)
            is_low: True for lower bound, False for upper

        Returns:
            Power percentage
        """
        # Standard zone definitions (Coggan/Allen model)
        zone_ranges = {
            1: (0, 55),      # Active Recovery
            2: (56, 75),     # Endurance
            3: (76, 90),     # Tempo
            4: (91, 105),    # Threshold
            5: (106, 120),   # VO2 Max
            6: (121, 150),   # Anaerobic
            7: (151, 200),   # Neuromuscular
        }

        if zone not in zone_ranges:
            return 75  # Default to Z2

        low, high = zone_ranges[zone]
        return low if is_low else high

    def _calculate_total_duration(
        self,
        segments: list[dict[str, Any]]
    ) -> int:
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
                total += seg["duration_min"]

        return total

    def _calculate_base_tss(
        self,
        segments: list[dict[str, Any]],
        ftp: float,
    ) -> float:
        """
        Calculate base TSS for workout.

        Uses existing TSS calculation from core module.

        Args:
            segments: List of segment dictionaries
            ftp: Athlete's FTP

        Returns:
            Estimated TSS
        """
        from cycling_ai.core.tss import calculate_workout_tss

        # Convert segments to format expected by TSS calculator
        # This may need adjustment based on actual TSS module interface
        return calculate_workout_tss(segments, ftp)
```

---

## Edge Cases & Risk Analysis

### Edge Cases to Handle

1. **Nested Repeat Structures**
   - **Risk**: Some workouts have repeats within repeats
   - **Example**: Warmup → (Work → Recovery) × 3 → Rest → (Work → Recovery) × 3 → Cooldown
   - **Mitigation**: Parser should detect and flatten nested structures
   - **Testing**: Include sample file with nested repeats

2. **Missing Power Targets**
   - **Risk**: Some steps have no power target (open target)
   - **Example**: "Ride at RPE 5" (no power specified)
   - **Mitigation**: Default to moderate power (60-70% FTP) or mark as "open"
   - **Testing**: Sample file with OPEN targets

3. **Power Zones vs Custom Ranges**
   - **Risk**: Some FIT files use zones, others use exact watts
   - **Example**: Zone 2 vs 150-180W
   - **Mitigation**: Handle both, convert zones to percentages using standard definitions
   - **Testing**: Test both zone-based and watt-based files

4. **Large Wattage Values**
   - **Risk**: Some FIT files have unrealistic power values (e.g., 10000W)
   - **Example**: Data corruption or bad exports
   - **Mitigation**: Validate power ranges, reject if > 500% FTP
   - **Testing**: Validation unit tests

5. **Missing Workout Name**
   - **Risk**: Some FIT files have empty workout names
   - **Mitigation**: Use filename or generate name from structure
   - **Testing**: Test with unnamed workout file

6. **Multiple Repeats in Sequence**
   - **Risk**: Workout has multiple interval blocks
   - **Example**: 5x3min @ VO2 → Rest → 3x10min @ Threshold
   - **Mitigation**: Parser should handle multiple repeat structures
   - **Testing**: Sample from real TrainingPeaks workouts

7. **Duration Type DISTANCE**
   - **Risk**: Some steps use distance (meters) not time
   - **Example**: "Warmup: 5km @ Z2"
   - **Mitigation**: Convert distance to estimated time (assume 30 km/h avg)
   - **Testing**: Sample with distance-based steps

8. **Heart Rate Targets**
   - **Risk**: Some workouts target HR not power
   - **Example**: "Interval @ 85-90% max HR"
   - **Mitigation**: Skip HR-based workouts or convert to estimated power
   - **Testing**: Sample with HR targets

### Risk Mitigation Strategy

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Nested repeats | Medium | High | Flatten structures, add validation |
| Missing power targets | Medium | Medium | Default to moderate effort, log warning |
| Invalid power values | Low | High | Validate ranges, reject outliers |
| Missing metadata | Low | Medium | Use filename, generate defaults |
| Unsupported duration type | Low | Medium | Skip unsupported steps, log warning |
| FIT file corruption | Low | High | Catch parse errors, clear error messages |
| Zone definition mismatch | Medium | Low | Use standard Coggan zones, document |

---

## Testing Strategy

### Test Pyramid

```
         ┌─────────────────┐
         │  Integration    │  4 tests
         │  Tests          │  (real FIT files)
         └─────────────────┘
              ▲
         ┌────┴────┐
         │  Unit   │  20+ tests
         │  Tests  │  (individual functions)
         └─────────┘
```

### Unit Tests

**File**: `tests/parsers/test_fit_workout_parser.py`

```python
import pytest
from pathlib import Path
from cycling_ai.parsers.fit_workout_parser import (
    FitWorkoutParser,
    FitWorkoutStep,
    FitIntensity,
    FitDurationType,
)

class TestFitWorkoutParser:
    """Unit tests for FitWorkoutParser."""

    def test_init(self):
        """Test parser initialization."""
        parser = FitWorkoutParser()
        assert parser is not None

    def test_parse_workout_file_missing_file(self):
        """Test error when file doesn't exist."""
        parser = FitWorkoutParser()

        with pytest.raises(FileNotFoundError):
            parser.parse_workout_file("nonexistent.fit", ftp=260)

    def test_parse_workout_file_invalid_ftp(self):
        """Test error when FTP is invalid."""
        parser = FitWorkoutParser()

        with pytest.raises(ValueError, match="Invalid FTP"):
            parser.parse_workout_file("workout.fit", ftp=0)

        with pytest.raises(ValueError, match="Invalid FTP"):
            parser.parse_workout_file("workout.fit", ftp=-100)

    def test_map_intensity_to_type(self):
        """Test intensity mapping."""
        parser = FitWorkoutParser()

        assert parser._map_intensity_to_type(FitIntensity.WARMUP) == "warmup"
        assert parser._map_intensity_to_type(FitIntensity.ACTIVE) == "interval"
        assert parser._map_intensity_to_type(FitIntensity.REST) == "recovery"
        assert parser._map_intensity_to_type(FitIntensity.COOLDOWN) == "cooldown"
        assert parser._map_intensity_to_type(None) == "steady"

    def test_zone_to_percentage(self):
        """Test power zone to percentage conversion."""
        parser = FitWorkoutParser()

        # Zone 2 (Endurance): 56-75%
        assert parser._zone_to_percentage(2, is_low=True) == 56
        assert parser._zone_to_percentage(2, is_low=False) == 75

        # Zone 4 (Threshold): 91-105%
        assert parser._zone_to_percentage(4, is_low=True) == 91
        assert parser._zone_to_percentage(4, is_low=False) == 105

        # Invalid zone defaults to Z2
        assert parser._zone_to_percentage(99, is_low=True) == 75

    def test_get_power_pct_custom_range(self):
        """Test power percentage from custom range."""
        parser = FitWorkoutParser()
        ftp = 250

        step = FitWorkoutStep(
            message_index=0,
            intensity=FitIntensity.ACTIVE,
            duration_type=FitDurationType.TIME,
            duration_value=600,
            target_type=FitTargetType.POWER,
            custom_power_low=225,  # 90% FTP
            custom_power_high=250,  # 100% FTP
        )

        assert parser._get_power_pct(step, ftp, is_low=True) == 90
        assert parser._get_power_pct(step, ftp, is_low=False) == 100

    def test_get_power_pct_zone(self):
        """Test power percentage from zone."""
        parser = FitWorkoutParser()
        ftp = 260

        step = FitWorkoutStep(
            message_index=0,
            intensity=FitIntensity.ACTIVE,
            duration_type=FitDurationType.TIME,
            duration_value=600,
            target_type=FitTargetType.POWER,
            target_power_zone=4,  # Threshold zone
        )

        assert parser._get_power_pct(step, ftp, is_low=True) == 91
        assert parser._get_power_pct(step, ftp, is_low=False) == 105

    def test_calculate_total_duration_simple(self):
        """Test duration calculation for simple workout."""
        parser = FitWorkoutParser()

        segments = [
            {"type": "warmup", "duration_min": 15},
            {"type": "steady", "duration_min": 60},
            {"type": "cooldown", "duration_min": 10},
        ]

        assert parser._calculate_total_duration(segments) == 85

    def test_calculate_total_duration_intervals(self):
        """Test duration calculation with intervals."""
        parser = FitWorkoutParser()

        segments = [
            {"type": "warmup", "duration_min": 15},
            {
                "type": "interval",
                "sets": 5,
                "work": {"duration_min": 3},
                "recovery": {"duration_min": 3},
            },
            {"type": "cooldown", "duration_min": 10},
        ]

        # 15 + (3+3)*5 + 10 = 55
        assert parser._calculate_total_duration(segments) == 55

    def test_convert_step_to_segment_warmup(self):
        """Test converting warmup step to segment."""
        parser = FitWorkoutParser()
        ftp = 260

        step = FitWorkoutStep(
            message_index=0,
            intensity=FitIntensity.WARMUP,
            duration_type=FitDurationType.TIME,
            duration_value=900,  # 15 minutes
            target_type=FitTargetType.POWER,
            custom_power_low=130,  # 50% FTP
            custom_power_high=169,  # 65% FTP
            step_name="Warm up",
        )

        segment = parser._convert_step_to_segment(step, ftp)

        assert segment["type"] == "warmup"
        assert segment["duration_min"] == 15
        assert segment["power_low_pct"] == 50
        assert segment["power_high_pct"] == 65
        assert segment["description"] == "Warm up"

    def test_convert_step_to_segment_skip_open(self):
        """Test that OPEN duration steps are skipped."""
        parser = FitWorkoutParser()
        ftp = 260

        step = FitWorkoutStep(
            message_index=0,
            intensity=FitIntensity.COOLDOWN,
            duration_type=FitDurationType.OPEN,
            duration_value=0,
            target_type=FitTargetType.OPEN,
        )

        segment = parser._convert_step_to_segment(step, ftp)
        assert segment is None

    def test_validate_workout_structure_step_count_mismatch(self):
        """Test validation catches step count mismatch."""
        parser = FitWorkoutParser()

        metadata = FitWorkoutMetadata(
            name="Test", sport="cycling", num_steps=5
        )

        steps = [
            FitWorkoutStep(
                message_index=i,
                intensity=FitIntensity.ACTIVE,
                duration_type=FitDurationType.TIME,
                duration_value=600,
                target_type=FitTargetType.POWER,
            )
            for i in range(3)  # Only 3 steps, metadata says 5
        ]

        with pytest.raises(ValueError, match="Step count mismatch"):
            parser._validate_workout_structure(metadata, steps)


class TestFitWorkoutStep:
    """Unit tests for FitWorkoutStep data class."""

    def test_is_repeat_step(self):
        """Test repeat step detection."""
        step = FitWorkoutStep(
            message_index=0,
            intensity=None,
            duration_type=FitDurationType.REPEAT_UNTIL_STEPS_COMPLETE,
            duration_value=5,
            target_type=FitTargetType.OPEN,
            repeat_steps=5,
        )

        assert step.is_repeat_step() is True

    def test_is_not_repeat_step(self):
        """Test non-repeat step."""
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


class TestParsedWorkout:
    """Unit tests for ParsedWorkout data class."""

    def test_generate_workout_id(self):
        """Test workout ID generation."""
        metadata = FitWorkoutMetadata(
            name="VO2 Max intervals - 5x3min",
            sport="cycling",
            num_steps=7,
        )

        workout = ParsedWorkout(
            metadata=metadata,
            segments=[],
            base_duration_min=55,
            base_tss=85,
        )

        workout_id = workout._generate_workout_id()

        assert workout_id == "vo2_max_intervals_5x3min"
        assert len(workout_id) <= 50

    def test_to_library_format_structure(self):
        """Test conversion to library format."""
        metadata = FitWorkoutMetadata(
            name="Threshold workout",
            sport="cycling",
            num_steps=5,
        )

        segments = [
            {"type": "warmup", "duration_min": 15},
            {"type": "interval", "sets": 2},
            {"type": "cooldown", "duration_min": 10},
        ]

        workout = ParsedWorkout(
            metadata=metadata,
            segments=segments,
            base_duration_min=55,
            base_tss=85,
        )

        library_format = workout.to_library_format()

        assert "id" in library_format
        assert library_format["name"] == "Threshold workout"
        assert library_format["segments"] == segments
        assert library_format["base_duration_min"] == 55
        assert library_format["base_tss"] == 85
        assert "suitable_phases" in library_format
        assert "variable_components" in library_format
```

### Integration Tests

**File**: `tests/parsers/test_fit_workout_parser_integration.py`

```python
import pytest
from pathlib import Path
from cycling_ai.parsers.fit_workout_parser import FitWorkoutParser

class TestFitWorkoutParserIntegration:
    """Integration tests with real FIT files."""

    @pytest.fixture
    def sample_fit_dir(self):
        """Path to sample FIT files."""
        return Path(".claude/fit_samples")

    @pytest.fixture
    def parser(self):
        """FitWorkoutParser instance."""
        return FitWorkoutParser()

    def test_parse_minute_monster(self, parser, sample_fit_dir):
        """Test parsing Minute Monster workout."""
        fit_path = sample_fit_dir / "2025-11-04_MinuteMons.fit"
        ftp = 1200  # Based on sample power values

        workout = parser.parse_workout_file(fit_path, ftp)

        # Check metadata
        assert workout.metadata.name == "Minute Monster (Power)"
        assert workout.metadata.sport == "cycling"
        assert workout.metadata.num_steps == 14

        # Check segments
        assert len(workout.segments) > 0

        # Check has warmup
        assert any(s["type"] == "warmup" for s in workout.segments)

        # Check has intervals
        assert any(s["type"] == "interval" for s in workout.segments)

        # Check has cooldown
        assert any(s["type"] == "cooldown" for s in workout.segments)

        # Check duration
        assert workout.base_duration_min > 0

        # Check TSS
        assert workout.base_tss > 0

    def test_parse_vo2max_booster(self, parser, sample_fit_dir):
        """Test parsing VO2 Max Booster workout."""
        fit_path = sample_fit_dir / "2025-11-05_VO2MaxBoos.fit"
        ftp = 1200

        workout = parser.parse_workout_file(fit_path, ftp)

        assert "vo2" in workout.metadata.name.lower()
        assert workout.metadata.num_steps == 23

        # Should have multiple interval sets
        interval_segments = [
            s for s in workout.segments if s["type"] == "interval"
        ]
        assert len(interval_segments) > 0

    def test_parse_map_efforts(self, parser, sample_fit_dir):
        """Test parsing M.A.P Efforts workout."""
        fit_path = sample_fit_dir / "2025-04-04_M.A.PEffor.fit"
        ftp = 1200

        workout = parser.parse_workout_file(fit_path, ftp)

        assert "map" in workout.metadata.name.lower()
        assert workout.metadata.num_steps == 10

    def test_to_library_format_complete(self, parser, sample_fit_dir):
        """Test complete conversion to library format."""
        fit_path = sample_fit_dir / "2025-11-04_MinuteMons.fit"
        ftp = 1200

        workout = parser.parse_workout_file(fit_path, ftp)
        library_format = workout.to_library_format()

        # Validate all required fields
        required_fields = [
            "id",
            "name",
            "detailed_description",
            "type",
            "intensity",
            "suitable_phases",
            "suitable_weekdays",
            "segments",
            "base_duration_min",
            "base_tss",
            "variable_components",
        ]

        for field in required_fields:
            assert field in library_format

        # Validate segments structure
        for segment in library_format["segments"]:
            assert "type" in segment

            if segment["type"] == "interval":
                assert "sets" in segment
                assert "work" in segment
                assert "duration_min" in segment["work"]
                assert "power_low_pct" in segment["work"]
                assert "power_high_pct" in segment["work"]
            else:
                assert "duration_min" in segment
                assert "power_low_pct" in segment
                assert "power_high_pct" in segment
```

### Test Coverage Goals

- **Unit Tests**: 90%+ coverage
- **Integration Tests**: All sample FIT files
- **Edge Cases**: 100% of identified edge cases tested
- **Type Checking**: 100% mypy --strict compliance

---

## Implementation Sequence (Task Cards)

The implementation will follow a **Test-Driven Development (TDD)** approach:

### Phase 1: Foundation (Cards 1-3)
1. **CARD_001**: Set up module structure and data classes
2. **CARD_002**: Implement FIT file reading and metadata extraction
3. **CARD_003**: Implement step extraction and validation

### Phase 2: Core Parsing (Cards 4-6)
4. **CARD_004**: Implement simple segment conversion
5. **CARD_005**: Implement repeat structure handling
6. **CARD_006**: Implement power conversion logic

### Phase 3: Integration (Cards 7-8)
7. **CARD_007**: Implement ParsedWorkout and library format conversion
8. **CARD_008**: Integration tests with sample FIT files

### Phase 4: Polish (Cards 9-10)
9. **CARD_009**: Edge case handling and validation
10. **CARD_010**: Documentation and examples

---

## Dependencies

### Required Python Packages

```python
# Already installed (from existing project)
fitparse==1.2.0  # FIT file parsing

# May need to install
dataclasses  # Python 3.7+ (built-in)
pathlib  # Python 3.4+ (built-in)
typing  # Python 3.5+ (built-in)
```

### Internal Dependencies

```python
from cycling_ai.core.workout_builder import Workout, WorkoutSegment
from cycling_ai.core.power_zones import calculate_power_zones
from cycling_ai.core.tss import calculate_workout_tss
```

---

## Success Criteria

### Functional Requirements
- [ ] Parse all 4 sample FIT files successfully
- [ ] Extract workout metadata (name, sport, steps)
- [ ] Convert all workout steps to segments
- [ ] Handle repeat/interval structures correctly
- [ ] Convert power zones and custom ranges to percentages
- [ ] Calculate accurate duration and TSS
- [ ] Generate valid workout library format

### Non-Functional Requirements
- [ ] 100% type safety (mypy --strict passes)
- [ ] 90%+ test coverage (unit tests)
- [ ] 100% integration test success (all samples)
- [ ] Clear error messages for invalid files
- [ ] Performance: Parse file in < 1 second
- [ ] Documentation: All public methods documented

### Code Quality
- [ ] PEP 8 compliance (ruff check passes)
- [ ] No code duplication
- [ ] Clear, descriptive naming
- [ ] Comprehensive docstrings
- [ ] Type hints on all functions

---

## Open Questions & Decisions Needed

### 1. FTP Requirement
**Question**: Should parser require FTP as input or support parsing without FTP?

**Options**:
- A) Require FTP (current design) - enables power percentage calculations
- B) Optional FTP - store raw watts if FTP not provided
- C) Store both watts and percentages

**Recommendation**: Option A (require FTP)
- Reason: Workout library format requires percentages
- Fallback: If FTP unknown, could use average power from sample files

### 2. Workout Type Inference
**Question**: How should parser infer workout type (VO2max, threshold, etc.)?

**Options**:
- A) Analyze power percentages in main intervals
- B) Parse workout name for keywords
- C) Leave empty for manual classification
- D) Use both A and B with confidence score

**Recommendation**: Option D
- Reason: Most accurate, allows manual override if low confidence

### 3. Variable Components Detection
**Question**: How to detect which workout components are adjustable?

**Options**:
- A) Mark all intervals as adjustable (sets can change)
- B) Use heuristics (if > 3 sets, adjustable)
- C) Leave empty for manual configuration
- D) Create separate "rigid" vs "flexible" workout categories

**Recommendation**: Option A initially, refine later
- Reason: Simple, conservative approach

### 4. Missing Detailed Descriptions
**Question**: FIT files don't include coaching notes. How to handle?

**Options**:
- A) Leave empty, add manually later
- B) Generate generic description based on workout type
- C) Use LLM to generate description from structure
- D) Prompt user to add description during import

**Recommendation**: Option A
- Reason: Simplest, maintains data integrity

### 5. Suitable Phases/Weekdays
**Question**: How to determine suitable phases and weekdays?

**Options**:
- A) Use default values for all workouts
- B) Infer from intensity (hard = Build/Peak, easy = all phases)
- C) Leave empty for manual configuration
- D) Create configuration file for mapping rules

**Recommendation**: Option B
- Reason: Provides reasonable defaults, can be overridden

---

## Future Enhancements (Out of Scope)

1. **Bi-directional Conversion**
   - Export our workout library format to FIT files
   - Would enable creating workouts in our system, loading to Garmin

2. **Advanced Workout Types**
   - Support running workouts (pace zones)
   - Support swim workouts (different structure)

3. **Workout Variations**
   - Detect workout "families" (same structure, different intensities)
   - Auto-generate progressive variations

4. **Metadata Enrichment**
   - Use LLM to generate detailed descriptions
   - Infer coaching notes from structure

5. **Workout Validation**
   - Physiological feasibility checks
   - TSS/intensity warnings

---

## Ready for Implementation

This plan provides:
- ✅ Clear architecture and data flow
- ✅ Complete type-safe data class designs
- ✅ Detailed parser implementation outline
- ✅ Comprehensive testing strategy
- ✅ Edge case analysis and mitigation
- ✅ Clear success criteria
- ✅ Implementation sequence (task cards)

**Next Steps**:
1. Review and approve this plan
2. Create detailed implementation task cards (CARD_001 - CARD_010)
3. Begin TDD implementation starting with CARD_001

**Estimated Implementation Time**: 8-12 hours (1.5-2 days)

---

**Document Status**: COMPLETE - Ready for Task Card Generation
**Author**: Task Implementation Preparation Architect
**Date**: 2025-11-02
