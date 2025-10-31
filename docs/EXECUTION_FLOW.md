# Cycling-AI Generate Command Execution Flow

## Command: `cycling-ai generate`

Complete trace of what happens when you run the generate command, how models are called, and data flows through the system.

---

## 1. Entry Point: CLI Command

**File**: `src/cycling_ai/cli/commands/generate.py`

```bash
cycling-ai generate \
  --profile athlete.json \
  --fit-dir ./fit_files \
  --output-dir ./reports \
  --provider anthropic
```

### Command Processing (lines 186-355)

1. **Parse Arguments** (lines 186-197):
   - `csv_file`: Optional Strava CSV
   - `profile_file`: Required athlete profile JSON
   - `fit_dir`: Optional FIT files directory
   - `output_dir`: Where to save reports (default: `./reports`)
   - `period_months`: Analysis period (default: 6)
   - `training_plan_weeks`: Plan duration (default: 12)
   - `skip_training_plan`: Flag to skip training plan
   - `skip_data_prep`: Flag to use existing cache
   - `provider`: LLM provider (default: `anthropic`)
   - `model`: Specific model (optional)
   - `prompts_dir`: Custom prompts directory (optional)

2. **Validation** (lines 220-227):
   - Must provide either `--csv` or `--fit-dir` (or both)
   - Display mode message (CSV or FIT-only)

3. **Initialize Provider** (lines 264-273):
   ```python
   provider_instance = _initialize_provider(provider, model, config)
   # Returns: AnthropicProvider, OpenAIProvider, GeminiProvider, or OllamaProvider
   ```

4. **Initialize Prompts** (lines 276-282):
   ```python
   prompts_manager = AgentPromptsManager(prompts_dir=prompts_dir)
   # Loads prompts from prompts_dir or uses embedded defaults
   ```

5. **Create Workflow Config** (lines 284-295):
   ```python
   workflow_config = WorkflowConfig(
       csv_file_path=csv_file,
       athlete_profile_path=profile_file,
       fit_dir_path=fit_dir,
       output_dir=Path(output_dir),
       period_months=period_months,
       generate_training_plan=not skip_training_plan,
       training_plan_weeks=training_plan_weeks,
       fit_only_mode=csv_file is None,
       skip_data_prep=skip_data_prep,
   )
   ```

6. **Initialize Orchestrator** (lines 310-316):
   ```python
   orchestrator = MultiAgentOrchestrator(
       provider=provider_instance,
       prompts_manager=prompts_manager,
       progress_callback=phase_tracker.update_phase,
   )
   ```

7. **Execute Workflow** (line 326):
   ```python
   result = orchestrator.execute_workflow(workflow_config)
   ```

---

## 2. Orchestrator: Multi-Agent Workflow

**File**: `src/cycling_ai/orchestration/multi_agent.py`

### Workflow Execution (method: `execute_workflow`)

The orchestrator executes **4 sequential phases**:

```python
Phase 1: Data Preparation        → Prepare Parquet cache
Phase 2: Performance Analysis    → Analyze trends, FTP, fitness
Phase 3: Training Planning       → Design personalized plan (LLM-driven)
Phase 4: Report Data Preparation → Extract & format into report_data.json (deterministic)
```

**Note**: After Phase 4 completes, the CLI generates an HTML report using the template engine:
- **Phase 4**: Deterministic extraction from session log → `report_data.json`
- **CLI Post-Processing**: Template-based HTML generation from `report_data.json` → `performance_report.html`

This separation ensures all LLM work is complete before the deterministic template rendering.

### Phase 1: Data Preparation

**Skip Condition**: `config.skip_data_prep == True`

**Tools**: `["prepare_cache"]`

**What Happens**:
1. **Agent**: `data_preparation` agent
2. **Prompt**: `prompts/default/1.0/data_preparation.txt`
3. **User Message**: Built from `data_preparation_user.txt` template
4. **LLM Call #1**:
   ```
   System: "You are a data preparation specialist..."
   User: "Prepare the Parquet cache from FIT files at: /path/to/fit_files"
   Tools: [prepare_cache]
   ```
