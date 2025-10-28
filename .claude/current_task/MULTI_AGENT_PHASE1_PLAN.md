# Phase 1 Implementation Plan: Core Multi-Agent Orchestrator Foundation

**Date**: 2025-10-27
**Status**: Ready for Implementation
**Estimated Effort**: 2-3 days
**Phase**: 1 of 4 (Foundation → Prompts → CLI → Integration)
**Architecture Reference**: `/Users/eduardo/Documents/projects/cycling-ai-analysis/plans/MULTI_AGENT_ORCHESTRATOR_ARCHITECTURE.md`

---

## Executive Summary

This plan implements **Phase 1** of the Multi-Agent Orchestrator Architecture, establishing the foundational data structures and core orchestration logic for a multi-phase, specialized-agent workflow system.

**What We're Building:**
- Core data structures for multi-phase workflows
- MultiAgentOrchestrator class with session isolation
- AgentPromptsManager with embedded specialized prompts
- MCP-compliant tool result extraction
- Comprehensive test suite (>85% coverage)

**Why This Matters:**
This foundation enables the `cycling-ai generate` command that will orchestrate 4 specialized AI agents to automatically produce comprehensive HTML reports from cycling data - a leap from single-shot analysis to end-to-end report generation.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│         PHASE 1: CORE ORCHESTRATOR FOUNDATION                │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  NEW COMPONENTS:                                              │
│                                                               │
│  multi_agent.py (~500 lines)                                 │
│  ├─ PhaseStatus(Enum)                                        │
│  ├─ PhaseResult(dataclass)                                   │
│  ├─ WorkflowConfig(dataclass)                                │
│  ├─ WorkflowResult(dataclass)                                │
│  └─ MultiAgentOrchestrator(class)                            │
│     ├─ execute_workflow()          # Main entry              │
│     ├─ _execute_phase()             # Generic phase exec     │
│     ├─ _execute_phase_1..4()        # Phase-specific         │
│     ├─ _extract_phase_data()        # MCP pattern            │
│     └─ Session isolation per phase                           │
│                                                               │
│  prompts.py (~200 lines)                                     │
│  ├─ DATA_PREPARATION_PROMPT                                  │
│  ├─ PERFORMANCE_ANALYSIS_PROMPT                              │
│  ├─ TRAINING_PLANNING_PROMPT                                 │
│  ├─ REPORT_GENERATION_PROMPT                                 │
│  └─ AgentPromptsManager(class)                               │
│     ├─ Embedded defaults                                     │
│     └─ Optional file overrides                               │
│                                                               │
│  INTEGRATION POINTS:                                          │
│  ├─ SessionManager → Session isolation                       │
│  ├─ AgentFactory → Agent creation                            │
│  ├─ BaseProvider → LLM abstraction                           │
│  └─ ToolExecutor → Tool execution                            │
└──────────────────────────────────────────────────────────────┘
```

---

## Context Analysis: What Already Exists

### Existing Infrastructure (No Changes Needed)

**1. Session Management** (`session.py`)
```python
class SessionManager:
    def create_session(provider_name, context, model, system_prompt):
        # Creates isolated conversation session
        # Perfect for per-phase isolation
```
**How we'll use it**: Create fresh session for each phase to prevent context bleed.

**2. Agent Factory** (`agent.py`)
```python
class AgentFactory:
    @staticmethod
    def create_agent(provider, session, system_prompt, max_iterations):
        # Creates LLMAgent with ToolExecutor
```
**How we'll use it**: Create specialized agent for each phase with custom system prompt.

**3. Provider Abstraction** (`providers/base.py`)
```python
class BaseProvider(ABC):
    def create_completion(messages, tools):
        # Unified interface across OpenAI, Anthropic, Gemini, Ollama
```
**How we'll use it**: Single provider instance works across all phases.

**4. Tool Execution** (Existing)
- Tools return `ToolExecutionResult` with success/data/format
- Results embedded in conversation messages (role="tool")
- **Critical**: We extract these from session.messages for inter-phase data passing

### The MCP Integration Pattern

**Challenge**: Tool results are embedded in conversation, not returned directly.

**Solution**: Extract from session messages after phase execution:
```python
def _extract_phase_data(self, phase_name, response, session):
    extracted = {}
    for message in session.messages:
        if message.role == "tool" and message.tool_results:
            for tool_result in message.tool_results:
                if tool_result.get("success"):
                    # Parse JSON from message.content
                    data = json.loads(message.content)
                    extracted[tool_name + "_data"] = data
    return extracted
