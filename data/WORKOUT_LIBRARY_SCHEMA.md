# Workout Library Schema Documentation

**Version**: 1.0.0
**File**: `workout_library.json`
**Last Updated**: 2025-11-02

---

## Overview

The workout library is a JSON file containing pre-built workout definitions for cycling training plans. Each workout is a complete, structured training session with power targets, durations, and metadata.

---

## File Structure

```json
{
  "version": "1.0.0",
  "description": "Workout library for cycling training plans",
  "ftp_reference": 1150,
  "workouts": [ ... ],
  "metadata": { ... }
}
```

### Top-Level Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `version` | string | Library version (semantic versioning) | `"1.0.0"` |
| `description` | string | Brief description of library | `"Workout library for cycling training plans"` |
| `ftp_reference` | number | Reference FTP used for power calculations (watts) | `1150` |
| `workouts` | array | Array of workout objects (see below) | `[...]` |
| `metadata` | object | Library metadata (creation info, stats) | `{...}` |

---

## Workout Object Schema

Each workout in the `workouts` array has the following structure:

```json
{
  "id": "minute_monster_power",
  "name": "Minute Monster (Power)",
  "detailed_description": "",
  "type": "vo2max",
  "intensity": "hard",
  "suitable_phases": ["Build", "Peak"],
  "suitable_weekdays": ["Tuesday", "Wednesday", "Thursday"],
  "segments": [ ... ],
  "base_duration_min": 74,
  "base_tss": 128,
  "variable_components": { ... },
  "source_file": "2025-11-04_MinuteMons.fit",
  "source_format": "fit"
}
```

### Workout Fields Reference

#### `id` (string, required)
**Unique identifier** for the workout (used in code references).

**Format**: `snake_case` (lowercase with underscores)

**Examples**:
- `"vo2max_classic"`
- `"threshold_2x20"`
- `"endurance_z2"`
- `"minute_monster_power"`

**Generation**: Automatically created from workout name:
- Remove special characters
- Convert spaces to underscores
- Convert to lowercase
- Remove duplicate underscores

---

#### `name` (string, required)
**Human-readable name** displayed to athletes.

**Format**: Free text (3-50 characters)

**Examples**:
- `"VO2 Max intervals"`
- `"Threshold 2x20"`
- `"Minute Monster (Power)"`
- `"Endurance base ride"`

**Guidelines**:
- Descriptive and scannable
- Include workout type or key characteristic
- Avoid overly long names

---

#### `detailed_description` (string, optional)
**Comprehensive explanation** of the workout (100-250 words).

**Format**: Plain text (supports basic markdown in future)

**Should Include**:
1. **Environment recommendation** (indoor/outdoor/either)
2. **Physiological target** (what system this trains)
3. **Training benefits** (performance improvements)
4. **Execution guidance** (how to perform effectively)

**Example**:
```
"Ideally perform this on your trainer, although outdoors works fine too.
Short interval HIIT is an effective means of enhancing your maximal oxygen
uptake (VO2max) and performance. The workout uses short bouts of work above
your pVO2max, with passive relief periods, to enable recruitment of your
larger fast twitch muscles, as well as stimulation of maximal cardiac output
(your heart). Focus on maintaining consistent power throughout each interval
and use the recovery periods to let your heart rate drop before the next effort."
```

**Current Status**: Most workouts have empty descriptions (need to be added manually).

---

#### `type` (string, required)
**Workout classification** based on primary training stimulus.

**Valid Values**:
- `"vo2max"` - VO2 Max intervals (106-120% FTP)
- `"threshold"` - Lactate threshold work (91-105% FTP)
- `"sweet_spot"` - Sweet spot training (88-93% FTP)
- `"tempo"` - Tempo pace (76-90% FTP)
- `"endurance"` - Aerobic endurance (56-75% FTP)
- `"recovery"` - Active recovery (< 55% FTP)

**Inference Logic**:
Based on highest power percentage in workout:
- ≥ 106% FTP → `vo2max`
- ≥ 91% FTP → `threshold`
- ≥ 88% FTP → `sweet_spot`
- ≥ 76% FTP → `tempo`
- < 76% FTP → `endurance`

