# Workout Library Created from FIT Files

**Date**: 2025-11-02
**Status**: ✅ Complete
**Location**: `data/workout_library.json`

---

## Summary

Successfully created the initial workout library by parsing 4 FIT workout files from `.claude/fit_samples/`. The library contains professional-grade VO2 Max workouts that can be used as a foundation for the training plan refactor.

---

## Workout Library Details

**File**: `data/workout_library.json`
**Size**: 16KB (612 lines)
**Format**: JSON
**Version**: 1.0.0

### Metadata
```json
{
  "version": "1.0.0",
  "description": "Workout library for cycling training plans",
  "ftp_reference": 1150,
  "metadata": {
    "total_workouts": 4,
    "source": "FIT files from .claude/fit_samples/",
    "created_by": "create_workout_library.py"
  }
}
```

---

## Included Workouts

### 1. M.A.P Efforts (`map_efforts`)
- **Type**: VO2 Max
- **Intensity**: Hard
- **Duration**: 42 minutes
- **TSS**: 75
- **Segments**: 9
- **Structure**:
  - 10min warmup
  - 2 sets of intervals (varying durations)
  - 8min cooldown

### 2. 30s x 4m Interval Repeats (`30_s_x_4m_interval_repeats`)
- **Type**: VO2 Max
- **Intensity**: Hard
- **Duration**: 71 minutes
- **TSS**: 116
- **Segments**: 13
- **Structure**:
  - Warmup
  - 30-second hard / 4-minute recovery repeats
  - Multiple interval sets
  - Cooldown

### 3. Minute Monster (`minute_monster_power`)
- **Type**: VO2 Max
- **Intensity**: Hard
- **Duration**: 74 minutes
- **TSS**: 128
- **Segments**: 13
- **Structure**:
  - 5min warmup
  - 30s/30s intervals (3 sets)
  - 5min recovery
  - 60s/60s intervals (10 sets each)
  - 10min cooldown

### 4. VO2 Max Booster (`vo2_max_booster_6_x_30_15_3_repeats`)
- **Type**: VO2 Max
- **Intensity**: Hard
- **Duration**: 46 minutes
- **TSS**: 77
- **Segments**: 22
- **Structure**:
  - Warmup
  - 6 x (30s on / 15s off) repeats x 3 sets
  - Recovery periods between sets
  - Cooldown

---

## Power Zones Used

All workouts use realistic power percentages (calculated from FTP=1150W):

| Zone | % FTP | Description |
|------|-------|-------------|
| Recovery | 96-101% | Active recovery / warmup |
| Work | 107-112% | VO2 Max intensity |
| Hard Efforts | 109-112% | Peak intervals |

**Note**: These percentages will be recalculated when workouts are assigned to athletes based on their individual FTP.

---

## Workout Characteristics

### All Workouts Are:
- ✅ **VO2 Max focused** - High-intensity interval training
- ✅ **Hard intensity** - Suitable for Build and Peak phases
- ✅ **Structured intervals** - Clear work/recovery patterns
- ✅ **Complete segments** - Warmup, work, recovery, cooldown
- ✅ **Power-based** - Use % FTP for targeting

### Suitable For:
- **Training Phases**: Build, Peak
- **Weekdays**: Tuesday, Wednesday, Thursday (mid-week hard sessions)
- **Fitness Level**: Intermediate to Advanced cyclists
- **Equipment**: Indoor trainer or outdoor with power meter

---

## Schema Structure

Each workout in the library contains:

```json
{
  "id": "string",                    // Unique workout identifier
  "name": "string",                  // Human-readable name
  "detailed_description": "string",  // Empty (to be added manually)
  "type": "string",                  // vo2max, threshold, sweet_spot, etc.
  "intensity": "string",             // hard, easy
  "suitable_phases": ["string"],     // Build, Peak, Foundation, etc.
  "suitable_weekdays": ["string"],   // Preferred weekdays
  "segments": [                      // Array of workout segments
    {
      "type": "string",              // warmup, interval, recovery, cooldown
      "duration_min": number,        // Duration in minutes
      "power_low_pct": number,       // Lower power target (% FTP)
      "power_high_pct": number,      // Upper power target (% FTP)
      "description": "string",       // Segment description

      // For interval segments only:
      "sets": number,                // Number of repetitions
      "work": { ... },              // Work interval details
      "recovery": { ... }           // Recovery interval details
    }
  ],
  "base_duration_min": number,       // Total workout duration
  "base_tss": number,                // Training Stress Score
  "variable_components": {           // Adjustable parameters
    "adjustable_field": "string",    // "sets" or "duration"
    "min_value": number,
    "max_value": number
  },
  "source_file": "string",           // Original FIT filename
  "source_format": "fit"             // Source format
}
```

