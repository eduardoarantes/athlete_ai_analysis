# Training Plan Generation: Rule-Based → LLM-Driven Migration

## Summary

Successfully migrated the training plan generation from rigid rule-based logic to a fully LLM-driven approach. The LLM agent now acts as a personalized cycling coach that analyzes athlete data, designs custom workouts, and provides coaching rationale.

## What Changed

### Before (Rule-Based)
- `generate_training_plan()` contained 420 lines of hardcoded logic
- Fixed periodization (Foundation → Build → Recovery → Peak)
- Predetermined workout types and interval structures
- Generic plans regardless of athlete's specific situation
- Performance data from Phase 2 was collected but ignored
- No personalization beyond basic parameters (FTP, available days)

### After (LLM-Driven)
- LLM analyzes performance trends and athlete profile
- Designs custom periodization based on athlete's needs
- Creates specific workouts with coaching rationale
- Explains decisions based on actual performance data
- Truly personalized plans that adapt to individual situations

## New Architecture

### Tools Available to LLM

#### 1. `calculate_power_zones`
**File**: `src/cycling_ai/tools/wrappers/zones_calculator_tool.py` (NEW)

Calculates training zones (Z1-Z5, Sweet Spot) based on current FTP.

**Usage**:
```python
calculate_power_zones(ftp=260)
```

**Returns**:
```json
{
  "ftp": 260,
  "zones": {
    "z1": {"name": "Active Recovery", "min": 0, "max": 143, ...},
    "z2": {"name": "Endurance", "min": 146, "max": 195, ...},
    ...
  }
}
```

#### 2. `create_workout`
**File**: `src/cycling_ai/tools/wrappers/workout_builder_tool.py` (NEW)

Allows LLM to design structured workouts with warm-up, intervals, recovery, and cool-down.

**Usage**:
```python
create_workout(
  workout_name="Week 1 Threshold Development",
  description="Build FTP with sustained sub-threshold efforts",
  ftp=260,
  segments=[
    {"type": "warmup", "duration_min": 15, "power_low": 150, "power_high": 195, "description": "Progressive warm-up"},
    {"type": "interval", "duration_min": 15, "power_low": 234, "power_high": 247, "description": "Threshold effort"},
    {"type": "recovery", "duration_min": 5, "power_low": 143, "power_high": 143, "description": "Easy recovery"},
    {"type": "interval", "duration_min": 15, "power_low": 234, "power_high": 247, "description": "Threshold effort"},
    {"type": "cooldown", "duration_min": 10, "power_low": 150, "power_high": 120, "description": "Easy spin"}
  ]
)
```

**Returns**: Structured workout object with segments and SVG visualization

#### 3. `finalize_training_plan`
**File**: `src/cycling_ai/tools/wrappers/training_plan_tool.py` (MODIFIED)

Validates and saves the complete LLM-designed plan.

**Usage**:
```python
finalize_training_plan(
  athlete_profile_json="/path/to/profile.json",
  total_weeks=12,
  target_ftp=275,
  weekly_plan=[...],  # Array of weeks with workouts
  coaching_notes="Based on your improving trend over 6 months...",
  monitoring_guidance="Track RPE during threshold sessions..."
)
```

### Core Functions

#### `finalize_training_plan()`
**File**: `src/cycling_ai/core/training.py` (COMPLETELY REWRITTEN)

**Before**: 420 lines of rule-based plan generation
**After**: 127 lines of validation and serialization only

The function now:
- Validates LLM-designed plan structure
- Serializes plan data to JSON
- Does NOT generate workouts (that's the LLM's job)

### Prompts

#### System Prompt (`prompts/default/1.0/training_planning.txt`)
**Completely rewritten** to position LLM as expert cycling coach:

- Emphasizes performance data analysis
- Requires coaching rationale for decisions
- Mandates warm-up/cool-down for intensity workouts
- Prohibits generic templates
- Demands personalization based on actual athlete data

Key sections:
- Expertise areas (periodization, performance analysis, recovery)
- Workflow (analyze → design → create → finalize)
- Critical guidelines (base on data, explain reasoning, gradual progression)

#### User Prompt (`prompts/default/1.0/training_planning_user.txt`)
**Completely rewritten** with detailed instructions:

- Analyze athlete's situation from performance data
- Design appropriate periodization (not templates)
- Create each workout with specific structure
- Organize into weekly structure with rationale
- Provide coaching and monitoring guidance

Includes example workout creation code.

### Orchestrator Updates

#### `multi_agent.py`
**File**: `src/cycling_ai/orchestration/multi_agent.py`

**Line 596** - Updated Phase 3 tools:
```python
tools=["calculate_power_zones", "create_workout", "finalize_training_plan"]
```

