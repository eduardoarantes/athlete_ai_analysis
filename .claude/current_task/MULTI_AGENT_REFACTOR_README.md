# Multi-Agent Orchestrator Refactoring - Task Documentation

**Status:** ✅ PLANNING COMPLETE - READY FOR TDD IMPLEMENTATION
**Created:** 2025-11-02
**Task Owner:** Task Implementation Preparation Architect
**Reviewer:** Eduardo

---

## Quick Start

### For Implementation Agent (task-executor-tdd)

1. **Read Planning Documents**
   - Start with `MULTI_AGENT_REFACTOR_PLAN.md` (comprehensive architecture overview)
   - Review `PLAN/MULTI_AGENT_REFACTOR_CARDS_SUMMARY.md` (all 10 task cards)
   - Read detailed CARD_001 spec: `PLAN/MULTI_AGENT_REFACTOR_CARD_001.md`

2. **Implementation Approach**
   - **Use TDD**: Write tests first, then implement
   - **Sequential execution**: Cards must be done in order (1→2→3...→10)
   - **Verify after each card**: Run tests, type checking, ensure nothing breaks

3. **Start with CARD_001**
   ```bash
   # Read full specification
   cat .claude/current_task/PLAN/MULTI_AGENT_REFACTOR_CARD_001.md

   # Create base.py with extracted classes
   # Write unit tests first (test_base.py)
   # Implement extraction
   # Update imports
   # Verify all tests pass
   ```

4. **Progress Through Cards**
   - Complete CARD_001 → CARD_002 → ... → CARD_010
   - Do not skip cards or do them out of order
   - Each card depends on previous cards

---

## Documentation Structure

```
.claude/current_task/
├── MULTI_AGENT_REFACTOR_README.md           # This file - Quick start guide
├── MULTI_AGENT_REFACTOR_PLAN.md             # Comprehensive planning document
└── PLAN/
    ├── MULTI_AGENT_REFACTOR_CARD_001.md     # Detailed: Extract base classes
    └── MULTI_AGENT_REFACTOR_CARDS_SUMMARY.md # Summary of all 10 cards
```

### Document Contents

1. **MULTI_AGENT_REFACTOR_PLAN.md** (60KB)
   - Executive summary
   - Architecture deep dive with code examples
   - Data flow patterns
   - Implementation strategy
   - Testing strategy
   - Migration guide for custom workflows
   - Risk analysis
   - Success criteria

2. **MULTI_AGENT_REFACTOR_CARD_001.md** (Complete Specification)
   - Objective and scope
   - Full code for base.py
   - Import updates required
   - Comprehensive unit tests (100% coverage)
   - Acceptance criteria
   - Verification steps

3. **MULTI_AGENT_REFACTOR_CARDS_SUMMARY.md** (All 10 Cards)
   - CARD_001: Extract base classes (1h)
   - CARD_002: Create BasePhase ABC (2h)
   - CARD_003: Extract DataPreparationPhase (1-2h)
   - CARD_004: Extract PerformanceAnalysisPhase (1.5h)
   - CARD_005: Extract TrainingPlanningPhase (2-2.5h)
   - CARD_006: Extract ReportPreparationPhase (0.5-1h)
   - CARD_007: Create BaseWorkflow ABC (1h)
   - CARD_008: Create FullReportWorkflow (1-2h)
   - CARD_009: Update MultiAgentOrchestrator wrapper (1h)
   - CARD_010: Final polish and documentation (1-2h)

---

## Task Overview

### Problem Statement

Current `multi_agent.py` is 1672 lines with tightly coupled phases that cannot be:
- Executed independently
- Tested in isolation
- Composed into custom workflows
- Extended without modifying the monolithic class

### Solution

Refactor into modular architecture:
```
orchestration/
├── base.py                      # NEW - Shared data classes
├── phases/                      # NEW - Individual phases
│   ├── base_phase.py           # Abstract base
│   ├── data_preparation.py     # Phase 1
│   ├── performance_analysis.py # Phase 2
│   ├── training_planning.py    # Phase 3
│   └── report_preparation.py   # Phase 4
├── workflows/                   # NEW - Workflow compositions
│   ├── base_workflow.py        # Abstract workflow
│   └── full_report.py          # 4-phase workflow
└── multi_agent.py              # MODIFIED - Backward compat wrapper
```

