"""Workout compliance analysis module.

This module provides tools for analyzing cycling workout compliance by comparing
planned workouts against actual performance data.
"""

from .analyzer import ComplianceAnalyzer
from .compliance import (
    BoundedComplianceScorer,
    ComplianceScorer,
    LegacyComplianceScorer,
)
from .models import ComplianceResult, StreamPoint, WorkoutStep
from .api import analyze_activity_from_library, analyze_activity_with_coach_ai

__all__ = [
    "ComplianceAnalyzer",
    "ComplianceScorer",
    "BoundedComplianceScorer",
    "LegacyComplianceScorer",
    "ComplianceResult",
    "StreamPoint",
    "WorkoutStep",
    "analyze_activity_from_library",
    "analyze_activity_with_coach_ai",
]
