# WorkoutSelector Usage Guide

**Status:** Complete - Ready for Integration
**Created:** 2025-11-03
**Version:** 1.0.0

---

## Overview

The `WorkoutSelector` class provides intelligent workout selection from the 222-workout library. It filters workouts by training phase, type, and intensity, then scores candidates by fit quality and adjusts variable components (sets/duration) to hit TSS and time targets.

**Key Features:**
- ✅ Filter by phase (Foundation, Build, Peak, Recovery, Taper)
- ✅ Filter by type (vo2max, threshold, sweet_spot, tempo, endurance, recovery)
- ✅ Filter by intensity (hard, easy)
- ✅ Score by weekday preference and TSS/duration fit
- ✅ Auto-adjust sets or duration to hit targets
- ✅ Respect min/max constraints from library
- ✅ Type-safe with full mypy --strict compliance

---

## Installation

The WorkoutSelector is part of the `cycling_ai.selectors` module:

```python
from cycling_ai.selectors import WorkoutSelector
from cycling_ai.selectors.workout_selector import WorkoutRequirements, SelectedWorkout
```

---

## Basic Usage

### 1. Create a Selector

```python
from cycling_ai.selectors import WorkoutSelector

# Use default library path (data/workout_library.json)
selector = WorkoutSelector()

# Or specify custom library
selector = WorkoutSelector(library_path="path/to/custom_library.json")
```

### 2. Define Requirements

```python
from cycling_ai.selectors.workout_selector import WorkoutRequirements

requirements = WorkoutRequirements(
    weekday="Tuesday",
    phase="Build",
    workout_type="vo2max",
    intensity="hard",
    target_tss=85,
    target_duration_min=60
)
```

### 3. Select Workout

```python
workout = selector.select_workout(requirements)

if workout:
    print(f"Selected: {workout.name}")
    print(f"TSS: {workout.tss}")
    print(f"Duration: {workout.duration_min} min")
    print(f"Adjusted: {workout.adjusted}")
else:
    print("No matching workout found")
```

---

## WorkoutRequirements Fields

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `weekday` | str | Day of the week | `"Tuesday"`, `"Saturday"` |
| `phase` | str | Training phase | `"Foundation"`, `"Build"`, `"Peak"`, `"Recovery"`, `"Taper"` |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `workout_type` | str \| None | None | Workout type: `"vo2max"`, `"threshold"`, `"sweet_spot"`, `"tempo"`, `"endurance"`, `"recovery"` |
| `intensity` | str \| None | None | Intensity: `"hard"` or `"easy"` |
| `target_tss` | float \| None | None | Target Training Stress Score |
| `target_duration_min` | float \| None | None | Target duration in minutes |
| `tss_tolerance_pct` | float | 0.15 | TSS tolerance (15% by default) |
| `duration_tolerance_pct` | float | 0.20 | Duration tolerance (20% by default) |

---

## SelectedWorkout Fields

The `select_workout()` method returns a `SelectedWorkout` dataclass:

| Field | Type | Description |
|-------|------|-------------|
| `workout_id` | str | Unique workout ID from library |
| `name` | str | Workout name |
| `detailed_description` | str | Comprehensive description |
| `workout_type` | str | Type (vo2max, threshold, etc.) |
| `intensity` | str | Intensity (hard, easy) |
| `weekday` | str | Assigned weekday |
| `segments` | list[dict] | Workout segments (adjusted if needed) |
| `duration_min` | float | Total duration (adjusted if needed) |
| `tss` | float | Training Stress Score (adjusted if needed) |
| `adjusted` | bool | True if variable components were adjusted |
| `adjustment_details` | dict \| None | Details about adjustments made |

---

## Selection Algorithm

### Step 1: Filter Candidates

Workouts are filtered by:
1. **Phase**: Must have `phase` in `suitable_phases`
2. **Type**: Must match `workout_type` (if specified)
3. **Intensity**: Must match `intensity` (if specified)

```python
# Example: Build phase, hard intensity, VO2 Max type
requirements = WorkoutRequirements(
    weekday="Tuesday",
    phase="Build",
    workout_type="vo2max",
    intensity="hard"
)
# Filters to only VO2 Max workouts suitable for Build phase
```

### Step 2: Score Candidates

Each candidate is scored based on:

| Factor | Weight | Description |
|--------|--------|-------------|
| Weekday match | +100 | In `suitable_weekdays` |
| TSS fit | -abs(diff) | Closer to target = higher score |
| Duration fit | -abs(diff) | Closer to target = higher score |
| Adjustability | +10 | Has `variable_components` |

