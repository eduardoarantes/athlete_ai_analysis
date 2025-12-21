# Training Plan Generation Flow

This document explains the complete execution path and all configuration options for training plan generation, from the web UI through to the Python backend.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WEB UI (Next.js)                                  │
│  create-plan/page.tsx (4-step wizard)                               │
└─────────────────────┬───────────────────────────────────────────────┘
                      │ POST /api/coach/plan/generate
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│          Next.js Service Layer                                       │
│  CyclingCoachService.generateTrainingPlan()                         │
└─────────────────────┬───────────────────────────────────────────────┘
                      │ POST /api/v1/plan/generate
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│           Python FastAPI Backend                                     │
│  AIPlanService.generate_plan()                                      │
│  ├─ Library-based (hybrid)  OR  Full LLM generation                │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│           Training Plan Tools                                        │
│  PlanOverviewTool → AddWeekDetailsTool → FinalizePlanTool          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Web UI (Next.js)

### Entry Point
**File:** `web/app/(dashboard)/coach/create-plan/page.tsx`

### Wizard Steps

The create plan wizard has 4 steps:

| Step | Component | Data Collected |
|------|-----------|----------------|
| 1. Goal | `goal-step.tsx` | Training goal (e.g., "Improve FTP", "Complete century") |
| 2. Timeline | `timeline-step.tsx` | Has event? Event date? Or number of weeks |
| 3. Profile | `profile-step.tsx` | FTP, weight, max HR, age, weekly hours, experience, training days |
| 4. Review | `review-step.tsx` | Confirmation before generation |

### Data Structure

```typescript
interface WizardData {
  goal?: string
  timeline?: {
    hasEvent: boolean
    eventDate?: string
    eventType?: string
    weeks?: number
  }
  profile?: {
    ftp: number
    weight: number
    maxHR: number
    age: number
    weeklyHours: string        // "5-7", "8-10", etc.
    experienceLevel: string    // "beginner", "intermediate", "advanced"
    trainingDays: string[]     // ["monday", "tuesday", ...]
  }
}
```

### API Calls During Wizard

| Endpoint | Purpose |
|----------|---------|
| `GET /api/coach/wizard/initialize` | Load existing athlete profile |
| `GET /api/coach/wizard/session` | Resume saved wizard state |
| `POST /api/coach/wizard/session` | Auto-save wizard progress |
| `POST /api/coach/wizard/suggest` | Get AI suggestions per step |
| `POST /api/coach/wizard/validate` | Validate current step before proceeding |
| **`POST /api/coach/plan/generate`** | **Trigger plan generation** |
| `DELETE /api/coach/wizard/session` | Clear session after generation |

### Generation Trigger

When the user clicks "Generate Plan" on the review step:

```typescript
// web/app/(dashboard)/coach/create-plan/page.tsx (Line 211-236)
const handleGeneratePlan = async () => {
  const response = await fetch('/api/coach/plan/generate', {
    method: 'POST',
    body: JSON.stringify({
      goal: wizardData.goal,
      timeline: wizardData.timeline,
      profile: wizardData.profile,
    }),
  })
  const { jobId } = await response.json()
  router.push(`/coach/plan/status/${jobId}`)
}
```

---

## Layer 2: Next.js Service Layer

### File: `web/lib/services/cycling-coach-service.ts`

### Main Method: `generateTrainingPlan()`

```typescript
async generateTrainingPlan(
  userId: string,
  params: TrainingPlanParams
): Promise<{ jobId: string }>
```

### Execution Flow

1. **Generate job ID:** `plan_${Date.now()}_${userId.slice(0, 8)}`
2. **Export data files:**
   - Activities → CSV file
   - Athlete profile → JSON file
3. **Create job record** in Supabase `plan_generation_jobs` table
4. **Call Python API** via `invokePythonApi()`
5. **Start background polling** via `pollForCompletion()`
6. **Return job ID** immediately to the UI

### Data Transformation

