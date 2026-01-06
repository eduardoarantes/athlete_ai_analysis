"""
Coach Router.

API endpoints for AI coaching feedback on workout compliance.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from cycling_ai.api.middleware.auth import User, get_current_user
from cycling_ai.api.middleware.rate_limit import RATE_LIMITS, rate_limit
from cycling_ai.api.models.coach import (
    ComplianceCoachRequest,
    ComplianceCoachResponse,
)
from cycling_ai.api.services.coach_service import ComplianceCoachService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/compliance", response_model=ComplianceCoachResponse)
@rate_limit(RATE_LIMITS["plan_generate"])  # Use same rate limit as plan generation
async def generate_compliance_feedback(
    request: ComplianceCoachRequest,
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> ComplianceCoachResponse:
    """
    Generate AI coaching feedback for workout compliance analysis.

    Takes compliance analysis data (score, segments, etc.) and returns
    personalized coaching feedback with strengths, improvements, and action items.

    Requires authentication.

    Args:
        request: Compliance coach request with analysis data
        current_user: Authenticated user from JWT token

    Returns:
        ComplianceCoachResponse with AI-generated feedback

    Example:
        ```
        POST /api/v1/coach/compliance
        Authorization: Bearer <jwt_token>
        {
            "workout_name": "Tempo Intervals",
            "workout_type": "tempo",
            "workout_date": "2025-01-06",
            "athlete_ftp": 265,
            "compliance_analysis": {
                "overall": {
                    "score": 85,
                    "grade": "B",
                    "summary": "Good execution",
                    "segments_completed": 5,
                    "segments_skipped": 0,
                    "segments_total": 5
                },
                "segments": [...],
                "metadata": {
                    "algorithm_version": "1.0.0",
                    "power_data_quality": "excellent"
                }
            }
        }

        Response (200):
        {
            "feedback": {
                "summary": "Good workout with 85% compliance...",
                "strengths": ["Maintained steady tempo power..."],
                "improvements": ["Recovery intervals too intense..."],
                "action_items": ["Set power cap for recovery..."],
                "segment_notes": []
            },
            "generated_at": "2025-01-06T12:00:00Z",
            "model": "gemini-2.0-flash",
            "cached": false
        }
        ```
    """
    logger.info(
        f"[COACH ROUTER] Received compliance feedback request for user {current_user.id}, "
        f"workout: {request.workout_name}, score: {request.compliance_analysis.overall.score}"
    )

    try:
        coach_service = ComplianceCoachService()
        response = await coach_service.generate_feedback(request)

        logger.info(
            f"[COACH ROUTER] Generated feedback for user {current_user.id}, "
            f"model: {response.model}"
        )

        return response

    except ValueError as e:
        logger.error(f"[COACH ROUTER] Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e)) from e

    except Exception as e:
        logger.error(f"[COACH ROUTER] Failed to generate feedback: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate coaching feedback. Please try again.",
        ) from e
