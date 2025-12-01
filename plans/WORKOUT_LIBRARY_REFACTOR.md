# Training Plan Refactor: Workout Library System

**Status**: Planning
**Date**: 2025-11-02

---

## Overview

Refactor training plan generation from **LLM-generated workouts** to **code-based workout selection from a pre-built library**.

### Current System (Before)
```
Phase 1: create_plan_overview (LLM)
  → weekly overview (phases, TSS, training_days)

Phase 2: add_week_details (LLM, called 12x)
  → LLM generates workouts from scratch
  → Creates segments, durations, power targets
  → Validates against targets
  → Retry loop if validation fails

Phase 3: finalize_plan
  → Assembles and saves
```

**Problems**:
- LLM creates inconsistent workouts
- 13 LLM calls (expensive, slow)
- Validation errors require retries
- No workout reusability
- Hard to ensure quality

### New System (After)
```
Phase 1: create_plan_overview (LLM, 1 call)
  → weekly overview (phases, TSS, training_days, hard/easy distribution)

Phase 2: finalize_plan (Pure Python)
  → WorkoutSelector reads weekly_overview
  → Selects workouts from library based on phase/intensity
  → Adjusts durations to hit TSS/time targets
  → Assembles and saves complete plan
```

**Benefits**:
✅ Deterministic (same inputs → same workouts)
✅ Faster (1 LLM call instead of 13)
✅ Cheaper (90% reduction in LLM costs)
✅ Testable (pure Python logic)
✅ Consistent (proven workout structures)
✅ Maintainable (update library in one place)

---

## Architecture

### Components

#### 1. Workout Library (`data/workout_library.json`)
Pre-built catalog of proven workouts with:
- Fixed structure (intervals, power zones)
- Variable components (duration, sets)
- Metadata (type, intensity, suitable phases)

#### 2. WorkoutSelector (`src/cycling_ai/core/workout_selector.py`)
Pure Python class that:
- Reads workout library
- Matches workouts to week requirements
- Adjusts durations to hit targets
- Returns complete weekly schedule

#### 3. Updated Tools
- `create_plan_overview`: Same (LLM creates strategic overview)
- `finalize_plan`: Updated (uses WorkoutSelector instead of expecting LLM-generated weeks)
- ~~`add_week_details`~~: Removed (no longer needed)

---

## Workout Library Schema

### Workout Object Structure

```json
{
  "id": "vo2max_classic",
  "name": "VO2 Max intervals",
  "detailed_description": "Ideally perform this on your trainer...",
  "type": "vo2max",
  "intensity": "hard",
  "suitable_phases": ["Build", "Peak"],
  "suitable_weekdays": ["Tuesday", "Wednesday", "Thursday"],
  "base_structure": {
    "warmup": {
      "type": "warmup",
      "duration_min": 15,
      "power_low_pct": 50,
      "power_high_pct": 65,
      "description": "Easy spin"
    },
    "main_set": {
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
    "cooldown": {
      "type": "cooldown",
      "duration_min": 10,
      "power_low_pct": 50,
      "power_high_pct": 55,
      "description": "Cool down"
    }
  },
  "variable_components": {
    "adjustable_field": "sets",
    "min_value": 4,
    "max_value": 8,
    "tss_per_unit": 17
  },
  "base_duration_min": 55,
  "base_tss": 85,
  "tss_calculation": "fixed"
}
```

### Workout Types to Include

**Hard Workouts** (intensity = "hard"):
1. `vo2max_classic` - 3min intervals @ 110-120% FTP
2. `vo2max_short` - 2min intervals @ 115-125% FTP
3. `threshold_intervals` - 2x20min @ 95-105% FTP
4. `threshold_continuous` - 40-60min @ 90-95% FTP
5. `sweet_spot_intervals` - 3x15min @ 88-93% FTP

**Easy Workouts** (intensity = "easy"):
6. `endurance_z2` - Variable duration @ 56-75% FTP
7. `tempo_steady` - 60-90min @ 76-85% FTP
8. `recovery_spin` - 30-60min @ 40-55% FTP
9. `sweet_spot_endurance` - Mix of sweet spot + Z2

