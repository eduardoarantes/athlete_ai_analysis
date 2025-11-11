# Phase 3 Implementation Plan: RAG-Enhanced Agent Integration

**Version:** 1.0
**Date:** 2025-11-07
**Status:** Ready for Execution
**Branch:** `rag-vectorstore-improvement`
**Phase:** 3 of 8 (RAG-Enhanced Agent Integration)
**Architect:** Task Implementation Preparation Agent

---

## Executive Summary

This plan details the implementation of **Phase 3: RAG-Enhanced Agent Integration** for the Cycling AI Analysis RAG Integration project. Phases 1 (RAG Foundation) and 2 (Knowledge Base) are complete with a fully populated vectorstore containing 29 domain knowledge chunks and 11 training templates.

**Phase 3 Goals:**
1. Integrate RAGManager into the multi-agent orchestration system
2. Implement prompt augmentation with retrieved context
3. Add RAG configuration options to WorkflowConfig and CLI
4. Maintain backward compatibility (RAG optional, disabled by default)
5. Ensure session isolation is preserved
6. Achieve 90%+ test coverage with full type safety

**Key Innovation:** RAG sits at the system prompt level, providing relevant context BEFORE agent execution without contaminating conversation history. This maintains session isolation while enriching each phase with domain-specific knowledge.

---

## Architecture Analysis

### Current State: Working Components

**Phase 1 Complete (commit f0925ce):**
- `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/rag/embeddings.py` - EmbeddingFactory
- `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/rag/vectorstore.py` - ChromaVectorStore
- `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/rag/manager.py` - RAGManager (two-vectorstore design)
- 100% test coverage, mypy --strict compliant

**Phase 2 Complete (commit 40e2e82):**
- 5 domain knowledge markdown files in `data/knowledge/domain/`
- 11 training templates in `data/knowledge/templates/training_plans.json`
- `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/rag/indexing.py` - KnowledgeIndexer
- CLI commands: `cycling-ai index domain`, `cycling-ai index templates`
- Vectorstore populated: 29 domain chunks + 11 templates = 40 documents

**Existing Orchestration Architecture:**
```
MultiAgentOrchestrator (backward compat wrapper)
    ↓
FullReportWorkflow (execute_workflow)
    ↓
4 Phase Modules (inherit from BasePhase):
    1. DataPreparationPhase
    2. PerformanceAnalysisPhase
    3. TrainingPlanningPhase
    4. ReportPreparationPhase
    ↓
BasePhase.execute() [Template Method Pattern]:
    1. Create isolated session
    2. Get system prompt (_get_system_prompt - ABSTRACT)
    3. Create agent with filtered tools
    4. Execute agent with user message
    5. Extract data from session (_extract_data - ABSTRACT)
```

**Key Insight:** The BasePhase template method provides the perfect integration point. We augment the system prompt BEFORE session creation, maintaining complete isolation.

---

## Integration Strategy

### Design Principle: Prompt Augmentation at System Level

**Pattern:** Retrieve → Format → Inject into System Prompt → Create Session

```python
# BEFORE (Phase 2):
system_prompt = self._get_system_prompt(config, context)
session = session_manager.create_session(system_prompt=system_prompt)

# AFTER (Phase 3):
base_prompt = self._get_system_prompt(config, context)

if config.enable_rag:
    # Retrieve relevant context
    retrieval = rag_manager.retrieve(query=retrieval_query, ...)

    # Format retrieved docs
    context_section = format_retrieved_context(retrieval)

    # Augment system prompt
    system_prompt = f"{base_prompt}\n\n{context_section}"
else:
    system_prompt = base_prompt

session = session_manager.create_session(system_prompt=system_prompt)
```

**Why This Works:**
1. Session isolation preserved - RAG context in system prompt, not history
2. No contamination between phases - each gets fresh retrieval
3. Backward compatible - if RAG disabled, original flow unchanged
4. Clean separation - phases don't know about RAG, BasePhase handles it

---

## Implementation Design

