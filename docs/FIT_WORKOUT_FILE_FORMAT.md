# FIT Workout File Format - Technical Reference

**Purpose**: Understanding FIT workout file structure for parsing and generating workouts
**Date**: 2025-11-02
**Sources**: Garmin FIT SDK, fit-tool library, GarminWorkoutCreator

---

## Overview

FIT (Flexible and Interoperable Data Transfer) workout files define structured workouts that can be loaded onto Garmin/Wahoo/etc cycling computers. A workout is a collection of **steps** with defined **duration** and **intensity targets** (heart rate, pace, or power).

---

## File Structure

### Required Messages

1. **FileIdMessage** - File metadata
2. **WorkoutMessage** - Workout metadata (name, sport, number of steps)
3. **WorkoutStepMessage** (multiple) - Individual workout steps

### Optional Messages

4. **WorkoutRepeatMessage** - Define repeat/interval structures

---

## Message Definitions

### 1. FileIdMessage

```python
file_id_message = FileIdMessage()
file_id_message.type = FileType.WORKOUT
file_id_message.manufacturer = Manufacturer.DEVELOPMENT.value
file_id_message.product = 0
file_id_message.time_created = round(datetime.datetime.now().timestamp() * 1000)
file_id_message.serial_number = 0x12345678
```

**Fields**:
- `type`: Always `FileType.WORKOUT` for workout files
- `manufacturer`: Device manufacturer (e.g., Garmin, Wahoo)
- `product`: Product ID
- `time_created`: Timestamp in milliseconds since Unix epoch
- `serial_number`: Device serial number

---

### 2. WorkoutMessage

```python
workout_message = WorkoutMessage()
workout_message.workoutName = 'VO2 Max Intervals'
workout_message.sport = Sport.CYCLING
workout_message.num_valid_steps = 5  # Total number of steps
```

**Fields**:
- `workoutName`: Workout name (string)
- `sport`: Sport type (e.g., `Sport.CYCLING`, `Sport.RUNNING`)
- `num_valid_steps`: Total number of WorkoutStepMessage records

---

### 3. WorkoutStepMessage

This is the core message that defines each segment of the workout.

```python
step = WorkoutStepMessage()
step.workout_step_name = 'Warmup'
step.message_index = 0  # Step number (0-indexed)
step.intensity = Intensity.WARMUP
step.duration_type = WorkoutStepDuration.TIME
step.duration_time = 600.0  # 10 minutes in seconds
step.target_type = WorkoutStepTarget.POWER
step.target_power_zone = 2  # Power zone 2
```

**Fields**:
- `workout_step_name`: Step description (string)
- `message_index`: Step sequence number (0-indexed)
- `intensity`: Intensity classification (see below)
- `duration_type`: How step duration is measured (see below)
- `duration_value`: Duration value (depends on duration_type)
- `target_type`: What metric to target (see below)
- `target_value`: Target value (depends on target_type)

---

## Enumerations

### Intensity Types

```python
class Intensity(Enum):
    WARMUP = 0
    COOLDOWN = 1
    ACTIVE = 2        # Main work intervals
    REST = 3          # Recovery between intervals
    INTERVAL = 4      # Deprecated, use ACTIVE
```

**Usage**:
- `WARMUP`: Easy spinning at start
- `ACTIVE`: Main work efforts (intervals, tempo, threshold)
- `REST`: Recovery between work intervals
- `COOLDOWN`: Easy spinning at end

---

### Duration Types

```python
class WorkoutStepDuration(Enum):
    TIME = 0                    # Duration in seconds
    DISTANCE = 1                # Duration in meters
    HR_LESS_THAN = 2            # Until HR drops below target
    HR_GREATER_THAN = 3         # Until HR exceeds target
    CALORIES = 4                # Duration in calories
    OPEN = 5                    # User-controlled (press lap button)
    REPEAT_UNTIL_STEPS_COMPLETE = 6  # For repeat structures
    REPEAT_UNTIL_TIME = 7       # Repeat until time elapsed
    REPEAT_UNTIL_DISTANCE = 8   # Repeat until distance covered
    REPEAT_UNTIL_CALORIES = 9   # Repeat until calories burned
    REPEAT_UNTIL_HR_LESS_THAN = 10
    REPEAT_UNTIL_HR_GREATER_THAN = 11
    REPEAT_UNTIL_POWER_LESS_THAN = 12
    REPEAT_UNTIL_POWER_GREATER_THAN = 13
    POWER_LESS_THAN = 14        # Until power drops below target
    POWER_GREATER_THAN = 15     # Until power exceeds target
    REPS = 28                   # Number of repetitions
```