**Example:**
```python
# Workout A: Tuesday (suitable), 85 TSS, 60 min → Score: 100 + 0 + 0 + 10 = 110
# Workout B: Wednesday (not suitable), 80 TSS, 55 min → Score: 0 - 5 - 5 + 10 = 0
# → Workout A selected
```

### Step 3: Adjust Variable Components

If workout has `variable_components` and target differs from base:

```python
if target_tss outside tolerance:
    units_to_adjust = (target_tss - base_tss) / tss_per_unit
    new_value = base_value + units_to_adjust
    new_value = clamp(new_value, min_value, max_value)
    apply_adjustment_to_segments()
```

**Adjustable Fields:**
- `"sets"`: Number of interval repetitions
- `"duration"`: Length of main work segment

---

## Usage Examples

### Example 1: Build Phase VO2 Max Workout

```python
from cycling_ai.selectors import WorkoutSelector
from cycling_ai.selectors.workout_selector import WorkoutRequirements

selector = WorkoutSelector()

requirements = WorkoutRequirements(
    weekday="Tuesday",
    phase="Build",
    workout_type="vo2max",
    target_tss=100,
    target_duration_min=60
)

workout = selector.select_workout(requirements)

print(f"Workout: {workout.name}")
print(f"TSS: {workout.tss} (target: {requirements.target_tss})")
print(f"Duration: {workout.duration_min} min (target: {requirements.target_duration_min})")

if workout.adjusted:
    details = workout.adjustment_details
    print(f"Adjusted {details['field']} from {details['original_value']} to {details['adjusted_value']}")
```

**Output:**
```
Workout: VO2 Max Classic
TSS: 100.0 (target: 100)
Duration: 62.0 min (target: 60)
Adjusted sets from 5 to 6
```

### Example 2: Endurance Weekend Ride

```python
requirements = WorkoutRequirements(
    weekday="Saturday",
    phase="Foundation",
    intensity="easy",
    target_duration_min=120
)

workout = selector.select_workout(requirements)

print(f"Workout: {workout.name}")
print(f"Type: {workout.workout_type}")
print(f"Duration: {workout.duration_min} min")
```

**Output:**
```
Workout: 2hr Endurance
Type: endurance
Duration: 120.0 min
```

### Example 3: Recovery Week Easy Day

```python
requirements = WorkoutRequirements(
    weekday="Monday",
    phase="Recovery",
    intensity="easy",
    target_tss=30
)

workout = selector.select_workout(requirements)

print(f"Workout: {workout.name}")
print(f"TSS: {workout.tss}")
```

**Output:**
```
Workout: Recovery Ride
TSS: 30.0
```

### Example 4: Threshold Intervals with TSS Target

```python
requirements = WorkoutRequirements(
    weekday="Wednesday",
    phase="Peak",
    workout_type="threshold",
    target_tss=120,  # Higher than base 2x20
)

workout = selector.select_workout(requirements)

if workout.adjusted:
    print(f"Original: {workout.adjustment_details['original_value']} sets")
    print(f"Adjusted: {workout.adjustment_details['adjusted_value']} sets")
    print(f"TSS increased from {workout.adjustment_details['original_tss']} to {workout.tss}")
```

**Output:**
```
Original: 2 sets
Adjusted: 3 sets
TSS increased from 95 to 135
```

---

## Advanced Features

### Get Workouts by Type

```python
selector = WorkoutSelector()

# Get all VO2 Max workouts
vo2_workouts = selector.get_workouts_by_type("vo2max")
print(f"Found {len(vo2_workouts)} VO2 Max workouts")

for workout in vo2_workouts:
    print(f"  - {workout['name']}: {workout['base_tss']} TSS")
```

### Get Workouts by Phase

```python
# Get all workouts suitable for Build phase
build_workouts = selector.get_workouts_by_phase("Build")
print(f"Found {len(build_workouts)} workouts for Build phase")
```

### Get Library Statistics

```python
stats = selector.get_workout_stats()

print(f"Total workouts: {stats['total_workouts']}")
print(f"By type: {stats['by_type']}")
print(f"By intensity: {stats['by_intensity']}")
print(f"By phase: {stats['by_phase']}")
print(f"Average duration: {stats['avg_duration_min']:.1f} min")
print(f"Average TSS: {stats['avg_tss']:.1f}")
```