### Key Design Decisions

1. **Phases are Stateless**: All context passed via PhaseContext parameter
2. **Template Method Pattern**: BasePhase provides execution structure
3. **Session Isolation Preserved**: Each phase creates fresh session (unchanged)
4. **Backward Compatibility**: MultiAgentOrchestrator delegates to FullReportWorkflow
5. **Data Flow via Context**: Previous phase data passed in PhaseContext.previous_phase_data

---

## Architecture Overview

### Core Abstractions

#### PhaseContext (New)
```python
@dataclass
class PhaseContext:
    config: WorkflowConfig
    previous_phase_data: dict[str, Any]
    session_manager: SessionManager
    provider: BaseProvider
    prompts_manager: AgentPromptsManager
    progress_callback: Callable[[str, PhaseStatus], None] | None
```

#### BasePhase (New)
```python
class BasePhase(ABC):
    def execute(self, context: PhaseContext) -> PhaseResult:
        """Template method with error handling."""
        # 1. Validate context
        # 2. Execute phase logic
        # 3. Extract data
        # 4. Return PhaseResult

    @abstractmethod
    def _execute_phase(self, context: PhaseContext) -> PhaseResult:
        """Phase-specific implementation."""

    @abstractmethod
    def _validate_context(self, context: PhaseContext) -> None:
        """Validate required data present."""

    @abstractmethod
    def _extract_phase_data(self, response: str, session: ConversationSession) -> dict[str, Any]:
        """Extract structured data."""
```

### Data Flow Pattern

```
Phase 1: Data Preparation
    ↓ extracted_data = {"cache_file_path": "...", "athlete_profile_path": "..."}
    ↓
Phase 2: Performance Analysis (context.previous_phase_data = Phase 1 data)
    ↓ extracted_data = {"performance_data": {...}, "zones_data": {...}}
    ↓
Phase 3: Training Planning (context.previous_phase_data = Phase 1 + 2 data)
    ↓ extracted_data = {"training_plan": {...}}
    ↓
Phase 4: Report Preparation (context.previous_phase_data = Phase 1 + 2 + 3 data)
    ↓ extracted_data = {"report_data_path": "..."}
```

---

## Implementation Timeline

**Total Estimated Time:** 12-16 hours (2-3 days)

### Day 1: Foundation and Core Phases (6-8 hours)
- CARD_001: Extract base classes (1h)
- CARD_002: Create BasePhase ABC (2h)
- CARD_003: Extract DataPreparationPhase (1-2h)
- CARD_004: Extract PerformanceAnalysisPhase (1.5h)
- Start CARD_005: Extract TrainingPlanningPhase

### Day 2: Complete Phases and Workflows (4-6 hours)
- Complete CARD_005: TrainingPlanningPhase (2-2.5h)
- CARD_006: Extract ReportPreparationPhase (0.5-1h)
- CARD_007: Create BaseWorkflow ABC (1h)
- CARD_008: Create FullReportWorkflow (1-2h)

### Day 3: Integration and Polish (2-3 hours)
- CARD_009: Update MultiAgentOrchestrator wrapper (1h)
- CARD_010: Final polish and docs (1-2h)
- Full system testing
- Smoke tests with CLI

---

## Testing Strategy

### Unit Test Requirements

Each card must include comprehensive unit tests:

```bash
# Card 1: Base classes
pytest tests/orchestration/test_base.py -v

# Card 2: BasePhase abstract class
pytest tests/orchestration/test_base_phase.py -v

# Cards 3-6: Individual phases
pytest tests/orchestration/test_data_preparation_phase.py -v
pytest tests/orchestration/test_performance_analysis_phase.py -v
pytest tests/orchestration/test_training_planning_phase.py -v
pytest tests/orchestration/test_report_preparation_phase.py -v

# Card 7-8: Workflows
pytest tests/orchestration/test_base_workflow.py -v
pytest tests/orchestration/test_full_report_workflow.py -v

# Card 9: Backward compatibility
pytest tests/orchestration/test_multi_agent_backward_compat.py -v
```

