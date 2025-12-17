# CARD 5: Background Job System with Database Persistence

**Status:** Pending
**Estimated Time:** 2 hours
**Dependencies:** CARD_4
**Assignee:** Implementation Agent

---

## Objective

Replace in-memory job storage with Supabase database persistence so jobs survive API restarts and can be polled by Next.js.

---

## Key Concept

The `plan_generation_jobs` table already exists in Supabase (created by migration `20251215000003_create_coach_tables.sql`). We just need to integrate it into the API.

---

## Tasks

### 1. Create `src/cycling_ai/api/services/job_storage.py`

```python
"""
Job storage service using Supabase.

Persists job status to database so jobs survive API restarts.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Any

from supabase import Client, create_client

from cycling_ai.api.models.common import JobStatus

logger = logging.getLogger(__name__)


class JobStorage:
    """
    Job storage service backed by Supabase.

    Manages job state in the plan_generation_jobs table.
    """

    def __init__(self) -> None:
        """Initialize Supabase client."""
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY")  # Service role key for backend

        if not supabase_url or not supabase_key:
            raise ValueError(
                "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set. "
                "These are required for job persistence."
            )

        self.client: Client = create_client(supabase_url, supabase_key)
        logger.info("JobStorage initialized with Supabase")

    async def create_job(
        self, job_id: str, user_id: str, params: dict[str, Any]
    ) -> JobStatus:
        """
        Create new job in database.

        Args:
            job_id: Unique job identifier
            user_id: User who created the job
            params: Job parameters (wizard data)

        Returns:
            Created job status
        """
        logger.info(f"Creating job: {job_id} for user: {user_id}")

        data = {
            "id": job_id,
            "user_id": user_id,
            "status": "queued",
            "params": params,
            "progress": None,
            "result": None,
            "error": None,
        }

        response = self.client.table("plan_generation_jobs").insert(data).execute()

        if not response.data:
            raise ValueError("Failed to create job in database")

        return self._row_to_job_status(response.data[0])

    async def get_job(self, job_id: str) -> JobStatus | None:
        """
        Get job status from database.

        Args:
            job_id: Job identifier

        Returns:
            Job status or None if not found
        """
        logger.debug(f"Getting job: {job_id}")

        response = (
            self.client.table("plan_generation_jobs")
            .select("*")
            .eq("id", job_id)
            .execute()
        )

        if not response.data:
            return None

        return self._row_to_job_status(response.data[0])

    async def update_job(
        self,
        job_id: str,
        status: str | None = None,
        progress: dict[str, Any] | None = None,
        result: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> JobStatus:
        """
        Update job status in database.

        Args:
            job_id: Job identifier
            status: New status (queued|running|completed|failed)
            progress: Progress information
            result: Job result (when completed)
            error: Error message (when failed)

        Returns:
            Updated job status
        """
        logger.debug(f"Updating job: {job_id}, status={status}")

        updates: dict[str, Any] = {}

        if status:
            updates["status"] = status
        if progress is not None:
            updates["progress"] = progress
        if result is not None:
            updates["result"] = result
        if error is not None:
            updates["error"] = error

        if not updates:
            raise ValueError("At least one field must be updated")

        response = (
            self.client.table("plan_generation_jobs")
            .update(updates)
            .eq("id", job_id)
            .execute()
        )

        if not response.data:
            raise ValueError(f"Job not found: {job_id}")

        return self._row_to_job_status(response.data[0])

    def _row_to_job_status(self, row: dict[str, Any]) -> JobStatus:
        """
        Convert database row to JobStatus model.

        Args:
            row: Database row

        Returns:
            JobStatus instance
        """
        return JobStatus(
            job_id=row["id"],
            status=row["status"],
            progress=row.get("progress"),
            result=row.get("result"),
            error=row.get("error"),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
        )


# Singleton instance
_job_storage: JobStorage | None = None


def get_job_storage() -> JobStorage:
    """Get or create JobStorage instance."""
    global _job_storage
    if _job_storage is None:
        _job_storage = JobStorage()
    return _job_storage
```

### 2. Update `src/cycling_ai/api/routers/plan.py`

Replace in-memory storage with database:

```python
# Remove: _job_storage: dict[str, JobStatus] = {}

# Add import:
from cycling_ai.api.services.job_storage import get_job_storage

# Update generate_plan function:
@router.post("/generate", ...)
async def generate_plan(...) -> JobStatusResponse:
    import time
    from uuid import uuid4

    job_id = f"plan_{int(time.time())}_{uuid4().hex[:8]}"
    logger.info(f"Creating plan generation job: {job_id}")

    # Get job storage
    job_storage = get_job_storage()

    # Create job in database (user_id from auth, for now use placeholder)
    user_id = "00000000-0000-0000-0000-000000000000"  # TODO: Get from auth
    await job_storage.create_job(
        job_id=job_id,
        user_id=user_id,
        params=request.model_dump()
    )

    # Queue background task
    background_tasks.add_task(_execute_plan_generation, job_id, request)

    return JobStatusResponse(...)

# Update get_job_status function:
@router.get("/status/{job_id}", ...)
async def get_job_status(job_id: str) -> JobStatus:
    logger.debug(f"Getting status for job: {job_id}")

    job_storage = get_job_storage()
    job_status = await job_storage.get_job(job_id)

    if not job_status:
        logger.warning(f"Job not found: {job_id}")
        raise HTTPException(...)

    return job_status

# Update _execute_plan_generation function:
async def _execute_plan_generation(job_id: str, request: TrainingPlanRequest) -> None:
    logger.info(f"Executing plan generation for job: {job_id}")
    job_storage = get_job_storage()

    # Update to running
    await job_storage.update_job(
        job_id=job_id,
        status="running",
        progress={"phase": "Generating plan", "percentage": 50}
    )

    try:
        response = plan_service.generate_plan(request)

        # Update to completed
        await job_storage.update_job(
            job_id=job_id,
            status="completed",
            progress={"phase": "Complete", "percentage": 100},
            result={"training_plan": response.training_plan, "metadata": response.metadata}
        )

        logger.info(f"Job completed successfully: {job_id}")

    except Exception as e:
        logger.error(f"Job failed: {job_id}, error: {str(e)}")

        # Update to failed
        await job_storage.update_job(
            job_id=job_id,
            status="failed",
            error=str(e)
        )
```

### 3. Update `pyproject.toml`

Add Supabase dependency:

```toml
[project.dependencies]
# Existing dependencies...
"supabase>=2.0.0",  # For job persistence
```

### 4. Create `.env.example`

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here

# FastAPI Configuration
FASTAPI_HOST=0.0.0.0
FASTAPI_PORT=8000
FASTAPI_RELOAD=true
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# LLM Provider
ANTHROPIC_API_KEY=sk-ant-...
```

### 5. Create `tests/api/services/test_job_storage.py`

```python
"""Tests for job storage service."""
from __future__ import annotations

import os

import pytest

from cycling_ai.api.services.job_storage import JobStorage


@pytest.fixture
def job_storage() -> JobStorage:
    """Create job storage instance."""
    # Requires SUPABASE_URL and SUPABASE_SERVICE_KEY to be set
    if not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_SERVICE_KEY"):
        pytest.skip("Supabase credentials not configured")

    return JobStorage()


@pytest.mark.asyncio
@pytest.mark.integration
async def test_create_job(job_storage: JobStorage) -> None:
    """Test creating a job."""
    job_status = await job_storage.create_job(
        job_id="test_123",
        user_id="user_123",
        params={"weeks": 12}
    )

    assert job_status.job_id == "test_123"
    assert job_status.status == "queued"


@pytest.mark.asyncio
@pytest.mark.integration
async def test_get_job(job_storage: JobStorage) -> None:
    """Test getting a job."""
    # Create job first
    await job_storage.create_job(
        job_id="test_456",
        user_id="user_123",
        params={"weeks": 12}
    )

    # Get it back
    job_status = await job_storage.get_job("test_456")

    assert job_status is not None
    assert job_status.job_id == "test_456"


@pytest.mark.asyncio
@pytest.mark.integration
async def test_update_job(job_storage: JobStorage) -> None:
    """Test updating a job."""
    # Create job first
    await job_storage.create_job(
        job_id="test_789",
        user_id="user_123",
        params={"weeks": 12}
    )

    # Update it
    updated = await job_storage.update_job(
        job_id="test_789",
        status="completed",
        result={"plan": "data"}
    )

    assert updated.status == "completed"
    assert updated.result is not None
```

---

## Verification Steps

### 1. Set Environment Variables

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_KEY="your-service-role-key"
export ANTHROPIC_API_KEY="sk-ant-..."
```

### 2. Install Dependencies

```bash
pip install -e ".[dev]"
```

### 3. Test Job Storage

```bash
pytest tests/api/services/test_job_storage.py -v -m integration
```

### 4. Test End-to-End

```bash
# Start API
./scripts/start_api.sh

# In another terminal, create job
curl -X POST http://localhost:8000/api/v1/plan/generate \
  -H "Content-Type: application/json" \
  -d '{
    "athlete_profile": {"ftp": 265, "weight_kg": 70, "age": 35},
    "weeks": 12
  }'

# Check Supabase dashboard - job should appear in plan_generation_jobs table

# Check job status
curl http://localhost:8000/api/v1/plan/status/plan_...

# Restart API - job should still be retrievable
```

---

## Files Created

- `src/cycling_ai/api/services/job_storage.py`
- `tests/api/services/test_job_storage.py`
- `.env.example`

---

## Files Modified

- `src/cycling_ai/api/routers/plan.py` (use database storage)
- `pyproject.toml` (add supabase dependency)

---

## Acceptance Criteria

- [x] Jobs persist to database
- [x] Jobs survive API restarts
- [x] Job status updates work
- [x] Tests pass
- [x] Type checking passes
- [x] Environment variables documented

---

## Next Card

**CARD_6.md** - Update Next.js service to call API
