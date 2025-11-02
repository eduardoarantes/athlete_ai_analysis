# Multi-Agent Orchestrator Refactoring Plan

**Status:** Planning Complete - Ready for TDD Implementation
**Created:** 2025-11-02
**Task Type:** Architecture Refactoring
**Priority:** High (Enables modular phase execution and custom workflows)

---

## Executive Summary

Refactor the monolithic `multi_agent.py` (1672 lines) into a modular, composable architecture that enables:
- **Individual phase execution** (e.g., just run training planning phase)
- **Custom workflow composition** (e.g., skip performance analysis, only generate training plan)
- **Better testability** (test phases in isolation)
- **Separation of concerns** (each phase is self-contained)
- **100% backward compatibility** (existing code continues to work unchanged)

### Current Problems

1. **Tight Coupling**: Phases are private methods (`_execute_phase_1`, `_execute_phase_2`, etc.) that cannot be used independently
2. **Hard to Test**: Cannot test individual phases without running the entire workflow
3. **No Reusability**: Cannot compose custom workflows from existing phases
4. **Difficult to Extend**: Adding new phases or workflows requires modifying the monolithic class
5. **Code Duplication**: Phase execution logic has significant overlap

### Proposed Solution

Extract phases into independent, composable components with a clear interface:

```
src/cycling_ai/orchestration/
├── base.py                     # Shared classes (PhaseResult, PhaseStatus, PhaseContext)
├── phases/                     # Individual phase implementations
│   ├── __init__.py
│   ├── base_phase.py          # Abstract BasePhase class
│   ├── data_preparation.py    # Phase 1: Data validation & caching
│   ├── performance_analysis.py # Phase 2: Performance & zones analysis
│   ├── training_planning.py   # Phase 3: Training plan generation
│   └── report_preparation.py  # Phase 4: Report data consolidation
├── workflows/                  # Workflow compositions
│   ├── __init__.py
│   ├── base_workflow.py       # Abstract workflow orchestrator
│   └── full_report.py         # Full 4-phase workflow
└── multi_agent.py             # PRESERVED - Delegates to workflows/full_report.py
```

---

## Architecture Deep Dive

### 1. Core Abstractions

#### PhaseContext (New)

```python
@dataclass
class PhaseContext:
    """
    Input context for phase execution.

    Contains configuration and data from previous phases.
    """
    config: WorkflowConfig  # Workflow configuration
    previous_phase_data: dict[str, Any]  # Data from prior phases
    session_manager: SessionManager  # For creating isolated sessions
    provider: BaseProvider  # LLM provider
    prompts_manager: AgentPromptsManager  # Prompt templates
    progress_callback: Callable[[str, PhaseStatus], None] | None = None
```

#### BasePhase (New)

```python
class BasePhase(ABC):
    """
    Abstract base class for all workflow phases.

    Provides template method pattern for phase execution with:
    - Session isolation
    - Data extraction
    - Error handling
    - Progress tracking
    """

    def __init__(
        self,
        phase_name: str,
        required_tools: list[str],
        max_iterations: int | None = None,
    ):
        self.phase_name = phase_name
        self.required_tools = required_tools
        self.max_iterations = max_iterations

    def execute(self, context: PhaseContext) -> PhaseResult:
        """
        Execute phase with full error handling and session isolation.

        Template method that:
        1. Validates input context
        2. Creates isolated session
        3. Executes phase logic
        4. Extracts structured data
        5. Returns PhaseResult
        """
        phase_start = datetime.now()

        try:
            # Hook for subclasses to validate context
            self._validate_context(context)

            # Execute phase-specific logic
            result = self._execute_phase(context)

            # Calculate metrics
            result.execution_time_seconds = (datetime.now() - phase_start).total_seconds()

            return result

        except Exception as e:
            return PhaseResult(
                phase_name=self.phase_name,
                status=PhaseStatus.FAILED,
                agent_response="",
                errors=[str(e)],
                execution_time_seconds=(datetime.now() - phase_start).total_seconds(),
            )

    @abstractmethod
    def _execute_phase(self, context: PhaseContext) -> PhaseResult:
        """Phase-specific execution logic (implemented by subclasses)."""
        pass

    @abstractmethod
    def _validate_context(self, context: PhaseContext) -> None:
        """Validate required context data (implemented by subclasses)."""
        pass

    @abstractmethod
    def _extract_phase_data(
        self, response: str, session: ConversationSession
    ) -> dict[str, Any]:
        """Extract structured data from phase execution (implemented by subclasses)."""
        pass
```

