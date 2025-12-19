"""
Analysis Router.

API endpoints for performance analysis.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

import httpx

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import JSONResponse

from cycling_ai.api.config import settings
from cycling_ai.api.middleware.auth import User, get_current_user
from cycling_ai.api.models.analysis import (
    AnalysisJobStatusResponse,
    PerformanceAnalysisRequest,
)
from cycling_ai.api.models.common import ErrorResponse
from cycling_ai.api.services.job_store import JobStatus, get_job_store

logger = logging.getLogger(__name__)

router = APIRouter()


async def _create_report_record(
    user_id: str,
    period_months: int,
    config: dict,
) -> str | None:
    """
    Create a report record in the database.

    Args:
        user_id: User ID
        period_months: Analysis period in months
        config: Request configuration

    Returns:
        Report ID or None if creation failed
    """
    if not settings.supabase_url or not settings.supabase_service_role_key:
        logger.warning("[ANALYSIS ROUTER] Supabase not configured, skipping DB save")
        return None

    end_date = datetime.now()
    start_date = end_date - timedelta(days=period_months * 30)

    url = f"{settings.supabase_url}/rest/v1/reports"
    headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    payload = {
        "user_id": user_id,
        "report_type": "performance",
        "period_start": start_date.date().isoformat(),
        "period_end": end_date.date().isoformat(),
        "config": config,
        "status": "processing",
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            report_id = data[0]["id"] if data else None
            logger.info(f"[ANALYSIS ROUTER] Created report record: {report_id}")
            return report_id
    except Exception as e:
        logger.error(f"[ANALYSIS ROUTER] Failed to create report record: {e}")
        return None


async def _update_report_completed(
    report_id: str,
    result: dict,
) -> None:
    """Update report record with completed status and results."""
    if not report_id or not settings.supabase_url or not settings.supabase_service_role_key:
        return

    url = f"{settings.supabase_url}/rest/v1/reports?id=eq.{report_id}"
    headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "status": "completed",
        "report_data": result,
        "completed_at": datetime.now().isoformat(),
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.patch(url, json=payload, headers=headers)
            response.raise_for_status()
            logger.info(f"[ANALYSIS ROUTER] Updated report {report_id} to completed")
    except Exception as e:
        logger.error(f"[ANALYSIS ROUTER] Failed to update report record: {e}")


async def _update_report_failed(
    report_id: str,
    error: str,
) -> None:
    """Update report record with failed status and error message."""
    if not report_id or not settings.supabase_url or not settings.supabase_service_role_key:
        return

    url = f"{settings.supabase_url}/rest/v1/reports?id=eq.{report_id}"
    headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "status": "failed",
        "error_message": error[:1000],  # Truncate long errors
        "completed_at": datetime.now().isoformat(),
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.patch(url, json=payload, headers=headers)
            response.raise_for_status()
            logger.info(f"[ANALYSIS ROUTER] Updated report {report_id} to failed")
    except Exception as e:
        logger.error(f"[ANALYSIS ROUTER] Failed to update report record: {e}")


async def _execute_performance_analysis(
    job_id: str,
    request: PerformanceAnalysisRequest,
    report_id: str | None = None,
) -> None:
    """
    Background task to execute performance analysis.

    Args:
        job_id: Job identifier
        request: Performance analysis request
        report_id: Database report ID for persistence
    """
    from cycling_ai.api.services.ai_analysis_service import AIAnalysisService

    job_store = get_job_store()

    try:
        # Update to running status
        await job_store.update_status(
            job_id=job_id,
            status=JobStatus.RUNNING,
            progress={"phase": "Initializing", "percentage": 0},
        )

        ai_service = AIAnalysisService()

        # Update progress - Fetching data
        await job_store.update_status(
            job_id=job_id,
            status=JobStatus.RUNNING,
            progress={"phase": "Fetching Strava activities", "percentage": 20},
        )

        # Run analysis (Fetch data + Performance Analysis + LLM synthesis)
        result = await ai_service.analyze_performance(request=request)

        # Save results to database
        if report_id:
            await _update_report_completed(report_id, result)

        # Update to completed
        await job_store.update_status(
            job_id=job_id,
            status=JobStatus.COMPLETED,
            result=result,
            progress={"phase": "Complete", "percentage": 100},
        )

        logger.info(
            f"[ANALYSIS ROUTER] Job {job_id} completed successfully "
            f"(provider: {result.get('ai_metadata', {}).get('ai_provider', 'unknown')}, "
            f"report_id: {report_id})"
        )

    except ValueError as e:
        logger.error(f"[ANALYSIS ROUTER] Job {job_id} failed: {str(e)}")
        if report_id:
            await _update_report_failed(report_id, str(e))
        await job_store.update_status(
            job_id=job_id,
            status=JobStatus.FAILED,
            error=str(e),
        )

    except Exception as e:
        logger.error(f"[ANALYSIS ROUTER] Job {job_id} failed with exception: {str(e)}")
        if report_id:
            await _update_report_failed(report_id, str(e))
        await job_store.update_status(
            job_id=job_id,
            status=JobStatus.FAILED,
            error=str(e),
        )


@router.post("/performance", response_model=AnalysisJobStatusResponse, status_code=202)
async def analyze_performance(
    request: PerformanceAnalysisRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
) -> AnalysisJobStatusResponse:
    """
    Start performance analysis as background job.

    Fetches activity data from Supabase (synced from Strava) and runs
    comprehensive performance analysis with LLM-powered insights.

    Requires authentication. The user_id in the request must match the
    authenticated user's ID (users can only analyze their own data).

    Args:
        request: Performance analysis request with user_id and athlete profile
        background_tasks: FastAPI background tasks manager
        current_user: Authenticated user from JWT token

    Returns:
        Job status response with job ID

    Raises:
        HTTPException: 403 if user_id doesn't match authenticated user

    Example:
        ```
        POST /api/v1/analysis/performance
        Authorization: Bearer <jwt_token>
        {
            "user_id": "uuid-of-user",
            "athlete_profile": {
                "ftp": 265,
                "weight_kg": 70,
                "max_hr": 186,
                "age": 35,
                "goals": ["Improve FTP"]
            },
            "period_months": 6
        }

        Response (202):
        {
            "job_id": "analysis_1734376800_a1b2c3d4",
            "status": "queued",
            "message": "Performance analysis started"
        }
        ```
    """
    # Verify user can only request analysis for themselves (prevent IDOR)
    if request.user_id != current_user.id:
        logger.warning(
            f"[ANALYSIS ROUTER] User {current_user.id} attempted to access "
            f"data for user {request.user_id}"
        )
        raise HTTPException(
            status_code=403,
            detail="Cannot request analysis for other users",
        )

    logger.info(
        f"[ANALYSIS ROUTER] Received performance analysis request: "
        f"user_id={request.user_id}, period_months={request.period_months}"
    )

    # Create job with user_id for ownership tracking
    job_store = get_job_store()
    job_id = await job_store.create_job(prefix="analysis", user_id=current_user.id)

    # Create report record in database
    report_id = await _create_report_record(
        user_id=request.user_id,
        period_months=request.period_months,
        config={
            "athlete_profile": request.athlete_profile.model_dump(),
            "period_months": request.period_months,
        },
    )

    # Queue background task
    background_tasks.add_task(
        _execute_performance_analysis,
        job_id=job_id,
        request=request,
        report_id=report_id,
    )

    return AnalysisJobStatusResponse(
        job_id=job_id,
        status="queued",
        message="Performance analysis started",
    )


@router.get("/status/{job_id}")
async def get_analysis_status(
    job_id: str,
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """
    Get status of performance analysis job.

    Requires authentication. Users can only access their own jobs.

    Args:
        job_id: Job identifier from /performance endpoint
        current_user: Authenticated user from JWT token

    Returns:
        Job status with result or error

    Raises:
        HTTPException: If job not found (404) or access denied (403)

    Example:
        ```
        GET /api/v1/analysis/status/analysis_1734376800_a1b2c3d4
        Authorization: Bearer <jwt_token>

        Response (200):
        {
            "job_id": "analysis_1734376800_a1b2c3d4",
            "status": "completed",
            "progress": {
                "phase": "Complete",
                "percentage": 100
            },
            "result": {
                "performance_analysis": {...},
                "ai_metadata": {...}
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
            f"[ANALYSIS ROUTER] User {current_user.id} attempted to access "
            f"job {job_id} owned by {job.user_id}"
        )
        raise HTTPException(
            status_code=403,
            detail="Access denied: you can only access your own jobs",
        )

    return JSONResponse(content=job.to_dict())