### Integration Test Requirements

```bash
# After card 3: Phase 1 standalone
pytest tests/orchestration/test_data_preparation_phase.py::test_phase_1_standalone -v

# After card 4: Phase 2 with Phase 1 data
pytest tests/orchestration/test_performance_analysis_phase.py::test_phase_2_with_phase1_data -v

# After card 8: Full workflow end-to-end
pytest tests/orchestration/test_full_report_workflow.py::test_full_workflow_e2e -v

# After card 9: All existing tests must pass
pytest tests/orchestration/ -v
pytest tests/cli/ -v
```

### Type Checking Requirements

After EVERY card:
```bash
mypy src/cycling_ai/orchestration --strict
```

---

## Success Criteria

### Must Have (Blocking)

- ✅ All 4 phases extracted into independent classes
- ✅ BasePhase provides clear template method interface
- ✅ FullReportWorkflow orchestrates phases correctly
- ✅ **100% backward compatibility**: ALL existing tests pass unchanged
- ✅ MultiAgentOrchestrator delegates to FullReportWorkflow
- ✅ Each phase can execute standalone with proper PhaseContext

### Should Have (Important)

- ✅ 90%+ test coverage on new phase classes
- ✅ 100% mypy --strict compliance
- ✅ Clear docstrings on all public methods
- ✅ Performance within 5% of original implementation
- ✅ Migration guide for custom workflow composition

### Nice to Have (Polish)

- ✅ Example custom workflow (e.g., TrainingPlanOnlyWorkflow)
- ✅ Updated CLAUDE.md with new architecture section
- ✅ Code examples in docstrings
- ✅ No code duplication between phases

---

## Risk Mitigation

### High Risk: Backward Compatibility Break

**Mitigation:**
- Preserve MultiAgentOrchestrator class exactly as-is (API)
- Delegate internally to FullReportWorkflow
- Run ALL existing tests WITHOUT modification
- Add dedicated backward compatibility test suite

**Verification:**
```bash
# Must pass without ANY test changes
pytest tests/orchestration/test_cross_training_detection.py -v
pytest tests/orchestration/test_weekly_hours_validation.py -v
```

### Medium Risk: Data Extraction Logic Break

**Mitigation:**
- Keep existing _extract_phase_data patterns in each phase
- Add _validate_context to catch missing data early
- Write integration tests verifying data handoffs
- Debug logging for extracted data keys

**Verification:**
- Integration tests with real LLM calls
- Check extracted_data contains expected keys after each phase

### Low Risk: Type Safety Regression

**Mitigation:**
- Run mypy --strict after EVERY card
- Add comprehensive type hints to all new classes
- Use dataclasses for immutable data structures

**Verification:**
```bash
mypy src/cycling_ai/orchestration --strict
```

---

## Commands Reference

### Running Tests
```bash
# All orchestration tests
pytest tests/orchestration/ -v

# With coverage
pytest tests/orchestration/ --cov=src/cycling_ai/orchestration --cov-report=html

# Specific test file
pytest tests/orchestration/test_base.py -v

# Integration tests only (requires LLM)
pytest tests/orchestration/ -m integration -v
```

### Type Checking
```bash
# Check all orchestration code
mypy src/cycling_ai/orchestration --strict

# Check specific file
mypy src/cycling_ai/orchestration/base.py --strict
```

### Code Quality
```bash
# Format code
ruff format src/cycling_ai/orchestration tests/orchestration

# Lint code
ruff check src/cycling_ai/orchestration tests/orchestration
```

### Smoke Tests
```bash
# CLI help (should work after card 9)
cycling-ai generate --help

# Full workflow (should work after card 9)
cycling-ai generate \
    --profile data/athletes/test_athlete/athlete_profile.json \
    --csv data/athletes/test_athlete/activities.csv \
    --provider anthropic \
    --weeks 12
```

---

## Key Files Reference

### Source Files to Create