**Common Duration Fields**:
- `duration_time`: Seconds (e.g., 600.0 = 10 minutes)
- `duration_distance`: Meters (e.g., 1609.0 = 1 mile)
- `duration_value`: Generic value for other types

---

### Target Types

```python
class WorkoutStepTarget(Enum):
    SPEED = 0                   # Speed target (m/s)
    HEART_RATE = 1              # HR zone or range
    OPEN = 2                    # No specific target
    CADENCE = 3                 # Cadence (rpm)
    POWER = 4                   # Power zone or range
    GRADE = 5                   # Incline gradient
    RESISTANCE = 6              # Trainer resistance
    POWER_3S = 7                # 3-second power
    POWER_10S = 8               # 10-second power
    POWER_30S = 9               # 30-second power
    POWER_LAP = 10              # Lap power
    SWIM_STROKE = 11            # Swim stroke type
    SPEED_LAP = 12              # Lap speed
    HEART_RATE_LAP = 13         # Lap HR
```

**Common Target Fields** (for Power):
- `target_power_zone`: Zone number (1-7)
- `custom_target_power_low`: Lower bound in watts
- `custom_target_power_high`: Upper bound in watts

**Common Target Fields** (for HR):
- `target_hr_zone`: Zone number (1-5)
- `custom_target_heart_rate_low`: Lower bound in bpm
- `custom_target_heart_rate_high`: Upper bound in bpm

---

## Workout Examples

### Example 1: Simple VO2 Max Workout

```python
# Warmup: 15 min Z2
warmup = WorkoutStepMessage()
warmup.message_index = 0
warmup.workout_step_name = 'Warmup'
warmup.intensity = Intensity.WARMUP
warmup.duration_type = WorkoutStepDuration.TIME
warmup.duration_time = 900.0  # 15 minutes
warmup.target_type = WorkoutStepTarget.POWER
warmup.target_power_zone = 2

# Work interval: 3 min Z5 (VO2 max)
work = WorkoutStepMessage()
work.message_index = 1
work.workout_step_name = 'VO2 Max Effort'
work.intensity = Intensity.ACTIVE
work.duration_type = WorkoutStepDuration.TIME
work.duration_time = 180.0  # 3 minutes
work.target_type = WorkoutStepTarget.POWER
work.target_power_zone = 5

# Recovery: 3 min Z1
recovery = WorkoutStepMessage()
recovery.message_index = 2
recovery.workout_step_name = 'Recovery'
recovery.intensity = Intensity.REST
recovery.duration_type = WorkoutStepDuration.TIME
recovery.duration_time = 180.0  # 3 minutes
recovery.target_type = WorkoutStepTarget.POWER
recovery.target_power_zone = 1

# Cooldown: 10 min Z1
cooldown = WorkoutStepMessage()
cooldown.message_index = 3
cooldown.workout_step_name = 'Cooldown'
cooldown.intensity = Intensity.COOLDOWN
cooldown.duration_type = WorkoutStepDuration.TIME
cooldown.duration_time = 600.0  # 10 minutes
cooldown.target_type = WorkoutStepTarget.POWER
cooldown.target_power_zone = 1

workout_steps = [warmup, work, recovery, cooldown]
```

---

### Example 2: Custom Power Targets (Not Zones)

```python
# Threshold interval: 20 min @ 250-270W
threshold = WorkoutStepMessage()
threshold.message_index = 1
threshold.workout_step_name = 'Threshold'
threshold.intensity = Intensity.ACTIVE
threshold.duration_type = WorkoutStepDuration.TIME
threshold.duration_time = 1200.0  # 20 minutes
threshold.target_type = WorkoutStepTarget.POWER
threshold.custom_target_power_low = 250  # watts
threshold.custom_target_power_high = 270  # watts
```

---

### Example 3: Intervals with Repeat Structure

**Note**: Repeat structures use `WorkoutStepDuration.REPEAT_UNTIL_STEPS_COMPLETE`