### 2. Phase Implementations

#### DataPreparationPhase (Phase 1)

```python
class DataPreparationPhase(BasePhase):
    """
    Phase 1: Data Preparation and Validation.

    Direct tool execution (no LLM):
    - Validates CSV, profile, FIT files
    - Creates Parquet cache with power zones
    - Returns cache paths for downstream phases
    """

    def __init__(self):
        super().__init__(
            phase_name=PHASE_DATA_PREPARATION,
            required_tools=["validate_data_files", "prepare_cache"],
            max_iterations=None,  # No LLM iterations
        )

    def _execute_phase(self, context: PhaseContext) -> PhaseResult:
        # Direct tool execution (current implementation from _execute_phase_1)
        # Import tools, execute validation, execute cache creation
        # Return PhaseResult with cache_file_path, athlete_profile_path, etc.
        pass

    def _validate_context(self, context: PhaseContext) -> None:
        # Validate CSV/FIT paths exist
        # Validate athlete profile exists
        pass

    def _extract_phase_data(
        self, response: str, session: ConversationSession
    ) -> dict[str, Any]:
        # No session - direct tool execution
        # Extract from tool results directly
        pass
```

#### PerformanceAnalysisPhase (Phase 2)

```python
class PerformanceAnalysisPhase(BasePhase):
    """
    Phase 2: Performance Analysis.

    LLM-orchestrated:
    - Analyzes performance trends over period
    - Optionally analyzes cross-training impact
    - Returns performance_data, zones_data, cross_training_data
    """

    def __init__(self):
        super().__init__(
            phase_name=PHASE_PERFORMANCE_ANALYSIS,
            required_tools=["analyze_performance"],  # + conditionally analyze_cross_training_impact
            max_iterations=5,
        )

    def _execute_phase(self, context: PhaseContext) -> PhaseResult:
        # Get cache path from Phase 1
        # Determine if cross-training analysis needed (auto-detect or explicit)
        # Build tools list conditionally
        # Create isolated session with performance_analysis_prompt
        # Create agent and execute
        # Extract performance_analysis_json
        pass

    def _validate_context(self, context: PhaseContext) -> None:
        # Ensure cache_file_path present
        # Ensure athlete_profile_path present
        pass

    def _extract_phase_data(
        self, response: str, session: ConversationSession
    ) -> dict[str, Any]:
        # Extract performance_data from tool results
        # Extract zones_data from tool results
        # Extract cross_training_data if available
        # Extract and validate performance_analysis_json from LLM response
        pass
```

#### TrainingPlanningPhase (Phase 3)

```python
class TrainingPlanningPhase(BasePhase):
    """
    Phase 3: Training Plan Generation.

    3-sub-phase LLM-orchestrated workflow:
    - 3a: Create plan overview (plan_id, phases, TSS targets)
    - 3b: Add weekly workout details iteratively
    - 3c: Finalize and validate complete plan

    This is the most complex phase - internally manages 3 sub-phases.
    """

    def __init__(self):
        super().__init__(
            phase_name=PHASE_TRAINING_PLANNING,
            required_tools=["create_plan_overview", "add_week_details", "finalize_plan"],
            max_iterations=None,  # Varies by sub-phase
        )

    def _execute_phase(self, context: PhaseContext) -> PhaseResult:
        # Sub-phase 3a: Overview
        phase3a_result = self._execute_phase_3a_overview(context)
        if not phase3a_result.success:
            return phase3a_result

        # Sub-phase 3b: Weekly details
        phase3b_result = self._execute_phase_3b_weeks(context, phase3a_result)
        if not phase3b_result.success:
            return phase3b_result

        # Sub-phase 3c: Finalization (Python only)
        phase3c_result = self._execute_phase_3c_finalize(context, phase3a_result)
        return phase3c_result

    def _validate_context(self, context: PhaseContext) -> None:
        # Ensure athlete_profile_path present
        # Load profile and validate FTP, training_days, weekly_hours
        pass

    def _extract_phase_data(
        self, response: str, session: ConversationSession
    ) -> dict[str, Any]:
        # Extract training_plan from finalize_plan tool result
        # Validate weekly_plan structure
        # Validate weekly hours (10% tolerance)
        pass
```

