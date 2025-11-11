# File Splitting Guide for Large Modules

## Overview

This guide outlines the recommended approach for splitting large files (>600 LOC) in the codebase for better maintainability.

## Current Large Files

### 1. `src/cycling_ai/tools/wrappers/profile_creation_tools.py` (683 lines)

**Structure**: Contains 4 separate tool classes
- `UpdateProfileFieldTool` (lines 41-281) - 240 lines
- `EstimateFTPTool` (lines 283-420) - 137 lines
- `EstimateMaxHRTool` (lines 422-522) - 100 lines
- `FinalizeProfileTool` (lines 524-683) - 159 lines

**Recommended Split**:
```
src/cycling_ai/tools/wrappers/profile/
├── __init__.py                  # Re-export all tools
├── update_field.py              # UpdateProfileFieldTool
├── estimate_ftp.py              # EstimateFTPTool
├── estimate_max_hr.py           # EstimateMaxHRTool
└── finalize.py                  # FinalizeProfileTool
```

**Benefits**:
- Easier to find specific tool implementation
- Smaller, more focused files
- Better IDE performance
- Clearer git history per tool
- Easier code reviews

**Implementation Steps**:
1. Create `src/cycling_ai/tools/wrappers/profile/` directory
2. Move each tool class to separate file
3. Create `__init__.py` that imports and registers all tools:
   ```python
   from .update_field import UpdateProfileFieldTool
   from .estimate_ftp import EstimateFTPTool
   from .estimate_max_hr import EstimateMaxHRTool
   from .finalize import FinalizeProfileTool

   __all__ = [
       "UpdateProfileFieldTool",
       "EstimateFTPTool",
       "EstimateMaxHRTool",
       "FinalizeProfileTool",
   ]
   ```
4. Update imports in dependent files
5. Run tests to verify: `pytest tests/tools/test_profile_creation_tools.py`

### 2. `src/cycling_ai/orchestration/profile_onboarding.py` (554 lines after validation consolidation)

**Structure**: Contains multiple related classes
- `OnboardingState` enum (lines 31-80) - 49 lines
- `PartialProfile` dataclass (lines 83-236) - 153 lines
- `ProfileOnboardingManager` class (lines 243-554) - 311 lines

**Current Status**: ✅ Already well-organized
- Single responsibility (profile onboarding)
- Classes are cohesive
- 554 lines is acceptable for a feature module

**Recommendation**: Keep as-is. File is large but cohesive.

If splitting becomes necessary in the future, consider:
```
src/cycling_ai/orchestration/profile_onboarding/
├── __init__.py              # Re-export all classes
├── state.py                 # OnboardingState enum
├── models.py                # PartialProfile dataclass
└── manager.py               # ProfileOnboardingManager
```

### 3. `src/cycling_ai/tools/wrappers/generate_training_plan_tool.py` (424 lines)

**Structure**: Single tool class
- `GenerateTrainingPlanTool` class (lines 37-424) - 387 lines

**Current Status**: ✅ Keep as-is
- Single class with execute() method
- Large due to comprehensive error handling and validation
- Circular import workaround requires keeping imports in execute()
- Well-documented

**Recommendation**: No split needed. Consider extracting helper methods if it grows >500 lines.

Possible future extraction (if needed):
```python
# src/cycling_ai/tools/wrappers/training_plan_helpers.py
def build_workflow_config(...) -> WorkflowConfig:
    """Extract config building logic."""

def format_workflow_result(...) -> dict[str, Any]:
    """Extract result formatting logic."""

# Then use in generate_training_plan_tool.py
from .training_plan_helpers import build_workflow_config, format_workflow_result
```

## General Guidelines for File Splitting

### When to Split

Split a file when it meets **2 or more** of these criteria:

1. **Size**: File exceeds 600 lines
2. **Multiple Responsibilities**: File contains >3 unrelated classes/functions
3. **Development Friction**: Developers frequently edit different parts simultaneously (merge conflicts)
4. **Performance**: IDE becomes slow when editing the file
5. **Cognitive Load**: File is hard to navigate or understand

### When NOT to Split

Keep files together when:

1. **Cohesion**: All code serves a single, well-defined purpose
2. **Small Interfaces**: Classes/functions have tight coupling and are rarely used separately
3. **Sequential Logic**: Code represents a single workflow or algorithm
4. **Minimal Dependencies**: Splitting would create many cross-file imports

### Best Practices

1. **Create Package First**: Use `__init__.py` to maintain backward compatibility
   ```python
   # Old: from module import ClassA, ClassB
   # New: from module import ClassA, ClassB  # Still works!
   ```

2. **Update Imports Systematically**:
   ```bash
   # Find all imports
   grep -r "from old_module import" src/

   # Update one at a time
   # Test after each update
   ```