### Component 1: RAGConfig (New Dataclass)

**Purpose:** Configure RAG behavior per workflow

**Location:** Add to `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/orchestration/base.py`

```python
@dataclass
class RAGConfig:
    """
    RAG configuration for workflow.

    Controls retrieval behavior across all phases.
    """
    enabled: bool = False
    top_k: int = 3
    min_score: float = 0.5

    # Per-phase retrieval customization
    phase_settings: dict[str, dict[str, Any]] = field(default_factory=dict)

    # Vectorstore paths
    project_vectorstore_path: Path = field(
        default_factory=lambda: Path(__file__).parent.parent.parent.parent / "data" / "vectorstore"
    )
    user_vectorstore_path: Path | None = None

    # Embedding config
    embedding_provider: str = "local"
    embedding_model: str | None = None
```

### Component 2: PromptAugmenter (New Module)

**Purpose:** Format retrieved documents into prompt sections

**Location:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/orchestration/rag_integration.py`

```python
class PromptAugmenter:
    """
    Formats retrieved documents for prompt injection.

    Handles:
    - Document ranking and filtering
    - Context formatting with sources
    - Token budget management
    """

    def __init__(self, max_context_tokens: int = 2000):
        self.max_context_tokens = max_context_tokens

    def augment_system_prompt(
        self,
        base_prompt: str,
        retrieval_result: RetrievalResult
    ) -> str:
        """
        Augment system prompt with retrieved context.

        Format:
        [Original System Prompt]

        ## Retrieved Knowledge Base

        The following relevant information has been retrieved from the knowledge base:

        ### Document 1: [Title] (Score: 0.85)
        [Content]

        ### Document 2: [Title] (Score: 0.78)
        [Content]

        Please use this information to inform your analysis while maintaining
        objectivity and accuracy.
        """
        pass
```

### Component 3: BasePhase RAG Integration

**Purpose:** Inject RAG into phase execution template

**Location:** Modify `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/orchestration/phases/base_phase.py`

**Changes:**
1. Add `rag_manager: RAGManager | None` to `PhaseContext`
2. Modify `execute()` to augment prompt if RAG enabled
3. Add `_get_retrieval_query()` abstract method (optional override)

```python
class BasePhase(ABC):
    def execute(self, context: PhaseContext) -> PhaseResult:
        # ... existing setup ...

        # Get base system prompt
        base_prompt = self._get_system_prompt(config, previous_data)

        # RAG augmentation (if enabled)
        if context.rag_manager and context.config.rag_config.enabled:
            retrieval_query = self._get_retrieval_query(config, previous_data)
            collection = self._get_retrieval_collection()

            retrieval_result = context.rag_manager.retrieve(
                query=retrieval_query,
                collection=collection,
                top_k=context.config.rag_config.top_k,
                min_score=context.config.rag_config.min_score,
            )

            augmenter = PromptAugmenter()
            system_prompt = augmenter.augment_system_prompt(
                base_prompt=base_prompt,
                retrieval_result=retrieval_result,
            )
        else:
            system_prompt = base_prompt

        # Create session with augmented prompt
        session = session_manager.create_session(system_prompt=system_prompt)

        # ... continue with agent execution ...

    def _get_retrieval_query(
        self, config: WorkflowConfig, previous_data: dict
    ) -> str:
        """
        Build retrieval query for this phase.

        Default: Use phase name and config context.
        Subclasses can override for custom queries.
        """
        return f"{self.phase_name} cycling analysis"

    @abstractmethod
    def _get_retrieval_collection(self) -> str:
        """Get collection name for retrieval (e.g., 'domain_knowledge')."""
        pass
```

### Component 4: Phase-Specific Retrieval Strategies

**Purpose:** Customize retrieval per phase

**Implementation:** Override `_get_retrieval_query()` in each phase

**DataPreparationPhase:**
```python
def _get_retrieval_query(self, config, previous_data) -> str:
    return "data validation best practices cycling FIT file CSV processing"

