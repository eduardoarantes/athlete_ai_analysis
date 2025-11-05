# Cycling AI Analysis - Claude Code Guide

**Project:** AI-powered cycling performance analysis with conversational interface
**Status:** Production Ready (Phase 4 Complete - 253/253 tests passing)
**Version:** 0.1.0

---

## Project Overview

This is a **production-ready Python application** that provides AI-powered cycling performance analysis through:

1. **Multi-Agent Report Generation** (`cycling-ai generate`) - Automated 4-phase pipeline that generates comprehensive HTML reports
2. **Conversational AI Interface** (`cycling-ai chat`) - Natural language chat with an AI assistant for performance queries
3. **Direct CLI Analysis Tools** - Command-line tools for specific analyses (performance, zones, training plans)

### Key Achievement
The system successfully orchestrates **4 specialized AI agents** that automatically analyze cycling data, create training plans, and generate professional HTML reports—all from a single command.

---

## Project Goals & Philosophy

### Primary Goals
1. **Make cycling performance analysis accessible** to all cyclists through natural language interaction
2. **Automate comprehensive report generation** using multi-agent LLM orchestration
3. **Support multiple LLM providers** (Anthropic, OpenAI, Google Gemini, Ollama) for flexibility and cost optimization
4. **Maintain production-grade code quality** (type-safe, tested, well-documented)

### Design Principles
- **Type Safety First**: Full `mypy --strict` compliance throughout the codebase
- **Test Coverage**: 253 passing tests, 85%+ coverage on orchestration, 62% overall
- **Clean Architecture**: Separation of concerns, SOLID principles, clear abstractions
- **Provider Agnostic**: Easy to add new LLM providers via adapter pattern
- **Tool Reuse**: All tools work standalone AND in agent orchestration
- **Fail Fast**: Clear error messages, validation at boundaries

---

## Architecture Overview

### High-Level Structure

```
┌─────────────────────────────────────────────────────────────┐
│                     CLI Layer                                │
│  cycling-ai {generate|chat|analyze|plan|report}              │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         v                               v
┌─────────────────────┐         ┌─────────────────────┐
│  Multi-Agent        │         │  Conversational     │
│  Orchestrator       │         │  Chat Interface     │
│  (4 Phases)         │         │  (Session-based)    │
└─────────┬───────────┘         └─────────┬───────────┘
          │                               │
          v                               v
┌──────────────────────────────────────────────────────┐
│            Orchestration Layer                        │
│  • LLM Agent (tool calling)                          │
│  • Tool Executor (runs Python functions)             │
│  • Session Manager (conversation state)              │
│  • Agent Prompts Manager (specialized prompts)       │
└────────────────────────┬─────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         v                               v
┌─────────────────────┐         ┌─────────────────────┐
│  Provider Layer     │         │  Tools Layer        │
│  (OpenAI, Anthropic,│         │  (analyze_perf,     │
│   Gemini, Ollama)   │         │   analyze_zones,    │
└─────────┬───────────┘         │   generate_plan)    │
          │                     └─────────┬───────────┘
          v                               v
┌──────────────────────────────────────────────────────┐
│              Core Business Logic                      │
│  • Performance analysis algorithms                    │
│  • Power zone calculations                           │
│  • Training plan generation                          │
│  • FIT file processing                               │
└──────────────────────────────────────────────────────┘
```

### Directory Structure

```
src/cycling_ai/
├── core/                  # Business logic (pure Python, no LLM)
│   ├── performance.py     # Performance analysis algorithms
│   ├── zones.py          # Power zone calculations
│   ├── training.py       # Training plan generation
│   ├── fit_processing.py # FIT file parsing
│   └── workout_builder.py
│
├── tools/                # Tool abstraction layer (MCP-style)
│   ├── base.py          # Tool, ToolParameter, ToolExecutionResult
│   ├── registry.py      # Auto-discovery and registration
│   └── wrappers/        # Tool implementations (Python → LLM callable)
│       ├── performance.py
│       ├── zones_tool.py
│       ├── training_plan_tool.py
│       └── data_validation_tool.py
│
├── providers/           # LLM provider adapters
│   ├── base.py         # BaseProvider, ProviderConfig
│   ├── openai_provider.py
│   ├── anthropic_provider.py
│   ├── gemini_provider.py
│   └── ollama_provider.py
│
├── orchestration/      # AI orchestration layer
│   ├── session.py      # ConversationSession, SessionManager
│   ├── agent.py        # LLMAgent, AgentFactory (tool calling)
│   ├── executor.py     # ToolExecutor (Python execution)
│   ├── multi_agent.py  # MultiAgentOrchestrator (4-phase pipeline)
│   └── prompts.py      # AgentPromptsManager (specialized prompts)
│
├── cli/                # Command-line interface
│   ├── main.py        # Entry point, Click app
│   └── commands/      # CLI commands
│       ├── generate.py   # Multi-agent report generation
│       ├── chat.py       # Conversational interface
│       ├── analyze.py    # Direct analysis commands
│       └── plan.py       # Training plan commands
│
├── config/            # Configuration management
└── utils/             # Shared utilities
```

