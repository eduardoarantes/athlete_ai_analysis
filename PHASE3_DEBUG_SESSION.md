# Phase 3 Training Planning - Debug Session Summary
**Date:** October 30, 2025
**Status:** In Progress - Tool Name Issue Identified

## Current State

### What Works ✅
1. **Power Zones Pre-calculation** (commit 6cb2756)
   - Zones calculated before Phase 3 execution
   - Removed `calculate_power_zones` from tools list
   - Zones passed as formatted text in prompt

2. **Session Serialization Fix** (commit 03b9cdb)
   - Fixed "RepeatedComposite is not JSON serializable" error
   - Deep serialization handles Gemini protobuf objects
   - Sessions persist correctly to disk

3. **SVG Generation Removal** (commit 89e42a0)
   - Removed 107 lines of SVG code from workout_builder.py
   - Updated workout_builder_tool.py
   - SVG only handled in HTML/Report layer

4. **Single-Call Pattern Redesign** (commit 3b121d2)
   - Removed `create_workout` tool from Phase 3
   - Modified `finalize_training_plan` to accept inline workouts
   - Complete prompt rewrite for single-call workflow

### Current Issue ❌

**Problem:** Gemini is hallucinating the tool name

**Expected Tool Name:** `finalize_training_plan`
**Actual Tool Call:** `FinalizeTrainingPlanWeeklyPlan`

**Error Message:**
```
Tool 'FinalizeTrainingPlanWeeklyPlan' is not available in this context
```

**Symptoms:**
- Gemini makes 5 tool calls (iterations 1-5)
- All calls use incorrect tool name
- Each call fails with "tool not available" error
- Loop exhausts max iterations (5)
- Phase 3 fails with no training plan output

**Session Evidence:**
- Session ID: 234c3949-9a5f-49ff-8f59-2692deaef298
- Location: `/Users/eduardo/.cycling-ai/workflow_sessions/234c3949-9a5f-49ff-8f59-2692deaef298.json`
- Last message shows tool call with malformed name

**Additional Issue:**
Even the arguments structure is wrong - passing individual week properties at top level instead of full structure with `athlete_profile_json`, `total_weeks`, `weekly_plan` array, etc.

## Architecture Changes Made

### Before (Multi-Call Pattern)
```
Tools: ["calculate_power_zones", "create_workout", "finalize_training_plan"]

Workflow:
1. LLM calls calculate_power_zones (1 call)
2. LLM calls create_workout repeatedly (75+ calls) ← UNBOUNDED LOOP
3. LLM never calls finalize_training_plan
```

### After (Single-Call Pattern)
```
Tools: ["finalize_training_plan"]

Workflow:
1. LLM designs all workouts in memory
2. LLM calls finalize_training_plan ONCE with complete plan
```

## File Modifications Summary

### 1. src/cycling_ai/orchestration/multi_agent.py
**_execute_phase_3 method (lines 581-631):**
- Added power zones pre-calculation logic
- Removed `create_workout` from tools list
- Changed to: `tools=["finalize_training_plan"]`

### 2. src/cycling_ai/tools/wrappers/training_plan_tool.py
**Updated finalize_training_plan tool:**
- Description changed to emphasize single-call submission
- `weekly_plan` parameter description expanded to include inline workout structure
- Now documents that each workout must contain: name, description, segments
- Each segment must have: type, duration_min, power_low, power_high, description

### 3. prompts/default/1.0/training_planning_user.txt
**Complete rewrite:**
- Emphasis on "ONE CALL" workflow
- Clear 6-step process
- Example workout structure in JSON format
- Critical instructions highlight single finalize_training_plan call
- Removed all references to create_workout tool

### 4. src/cycling_ai/core/workout_builder.py
**Removed:**
- `generate_svg()` method (lines 107-202)
- All SVG generation code

### 5. src/cycling_ai/tools/wrappers/workout_builder_tool.py
**Removed:**
- SVG-related descriptions
- `svg_markup` generation in execute method
- References to SVG in tool definition

### 6. src/cycling_ai/orchestration/session.py
**Added:**
- `_deep_serialize()` helper function (lines 17-51)
- Updated `ConversationMessage.to_dict()` to serialize tool_calls and tool_results

### 7. src/cycling_ai/providers/interaction_logger.py
**Added:**
- `_deep_serialize()` method for recursive serialization
- Updated `_format_message()` to serialize tool_calls
- Updated `_serialize_tool_calls()` and `_serialize_metadata()`

## Test Results

### Latest Test (Single-Call Pattern)
```
Test File: /tmp/phase_test_single_call.log
Duration: 398.89s
Iterations: 5/5 (max reached)
Status: FAILED

Tool Calls:
- Iteration 1: FinalizeTrainingPlanWeeklyPlan (FAILED - tool not found)
- Iteration 2: FinalizeTrainingPlanWeeklyPlan (FAILED - tool not found)
- Iteration 3: FinalizeTrainingPlanWeeklyPlan (FAILED - tool not found)
- Iteration 4: FinalizeTrainingPlanWeeklyPlan (FAILED - tool not found)
- Iteration 5: FinalizeTrainingPlanWeeklyPlan (FAILED - tool not found)

Result: Phase 3 failed, no training plan generated
```