**Line 336-338** - Updated data extraction:
```python
elif tool_name in ("generate_training_plan", "finalize_training_plan"):
    data = json.loads(message.content)
    extracted["training_plan"] = data
```

## Benefits

### 1. True Personalization
- Plans adapt to athlete's actual performance trends
- Considers specific goals and constraints
- Responds to declining/improving fitness trajectories

### 2. Data-Driven Decisions
- Uses Phase 2 performance analysis
- References time-in-zones distribution
- Identifies strengths and limiters

### 3. Explainable Coaching
- LLM explains WHY it chose specific approaches
- References actual performance data
- Provides rationale for periodization and target FTP

### 4. Flexibility
- Can apply different training philosophies
- Adapts to special circumstances (injury, life events)
- Not constrained by rigid templates

### 5. Maintainability
- Coaching updates via prompts, not code
- Easy to incorporate new training methodologies
- Reduced code complexity (420 → 127 lines)

## Example LLM Workflow

```
1. LLM analyzes performance data:
   "Eduardo's FTP improved from 245W to 260W over 6 months. His time-in-zones
   shows limited Z4/Z5 work. I'll focus on threshold and VO2 development."

2. LLM calculates zones:
   calculate_power_zones(ftp=260)

3. LLM designs workouts:
   create_workout(...)  # Week 1 Tuesday Threshold
   create_workout(...)  # Week 1 Thursday Tempo
   ...

4. LLM organizes into weeks:
   weekly_plan = [
     {
       "week_number": 1,
       "phase": "Foundation",
       "phase_rationale": "Building aerobic base while introducing threshold...",
       "workouts": {...},
       "weekly_focus": "Consistency and proper recovery between sessions",
       "weekly_watch_points": "Watch RPE - should feel controlled"
     },
     ...
   ]

5. LLM finalizes with coaching notes:
   finalize_training_plan(
     coaching_notes="Based on your steady improvement trend...",
     monitoring_guidance="Track RPE during threshold efforts..."
   )
```

## Files Changed

### New Files
1. `src/cycling_ai/tools/wrappers/workout_builder_tool.py` - create_workout tool
2. `src/cycling_ai/tools/wrappers/zones_calculator_tool.py` - calculate_power_zones tool
3. `plans/LLM_DRIVEN_TRAINING_PLAN_ARCHITECTURE.md` - Architecture design document

### Modified Files
1. `src/cycling_ai/core/training.py` - Reduced from 420 to 127 lines, removed all rule logic
2. `src/cycling_ai/tools/wrappers/training_plan_tool.py` - Renamed tool, updated parameters
3. `prompts/default/1.0/training_planning.txt` - Completely rewritten for LLM coaching
4. `prompts/default/1.0/training_planning_user.txt` - Completely rewritten with detailed instructions
5. `src/cycling_ai/orchestration/multi_agent.py` - Updated tools list and data extraction

### Preserved Files
- `src/cycling_ai/core/workout_builder.py` - Workout and WorkoutSegment classes still used
- Used by create_workout tool for generating structured workout objects

## Migration Notes

### Backward Compatibility
- Old `generate_training_plan` tool name still recognized in data extraction
- Existing workout_builder classes preserved and reused
- SVG generation logic unchanged

### Data Flow
- Phase 2 performance data now actively used by LLM
- Athlete profile fully leveraged for personalization
- Training plan structure output remains compatible with Phase 4 reporting

## Testing Recommendations

1. **Test with different athlete profiles**:
   - Improving athlete (FTP trending up)
   - Declining athlete (needs recovery focus)
   - Limited availability (3 days/week)
   - Advanced athlete (needs high intensity)

2. **Verify LLM reasoning**:
   - Check coaching_notes reference actual performance data
   - Ensure periodization matches athlete's situation
   - Validate workout progression is gradual

3. **Validate workout structure**:
   - High-intensity workouts have warm-up/cool-down
   - Power targets match calculated zones
   - Progression is appropriate

4. **Check edge cases**:
   - Minimum weeks (4)
   - Maximum weeks (24)
   - Different available day combinations
   - Various FTP targets

## Future Enhancements

1. **Additional Tools**:
   - `analyze_past_training_plan` - Learn from previous plans
   - `simulate_workout_load` - Calculate TSS/training load
   - `suggest_race_taper` - Event-specific peaking

2. **Enhanced Personalization**:
   - Consider injury history
   - Account for cross-training activities
   - Integrate with actual performance vs. planned

3. **Adaptive Planning**:
   - Mid-plan adjustments based on progress
   - Real-time adaptation to life events
   - Progressive target FTP updates

## Conclusion

The migration to LLM-driven training plan generation transforms the system from a rigid rule-based template generator into a personalized coaching platform. The LLM now makes informed decisions based on actual athlete data, explains its reasoning, and adapts to individual circumstances - just like a human coach would.
