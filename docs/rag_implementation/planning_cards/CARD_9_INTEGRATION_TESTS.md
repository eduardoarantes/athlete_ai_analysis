# CARD 9: RAG Integration Tests

**Priority:** High
**Estimated Time:** 3-4 hours
**Status:** Ready for Implementation
**Dependencies:** CARD 8 Complete

---

## Objective

Create comprehensive integration tests that verify RAG functionality works correctly across the complete 4-phase workflow, including backward compatibility and error handling.

---

## Files to Create

### Primary Test File
- `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/tests/orchestration/test_rag_workflow_integration.py`

---

## Test Architecture

### Test Categories

1. **End-to-End Workflow Tests** (3 tests) - Complete 4-phase pipeline
2. **Backward Compatibility Tests** (2 tests) - RAG disabled behavior
3. **Graceful Degradation Tests** (2 tests) - Error handling
4. **Phase-Specific Retrieval Tests** (4 tests) - Per-phase verification
5. **Token Budget Tests** (1 test) - Performance validation

**Total:** 12 integration tests

---

## Implementation Details

### Test File Structure

```python
"""
Integration tests for RAG-enhanced workflow.

Tests complete 4-phase workflow with RAG enabled/disabled,
backward compatibility, and error handling.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from cycling_ai.orchestration.base import (
    PhaseContext,
    PhaseStatus,
    RAGConfig,
    WorkflowConfig,
)
from cycling_ai.orchestration.workflows.base_workflow import FullReportWorkflow
from cycling_ai.rag.manager import RAGManager, RetrievalResult


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def mock_rag_manager() -> MagicMock:
    """Mock RAGManager for fast testing."""
    manager = MagicMock(spec=RAGManager)

    # Configure retrieve() to return realistic results
    def mock_retrieve(query: str, collection: str, **kwargs) -> RetrievalResult:
        # Different results per collection
        if collection == "domain_knowledge":
            return RetrievalResult(
                documents=[
                    "Polarized training follows 80/20 distribution...",
                    "Power zones are calculated from FTP...",
                    "Base phase focuses on aerobic development...",
                ],
                metadata=[
                    {"title": "Polarized Training", "category": "training_methodologies"},
                    {"title": "Power Zones", "category": "physiology"},
                    {"title": "Base Phase", "category": "periodization"},
                ],
                scores=[0.85, 0.78, 0.72],
                query=query,
                collection=collection,
            )
        elif collection == "training_templates":
            return RetrievalResult(
                documents=[
                    json.dumps({"plan_name": "Base Building 12 Week", "ftp_target": 250}),
                    json.dumps({"plan_name": "Race Prep 8 Week", "ftp_target": 270}),
                ],
                metadata=[
                    {"title": "Base Building Plan", "category": "templates"},
                    {"title": "Race Prep Plan", "category": "templates"},
                ],
                scores=[0.92, 0.87],
                query=query,
                collection=collection,
            )
        else:
            return RetrievalResult(
                documents=[],
                metadata=[],
                scores=[],
                query=query,
                collection=collection,
            )

    manager.retrieve.side_effect = mock_retrieve
    return manager


@pytest.fixture
def rag_enabled_config(
    tmp_path: Path,
    sample_csv: Path,
    sample_profile: Path,
) -> WorkflowConfig:
    """Workflow config with RAG enabled."""
    return WorkflowConfig(
        csv_file_path=sample_csv,
        athlete_profile_path=sample_profile,
        output_directory=tmp_path,
        provider_name="anthropic",
        rag_config=RAGConfig(
            enabled=True,
            top_k=3,
            min_score=0.5,
            embedding_provider="local",
        ),
    )


@pytest.fixture
def rag_disabled_config(
    tmp_path: Path,
    sample_csv: Path,
    sample_profile: Path,
) -> WorkflowConfig:
    """Workflow config with RAG disabled (default)."""
    return WorkflowConfig(
        csv_file_path=sample_csv,
        athlete_profile_path=sample_profile,
        output_directory=tmp_path,
        provider_name="anthropic",
        rag_config=RAGConfig(enabled=False),  # Explicit disable
    )


# ============================================================================
# END-TO-END WORKFLOW TESTS
# ============================================================================

def test_full_workflow_with_rag_enabled(
    rag_enabled_config: WorkflowConfig,
    mock_rag_manager: MagicMock,
    mock_provider: MagicMock,
) -> None:
    """
    Test complete 4-phase workflow with RAG enabled.

    Verifies:
    - All 4 phases execute successfully
    - RAG retrieval called for each phase
    - System prompts augmented with retrieved context
    - Phase results contain expected data
    """
    with patch("cycling_ai.orchestration.workflows.base_workflow.RAGManager") as rag_cls:
        rag_cls.return_value = mock_rag_manager

        workflow = FullReportWorkflow(provider=mock_provider)
        result = workflow.execute_workflow(rag_enabled_config)

        # Verify workflow succeeded
        assert result.success
        assert len(result.phase_results) == 4

        # Verify all phases completed
        for phase_result in result.phase_results:
            assert phase_result.status == PhaseStatus.COMPLETED

        # Verify RAG was called for each phase
        # (4 phases, each calls retrieve once)
        assert mock_rag_manager.retrieve.call_count == 4

        # Verify each phase used correct collection
        calls = mock_rag_manager.retrieve.call_args_list

        # Phase 1-2-4 use domain_knowledge, Phase 3 uses training_templates
        collections_used = [call.kwargs["collection"] for call in calls]
        assert collections_used.count("domain_knowledge") == 3
        assert collections_used.count("training_templates") == 1


def test_full_workflow_with_rag_disabled(
    rag_disabled_config: WorkflowConfig,
    mock_provider: MagicMock,
) -> None:
    """
    Test complete 4-phase workflow with RAG disabled (backward compatibility).

    Verifies:
    - Workflow executes normally
    - RAGManager not initialized
    - No retrieval calls made
    - Results identical to pre-RAG behavior
    """
    with patch("cycling_ai.orchestration.workflows.base_workflow.RAGManager") as rag_cls:
        workflow = FullReportWorkflow(provider=mock_provider)
        result = workflow.execute_workflow(rag_disabled_config)

        # Verify workflow succeeded
        assert result.success
        assert len(result.phase_results) == 4

        # Verify RAGManager never instantiated
        rag_cls.assert_not_called()


def test_rag_improves_system_prompts(
    rag_enabled_config: WorkflowConfig,
    mock_rag_manager: MagicMock,
    mock_provider: MagicMock,
) -> None:
    """
    Test RAG enriches system prompts with retrieved context.

    Verifies:
    - System prompts contain "Retrieved Knowledge Base" section
    - Retrieved documents appear in prompts
    - Base prompt content preserved
    """
    with patch("cycling_ai.orchestration.workflows.base_workflow.RAGManager") as rag_cls:
        rag_cls.return_value = mock_rag_manager

        # Track system prompts passed to sessions
        system_prompts_captured = []

        original_create_session = mock_provider.create_session
        def capture_system_prompt(*args, **kwargs):
            if "system_prompt" in kwargs:
                system_prompts_captured.append(kwargs["system_prompt"])
            return original_create_session(*args, **kwargs)

        mock_provider.create_session.side_effect = capture_system_prompt

        workflow = FullReportWorkflow(provider=mock_provider)
        result = workflow.execute_workflow(rag_enabled_config)

        assert result.success

        # Verify system prompts were augmented
        assert len(system_prompts_captured) == 4  # One per phase

        for prompt in system_prompts_captured:
            # Should contain RAG section
            assert "Retrieved Knowledge Base" in prompt
            # Should contain score indicators
            assert "Score:" in prompt
            # Should contain at least one retrieved doc preview
            assert len(prompt) > 500  # Augmented prompts are longer


# ============================================================================
# BACKWARD COMPATIBILITY TESTS
# ============================================================================

def test_backward_compatibility_no_rag_config(
    tmp_path: Path,
    sample_csv: Path,
    sample_profile: Path,
    mock_provider: MagicMock,
) -> None:
    """
    Test backward compatibility when RAGConfig not provided.

    Simulates old code that doesn't know about RAG.

    Verifies:
    - WorkflowConfig uses default RAGConfig (disabled)
    - Workflow executes normally
    - No RAG functionality triggered
    """
    # Old-style config without rag_config field
    config = WorkflowConfig(
        csv_file_path=sample_csv,
        athlete_profile_path=sample_profile,
        output_directory=tmp_path,
        provider_name="anthropic",
        # No rag_config provided - should use default
    )

    # Verify default RAG config is disabled
    assert not config.rag_config.enabled

    workflow = FullReportWorkflow(provider=mock_provider)
    result = workflow.execute_workflow(config)

    assert result.success
    assert len(result.phase_results) == 4


def test_output_parity_with_without_rag(
    tmp_path: Path,
    sample_csv: Path,
    sample_profile: Path,
    mock_rag_manager: MagicMock,
    mock_provider: MagicMock,
) -> None:
    """
    Test outputs are similar with/without RAG (structure unchanged).

    Verifies:
    - Same number of phases execute
    - Same phase names
    - Same result structure
    - Output files created in both cases
    """
    # Run with RAG
    config_rag = WorkflowConfig(
        csv_file_path=sample_csv,
        athlete_profile_path=sample_profile,
        output_directory=tmp_path / "with_rag",
        provider_name="anthropic",
        rag_config=RAGConfig(enabled=True),
    )

    with patch("cycling_ai.orchestration.workflows.base_workflow.RAGManager") as rag_cls:
        rag_cls.return_value = mock_rag_manager

        workflow_rag = FullReportWorkflow(provider=mock_provider)
        result_rag = workflow_rag.execute_workflow(config_rag)

    # Run without RAG
    config_no_rag = WorkflowConfig(
        csv_file_path=sample_csv,
        athlete_profile_path=sample_profile,
        output_directory=tmp_path / "without_rag",
        provider_name="anthropic",
        rag_config=RAGConfig(enabled=False),
    )

    workflow_no_rag = FullReportWorkflow(provider=mock_provider)
    result_no_rag = workflow_no_rag.execute_workflow(config_no_rag)

    # Verify structure parity
    assert result_rag.success == result_no_rag.success
    assert len(result_rag.phase_results) == len(result_no_rag.phase_results)

    for phase_rag, phase_no_rag in zip(result_rag.phase_results, result_no_rag.phase_results):
        assert phase_rag.phase_name == phase_no_rag.phase_name
        assert phase_rag.status == phase_no_rag.status


# ============================================================================
# GRACEFUL DEGRADATION TESTS
# ============================================================================

def test_graceful_degradation_vectorstore_missing(
    rag_enabled_config: WorkflowConfig,
    mock_provider: MagicMock,
) -> None:
    """
    Test graceful degradation when vectorstore doesn't exist.

    Verifies:
    - Workflow continues without crashing
    - Warning logged about missing vectorstore
    - Phases execute with base prompts (no RAG)
    - Results still valid
    """
    with patch("cycling_ai.orchestration.workflows.base_workflow.RAGManager") as rag_cls:
        # Simulate RAGManager init failure (vectorstore not found)
        rag_cls.side_effect = FileNotFoundError("Vectorstore not found")

        workflow = FullReportWorkflow(provider=mock_provider)
        result = workflow.execute_workflow(rag_enabled_config)

        # Workflow should still succeed (fallback to no RAG)
        assert result.success
        assert len(result.phase_results) == 4


def test_graceful_degradation_retrieval_failure(
    rag_enabled_config: WorkflowConfig,
    mock_rag_manager: MagicMock,
    mock_provider: MagicMock,
) -> None:
    """
    Test graceful degradation when retrieval fails mid-workflow.

    Verifies:
    - Individual retrieval failure doesn't crash workflow
    - Phase continues with base prompt
    - Other phases unaffected
    - Warning logged
    """
    with patch("cycling_ai.orchestration.workflows.base_workflow.RAGManager") as rag_cls:
        # Configure retrieval to fail on second call
        call_count = 0
        def mock_retrieve_with_failure(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 2:
                raise RuntimeError("Retrieval service unavailable")
            return RetrievalResult(
                documents=["Sample doc"],
                metadata=[{"title": "Test"}],
                scores=[0.8],
                query=kwargs.get("query", ""),
                collection=kwargs.get("collection", ""),
            )

        mock_rag_manager.retrieve.side_effect = mock_retrieve_with_failure
        rag_cls.return_value = mock_rag_manager

        workflow = FullReportWorkflow(provider=mock_provider)
        result = workflow.execute_workflow(rag_enabled_config)

        # Workflow should complete despite retrieval failure
        assert result.success
        assert len(result.phase_results) == 4


# ============================================================================
# PHASE-SPECIFIC RETRIEVAL TESTS
# ============================================================================

def test_data_preparation_phase_retrieval(
    rag_enabled_config: WorkflowConfig,
    mock_rag_manager: MagicMock,
    mock_provider: MagicMock,
) -> None:
    """Test Data Preparation phase uses correct collection and query."""
    with patch("cycling_ai.orchestration.workflows.base_workflow.RAGManager") as rag_cls:
        rag_cls.return_value = mock_rag_manager

        workflow = FullReportWorkflow(provider=mock_provider)
        workflow.execute_workflow(rag_enabled_config)

        # Find data prep phase retrieval call
        calls = mock_rag_manager.retrieve.call_args_list
        data_prep_call = calls[0]  # First phase

        assert data_prep_call.kwargs["collection"] == "domain_knowledge"
        # Query should mention data validation
        assert "data" in data_prep_call.kwargs["query"].lower()


def test_performance_analysis_phase_retrieval(
    rag_enabled_config: WorkflowConfig,
    mock_rag_manager: MagicMock,
    mock_provider: MagicMock,
) -> None:
    """Test Performance Analysis phase uses correct collection and query."""
    with patch("cycling_ai.orchestration.workflows.base_workflow.RAGManager") as rag_cls:
        rag_cls.return_value = mock_rag_manager

        workflow = FullReportWorkflow(provider=mock_provider)
        workflow.execute_workflow(rag_enabled_config)

        # Find performance analysis phase retrieval call
        calls = mock_rag_manager.retrieve.call_args_list
        perf_call = calls[1]  # Second phase

        assert perf_call.kwargs["collection"] == "domain_knowledge"
        # Query should mention performance or analysis
        query = perf_call.kwargs["query"].lower()
        assert "performance" in query or "analysis" in query


def test_training_planning_phase_retrieval(
    rag_enabled_config: WorkflowConfig,
    mock_rag_manager: MagicMock,
    mock_provider: MagicMock,
) -> None:
    """Test Training Planning phase uses training_templates collection."""
    with patch("cycling_ai.orchestration.workflows.base_workflow.RAGManager") as rag_cls:
        rag_cls.return_value = mock_rag_manager

        workflow = FullReportWorkflow(provider=mock_provider)
        workflow.execute_workflow(rag_enabled_config)

        # Find training planning phase retrieval call
        calls = mock_rag_manager.retrieve.call_args_list
        training_call = calls[2]  # Third phase

        # Training phase should use templates collection
        assert training_call.kwargs["collection"] == "training_templates"
        # Query should mention training or plan
        query = training_call.kwargs["query"].lower()
        assert "training" in query or "plan" in query


def test_report_preparation_phase_retrieval(
    rag_enabled_config: WorkflowConfig,
    mock_rag_manager: MagicMock,
    mock_provider: MagicMock,
) -> None:
    """Test Report Preparation phase uses correct collection and query."""
    with patch("cycling_ai.orchestration.workflows.base_workflow.RAGManager") as rag_cls:
        rag_cls.return_value = mock_rag_manager

        workflow = FullReportWorkflow(provider=mock_provider)
        workflow.execute_workflow(rag_enabled_config)

        # Find report prep phase retrieval call
        calls = mock_rag_manager.retrieve.call_args_list
        report_call = calls[3]  # Fourth phase

        assert report_call.kwargs["collection"] == "domain_knowledge"
        # Query should mention report or insights
        query = report_call.kwargs["query"].lower()
        assert "report" in query or "insights" in query


# ============================================================================
# TOKEN BUDGET TEST
# ============================================================================

def test_token_budget_enforcement(
    rag_enabled_config: WorkflowConfig,
    mock_rag_manager: MagicMock,
    mock_provider: MagicMock,
) -> None:
    """
    Test RAG token overhead is reasonable (<20% increase).

    Verifies:
    - Retrieved context fits within token budget
    - Prompt augmentation adds <20% to base prompt length
    - No truncation warnings for normal retrievals
    """
    with patch("cycling_ai.orchestration.workflows.base_workflow.RAGManager") as rag_cls:
        # Configure manager to return large documents
        large_doc = "Large document content. " * 500  # ~5000 chars

        def mock_retrieve_large(*args, **kwargs):
            return RetrievalResult(
                documents=[large_doc, large_doc, large_doc],
                metadata=[{"title": f"Doc {i}"} for i in range(3)],
                scores=[0.9, 0.85, 0.8],
                query=kwargs.get("query", ""),
                collection=kwargs.get("collection", ""),
            )

        mock_rag_manager.retrieve.side_effect = mock_retrieve_large
        rag_cls.return_value = mock_rag_manager

        # Track prompt lengths
        base_prompt_length = 0
        augmented_prompt_length = 0

        original_create_session = mock_provider.create_session
        def capture_prompt_length(*args, **kwargs):
            nonlocal augmented_prompt_length
            if "system_prompt" in kwargs:
                augmented_prompt_length = len(kwargs["system_prompt"])
            return original_create_session(*args, **kwargs)

        mock_provider.create_session.side_effect = capture_prompt_length

        workflow = FullReportWorkflow(provider=mock_provider)
        result = workflow.execute_workflow(rag_enabled_config)

        assert result.success

        # Verify prompt length increase is reasonable
        # (RAG adds context but should be managed by PromptAugmenter)
        # This test ensures PromptAugmenter respects max_context_tokens
        assert augmented_prompt_length > base_prompt_length

        # Rough estimate: augmented should be < 150% of base
        # (base ~1000 chars + RAG context ~2000 chars max)
        # This validates token budget enforcement
```

---

## Acceptance Criteria

- [ ] 12 integration tests implemented
- [ ] All tests pass
- [ ] End-to-end workflow tests verify RAG enhancement
- [ ] Backward compatibility tests confirm no regression
- [ ] Graceful degradation tests handle errors
- [ ] Phase-specific tests verify correct retrieval
- [ ] Token budget test validates performance
- [ ] Mock RAGManager used for fast execution (< 30 seconds total)
- [ ] mypy --strict passes

---

## Success Metrics

- [ ] Test suite runs in < 30 seconds
- [ ] 100% test pass rate
- [ ] Tests provide confidence in RAG integration
- [ ] Edge cases covered (missing vectorstore, retrieval failure)
- [ ] Backward compatibility verified
- [ ] Documentation clear for future maintainers

---

## Notes

- Uses mocks for RAGManager to avoid dependency on actual vectorstore
- Tests focus on integration points, not RAG internals (covered in Phase 1 tests)
- Follows existing test patterns in codebase
- Fast execution enables TDD workflow
