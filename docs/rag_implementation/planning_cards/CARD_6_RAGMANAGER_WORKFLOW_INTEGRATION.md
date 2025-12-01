# Implementation Card 6: RAGManager Workflow Integration

**Priority:** CRITICAL (Blocking all RAG functionality)
**Estimated Time:** 3-4 hours
**Card Status:** Ready for Implementation
**Dependencies:** Phase 1 & 2 complete (RAGManager exists)

---

## Objective

Initialize RAGManager in BaseWorkflow when RAG is enabled, passing it to PhaseContext so phases can actually use RAG. This is the **most critical missing piece** - without this, RAG is never activated.

---

## Files to Modify

### File 1: `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/orchestration/workflows/base_workflow.py`

**Current Code (Lines 156-183):**
```python
def _create_phase_context(
    self, config: WorkflowConfig, previous_phase_data: dict[str, Any]
) -> PhaseContext:
    """
    Create phase execution context.

    Helper method to build PhaseContext with config and accumulated data
    from previous phases.

    Args:
        config: Workflow configuration
        previous_phase_data: Data extracted from previous phases

    Returns:
        PhaseContext ready for phase execution

    Example:
        >>> context = self._create_phase_context(config, {})
        >>> result = phase.execute(context)
    """
    return PhaseContext(
        config=config,
        previous_phase_data=previous_phase_data,
        session_manager=self.session_manager,
        provider=self.provider,
        prompts_manager=self.prompts_manager,
        progress_callback=self.progress_callback,
    )
```

**New Code:**
```python
def _create_phase_context(
    self, config: WorkflowConfig, previous_phase_data: dict[str, Any]
) -> PhaseContext:
    """
    Create phase execution context.

    Helper method to build PhaseContext with config and accumulated data
    from previous phases. If RAG is enabled, initializes RAGManager.

    Args:
        config: Workflow configuration
        previous_phase_data: Data extracted from previous phases

    Returns:
        PhaseContext ready for phase execution

    Example:
        >>> context = self._create_phase_context(config, {})
        >>> result = phase.execute(context)
    """
    # Initialize RAG manager if enabled
    rag_manager = None
    if config.rag_config.enabled:
        rag_manager = self._initialize_rag_manager(config.rag_config)

    return PhaseContext(
        config=config,
        previous_phase_data=previous_phase_data,
        session_manager=self.session_manager,
        provider=self.provider,
        prompts_manager=self.prompts_manager,
        progress_callback=self.progress_callback,
        rag_manager=rag_manager,
    )

def _initialize_rag_manager(self, rag_config: Any) -> Any:
    """
    Initialize RAG manager with config.

    Creates RAGManager if vectorstore exists, otherwise logs warning
    and returns None for graceful degradation.

    Args:
        rag_config: RAG configuration

    Returns:
        RAGManager instance or None if initialization fails

    Example:
        >>> rag_manager = self._initialize_rag_manager(config.rag_config)
        >>> if rag_manager:
        ...     # RAG available
    """
    import logging
    from cycling_ai.rag.manager import RAGManager

    logger = logging.getLogger(__name__)

    # Check if project vectorstore exists
    if rag_config.project_vectorstore_path is None:
        logger.warning(
            "RAG enabled but no project vectorstore path configured. "
            "RAG will be disabled."
        )
        return None

    if not rag_config.project_vectorstore_path.exists():
        logger.warning(
            f"RAG enabled but project vectorstore not found at: "
            f"{rag_config.project_vectorstore_path}. "
            f"Run 'cycling-ai index domain-knowledge' to populate vectorstore. "
            f"RAG will be disabled for this run."
        )
        return None

    try:
        logger.info(
            f"Initializing RAG with vectorstore: {rag_config.project_vectorstore_path}"
        )
        rag_manager = RAGManager(
            project_vectorstore_path=rag_config.project_vectorstore_path,
            user_vectorstore_path=rag_config.user_vectorstore_path,
            embedding_provider=rag_config.embedding_provider,
            embedding_model=rag_config.embedding_model,
        )
        logger.info("RAG manager initialized successfully")
        return rag_manager
    except Exception as e:
        logger.error(
            f"Failed to initialize RAG manager: {e}. "
            f"RAG will be disabled for this run."
        )
        return None
```

---

## Implementation Steps

### Step 1: Add Import
At top of file (around line 15):
```python
from typing import Any  # Should already exist
# Add if not present:
from cycling_ai.orchestration.base import RAGConfig
```

### Step 2: Modify _create_phase_context()
Replace lines 156-183 with new implementation above.

### Step 3: Add _initialize_rag_manager() Method
Add new method after _create_phase_context() (around line 184).