```python
# Warmup
warmup = WorkoutStepMessage()
warmup.message_index = 0
warmup.workout_step_name = 'Warmup'
warmup.intensity = Intensity.WARMUP
warmup.duration_type = WorkoutStepDuration.TIME
warmup.duration_time = 900.0  # 15 min
warmup.target_type = WorkoutStepTarget.POWER
warmup.target_power_zone = 2

# Work interval (will be repeated)
work = WorkoutStepMessage()
work.message_index = 1
work.workout_step_name = 'Work'
work.intensity = Intensity.ACTIVE
work.duration_type = WorkoutStepDuration.TIME
work.duration_time = 180.0  # 3 min
work.target_type = WorkoutStepTarget.POWER
work.target_power_zone = 5

# Recovery (will be repeated)
recovery = WorkoutStepMessage()
recovery.message_index = 2
recovery.workout_step_name = 'Recovery'
recovery.intensity = Intensity.REST
recovery.duration_type = WorkoutStepDuration.TIME
recovery.duration_time = 180.0  # 3 min
recovery.target_type = WorkoutStepTarget.POWER
recovery.target_power_zone = 1

# Repeat step (repeat steps 1-2 five times)
repeat = WorkoutStepMessage()
repeat.message_index = 3
repeat.workout_step_name = 'Repeat 5x'
repeat.duration_type = WorkoutStepDuration.REPEAT_UNTIL_STEPS_COMPLETE
repeat.duration_value = 5  # Number of repetitions
repeat.target_type = WorkoutStepTarget.OPEN
repeat.repeat_from = 1  # Start repeating from step 1
repeat.repeat_to = 2    # End repeat at step 2

# Cooldown
cooldown = WorkoutStepMessage()
cooldown.message_index = 4
cooldown.workout_step_name = 'Cooldown'
cooldown.intensity = Intensity.COOLDOWN
cooldown.duration_type = WorkoutStepDuration.TIME
cooldown.duration_time = 600.0  # 10 min
cooldown.target_type = WorkoutStepTarget.POWER
cooldown.target_power_zone = 1

workout_steps = [warmup, work, recovery, repeat, cooldown]
```

**Structure**: Warmup → (Work → Recovery) × 5 → Cooldown

---

## Power Zone Definitions

FIT files reference power zones (1-7). These zones are typically defined in the athlete's device settings based on FTP:

| Zone | Name | % FTP | Description |
|------|------|-------|-------------|
| 1 | Active Recovery | < 55% | Very easy |
| 2 | Endurance | 56-75% | Aerobic base |
| 3 | Tempo | 76-90% | Sustainable effort |
| 4 | Threshold | 91-105% | Lactate threshold |
| 5 | VO2 Max | 106-120% | Maximal aerobic |
| 6 | Anaerobic | 121-150% | Anaerobic capacity |
| 7 | Neuromuscular | > 150% | Sprint power |

**Note**: When using `target_power_zone`, the device uses its configured zones. When using `custom_target_power_low/high`, you specify exact wattage.

---

## Building Complete FIT Workout File

```python
from fit_tool.fit_file_builder import FitFileBuilder
from fit_tool.profile.messages.file_id_message import FileIdMessage
from fit_tool.profile.messages.workout_message import WorkoutMessage
from fit_tool.profile.messages.workout_step_message import WorkoutStepMessage
from fit_tool.profile.profile_type import (
    FileType, Sport, Intensity,
    WorkoutStepDuration, WorkoutStepTarget
)
import datetime

# 1. Create FileId message
file_id = FileIdMessage()
file_id.type = FileType.WORKOUT
file_id.manufacturer = 0  # Development
file_id.product = 0
file_id.time_created = round(datetime.datetime.now().timestamp() * 1000)
file_id.serial_number = 0x12345678

# 2. Create Workout message
workout = WorkoutMessage()
workout.workoutName = 'VO2 Max Intervals'
workout.sport = Sport.CYCLING
workout.num_valid_steps = 4  # Total steps

# 3. Create workout steps (warmup, work, recovery, cooldown)
workout_steps = [...]  # See examples above

# 4. Build and save FIT file
builder = FitFileBuilder(auto_define=True, min_string_size=50)
builder.add(file_id)
builder.add(workout)
builder.add_all(workout_steps)

fit_file = builder.build()
fit_file.to_file('vo2max_workout.fit')
```

---

## Mapping Our Workout Library to FIT

### Our Workout Structure → FIT Mapping

**Our JSON Structure**:
```json
{
  "id": "vo2max_classic",
  "segments": [
    {
      "type": "warmup",
      "duration_min": 15,
      "power_low_pct": 50,
      "power_high_pct": 65
    },
    {
      "type": "interval",
      "sets": 5,
      "work": {
        "duration_min": 3,
        "power_low_pct": 110,
        "power_high_pct": 120
      },
      "recovery": {
        "duration_min": 3,
        "power_low_pct": 50,
        "power_high_pct": 60
      }
    },
    {
      "type": "cooldown",
      "duration_min": 10,
      "power_low_pct": 50,
      "power_high_pct": 55
    }
  ]
}
```