#### ReportPreparationPhase (Phase 4)

```python
class ReportPreparationPhase(BasePhase):
    """
    Phase 4: Report Data Preparation.

    Python-only consolidation:
    - Consolidates performance analysis + training plan
    - Creates report_data.json for HTML generation
    - No LLM calls
    """

    def __init__(self):
        super().__init__(
            phase_name=PHASE_REPORT_DATA_PREPARATION,
            required_tools=[],  # No tools - direct Python
            max_iterations=None,
        )

    def _execute_phase(self, context: PhaseContext) -> PhaseResult:
        # Extract performance_analysis_json from Phase 2
        # Extract training_plan from Phase 3
        # Use report_data_extractor utilities
        # Save report_data.json to output_dir
        pass

    def _validate_context(self, context: PhaseContext) -> None:
        # Ensure training_plan available from Phase 3
        pass

    def _extract_phase_data(
        self, response: str, session: ConversationSession
    ) -> dict[str, Any]:
        # Return report_data_path, report_data
        pass
```

### 3. Workflow Compositions

#### BaseWorkflow (New)

```python
class BaseWorkflow(ABC):
    """
    Abstract base class for workflow compositions.

    Provides infrastructure for:
    - Phase sequencing
    - Data handoffs between phases
    - Progress tracking
    - Error handling
    - Result aggregation
    """

    def __init__(
        self,
        provider: BaseProvider,
        prompts_manager: AgentPromptsManager | None = None,
        session_manager: SessionManager | None = None,
        progress_callback: Callable[[str, PhaseStatus], None] | None = None,
    ):
        self.provider = provider
        self.prompts_manager = prompts_manager or AgentPromptsManager()
        self.session_manager = session_manager or self._get_default_session_manager()
        self.progress_callback = progress_callback

    @abstractmethod
    def execute_workflow(self, config: WorkflowConfig) -> WorkflowResult:
        """Execute complete workflow (implemented by subclasses)."""
        pass

    @abstractmethod
    def get_phases(self) -> list[BasePhase]:
        """Get phases in execution order (implemented by subclasses)."""
        pass

    def _create_phase_context(
        self, config: WorkflowConfig, previous_data: dict[str, Any]
    ) -> PhaseContext:
        """Create phase context with config and previous phase data."""
        return PhaseContext(
            config=config,
            previous_phase_data=previous_data,
            session_manager=self.session_manager,
            provider=self.provider,
            prompts_manager=self.prompts_manager,
            progress_callback=self.progress_callback,
        )
```

#### FullReportWorkflow (New)

