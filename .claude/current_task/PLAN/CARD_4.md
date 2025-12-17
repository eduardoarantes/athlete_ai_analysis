# CARD 4: Plan Router (API Endpoints)

**Status:** Pending
**Estimated Time:** 2 hours
**Dependencies:** CARD_3
**Assignee:** Implementation Agent

---

## Objective

Create FastAPI router with endpoints for training plan generation and job status retrieval.

---

## Tasks

### 1. Create `src/cycling_ai/api/routers/plan.py`

```python
"""
Training plan API router.

Provides endpoints for:
- POST /api/v1/plan/generate - Start plan generation job
- GET /api/v1/plan/status/{job_id} - Get job status
"""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi import status as http_status

from cycling_ai.api.dependencies import SettingsDep
from cycling_ai.api.models.common import JobStatus
from cycling_ai.api.models.plan import JobStatusResponse, TrainingPlanRequest
from cycling_ai.api.services.plan_service import PlanService

logger = logging.getLogger(__name__)

# Create router
router = APIRouter()

# Service instance (could be dependency-injected in future)
plan_service = PlanService()

# In-memory job storage (will be replaced with database in CARD_5)
_job_storage: dict[str, JobStatus] = {}


@router.post(
    "/generate",
    response_model=JobStatusResponse,
    status_code=http_status.HTTP_202_ACCEPTED,
    summary="Generate training plan",
    description="Start asynchronous training plan generation. Returns job ID for status polling.",
)
async def generate_plan(
    request: TrainingPlanRequest,
    background_tasks: BackgroundTasks,
    settings: SettingsDep,
) -> JobStatusResponse:
    """
    Generate training plan asynchronously.

    Args:
        request: Training plan request with athlete profile and parameters
        background_tasks: FastAPI background tasks manager
        settings: Application settings

    Returns:
        Job status response with job ID

    Raises:
        HTTPException: If validation fails
    """
    import time
    from uuid import uuid4

    # Generate job ID
    job_id = f"plan_{int(time.time())}_{uuid4().hex[:8]}"

    logger.info(f"Creating plan generation job: {job_id}")

    # Create initial job status
    job_status = JobStatus(
        job_id=job_id,
        status="queued",
        progress=None,
        result=None,
        error=None,
    )

    # Store job
    _job_storage[job_id] = job_status

    # Queue background task (actual implementation in CARD_5)
    background_tasks.add_task(_execute_plan_generation, job_id, request)

    return JobStatusResponse(
        job_id=job_id,
        status="queued",
        message="Training plan generation started. Poll /api/v1/plan/status/{job_id} for updates.",
    )


@router.get(
    "/status/{job_id}",
    response_model=JobStatus,
    summary="Get job status",
    description="Get current status of a plan generation job.",
)
async def get_job_status(job_id: str) -> JobStatus:
    """
    Get status of plan generation job.

    Args:
        job_id: Job identifier

    Returns:
        Job status with progress and result

    Raises:
        HTTPException: If job not found
    """
    logger.debug(f"Getting status for job: {job_id}")

    if job_id not in _job_storage:
        logger.warning(f"Job not found: {job_id}")
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Job not found: {job_id}",
        )

    return _job_storage[job_id]


async def _execute_plan_generation(job_id: str, request: TrainingPlanRequest) -> None:
    """
    Execute plan generation in background.

    This is a placeholder - full implementation in CARD_5.

    Args:
        job_id: Job identifier
        request: Training plan request
    """
    logger.info(f"Executing plan generation for job: {job_id}")

    # Update status to running
    _job_storage[job_id].status = "running"
    _job_storage[job_id].progress = {"phase": "Generating plan", "percentage": 50}

    try:
        # Call service
        response = plan_service.generate_plan(request)

        # Update status to completed
        _job_storage[job_id].status = "completed"
        _job_storage[job_id].progress = {"phase": "Complete", "percentage": 100}
        _job_storage[job_id].result = {
            "training_plan": response.training_plan,
            "metadata": response.metadata,
        }

        logger.info(f"Job completed successfully: {job_id}")

    except Exception as e:
        logger.error(f"Job failed: {job_id}, error: {str(e)}")

        # Update status to failed
        _job_storage[job_id].status = "failed"
        _job_storage[job_id].error = str(e)
```

### 2. Update `src/cycling_ai/api/main.py`

Add router to application:

```python
# After imports, add:
from cycling_ai.api.routers import plan

# After CORS middleware, add:
app.include_router(plan.router, prefix="/api/v1/plan", tags=["plan"])
```

### 3. Update `src/cycling_ai/api/routers/__init__.py`

```python
"""API routers."""
from . import plan

__all__ = ["plan"]
```

