# Tool Registration Debug Session

## Problem
FIT-only workflow fails with "Tool 'validate_data_files' not found in registry" error, despite tools being sent to LLM.

## Root Cause Identified
Phase 1 tools (`DataValidationTool` and `CachePreparationTool`) were not being imported during app initialization, so they never registered themselves with the global tool registry.

## Fixes Applied

### 1. Added Missing Imports to `src/cycling_ai/tools/wrappers/__init__.py`
```python
from .cache_preparation_tool import CachePreparationTool
from .cross_training_tool import CrossTrainingTool
from .data_validation_tool import DataValidationTool  # ADDED
from .performance import PerformanceAnalysisTool
from .report_tool import ReportGenerationTool
from .training_plan_tool import TrainingPlanTool
from .zones_tool import ZoneAnalysisTool

__all__ = [
    "CachePreparationTool",  # ADDED
    "CrossTrainingTool",
    "DataValidationTool",  # ADDED
    "PerformanceAnalysisTool",
    "ReportGenerationTool",
    "TrainingPlanTool",
    "ZoneAnalysisTool",
]
```

### 2. Updated `src/cycling_ai/orchestration/executor.py`
Added explicit tool loading in executor initialization:
```python
import cycling_ai.tools  # Trigger tool registration via load_all_tools()
from cycling_ai.tools.base import ToolExecutionResult
from cycling_ai.tools.registry import get_global_registry


class ToolExecutor:
    def __init__(self) -> None:
        """Initialize executor with global registry."""
        # Ensure all tools are loaded before accessing registry
        cycling_ai.tools.load_all_tools()  # noqa: F405
        self.registry = get_global_registry()
```

## Current Status
Despite fixes, error persists in end-to-end tests. Manual testing shows tools ARE registered when executor is imported directly.

## Next Steps After Restart

### Step 1: Verify Fixes Are Saved
```bash
cd /Users/eduardo/Documents/projects/cycling-ai-analysis

# Check executor.py has the import
head -30 src/cycling_ai/orchestration/executor.py | grep "load_all_tools"

# Check wrappers __init__.py has the imports
grep -E "(DataValidationTool|CachePreparationTool)" src/cycling_ai/tools/wrappers/__init__.py
```

### Step 2: Clear Python Cache
```bash
find src -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
find src -name "*.pyc" -delete 2>/dev/null
```

### Step 3: Run Diagnostic Test
Create and run this test script:
```bash
cat > /tmp/test_tool_loading.py << 'EOF'
"""Test script to diagnose tool loading issue."""
import sys

print("=" * 60)
print("DIAGNOSTIC: Tool Loading Test")
print("=" * 60)

# Step 1: Import executor (this should trigger tool loading)
print("\n1. Importing ToolExecutor...")
from cycling_ai.orchestration.executor import ToolExecutor

# Step 2: Create executor instance
print("2. Creating ToolExecutor instance...")
executor = ToolExecutor()

# Step 3: List tools in registry
print("3. Tools in registry:")
tools = executor.registry.list_tools()
for i, tool_name in enumerate(sorted(tools), 1):
    print(f"   {i}. {tool_name}")

print(f"\nTotal tools: {len(tools)}")

# Step 4: Try to get the problematic tool
print("\n4. Testing validate_data_files retrieval...")
try:
    tool = executor.registry.get_tool('validate_data_files')
    print(f"   ✓ SUCCESS: Got tool {tool.__class__.__name__}")
except KeyError as e:
    print(f"   ✗ FAILED: {e}")
    sys.exit(1)

# Step 5: Try to execute the tool
print("\n5. Testing validate_data_files execution...")
result = executor.execute_tool('validate_data_files', {
    'athlete_profile_path': '/Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/athlete_profile.json',
    'fit_dir_path': '/Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/activities'
})

if result.success:
    print(f"   ✓ SUCCESS: Tool executed successfully")
    print(f"   FIT files found: {result.data.get('fit_files_count', 'N/A')}")
else:
    print(f"   ✗ FAILED: {result.errors}")
    sys.exit(1)

print("\n" + "=" * 60)
print("ALL TESTS PASSED!")
print("=" * 60)
EOF

.venv/bin/python /tmp/test_tool_loading.py
```

### Step 4: Test FIT-Only Workflow
If diagnostic passes:
```bash
rm logs/llm_interactions/*.jsonl

.venv/bin/cycling-ai generate \
  --profile /Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/athlete_profile.json \
  --fit-dir /Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/activities \
  --output-dir /tmp/fit_test_final \
  --period-months 6 \
  --skip-training-plan \
  --provider gemini

# Check for errors
grep "not found in registry" logs/llm_interactions/*.jsonl || echo "✓ NO ERRORS!"
```

### Step 5: If Still Failing
Check if there's a module installation issue:
```bash
# The app might be running from installed package instead of source
.venv/bin/python -c "
import cycling_ai.orchestration.executor
print('Executor location:', cycling_ai.orchestration.executor.__file__)
"

# If it's not in the src/ directory, reinstall in editable mode
.venv/bin/pip install -e .
```

## Alternative Hypothesis
If the diagnostic test PASSES but end-to-end test FAILS, the issue may be:
1. **Module loading order**: Tools are loaded AFTER the agent gets the tool list
2. **Registry singleton issue**: Multiple registry instances being created
3. **Provider-specific issue**: The way Gemini provider gets/uses tools differs from executor

To investigate, add debug logging to `src/cycling_ai/orchestration/executor.py`:
```python
def __init__(self) -> None:
    """Initialize executor with global registry."""
    import logging
    logger = logging.getLogger(__name__)

    # Ensure all tools are loaded before accessing registry
    tools_loaded = cycling_ai.tools.load_all_tools()
    logger.info(f"Loaded {tools_loaded} tools during executor init")

    self.registry = get_global_registry()
    logger.info(f"Registry has {len(self.registry.list_tools())} tools: {self.registry.list_tools()}")
```

## Files Modified
1. `src/cycling_ai/tools/wrappers/__init__.py` - Added Phase 1 tool imports
2. `src/cycling_ai/orchestration/executor.py` - Added explicit tool loading

## Key Insight
When testing the executor directly with Python, tools ARE found. This suggests the fix works for direct imports, but something in the multi-agent workflow initialization may be creating the registry before tools are loaded.

## Resume Command
```bash
cd /Users/eduardo/Documents/projects/cycling-ai-analysis
cat .claude/TOOL_REGISTRATION_DEBUG.md
# Then follow "Next Steps After Restart"
```
