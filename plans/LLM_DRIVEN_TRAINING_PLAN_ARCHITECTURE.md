# LLM-Driven Training Plan Architecture

## Overview
Redesign the training plan generation from rule-based to fully LLM-driven, allowing the AI to make coaching decisions based on athlete data, performance analysis, and training science principles.

## Current Problems
1. **Rule-based logic** generates identical plans for different athletes
2. **Performance data ignored** - Phase 2 analysis not used for planning
3. **No personalization** - athlete goals, constraints, trends not considered
4. **Rigid structure** - fixed phase distribution, predetermined workouts
5. **Maintenance burden** - coaching changes require code updates

## New Architecture

### Phase 1: LLM Agent Role
The training planning agent becomes a **coaching expert** that:
- Analyzes performance trends from Phase 2
- Reviews athlete profile (goals, constraints, training status)
- Designs periodized plan with reasoning
- Determines workout types, intensities, and progressions
- Explains coaching decisions

### Phase 2: Tools Available to LLM

#### Tool 1: `create_workout` (NEW)
**Purpose**: Build structured workout with warm-up, intervals, recovery, cool-down

**Parameters**:
- `workout_name`: string (e.g., "Threshold", "VO2 Max", "Endurance")
- `description`: string (coaching notes)
- `segments`: array of segment objects
  - `type`: warmup | interval | recovery | cooldown | steady
  - `duration_min`: integer
  - `power_low`: integer (watts)
  - `power_high`: integer (watts, optional)
  - `description`: string

**Returns**: Structured workout object with SVG visualization

**Example**:
```json
{
  "workout_name": "Week 1 Threshold Development",
  "description": "Build FTP with sub-threshold intervals",
  "segments": [
    {"type": "warmup", "duration_min": 15, "power_low": 150, "power_high": 195, "description": "Progressive warm-up Z1-Z2"},
    {"type": "interval", "duration_min": 15, "power_low": 234, "power_high": 247, "description": "Threshold effort 90-95% FTP"},
    {"type": "recovery", "duration_min": 5, "power_low": 143, "power_high": 143, "description": "Easy spinning"},
    {"type": "interval", "duration_min": 15, "power_low": 234, "power_high": 247, "description": "Threshold effort 90-95% FTP"},
    {"type": "cooldown", "duration_min": 10, "power_low": 150, "power_high": 120, "description": "Easy recovery"}
  ]
}
```

#### Tool 2: `calculate_power_zones` (NEW)
**Purpose**: Calculate training zones based on current FTP

**Parameters**:
- `ftp`: number (current FTP in watts)

**Returns**: Power zone definitions (Z1-Z5, Sweet Spot, etc.)

#### Tool 3: `finalize_training_plan` (MODIFIED from `generate_training_plan`)
**Purpose**: Save the complete training plan designed by the LLM

**Parameters**:
- `athlete_profile_json`: string (path)
- `total_weeks`: integer
- `target_ftp`: number
- `weekly_plan`: array of week objects
  - `week_number`: integer
  - `phase`: string (Foundation, Build, Recovery, Peak, etc.)
  - `phase_rationale`: string (why this phase now)
  - `workouts`: object mapping day names to workout objects
  - `weekly_focus`: string (coaching guidance for the week)
  - `monitoring_notes`: string (what athlete should watch for)

**Returns**: Complete training plan with metadata

### Phase 3: Data Flow

**Input to LLM** (from Phase 2 `phase_context`):
```json
{
  "performance_data": {
    "recent_trend": "improving/declining/stable",
    "ftp_current": 260,
    "ftp_6mo_ago": 245,
    "fitness_trend": {...},
    "fatigue_indicators": {...}
  },
  "zones_data": {
    "time_in_zones": {...},
    "zone_distribution": {...}
  },
  "athlete_profile": {
    "name": "Eduardo",
    "age": 42,
    "ftp": 260,
    "goals": ["Improve FTP", "Complete gran fondo"],
    "available_days": ["Tuesday", "Thursday", "Saturday", "Sunday"],
    "constraints": [...],
    "training_status": "trained"
  }
}
```

**Output from LLM**:
- Coaching analysis and rationale
- Week-by-week plan with specific workouts
- Monitoring and adaptation guidance
- Success factors and risk assessment

### Phase 4: Prompt Updates

