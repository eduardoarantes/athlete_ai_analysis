"""
Compliance Coach Service.

Generates AI-powered coaching feedback for workout compliance analysis.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

from cycling_ai.api.config import settings
from cycling_ai.api.models.coach import (
    CoachFeedback,
    ComplianceCoachRequest,
    ComplianceCoachResponse,
    SegmentNote,
)
from cycling_ai.config.loader import load_config
from cycling_ai.orchestration.prompt_loader import PromptLoader
from cycling_ai.providers.base import BaseProvider, ProviderConfig, ProviderMessage
from cycling_ai.providers.factory import ProviderFactory

logger = logging.getLogger(__name__)


class ComplianceCoachService:
    """
    Service for generating AI coaching feedback on workout compliance.

    Uses LLM to analyze compliance data and provide personalized,
    actionable feedback to help athletes improve their training execution.
    """

    def __init__(self) -> None:
        """Initialize the coach service with provider from config."""
        self._provider: BaseProvider | None = None
        self._provider_name = settings.ai_provider
        self._model_name = settings.get_default_model()

    def _get_provider(self) -> BaseProvider:
        """
        Get or create the LLM provider instance.

        Returns:
            Initialized provider instance

        Raises:
            ValueError: If provider cannot be created (missing API key)
        """
        if self._provider is None:
            api_key = settings.get_provider_api_key()
            if not api_key:
                raise ValueError(
                    f"No API key configured for provider '{self._provider_name}'. "
                    f"Set the appropriate environment variable "
                    f"(ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY)."
                )

            config = ProviderConfig(
                provider_name=self._provider_name,
                api_key=api_key,
                model=self._model_name,
                max_tokens=2048,  # Coach feedback is shorter than training plans
                temperature=0.7,
            )

            self._provider = ProviderFactory.create_provider(config)
            logger.info(
                f"[COACH SERVICE] Created provider: {self._provider_name} "
                f"with model {self._model_name}"
            )

        return self._provider

    def _format_segment_details(self, request: ComplianceCoachRequest) -> str:
        """
        Format segment analysis data for the prompt.

        Args:
            request: Coach request with compliance analysis

        Returns:
            Formatted string of segment details
        """
        segments = request.compliance_analysis.segments
        if not segments:
            return "No segment details available."

        lines = []
        for seg in segments:
            lines.append(f"### Segment {seg.segment_index + 1}: {seg.segment_name}")
            lines.append(f"**Type:** {seg.segment_type}")
            lines.append(f"**Match Quality:** {seg.match_quality}")
            lines.append("")

            # Planned values
            lines.append("**Planned:**")
            planned_duration_min = seg.planned_duration_sec / 60
            lines.append(f"- Duration: {planned_duration_min:.1f} min")
            lines.append(f"- Power: {seg.planned_power_low}-{seg.planned_power_high}W")
            lines.append(f"- Target Zone: Z{seg.planned_zone}")
            lines.append("")

            # Actual values
            if seg.match_quality == "skipped":
                lines.append("**Actual:** SKIPPED")
            else:
                lines.append("**Actual:**")
                if seg.actual_duration_sec is not None:
                    actual_duration_min = seg.actual_duration_sec / 60
                    lines.append(f"- Duration: {actual_duration_min:.1f} min")
                if seg.actual_avg_power is not None:
                    lines.append(f"- Avg Power: {seg.actual_avg_power:.0f}W")
                if seg.actual_dominant_zone is not None:
                    lines.append(f"- Dominant Zone: Z{seg.actual_dominant_zone}")
            lines.append("")

            # Scores
            lines.append("**Scores:**")
            lines.append(f"- Power Compliance: {seg.power_compliance:.0f}%")
            lines.append(f"- Zone Compliance: {seg.zone_compliance:.0f}%")
            lines.append(f"- Duration Compliance: {seg.duration_compliance:.0f}%")
            lines.append(f"- Overall: {seg.overall_segment_score:.0f}%")
            lines.append("")

            # Assessment
            lines.append(f"**Assessment:** {seg.assessment}")
            lines.append("")
            lines.append("---")
            lines.append("")

        return "\n".join(lines)

    def _build_prompt_params(self, request: ComplianceCoachRequest) -> dict[str, Any]:
        """
        Build prompt parameters from request.

        Args:
            request: Coach request

        Returns:
            Dictionary of prompt parameters
        """
        analysis = request.compliance_analysis
        overall = analysis.overall
        metadata = analysis.metadata

        return {
            "workout_name": request.workout_name,
            "workout_type": request.workout_type,
            "workout_date": request.workout_date,
            "workout_description": request.workout_description or "No description provided",
            "athlete_ftp": str(request.athlete_ftp),
            "athlete_lthr": str(request.athlete_lthr) if request.athlete_lthr else "Not set",
            "overall_score": str(overall.score),
            "overall_grade": overall.grade,
            "overall_summary": overall.summary,
            "segments_completed": str(overall.segments_completed),
            "segments_skipped": str(overall.segments_skipped),
            "segments_total": str(overall.segments_total),
            "power_data_quality": metadata.power_data_quality,
            "power_stream_length": str(
                sum(s.actual_duration_sec or 0 for s in analysis.segments)
            ),
            "segment_details": self._format_segment_details(request),
        }

    def _parse_feedback_response(self, content: str) -> CoachFeedback:
        """
        Parse LLM response into CoachFeedback model.

        Args:
            content: LLM response content (expected to be JSON)

        Returns:
            Parsed CoachFeedback

        Raises:
            ValueError: If response cannot be parsed
        """
        # Clean up the response - remove markdown code blocks if present
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        try:
            data = json.loads(content)
        except json.JSONDecodeError as e:
            logger.error(f"[COACH SERVICE] Failed to parse JSON response: {e}")
            logger.error(f"[COACH SERVICE] Raw content: {content[:500]}")
            raise ValueError(f"Failed to parse coaching feedback: {e}") from e

        # Parse segment notes
        segment_notes = []
        for note_data in data.get("segment_notes", []):
            segment_notes.append(
                SegmentNote(
                    segment_index=note_data.get("segment_index", 0),
                    note=note_data.get("note", ""),
                )
            )

        return CoachFeedback(
            summary=data.get("summary", ""),
            strengths=data.get("strengths", []),
            improvements=data.get("improvements", []),
            action_items=data.get("action_items", []),
            segment_notes=segment_notes,
        )

    async def generate_feedback(
        self,
        request: ComplianceCoachRequest,
    ) -> ComplianceCoachResponse:
        """
        Generate AI coaching feedback for workout compliance.

        Args:
            request: Coach request with compliance analysis data

        Returns:
            ComplianceCoachResponse with AI-generated feedback

        Raises:
            ValueError: If feedback generation fails
        """
        logger.info(
            f"[COACH SERVICE] Generating feedback for workout: {request.workout_name}, "
            f"score: {request.compliance_analysis.overall.score}"
        )

        # Load prompts
        config = load_config()
        prompt_loader = PromptLoader(version=config.version)

        system_prompt = prompt_loader.get_compliance_coach_prompt()
        prompt_params = self._build_prompt_params(request)
        user_prompt = prompt_loader.get_compliance_coach_user_prompt(**prompt_params)

        # Create messages
        messages = [
            ProviderMessage(role="system", content=system_prompt),
            ProviderMessage(role="user", content=user_prompt),
        ]

        # Get provider and create completion
        provider = self._get_provider()
        response = provider.create_completion(messages=messages)

        # Parse response
        feedback = self._parse_feedback_response(response.content)

        logger.info(
            f"[COACH SERVICE] Generated feedback with {len(feedback.strengths)} strengths, "
            f"{len(feedback.improvements)} improvements, "
            f"{len(feedback.action_items)} action items"
        )

        return ComplianceCoachResponse(
            feedback=feedback,
            generated_at=datetime.now(UTC).isoformat(),
            model=self._model_name,
            prompt_version=prompt_loader.version,
            cached=False,
        )