```

This is the KEY integration pattern that makes multi-agent coordination work.

---

## Detailed Component Specifications

### 1. Data Structures (multi_agent.py, lines 1-200)

#### PhaseStatus Enum
```python
class PhaseStatus(Enum):
    """Workflow phase execution status."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"  # For optional phases
```

#### PhaseResult Dataclass
```python
@dataclass
class PhaseResult:
    """Result from executing a single workflow phase."""
    phase_name: str
    status: PhaseStatus
    agent_response: str
    extracted_data: dict[str, Any] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)
    execution_time_seconds: float = 0.0
    tokens_used: int = 0

    @property
    def success(self) -> bool:
        return self.status == PhaseStatus.COMPLETED

    def to_dict(self) -> dict[str, Any]:
        # Serialization for debugging/logging
```

**Design Rationale**:
- `extracted_data`: Structured data passed to next phase (from tool results)
- `agent_response`: Natural language summary (for debugging)
- `errors`: List allows multiple error messages
- `tokens_used`: Track costs per phase

#### WorkflowConfig Dataclass
```python
@dataclass
class WorkflowConfig:
    """Configuration for multi-agent workflow."""
    # Input paths
    csv_file_path: Path
    athlete_profile_path: Path
    fit_dir_path: Path | None = None

    # Output paths
    output_dir: Path = field(default_factory=lambda: Path("./reports"))

    # Execution parameters
    period_months: int = 6
    generate_training_plan: bool = True
    training_plan_weeks: int = 12

    # Provider configuration
    provider: BaseProvider | None = None
    max_iterations_per_phase: int = 5

    # Prompts configuration
    prompts_dir: Path | None = None

    def validate(self) -> None:
        """Validate all paths and parameters."""
        if not self.csv_file_path.exists():
            raise ValueError(f"CSV file not found: {self.csv_file_path}")
        # ... more validation
```

**Design Rationale**:
- All user inputs in one place
- Validation ensures fail-fast on bad config
- Defaults for optional parameters
- Provider can be None (set by orchestrator)

#### WorkflowResult Dataclass
```python
@dataclass
class WorkflowResult:
    """Complete result from workflow execution."""
    phase_results: list[PhaseResult]
    total_execution_time_seconds: float
    total_tokens_used: int
    output_files: list[Path] = field(default_factory=list)

    @property
    def success(self) -> bool:
        # Success if all non-skipped phases completed
        return all(r.success for r in self.phase_results
                   if r.status != PhaseStatus.SKIPPED)

    def get_phase_result(self, phase_name: str) -> PhaseResult | None:
        # Retrieve specific phase result

    def to_dict(self) -> dict[str, Any]:
        # Serialization for reporting
```

**Design Rationale**:
- Aggregates all phase results
- Tracks total resources (time, tokens)
- Output files list for user reference
- Success property for quick status check

---

### 2. MultiAgentOrchestrator Class (multi_agent.py, lines 201-500)

#### Initialization
```python
class MultiAgentOrchestrator:
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
```

**Design Rationale**:
- Provider required (can't run without LLM)
- Prompts manager defaults to embedded prompts
- Session manager defaults to temp storage
- Progress callback for UI integration (Phase 2)

#### Core Workflow Method
```python
def execute_workflow(self, config: WorkflowConfig) -> WorkflowResult:
    """
    Execute complete multi-agent workflow.

    Flow:
    1. Validate configuration
    2. Execute Phase 1: Data Preparation
    3. Execute Phase 2: Performance Analysis (uses Phase 1 data)
    4. Execute Phase 3: Training Planning (optional, uses Phase 2 data)
    5. Execute Phase 4: Report Generation (uses all previous data)
    6. Return aggregated WorkflowResult

    Fail-fast: Stop on first phase failure
    """
    config.validate()

    phase_results = []
    workflow_start = datetime.now()
    total_tokens = 0

    # Phase 1: Data Preparation
    phase1_result = self._execute_phase_1(config)
    phase_results.append(phase1_result)
    total_tokens += phase1_result.tokens_used

    if not phase1_result.success:
        return self._create_failed_workflow_result(...)

    # Phase 2: Performance Analysis (gets Phase 1 data)
    phase2_result = self._execute_phase_2(config, phase1_result)
    # ... similar pattern for Phase 3, 4

    return WorkflowResult(...)
```

**Design Rationale**:
- Sequential execution (each phase builds on previous)
- Early validation prevents wasted execution
- Fail-fast saves tokens/time
- Accumulates results for final report

#### Generic Phase Execution
```python
def _execute_phase(
    self,
    phase_name: str,
    config: WorkflowConfig,
    prompt_getter: Callable[[], str],
    tools: list[str],
    phase_context: dict[str, Any],
    user_message: str,
) -> PhaseResult:
    """
    Execute a single workflow phase with session isolation.

    Key steps:
    1. Create isolated session with system prompt
    2. Create agent with tool access
    3. Process user message (agent uses tools as needed)
    4. Extract structured data from tool results
    5. Calculate execution metrics
    6. Return PhaseResult
    """
    phase_start = datetime.now()

    # Notify progress callback
    if self.progress_callback:
        self.progress_callback(phase_name, PhaseStatus.IN_PROGRESS)

    try:
        # Create isolated session for this phase
        session = self.session_manager.create_session(
            provider_name=self.provider.config.provider_name,
            context=phase_context,
            model=self.provider.config.model,
            system_prompt=prompt_getter(),
        )

        # Create agent
        agent = AgentFactory.create_agent(
            provider=self.provider,
            session=session,
            max_iterations=config.max_iterations_per_phase,
        )

        # Execute phase
        response = agent.process_message(user_message)

        # Extract structured data from tool results
        extracted_data = self._extract_phase_data(phase_name, response, session)

        # Calculate metrics
        execution_time = (datetime.now() - phase_start).total_seconds()
        tokens_used = self._estimate_tokens(session)

        # Create successful result
        result = PhaseResult(
            phase_name=phase_name,
            status=PhaseStatus.COMPLETED,
            agent_response=response,
            extracted_data=extracted_data,
            execution_time_seconds=execution_time,
            tokens_used=tokens_used,
        )

        if self.progress_callback:
            self.progress_callback(phase_name, PhaseStatus.COMPLETED)

        return result

    except Exception as e:
        # Handle failure gracefully
        execution_time = (datetime.now() - phase_start).total_seconds()

        result = PhaseResult(
            phase_name=phase_name,
            status=PhaseStatus.FAILED,
            agent_response="",
            errors=[str(e)],
            execution_time_seconds=execution_time,
        )

        if self.progress_callback:
            self.progress_callback(phase_name, PhaseStatus.FAILED)

        return result
```

**Design Rationale**:
- Generic method handles all phases consistently
- Session isolation prevents context bleed
- Try-catch ensures graceful failure
- Progress callbacks for UI integration
- Metrics collected for cost tracking

#### MCP Data Extraction (Critical)
```python
def _extract_phase_data(
    self,
    phase_name: str,
    response: str,
    session: ConversationSession,
) -> dict[str, Any]:
    """
    Extract structured data from phase execution.

    Examines tool results in session messages to extract data
    that can be passed to subsequent phases.

    This is the KEY pattern for multi-agent coordination!
    """
    extracted = {}

    # Look through session messages for tool results
    for message in session.messages:
        if message.role == "tool" and message.tool_results:
            for tool_result in message.tool_results:
                if tool_result.get("success"):
                    tool_name = tool_result.get("tool_name", "")

                    # Extract data based on tool type
                    if tool_name == "analyze_performance":
                        try:
                            data = json.loads(message.content)
                            extracted["performance_data"] = data
                        except json.JSONDecodeError:
                            pass

                    elif tool_name == "analyze_zones":
                        try:
                            data = json.loads(message.content)
                            extracted["zones_data"] = data
                        except json.JSONDecodeError:
                            pass

                    # ... similar for other tools

    return extracted
```

**Design Rationale**:
- Reads from conversation session (MCP pattern)
- Robust JSON parsing with error handling
- Tool-specific extraction logic
- Returns empty dict on failure (graceful degradation)

---

### 3. AgentPromptsManager (prompts.py)

#### Embedded Prompts
```python
DATA_PREPARATION_PROMPT = """You are a data preparation specialist for cycling performance analysis.

