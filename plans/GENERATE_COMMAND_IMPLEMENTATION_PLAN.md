# Plan: Create Single-Command HTML Report Generator

## Overview
Create a new `generate-report` CLI command that takes an athlete profile and generates a comprehensive HTML performance report in one shot, while keeping the existing interactive chat interface.

## Current State Analysis
- **Current CLI**: Has interactive `chat` command that uses single `LLMAgent` with one system prompt
- **Desired State**: The athlete performance analysis project uses **5 specialized agents** (data-prep, analysis, coach, planning, reporting) coordinated through MCP tools
- **Goal**: Bridge the gap by creating a single command that orchestrates these specialized workflows

## Implementation Plan

### 1. **Create new `generate` command** ([`src/cycling_ai/cli/commands/generate.py`](../src/cycling_ai/cli/commands/generate.py))
   - New CLI command: `cycling-ai generate --profile <path> --output <dir>`
   - Orchestrates the complete workflow:
     1. Load athlete profile JSON
     2. Prepare data cache (data-prep agent workflow)
     3. Run performance analysis (analysis agent workflow)
     4. Run time-in-zones analysis (analysis agent workflow)
     5. Generate training plan (planning agent workflow)
     6. Create HTML reports (reporting agent workflow)
   - Uses multiple specialized `LLMAgent` instances, one for each workflow phase
   - Each agent gets its own system prompt based on the agent definitions from `.claude/agents/`

### 2. **Create specialized agent prompts module** ([`src/cycling_ai/orchestration/prompts.py`](../src/cycling_ai/orchestration/prompts.py))
   - Parse the 5 agent markdown files from athlete_performance_analysis project
   - Extract system prompts for:
     - Data prep specialist
     - Performance analyst
     - Training planner
     - Report generator
     - Master orchestrator (coach)
   - Provide factory functions to get each prompt

### 3. **Create multi-agent orchestrator** ([`src/cycling_ai/orchestration/multi_agent.py`](../src/cycling_ai/orchestration/multi_agent.py))
   - `MultiAgentOrchestrator` class that manages workflow across multiple agents
   - Each phase uses a specialized agent with appropriate tools:
     - **Data prep**: Uses data preparation tools
     - **Analysis**: Uses performance + zones analysis tools
     - **Planning**: Uses training plan tool
     - **Reporting**: Uses HTML report generation tool
   - Handles data flow between agents (following MCP integration rules - extract `result` fields)

### 4. **Update CLI registration** ([`src/cycling_ai/cli/main.py`](../src/cycling_ai/cli/main.py))
   - Register new `generate` command alongside existing `chat` command
   - Keep existing chat command unchanged

### 5. **Map agent definitions to tool registry**
   - Data prep agent → core/data_loader tools
   - Analysis agent → tools/wrappers/performance, zones tools
   - Planning agent → tools/wrappers/training_plan_tool
   - Reporting agent → tools/wrappers/report_tool
   - Coach agent → orchestrates all of the above

## Key Design Decisions

**✅ Keep existing chat command unchanged**
- Current interactive chat continues to work
- Uses single agent with current system prompt

**✅ Add new generate command for one-shot reports**
- Non-interactive, automated workflow
- Uses multi-agent orchestration pattern from athlete_performance_analysis project

**✅ Reuse existing tools and infrastructure**
- Same tool registry and provider abstraction
- Same LLMAgent class, just multiple instances with different prompts

**✅ Follow MCP integration pattern**
- Extract `result` field from tool outputs before passing to next agent
- Follow the data flow rules from cycling-coach-agent.md

## File Changes Summary

### New files:
- `src/cycling_ai/cli/commands/generate.py` - New generate command
- `src/cycling_ai/orchestration/prompts.py` - Agent prompt definitions
- `src/cycling_ai/orchestration/multi_agent.py` - Multi-agent orchestrator

### Modified files:
- `src/cycling_ai/cli/main.py` - Register generate command
- `src/cycling_ai/cli/commands/__init__.py` - Export generate command

### Unchanged:
- All existing chat functionality
- Tool implementations
- Provider infrastructure
- Session management

## Example Usage

```bash
# New single-command report generation
cycling-ai generate \
  --profile /Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/athlete_profile.json \
  --output ./reports

# Existing interactive chat (unchanged)
cycling-ai chat --provider anthropic --profile athlete.json
```

## Agent Definitions Reference

Agent definition files from athlete_performance_analysis project:
- `/Users/eduardo/Documents/projects/athlete_performance_analysis/.claude/agents/cycling-analysis-agent.md`
- `/Users/eduardo/Documents/projects/athlete_performance_analysis/.claude/agents/cycling-coach-agent.md`
- `/Users/eduardo/Documents/projects/athlete_performance_analysis/.claude/agents/cycling-data-prep-agent.md`
- `/Users/eduardo/Documents/projects/athlete_performance_analysis/.claude/agents/cycling-planning-agent.md`
- `/Users/eduardo/Documents/projects/athlete_performance_analysis/.claude/agents/cycling-reporting-agent.md`

## Athlete Profile Reference

Location: `/Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/athlete_profile.json`

Expected structure:
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
    "raw_training_data_path": "/Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/activities"
}
```

## Workflow Sequence

### Phase 1: Data Preparation (Data-Prep Agent)
1. Load athlete profile JSON
2. Verify data paths exist
3. Create parquet cache from activities CSV
4. Organize FIT files by activity type and date
5. Validate data quality

### Phase 2: Performance Analysis (Analysis Agent)
1. Analyze performance metrics (recent vs previous period)
2. Analyze time-in-zones from FIT files
3. Extract key insights and trends

### Phase 3: Training Planning (Planning Agent)
1. Generate periodized training plan based on:
   - Current FTP
   - Training availability
   - Goals
   - Age-appropriate recovery

### Phase 4: Report Generation (Reporting Agent)
1. Create HTML report suite:
   - `index.html` - Executive summary
   - `coaching_report.html` - Detailed analysis
   - `performance_dashboard.html` - Metrics deep dive
2. Embed all analysis data
3. Include coaching insights

### Phase 5: Orchestration (Coach Agent)
- Coordinates all phases
- Validates prerequisites
- Ensures proper data flow
- Provides strategic synthesis

## MCP Integration Rules

**Critical:** All MCP tools return `{"result": "data"}` structure.

Before passing data between agents:
```python
# ❌ WRONG
analysis = tool_call(...)
next_agent.process(analysis)  # Passes dict

# ✅ CORRECT
analysis = tool_call(...)
next_agent.process(analysis["result"])  # Extract string
```

## Success Criteria

- ✅ Single command generates complete HTML report suite
- ✅ No user interaction required during generation
- ✅ Existing chat command continues to work unchanged
- ✅ All 5 agent workflows properly orchestrated
- ✅ Data flows correctly between agents
- ✅ Reports include all analysis, zones, and training plan
- ✅ Professional HTML output with embedded data