### Step 4: Update Type Hints
Ensure all type hints are correct:
- Import `Any` from typing (should already exist)
- RAGConfig imported from orchestration.base
- RAGManager imported dynamically to avoid circular import

---

## Testing

### Unit Tests

**Location:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/tests/orchestration/test_base_workflow.py`

**Test 1: RAG Manager Created When Enabled**
```python
def test_create_phase_context_with_rag_enabled(tmp_path):
    """Test that RAGManager is created when RAG enabled."""
    from cycling_ai.orchestration.base import RAGConfig, WorkflowConfig
    from cycling_ai.orchestration.workflows.base_workflow import BaseWorkflow
    from unittest.mock import Mock

    # Create populated vectorstore directory
    vectorstore_path = tmp_path / "vectorstore"
    vectorstore_path.mkdir()
    (vectorstore_path / "chroma.sqlite3").touch()  # Mock DB file

    # Create RAG config with enabled=True
    rag_config = RAGConfig(
        enabled=True,
        project_vectorstore_path=vectorstore_path,
    )

    config = WorkflowConfig(
        csv_file_path=tmp_path / "test.csv",
        athlete_profile_path=tmp_path / "profile.json",
        training_plan_weeks=12,
        rag_config=rag_config,
    )

    # Create workflow (use concrete implementation or mock)
    provider = Mock()
    workflow = BaseWorkflow(provider=provider)

    # Create phase context
    context = workflow._create_phase_context(config, {})

    # RAGManager should be initialized
    assert context.rag_manager is not None
    assert context.config.rag_config.enabled is True
```

**Test 2: No RAG Manager When Disabled**
```python
def test_create_phase_context_with_rag_disabled(tmp_path):
    """Test that RAGManager is NOT created when RAG disabled."""
    from cycling_ai.orchestration.base import RAGConfig, WorkflowConfig
    from cycling_ai.orchestration.workflows.base_workflow import BaseWorkflow
    from unittest.mock import Mock

    # RAG config with enabled=False (default)
    rag_config = RAGConfig(enabled=False)

    config = WorkflowConfig(
        csv_file_path=tmp_path / "test.csv",
        athlete_profile_path=tmp_path / "profile.json",
        training_plan_weeks=12,
        rag_config=rag_config,
    )

    provider = Mock()
    workflow = BaseWorkflow(provider=provider)

    context = workflow._create_phase_context(config, {})

    # RAGManager should be None
    assert context.rag_manager is None
    assert context.config.rag_config.enabled is False
```

**Test 3: Graceful Degradation - Missing Vectorstore**
```python
def test_create_phase_context_rag_missing_vectorstore(tmp_path, caplog):
    """Test graceful degradation when vectorstore missing."""
    from cycling_ai.orchestration.base import RAGConfig, WorkflowConfig
    from cycling_ai.orchestration.workflows.base_workflow import BaseWorkflow
    from unittest.mock import Mock

    # Point to non-existent vectorstore
    missing_path = tmp_path / "nonexistent"

    rag_config = RAGConfig(
        enabled=True,
        project_vectorstore_path=missing_path,
    )

    config = WorkflowConfig(
        csv_file_path=tmp_path / "test.csv",
        athlete_profile_path=tmp_path / "profile.json",
        training_plan_weeks=12,
        rag_config=rag_config,
    )

    provider = Mock()
    workflow = BaseWorkflow(provider=provider)

    context = workflow._create_phase_context(config, {})

    # Should degrade gracefully
    assert context.rag_manager is None
    assert "not found" in caplog.text.lower()
```

**Test 4: RAG Config Propagates to Context**
```python
def test_rag_config_propagates_to_context(tmp_path):
    """Test that RAGConfig is accessible in PhaseContext."""
    from cycling_ai.orchestration.base import RAGConfig, WorkflowConfig
    from cycling_ai.orchestration.workflows.base_workflow import BaseWorkflow
    from unittest.mock import Mock

    rag_config = RAGConfig(
        enabled=True,
        top_k=5,
        min_score=0.7,
    )

    config = WorkflowConfig(
        csv_file_path=tmp_path / "test.csv",
        athlete_profile_path=tmp_path / "profile.json",
        training_plan_weeks=12,
        rag_config=rag_config,
    )

    provider = Mock()
    workflow = BaseWorkflow(provider=provider)

    context = workflow._create_phase_context(config, {})

    # Config should be accessible
    assert context.config.rag_config.enabled is True
    assert context.config.rag_config.top_k == 5
    assert context.config.rag_config.min_score == 0.7