```python
class FullReportWorkflow(BaseWorkflow):
    """
    Full 4-phase report generation workflow.

    Orchestrates:
    - Phase 1: Data Preparation
    - Phase 2: Performance Analysis
    - Phase 3: Training Planning (optional)
    - Phase 4: Report Preparation
    """

    def get_phases(self) -> list[BasePhase]:
        return [
            DataPreparationPhase(),
            PerformanceAnalysisPhase(),
            TrainingPlanningPhase(),
            ReportPreparationPhase(),
        ]

    def execute_workflow(self, config: WorkflowConfig) -> WorkflowResult:
        """Execute full 4-phase workflow."""
        config.validate()

        phase_results: list[PhaseResult] = []
        workflow_start = datetime.now()
        total_tokens = 0
        previous_data: dict[str, Any] = {}

        # Phase 1: Data Preparation (or skip if cache exists)
        if config.skip_data_prep:
            # Create skipped result with cache paths
            phase1_result = self._create_skipped_phase_1_result(config)
        else:
            phase1 = DataPreparationPhase()
            context = self._create_phase_context(config, {})
            phase1_result = phase1.execute(context)

            if not phase1_result.success:
                return self._create_failed_workflow_result(
                    phase_results, workflow_start, total_tokens
                )

        phase_results.append(phase1_result)
        previous_data.update(phase1_result.extracted_data)
        total_tokens += phase1_result.tokens_used

        # Phase 2: Performance Analysis
        phase2 = PerformanceAnalysisPhase()
        context = self._create_phase_context(config, previous_data)
        phase2_result = phase2.execute(context)
        phase_results.append(phase2_result)
        previous_data.update(phase2_result.extracted_data)
        total_tokens += phase2_result.tokens_used

        if not phase2_result.success:
            return self._create_failed_workflow_result(
                phase_results, workflow_start, total_tokens
            )

        # Phase 3: Training Planning (optional)
        if config.generate_training_plan:
            phase3 = TrainingPlanningPhase()
            context = self._create_phase_context(config, previous_data)
            phase3_result = phase3.execute(context)
            phase_results.append(phase3_result)
            previous_data.update(phase3_result.extracted_data)
            total_tokens += phase3_result.tokens_used

            if not phase3_result.success:
                # Mark as skipped, continue workflow
                phase3_result.status = PhaseStatus.SKIPPED
        else:
            # Add skipped result
            phase_results.append(
                PhaseResult(
                    phase_name=PHASE_TRAINING_PLANNING,
                    status=PhaseStatus.SKIPPED,
                    agent_response="Training plan generation was not requested",
                )
            )

        # Phase 4: Report Preparation (only if training plan generated)
        if config.generate_training_plan:
            phase4 = ReportPreparationPhase()
            context = self._create_phase_context(config, previous_data)
            phase4_result = phase4.execute(context)
            phase_results.append(phase4_result)
            # No tokens used (Python only)

            if not phase4_result.success:
                return self._create_failed_workflow_result(
                    phase_results, workflow_start, total_tokens
                )
        else:
            # Add skipped result
            phase_results.append(
                PhaseResult(
                    phase_name=PHASE_REPORT_DATA_PREPARATION,
                    status=PhaseStatus.SKIPPED,
                    agent_response="Report data preparation skipped - no training plan",
                )
            )

        # Return complete workflow result
        workflow_end = datetime.now()
        total_time = (workflow_end - workflow_start).total_seconds()

        # Collect output files
        validated_files: list[Path] = []
        if config.generate_training_plan:
            phase4_result = phase_results[-1]
            if phase4_result.success:
                report_data_path = phase4_result.extracted_data.get("report_data_path")
                if report_data_path:
                    validated_files.append(Path(report_data_path).absolute())

        return WorkflowResult(
            phase_results=phase_results,
            total_execution_time_seconds=total_time,
            total_tokens_used=total_tokens,
            output_files=validated_files,
        )
```

### 4. Backward Compatibility Layer

#### MultiAgentOrchestrator (Preserved)

```python
class MultiAgentOrchestrator:
    """
    BACKWARD COMPATIBILITY WRAPPER.

    Delegates to FullReportWorkflow for actual execution.
    Preserves existing API for all consuming code.
    """

    def __init__(
        self,
        provider: BaseProvider,
        prompts_manager: AgentPromptsManager | None = None,
        session_manager: SessionManager | None = None,
        progress_callback: Callable[[str, PhaseStatus], None] | None = None,
    ):
        # Create workflow instance
        self._workflow = FullReportWorkflow(
            provider=provider,
            prompts_manager=prompts_manager,
            session_manager=session_manager,
            progress_callback=progress_callback,
        )

    def execute_workflow(self, config: WorkflowConfig) -> WorkflowResult:
        """Execute complete workflow (delegates to FullReportWorkflow)."""
        return self._workflow.execute_workflow(config)

    # Preserve any other public methods used by consuming code
```

---

## Data Flow Patterns

### Pattern 1: Phase Execution with Context

```
PhaseContext (config + previous_data)
    ↓
BasePhase.execute(context)
    ↓
1. _validate_context(context)  # Ensure required data present
    ↓
2. _execute_phase(context)     # Phase-specific logic
    ↓
3. _extract_phase_data()       # Extract structured data
    ↓
PhaseResult (status, data, errors, metrics)
```

### Pattern 2: Data Handoff Between Phases