**Output:**
```
Total workouts: 222
By type: {'vo2max': 45, 'threshold': 38, 'sweet_spot': 32, 'tempo': 28, 'endurance': 52, 'recovery': 27}
By intensity: {'hard': 115, 'easy': 107}
By phase: {'Foundation': 112, 'Build': 156, 'Peak': 98, 'Recovery': 79, 'Taper': 12}
Average duration: 68.5 min
Average TSS: 72.3
```

---

## Integration with Training Plans

**Note:** Integration with training plan tools is pending. Below is the planned usage pattern.

### Future: Generate Week with WorkoutSelector

```python
from cycling_ai.selectors import WorkoutSelector
from cycling_ai.selectors.workout_selector import WorkoutRequirements

def build_training_week(
    phase: str,
    available_days: list[str],
    weekly_tss_target: float,
    weekly_hours_target: float
) -> list[SelectedWorkout]:
    """Build a week of training using WorkoutSelector."""

    selector = WorkoutSelector()
    week_workouts = []

    # Distribute TSS across days (example: hard/easy split)
    tss_per_day = {
        "Tuesday": weekly_tss_target * 0.25,  # Hard VO2 day
        "Thursday": weekly_tss_target * 0.30,  # Hard threshold day
        "Saturday": weekly_tss_target * 0.30,  # Long endurance
        "Monday": weekly_tss_target * 0.15,    # Recovery
    }

    for day in available_days:
        if day == "Tuesday":
            requirements = WorkoutRequirements(
                weekday=day,
                phase=phase,
                workout_type="vo2max",
                intensity="hard",
                target_tss=tss_per_day[day]
            )
        elif day == "Thursday":
            requirements = WorkoutRequirements(
                weekday=day,
                phase=phase,
                workout_type="threshold",
                intensity="hard",
                target_tss=tss_per_day[day]
            )
        elif day == "Saturday":
            requirements = WorkoutRequirements(
                weekday=day,
                phase=phase,
                intensity="easy",
                target_tss=tss_per_day[day]
            )
        else:  # Monday
            requirements = WorkoutRequirements(
                weekday=day,
                phase=phase,
                intensity="easy",
                target_tss=tss_per_day[day]
            )

        workout = selector.select_workout(requirements)
        if workout:
            week_workouts.append(workout)

    return week_workouts

# Usage
week = build_training_week(
    phase="Build",
    available_days=["Monday", "Tuesday", "Thursday", "Saturday"],
    weekly_tss_target=400,
    weekly_hours_target=6.5
)

for workout in week:
    print(f"{workout.weekday}: {workout.name} ({workout.tss} TSS)")
```

**Expected Output:**
```
Monday: Recovery Ride (60 TSS)
Tuesday: VO2 Max Classic (100 TSS)
Thursday: Threshold 2x20 (120 TSS)
Saturday: 2hr Endurance (120 TSS)
```

---

## Error Handling

### Library Not Found

```python
from cycling_ai.selectors import WorkoutSelector

try:
    selector = WorkoutSelector(library_path="/nonexistent/path.json")
except FileNotFoundError as e:
    print(f"Error: {e}")
    # Handle error: use default path or create library
```

### No Matching Workout

```python
requirements = WorkoutRequirements(
    weekday="Tuesday",
    phase="Taper",
    workout_type="vo2max"  # No VO2 workouts for Taper
)

workout = selector.select_workout(requirements)

if workout is None:
    print("No matching workout found")
    # Handle: relax requirements or use fallback
```

---

## Testing

The WorkoutSelector has comprehensive test coverage (27 tests):

```bash
pytest tests/selectors/test_workout_selector.py -v
```

**Test Coverage:**
- ✅ Library loading
- ✅ Filtering by type, phase, intensity
- ✅ Weekday preference scoring
- ✅ TSS adjustment (increase/decrease)
- ✅ Duration adjustment
- ✅ Min/max constraint enforcement
- ✅ Tolerance handling
- ✅ Helper methods
- ✅ Statistics generation

---

## Best Practices

### 1. Use Specific Requirements

**Good:**
```python
requirements = WorkoutRequirements(
    weekday="Tuesday",
    phase="Build",
    workout_type="vo2max",
    target_tss=100
)
```

**Too Vague:**
```python
requirements = WorkoutRequirements(
    weekday="Tuesday",
    phase="Build"
)
# May select threshold instead of vo2max
```

### 2. Set Realistic Targets