#### System Prompt (`training_planning.txt`)
```
You are an expert cycling coach with deep knowledge of:
- Training periodization and progressive overload
- FTP-based training and power zones
- Performance analysis and trend interpretation
- Individualized program design
- Recovery and adaptation principles

**Your Task**:
Analyze the athlete's performance data and profile to design a personalized training plan.

**Available Tools**:
1. calculate_power_zones - Get training zones for workout design
2. create_workout - Build structured workouts with specific intervals
3. finalize_training_plan - Save your complete plan

**Workflow**:
1. Review performance trends from analysis phase
2. Assess athlete's current fitness, goals, and constraints
3. Calculate appropriate power zones
4. Design week-by-week progression:
   - Determine phases based on athlete needs (not fixed templates)
   - Create specific workouts using create_workout tool
   - Balance intensity with recovery
   - Progressive overload appropriate for athlete's status
5. Provide coaching rationale for your decisions
6. Finalize plan with monitoring guidance

**Important**:
- Each workout must have warm-up and cool-down (when appropriate)
- Adapt plan structure to athlete's specific situation
- Explain WHY you chose this approach
- Consider recent performance trends
- Respect available training days
- Include recovery weeks when needed
```

#### User Prompt (`training_planning_user.txt`)
```
Design a {training_plan_weeks}-week personalized training plan for this athlete.

**Athlete Profile**: {athlete_profile_path}

**Performance Context**:
You have access to recent performance analysis showing trends, time-in-zones, and fitness trajectory.

**Your Responsibilities**:
1. Analyze the athlete's current state and recent trends
2. Design a periodized plan that addresses their specific needs
3. Create detailed workouts with warm-up, main set, cool-down
4. Provide coaching rationale for your approach
5. Include monitoring guidance and success factors

**Plan Structure**:
- Use calculate_power_zones to get training zones
- Use create_workout to build each workout
- Use finalize_training_plan to save your complete plan

**Remember**: This is a personalized coaching program. Adapt to this specific athlete's data, don't use generic templates.
```

## Implementation Steps

1. **Create new tools**:
   - `src/cycling_ai/tools/wrappers/workout_builder_tool.py` - create_workout
   - `src/cycling_ai/tools/wrappers/zones_calculator_tool.py` - calculate_power_zones

2. **Modify training.py**:
   - Remove rule-based plan generation (lines 87-217)
   - Keep only utility functions for zones and data serialization
   - Add finalize_training_plan function (saves LLM-designed plan)

3. **Update training_plan_tool.py**:
   - Rename to finalize_training_plan
   - Accept weekly_plan parameter designed by LLM
   - Validate and save the plan

4. **Update prompts**:
   - training_planning.txt - coaching expert system
   - training_planning_user.txt - personalized design instructions

5. **Update multi_agent.py**:
   - Phase 3 tools: ["calculate_power_zones", "create_workout", "finalize_training_plan"]

## Benefits

1. **True Personalization**: Plans adapt to actual athlete data
2. **Performance-Driven**: Uses Phase 2 analysis to inform decisions
3. **Flexible**: Can apply different training philosophies
4. **Explainable**: LLM explains coaching rationale
5. **Maintainable**: Coaching updates via prompts, not code
6. **Adaptive**: Can handle special cases (injury, life events, etc.)

## Example LLM Workflow

```
LLM: "I've analyzed Eduardo's performance data. His FTP improved from 245W to 260W
over 6 months, showing steady progression. However, his time-in-zones shows
limited Z4/Z5 work. For the next 12 weeks, I'll focus on threshold and VO2 max
development while respecting his 4-day training availability."

LLM calls: calculate_power_zones(ftp=260)
→ Returns: {Z1: 0-156W, Z2: 156-208W, Z3: 208-234W, Z4: 234-286W, ...}

LLM: "Week 1 will be Foundation phase. Given his trained status, I'll start with
moderate threshold work..."

LLM calls: create_workout(...)
→ Builds Tuesday threshold workout

LLM calls: create_workout(...)
→ Builds Thursday tempo workout

... (continues for all weeks)

LLM calls: finalize_training_plan(weekly_plan=[...])
→ Saves complete 12-week plan

LLM: "I've designed a 12-week plan with 4-week Foundation, 4-week Build, 3-week
Peak, and 1-week Recovery. Recovery week at week 8. Target FTP: 275W (+5.8%).
Monitor RPE and ensure adequate recovery between threshold sessions..."
```

## Migration Notes

- Existing workout_builder.py functions become internal utilities
- SVG generation logic preserved
- Power zone calculations remain deterministic
- Only the _planning logic_ moves to LLM