```
Phase 1: Data Preparation
    ↓ extracted_data = {"cache_file_path": "...", "athlete_profile_path": "..."}
    ↓
Phase 2: Performance Analysis (context.previous_phase_data = Phase 1 data)
    ↓ extracted_data = {"performance_data": {...}, "zones_data": {...}}
    ↓
Phase 3: Training Planning (context.previous_phase_data = Phase 1 + Phase 2 data)
    ↓ extracted_data = {"training_plan": {...}, "output_path": "..."}
    ↓
Phase 4: Report Preparation (context.previous_phase_data = Phase 1 + 2 + 3 data)
    ↓ extracted_data = {"report_data_path": "...", "report_data": {...}}
    ↓
WorkflowResult (all phase results aggregated)
```

### Pattern 3: Session Isolation

```
Each Phase Creates Fresh Session:

Phase 2:
  session = context.session_manager.create_session(
      provider_name=context.provider.name,
      context=context.previous_phase_data,  # Phase 1 data
      system_prompt=context.prompts_manager.get_performance_analysis_prompt(),
  )

  agent = AgentFactory.create_agent(
      provider=context.provider,
      session=session,
      allowed_tools=self.required_tools,
  )

  response = agent.process_message(user_message)

  # Session isolated - doesn't affect other phases
```

---

## Implementation Strategy

### Phase 1: Foundation (Cards 1-3)

**CARD_001: Extract Base Classes**
- Create `orchestration/base.py` with PhaseContext dataclass
- Move PhaseResult, PhaseStatus, WorkflowConfig, WorkflowResult to base.py
- Update imports in multi_agent.py (no logic changes)
- Run tests to ensure nothing breaks

**CARD_002: Create BasePhase Abstract Class**
- Create `orchestration/phases/base_phase.py`
- Implement BasePhase with template method pattern
- Add abstract methods: _execute_phase, _validate_context, _extract_phase_data
- Write unit tests for BasePhase error handling and template method flow

**CARD_003: Extract DataPreparationPhase**
- Create `orchestration/phases/data_preparation.py`
- Move _execute_phase_1 logic to DataPreparationPhase
- Implement BasePhase interface
- Write unit tests for DataPreparationPhase
- Write integration test: execute phase standalone

### Phase 2: Core Phase Implementations (Cards 4-6)

**CARD_004: Extract PerformanceAnalysisPhase**
- Create `orchestration/phases/performance_analysis.py`
- Move _execute_phase_2 logic to PerformanceAnalysisPhase
- Move cross-training auto-detection logic
- Move performance analysis JSON validation logic
- Implement BasePhase interface
- Write unit tests + integration test

**CARD_005: Extract TrainingPlanningPhase (Most Complex)**
- Create `orchestration/phases/training_planning.py`
- Move _execute_phase_3a_overview, _execute_phase_3b_weeks, _execute_phase_3c_finalize logic
- Move weekly hours validation logic
- Move performance summary generation logic
- Implement BasePhase interface with 3 internal sub-phases
- Write unit tests for each sub-phase + integration test

**CARD_006: Extract ReportPreparationPhase**
- Create `orchestration/phases/report_preparation.py`
- Move _execute_phase_4 logic to ReportPreparationPhase
- Implement BasePhase interface
- Write unit tests + integration test

### Phase 3: Workflow Composition (Cards 7-8)

**CARD_007: Create BaseWorkflow Abstract Class**
- Create `orchestration/workflows/base_workflow.py`
- Implement BaseWorkflow with workflow orchestration infrastructure
- Add helper methods: _create_phase_context, _create_failed_workflow_result, etc.
- Write unit tests for BaseWorkflow helpers

**CARD_008: Create FullReportWorkflow**
- Create `orchestration/workflows/full_report.py`
- Implement FullReportWorkflow using extracted phases
- Move phase sequencing logic from execute_workflow
- Handle skip_data_prep logic
- Handle optional training plan logic
- Write integration test: full workflow end-to-end

### Phase 4: Backward Compatibility (Card 9)

**CARD_009: Update MultiAgentOrchestrator Wrapper**
- Modify `orchestration/multi_agent.py`
- Replace implementation with delegation to FullReportWorkflow
- Preserve existing public API
- Run full test suite to ensure backward compatibility
- Update any internal imports to use new structure

### Phase 5: Cleanup and Documentation (Card 10)

