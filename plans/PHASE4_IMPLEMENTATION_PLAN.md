# Phase 4 Implementation Plan: LLM Integration & Agent Framework

**Date:** 2025-10-24
**Status:** 🔄 IN PROGRESS
**Previous Phase:** Phase 3 Complete (Tools, CLI, Providers)

---

## Executive Summary

Phase 4 implements the **LLM integration layer** that brings together all components built in Phases 1-3. This phase transforms the system from a command-line tool into an **AI-powered conversational analyst** that can understand natural language queries, plan multi-tool workflows, and provide intelligent insights.

**Key Objectives:**
1. Implement conversational AI interface (`cycling-ai chat`)
2. Integrate provider adapters with tool execution
3. Enable multi-turn conversation sessions
4. Add tool use planning and orchestration by LLMs
5. Cross-provider testing and validation

**Timeline:** 3-4 days
**Risk Level:** Medium (API integration complexity)

---

## Current System Status

### ✅ Phase 1-3 Achievements

**Phase 1: Core Foundation**
- ✅ Base abstractions (tools, providers)
- ✅ Business logic extraction (8 modules)
- ✅ Tool registry implementation
- ✅ 90%+ test coverage on core

**Phase 2: Provider Adapters**
- ✅ OpenAI adapter (GPT-4, GPT-3.5)
- ✅ Anthropic adapter (Claude 3.5 Sonnet)
- ✅ Google Gemini adapter
- ✅ Ollama adapter (local models)
- ✅ Configuration system

**Phase 3: Tool Wrappers & CLI**
- ✅ 5 tool wrappers (performance, zones, training, cross-training, reports)
- ✅ Full CLI with Rich formatting
- ✅ Orchestration executor
- ✅ Real data validation (220+ activities)

### 🎯 What Phase 4 Adds

**Current:** CLI tools execute directly with fixed parameters
```bash
cycling-ai analyze performance --csv data.csv --profile profile.json
```

**Phase 4:** LLM-powered conversational interface
```bash
cycling-ai chat --provider anthropic
> "Analyze my performance for the last 6 months and suggest training improvements"
# LLM understands intent, calls tools, interprets results
```

---

## Architecture Overview

### Phase 4 Components

```
┌─────────────────────────────────────────────────────────┐
│                 User Input (Natural Language)            │
│              "Analyze my last 6 months..."               │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│              Conversational Interface (NEW)              │
│  - Message history management                            │
│  - Multi-turn conversation context                       │
│  - User preference tracking                              │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│           LLM Provider (via Adapter) (NEW)               │
│  - Tool schema injection                                 │
│  - Tool use planning                                     │
│  - Result interpretation                                 │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│              Tool Executor (Existing)                    │
│  - Execute requested tools                               │
│  - Format results                                        │
│  - Return to LLM for interpretation                      │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│            Core Business Logic (Existing)                │
│  - Performance analysis                                  │
│  - Zone analysis                                         │
│  - Training plan generation                              │
└─────────────────────────────────────────────────────────┘
```

---

## Phase 4 Implementation Tasks

### Task 1: Conversational Session Manager

**File:** `src/cycling_ai/orchestration/session.py`

**Purpose:** Manage multi-turn conversation state and history

**Key Classes:**
```python
@dataclass
class ConversationMessage:
    """Single message in conversation."""
    role: str  # "user", "assistant", "system", "tool"
    content: str
    tool_calls: list[dict[str, Any]] | None = None
    tool_results: list[dict[str, Any]] | None = None
    timestamp: datetime = field(default_factory=datetime.now)

@dataclass
class ConversationSession:
    """Manages a conversation session."""
    session_id: str
    provider_name: str
    messages: list[ConversationMessage]
    context: dict[str, Any]  # User preferences, data paths, etc.
    created_at: datetime
    last_activity: datetime

class SessionManager:
    """Manages conversation sessions."""

    def create_session(
        self, provider_name: str, context: dict[str, Any]
    ) -> ConversationSession:
        """Create new conversation session."""

    def add_message(
        self, session_id: str, message: ConversationMessage
    ) -> None:
        """Add message to session history."""

    def get_session(self, session_id: str) -> ConversationSession:
        """Retrieve session by ID."""

    def list_sessions(self) -> list[ConversationSession]:
        """List all active sessions."""
```

**Tests:** `tests/orchestration/test_session.py`

---

### Task 2: LLM Agent Orchestrator

