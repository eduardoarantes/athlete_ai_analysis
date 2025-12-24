"""
AI-Powered Plan Generation Service.

Uses LLM providers to generate personalized training plans from athlete profiles.
This is a simplified approach for the web API that doesn't require CSV/FIT files.

Supports two workout sources:
- "library": LLM generates plan structure, library provides workouts (fast, 0 tokens for workouts)
- "llm": LLM generates entire plan including workouts (flexible, more tokens)
"""

from __future__ import annotations

import json
import logging
import tempfile
from pathlib import Path
from typing import Any

from cycling_ai.api.config import settings
from cycling_ai.api.models.plan import AthleteProfileData, TrainingPlanRequest
from cycling_ai.config.loader import load_config
from cycling_ai.core.power_zones import calculate_power_zones
from cycling_ai.orchestration.prompt_loader import PromptLoader
from cycling_ai.providers.base import BaseProvider, ProviderConfig, ProviderMessage
from cycling_ai.providers.factory import ProviderFactory
from cycling_ai.tools.wrappers.plan_overview_tool import PlanOverviewTool

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

    def _validate_request(self, request: TrainingPlanRequest) -> None:
        """
        Validate that the request has all required fields.

        Args:
            request: Training plan request to validate

        Raises:
            ValueError: If required fields are missing
        """
        profile = request.athlete_profile

        # Validate training availability
        if not profile.training_availability:
            raise ValueError("Training availability is required. Please configure your available training days and hours.")

        if "week_days" not in profile.training_availability:
            raise ValueError("Training days (week_days) are required. Please configure your available training days.")

        days = profile.training_availability["week_days"]
        if (isinstance(days, list) and not days) or (isinstance(days, str) and not days.strip()):
            raise ValueError("At least one training day is required.")

        if "hours_per_week" not in profile.training_availability:
            raise ValueError("Weekly training hours are required. Please configure your available hours per week.")

        logger.debug(f"[AI PLAN SERVICE] Request validation passed: {len(days)} training days configured")

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
            ValueError: If plan generation fails or required fields are missing
        """
        # Early validation of required fields
        self._validate_request(request)

        workout_source = settings.workout_source
        logger.info(
            f"[AI PLAN SERVICE] Starting plan generation: {request.weeks} weeks, "
            f"target FTP: {request.target_ftp}, workout_source: {workout_source}"
        )

        if workout_source == "library":
            return await self._generate_plan_with_library(request)
        else:
            return await self._generate_plan_with_llm(request)

    async def _generate_plan_with_library(
        self,
        request: TrainingPlanRequest,
    ) -> dict[str, Any]:
        """
        Generate plan using LLM for structure + library for workouts.

        This is the hybrid approach:
        1. LLM generates weekly overview (plan structure) via tool calling
        2. Library selects specific workouts (no LLM tokens)

        Args:
            request: Training plan request

        Returns:
            Dictionary with training_plan data and AI metadata
        """
        from cycling_ai.orchestration.phases.training_planning_library import LibraryBasedTrainingPlanningWeeks

        logger.info("[AI PLAN SERVICE] Using library-based workout selection")

        try:
            provider = self._get_provider()
        except ValueError as e:
            logger.error(f"[AI PLAN SERVICE] Provider initialization failed: {e}")
            raise

        # Step 1: Use LLM to generate weekly overview via tool calling
        logger.info("[AI PLAN SERVICE] Step 1: Generating weekly overview with LLM...")

        # Create temp athlete profile file (required by prompts)
        athlete_profile_path = self._create_temp_athlete_profile(request)

        try:
            # Build prompt parameters
            prompt_params = self._build_overview_prompt_params(request, athlete_profile_path)

            # Load prompts from external files (version from .cycling-ai.yaml)
            config = load_config()
            prompt_loader = PromptLoader(version=config.version)
            system_prompt = prompt_loader.get_training_planning_overview_prompt(**prompt_params)
            user_message = prompt_loader.get_training_planning_overview_user_prompt(**prompt_params)

            # Get tool definition
            overview_tool = PlanOverviewTool()
            tool_definition = overview_tool.definition

            # Call LLM with tool
            messages = [
                ProviderMessage(role="system", content=system_prompt),
                ProviderMessage(role="user", content=user_message),
            ]

            logger.info("[AI PLAN SERVICE] Calling LLM with create_plan_overview tool...")
            response = provider.create_completion(
                messages=messages,
                tools=[tool_definition],
                force_tool_call=True,
            )

            # Extract tool call arguments
            if not response.tool_calls or len(response.tool_calls) == 0:
                raise ValueError("LLM did not call create_plan_overview tool")

            tool_call = response.tool_calls[0]
            tool_args = tool_call.get("arguments", {})

            logger.info(f"[AI PLAN SERVICE] LLM called tool with {len(tool_args)} arguments")

            # Execute the tool with LLM-provided arguments
            overview_result = overview_tool.execute(**tool_args)

            if not overview_result.success:
                errors = overview_result.errors or ["Unknown error"]
                raise ValueError(f"Failed to generate weekly overview: {', '.join(errors)}")

            # Extract plan_id from result
            result_data = overview_result.data
            if not isinstance(result_data, dict):
                raise ValueError("Tool result data is not a dictionary")
            plan_id = result_data.get("plan_id")
            if not plan_id:
                raise ValueError("Tool result missing plan_id")

            logger.info(f"[AI PLAN SERVICE] Step 1 complete: Overview generated with plan_id={plan_id}")

        finally:
            # Clean up temp athlete profile
            Path(athlete_profile_path).unlink(missing_ok=True)

        # Step 2: Use library to select workouts
        logger.info("[AI PLAN SERVICE] Step 2: Selecting workouts from library...")

        library_phase = LibraryBasedTrainingPlanningWeeks(temperature=0.5)
        library_result = library_phase.execute(plan_id=plan_id)

        if not library_result.get("success"):
            raise ValueError("Failed to select workouts from library")

        logger.info(f"[AI PLAN SERVICE] Step 2 complete: {library_result.get('weeks_added')} weeks added")

        # Step 3: Assemble the finalized plan from overview + week files
        logger.info("[AI PLAN SERVICE] Step 3: Assembling plan from overview and week files...")

        overview_path = Path("/tmp") / f"{plan_id}_overview.json"
        if not overview_path.exists():
            raise ValueError(f"Plan overview not found: {overview_path}")

        with open(overview_path) as f:
            overview_data = json.load(f)

        # Load and combine all week details
        weekly_plan = []
        for week_num in range(1, request.weeks + 1):
            week_path = Path("/tmp") / f"{plan_id}_week_{week_num}.json"
            if not week_path.exists():
                raise ValueError(f"Week {week_num} file not found: {week_path}")

            with open(week_path) as f:
                week_data = json.load(f)

            # Get overview metadata for this week
            week_overview = overview_data["weekly_overview"][week_num - 1]

            # Merge: week metadata from overview + workouts from week file
            merged_week = {
                "week_number": week_num,
                "phase": week_overview.get("phase"),
                "phase_rationale": week_overview.get("phase_rationale"),
                "weekly_focus": week_overview.get("weekly_focus"),
                "weekly_watch_points": week_overview.get("weekly_watch_points"),
                "week_tss": week_overview.get("target_tss", 0),
                "workouts": week_data.get("workouts", []),
            }
            weekly_plan.append(merged_week)

        logger.info(f"[AI PLAN SERVICE] Assembled {len(weekly_plan)} weeks into plan")

        # Build complete plan structure matching TypeScript TrainingPlanData interface
        plan_data = {
            "athlete_profile": {
                "ftp": request.athlete_profile.ftp,
                "weight_kg": request.athlete_profile.weight_kg,
                "max_hr": request.athlete_profile.max_hr,
                "age": request.athlete_profile.age,
                "goals": request.athlete_profile.goals or ["General fitness"],
            },
            "plan_metadata": {
                "total_weeks": request.weeks,
                "current_ftp": request.athlete_profile.ftp,
                "target_ftp": request.target_ftp or request.athlete_profile.ftp * 1.05,
            },
            "coaching_notes": overview_data.get("coaching_notes", ""),
            "monitoring_guidance": overview_data.get("monitoring_guidance", ""),
            "weekly_plan": weekly_plan,
        }

        # Clean up temporary files
        overview_path.unlink(missing_ok=True)
        for week_num in range(1, request.weeks + 1):
            week_path = Path("/tmp") / f"{plan_id}_week_{week_num}.json"
            week_path.unlink(missing_ok=True)

        # Add metadata
        result = {
            "training_plan": plan_data,
            "ai_metadata": {
                "ai_provider": self._provider_name,
                "ai_model": self._model_name,
                "workout_source": "library",
                "library_version": "1.0.0",
            },
        }

        logger.info("[AI PLAN SERVICE] Successfully generated training plan with library workouts")
        return result

    def _create_temp_athlete_profile(self, request: TrainingPlanRequest) -> str:
        """Create a temporary athlete profile JSON file for the prompts."""
        profile = request.athlete_profile
        profile_data = {
            "ftp": profile.ftp,
            "weight_kg": profile.weight_kg,
            "max_hr": profile.max_hr,
            "age": profile.age,
            "goals": profile.goals or ["General fitness"],
            "experience_level": profile.experience_level,
            "training_availability": profile.training_availability or {
                "hours_per_week": 7,
                "week_days": ["Tuesday", "Thursday", "Saturday", "Sunday"],
            },
        }

        # Create temp file
        fd, path = tempfile.mkstemp(suffix=".json", prefix="athlete_profile_")
        with open(fd, "w") as f:
            json.dump(profile_data, f, indent=2)

        return path

    def _build_overview_prompt_params(
        self,
        request: TrainingPlanRequest,
        athlete_profile_path: str,
    ) -> dict[str, Any]:
        """Build parameters for the training planning overview prompts."""
        profile = request.athlete_profile
        ftp = int(profile.ftp)

        # Calculate power zones
        power_zones = calculate_power_zones(ftp)
        zones_text = self._format_power_zones(power_zones, ftp)

        # Get training availability
        available_days = self._get_training_days_list(profile)
        weekly_hours = self._get_weekly_hours(profile)

        # Build prompt parameters matching what the prompts expect
        return {
            "training_plan_weeks": str(request.weeks),
            "athlete_profile_path": athlete_profile_path,
            "power_zones": zones_text,
            "available_days": ", ".join(available_days),
            "num_available_days": str(len(available_days)),
            "weekly_time_budget_hours": str(weekly_hours),
            "daily_time_caps_json": "None",
            "goals": ", ".join(profile.goals) if profile.goals else "General fitness",
            "current_training_status": profile.experience_level or "intermediate",
            "performance_summary": "No historical performance data available (new plan from web).",
        }

    def _get_training_days_list(self, profile: AthleteProfileData) -> list[str]:
        """
        Extract training days as a list from profile.

        Raises:
            ValueError: If training days are not configured in the profile
        """
        if not profile.training_availability:
            raise ValueError("Training availability is required. Please configure your available training days.")
        if "week_days" not in profile.training_availability:
            raise ValueError("Training days (week_days) are required. Please configure your available training days.")

        days = profile.training_availability["week_days"]
        if isinstance(days, list):
            if not days:
                raise ValueError("At least one training day is required.")
            return days
        elif isinstance(days, str):
            day_list = [d.strip() for d in days.split(",") if d.strip()]
            if not day_list:
                raise ValueError("At least one training day is required.")
            return day_list
        else:
            raise ValueError(f"Invalid training days format: expected list or comma-separated string, got {type(days).__name__}")

    async def _generate_plan_with_llm(
        self,
        request: TrainingPlanRequest,
    ) -> dict[str, Any]:
        """
        Generate entire plan using LLM (original behavior).

        Args:
            request: Training plan request

        Returns:
            Dictionary with training_plan data and AI metadata
        """
        logger.info("[AI PLAN SERVICE] Using full LLM generation")

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
                "workout_source": "llm",
                "library_version": "1.0.0",
            },
        }

        logger.info("[AI PLAN SERVICE] Successfully generated AI training plan")
        return result

    def _get_weekly_hours(self, profile: AthleteProfileData) -> float:
        """
        Extract weekly hours from profile.

        Raises:
            ValueError: If weekly hours are not configured in the profile
        """
        if not profile.training_availability:
            raise ValueError("Training availability is required.")
        if "hours_per_week" not in profile.training_availability:
            raise ValueError("Weekly training hours are required. Please configure your available hours per week.")

        hours = profile.training_availability["hours_per_week"]
        try:
            hours_float = float(hours)
            if hours_float <= 0:
                raise ValueError("Weekly training hours must be greater than 0.")
            return hours_float
        except (TypeError, ValueError) as e:
            raise ValueError(f"Invalid weekly hours format: {hours}") from e

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
