from typing import Dict, Optional

from .analyzer import ComplianceAnalyzer
from .compliance import ComplianceScorer
from .io import load_workout_steps_from_library_object
from .strava_service import StravaClient
from .coach_ai import generate_coach_analysis


def analyze_activity_from_library(
    workout: Dict[str, object],
    activity_id: int,
    strava_token: str,
    ftp: float,
    compliance_scorer: Optional[ComplianceScorer] = None,
) -> Dict[str, object]:
    """Analyze a Strava activity against a provided workout object."""
    steps, resolved_ftp = load_workout_steps_from_library_object(workout, ftp=ftp)

    client = StravaClient(strava_token)
    streams = client.get_power_streams(activity_id)

    analyzer = ComplianceAnalyzer(ftp=resolved_ftp, compliance_scorer=compliance_scorer)
    results = analyzer.analyze(steps, streams)

    workout_id = workout.get("id", "unknown")
    return {
        "workout_id": workout_id,
        "workout_name": workout.get("name", workout_id),
        "activity_id": activity_id,
        "ftp": resolved_ftp,
        "steps": steps,
        "streams": streams,
        "results": results,
    }


def analyze_activity_with_coach_ai(
    workout_id: str,
    activity_id: int,
    strava_token: str,
    workout_library_path: str,
    ftp: float,
    system_prompt_path: str = "prompts/compliance_coach_analysis_system_prompt.j2",
    user_prompt_path: str = "prompts/compliance_coach_analysis_user_prompt.j2",
    api_key: Optional[str] = None,
    model: Optional[str] = None,
    activity_meta: Optional[Dict[str, str]] = None,
    athlete_meta: Optional[Dict[str, str]] = None,
) -> Dict[str, object]:
    return generate_coach_analysis(
        activity_id=activity_id,
        workout_id=workout_id,
        strava_token=strava_token,
        workout_library_path=workout_library_path,
        ftp=ftp,
        system_prompt_path=system_prompt_path,
        user_prompt_path=user_prompt_path,
        api_key=api_key,
        model=model,
        activity_meta=activity_meta,
        athlete_meta=athlete_meta,
    )