**FIT Mapping**:
1. **Warmup segment** → WorkoutStepMessage (intensity=WARMUP, duration_type=TIME)
2. **Interval.work** → WorkoutStepMessage (intensity=ACTIVE, duration_type=TIME)
3. **Interval.recovery** → WorkoutStepMessage (intensity=REST, duration_type=TIME)
4. **Repeat step** → WorkoutStepMessage (duration_type=REPEAT_UNTIL_STEPS_COMPLETE)
5. **Cooldown segment** → WorkoutStepMessage (intensity=COOLDOWN, duration_type=TIME)

---

## Parsing Strategy

### From FIT → Our Library Format

```python
def parse_fit_workout(fit_file_path: Path) -> dict:
    """Parse FIT workout file into our library format."""

    # 1. Read FIT file
    fit_data = read_fit_file(fit_file_path)

    # 2. Extract workout metadata
    workout_msg = fit_data.get_message('workout')[0]
    workout_name = workout_msg['workout_name']

    # 3. Extract workout steps
    steps = fit_data.get_messages('workout_step')

    # 4. Convert to our segment format
    segments = []
    for step in steps:
        segment = convert_step_to_segment(step)
        segments.append(segment)

    # 5. Detect repeat structures and consolidate
    segments = consolidate_repeats(segments)

    return {
        "id": generate_id(workout_name),
        "name": workout_name,
        "segments": segments
    }
```

### From Our Library → FIT

```python
def export_workout_to_fit(workout: dict, output_path: Path) -> None:
    """Export our workout format to FIT file."""

    builder = FitFileBuilder()

    # Add file_id
    builder.add(create_file_id())

    # Add workout message
    workout_msg = WorkoutMessage()
    workout_msg.workoutName = workout['name']
    workout_msg.num_valid_steps = count_fit_steps(workout)
    builder.add(workout_msg)

    # Convert segments to FIT steps
    step_index = 0
    for segment in workout['segments']:
        if segment['type'] == 'interval':
            # Create work step
            work_step = create_interval_work_step(segment, step_index)
            builder.add(work_step)
            step_index += 1

            # Create recovery step
            recovery_step = create_interval_recovery_step(segment, step_index)
            builder.add(recovery_step)
            step_index += 1

            # Create repeat step
            repeat_step = create_repeat_step(segment, step_index, work_index, recovery_index)
            builder.add(repeat_step)
            step_index += 1
        else:
            # Simple step (warmup, cooldown, steady)
            step = create_simple_step(segment, step_index)
            builder.add(step)
            step_index += 1

    # Build and save
    fit_file = builder.build()
    fit_file.to_file(output_path)
```

---

## Key Takeaways for Implementation

1. **FIT uses zones or custom ranges**: Either `target_power_zone` (1-7) OR `custom_target_power_low/high` (watts)
2. **Repeats are separate steps**: Interval structures require work + recovery + repeat messages
3. **Message index matters**: Steps must be sequentially numbered (0-indexed)
4. **Intensity classification**: Critical for device UI (warmup, active, rest, cooldown)
5. **Duration in seconds**: `duration_time` is always in seconds (not minutes)
6. **Power in percentage**: Our library stores power as % FTP, FIT needs zones or absolute watts

---

## Libraries Available

### Python
- **fit-tool**: Full FIT file creation and parsing (recommended)
- **fitparse**: FIT file parsing only
- **python-fitparse**: Alternative parser

### Java
- **GarminWorkoutCreator**: Archived project, converts Excel → FIT

### Official
- **Garmin FIT SDK**: C++, Java, C# - Official implementation

---

## Next Steps for Our Implementation

1. **Create FIT export function** in `src/cycling_ai/exporters/fit_exporter.py`
2. **Map power percentages to zones** or custom ranges
3. **Handle interval structures** (work + recovery + repeat)
4. **Test with real devices** (Garmin Edge, Wahoo BOLT)
5. **Add FIT import** to parse existing workouts into library

---

**References**:
- [Garmin FIT SDK](https://developer.garmin.com/fit/)
- [fit-tool PyPI](https://pypi.org/project/fit-tool/)
- [GarminWorkoutCreator](https://github.com/jpickup/GarminWorkoutCreator)