**Flexible duration workouts**:
- `endurance_z2`: 60-180 min (fully variable)
- `recovery_spin`: 30-90 min (fully variable)

**Fixed structure with variable sets**:
- `vo2max_classic`: 4-8 sets (adjust sets to hit TSS)
- `threshold_intervals`: 1-3 sets (adjust repetitions)

---

## WorkoutSelector Algorithm

### Phase-Based Selection Logic

```python
WORKOUT_MATRIX = {
    "Foundation": {
        "hard": ["tempo_steady", "sweet_spot_intervals"],
        "easy": ["endurance_z2", "recovery_spin"]
    },
    "Build": {
        "hard": ["threshold_intervals", "vo2max_classic", "sweet_spot_intervals"],
        "easy": ["endurance_z2", "tempo_steady"]
    },
    "Recovery": {
        "hard": ["tempo_steady"],  # "Hard" during recovery = tempo max
        "easy": ["endurance_z2", "recovery_spin"]
    },
    "Peak": {
        "hard": ["vo2max_classic", "vo2max_short", "threshold_continuous"],
        "easy": ["endurance_z2", "recovery_spin"]
    },
    "Taper": {
        "hard": ["vo2max_short"],  # Short, sharp efforts
        "easy": ["recovery_spin"]
    }
}
```

### Selection Algorithm (Pseudocode)

```python
def assign_workouts(week_overview, workout_library):
    phase = week_overview["phase"]
    training_days = week_overview["training_days"]
    hard_days = week_overview["hard_days"]
    easy_days = week_overview["easy_days"]
    target_tss = week_overview["target_tss"]
    target_hours = week_overview["total_hours"]

    # Get available workouts for this phase
    hard_pool = WORKOUT_MATRIX[phase]["hard"]
    easy_pool = WORKOUT_MATRIX[phase]["easy"]

    # Assign hard workouts to weekends (if available) for longer sessions
    hard_workout_days = prioritize_weekends(training_days, hard_days)
    easy_workout_days = [d for d in training_days if d not in hard_workout_days]

    # Select workouts
    selected_workouts = []
    for day in hard_workout_days:
        workout = select_from_pool(hard_pool, day, week_overview)
        selected_workouts.append((day, workout))

    for day in easy_workout_days:
        workout = select_from_pool(easy_pool, day, week_overview)
        selected_workouts.append((day, workout))

    # Adjust durations to hit targets
    adjusted_workouts = adjust_durations(
        selected_workouts,
        target_tss,
        target_hours,
        workout_library
    )

    return adjusted_workouts
```

### Duration Adjustment Algorithm

```python
def adjust_durations(workouts, target_tss, target_hours, library):
    """
    Adjust variable components to hit TSS and time targets.

    Priority:
    1. Adjust flexible duration workouts (endurance, recovery)
    2. Adjust interval sets (vo2max, threshold)
    3. Accept ±10% tolerance if exact match impossible
    """

    # Calculate current totals
    current_tss = sum(w.base_tss for w in workouts)
    current_hours = sum(w.base_duration_min for w in workouts) / 60

    # Calculate adjustments needed
    tss_gap = target_tss - current_tss
    time_gap = target_hours - current_hours

    # Adjust flexible workouts first (endurance, recovery)
    for workout in workouts:
        if workout.variable_components.adjustable_field == "duration":
            # Adjust duration to fill time_gap
            adjustment = calculate_duration_adjustment(workout, time_gap, tss_gap)
            workout.adjusted_duration = workout.base_duration_min + adjustment

    # Recalculate and adjust interval workouts if needed
    # ... (similar logic for sets-based adjustments)

    return workouts
```

---

## Implementation Plan

### Step 1: Create Workout Library
**File**: `data/workout_library.json`

**Tasks**:
- [ ] Define 8-10 core workouts (VO2, Threshold, Sweet Spot, Tempo, Endurance, Recovery)
- [ ] Include detailed descriptions (copy from existing workout_builder.py)
- [ ] Define variable components for each workout
- [ ] Calculate base TSS for each workout
- [ ] Validate JSON schema