5. **Tool Execution**: `prepare_cache(fit_dir_path=...)`
   - Scans FIT directory
   - Parses FIT files using Java FIT parser
   - Creates Parquet cache with activity data
   - Returns cache path
6. **Extracted Data**:
   ```python
   {
       "cache_file_path": "/path/cache/activities_cache.parquet",
       "cache_metadata_path": "/path/cache/metadata.json",
       "athlete_profile_path": "/path/athlete.json"
   }
   ```

### Phase 2: Performance Analysis

**Tools**: `["analyze_performance", "analyze_time_in_zones"]`

**What Happens**:
1. **Agent**: `performance_analysis` agent
2. **Prompt**: `prompts/default/1.0/performance_analysis.txt`
3. **Context from Phase 1**:
   ```python
   {
       "cache_file_path": "...",
       "athlete_profile_path": "..."
   }
   ```
4. **User Message**: Built from `performance_analysis_user.txt` template
5. **LLM Call #2**:
   ```
   System: "You are an expert cycling coach and performance analyst..."
   User: "Analyze performance over 6 months using cache at: /path/cache"
   Tools: [analyze_performance, analyze_time_in_zones]
   Context: {cache_file_path, athlete_profile_path}
   ```
6. **Tool Executions**:
   - **LLM calls**: `analyze_performance(cache_path=..., period_months=6)`
     - Loads Parquet cache
     - Calculates power metrics, trends, fitness trajectory
     - Returns performance data JSON
   - **LLM calls**: `analyze_time_in_zones(activities_directory=..., athlete_ftp=260)`
     - Analyzes FIT files second-by-second
     - Calculates time in each power zone
     - Returns zone distribution JSON
7. **Extracted Data**:
   ```python
   {
       "performance_data": {
           "current_ftp": 260,
           "ftp_6mo_ago": 245,
           "trend": "improving",
           ...
       },
       "zones_data": {
           "z1_percent": 45.2,
           "z2_percent": 38.1,
           "z3_percent": 10.5,
           "z4_percent": 4.8,
           "z5_percent": 1.4,
           ...
       }
   }
   ```

### Phase 3: Training Planning (LLM-Driven!)

**Skip Condition**: `config.generate_training_plan == False`

**Tools**: `["calculate_power_zones", "create_workout", "finalize_training_plan"]`

**What Happens**:
1. **Agent**: `training_planning` agent (EXPERT CYCLING COACH)
2. **Prompt**: `prompts/default/1.0/training_planning.txt`
3. **Context from Phase 2**:
   ```python
   {
       "performance_data": {...},
       "zones_data": {...},
       "athlete_profile_path": "..."
   }
   ```
4. **User Message**: Built from `training_planning_user.txt` template
5. **LLM Call #3** (AUTONOMOUS COACH):
   ```
   System: "You are an expert cycling coach..."
   User: "Design a 12-week personalized training plan for this athlete"
   Tools: [calculate_power_zones, create_workout, finalize_training_plan]
   Context: {performance_data, zones_data, athlete_profile}
   ```

