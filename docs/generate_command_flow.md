# Generate Command Flow

This document describes the complete execution flow when calling the `cycling-ai generate` command.

## Overview

The `generate` command orchestrates a multi-agent workflow to analyze cycling data and produce comprehensive HTML reports. The workflow consists of 4 sequential phases, each handled by a specialized LLM agent.

## Execution Steps

### 1. CLI Entry Point
**Location**: `src/cycling_ai/cli/main.py:54-60`

- Command parsed by Click framework
- Calls `generate()` function with parsed arguments

### 2. Generate Command Initialization
**Location**: `src/cycling_ai/cli/commands/generate.py:210-254`

#### Display Header (210-220)
- Shows banner with Rich formatting
- "Multi-Agent Report Generator" title

#### Validate Output Directory (223)
- Checks if output directory exists or can be created
- Verifies write permissions

#### Load Configuration (226-233)
- Attempts to load from `~/.cycling-ai/config.yaml`
- Falls back to environment variables if config not found
- Continues with defaults on failure (non-fatal)

#### Initialize LLM Provider (236-246)
**Implementation**: `generate.py:325-413`

- Determines provider and model:
  - From `--provider` and `--model` CLI flags
  - From config file
  - From default values
- Gets API key:
  - From config file
  - From environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.)
  - Validates key exists (except for Ollama)
- Creates `ProviderConfig` instance
- Calls `ProviderFactory.create_provider()` to instantiate provider

#### Initialize Prompts Manager (248-254)
- Loads custom prompts from `--prompts-dir` if provided
- Otherwise uses embedded default prompts from package

### 3. Workflow Configuration
**Location**: `generate.py:256-276`

#### Create WorkflowConfig (257-265)
- `csv_file_path`: Strava activities CSV
- `athlete_profile_path`: Athlete profile JSON
- `fit_dir_path`: Optional FIT files directory
- `output_dir`: Report output directory
- `period_months`: Analysis period (default: 6)
- `generate_training_plan`: Whether to run Phase 3 (default: true)
- `training_plan_weeks`: Training plan duration (default: 12)

#### Validate Configuration (268-273)
- CSV file exists
- Profile JSON exists
- FIT directory exists (if provided)
- `period_months` between 1-24
- `training_plan_weeks` between 1-52
- Raises `ValueError` on failure with helpful error message

#### Display Configuration Summary (276, 416-442)
- Shows table with all workflow parameters
- Confirms inputs before execution

### 4. Initialize Multi-Agent Orchestrator
**Location**: `generate.py:279-286`

#### Create Phase Progress Tracker (280)
- Tracks status of 4 workflow phases
- Provides Rich table for live UI updates

#### Create MultiAgentOrchestrator (282-286)
- Provider instance
- Prompts manager
- Progress callback function for UI updates

### 5. Execute Workflow with Live Progress
**Location**: `generate.py:288-302`

- Starts Rich `Live` display showing phase status table (293)
- Calls `orchestrator.execute_workflow(config)` (294)
- Handles `KeyboardInterrupt` for graceful cancellation (295-298)
- Catches and displays execution errors (299-302)

### 6. Multi-Agent Workflow Execution
**Location**: `src/cycling_ai/orchestration/multi_agent.py:550-649`

The orchestrator executes 4 sequential phases, each with isolated sessions but shared data.

#### Phase 1: Data Preparation
**Location**: `multi_agent.py:578-586`, Implementation: `multi_agent.py:438-465`

**Purpose**: Validate input files and prepare data cache

**Process**:
1. Create isolated `ConversationSession` (382-387)
   - Provider name, model, and system prompt
   - Phase context with file paths
2. Create `LLMAgent` with system prompt (390-394)
3. Send user message requesting data validation (397)
4. Agent executes tool loop (details in section 7)
5. Extract structured data from tool results (400)
   - Looks for `validate_data_files` and `prepare_cache` tool results
6. Return `PhaseResult` with:
   - Status (COMPLETED/FAILED)
   - Agent response text
   - Extracted data dictionary
   - Execution time and token count (407-418)

**Available Tools**:
- `validate_data_files`
- `prepare_cache`

**Extracted Data**:
- Validation results
- Cache metadata

