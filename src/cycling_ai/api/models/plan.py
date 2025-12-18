"""
Pydantic models for training plan generation.

Defines request/response models for plan-related endpoints.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class AthleteProfileData(BaseModel):
    """Athlete profile embedded in requests."""

    name: str | None = Field(None, description="Athlete name")
    ftp: float = Field(..., gt=0, description="Functional Threshold Power in watts")
    weight_kg: float = Field(..., gt=0, description="Athlete weight in kilograms")
    max_hr: int | None = Field(None, gt=0, le=220, description="Maximum heart rate")
    age: int = Field(..., gt=0, le=120, description="Athlete age")
    goals: list[str] | None = Field(None, description="Training goals")
    training_availability: dict[str, Any] | None = Field(None, description="Available training days and hours")
    experience_level: str | None = Field(None, description="Experience level")
    weekly_hours_available: float | None = Field(None, gt=0, description="Available training hours per week")
    training_days_per_week: int | None = Field(None, ge=3, le=7, description="Number of training days per week")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "ftp": 265,
                    "weight_kg": 70,
                    "max_hr": 186,
                    "age": 35,
                    "goals": ["Improve FTP", "Complete century ride"],
                    "training_availability": {
                        "hours_per_week": 7,
                        "week_days": "Monday, Wednesday, Friday, Saturday, Sunday",
                    },
                    "experience_level": "intermediate",
                    "weekly_hours_available": 7,
                    "training_days_per_week": 5,
                }
            ]
        }
    }


class TrainingPlanRequest(BaseModel):
    """Request model for training plan generation."""

    athlete_profile: AthleteProfileData = Field(..., description="Athlete profile information")
    weeks: int = Field(..., ge=4, le=24, description="Plan duration in weeks")
    target_ftp: float | None = Field(None, gt=0, description="Target FTP in watts")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
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
            ]
        }
    }


class JobStatusResponse(BaseModel):
    """Response model for job creation."""

    job_id: str = Field(..., description="Unique job identifier")
    status: str = Field(..., description="Initial job status (queued)")
    message: str = Field(..., description="Status message")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "job_id": "plan_1734376800_a1b2c3d4",
                    "status": "queued",
                    "message": "Training plan generation started",
                }
            ]
        }
    }


class TrainingPlanResponse(BaseModel):
    """Response model for completed training plan."""

    training_plan: dict[str, Any] = Field(..., description="Generated training plan")
    metadata: dict[str, Any] | None = Field(None, description="Additional metadata")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "training_plan": {
                        "total_weeks": 12,
                        "current_ftp": 265,
                        "target_ftp": 278,
                        "weekly_plan": [],
                    },
                    "metadata": {
                        "generated_at": "2024-12-16T10:00:00Z",
                        "model": "anthropic/claude-3-5-sonnet",
                    },
                }
            ]
        }
    }