**Example**: A workout with intervals at 110% FTP = `"vo2max"`

---

#### `intensity` (string, required)
**Relative difficulty** of the workout.

**Valid Values**:
- `"hard"` - High intensity, significant fatigue
- `"easy"` - Low intensity, minimal fatigue

**Inference Logic**:
Based on workout type:
- `hard`: vo2max, threshold, sweet_spot
- `easy`: tempo, endurance, recovery

**Usage**: Used by WorkoutSelector to match hard vs easy days in training plan.

---

#### `suitable_phases` (array of strings, required)
**Training phases** where this workout is appropriate.

**Valid Values**:
- `"Foundation"` - Base building phase
- `"Build"` - Building intensity phase
- `"Recovery"` - Recovery week
- `"Peak"` - Race preparation phase
- `"Taper"` - Pre-race taper

**Examples**:
```json
"suitable_phases": ["Build", "Peak"]        // VO2 Max workout
"suitable_phases": ["Foundation", "Build"]  // Endurance workout
"suitable_phases": ["Recovery"]             // Recovery ride
```

**Inference Logic**:
- `vo2max` → Build, Peak
- `threshold` → Build, Peak
- `sweet_spot` → Foundation, Build
- `tempo` → Foundation, Build
- `endurance` → Foundation, Build, Recovery
- `recovery` → Recovery

**Usage**: WorkoutSelector filters workouts by current training phase.

---

#### `suitable_weekdays` (array of strings, required)
**Preferred weekdays** for scheduling this workout.

**Valid Values**:
- `"Monday"`, `"Tuesday"`, `"Wednesday"`, `"Thursday"`, `"Friday"`, `"Saturday"`, `"Sunday"`

**Guidelines**:
- **Hard workouts**: Weekdays (Tuesday, Wednesday, Thursday) - allows weekend for long rides
- **Easy workouts**: Any day
- **Long endurance**: Weekends (Saturday, Sunday) - more time available

**Examples**:
```json
"suitable_weekdays": ["Tuesday", "Wednesday", "Thursday"]  // VO2 Max
"suitable_weekdays": ["Saturday", "Sunday"]                // Long endurance
"suitable_weekdays": ["Monday", "Tuesday", ..., "Sunday"]  // Recovery (any day)
```

**Inference Logic** (for hard workouts):
```
if intensity == "hard":
    suitable_weekdays = ["Tuesday", "Wednesday", "Thursday"]
else:
    suitable_weekdays = ["Monday", ..., "Sunday"]  # All days
```

**Usage**: WorkoutSelector prioritizes these days when assigning workouts.

---

#### `segments` (array of objects, required)
**Ordered list of workout segments** (warmup, intervals, cooldown, etc.).

**Segment Types**:
1. **Simple Segments**: warmup, cooldown, steady, tempo, recovery
2. **Interval Segments**: repeating work/recovery patterns

**Example Structure**:
```json
"segments": [
  {
    "type": "warmup",
    "duration_min": 15,
    "power_low_pct": 50,
    "power_high_pct": 65,
    "description": "Easy spin"
  },
  {
    "type": "interval",
    "sets": 5,
    "work": {
      "duration_min": 3,
      "power_low_pct": 110,
      "power_high_pct": 120,
      "description": "VO2 max effort"
    },
    "recovery": {
      "duration_min": 3,
      "power_low_pct": 50,
      "power_high_pct": 60,
      "description": "Easy recovery"
    }
  },
  {
    "type": "cooldown",
    "duration_min": 10,
    "power_low_pct": 50,
    "power_high_pct": 55,
    "description": "Cool down"
  }
]
```

**See "Segment Object Schema" below for detailed field reference.**

---

#### `base_duration_min` (number, required)
**Total workout duration** in minutes (sum of all segment durations).

**Format**: Integer or decimal (minutes)

**Examples**:
- `42` - 42 minutes
- `74.5` - 74 minutes 30 seconds
- `120` - 2 hours