def _get_retrieval_collection(self) -> str:
    return "domain_knowledge"
```

**PerformanceAnalysisPhase:**
```python
def _get_retrieval_query(self, config, previous_data) -> str:
    return f"performance analysis training zones FTP {config.period_months} months comparison"

def _get_retrieval_collection(self) -> str:
    return "domain_knowledge"
```

**TrainingPlanningPhase:**
```python
def _get_retrieval_query(self, config, previous_data) -> str:
    ftp = previous_data.get("athlete_ftp", 250)
    return f"training plan periodization {config.training_plan_weeks} weeks FTP {ftp}W"

def _get_retrieval_collection(self) -> str:
    return "training_templates"  # Retrieve plan templates
```

**ReportPreparationPhase:**
```python
def _get_retrieval_query(self, config, previous_data) -> str:
    return "report generation coaching insights performance summary"

def _get_retrieval_collection(self) -> str:
    return "domain_knowledge"
```

### Component 5: WorkflowConfig RAG Options

**Purpose:** CLI integration

**Location:** Modify `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/orchestration/base.py`

```python
@dataclass
class WorkflowConfig:
    # ... existing fields ...

    # RAG configuration
    rag_config: RAGConfig = field(default_factory=RAGConfig)
```

### Component 6: CLI Integration

**Purpose:** Add `--enable-rag` flag

**Location:** Modify `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/cli/commands/generate.py`

```python
@click.option(
    "--enable-rag",
    is_flag=True,
    default=False,
    help="Enable RAG-enhanced prompts (retrieves from knowledge base)",
)
@click.option(
    "--rag-top-k",
    type=int,
    default=3,
    help="Number of documents to retrieve per phase (default: 3)",
)
@click.option(
    "--rag-min-score",
    type=float,
    default=0.5,
    help="Minimum similarity score for retrieval (0-1, default: 0.5)",
)
def generate(
    # ... existing params ...
    enable_rag: bool,
    rag_top_k: int,
    rag_min_score: float,
) -> None:
    # ... create config ...

    rag_config = RAGConfig(
        enabled=enable_rag,
        top_k=rag_top_k,
        min_score=rag_min_score,
    )

    config = WorkflowConfig(
        # ... existing fields ...
        rag_config=rag_config,
    )
