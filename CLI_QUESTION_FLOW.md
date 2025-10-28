# Cycling-AI CLI: Question Flow Explanation

## Overview

This document explains what happens when you send a question to the cycling-ai CLI system.

## Question Flow Overview

When you type a question like "How has my cycling performance changed over the last 6 months?", here's the complete flow:

### 1. **CLI Entry** [`src/cycling_ai/cli/main.py:53-59`](src/cycling_ai/cli/main.py#L53-L59)
You run: `cycling-ai chat --provider anthropic --profile athlete.json`

### 2. **Chat Command Initialization** [`src/cycling_ai/cli/commands/chat.py:107-156`](src/cycling_ai/cli/commands/chat.py#L107-L156)
- Loads your athlete profile and configuration
- Creates/restores a conversation session (stored in `~/.cycling-ai/sessions/`)
- Initializes the LLM provider (Anthropic Claude in your case)
- Creates an **LLMAgent** that orchestrates everything

### 3. **Interactive Loop** [`src/cycling_ai/cli/commands/chat.py:301-356`](src/cycling_ai/cli/commands/chat.py#L301-L356)
- Displays a prompt waiting for your question
- You type your question
- System checks if it's a special command (`/quit`, `/help`, etc.)
- If not, passes it to the agent for processing

### 4. **Agent Processing** [`src/cycling_ai/orchestration/agent.py:53-124`](src/cycling_ai/orchestration/agent.py#L53-L124)
This is the core orchestration - it's an iterative loop (max 10 iterations):
   - Adds your question to the conversation history
   - Gets available tools from the registry (5 cycling analysis tools)
   - Sends to Claude with your question + tool definitions
   - Claude decides if it needs to call tools or can answer directly

### 5. **Tool Execution** (if needed)
Claude might call tools like:
- `analyze_performance` - Compares metrics over time periods ([`tools/wrappers/performance.py`](src/cycling_ai/tools/wrappers/performance.py))
- `analyze_zones` - Examines power zone distribution ([`tools/wrappers/zones_tool.py`](src/cycling_ai/tools/wrappers/zones_tool.py))
- `generate_training_plan` - Creates training recommendations ([`tools/wrappers/training_plan_tool.py`](src/cycling_ai/tools/wrappers/training_plan_tool.py))
- `analyze_cross_training` - Analyzes non-cycling activities ([`tools/wrappers/cross_training_tool.py`](src/cycling_ai/tools/wrappers/cross_training_tool.py))
- `generate_report` - Creates HTML/Markdown reports ([`tools/wrappers/report_tool.py`](src/cycling_ai/tools/wrappers/report_tool.py))

Each tool:
- Reads your CSV activity data
- Performs calculations (FTP trends, zone analysis, etc.)
- Returns structured results back to Claude

### 6. **Iterative Refinement**
- Claude receives tool results
- Can call more tools if needed
- Loops back until it has enough information
- Generates a final natural language response

### 7. **Response Display** [`src/cycling_ai/cli/commands/chat.py:338-346`](src/cycling_ai/cli/commands/chat.py#L338-L346)
- Response formatted with Rich library (markdown panels)
- Displayed in your terminal
- Full conversation saved to session file

