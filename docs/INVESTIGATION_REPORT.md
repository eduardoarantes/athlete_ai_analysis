# Workflow Hang Investigation Report

## Problem Statement
The `cycling-ai generate` workflow with OpenAI provider hangs after Phase 1 (Data Preparation) and never progresses to Phase 2 completion, despite Phase 2's LLM successfully requesting tool execution.

## Evidence

### 1. LLM Interaction Logs
File: `logs/llm_interactions/session_20251030_121825.jsonl`

**Interaction 3 (last interaction)**:
- LLM finish_reason: `tool_calls`
- Tool requested: `analyze_performance`
- Arguments: `{csv_file_path, athlete_profile_json, period_months: 3}`
- Expected: Agent should execute tool and send result back to LLM
- Actual: No interaction 4 logged - workflow stopped

### 2. Tool Execution Test
Direct test of `analyze_performance` tool:
```bash
✓ Success: True
✓ Execution time: 17 seconds
✓ Data returned: Valid JSON with expected keys
```

**Conclusion**: Tool itself is NOT the problem.

### 3. Missing Agent Logs
No agent loop logs found (e.g., "[AGENT LOOP] Response received", "[AGENT LOOP] Executing tool calls").

**Conclusion**: Agent loop stopped executing or encountered an error before logging.

## Root Cause Hypothesis

The agent receives the OpenAI response with `tool_calls`, but the condition at `src/cycling_ai/orchestration/agent.py:116` fails:

```python
if response.tool_calls:  # This evaluates to False somehow
    # Tool execution code never runs
```

Possible reasons:
1. **Type mismatch**: `response.tool_calls` might be an empty list `[]` instead of the expected array
2. **Field name mismatch**: OpenAI provider might be setting a different field name
3. **Silent exception**: An error occurs before line 116, causing premature exit

## Proposed Solution

### Step 1: Add Defensive Logging

Add detailed logging to `src/cycling_ai/orchestration/agent.py` after line 110:

```python
# Send to LLM with tools
response = self.provider.create_completion(
    messages=messages,
    tools=tools if tools else None,
)

# ADD THIS BLOCK:
logger.info(f"[AGENT LOOP] Response received.")
logger.info(f"[AGENT LOOP] Response type: {type(response)}")
logger.info(f"[AGENT LOOP] Response.tool_calls type: {type(response.tool_calls)}")
logger.info(f"[AGENT LOOP] Response.tool_calls value: {response.tool_calls}")
logger.info(f"[AGENT LOOP] Response.tool_calls bool: {bool(response.tool_calls)}")
logger.info(f"[AGENT LOOP] Content length: {len(response.content) if response.content else 0}")
logger.info(f"[AGENT LOOP] Tool calls count: {len(response.tool_calls) if response.tool_calls else 0}")
```

### Step 2: Verify OpenAI Provider Response Format

Check that `OpenAIProvider.create_completion()` returns `CompletionResponse` with:
- `tool_calls`: List of dicts (NOT None, NOT empty list when tools are called)
- Each dict has: `{name, arguments, id}`

Current code (src/cycling_ai/providers/openai_provider.py:298-306):
```python
if response.choices[0].message.tool_calls:
    tool_calls = [
        {
            "name": tc.function.name,
            "arguments": json.loads(tc.function.arguments),
            "id": tc.id,
        }
        for tc in response.choices[0].message.tool_calls
    ]
```

**Verify**: This list is being set on `CompletionResponse.tool_calls` correctly.

### Step 3: Add Exception Handling

Wrap the agent loop in try-except to catch and log any silent failures:

```python
try:
    # Agent loop code
    ...
except Exception as e:
    logger.error(f"[AGENT LOOP] Exception occurred: {e}", exc_info=True)
    raise
```

## Testing Plan

1. Add logging to agent.py
2. Re-run workflow with OpenAI provider
3. Examine logs to see:
   - What type is `response.tool_calls`?
   - What value does it have?
   - Does the `if response.tool_calls:` condition evaluate to True or False?
4. Based on findings, implement appropriate fix

## Status

- ✓ Phase 4 fix completed and verified (separate issue)
- ✓ OpenAI schema conversion refactored
- ✓ OpenAI interaction logging added
- ⏳ Workflow hang issue - investigation complete, fix pending

## Next Steps

1. Implement proposed logging
2. Test to identify exact failure point
3. Apply fix based on findings
