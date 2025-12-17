# FastAPI Integration Layer - Implementation Plan

**Version:** 1.0
**Created:** 2025-12-16
**Status:** Ready for Execution
**Estimated Duration:** 3-4 days (8 implementation cards)

---

## Executive Summary

This plan creates a **FastAPI REST API layer** to wrap the existing Python cycling-ai backend services, enabling the Next.js web UI to communicate with the Python backend via HTTP instead of spawning CLI processes.

### Current Problem
The Next.js service (`web/lib/services/cycling-coach-service.ts`) spawns Python CLI processes directly:
```typescript
spawn('cycling-ai', ['plan', 'generate', '--profile', profilePath, '--weeks', weeks])
```

This causes errors like:
```
Usage: cycling-ai plan generate [OPTIONS]
Error: No such option: --weeks
```

### Solution
Create a FastAPI application that:
1. Exposes REST endpoints for training plan generation, analysis, and chat
2. Calls Python tools/services directly (NOT the CLI)
3. Supports async background job execution
4. Returns structured JSON responses
5. Maintains type safety with Pydantic models

### Key Benefits
- **No CLI parsing issues** - Direct Python function calls
- **Better error handling** - Structured JSON error responses
- **Type safety** - Pydantic request/response models
- **API-first design** - Clean separation between web UI and backend
- **Testable** - API endpoints can be tested independently
- **Scalable** - Can run as separate service, containerized, etc.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js Web UI                               │
│  /app/api/coach/plan/generate/route.ts                          │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTP POST /api/v1/plan/generate
                      v
┌─────────────────────────────────────────────────────────────────┐
│                  FastAPI Application                             │
│  src/cycling_ai/api/                                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ main.py - FastAPI app, CORS, middleware                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ routers/                                                  │  │
│  │   ├── plan.py - POST /api/v1/plan/generate               │  │
│  │   ├── chat.py - POST /api/v1/chat                        │  │
│  │   └── analysis.py - POST /api/v1/analysis                │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ models/ - Pydantic request/response models               │  │
│  │   ├── plan.py - TrainingPlanRequest, TrainingPlanResponse│  │
│  │   ├── chat.py - ChatRequest, ChatResponse                │  │
│  │   └── common.py - ErrorResponse, JobStatus               │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ services/ - Business logic layer                         │  │
│  │   ├── plan_service.py - Wraps TrainingPlanTool           │  │
│  │   ├── chat_service.py - Wraps conversational agent       │  │
│  │   └── background.py - Background job execution           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────────┘
                      │ Direct function calls
                      v
┌─────────────────────────────────────────────────────────────────┐
│         Existing cycling-ai Tools & Services                    │
│  src/cycling_ai/tools/wrappers/training_plan_tool.py           │
│  src/cycling_ai/core/training.py                               │
│  src/cycling_ai/orchestration/ (chat, multi-agent)             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
src/cycling_ai/
├── api/                          # NEW FastAPI application
│   ├── __init__.py
│   ├── main.py                   # FastAPI app entry point
│   ├── config.py                 # API configuration
│   ├── dependencies.py           # Dependency injection (auth, etc.)
│   ├── models/                   # Pydantic models
│   │   ├── __init__.py
│   │   ├── common.py            # Shared models (ErrorResponse, JobStatus)
│   │   ├── plan.py              # Plan generation models
│   │   ├── chat.py              # Chat models
│   │   └── analysis.py          # Analysis models
│   ├── routers/                  # API route handlers
│   │   ├── __init__.py
│   │   ├── plan.py              # /api/v1/plan/* endpoints
│   │   ├── chat.py              # /api/v1/chat endpoint
│   │   └── analysis.py          # /api/v1/analysis/* endpoints
│   └── services/                 # Business logic layer
│       ├── __init__.py
│       ├── plan_service.py      # Training plan generation logic
│       ├── chat_service.py      # Chat session management
│       ├── analysis_service.py  # Performance analysis logic
│       └── background.py        # Background job executor
│
├── tools/                        # EXISTING (no changes needed)
│   └── wrappers/
│       ├── training_plan_tool.py
│       └── performance.py
│
└── core/                         # EXISTING (no changes needed)
    ├── training.py
    ├── performance.py
    └── athlete.py