**Calculation**:
```
base_duration_min = sum(all segment durations)
```

For interval segments:
```
segment_duration = warmup + (work_duration + recovery_duration) × sets + cooldown
```

**Usage**:
- Display total workout time to athlete
- Schedule workouts to fit weekly time budget
- Calculate hourly TSS rate

---

#### `base_tss` (number, required)
**Training Stress Score** - quantifies workout difficulty.

**Format**: Decimal number (0-300+ typical range)

**Examples**:
- `75` - Moderate workout
- `128` - Hard workout
- `200` - Very hard workout

**Calculation Formula**:
```
TSS = (duration_hours × intensity_factor² × 100)
```

Where `intensity_factor` is derived from normalized power:
```
intensity_factor = normalized_power / FTP
```

**Approximate TSS by Intensity**:
- Recovery (< 55% FTP): ~30 TSS/hour
- Endurance (56-75% FTP): ~50 TSS/hour
- Tempo (76-90% FTP): ~70 TSS/hour
- Threshold (91-105% FTP): ~90 TSS/hour
- VO2 Max (106-120% FTP): ~120 TSS/hour

**Usage**:
- Weekly TSS targets (e.g., 300 TSS/week)
- Progressive overload (increase TSS week-to-week)
- Recovery planning (reduce TSS in recovery weeks)

---

#### `variable_components` (object, optional)
**Adjustable parameters** that can be modified to fit time/TSS targets.

**Format**:
```json
{
  "adjustable_field": "sets",
  "min_value": 4,
  "max_value": 8,
  "tss_per_unit": 17,
  "duration_per_unit_min": 6
}
```

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `adjustable_field` | string | What can be adjusted: `"sets"` or `"duration"` |
| `min_value` | number | Minimum allowed value |
| `max_value` | number | Maximum allowed value |
| `tss_per_unit` | number | TSS added per unit increase |
| `duration_per_unit_min` | number | Minutes added per unit increase |

**Examples**:

**Adjustable Sets** (VO2 Max intervals):
```json
{
  "adjustable_field": "sets",
  "min_value": 4,
  "max_value": 8,
  "tss_per_unit": 17,
  "duration_per_unit_min": 6
}
```
Meaning: Can do 4-8 sets. Each additional set adds 17 TSS and 6 minutes.

**Adjustable Duration** (Endurance ride):
```json
{
  "adjustable_field": "duration",
  "min_value": 60,
  "max_value": 180,
  "tss_per_unit": 0.8,
  "duration_per_unit_min": 1
}
```
Meaning: Can be 60-180 minutes. Each additional minute adds 0.8 TSS.

**Usage**:
WorkoutSelector adjusts these values to hit weekly TSS/time targets:
```python
# Need to reduce TSS by 20
if workout.variable_components.adjustable_field == "sets":
    sets_to_remove = 20 / workout.variable_components.tss_per_unit
    new_sets = workout.base_sets - sets_to_remove
```

---

#### `source_file` (string, optional)
**Original filename** if workout was imported from external source.

**Examples**:
- `"2025-11-04_MinuteMons.fit"` - FIT file
- `"vo2max_classic.json"` - Manual JSON
- `null` - Created programmatically

**Usage**: Tracking and debugging workout origin.

---

#### `source_format` (string, optional)
**Format of source file**.

**Valid Values**:
- `"fit"` - FIT workout file
- `"json"` - JSON workout definition
- `"manual"` - Manually created
- `"zwo"` - Zwift workout file
- `"mrc"` - TrainerRoad workout file

**Usage**: Parsing and import logic.

---

## Segment Object Schema

Segments define individual parts of a workout (warmup, intervals, cooldown).

### Simple Segment (warmup, cooldown, steady, tempo, recovery)

```json
{
  "type": "warmup",
  "duration_min": 15,
  "power_low_pct": 50,
  "power_high_pct": 65,
  "description": "Easy spin"
}
```

#### Segment Fields

**`type`** (string, required)
- Valid values: `"warmup"`, `"cooldown"`, `"steady"`, `"tempo"`, `"recovery"`
- Determines how segment is displayed and categorized