#### Phase 2: Performance Analysis
**Location**: `multi_agent.py:588-596`, Implementation: `multi_agent.py:467-491`

**Purpose**: Analyze performance metrics and zone distribution

**Process**:
1. Uses Phase 1 extracted data as phase context (489)
2. Same agent loop pattern as Phase 1
3. Agent calls performance analysis tools
4. Extracts performance and zones data (290-296)

**Available Tools**:
- `analyze_performance`
- `analyze_time_in_zones`

**Extracted Data**:
- `performance_data`: Performance comparison results
- `zones_data`: Time in zones analysis

#### Phase 3: Training Planning (Optional)
**Location**: `multi_agent.py:598-615`, Implementation: `multi_agent.py:493-517`

**Purpose**: Generate personalized training plan

**Process**:
1. **Skipped** if `--skip-training-plan` flag used (599)
2. Uses Phase 2 data as context (490)
3. Agent calls training plan generation tool
4. If fails, marks as SKIPPED (non-fatal) (605-606)
5. Training plan failure doesn't stop workflow

**Available Tools**:
- `generate_training_plan`

**Extracted Data**:
- `training_plan`: Generated training plan structure

#### Phase 4: Report Generation
**Location**: `multi_agent.py:617-625`, Implementation: `multi_agent.py:519-548`

**Purpose**: Generate HTML reports from all collected data

**Process**:
1. Combines data from all previous phases (533-535)
   - Performance data from Phase 2
   - Zones data from Phase 2
   - Training plan from Phase 3 (if generated)
2. Agent calls report generation tool
3. Creates HTML files in output directory
4. Extracts output file paths (632-642)
5. Validates files actually exist on disk

**Available Tools**:
- `generate_report`

**Extracted Data**:
- `output_files`: List of generated report file paths

### 7. LLM Agent Loop (Each Phase)
**Location**: `src/cycling_ai/orchestration/agent.py:53-124`

Each phase executes the same agent loop pattern:

#### Loop Structure (Max 10 iterations)

**Iteration Process**:
1. **Add user message to session** (67-69)
2. **Get available tools** from registry (72)
3. **Start iteration loop** (75-76)
4. **Format messages for LLM** (79-82)
   - Convert session messages to `ProviderMessage` format
5. **Send to LLM** (85-88)
   - Messages + available tools → `provider.create_completion()`
6. **Check response for tool calls** (91)

   **If tool calls present** (91-112):
   - Execute each tool via `ToolExecutor` (93, 126-148)
   - Add assistant message with tool calls to session (96-102)
   - Add tool results as separate messages (104-109)
   - **Continue loop** to let LLM process results (112)

   **If no tool calls** (114-119):
   - Add assistant message to session (115-116)
   - **Break loop** - return final response (119)

7. **If max iterations exceeded** (121-124)
   - Raise `RuntimeError` - agent stuck in loop

#### Tool Execution Details
**Location**: `agent.py:126-148`

For each tool call from LLM:
1. Extract tool name and parameters (141-142)
2. Call `executor.execute_tool(name, params)` (145)
3. Return `ToolExecutionResult` with:
   - `success`: boolean
   - `data`: result data (dict, list, string, etc.)
   - `format`: "json", "markdown", "text", or "html"
   - `errors`: list of error messages if failed

#### Tool Result Formatting
**Location**: `agent.py:180-221`

Tool results are formatted as conversation messages:
- **Success**: JSON stringified or raw data depending on format
- **Failure**: Error message string
- Includes metadata: tool_call_id, tool_name, success flag

### 8. Display Results
**Location**: `generate.py:304-311`

#### Success Path (307-308, 445-482)
- Shows green success panel
- Displays execution summary table:
  - Total execution time
  - Total tokens used
  - Phases completed count
- Lists generated HTML report files
- Shows file paths with checkmarks
- Instructions to open reports in browser

#### Failure Path (309-311, 492-518)
- Shows red failure panel
- Identifies failed phase
- Lists error messages
- Shows troubleshooting guidance
- Exits with `click.Abort()`

### 9. Output Files Generated

Reports are saved in the specified `--output-dir` (default: `./reports`):

- **`index.html`**: Executive summary and navigation
- **`coaching_insights.html`**: Detailed analysis and recommendations
- **`performance_dashboard.html`**: Visual data dashboard with charts

