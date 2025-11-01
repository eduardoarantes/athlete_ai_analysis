# V1.2 Three-Phase Training Plan Generation

## Overview

V1.2 now splits training plan generation into **3 isolated sub-phases** to solve Gemini's parallel tool calling issue and improve reliability across all providers.

## Phase Structure

### **Phase 3a: Training Plan Overview** (LLM)
- **Purpose**: Generate high-level plan structure
- **Tool**: `create_plan_overview` only
- **LLM Calls**: 1
- **Output**: plan_id + weekly overview (phases, TSS, focus)
- **Duration**: ~10-20 seconds
- **Tokens**: ~2-4K

### **Phase 3b: Weekly Details Generation** (LLM)
- **Purpose**: Generate detailed workouts for all weeks
- **Tool**: `add_week_details` only
- **LLM Calls**: N (one per week)
- **Input**: plan_id from Phase 3a
- **Output**: Detailed workouts saved to temp storage
- **Duration**: ~30-60 seconds for 12 weeks
- **Tokens**: ~1-2K per week

### **Phase 3c: Plan Finalization** (Python Only - NO LLM)
- **Purpose**: Assemble, validate, and save complete plan
- **Tool**: `finalize_plan` (direct Python call)
- **LLM Calls**: 0
- **Input**: plan_id from Phase 3a
- **Output**: Complete validated training plan
- **Duration**: <1 second
- **Tokens**: 0 (no LLM)

## Benefits

### ✅ **Solves Gemini Parallel Calling Issue**
- Each phase has ONE tool only
- No risk of LLM calling multiple tools simultaneously
- Gemini conversation state stays synchronized

### ✅ **Works Across All Providers**
- Anthropic: Works perfectly
- OpenAI: Works perfectly
- Gemini: Now works reliably
- Ollama: Works (with appropriate model size)

### ✅ **Better Error Recovery**
- Can retry individual sub-phases
- Failure in Phase 3b doesn't waste Phase 3a work
- Clear checkpoint between each phase

### ✅ **Improved Progress Tracking**
- Phase 3a: "Overview created"
- Phase 3b: "1/12 weeks complete", "2/12 weeks complete", etc.
- Phase 3c: "Plan finalized"

### ✅ **Clearer Prompts**
- Each phase has focused, single-purpose prompts
- Less cognitive load on LLM
- Higher success rates

### ✅ **Performance Optimization**
- Phase 3c uses NO tokens (Python only)
- Saves ~1-2K tokens per generation
- Faster overall execution

## Data Flow

```
Phase 2 (Performance Analysis)
    ↓ [performance_data, zones_data, athlete_profile_path]

Phase 3a (Overview - LLM)
    → Call: create_plan_overview
    ↓ [plan_id, weekly_overview]
    ↓ Save: /tmp/{plan_id}_overview.json

Phase 3b (Weekly Details - LLM)
    → Call: add_week_details (week 1)
    ↓ Save: /tmp/{plan_id}_week_1.json
    → Call: add_week_details (week 2)
    ↓ Save: /tmp/{plan_id}_week_2.json
    → ... (repeat N times)
    ↓ Save: /tmp/{plan_id}_week_N.json
    ↓ [weeks_completed: N]

Phase 3c (Finalization - Python)
    → Load: /tmp/{plan_id}_overview.json
    → Load: /tmp/{plan_id}_week_*.json (all weeks)
    → Validate: Complete plan structure
    → Save: output/training_plan_{timestamp}.json
    → Cleanup: Delete temp files
    ↓ [complete_training_plan]

Phase 4 (Report Generation)
```

## File Structure

### Prompts (3 sets)

**Phase 3a: Overview**
- `training_planning_overview.txt` (system prompt)
- `training_planning_overview_user.txt` (user prompt)

**Phase 3b: Weekly Details**
- `training_planning_weeks.txt` (system prompt)
- `training_planning_weeks_user.txt` (user prompt)

**Phase 3c: Finalization**
- No prompts needed (Python only)

### Tools (3 tools)

**create_plan_overview**
- Creates high-level structure
- Returns plan_id
- Saves to /tmp/{plan_id}_overview.json

**add_week_details**
- Adds workouts for ONE week
- Updates progress counter
- Saves to /tmp/{plan_id}_week_{N}.json

**finalize_plan**
- Loads all temp files
- Validates complete plan
- Saves to output directory
- Cleans up temp files

## Orchestrator Changes