**Deliverable**: `data/workout_library.json` with complete workout catalog

---

### Step 2: Implement WorkoutSelector
**File**: `src/cycling_ai/core/workout_selector.py`

**Classes**:
```python
@dataclass
class Workout:
    id: str
    name: str
    detailed_description: str
    type: str
    intensity: str
    base_structure: dict
    variable_components: dict
    base_duration_min: int
    base_tss: float

@dataclass
class WorkoutAssignment:
    weekday: str
    workout: Workout
    adjusted_duration_min: int
    adjusted_tss: float
    segments: list[dict]  # Final segment structure

class WorkoutSelector:
    def __init__(self, library_path: Path):
        self.library = self._load_library(library_path)

    def assign_weekly_workouts(
        self, week_overview: dict
    ) -> list[WorkoutAssignment]:
        """Main entry point for workout assignment."""
        pass

    def _select_workout(
        self, phase: str, intensity: str, weekday: str
    ) -> Workout:
        """Select appropriate workout from library."""
        pass

    def _adjust_workout_duration(
        self, workout: Workout, target_duration_min: int
    ) -> WorkoutAssignment:
        """Adjust workout duration to hit time target."""
        pass

    def _calculate_workout_tss(
        self, workout: Workout, duration_min: int, ftp: float
    ) -> float:
        """Calculate TSS for adjusted workout."""
        pass
```

**Tasks**:
- [ ] Implement library loading and validation
- [ ] Implement phase-based workout selection (WORKOUT_MATRIX)
- [ ] Implement duration adjustment algorithm
- [ ] Implement TSS calculation for adjusted workouts
- [ ] Write unit tests for all methods
- [ ] Test with various week scenarios

**Deliverable**: Fully tested `WorkoutSelector` class

---

### Step 3: Update finalize_plan Tool
**File**: `src/cycling_ai/tools/wrappers/training_plan_tool.py`

**Changes**:
```python
def execute(self, **kwargs):
    # Load overview from Phase 1
    overview_data = load_overview(plan_id)

    # NEW: Use WorkoutSelector instead of reading LLM-generated weeks
    selector = WorkoutSelector(library_path="data/workout_library.json")

    complete_plan = {
        "weeks": []
    }

    for week_overview in overview_data["weekly_overview"]:
        # Code selects and adjusts workouts
        workouts = selector.assign_weekly_workouts(
            week_overview=week_overview,
            ftp=overview_data["target_ftp"]
        )

        complete_plan["weeks"].append({
            "week_number": week_overview["week_number"],
            "phase": week_overview["phase"],
            "workouts": [w.to_dict() for w in workouts]
        })

    # Validate and save
    validate_plan(complete_plan)
    save_plan(complete_plan, output_path)

    return ToolExecutionResult(success=True, ...)
```

**Tasks**:
- [ ] Remove dependency on `add_week_details` results
- [ ] Integrate `WorkoutSelector`
- [ ] Update validation logic
- [ ] Update success messages
- [ ] Test with real overview data

**Deliverable**: Updated `finalize_plan` tool

---

### Step 4: Remove add_week_details Tool
**Files to modify**:
- `src/cycling_ai/tools/wrappers/add_week_tool.py` - DELETE
- Tool registry - Remove registration

**Tasks**:
- [ ] Delete `add_week_tool.py`
- [ ] Update tool registry if needed
- [ ] Remove references in tests
- [ ] Remove from CLI if directly referenced

**Deliverable**: Cleaned codebase without old tool

---

### Step 5: Update Prompts
**Files**:
- `prompts/default/1.2/training_planning.txt` - Main prompt
- `prompts/default/1.2/training_planning_overview.txt` - Phase 1 only
- DELETE `prompts/default/1.2/training_planning_weeks.txt` - No longer needed

