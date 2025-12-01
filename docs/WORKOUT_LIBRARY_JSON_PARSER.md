# Workout Library Created from JSON Files

**Date**: 2025-11-02
**Status**: ✅ Complete
**Location**: `data/workout_library.json`
**Source**: 222 JSON workout files

---

## Summary

Successfully created a comprehensive workout library by parsing 222 JSON workout files from `fit-crawler/workout_library/`. This replaces the initial 4-workout library that was created from FIT files.

---

## Workout Library Statistics

**File**: `data/workout_library.json`
**Size**: 425KB
**Format**: JSON
**Version**: 1.0.0
**Total Workouts**: 222

### Workout Distribution

**By Type:**
- Endurance: 104 workouts (47%)
- Threshold: 81 workouts (36%)
- Recovery: 11 workouts (5%)
- Mixed: 11 workouts (5%)
- Tempo: 8 workouts (4%)
- VO2 Max: 5 workouts (2%)
- Sweet Spot: 2 workouts (1%)

**By Intensity:**
- Easy: 126 workouts (57%)
- Hard: 96 workouts (43%)

**Duration Range:**
- Minimum: 39 minutes
- Maximum: 300 minutes (5 hours)
- Average: 89 minutes

**TSS Range:**
- Minimum: 19 TSS
- Maximum: 214 TSS
- Average: 69 TSS

---

## JSON Workout Format

The source JSON files follow this structure:

```json
{
  "title": "Workout Name",
  "description": "Detailed coaching instructions...",
  "userTags": "Cycling,CyclingVirtualActivity,Virtual",
  "workout_structure": [
    {
      "type": "step",
      "length": {"unit": "repetition", "value": 1},
      "steps": [
        {
          "intensityClass": "warmUp",
          "length": {"unit": "second", "value": 600},
          "targets": [{"minValue": 50, "maxValue": 65}],
          "name": "Warmup"
        }
      ]
    },
    {
      "type": "repetition",
      "length": {"unit": "repetition", "value": 5},
      "steps": [
        {
          "intensityClass": "active",
          "length": {"unit": "second", "value": 40},
          "targets": [{"minValue": 115, "maxValue": 130}],
          "name": "Hard effort"
        },
        {
          "intensityClass": "rest",
          "length": {"unit": "second", "value": 20},
          "targets": [{"minValue": 42.5}],
          "name": "Rest"
        }
      ]
    }
  ],
  "coachComments": null
}
```

### Key Advantages

1. **Direct % FTP values** - No conversion needed from watts
2. **Rich descriptions** - Already includes detailed coaching notes
3. **Large library** - 222 workouts vs 4 from FIT files
4. **Variety** - Covers all workout types and intensities
5. **Clean structure** - Clear hierarchy of repetitions and steps

---

## Parser Implementation

**File**: `src/cycling_ai/parsers/json_workout_parser.py`

### Key Features

- **Automatic type inference** - Determines workout type from title/description
- **Intensity classification** - Maps to "hard" or "easy"
- **Segment conversion** - Converts JSON structure to our library schema
- **TSS calculation** - Estimates Training Stress Score
- **Variable components** - Identifies adjustable parameters (sets/duration)
- **Phase/weekday inference** - Suggests suitable training phases and days

### Mapping Rules

**Intensity Class → Segment Type:**
- `warmUp` → `warmup`
- `coolDown` → `cooldown`
- `active` → `steady` (or `work` if in repetition)
- `rest` → `recovery`

**Workout Structure Type:**
- `step` → Simple segment
- `repetition` → Interval segment with sets

**Workout Type Inference:**
- Searches for keywords in title/description/tags
- Examples: "VO2", "threshold", "FTP", "endurance", "recovery"
- Falls back to "mixed" if no clear type identified

---

## Sample Workouts

### 1. Endurance Workout

```json
{
  "id": "aerobic_endurance_ride",
  "name": "Aerobic Endurance Ride",
  "detailed_description": "Ride mainly in Z2 today. You should be able to maintain conversation at this intensity.",
  "type": "endurance",
  "intensity": "easy",
  "base_duration_min": 180,
  "base_tss": 128.7,
  "segments": [
    {
      "type": "steady",
      "duration_min": 180,
      "power_low_pct": 56,
      "power_high_pct": 75,
      "description": "Active"
    }
  ]
}
```

### 2. VO2 Max Intervals

```json
{
  "id": "4020s_5min",
  "name": "40/20s (5min)",
  "detailed_description": "Aim is to accumulate a decent amount of time in and above zone 5...",
  "type": "vo2max",
  "intensity": "hard",
  "base_duration_min": 58,
  "base_tss": 47.3,
  "segments": [
    {
      "type": "warmup",
      "duration_min": 10,
      "power_low_pct": 50,
      "power_high_pct": 65
    },
    {
      "type": "interval",
      "sets": 5,
      "work": {
        "duration_min": 0.67,
        "power_low_pct": 115,
        "power_high_pct": 130,
        "description": "40s hard"
      },
      "recovery": {
        "duration_min": 0.33,
        "power_low_pct": 42,
        "power_high_pct": 42,
        "description": "Rest"
      }
    },
    {
      "type": "cooldown",
      "duration_min": 5,
      "power_low_pct": 50,
      "power_high_pct": 60
    }
  ]
}
```

