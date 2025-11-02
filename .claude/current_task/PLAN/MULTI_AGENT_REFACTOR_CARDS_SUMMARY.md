# Multi-Agent Refactor Implementation Cards - Summary

**Total Cards:** 10
**Estimated Total Time:** 12-16 hours

---

## CARD_001: Extract Base Classes ✅ DETAILED

**File:** `MULTI_AGENT_REFACTOR_CARD_001.md`
**Time:** 1 hour
**Status:** Detailed specification complete

### Summary
- Extract PhaseStatus, PhaseResult, WorkflowConfig, WorkflowResult to base.py
- Add new PhaseContext dataclass
- Update all imports throughout codebase
- Create comprehensive unit tests

---

## CARD_002: Create BasePhase Abstract Class

**Time:** 2 hours
**Priority:** Critical
**Dependencies:** CARD_001

### Objective
Create abstract base class that all phases will implement, providing template method pattern for phase execution.

### Key Deliverables
1. `src/cycling_ai/orchestration/phases/base_phase.py`:
   - BasePhase ABC with template method execute()
   - Abstract methods: _execute_phase(), _validate_context(), _extract_phase_data()
   - Standard error handling and progress tracking
   - Session isolation pattern
   - Token estimation

2. Unit Tests (`tests/orchestration/test_base_phase.py`):
   - Test template method flow
   - Test error handling wraps exceptions
   - Test abstract method enforcement
   - Mock phase implementation for testing

### Implementation Notes
```python
class BasePhase(ABC):
    def __init__(self, phase_name: str, required_tools: list[str], max_iterations: int | None = None):
        self.phase_name = phase_name
        self.required_tools = required_tools
        self.max_iterations = max_iterations

    def execute(self, context: PhaseContext) -> PhaseResult:
        """Template method with full error handling."""
        phase_start = datetime.now()
        try:
            self._validate_context(context)
            result = self._execute_phase(context)
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
        """Phase-specific logic."""
        pass

    @abstractmethod
    def _validate_context(self, context: PhaseContext) -> None:
        """Validate required context data."""
        pass

    @abstractmethod
    def _extract_phase_data(self, response: str, session: ConversationSession) -> dict[str, Any]:
        """Extract structured data."""
        pass
```

---

## CARD_003: Extract DataPreparationPhase

**Time:** 1-2 hours
**Priority:** High
**Dependencies:** CARD_002

### Objective
Extract Phase 1 (_execute_phase_1) into standalone DataPreparationPhase class.

### Key Deliverables
1. `src/cycling_ai/orchestration/phases/data_preparation.py`:
   - DataPreparationPhase(BasePhase)
   - Direct tool execution (no LLM)
   - Validation + cache creation
   - Extract cache paths

2. Unit Tests (`tests/orchestration/test_data_preparation_phase.py`):
   - Test phase executes standalone
   - Test validation catches missing files
   - Test cache creation success/failure
   - Test extracted data structure

3. Integration Test:
   - Execute phase with real config
   - Verify cache file created
   - Verify extracted data has cache_file_path, athlete_profile_path

### Key Code Pattern
```python
def _execute_phase(self, context: PhaseContext) -> PhaseResult:
    # Import tools
    from cycling_ai.tools.wrappers.data_validation_tool import DataValidationTool
    from cycling_ai.tools.wrappers.cache_preparation_tool import CachePreparationTool

    # Execute validation
    validation_tool = DataValidationTool()
    validation_result = validation_tool.execute(...)

    # Execute cache creation
    cache_tool = CachePreparationTool()
    cache_result = cache_tool.execute(...)

    # Return result with extracted data
    return PhaseResult(
        phase_name=PHASE_DATA_PREPARATION,
        status=PhaseStatus.COMPLETED,
        agent_response="Data preparation complete",
        extracted_data={
            "cache_file_path": cache_path,
            "athlete_profile_path": profile_path,
        },
    )
```

---

## CARD_004: Extract PerformanceAnalysisPhase

**Time:** 1.5 hours
**Priority:** High
**Dependencies:** CARD_003

### Objective
Extract Phase 2 (_execute_phase_2) into standalone PerformanceAnalysisPhase class.

### Key Deliverables
1. `src/cycling_ai/orchestration/phases/performance_analysis.py`:
   - PerformanceAnalysisPhase(BasePhase)
   - LLM-orchestrated with tool calling
   - Cross-training auto-detection logic
   - Performance analysis JSON extraction/validation

2. Tests:
   - Unit tests for context validation
   - Unit tests for cross-training detection logic
   - Integration test with mock LLM
   - Integration test with real LLM (optional, marked)

### Key Features
- Conditional cross-training tool based on activity distribution
- Extract performance_analysis_json from LLM response
- Validate against schema
- Session isolation pattern

---

## CARD_005: Extract TrainingPlanningPhase

