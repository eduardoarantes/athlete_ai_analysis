"""Workout compliance analysis module.

This module provides tools for analyzing cycling workout compliance by comparing
planned workouts against actual performance data.
"""

from .analyzer import ComplianceAnalyzer
from .api import analyze_activity_from_strava
from .coach_ai import generate_coach_analysis
from .compliance import (
    BoundedComplianceScorer,
    ComplianceScorer,
    LegacyComplianceScorer,
)
from .models import ComplianceResult, StreamPoint, WorkoutStep

__all__ = [
    "ComplianceAnalyzer",
    "ComplianceScorer",
    "BoundedComplianceScorer",
    "LegacyComplianceScorer",
    "ComplianceResult",
    "StreamPoint",
    "WorkoutStep",
    "analyze_activity_from_strava",
    "generate_coach_analysis",
]