---

## Key Components Deep Dive

### 1. Multi-Agent Orchestrator (`orchestration/multi_agent.py`)

**Purpose:** Coordinates 4 specialized agents to generate comprehensive reports.

**4-Phase Pipeline:**
1. **Phase 1: Data Preparation** - Validates CSV, profile, FIT files; creates Parquet cache
2. **Phase 2: Performance Analysis** - Compares periods, calculates zone distribution
3. **Phase 3: Training Planning** - Creates periodized training plan (optional)
4. **Phase 4: Report Data Preparation** - Prepares JSON data for HTML templates

**Key Pattern: MCP Result Extraction**
- Each phase creates an isolated session
- Agent executes tools, results stored in conversation
- Orchestrator extracts structured data from tool results
- Data flows: Phase 1 → Phase 2 → Phase 3 → Phase 4

**Important:** Session isolation prevents context overflow and prompt contamination.

### 2. Tool System (`tools/`)

**Pattern:** Model Context Protocol (MCP) style
- Tools are Python functions decorated with metadata
- Auto-discovered via `registry.py`
- LLM calls tools by name, executor runs Python function
- Results returned as structured JSON

**Example Tool:**
```python
@dataclass
class AnalyzePerformanceTool(BaseTool):
    name: str = "analyze_performance"
    description: str = "Compare cycling performance across time periods"

    def execute(self, **kwargs) -> ToolExecutionResult:
        # Python business logic here
        result = analyze_performance_data(...)
        return ToolExecutionResult(
            success=True,
            output=json.dumps(result),
            format="json"
        )
```

### 3. Provider System (`providers/`)

**Pattern:** Adapter pattern for LLM providers
- Common interface: `BaseProvider`
- Each provider implements: `complete()`, `complete_streaming()`
- Handles tool calling format conversion (each provider has different schemas)
- Configuration via `ProviderConfig`

**Supported Providers:**
- **Anthropic Claude** (Recommended) - Best tool calling, high quality
- **OpenAI GPT-4** - Reliable, more expensive
- **Google Gemini** - Best value, good quality
- **Ollama** - Local execution, free, privacy-focused

### 4. Session System (`orchestration/session.py`)

**Purpose:** Manages conversation state for chat and multi-agent workflows

**Key Features:**
- Stores messages with roles (user, assistant, tool)
- Supports tool results in conversation
- Persistence to JSON files
- Session resumption for chat

**Usage:**
- Chat: One long-lived session
- Multi-agent: Fresh session per phase

---

## Data Flow Patterns

### Pattern 1: Multi-Agent Report Generation

```
User runs: cycling-ai generate --profile profile.json --fit-dir ./fit/

1. CLI validates inputs, creates WorkflowConfig
2. MultiAgentOrchestrator.execute_workflow()

   Phase 1 (Data Prep Agent):
   - New session created with DATA_PREPARATION_PROMPT
   - Agent validates files
   - Creates Parquet cache: activities_processed.parquet
   - Extracts: {csv_validated: true, fit_files_count: 42}

   Phase 2 (Performance Analysis Agent):
   - New session with PERFORMANCE_ANALYSIS_PROMPT + Phase 1 data
   - Calls: analyze_performance, analyze_zones
   - Extracts: {performance_data: {...}, zones_data: {...}}

   Phase 3 (Training Planning Agent):
   - New session with TRAINING_PLANNING_PROMPT + Phase 2 data
   - Calls: generate_training_plan
   - Extracts: {training_plan_data: {...}}

   Phase 4 (Report Data Prep Agent):
   - New session with REPORT_DATA_PREP_PROMPT + all previous data
   - Calls: prepare_report_data
   - Extracts: {report_json_path: "report_data.json"}

3. HTML templates render from report_data.json
4. Output: index.html, coaching_insights.html, performance_dashboard.html
```