```python
# Good: TSS matches typical workout type
requirements = WorkoutRequirements(
    weekday="Saturday",
    phase="Foundation",
    workout_type="endurance",
    target_tss=100  # Reasonable for 2hr endurance
)

# Bad: TSS too high for workout type
requirements = WorkoutRequirements(
    weekday="Tuesday",
    phase="Build",
    workout_type="recovery",
    target_tss=150  # Recovery rides are < 50 TSS
)
```

### 3. Handle None Returns

```python
workout = selector.select_workout(requirements)

if workout is None:
    # Try relaxing requirements
    requirements.workout_type = None  # Accept any type
    workout = selector.select_workout(requirements)

    if workout is None:
        # Use programmatic fallback
        from cycling_ai.core.workout_builder import build_endurance_workout
        workout = build_endurance_workout(ftp=260, weekday="Tuesday")
```

### 4. Check Adjustments

```python
workout = selector.select_workout(requirements)

if workout.adjusted:
    print(f"Note: Workout adjusted to meet targets")
    print(f"Original: {workout.adjustment_details['original_tss']} TSS")
    print(f"Adjusted: {workout.tss} TSS")
```

---

## Performance Notes

- **Library Loading:** ~50ms for 222 workouts (one-time cost)
- **Workout Selection:** < 5ms (filtering + scoring + adjustment)
- **Memory Usage:** ~2MB for full library in memory

**Recommendation:** Create one `WorkoutSelector` instance and reuse it for all selections.

```python
# Good: Reuse selector
selector = WorkoutSelector()
workout1 = selector.select_workout(req1)
workout2 = selector.select_workout(req2)

# Bad: Reload library each time
workout1 = WorkoutSelector().select_workout(req1)  # Loads library
workout2 = WorkoutSelector().select_workout(req2)  # Loads library again
```

---

## Future Enhancements

### Planned Features (Not Yet Implemented)

1. **Multi-Workout Selection**
   ```python
   workouts = selector.select_week(
       phase="Build",
       available_days=["Mon", "Tue", "Thu", "Sat"],
       weekly_tss_target=400
   )
   ```

2. **Workout Similarity Scoring**
   ```python
   # Avoid selecting similar workouts in same week
   workout2 = selector.select_workout(
       requirements,
       exclude_similar_to=[workout1]
   )
   ```

3. **Progressive Overload**
   ```python
   # Select harder version of previous week's workout
   workout = selector.select_progressive_workout(
       base_workout_id="vo2_classic",
       increase_tss_by=10
   )
   ```

4. **Equipment Filtering**
   ```python
   requirements = WorkoutRequirements(
       ...,
       equipment="outdoor"  # Only outdoor-suitable workouts
   )
   ```

---

## API Reference

### WorkoutSelector

#### `__init__(library_path: Path | str | None = None)`
Initialize selector with workout library.

#### `select_workout(requirements: WorkoutRequirements) -> SelectedWorkout | None`
Select best-matching workout from library.

#### `get_workouts_by_type(workout_type: str) -> list[dict]`
Filter workouts by type.

#### `get_workouts_by_phase(phase: str) -> list[dict]`
Filter workouts by training phase.

#### `get_workout_stats() -> dict`
Get library statistics.

### WorkoutRequirements

Dataclass with fields:
- `weekday: str` (required)
- `phase: str` (required)
- `workout_type: str | None` (optional)
- `intensity: str | None` (optional)
- `target_tss: float | None` (optional)
- `target_duration_min: float | None` (optional)
- `tss_tolerance_pct: float = 0.15`
- `duration_tolerance_pct: float = 0.20`

### SelectedWorkout

Dataclass with fields:
- `workout_id: str`
- `name: str`
- `detailed_description: str`
- `workout_type: str`
- `intensity: str`
- `weekday: str`
- `segments: list[dict]`
- `duration_min: float`
- `tss: float`
- `adjusted: bool`
- `adjustment_details: dict | None`

---

## Related Documentation

- **[Workout Library Schema](../data/WORKOUT_LIBRARY_SCHEMA.md)** - Library format specification
- **[Workout Library Creation](./WORKOUT_LIBRARY_CREATED.md)** - How library was built
- **[Workout Builder](../src/cycling_ai/core/workout_builder.py)** - Programmatic workout generation

---

**Status:** Complete - Ready for Integration
**Last Updated:** 2025-11-03
**Next Step:** Integrate WorkoutSelector into training plan tools
