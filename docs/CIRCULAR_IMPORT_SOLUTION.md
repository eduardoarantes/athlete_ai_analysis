# Circular Import Solution: generate_training_plan_tool.py

## Problem Statement

The `generate_complete_training_plan` tool wraps the MultiAgentOrchestrator to enable chat users to generate complete training plans via the same 4-phase workflow used by the `cycling-ai generate` command.

However, this creates a circular dependency:

```
generate_training_plan_tool.py
  ↓ imports
MultiAgentOrchestrator
  ↓ imports
FullReportWorkflow
  ↓ imports
TrainingPlanningPhase
  ↓ imports
AgentFactory
  ↓ imports
ToolExecutor
  ↓ calls
load_all_tools()
  ↓ imports ALL tools including
generate_training_plan_tool.py
  ↓ CIRCULAR DEPENDENCY
```

**Error Message:**
```python
ImportError: cannot import name 'ToolExecutor' from partially initialized module
'cycling_ai.orchestration.executor' (most likely due to a circular import)
```

## Solution: Lazy Import Pattern

The solution is to **delay imports until execution time** by moving imports from module level into the `execute()` method:

```python
# generate_training_plan_tool.py

class GenerateTrainingPlanTool(BaseTool):
    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        # Import HERE instead of module level
        from cycling_ai.orchestration.multi_agent import MultiAgentOrchestrator
        from cycling_ai.orchestration.prompts import AgentPromptsManager
        from cycling_ai.orchestration.session import SessionManager

        # Now safe to use these classes
        orchestrator = MultiAgentOrchestrator(...)
        result = orchestrator.execute_workflow(config)
        return result
```

### Why This Works

1. **Module import**: `generate_training_plan_tool.py` is imported by `load_all_tools()`
2. **Tool class definition**: `GenerateTrainingPlanTool` class is defined
3. **Tool registration**: Tool registered with `register_tool()`
4. **No immediate execution**: The `execute()` method is NOT called during import
5. **Later execution**: When LLM calls the tool, `execute()` runs and imports are safe

At execution time, all modules are fully initialized, so there's no circular dependency.

## Trade-offs

### ✅ Advantages
- **Simple**: One-line change breaks the circular dependency
- **Effective**: Tool loads successfully and executes correctly
- **Minimal impact**: Only affects this one tool
- **Backwards compatible**: No API changes

### ⚠️ Disadvantages
- **Runtime overhead**: Imports happen on every tool execution (~0.1ms)
- **Type checking limitations**: IDEs may not auto-complete as effectively
- **Hidden dependency**: Circular dependency still exists architecturally
- **Code smell**: Generally considered less clean than proper architecture

## Alternative Solutions Considered

### Option A: Refactor Architecture (Not Chosen)
**Approach**: Restructure modules to eliminate circular dependency

**Changes Required**:
- Move `AgentFactory` out of agent.py
- Create separate `tool_loading.py` module
- Refactor orchestrator to not depend on phases
- Update 20+ import statements

**Why Not Chosen**:
- Too invasive for a single tool
- Risk of breaking existing functionality
- Requires comprehensive testing
- Doesn't provide user value

### Option B: Protocol/ABC Pattern (Not Chosen)
**Approach**: Use abstract base class or Protocol for orchestrator interface

**Changes Required**:
- Define `OrchestratorProtocol`
- Import protocol instead of concrete class
- Use dependency injection

**Why Not Chosen**:
- Over-engineering for single use case
- Adds complexity without clear benefit
- Still requires refactoring

### Option C: Lazy Import (Chosen)
**Approach**: Move imports into `execute()` method

**Why Chosen**:
- Minimal code change
- No risk to existing functionality
- Proven pattern in Python ecosystem
- Easy to understand and maintain

## Architectural Justification

This circular dependency exists because:

1. **Tool system is bidirectional**:
   - Tools need orchestrator to execute workflows
   - Orchestrator needs tools to provide functionality

2. **Discovery pattern requires imports**:
   - `load_all_tools()` imports all tool modules
   - This triggers import chain that creates cycle

3. **generate_training_plan_tool is special**:
   - Most tools are simple wrappers around core logic
   - This tool wraps the entire orchestration system
   - It's essentially "tool calling tool system"

### Design Principle

The lazy import pattern is **acceptable here** because:
- This is a **special integration tool** that bridges chat and orchestrator
- The circular dependency is **inherent to the design** (tool wraps orchestrator, orchestrator uses tools)
- Runtime import cost is **negligible** compared to 2-5 minute workflow execution
- Alternative solutions would require **major refactoring** for minimal benefit

## Long-term Recommendations

If this pattern needs to be used in multiple places, consider:

1. **Extract to separate package**: Create `cycling_ai.integrations` package with relaxed import rules
2. **Plugin architecture**: Use entry points for tool discovery instead of direct imports
3. **Lazy loading registry**: Tools register themselves without importing implementations

For now, the lazy import pattern is the pragmatic choice that balances code quality with development velocity.

## Testing

The fix is validated by:
- All 17 tools load successfully (verified in logs)
- Tool executes correctly when called by LLM
- No import errors during startup
- Integration tests pass

```bash
# Verify tool loads
pytest tests/tools/test_generate_training_plan_tool.py -v

# Verify no circular import
python -c "from cycling_ai.tools.loader import load_all_tools; load_all_tools()"
```

## References

- **Commit**: `cab7fe7` - Initial circular import fix
- **Commit**: `ccb748c` - Agent system prompt update to use this tool
- **Python Import System**: https://docs.python.org/3/reference/import.html
- **Circular Imports Guide**: https://stackabuse.com/python-circular-imports/
