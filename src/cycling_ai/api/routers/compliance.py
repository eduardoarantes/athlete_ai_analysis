"""
Compliance Router.

API endpoints for workout compliance analysis.
"""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from cycling_ai.core.compliance import (
    ComplianceAnalyzer,
    ComplianceResult,
    analyze_activity_from_strava,
)
from cycling_ai.core.compliance.io import load_workout_steps_from_library_object
from cycling_ai.core.compliance.models import StreamPoint
from cycling_ai.core.workout_library.structure_helpers import WorkoutStructure
from cycling_ai.api.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


# Request Models
class StreamPointInput(BaseModel):
    """Power stream data point."""

    time_offset: int = Field(..., description="Time offset in seconds from activity start")
    power: float = Field(..., description="Power value in watts")


class WorkoutInput(BaseModel):
    """Workout data for compliance analysis."""

    id: str | None = Field(None, description="Workout ID from library")
    name: str | None = Field(None, description="Workout name")
    structure: WorkoutStructure = Field(..., description="Workout structure")


class AnalyzeComplianceRequest(BaseModel):
    """Request body for compliance analysis."""

    workout: WorkoutInput = Field(..., description="Workout to analyze against")
    streams: list[StreamPointInput] = Field(..., description="Power stream data from activity")
    ftp: float = Field(..., description="Athlete's FTP in watts", gt=0)
    activity_id: int | None = Field(None, description="Optional activity ID for reference")


class AnalyzeStravaActivityRequest(BaseModel):
    """Request body for analyzing a Strava activity."""

    workout: WorkoutInput = Field(..., description="Workout to analyze against")
    activity_id: int = Field(..., description="Strava activity ID")
    ftp: float = Field(..., description="Athlete's FTP in watts", gt=0)


# Response Models
class ComplianceStepResult(BaseModel):
    """Compliance result for a single workout step."""

    step_name: str
    planned_duration: int
    actual_duration: int
    target_power: float
    actual_power_avg: float
    compliance_pct: float
    intensity_class: str | None = None


class ComplianceAnalysisResponse(BaseModel):
    """Response for compliance analysis."""

    workout_id: str | None
    workout_name: str
    activity_id: int | None
    ftp: float
    overall_compliance: float
    results: list[ComplianceStepResult]
    total_steps: int
    summary: dict[str, float] | None = None


# Helper Functions
def _calculate_overall_compliance(results: list[ComplianceResult]) -> float:
    """Calculate overall compliance percentage."""
    if not results:
        return 0.0
    return sum(r.compliance_pct for r in results) / len(results)


def _calculate_summary_by_intensity(results: list[ComplianceResult]) -> dict[str, float]:
    """Calculate average compliance by intensity class."""
    summary: dict[str, list[float]] = {}

    for result in results:
        intensity = result.intensity_class or "unknown"
        if intensity not in summary:
            summary[intensity] = []
        summary[intensity].append(result.compliance_pct)

    return {intensity: sum(scores) / len(scores) for intensity, scores in summary.items()}


def _compliance_result_to_response(result: ComplianceResult) -> ComplianceStepResult:
    """Convert ComplianceResult to API response model."""
    return ComplianceStepResult(
        step_name=result.step_name,
        planned_duration=result.planned_duration,
        actual_duration=result.actual_duration,
        target_power=result.target_power,
        actual_power_avg=result.actual_power_avg,
        compliance_pct=result.compliance_pct,
        intensity_class=result.intensity_class,
    )


# Endpoints
@router.post("/analyze", response_model=ComplianceAnalysisResponse)
async def analyze_compliance(request: AnalyzeComplianceRequest) -> ComplianceAnalysisResponse:
    """
    Analyze workout compliance from provided stream data.

    This endpoint accepts a workout structure and power stream data,
    and returns detailed compliance analysis for each workout step.

    Args:
        request: Compliance analysis request with workout, streams, and FTP

    Returns:
        Detailed compliance analysis results

    Raises:
        HTTPException: If analysis fails
    """
    try:
        logger.info(
            f"Analyzing compliance for workout '{request.workout.name or request.workout.id}' "
            f"with {len(request.streams)} stream points"
        )

        # Convert request models to compliance models
        workout_dict = {
            "id": request.workout.id or "custom",
            "name": request.workout.name or "Custom Workout",
            "structure": request.workout.structure.model_dump(),
        }

        streams = [StreamPoint(time_offset=s.time_offset, power=s.power) for s in request.streams]

        # Load workout steps
        steps, resolved_ftp = load_workout_steps_from_library_object(workout_dict, ftp=request.ftp)

        # Run compliance analysis
        analyzer = ComplianceAnalyzer(ftp=resolved_ftp)
        results = analyzer.analyze(steps, streams)

        # Calculate metrics
        overall_compliance = _calculate_overall_compliance(results)
        summary = _calculate_summary_by_intensity(results)

        logger.info(f"Compliance analysis completed: {overall_compliance:.1f}% overall compliance")

        return ComplianceAnalysisResponse(
            workout_id=request.workout.id,
            workout_name=request.workout.name or "Custom Workout",
            activity_id=request.activity_id,
            ftp=resolved_ftp,
            overall_compliance=overall_compliance,
            results=[_compliance_result_to_response(r) for r in results],
            total_steps=len(results),
            summary=summary,
        )

    except Exception as e:
        logger.error(f"Compliance analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Compliance analysis failed: {str(e)}")


@router.post("/analyze-strava", response_model=ComplianceAnalysisResponse)
async def analyze_strava_activity(request: AnalyzeStravaActivityRequest) -> ComplianceAnalysisResponse:
    """
    Analyze workout compliance from a Strava activity.

    This endpoint fetches power stream data from Strava and analyzes
    compliance against the provided workout structure.

    Note: Strava access token is configured server-side in environment variables
    or AWS Parameter Store (in production).

    Args:
        request: Request with workout, Strava activity ID, and FTP

    Returns:
        Detailed compliance analysis results

    Raises:
        HTTPException: If Strava fetch or analysis fails
    """
    try:
        logger.info(
            f"Analyzing Strava activity {request.activity_id} "
            f"for workout '{request.workout.name or request.workout.id}'"
        )

        # Convert workout to dict format
        workout_dict = {
            "id": request.workout.id or "custom",
            "name": request.workout.name or "Custom Workout",
            "structure": request.workout.structure.model_dump(),
        }

        # Use the existing analyze_activity_from_strava function
        result = analyze_activity_from_strava(
            workout=workout_dict,
            activity_id=request.activity_id,
            ftp=request.ftp,
        )

        # Calculate metrics
        overall_compliance = _calculate_overall_compliance(result["results"])
        summary = _calculate_summary_by_intensity(result["results"])

        logger.info(f"Strava activity analysis completed: {overall_compliance:.1f}% overall compliance")

        return ComplianceAnalysisResponse(
            workout_id=result["workout_id"],
            workout_name=result["workout_name"],
            activity_id=result["activity_id"],
            ftp=result["ftp"],
            overall_compliance=overall_compliance,
            results=[_compliance_result_to_response(r) for r in result["results"]],
            total_steps=len(result["results"]),
            summary=summary,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Strava activity analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Strava activity analysis failed: {str(e)}")


@router.get("/health")
async def compliance_health() -> JSONResponse:
    """
    Health check for compliance service.

    Returns:
        JSON response with service status
    """
    return JSONResponse(content={"status": "healthy", "service": "compliance"})
