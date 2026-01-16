import json
import os
from typing import Any, Dict, Iterable, List, Optional

import requests

from .aligners import DTWAligner
from .analyzer import ComplianceAnalyzer
from .io import load_workout_library, load_workout_steps_from_library_object
from .models import ComplianceResult, StreamPoint
from .strava_service import StravaClient


def _render_template(template_path: str, context: Dict[str, Any]) -> str:
    try:
        from jinja2 import Environment, StrictUndefined
    except ImportError as exc:
        raise RuntimeError(
            "jinja2 is required to render prompts. Install it with: pip install jinja2"
        ) from exc

    with open(template_path, "r") as f:
        template_text = f.read()

    env = Environment(undefined=StrictUndefined, trim_blocks=True, lstrip_blocks=True)
    return env.from_string(template_text).render(**context)


def _is_warm_cool(result: ComplianceResult) -> bool:
    intensity = (result.intensity_class or "").lower()
    if intensity in {"warmup", "cooldown"}:
        return True
    name = result.step_name.lower()
    return "warm" in name or "cool" in name


def _weight_factor(result: ComplianceResult) -> float:
    return 0.5 if _is_warm_cool(result) else 1.0


def _weighted_avg(results: Iterable[ComplianceResult], predicate) -> float:
    selected = [r for r in results if predicate(r)]
    total = sum(r.planned_duration for r in selected)
    if total == 0:
        return 0.0
    return sum(r.compliance_pct * r.planned_duration for r in selected) / total


def _is_recovery(result: ComplianceResult) -> bool:
    intensity = (result.intensity_class or "").lower()
    name = result.step_name.lower()
    return intensity in {"recovery", "rest"} or any(k in name for k in ["recovery", "rest", "easy"])


def _is_hard(result: ComplianceResult, ftp: float) -> bool:
    if _is_warm_cool(result):
        return False
    return result.target_power >= ftp * 0.85


def _summarize_results(results: List[ComplianceResult], ftp: float) -> Dict[str, float]:
    planned_total = sum(r.planned_duration for r in results)
    actual_total = sum(r.actual_duration for r in results)
    weighted_total = sum(r.planned_duration * _weight_factor(r) for r in results)
    if weighted_total > 0:
        weighted = sum(r.compliance_pct * r.planned_duration * _weight_factor(r) for r in results)
        overall = weighted / weighted_total
    else:
        overall = 0.0

    warmup_comp = _weighted_avg(results, lambda r: _is_warm_cool(r) and "warm" in r.step_name.lower())
    cooldown_comp = _weighted_avg(results, lambda r: _is_warm_cool(r) and "cool" in r.step_name.lower())
    work_comp = _weighted_avg(results, lambda r: not _is_warm_cool(r))
    hard_comp = _weighted_avg(results, lambda r: _is_hard(r, ftp))
    recovery_comp = _weighted_avg(results, _is_recovery)

    avg_target_power = (
        sum(r.target_power * r.planned_duration for r in results) / planned_total
        if planned_total
        else 0.0
    )
    avg_actual_power = (
        sum(r.actual_power_avg * r.actual_duration for r in results) / actual_total
        if actual_total
        else 0.0
    )

    return {
        "planned_duration_s": planned_total,
        "actual_duration_s": actual_total,
        "overall_compliance_pct": round(overall, 1),
        "work_compliance_pct": round(work_comp, 1),
        "warmup_compliance_pct": round(warmup_comp, 1),
        "cooldown_compliance_pct": round(cooldown_comp, 1),
        "hard_segments_avg_compliance_pct": round(hard_comp, 1),
        "recovery_segments_avg_compliance_pct": round(recovery_comp, 1),
        "avg_target_power_w": round(avg_target_power, 1),
        "avg_actual_power_w": round(avg_actual_power, 1),
    }


def _data_quality(streams: List[StreamPoint]) -> Dict[str, Any]:
    if not streams:
        return {"missing_samples_pct": 0.0, "zero_power_pct": 0.0, "gaps_detected": False}

    times = [p.time_offset for p in streams]
    powers = [p.power for p in streams]
    times_sorted = sorted(times)

    missing = 0
    last = times_sorted[0]
    for t in times_sorted[1:]:
        if t > last + 1:
            missing += t - last - 1
        last = t

    expected = times_sorted[-1] + 1
    missing_pct = (missing / expected * 100.0) if expected else 0.0
    zero_pct = (sum(1 for v in powers if v == 0) / len(powers) * 100.0) if powers else 0.0
    return {
        "missing_samples_pct": round(missing_pct, 2),
        "zero_power_pct": round(zero_pct, 2),
        "gaps_detected": missing > 0,
    }