```
src/cycling_ai/orchestration/
├── base.py                              # CARD_001
├── phases/
│   ├── __init__.py                      # CARD_002
│   ├── base_phase.py                    # CARD_002
│   ├── data_preparation.py              # CARD_003
│   ├── performance_analysis.py          # CARD_004
│   ├── training_planning.py             # CARD_005
│   └── report_preparation.py            # CARD_006
└── workflows/
    ├── __init__.py                      # CARD_007
    ├── base_workflow.py                 # CARD_007
    └── full_report.py                   # CARD_008
```

### Test Files to Create

```
tests/orchestration/
├── test_base.py                         # CARD_001
├── test_base_phase.py                   # CARD_002
├── test_data_preparation_phase.py       # CARD_003
├── test_performance_analysis_phase.py   # CARD_004
├── test_training_planning_phase.py      # CARD_005
├── test_report_preparation_phase.py     # CARD_006
├── test_base_workflow.py                # CARD_007
├── test_full_report_workflow.py         # CARD_008
└── test_multi_agent_backward_compat.py  # CARD_009
```

### Files to Modify

```
src/cycling_ai/orchestration/multi_agent.py  # CARD_001, CARD_009
tests/orchestration/test_cross_training_detection.py  # CARD_001 (imports)
tests/orchestration/test_weekly_hours_validation.py   # CARD_001 (imports)
src/cycling_ai/cli/commands/generate.py      # CARD_001 (imports)
```

---

## Implementation Checklist

### Preparation
- [ ] Read MULTI_AGENT_REFACTOR_PLAN.md (full context)
- [ ] Read MULTI_AGENT_REFACTOR_CARDS_SUMMARY.md (all cards)
- [ ] Read MULTI_AGENT_REFACTOR_CARD_001.md (detailed spec)
- [ ] Understand BasePhase interface design
- [ ] Understand PhaseContext data flow
- [ ] Review current multi_agent.py implementation

### Card Completion (In Order)
- [ ] CARD_001: Extract base classes ← START HERE
- [ ] CARD_002: Create BasePhase ABC
- [ ] CARD_003: Extract DataPreparationPhase
- [ ] CARD_004: Extract PerformanceAnalysisPhase
- [ ] CARD_005: Extract TrainingPlanningPhase
- [ ] CARD_006: Extract ReportPreparationPhase
- [ ] CARD_007: Create BaseWorkflow ABC
- [ ] CARD_008: Create FullReportWorkflow
- [ ] CARD_009: Update MultiAgentOrchestrator wrapper
- [ ] CARD_010: Final polish and documentation

### Verification (After Each Card)
- [ ] All unit tests pass
- [ ] All existing tests continue to pass
- [ ] Type checking passes (mypy --strict)
- [ ] Code formatted (ruff format)
- [ ] Code linting passes (ruff check)

### Final Verification (After Card 10)
- [ ] Full test suite passes (pytest tests/)
- [ ] CLI smoke tests pass
- [ ] Integration test with real LLM passes
- [ ] Performance within 5% of baseline
- [ ] Documentation updated
- [ ] Example custom workflow created

---

## Context Files

### Essential Reading
1. **src/cycling_ai/orchestration/multi_agent.py** (1672 lines)
   - Current implementation to refactor
   - Understand phase execution patterns
   - Understand data extraction patterns

2. **CLAUDE.md** (Project guide)
   - Current architecture overview
   - Testing patterns
   - Type safety requirements

### Reference Files
- `src/cycling_ai/orchestration/session.py` - Session management
- `src/cycling_ai/orchestration/agent.py` - LLM agent with tool calling
- `src/cycling_ai/orchestration/prompts.py` - Prompt management
- `tests/orchestration/test_cross_training_detection.py` - Existing tests

---

## Notes for Implementation Agent

### Important Patterns to Preserve

1. **Session Isolation**: Each phase creates fresh session
   ```python
   session = context.session_manager.create_session(
       provider_name=context.provider.name,
       context=context.previous_phase_data,
       system_prompt=prompt,
   )
   ```