---

## Next Steps

### Immediate Next Steps:
1. ✅ **Workout Library Created** (this document)
2. ⏭️ **Implement WorkoutSelector** - Code to select workouts from library
3. ⏭️ **Update Training Plan Tools** - Use WorkoutSelector instead of LLM generation

### Future Enhancements:

#### 1. Add More Workout Types
Currently only VO2 Max workouts. Need to add:
- Threshold intervals (2x20, 3x15, continuous)
- Sweet Spot intervals (3x12-15min)
- Tempo workouts (60-90min steady)
- Endurance rides (2-4 hours Z2)
- Recovery rides (30-60min easy)

#### 2. Add Detailed Descriptions
All workouts have empty `detailed_description` fields. Add:
- Physiological target (what system this trains)
- Training benefits (performance improvements)
- Execution guidance (how to perform effectively)
- Environment recommendation (indoor/outdoor)

Example:
```
"Ideally perform this on your trainer, although outdoors works fine too.
Short interval HIIT is an effective means of enhancing your maximal oxygen
uptake (VO2max) and performance. The workout uses short bouts of work above
your pVO2max, with passive relief periods, to enable recruitment of your
larger fast twitch muscles..."
```

#### 3. Create More FIT Files
- Parse more workout files from TrainingPeaks, Garmin Connect, etc.
- Import workouts from popular training plans
- Build library to 20-30 core workouts

#### 4. Add Workout Variants
- Same workout type with different durations
- Same workout type with different intensities
- Progressive versions (beginner → advanced)

#### 5. Manual Workout Creation
- Create JSON workout definitions manually
- No need to parse from FIT (can be tedious for simple workouts)
- Example: Basic endurance ride doesn't need FIT parsing

---

## Usage Example

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

# Get workout suitable for Build phase
build_workouts = [
    w for w in library['workouts']
    if 'Build' in w['suitable_phases']
]

# Get a specific workout
minute_monster = next(
    w for w in library['workouts']
    if w['id'] == 'minute_monster_power'
)

print(f"Name: {minute_monster['name']}")
print(f"Duration: {minute_monster['base_duration_min']} min")
print(f"TSS: {minute_monster['base_tss']}")
print(f"Segments: {len(minute_monster['segments'])}")
```

---

## Technical Notes

### FTP Reference
- Library uses FTP=1150W (from source FIT files)
- Power percentages are relative (e.g., 96% FTP)
- When assigning to athletes, recalculate watts based on their FTP
- Example: Athlete with FTP=260W → 96% = 250W

### TSS Calculation
TSS values in library are calculated using:
```
TSS = (duration_hours × intensity_factor² × 100)
```

Where intensity_factor is derived from power percentages:
- Warmup (96-98% FTP): IF ≈ 0.97
- VO2 Max (107-112% FTP): IF ≈ 1.10
- Recovery (96-101% FTP): IF ≈ 0.98

### Variable Components
Most workouts have `variable_components` defined:
- **Adjustable sets**: Can increase/decrease interval repetitions
- **Adjustable duration**: Can extend/shorten workout

This allows WorkoutSelector to adjust workouts to fit weekly TSS targets.

---

## Files Created

1. **`data/workout_library.json`** - The workout library
2. **`scripts/create_workout_library.py`** - Generator script
3. **`docs/WORKOUT_LIBRARY_CREATED.md`** - This documentation

---

## Conclusion

✅ **Workout library successfully created** from FIT files using the FIT parser.

The library provides a solid foundation of 4 high-quality VO2 Max workouts. While this is a small library, it's sufficient to:
- Test the WorkoutSelector implementation
- Validate the training plan refactor concept
- Demonstrate the workflow

Next step: **Implement WorkoutSelector** to programmatically select and adjust workouts from this library based on training plan requirements.

---

**Created**: 2025-11-02
**Tool**: FIT Workout Parser
**Source**: 4 FIT files from `.claude/fit_samples/`
**Status**: Ready for use