**`duration_min`** (number, required)
- Duration in minutes (integer or decimal)
- Examples: `15`, `10.5`, `120`

**`power_low_pct`** (number, required)
- Lower power target as **percentage of FTP**
- Range: 0-200 (typically 50-120)
- Examples: `50` (50% FTP), `95` (95% FTP), `110` (110% FTP)

**`power_high_pct`** (number, required)
- Upper power target as **percentage of FTP**
- Range: 0-200 (typically 50-120)
- Usually slightly higher than `power_low_pct`
- Examples: `65` (65% FTP), `105` (105% FTP), `120` (120% FTP)

**Power Range Examples**:
- Recovery: `50-60%` FTP
- Endurance: `56-75%` FTP
- Tempo: `76-90%` FTP
- Threshold: `95-105%` FTP
- VO2 Max: `110-120%` FTP

**`description`** (string, required)
- Brief description of segment (1-10 words)
- Examples: `"Easy spin"`, `"VO2 max effort"`, `"Cool down"`

---

### Interval Segment

```json
{
  "type": "interval",
  "sets": 5,
  "work": {
    "duration_min": 3,
    "power_low_pct": 110,
    "power_high_pct": 120,
    "description": "VO2 max effort"
  },
  "recovery": {
    "duration_min": 3,
    "power_low_pct": 50,
    "power_high_pct": 60,
    "description": "Easy recovery"
  }
}
```

#### Interval Fields

**`type`** (string, required)
- Always `"interval"` for repeating work/recovery patterns

**`sets`** (number, required)
- Number of repetitions
- Range: 1-20 (typically 3-10)
- Examples: `5` (repeat 5 times), `10` (repeat 10 times)

**`work`** (object, required)
- Work interval definition (same fields as simple segment)
- Contains: `duration_min`, `power_low_pct`, `power_high_pct`, `description`

**`recovery`** (object, optional)
- Recovery interval between work intervals
- Contains: `duration_min`, `power_low_pct`, `power_high_pct`, `description`
- If omitted, no recovery between sets (back-to-back work)

**Total Duration Calculation**:
```
interval_duration = (work.duration_min + recovery.duration_min) × sets
```

**Example**:
```
sets = 5
work.duration_min = 3
recovery.duration_min = 3
total = (3 + 3) × 5 = 30 minutes
```

---

## Power Percentage Reference

All power values in the library are **percentages of FTP** (Functional Threshold Power).

### Standard Power Zones (Coggan Model)

| Zone | Name | % FTP | Description |
|------|------|-------|-------------|
| 1 | Active Recovery | < 55% | Very easy, conversational |
| 2 | Endurance | 56-75% | Aerobic base, all-day pace |
| 3 | Tempo | 76-90% | "Comfortably hard" |
| 4 | Threshold | 91-105% | Lactate threshold, sustainable ~1hr |
| 5 | VO2 Max | 106-120% | Maximal aerobic, hard breathing |
| 6 | Anaerobic | 121-150% | Anaerobic capacity, very hard |
| 7 | Neuromuscular | > 150% | Sprint power, maximal effort |

### Converting to Absolute Watts

When assigning workout to athlete:

```python
athlete_ftp = 260  # watts
power_target_pct = 110  # % FTP (from library)

power_watts = (power_target_pct / 100) * athlete_ftp
# 110% of 260W = 286W
```

### Library Uses Relative (%) Power

**Why?**
- Workouts are portable across athletes
- Same workout structure works for FTP=200W or FTP=400W
- Easy to adjust for different fitness levels

**When to Convert to Watts?**
- When displaying to athlete: "Hold 250-270W"
- When sending to device (Garmin, Wahoo)
- When calculating actual TSS

---

## TSS (Training Stress Score) Explained

**TSS** quantifies workout difficulty by combining duration and intensity.

### TSS Formula

```
TSS = (duration_hours × intensity_factor² × 100)
```

Where:
```
intensity_factor = normalized_power / FTP
```

### TSS Benchmarks