The service transforms wizard data to Python API format:

```typescript
const response = await invokePythonApi<{ job_id: string }>({
  method: 'POST',
  path: '/api/v1/plan/generate',
  body: {
    athlete_profile: {
      ftp: params.profile.ftp,
      weight_kg: params.profile.weight,
      max_hr: params.profile.maxHR || null,
      age: params.profile.age || null,
      goals: [params.goal],
      experience_level: params.profile.experienceLevel,
      weekly_hours_available: parseFloat(params.profile.weeklyHours),
      training_availability: {
        hours_per_week: parseFloat(params.profile.weeklyHours),
        week_days: trainingDaysFormatted,
      },
    },
    weeks: weeks,
    target_ftp: params.profile.ftp * 1.05, // 5% improvement
  },
})
```

### Background Polling

```typescript
// Polls every 5 seconds until complete
async pollForCompletion(dbJobId: string, apiJobId: string, ...): Promise<void> {
  while (true) {
    const status = await fetch(`/api/v1/plan/status/${apiJobId}`)
    if (status.status === 'completed') {
      // Save plan to Supabase training_plans table
      // Update job status
      break
    }
    await sleep(5000)
  }
}
```

---

## Layer 3: Python FastAPI Backend

### File: `src/cycling_ai/api/routers/plan.py`

### Endpoint: `POST /api/v1/plan/generate`

```python
@router.post("/generate", response_model=JobStatusResponse)
async def generate_plan(
    request: TrainingPlanRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    use_ai: bool = Query(default=True),  # Toggle AI vs skeleton
) -> JobStatusResponse:
```

### Request Model

```python
class TrainingPlanRequest(BaseModel):
    athlete_profile: AthleteProfileData
    weeks: int  # 4-24
    target_ftp: float | None
```

### Response

```python
class JobStatusResponse(BaseModel):
    job_id: str    # "plan_1734376800_a1b2c3d4"
    status: str    # "queued"
    message: str
```

### Background Task Execution

```python
# Queued as background task (returns 202 Accepted immediately)
background_tasks.add_task(
    _execute_plan_generation,
    job_id=job_id,
    request=request,
    use_ai=use_ai,
)
```

---

## Layer 4: AI Plan Service

### File: `src/cycling_ai/api/services/ai_plan_service.py`

### Two Generation Strategies

The `workout_source` configuration determines which strategy is used:

| Strategy | Config Value | Description |
|----------|--------------|-------------|
| **Library-based (Hybrid)** | `workout_source="library"` | LLM generates structure, library provides workouts |
| **Full LLM** | `workout_source="llm"` | LLM generates everything |

---

### Strategy A: Library-Based (Default, Recommended)

**Method:** `_generate_plan_with_library()`