**Time:** 2-2.5 hours (Most Complex)
**Priority:** High
**Dependencies:** CARD_004

### Objective
Extract Phase 3 (3a/3b/3c) into standalone TrainingPlanningPhase with internal sub-phases.

### Key Deliverables
1. `src/cycling_ai/orchestration/phases/training_planning.py`:
   - TrainingPlanningPhase(BasePhase)
   - Internal methods: _execute_phase_3a_overview, _execute_phase_3b_weeks, _execute_phase_3c_finalize
   - Power zones pre-calculation
   - Weekly hours validation
   - Performance summary generation

2. Tests:
   - Unit tests for each sub-phase
   - Unit tests for weekly hours validation
   - Unit tests for performance summary generation
   - Integration test: full 3-phase execution

### Key Complexity
- 3 internal sub-phases with different execution patterns
- Phase 3a: Single tool call (create_plan_overview)
- Phase 3b: Iterative tool calls (add_week_details N times)
- Phase 3c: Python-only finalization
- Extract plan_id from 3a for use in 3b/3c

---

## CARD_006: Extract ReportPreparationPhase

**Time:** 0.5-1 hour
**Priority:** Medium
**Dependencies:** CARD_005

### Objective
Extract Phase 4 (_execute_phase_4) into standalone ReportPreparationPhase class.

### Key Deliverables
1. `src/cycling_ai/orchestration/phases/report_preparation.py`:
   - ReportPreparationPhase(BasePhase)
   - Python-only consolidation (no LLM)
   - Uses report_data_extractor utilities
   - Saves report_data.json

2. Tests:
   - Unit tests for data consolidation
   - Test with performance analysis present
   - Test with performance analysis absent
   - Integration test: complete report_data.json creation

### Key Pattern
```python
def _execute_phase(self, context: PhaseContext) -> PhaseResult:
    # Get Phase 2 performance analysis (optional)
    performance_analysis = context.previous_phase_data.get("performance_analysis_json")

    # Get Phase 3 training plan (required)
    training_plan = context.previous_phase_data.get("training_plan")
    if not training_plan:
        raise ValueError("Training plan required for report preparation")

    # Use extractor utilities
    athlete_data = consolidate_athlete_data(
        training_plan_data=training_plan,
        profile=profile,
        athlete_id=athlete_id,
        athlete_name=athlete_name,
        performance_analysis=performance_analysis,
    )

    # Save report_data.json
    report_data = create_report_data([athlete_data], generator_info)
    output_path = context.config.output_dir / "report_data.json"
    with open(output_path, "w") as f:
        json.dump(report_data, f, indent=2)

    return PhaseResult(...)
```

---

## CARD_007: Create BaseWorkflow Abstract Class

**Time:** 1 hour
**Priority:** High
**Dependencies:** CARD_006

### Objective
Create abstract workflow orchestrator that coordinates phase execution.

### Key Deliverables
1. `src/cycling_ai/orchestration/workflows/base_workflow.py`:
   - BaseWorkflow ABC
   - Infrastructure for phase sequencing
   - Helper methods: _create_phase_context, _create_failed_workflow_result
   - Abstract methods: execute_workflow(), get_phases()

2. Tests:
   - Unit tests for helper methods
   - Test _create_phase_context builds correct context
   - Test _create_failed_workflow_result formats correctly
   - Mock workflow implementation for testing

### Key Methods
```python
class BaseWorkflow(ABC):
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

    def _create_failed_workflow_result(
        self, phase_results: list[PhaseResult], workflow_start: datetime, total_tokens: int
    ) -> WorkflowResult:
        """Create workflow result for failed execution."""
        total_time = (datetime.now() - workflow_start).total_seconds()
        return WorkflowResult(
            phase_results=phase_results,
            total_execution_time_seconds=total_time,
            total_tokens_used=total_tokens,
            output_files=[],
        )
```

---

## CARD_008: Create FullReportWorkflow

**Time:** 1-2 hours
**Priority:** High
**Dependencies:** CARD_007

### Objective
Implement full 4-phase workflow using extracted phases.

### Key Deliverables
1. `src/cycling_ai/orchestration/workflows/full_report.py`:
   - FullReportWorkflow(BaseWorkflow)
   - Execute all 4 phases in sequence
   - Handle skip_data_prep logic
   - Handle optional training plan logic
   - Aggregate phase results

2. Tests:
   - Integration test: full workflow with all phases
   - Test skip_data_prep creates skipped Phase 1 result
   - Test optional training plan skips Phase 3+4
   - Test data handoff between phases
   - Test failure in one phase stops workflow