6. **LLM Workflow** (Multiple Tool Calls):

   **Step 1**: LLM analyzes athlete data
   ```
   "Eduardo's FTP improved from 245W to 260W over 6 months (+6.1%).
   His time-in-zones shows 83% easy/moderate and only 6% Z4/Z5.
   He has 4 available training days: Tue, Thu, Sat, Sun.
   I'll design a foundation-build-peak plan to develop threshold power..."
   ```

   **Step 2**: LLM calculates zones
   ```python
   # Tool Call 1
   calculate_power_zones(ftp=260)
   → Returns: {z1: {min: 0, max: 143}, z2: {145-195}, ...}
   ```

   **Step 3**: LLM designs workouts (one per call!)
   ```python
   # Tool Call 2
   create_workout(
       workout_name="Week 1 Tuesday - Threshold Development",
       description="Build FTP with sustained efforts",
       ftp=260,
       segments=[
           {"type": "warmup", "duration_min": 15, "power_low": 143, "power_high": 195, ...},
           {"type": "interval", "duration_min": 15, "power_low": 234, "power_high": 247, ...},
           {"type": "recovery", "duration_min": 5, "power_low": 143, "power_high": 143, ...},
           {"type": "interval", "duration_min": 15, "power_low": 234, "power_high": 247, ...},
           {"type": "cooldown", "duration_min": 10, "power_low": 143, "power_high": 120, ...}
       ]
   )
   → Returns: {name: "...", segments: [...], svg: "...", total_duration_min: 60}

   # Tool Call 3
   create_workout(...)  # Week 1 Thursday

   # Tool Call 4
   create_workout(...)  # Week 1 Saturday

   # ... (continues for all 12 weeks × 3-4 workouts = ~40 tool calls!)
   ```

   **Step 4**: LLM organizes plan
   ```python
   weekly_plan = [
       {
           "week_number": 1,
           "phase": "Foundation",
           "phase_rationale": "Building aerobic base while introducing threshold work...",
           "workouts": {
               "Tuesday": {workout from create_workout},
               "Thursday": {workout from create_workout},
               "Saturday": {workout from create_workout}
           },
           "weekly_focus": "Consistency and proper recovery",
           "weekly_watch_points": "Watch RPE on threshold intervals..."
       },
       # ... weeks 2-12
   ]
   ```

   **Step 5**: LLM finalizes plan
   ```python
   # Tool Call ~43
   finalize_training_plan(
       athlete_profile_json="/path/athlete.json",
       total_weeks=12,
       target_ftp=275,
       weekly_plan=[...],  # All 12 weeks
       coaching_notes="Based on your steady improvement trend and limited high-intensity exposure, this plan focuses on building threshold capacity while respecting your 4-day availability. The foundation phase establishes consistency, build phase adds VO2 work, and peak phase prepares for performance...",
       monitoring_guidance="Track RPE during threshold sessions. If consistently > 8/10, reduce intensity by 5%. Watch for accumulated fatigue signs: elevated RHR, poor sleep, decreased motivation. Include recovery weeks as scheduled..."
   )
   → Returns: Complete plan JSON
   ```

7. **Extracted Data**:
   ```python
   {
       "training_plan": {
           "athlete_profile": {...},
           "plan_metadata": {
               "total_weeks": 12,
               "current_ftp": 260,
               "target_ftp": 275,
               "plan_type": "LLM-designed personalized plan"
           },
           "coaching_notes": "...",
           "monitoring_guidance": "...",
           "weekly_plan": [...]
       }
   }
   ```

### Phase 4: Report Data Preparation

**Tools**: None (deterministic processing)

**What Happens**:
1. **Extract from Session Log**:
   - Reads LLM interaction log (JSONL file) from Phase 3
   - Parses training plan data designed by the LLM coach
   - Extracts athlete profile
2. **Create report_data.json**:
   ```python
   report_data = {
       "generator": {
           "tool": "cycling-ai",
           "version": "0.1.0",
           "timestamp": "2025-01-..."
       },
       "athletes": [
           {
               "id": "eduardo",
               "name": "Eduardo",
               "profile": {...},
               "training_plan": {
                   "weeks": [...],
                   "coaching_notes": "...",
                   "power_zones": {...},
                   ...
               }
           }
       ]
   }
   ```
3. **Copy HTML Viewer**:
   - Copies `templates/training_plan_viewer.html` to output directory
   - Static HTML that reads `report_data.json` for interactive viewing
4. **Pass Data to Phase 5**:
   - Includes `report_data` in `extracted_data` for Phase 5 to consume
5. **Output**:
   - `reports/report_data.json` (structured training plan data)
   - `reports/training_plan_viewer.html` (static viewer)

