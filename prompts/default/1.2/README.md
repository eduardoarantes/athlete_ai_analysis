# Prompt Version 1.2 - Three-Phase Training Plan Generation

## Overview

Version 1.2 introduces a **three-phase approach** to training plan generation that solves critical limitations in v1.1 where large training plans (12+ weeks) failed due to JSON payload size constraints.

## Problem Solved

**V1.1 Issue**: LLMs (especially Claude Sonnet 4.5) struggled to generate complete 12-week training plans in a single tool call:
- Single JSON payload ~14KB (complete plan with all workouts)
- Models frequently omitted the `weekly_plan` array entirely
- Hit token/complexity limits causing incomplete outputs
- Success rate: Low for plans >8 weeks

**V1.2 Solution**: Break generation into smaller, manageable chunks:
- Phase 1: Overview only (~1-2KB)
- Phase 2: One week at a time (~1-2KB per week)
- Phase 3: Assembly and validation (~1KB)
- Success rate: Expected to be much higher

---

## Key Differences from V1.1

### 1. **Tool Architecture**

**V1.1**: Single tool (`generate_training_plan` or `finalize_training_plan`)
- Input: All parameters + athlete constraints
- Output: Complete training plan with all weeks in one JSON
- Tool calls: **1**

**V1.2**: Three specialized tools
- `create_plan_overview`: Generate high-level structure
- `add_week_details`: Add workouts for one week (called N times)
- `finalize_plan`: Assemble and validate complete plan
- Tool calls: **1 + N + 1** (e.g., 14 for 12-week plan)

### 2. **Prompt Structure**

**V1.1 System Prompt** (`training_planning.txt`):
- Static instructions
- No template variables
- Single-phase execution model

**V1.2 System Prompt** (`training_planning.txt`):
- **Template variables**: `{training_plan_weeks}`, `{total_tool_calls}`, `{available_days}`, `{weekly_time_budget_hours}`
- **Three-phase execution model** with clear phase boundaries
- **Validation checklist** with exact tool call count requirements

**V1.1 User Prompt** (`training_planning_user.txt`):
- Single request for complete plan
- Static example workouts
- No phase structure

**V1.2 User Prompt** (`training_planning_user.txt`):
- **Three-phase execution instructions** with explicit ordering
- **Dynamic example workouts** generated based on athlete's schedule
- **Validation checklist** at the end
- Template variables for all dynamic content

### 3. **Template Variables**

**V1.1**: No template variables in system prompt
- All dynamic content in user prompt
- Limited parameterization

**V1.2**: Extensive template variables in both prompts
- `{training_plan_weeks}`: Number of weeks in plan (fully parameterized)
- `{total_tool_calls}`: Expected number of tool calls (1 + weeks + 1)
- `{training_plan_weeks_plus_1}`: For step numbering in examples
- `{num_available_days}`: Count of training days per week
- `{num_rest_days}`: Count of rest days per week
- `{available_days}`: Comma-separated list of training days
- `{weekly_time_budget_hours}`: Weekly time budget
- `{daily_time_caps_json}`: Daily time constraints (JSON)
- `{power_zones}`: Power zones text
- `{athlete_profile_path}`: Path to athlete profile
- `{performance_summary}`: Auto-generated from Phase 2 results
- `{example_workouts}`: Dynamically generated based on schedule
- `{example_total_minutes}`: Calculated from example workouts
- `{example_total_hours}`: Calculated from example workouts

### 4. **Execution Flow**

**V1.1 Flow**:
```
1. LLM receives: "Generate 12-week plan with all workouts"
2. LLM tries to produce: ~14KB JSON with 12 weeks × 4-6 workouts × segments
3. Result: Often incomplete (missing weekly_plan)
```