**Your Role:**
Validate, organize, and cache cycling data files for downstream analysis.

**Objectives:**
1. Verify file existence and accessibility
2. Validate data structure and quality
3. Extract and cache key metadata
4. Prepare data for efficient analysis

**Available Tools:**
- File system operations
- Data validation utilities

**Output Requirements:**
- Confirm data files are valid
- Report any data quality issues
- Cache organized data for next phase

**Guidelines:**
- Be thorough but efficient
- Report issues clearly
- Don't perform analysis yet (save for next phase)
"""

PERFORMANCE_ANALYSIS_PROMPT = """You are an expert cycling performance analyst.

**Your Role:**
Analyze cycling performance data to identify trends, patterns, and insights.

**Expertise:**
- Training load analysis and periodization
- Power-based training zones (FTP)
- Performance trends and comparisons
- Time-in-zones analysis
- Polarized training methodology (80/20)

**Objectives:**
1. Compare recent vs previous period performance
2. Calculate time-in-zones distribution
3. Identify significant trends
4. Generate actionable insights

**Available Tools:**
- analyze_performance: Compare time periods
- analyze_zones: Calculate power zone distribution

**Output Requirements:**
- Clear comparison of periods
- Time-in-zones breakdown
- 3-5 key insights
- Data-driven observations