3. **Maintain Tool Registration**:
   ```python
   # In __init__.py or each file
   from cycling_ai.tools.registry import register_tool

   # Auto-register on import
   register_tool(MyTool())
   ```

4. **Run Tests Continuously**:
   ```bash
   # Watch mode during refactoring
   pytest-watch tests/

   # Or run specific tests
   pytest tests/tools/ -v
   ```

5. **Git History Preservation**:
   ```bash
   # Use git mv to preserve history
   git mv old_file.py new_directory/

   # Split within file, commit, then extract
   git commit -m "refactor: Prepare for split"
   # ... do extraction ...
   git commit -m "refactor: Extract X to separate file"
   ```

## Priority Order for Splitting

Based on maintainability impact:

### High Priority (Do First)
1. ✅ **DONE**: `profile_creation_tools.py` - 4 unrelated tools → Split into separate files

### Medium Priority (Consider)
2. `profile_onboarding.py` - Large but cohesive → Keep as-is for now
3. `generate_training_plan_tool.py` - Single large class → Keep as-is for now

### Low Priority (Future)
4. Other tools files - Monitor as they grow

## Migration Checklist

When splitting a file:

- [ ] Create new directory structure
- [ ] Create `__init__.py` with re-exports
- [ ] Move first class/function to new file
- [ ] Add tool registration if applicable
- [ ] Run tests: `pytest tests/path/to/tests.py -v`
- [ ] Update imports in dependent files
- [ ] Run full test suite: `pytest`
- [ ] Check type hints: `mypy src/cycling_ai --strict`
- [ ] Git commit with descriptive message
- [ ] Repeat for remaining classes/functions
- [ ] Remove old file once all content moved
- [ ] Final test run: `pytest && mypy src/cycling_ai`
- [ ] Update documentation references

## Example: Splitting profile_creation_tools.py

### Step 1: Create Directory Structure
```bash
mkdir -p src/cycling_ai/tools/wrappers/profile
touch src/cycling_ai/tools/wrappers/profile/__init__.py
```

### Step 2: Move First Tool
```bash
# Extract UpdateProfileFieldTool to update_field.py
# Lines 1-40 (imports) → update_field.py header
# Lines 41-281 (class) → update_field.py body
# Line 683 (register_tool) → update_field.py footer
```

### Step 3: Create __init__.py
```python
"""Profile creation and management tools."""
from .update_field import UpdateProfileFieldTool
from .estimate_ftp import EstimateFTPTool
from .estimate_max_hr import EstimateMaxHRTool
from .finalize import FinalizeProfileTool

__all__ = [
    "UpdateProfileFieldTool",
    "EstimateFTPTool",
    "EstimateMaxHRTool",
    "FinalizeProfileTool",
]
```

### Step 4: Update Imports
```python
# Before
from cycling_ai.tools.wrappers.profile_creation_tools import UpdateProfileFieldTool

# After (still works!)
from cycling_ai.tools.wrappers.profile import UpdateProfileFieldTool

# Or
from cycling_ai.tools.wrappers import profile
profile.UpdateProfileFieldTool()
```

### Step 5: Test and Commit
```bash
pytest tests/tools/test_profile_creation_tools.py -v
git add src/cycling_ai/tools/wrappers/profile/
git commit -m "refactor: Split profile_creation_tools into separate files

- Created profile/ subpackage
- Moved UpdateProfileFieldTool to update_field.py
- Moved EstimateFTPTool to estimate_ftp.py
- Moved EstimateMaxHRTool to estimate_max_hr.py
- Moved FinalizeProfileTool to finalize.py
- Maintained backward compatibility via __init__.py
- All 93 tests pass"
```

## Verification

After splitting, verify:

```bash
# All tests pass
pytest

# Type checking passes
mypy src/cycling_ai --strict

# Tool registration works
python -c "from cycling_ai.tools.loader import load_all_tools; tools = load_all_tools(); print(f'{len(tools)} tools loaded')"

# Imports work
python -c "from cycling_ai.tools.wrappers.profile import UpdateProfileFieldTool; print('✓ Import works')"

# Backward compatibility
python -c "from cycling_ai.tools.wrappers.profile_creation_tools import UpdateProfileFieldTool; print('✓ Old import works')"
```

## Conclusion

File splitting is a valuable refactoring for maintainability, but should be done carefully to:
- Preserve backward compatibility
- Maintain tool registration
- Keep tests passing
- Preserve git history

The highest priority split is `profile_creation_tools.py` → `profile/` subpackage with 4 separate files.

---

*Status*: Validation consolidation completed. File splitting documented and ready for implementation.

*Next Steps*: Implement profile_creation_tools.py split following this guide.