**CARD_010: Final Polish**
- Add comprehensive docstrings to all new classes
- Update type hints to ensure mypy --strict compliance
- Add usage examples in docstrings
- Update CLAUDE.md with new architecture section
- Create migration guide for custom workflow composition
- Run full test suite + type checking

---

## Testing Strategy

### Unit Test Coverage Goals

- **BasePhase**: 100% (template method flow, error handling)
- **Each Phase Implementation**: 90%+ (logic, validation, extraction)
- **BaseWorkflow**: 100% (helpers, context creation)
- **FullReportWorkflow**: 90%+ (sequencing, data handoff)
- **MultiAgentOrchestrator wrapper**: 100% (delegation)

### Integration Test Strategy

**Phase-Level Integration Tests:**
```python
def test_data_preparation_phase_standalone():
    """Test Phase 1 executes independently."""
    phase = DataPreparationPhase()
    context = PhaseContext(
        config=test_config,
        previous_phase_data={},
        session_manager=test_session_manager,
        provider=test_provider,
        prompts_manager=test_prompts_manager,
    )

    result = phase.execute(context)

    assert result.success
    assert "cache_file_path" in result.extracted_data
    assert "athlete_profile_path" in result.extracted_data

def test_performance_analysis_phase_with_phase1_data():
    """Test Phase 2 uses Phase 1 data correctly."""
    phase = PerformanceAnalysisPhase()
    context = PhaseContext(
        config=test_config,
        previous_phase_data={
            "cache_file_path": "/path/to/cache.parquet",
            "athlete_profile_path": "/path/to/profile.json",
        },
        session_manager=test_session_manager,
        provider=mock_provider,
        prompts_manager=test_prompts_manager,
    )

    result = phase.execute(context)

    assert result.success
    assert "performance_data" in result.extracted_data
```

**Workflow-Level Integration Tests:**
```python
def test_full_report_workflow_end_to_end():
    """Test complete workflow with real data."""
    workflow = FullReportWorkflow(
        provider=anthropic_provider,
        prompts_manager=prompts_manager,
    )

    config = WorkflowConfig(
        csv_file_path=test_csv_path,
        athlete_profile_path=test_profile_path,
        training_plan_weeks=12,
        generate_training_plan=True,
    )

    result = workflow.execute_workflow(config)

    assert result.success
    assert len(result.phase_results) == 4
    assert result.phase_results[0].phase_name == PHASE_DATA_PREPARATION
    assert result.phase_results[1].phase_name == PHASE_PERFORMANCE_ANALYSIS
    assert result.phase_results[2].phase_name == PHASE_TRAINING_PLANNING
    assert result.phase_results[3].phase_name == PHASE_REPORT_DATA_PREPARATION
```

**Backward Compatibility Tests:**
```python
def test_multi_agent_orchestrator_backward_compatible():
    """Ensure existing code still works."""
    orchestrator = MultiAgentOrchestrator(provider=test_provider)
    config = WorkflowConfig(...)

    result = orchestrator.execute_workflow(config)

    # Same behavior as before refactoring
    assert result.success
    assert isinstance(result, WorkflowResult)
```

### Test Organization

```
tests/orchestration/
├── test_base_phase.py               # BasePhase unit tests
├── test_data_preparation_phase.py   # Phase 1 unit + integration
├── test_performance_analysis_phase.py # Phase 2 unit + integration
├── test_training_planning_phase.py  # Phase 3 unit + integration
├── test_report_preparation_phase.py # Phase 4 unit + integration
├── test_base_workflow.py            # BaseWorkflow unit tests
├── test_full_report_workflow.py     # Workflow integration tests
└── test_multi_agent_backward_compat.py # Backward compatibility tests
```

---

## Migration Guide for Custom Workflows

### Example: Training Plan Only Workflow

