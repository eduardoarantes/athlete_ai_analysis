"""Pydantic models for performance analysis JSON output."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class AthleteProfile(BaseModel):
    """Athlete profile information."""

    name: str = Field(..., description="Athlete's name")
    current_ftp: int = Field(..., description="Current Functional Threshold Power in watts")
    weight: float = Field(..., description="Weight in kilograms")
    w_kg: float = Field(..., description="Watts per kilogram (FTP/weight)")
    age: int | None = Field(None, description="Athlete's age")
    experience_level: str | None = Field(None, description="Experience level (e.g., Beginner, Intermediate, Advanced)")


class PerformanceMetric(BaseModel):
    """A single performance comparison metric."""

    metric: str = Field(..., description="Name of the metric")
    previous: str = Field(..., description="Value in previous period")
    current: str = Field(..., description="Value in current period")
    change: str = Field(..., description="Change description (e.g., '+13W (+7.0%)')")
    trend: Literal["up", "down", "neutral"] = Field(..., description="Trend direction")


class ZoneDistribution(BaseModel):
    """Training zone distribution data."""

    zone: int = Field(..., ge=1, le=7, description="Zone number (1-7)")
    name: str = Field(..., description="Zone name (e.g., Recovery, Endurance)")
    percentage: float = Field(..., ge=0, le=100, description="Percentage of time in this zone")
    hours: float = Field(..., ge=0, description="Total hours in this zone")


class KeyTrend(BaseModel):
    """A key performance trend with title and description."""

    title: str = Field(..., description="Trend title")
    description: str = Field(..., description="Detailed trend description")


class Insight(BaseModel):
    """A training insight or observation."""

    title: str = Field(..., description="Insight title")
    description: str = Field(..., description="Detailed insight description")


class Recommendation(BaseModel):
    """A training recommendation."""

    text: str = Field(..., description="Recommendation text")


class RecommendationCategories(BaseModel):
    """Categorized recommendations."""

    short_term: list[Recommendation] = Field(
        default_factory=list, description="Short-term focus recommendations (next 4 weeks)"
    )
    long_term: list[Recommendation] = Field(
        default_factory=list, description="Long-term goals (3-6 months)"
    )
    recovery_nutrition: list[Recommendation] = Field(
        default_factory=list, description="Recovery and nutrition recommendations"
    )


class ActivityDistribution(BaseModel):
    """Distribution of activities by category."""

    category: str = Field(..., description="Activity category (e.g., Cycling, Strength, Cardio)")
    count: int = Field(..., ge=0, description="Number of activities in this category")
    percentage: float = Field(..., ge=0, le=100, description="Percentage of total activities")


class LoadBalance(BaseModel):
    """Training load balance across activity categories."""

    cycling_percent: float = Field(..., ge=0, le=100, description="Percentage of load from cycling")
    strength_percent: float = Field(..., ge=0, le=100, description="Percentage of load from strength training")
    cardio_percent: float = Field(..., ge=0, le=100, description="Percentage of load from cardio activities")
    assessment: str = Field(..., description="Assessment of load balance appropriateness")


class InterferenceEvent(BaseModel):
    """A detected interference event between activities."""

    date: str = Field(..., description="Date of interference event (YYYY-MM-DD)")
    activity1: str = Field(..., description="First activity name")
    activity2: str = Field(..., description="Second activity name")
    hours_between: float = Field(..., ge=0, description="Hours between activities")
    score: int = Field(..., ge=0, le=10, description="Interference severity score (0-10)")
    explanation: str = Field(..., description="Explanation of why this is an interference")


class CrossTrainingAnalysis(BaseModel):
    """Cross-training impact analysis data."""

    analyzed: bool = Field(..., description="Whether cross-training analysis was performed")
    activity_distribution: list[ActivityDistribution] = Field(
        default_factory=list, description="Distribution of activities by category"
    )
    load_balance: LoadBalance | None = Field(
        None, description="Training load balance across categories"
    )
    interference_events: list[InterferenceEvent] = Field(
        default_factory=list, description="Detected activity interference events"
    )
    recommendations: list[Recommendation] = Field(
        default_factory=list, description="Cross-training specific recommendations"
    )


class PerformanceAnalysis(BaseModel):
    """Complete performance analysis report structure."""

    athlete_profile: AthleteProfile = Field(..., description="Athlete profile information")
    performance_comparison: list[PerformanceMetric] = Field(
        ..., description="Performance metrics comparison"
    )
    time_in_zones: list[ZoneDistribution] = Field(
        ..., description="Training zone distribution"
    )
    key_trends: list[KeyTrend] = Field(..., description="Key performance trends")
    insights: list[Insight] = Field(..., description="Training insights")
    recommendations: RecommendationCategories = Field(..., description="Training recommendations")
    cross_training: CrossTrainingAnalysis | None = Field(
        None, description="Cross-training impact analysis (optional, only if athlete does multiple sports)"
    )
    analysis_period_months: int = Field(
        default=6, description="Number of months analyzed"
    )

    class Config:
        """Pydantic configuration."""

        json_schema_extra = {
            "example": {
                "athlete_profile": {
                    "name": "Eduardo Arantes",
                    "current_ftp": 260,
                    "weight": 75.0,
                    "w_kg": 3.47,
                    "age": 35,
                    "experience_level": "Advanced",
                },
                "performance_comparison": [
                    {
                        "metric": "Average Power",
                        "previous": "185W",
                        "current": "198W",
                        "change": "+13W (+7.0%)",
                        "trend": "up",
                    }
                ],
                "time_in_zones": [
                    {
                        "zone": 1,
                        "name": "Recovery",
                        "percentage": 35.0,
                        "hours": 42.0,
                    }
                ],
                "key_trends": [
                    {
                        "title": "Aerobic Base Development",
                        "description": "Significant increase in Zone 2 training volume...",
                    }
                ],
                "insights": [
                    {
                        "title": "Polarized Training Distribution",
                        "description": "Your current 80/20 split...",
                    }
                ],
                "recommendations": {
                    "short_term": [
                        {"text": "Maintain current Zone 2 volume to continue aerobic development"}
                    ],
                    "long_term": [
                        {"text": "Target FTP increase of 10-15W through focused threshold work"}
                    ],
                    "recovery_nutrition": [
                        {"text": "Prioritize 8+ hours of sleep during high-load weeks"}
                    ],
                },
                "analysis_period_months": 6,
            }
        }
