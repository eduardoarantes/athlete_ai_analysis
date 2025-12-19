"""
AI-Powered Plan Generation Service.

Uses LLM providers to generate personalized training plans from athlete profiles.
This is a simplified approach for the web API that doesn't require CSV/FIT files.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from cycling_ai.api.config import settings
from cycling_ai.api.models.plan import AthleteProfileData, TrainingPlanRequest
from cycling_ai.core.power_zones import calculate_power_zones
from cycling_ai.providers.base import BaseProvider, ProviderConfig, ProviderMessage
from cycling_ai.providers.factory import ProviderFactory

logger = logging.getLogger(__name__)


class AIPlanService:
    """
    Service for AI-powered training plan generation.

    Uses configured LLM provider to generate personalized training plans
    based on athlete profile and plan parameters.
    """

    def __init__(self) -> None:
        """Initialize the AI plan service with provider from config."""
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
                max_tokens=settings.ai_max_tokens,
                temperature=settings.ai_temperature,
            )

            self._provider = ProviderFactory.create_provider(config)
            logger.info(f"[AI PLAN SERVICE] Created provider: {self._provider_name} with model {self._model_name}")

        return self._provider

    async def generate_plan(
        self,
        request: TrainingPlanRequest,
    ) -> dict[str, Any]:
        """
        Generate an AI-powered training plan.

        Args:
            request: Training plan request with athlete profile and parameters

        Returns:
            Dictionary with training_plan data and AI metadata

        Raises:
            ValueError: If plan generation fails
        """
        logger.info(
            f"[AI PLAN SERVICE] Starting AI plan generation: {request.weeks} weeks, target FTP: {request.target_ftp}"
        )

        try:
            provider = self._get_provider()
        except ValueError as e:
            logger.error(f"[AI PLAN SERVICE] Provider initialization failed: {e}")
            raise

        # Calculate power zones based on athlete FTP
        ftp = int(request.athlete_profile.ftp)
        power_zones = calculate_power_zones(ftp)

        # Format power zones for prompt
        zones_text = self._format_power_zones(power_zones, ftp)

        # Build athlete context
        athlete_context = self._build_athlete_context(request.athlete_profile, request)

        # Build the system prompt
        system_prompt = self._build_system_prompt()

        # Build the user message
        user_message = self._build_user_message(
            athlete_context=athlete_context,
            zones_text=zones_text,
            weeks=request.weeks,
            target_ftp=int(request.target_ftp) if request.target_ftp else None,
        )

        # Call the LLM
        logger.info("[AI PLAN SERVICE] Calling LLM for plan generation...")

        messages = [
            ProviderMessage(role="system", content=system_prompt),
            ProviderMessage(role="user", content=user_message),
        ]

        try:
            response = provider.create_completion(messages=messages, tools=None)
        except Exception as e:
            logger.error(f"[AI PLAN SERVICE] LLM call failed: {e}")
            raise ValueError(f"AI plan generation failed: {str(e)}") from e

        # Parse the response
        try:
            plan_data = self._parse_plan_response(response.content)
        except Exception as e:
            logger.error(f"[AI PLAN SERVICE] Failed to parse LLM response: {e}")
            logger.debug(f"[AI PLAN SERVICE] Raw response: {response.content[:500]}...")
            raise ValueError(f"Failed to parse training plan from AI response: {str(e)}") from e

        # Add metadata
        result = {
            "training_plan": plan_data,
            "ai_metadata": {
                "ai_provider": self._provider_name,
                "ai_model": self._model_name,
                "library_version": "1.0.0",
            },
        }

        logger.info("[AI PLAN SERVICE] Successfully generated AI training plan")
        return result

    def _format_power_zones(self, power_zones: dict[str, Any], ftp: int) -> str:
        """Format power zones for inclusion in prompt."""
        zones_text = f"**Power Zones (based on FTP {ftp}W):**\n"
        for zone_id, zone_data in power_zones.items():
            zones_text += (
                f"- **{zone_id.upper()} ({zone_data['name']})**: "
                f"{zone_data['min']}-{zone_data['max']}W "
                f"({int(zone_data['ftp_pct_min'] * 100)}-{int(zone_data['ftp_pct_max'] * 100)}% FTP)\n"
            )
        return zones_text

    def _build_athlete_context(self, profile: AthleteProfileData, request: TrainingPlanRequest) -> str:
        """Build athlete context string for the prompt."""
        context_parts = [
            f"- Current FTP: {profile.ftp}W",
            f"- Weight: {profile.weight_kg}kg",
            f"- Age: {profile.age}",
            f"- Max HR: {profile.max_hr}bpm",
        ]

        if profile.goals:
            context_parts.append(f"- Goals: {', '.join(profile.goals)}")

        if profile.experience_level:
            context_parts.append(f"- Experience: {profile.experience_level}")

        if profile.training_availability:
            avail = profile.training_availability
            if "hours_per_week" in avail:
                context_parts.append(f"- Weekly hours available: {avail['hours_per_week']}")
            if "week_days" in avail:
                context_parts.append(f"- Training days: {avail['week_days']}")

        if request.target_ftp:
            context_parts.append(f"- Target FTP: {request.target_ftp}W")

        return "\n".join(context_parts)

    def _build_system_prompt(self) -> str:
        """Build the system prompt for plan generation."""
        return """You are an expert cycling coach creating personalized training plans.