```

---

## Key Design Patterns

### 1. Tool Wrapper Pattern
The API services wrap existing tools without duplicating logic:

```python
# api/services/plan_service.py
from cycling_ai.tools.wrappers import TrainingPlanTool

class PlanService:
    def __init__(self):
        self.tool = TrainingPlanTool()

    async def generate_plan(self, request: TrainingPlanRequest) -> TrainingPlanResponse:
        # Convert API request to tool parameters
        result = self.tool.execute(
            athlete_profile_json=request.athlete_profile,
            total_weeks=request.weeks,
            target_ftp=request.target_ftp,
            ...
        )

        # Convert tool result to API response
        return TrainingPlanResponse(...)
```

### 2. Pydantic Models for Type Safety
All requests/responses use Pydantic models:

```python
# api/models/plan.py
from pydantic import BaseModel, Field

class TrainingPlanRequest(BaseModel):
    """Request model for plan generation."""
    athlete_profile: dict = Field(..., description="Athlete profile data")
    weeks: int = Field(..., ge=4, le=24, description="Plan duration in weeks")
    target_ftp: float | None = Field(None, description="Target FTP in watts")

    class Config:
        json_schema_extra = {
            "example": {
                "athlete_profile": {"ftp": 265, "weight_kg": 70, ...},
                "weeks": 12,
                "target_ftp": 278
            }
        }
```

### 3. Background Job Execution
Long-running operations return job IDs:

```python
# api/routers/plan.py
@router.post("/generate", response_model=JobStatusResponse)
async def generate_plan(
    request: TrainingPlanRequest,
    background_tasks: BackgroundTasks
):
    job_id = f"plan_{int(time.time())}_{uuid4().hex[:8]}"

    # Queue background task
    background_tasks.add_task(
        plan_service.execute_plan_generation,
        job_id=job_id,
        request=request
    )

    return JobStatusResponse(
        job_id=job_id,
        status="queued"
    )
```

### 4. Error Handling
Consistent error responses:

```python
# api/models/common.py
class ErrorResponse(BaseModel):
    error: str
    details: str | None = None
    validation_errors: list[str] | None = None

# Usage in routes:
raise HTTPException(
    status_code=400,
    detail=ErrorResponse(
        error="Invalid athlete profile",
        validation_errors=["FTP must be positive"]
    ).model_dump()
)
```

---

## Implementation Cards

The implementation is broken down into 8 sequential cards (see `/PLAN/CARD_*.md`):

1. **CARD_1.md** - FastAPI Project Setup
2. **CARD_2.md** - Pydantic Models (Request/Response)
3. **CARD_3.md** - Plan Service Layer
4. **CARD_4.md** - Plan Router (API Endpoints)
5. **CARD_5.md** - Background Job System
6. **CARD_6.md** - Update Next.js Service
7. **CARD_7.md** - Testing & Validation
8. **CARD_8.md** - Documentation & Deployment

---

## API Specification

### Core Endpoints

#### 1. Generate Training Plan
```
POST /api/v1/plan/generate
Content-Type: application/json

Request Body:
{
  "athlete_profile": {
    "ftp": 265,
    "weight_kg": 70,
    "max_hr": 186,
    "age": 35,
    "goals": ["Improve FTP"],
    "training_availability": {
      "hours_per_week": 7,
      "week_days": "Monday, Wednesday, Friday, Saturday, Sunday"
    }
  },
  "weeks": 12,
  "target_ftp": 278
}

Response (202 Accepted):
{
  "job_id": "plan_1734376800_a1b2c3d4",
  "status": "queued",
  "message": "Training plan generation started"
}
```

#### 2. Get Job Status
```
GET /api/v1/plan/status/{job_id}

Response (200 OK):
{
  "job_id": "plan_1734376800_a1b2c3d4",
  "status": "completed",  // queued | running | completed | failed
  "progress": {
    "phase": "Finalizing plan",
    "percentage": 100
  },
  "result": {
    "training_plan": {
      "total_weeks": 12,
      "target_ftp": 278,
      "weekly_plan": [...]
    }
  }
}
```

#### 3. Chat with AI Coach
```
POST /api/v1/chat
Content-Type: application/json