## Key Technical Details

### Session Isolation
**Location**: `multi_agent.py:382-387`

Each phase gets its own `ConversationSession` to prevent context leakage:
- Fresh message history per phase
- Isolated system prompt per agent
- No cross-contamination of tool results

### Data Handoff Between Phases
**Location**: `multi_agent.py:357, 489-490`

Structured data flows between phases via `phase_context`:
- Phase 1 → Phase 2: Validation results, cache info
- Phase 2 → Phase 3: Performance metrics, zones data
- Phases 1-3 → Phase 4: Combined data for report generation

### Data Extraction
**Location**: `multi_agent.py:259-309`

After each phase, the orchestrator:
1. Scans session messages for tool results
2. Parses JSON from successful tool calls
3. Extracts specific data based on tool name
4. Stores in phase result's `extracted_data` dict

### Progress Tracking
**Location**: `multi_agent.py:377-378, 416-417`

Callbacks update UI in real-time:
- `IN_PROGRESS`: When phase starts
- `COMPLETED`: When phase succeeds
- `FAILED`: When phase fails
- Rich Live display automatically refreshes

### Error Handling
**Location**: `multi_agent.py:421-436`

Phase failures are caught gracefully:
- Exception captured and logged in `PhaseResult.errors`
- Workflow stops on critical phase failure (Phases 1, 2, 4)
- Training plan failure (Phase 3) is non-fatal, marked as SKIPPED

### Token Estimation
**Location**: `multi_agent.py:311-324`

Rough approximation for cost tracking:
- 1 token ≈ 4 characters
- Sums all message content in session
- Used for budget and analytics

### Max Iterations Safety
**Location**: `agent.py:75-124`

Prevents infinite loops:
- Default: 10 iterations per phase
- Configurable via `WorkflowConfig.max_iterations_per_phase`
- Raises error if exceeded

## Architecture Patterns

### Sequential Multi-Agent Pipeline
Each agent is a specialist for its phase:
- **Phase 1 Agent**: Data validation expert
- **Phase 2 Agent**: Performance analysis expert
- **Phase 3 Agent**: Training planning expert
- **Phase 4 Agent**: Report generation expert

### Tool-Augmented LLM Pattern
Agents don't have direct code access:
- LLM decides which tools to call
- Tools execute with real data
- Results returned to LLM
- LLM interprets and provides insights

### Stateful Conversation Sessions
Each phase maintains conversation history:
- System prompt sets agent role
- User message provides task
- Tool calls and results accumulate
- Final response synthesizes findings

## File References

### Core Files
- CLI entry: `src/cycling_ai/cli/main.py`
- Generate command: `src/cycling_ai/cli/commands/generate.py`
- Multi-agent orchestrator: `src/cycling_ai/orchestration/multi_agent.py`
- LLM agent: `src/cycling_ai/orchestration/agent.py`
- Session management: `src/cycling_ai/orchestration/session.py`
- Tool executor: `src/cycling_ai/orchestration/executor.py`
- Provider factory: `src/cycling_ai/providers/factory.py`

### Supporting Files
- Prompts manager: `src/cycling_ai/orchestration/prompts.py`
- Tool registry: `src/cycling_ai/tools/base.py`
- Provider interfaces: `src/cycling_ai/providers/base.py`
- Configuration loader: `src/cycling_ai/config/loader.py`

## Example Command

```bash
cycling-ai generate \
  --csv data/activities.csv \
  --profile data/profile.json \
  --fit-dir data/fit_files \
  --output-dir ./my_reports \
  --period-months 6 \
  --training-plan-weeks 12 \
  --provider anthropic \
  --model claude-3-5-sonnet-20241022
```

## Troubleshooting

### Provider Initialization Fails
- Check API key environment variable is set
- Verify API key format is correct
- For Ollama: ensure server is running (`ollama serve`)

### Configuration Validation Fails
- Verify all input file paths exist
- Check file formats (CSV, JSON)
- Ensure FIT directory contains .fit files

### Phase Execution Fails
- Check logs for specific error messages
- Verify input data format matches expectations
- Ensure sufficient API rate limits/quota

### No Reports Generated
- Check output directory permissions
- Verify Phase 4 completed successfully
- Look for tool execution errors in logs
