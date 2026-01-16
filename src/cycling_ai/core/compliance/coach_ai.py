"""
Coach AI module for generating AI-powered coaching feedback on workout compliance.

This module provides functions for analyzing workout compliance and generating
personalized coaching feedback using LLM providers.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Callable, Iterable

from .aligners import DTWAligner
from .analyzer import ComplianceAnalyzer
from .io import load_workout_steps_from_library_object
from .models import ComplianceResult, StreamPoint

logger = logging.getLogger(__name__)

# Constants for compliance analysis
WARMUP_COOLDOWN_WEIGHT = 0.5  # Weight factor for warmup/cooldown segments (less important)
WORK_SEGMENT_WEIGHT = 1.0  # Weight factor for work segments (intervals, steady state)
MAX_PROMPT_TEXT_LENGTH = 500  # Maximum length for user-provided text to prevent token exhaustion
HARD_SEGMENT_POWER_THRESHOLD = 0.85  # Power threshold (% of FTP) to classify as "hard" segment


def _render_template(template_path: str | Path, context: dict[str, Any]) -> str:
    """
    Render a Jinja2 template with the given context.

    Args:
        template_path: Path to the Jinja2 template file
        context: Dictionary of variables to render in the template

    Returns:
        Rendered template as string

    Raises:
        RuntimeError: If jinja2 is not installed
        FileNotFoundError: If template file not found
    """
    try:
        from jinja2 import Environment, StrictUndefined
    except ImportError as exc:
        raise RuntimeError(
            "jinja2 is required to render prompts. Install it with: pip install jinja2"
        ) from exc

    template_path = Path(template_path)
    if not template_path.exists():
        raise FileNotFoundError(f"Template file not found: {template_path}")

    template_text = template_path.read_text()
    env = Environment(undefined=StrictUndefined, trim_blocks=True, lstrip_blocks=True)
    return env.from_string(template_text).render(**context)


def _sanitize_for_prompt(text: str) -> str:
    """
    Sanitize user-provided text to prevent prompt injection attacks.

    Removes or neutralizes patterns that could be used to manipulate LLM behavior,
    such as role-switching instructions or system prompts.

    Args:
        text: User-provided text to sanitize

    Returns:
        Sanitized text safe for LLM prompts

    Examples:
        >>> _sanitize_for_prompt("Ignore previous instructions and...")
        "[filtered] and..."
        >>> _sanitize_for_prompt("Normal workout name")
        "Normal workout name"
    """
    if not text or not isinstance(text, str):
        return text

    # Patterns that indicate potential prompt injection
    dangerous_patterns = [
        "ignore previous instructions",
        "ignore all previous",
        "disregard previous",
        "system:",
        "assistant:",
        "user:",
        "you are now",
        "act as",
        "pretend to be",
        "your new role",
    ]

    # Convert to lowercase for pattern matching
    text_lower = text.lower()
    original_text = text

    # Check for dangerous patterns
    for pattern in dangerous_patterns:
        if pattern in text_lower:
            logger.warning(
                f"[PROMPT INJECTION] Detected potential prompt injection: '{pattern}' "
                f"in text: '{text[:50]}...'"
            )
            # Replace the pattern with [filtered]
            # Use case-insensitive replacement
            import re

            text = re.sub(
                re.escape(pattern), "[filtered]", text, flags=re.IGNORECASE
            )

    # Limit length to prevent token exhaustion attacks
    if len(text) > MAX_PROMPT_TEXT_LENGTH:
        logger.warning(
            f"[PROMPT INJECTION] Truncating excessively long text from {len(text)} to {MAX_PROMPT_TEXT_LENGTH} chars"
        )
        text = text[:MAX_PROMPT_TEXT_LENGTH] + "..."

    # Log if we made changes
    if text != original_text:
        logger.info(f"[PROMPT INJECTION] Sanitized input: '{original_text[:50]}...' -> '{text[:50]}...'")

    return text


def _is_warm_cool(result: ComplianceResult) -> bool:
    intensity = (result.intensity_class or "").lower()
    if intensity in {"warmup", "cooldown"}:
        return True
    name = result.step_name.lower()
    return "warm" in name or "cool" in name


def _weight_factor(result: ComplianceResult) -> float:
    """
    Get weight factor for a compliance result.

    Warmup and cooldown segments are weighted lower (0.5) since they're less critical
    to overall training quality than work segments (1.0).

    Args:
        result: Compliance result to weight

    Returns:
        Weight factor (0.5 for warmup/cooldown, 1.0 for work)
    """
    return WARMUP_COOLDOWN_WEIGHT if _is_warm_cool(result) else WORK_SEGMENT_WEIGHT


def _weighted_avg(
    results: Iterable[ComplianceResult], predicate: Callable[[ComplianceResult], bool]
) -> float:
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
    """
    Determine if a segment is a "hard" work segment.

    Hard segments are work segments (not warmup/cooldown) with power >= 85% FTP.
    These include tempo, threshold, and VO2max intervals.

    Args:
        result: Compliance result to check
        ftp: Athlete's FTP

    Returns:
        True if segment is hard work, False otherwise
    """
    if _is_warm_cool(result):
        return False
    return result.target_power >= ftp * HARD_SEGMENT_POWER_THRESHOLD


def _summarize_results(results: list[ComplianceResult], ftp: float) -> dict[str, float]:
    """
    Summarize compliance results with overall and segment-specific metrics.

    Args:
        results: List of compliance results for each workout step
        ftp: Athlete's Functional Threshold Power

    Returns:
        Dictionary containing summary metrics like overall compliance,
        work/warmup/cooldown compliance, and average power values
    """
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


def _data_quality(streams: list[StreamPoint]) -> dict[str, Any]:
    """
    Analyze data quality of power stream.

    Args:
        streams: List of power stream points

    Returns:
        Dictionary with data quality metrics (missing samples, zero power, gaps)
    """
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
    workout: dict[str, Any],
    results: list[ComplianceResult],
    streams: list[StreamPoint],
    ftp: float,
    alignment: dict[str, str],
    activity_meta: dict[str, str] | None = None,
    athlete_meta: dict[str, str] | None = None,
) -> dict[str, Any]:
    """
    Build context dictionary for coaching prompt templates.

    Args:
        activity_id: Strava activity ID
        workout_id: Workout identifier
        workout: Workout definition dictionary
        results: Compliance analysis results
        streams: Power stream data
        ftp: Athlete's FTP
        alignment: Alignment algorithm details
        activity_meta: Optional activity metadata (name, date)
        athlete_meta: Optional athlete metadata (name)

    Returns:
        Dictionary containing all context for prompt rendering
    """
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

    # Sanitize user-provided strings to prevent prompt injection
    activity_name = _sanitize_for_prompt(activity_meta.get("name", "Unknown"))
    athlete_name = _sanitize_for_prompt(athlete_meta.get("name", "Unknown"))
    workout_name = _sanitize_for_prompt(workout.get("name", workout_id))
    workout_description = _sanitize_for_prompt(workout.get("description") or "")

    return {
        "activity": {
            "id": activity_id,
            "name": activity_name,
            "date": activity_meta.get("date", "Unknown"),  # Date is safe
        },
        "athlete": {
            "name": athlete_name,
            "ftp_w": round(ftp, 1),
        },
        "workout": {
            "id": workout_id,  # ID is safe (generated)
            "name": workout_name,
            "type": workout.get("type", ""),  # Type is enum-like, safe
            "intent": workout_description,
        },
        "alignment": alignment,
        "summary": _summarize_results(results, ftp),
        "data_quality": _data_quality(streams),
        "segments": segments,
    }


def render_coach_prompts(
    system_prompt_path: str | Path,
    user_prompt_path: str | Path,
    context: dict[str, Any],
) -> dict[str, str]:
    """
    Render system and user prompts from templates.

    Args:
        system_prompt_path: Path to system prompt template
        user_prompt_path: Path to user prompt template
        context: Context dictionary for template rendering

    Returns:
        Dictionary with 'system_prompt' and 'user_prompt' keys
    """
    return {
        "system_prompt": _render_template(system_prompt_path, context),
        "user_prompt": _render_template(user_prompt_path, context),
    }


def call_llm_provider(
    system_prompt: str,
    user_prompt: str,
    provider_name: str = "openai",
    api_key: str | None = None,
    model: str | None = None,
    temperature: float = 0.2,
    max_tokens: int = 2048,
) -> str:
    """
    Call an LLM provider to generate coaching feedback.

    This function uses the provider system to support multiple LLM backends
    (OpenAI, Anthropic, Google Gemini, Ollama).

    Args:
        system_prompt: System prompt with coaching instructions
        user_prompt: User prompt with workout analysis context
        provider_name: Provider to use ('openai', 'anthropic', 'google', 'ollama')
        api_key: Optional API key (uses environment variable if not provided)
        model: Optional model name (uses provider default if not provided)
        temperature: Temperature for response generation
        max_tokens: Maximum tokens in response

    Returns:
        Generated coaching feedback text

    Raises:
        ValueError: If provider configuration is invalid
        RuntimeError: If API call fails
    """
    from cycling_ai.providers.base import ProviderConfig, ProviderMessage
    from cycling_ai.providers.factory import ProviderFactory

    # Create provider config
    config = ProviderConfig(
        provider_name=provider_name,
        api_key=api_key or "",  # Will be validated by factory
        model=model or "",  # Will use default if empty
        temperature=temperature,
        max_tokens=max_tokens,
    )

    # Create provider instance
    try:
        provider = ProviderFactory.create_provider(config)
    except Exception as e:
        raise ValueError(f"Failed to create provider '{provider_name}': {e}") from e

    # Create messages
    messages = [
        ProviderMessage(role="system", content=system_prompt),
        ProviderMessage(role="user", content=user_prompt),
    ]

    # Get completion
    try:
        response = provider.create_completion(messages=messages)
        return response.content
    except Exception as e:
        raise RuntimeError(f"LLM provider call failed: {e}") from e


def generate_coach_analysis(
    activity_id: int,
    workout_structure: dict[str, Any],
    power_streams: list[StreamPoint],
    ftp: float,
    system_prompt_path: str | Path,
    user_prompt_path: str | Path,
    provider_name: str = "openai",
    api_key: str | None = None,
    model: str | None = None,
    temperature: float = 0.2,
    activity_meta: dict[str, str] | None = None,
    athlete_meta: dict[str, str] | None = None,
) -> dict[str, Any]:
    """
    Generate AI-powered coaching analysis for an activity.

    This function:
    1. Parses workout structure into steps
    2. Performs DTW alignment between planned and actual power
    3. Analyzes compliance for each workout step
    4. Generates coaching feedback using an LLM provider

    Args:
        activity_id: Activity identifier (e.g., Strava activity ID)
        workout_structure: Workout structure dictionary containing:
            - id: Workout identifier
            - name: Workout name
            - type: Workout type
            - description: Workout description/intent
            - structure: Workout structure definition
        power_streams: List of power stream points (time_offset, power)
        ftp: Athlete's Functional Threshold Power
        system_prompt_path: Path to system prompt template
        user_prompt_path: Path to user prompt template
        provider_name: LLM provider name ('openai', 'anthropic', 'google', 'ollama')
        api_key: Optional API key for LLM provider
        model: Optional model name
        temperature: Temperature for LLM response generation
        activity_meta: Optional activity metadata (name, date)
        athlete_meta: Optional athlete metadata (name)

    Returns:
        Dictionary containing:
        - system_prompt: Rendered system prompt
        - user_prompt: Rendered user prompt
        - response_text: Raw LLM response
        - response_json: Parsed JSON response (if valid)
        - context: Full analysis context

    Raises:
        ValueError: If workout structure is invalid or provider configuration is invalid
        RuntimeError: If LLM provider call fails
    """
    # Load workout steps
    steps, resolved_ftp = load_workout_steps_from_library_object(workout_structure, ftp=ftp)
    streams = power_streams

    # Perform DTW alignment
    analyzer = ComplianceAnalyzer(ftp=resolved_ftp)
    planned_power = analyzer._expand_steps_to_seconds(steps)
    actual_power = [p.power for p in streams]
    planned_anchor, actual_anchor = analyzer.find_interval_anchors(planned_power, actual_power)

    aligner = DTWAligner(downsample=4, anchor=False)
    aligned_series = aligner.align_with_anchors(
        planned_power, actual_power, planned_anchor, actual_anchor
    )
    results = analyzer.analyze_with_aligned_series(steps, aligned_series)

    # Build alignment metadata
    alignment = {
        "model": "DTW Align (Constrained)",
        "params": (
            f"downsample=4, window={aligner.window}, penalty={aligner.penalty}, "
            f"psi={aligner.psi}, anchor={aligner.anchor}, "
            "anchor_search=high_ratio=0.9,min_run=45,search_window=600"
        ),
        "notes": f"planned_anchor={planned_anchor}, actual_anchor={actual_anchor}",
    }

    # Build prompt context
    workout_id = workout_structure.get("id", "unknown")
    context = build_prompt_context(
        activity_id=activity_id,
        workout_id=workout_id,
        workout=workout_structure,
        results=results,
        streams=streams,
        ftp=resolved_ftp,
        alignment=alignment,
        activity_meta=activity_meta,
        athlete_meta=athlete_meta,
    )

    # Render prompts
    prompts = render_coach_prompts(system_prompt_path, user_prompt_path, context)

    # Generate coaching feedback
    response_text = call_llm_provider(
        system_prompt=prompts["system_prompt"],
        user_prompt=prompts["user_prompt"],
        provider_name=provider_name,
        api_key=api_key,
        model=model,
        temperature=temperature,
    )

    # Try to parse as JSON
    response_json: dict[str, Any] | None = None
    try:
        response_json = json.loads(response_text)
    except json.JSONDecodeError:
        # Response is not valid JSON, keep as text
        pass

    return {
        "system_prompt": prompts["system_prompt"],
        "user_prompt": prompts["user_prompt"],
        "response_text": response_text,
        "response_json": response_json,
        "context": context,
    }