```

---

## File Modification Plan

### Files to Modify

1. **`/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/orchestration/base.py`**
   - Add `RAGConfig` dataclass
   - Add `rag_config: RAGConfig` field to `WorkflowConfig`
   - Add `rag_manager: RAGManager | None` field to `PhaseContext`

2. **`/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/orchestration/phases/base_phase.py`**
   - Add `_get_retrieval_query()` method
   - Add `_get_retrieval_collection()` abstract method
   - Modify `execute()` to augment prompt with RAG

3. **`/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/orchestration/phases/data_preparation.py`**
   - Implement `_get_retrieval_query()`
   - Implement `_get_retrieval_collection()`

4. **`/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/orchestration/phases/performance_analysis.py`**
   - Implement `_get_retrieval_query()`
   - Implement `_get_retrieval_collection()`

5. **`/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/orchestration/phases/training_planning.py`**
   - Implement `_get_retrieval_query()`
   - Implement `_get_retrieval_collection()`

6. **`/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/orchestration/phases/report_preparation.py`**
   - Implement `_get_retrieval_query()`
   - Implement `_get_retrieval_collection()`

7. **`/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/orchestration/workflows/base_workflow.py`**
   - Modify `_create_phase_context()` to include `rag_manager`
   - Initialize RAGManager if RAG enabled

8. **`/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/cli/commands/generate.py`**
   - Add `--enable-rag`, `--rag-top-k`, `--rag-min-score` options
   - Create `RAGConfig` from CLI args

### Files to Create

1. **`/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/src/cycling_ai/orchestration/rag_integration.py`**
   - `PromptAugmenter` class
   - Helper functions for formatting

2. **`/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/tests/orchestration/test_rag_integration.py`**
   - Unit tests for `PromptAugmenter`
   - Integration tests for RAG in phases

3. **`/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/tests/orchestration/test_rag_workflow.py`**
   - End-to-end workflow tests with RAG
   - Backward compatibility tests (RAG disabled)

---

## Testing Strategy

### Test Categories

**1. Unit Tests - PromptAugmenter (10 tests)**
- `test_augment_empty_results` - No documents retrieved
- `test_augment_single_document` - One document
- `test_augment_multiple_documents` - Multiple documents
- `test_token_budget_enforcement` - Truncate if exceeds limit
- `test_score_filtering` - Filter low-score documents
- `test_source_attribution` - Include metadata
- `test_formatting_consistency` - Markdown formatting
- `test_special_characters` - Handle edge cases

**2. Unit Tests - BasePhase RAG Integration (8 tests)**
- `test_execute_without_rag` - Original behavior preserved
- `test_execute_with_rag_enabled` - Augmented prompt
- `test_retrieval_query_generation` - Default query format
- `test_retrieval_collection_routing` - Correct collection
- `test_rag_failure_graceful_degradation` - Fallback to base prompt
- `test_phase_context_rag_manager` - Context propagation

**3. Integration Tests - Phase-Specific Retrieval (12 tests)**
- `test_data_prep_retrieval` - Correct query + collection
- `test_performance_analysis_retrieval` - Context from config
- `test_training_planning_retrieval` - Templates retrieval
- `test_report_prep_retrieval` - Report context
- Each phase: test query generation, collection routing, prompt augmentation

**4. End-to-End Tests (5 tests)**
- `test_full_workflow_with_rag` - Complete 4-phase workflow
- `test_full_workflow_without_rag` - Backward compatibility
- `test_rag_improves_output_quality` - Compare with/without RAG
- `test_token_usage_with_rag` - Token count increase acceptable
- `test_vectorstore_unavailable_fallback` - Graceful degradation

**Test Coverage Goal:** 90%+ on new modules, 85%+ overall orchestration

---

## Success Metrics

### Quantitative Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Test coverage | 90%+ | pytest --cov on new modules |
| Type safety | 100% | mypy --strict passes |
| Backward compatibility | 100% | All existing tests pass with RAG disabled |
| Integration tests | 35+ | Unit + integration + e2e |
| RAG retrieval accuracy | 80%+ | Manual validation of retrieved docs |
| Token overhead | <20% | Compare token usage with/without RAG |

### Acceptance Criteria

- [ ] RAGConfig dataclass implemented and tested
- [ ] PromptAugmenter module created with 10+ tests
- [ ] BasePhase modified with RAG augmentation
- [ ] All 4 phase modules implement retrieval methods
- [ ] CLI accepts --enable-rag flag
- [ ] 35+ tests pass (unit + integration + e2e)
- [ ] mypy --strict passes
- [ ] Backward compatibility verified (RAG disabled = original behavior)
- [ ] Manual testing shows improved response quality
- [ ] Documentation updated (CLAUDE.md, README)

---

## Risk Mitigation

### Risk 1: RAG Overhead Degrades Performance

**Mitigation:**
- Retrieval happens once per phase, not per tool call
- Local embeddings (fast, no API calls)
- Chroma vectorstore optimized for speed
- Default top_k=3 (minimal context)

**Validation:**
- Benchmark workflow execution time with/without RAG
- Expect <10% time increase (retrieval ~50ms per phase)

### Risk 2: Retrieved Context Confuses LLM

**Mitigation:**
- Clear formatting with "Retrieved Knowledge Base" section
- Source attribution for all documents
- Min score filtering (default 0.5) ensures relevance
- System prompt instructs: "use as reference, maintain objectivity"

**Validation:**
- Manual inspection of augmented prompts
- A/B testing with/without RAG
- Monitor for hallucinations or contradictions

### Risk 3: Backward Compatibility Breaks

**Mitigation:**
- RAG disabled by default
- All existing tests run without RAG
- Graceful degradation if vectorstore unavailable
- No changes to phase interfaces (only BasePhase internals)

**Validation:**
- Run full test suite with RAG disabled
- Verify output parity with pre-RAG state

### Risk 4: Type Safety Violations

**Mitigation:**
- RAGManager already mypy --strict compliant
- New types follow existing patterns
- Use Optional[] for nullable fields
- Explicit return types on all methods

**Validation:**
- mypy --strict must pass before commit
- Pre-commit hook enforces type checking

---

## Implementation Roadmap

### Card Breakdown

**CARD 1: Core Infrastructure (RAGConfig + PromptAugmenter)**
- Add RAGConfig to base.py
- Create rag_integration.py with PromptAugmenter
- Write unit tests for PromptAugmenter (10 tests)
- Estimated time: 6-8 hours

**CARD 2: BasePhase RAG Integration**
- Modify base_phase.py execute() method
- Add _get_retrieval_query() and _get_retrieval_collection()
- Update PhaseContext with rag_manager
- Write unit tests (8 tests)
- Estimated time: 6-8 hours

**CARD 3: Phase-Specific Retrieval**
- Implement retrieval methods in all 4 phases
- Customize queries per phase needs
- Write integration tests (12 tests)
- Estimated time: 8-10 hours

**CARD 4: Workflow Integration**
- Modify base_workflow.py to initialize RAGManager
- Update _create_phase_context()
- Ensure session isolation preserved
- Write workflow tests (5 tests)
- Estimated time: 4-6 hours

**CARD 5: CLI Integration**
- Add --enable-rag flags to generate.py
- Update help text and documentation
- Test CLI with RAG enabled/disabled
- Estimated time: 3-4 hours

**CARD 6: End-to-End Testing + Documentation**
- Run complete workflow with RAG
- A/B test output quality
- Benchmark performance
- Update CLAUDE.md, README
- Estimated time: 6-8 hours

**Total Estimated Time:** 33-44 hours (~5-6 days)

---

## Next Steps

The executor agent should proceed to create detailed implementation cards:

1. `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/.claude/current_task/PLAN/CARD_1_RAG_CONFIG_AND_AUGMENTER.md`
2. `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/.claude/current_task/PLAN/CARD_2_BASE_PHASE_INTEGRATION.md`
3. `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/.claude/current_task/PLAN/CARD_3_PHASE_RETRIEVAL_STRATEGIES.md`
4. `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/.claude/current_task/PLAN/CARD_4_WORKFLOW_INTEGRATION.md`
5. `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/.claude/current_task/PLAN/CARD_5_CLI_INTEGRATION.md`
6. `/Users/eduardo/Documents/projects/cycling-ai-analysis/trees/rag-vectorstore-improvement/.claude/current_task/PLAN/CARD_6_TESTING_AND_DOCS.md`

Each card will contain:
- Specific files to modify (absolute paths)
- Code changes with before/after comparisons
- Test cases with expected outputs
- Acceptance criteria for card completion

---

## Summary

Phase 3 integrates the RAG foundation (Phase 1) and knowledge base (Phase 2) into the live multi-agent orchestration system. The key innovation is **prompt-level augmentation** that preserves session isolation while enriching agent context with relevant domain knowledge.

**Architecture Highlights:**
- RAG sits at BasePhase level, transparent to individual phases
- System prompt augmentation (not conversation history)
- Backward compatible (disabled by default)
- Per-phase retrieval customization
- Full type safety and test coverage

**Expected Impact:**
- 30-40% token reduction through targeted retrieval
- Improved analysis quality via cycling science knowledge
- Better training plans using proven templates
- Maintained performance (retrieval overhead <10%)

**Risk Mitigation:**
- Graceful degradation if RAG fails
- Extensive testing (35+ tests)
- Backward compatibility guaranteed
- Performance benchmarking before merge

This implementation follows the project's clean architecture principles, maintains SOLID design, and ensures production-grade quality with comprehensive testing and type safety.