**File:** `src/cycling_ai/orchestration/agent.py`

**Purpose:** Coordinate LLM tool use with tool execution

**Key Classes:**
```python
class LLMAgent:
    """
    Orchestrates LLM-powered tool execution.

    Manages the loop:
    1. Send user message + tools to LLM
    2. LLM decides which tool(s) to call
    3. Execute tools
    4. Return results to LLM
    5. LLM interprets and responds
    """

    def __init__(
        self,
        provider: BaseProvider,
        executor: ToolExecutor,
        session: ConversationSession,
    ):
        self.provider = provider
        self.executor = executor
        self.session = session

    async def process_message(self, user_message: str) -> str:
        """
        Process user message through LLM agent loop.

        Args:
            user_message: User's natural language input

        Returns:
            LLM's final response after tool execution

        Flow:
            1. Add user message to session
            2. Convert tools to provider schema
            3. Send to LLM with message history
            4. If LLM requests tools:
                a. Execute requested tools
                b. Send results back to LLM
                c. Repeat until LLM provides final answer
            5. Return LLM response
        """

    def _execute_tool_calls(
        self, tool_calls: list[dict[str, Any]]
    ) -> list[ToolExecutionResult]:
        """Execute tools requested by LLM."""

    def _format_tool_results(
        self, results: list[ToolExecutionResult]
    ) -> list[dict[str, Any]]:
        """Format tool results for LLM."""
```

**Tests:** `tests/orchestration/test_agent.py`

---

### Task 3: Chat CLI Command

**File:** `src/cycling_ai/cli/commands/chat.py`

**Purpose:** Interactive conversational interface

**Implementation:**
```python
@click.command()
@click.option(
    "--provider",
    type=click.Choice(["openai", "anthropic", "gemini", "ollama"]),
    default="anthropic",
    help="LLM provider to use",
)
@click.option(
    "--model",
    help="Specific model (e.g., gpt-4, claude-3-5-sonnet)",
)
@click.option(
    "--profile",
    type=click.Path(exists=True),
    help="Path to athlete profile (sets context)",
)
@click.option(
    "--data-dir",
    type=click.Path(exists=True),
    help="Path to data directory (for file discovery)",
)
@click.option(
    "--session-id",
    help="Resume existing session",
)
def chat(
    provider: str,
    model: str | None,
    profile: str | None,
    data_dir: str | None,
    session_id: str | None,
) -> None:
    """
    Start interactive AI conversation.

    Chat with an AI assistant that can analyze your cycling data,
    generate training plans, and provide insights.

    \b
    Examples:
        # Start new chat with Anthropic Claude
        cycling-ai chat --provider anthropic --profile athlete.json

        # Use OpenAI GPT-4
        cycling-ai chat --provider openai --model gpt-4-turbo

        # Resume existing session
        cycling-ai chat --session-id abc123

    \b
    Once in chat mode, you can ask questions like:
        "Analyze my performance for the last 6 months"
        "What's my time in zone 2 vs zone 4?"
        "Create a 12-week training plan to increase my FTP"
        "How does my swimming affect my cycling?"
    """
    # Implementation:
    # 1. Initialize provider from config
    # 2. Create or load session
    # 3. Create LLM agent
    # 4. Enter interactive loop
    # 5. Handle tool execution and display results
```

**Interactive Loop:**
```python
while True:
    # Get user input
    user_input = console.input("[bold cyan]You:[/bold cyan] ")

    if user_input.lower() in ["exit", "quit", "/quit"]:
        break

    # Show "thinking" indicator
    with console.status("[bold yellow]Thinking..."):
        response = await agent.process_message(user_input)

    # Display LLM response
    console.print(f"[bold green]AI:[/bold green] {response}")

    # If tools were executed, show summary
    if tool_results:
        display_tool_execution_summary(tool_results)
```

**Tests:** `tests/cli/commands/test_chat.py`

---

### Task 4: Provider Integration Tests

**File:** `tests/providers/test_integration.py`

**Purpose:** End-to-end tests with real LLM providers

**Test Matrix:**
```python
PROVIDERS = ["openai", "anthropic", "gemini", "ollama"]
TOOLS = ["analyze_performance", "analyze_zones", "generate_training_plan"]

@pytest.mark.integration
@pytest.mark.parametrize("provider_name", PROVIDERS)
@pytest.mark.parametrize("tool_name", TOOLS)
def test_provider_tool_execution(
    provider_name: str,
    tool_name: str,
    real_data_fixture,
):
    """
    Test each provider can execute each tool.

    Validates:
    1. Provider can convert tool schema
    2. LLM can understand and call tool
    3. Tool executes successfully
    4. Results are correctly formatted
    5. LLM can interpret results
    """
```