### 8. **Session Persistence** [`src/cycling_ai/orchestration/session.py`](src/cycling_ai/orchestration/session.py)
- Entire conversation (your questions, Claude's responses, tool calls) saved
- Can resume later with full context
- Stored as JSON in `~/.cycling-ai/sessions/`

## Key Architecture Patterns

### Provider Abstraction
The system works with Anthropic, OpenAI, Gemini, or Ollama through a common interface ([`src/cycling_ai/providers/base.py`](src/cycling_ai/providers/base.py))

### Tool Registry
All analysis tools register themselves, making the system easily extensible

### Agentic Loop
Claude autonomously decides which tools to use and can chain multiple tool calls to answer complex questions

## Example: 6-Month Performance Question

For a question like "How has my cycling performance changed over the last 6 months?", Claude would likely:

1. Call `analyze_performance` with a 6-month time range
2. Receive metrics (FTP trends, volume changes, intensity distribution)
3. Generate a comprehensive analysis with insights about your improvement or changes

## Key File Paths

### Entry Points
- [`src/cycling_ai/cli/main.py`](src/cycling_ai/cli/main.py) - Main CLI entry point
- [`src/cycling_ai/cli/commands/chat.py`](src/cycling_ai/cli/commands/chat.py) - Chat command implementation

### Orchestration
- [`src/cycling_ai/orchestration/agent.py`](src/cycling_ai/orchestration/agent.py) - LLM agent orchestration
- [`src/cycling_ai/orchestration/session.py`](src/cycling_ai/orchestration/session.py) - Session management
- [`src/cycling_ai/orchestration/executor.py`](src/cycling_ai/orchestration/executor.py) - Tool execution

### Tools & Registry
- [`src/cycling_ai/tools/base.py`](src/cycling_ai/tools/base.py) - Base tool interface
- [`src/cycling_ai/tools/registry.py`](src/cycling_ai/tools/registry.py) - Tool registry system
- [`src/cycling_ai/tools/wrappers/performance.py`](src/cycling_ai/tools/wrappers/performance.py) - Performance analysis tool
- [`src/cycling_ai/tools/wrappers/zones_tool.py`](src/cycling_ai/tools/wrappers/zones_tool.py) - Zone analysis tool
- [`src/cycling_ai/tools/wrappers/training_plan_tool.py`](src/cycling_ai/tools/wrappers/training_plan_tool.py) - Training plan generation
- [`src/cycling_ai/tools/wrappers/cross_training_tool.py`](src/cycling_ai/tools/wrappers/cross_training_tool.py) - Cross-training analysis
- [`src/cycling_ai/tools/wrappers/report_tool.py`](src/cycling_ai/tools/wrappers/report_tool.py) - Report generation

### Providers
- [`src/cycling_ai/providers/base.py`](src/cycling_ai/providers/base.py) - Base provider interface
- [`src/cycling_ai/providers/factory.py`](src/cycling_ai/providers/factory.py) - Provider factory
- [`src/cycling_ai/providers/anthropic_provider.py`](src/cycling_ai/providers/anthropic_provider.py) - Anthropic/Claude implementation
- [`src/cycling_ai/providers/openai_provider.py`](src/cycling_ai/providers/openai_provider.py) - OpenAI implementation

## System Architecture Layers

1. **CLI Layer** - User input/output ([chat.py](src/cycling_ai/cli/commands/chat.py))
2. **Agent Layer** - LLM orchestration ([agent.py](src/cycling_ai/orchestration/agent.py))
3. **Provider Layer** - LLM abstraction ([providers/](src/cycling_ai/providers/))
4. **Tool Layer** - Analysis tools ([tools/](src/cycling_ai/tools/))
5. **Data Layer** - Business logic ([core/](src/cycling_ai/core/))
6. **Session Layer** - Context management ([session.py](src/cycling_ai/orchestration/session.py))

The system is designed to be modular, extensible, and supports multiple LLM providers while maintaining full conversation context through persistent sessions.

## Flow Diagram

```
User Question
    ↓
CLI Entry ([main.py](src/cycling_ai/cli/main.py))
    ↓
Chat Command ([chat.py](src/cycling_ai/cli/commands/chat.py))
    ↓
LLM Agent ([agent.py](src/cycling_ai/orchestration/agent.py)) ←────────┐
    ↓                                                                    │
LLM Provider ([anthropic.py](src/cycling_ai/providers/anthropic_provider.py))
    ↓                                                                    │
Tool Decision                                                            │
    ↓                                                                    │
Tool Execution ([executor.py](src/cycling_ai/orchestration/executor.py))│
    ↓                                                                    │
Tool Results ────────────────────────────────────────────────────────────┘
    ↓
Final Response
    ↓
Display & Save ([chat.py](src/cycling_ai/cli/commands/chat.py) + [session.py](src/cycling_ai/orchestration/session.py))
```

## Session Storage

Sessions are stored in: `~/.cycling-ai/sessions/{session_id}.json`

Each session contains:
- Full conversation history
- System messages
- User messages
- Assistant responses
- Tool calls and results
- Metadata (timestamps, provider, model)
- Context paths (athlete profile, data directory)