| TSS | Duration | Intensity | Example |
|-----|----------|-----------|---------|
| < 150 | Short | Low-Moderate | 1hr endurance ride |
| 150-300 | Medium | Moderate | 2hr tempo ride |
| 300-450 | Long | Hard | 3hr race or long intervals |
| > 450 | Very Long | Very Hard | Century ride, stage race |

### Weekly TSS Targets

Typical training volumes:
- **Recreational**: 200-400 TSS/week
- **Competitive**: 400-700 TSS/week
- **Professional**: 700-1200 TSS/week

### TSS Examples (from library)

| Workout | Duration | Intensity | TSS | TSS/hour |
|---------|----------|-----------|-----|----------|
| M.A.P Efforts | 42 min | VO2 Max | 75 | 107 |
| 30s x 4m intervals | 71 min | VO2 Max | 116 | 98 |
| Minute Monster | 74 min | VO2 Max | 128 | 104 |
| VO2 Max Booster | 46 min | VO2 Max | 77 | 100 |

**Note**: VO2 Max workouts have high TSS/hour (~100-120) due to intensity.

---

## Example: Complete Workout

Here's a fully annotated workout from the library:

```json
{
  // Unique identifier (snake_case)
  "id": "minute_monster_power",

  // Display name (shown to athlete)
  "name": "Minute Monster (Power)",

  // Detailed explanation (currently empty, to be added)
  "detailed_description": "",

  // Workout classification
  "type": "vo2max",

  // Difficulty level
  "intensity": "hard",

  // Suitable training phases
  "suitable_phases": ["Build", "Peak"],

  // Preferred weekdays
  "suitable_weekdays": ["Tuesday", "Wednesday", "Thursday"],

  // Workout structure (13 segments total)
  "segments": [
    // 1. Warmup
    {
      "type": "warmup",
      "duration_min": 5,
      "power_low_pct": 96,
      "power_high_pct": 98,
      "description": "Warm up"
    },

    // 2. First interval set: 30s/30s × 3
    {
      "type": "interval",
      "sets": 3,
      "work": {
        "duration_min": 0.5,  // 30 seconds
        "power_low_pct": 110,
        "power_high_pct": 112,
        "description": "Hard"
      },
      "recovery": {
        "duration_min": 0.5,  // 30 seconds
        "power_low_pct": 98,
        "power_high_pct": 101,
        "description": "Easy"
      }
    },

    // 3. Recovery period
    {
      "type": "recovery",
      "duration_min": 5,
      "power_low_pct": 98,
      "power_high_pct": 100,
      "description": "Recovery"
    },

    // 4. Second interval set: 60s/60s × 10
    {
      "type": "interval",
      "sets": 10,
      "work": {
        "duration_min": 1,
        "power_low_pct": 109,
        "power_high_pct": 110,
        "description": "Hard"
      },
      "recovery": {
        "duration_min": 1,
        "power_low_pct": 98,
        "power_high_pct": 100,
        "description": "Easy"
      }
    },

    // ... more segments ...

    // Final: Cooldown
    {
      "type": "cooldown",
      "duration_min": 10,
      "power_low_pct": 96,
      "power_high_pct": 98,
      "description": "Cool Down"
    }
  ],

  // Total duration (sum of all segments)
  "base_duration_min": 74,

  // Training Stress Score
  "base_tss": 128,

  // Adjustable parameters (can increase/decrease sets)
  "variable_components": {
    "adjustable_field": "sets",
    "min_value": 2,
    "max_value": 15,
    "tss_per_unit": 4.2,
    "duration_per_unit_min": 2
  },

  // Source tracking
  "source_file": "2025-11-04_MinuteMons.fit",
  "source_format": "fit"
}
```

---

## Usage in Code

### Loading the Library

```python
import json
from pathlib import Path

library_path = Path("data/workout_library.json")
with open(library_path) as f:
    library = json.load(f)

workouts = library["workouts"]
```

### Filtering Workouts