**Mock Tests (for CI/CD):**
```python
@pytest.mark.unit
@pytest.mark.parametrize("provider_name", PROVIDERS)
def test_provider_tool_schema_conversion(provider_name: str):
    """Test schema conversion without actual API calls."""

@pytest.mark.unit
def test_agent_orchestration_flow():
    """Test agent flow with mocked provider responses."""
```

---

### Task 5: Configuration Enhancements

**File:** `src/cycling_ai/config/defaults.yaml`

**Add LLM-specific settings:**
```yaml
# LLM settings for conversational interface
llm:
  # System prompts for different providers
  system_prompts:
    cycling_analyst: |
      You are an expert cycling performance analyst with deep knowledge of:
      - Training load and periodization
      - Power-based training zones
      - FTP testing and improvement
      - Polarized training methodology
      - Cross-training impact on cycling

      You have access to tools to analyze athlete data. When a user asks
      about their performance, use the appropriate tools to gather data,
      then provide insightful analysis and actionable recommendations.

      Always explain your reasoning and cite specific data points.

  # Default models per provider
  default_models:
    openai: "gpt-4-turbo-2024-04-09"
    anthropic: "claude-3-5-sonnet-20241022"
    gemini: "gemini-1.5-pro"
    ollama: "llama3.1:8b"

  # Conversation settings
  max_history_messages: 50
  temperature: 0.7
  max_tokens: 4096

  # Tool execution limits
  max_tool_calls_per_message: 5
  tool_timeout_seconds: 60
```

---

## Implementation Order

### Week 1: Core Infrastructure

**Day 1-2: Session Management**
1. Implement `ConversationMessage` and `ConversationSession` dataclasses
2. Implement `SessionManager` with in-memory storage
3. Create tests for session lifecycle
4. Add session persistence (JSON file or SQLite)

**Day 2-3: Agent Orchestration**
1. Implement `LLMAgent` class with basic tool loop
2. Integrate with existing `ToolExecutor`
3. Add provider schema conversion
4. Create tests with mocked providers

**Day 3-4: Chat CLI Command**
1. Implement `chat` command with provider selection
2. Add interactive loop with Rich formatting
3. Implement session resume functionality
4. Add tool execution visualization

### Week 2: Integration & Testing

**Day 5-6: Provider Integration**
1. Test with OpenAI (GPT-4)
2. Test with Anthropic (Claude 3.5 Sonnet)
3. Test with Gemini
4. Test with Ollama (local)
5. Fix provider-specific issues

**Day 6-7: End-to-End Testing**
1. Real data testing with all providers
2. Multi-turn conversation testing
3. Complex workflow testing (multiple tools)
4. Performance benchmarking
5. Documentation and examples

---

## Success Criteria

### Functional Requirements
- [ ] `cycling-ai chat` command works with all 4 providers
- [ ] LLM can discover and call all 5 tools
- [ ] Multi-turn conversations maintain context
- [ ] Tool results are correctly interpreted by LLM
- [ ] Session persistence works (save/resume)
- [ ] Error handling provides clear feedback

### Quality Requirements
- [ ] Integration tests for all provider/tool combinations
- [ ] <3 second latency for tool execution
- [ ] <10 second latency for LLM responses
- [ ] Graceful handling of API errors
- [ ] Test coverage >80% for new orchestration code

### User Experience Requirements
- [ ] Chat interface is intuitive and responsive
- [ ] Tool execution is visible to user
- [ ] Results are formatted beautifully (Rich)
- [ ] Help text explains chat capabilities
- [ ] Examples demonstrate common workflows

---

## Testing Strategy

### Unit Tests
- `test_session.py` - Session management
- `test_agent.py` - Agent orchestration (mocked)
- `test_chat.py` - CLI command (mocked)

### Integration Tests (Require API Keys)
- `test_integration.py` - Provider + tool execution
- Mark with `@pytest.mark.integration`
- Skip in CI, run manually

### End-to-End Tests
- `test_e2e_conversations.py` - Full conversation flows
- Use real data fixtures
- Test complex multi-tool scenarios

---

## Provider-Specific Considerations