### Pattern 2: Conversational Chat

```
User runs: cycling-ai chat --provider anthropic

1. SessionManager creates/loads session
2. User types: "How has my performance changed in the last 6 months?"
3. LLMAgent processes message:
   - Sends to provider with available tools
   - LLM decides to call analyze_performance
   - ToolExecutor runs Python function
   - Result added to conversation
   - LLM generates natural language response
4. User sees insights + can ask follow-up questions
```

---

## Important Patterns & Best Practices

### 1. Type Safety
**Always use type hints and maintain mypy --strict compliance**

```python
# Good
def analyze_performance(
    csv_path: Path,
    profile: AthleteProfile,
    period_months: int
) -> PerformanceAnalysis:
    ...

# Bad - no types
def analyze_performance(csv_path, profile, period_months):
    ...
```

### 2. Tool Result Extraction (MCP Pattern)

**Critical for multi-agent workflows:**

```python
def _extract_phase_data(
    self,
    phase_name: str,
    response: str,
    session: ConversationSession,
) -> dict[str, Any]:
    """Extract structured data from tool results in session."""
    extracted: dict[str, Any] = {}

    # Look through session messages for tool results
    for message in session.messages:
        if message.role == "tool" and message.tool_results:
            for tool_result in message.tool_results:
                if tool_result.get("success"):
                    # Parse JSON from content
                    data = json.loads(message.content)
                    extracted[tool_result["tool_name"]] = data

    return extracted
```

### 3. Session Isolation

**Each phase gets a fresh session:**

```python
# Good - isolated sessions
session = session_manager.create_session(
    provider_name=provider.name,
    context=phase_context,  # Data from previous phases
    system_prompt=phase_prompt,
)

# Bad - reusing session across phases causes context overflow
```

### 4. Error Handling

**Fail fast with clear messages:**

```python
# Good
def validate_config(config: WorkflowConfig) -> None:
    if not config.csv_file_path.exists():
        raise ValueError(
            f"CSV file not found: {config.csv_file_path}\n"
            f"Please check the path and try again."
        )

# Bad - silent failure
def validate_config(config):
    if not config.csv_file_path.exists():
        return False
```

### 5. Tool Naming Convention

**Tools should be verb-based and descriptive:**

```python
# Good
"analyze_performance"
"generate_training_plan"
"validate_data"

# Bad
"performance"
"plan"
"validator"
```

---

## Testing Strategy

### Test Coverage Goals
- **Unit tests**: 90%+ for core business logic
- **Integration tests**: All tool wrappers, provider adapters
- **End-to-end tests**: Multi-agent workflow with real LLMs (marked as integration)

### Running Tests

```bash
# All tests (skips integration by default)
pytest

# With coverage report
pytest --cov=src/cycling_ai --cov-report=html

# Include integration tests (requires API keys)
pytest -m integration

# Specific component
pytest tests/orchestration/test_multi_agent.py -v

# Type checking
mypy src/cycling_ai --strict
```

### Testing Patterns

**1. Mock LLM responses for unit tests:**
```python
def test_agent_tool_calling(mock_provider):
    """Test agent can call tools correctly."""
    mock_provider.set_response(
        tool_calls=[{"name": "analyze_performance", "args": {...}}]
    )

    agent = LLMAgent(provider=mock_provider, session=session)
    response = agent.process_message("Analyze my performance")

    assert "tool" in session.messages
```

**2. Use real data for integration tests:**
```python
@pytest.mark.integration
def test_real_workflow(real_csv_file, real_profile):
    """Test with real data and real LLM."""
    config = WorkflowConfig(
        csv_file_path=real_csv_file,
        athlete_profile_path=real_profile,
    )

    orchestrator = MultiAgentOrchestrator(provider=anthropic_provider)
    result = orchestrator.execute_workflow(config)

    assert result.success
    assert len(result.output_files) == 3  # 3 HTML files
```

---

## Common Tasks & How-Tos

### Adding a New Tool

1. **Create tool wrapper** in `tools/wrappers/`:

```python
from dataclasses import dataclass
from cycling_ai.tools.base import BaseTool, ToolExecutionResult, ToolParameter

@dataclass
class MyNewTool(BaseTool):
    name: str = "my_new_tool"
    description: str = "Does something useful"
    parameters: list[ToolParameter] = field(default_factory=lambda: [
        ToolParameter(
            name="input_data",
            param_type="string",
            description="Input data to process",
            required=True
        )
    ])

    def execute(self, input_data: str) -> ToolExecutionResult:
        # Call core business logic
        result = my_core_function(input_data)

        return ToolExecutionResult(
            success=True,
            output=json.dumps(result),
            format="json"
        )
```

2. **Tool is auto-discovered** by `ToolRegistry` on startup (no registration needed!)

3. **Write tests:**

```python
def test_my_new_tool():
    tool = MyNewTool()
    result = tool.execute(input_data="test")

    assert result.success
    assert "expected_key" in json.loads(result.output)
```

### Adding a New LLM Provider

1. **Create provider adapter** in `providers/`:

```python
class MyNewProvider(BaseProvider):
    def complete(
        self,
        messages: list[ConversationMessage],
        tools: list[Tool] | None = None,
    ) -> str:
        # Convert messages to provider's format
        # Call provider's API
        # Convert response back to standard format
        return response_text

    def _convert_tools_to_provider_format(
        self, tools: list[Tool]
    ) -> list[dict]:
        # Each provider has different tool schema
        return [...]
```

2. **Register in factory** (`providers/factory.py`):

```python
class ProviderFactory:
    @staticmethod
    def create_provider(config: ProviderConfig) -> BaseProvider:
        if config.provider_name == "mynewprovider":
            return MyNewProvider(config)
        # ...
```

3. **Add to CLI options** (`cli/commands/generate.py`, `cli/commands/chat.py`)

### Adding a New Phase to Multi-Agent Workflow

1. **Add prompt** in `orchestration/prompts.py`:

```python
MY_NEW_PHASE_PROMPT = """You are a specialist in X...
Your role: ...
Available tools: ...
"""

class AgentPromptsManager:
    def get_my_new_phase_prompt(self) -> str:
        return self._custom_prompts.get("my_new_phase", MY_NEW_PHASE_PROMPT)
```

2. **Add phase execution** in `orchestration/multi_agent.py`:

```python
def _execute_phase_my_new_phase(
    self, config: WorkflowConfig, prev_result: PhaseResult
) -> PhaseResult:
    return self._execute_phase(
        phase_name="my_new_phase",
        config=config,
        prompt_getter=lambda: self.prompts_manager.get_my_new_phase_prompt(),
        tools=["my_tool_1", "my_tool_2"],
        phase_context=prev_result.extracted_data,
        user_message="Execute new phase...",
    )
```

3. **Integrate into workflow** in `execute_workflow()`:

```python
phase_new = self._execute_phase_my_new_phase(config, phase_3_result)
phase_results.append(phase_new)
```

---

## Configuration & Environment

### Required Environment Variables