Request Body:
{
  "message": "How has my performance improved?",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",  // optional
  "context": {
    "athlete_profile": {...},
    "activities_csv": "base64_encoded_csv"  // optional
  }
}

Response (200 OK):
{
  "reply": "Based on your recent activities...",
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### 4. Performance Analysis
```
POST /api/v1/analysis/performance
Content-Type: application/json

Request Body:
{
  "activities_csv": "base64_encoded_csv",
  "athlete_profile": {...},
  "period_months": 6
}

Response (200 OK):
{
  "analysis": {
    "period": "2024-06-16 to 2024-12-16",
    "total_activities": 142,
    "metrics": {...},
    "trends": {...}
  }
}
```

---

## Integration with Next.js

### Before (Broken)
```typescript
// web/lib/services/cycling-coach-service.ts
const pythonProcess = spawn('cycling-ai', [
  'plan', 'generate',
  '--profile', profilePath,
  '--weeks', weeks,  // ERROR: --weeks option doesn't exist
])
```

### After (Working)
```typescript
// web/lib/services/cycling-coach-service.ts
const response = await fetch('http://localhost:8000/api/v1/plan/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    athlete_profile: athleteProfile,
    weeks: weeks,
    target_ftp: targetFtp
  })
})

const { job_id, status } = await response.json()
```

---

## Testing Strategy

### 1. Unit Tests (pytest)
Test services in isolation:

```python
# tests/api/services/test_plan_service.py
def test_generate_plan_success():
    service = PlanService()
    request = TrainingPlanRequest(
        athlete_profile={"ftp": 265, ...},
        weeks=12,
        target_ftp=278
    )

    result = await service.generate_plan(request)

    assert result.success
    assert result.training_plan is not None
```

### 2. Integration Tests (pytest + httpx)
Test API endpoints:

```python
# tests/api/test_plan_router.py
@pytest.mark.asyncio
async def test_plan_generate_endpoint(client: AsyncClient):
    response = await client.post(
        "/api/v1/plan/generate",
        json={
            "athlete_profile": {...},
            "weeks": 12,
            "target_ftp": 278
        }
    )

    assert response.status_code == 202
    data = response.json()
    assert "job_id" in data
    assert data["status"] == "queued"
```

### 3. End-to-End Tests
Test full flow from Next.js to API:

```typescript
// web/tests/integration/cycling-coach-api.spec.ts
test('generate training plan via API', async ({ page }) => {
  // Submit wizard
  await page.goto('/coach/wizard')
  await fillWizardSteps(page)

  // Should start job
  await page.waitForURL('/coach/plan/*')

  // Should show progress
  await expect(page.locator('[data-testid="job-status"]')).toContainText('running')

  // Should complete
  await expect(page.locator('[data-testid="job-status"]')).toContainText('completed', {
    timeout: 60000
  })
})
```

---

## Configuration

### Environment Variables
```bash
# API Server
FASTAPI_HOST=0.0.0.0
FASTAPI_PORT=8000
FASTAPI_RELOAD=true  # Development only

# CORS (for Next.js)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Job Storage (optional, defaults to in-memory)
JOB_STORAGE_PATH=/tmp/cycling-ai-jobs

# LLM Provider (for chat/plan generation)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Next.js Environment
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### FastAPI Configuration
```python
# src/cycling_ai/api/config.py
from pydantic_settings import BaseSettings

class APISettings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = False
    allowed_origins: list[str] = ["http://localhost:3000"]
    job_storage_path: str = "/tmp/cycling-ai-jobs"

    class Config:
        env_prefix = "FASTAPI_"
```

---

## Deployment Options

### Option 1: Standalone Process (Development)
```bash
# Terminal 1: FastAPI
cd /path/to/cycling-ai-analysis
uvicorn cycling_ai.api.main:app --reload --port 8000

# Terminal 2: Next.js
cd web
pnpm dev
```

### Option 2: Docker Compose (Production)
```yaml
# docker-compose.yml
services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}

  web:
    build: ./web
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://api:8000/api/v1
    depends_on:
      - api
