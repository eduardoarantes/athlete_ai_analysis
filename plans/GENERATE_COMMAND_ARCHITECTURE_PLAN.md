# Architecture Plan: Generate Command Implementation

## Executive Summary

This architecture plan details the implementation of a new `generate` CLI command that orchestrates multiple specialized agents to produce comprehensive HTML performance reports in a single command execution. The command will bridge the existing conversational CLI with the multi-agent workflow from the athlete_performance_analysis project.

## Table of Contents

1. [System Context](#system-context)
2. [Architecture Overview](#architecture-overview)
3. [Component Design](#component-design)
4. [Data Flow](#data-flow)
5. [Implementation Strategy](#implementation-strategy)
6. [Technical Decisions](#technical-decisions)
7. [Integration Points](#integration-points)
8. [Testing Strategy](#testing-strategy)
9. [Risk Analysis](#risk-analysis)

---

## 1. System Context

### Current State

**Existing System Architecture:**
```
cycling-ai-analysis/
├── Core Business Logic (8 modules)
│   └── Performance, zones, training, fit processing, etc.
├── Tool Wrappers (5 tools)
│   └── Wrap core logic for LLM consumption
├── Provider Abstraction (4 providers)
│   └── OpenAI, Anthropic, Gemini, Ollama
├── Orchestration Layer
│   ├── LLMAgent: Single-agent with tool calling
│   ├── Session: Conversation management
│   └── ToolExecutor: Tool execution engine
└── CLI Interface
    ├── chat: Interactive conversation (multi-turn)
    └── analyze/plan/report: Direct tool access
```

**Current Capabilities:**
- ✅ Interactive chat with single LLM agent
- ✅ Direct command-line tool access
- ✅ Tool auto-discovery and execution
- ✅ Multi-turn conversations with context
- ✅ Session persistence

**Gap:**
- ❌ No multi-agent orchestration
- ❌ No workflow-based agent specialization
- ❌ No single-command report generation

### Target State

**athlete_performance_analysis Architecture:**
```
MCP Server Integration (5 specialized agents via Claude Desktop)
├── cycling-data-prep agent
│   └── Organizes FIT files, creates cache
├── cycling-analysis agent
│   └── Performance analysis, zone distribution
├── cycling-planning agent
│   └── Training plan generation
├── cycling-reporting agent
│   └── HTML report creation
└── cycling-coach agent
    └── Orchestrates all agents
```

**Target Workflow:**
```bash
cycling-ai generate \
  --profile /path/to/athlete_profile.json \
  --output ./reports

# Single command orchestrates:
# 1. Data prep → Cache creation
# 2. Analysis → Performance + zones
# 3. Planning → Training plan (optional)
# 4. Reporting → HTML suite
```

---

## 2. Architecture Overview

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI: generate command                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              MultiAgentOrchestrator                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Phase 1: Data Preparation                            │  │
│  │   Agent: DataPrepAgent (specialized system prompt)   │  │
│  │   Tools: prepare_cache, organize_fit_files          │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                    │
│                         ▼ (pass cache path)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Phase 2: Performance Analysis                        │  │
│  │   Agent: AnalysisAgent (specialized system prompt)   │  │
│  │   Tools: analyze_performance, analyze_zones         │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                    │
│                         ▼ (pass analysis results)           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Phase 3: Training Planning                           │  │
│  │   Agent: PlanningAgent (specialized system prompt)   │  │
│  │   Tools: generate_training_plan                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                    │
│                         ▼ (aggregate all results)           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Phase 4: Report Generation                           │  │
│  │   Agent: ReportingAgent (specialized system prompt)  │  │
│  │   Tools: generate_html_reports                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
            HTML Report Suite (3 files)
```

### Key Architectural Principles

1. **Agent Specialization**: Each phase uses a dedicated agent with specialized prompts
2. **Tool Reuse**: Leverage existing tool wrappers without modification
3. **Linear Workflow**: Sequential phases with clear data handoffs
4. **MCP Pattern Compliance**: Extract `result` field from tool outputs
5. **Non-Interactive**: Automated execution without user input

---

## 3. Component Design

### 3.1 MultiAgentOrchestrator

**Purpose**: Coordinate workflow across specialized agents

**Location**: `src/cycling_ai/orchestration/multi_agent.py`

**Class Structure**:
```python
class WorkflowPhase(Enum):
    """Workflow phase identifiers."""
    DATA_PREP = "data_prep"
    ANALYSIS = "analysis"
    PLANNING = "planning"
    REPORTING = "reporting"

@dataclass
class PhaseResult:
    """Result from a workflow phase."""
    phase: WorkflowPhase
    success: bool
    data: dict[str, Any]
    errors: list[str]
    agent_response: str

class MultiAgentOrchestrator:
    """
    Orchestrates multi-agent workflow for report generation.

    Each phase uses a specialized agent with appropriate:
    - System prompt (from agent definitions)
    - Tool subset (filtered from registry)
    - Context (from previous phases)
    """

    def __init__(
        self,
        provider: BaseProvider,
        prompts_manager: AgentPromptsManager,
        max_iterations_per_phase: int = 5,
    ):
        self.provider = provider
        self.prompts = prompts_manager
        self.max_iterations = max_iterations_per_phase

    async def execute_workflow(
        self,
        athlete_profile_path: str,
        output_dir: str,
        include_training_plan: bool = True,
    ) -> dict[str, PhaseResult]:
        """
        Execute complete report generation workflow.

        Returns:
            Dictionary mapping phase name to result
        """
        results = {}

        # Phase 1: Data Preparation
        results["data_prep"] = await self._run_phase(
            phase=WorkflowPhase.DATA_PREP,
            system_prompt=self.prompts.get_data_prep_prompt(),
            tools=["prepare_cache", "organize_fit_files", "get_date_span"],
            context={"athlete_profile": athlete_profile_path},
        )

        # Phase 2: Analysis
        results["analysis"] = await self._run_phase(
            phase=WorkflowPhase.ANALYSIS,
            system_prompt=self.prompts.get_analysis_prompt(),
            tools=["analyze_performance", "analyze_zones"],
            context={
                "athlete_profile": athlete_profile_path,
                "cache_path": results["data_prep"].data.get("cache_path"),
            },
        )

        # Phase 3: Planning (optional)
        if include_training_plan:
            results["planning"] = await self._run_phase(
                phase=WorkflowPhase.PLANNING,
                system_prompt=self.prompts.get_planning_prompt(),
                tools=["generate_training_plan"],
                context={"athlete_profile": athlete_profile_path},
            )

        # Phase 4: Reporting
        results["reporting"] = await self._run_phase(
            phase=WorkflowPhase.REPORTING,
            system_prompt=self.prompts.get_reporting_prompt(),
            tools=["generate_html_reports"],
            context={
                "athlete_profile": athlete_profile_path,
                "analysis_data": results["analysis"].data.get("performance"),
                "zones_data": results["analysis"].data.get("zones"),
                "training_plan": results.get("planning", {}).data.get("plan"),
                "output_dir": output_dir,
            },
        )

        return results

    async def _run_phase(
        self,
        phase: WorkflowPhase,
        system_prompt: str,
        tools: list[str],
        context: dict[str, Any],
    ) -> PhaseResult:
        """
        Execute a single workflow phase.

        Creates specialized agent for phase and runs to completion.
        """
        # Create phase-specific session
        session = ConversationSession(
            session_id=f"workflow_{phase.value}",
            provider_name=self.provider.config.provider_name,
        )

        # Add system prompt
        session.add_message(
            ConversationMessage(role="system", content=system_prompt)
        )

        # Create executor with filtered tools
        executor = ToolExecutor()
        executor.registry = self._filter_registry(tools)

        # Create agent
        agent = LLMAgent(
            provider=self.provider,
            executor=executor,
            session=session,
            max_iterations=self.max_iterations,
        )

        # Generate task message from context
        task_message = self._generate_task_message(phase, context)

        try:
            response = agent.process_message(task_message)

            # Extract structured data from response
            data = self._extract_phase_data(phase, agent.get_conversation_history())

            return PhaseResult(
                phase=phase,
                success=True,
                data=data,
                errors=[],
                agent_response=response,
            )

        except Exception as e:
            return PhaseResult(
                phase=phase,
                success=False,
                data={},
                errors=[str(e)],
                agent_response="",
            )
```

**Key Methods**:
- `execute_workflow()`: Main entry point for full workflow
- `_run_phase()`: Execute single phase with specialized agent
- `_filter_registry()`: Create tool registry subset for phase
- `_generate_task_message()`: Create phase-specific instructions
- `_extract_phase_data()`: Parse tool results from conversation history

### 3.2 AgentPromptsManager

**Purpose**: Manage specialized system prompts for each agent

**Location**: `src/cycling_ai/orchestration/prompts.py`

**Class Structure**:
```python
class AgentPromptsManager:
    """
    Manages specialized system prompts for multi-agent workflows.

    Loads and provides prompts based on agent definitions from
    athlete_performance_analysis project.
    """

    def __init__(self, agent_definitions_dir: str | None = None):
        """
        Initialize prompts manager.

        Args:
            agent_definitions_dir: Optional path to .claude/agents/ directory.
                                  If None, uses embedded prompts.
        """
        self.definitions_dir = agent_definitions_dir
        self._prompts: dict[str, str] = {}
        self._load_prompts()

    def _load_prompts(self) -> None:
        """Load prompts from agent definitions or use defaults."""
        if self.definitions_dir:
            # Load from markdown files
            self._load_from_files()
        else:
            # Use embedded prompts
            self._load_embedded()

    def _load_from_files(self) -> None:
        """Load prompts from agent definition markdown files."""
        # Parse cycling-data-prep-agent.md
        # Parse cycling-analysis-agent.md
        # Parse cycling-planning-agent.md
        # Parse cycling-reporting-agent.md
        # Extract system prompt sections
        pass

    def _load_embedded(self) -> None:
        """Load embedded default prompts."""
        self._prompts["data_prep"] = self._get_data_prep_prompt()
        self._prompts["analysis"] = self._get_analysis_prompt()
        self._prompts["planning"] = self._get_planning_prompt()
        self._prompts["reporting"] = self._get_reporting_prompt()

    def get_data_prep_prompt(self) -> str:
        """Get data preparation specialist prompt."""
        return self._prompts["data_prep"]

    def get_analysis_prompt(self) -> str:
        """Get performance analysis specialist prompt."""
        return self._prompts["analysis"]

    def get_planning_prompt(self) -> str:
        """Get training planning specialist prompt."""
        return self._prompts["planning"]

    def get_reporting_prompt(self) -> str:
        """Get report generation specialist prompt."""
        return self._prompts["reporting"]

    @staticmethod
    def _get_data_prep_prompt() -> str:
        """Embedded data prep prompt."""
        return """You are a data preparation specialist for cycling analysis.

Your role: Prepare and optimize cycling data for analysis by:
1. Creating optimized Parquet cache from CSV data
2. Organizing FIT files by activity type and date
3. Validating data quality
4. Providing clear summary of data readiness

Available tools:
- prepare_cache: Create Parquet cache for 10x faster analysis
- organize_fit_files: Organize .fit/.fit.gz by activity/month
- get_date_span: Check data coverage

Workflow:
1. Call prepare_cache with CSV path
2. Call organize_fit_files if needed
3. Call get_date_span to verify coverage
4. Summarize what was prepared

Be concise. Focus on cache creation and validation."""

    @staticmethod
    def _get_analysis_prompt() -> str:
        """Embedded analysis prompt."""
        return """You are an elite cycling performance analyst.

Your role: Deliver comprehensive performance analysis including:
- Period comparison (recent vs previous)
- Time-in-zones from FIT files (second-by-second, not averages)
- Performance trends and insights

Available tools:
- analyze_performance: Period comparison analysis
- analyze_zones: Second-by-second zone analysis from FIT files

Critical: You MUST use analyze_zones for zone distribution.
Never use ride averages. Only actual second-by-second data shows
true time spent in each zone.

Power Zones (% FTP):
- Z1: 0-60% (Active Recovery)
- Z2: 60-80% (Endurance)
- Z3: 80-90% (Tempo)
- Z4: 90-110% (Threshold)
- Z5: >110% (VO2 Max)

Workflow:
1. Call analyze_performance with athlete_profile_json
2. Call analyze_zones with athlete_profile_json
3. Synthesize findings
4. Provide actionable insights

Be data-driven. Cite specific metrics."""

    @staticmethod
    def _get_planning_prompt() -> str:
        """Embedded planning prompt."""
        return """You are a professional training plan architect.

Your role: Create periodized training plans based on:
- Current fitness (FTP)
- Training goals
- Available days per week
- Age-appropriate recovery

Available tools:
- generate_training_plan: Create periodized week-by-week plan

The tool accepts athlete_profile_json which contains:
- Current FTP
- Training availability (days/week, specific days)
- Goals
- Age

Workflow:
1. Call generate_training_plan with athlete_profile_json
2. Review plan structure
3. Highlight key workouts

Be concise. Focus on plan structure and periodization."""

    @staticmethod
    def _get_reporting_prompt() -> str:
        """Embedded reporting prompt."""
        return """You are a professional performance report generator.

Your role: Create comprehensive HTML reports combining:
- Performance analysis
- Time-in-zones
- Training plan (if provided)
- Visual dashboards

Available tools:
- generate_html_reports: Create HTML report suite

CRITICAL MCP Integration Rule:
All tool results have format {"result": "data"}
You MUST extract the "result" field before passing to generate_html_reports.

Example:
analysis_output = analyze_performance(...)
zones_output = analyze_zones(...)

# ✅ CORRECT
generate_html_reports(
    analysis_data=analysis_output["result"],  # Extract string!
    zones_data=zones_output["result"],        # Extract string!
    ...
)

# ❌ WRONG
generate_html_reports(
    analysis_data=analysis_output,  # Passing dict!
    ...
)

Workflow:
1. Receive analysis_data, zones_data, training_plan from context
2. Call generate_html_reports with athlete_profile_json
3. Report file locations

Be concise. Confirm report creation."""
```

### 3.3 Generate CLI Command

**Purpose**: User-facing command interface

**Location**: `src/cycling_ai/cli/commands/generate.py`

**Implementation**:
```python
"""
Generate command for single-command report generation.

Orchestrates multi-agent workflow to produce comprehensive HTML reports.
"""
from __future__ import annotations

from pathlib import Path

import click
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn

from cycling_ai.cli.formatting import console
from cycling_ai.config.loader import load_config
from cycling_ai.orchestration.multi_agent import MultiAgentOrchestrator
from cycling_ai.orchestration.prompts import AgentPromptsManager
from cycling_ai.providers.base import ProviderConfig
from cycling_ai.providers.factory import ProviderFactory


@click.command()
@click.option(
    "--profile",
    type=click.Path(exists=True, path_type=Path),
    required=True,
    help="Path to athlete profile JSON",
)
@click.option(
    "--output",
    type=click.Path(path_type=Path),
    default="./reports",
    help="Output directory for reports",
)
@click.option(
    "--provider",
    type=click.Choice(["openai", "anthropic", "gemini", "ollama"]),
    default="anthropic",
    help="LLM provider for agent orchestration",
)
@click.option(
    "--model",
    help="Specific model to use",
)
@click.option(
    "--skip-training-plan",
    is_flag=True,
    help="Skip training plan generation",
)
@click.option(
    "--agent-definitions",
    type=click.Path(exists=True, path_type=Path),
    help="Path to .claude/agents/ directory with custom prompts",
)
def generate(
    profile: Path,
    output: Path,
    provider: str,
    model: str | None,
    skip_training_plan: bool,
    agent_definitions: Path | None,
) -> None:
    """
    Generate comprehensive HTML performance report.

    Single command that orchestrates specialized agents to:
    1. Prepare data cache
    2. Analyze performance and zones
    3. Generate training plan (optional)
    4. Create HTML report suite

    \b
    Examples:
        # Basic usage
        cycling-ai generate --profile athlete.json

        # Custom output location
        cycling-ai generate --profile athlete.json --output ./my-reports

        # Skip training plan
        cycling-ai generate --profile athlete.json --skip-training-plan

        # Use custom agent prompts
        cycling-ai generate --profile athlete.json \\
            --agent-definitions /path/to/.claude/agents
    """
    try:
        # Load configuration
        config = load_config()

        # Display header
        _display_header(profile, output)

        # Initialize provider
        provider_instance = _initialize_provider(
            provider_name=provider,
            model=model,
            config=config,
        )

        # Initialize prompts manager
        prompts = AgentPromptsManager(
            agent_definitions_dir=str(agent_definitions) if agent_definitions else None
        )

        # Create orchestrator
        orchestrator = MultiAgentOrchestrator(
            provider=provider_instance,
            prompts_manager=prompts,
        )

        # Execute workflow with progress
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:

            task = progress.add_task("Executing workflow...", total=None)

            results = orchestrator.execute_workflow(
                athlete_profile_path=str(profile.absolute()),
                output_dir=str(output.absolute()),
                include_training_plan=not skip_training_plan,
            )

            progress.update(task, completed=True)

        # Display results
        _display_results(results, output)

    except Exception as e:
        console.print(f"[red]Error: {str(e)}[/red]")
        raise click.Abort() from e


def _display_header(profile: Path, output: Path) -> None:
    """Display command header."""
    header = Panel.fit(
        f"""[bold cyan]Generate Performance Report[/bold cyan]

[white]Profile:[/white] [green]{profile}[/green]
[white]Output:[/white] [green]{output}[/green]

[yellow]Orchestrating specialized agents...[/yellow]
""",
        border_style="cyan",
    )
    console.print(header)
    console.print()


def _display_results(
    results: dict[str, Any],
    output: Path,
) -> None:
    """Display workflow results."""
    # Check for failures
    failures = [
        phase for phase, result in results.items()
        if not result.success
    ]

    if failures:
        console.print(f"[red]✗ Workflow failed at: {', '.join(failures)}[/red]")
        for phase in failures:
            for error in results[phase].errors:
                console.print(f"  [dim]{error}[/dim]")
        return

    # Success summary
    console.print("[bold green]✓ Report generation complete![/bold green]\n")

    console.print("[cyan]Generated reports:[/cyan]")
    console.print(f"  • {output}/index.html")
    console.print(f"  • {output}/coaching_report.html")
    console.print(f"  • {output}/performance_dashboard.html")

    console.print(f"\n[yellow]Open {output}/index.html to view[/yellow]")


def _initialize_provider(
    provider_name: str,
    model: str | None,
    config: Any,
) -> BaseProvider:
    """Initialize LLM provider."""
    # Similar to chat command provider initialization
    # ... (implementation details)
```

---

## 4. Data Flow

### 4.1 Workflow Sequence Diagram

```
User
  │
  ├─> cycling-ai generate --profile athlete.json
  │
  ▼
CLI (generate.py)
  │
  ├─> Initialize MultiAgentOrchestrator
  │   ├─> Load AgentPromptsManager
  │   └─> Initialize Provider
  │
  ├─> orchestrator.execute_workflow()
  │
  ▼
┌─────────────────────────────────────┐
│ PHASE 1: Data Preparation           │
├─────────────────────────────────────┤
│ Agent: DataPrepAgent                │
│ Prompt: data_prep system prompt     │
│ Tools: prepare_cache,               │
│        organize_fit_files,          │
│        get_date_span                │
├─────────────────────────────────────┤
│ Input:                              │
│   athlete_profile.json path         │
│                                     │
│ Actions:                            │
│   1. prepare_cache()                │
│      → /path/to/cache/activities_   │
│        processed.parquet            │
│   2. organize_fit_files()           │
│      → /path/to/organized_          │
│        activities/Ride/2024-10/     │
│   3. get_date_span()                │
│      → "2024-01-01 to 2025-10-27"   │
│                                     │
│ Output:                             │
│   PhaseResult {                     │
│     success: true,                  │
│     data: {                         │
│       cache_path: "/path/...",      │
│       fit_dir: "/path/...",         │
│       date_span: "...",             │
│       activity_count: 603           │
│     }                               │
│   }                                 │
└─────────────────────────────────────┘
  │
  ▼ (pass cache_path, fit_dir)
┌─────────────────────────────────────┐
│ PHASE 2: Analysis                   │
├─────────────────────────────────────┤
│ Agent: AnalysisAgent                │
│ Prompt: analysis system prompt      │
│ Tools: analyze_performance,         │
│        analyze_zones                │
├─────────────────────────────────────┤
│ Input:                              │
│   athlete_profile.json              │
│   cache_path from Phase 1           │
│   fit_dir from Phase 1              │
│                                     │
│ Actions:                            │
│   1. analyze_performance()          │
│      → {"result": "{...JSON...}"}   │
│   2. analyze_zones()                │
│      → {"result": "{...JSON...}"}   │
│                                     │
│ Output:                             │
│   PhaseResult {                     │
│     success: true,                  │
│     data: {                         │
│       performance: "{...}",  # JSON │
│       zones: "{...}"         # JSON │
│     }                               │
│   }                                 │
└─────────────────────────────────────┘
  │
  ▼ (pass athlete_profile)
┌─────────────────────────────────────┐
│ PHASE 3: Planning                   │
├─────────────────────────────────────┤
│ Agent: PlanningAgent                │
│ Prompt: planning system prompt      │
│ Tools: generate_training_plan       │
├─────────────────────────────────────┤
│ Input:                              │
│   athlete_profile.json              │
│                                     │
│ Actions:                            │
│   1. generate_training_plan()       │
│      → {"result": "{...JSON...}"}   │
│                                     │
│ Output:                             │
│   PhaseResult {                     │
│     success: true,                  │
│     data: {                         │
│       plan: "{...}"  # JSON string  │
│     }                               │
│   }                                 │
└─────────────────────────────────────┘
  │
  ▼ (aggregate all results)
┌─────────────────────────────────────┐
│ PHASE 4: Reporting                  │
├─────────────────────────────────────┤
│ Agent: ReportingAgent               │
│ Prompt: reporting system prompt     │
│ Tools: generate_html_reports        │
├─────────────────────────────────────┤
│ Input:                              │
│   athlete_profile.json              │
│   performance JSON from Phase 2     │
│   zones JSON from Phase 2           │
│   plan JSON from Phase 3            │
│   output_dir                        │
│                                     │
│ CRITICAL MCP Pattern:               │
│   Pass analysis["result"] NOT       │
│   analysis dict!                    │
│                                     │
│ Actions:                            │
│   1. generate_html_reports(         │
│        analysis_data=perf["result"],│
│        zones_data=zones["result"],  │
│        training_plan=plan["result"],│
│        athlete_profile_json=path,   │
│        output_directory=output_dir  │
│      )                              │
│      → Creates 3 HTML files         │
│                                     │
│ Output:                             │
│   PhaseResult {                     │
│     success: true,                  │
│     data: {                         │
│       reports: [                    │
│         "index.html",               │
│         "coaching_report.html",     │
│         "performance_dashboard.html"│
│       ]                             │
│     }                               │
│   }                                 │
└─────────────────────────────────────┘
  │
  ▼
User receives:
  ./reports/Athlete_Name/
    ├── index.html
    ├── coaching_report.html
    └── performance_dashboard.html
```

### 4.2 MCP Integration Pattern (CRITICAL)

**Problem**: All MCP tools return `{"result": "data"}` structure

**Solution**: Extract `result` field before passing between agents

```python
# Phase 2: Analysis
analysis_output = agent.process_message("Analyze performance")
# analysis_output from tool: {"result": "{...JSON...}"}

# Extract tool results from conversation history
conversation = agent.get_conversation_history()
tool_messages = [msg for msg in conversation if msg.role == "tool"]

performance_result = None
zones_result = None

for msg in tool_messages:
    # msg.content is the stringified result
    if "analyze_performance" in msg.tool_results[0]["tool_name"]:
        # Already extracted in tool result message formatting
        performance_result = msg.content
    elif "analyze_zones" in msg.tool_results[0]["tool_name"]:
        zones_result = msg.content

# Phase 4: Reporting
# Pass extracted strings, NOT dicts
reporting_agent.process_message(
    f"""Generate HTML reports with:
    - analysis_data: {performance_result}
    - zones_data: {zones_result}
    - training_plan: {plan_result}
    - athlete_profile_json: {profile_path}
    - output_directory: {output_dir}
    """
)
```

**Key Points**:
1. Tool results are already extracted in `agent.py:_format_tool_result_message()`
2. The `content` field of tool messages contains the extracted result string
3. Pass these strings (not dicts) to next phase
4. Reporting agent receives pre-extracted data

---

## 5. Implementation Strategy

### 5.1 Development Phases

**Phase A: Core Orchestrator (Days 1-2)**
1. Create `MultiAgentOrchestrator` class
   - Implement workflow execution
   - Implement phase execution
   - Implement tool registry filtering
   - Add result extraction logic

2. Test orchestrator in isolation
   - Mock agents
   - Verify phase sequencing
   - Validate data passing

**Phase B: Prompts Manager (Day 3)**
1. Create `AgentPromptsManager` class
   - Implement embedded prompts
   - Add file loading capability (optional)
   - Test prompt retrieval

2. Extract prompts from agent definitions
   - Parse markdown files
   - Extract system prompt sections
   - Validate prompt completeness

**Phase C: CLI Command (Day 4)**
1. Create `generate.py` command
   - Implement CLI interface
   - Add provider initialization
   - Add progress display
   - Add result formatting

2. Integrate with main CLI
   - Register command
   - Update `__init__.py`
   - Add to CLI help

**Phase D: Integration Testing (Day 5)**
1. End-to-end workflow test
   - Real athlete profile
   - Real data files
   - Verify HTML generation

2. Error handling tests
   - Missing files
   - Tool failures
   - Agent errors

**Phase E: Documentation (Day 6)**
1. Update README
   - Add generate command examples
   - Document workflow
   - Add architecture diagram

2. Create user guide
   - Setup instructions
   - Usage examples
   - Troubleshooting

### 5.2 File Creation Order

```
1. src/cycling_ai/orchestration/prompts.py
   └── AgentPromptsManager + embedded prompts

2. src/cycling_ai/orchestration/multi_agent.py
   └── MultiAgentOrchestrator + workflow logic

3. tests/orchestration/test_prompts.py
   └── Unit tests for prompts manager

4. tests/orchestration/test_multi_agent.py
   └── Unit tests for orchestrator (with mocks)

5. src/cycling_ai/cli/commands/generate.py
   └── CLI command implementation

6. tests/cli/test_generate.py
   └── CLI tests

7. tests/integration/test_generate_workflow.py
   └── End-to-end integration test

8. Update src/cycling_ai/cli/commands/__init__.py
   └── Export generate command

9. Update src/cycling_ai/cli/main.py
   └── Register generate command

10. Update README.md
    └── Documentation
```

### 5.3 Testing Strategy

**Unit Tests** (90%+ coverage target):
```python
# tests/orchestration/test_prompts.py
def test_embedded_prompts_loaded():
    """Test all embedded prompts are available."""
    prompts = AgentPromptsManager()
    assert prompts.get_data_prep_prompt()
    assert prompts.get_analysis_prompt()
    assert prompts.get_planning_prompt()
    assert prompts.get_reporting_prompt()

def test_prompts_contain_key_sections():
    """Test prompts have required sections."""
    prompts = AgentPromptsManager()
    prep = prompts.get_data_prep_prompt()
    assert "prepare_cache" in prep
    assert "organize_fit_files" in prep

# tests/orchestration/test_multi_agent.py
@pytest.mark.asyncio
async def test_workflow_phases_execute_in_order():
    """Test phases execute sequentially."""
    mock_provider = MockProvider()
    prompts = AgentPromptsManager()
    orchestrator = MultiAgentOrchestrator(mock_provider, prompts)

    results = await orchestrator.execute_workflow(
        athlete_profile_path="/path/to/profile.json",
        output_dir="/path/to/output",
    )

    assert "data_prep" in results
    assert "analysis" in results
    assert "planning" in results
    assert "reporting" in results

@pytest.mark.asyncio
async def test_data_flows_between_phases():
    """Test phase results are passed correctly."""
    # Mock orchestrator to track data flow
    # Verify cache_path from Phase 1 reaches Phase 2
    # Verify analysis data from Phase 2 reaches Phase 4
```

**Integration Tests**:
```python
# tests/integration/test_generate_workflow.py
@pytest.mark.integration
@pytest.mark.asyncio
async def test_full_workflow_with_real_data():
    """Test complete workflow with real athlete data."""
    profile_path = "tests/fixtures/athlete_profile.json"
    output_dir = "tests/output/reports"

    # Initialize real provider (requires API key)
    provider = ProviderFactory.create_provider(
        ProviderConfig(
            provider_name="anthropic",
            api_key=os.getenv("ANTHROPIC_API_KEY"),
            model="claude-3-5-sonnet-20241022",
        )
    )

    prompts = AgentPromptsManager()
    orchestrator = MultiAgentOrchestrator(provider, prompts)

    results = await orchestrator.execute_workflow(
        athlete_profile_path=profile_path,
        output_dir=output_dir,
    )

    # Verify all phases succeeded
    assert all(r.success for r in results.values())

    # Verify HTML files created
    assert Path(output_dir, "index.html").exists()
    assert Path(output_dir, "coaching_report.html").exists()
    assert Path(output_dir, "performance_dashboard.html").exists()
```

**CLI Tests**:
```python
# tests/cli/test_generate.py
def test_generate_command_basic(cli_runner):
    """Test basic generate command."""
    result = cli_runner.invoke(
        cli,
        [
            "generate",
            "--profile", "tests/fixtures/profile.json",
            "--output", "tests/output",
        ],
    )
    assert result.exit_code == 0
    assert "complete" in result.output.lower()

def test_generate_command_skip_training_plan(cli_runner):
    """Test skip training plan flag."""
    result = cli_runner.invoke(
        cli,
        [
            "generate",
            "--profile", "tests/fixtures/profile.json",
            "--skip-training-plan",
        ],
    )
    assert result.exit_code == 0
```

---

## 6. Technical Decisions

### 6.1 Synchronous vs Asynchronous Execution

**Decision**: Use synchronous execution initially

**Rationale**:
- Current codebase is entirely synchronous
- LLMAgent.process_message() is synchronous
- Tool execution is synchronous
- Async would require refactoring entire stack

**Future Enhancement**:
- Add async variants: `execute_workflow_async()`
- Enable parallel phase execution where possible
- Improve responsiveness for long-running workflows

### 6.2 Agent Context Management

**Decision**: Create new session per phase

**Rationale**:
- Clean separation of agent contexts
- Prevents tool availability confusion
- Easier to debug phase-specific issues
- Allows phase-specific max_iterations

**Alternative Considered**: Single session with dynamic tool updates
- Rejected: Too complex, harder to isolate failures

### 6.3 Data Passing Between Phases

**Decision**: Extract structured data from conversation history

**Rationale**:
- Agent responses are unstructured text
- Tool results embedded in conversation
- Need explicit extraction for next phase input

**Implementation**:
```python
def _extract_phase_data(
    self,
    phase: WorkflowPhase,
    conversation: list[ConversationMessage],
) -> dict[str, Any]:
    """Extract structured data from phase conversation."""
    tool_messages = [m for m in conversation if m.role == "tool"]

    if phase == WorkflowPhase.DATA_PREP:
        return {
            "cache_path": self._extract_cache_path(tool_messages),
            "fit_dir": self._extract_fit_dir(tool_messages),
            "activity_count": self._extract_activity_count(tool_messages),
        }

    elif phase == WorkflowPhase.ANALYSIS:
        return {
            "performance": self._extract_tool_result("analyze_performance", tool_messages),
            "zones": self._extract_tool_result("analyze_zones", tool_messages),
        }

    # ... other phases
```

### 6.4 Error Handling Strategy

**Decision**: Fail fast with detailed error reporting

**Rationale**:
- Phases are dependent (later phases need earlier results)
- No value in continuing after phase failure
- Provide clear error messages for troubleshooting

**Implementation**:
```python
async def execute_workflow(self, ...):
    results = {}

    # Phase 1
    results["data_prep"] = await self._run_phase(...)
    if not results["data_prep"].success:
        return results  # Stop here, don't continue

    # Phase 2
    results["analysis"] = await self._run_phase(...)
    if not results["analysis"].success:
        return results  # Stop here

    # ... continue only if all succeed
```

### 6.5 Tool Registry Filtering

**Decision**: Create subset registry per phase

**Rationale**:
- Agents should only see relevant tools
- Prevents tool confusion (agent choosing wrong tool)
- Matches agent specialization pattern
- Clearer tool calling behavior

**Implementation**:
```python
def _filter_registry(self, allowed_tools: list[str]) -> ToolRegistry:
    """Create registry subset with only allowed tools."""
    filtered_registry = ToolRegistry()
    global_registry = get_global_registry()

    for tool_name in allowed_tools:
        if global_registry.has_tool(tool_name):
            tool = global_registry.get_tool(tool_name)
            filtered_registry.register(tool)

    return filtered_registry
```

### 6.6 Embedded vs File-Based Prompts

**Decision**: Embedded prompts with optional file loading

**Rationale**:
- Zero external dependencies by default
- Works out-of-box without setup
- Advanced users can customize with files
- Easy to distribute (single package)

**Implementation**:
```python
def __init__(self, agent_definitions_dir: str | None = None):
    if agent_definitions_dir:
        self._load_from_files()  # Custom prompts
    else:
        self._load_embedded()    # Default prompts
```

---

## 7. Integration Points

### 7.1 With Existing Tool System

**Integration**: Reuse all existing tool wrappers

**Tools Used**:
- `prepare_cache` (data_prep)
- `organize_fit_files` (data_prep)
- `get_date_span` (data_prep)
- `analyze_performance` (analysis)
- `analyze_zones` (analysis)
- `generate_training_plan` (planning)
- `generate_html_reports` (reporting)

**No Changes Required**: Tools already compatible

### 7.2 With Provider System

**Integration**: Use existing provider abstraction

**Works With**:
- OpenAI
- Anthropic
- Gemini
- Ollama

**Provider Selection**: CLI flag `--provider anthropic`

### 7.3 With CLI System

**Integration**: Add new command to existing CLI

**Registration**:
```python
# src/cycling_ai/cli/main.py
from .commands import generate

cli.add_command(generate.generate)
```

**Consistency**: Follow existing CLI patterns (options, formatting, error handling)

### 7.4 With Athlete Profile System

**Integration**: Use existing athlete profile JSON

**Profile Fields Used**:
```json
{
  "age": 51,
  "weight": "84kg",
  "FTP": "260w",
  "critical_HR": 149,
  "gender": "male",
  "training_availability": {
    "hours_per_week": 7,
    "week_days": "Sunday, Saturday, Tuesday, Wednesday"
  },
  "goals": "Complete a 160km ride under 5 hours in 10 weeks",
  "current_training_status": "strong recreational",
  "raw_training_data_path": "/path/to/activities"
}
```

**Used By**: All phases pass athlete_profile_json path to tools

---

## 8. Risk Analysis

### 8.1 Technical Risks

**Risk**: LLM agent chooses wrong tools
- **Likelihood**: Medium
- **Impact**: High (wrong analysis)
- **Mitigation**:
  - Tool registry filtering (only show relevant tools)
  - Specialized system prompts with clear instructions
  - Validation of tool call results

**Risk**: Tool result extraction fails
- **Likelihood**: Medium
- **Impact**: High (workflow breaks)
- **Mitigation**:
  - Robust parsing logic
  - Error handling with fallbacks
  - Logging of raw tool results

**Risk**: Phase dependencies not met
- **Likelihood**: Low
- **Impact**: High (later phases fail)
- **Mitigation**:
  - Validate phase outputs before continuing
  - Fail fast on missing data
  - Clear error messages

**Risk**: MCP result format not extracted
- **Likelihood**: High (easy to forget)
- **Impact**: Critical (reporting fails)
- **Mitigation**:
  - Document pattern extensively
  - Add validation in orchestrator
  - Provide clear error messages
  - Example code in docstrings

### 8.2 User Experience Risks

**Risk**: Long execution time (5-10 minutes)
- **Likelihood**: High
- **Impact**: Medium (user frustration)
- **Mitigation**:
  - Progress indicators per phase
  - Estimated time display
  - Allow background execution (future)

**Risk**: Unclear error messages
- **Likelihood**: Medium
- **Impact**: Medium (user confusion)
- **Mitigation**:
  - Structured error reporting
  - Actionable error messages
  - Include relevant file paths

**Risk**: Unexpected agent behavior
- **Likelihood**: Medium
- **Impact**: Medium (wrong output)
- **Mitigation**:
  - Detailed logging
  - Conversation history export
  - Agent response validation

### 8.3 Maintenance Risks

**Risk**: Prompt drift (agents don't follow instructions)
- **Likelihood**: Medium
- **Impact**: Medium (output quality)
- **Mitigation**:
  - Version prompts
  - Test with multiple providers
  - Allow prompt customization

**Risk**: Tool interface changes
- **Likelihood**: Low
- **Impact**: High (workflow breaks)
- **Mitigation**:
  - Pin tool interface contracts
  - Comprehensive integration tests
  - Version compatibility checks

---

## 9. Success Criteria

### 9.1 Functional Requirements

✅ Single command generates complete HTML report suite
- 3 HTML files (index, coaching, dashboard)
- All data embedded
- Professional formatting

✅ No user interaction required during execution
- Fully automated workflow
- Progress display only

✅ Existing chat command continues to work
- No changes to chat functionality
- No breaking changes

✅ All specialized agent workflows execute correctly
- Data prep completes successfully
- Analysis provides accurate insights
- Training plan is periodized
- Reports contain all data

✅ Data flows correctly between agents
- Cache path passed to analysis
- Analysis results passed to reporting
- MCP result extraction works

✅ Professional HTML output
- Embedded data (no external files)
- Visual charts and tables
- Coaching insights included

### 9.2 Non-Functional Requirements

✅ **Performance**: Complete workflow in < 10 minutes
- Data prep: ~1 min
- Analysis: ~3 min
- Planning: ~2 min
- Reporting: ~2 min

✅ **Reliability**: 95%+ success rate on valid inputs
- Robust error handling
- Graceful failures

✅ **Maintainability**: 85%+ test coverage
- Unit tests for all components
- Integration tests for workflow
- CLI tests

✅ **Usability**: Clear progress and errors
- Per-phase progress indicators
- Actionable error messages
- Help documentation

✅ **Extensibility**: Easy to add new phases
- Modular orchestrator design
- Plugin-style tool registry
- Customizable prompts

---

## 10. Future Enhancements

### 10.1 Short Term (Next Release)

1. **Streaming Progress**
   - Real-time agent thoughts display
   - Tool execution status
   - Estimated time remaining

2. **Caching Optimization**
   - Cache analysis results
   - Skip unchanged phases
   - Incremental updates

3. **Error Recovery**
   - Retry failed phases
   - Resume from checkpoint
   - Partial result output

### 10.2 Medium Term (3-6 Months)

1. **Parallel Execution**
   - Async phase execution where possible
   - Parallel tool calls within phases
   - Faster overall workflow

2. **Web UI**
   - Browser-based interface
   - Visual workflow tracking
   - Interactive report viewing

3. **Custom Workflows**
   - User-defined phase sequences
   - Conditional phase execution
   - Workflow templates

### 10.3 Long Term (6-12 Months)

1. **Multi-Athlete Batch Processing**
   - Process multiple athletes
   - Comparative analysis
   - Team reports

2. **Advanced Analytics**
   - ML-powered insights
   - Predictive modeling
   - Anomaly detection

3. **Integration Ecosystem**
   - Strava API direct integration
   - TrainingPeaks export
   - Garmin Connect sync

---

## 11. Appendix

### 11.1 Reference Files

**Agent Definitions**:
- `/Users/eduardo/Documents/projects/athlete_performance_analysis/.claude/agents/cycling-data-prep-agent.md`
- `/Users/eduardo/Documents/projects/athlete_performance_analysis/.claude/agents/cycling-analysis-agent.md`
- `/Users/eduardo/Documents/projects/athlete_performance_analysis/.claude/agents/cycling-planning-agent.md`
- `/Users/eduardo/Documents/projects/athlete_performance_analysis/.claude/agents/cycling-reporting-agent.md`
- `/Users/eduardo/Documents/projects/athlete_performance_analysis/.claude/agents/cycling-coach-agent.md`

**Athlete Profile**:
- `/Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/athlete_profile.json`

**Current Codebase**:
- `/Users/eduardo/Documents/projects/cycling-ai-analysis/src/cycling_ai/`

### 11.2 Key Patterns

**MCP Result Extraction**:
```python
# Tool returns: {"result": "actual data"}
tool_output = analyze_performance(...)

# Extract before passing to next agent
data_string = tool_output["result"]

# Pass string, not dict
generate_html_reports(analysis_data=data_string, ...)
```

**Phase Execution**:
```python
# Create specialized agent per phase
session = ConversationSession(session_id=f"phase_{name}")
session.add_message(ConversationMessage(role="system", content=prompt))
executor = ToolExecutor()
executor.registry = filtered_registry
agent = LLMAgent(provider, executor, session)
response = agent.process_message(task)
```

**Tool Registry Filtering**:
```python
# Phase-specific tools only
allowed_tools = ["analyze_performance", "analyze_zones"]
filtered_registry = ToolRegistry()
for tool_name in allowed_tools:
    tool = global_registry.get_tool(tool_name)
    filtered_registry.register(tool)
```

### 11.3 Command Examples

```bash
# Basic usage
cycling-ai generate --profile athlete_profile.json

# Custom output
cycling-ai generate \
  --profile athlete_profile.json \
  --output ./my-reports

# Skip training plan
cycling-ai generate \
  --profile athlete_profile.json \
  --skip-training-plan

# Use OpenAI
cycling-ai generate \
  --profile athlete_profile.json \
  --provider openai \
  --model gpt-4-turbo

# Custom agent prompts
cycling-ai generate \
  --profile athlete_profile.json \
  --agent-definitions /path/to/.claude/agents
```

---

## Summary

This architecture plan provides a comprehensive blueprint for implementing the `generate` command with multi-agent orchestration. The design:

1. **Reuses existing infrastructure** (tools, providers, CLI)
2. **Adds specialized orchestration layer** (MultiAgentOrchestrator)
3. **Maintains clean separation** (prompts, phases, data flow)
4. **Follows MCP patterns** (result extraction, data passing)
5. **Enables future enhancements** (async, parallelization, custom workflows)

The implementation is **incremental, testable, and maintains backward compatibility** with the existing chat command.

**Estimated Implementation Time**: 6 days
**Test Coverage Target**: 85%+
**Lines of Code**: ~1,500 (orchestrator + prompts + CLI + tests)

Ready for implementation! 🚀
