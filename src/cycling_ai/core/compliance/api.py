"""High-level API functions for compliance analysis."""

from __future__ import annotations

import os
from typing import Any

from .analyzer import ComplianceAnalyzer
from .compliance import ComplianceScorer
from .io import load_workout_steps_from_library_object
from .strava_service import StravaClient


def analyze_activity_from_strava(
    workout: dict[str, Any],
    activity_id: int,
    ftp: float,
    compliance_scorer: ComplianceScorer | None = None,
) -> dict[str, Any]:
    """
    Analyze a Strava activity against a provided workout structure.

    Strava access token is read from STRAVA_ACCESS_TOKEN environment variable.

    Args:
        workout: Workout structure dictionary
        activity_id: Strava activity ID
        ftp: Athlete's FTP
        compliance_scorer: Optional custom compliance scorer

    Returns:
        Dictionary with analysis results

    Raises:
        ValueError: If STRAVA_ACCESS_TOKEN not set in environment
    """
    strava_token = os.environ.get("STRAVA_ACCESS_TOKEN")
    if not strava_token:
        raise ValueError(
            "STRAVA_ACCESS_TOKEN environment variable not set. "
            "Cannot fetch activity data from Strava."
        )

    steps, resolved_ftp = load_workout_steps_from_library_object(workout, ftp=ftp)

    client = StravaClient(strava_token)
    streams = client.get_power_streams(activity_id)

    analyzer = ComplianceAnalyzer(ftp=resolved_ftp, compliance_scorer=compliance_scorer)
    results = analyzer.analyze(steps, streams)

    workout_id = str(workout.get("id", "unknown"))
    return {
        "workout_id": workout_id,
        "workout_name": str(workout.get("name", workout_id)),
        "activity_id": activity_id,
        "ftp": resolved_ftp,
        "steps": steps,
        "streams": streams,
        "results": results,
    }


