# Gemini Tool Calling Fix - Summary

## Problem Statement
Gemini 2.0/2.5 Flash was failing in Phase 3 (Training Planning) with "Maximum iterations exceeded" error, getting stuck in a loop calling `calculate_power_zones` repeatedly.

## Root Cause Analysis

### Issue 1: Provider-Agnostic Code Making Provider-Specific Assumptions ✅ FIXED
**Location**: `src/cycling_ai/orchestration/agent.py:180-187`

**Problem**: Agent was converting all `role="tool"` messages to `role="assistant"` before sending to providers, assuming all LLMs handle tool results the same way.

**Fix**: Removed the conversion - now passes `role="tool"` unchanged and lets each provider handle conversion to their specific format.

### Issue 2: ProviderMessage Missing tool_results Field ✅ FIXED
**Location**: `src/cycling_ai/providers/base.py:43-60`

**Problem**: `ProviderMessage` didn't have a `tool_results` field to carry metadata like tool names.

**Fix**: Added `tool_results: list[dict[str, Any]] | None = None` field and updated validation to allow `role="tool"`.

### Issue 3: Gemini Provider Not Handling Tool Responses ✅ PARTIALLY FIXED
**Location**: `src/cycling_ai/providers/gemini_provider.py:176-209`

**Problem**: Gemini requires function responses in specific format with function name.

**Fix**: Added code to detect `role="tool"` messages and format them as:
```python
{
    "role": "function",
    "parts": [{
        "function_response": {
            "name": tool_name,  # Extracted from tool_results
            "response": tool_data
        }
    }]
}
```

**Status**: Format is correct (verified with test script), but still looping in actual workflow.

### Issue 4: Anthropic Provider Not Handling Tool Responses ✅ FIXED
**Location**: `src/cycling_ai/providers/anthropic_provider.py:170-190`

**Problem**: Anthropic requires tool results as `role="user"` with `type="tool_result"` content.

**Fix**: Added conversion for `role="tool"` messages.

### Issue 5: Prompts Not Enforcing Tool Usage ✅ FIXED
**Locations**:
- `prompts/default/1.0/training_planning.txt:77-82`
- `prompts/default/1.0/training_planning_user.txt:56-65, 84-89`

**Problem**: Prompts had conflicting instructions - asked to use `finalize_training_plan` tool but also said "present clear workout details", which Gemini interpreted as "return JSON directly".

**Fix**: Made tool usage REQUIRED with explicit instructions:
- "YOU MUST call the finalize_training_plan tool"
- "DO NOT return JSON directly in your response - use the tool instead"

## Remaining Issue ⚠️

**Gemini Still Looping**: Despite correct function response format (verified with standalone test), Gemini gets stuck calling `calculate_power_zones` repeatedly in the actual workflow.

### Hypothesis
The Gemini provider builds chat history manually (`messages[:-1]`), but may not be including the assistant's function call messages properly. When an assistant calls a function, the history needs:

1. **Assistant message** with the function call
2. **Function response** message

Currently we might only be adding #2.

### Test Evidence
- ✅ Standalone test with `chat.send_message()` works perfectly
- ✗ Actual workflow with manual history building loops
- ✅ Function response format is correct (Gemini accepts it)
- ✗ Something about history reconstruction is wrong

### Next Steps
1. **Add assistant tool call messages to history**: When rebuilding history, include messages where assistant made function calls
2. **Verify message sequence**: Ensure history has proper alternation: user → assistant (with tool call) → function → user → ...
3. **Test with Gemini 2.5 Flash**: Verify fix works end-to-end
4. **Test with Claude**: Ensure our changes didn't break Anthropic provider

## Files Modified

### Core Files
- ✅ `src/cycling_ai/providers/base.py` - Added `tool_results` to ProviderMessage
- ✅ `src/cycling_ai/orchestration/agent.py` - Removed provider-specific conversion
- ⚠️ `src/cycling_ai/providers/gemini_provider.py` - Added function response handling (needs history fix)
- ✅ `src/cycling_ai/providers/anthropic_provider.py` - Added tool result handling

### Prompts
- ✅ `prompts/default/1.0/training_planning.txt` - Enforced tool usage
- ✅ `prompts/default/1.0/training_planning_user.txt` - Enforced tool usage

### Test Scripts
- ✅ `scripts/manual_phase_runner.py` - Created for debugging
- ✅ `scripts/diagnose_gemini_loop.py` - Created for log analysis
- ✅ `scripts/test_gemini_function_response.py` - Verified format works

## Architecture Improvements

### Before
```
Agent (agent.py)
  ↓
  Converts role="tool" → role="assistant" for ALL providers
  ↓
Provider (gemini/openai/anthropic)
  ↓
  Uses whatever role Agent gives it
```

### After (Correct Design)
```
Agent (agent.py)
  ↓
  Passes role="tool" unchanged
  ↓
Provider (gemini/openai/anthropic)
  ↓
  Each provider converts to its own format:
  - OpenAI: role="tool" (unchanged)
  - Anthropic: role="user" + type="tool_result"
  - Gemini: role="function" + function_response
```

## Rate Limits Hit
- `gemini-2.0-flash-exp`: 50 requests/day limit hit
- Switched to `gemini-2.5-flash`: Separate quota

## Testing Status
- ✅ ProviderMessage validation
- ✅ Function response format (standalone)
- ⚠️ Full workflow (loops on Phase 3)
- ⏳ Claude/Anthropic provider (pending)
- ⏳ OpenAI provider (pending)

## Success Metrics
- ✅ Phase 1: Data Preparation - Works
- ✅ Phase 2: Performance Analysis - Works with Gemini
- ⚠️ Phase 3: Training Planning - Loops (needs history fix)
- ⏳ Phase 4: Report Data Preparation - Pending Phase 3 fix
- ⏳ Phase 5: Report Generation - Pending Phase 3 fix