2. **Tool Result Extraction**: Extract from session messages
   ```python
   for message in session.messages:
       if message.role == "tool" and message.tool_results:
           for tool_result in message.tool_results:
               if tool_result.get("success"):
                   data = json.loads(message.content)
                   extracted[tool_result["tool_name"]] = data
   ```

3. **Progress Callbacks**: Notify on status changes
   ```python
   if context.progress_callback:
       context.progress_callback(self.phase_name, PhaseStatus.IN_PROGRESS)
   ```

### Common Pitfalls to Avoid

1. ❌ **Don't** modify existing test files (except imports in CARD_001)
2. ❌ **Don't** change phase execution logic (preserve exact behavior)
3. ❌ **Don't** break session isolation (each phase needs fresh session)
4. ❌ **Don't** skip cards or do them out of order
5. ❌ **Don't** proceed if tests fail after a card

### What to Do When Stuck

1. **Re-read the card specification** - All details are documented
2. **Check MULTI_AGENT_REFACTOR_PLAN.md** - Comprehensive architecture
3. **Look at current multi_agent.py** - Reference implementation
4. **Run tests frequently** - Catch issues early
5. **Use debug logging** - Understand data flow

---

## Expected Outcomes

### After Refactoring

1. **Modular Architecture**
   - 4 independent phase classes
   - Clear BasePhase interface
   - Composable workflow system

2. **Better Testability**
   - Test phases in isolation
   - Mock individual phases
   - Clear test boundaries

3. **Extensibility**
   - Easy to add new phases
   - Easy to create custom workflows
   - No need to modify monolithic class

4. **Maintainability**
   - Single Responsibility Principle
   - Clear separation of concerns
   - No code duplication

5. **Backward Compatibility**
   - Existing code works unchanged
   - Zero breaking changes
   - Smooth migration path

### Example: Custom Workflow After Refactoring

```python
from cycling_ai.orchestration.workflows.base_workflow import BaseWorkflow
from cycling_ai.orchestration.phases.data_preparation import DataPreparationPhase
from cycling_ai.orchestration.phases.training_planning import TrainingPlanningPhase

class TrainingPlanOnlyWorkflow(BaseWorkflow):
    """Generate training plan without performance analysis."""

    def get_phases(self) -> list[BasePhase]:
        return [
            DataPreparationPhase(),
            TrainingPlanningPhase(),
        ]

    def execute_workflow(self, config: WorkflowConfig) -> WorkflowResult:
        # Execute Phase 1 → Phase 3 (skip Phase 2)
        ...

# Usage
workflow = TrainingPlanOnlyWorkflow(provider=anthropic_provider)
result = workflow.execute_workflow(config)
```

---

## Questions? Issues?

### For Implementation Agent

If you encounter issues during implementation:

1. **Check the relevant card specification** - All details documented
2. **Review MULTI_AGENT_REFACTOR_PLAN.md** - Architecture decisions explained
3. **Look at existing tests** - Patterns for testing similar code
4. **Run tests after each change** - Catch regressions immediately

### For Eduardo (Human Review)

Before starting implementation:
- Review MULTI_AGENT_REFACTOR_PLAN.md for architecture approval
- Review risk analysis section
- Confirm backward compatibility approach acceptable
- Confirm timeline estimate reasonable (12-16 hours)

---

## Final Checklist Before Starting

- [ ] Read this README completely
- [ ] Read MULTI_AGENT_REFACTOR_PLAN.md (60KB document)
- [ ] Read MULTI_AGENT_REFACTOR_CARDS_SUMMARY.md (all 10 cards)
- [ ] Read MULTI_AGENT_REFACTOR_CARD_001.md (first card detailed spec)
- [ ] Understand the goal: Modular phases, 100% backward compatible
- [ ] Understand the approach: TDD, sequential cards, test after each
- [ ] Understand the timeline: 12-16 hours, 2-3 days
- [ ] Ready to start with CARD_001

---

**STATUS:** ✅ PLANNING COMPLETE - READY FOR IMPLEMENTATION AGENT

**Next Step:** Assign to task-executor-tdd agent with instruction: "Start with CARD_001"

**Created:** 2025-11-02
**Task Owner:** Task Implementation Preparation Architect
**Reviewer:** Eduardo