CRITICAL: You must return ONLY valid JSON. No text, no markdown, no explanations.

Training principles:
1. Progressive overload - gradually increase training stress
2. Periodization - Base (weeks 1-4), Build (weeks 5-8), Peak (weeks 9-12)
3. Recovery - include 1 recovery week every 3-4 weeks
4. 3-4 workouts per week maximum

STRICT OUTPUT RULES:
- Return ONLY valid JSON - no text before or after
- NO markdown code blocks (no ```)
- Use double quotes for all strings
- No trailing commas
- Keep descriptions SHORT (under 50 words each)
- Limit to 3-4 workouts per week
- Limit to 2-3 segments per workout

Required JSON Schema:
{
  "athlete_profile": {
    "ftp": <integer>,
    "weight_kg": <number>,
    "goals": [<string>]
  },
  "plan_metadata": {
    "total_weeks": <integer>,
    "current_ftp": <integer>,
    "target_ftp": <integer>
  },
  "weekly_plan": [
    {
      "week_number": <integer>,
      "phase": "<string: Foundation|Build|Peak|Recovery>",
      "phase_rationale": "<string>",
      "week_tss": <integer>,
      "weekly_focus": "<string>",
      "weekly_watch_points": "<string>",
      "workouts": [
        {
          "weekday": "<string: Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday>",
          "name": "<string>",
          "type": "<string: endurance|tempo|sweet_spot|threshold|vo2max|recovery|rest>",
          "description": "<string: detailed workout description>",
          "tss": <integer>,
          "segments": [
            {
              "type": "<string: warmup|interval|recovery|cooldown|steady>",
              "duration_min": <integer>,
              "power_low_pct": <number: 0-150>,
              "power_high_pct": <number: 0-150>,
              "description": "<string>"
            }
          ]
        }
      ]
    }
  ],
  "coaching_notes": "<string>",
  "monitoring_guidance": "<string>"
}"""

    def _build_user_message(
        self,
        athlete_context: str,
        zones_text: str,
        weeks: int,
        target_ftp: int | None,
    ) -> str:
        """Build the user message requesting the plan."""
        target_text = f"Target FTP: {target_ftp}W" if target_ftp else "Target: 5% FTP improvement"

        return f"""Create a {weeks}-week training plan.

Athlete:
{athlete_context}

{zones_text}

Requirements:
- {weeks} weeks total
- {target_text}
- 3-4 workouts per week (keep it simple)
- 2-3 segments per workout
- Short descriptions (1 sentence each)

Return ONLY valid JSON. No markdown. No extra text."""

    def _parse_plan_response(self, response: str) -> dict[str, Any]:
        """
        Parse the LLM response to extract the training plan.

        Args:
            response: Raw LLM response text

        Returns:
            Parsed training plan dictionary

        Raises:
            ValueError: If response cannot be parsed as valid JSON
        """
        # Try to extract JSON from the response
        response = response.strip()

        # Remove markdown code blocks if present
        if response.startswith("```json"):
            response = response[7:]
        elif response.startswith("```"):
            response = response[3:]

        if response.endswith("```"):
            response = response[:-3]

        response = response.strip()

        # Parse JSON
        plan_data: dict[str, Any]
        try:
            plan_data = json.loads(response)
        except json.JSONDecodeError as e:
            # Try to find JSON within the response
            import re

            json_match = re.search(r"\{[\s\S]*\}", response)
            if json_match:
                try:
                    plan_data = json.loads(json_match.group())
                except json.JSONDecodeError:
                    raise ValueError(f"Could not parse JSON from response: {e}") from e
            else:
                raise ValueError(f"No valid JSON found in response: {e}") from e

        # Validate required fields
        required_fields = ["athlete_profile", "plan_metadata", "weekly_plan"]
        for field in required_fields:
            if field not in plan_data:
                raise ValueError(f"Missing required field in plan: {field}")

        return plan_data

    def get_ai_metadata(self) -> dict[str, str]:
        """
        Get metadata about the AI provider being used.

        Returns:
            Dictionary with provider and model info
        """
        return {
            "ai_provider": self._provider_name,
            "ai_model": self._model_name,
            "library_version": "1.0.0",
        }