def build_prompt_context(
    activity_id: int,
    workout_id: str,
    workout: Dict[str, Any],
    results: List[ComplianceResult],
    streams: List[StreamPoint],
    ftp: float,
    alignment: Dict[str, str],
    activity_meta: Optional[Dict[str, str]] = None,
    athlete_meta: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    activity_meta = activity_meta or {}
    athlete_meta = athlete_meta or {}

    segments = [
        {
            "name": r.step_name,
            "intensity_class": r.intensity_class or "",
            "planned_duration_s": r.planned_duration,
            "actual_duration_s": r.actual_duration,
            "target_power_w": round(r.target_power, 1),
            "actual_avg_power_w": round(r.actual_power_avg, 1),
            "compliance_pct": round(r.compliance_pct, 1),
        }
        for r in results
    ]

    return {
        "activity": {
            "id": activity_id,
            "name": activity_meta.get("name", "Unknown"),
            "date": activity_meta.get("date", "Unknown"),
        },
        "athlete": {
            "name": athlete_meta.get("name", "Unknown"),
            "ftp_w": round(ftp, 1),
        },
        "workout": {
            "id": workout_id,
            "name": workout.get("name", workout_id),
            "type": workout.get("type", ""),
            "intent": workout.get("description") or "",
        },
        "alignment": alignment,
        "summary": _summarize_results(results, ftp),
        "data_quality": _data_quality(streams),
        "segments": segments,
    }


def render_coach_prompts(
    system_prompt_path: str,
    user_prompt_path: str,
    context: Dict[str, Any],
) -> Dict[str, str]:
    return {
        "system_prompt": _render_template(system_prompt_path, context),
        "user_prompt": _render_template(user_prompt_path, context),
    }


def call_openai_chat(
    system_prompt: str,
    user_prompt: str,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
    api_url: Optional[str] = None,
    temperature: float = 0.2,
    timeout_s: int = 60,
) -> str:
    resolved_key = api_key or os.environ.get("OPENAI_API_KEY")
    if not resolved_key:
        raise RuntimeError("OPENAI_API_KEY is required to call the AI API.")
    resolved_model = model or os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    resolved_url = api_url or os.environ.get("OPENAI_API_URL", "https://api.openai.com/v1/chat/completions")

    payload = {
        "model": resolved_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
    }
    response = requests.post(
        resolved_url,
        headers={"Authorization": f"Bearer {resolved_key}", "Content-Type": "application/json"},
        json=payload,
        timeout=timeout_s,
    )
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"]


def generate_coach_analysis(
    activity_id: int,
    workout_id: str,
    strava_token: str,
    workout_library_path: str,
    ftp: float,
    system_prompt_path: str,
    user_prompt_path: str,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
    activity_meta: Optional[Dict[str, str]] = None,
    athlete_meta: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    library = load_workout_library(workout_library_path)
    workout = library.get(workout_id)
    if workout is None:
        raise KeyError(f"Workout id {workout_id} not found in library.")

    steps, resolved_ftp = load_workout_steps_from_library_object(workout, ftp=ftp)
    streams = StravaClient(strava_token).get_power_streams(activity_id)

    analyzer = ComplianceAnalyzer(ftp=resolved_ftp)
    planned_power = analyzer._expand_steps_to_seconds(steps)
    actual_power = [p.power for p in streams]
    planned_anchor, actual_anchor = analyzer.find_interval_anchors(planned_power, actual_power)

    aligner = DTWAligner(downsample=4, anchor=False)
    aligned_series = aligner.align_with_anchors(
        planned_power, actual_power, planned_anchor, actual_anchor
    )
    results = analyzer.analyze_with_aligned_series(steps, aligned_series)

    alignment = {
        "model": "DTW Align (Constrained)",
        "params": (
            f"downsample=4, window={aligner.window}, penalty={aligner.penalty}, "
            f"psi={aligner.psi}, anchor={aligner.anchor}, "
            "anchor_search=high_ratio=0.9,min_run=45,search_window=600"
        ),
        "notes": f"planned_anchor={planned_anchor}, actual_anchor={actual_anchor}",
    }

    context = build_prompt_context(
        activity_id=activity_id,
        workout_id=workout_id,
        workout=workout,
        results=results,
        streams=streams,
        ftp=resolved_ftp,
        alignment=alignment,
        activity_meta=activity_meta,
        athlete_meta=athlete_meta,
    )

    prompts = render_coach_prompts(system_prompt_path, user_prompt_path, context)
    response_text = call_openai_chat(
        prompts["system_prompt"], prompts["user_prompt"], api_key=api_key, model=model
    )

    try:
        response_json = json.loads(response_text)
    except json.JSONDecodeError:
        response_json = None

    return {
        "system_prompt": prompts["system_prompt"],
        "user_prompt": prompts["user_prompt"],
        "response_text": response_text,
        "response_json": response_json,
        "context": context,
    }
