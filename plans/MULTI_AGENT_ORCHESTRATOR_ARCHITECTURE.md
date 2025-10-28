# Multi-Agent Workflow Orchestrator - Technical Architecture Plan

**Document Version:** 1.0.0
**Date:** 2025-10-27
**Status:** Definitive Implementation Guide

---

## Executive Summary

This document provides a comprehensive technical architecture for implementing a multi-agent workflow orchestrator in the cycling-ai-analysis project. The orchestrator will enable a new `cycling-ai generate` command that coordinates four specialized agents to automatically produce comprehensive HTML reports from cycling data.

### Key Architecture Principles

1. **Tool Reuse** - All existing tools work without modification
2. **Sequential Workflow** - Four distinct phases with data handoffs
3. **Fail Fast** - Stop workflow on any phase failure
4. **Embedded Prompts** - Zero-setup with customization option
5. **Session Isolation** - New session per phase prevents context bleed
6. **MCP Pattern** - Proper result extraction between phases

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  CLI: cycling-ai generate                    │
│              (commands/generate.py)                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         v
┌─────────────────────────────────────────────────────────────┐
│            MultiAgentOrchestrator                            │
│         (orchestration/multi_agent.py)                       │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │   Phase 1  │─>│   Phase 2  │─>│   Phase 3  │─>          │
│  │    Data    │  │Performance │  │  Training  │            │
│  │    Prep    │  │  Analysis  │  │   Planning │            │
│  └────────────┘  └────────────┘  └────────────┘            │
│                                                   │          │
│  ┌────────────┐                                  │          │
│  │   Phase 4  │<─────────────────────────────────┘          │
│  │   Report   │                                              │
│  │ Generation │                                              │
│  └────────────┘                                              │
└─────────────────────────────────────────────────────────────┘
                         │
                         v
┌─────────────────────────────────────────────────────────────┐
│          AgentPromptsManager                                 │
│       (orchestration/prompts.py)                             │
│                                                              │
│  Embedded Prompts:                                           │
│  • DATA_PREPARATION_PROMPT                                   │
│  • PERFORMANCE_ANALYSIS_PROMPT                               │
│  • TRAINING_PLANNING_PROMPT                                  │
│  • REPORT_GENERATION_PROMPT                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Table of Contents