**3-Step Process:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: LLM generates weekly overview                          │
│  Tool: PlanOverviewTool                                         │
│  Output: /tmp/{plan_id}_overview.json                           │
│  Tokens: ~1,000                                                 │
└─────────────────────┬───────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Library selects workouts                               │
│  Class: LibraryBasedTrainingPlanningWeeks                       │
│  Tool: AddWeekDetailsTool (per week)                            │
│  Output: /tmp/{plan_id}_week_{n}.json                           │
│  Tokens: 0 (no LLM)                                             │
└─────────────────────┬───────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: Finalize plan                                          │
│  Tool: FinalizePlanTool                                         │
│  Output: /tmp/{plan_id}_plan.json                               │
└─────────────────────────────────────────────────────────────────┘
```

**Benefits:**
- **Speed:** 1-2 minutes
- **Cost:** ~1,000 tokens (~$0.01)
- **Quality:** Proven library workouts
- **Consistency:** Same structure produces same workouts

---

### Strategy B: Full LLM Generation

**Method:** `_generate_plan_with_llm()`

**Process:**

1. Calculate power zones from athlete's FTP
2. Build system prompt with training guidelines
3. Build user message with athlete context
4. Call LLM provider for complete plan
5. Parse and validate JSON response

**Characteristics:**
- **Speed:** 2-5 minutes
- **Cost:** 20,000-30,000 tokens (~$0.25-0.40)
- **Quality:** Fully customized to athlete
- **Variability:** Each generation is unique

---

## Layer 5: Training Plan Tools

### Tool 1: PlanOverviewTool

**File:** `src/cycling_ai/tools/wrappers/plan_overview_tool.py`

**Purpose:** Generate high-level plan structure

**Parameters:**
```python
athlete_profile_json: str   # Path to profile JSON
total_weeks: int            # Plan duration (4-24)
target_ftp: float           # Goal FTP
weekly_overview: list       # Week structures (LLM generates)
coaching_notes: str         # Strategy notes (200-400 words)
monitoring_guidance: str    # KPIs to track
```

**Validation Rules:**
- All 7 weekdays present per week
- No more than 5 training days (minimum 2 rest days)
- No more than 3 hard days per week (threshold/VO2max/sweetspot)
- Valid workout types only

**Valid Workout Types:**
`rest`, `recovery`, `endurance`, `tempo`, `sweetspot`, `threshold`, `vo2max`, `mixed`, `strength`

**Output:** `/tmp/{plan_id}_overview.json`

---

### Tool 2: AddWeekDetailsTool

**File:** `src/cycling_ai/tools/wrappers/add_week_tool.py`

**Purpose:** Add detailed workouts for a specific week

**Parameters:**
```python
plan_id: str           # From PlanOverviewTool
week_number: int       # Week 1 to total_weeks
workouts: list         # Array of workout objects
```

**Workout Structure:**
```python
{
    "weekday": "Monday",
    "name": "Endurance Base",
    "type": "endurance",
    "description": "Build aerobic base",
    "duration_min": 90,
    "tss": 75,
    "segments": [
        {
            "type": "warmup",
            "duration_min": 10,
            "power_low_pct": 50,
            "power_high_pct": 75,
            "description": "Easy spin"
        },
        {
            "type": "steady",
            "duration_min": 70,
            "power_low_pct": 65,
            "power_high_pct": 75,
            "description": "Zone 2 endurance"
        },
        {
            "type": "cooldown",
            "duration_min": 10,
            "power_low_pct": 40,
            "power_high_pct": 55,
            "description": "Cool down"
        }
    ]
}
```

**Validation:**
- All 7 weekdays present
- Workouts only on designated training days
- Time budget validation (±20% tolerance)
- Segments sum to total duration

**Auto-Fix Features:**
- Removes warmup/cooldown from endurance rides if over time
- Reduces endurance segment durations in 15-min increments
- Minimum 60 minutes enforced

**Output:** `/tmp/{plan_id}_week_{week_number}.json`

**Source Tracking:**
```python
# Library-sourced workouts:
workout["source"] = "library"
workout["library_workout_id"] = "endurance_base_90"

# LLM-generated workouts:
workout["source"] = "llm"
```

---

### Tool 3: FinalizePlanTool

**Purpose:** Assemble all weeks into final plan

**Process:**
1. Load all week files
2. Merge into complete plan structure
3. Validate plan integrity
4. Save final output

**Output:** `/tmp/{plan_id}_plan.json`

---

## Configuration Options

### File: `src/cycling_ai/api/config.py`

```python
class APISettings(BaseSettings):
    # AI Provider Selection
    ai_provider: str = "anthropic"  # anthropic, openai, gemini, ollama
    ai_model: str | None = None     # Provider-specific model
    ai_max_tokens: int = 16384
    ai_temperature: float = 0.7

    # Workout Source
    workout_source: str = "llm"     # "library" or "llm"

    # Provider API Keys
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    google_api_key: str | None = None
    ollama_base_url: str = "http://localhost:11434"