```python
# Get all VO2 Max workouts
vo2_workouts = [w for w in workouts if w["type"] == "vo2max"]

# Get hard workouts suitable for Build phase
build_hard = [
    w for w in workouts
    if "Build" in w["suitable_phases"] and w["intensity"] == "hard"
]

# Get workouts under 60 minutes
short_workouts = [
    w for w in workouts
    if w["base_duration_min"] < 60
]
```

### Selecting a Workout

```python
# Get workout by ID
workout = next(w for w in workouts if w["id"] == "minute_monster_power")

print(f"Name: {workout['name']}")
print(f"Duration: {workout['base_duration_min']} min")
print(f"TSS: {workout['base_tss']}")
print(f"Segments: {len(workout['segments'])}")
```

### Adjusting Workout Duration

```python
workout = workouts[0]
if workout.get("variable_components"):
    vc = workout["variable_components"]

    if vc["adjustable_field"] == "sets":
        # Increase from 5 to 7 sets
        current_sets = 5
        new_sets = 7
        sets_added = new_sets - current_sets

        # Calculate new values
        new_duration = workout["base_duration_min"] + (sets_added * vc["duration_per_unit_min"])
        new_tss = workout["base_tss"] + (sets_added * vc["tss_per_unit"])

        print(f"New duration: {new_duration} min")
        print(f"New TSS: {new_tss}")
```

### Converting Power to Watts

```python
athlete_ftp = 260  # watts

for segment in workout["segments"]:
    if segment["type"] != "interval":
        power_low = (segment["power_low_pct"] / 100) * athlete_ftp
        power_high = (segment["power_high_pct"] / 100) * athlete_ftp

        print(f"{segment['type']}: {power_low:.0f}-{power_high:.0f}W")
    else:
        work_low = (segment["work"]["power_low_pct"] / 100) * athlete_ftp
        work_high = (segment["work"]["power_high_pct"] / 100) * athlete_ftp

        print(f"Work: {work_low:.0f}-{work_high:.0f}W × {segment['sets']} sets")
```

---

## Validation Rules

### Required Fields
- Every workout MUST have: `id`, `name`, `type`, `intensity`, `segments`, `base_duration_min`, `base_tss`
- Every segment MUST have: `type`, `duration_min`, `power_low_pct`, `power_high_pct`, `description`
- Interval segments MUST have: `sets`, `work`

### Value Constraints
- `power_low_pct`: 0-200 (typically 40-150)
- `power_high_pct`: 0-200, must be ≥ `power_low_pct`
- `duration_min`: > 0
- `base_duration_min`: Must equal sum of segment durations
- `sets`: ≥ 1 (for interval segments)

### Logical Constraints
- `base_duration_min` should match calculated duration from segments
- `base_tss` should be reasonable for duration/intensity
- `suitable_phases` should align with workout type
- `intensity` should match workout type (vo2max/threshold = hard)

---

## Future Enhancements

### Planned Additions

1. **More Workout Types**
   - Threshold workouts (2x20, 3x12, continuous)
   - Sweet Spot workouts (3x15)
   - Tempo workouts (60-90min steady)
   - Endurance rides (2-4 hours)
   - Recovery rides (30-60min easy)

2. **Richer Metadata**
   - Equipment requirements (indoor/outdoor/both)
   - Difficulty rating (1-10)
   - Prerequisites (requires FTP test, requires X fitness level)
   - Tags (intervals, climbing, sprints, etc.)

3. **Enhanced Descriptions**
   - Fill in all `detailed_description` fields
   - Add coaching cues
   - Add execution tips

4. **Progression Variants**
   - Beginner/Intermediate/Advanced versions
   - Progressive overload tracks

5. **Cadence Targets**
   - Add `cadence_rpm` fields to segments
   - Cadence ranges for specific drills

---

## Version History

### Version 1.0.0 (2025-11-02)
- Initial release
- 4 VO2 Max workouts from FIT files
- Basic schema with segments, power, duration, TSS
- Variable components for workout adjustment

---

**For Questions or Contributions**:
See `docs/WORKOUT_LIBRARY_CREATED.md` for usage examples and `plans/WORKOUT_LIBRARY_REFACTOR.md` for architecture details.