### Previous Test (Multi-Call Pattern - Before Redesign)
```
Duration: 133.96s
Iterations: 5/5 (max reached)
Status: FAILED

Tool Calls:
- create_workout: 64 times (12+13+13+13+13)
- finalize_training_plan: 0 times

Result: Unbounded loop, never called finalize
```

## Potential Root Causes

### 1. Gemini Provider Tool Name Conversion
The Gemini provider may be incorrectly converting tool names when sending to the API or receiving responses. Need to investigate:
- `src/cycling_ai/providers/gemini.py` - How tool definitions are sent
- How Gemini API expects tool names (snake_case vs PascalCase?)
- Whether there's a mapping or conversion happening

### 2. Tool Definition Format
Check if the tool definition format is incompatible with Gemini's expectations:
- ToolDefinition name field
- How parameters are structured
- Whether Gemini is auto-generating names from parameter structure

### 3. LLM Confusion
Gemini may be confused by:
- The length/complexity of the weekly_plan parameter description
- Trying to parse "finalize_training_plan" and generating a different name
- Function calling schema incompatibility

## Next Steps (Priority Order)

### 1. Investigate Gemini Provider Tool Name Handling (HIGH PRIORITY)
```bash
# Check how tool names are sent to Gemini API
grep -n "function.*name" src/cycling_ai/providers/gemini.py
```

**Files to Review:**
- `src/cycling_ai/providers/gemini.py` - Tool conversion logic
- Check if there's a camelCase/PascalCase conversion happening

### 2. Add Debug Logging for Tool Names
Add logging to see exactly what tool name is being:
1. Defined in the tool registry
2. Sent to Gemini API
3. Received back from Gemini

### 3. Test with Different Models
Try the same workflow with:
- Claude (Anthropic) - Verify tool design is correct
- GPT-4 (OpenAI) - Cross-check behavior
- Gemini 2.0 Pro (if rate limits allow)

### 4. Simplify Tool Definition (If Needed)
If Gemini has issues with complex parameter structures:
- Simplify weekly_plan parameter description
- Break down into smaller, simpler parameters
- Use string/JSON instead of nested object structure

### 5. Alternative: Force Tool Name Match
Add validation/mapping in provider to ensure:
- Tool names sent match tool names received
- Error if mismatch detected
- Automatic correction/retry logic

## Code Locations for Investigation

### Gemini Provider
```
src/cycling_ai/providers/gemini.py
- Lines with tool name handling
- Function calling implementation
- Tool definition conversion
```

### Tool Registry
```
src/cycling_ai/tools/registry.py
- Tool registration logic
- Tool name validation
```

### Agent Tool Execution
```
src/cycling_ai/orchestration/agent.py
- Lines 142-154: Loop detection logic (works)
- Tool execution logic
- Tool name resolution
```

## Environment Info
```
Model: gemini-2.5-flash
Provider: Google Gemini API
Max Iterations: 5
Training Plan Weeks: 4
Output Dir: /tmp/cycling_eduardo_20251029_1126
```

## Commits This Session
1. `6cb2756` - Simplify Phase 3 by pre-calculating power zones
2. `03b9cdb` - Fix RepeatedComposite serialization error in session persistence
3. `89e42a0` - Remove SVG generation from workout_builder and improve Phase 3 prompt
4. `3b121d2` - Redesign Phase 3 to single-call pattern with inline workouts

## Key Insights

1. **Prompt engineering alone cannot fix unbounded loops** - The multi-call pattern was fundamentally incompatible with how Gemini interprets tool calling

2. **Single-call pattern is theoretically correct** - LLMs should design everything in memory then submit once, but tool name hallucination is blocking execution

3. **Gemini has quirks with function calling** - The tool name issue suggests Gemini may have specific requirements or bugs in how it handles tool names

4. **Progress has been made** - Sessions persist, serialization works, power zones are pre-calculated, workflow is simpler

## Questions for Next Session

1. Is there a Gemini-specific tool naming convention we're missing?
2. Should we add a tool name normalization layer in the provider?
3. Would switching to a different model (Claude/GPT-4) bypass this issue?
4. Is the nested parameter structure too complex for Gemini's function calling?

## References
- [PHASE3_LOOP_ANALYSIS.md](PHASE3_LOOP_ANALYSIS.md) - Original loop issue analysis
- Session logs: `/Users/eduardo/.cycling-ai/workflow_sessions/`
- LLM interaction logs: `logs/llm_interactions/`
- Test logs: `/tmp/phase_test_*.log`