**Note**: This phase performs deterministic data extraction and structuring. No LLM calls are made.

### Phase 5: Report Generation

**Tools**: `["generate_report"]`

**What Happens**:
1. **Agent**: `report_generation` agent
2. **Prompt**: `prompts/default/1.0/report_generation.txt`
3. **Context from Phase 4**:
   ```python
   {
       "report_data": {
           "athletes": [...],
           "generator": {...}
       },
       # Also includes data from previous phases:
       "performance_data": {...},
       "zones_data": {...},
       "training_plan": {...}
   }
   ```
4. **LLM Call #4**:
   ```
   System: "You are a professional cycling coach and technical writer..."
   User: "Generate comprehensive HTML reports using the structured report_data"
   Tools: [generate_report]
   Context: {report_data from Phase 4, plus other phase data}
   ```
5. **Tool Execution**: `generate_report(...)`
   - LLM uses structured `report_data.json` format
   - LLM provides markdown content for reports
   - Tool converts to HTML with CSS styling
   - Saves multiple HTML files (index.html, coaching_insights.html, etc.)
6. **Output**:
   - HTML report files using structured data from Phase 4

**Note**: Phase 5 benefits from the clean, structured `report_data.json` created in Phase 4, allowing the LLM to generate more consistent and comprehensive reports.

---

## 3. Model Interaction Details

### How LLMs Are Called

**File**: `src/cycling_ai/providers/anthropic.py` (or other provider)

Each tool call goes through this flow:

```python
# 1. Prepare messages
messages = [
    {"role": "system", "content": system_prompt},
    {"role": "user", "content": user_message}
]

# 2. Prepare tools (function calling schema)
tools = [
    {
        "name": "calculate_power_zones",
        "description": "Calculate training zones...",
        "parameters": {...}
    },
    {
        "name": "create_workout",
        "description": "Create structured workout...",
        "parameters": {...}
    },
    ...
]

# 3. Call LLM API
response = anthropic.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=4096,
    temperature=0.7,
    messages=messages,
    tools=tools
)

# 4. Process response
if response.stop_reason == "tool_use":
    # LLM wants to call a tool
    tool_name = response.content[0].name
    tool_input = response.content[0].input

    # Execute tool
    result = tool_registry.execute(tool_name, **tool_input)

    # Add tool result to conversation
    messages.append({
        "role": "assistant",
        "content": response.content
    })
    messages.append({
        "role": "user",
        "content": [{"type": "tool_result", "tool_use_id": ..., "content": result}]
    })

    # Continue conversation (LLM can make more tool calls)
    response = anthropic.messages.create(...)
```

### Conversation Loop

The orchestrator maintains conversation state:

```python
session = ConversationSession()

# Initial message
session.add_message(role="system", content=system_prompt)
session.add_message(role="user", content=user_message)

# Iterative loop (max 5 iterations per phase)
for iteration in range(max_iterations):
    # Call LLM
    response = provider.send_message(session, tools=tools)

    # Add assistant response
    session.add_message(role="assistant", content=response.text, tool_calls=...)

    # If tool calls, execute them
    if response.tool_calls:
        for tool_call in response.tool_calls:
            result = execute_tool(tool_call.name, tool_call.arguments)
            session.add_message(role="tool", content=result, tool_call_id=...)
    else:
        # No more tool calls - LLM is done
        break
```

---