1. [Requirements Analysis](#1-requirements-analysis)
2. [Component Specifications](#2-component-specifications)
3. [MCP Integration Patterns](#3-mcp-integration-patterns)
4. [Phase Definitions](#4-phase-definitions)
5. [Data Flow Architecture](#5-data-flow-architecture)
6. [CLI Integration](#6-cli-integration)
7. [Implementation Strategy](#7-implementation-strategy)
8. [Code Structure](#8-code-structure)
9. [Risk Analysis](#9-risk-analysis)
10. [Future Extensibility](#10-future-extensibility)

---

## 1. Requirements Analysis

### 1.1 Functional Requirements

**FR-1: Multi-Phase Workflow Execution**
- Execute 4 sequential phases: Data Prep → Performance Analysis → Training Planning → Report Generation
- Each phase uses a specialized agent with specific tools
- Data flows from one phase to the next
- Stop workflow on any phase failure

**FR-2: Agent Specialization**
- Each phase has a dedicated LLM agent with a specialized system prompt
- Tool access is limited per phase (principle of least privilege)
- Session isolation prevents context contamination

**FR-3: Report Generation**
- Generate 3 HTML files: index.html, coaching_insights.html, performance_dashboard.html
- Reports combine data from all phases
- Professional formatting with charts/tables

**FR-4: Zero-Configuration Setup**
- Embedded prompts work out-of-box
- Optional file-based prompt customization
- Leverage existing provider configuration

**FR-5: Progress Visibility**
- Real-time phase progress display
- Clear error reporting
- Execution time tracking per phase

### 1.2 Non-Functional Requirements

**NFR-1: Performance**
- Complete workflow in < 5 minutes for typical dataset
- Token budget management across phases
- Efficient data handoffs

**NFR-2: Reliability**
- Fail fast with clear error messages
- Graceful degradation (skip optional phases)
- Retry logic for transient failures

**NFR-3: Maintainability**
- Clean separation of concerns
- Type-safe implementation (mypy --strict)
- Comprehensive test coverage (>85%)

**NFR-4: Extensibility**
- Easy to add new phases
- Customizable prompts
- Pluggable report formats

### 1.3 Constraints

- Must work with existing provider abstraction (OpenAI, Anthropic, Gemini, Ollama)
- Must reuse existing tools without modification
- Must follow existing project patterns (monorepo, Click CLI, Rich formatting)
- Limited by LLM context windows and token budgets

### 1.4 Stakeholders

- **End Users**: Cyclists wanting comprehensive analysis reports
- **Developers**: Need clear extension points for new phases/prompts
- **System**: Existing chat command must continue working unchanged

---

## 2. Component Specifications

### 2.1 MultiAgentOrchestrator

**Location:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/src/cycling_ai/orchestration/multi_agent.py`

**Purpose:** Coordinates sequential execution of specialized agents across multiple phases.

#### 2.1.1 Class Definition

```python
"""
Multi-agent workflow orchestrator.

Coordinates sequential execution of specialized agents across multiple phases,
with data handoffs between phases and comprehensive error handling.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Callable

from cycling_ai.orchestration.agent import AgentFactory
from cycling_ai.orchestration.prompts import AgentPromptsManager
from cycling_ai.orchestration.session import ConversationSession, SessionManager
from cycling_ai.providers.base import BaseProvider


class PhaseStatus(Enum):
    """Status of a workflow phase."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class PhaseResult:
    """
    Result from executing a single workflow phase.

    Contains both the agent's response and extracted structured data
    that can be passed to subsequent phases.
    """
    phase_name: str
    status: PhaseStatus
    agent_response: str
    extracted_data: dict[str, Any] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)
    execution_time_seconds: float = 0.0
    tokens_used: int = 0

    @property
    def success(self) -> bool:
        """Whether phase completed successfully."""
        return self.status == PhaseStatus.COMPLETED

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "phase_name": self.phase_name,
            "status": self.status.value,
            "agent_response": self.agent_response,
            "extracted_data": self.extracted_data,
            "errors": self.errors,
            "execution_time_seconds": self.execution_time_seconds,
            "tokens_used": self.tokens_used,
        }


@dataclass
class WorkflowConfig:
    """
    Configuration for multi-agent workflow.

    Defines inputs, outputs, and execution parameters for the workflow.
    """
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
    prompts_dir: Path | None = None  # Optional custom prompts directory

    def validate(self) -> None:
        """
        Validate configuration.

        Raises:
            ValueError: If configuration is invalid
        """
        if not self.csv_file_path.exists():
            raise ValueError(f"CSV file not found: {self.csv_file_path}")

        if not self.athlete_profile_path.exists():
            raise ValueError(f"Athlete profile not found: {self.athlete_profile_path}")

        if self.fit_dir_path and not self.fit_dir_path.is_dir():
            raise ValueError(f"FIT directory not found: {self.fit_dir_path}")

        if self.period_months < 1 or self.period_months > 24:
            raise ValueError("period_months must be between 1 and 24")

        if self.training_plan_weeks < 1 or self.training_plan_weeks > 52:
            raise ValueError("training_plan_weeks must be between 1 and 52")


@dataclass
class WorkflowResult:
    """
    Complete result from workflow execution.

    Contains results from all phases and metadata about the workflow run.
    """
    phase_results: list[PhaseResult]
    total_execution_time_seconds: float
    total_tokens_used: int
    output_files: list[Path] = field(default_factory=list)

    @property
    def success(self) -> bool:
        """Whether entire workflow completed successfully."""
        return all(r.success for r in self.phase_results if r.status != PhaseStatus.SKIPPED)

    def get_phase_result(self, phase_name: str) -> PhaseResult | None:
        """Get result for specific phase."""
        for result in self.phase_results:
            if result.phase_name == phase_name:
                return result
        return None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "phase_results": [r.to_dict() for r in self.phase_results],
            "total_execution_time_seconds": self.total_execution_time_seconds,
            "total_tokens_used": self.total_tokens_used,
            "output_files": [str(f) for f in self.output_files],
            "success": self.success,
        }


class MultiAgentOrchestrator:
    """
    Orchestrates multi-agent workflow execution.

    Coordinates sequential phases with specialized agents, managing data flow,
    session isolation, and error handling.
    """

    def __init__(
        self,
        provider: BaseProvider,
        prompts_manager: AgentPromptsManager | None = None,
        session_manager: SessionManager | None = None,
        progress_callback: Callable[[str, PhaseStatus], None] | None = None,
    ):
        """
        Initialize orchestrator.

        Args:
            provider: LLM provider for all agents
            prompts_manager: Manager for agent prompts (uses default if None)
            session_manager: Session manager (uses default if None)
            progress_callback: Optional callback for progress updates
        """
        self.provider = provider
        self.prompts_manager = prompts_manager or AgentPromptsManager()
        self.session_manager = session_manager or self._get_default_session_manager()
        self.progress_callback = progress_callback

    def execute_workflow(self, config: WorkflowConfig) -> WorkflowResult:
        """
        Execute complete multi-agent workflow.

        Args:
            config: Workflow configuration

        Returns:
            WorkflowResult with all phase results

        Raises:
            ValueError: If configuration is invalid
        """
        # Validate configuration
        config.validate()

        # Initialize results
        phase_results: list[PhaseResult] = []
        workflow_start = datetime.now()
        total_tokens = 0

        # Phase 1: Data Preparation
        phase1_result = self._execute_phase_1(config)
        phase_results.append(phase1_result)
        total_tokens += phase1_result.tokens_used

        if not phase1_result.success:
            return self._create_failed_workflow_result(phase_results, workflow_start, total_tokens)

        # Phase 2: Performance Analysis
        phase2_result = self._execute_phase_2(config, phase1_result)
        phase_results.append(phase2_result)
        total_tokens += phase2_result.tokens_used

        if not phase2_result.success:
            return self._create_failed_workflow_result(phase_results, workflow_start, total_tokens)

        # Phase 3: Training Planning (optional)
        if config.generate_training_plan:
            phase3_result = self._execute_phase_3(config, phase2_result)
            phase_results.append(phase3_result)
            total_tokens += phase3_result.tokens_used

            if not phase3_result.success:
                # Training plan failure is non-fatal, mark as skipped
                phase3_result.status = PhaseStatus.SKIPPED
        else:
            # Skip training planning
            phase_results.append(PhaseResult(
                phase_name="training_planning",
                status=PhaseStatus.SKIPPED,
                agent_response="Training plan generation was not requested",
                extracted_data={},
            ))

        # Phase 4: Report Generation
        phase4_result = self._execute_phase_4(config, phase_results)
        phase_results.append(phase4_result)
        total_tokens += phase4_result.tokens_used

        if not phase4_result.success:
            return self._create_failed_workflow_result(phase_results, workflow_start, total_tokens)

        # Create successful workflow result
        workflow_end = datetime.now()
        total_time = (workflow_end - workflow_start).total_seconds()

        return WorkflowResult(
            phase_results=phase_results,
            total_execution_time_seconds=total_time,
            total_tokens_used=total_tokens,
            output_files=phase4_result.extracted_data.get("output_files", []),
        )

    def _execute_phase_1(self, config: WorkflowConfig) -> PhaseResult:
        """Execute Phase 1: Data Preparation."""
        return self._execute_phase(
            phase_name="data_preparation",
            config=config,
            prompt_getter=lambda: self.prompts_manager.get_data_preparation_prompt(),
            tools=["analyze_performance", "analyze_zones"],
            phase_context={
                "csv_file_path": str(config.csv_file_path),
                "athlete_profile_path": str(config.athlete_profile_path),
                "fit_dir_path": str(config.fit_dir_path) if config.fit_dir_path else None,
            },
            user_message=f"""Prepare cycling data for analysis:

1. Verify data files exist and are accessible
2. Extract athlete profile information
3. Validate CSV structure and FIT files
4. Create organized cache of processed data

CSV: {config.csv_file_path}
Profile: {config.athlete_profile_path}
FIT Directory: {config.fit_dir_path or 'Not provided'}
""",
        )

    def _execute_phase_2(self, config: WorkflowConfig, phase1_result: PhaseResult) -> PhaseResult:
        """Execute Phase 2: Performance Analysis."""
        return self._execute_phase(
            phase_name="performance_analysis",
            config=config,
            prompt_getter=lambda: self.prompts_manager.get_performance_analysis_prompt(),
            tools=["analyze_performance", "analyze_zones"],
            phase_context=phase1_result.extracted_data,
            user_message=f"""Analyze cycling performance for the last {config.period_months} months:

1. Compare recent period vs previous equivalent period
2. Calculate time-in-zones distribution
3. Identify trends and patterns
4. Generate insights and observations

Use the data prepared in phase 1.
""",
        )

    def _execute_phase_3(self, config: WorkflowConfig, phase2_result: PhaseResult) -> PhaseResult:
        """Execute Phase 3: Training Planning."""
        return self._execute_phase(
            phase_name="training_planning",
            config=config,
            prompt_getter=lambda: self.prompts_manager.get_training_planning_prompt(),
            tools=["generate_training_plan"],
            phase_context=phase2_result.extracted_data,
            user_message=f"""Create a {config.training_plan_weeks}-week training plan:

1. Review performance analysis findings
2. Consider current fitness level and trends
3. Design periodized plan with progressive overload
4. Include recovery weeks and taper

Base the plan on insights from the performance analysis phase.
""",
        )

    def _execute_phase_4(self, config: WorkflowConfig, all_results: list[PhaseResult]) -> PhaseResult:
        """Execute Phase 4: Report Generation."""
        # Combine data from all previous phases
        combined_data = {}
        for result in all_results:
            combined_data.update(result.extracted_data)

        return self._execute_phase(
            phase_name="report_generation",
            config=config,
            prompt_getter=lambda: self.prompts_manager.get_report_generation_prompt(),
            tools=["generate_report"],
            phase_context=combined_data,
            user_message=f"""Generate comprehensive HTML reports:

1. index.html - Executive summary and navigation
2. coaching_insights.html - Detailed analysis and recommendations
3. performance_dashboard.html - Visual data dashboard

Output directory: {config.output_dir}

Combine all insights from previous phases into cohesive reports.
""",
        )

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
        Execute a single workflow phase.

        Args:
            phase_name: Name of the phase
            config: Workflow configuration
            prompt_getter: Callable that returns system prompt
            tools: List of tool names available in this phase
            phase_context: Context data from previous phases
            user_message: User message to send to agent

        Returns:
            PhaseResult from execution
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

            # Create agent with tool filtering
            agent = AgentFactory.create_agent(
                provider=self.provider,
                session=session,
                max_iterations=config.max_iterations_per_phase,
            )

            # Filter tools for this phase
            # TODO: Implement tool filtering in AgentFactory or ToolExecutor

            # Execute phase
            response = agent.process_message(user_message)

            # Extract structured data from response
            extracted_data = self._extract_phase_data(phase_name, response, session)

            # Calculate execution time
            phase_end = datetime.now()
            execution_time = (phase_end - phase_start).total_seconds()

            # Estimate tokens used (rough approximation)
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

            # Notify progress callback
            if self.progress_callback:
                self.progress_callback(phase_name, PhaseStatus.COMPLETED)

            return result

        except Exception as e:
            # Handle phase failure
            phase_end = datetime.now()
            execution_time = (phase_end - phase_start).total_seconds()

            result = PhaseResult(
                phase_name=phase_name,
                status=PhaseStatus.FAILED,
                agent_response="",
                errors=[str(e)],
                execution_time_seconds=execution_time,
            )

            # Notify progress callback
            if self.progress_callback:
                self.progress_callback(phase_name, PhaseStatus.FAILED)

            return result

    def _extract_phase_data(
        self,
        phase_name: str,
        response: str,
        session: ConversationSession,
    ) -> dict[str, Any]:
        """
        Extract structured data from phase execution.

        Examines tool results in the session to extract data that can
        be passed to subsequent phases.

        Args:
            phase_name: Name of the phase
            response: Agent's final response
            session: Conversation session

        Returns:
            Extracted structured data
        """
        extracted: dict[str, Any] = {}

        # Look through session messages for tool results
        for message in session.messages:
            if message.role == "tool" and message.tool_results:
                for tool_result in message.tool_results:
                    if tool_result.get("success"):
                        tool_name = tool_result.get("tool_name", "")

                        # Extract data based on tool type
                        if tool_name == "analyze_performance":
                            # Parse JSON from content
                            try:
                                import json
                                data = json.loads(message.content)
                                extracted["performance_data"] = data
                            except json.JSONDecodeError:
                                pass

                        elif tool_name == "analyze_zones":
                            try:
                                import json
                                data = json.loads(message.content)
                                extracted["zones_data"] = data
                            except json.JSONDecodeError:
                                pass

                        elif tool_name == "generate_training_plan":
                            try:
                                import json
                                data = json.loads(message.content)
                                extracted["training_plan_data"] = data
                            except json.JSONDecodeError:
                                pass

                        elif tool_name == "generate_report":
                            try:
                                import json
                                data = json.loads(message.content)
                                extracted["report_data"] = data
                                if "report_path" in data:
                                    extracted["output_files"] = [Path(data["report_path"])]
                            except json.JSONDecodeError:
                                pass

        return extracted

    def _estimate_tokens(self, session: ConversationSession) -> int:
        """
        Estimate tokens used in session.

        Rough approximation: 4 characters per token.
        """
        total_chars = sum(len(msg.content) for msg in session.messages)
        return total_chars // 4

    def _create_failed_workflow_result(
        self,
        phase_results: list[PhaseResult],
        workflow_start: datetime,
        total_tokens: int,
    ) -> WorkflowResult:
        """Create workflow result for failed workflow."""
        workflow_end = datetime.now()
        total_time = (workflow_end - workflow_start).total_seconds()

        return WorkflowResult(
            phase_results=phase_results,
            total_execution_time_seconds=total_time,
            total_tokens_used=total_tokens,
            output_files=[],
        )

    def _get_default_session_manager(self) -> SessionManager:
        """Get default session manager for workflow sessions."""
        from cycling_ai.orchestration.session import SessionManager

        # Use temporary directory for workflow sessions
        storage_dir = Path.home() / ".cycling-ai" / "workflow_sessions"
        return SessionManager(storage_dir=storage_dir)
```

#### 2.1.2 Interface Contract

**Inputs:**
- `WorkflowConfig`: Configuration containing all input paths and parameters
- `BaseProvider`: LLM provider instance
- Optional `AgentPromptsManager`: Custom prompts
- Optional progress callback

**Outputs:**
- `WorkflowResult`: Complete workflow results with phase-by-phase data
- Generated HTML reports in output directory

**Error Handling:**
- Validates configuration before execution
- Fail-fast: stops on first phase failure
- Optional phases (training plan) marked as SKIPPED on failure
- Comprehensive error messages in PhaseResult.errors

---

### 2.2 AgentPromptsManager

**Location:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/src/cycling_ai/orchestration/prompts.py`

**Purpose:** Manages specialized system prompts for each agent type with embedded defaults and optional file loading.

#### 2.2.1 Class Definition

```python
"""
Agent prompts manager.

Manages specialized system prompts for each agent type in the multi-agent
workflow, with embedded defaults and optional file-based customization.
"""
from __future__ import annotations

from pathlib import Path
from typing import Dict


# Embedded default prompts
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

TRAINING_PLANNING_PROMPT = """You are an expert cycling training plan designer.

**Your Role:**
Create periodized training plans based on performance analysis findings.

**Expertise:**
- Periodization (base, build, peak, taper)
- Progressive overload principles
- Recovery and adaptation
- FTP improvement strategies
- Training stress balance

**Objectives:**
1. Review performance analysis insights
2. Design periodized plan structure
3. Balance intensity and recovery
4. Target specific improvements

**Available Tools:**
- generate_training_plan: Create structured training plan

**Output Requirements:**
- Periodized plan with clear phases
- Weekly structure with recovery weeks
- Intensity distribution (80/20 or similar)
- Specific workout types and targets

**Guidelines:**
- Base plan on analysis findings
- Consider current fitness level
- Include progression and recovery
- Explain training rationale
"""

REPORT_GENERATION_PROMPT = """You are a technical writer specializing in cycling performance reports.

**Your Role:**
Generate comprehensive, professional HTML reports combining all analysis phases.

**Objectives:**
1. Create index.html with executive summary
2. Create coaching_insights.html with detailed analysis
3. Create performance_dashboard.html with visual data

**Available Tools:**
- generate_report: Create HTML reports
- Data from all previous phases

**Output Requirements:**
- Professional, clean HTML
- Clear visual hierarchy
- Executive summary for quick scanning
- Detailed insights for deep dive
- Visual dashboard with charts/tables

**Content Structure:**

**index.html:**
- Athlete overview
- Key metrics summary
- Navigation to detailed reports
- High-level insights (3-5 bullet points)

**coaching_insights.html:**
- Performance analysis section
- Zone distribution analysis
- Training plan recommendations
- Detailed insights and trends
- Actionable recommendations

**performance_dashboard.html:**
- Visual charts and graphs
- Comparative tables
- Time-in-zones visualization
- Monthly trends
- Best performances highlights

**Guidelines:**
- Write in clear, professional language
- Use visuals to enhance understanding
- Organize information logically
- Make insights actionable
- Ensure reports are self-contained (no external dependencies)
"""


class AgentPromptsManager:
    """
    Manages specialized system prompts for workflow agents.

    Provides embedded default prompts with optional file-based overrides
    for customization.
    """

    def __init__(self, prompts_dir: Path | None = None):
        """
        Initialize prompts manager.

        Args:
            prompts_dir: Optional directory containing custom prompt files.
                         If None, uses embedded defaults.

        Expected files in prompts_dir (all optional):
        - data_preparation.txt
        - performance_analysis.txt
        - training_planning.txt
        - report_generation.txt
        """
        self.prompts_dir = prompts_dir
        self._custom_prompts: Dict[str, str] = {}

        if self.prompts_dir and self.prompts_dir.exists():
            self._load_custom_prompts()

    def _load_custom_prompts(self) -> None:
        """Load custom prompts from files if they exist."""
        if not self.prompts_dir:
            return

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
                    # If loading fails, fall back to embedded default
                    pass

    def get_data_preparation_prompt(self) -> str:
        """Get data preparation agent system prompt."""
        return self._custom_prompts.get("data_preparation", DATA_PREPARATION_PROMPT)

    def get_performance_analysis_prompt(self) -> str:
        """Get performance analysis agent system prompt."""
        return self._custom_prompts.get("performance_analysis", PERFORMANCE_ANALYSIS_PROMPT)

    def get_training_planning_prompt(self) -> str:
        """Get training planning agent system prompt."""
        return self._custom_prompts.get("training_planning", TRAINING_PLANNING_PROMPT)

    def get_report_generation_prompt(self) -> str:
        """Get report generation agent system prompt."""
        return self._custom_prompts.get("report_generation", REPORT_GENERATION_PROMPT)

    def list_available_prompts(self) -> list[str]:
        """List all available prompt types."""
        return [
            "data_preparation",
            "performance_analysis",
            "training_planning",
            "report_generation",
        ]

    def is_custom_prompt_loaded(self, prompt_type: str) -> bool:
        """Check if custom prompt is loaded for given type."""
        return prompt_type in self._custom_prompts
```

---

### 2.3 Generate CLI Command

**Location:** `/Users/eduardo/Documents/projects/cycling-ai-analysis/src/cycling_ai/cli/commands/generate.py`

**Purpose:** User-facing CLI command for the generate workflow.

#### 2.3.1 Command Implementation

```python
"""
Generate command for comprehensive report generation.

Orchestrates multi-agent workflow to produce comprehensive HTML reports
from cycling data in a single command.
"""
from __future__ import annotations

from pathlib import Path

import click
from rich.live import Live
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn
from rich.table import Table
from rich.panel import Panel

from cycling_ai.cli.formatting import console
from cycling_ai.config.loader import load_config
from cycling_ai.orchestration.multi_agent import (
    MultiAgentOrchestrator,
    WorkflowConfig,
    PhaseStatus,
)
from cycling_ai.orchestration.prompts import AgentPromptsManager
from cycling_ai.providers.base import ProviderConfig
from cycling_ai.providers.factory import ProviderFactory


@click.command()
@click.option(
    "--csv",
    "csv_file",
    type=click.Path(exists=True, path_type=Path),
    required=True,
    help="Path to Strava activities CSV export",
)
@click.option(
    "--profile",
    "profile_file",
    type=click.Path(exists=True, path_type=Path),
    required=True,
    help="Path to athlete profile JSON",
)
@click.option(
    "--fit-dir",
    type=click.Path(exists=True, path_type=Path),
    help="Directory containing FIT files for zone analysis",
)
@click.option(
    "--output-dir",
    type=click.Path(path_type=Path),
    default="./reports",
    help="Output directory for generated reports",
)
@click.option(
    "--period-months",
    type=int,
    default=6,
    help="Number of months for performance comparison",
)
@click.option(
    "--training-plan-weeks",
    type=int,
    default=12,
    help="Number of weeks for training plan",
)
@click.option(
    "--skip-training-plan",
    is_flag=True,
    help="Skip training plan generation phase",
)
@click.option(
    "--provider",
    type=click.Choice(["openai", "anthropic", "gemini", "ollama"]),
    default="anthropic",
    help="LLM provider to use",
)
@click.option(
    "--model",
    help="Specific model to use (e.g., gpt-4, claude-3-5-sonnet)",
)
@click.option(
    "--prompts-dir",
    type=click.Path(exists=True, path_type=Path),
    help="Directory containing custom agent prompts",
)
def generate(
    csv_file: Path,
    profile_file: Path,
    fit_dir: Path | None,
    output_dir: Path,
    period_months: int,
    training_plan_weeks: int,
    skip_training_plan: bool,
    provider: str,
    model: str | None,
    prompts_dir: Path | None,
) -> None:
    """
    Generate comprehensive cycling analysis reports.

    Orchestrates a multi-agent workflow to analyze cycling data and produce
    professional HTML reports including performance analysis, zone distribution,
    training recommendations, and visual dashboards.

    \b
    Example:
        cycling-ai generate \\
            --csv activities.csv \\
            --profile athlete.json \\
            --fit-dir ./fit_files \\
            --output-dir ./my_reports

    \b
    Output Files:
        - index.html - Executive summary and navigation
        - coaching_insights.html - Detailed analysis and recommendations
        - performance_dashboard.html - Visual data dashboard
    """
    try:
        # Display header
        console.print()
        console.print(Panel.fit(
            "[bold cyan]Multi-Agent Report Generator[/bold cyan]\n"
            "[dim]Orchestrating specialized agents for comprehensive analysis[/dim]",
            border_style="cyan"
        ))
        console.print()

        # Initialize provider
        console.print("[cyan]Initializing LLM provider...[/cyan]")
        provider_instance = _initialize_provider(provider, model)
        console.print(f"[green]✓ Provider initialized: {provider} ({provider_instance.config.model})[/green]")
        console.print()

        # Initialize prompts manager
        prompts_manager = AgentPromptsManager(prompts_dir=prompts_dir)
        if prompts_dir:
            console.print(f"[cyan]Using custom prompts from: {prompts_dir}[/cyan]")
        else:
            console.print("[cyan]Using embedded default prompts[/cyan]")
        console.print()

        # Create workflow configuration
        workflow_config = WorkflowConfig(
            csv_file_path=csv_file,
            athlete_profile_path=profile_file,
            fit_dir_path=fit_dir,
            output_dir=Path(output_dir),
            period_months=period_months,
            generate_training_plan=not skip_training_plan,
            training_plan_weeks=training_plan_weeks,
        )

        # Display configuration summary
        _display_config_summary(workflow_config)
        console.print()

        # Initialize orchestrator with progress tracking
        phase_tracker = PhaseProgressTracker()

        orchestrator = MultiAgentOrchestrator(
            provider=provider_instance,
            prompts_manager=prompts_manager,
            progress_callback=phase_tracker.update_phase,
        )

        # Execute workflow with live progress display
        console.print("[bold]Executing Multi-Agent Workflow[/bold]")
        console.print()

        with Live(phase_tracker.get_table(), refresh_per_second=4, console=console):
            result = orchestrator.execute_workflow(workflow_config)

        console.print()

        # Display results
        if result.success:
            _display_success_results(result)
        else:
            _display_failure_results(result)
            raise click.Abort()

    except click.Abort:
        console.print("[yellow]Generation cancelled[/yellow]")
        raise
    except Exception as e:
        console.print(f"[red]Error: {str(e)}[/red]")
        raise


class PhaseProgressTracker:
    """Tracks and displays progress of workflow phases."""

    def __init__(self):
        """Initialize progress tracker."""
        self.phases = {
            "data_preparation": {"name": "Data Preparation", "status": PhaseStatus.PENDING},
            "performance_analysis": {"name": "Performance Analysis", "status": PhaseStatus.PENDING},
            "training_planning": {"name": "Training Planning", "status": PhaseStatus.PENDING},
            "report_generation": {"name": "Report Generation", "status": PhaseStatus.PENDING},
        }

    def update_phase(self, phase_name: str, status: PhaseStatus) -> None:
        """Update phase status."""
        if phase_name in self.phases:
            self.phases[phase_name]["status"] = status

    def get_table(self) -> Table:
        """Generate Rich table showing current phase status."""
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("Phase", style="cyan", width=30)
        table.add_column("Status", width=20)

        for phase_id, phase_info in self.phases.items():
            name = phase_info["name"]
            status = phase_info["status"]

            # Format status with emoji and color
            if status == PhaseStatus.PENDING:
                status_str = "[dim]⏳ Pending[/dim]"
            elif status == PhaseStatus.IN_PROGRESS:
                status_str = "[yellow]🔄 In Progress[/yellow]"
            elif status == PhaseStatus.COMPLETED:
                status_str = "[green]✓ Completed[/green]"
            elif status == PhaseStatus.FAILED:
                status_str = "[red]✗ Failed[/red]"
            elif status == PhaseStatus.SKIPPED:
                status_str = "[dim]⊘ Skipped[/dim]"
            else:
                status_str = str(status.value)

            table.add_row(name, status_str)

        return table


def _initialize_provider(provider_name: str, model: str | None) -> Any:
    """Initialize LLM provider."""
    import os
    from cycling_ai.providers.base import ProviderConfig

    # Get API key from environment
    env_var_map = {
        "openai": "OPENAI_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY",
        "gemini": "GOOGLE_API_KEY",
        "ollama": "",
    }

    api_key = ""
    if env_var := env_var_map.get(provider_name):
        api_key = os.getenv(env_var, "")
        if not api_key and provider_name != "ollama":
            raise ValueError(
                f"API key not found. Please set {env_var} environment variable."
            )

    # Determine model
    if not model:
        defaults = {
            "openai": "gpt-4-turbo-2024-04-09",
            "anthropic": "claude-3-5-sonnet-20241022",
            "gemini": "gemini-1.5-pro",
            "ollama": "llama3.2:3b",
        }
        model = defaults[provider_name]

    # Create provider config
    config = ProviderConfig(
        provider_name=provider_name,
        api_key=api_key,
        model=model,
        temperature=0.7,
        max_tokens=4096,
    )

    # Create provider
    return ProviderFactory.create_provider(config)


def _display_config_summary(config: WorkflowConfig) -> None:
    """Display configuration summary."""
    table = Table(title="Workflow Configuration", show_header=False)
    table.add_column("Setting", style="cyan")
    table.add_column("Value", style="white")

    table.add_row("CSV File", str(config.csv_file_path))
    table.add_row("Athlete Profile", str(config.athlete_profile_path))
    table.add_row("FIT Directory", str(config.fit_dir_path) if config.fit_dir_path else "Not provided")
    table.add_row("Output Directory", str(config.output_dir))
    table.add_row("Analysis Period", f"{config.period_months} months")
    table.add_row("Training Plan", f"{config.training_plan_weeks} weeks" if config.generate_training_plan else "Disabled")

    console.print(table)


def _display_success_results(result: Any) -> None:
    """Display successful workflow results."""
    console.print(Panel.fit(
        "[bold green]✓ Workflow Completed Successfully[/bold green]",
        border_style="green"
    ))
    console.print()

    # Execution summary
    summary_table = Table(title="Execution Summary", show_header=False)
    summary_table.add_column("Metric", style="cyan")
    summary_table.add_column("Value", style="white")

    summary_table.add_row("Total Time", f"{result.total_execution_time_seconds:.1f}s")
    summary_table.add_row("Total Tokens", f"{result.total_tokens_used:,}")
    summary_table.add_row("Phases Completed", str(sum(1 for r in result.phase_results if r.success)))

    console.print(summary_table)
    console.print()

    # Output files
    if result.output_files:
        console.print("[bold]Generated Reports:[/bold]")
        for file_path in result.output_files:
            console.print(f"  [green]✓[/green] {file_path}")
        console.print()

    console.print("[dim]Open the reports in your browser to view the analysis.[/dim]")


def _display_failure_results(result: Any) -> None:
    """Display failed workflow results."""
    console.print(Panel.fit(
        "[bold red]✗ Workflow Failed[/bold red]",
        border_style="red"
    ))
    console.print()

    # Show which phase failed
    for phase_result in result.phase_results:
        if phase_result.status == PhaseStatus.FAILED:
            console.print(f"[red]Failed at phase: {phase_result.phase_name}[/red]")
            if phase_result.errors:
                console.print("[red]Errors:[/red]")
                for error in phase_result.errors:
                    console.print(f"  • {error}")
            console.print()
```

#### 2.3.2 CLI Integration

Update `/Users/eduardo/Documents/projects/cycling-ai-analysis/src/cycling_ai/cli/main.py`:

```python
# Add import
from .commands import analyze, chat, config as config_cmd, plan, providers, report, generate

# Register command
cli.add_command(generate.generate)
```

---

## 3. MCP Integration Patterns

### 3.1 The MCP Challenge

When using Model Context Protocol (MCP) tools with LLMs, results are embedded in the conversation as tool response messages rather than directly accessible. We need to extract structured data from these messages to pass between phases.

### 3.2 Result Extraction Pattern

The key pattern is to examine the conversation session after agent execution and extract tool results from "tool" role messages:

```python
def _extract_phase_data(
    self,
    phase_name: str,
    response: str,
    session: ConversationSession,
) -> dict[str, Any]:
    """
    Extract structured data from phase execution.

    This is the critical MCP integration pattern: we examine the
    conversation session to find tool results and extract structured
    data for the next phase.
    """
    extracted: dict[str, Any] = {}

    # Iterate through all messages in the session
    for message in session.messages:
        # Look for tool result messages
        if message.role == "tool" and message.tool_results:
            for tool_result in message.tool_results:
                # Only process successful tool executions
                if tool_result.get("success"):
                    tool_name = tool_result.get("tool_name", "")

                    # The actual data is in message.content, which contains
                    # the JSON stringified result from ToolExecutionResult
                    if tool_name == "analyze_performance":
                        try:
                            import json
                            # Parse JSON from content
                            data = json.loads(message.content)
                            extracted["performance_data"] = data
                        except json.JSONDecodeError:
                            # If parsing fails, skip this result
                            pass

                    elif tool_name == "analyze_zones":
                        try:
                            import json
                            data = json.loads(message.content)
                            extracted["zones_data"] = data
                        except json.JSONDecodeError:
                            pass

                    # ... handle other tool types

    return extracted
```

### 3.3 Key MCP Patterns

**Pattern 1: Tool Result Location**
```python
# Tool results are in session.messages with role="tool"
for message in session.messages:
    if message.role == "tool":
        # message.content contains the stringified data
        # message.tool_results contains metadata
```

**Pattern 2: JSON Parsing**
```python
# Most tools return JSON format
if tool_result.get("format") == "json":
    data = json.loads(message.content)
```

**Pattern 3: Error Handling**
```python
# Always check success flag before extracting
if tool_result.get("success"):
    # Extract data
else:
    # Handle error - tool_result may contain error info
```

**Pattern 4: Multiple Tool Calls**
```python
# An agent may call multiple tools in one phase
# Extract all results and combine
extracted = {}
for message in session.messages:
    if message.role == "tool":
        # Extract and merge into extracted dict
```

### 3.4 Data Handoff Between Phases

```
Phase 1: Data Preparation
  Agent calls: No tools (just validation)
  Extracts: File paths, validation status
  Passes to Phase 2: {
    "csv_validated": True,
    "profile_validated": True,
    "fit_files_count": 42
  }

Phase 2: Performance Analysis
  Agent calls: analyze_performance, analyze_zones
  Extracts: Performance JSON, Zones JSON
  Passes to Phase 3: {
    "performance_data": {...},  # Full analyze_performance result
    "zones_data": {...},        # Full analyze_zones result
  }

Phase 3: Training Planning
  Agent calls: generate_training_plan
  Extracts: Training plan JSON
  Passes to Phase 4: {
    "performance_data": {...},  # Forwarded from Phase 2
    "zones_data": {...},        # Forwarded from Phase 2
    "training_plan_data": {...} # New from Phase 3
  }

Phase 4: Report Generation
  Agent calls: generate_report
  Extracts: Output file paths
  Returns: {
    "output_files": [
      Path("./reports/index.html"),
      Path("./reports/coaching_insights.html"),
      Path("./reports/performance_dashboard.html")
    ]
  }
```

### 3.5 Session Isolation

Each phase gets a fresh `ConversationSession` to prevent:
- Context window overflow
- Cross-phase prompt contamination
- Token budget exhaustion

```python
# Create new session for each phase
session = self.session_manager.create_session(
    provider_name=self.provider.config.provider_name,
    context=phase_context,  # Data from previous phases
    model=self.provider.config.model,
    system_prompt=prompt_getter(),
)

# Session only lives for this phase
agent = AgentFactory.create_agent(
    provider=self.provider,
    session=session,
    max_iterations=config.max_iterations_per_phase,
)

# Execute phase
response = agent.process_message(user_message)

# Extract results from THIS session only
extracted_data = self._extract_phase_data(phase_name, response, session)
```

---

## 4. Phase Definitions

### 4.1 Phase 1: Data Preparation

**Purpose:** Validate input files and prepare data for analysis.

**System Prompt:** `DATA_PREPARATION_PROMPT` (see AgentPromptsManager)

**Available Tools:**
- None (primarily validation and file system checks)

**Inputs:**
```python
{
    "csv_file_path": str,
    "athlete_profile_path": str,
    "fit_dir_path": str | None,
}
```

**User Message Template:**
```
Prepare cycling data for analysis:

1. Verify data files exist and are accessible
2. Extract athlete profile information
3. Validate CSV structure and FIT files
4. Create organized cache of processed data

CSV: {csv_file_path}
Profile: {athlete_profile_path}
FIT Directory: {fit_dir_path or 'Not provided'}
```

**Expected Outputs:**
```python
{
    "csv_validated": bool,
    "profile_validated": bool,
    "fit_files_count": int,
    "athlete_name": str,
    "athlete_ftp": int,
}
```

**Success Criteria:**
- CSV file exists and is readable
- Athlete profile exists and contains required fields
- FIT directory exists (if provided) and contains .fit files

**Failure Conditions:**
- Missing or unreadable files
- Invalid athlete profile structure
- No FIT files found when directory provided

---

### 4.2 Phase 2: Performance Analysis

**Purpose:** Analyze cycling performance comparing time periods and calculating zone distribution.

**System Prompt:** `PERFORMANCE_ANALYSIS_PROMPT`

**Available Tools:**
- `analyze_performance`: Compare recent vs previous period
- `analyze_zones`: Calculate time-in-zones from FIT files

**Inputs (from Phase 1):**
```python
{
    "csv_file_path": str,
    "athlete_profile_path": str,
    "fit_dir_path": str | None,
    # Plus validation results from Phase 1
}
```

**User Message Template:**
```
Analyze cycling performance for the last {period_months} months:

1. Compare recent period vs previous equivalent period
2. Calculate time-in-zones distribution
3. Identify trends and patterns
4. Generate insights and observations

Use the data prepared in phase 1.
```

**Tool Call Sequence:**
```python
# Call 1: Performance comparison
agent calls: analyze_performance(
    csv_file_path=csv_file_path,
    athlete_profile_json=athlete_profile_path,
    period_months=period_months
)
# Returns: Full performance analysis JSON

# Call 2: Zone distribution (if FIT files available)
agent calls: analyze_zones(
    fit_dir=fit_dir_path,
    athlete_profile_json=athlete_profile_path
)
# Returns: Full zones analysis JSON
```

**Expected Outputs:**
```python
{
    "performance_data": {
        "athlete_profile": {...},
        "recent_period": {...},
        "previous_period": {...},
        "trends": {...},
        "monthly_breakdown": [...],
        "best_power_rides": [...],
        "longest_rides": [...]
    },
    "zones_data": {
        "zones": {...},
        "total_time_hours": float,
        "easy_percent": float,
        "moderate_percent": float,
        "hard_percent": float,
        "polarization_score": float
    }
}
```

**Success Criteria:**
- Both tools execute successfully
- Performance data shows valid comparisons
- Zone data contains all 5 zones (if FIT files provided)

**Failure Conditions:**
- Tool execution errors
- Invalid CSV data
- Missing required columns

---

### 4.3 Phase 3: Training Planning (Optional)

**Purpose:** Generate periodized training plan based on performance analysis.

**System Prompt:** `TRAINING_PLANNING_PROMPT`

**Available Tools:**
- `generate_training_plan`: Create structured training plan

**Inputs (from Phase 2):**
```python
{
    "performance_data": {...},  # Full performance analysis
    "zones_data": {...},        # Full zones analysis
    "athlete_profile_path": str,
    "training_plan_weeks": int,
}
```

**User Message Template:**
```
Create a {training_plan_weeks}-week training plan:

1. Review performance analysis findings
2. Consider current fitness level and trends
3. Design periodized plan with progressive overload
4. Include recovery weeks and taper

Base the plan on insights from the performance analysis phase.
```

**Tool Call:**
```python
agent calls: generate_training_plan(
    athlete_profile_json=athlete_profile_path,
    total_weeks=training_plan_weeks,
    current_ftp=<from performance_data>,
    target_ftp_increase_percent=<calculated from trends>
)
# Returns: Training plan JSON
```

**Expected Outputs:**
```python
{
    "performance_data": {...},  # Forwarded
    "zones_data": {...},        # Forwarded
    "training_plan_data": {
        "total_weeks": int,
        "current_ftp": int,
        "target_ftp": int,
        "ftp_gain": int,
        "ftp_gain_percent": float,
        "weeks": [...],
        "plan_text": str
    }
}
```

**Success Criteria:**
- Training plan generated with all weeks
- FTP targets are realistic
- Plan includes recovery weeks

**Failure Conditions:**
- Tool execution error
- Invalid athlete profile data
- Unrealistic parameters

**Note:** This phase is optional. If it fails, it's marked as SKIPPED and workflow continues to Phase 4.

---

### 4.4 Phase 4: Report Generation

**Purpose:** Generate comprehensive HTML reports combining all analysis phases.

**System Prompt:** `REPORT_GENERATION_PROMPT`

**Available Tools:**
- `generate_report`: Create HTML reports
- Custom HTML generation (if needed)

**Inputs (from all previous phases):**
```python
{
    "performance_data": {...},       # From Phase 2
    "zones_data": {...},             # From Phase 2
    "training_plan_data": {...},     # From Phase 3 (optional)
    "output_dir": Path,
}
```

**User Message Template:**
```
Generate comprehensive HTML reports:

1. index.html - Executive summary and navigation
2. coaching_insights.html - Detailed analysis and recommendations
3. performance_dashboard.html - Visual data dashboard

Output directory: {output_dir}

Combine all insights from previous phases into cohesive reports.
```

**Expected Report Structure:**

**index.html:**
```html
<!DOCTYPE html>
<html>
<head>
    <title>Cycling Performance Report</title>
    <style>/* Embedded CSS */</style>
</head>
<body>
    <h1>Performance Report - {Athlete Name}</h1>

    <section class="executive-summary">
        <h2>Executive Summary</h2>
        <ul>
            <li>Key Insight 1</li>
            <li>Key Insight 2</li>
            <li>Key Insight 3</li>
        </ul>
    </section>

    <section class="navigation">
        <h2>Report Sections</h2>
        <ul>
            <li><a href="coaching_insights.html">Coaching Insights</a></li>
            <li><a href="performance_dashboard.html">Performance Dashboard</a></li>
        </ul>
    </section>

    <section class="key-metrics">
        <h2>Key Metrics</h2>
        <table><!-- Metrics table --></table>
    </section>
</body>
</html>
```

**coaching_insights.html:**
```html
<!DOCTYPE html>
<html>
<head>
    <title>Coaching Insights</title>
    <style>/* Embedded CSS */</style>
</head>
<body>
    <nav><a href="index.html">← Back to Index</a></nav>

    <h1>Coaching Insights and Recommendations</h1>

    <section class="performance-analysis">
        <h2>Performance Analysis</h2>
        <!-- Detailed performance comparison -->
    </section>

    <section class="zone-distribution">
        <h2>Power Zone Distribution</h2>
        <!-- Time-in-zones analysis -->
    </section>

    <section class="training-recommendations">
        <h2>Training Recommendations</h2>
        <!-- If training plan was generated -->
    </section>

    <section class="action-items">
        <h2>Actionable Next Steps</h2>
        <ol>
            <li>Action 1</li>
            <li>Action 2</li>
            <li>Action 3</li>
        </ol>
    </section>
</body>
</html>
```

**performance_dashboard.html:**
```html
<!DOCTYPE html>
<html>
<head>
    <title>Performance Dashboard</title>
    <style>/* Embedded CSS with charts */</style>
</head>
<body>
    <nav><a href="index.html">← Back to Index</a></nav>

    <h1>Performance Dashboard</h1>

    <section class="period-comparison">
        <h2>Period Comparison</h2>
        <!-- Bar charts comparing periods -->
    </section>

    <section class="zone-visualization">
        <h2>Zone Distribution</h2>
        <!-- Pie chart or bar chart of zones -->
    </section>

    <section class="monthly-trends">
        <h2>Monthly Trends</h2>
        <!-- Line chart of monthly metrics -->
    </section>

    <section class="best-performances">
        <h2>Best Performances</h2>
        <!-- Table of top rides -->
    </section>
</body>
</html>
```

**Expected Outputs:**
```python
{
    "output_files": [
        Path("./reports/index.html"),
        Path("./reports/coaching_insights.html"),
        Path("./reports/performance_dashboard.html")
    ],
    "report_data": {
        "files_created": 3,
        "total_size_bytes": int
    }
}
```

**Success Criteria:**
- All 3 HTML files created
- Files contain valid HTML
- Reports are self-contained (no external dependencies)
- Professional formatting and styling

**Failure Conditions:**
- Cannot write to output directory
- HTML generation errors
- Missing data from previous phases

---

## 5. Data Flow Architecture

### 5.1 Overall Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│                        User Inputs                            │
│  • CSV file path                                             │
│  • Athlete profile JSON                                       │
│  • FIT directory (optional)                                   │
│  • Configuration parameters                                   │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          v
┌──────────────────────────────────────────────────────────────┐
│                   Phase 1: Data Preparation                   │
│                                                               │
│  Validates:                                                   │
│  • File existence and accessibility                           │
│  • Athlete profile structure                                  │
│  • FIT file availability                                      │
│                                                               │
│  Outputs:                                                     │
│  • Validation status                                          │
│  • File counts                                                │
│  • Basic athlete info                                         │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          v
┌──────────────────────────────────────────────────────────────┐
│                Phase 2: Performance Analysis                  │
│                                                               │
│  Executes Tools:                                              │
│  • analyze_performance → Performance JSON                     │
│  • analyze_zones → Zones JSON                                 │
│                                                               │
│  Outputs:                                                     │
│  • performance_data: {                                        │
│      athlete_profile, recent_period, previous_period,         │
│      trends, monthly_breakdown, best_rides                    │
│    }                                                          │
│  • zones_data: {                                              │
│      zones, time_hours, polarization_score                    │
│    }                                                          │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          v
┌──────────────────────────────────────────────────────────────┐
│               Phase 3: Training Planning (Optional)           │
│                                                               │
│  Executes Tools:                                              │
│  • generate_training_plan → Training Plan JSON                │
│                                                               │
│  Inputs:                                                      │
│  • Performance trends from Phase 2                            │
│  • Current FTP from athlete profile                           │
│  • Zone distribution insights                                 │
│                                                               │
│  Outputs:                                                     │
│  • training_plan_data: {                                      │
│      weeks, current_ftp, target_ftp, plan_text                │
│    }                                                          │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          v
┌──────────────────────────────────────────────────────────────┐
│                 Phase 4: Report Generation                    │
│                                                               │
│  Inputs (Combined):                                           │
│  • performance_data from Phase 2                              │
│  • zones_data from Phase 2                                    │
│  • training_plan_data from Phase 3 (if available)             │
│                                                               │
│  Executes:                                                    │
│  • Generate index.html                                        │
│  • Generate coaching_insights.html                            │
│  • Generate performance_dashboard.html                        │
│                                                               │
│  Outputs:                                                     │
│  • output_files: [Path, Path, Path]                          │
│  • report_data: {files_created, total_size}                   │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          v
┌──────────────────────────────────────────────────────────────┐
│                      Final Results                            │
│                                                               │
│  • 3 HTML files in output directory                           │
│  • WorkflowResult with all phase data                         │
│  • Execution metadata (time, tokens)                          │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 State Management

**WorkflowConfig (Immutable Input State):**
- Set once at workflow start
- Contains all user-provided parameters
- Passed to all phases

**PhaseResult (Phase Output State):**
- Created by each phase
- Contains agent response + extracted data
- Immutable once created

**Accumulated State (Forwarded Between Phases):**
- Each phase receives accumulated data from all previous phases
- Phases add their own extracted data
- State grows as workflow progresses

Example progression:
```python
# After Phase 1
phase1_state = {
    "csv_validated": True,
    "profile_validated": True,
}

# After Phase 2 (includes Phase 1 state)
phase2_state = {
    "csv_validated": True,
    "profile_validated": True,
    "performance_data": {...},
    "zones_data": {...},
}

# After Phase 3 (includes Phase 1 + 2 state)
phase3_state = {
    "csv_validated": True,
    "profile_validated": True,
    "performance_data": {...},
    "zones_data": {...},
    "training_plan_data": {...},
}

# Phase 4 receives phase3_state
```

### 5.3 Caching Strategy

**Phase-Level Caching:**
- Each phase's extracted data is cached in memory
- No disk caching between phases (workflow is ephemeral)
- Session data includes tool results for potential replay

**Tool-Level Caching:**
- Existing tools handle their own caching (e.g., FIT file parsing cache)
- No changes needed to existing tool implementations

**Future Enhancement:**
- Could add workflow result serialization for replay
- Could cache intermediate phase results to disk

---

## 6. CLI Integration

### 6.1 Command Structure

```bash
cycling-ai generate \
    --csv activities.csv \
    --profile athlete.json \
    --fit-dir ./fit_files \
    --output-dir ./reports \
    --period-months 6 \
    --training-plan-weeks 12 \
    --provider anthropic \
    --model claude-3-5-sonnet-20241022
```

### 6.2 Argument Specifications

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--csv` | Path | Yes | - | Path to Strava activities CSV |
| `--profile` | Path | Yes | - | Path to athlete profile JSON |
| `--fit-dir` | Path | No | None | Directory with FIT files |
| `--output-dir` | Path | No | `./reports` | Output directory for reports |
| `--period-months` | int | No | 6 | Months for performance comparison |
| `--training-plan-weeks` | int | No | 12 | Weeks for training plan |
| `--skip-training-plan` | flag | No | False | Skip training plan phase |
| `--provider` | choice | No | anthropic | LLM provider |
| `--model` | str | No | (provider default) | Specific model |
| `--prompts-dir` | Path | No | None | Custom prompts directory |

### 6.3 Progress Reporting

**Live Progress Display:**
```
┌─────────────────────────────────────────┐
│          Multi-Agent Workflow           │
└─────────────────────────────────────────┘

Phase                          Status
─────────────────────────────────────────
Data Preparation               ✓ Completed
Performance Analysis           🔄 In Progress
Training Planning              ⏳ Pending
Report Generation              ⏳ Pending
```

**Progress Updates:**
- Real-time status updates using Rich Live display
- Each phase shows: Pending → In Progress → Completed/Failed/Skipped
- Color coding: Green (success), Yellow (in progress), Red (failed), Gray (pending/skipped)

### 6.4 Output Formatting

**Success Output:**
```
┌────────────────────────────────────────┐
│   ✓ Workflow Completed Successfully    │
└────────────────────────────────────────┘

Execution Summary
─────────────────────────────────────────
Total Time           45.3s
Total Tokens         12,547
Phases Completed     4

Generated Reports:
  ✓ /Users/eduardo/reports/index.html
  ✓ /Users/eduardo/reports/coaching_insights.html
  ✓ /Users/eduardo/reports/performance_dashboard.html

Open the reports in your browser to view the analysis.
```

**Failure Output:**
```
┌────────────────────────────────────────┐
│        ✗ Workflow Failed               │
└────────────────────────────────────────┘

Failed at phase: performance_analysis
Errors:
  • CSV file missing required column 'Average Power'
  • Unable to calculate performance metrics
```

### 6.5 Exit Codes

- `0`: Success - all phases completed
- `1`: Failure - workflow failed at some phase
- `2`: Validation error - invalid configuration
- `130`: User cancelled (Ctrl+C)

---

## 7. Implementation Strategy

### 7.1 Implementation Order

**Phase A: Foundation (Week 1)**
1. Create `AgentPromptsManager` with embedded prompts
2. Create basic `MultiAgentOrchestrator` structure
3. Implement `PhaseResult`, `WorkflowConfig`, `WorkflowResult` dataclasses
4. Add unit tests for dataclasses and prompts manager

**Phase B: Orchestration Logic (Week 1-2)**
5. Implement `_execute_phase()` method
6. Implement `_extract_phase_data()` with MCP pattern
7. Implement phase 1-4 execution methods
8. Add session isolation logic
9. Unit tests for orchestration logic

**Phase C: CLI Command (Week 2)**
10. Create `generate.py` command
11. Implement `PhaseProgressTracker`
12. Add progress display with Rich
13. Implement provider initialization
14. Integration tests for CLI

**Phase D: Integration & Testing (Week 2-3)**
15. End-to-end integration tests
16. Real data validation tests
17. Error handling refinement
18. Documentation

### 7.2 Testing Approach

**Unit Tests:**
```python
# tests/orchestration/test_multi_agent.py
def test_phase_result_creation():
    """Test PhaseResult dataclass."""
    result = PhaseResult(
        phase_name="test",
        status=PhaseStatus.COMPLETED,
        agent_response="Success",
        extracted_data={"key": "value"},
    )
    assert result.success

def test_workflow_config_validation():
    """Test WorkflowConfig validation."""
    config = WorkflowConfig(
        csv_file_path=Path("nonexistent.csv"),
        athlete_profile_path=Path("profile.json"),
    )
    with pytest.raises(ValueError, match="CSV file not found"):
        config.validate()

def test_extract_phase_data():
    """Test MCP result extraction pattern."""
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
```

**Integration Tests:**
```python
# tests/orchestration/test_multi_agent_integration.py
def test_full_workflow_with_mock_provider(tmp_path):
    """Test complete workflow with mocked LLM provider."""
    # Create test data files
    csv_file = tmp_path / "activities.csv"
    csv_file.write_text("Activity Date,Distance,...")

    profile_file = tmp_path / "profile.json"
    profile_file.write_text('{"name": "Test", "ftp": 250}')

    # Create mock provider that returns canned responses
    mock_provider = MockProvider()

    # Configure workflow
    config = WorkflowConfig(
        csv_file_path=csv_file,
        athlete_profile_path=profile_file,
        output_dir=tmp_path / "reports",
    )

    # Execute workflow
    orchestrator = MultiAgentOrchestrator(provider=mock_provider)
    result = orchestrator.execute_workflow(config)

    # Verify results
    assert result.success
    assert len(result.phase_results) == 4
    assert (tmp_path / "reports" / "index.html").exists()
```

**Real Data Tests:**
```python
# tests/integration/test_real_workflow.py
@pytest.mark.integration
@pytest.mark.skipif(not os.getenv("ANTHROPIC_API_KEY"), reason="No API key")
def test_workflow_with_real_data_and_real_llm():
    """Test workflow with real cycling data and real LLM."""
    # Use actual test data
    csv_file = Path("tests/data/real_activities.csv")
    profile_file = Path("tests/data/test_profile.json")

    # Real provider
    provider = AnthropicProvider(ProviderConfig(...))

    # Execute
    result = orchestrator.execute_workflow(config)

    # Validate
    assert result.success
    # Check report quality
```

### 7.3 Migration Path

**Coexistence with Chat Command:**
- No changes needed to existing `chat` command
- Both commands use same tools, providers, sessions
- Shared components remain unchanged

**Gradual Rollout:**
1. Implement and test `generate` command in parallel
2. Beta test with real users
3. Gather feedback and iterate
4. Promote as primary workflow for report generation

### 7.4 Validation Checkpoints

**Checkpoint 1: Foundation Complete**
- [ ] AgentPromptsManager created with 4 embedded prompts
- [ ] Prompts can be loaded from files
- [ ] All dataclasses defined and tested
- [ ] Unit tests pass

**Checkpoint 2: Orchestration Complete**
- [ ] MultiAgentOrchestrator can execute all 4 phases
- [ ] MCP data extraction works correctly
- [ ] Session isolation verified
- [ ] Integration tests pass

**Checkpoint 3: CLI Complete**
- [ ] `cycling-ai generate` command works
- [ ] Progress display functions correctly
- [ ] Error handling is robust
- [ ] Help text is clear

**Checkpoint 4: Production Ready**
- [ ] End-to-end tests with real data pass
- [ ] Documentation complete
- [ ] Performance acceptable (< 5 min for typical dataset)
- [ ] Ready for user testing

---

## 8. Code Structure

### 8.1 File Organization

```
src/cycling_ai/
├── orchestration/
│   ├── __init__.py
│   ├── agent.py              # Existing: LLMAgent, AgentFactory
│   ├── session.py            # Existing: ConversationSession, SessionManager
│   ├── executor.py           # Existing: ToolExecutor
│   ├── multi_agent.py        # NEW: MultiAgentOrchestrator
│   └── prompts.py            # NEW: AgentPromptsManager
│
├── cli/
│   ├── commands/
│   │   ├── __init__.py
│   │   ├── chat.py           # Existing: chat command
│   │   ├── analyze.py        # Existing
│   │   ├── plan.py           # Existing
│   │   ├── report.py         # Existing
│   │   ├── config.py         # Existing
│   │   ├── providers.py      # Existing
│   │   └── generate.py       # NEW: generate command
│   └── main.py               # Modified: register generate command
│
└── [existing structure unchanged]
```

### 8.2 Module Dependencies

```
cycling_ai.cli.commands.generate
  └─> cycling_ai.orchestration.multi_agent
       ├─> cycling_ai.orchestration.prompts
       ├─> cycling_ai.orchestration.agent (existing)
       ├─> cycling_ai.orchestration.session (existing)
       ├─> cycling_ai.providers.base (existing)
       └─> cycling_ai.providers.factory (existing)

cycling_ai.orchestration.multi_agent
  ├─> cycling_ai.orchestration.prompts
  ├─> cycling_ai.orchestration.agent
  ├─> cycling_ai.orchestration.session
  └─> cycling_ai.providers.base

cycling_ai.orchestration.prompts
  └─> (no dependencies - standalone)
```

### 8.3 Configuration Management

**Embedded Prompts Location:**
- All prompts embedded directly in `prompts.py` as module-level constants
- No external files required for default operation
- Zero-configuration setup

**Optional Custom Prompts:**
```
~/.cycling-ai/prompts/
├── data_preparation.txt
├── performance_analysis.txt
├── training_planning.txt
└── report_generation.txt
```

**Usage:**
```bash
# Use embedded defaults
cycling-ai generate --csv ... --profile ...

# Use custom prompts
cycling-ai generate --csv ... --profile ... --prompts-dir ~/.cycling-ai/prompts
```

### 8.4 Where Components Live

| Component | File Path | Purpose |
|-----------|-----------|---------|
| `MultiAgentOrchestrator` | `src/cycling_ai/orchestration/multi_agent.py` | Main workflow coordinator |
| `PhaseResult` | `src/cycling_ai/orchestration/multi_agent.py` | Phase result dataclass |
| `WorkflowConfig` | `src/cycling_ai/orchestration/multi_agent.py` | Workflow configuration |
| `WorkflowResult` | `src/cycling_ai/orchestration/multi_agent.py` | Complete workflow result |
| `PhaseStatus` | `src/cycling_ai/orchestration/multi_agent.py` | Phase status enum |
| `AgentPromptsManager` | `src/cycling_ai/orchestration/prompts.py` | Prompts management |
| `DATA_PREPARATION_PROMPT` | `src/cycling_ai/orchestration/prompts.py` | Embedded prompt |
| `PERFORMANCE_ANALYSIS_PROMPT` | `src/cycling_ai/orchestration/prompts.py` | Embedded prompt |
| `TRAINING_PLANNING_PROMPT` | `src/cycling_ai/orchestration/prompts.py` | Embedded prompt |
| `REPORT_GENERATION_PROMPT` | `src/cycling_ai/orchestration/prompts.py` | Embedded prompt |
| `generate` command | `src/cycling_ai/cli/commands/generate.py` | CLI command |
| `PhaseProgressTracker` | `src/cycling_ai/cli/commands/generate.py` | Progress display |

---

## 9. Risk Analysis

### 9.1 Technical Risks

**RISK-1: LLM Context Window Overflow**
- **Severity:** Medium
- **Probability:** Medium
- **Impact:** Workflow fails mid-execution
- **Mitigation:**
  - Session isolation per phase limits context growth
  - Token estimation and tracking
  - Fail fast if approaching limits
  - Use models with large context (Claude 200k tokens)

**RISK-2: Tool Execution Failures**
- **Severity:** High
- **Probability:** Low
- **Impact:** Phase fails, workflow stops
- **Mitigation:**
  - Comprehensive input validation in tools
  - Clear error messages from tools
  - Fail-fast strategy prevents cascading failures
  - Retry logic for transient errors

**RISK-3: MCP Data Extraction Failures**
- **Severity:** High
- **Probability:** Medium
- **Impact:** Data not passed between phases
- **Mitigation:**
  - Robust JSON parsing with error handling
  - Validate extracted data structure
  - Log extraction attempts for debugging
  - Comprehensive integration tests

**RISK-4: HTML Generation Quality**
- **Severity:** Medium
- **Probability:** Medium
- **Impact:** Poor quality reports
- **Mitigation:**
  - Detailed prompt engineering for report phase
  - Template-based HTML structure
  - Validation of generated HTML
  - Fallback to basic templates

**RISK-5: Token Budget Exhaustion**
- **Severity:** Medium
- **Probability:** Low
- **Impact:** High API costs
- **Mitigation:**
  - Token tracking per phase
  - Budget limits in configuration
  - Warning when approaching limits
  - Use efficient models (Claude Sonnet vs Opus)

### 9.2 Operational Risks

**RISK-6: Long Execution Times**
- **Severity:** Low
- **Probability:** Medium
- **Impact:** Poor user experience
- **Mitigation:**
  - Progress display keeps users informed
  - Optimize tool execution
  - Parallel tool calls where possible
  - Target < 5 min for typical dataset

**RISK-7: File System Permissions**
- **Severity:** Low
- **Probability:** Low
- **Impact:** Cannot write reports
- **Mitigation:**
  - Validate output directory writability early
  - Clear error messages
  - Suggest alternative output locations

**RISK-8: API Rate Limits**
- **Severity:** Medium
- **Probability:** Low
- **Impact:** Workflow fails mid-execution
- **Mitigation:**
  - Exponential backoff retry logic
  - Rate limit awareness
  - Option to use local models (Ollama)

### 9.3 Failure Points and Mitigation

| Failure Point | Detection | Recovery Strategy |
|---------------|-----------|-------------------|
| Invalid input files | Pre-validation in Phase 1 | Fail fast with clear error |
| Tool execution error | Check ToolExecutionResult.success | Return PhaseResult with errors |
| JSON parsing error | try/except in extraction | Log error, return empty dict |
| LLM API error | Provider exception | Retry with backoff, then fail |
| HTML write error | File I/O exception | Check permissions, suggest alternative |
| Session overflow | Token estimation | Warn user, consider truncation |

### 9.4 Performance Considerations

**Token Budget Management:**
```python
# Rough estimates per phase (Claude Sonnet)
Phase 1: Data Preparation      ~  1,000 tokens
Phase 2: Performance Analysis  ~  8,000 tokens
Phase 3: Training Planning     ~  5,000 tokens
Phase 4: Report Generation     ~ 10,000 tokens
─────────────────────────────────────────────
Total Estimated:               ~ 24,000 tokens

Cost (Claude Sonnet 3.5):
Input:  24k tokens × $3/million  = $0.072
Output: 12k tokens × $15/million = $0.180
Total per workflow:              = ~$0.25
```

**Optimization Strategies:**
- Use efficient models (Sonnet vs Opus)
- Limit conversation history per phase
- Extract only necessary data between phases
- Compress verbose tool results

---

## 10. Future Extensibility

### 10.1 Adding New Phases

**Example: Add "Nutrition Analysis" Phase**

1. **Create prompt:**
```python
# In prompts.py
NUTRITION_ANALYSIS_PROMPT = """You are a cycling nutrition specialist...
"""

class AgentPromptsManager:
    def get_nutrition_analysis_prompt(self) -> str:
        return self._custom_prompts.get("nutrition_analysis", NUTRITION_ANALYSIS_PROMPT)
```

2. **Add phase execution method:**
```python
# In multi_agent.py
def _execute_phase_nutrition(self, config: WorkflowConfig, prev_result: PhaseResult) -> PhaseResult:
    return self._execute_phase(
        phase_name="nutrition_analysis",
        config=config,
        prompt_getter=lambda: self.prompts_manager.get_nutrition_analysis_prompt(),
        tools=["analyze_nutrition"],  # New tool
        phase_context=prev_result.extracted_data,
        user_message="Analyze nutrition strategy...",
    )
```

3. **Integrate into workflow:**
```python
# In execute_workflow()
phase_nutrition = self._execute_phase_nutrition(config, phase3_result)
phase_results.append(phase_nutrition)
```

### 10.2 Customizing Agent Prompts

**File-Based Customization:**
```bash
# Create custom prompts directory
mkdir -p ~/.cycling-ai/prompts

# Create custom prompt file
cat > ~/.cycling-ai/prompts/performance_analysis.txt << 'EOF'
You are a cycling coach specializing in criterium racing...
[Custom prompt content]
EOF

# Use custom prompts
cycling-ai generate \
    --csv activities.csv \
    --profile profile.json \
    --prompts-dir ~/.cycling-ai/prompts
```

**Programmatic Customization:**
```python
# In custom script
from cycling_ai.orchestration.prompts import AgentPromptsManager

# Create custom manager
prompts = AgentPromptsManager()
prompts._custom_prompts["performance_analysis"] = """
Custom prompt here...
"""

# Use in orchestrator
orchestrator = MultiAgentOrchestrator(
    provider=provider,
    prompts_manager=prompts,
)
```

### 10.3 Plugin Architecture Considerations

**Future Enhancement: Phase Plugins**
```python
class PhasePlugin(ABC):
    """Abstract base for phase plugins."""

    @property
    @abstractmethod
    def phase_name(self) -> str:
        pass

    @property
    @abstractmethod
    def system_prompt(self) -> str:
        pass

    @property
    @abstractmethod
    def tools(self) -> list[str]:
        pass

    @abstractmethod
    def create_user_message(self, config: WorkflowConfig, context: dict[str, Any]) -> str:
        pass

# Usage
orchestrator.register_phase(CustomPhasePlugin())
```

### 10.4 API Design for Programmatic Use

**Python API:**
```python
from cycling_ai.orchestration.multi_agent import MultiAgentOrchestrator, WorkflowConfig
from cycling_ai.providers.factory import ProviderFactory

# Initialize
provider = ProviderFactory.create_provider(config)
orchestrator = MultiAgentOrchestrator(provider=provider)

# Configure
workflow_config = WorkflowConfig(
    csv_file_path=Path("activities.csv"),
    athlete_profile_path=Path("profile.json"),
    output_dir=Path("./reports"),
)

# Execute
result = orchestrator.execute_workflow(workflow_config)

# Access results
if result.success:
    for phase_result in result.phase_results:
        print(f"{phase_result.phase_name}: {phase_result.status}")

    for file in result.output_files:
        print(f"Generated: {file}")
```

**Async Support (Future):**
```python
async def generate_report_async():
    orchestrator = AsyncMultiAgentOrchestrator(provider=provider)
    result = await orchestrator.execute_workflow(config)
    return result
```

### 10.5 Report Format Extensibility

**Current: HTML Only**
- Phase 4 generates 3 HTML files

**Future: Pluggable Report Formats**
```python
class ReportGenerator(ABC):
    @abstractmethod
    def generate(
        self,
        performance_data: dict,
        zones_data: dict,
        training_plan_data: dict | None,
        output_dir: Path,
    ) -> list[Path]:
        pass

class HTMLReportGenerator(ReportGenerator):
    def generate(self, ...):
        # Current implementation
        pass

class PDFReportGenerator(ReportGenerator):
    def generate(self, ...):
        # Generate PDF reports
        pass

class MarkdownReportGenerator(ReportGenerator):
    def generate(self, ...):
        # Generate Markdown reports
        pass

# Usage
orchestrator.set_report_generator(PDFReportGenerator())
```

---

## Appendices

### Appendix A: Complete File Paths Reference

```
/Users/eduardo/Documents/projects/cycling-ai-analysis/
├── src/cycling_ai/
│   ├── orchestration/
│   │   ├── multi_agent.py         # NEW: 500 lines
│   │   └── prompts.py             # NEW: 200 lines
│   └── cli/
│       ├── commands/
│       │   └── generate.py        # NEW: 400 lines
│       └── main.py                # MODIFIED: +2 lines
│
└── tests/
    ├── orchestration/
    │   ├── test_multi_agent.py     # NEW: 300 lines
    │   └── test_prompts.py         # NEW: 100 lines
    └── cli/
        └── test_generate.py        # NEW: 200 lines
```

### Appendix B: Data Structure Examples

**WorkflowConfig:**
```python
WorkflowConfig(
    csv_file_path=Path("/Users/eduardo/data/activities.csv"),
    athlete_profile_path=Path("/Users/eduardo/data/profile.json"),
    fit_dir_path=Path("/Users/eduardo/data/fit_files"),
    output_dir=Path("/Users/eduardo/reports"),
    period_months=6,
    generate_training_plan=True,
    training_plan_weeks=12,
    provider=<AnthropicProvider>,
    max_iterations_per_phase=5,
    prompts_dir=None,
)
```

**PhaseResult:**
```python
PhaseResult(
    phase_name="performance_analysis",
    status=PhaseStatus.COMPLETED,
    agent_response="Based on the analysis of your last 6 months...",
    extracted_data={
        "performance_data": {
            "athlete_profile": {"name": "Eduardo", "ftp": 250},
            "recent_period": {"total_rides": 55, "avg_power": 171},
            "previous_period": {"total_rides": 48, "avg_power": 170},
            "trends": {"avg_power_change_pct": 0.6},
        },
        "zones_data": {
            "zones": {"Z1": {"time_hours": 120.5, "percentage": 65.2}},
            "total_time_hours": 184.8,
            "polarization_score": 0.82,
        },
    },
    errors=[],
    execution_time_seconds=23.4,
    tokens_used=7842,
)
```

**WorkflowResult:**
```python
WorkflowResult(
    phase_results=[<PhaseResult>, <PhaseResult>, <PhaseResult>, <PhaseResult>],
    total_execution_time_seconds=67.8,
    total_tokens_used=23456,
    output_files=[
        Path("/Users/eduardo/reports/index.html"),
        Path("/Users/eduardo/reports/coaching_insights.html"),
        Path("/Users/eduardo/reports/performance_dashboard.html"),
    ],
)
```

### Appendix C: Testing Checklist

**Unit Tests:**
- [ ] PhaseResult creation and serialization
- [ ] WorkflowConfig validation
- [ ] WorkflowResult aggregation
- [ ] AgentPromptsManager default prompts
- [ ] AgentPromptsManager file loading
- [ ] MultiAgentOrchestrator._extract_phase_data()
- [ ] MultiAgentOrchestrator._estimate_tokens()

**Integration Tests:**
- [ ] Full workflow with mocked provider
- [ ] Phase 1 execution with real files
- [ ] Phase 2 tool execution
- [ ] Phase 3 tool execution
- [ ] Phase 4 HTML generation
- [ ] Custom prompts loading
- [ ] Progress callback invocation

**End-to-End Tests:**
- [ ] Complete workflow with real data + real LLM
- [ ] CLI command with all options
- [ ] Error handling scenarios
- [ ] File permission issues
- [ ] Invalid input data

**Performance Tests:**
- [ ] Workflow completes in < 5 minutes
- [ ] Token usage within budget
- [ ] Memory usage acceptable
- [ ] No memory leaks in long sessions

---

## Summary

This architecture plan provides a comprehensive, implementation-ready specification for the multi-agent workflow orchestrator. Key highlights:

1. **Clean Architecture**: Separate concerns (orchestration, prompts, CLI)
2. **MCP Integration**: Proper pattern for extracting tool results
3. **Session Isolation**: Each phase gets fresh session
4. **Embedded Prompts**: Zero-config with customization option
5. **Fail Fast**: Stop on phase failure, clear error messages
6. **Tool Reuse**: No changes to existing tools
7. **Extensible**: Easy to add phases, customize prompts, change formats

**Total Implementation Estimate:** 2-3 weeks

**Files to Create:**
- `src/cycling_ai/orchestration/multi_agent.py` (~500 lines)
- `src/cycling_ai/orchestration/prompts.py` (~200 lines)
- `src/cycling_ai/cli/commands/generate.py` (~400 lines)
- Tests (~600 lines total)

**Files to Modify:**
- `src/cycling_ai/cli/main.py` (+2 lines)
- `src/cycling_ai/cli/commands/__init__.py` (+1 line)

The implementation can proceed step-by-step following the phases outlined in Section 7, with clear validation checkpoints at each stage.
