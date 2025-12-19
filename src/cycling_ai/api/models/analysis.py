"""
Pydantic models for performance analysis.

Defines request/response models for analysis-related endpoints.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from cycling_ai.api.models.plan import AthleteProfileData


class PerformanceAnalysisRequest(BaseModel):
    """Request model for performance analysis."""

    user_id: str = Field(..., description="User ID to fetch Strava activities for")
    athlete_profile: AthleteProfileData = Field(..., description="Athlete profile information")
    period_months: int = Field(
        default=6,
        ge=1,
        le=24,
        description="Analysis period in months",
    )
    analyze_cross_training: bool | None = Field(
        default=None,
        description="Whether to analyze cross-training impact. None = auto-detect",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "user_id": "uuid-of-user",
                    "athlete_profile": {
                        "ftp": 265,
                        "weight_kg": 70,
                        "max_hr": 186,
                        "age": 35,
                        "goals": ["Improve FTP"],
                    },
                    "period_months": 6,
                    "analyze_cross_training": None,
                }
            ]
        }
    }


class PerformanceAnalysisResponse(BaseModel):
    """Response model for completed performance analysis."""

    performance_analysis: dict[str, Any] = Field(..., description="Performance analysis results")
    cross_training_analysis: dict[str, Any] | None = Field(
        None, description="Cross-training analysis if applicable"
    )
    ai_metadata: dict[str, str] = Field(..., description="AI provider metadata")
    cache_info: dict[str, Any] | None = Field(None, description="Cache metadata from Phase 1")


class AnalysisJobStatusResponse(BaseModel):
    """Response model for analysis job creation."""

    job_id: str = Field(..., description="Unique job identifier")
    status: str = Field(..., description="Job status: queued, running, completed, failed")
    message: str | None = Field(None, description="Status message")