## 4. Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                     cycling-ai generate                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1: Data Preparation                                       │
│  ┌──────────────┐                                                │
│  │ LLM Call #1  │ → prepare_cache() → Parquet cache             │
│  └──────────────┘                                                │
│  Output: {cache_file_path, athlete_profile_path}                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 2: Performance Analysis                                   │
│  ┌──────────────┐                                                │
│  │ LLM Call #2  │ → analyze_performance() → Performance metrics │
│  │              │ → analyze_time_in_zones() → Zone distribution │
│  └──────────────┘                                                │
│  Output: {performance_data, zones_data}                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 3: Training Planning (LLM-DRIVEN!)                        │
│  ┌──────────────────────────────────────────────────────────────┐
│  │ LLM Call #3: "I'll analyze Eduardo's data and design a plan"│
│  └────┬─────────────────────────────────────────────────────────┘
│       │                                                           │
│       ├─→ Tool Call 1: calculate_power_zones(ftp=260)           │
│       │                                                           │
│       ├─→ Tool Call 2: create_workout("Week 1 Tue - Threshold") │
│       ├─→ Tool Call 3: create_workout("Week 1 Thu - Tempo")     │
│       ├─→ Tool Call 4: create_workout("Week 1 Sat - Endurance") │
│       │   ... (40+ tool calls for all workouts)                 │
│       │                                                           │
│       └─→ Tool Call N: finalize_training_plan(weekly_plan=[...])│
│                                                                   │
│  Output: {training_plan: {weekly_plan, coaching_notes, ...}}    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 4: Report Data Preparation (Deterministic)                │
│  - Extract training plan from session log (JSONL)                │
│  - Parse workout data and athlete profile from Phase 3           │
│  - Create report_data.json (structured format)                   │
│  - Copy training_plan_viewer.html (static viewer)                │
│  - Pass report_data to Phase 5 via extracted_data                │
│                                                                   │
│  Output: reports/report_data.json + reports/viewer.html         │
│          (Reliable, consistent structured data)                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 5: Report Generation (LLM)                                │
│  ┌──────────────────────────────────────────────────────────────┐
│  │ LLM Call #4: "Generate comprehensive HTML reports"          │
│  └────┬─────────────────────────────────────────────────────────┘
│       │                                                           │
│       └─→ Tool Call: generate_report(...)                       │
│           - LLM receives structured report_data from Phase 4     │
│           - LLM provides well-structured markdown content        │
│           - Tool converts to HTML with CSS styling               │
│           - Saves HTML files to output directory                 │
│                                                                   │
│  Output: HTML report files (uses structured data from Phase 4)   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Token Usage Example

For a typical 12-week plan:

| Phase | LLM Calls | Tools Called | Est. Tokens |
|-------|-----------|--------------|-------------|
| Phase 1 | 1 | prepare_cache | 2,000 |
| Phase 2 | 1 | analyze_performance, analyze_time_in_zones | 8,000 |
| Phase 3 | 1 (multi-turn) | calculate_power_zones (1×), create_workout (40×), finalize_training_plan (1×) | 45,000 |
| Phase 4 | 0 | (deterministic) | 0 |
| Phase 5 | 1 | generate_report | 5,000 |
| **Total** | **4** | **~44** | **~60,000** |

---

## 6. Output Files

After successful execution:

```
reports/
├── report_data.json              # Structured training plan data (Phase 4)
├── training_plan_viewer.html     # Static HTML viewer (Phase 4)
├── index.html                    # LLM-generated HTML (Phase 5, optional)
├── coaching_insights.html        # LLM-generated HTML (Phase 5, optional)
└── .sessions/
    └── 20250129_143022.jsonl    # LLM interaction log
```

**Primary Output**: `reports/report_data.json` + `reports/training_plan_viewer.html` (Phase 4)
**Secondary Output**: HTML files from Phase 5 (LLM-generated reports using Phase 4's structured data)

---

## Key Takeaways

1. **Entry**: `cycling-ai generate` command in `cli/commands/generate.py`
2. **Orchestration**: `MultiAgentOrchestrator` executes 5 sequential phases
3. **LLM Calls**: **4 total LLM calls** (Phases 1-3, 5), Phase 3 makes **~43 tool calls**
4. **Autonomy**: Phase 3 is fully LLM-driven - the AI coach designs the entire plan
5. **Logical Flow**:
   - **Phase 4**: Deterministic data preparation (structured JSON + static viewer)
   - **Phase 5**: LLM-generated HTML using Phase 4's structured data
6. **Token Usage**: ~60K tokens for complete 12-week personalized plan
