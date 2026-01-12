"""
Plan Service Layer.

Service that wraps TrainingPlanTool for FastAPI integration.
Converts API request models to tool parameters and handles async execution.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from cycling_ai.api.models.plan import AthleteProfileData, TrainingPlanRequest
from cycling_ai.core.athlete import load_athlete_profile
from cycling_ai.tools.wrappers.training_plan_tool import TrainingPlanTool

logger = logging.getLogger(__name__)


class PlanService:
    """
    Service for training plan generation.

    Wraps the existing TrainingPlanTool and provides async API for FastAPI integration.
    """

    def __init__(self) -> None:
        """Initialize PlanService with TrainingPlanTool."""
        self.tool = TrainingPlanTool()

    async def generate_plan(
        self,
        request: TrainingPlanRequest,
        athlete_profile_path: Path,
    ) -> dict[str, Any]:
        """
        Generate training plan from API request.

        Args:
            request: TrainingPlanRequest with athlete profile and plan parameters
            athlete_profile_path: Path to athlete profile JSON file (for tool compatibility)

        Returns:
            Dictionary with training_plan and metadata

        Raises:
            ValueError: If profile file not found or plan generation fails
        """
        logger.info(f"[PLAN SERVICE] Starting plan generation for {request.weeks} weeks")

        # Validate profile path exists
        if not athlete_profile_path.exists():
            raise ValueError(f"Athlete profile not found at path: {athlete_profile_path}")

        # Load athlete profile to get current FTP
        try:
            athlete_profile = load_athlete_profile(athlete_profile_path)
            logger.info(f"[PLAN SERVICE] Loaded athlete profile: {athlete_profile.name}, FTP: {athlete_profile.ftp}")
        except Exception as e:
            logger.error(f"[PLAN SERVICE] Failed to load athlete profile: {str(e)}")
            raise ValueError(f"Error loading athlete profile: {str(e)}") from e

        # Calculate target FTP if not provided
        target_ftp = request.target_ftp
        if target_ftp is None:
            # Default: 5% increase over current FTP
            target_ftp = float(athlete_profile.ftp * 1.05)
            logger.info(
                f"[PLAN SERVICE] No target FTP provided, using default: {target_ftp:.1f}W "
                f"(5% increase from {athlete_profile.ftp}W)"
            )

        # Generate minimal weekly plan structure for tool
        # The LLM agent will fill in the actual workouts
        weekly_plan = self._create_skeleton_weekly_plan(request.weeks)

        # Call tool synchronously (tool is not async)
        logger.info("[PLAN SERVICE] Calling TrainingPlanTool.execute()")
        result = self.tool.execute(
            athlete_profile_json=str(athlete_profile_path),
            total_weeks=request.weeks,
            target_ftp=target_ftp,
            weekly_plan=weekly_plan,
            coaching_notes="Generated via API",
            monitoring_guidance="Monitor power zones and recovery metrics",
        )

        # Check if tool execution succeeded
        if not result.success:
            error_msg = "; ".join(result.errors) if result.errors else "Unknown error"
            logger.error(f"[PLAN SERVICE] Tool execution failed: {error_msg}")
            raise ValueError(f"Plan generation failed: {error_msg}")

        logger.info("[PLAN SERVICE] Tool execution successful")

        # Extract result data
        if result.data is None:
            raise ValueError("Tool returned success but no data")

        # Type assertion for mypy - result.data is confirmed to be dict[str, Any]
        return dict(result.data)

    def _create_skeleton_weekly_plan(self, total_weeks: int) -> list[dict[str, Any]]:
        """
        Create minimal weekly plan structure.

        This is a skeleton that will be filled by the LLM agent.
        For the service layer, we provide a minimal structure to satisfy the tool.

        Args:
            total_weeks: Number of weeks in the plan

        Returns:
            List of week dictionaries with minimal structure
        """
        weekly_plan = []

        for week_num in range(1, total_weeks + 1):
            # Determine phase based on week number
            phase = self._determine_phase(week_num, total_weeks)

            week_data = {
                "week_number": week_num,
                "phase": phase,
                "phase_rationale": f"Week {week_num} of {total_weeks}: {phase} phase",
                "workouts": [
                    {
                        "weekday": "Monday",
                        "name": "Base Endurance",
                        "detailed_description": (
                            "Foundation ride focusing on aerobic development. "
                            "Maintain steady effort in Zone 2 for metabolic adaptation. "
                            "Benefits: Builds aerobic base, improves fat oxidation, "
                            "develops mitochondrial density. "
                            "Execution: Ride at conversational pace, focus on smooth pedaling."
                        ),
                        "structure": {
                            "primaryIntensityMetric": "percentOfFtp",
                            "primaryLengthMetric": "duration",
                            "structure": [
                                {
                                    "type": "step",
                                    "length": {"unit": "repetition", "value": 1},
                                    "steps": [
                                        {
                                            "name": "Warmup",
                                            "intensityClass": "warmUp",
                                            "length": {"unit": "minute", "value": 10},
                                            "targets": [
                                                {
                                                    "type": "power",
                                                    "minValue": 50.0,
                                                    "maxValue": 60.0,
                                                    "unit": "percentOfFtp",
                                                }
                                            ],
                                        }
                                    ],
                                },
                                {
                                    "type": "step",
                                    "length": {"unit": "repetition", "value": 1},
                                    "steps": [
                                        {
                                            "name": "Steady endurance effort",
                                            "intensityClass": "active",
                                            "length": {"unit": "minute", "value": 60},
                                            "targets": [
                                                {
                                                    "type": "power",
                                                    "minValue": 65.0,
                                                    "maxValue": 75.0,
                                                    "unit": "percentOfFtp",
                                                }
                                            ],
                                        }
                                    ],
                                },
                                {
                                    "type": "step",
                                    "length": {"unit": "repetition", "value": 1},
                                    "steps": [
                                        {
                                            "name": "Cooldown",
                                            "intensityClass": "coolDown",
                                            "length": {"unit": "minute", "value": 10},
                                            "targets": [
                                                {
                                                    "type": "power",
                                                    "minValue": 50.0,
                                                    "maxValue": 60.0,
                                                    "unit": "percentOfFtp",
                                                }
                                            ],
                                        }
                                    ],
                                },
                            ],
                        },
                    }
                ],
                "weekly_focus": f"{phase} phase development",
                "weekly_watch_points": "Monitor recovery and adaptation",
            }

            weekly_plan.append(week_data)

        return weekly_plan

    def _determine_phase(self, week_num: int, total_weeks: int) -> str:
        """
        Determine training phase based on week number.

        Simple periodization model:
        - First 40%: Foundation
        - Next 40%: Build
        - Last 20%: Peak/Taper

        Args:
            week_num: Current week number (1-indexed)
            total_weeks: Total number of weeks

        Returns:
            Phase name
        """
        progress = week_num / total_weeks

        if progress <= 0.4:
            return "Foundation"
        elif progress <= 0.8:
            return "Build"
        else:
            return "Peak"

    def _profile_to_dict(self, profile: AthleteProfileData) -> dict[str, Any]:
        """
        Convert AthleteProfileData to dictionary format.

        Args:
            profile: Pydantic model with athlete data

        Returns:
            Dictionary representation
        """
        return profile.model_dump(exclude_none=True)