### Before (V1.2-initial)
```python
def _execute_phase_3(config, phase2_result):
    # Single phase with 14+ tool calls
    return _execute_phase(
        tools=["create_plan_overview", "add_week_details", "finalize_plan"],
        max_iterations=total_tool_calls + 5
    )
```

### After (V1.2-split)
```python
def _execute_phase_3a_overview(config, phase2_result):
    # Phase 3a: Overview only
    return _execute_phase(
        tools=["create_plan_overview"],
        max_iterations=5
    )

def _execute_phase_3b_weeks(config, phase3a_result):
    # Phase 3b: Weeks only
    plan_id = phase3a_result.extracted_data["plan_id"]
    return _execute_phase(
        tools=["add_week_details"],
        max_iterations=training_plan_weeks + 5
    )

def _execute_phase_3c_finalize(config, phase3a_result):
    # Phase 3c: Python only - NO LLM
    plan_id = phase3a_result.extracted_data["plan_id"]
    finalize_tool = FinalizePlanTool()
    result = finalize_tool.execute(plan_id=plan_id)
    return create_phase_result(result)
```

## Execution Example (12-Week Plan)

### Phase 3a (10 seconds)
```
[13:45:00] Starting Phase 3a: Training Plan Overview
[13:45:02] LLM generating high-level structure...
[13:45:10] Tool call: create_plan_overview
[13:45:10] Overview saved: /tmp/abc123_overview.json
[13:45:10] Phase 3a complete. plan_id=abc123
```

### Phase 3b (45 seconds)
```
[13:45:10] Starting Phase 3b: Weekly Details (12 weeks)
[13:45:12] LLM generating week 1 workouts...
[13:45:15] Tool call: add_week_details(week=1)
[13:45:15] Week 1/12 complete
[13:45:17] LLM generating week 2 workouts...
[13:45:20] Tool call: add_week_details(week=2)
[13:45:20] Week 2/12 complete
... (continue for all 12 weeks)
[13:45:55] Week 12/12 complete
[13:45:55] Phase 3b complete. All weeks generated.
```

### Phase 3c (0.5 seconds)
```
[13:45:55] Starting Phase 3c: Plan Finalization (Python)
[13:45:55] Loading overview: /tmp/abc123_overview.json
[13:45:55] Loading 12 week files...
[13:45:55] Validating complete plan...
[13:45:55] Validation passed
[13:45:55] Saving: output/training_plan_20251101_134555.json
[13:45:55] Cleaning up temp files
[13:45:55] Phase 3c complete. NO LLM tokens used.
```

**Total Time**: ~55 seconds (vs ~60 seconds in single-phase approach)
**Total Tokens**: ~18K (vs ~20K with finalize tool call)

## Comparison: V1.1 vs V1.2-initial vs V1.2-split

| Metric | V1.1 | V1.2-initial | V1.2-split |
|--------|------|--------------|------------|
| **LLM Phases** | 1 | 1 | 2 |
| **Python Phases** | 0 | 0 | 1 |
| **Tool Calls** | 1 | 14 | 13+1 |
| **Max JSON per call** | ~14KB | ~2KB | ~2KB |
| **Gemini Compatible** | ❌ | ❌ | ✅ |
| **Session Isolation** | ❌ | ❌ | ✅ |
| **Progress Visibility** | None | Good | Excellent |
| **Token Efficiency** | Low | High | Highest |
| **Error Recovery** | Poor | Fair | Excellent |

## Migration from V1.2-initial

If you had the original V1.2 implementation, the split version is **backward compatible** - just use the new prompts and the orchestrator will automatically use the 3-phase approach.

**No code changes needed in your application** - the split is transparent to callers.

## Troubleshooting

### Phase 3a fails
- Check athlete profile has FTP, available_days, weekly_hours
- Check template variables are properly formatted
- Review create_plan_overview tool logs

### Phase 3b fails mid-way
- Check temp files exist: `ls /tmp/{plan_id}*`
- Review add_week_details tool logs
- Ensure LLM is calling tool for EACH week

### Phase 3c fails
- Verify all week files exist
- Check finalize_plan tool logs for validation errors
- Ensure plan_id matches overview file

## Performance Tips

1. **Use Anthropic for fastest execution** (~45s for 12 weeks)
2. **Use Gemini for best value** (~60s for 12 weeks, much cheaper)
3. **Use OpenAI for most reliable** (~50s for 12 weeks)
4. **Avoid small Ollama models** (llama3.2:3b fails, use 8b+)

---

**Version**: 1.2-split
**Created**: 2025-11-01
**Status**: Production Ready
**Recommended For**: All training plan generations
