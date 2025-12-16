"""
Plan Router.

API endpoints for training plan generation.
"""
from __future__ import annotations

import json
import logging
import tempfile
from pathlib import Path
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse

from cycling_ai.api.models.common import ErrorResponse
from cycling_ai.api.models.plan import JobStatusResponse, TrainingPlanRequest
from cycling_ai.api.services.job_store import JobStatus, get_job_store
from cycling_ai.api.services.plan_service import PlanService

logger = logging.getLogger(__name__)

router = APIRouter()


async def _execute_plan_generation(
    job_id: str,
    request: TrainingPlanRequest,
) -> None:
    """
    Background task to execute plan generation.

    Args:
        job_id: Job identifier
        request: Plan generation request
    """
    job_store = get_job_store()
    plan_service = PlanService()

    try:
        # Update to running status
        await job_store.update_status(
            job_id=job_id,
            status=JobStatus.RUNNING,
            progress={"phase": "Initializing", "percentage": 0},
        )

        # Create temporary athlete profile file
        # The underlying tool expects a file path, not just data
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".json",
            delete=False,
        ) as f:
            profile_data = {
                "name": "API User",
                "age": request.athlete_profile.age,
                "weight": f"{request.athlete_profile.weight_kg}kg",
                "FTP": f"{request.athlete_profile.ftp}w",
                "critical_HR": request.athlete_profile.max_hr,
                "gender": "unknown",
                "training_availability": request.athlete_profile.training_availability
                or {},
                "goals": " ".join(request.athlete_profile.goals or []),
                "current_training_status": request.athlete_profile.experience_level
                or "intermediate",
                "raw_training_data_path": "/tmp/api_data",
            }
            json.dump(profile_data, f)
            profile_path = Path(f.name)

        try:
            # Update progress
            await job_store.update_status(
                job_id=job_id,
                status=JobStatus.RUNNING,
                progress={"phase": "Generating plan", "percentage": 50},
            )

            # Generate plan
            result = await plan_service.generate_plan(
                request=request,
                athlete_profile_path=profile_path,
            )

            # Update to completed
            await job_store.update_status(
                job_id=job_id,
                status=JobStatus.COMPLETED,
                result=result,
                progress={"phase": "Complete", "percentage": 100},
            )

            logger.info(f"[PLAN ROUTER] Job {job_id} completed successfully")

        finally:
            # Clean up temporary file
            if profile_path.exists():
                profile_path.unlink()

    except Exception as e:
        logger.error(f"[PLAN ROUTER] Job {job_id} failed: {str(e)}")
        await job_store.update_status(
            job_id=job_id,
            status=JobStatus.FAILED,
            error=str(e),
        )


@router.post("/generate", response_model=JobStatusResponse, status_code=202)
async def generate_plan(
    request: TrainingPlanRequest,
    background_tasks: BackgroundTasks,
) -> JobStatusResponse:
    """
    Start training plan generation as background job.

    Args:
        request: Training plan request with athlete profile and parameters
        background_tasks: FastAPI background tasks manager

    Returns:
        Job status response with job ID

    Example:
        ```
        POST /api/v1/plan/generate
        {
            "athlete_profile": {
                "ftp": 265,
                "weight_kg": 70,
                "age": 35,
                "max_hr": 186,
                "goals": ["Improve FTP"]
            },
            "weeks": 12,
            "target_ftp": 278
        }

        Response (202):
        {
            "job_id": "plan_1734376800_a1b2c3d4",
            "status": "queued",
            "message": "Training plan generation started"
        }
        ```
    """
    logger.info(
        f"[PLAN ROUTER] Received plan generation request: {request.weeks} weeks, "
        f"target FTP: {request.target_ftp}"
    )

    # Create job
    job_store = get_job_store()
    job_id = await job_store.create_job()

    # Queue background task
    background_tasks.add_task(
        _execute_plan_generation,
        job_id=job_id,
        request=request,
    )

    return JobStatusResponse(
        job_id=job_id,
        status="queued",
        message="Training plan generation started",
    )


@router.get("/status/{job_id}")
async def get_job_status(job_id: str) -> JSONResponse:
    """
    Get status of plan generation job.

    Args:
        job_id: Job identifier from /generate endpoint

    Returns:
        Job status with result or error

    Raises:
        HTTPException: If job not found (404)

    Example:
        ```
        GET /api/v1/plan/status/plan_1734376800_a1b2c3d4

        Response (200):
        {
            "job_id": "plan_1734376800_a1b2c3d4",
            "status": "completed",
            "progress": {
                "phase": "Complete",
                "percentage": 100
            },
            "result": {
                "training_plan": {...}
            }
        }
        ```
    """
    job_store = get_job_store()
    job = await job_store.get_job(job_id)

    if job is None:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error="Job not found",
                details=f"No job exists with ID: {job_id}",
                validation_errors=None,
            ).model_dump(),
        )

    return JSONResponse(content=job.to_dict())