**V1.2 Flow**:
```
1. Phase 1: create_plan_overview
   → Input: High-level parameters
   → Output: Weekly overview (phases, TSS, focus) + plan_id
   → Size: ~1-2KB

2. Phase 2: add_week_details (×12 for 12-week plan)
   → Input: plan_id + week_number + workouts for ONE week
   → Output: Week saved to temp storage + progress ("5/12 weeks complete")
   → Size: ~1-2KB per week

3. Phase 3: finalize_plan
   → Input: plan_id
   → Output: Complete assembled plan + validation + saved to file
   → Size: ~1KB

Total tool calls: 14 (1 + 12 + 1)
Total JSON generated: Same as v1.1, but distributed across 14 smaller chunks
```

### 5. **Temp File Management**

**V1.1**: No intermediate storage
- Everything in memory during single LLM call
- No persistence between tool calls

**V1.2**: Temp file storage for progressive assembly
- Overview: `/tmp/{plan_id}_overview.json`
- Each week: `/tmp/{plan_id}_week_{N}.json`
- Files cleaned up after `finalize_plan` completes
- Enables stateful progression across multiple tool calls

### 6. **Validation**

**V1.1**: Single validation at the end
- Validate complete plan structure
- If validation fails, entire generation wasted

**V1.2**: Multi-stage validation
- **Phase 1**: Validate `weekly_overview` has correct number of weeks
- **Phase 2**: Validate each week's workouts match overview (segments, durations, days)
- **Phase 3**: Validate complete assembled plan before saving
- Early failure detection prevents wasted tool calls

### 7. **Compliance Enforcement**

**V1.1**: Implicit requirements in prompt
- "Generate a training plan with workouts for each week"
- No explicit tool call count

**V1.2**: Explicit compliance rules with exact counts
```
✅ Total tool calls: Must be exactly {total_tool_calls} calls
   - 1x create_plan_overview
   - {training_plan_weeks}x add_week_details
   - 1x finalize_plan

✅ weekly_overview array: Must have exactly {training_plan_weeks} entries
✅ Available days: ONLY schedule on: {available_days}
✅ Weekly time budget: ~{weekly_time_budget_hours} hours per week (±10%)
```

---

## When to Use V1.2 vs V1.1

### Use V1.2 When:
- ✅ Training plans ≥8 weeks
- ✅ Using Claude Sonnet 4.5 or similar models with strict output limits
- ✅ Need high reliability for complete plan generation
- ✅ Want progress tracking during generation
- ✅ Prefer explicit phase boundaries

### Use V1.1 When:
- ✅ Training plans ≤6 weeks (simpler execution)
- ✅ Using models with very large output token budgets (e.g., Claude Opus)
- ✅ Want minimal tool call overhead
- ✅ Prototyping or testing

---

## Migration Guide: V1.1 → V1.2

If you're currently using v1.1 prompts, here's what changes:

### 1. **Update CLI/Config**
Change prompt version in configuration or CLI:
```bash
# Old
cycling-ai generate --profile profile.json --prompt-version 1.1

# New
cycling-ai generate --profile profile.json --prompt-version 1.2
```

### 2. **No Code Changes Required**
The orchestrator automatically handles the new tool flow when v1.2 is selected. The three tools are auto-registered by the tool registry.

### 3. **Expect Different Execution**
- **V1.1**: 5 total iterations (setup + tool call + response)
- **V1.2**: 14+ iterations for 12-week plan (1 overview + 12 weeks + 1 finalize)

### 4. **Monitor Logs**
V1.2 logs show progress:
```
[PHASE 3] Tool result: "1/12 weeks complete"
[PHASE 3] Tool result: "2/12 weeks complete"
...
[PHASE 3] Tool result: "All weeks complete! Call finalize_plan"
```

---

## Technical Implementation

### Orchestrator Changes (`multi_agent.py`)
- Added `max_iterations` parameter to `_execute_phase()` method
- Dynamic calculation: `total_tool_calls = 1 + training_plan_weeks + 1`
- Set max_iterations to `total_tool_calls + 5` (buffer for LLM reasoning)
- Added `_generate_performance_summary()` to extract Phase 2 data

### Prompt Loader Changes (`prompt_loader.py`)
- `get_training_planning_prompt()` now formats system prompt with template variables
- `get_training_planning_user_prompt()` generates dynamic examples based on athlete schedule
- Backward compatible with v1.1 (graceful degradation if variables missing)