**Guidelines:**
- Use concrete numbers and percentages
- Explain the significance of trends
- Be encouraging but honest
- Focus on actionable patterns
"""

# ... TRAINING_PLANNING_PROMPT and REPORT_GENERATION_PROMPT similar
```

#### Prompts Manager Class
```python
class AgentPromptsManager:
    """Manages specialized system prompts for workflow agents."""

    def __init__(self, prompts_dir: Path | None = None):
        """
        Initialize prompts manager.

        Args:
            prompts_dir: Optional directory with custom prompts.
                         Expected files: data_preparation.txt,
                                        performance_analysis.txt,
                                        training_planning.txt,
                                        report_generation.txt
        """
        self.prompts_dir = prompts_dir
        self._custom_prompts: Dict[str, str] = {}

        if self.prompts_dir and self.prompts_dir.exists():
            self._load_custom_prompts()

    def _load_custom_prompts(self) -> None:
        """Load custom prompts from files if they exist."""
        prompt_files = {
            "data_preparation": "data_preparation.txt",
            "performance_analysis": "performance_analysis.txt",
            "training_planning": "training_planning.txt",
            "report_generation": "report_generation.txt",
        }

        for key, filename in prompt_files.items():
            file_path = self.prompts_dir / filename
            if file_path.exists():
                try:
                    self._custom_prompts[key] = file_path.read_text(encoding="utf-8")
                except Exception:
                    # Fall back to embedded default on error
                    pass

    def get_data_preparation_prompt(self) -> str:
        """Get data preparation agent system prompt."""
        return self._custom_prompts.get("data_preparation", DATA_PREPARATION_PROMPT)

    # ... similar methods for other prompts
```

**Design Rationale**:
- Embedded defaults = zero-configuration
- File override allows iteration without code changes
- Silent fallback on file errors (robustness)
- Clean interface for orchestrator

---

## Implementation Strategy

### Test-Driven Development Order

**CARD_001**: Data Structures
1. Write tests for PhaseStatus, PhaseResult, WorkflowConfig, WorkflowResult
2. Implement data structures to pass tests
3. Verify serialization, validation logic

**CARD_002**: Prompts Manager
1. Write tests for AgentPromptsManager (embedded and file loading)
2. Implement prompts manager
3. Verify all prompts load correctly

**CARD_003**: Orchestrator Core
1. Write tests for `_extract_phase_data()` with mocked sessions
2. Implement extraction logic
3. Write tests for `_execute_phase()` with mocked agent
4. Implement generic phase execution

**CARD_004**: Phase Execution
1. Write integration tests for each phase method
2. Implement `_execute_phase_1..4()` methods
3. Write test for `execute_workflow()` with mocked responses
4. Implement main workflow method

**CARD_005**: Integration Testing
1. End-to-end test with real SessionManager, mocked LLM
2. Session isolation verification
3. Data accumulation verification
4. Error handling verification

---

## Testing Approach

### Unit Tests (tests/orchestration/test_multi_agent.py)

```python
class TestPhaseResult:
    def test_creation(self):
        result = PhaseResult(
            phase_name="test",
            status=PhaseStatus.COMPLETED,
            agent_response="Success",
            extracted_data={"key": "value"},
        )
        assert result.success
        assert result.phase_name == "test"

    def test_to_dict_serialization(self):
        result = PhaseResult(...)
        d = result.to_dict()
        assert d["phase_name"] == "test"
        assert d["status"] == "completed"

class TestWorkflowConfig:
    def test_validation_missing_csv(self, tmp_path):
        config = WorkflowConfig(
            csv_file_path=tmp_path / "missing.csv",
            athlete_profile_path=tmp_path / "profile.json",
        )
        with pytest.raises(ValueError, match="CSV file not found"):
            config.validate()

class TestMultiAgentOrchestrator:
    @pytest.fixture
    def mock_provider(self):
        # Mock provider with queued responses
        ...

    def test_extract_phase_data_performance(self):
        # Create mock session with tool results
        session = Mock()
        session.messages = [
            ConversationMessage(
                role="tool",
                content='{"data": "value"}',
                tool_results=[{
                    "success": True,
                    "tool_name": "analyze_performance",
                }]
            )
        ]

        orchestrator = MultiAgentOrchestrator(provider=mock_provider)
        extracted = orchestrator._extract_phase_data("test", "response", session)

        assert "performance_data" in extracted
        assert extracted["performance_data"]["data"] == "value"

    def test_execute_workflow_all_phases(self, mock_provider, tmp_path):
        # Create test files
        csv_file = tmp_path / "activities.csv"
        csv_file.write_text("Activity Date,Distance,...")

        profile_file = tmp_path / "profile.json"
        profile_file.write_text('{"name": "Test", "ftp": 250}')

        # Configure workflow
        config = WorkflowConfig(
            csv_file_path=csv_file,
            athlete_profile_path=profile_file,
            output_dir=tmp_path / "reports",
        )

        # Execute workflow
        orchestrator = MultiAgentOrchestrator(provider=mock_provider)
        result = orchestrator.execute_workflow(config)

        # Verify
        assert result.success
        assert len(result.phase_results) == 4
        assert all(r.status == PhaseStatus.COMPLETED for r in result.phase_results)
```

### Integration Tests (tests/orchestration/test_multi_agent_integration.py)

```python
def test_session_isolation_between_phases(mock_provider, tmp_path):
    """Verify each phase gets isolated session."""
    orchestrator = MultiAgentOrchestrator(provider=mock_provider)

    # Track session IDs created
    session_ids = []
    original_create = orchestrator.session_manager.create_session

    def tracking_create(*args, **kwargs):
        session = original_create(*args, **kwargs)
        session_ids.append(session.session_id)
        return session

    orchestrator.session_manager.create_session = tracking_create

    # Execute workflow
    result = orchestrator.execute_workflow(config)

    # Verify unique session per phase
    assert len(session_ids) == 4
    assert len(set(session_ids)) == 4  # All unique
```

---

## Validation Criteria

### Phase 1 Complete When:

**Code Quality**
- [ ] All files pass `mypy --strict`
- [ ] All files pass `ruff check`
- [ ] Docstrings on all public classes/methods

**Test Coverage**
- [ ] >85% coverage on multi_agent.py
- [ ] >90% coverage on prompts.py
- [ ] All tests pass
- [ ] Integration tests verify session isolation

**Functionality**
- [ ] Can create and validate WorkflowConfig
- [ ] Can initialize MultiAgentOrchestrator
- [ ] Can execute single phase with mock provider
- [ ] Can extract tool results from session messages
- [ ] Prompts load (embedded and file-based)

---

## Risk Mitigation

**RISK**: MCP data extraction fails
**MITIGATION**: Comprehensive unit tests, robust JSON parsing, graceful degradation

**RISK**: Session isolation leaks context
**MITIGATION**: Integration test verifies unique sessions, test messages don't bleed

**RISK**: Type safety issues
**MITIGATION**: Use mypy --strict from start, proper type hints everywhere

---

## Next Steps After Phase 1

**Phase 2**: CLI Integration (`generate.py` command)
**Phase 3**: End-to-End Testing (real LLM, real data)
**Phase 4**: Production Ready (docs, optimization)

---

## Implementation Cards

Detailed step-by-step instructions in:
- `PLAN/MULTI_AGENT_CARD_001.md` - Data Structures
- `PLAN/MULTI_AGENT_CARD_002.md` - Prompts Manager
- `PLAN/MULTI_AGENT_CARD_003.md` - Orchestrator Core
- `PLAN/MULTI_AGENT_CARD_004.md` - Phase Execution
- `PLAN/MULTI_AGENT_CARD_005.md` - Testing & Validation

---

**Status**: Ready for implementation by task-executor-tdd agent
**Prepared by**: Task Implementation Preparation Architect
**Date**: 2025-10-27