### 4. Create `tests/api/routers/test_plan.py`

```python
"""Tests for plan router."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from cycling_ai.api.main import app


@pytest.fixture
def client() -> TestClient:
    """Create test client."""
    return TestClient(app)


@pytest.fixture
def sample_plan_request() -> dict:
    """Create sample plan request."""
    return {
        "athlete_profile": {
            "ftp": 265,
            "weight_kg": 70,
            "max_hr": 186,
            "age": 35,
            "goals": ["Improve FTP"],
            "training_availability": {
                "hours_per_week": 7,
                "week_days": "Monday, Wednesday, Friday, Saturday, Sunday",
            },
        },
        "weeks": 12,
        "target_ftp": 278,
    }


def test_generate_plan_endpoint(client: TestClient, sample_plan_request: dict) -> None:
    """Test plan generation endpoint."""
    response = client.post("/api/v1/plan/generate", json=sample_plan_request)

    assert response.status_code == 202
    data = response.json()
    assert "job_id" in data
    assert data["status"] == "queued"
    assert "message" in data
    assert data["job_id"].startswith("plan_")


def test_generate_plan_invalid_request(client: TestClient) -> None:
    """Test plan generation with invalid request."""
    invalid_request = {
        "athlete_profile": {
            "ftp": -100,  # Invalid: must be positive
            "weight_kg": 70,
            "age": 35,
        },
        "weeks": 12,
    }

    response = client.post("/api/v1/plan/generate", json=invalid_request)

    assert response.status_code == 422  # Validation error


def test_get_job_status_not_found(client: TestClient) -> None:
    """Test getting status for non-existent job."""
    response = client.get("/api/v1/plan/status/nonexistent_job")

    assert response.status_code == 404


@pytest.mark.integration
def test_generate_plan_end_to_end(client: TestClient, sample_plan_request: dict) -> None:
    """
    Test plan generation end-to-end.

    This is an integration test that requires LLM API keys.
    """
    # Start job
    response = client.post("/api/v1/plan/generate", json=sample_plan_request)
    assert response.status_code == 202
    job_id = response.json()["job_id"]

    # Poll for completion (with timeout)
    import time
    max_wait = 120  # 2 minutes
    start_time = time.time()

    while time.time() - start_time < max_wait:
        status_response = client.get(f"/api/v1/plan/status/{job_id}")
        assert status_response.status_code == 200

        status_data = status_response.json()
        if status_data["status"] == "completed":
            assert "result" in status_data
            assert "training_plan" in status_data["result"]
            break
        elif status_data["status"] == "failed":
            pytest.fail(f"Job failed: {status_data.get('error')}")

        time.sleep(2)
    else:
        pytest.fail("Job did not complete within timeout")
```

---

## Verification Steps

### 1. Start API Server

```bash
./scripts/start_api.sh
```

### 2. Test Endpoints Manually

```bash
# Generate plan
curl -X POST http://localhost:8000/api/v1/plan/generate \
  -H "Content-Type: application/json" \
  -d '{
    "athlete_profile": {
      "ftp": 265,
      "weight_kg": 70,
      "age": 35,
      "goals": ["Improve FTP"]
    },
    "weeks": 12,
    "target_ftp": 278
  }'

# Response: {"job_id":"plan_1734376800_a1b2c3d4","status":"queued","message":"..."}

# Get job status
JOB_ID="plan_1734376800_a1b2c3d4"  # Use actual job ID from above
curl http://localhost:8000/api/v1/plan/status/$JOB_ID

# Response: {"job_id":"...","status":"running","progress":{...}}
```

### 3. Check API Documentation

```bash
open http://localhost:8000/docs
```

Should show:
- POST /api/v1/plan/generate
- GET /api/v1/plan/status/{job_id}

### 4. Run Tests

```bash
# Unit tests only
pytest tests/api/routers/test_plan.py -v -m "not integration"

# Integration tests (requires API keys)
export ANTHROPIC_API_KEY="your-key-here"
pytest tests/api/routers/test_plan.py -v -m integration
```

---

## Files Created

- `src/cycling_ai/api/routers/plan.py`
- `src/cycling_ai/api/routers/__init__.py`
- `tests/api/routers/__init__.py` (empty)
- `tests/api/routers/test_plan.py`

---

## Files Modified

- `src/cycling_ai/api/main.py` (add router)

---

## Acceptance Criteria

- [x] POST /generate endpoint works
- [x] GET /status/{job_id} endpoint works
- [x] Validation errors return 422
- [x] Not found returns 404
- [x] Background tasks execute
- [x] Tests pass
- [x] API docs show endpoints
- [x] Type checking passes

---

## Next Card

**CARD_5.md** - Implement background job system with database persistence