### OpenAI (GPT-4)
- **Function Calling:** Native support, use `tools` parameter
- **Parallel Calls:** Can request multiple tools simultaneously
- **Cost:** ~$0.01-0.03 per request with tool use
- **Latency:** 2-5 seconds average

### Anthropic (Claude 3.5 Sonnet)
- **Tool Use:** Native support via `tools` parameter
- **Tool Chaining:** Excellent at multi-step reasoning
- **Cost:** ~$0.015-0.075 per request
- **Latency:** 2-4 seconds average

### Google Gemini
- **Function Declarations:** Uses `function_declarations`
- **Limitations:** May need prompt tuning for complex tool use
- **Cost:** Lower than OpenAI/Anthropic
- **Latency:** 3-6 seconds average

### Ollama (Local)
- **Function Calling:** Limited, depends on model
- **Fallback:** Structured output parsing from text
- **Cost:** Free (local)
- **Latency:** Varies by hardware (5-30 seconds)

---

## Example User Workflows

### Workflow 1: Performance Analysis
```
User: "How has my cycling performance changed over the last 6 months?"

LLM thinks: Need to analyze performance data
→ Calls: analyze_performance(period_months=6)

LLM receives: Performance comparison data showing +2% average power

LLM responds: "Your cycling performance has improved over the last 6 months:
- Average power increased by 2% (171W → 174W)
- You rode 110 activities totaling 4,580 km
- Your consistency improved - you averaged 18 rides per month vs 16 previously
This suggests your training is working well. Let's look at your zone distribution..."
```

### Workflow 2: Training Plan
```
User: "I want to increase my FTP from 260W to 280W. Can you create a plan?"

LLM thinks: Need athlete profile and to generate training plan
→ Calls: generate_training_plan(target_ftp=280, weeks=12)

LLM receives: 12-week periodized plan

LLM responds: "I've created a 12-week plan to increase your FTP by 7.7% (260W → 280W):

**Phase 1 (Weeks 1-3): Foundation**
- Focus on Z2 endurance (60-80% of rides)
- 4 rides per week, progressive volume
- Total: ~250 TSS/week

**Phase 2 (Weeks 4-6): Build**
- Add Z4 threshold intervals
- 2x per week: 3x10min @ 260W
..."
```

### Workflow 3: Multi-Tool Complex Query
```
User: "Analyze my training, check if I'm doing too much high intensity, and adjust my plan accordingly"

LLM thinks: This requires multiple tools in sequence
→ Calls: analyze_zones(period_months=3)

LLM receives: Zone distribution showing 15% Z4-Z5 (too high for base phase)

LLM thinks: Need to adjust training plan
→ Calls: generate_training_plan(target_ftp=current+5%, emphasis="base")

LLM responds: "I've analyzed your recent training and found you're doing too much high-intensity work:

**Current Distribution:**
- Z4-Z5: 15% (recommended: 10-12% for base phase)
- Z1-Z2: 78% (good, target: 80%)

**Recommendation:**
I've generated an adjusted plan that reduces intensity:
- Reduce threshold intervals to 1x per week
- Add more Z2 volume
- Include recovery weeks every 3rd week
..."
```

---

## Documentation Updates

### User Documentation
- **CHAT_GUIDE.md** - How to use conversational interface
- **PROVIDER_SETUP.md** - Setting up API keys for each provider
- **EXAMPLES.md** - Common conversation examples

### Developer Documentation
- **AGENT_ARCHITECTURE.md** - How the agent orchestration works
- **ADDING_PROVIDERS.md** - How to add new LLM providers
- **TOOL_INTEGRATION.md** - How tools are discovered and called

---

## Migration Path

### For Existing CLI Users
- **No Breaking Changes:** All existing CLI commands still work
- **Optional Upgrade:** `chat` is an additional interface
- **Gradual Adoption:** Users can try chat while still using direct commands

### Example Migration
**Before (Phase 3):**
```bash
cycling-ai analyze performance --csv data.csv --profile profile.json
cycling-ai analyze zones --fit-dir fits/ --profile profile.json
# User manually interprets results and decides on plan
cycling-ai plan generate --profile profile.json --weeks 12
```

**After (Phase 4):**
```bash
cycling-ai chat --profile profile.json
> "Analyze my performance and zones, then suggest a training plan"
# AI handles tool orchestration and provides integrated insights
```