```python
from cycling_ai.orchestration.workflows.base_workflow import BaseWorkflow
from cycling_ai.orchestration.phases.data_preparation import DataPreparationPhase
from cycling_ai.orchestration.phases.training_planning import TrainingPlanningPhase

class TrainingPlanOnlyWorkflow(BaseWorkflow):
    """
    Custom workflow: Generate training plan without performance analysis.

    Use case: User has FTP, wants plan, doesn't need performance analysis.
    """

    def get_phases(self) -> list[BasePhase]:
        return [
            DataPreparationPhase(),
            TrainingPlanningPhase(),
        ]

    def execute_workflow(self, config: WorkflowConfig) -> WorkflowResult:
        config.validate()

        phase_results: list[PhaseResult] = []
        workflow_start = datetime.now()
        previous_data: dict[str, Any] = {}

        # Phase 1: Data Preparation
        phase1 = DataPreparationPhase()
        context = self._create_phase_context(config, {})
        phase1_result = phase1.execute(context)
        phase_results.append(phase1_result)

        if not phase1_result.success:
            return self._create_failed_workflow_result(phase_results, workflow_start, 0)

        previous_data.update(phase1_result.extracted_data)

        # Phase 3: Training Planning (skip Phase 2)
        phase3 = TrainingPlanningPhase()
        context = self._create_phase_context(config, previous_data)
        phase3_result = phase3.execute(context)
        phase_results.append(phase3_result)

        # Return result
        total_time = (datetime.now() - workflow_start).total_seconds()
        return WorkflowResult(
            phase_results=phase_results,
            total_execution_time_seconds=total_time,
            total_tokens_used=sum(r.tokens_used for r in phase_results),
            output_files=[],
        )

# Usage
workflow = TrainingPlanOnlyWorkflow(provider=anthropic_provider)
result = workflow.execute_workflow(config)
```

---

## Risk Analysis

### High Risk: Backward Compatibility

**Risk:** Existing consuming code breaks after refactoring

**Mitigation:**
- Preserve `MultiAgentOrchestrator` class with exact same API
- Delegate to new `FullReportWorkflow` internally
- Run full existing test suite without modifications
- Add backward compatibility integration tests

**Validation:**
```bash
# All existing tests must pass without changes
pytest tests/orchestration/test_multi_agent.py -v
pytest tests/cli/ -v
```

### Medium Risk: Data Extraction Logic

**Risk:** Phase data extraction breaks, downstream phases missing data

**Mitigation:**
- Keep existing `_extract_phase_data` logic in each phase
- Add validation in `_validate_context` to catch missing data early
- Write integration tests that verify data handoffs
- Add debug logging for extracted data keys

**Validation:**
- Integration tests with real LLM calls
- Check extracted_data contains expected keys

### Medium Risk: Session Isolation

**Risk:** Session management changes break phase isolation

**Mitigation:**
- Keep session creation pattern identical (create fresh session per phase)
- Pass SessionManager via PhaseContext (no changes to session lifecycle)
- Test that sessions don't leak between phases

**Validation:**
- Unit tests verify session created per phase
- Integration tests verify no session contamination

### Low Risk: Type Safety

**Risk:** Type errors from new abstractions

**Mitigation:**
- Run `mypy --strict` after each card
- Add comprehensive type hints to all new classes
- Use dataclasses for PhaseContext (immutable, type-safe)

**Validation:**
```bash
mypy src/cycling_ai/orchestration --strict
```

### Low Risk: Performance

**Risk:** Additional abstraction layers add overhead

**Mitigation:**
- Abstractions are lightweight (no heavy computation)
- Session isolation unchanged (same as before)
- LLM calls unchanged (same prompts, same tools)

**Validation:**
- Integration tests measure execution time
- Should be within 5% of current performance

---

## Open Questions & Decisions

### Q1: Should phases be stateless or stateful?

**Decision:** Stateless (current approach)
- Each phase instance can be reused across workflows
- No internal state between executions
- All context passed via PhaseContext parameter

**Rationale:** Simpler, more testable, no side effects

### Q2: How to handle sub-phases (e.g., Phase 3a/3b/3c)?

**Decision:** Internal to TrainingPlanningPhase
- TrainingPlanningPhase encapsulates 3 sub-phases internally
- External interface is single execute() method
- Sub-phase results aggregated into single PhaseResult

**Rationale:** Simplifies external API, maintains encapsulation

### Q3: Should PhaseContext be mutable or immutable?

**Decision:** Immutable (dataclass with frozen=False but pass-by-value semantics)
- Each phase gets context with previous_phase_data dict
- Phase cannot modify context, only return new data in PhaseResult
- Next phase gets updated previous_phase_data