### Key Flow
```python
def execute_workflow(self, config: WorkflowConfig) -> WorkflowResult:
    config.validate()
    phase_results = []
    previous_data = {}

    # Phase 1: Data Preparation (or skip)
    if config.skip_data_prep:
        phase1_result = self._create_skipped_phase_1_result(config)
    else:
        phase1 = DataPreparationPhase()
        phase1_result = phase1.execute(self._create_phase_context(config, {}))

    phase_results.append(phase1_result)
    previous_data.update(phase1_result.extracted_data)

    # Phase 2: Performance Analysis
    phase2 = PerformanceAnalysisPhase()
    phase2_result = phase2.execute(self._create_phase_context(config, previous_data))
    phase_results.append(phase2_result)
    previous_data.update(phase2_result.extracted_data)

    # Phase 3: Training Planning (optional)
    if config.generate_training_plan:
        phase3 = TrainingPlanningPhase()
        phase3_result = phase3.execute(self._create_phase_context(config, previous_data))
        phase_results.append(phase3_result)
        previous_data.update(phase3_result.extracted_data)

        # Phase 4: Report Preparation
        phase4 = ReportPreparationPhase()
        phase4_result = phase4.execute(self._create_phase_context(config, previous_data))
        phase_results.append(phase4_result)

    return WorkflowResult(...)
```

---

## CARD_009: Update MultiAgentOrchestrator Wrapper

**Time:** 1 hour
**Priority:** Critical (Backward Compatibility)
**Dependencies:** CARD_008

### Objective
Convert MultiAgentOrchestrator to backward-compatible wrapper that delegates to FullReportWorkflow.

### Key Deliverables
1. Update `src/cycling_ai/orchestration/multi_agent.py`:
   - Keep MultiAgentOrchestrator class
   - Remove all phase execution methods
   - Delegate to FullReportWorkflow
   - Preserve public API exactly

2. Tests:
   - Run ALL existing tests (must pass without modification)
   - Add backward compatibility integration tests
   - Test existing CLI commands work unchanged

### Key Pattern
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
```

### Acceptance Criteria
- ALL existing tests pass WITHOUT modification
- CLI commands work unchanged
- No breaking changes to public API

---

## CARD_010: Final Polish

**Time:** 1-2 hours
**Priority:** Medium
**Dependencies:** CARD_009

### Objective
Complete documentation, type checking, and examples.

### Key Deliverables
1. **Documentation**:
   - Comprehensive docstrings on all new classes
   - Usage examples in docstrings
   - Update CLAUDE.md with new architecture section
   - Create migration guide for custom workflows

2. **Type Safety**:
   - Run `mypy src/cycling_ai/orchestration --strict`
   - Fix any type errors
   - Ensure 100% type hint coverage

3. **Code Quality**:
   - Run `ruff format` on all new files
   - Run `ruff check` and fix issues
   - Remove any code duplication
   - Ensure consistent naming conventions

4. **Testing**:
   - Run full test suite
   - Verify 90%+ coverage on new code
   - Add any missing edge case tests

5. **Examples**:
   - Create example custom workflow (TrainingPlanOnlyWorkflow)
   - Add to examples/ directory or docs/

### Verification Checklist
```bash
# Type checking
mypy src/cycling_ai/orchestration --strict

# Code formatting
ruff format src/cycling_ai/orchestration tests/orchestration
ruff check src/cycling_ai/orchestration tests/orchestration

# Full test suite
pytest tests/orchestration/ -v --cov=src/cycling_ai/orchestration --cov-report=html

# CLI smoke test
cycling-ai generate --help

# Integration test with real data
cycling-ai generate --profile test_profile.json --csv test_activities.csv --provider anthropic
```

---

## Implementation Order

Execute cards **strictly in sequence**:

1. **CARD_001** → Foundation (base classes)
2. **CARD_002** → Base phase interface
3. **CARD_003** → Phase 1 (data prep)
4. **CARD_004** → Phase 2 (performance)
5. **CARD_005** → Phase 3 (training planning)
6. **CARD_006** → Phase 4 (report prep)
7. **CARD_007** → Base workflow
8. **CARD_008** → Full workflow
9. **CARD_009** → Backward compat wrapper
10. **CARD_010** → Polish and docs

**Critical:** Run tests after EACH card. Do not proceed if tests fail.

---

## Success Criteria Summary

### Functional
- ✅ All 4 phases extracted into independent classes
- ✅ Each phase can execute standalone
- ✅ Custom workflows can be composed
- ✅ Full workflow produces same results as before

### Backward Compatibility
- ✅ ALL existing tests pass unchanged
- ✅ CLI commands work unchanged
- ✅ MultiAgentOrchestrator API preserved

### Code Quality
- ✅ 90%+ test coverage on new code
- ✅ 100% mypy --strict compliance
- ✅ No code duplication
- ✅ Clear docstrings on all public methods

### Performance
- ✅ Execution time within 5% of original
- ✅ Token usage unchanged

---

**Total Estimated Time:** 12-16 hours (2-3 days)

**Status:** ✅ All cards outlined - Ready for TDD implementation