---

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Provider API changes | Medium | High | Version pin SDKs, adapter isolation |
| Tool execution errors | Medium | Medium | Robust error handling, retry logic |
| LLM hallucination | Medium | Medium | Validate tool calls, cite data sources |
| Rate limiting | Medium | Medium | Implement backoff, queue requests |
| Cost overruns | Low | Medium | Track usage, set limits |

### User Experience Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Slow responses | Medium | Medium | Show progress, stream where possible |
| Confusing tool calls | Low | Low | Explain what AI is doing |
| Unexpected behavior | Medium | Medium | Clear documentation, examples |

---

## Performance Targets

### Latency Targets
- **First Token:** <2 seconds (provider dependent)
- **Tool Execution:** <5 seconds per tool
- **Total Response:** <10 seconds for single-tool queries
- **Complex Workflows:** <30 seconds for multi-tool queries

### Cost Targets (per conversation)
- **OpenAI:** <$0.10 for typical session
- **Anthropic:** <$0.15 for typical session
- **Gemini:** <$0.05 for typical session
- **Ollama:** Free (local)

---

## Future Enhancements (Phase 5+)

### Advanced Features
1. **Streaming Responses** - Stream LLM output token-by-token
2. **Parallel Tool Execution** - Execute multiple tools concurrently
3. **Workflow Templates** - Pre-defined multi-tool workflows
4. **Voice Interface** - Speech-to-text input
5. **Data Visualization** - Generate charts during conversation
6. **Export Conversations** - Save chat history as reports
7. **Agent Memory** - Long-term memory across sessions
8. **Multi-Agent** - Specialist agents for different domains

### Integration Opportunities
1. **Web Interface** - React/Next.js chat UI
2. **Mobile App** - iOS/Android with push notifications
3. **Strava Integration** - Auto-sync and analyze new activities
4. **Garmin Connect** - Direct device integration
5. **TrainingPeaks API** - Export plans to TrainingPeaks

---

## Deliverables Checklist

### Code Implementation
- [ ] `orchestration/session.py` with tests
- [ ] `orchestration/agent.py` with tests
- [ ] `cli/commands/chat.py` with tests
- [ ] Integration tests for all providers
- [ ] Configuration enhancements

### Documentation
- [ ] PHASE4_IMPLEMENTATION_COMPLETE.md (this becomes completion doc)
- [ ] CHAT_GUIDE.md for users
- [ ] PROVIDER_SETUP.md for API key configuration
- [ ] EXAMPLES.md with common workflows
- [ ] Updated README.md with chat examples

### Testing & Validation
- [ ] All unit tests passing
- [ ] Integration tests with all 4 providers
- [ ] End-to-end workflow testing
- [ ] Performance benchmarks
- [ ] Cost analysis

---

## Next Steps

### Immediate Actions
1. Review and approve this plan
2. Set up API keys for testing (OpenAI, Anthropic, Gemini)
3. Create branch: `feature/phase4-llm-integration`
4. Begin Task 1: Session Management

### Implementation Sequence
1. **Task 1:** Session management (Days 1-2)
2. **Task 2:** Agent orchestration (Days 2-3)
3. **Task 3:** Chat CLI (Days 3-4)
4. **Task 4:** Provider integration tests (Days 5-6)
5. **Task 5:** Documentation & validation (Days 6-7)

---

## Appendix: Code Snippets

### Example Agent Loop (Simplified)
```python
async def process_message(self, user_message: str) -> str:
    # Add user message to history
    self.session.add_message(ConversationMessage(
        role="user",
        content=user_message
    ))

    # Convert tools to provider schema
    tools_schema = self.provider.convert_tools_schema(
        self.executor.registry.list_tools()
    )

    # Send to LLM with tools
    response = await self.provider.chat_completion(
        messages=self.session.messages,
        tools=tools_schema,
        max_tokens=4096
    )

    # Check if LLM wants to call tools
    if response.tool_calls:
        # Execute tools
        tool_results = await self._execute_tools(response.tool_calls)

        # Send results back to LLM
        response = await self.provider.chat_completion(
            messages=self.session.messages + [
                ConversationMessage(
                    role="assistant",
                    tool_calls=response.tool_calls
                ),
                ConversationMessage(
                    role="tool",
                    tool_results=tool_results
                )
            ],
            tools=tools_schema
        )

    # Return final response
    return response.content
```

---

**Document Version:** 1.0
**Author:** Implementation Planning Agent
**Date:** 2025-10-24
**Status:** Ready for Implementation