**Rationale:** Clearer data flow, easier to debug, no side effects

### Q4: How to handle phase dependencies?

**Decision:** Implicit dependencies via context validation
- Each phase validates required data in _validate_context()
- Clear error messages if data missing
- Workflow responsible for correct sequencing

**Rationale:** Simple, flexible, explicit errors

### Q5: Should we support parallel phase execution?

**Decision:** Not in initial refactoring
- Current workflow is sequential (Phase 1 → 2 → 3 → 4)
- Phases have dependencies (each needs previous phase data)
- Future enhancement: Could add parallel execution for independent phases

**Rationale:** Sequential is simpler, matches current behavior

---

## Success Criteria

### Functional Requirements

- ✅ All 4 phases extracted into independent classes
- ✅ BasePhase provides clear interface and template method
- ✅ FullReportWorkflow orchestrates phases correctly
- ✅ MultiAgentOrchestrator delegates to workflow (backward compatible)
- ✅ Each phase can be executed standalone with proper context
- ✅ Custom workflows can be composed from existing phases

### Non-Functional Requirements

- ✅ 100% backward compatibility (existing code unchanged)
- ✅ 90%+ test coverage on new phase classes
- ✅ 100% mypy --strict compliance
- ✅ Performance within 5% of current implementation
- ✅ Clear docstrings on all public methods
- ✅ Migration guide for custom workflow composition

### Code Quality

- ✅ No code duplication between phases
- ✅ Clear separation of concerns
- ✅ Single Responsibility Principle (each phase does one thing)
- ✅ Open/Closed Principle (easy to add new phases)
- ✅ Liskov Substitution (all phases implement BasePhase contract)
- ✅ Dependency Inversion (depend on abstractions, not implementations)

---

## Timeline Estimate

**Total Time:** 12-16 hours (2-3 days)

- **Phase 1 (Cards 1-3):** 4-5 hours
  - Extract base classes: 1 hour
  - Create BasePhase: 2 hours
  - Extract DataPreparationPhase: 1-2 hours

- **Phase 2 (Cards 4-6):** 4-5 hours
  - Extract PerformanceAnalysisPhase: 1.5 hours
  - Extract TrainingPlanningPhase: 2-2.5 hours (most complex)
  - Extract ReportPreparationPhase: 0.5-1 hour

- **Phase 3 (Cards 7-8):** 2-3 hours
  - Create BaseWorkflow: 1 hour
  - Create FullReportWorkflow: 1-2 hours

- **Phase 4 (Card 9):** 1 hour
  - Update MultiAgentOrchestrator wrapper: 1 hour

- **Phase 5 (Card 10):** 1-2 hours
  - Documentation, examples, final polish: 1-2 hours

---

## Implementation Cards Summary

1. **CARD_001**: Extract Base Classes (PhaseContext, move shared classes)
2. **CARD_002**: Create BasePhase Abstract Class
3. **CARD_003**: Extract DataPreparationPhase (Phase 1)
4. **CARD_004**: Extract PerformanceAnalysisPhase (Phase 2)
5. **CARD_005**: Extract TrainingPlanningPhase (Phase 3)
6. **CARD_006**: Extract ReportPreparationPhase (Phase 4)
7. **CARD_007**: Create BaseWorkflow Abstract Class
8. **CARD_008**: Create FullReportWorkflow
9. **CARD_009**: Update MultiAgentOrchestrator Wrapper (Backward Compatibility)
10. **CARD_010**: Final Polish (Documentation, Examples, Type Checking)

Each card includes:
- Detailed implementation steps
- Test requirements (TDD approach)
- Acceptance criteria
- File changes required
- Estimated time

---

## Next Steps

1. **Review this plan** with Eduardo
2. **Create detailed task cards** in `.claude/current_task/PLAN/` directory
3. **Assign to task-executor-tdd agent** for TDD implementation
4. **Execute cards sequentially** (1-10)
5. **Run full test suite** after each card
6. **Verify backward compatibility** at end

---

**Status:** ✅ PLANNING COMPLETE - READY FOR DETAILED TASK CARDS

**Created by:** Task Implementation Preparation Architect
**Date:** 2025-11-02
**Reviewer:** Eduardo