### 3. Threshold Workout

```json
{
  "id": "cardio_drift_test",
  "name": "Cardio Drift Test",
  "detailed_description": "You need a power meter for this test. Ride for one hour at ~70% of your threshold...",
  "type": "threshold",
  "intensity": "hard",
  "base_duration_min": 70,
  "base_tss": 52.6,
  "segments": [
    {
      "type": "warmup",
      "duration_min": 5,
      "power_low_pct": 45,
      "power_high_pct": 55
    },
    {
      "type": "steady",
      "duration_min": 60,
      "power_low_pct": 70,
      "power_high_pct": 70
    },
    {
      "type": "cooldown",
      "duration_min": 5,
      "power_low_pct": 45,
      "power_high_pct": 55
    }
  ]
}
```

---

## Test Results

**Test File**: `tests/parsers/test_json_workout_parser.py`
**Tests**: 19/19 passing
**Coverage**: 86%

### Test Coverage

- ✅ Parser initialization
- ✅ ID generation from titles
- ✅ Workout type inference (VO2max, threshold, endurance, etc.)
- ✅ Intensity inference (hard/easy)
- ✅ Simple workout parsing
- ✅ Interval workout parsing
- ✅ Duration calculation
- ✅ TSS calculation (simple and intervals)
- ✅ Suitable phase inference
- ✅ Suitable weekday inference
- ✅ Error handling (missing files, missing fields)
- ✅ Variable components identification

---

## Usage

### Generate Workout Library

```bash
# Default: Uses fit-crawler directory
PYTHONPATH=src .venv/bin/python3 scripts/create_workout_library_from_json.py

# Custom directory
PYTHONPATH=src .venv/bin/python3 scripts/create_workout_library_from_json.py \
  --json-dir /path/to/workouts \
  --output data/workout_library.json
```

### Load in Python

```python
import json

# Load workout library
with open('data/workout_library.json') as f:
    library = json.load(f)

# Get all VO2 Max workouts
vo2_workouts = [
    w for w in library['workouts']
    if w['type'] == 'vo2max'
]

# Get endurance workouts suitable for weekends
weekend_endurance = [
    w for w in library['workouts']
    if w['type'] == 'endurance' and
    ('Saturday' in w['suitable_weekdays'] or 'Sunday' in w['suitable_weekdays'])
]

# Get a specific workout
cardio_drift = next(
    w for w in library['workouts']
    if w['id'] == 'cardio_drift_test'
)
```

---

## Comparison: FIT vs JSON Source

| Aspect | FIT Files | JSON Files |
|--------|-----------|------------|
| **Count** | 4 workouts | 222 workouts |
| **Coverage** | VO2 Max only | All types |
| **Power Format** | Watts + 1000 offset | Direct % FTP |
| **Descriptions** | Missing | Included |
| **Parsing Complexity** | High (binary format) | Low (JSON) |
| **Success Rate** | 100% (4/4) | 100% (222/222) |
| **Library Size** | 16KB | 425KB |

**Decision**: Use JSON files as primary source for workout library. Keep FIT parser for future use (importing user-created workouts from devices).

---

## Next Steps

### Immediate

1. ✅ **JSON Parser Created** - `src/cycling_ai/parsers/json_workout_parser.py`
2. ✅ **Tests Written** - 19 tests, 86% coverage
3. ✅ **Library Generated** - 222 workouts in `data/workout_library.json`
4. ⏭️ **Implement WorkoutSelector** - Select workouts from library based on plan requirements

### Future Enhancements

1. **Manual Curation**
   - Review workout types (some may be misclassified)
   - Add missing detailed descriptions where needed
   - Validate TSS calculations against known values

2. **Expand Library**
   - Add more recovery workouts (currently only 11)
   - Add more sprint/neuromuscular workouts
   - Create progressive versions (beginner → advanced)

3. **Metadata Enhancement**
   - Add equipment requirements (indoor/outdoor)
   - Add skill level (beginner/intermediate/advanced)
   - Add workout focus (aerobic capacity, power, endurance)

4. **Quality Validation**
   - Cross-check TSS values with TrainingPeaks
   - Verify power percentages align with Coggan zones
   - Ensure duration calculations are accurate

---

## Files Created

1. **`src/cycling_ai/parsers/json_workout_parser.py`** - JSON parser
2. **`tests/parsers/test_json_workout_parser.py`** - Test suite
3. **`scripts/create_workout_library_from_json.py`** - Library generator
4. **`data/workout_library.json`** - Generated library (222 workouts)
5. **`docs/WORKOUT_LIBRARY_JSON_PARSER.md`** - This documentation

---

## Conclusion

✅ **Successfully created comprehensive workout library** from 222 JSON files.

The library provides:
- **Diversity**: All workout types and intensities
- **Quality**: Detailed coaching descriptions included
- **Accuracy**: Direct % FTP values, no conversion needed
- **Size**: 55x larger than initial FIT-based library
- **Readiness**: Immediately usable for WorkoutSelector implementation

**Next Step**: Implement `WorkoutSelector` class to programmatically select and adjust workouts from this library based on training plan requirements.

---

**Created**: 2025-11-02
**Tool**: JSON Workout Parser
**Source**: 222 JSON files from fit-crawler
**Status**: Ready for use
