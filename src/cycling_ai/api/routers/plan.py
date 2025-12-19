"""
Plan Router.

API endpoints for training plan generation.
"""

from __future__ import annotations

import json
import logging
import tempfile
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from cycling_ai.api.config import settings
from cycling_ai.api.middleware.auth import User, get_current_user
from cycling_ai.api.models.common import ErrorResponse
from cycling_ai.api.models.plan import JobStatusResponse, TrainingPlanRequest
from cycling_ai.api.services.job_store import JobStatus, get_job_store
from cycling_ai.api.services.plan_service import PlanService

logger = logging.getLogger(__name__)

router = APIRouter()


async def _execute_plan_generation(
    job_id: str,
    request: TrainingPlanRequest,
    use_ai: bool = True,
) -> None:
    """
    Background task to execute plan generation.

    Args:
        job_id: Job identifier
        request: Plan generation request
        use_ai: If True, use AI-powered generation; otherwise use skeleton templates
    """
    job_store = get_job_store()

    try:
        # Update to running status
        await job_store.update_status(
            job_id=job_id,
            status=JobStatus.RUNNING,
            progress={"phase": "Initializing", "percentage": 0},
        )

        if use_ai:
            # AI-powered plan generation
            await _execute_ai_plan_generation(job_id, request, job_store)
        else:
            # Skeleton-based plan generation (original behavior)
            await _execute_skeleton_plan_generation(job_id, request, job_store)

    except Exception as e:
        logger.error(f"[PLAN ROUTER] Job {job_id} failed: {str(e)}")
        await job_store.update_status(
            job_id=job_id,
            status=JobStatus.FAILED,
            error=str(e),
        )


async def _execute_ai_plan_generation(
    job_id: str,
    request: TrainingPlanRequest,
    job_store: Any,
) -> None:
    """
    Execute AI-powered plan generation.

    Args:
        job_id: Job identifier
        request: Plan generation request
        job_store: Job store instance
    """
    from cycling_ai.api.services.ai_plan_service import AIPlanService

    ai_service = AIPlanService()

    try:
        # Update progress
        await job_store.update_status(
            job_id=job_id,
            status=JobStatus.RUNNING,
            progress={"phase": "Generating AI-powered plan", "percentage": 30},
        )

        # Generate plan using AI
        result = await ai_service.generate_plan(request=request)

        # Update to completed with AI metadata
        await job_store.update_status(
            job_id=job_id,
            status=JobStatus.COMPLETED,
            result=result,
            progress={"phase": "Complete", "percentage": 100},
        )

        logger.info(
            f"[PLAN ROUTER] AI job {job_id} completed successfully "
            f"(provider: {result.get('ai_metadata', {}).get('ai_provider', 'unknown')})"
        )

    except ValueError as e:
        # Specific errors from AI service
        logger.error(f"[PLAN ROUTER] AI job {job_id} failed: {str(e)}")
        await job_store.update_status(
            job_id=job_id,
            status=JobStatus.FAILED,
            error=str(e),
        )
        raise


async def _execute_skeleton_plan_generation(
    job_id: str,
    request: TrainingPlanRequest,
    job_store: Any,
) -> None:
    """
    Execute skeleton-based plan generation (original behavior).

    Args:
        job_id: Job identifier
        request: Plan generation request
        job_store: Job store instance
    """
    plan_service = PlanService()

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
            "training_availability": request.athlete_profile.training_availability or {},
            "goals": " ".join(request.athlete_profile.goals or []),
            "current_training_status": request.athlete_profile.experience_level or "intermediate",
            "raw_training_data_path": "/tmp/api_data",
        }
        json.dump(profile_data, f)
        profile_path = Path(f.name)

    try:
        # Update progress
        await job_store.update_status(
            job_id=job_id,
            status=JobStatus.RUNNING,
            progress={"phase": "Generating skeleton plan", "percentage": 50},
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

        logger.info(f"[PLAN ROUTER] Skeleton job {job_id} completed successfully")

    finally:
        # Clean up temporary file
        if profile_path.exists():
            profile_path.unlink()


# Import Any for type hints
from typing import Any


@router.post("/generate", response_model=JobStatusResponse, status_code=202)
async def generate_plan(
    request: TrainingPlanRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    use_ai: bool = Query(
        default=True,
        description="Use AI-powered plan generation. Set to false for skeleton templates.",
    ),
) -> JobStatusResponse:
    """
    Start training plan generation as background job.

    By default, uses AI-powered generation for personalized training plans.
    Set use_ai=false for faster skeleton-based templates.

    Requires authentication.

    Args:
        request: Training plan request with athlete profile and parameters
        background_tasks: FastAPI background tasks manager
        current_user: Authenticated user from JWT token
        use_ai: If True (default), use AI-powered generation

    Returns:
        Job status response with job ID

    Example:
        ```
        POST /api/v1/plan/generate?use_ai=true
        Authorization: Bearer <jwt_token>
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
            "message": "AI training plan generation started"
        }
        ```
    """
    mode = "AI-powered" if use_ai else "skeleton"
    logger.info(
        f"[PLAN ROUTER] Received {mode} plan generation request: "
        f"{request.weeks} weeks, target FTP: {request.target_ftp}, user: {current_user.id}"
    )

    # Create job with user_id for ownership tracking
    job_store = get_job_store()
    job_id = await job_store.create_job(user_id=current_user.id)

    # Queue background task
    background_tasks.add_task(
        _execute_plan_generation,
        job_id=job_id,
        request=request,
        use_ai=use_ai,
    )

    message = "AI training plan generation started" if use_ai else "Skeleton plan generation started"
    return JobStatusResponse(
        job_id=job_id,
        status="queued",
        message=message,
    )


@router.get("/status/{job_id}")
async def get_job_status(
    job_id: str,
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """
    Get status of plan generation job.

    Requires authentication. Users can only access their own jobs.

    Args:
        job_id: Job identifier from /generate endpoint
        current_user: Authenticated user from JWT token

    Returns:
        Job status with result or error

    Raises:
        HTTPException: If job not found (404) or access denied (403)

    Example:
        ```
        GET /api/v1/plan/status/plan_1734376800_a1b2c3d4
        Authorization: Bearer <jwt_token>

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

    # Verify job ownership
    if job.user_id is not None and job.user_id != current_user.id:
        logger.warning(
            f"[PLAN ROUTER] User {current_user.id} attempted to access "
            f"job {job_id} owned by {job.user_id}"
        )
        raise HTTPException(
            status_code=403,
            detail="Access denied: you can only access your own jobs",
        )

    return JSONResponse(content=job.to_dict())
