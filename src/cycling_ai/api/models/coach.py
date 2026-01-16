"""
Pydantic models for coach analysis.

Defines request/response models for AI coach analysis of workout compliance.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class StreamPointInput(BaseModel):
    """Power stream data point."""

    time_offset: int = Field(..., description="Time offset in seconds from activity start")
    power: float = Field(..., description="Power value in watts")


class WorkoutStructureInput(BaseModel):
    """Workout structure for coach analysis."""

    id: str = Field(..., description="Workout identifier")
    name: str = Field(..., description="Workout name")
    type: str = Field(default="", description="Workout type (intervals, endurance, etc.)")
    description: str | None = Field(None, description="Workout description/intent")
    structure: dict = Field(..., description="Workout structure definition")


class CoachAnalysisRequest(BaseModel):
    """Request model for full coach analysis (compliance + AI feedback)."""

    # Activity context
    activity_id: int = Field(..., description="Activity identifier")
    activity_name: str | None = Field(None, description="Activity name")
    activity_date: str | None = Field(None, description="Activity date (YYYY-MM-DD)")

    # Workout data
    workout: WorkoutStructureInput = Field(..., description="Workout structure")
    power_streams: list[StreamPointInput] = Field(..., description="Power stream data")

    # Athlete context
    athlete_ftp: int = Field(..., gt=0, description="Athlete FTP in watts")
    athlete_name: str | None = Field(None, description="Athlete name")
    athlete_lthr: int | None = Field(None, description="Athlete LTHR in bpm")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "activity_id": 12345,
                    "activity_name": "Morning Tempo Ride",
                    "activity_date": "2025-01-16",
                    "workout": {
                        "id": "tempo_intervals_3x10",
                        "name": "Tempo Intervals 3x10min",
                        "type": "tempo",
                        "description": "3x10min @ 85-90% FTP with 5min recovery",
                        "structure": {"structure": []},
                    },
                    "power_streams": [
                        {"time_offset": 0, "power": 150.0},
                        {"time_offset": 1, "power": 152.0},
                    ],
                    "athlete_ftp": 265,
                    "athlete_name": "John Doe",
                }
            ]
        }
    }


class CoachAnalysisResponse(BaseModel):
    """Response model for full coach analysis."""

    # Analysis results
    system_prompt: str = Field(..., description="System prompt used")
    user_prompt: str = Field(..., description="User prompt with workout context")
    response_text: str = Field(..., description="Raw LLM response")
    response_json: dict | None = Field(None, description="Parsed JSON response if valid")

    # Metadata
    model: str = Field(..., description="LLM model used")
    provider: str = Field(..., description="LLM provider used")
    generated_at: str = Field(..., description="ISO timestamp of generation")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "system_prompt": "You are an experienced cycling coach...",
                    "user_prompt": "Analyze the athlete's execution...",
                    "response_text": '{"overall_assessment": "..."}',
                    "response_json": {
                        "overall_assessment": "Good execution with minor pacing issues",
                        "strengths": ["Consistent power in main intervals"],
                        "opportunities": ["Recovery intervals too intense"],
                    },
                    "model": "claude-sonnet-4-20250514",
                    "provider": "anthropic",
                    "generated_at": "2025-01-16T12:00:00Z",
                }
            ]
        }
    }