**Changes to main prompt**:
```
You are an expert cycling coach...

## Mission
Design a complete, personalized {training_plan_weeks}-week training plan using a TWO-PHASE approach.

**CRITICAL**: You must make exactly 2 tool calls:
1. create_plan_overview (1 call) - Generate high-level plan structure
2. finalize_plan (1 call) - Assemble workouts and save complete plan

## PHASE 1: Create Plan Overview

**Tool**: `create_plan_overview`

[Same as before - define weekly overview with phases, TSS, training_days]

## PHASE 2: Finalize Plan

**Tool**: `finalize_plan` (call ONCE after overview created)

**What happens**:
- Code automatically selects workouts from library based on your weekly overview
- Workouts are matched to phases (Foundation → Endurance, Build → Threshold, etc.)
- Durations adjusted to hit your TSS and time targets
- Complete plan assembled and saved

**You don't need to**:
- Generate workout segments
- Calculate durations
- Validate TSS targets
- Create detailed workout structures

**The system handles all of that based on your strategic weekly overview.**
```

**Tasks**:
- [ ] Update main prompt to reflect 2-phase workflow
- [ ] Remove all add_week_details references
- [ ] Update total_tool_calls calculation
- [ ] Simplify validation sections
- [ ] Remove workout generation examples

**Deliverable**: Simplified prompts for 2-phase system

---

### Step 6: Update Orchestration
**File**: `src/cycling_ai/orchestration/multi_agent.py` (if used)

**Changes**:
- Remove Phase 2 (add_week_details loop)
- Update workflow to call only: create_plan_overview → finalize_plan
- Update phase result extraction

**Tasks**:
- [ ] Simplify workflow execution
- [ ] Update phase result handling
- [ ] Test end-to-end workflow

---

### Step 7: Testing
**Test scenarios**:
1. 4-week Foundation plan (easy intensity)
2. 12-week Build plan (mixed intensity)
3. 8-week plan with Recovery weeks
4. Athlete with 3 training days/week
5. Athlete with 5 training days/week

**Validation**:
- [ ] Workout selection matches phase
- [ ] TSS targets hit (±10%)
- [ ] Time targets hit (±10%)
- [ ] Training days respected
- [ ] Hard/easy distribution correct
- [ ] Recovery weeks have reduced volume

**Deliverable**: Passing tests for all scenarios

---

## Migration Strategy

### Backward Compatibility: NONE
- Old 3-phase system completely replaced
- No need to support old workflow
- Clean break, simpler codebase

### Rollout
1. Implement on feature branch
2. Test thoroughly with various athlete profiles
3. Merge to main when validated
4. Update documentation

---

## Success Metrics

### Performance
- **LLM calls**: Reduced from ~13 to 1 (92% reduction)
- **Generation time**: ~60 seconds → ~10 seconds (83% faster)
- **LLM cost**: ~$0.25 → ~$0.02 (92% cheaper)

### Quality
- **Workout consistency**: 100% (same library workouts every time)
- **TSS accuracy**: ±5% (deterministic calculation)
- **Time accuracy**: ±5% (deterministic calculation)

### Developer Experience
- **Testability**: Pure Python = easy unit tests
- **Debuggability**: No LLM black box for workout generation
- **Maintainability**: Update library, not prompts

---

## Open Questions

1. **Workout Variety**: How to prevent same workout every week?
   - Round-robin selection from pool?
   - Random selection?
   - Configurable preference?

2. **Custom Workouts**: How to support athlete-specific workouts?
   - Add to library per-athlete?
   - Separate custom_workout_library.json?

3. **Workout Progression**: How to progress workouts week-to-week?
   - Increase sets gradually?
   - Increase duration gradually?
   - Code-based progression rules?

4. **Library Updates**: How to version workout library?
   - Semantic versioning (v1.0.0)?
   - Migration scripts for breaking changes?

---

## Next Steps

1. Review and approve this plan
2. Start with Step 1: Create workout library JSON
3. Implement WorkoutSelector (Step 2)
4. Update finalize_plan tool (Step 3)
5. Test and iterate

---

**Author**: Claude Code
**Reviewed By**: Eduardo
**Status**: Awaiting approval