```

**Test 5: Backward Compatibility**
```python
def test_backward_compatibility_no_rag(tmp_path):
    """Test that workflow works without RAG (backward compatibility)."""
    from cycling_ai.orchestration.base import WorkflowConfig
    from cycling_ai.orchestration.workflows.base_workflow import BaseWorkflow
    from unittest.mock import Mock

    # No RAGConfig specified (uses default)
    config = WorkflowConfig(
        csv_file_path=tmp_path / "test.csv",
        athlete_profile_path=tmp_path / "profile.json",
        training_plan_weeks=12,
        # rag_config uses default (enabled=False)
    )

    provider = Mock()
    workflow = BaseWorkflow(provider=provider)

    context = workflow._create_phase_context(config, {})

    # Should work with None RAG manager
    assert context.rag_manager is None
    assert context.config.rag_config.enabled is False
```

---

## Manual Validation

### Step 1: Populate Vectorstore
```bash
cd /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement

# Index domain knowledge
cycling-ai index domain-knowledge

# Verify vectorstore created
ls -la data/vectorstore/
```

### Step 2: Create Test Script
**File:** `/tmp/test_rag_initialization.py`
```python
#!/usr/bin/env python3
"""
Test RAG initialization in workflow.
"""
from pathlib import Path
from cycling_ai.orchestration.base import RAGConfig, WorkflowConfig
from cycling_ai.orchestration.workflows.full_report import FullReportWorkflow
from unittest.mock import Mock

# Setup
project_root = Path(__file__).parent.parent.parent
vectorstore_path = project_root / "data" / "vectorstore"

# Test 1: RAG Enabled
print("Test 1: RAG Enabled")
rag_config_enabled = RAGConfig(
    enabled=True,
    project_vectorstore_path=vectorstore_path,
)

config_enabled = WorkflowConfig(
    csv_file_path=project_root / "test_data" / "activities.csv",
    athlete_profile_path=project_root / "test_data" / "profile.json",
    training_plan_weeks=12,
    rag_config=rag_config_enabled,
)

provider = Mock()
workflow = FullReportWorkflow(provider=provider)

context_enabled = workflow._create_phase_context(config_enabled, {})
print(f"  RAG Manager created: {context_enabled.rag_manager is not None}")
print(f"  Expected: True\n")

# Test 2: RAG Disabled
print("Test 2: RAG Disabled")
config_disabled = WorkflowConfig(
    csv_file_path=project_root / "test_data" / "activities.csv",
    athlete_profile_path=project_root / "test_data" / "profile.json",
    training_plan_weeks=12,
    # No rag_config = default (disabled)
)

context_disabled = workflow._create_phase_context(config_disabled, {})
print(f"  RAG Manager created: {context_disabled.rag_manager is not None}")
print(f"  Expected: False")
```

### Step 3: Run Test
```bash
cd /Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement
python /tmp/test_rag_initialization.py
```

**Expected Output:**
```
Test 1: RAG Enabled
  RAG Manager created: True
  Expected: True

Test 2: RAG Disabled
  RAG Manager created: False
  Expected: False
```

---

## Acceptance Criteria

- [ ] `_create_phase_context()` modified to check `config.rag_config.enabled`
- [ ] `_initialize_rag_manager()` method added
- [ ] RAGManager created when RAG enabled AND vectorstore exists
- [ ] RAGManager is None when RAG disabled
- [ ] Graceful degradation: RAGManager is None if vectorstore missing (with warning)
- [ ] 5 unit tests pass
- [ ] Manual test shows RAGManager created correctly
- [ ] mypy --strict passes
- [ ] No backward compatibility breakage

---

## Troubleshooting

### Issue: ImportError for RAGManager
**Solution:** Import is inside method to avoid circular dependency:
```python
from cycling_ai.rag.manager import RAGManager  # Inside _initialize_rag_manager()
```

### Issue: BaseWorkflow is abstract
**Solution:** For testing, use concrete implementation (FullReportWorkflow) or mock get_phases() and execute_workflow():
```python
class TestWorkflow(BaseWorkflow):
    def get_phases(self):
        return []
    def execute_workflow(self, config):
        pass
```

### Issue: Vectorstore not found warning
**Solution:** Run indexing first:
```bash
cycling-ai index domain-knowledge
```

---

## Dependencies

**Before this card:**
- Phase 1 complete (RAGManager class exists)
- Phase 2 complete (vectorstore can be populated)

**After this card:**
- Card 7: Phase-specific retrieval (depends on RAGManager being available)
- Card 8: CLI integration (depends on RAGManager being initialized)

---

## Estimated Time Breakdown

- Code changes: 1 hour
- Unit tests: 1.5 hours
- Manual validation: 0.5 hours
- Debugging/fixes: 0.5-1 hour
- **Total: 3-4 hours**

---

## Notes

- This is the **most critical card** - without it, RAG never activates
- All other RAG features depend on this working
- Graceful degradation is important - don't crash if vectorstore missing
- Logging is important for debugging RAG issues
- Type hints must be correct for mypy --strict compliance