```

### Option 3: Vercel + Separate API Server
- Deploy Next.js to Vercel
- Deploy FastAPI to Render/Railway/Fly.io
- Update `NEXT_PUBLIC_API_URL` to production API URL

---

## Dependencies

### New Dependencies (add to pyproject.toml)
```toml
[project.dependencies]
# Existing dependencies...
"fastapi>=0.109.0",
"uvicorn[standard]>=0.27.0",
"pydantic>=2.5.0",
"pydantic-settings>=2.1.0",
"python-multipart>=0.0.6",  # For file uploads

[project.optional-dependencies]
dev = [
    # Existing dev dependencies...
    "httpx>=0.26.0",  # For testing FastAPI
    "pytest-asyncio>=0.23.0",  # For async tests
]
```

### Next.js Changes
No new dependencies required - just update service to use `fetch()` instead of `spawn()`.

---

## Migration Strategy

### Phase 1: Add FastAPI (This Implementation)
- Create FastAPI application alongside CLI
- Both CLI and API work independently
- Next.js switches from CLI to API

### Phase 2: Deprecate Direct CLI Usage in Web Context
- CLI remains for command-line users
- Web UI only uses API
- Better separation of concerns

### Phase 3: Future Enhancements
- Add authentication/authorization to API
- Add rate limiting
- Add caching layer
- Add monitoring/observability

---

## Risk Mitigation

### Risk 1: Background Job State Management
**Mitigation:**
- Use Supabase `plan_generation_jobs` table for persistence
- Jobs survive API restarts
- Next.js can poll status even if API restarts

### Risk 2: Long-Running LLM Calls
**Mitigation:**
- Use FastAPI BackgroundTasks
- Set reasonable timeouts
- Provide progress updates
- Allow job cancellation

### Risk 3: Type Safety Between Systems
**Mitigation:**
- Pydantic models enforce types at API boundary
- TypeScript types in Next.js match API spec
- Integration tests verify compatibility

### Risk 4: CORS Issues in Production
**Mitigation:**
- Configure CORS properly in FastAPI
- Use environment-specific origins
- Test CORS in staging environment

---

## Success Criteria

Implementation is complete when:

1. ✅ FastAPI server starts without errors
2. ✅ All endpoints respond with correct status codes
3. ✅ Pydantic validation works (rejects invalid requests)
4. ✅ Training plan generation works end-to-end
5. ✅ Background jobs execute and update status
6. ✅ Next.js service successfully calls API (no more CLI spawning)
7. ✅ All tests pass (unit + integration)
8. ✅ Type checking passes (`mypy --strict`)
9. ✅ API documentation auto-generated (FastAPI /docs)
10. ✅ Error handling works (returns structured errors)

---

## Next Steps After Completion

After this implementation:

1. **Add Authentication** - JWT tokens, API keys
2. **Add Chat Endpoint** - Conversational AI coach
3. **Add Analysis Endpoints** - Performance analysis, zone analysis
4. **Add File Upload** - Direct FIT file upload
5. **Add Streaming** - Stream LLM responses for chat
6. **Add Webhooks** - Notify Next.js when jobs complete (instead of polling)

---

## References

- **FastAPI Documentation:** https://fastapi.tiangolo.com/
- **Pydantic Documentation:** https://docs.pydantic.dev/
- **Project CLAUDE.md:** See root directory for architecture patterns
- **Existing Tools:** `src/cycling_ai/tools/wrappers/`
- **Database Schema:** `web/supabase/migrations/20251215000003_create_coach_tables.sql`

---

## Code Review Checklist

Before marking this task complete:

- [ ] All code has type hints (`mypy --strict` passes)
- [ ] All new code has docstrings (Google style)
- [ ] Unit tests written for all services
- [ ] Integration tests written for all endpoints
- [ ] Error handling covers all edge cases
- [ ] Pydantic models have examples
- [ ] FastAPI routes have proper response models
- [ ] CORS configured correctly
- [ ] Environment variables documented
- [ ] API returns proper HTTP status codes
- [ ] Logging added for debugging
- [ ] No hardcoded values (use config)
- [ ] README updated with API usage instructions

---

**Document Status:** Ready for implementation execution
**Last Updated:** 2025-12-16
**Next Action:** Begin CARD_1 - FastAPI Project Setup
