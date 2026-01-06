"""
Pydantic models for compliance coaching.

Defines request/response models for AI coaching feedback on workout compliance.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class SegmentNote(BaseModel):
    """Coaching note for a specific workout segment."""

    segment_index: int = Field(..., description="Index of the segment (0-based)")
    note: str = Field(..., description="Coaching feedback for this segment")


class CoachFeedback(BaseModel):
    """AI-generated coaching feedback for workout compliance."""

    summary: str = Field(
        ...,
        description="2-3 sentence overall assessment of workout execution",
    )
    strengths: list[str] = Field(
        ...,
        min_length=1,
        max_length=5,
        description="Specific things athlete did well (with data references)",
    )
    improvements: list[str] = Field(
        ...,
        min_length=0,
        max_length=4,
        description="Specific areas to improve",
    )
    action_items: list[str] = Field(
        ...,
        min_length=1,
        max_length=4,
        description="Actionable recommendations for next workout",
    )
    segment_notes: list[SegmentNote] = Field(
        default_factory=list,
        description="Specific notes for individual segments (0-3 items)",
    )


class ZoneDistribution(BaseModel):
    """Power zone distribution percentages."""

    z1: float = Field(..., ge=0, le=1, description="Percentage in Zone 1")
    z2: float = Field(..., ge=0, le=1, description="Percentage in Zone 2")
    z3: float = Field(..., ge=0, le=1, description="Percentage in Zone 3")
    z4: float = Field(..., ge=0, le=1, description="Percentage in Zone 4")
    z5: float = Field(..., ge=0, le=1, description="Percentage in Zone 5")


class SegmentAnalysis(BaseModel):
    """Analysis of a single workout segment."""

    segment_index: int = Field(..., description="Index of segment in workout")
    segment_name: str = Field(..., description="Name of the segment")
    segment_type: str = Field(..., description="Type: warmup, interval, recovery, etc.")
    match_quality: str = Field(
        ..., description="Quality: excellent, good, fair, poor, skipped"
    )

    # Planned values
    planned_duration_sec: int = Field(..., description="Planned duration in seconds")
    planned_power_low: int = Field(..., description="Lower bound of target power")
    planned_power_high: int = Field(..., description="Upper bound of target power")
    planned_zone: int = Field(..., ge=1, le=5, description="Target power zone")

    # Actual values (null if skipped)
    actual_start_sec: int | None = Field(None, description="Start time in seconds")
    actual_end_sec: int | None = Field(None, description="End time in seconds")
    actual_duration_sec: int | None = Field(None, description="Actual duration")
    actual_avg_power: float | None = Field(None, description="Average power in watts")
    actual_max_power: float | None = Field(None, description="Max power in watts")
    actual_min_power: float | None = Field(None, description="Min power in watts")
    actual_dominant_zone: int | None = Field(None, description="Dominant zone achieved")
    time_in_zone: ZoneDistribution | None = Field(None, description="Zone distribution")

    # Scores
    power_compliance: float = Field(..., ge=0, le=100, description="Power score 0-100")
    zone_compliance: float = Field(..., ge=0, le=100, description="Zone score 0-100")
    duration_compliance: float = Field(..., ge=0, le=100, description="Duration score")
    overall_segment_score: float = Field(..., ge=0, le=100, description="Overall score")

    # Human-readable
    assessment: str = Field(..., description="Text assessment of segment execution")


class OverallCompliance(BaseModel):
    """Overall workout compliance summary."""

    score: float = Field(..., ge=0, le=100, description="Overall compliance score")
    grade: str = Field(..., pattern=r"^[A-F]$", description="Letter grade A-F")
    summary: str = Field(..., description="Summary of workout execution")
    segments_completed: int = Field(..., ge=0, description="Number completed")
    segments_skipped: int = Field(..., ge=0, description="Number skipped")
    segments_total: int = Field(..., ge=1, description="Total segments")


class ComplianceMetadata(BaseModel):
    """Metadata about the compliance analysis."""

    algorithm_version: str = Field(..., description="Version of analysis algorithm")
    power_data_quality: str = Field(..., description="Quality: excellent, good, fair, poor")
    analysis_duration_ms: int | None = Field(None, description="Time to analyze")


class ComplianceAnalysis(BaseModel):
    """Full compliance analysis for a workout."""

    overall: OverallCompliance = Field(..., description="Overall compliance summary")
    segments: list[SegmentAnalysis] = Field(..., description="Per-segment analysis")
    metadata: ComplianceMetadata = Field(..., description="Analysis metadata")


class ComplianceCoachRequest(BaseModel):
    """Request model for compliance coaching feedback."""

    # Workout context
    workout_name: str = Field(..., description="Name of the workout")
    workout_type: str = Field(..., description="Type: endurance, intervals, etc.")
    workout_date: str = Field(..., description="Date of workout (YYYY-MM-DD)")
    workout_description: str | None = Field(None, description="Workout description")

    # Athlete context
    athlete_ftp: int = Field(..., gt=0, description="Athlete FTP in watts")
    athlete_lthr: int | None = Field(None, description="Athlete LTHR in bpm")

    # Compliance analysis data
    compliance_analysis: ComplianceAnalysis = Field(
        ..., description="Full compliance analysis from web app"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "workout_name": "Tempo Intervals",
                    "workout_type": "tempo",
                    "workout_date": "2025-01-06",
                    "workout_description": "3x10min tempo intervals",
                    "athlete_ftp": 265,
                    "athlete_lthr": 170,
                    "compliance_analysis": {
                        "overall": {
                            "score": 85,
                            "grade": "B",
                            "summary": "Good execution with minor deviations",
                            "segments_completed": 5,
                            "segments_skipped": 0,
                            "segments_total": 5,
                        },
                        "segments": [],
                        "metadata": {
                            "algorithm_version": "1.0.0",
                            "power_data_quality": "excellent",
                        },
                    },
                }
            ]
        }
    }


class ComplianceCoachResponse(BaseModel):
    """Response model for compliance coaching feedback."""

    feedback: CoachFeedback = Field(..., description="AI-generated coaching feedback")
    generated_at: str = Field(..., description="ISO timestamp of generation")
    model: str = Field(..., description="LLM model used for generation")
    prompt_version: str = Field(..., description="Version of the prompt template used")
    cached: bool = Field(default=False, description="Whether response was cached")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "feedback": {
                        "summary": "Good workout execution with 85% compliance.",
                        "strengths": ["Maintained consistent tempo power"],
                        "improvements": ["Recovery intervals were too intense"],
                        "action_items": ["Set power cap alert for recovery"],
                        "segment_notes": [],
                    },
                    "generated_at": "2025-01-06T12:00:00Z",
                    "model": "gemini-2.0-flash",
                    "prompt_version": "v1.0",
                    "cached": False,
                }
            ]
        }
    }