```

### Supported Providers

| Provider | Model | Quality | Speed | Cost |
|----------|-------|---------|-------|------|
| **Anthropic** | claude-sonnet-4-20250514 | Excellent | Fast | Medium |
| **OpenAI** | gpt-4o | Excellent | Fast | High |
| **Google Gemini** | gemini-2.0-flash | Good | Fast | Low |
| **Ollama** | llama3.1:8b | Good | Slow | Free |

### Environment Variables

```bash
# Required for cloud providers
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GOOGLE_API_KEY="..."

# Configuration overrides
export AI_PROVIDER="anthropic"
export WORKOUT_SOURCE="library"
```

---

## Output Structure

### Final Training Plan JSON

```json
{
  "training_plan": {
    "plan_id": "uuid",
    "athlete_profile": {
      "ftp": 265,
      "weight_kg": 70,
      "max_hr": 186,
      "goals": ["Improve FTP"]
    },
    "plan_metadata": {
      "total_weeks": 12,
      "target_ftp": 278,
      "start_date": null,
      "coaching_notes": "Progressive overload plan..."
    },
    "weekly_plan": [
      {
        "week_number": 1,
        "week_type": "base",
        "focus": "Build aerobic foundation",
        "target_hours": 8,
        "target_tss": 400,
        "workouts": [...]
      }
    ]
  },
  "ai_metadata": {
    "ai_provider": "anthropic",
    "ai_model": "claude-sonnet-4-20250514",
    "workout_source": "library",
    "library_version": "1.0.0",
    "generated_at": "2024-12-22T10:30:00Z"
  }
}
```

---

## Database Storage

### Tables

**`plan_generation_jobs`** - Tracks generation progress
```sql
id, user_id, api_job_id, status, created_at, completed_at, error_message
```

**`training_plans`** - Stores completed plans (as templates)
```sql
id, user_id, name, plan_data (JSONB), metadata (JSONB), status, created_at
```

**`plan_instances`** - Scheduled instances of plans
```sql
id, user_id, template_id, start_date, end_date, status, created_at
```

---

## Key Files Reference

| Layer | File | Purpose |
|-------|------|---------|
| UI | `web/app/(dashboard)/coach/create-plan/page.tsx` | Wizard orchestrator |
| Service | `web/lib/services/cycling-coach-service.ts` | Plan generation + polling |
| API | `src/cycling_ai/api/routers/plan.py` | FastAPI endpoint |
| AI Service | `src/cycling_ai/api/services/ai_plan_service.py` | Strategy selection |
| Tool | `src/cycling_ai/tools/wrappers/plan_overview_tool.py` | Phase 3a |
| Tool | `src/cycling_ai/tools/wrappers/add_week_tool.py` | Phase 3b |
| Library | `src/cycling_ai/orchestration/phases/training_planning_library.py` | Library selection |
| Config | `src/cycling_ai/api/config.py` | Settings |

---

## Performance Comparison

| Metric | Library-Based | Full LLM |
|--------|---------------|----------|
| **Time** | 1-2 minutes | 2-5 minutes |
| **Tokens** | ~1,000 | 20,000-30,000 |
| **Cost** | ~$0.01 | ~$0.25-0.40 |
| **Customization** | Structured | Fully custom |
| **Consistency** | High | Variable |
| **Quality** | Proven workouts | Athlete-specific |

---

## Troubleshooting

### Common Issues

1. **Plan generation stuck at "queued"**
   - Check Python API logs: `tail -f logs/api.log`
   - Verify API key is set for selected provider

2. **Validation errors in workouts**
   - Check week structure has all 7 days
   - Verify training days match profile
   - Check time budget within tolerance

3. **Empty or malformed plan**
   - Verify LLM model size (need 8B+ parameters)
   - Check response parsing in `_parse_plan_response()`

### Debug Commands

```bash
# Check job status directly
curl http://localhost:8000/api/v1/plan/status/{job_id}

# View plan files
ls -la /tmp/plan_*

# Check API logs
tail -f ~/.cycling-ai/logs/api.log
```