**For cloud providers:**
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GOOGLE_API_KEY="..."
```

**For local execution:**
```bash
# Ollama doesn't need API key
# Just ensure Ollama is running: ollama serve
```

### Configuration Files

**Athlete Profile** (`athlete_profile.json`):
```json
{
  "ftp": 265,
  "max_hr": 186,
  "weight_kg": 70,
  "age": 35,
  "goals": ["Improve FTP", "Complete century ride"]
}
```

**Custom Prompts** (optional, `~/.cycling-ai/prompts/`):
- `data_preparation_agent.txt`
- `performance_analysis_agent.txt`
- `training_planning_agent.txt`
- `report_data_preparation_agent.txt`

---

## Performance Considerations

### Token Usage Estimates (Claude Sonnet)
- **Phase 1:** ~1,000 tokens
- **Phase 2:** ~8,000 tokens
- **Phase 3:** ~5,000 tokens
- **Phase 4:** ~10,000 tokens
- **Total:** ~24,000 tokens (~$0.25 per workflow)

### Optimization Tips
1. Use efficient models (Sonnet vs Opus)
2. Shorter analysis periods reduce tokens
3. Session isolation limits context growth
4. Parquet cache accelerates data access (10x faster than CSV)

### Execution Time
- **Typical:** 2-5 minutes for complete workflow
- **Factors:** Provider speed, dataset size, model size
- **Fastest:** Anthropic Claude (~2 min)
- **Slowest:** Ollama with small hardware (~5-10 min)

---

## Known Issues & Limitations

### Model Size Requirements
**CRITICAL:** Models with < 8B parameters cannot reliably execute tool calls.

- ❌ **llama3.2:3b** - Too small, produces no HTML reports
- ⚠️ **llama3.1:8b** - Minimum acceptable for local use
- ✅ **claude-3.5-sonnet** - Recommended for production

See `docs/TROUBLESHOOTING.md` for details.

### Data Requirements
- CSV must have columns: Activity Date, Activity Name, Activity Type, Distance, Moving Time
- FIT files optional but recommended for power analysis
- Athlete profile must have: ftp, max_hr, weight_kg, age, goals

---

## Contributing Guidelines

### Before Making Changes

1. **Read existing tests** to understand patterns
2. **Check type hints** are complete (`mypy --strict` must pass)
3. **Run full test suite** before committing
4. **Update documentation** for user-facing changes

### Code Style

- **Formatting:** Use `ruff format`
- **Linting:** Run `ruff check` (auto-fix with `--fix`)
- **Type checking:** `mypy src/cycling_ai --strict`
- **Line length:** 100 characters max
- **Imports:** Group by stdlib, third-party, local

### Commit Guidelines

```bash
# Good commit messages
"Add zone enrichment to data preparation phase"
"Fix: Handle missing FTP in athlete profile"
"Refactor: Extract tool result parsing to helper method"

# Bad commit messages
"fix stuff"
"updates"
"WIP"
```

### Pull Request Process

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes with tests
3. Run full test suite: `pytest && mypy src/cycling_ai --strict`
4. Update documentation if needed
5. Create PR with clear description

---

## Debugging Tips

### Enable Verbose Logging

```bash
cycling-ai generate --verbose
# or
cycling-ai chat --verbose
```

Logs go to: `~/.cycling-ai/logs/cycling-ai.log`

### Debug Multi-Agent Workflow

**Check phase results:**
```python
result = orchestrator.execute_workflow(config)
for phase_result in result.phase_results:
    print(f"{phase_result.phase_name}: {phase_result.status}")
    print(f"Extracted data: {phase_result.extracted_data}")
```

**Check session messages:**
```python
session = session_manager.load_session(session_id)
for msg in session.messages:
    print(f"{msg.role}: {msg.content[:100]}...")
```

**Validate tool results:**
```python
# Tools should return ToolExecutionResult with success=True
result = tool.execute(**params)
assert result.success, f"Tool failed: {result.error}"
```

---

## Quick Reference

### Common Commands

```bash
# Generate comprehensive reports
cycling-ai generate --profile profile.json --fit-dir ./fit/ --provider anthropic

# Start chat session
cycling-ai chat --provider anthropic --profile profile.json

# Direct performance analysis
cycling-ai analyze performance --csv activities.csv --profile profile.json --period-months 6

# Generate training plan
cycling-ai plan generate --profile profile.json --weeks 12 --target-ftp 280

# Run tests
pytest
pytest --cov=src/cycling_ai --cov-report=html
mypy src/cycling_ai --strict
ruff check src/cycling_ai
```


## check last session's log

python3 scripts/analyze_llm_logs.py  "$(ls -t logs/llm_interactions | head -n 1 | xargs -I {} realpath logs/llm_interactions/{})" --interaction {interaction_id}


application log location: app/app.log
logs are correlated to the sessions 
example
[{session_id}] - 2025-11-05 14:30:52 - cycling_ai.agent - INFO - Processing user message


## Final Notes for Claude Code

When working on this project:

1. **Always maintain type safety** - Run `mypy --strict` before committing
2. **Write tests first** for new features (TDD approach)
3. **Respect session isolation** - Each phase needs fresh session in multi-agent workflow
4. **Follow MCP pattern** for tool results - Extract from conversation messages
5. **Keep business logic separate** - Core logic in `core/`, tools in `tools/wrappers/`
6. **Document prompts well** - Agent prompts are critical for quality
7. **Test with real data** - Integration tests catch provider-specific issues
8. **Optimize for tokens** - Session isolation and efficient prompts reduce costs

**Most Important:** This is a production system with real users. Code quality, test coverage, and clear documentation are non-negotiable.