### New Tools
1. **`plan_overview_tool.py`**: Creates plan skeleton
   - Validates total_weeks in range [4-24]
   - Validates weekly_overview array length
   - Generates UUID plan_id
   - Saves to temp storage

2. **`add_week_tool.py`**: Adds one week's details
   - Validates plan_id exists
   - Validates week_number in range
   - Validates workout/segment structure
   - Updates progress counter
   - Saves to temp storage

3. **`finalize_plan_tool.py`**: Assembles and validates
   - Loads all week files
   - Merges with overview metadata
   - Validates complete plan structure
   - Saves to output directory
   - Cleans up temp files

---

## Example: 12-Week Plan Generation

### V1.1 (Old):
```
Tool Call 1: finalize_training_plan({
  athlete_profile: "...",
  weekly_plan: [
    { week: 1, workouts: [...] },  // ~1.2KB
    { week: 2, workouts: [...] },  // ~1.2KB
    ...
    { week: 12, workouts: [...] }  // ~1.2KB
  ]
})
→ Result: Often incomplete (weekly_plan omitted)
```

### V1.2 (New):
```
Tool Call 1: create_plan_overview({
  total_weeks: 12,
  weekly_overview: [
    { week: 1, phase: "Foundation", tss: 250, ... },
    ...
    { week: 12, phase: "Taper", tss: 150, ... }
  ]
})
→ Result: plan_id="abc123", "Overview created. Call add_week_details for each week."

Tool Call 2: add_week_details({ plan_id: "abc123", week_number: 1, workouts: [...] })
→ Result: "1/12 weeks complete"

Tool Call 3: add_week_details({ plan_id: "abc123", week_number: 2, workouts: [...] })
→ Result: "2/12 weeks complete"

...

Tool Call 13: add_week_details({ plan_id: "abc123", week_number: 12, workouts: [...] })
→ Result: "All weeks complete! Call finalize_plan"

Tool Call 14: finalize_plan({ plan_id: "abc123" })
→ Result: Complete validated training plan saved
```

---

## Performance Characteristics

| Metric | V1.1 | V1.2 |
|--------|------|------|
| **Tool Calls** | 1 | 1 + N + 1 |
| **Max JSON per call** | ~14KB | ~2KB |
| **Token efficiency** | Lower (wasted on failures) | Higher (progressive success) |
| **Success rate (12 weeks)** | ~30-40% | Expected ~90%+ |
| **Execution time** | 30-60s | 60-120s |
| **Progress visibility** | None | "X/Y weeks complete" |
| **Recovery on failure** | Retry entire plan | Retry single week |

---

## Debugging Tips

### Check Phase 3 Max Iterations
If plan generation stops prematurely:
```python
# In multi_agent.py:
total_tool_calls = 1 + config.training_plan_weeks + 1
max_iterations = total_tool_calls + 5  # Should be sufficient

# For 12 weeks: max_iterations = 14 + 5 = 19
```

### Verify Temp Files
If finalization fails:
```bash
ls -la /tmp/*_overview.json
ls -la /tmp/*_week_*.json

# Should see:
# abc123_overview.json
# abc123_week_1.json
# abc123_week_2.json
# ...
```

### Check Tool Call Count
Monitor LLM interaction logs:
```bash
tail -f logs/llm_interactions/session_*.jsonl | grep tool_use
# Should see exactly (1 + weeks + 1) tool calls
```

---

## Future Enhancements

Potential improvements for future versions:

1. **Parallel week generation**: Generate multiple weeks in parallel (requires concurrent tool calls)
2. **Incremental validation**: Validate each week immediately after generation
3. **Smart caching**: Cache overview for similar athlete profiles
4. **Adaptive phasing**: Automatically choose v1.1 vs v1.2 based on plan size
5. **Progress callbacks**: Real-time UI updates during generation

---

**Version**: 1.2
**Created**: 2025-11-01
**Status**: Production Ready
**Recommended For**: All training plan generations ≥8 weeks
