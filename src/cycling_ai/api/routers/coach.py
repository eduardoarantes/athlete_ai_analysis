"""
Coach Router.

API endpoints for AI coaching feedback on workout compliance.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from cycling_ai.api.config import settings
from cycling_ai.api.middleware.auth import User, get_current_user
from cycling_ai.api.middleware.rate_limit import RATE_LIMITS, rate_limit
from cycling_ai.api.models.coach import (
    CoachAnalysisRequest,
    CoachAnalysisResponse,
)
from cycling_ai.core.compliance import generate_coach_analysis
from cycling_ai.core.compliance.models import StreamPoint

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/analyze", response_model=CoachAnalysisResponse)
@rate_limit(RATE_LIMITS["plan_generate"])
async def generate_coach_analysis_endpoint(
    request: CoachAnalysisRequest,
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> CoachAnalysisResponse:
    """
    Generate full coach analysis from workout structure and power streams.

    Takes workout structure and power stream data, performs compliance analysis
    using DTW alignment, and generates AI coaching feedback.

    Requires authentication.

    Args:
        request: Coach analysis request with workout and power data
        current_user: Authenticated user from JWT token

    Returns:
        CoachAnalysisResponse with prompts, AI feedback, and metadata

    Example:
        ```
        POST /api/v1/coach/analyze
        Authorization: Bearer <jwt_token>
        {
            "activity_id": 12345,
            "activity_name": "Morning Tempo Ride",
            "activity_date": "2025-01-16",
            "workout": {
                "id": "tempo_3x10",
                "name": "Tempo Intervals",
                "type": "tempo",
                "description": "3x10min @ 85-90% FTP",
                "structure": {...}
            },
            "power_streams": [
                {"time_offset": 0, "power": 150.0},
                ...
            ],
            "athlete_ftp": 265,
            "athlete_name": "John Doe"
        }

        Response (200):
        {
            "system_prompt": "You are an experienced cycling coach...",
            "user_prompt": "Analyze the athlete's execution...",
            "response_text": "{...}",
            "response_json": {...},
            "model": "claude-sonnet-4-20250514",
            "provider": "anthropic",
            "generated_at": "2025-01-16T12:00:00Z"
        }
        ```
    """
    logger.info(
        f"[COACH ROUTER] Received analysis request for user {current_user.id}, "
        f"workout: {request.workout.name}, activity: {request.activity_id}"
    )

    try:
        from datetime import UTC, datetime
        from pathlib import Path

        # Convert request models to core models
        workout_structure = {
            "id": request.workout.id,
            "name": request.workout.name,
            "type": request.workout.type,
            "description": request.workout.description or "",
            "structure": request.workout.structure,
        }

        power_streams = [
            StreamPoint(time_offset=s.time_offset, power=s.power) for s in request.power_streams
        ]

        # Build metadata
        activity_meta = {
            "name": request.activity_name or "Unknown",
            "date": request.activity_date or datetime.now(UTC).strftime("%Y-%m-%d"),
        }

        athlete_meta = {
            "name": request.athlete_name or "Unknown",
        }

        # Get prompt paths (from project root)
        # __file__ is in src/cycling_ai/api/routers/coach.py
        # We need to go up 5 levels to get to project root
        project_root = Path(__file__).parent.parent.parent.parent.parent
        prompt_dir = project_root / "prompts" / "default" / "1.3"
        system_prompt_path = prompt_dir / "compliance_coach_analysis_system_prompt.j2"
        user_prompt_path = prompt_dir / "compliance_coach_analysis_user_prompt.j2"

        logger.info(f"[COACH ROUTER] Using prompts from: {prompt_dir}")
        if not system_prompt_path.exists():
            raise FileNotFoundError(f"System prompt not found: {system_prompt_path}")

        # Generate analysis
        result = generate_coach_analysis(
            activity_id=request.activity_id,
            workout_structure=workout_structure,
            power_streams=power_streams,
            ftp=float(request.athlete_ftp),
            system_prompt_path=system_prompt_path,
            user_prompt_path=user_prompt_path,
            provider_name=settings.ai_provider,
            api_key=settings.get_provider_api_key(),
            model=settings.get_default_model(),
            temperature=settings.ai_temperature,
            activity_meta=activity_meta,
            athlete_meta=athlete_meta,
        )

        logger.info(
            f"[COACH ROUTER] Generated analysis for user {current_user.id}, "
            f"provider: {settings.ai_provider}, model: {settings.get_default_model()}"
        )

        return CoachAnalysisResponse(
            system_prompt=result["system_prompt"],
            user_prompt=result["user_prompt"],
            response_text=result["response_text"],
            response_json=result["response_json"],
            model=settings.get_default_model(),
            provider=settings.ai_provider,
            generated_at=datetime.now(UTC).isoformat(),
        )

    except ValueError as e:
        logger.error(f"[COACH ROUTER] Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e)) from e

    except FileNotFoundError as e:
        logger.error(f"[COACH ROUTER] Prompt template not found: {e}")
        raise HTTPException(
            status_code=500,
            detail="Prompt templates not found. Please contact support.",
        ) from e

    except Exception as e:
        logger.error(f"[COACH ROUTER] Failed to generate analysis: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate coach analysis. Please try again.",
        ) from e
