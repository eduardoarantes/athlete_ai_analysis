"""
Training Planning Phase (Phase 3).

This phase generates a complete training plan with 3 sequential sub-phases:
- Phase 3a: Overview generation (LLM + create_plan_overview tool)
- Phase 3b: Weekly details (LLM + add_week_details tool, iterative)
- Phase 3c: Finalization (Python only, finalize_training_plan tool)
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from cycling_ai.orchestration.agent import AgentFactory
from cycling_ai.orchestration.base import PhaseContext, PhaseResult, PhaseStatus
from cycling_ai.orchestration.phases.base_phase import BasePhase
from cycling_ai.orchestration.session import ConversationSession
from cycling_ai.tools.wrappers.finalize_plan_tool import FinalizePlanTool

logger = logging.getLogger(__name__)


def _get_mandatory_rest_days_text(available_days: list[str]) -> str:
    """
    Generate text describing mandatory rest days (days not available for training).

    Args:
        available_days: List of weekdays available for training

    Returns:
        Empty string if all 7 days available, otherwise formatted text with mandatory rest days
    """
    all_weekdays = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
    available_set = set(available_days)

    # Calculate unavailable days (mandatory rest)
    unavailable_days = all_weekdays - available_set

    if not unavailable_days:
        return ""  # All days available

    # Sort for consistent output
    weekday_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    sorted_unavailable = sorted(unavailable_days, key=lambda d: weekday_order.index(d))

    if len(sorted_unavailable) == 1:
        return f"\n   - MANDATORY REST DAY: {sorted_unavailable[0]} (not available for training)"
    else:
        days_str = ", ".join(sorted_unavailable)
        return f"\n   - MANDATORY REST DAYS: {days_str} (not available for training)"


class TrainingPlanningPhase(BasePhase):
    """
    Phase 3: Training Plan Generation.

    This phase has 3 internal sub-phases that execute sequentially:
    1. Phase 3a: Generate plan overview (structure, phases, TSS targets)
    2. Phase 3b: Add weekly workout details (iterative, one week at a time)
    3. Phase 3c: Finalize and validate complete plan (Python only)

    The phase requires athlete profile with FTP, available training days,
    and weekly time budget to generate appropriate training plans.

    Usage:
        phase = TrainingPlanningPhase()
        result = phase.execute(context)
        training_plan = result.extracted_data["training_plan"]
    """

    def __init__(self) -> None:
        """Initialize training planning phase."""
        super().__init__(
            phase_name="training_planning",
            required_tools=[
                "create_plan_overview",
                "add_week_details",
                "finalize_training_plan",
            ],
            max_iterations=None,  # Set per sub-phase
        )

    def execute(self, context: PhaseContext) -> PhaseResult:
        """
        Execute all 3 sub-phases sequentially.

        Override base execute() to handle multi-phase execution pattern.

        Args:
            context: Phase context with config and previous phase data

        Returns:
            PhaseResult with complete training plan
        """
        phase_start = datetime.now()

        try:
            # Validate context before starting
            self._validate_context(context)

            # Phase 3a: Generate plan overview
            logger.info("[PHASE 3a] Starting overview generation")
            overview_result = self._execute_phase_3a_overview(context)

            if not overview_result.success:
                overview_result.execution_time_seconds = (
                    datetime.now() - phase_start
                ).total_seconds()
                return overview_result

            logger.info("[PHASE 3a] Overview generation complete")

            # Update context with Phase 3a data for Phase 3b
            context_3b = PhaseContext(
                config=context.config,
                previous_phase_data={
                    **context.previous_phase_data,
                    **overview_result.extracted_data,
                },
                session_manager=context.session_manager,
                provider=context.provider,
                prompts_manager=context.prompts_manager,
                progress_callback=context.progress_callback,
            )

            # Phase 3b: Add weekly details (library-based or LLM-based)
            workout_source = context.config.workout_source
            logger.info(
                f"[PHASE 3b] Starting weekly details generation "
                f"(source={workout_source})"
            )

            if workout_source == "library":
                weeks_result = self._execute_phase_3b_library(context_3b)
            else:
                weeks_result = self._execute_phase_3b_weeks(context_3b)

            if not weeks_result.success:
                weeks_result.execution_time_seconds = (
                    datetime.now() - phase_start
                ).total_seconds()
                return weeks_result

            logger.info("[PHASE 3b] Weekly details generation complete")

            # Phase 3c: Finalize plan (uses plan_id from Phase 3a)
            logger.info("[PHASE 3c] Starting plan finalization")
            finalize_result = self._execute_phase_3c_finalize(context_3b)

            if not finalize_result.success:
                finalize_result.execution_time_seconds = (
                    datetime.now() - phase_start
                ).total_seconds()
                return finalize_result

            logger.info("[PHASE 3c] Plan finalization complete")

            # Build final result
            execution_time = (datetime.now() - phase_start).total_seconds()

            # Combine all extracted data
            final_data = {
                **overview_result.extracted_data,
                **weeks_result.extracted_data,
                **finalize_result.extracted_data,
            }

            # Calculate total tokens used
            total_tokens = (
                overview_result.tokens_used
                + weeks_result.tokens_used
                + finalize_result.tokens_used
            )

            return PhaseResult(
                phase_name=self.phase_name,
                status=PhaseStatus.COMPLETED,
                agent_response=finalize_result.agent_response,
                extracted_data=final_data,
                execution_time_seconds=execution_time,
                tokens_used=total_tokens,
            )

        except Exception as e:
            logger.exception(f"[PHASE 3] Training planning failed: {e}")
            return PhaseResult(
                phase_name=self.phase_name,
                status=PhaseStatus.FAILED,
                agent_response=f"Training planning failed: {str(e)}",
                errors=[str(e)],
                execution_time_seconds=(datetime.now() - phase_start).total_seconds(),
            )

    def _execute_phase_3a_overview(self, context: PhaseContext) -> PhaseResult:
        """
        Execute Phase 3a: Training Plan Overview Generation.

        Generates high-level plan structure with weekly phases, TSS targets,
        and focus areas. Returns plan_id for subsequent phases.

        Args:
            context: Phase context with config and previous phase data

        Returns:
            PhaseResult with plan_id and overview data
        """
        from cycling_ai.core.power_zones import calculate_power_zones
        from cycling_ai.core.athlete import load_athlete_profile

        phase_start = datetime.now()

        # Extract athlete profile path from context
        athlete_profile_path = context.previous_phase_data.get(
            "athlete_profile_path", str(context.config.athlete_profile_path)
        )

        # Load athlete profile
        try:
            athlete_profile = load_athlete_profile(athlete_profile_path)
        except FileNotFoundError as e:
            raise ValueError(
                f"[PHASE 3a] Cannot proceed: Athlete profile not found at '{athlete_profile_path}'. "
                f"Phase 3 requires a valid athlete profile with FTP, available training days, "
                f"and weekly time budget. Error: {e}"
            ) from e
        except Exception as e:
            raise ValueError(
                f"[PHASE 3a] Cannot proceed: Failed to load athlete profile from '{athlete_profile_path}'. "
                f"Phase 3 requires a valid athlete profile. Error: {e}"
            ) from e

        # Validate required fields
        if not hasattr(athlete_profile, "ftp") or athlete_profile.ftp is None:
            raise ValueError(
                f"[PHASE 3a] Cannot proceed: Athlete profile at '{athlete_profile_path}' "
                f"does not have a valid FTP value. FTP is required for training plan generation."
            )

        ftp = athlete_profile.ftp
        available_days = athlete_profile.get_training_days()
        weekly_time_budget_hours = athlete_profile.get_weekly_training_hours()

        # Validate available days
        if not available_days or len(available_days) == 0:
            raise ValueError(
                f"[PHASE 3a] Cannot proceed: Athlete profile at '{athlete_profile_path}' "
                f"does not specify available training days. At least one training day is required."
            )

        # Validate weekly time budget
        if weekly_time_budget_hours is None or weekly_time_budget_hours <= 0:
            raise ValueError(
                f"[PHASE 3a] Cannot proceed: Athlete profile at '{athlete_profile_path}' "
                f"does not have a valid weekly time budget. Weekly time budget must be greater than 0."
            )

        # Get daily time caps if available
        daily_time_caps = getattr(athlete_profile, "daily_time_caps", None)

        # Pre-calculate power zones
        power_zones = calculate_power_zones(ftp)

        # Format zones for prompt
        zones_text = f"**Power Zones (based on FTP {ftp}W):**\n"
        for zone_id, zone_data in power_zones.items():
            zones_text += (
                f"- **{zone_id.upper()} ({zone_data['name']})**: "
                f"{zone_data['min']}-{zone_data['max']}W "
                f"({int(zone_data['ftp_pct_min']*100)}-{int(zone_data['ftp_pct_max']*100)}% FTP) "
                f"- {zone_data['description']}\n"
            )

        # Format available days and daily time caps
        available_days_str = ", ".join(available_days)
        daily_time_caps_json = json.dumps(daily_time_caps) if daily_time_caps else "None"

        # Extract optional athlete profile fields
        goals = getattr(athlete_profile, "goals", None) or "Not specified"
        current_training_status = getattr(athlete_profile, "current_training_status", None) or "Not specified"

        # Prepare prompt parameters
        prompt_params = {
            "training_plan_weeks": str(context.config.training_plan_weeks),
            "athlete_profile_path": athlete_profile_path,
            "power_zones": zones_text,
            "available_days": available_days_str,
            "mandatory_rest_days_text": _get_mandatory_rest_days_text(available_days),
            "weekly_time_budget_hours": str(weekly_time_budget_hours),
            "daily_time_caps_json": daily_time_caps_json,
            "num_available_days": str(len(available_days)),
            "num_rest_days": str(7 - len(available_days)),
            "total_tool_calls": str(1 + context.config.training_plan_weeks + 1),
            "training_plan_weeks_plus_1": str(context.config.training_plan_weeks + 1),
            "goals": goals,
            "current_training_status": current_training_status,
        }

        # Generate performance summary from Phase 2 data
        performance_summary = self._generate_performance_summary(
            context.previous_phase_data
        )
        prompt_params["performance_summary"] = performance_summary

        # Get prompts
        system_prompt = context.prompts_manager.get_training_planning_overview_prompt(
            **prompt_params
        )
        user_message = context.prompts_manager.get_training_planning_overview_user_prompt(
            **prompt_params
        )

        # Create session with isolation
        session = context.session_manager.create_session(
            provider_name=context.provider.config.provider_name,
            context=context.previous_phase_data,
            system_prompt=system_prompt,
        )

        # Create agent with AgentFactory
        agent = AgentFactory.create_agent(
            provider=context.provider,
            session=session,
            allowed_tools=self.required_tools[:1],  # Only create_plan_overview
            force_tool_call=True,
            max_iterations=5,
        )

        # Execute with agent
        try:
            response = agent.process_message(user_message)
        except Exception as e:
            logger.error(f"[PHASE 3a] Agent execution failed: {e}")
            return PhaseResult(
                phase_name="training_planning_overview",
                status=PhaseStatus.FAILED,
                agent_response=f"Overview generation failed: {str(e)}",
                errors=[str(e)],
                execution_time_seconds=(datetime.now() - phase_start).total_seconds(),
            )

        # Extract data from session
        extracted_data = self._extract_phase_data(response, session)

        # Ensure plan_id is present
        if "plan_id" not in extracted_data:
            logger.error("[PHASE 3a] No plan_id found in extracted data")
            return PhaseResult(
                phase_name="training_planning_overview",
                status=PhaseStatus.FAILED,
                agent_response="Overview generation did not produce plan_id",
                errors=["Missing plan_id in extracted data"],
                execution_time_seconds=(datetime.now() - phase_start).total_seconds(),
            )

        # Add athlete profile path to extracted data for Phase 3b
        extracted_data["athlete_profile_path"] = athlete_profile_path

        execution_time = (datetime.now() - phase_start).total_seconds()
        tokens_used = session.get_total_tokens()

        return PhaseResult(
            phase_name="training_planning_overview",
            status=PhaseStatus.COMPLETED,
            agent_response=response,
            extracted_data=extracted_data,
            execution_time_seconds=execution_time,
            tokens_used=tokens_used,
        )

    def _execute_phase_3b_weeks(self, context: PhaseContext) -> PhaseResult:
        """
        Execute Phase 3b: Weekly Workout Details Generation.

        Generates detailed workouts for each week iteratively with FRESH SESSION per week.
        This prevents failed attempts from accumulating in conversation context.

        Pattern: For each week, rebuild prompt with only successful week completions.

        Args:
            context: Phase context with plan_id from Phase 3a

        Returns:
            PhaseResult with all weeks added
        """
        from cycling_ai.core.power_zones import calculate_power_zones
        from cycling_ai.core.athlete import load_athlete_profile

        phase_start = datetime.now()

        # Extract plan_id from Phase 3a
        plan_id = context.previous_phase_data.get("plan_id")
        if not plan_id:
            raise ValueError(
                "[PHASE 3b] Cannot proceed: No plan_id found in Phase 3a results. "
                "Phase 3a must complete successfully first."
            )

        # Get athlete profile info (same as Phase 3a)
        athlete_profile_path = context.previous_phase_data.get(
            "athlete_profile_path", str(context.config.athlete_profile_path)
        )
        athlete_profile = load_athlete_profile(athlete_profile_path)
        ftp = athlete_profile.ftp
        available_days = athlete_profile.get_training_days()
        weekly_time_budget_hours = athlete_profile.get_weekly_training_hours()
        daily_time_caps = getattr(athlete_profile, "daily_time_caps", None)

        # Pre-calculate power zones
        power_zones = calculate_power_zones(ftp)
        zones_text = f"**Power Zones (based on FTP {ftp}W):**\n"
        for zone_id, zone_data in power_zones.items():
            zones_text += (
                f"- **{zone_id.upper()} ({zone_data['name']})**: "
                f"{zone_data['min']}-{zone_data['max']}W "
                f"({int(zone_data['ftp_pct_min']*100)}-{int(zone_data['ftp_pct_max']*100)}% FTP) "
                f"- {zone_data['description']}\n"
            )

        # Load weekly_overview from Phase 3a
        temp_dir = Path("/tmp")
        overview_file = temp_dir / f"{plan_id}_overview.json"

        if not overview_file.exists():
            raise ValueError(
                f"[PHASE 3b] Overview file not found: {overview_file}. "
                "Phase 3a must complete successfully first."
            )

        with open(overview_file) as f:
            overview_data = json.load(f)

        weekly_overview = overview_data.get("weekly_overview", [])

        # Format prompt parameters (constant for all weeks)
        available_days_str = ", ".join(available_days)
        daily_time_caps_json = json.dumps(daily_time_caps) if daily_time_caps else "None"

        # Base prompt parameters (shared across all weeks)
        base_prompt_params = {
            "plan_id": plan_id,
            "training_plan_weeks": str(context.config.training_plan_weeks),
            "athlete_profile_path": athlete_profile_path,
            "power_zones": zones_text,
            "available_days": available_days_str,
            "mandatory_rest_days_text": _get_mandatory_rest_days_text(available_days),
            "weekly_time_budget_hours": str(weekly_time_budget_hours),
            "daily_time_caps_json": daily_time_caps_json,
            "num_available_days": str(len(available_days)),
            "num_rest_days": str(7 - len(available_days)),
            "weekly_overview": weekly_overview,  # Pass the data structure for Jinja2
        }

        # Accumulate successful week completions
        weeks_added: list[int] = []
        total_tokens = 0

        # Generate each week with FRESH SESSION (rebuild pattern)
        total_weeks = context.config.training_plan_weeks
        for week_num in range(1, total_weeks + 1):
            logger.info(f"[PHASE 3b] Generating week {week_num}/{total_weeks} (fresh session)")

            try:
                week_result = self._execute_single_week(
                    context=context,
                    week_number=week_num,
                    base_params=base_prompt_params,
                    successful_weeks=weeks_added,
                )

                if week_result["success"]:
                    weeks_added.append(week_num)
                    total_tokens += week_result["tokens_used"]
                    logger.info(f"[PHASE 3b] Week {week_num} added successfully")
                else:
                    # Week failed permanently
                    errors = week_result.get("errors", ["Unknown error"])
                    logger.error(f"[PHASE 3b] Week {week_num} failed: {errors}")
                    return PhaseResult(
                        phase_name="training_planning_weeks",
                        status=PhaseStatus.FAILED,
                        agent_response=f"Week {week_num} generation failed: {errors}",
                        errors=errors,
                        execution_time_seconds=(datetime.now() - phase_start).total_seconds(),
                        tokens_used=total_tokens,
                    )

            except Exception as e:
                import traceback
                tb_str = "".join(traceback.format_exception(type(e), e, e.__traceback__))
                logger.error(f"[PHASE 3b] Week {week_num} exception: {e}\n{tb_str}")
                return PhaseResult(
                    phase_name="training_planning_weeks",
                    status=PhaseStatus.FAILED,
                    agent_response=f"Week {week_num} failed with exception: {str(e)}",
                    errors=[str(e)],
                    execution_time_seconds=(datetime.now() - phase_start).total_seconds(),
                    tokens_used=total_tokens,
                )

        execution_time = (datetime.now() - phase_start).total_seconds()
        logger.info(f"[PHASE 3b] All {total_weeks} weeks generated successfully in {execution_time:.2f}s")

        return PhaseResult(
            phase_name="training_planning_weeks",
            status=PhaseStatus.COMPLETED,
            agent_response=f"All {total_weeks} weeks generated successfully",
            extracted_data={"weeks_added": weeks_added},
            execution_time_seconds=execution_time,
            tokens_used=total_tokens,
        )

    def _execute_phase_3b_library(self, context: PhaseContext) -> PhaseResult:
        """
        Execute Phase 3b using library-based workout selection (no LLM).

        This is a fast, deterministic alternative to LLM-based workout generation.
        Selects workouts from curated library based on weekly overview from Phase 3a.

        Args:
            context: Phase context with plan_id from Phase 3a

        Returns:
            PhaseResult with all weeks added

        Raises:
            RuntimeError: If library selection or week addition fails
        """
        from cycling_ai.orchestration.phases.training_planning_library import (
            LibraryBasedTrainingPlanningWeeks,
        )

        phase_start = datetime.now()

        # Extract plan_id from Phase 3a
        plan_id = context.previous_phase_data.get("plan_id")
        if not plan_id:
            raise ValueError(
                "[PHASE 3b-LIBRARY] Cannot proceed: No plan_id found in Phase 3a results. "
                "Phase 3a must complete successfully first."
            )

        logger.info(
            f"[PHASE 3b-LIBRARY] Using library-based workout selection "
            f"for plan {plan_id}"
        )

        try:
            # Initialize library-based phase with temperature for variety
            temperature = 0.5  # Balanced randomness
            library_phase = LibraryBasedTrainingPlanningWeeks(temperature=temperature)

            # Execute library selection (fast, no LLM calls)
            result = library_phase.execute(plan_id=plan_id)

            execution_time = (datetime.now() - phase_start).total_seconds()
            weeks_added = result.get("weeks_added", 0)

            logger.info(
                f"[PHASE 3b-LIBRARY] Completed in {execution_time:.2f}s "
                f"({weeks_added} weeks, 0 tokens)"
            )

            return PhaseResult(
                phase_name="training_planning_weeks",
                status=PhaseStatus.COMPLETED,
                agent_response=(
                    f"Library-based: {weeks_added} weeks generated in "
                    f"{execution_time:.2f}s"
                ),
                extracted_data={"weeks_added": list(range(1, weeks_added + 1))},
                execution_time_seconds=execution_time,
                tokens_used=0,  # No LLM usage
            )

        except Exception as e:
            import traceback
            tb_str = "".join(traceback.format_exception(type(e), e, e.__traceback__))
            execution_time = (datetime.now() - phase_start).total_seconds()
            error_msg = f"Library-based workout selection failed: {str(e)}"
            logger.error(f"[PHASE 3b-LIBRARY] {error_msg}\n{tb_str}")

            return PhaseResult(
                phase_name="training_planning_weeks",
                status=PhaseStatus.FAILED,
                agent_response=error_msg,
                errors=[str(e)],
                execution_time_seconds=execution_time,
                tokens_used=0,
            )

    def _execute_single_week(
        self,
        context: PhaseContext,
        week_number: int,
        base_params: dict[str, str],
        successful_weeks: list[int],
    ) -> dict[str, Any]:
        """
        Execute single week generation with fresh session.

        Rebuilds context with only successful week completions, preventing
        failed attempts from polluting conversation.

        Args:
            context: Phase context
            week_number: Week to generate (1-indexed)
            base_params: Base prompt parameters
            successful_weeks: List of successfully completed week numbers

        Returns:
            Dictionary with success, tokens_used, errors
        """
        # Extract plan_id from context (set in Phase 3a)
        plan_id = base_params.get("plan_id")
        if not plan_id:
            raise ValueError(
                f"[PHASE 3b] plan_id not found in base_params for week {week_number}"
            )

        # Build context string showing successful weeks
        context_text = f"Successfully completed weeks: {successful_weeks if successful_weeks else 'None (first week)'}"

        # Get prompts with week-specific context
        system_prompt = context.prompts_manager.get_training_planning_weeks_prompt(
            **base_params
        )

        # Get user prompt from file with all the detailed instructions
        user_prompt_template = context.prompts_manager.get_training_planning_weeks_user_prompt(
            **base_params
        )

        # Build user message with context and detailed instructions
        user_message = (
            f"{context_text}\n\n"
            f"**Use plan_id: `{plan_id}`**\n\n"
            f"{user_prompt_template}"
        )

        # Create FRESH session for this week
        session = context.session_manager.create_session(
            provider_name=context.provider.config.provider_name,
            context=context.previous_phase_data,
            system_prompt=system_prompt,
        )

        # Create agent with limited iterations for single week
        agent = AgentFactory.create_agent(
            provider=context.provider,
            session=session,
            allowed_tools=self.required_tools[1:2],  # Only add_week_details
            force_tool_call=True,
            max_iterations=5,  # Single week should complete in 1-3 iterations
        )

        # Execute
        max_retries = 3
        for attempt in range(1, max_retries + 1):
            try:
                response = agent.process_message(user_message)

                # Extract week result
                extracted = self._extract_phase_data(response, session)

                # Check if week was added
                if "weeks_added" in extracted and week_number in extracted["weeks_added"]:
                    return {
                        "success": True,
                        "tokens_used": session.get_total_tokens(),
                        "errors": [],
                    }

                # Week not added - check for errors in session
                error_details = self._extract_week_error_details(session)
                if error_details:
                    logger.warning(f"[PHASE 3b] Week {week_number} attempt {attempt}/{max_retries} had errors: {error_details['error_summary']}")

                    if attempt < max_retries:
                        # Retry with fresh session (rebuild pattern)
                        logger.info(f"[PHASE 3b] Retrying week {week_number} with fresh session")
                        session = context.session_manager.create_session(
                            provider_name=context.provider.config.provider_name,
                            context=context.previous_phase_data,
                            system_prompt=system_prompt,
                        )
                        agent = AgentFactory.create_agent(
                            provider=context.provider,
                            session=session,
                            allowed_tools=self.required_tools[1:2],
                            force_tool_call=True,
                            max_iterations=5,
                        )

                        # Build detailed retry message with previous tool call information
                        user_message = (
                            f"{context_text}\n\n"
                            f"**Use plan_id: `{plan_id}`**\n\n"
                            f"**Previous Attempt Failed for Week {week_number}:**\n\n"
                            f"{error_details['full_error']}\n\n"
                            f"Call `add_week_details` with plan_id=\"{plan_id}\" and week_number={week_number}, correcting the issues above."
                        )
                        continue
                    else:
                        # Max retries exceeded
                        return {
                            "success": False,
                            "tokens_used": session.get_total_tokens(),
                            "errors": [error_details['error_summary']],
                        }

                # No errors but week not added - unexpected
                return {
                    "success": False,
                    "tokens_used": session.get_total_tokens(),
                    "errors": [f"Week {week_number} not added (no errors reported)"],
                }

            except Exception as e:
                logger.error(f"[PHASE 3b] Week {week_number} attempt {attempt} exception: {e}")
                if attempt >= max_retries:
                    return {
                        "success": False,
                        "tokens_used": session.get_total_tokens(),
                        "errors": [str(e)],
                    }
                # Retry

        return {
            "success": False,
            "tokens_used": session.get_total_tokens(),
            "errors": [f"Week {week_number} failed after {max_retries} attempts"],
        }

    def _extract_week_error_details(
        self, session: ConversationSession
    ) -> dict[str, str] | None:
        """
        Extract detailed error information from tool results in session.

        Provides both a summary for logging and full error text for retry message.

        Args:
            session: Conversation session

        Returns:
            Dictionary with 'error_summary' and 'full_error' keys, or None if no errors
        """
        for message in session.messages:
            if message.role == "tool" and message.tool_results:
                for tool_result in message.tool_results:
                    if not tool_result.get("success", True):
                        # Failed tool call - extract error from content
                        content = message.content
                        if content:
                            # Extract summary (first line or first 100 chars)
                            lines = content.split('\n')
                            summary = lines[0] if lines else content[:100]

                            return {
                                "error_summary": summary,
                                "full_error": content,
                            }
        return None

    def _execute_phase_3c_finalize(self, context: PhaseContext) -> PhaseResult:
        """
        Execute Phase 3c: Training Plan Finalization (Python only - no LLM).

        Assembles complete plan from overview + all weeks, validates, and saves.
        Similar to Phase 1 data preparation - direct tool execution.

        Args:
            context: Phase context with plan_id from Phase 3a

        Returns:
            PhaseResult with complete training plan
        """
        phase_start = datetime.now()

        # Extract plan_id from Phase 3a
        plan_id = context.previous_phase_data.get("plan_id")
        if not plan_id:
            raise ValueError(
                "[PHASE 3c] Cannot proceed: No plan_id found in Phase 3a results."
            )

        logger.info("[PHASE 3c FINALIZE] Starting plan finalization (no LLM)")
        logger.info(f"[PHASE 3c FINALIZE] plan_id: {plan_id}")

        # Directly call finalize_plan tool
        finalize_tool = FinalizePlanTool()
        result = finalize_tool.execute(plan_id=plan_id)

        if not result.success:
            errors = result.errors or ["Plan finalization failed"]
            logger.error(f"[PHASE 3c FINALIZE] Finalization failed: {errors}")
            return PhaseResult(
                phase_name="training_planning_finalize",
                status=PhaseStatus.FAILED,
                agent_response="Plan finalization failed",
                errors=errors,
                execution_time_seconds=(datetime.now() - phase_start).total_seconds(),
            )

        logger.info("[PHASE 3c FINALIZE] Plan finalization complete")

        # Extract training plan data
        extracted_data = {
            "training_plan": result.data,
            "output_path": result.metadata.get("output_path"),
        }

        execution_time = (datetime.now() - phase_start).total_seconds()
        logger.info(
            f"[PHASE 3c FINALIZE] Completed in {execution_time:.2f}s (no tokens used)"
        )

        return PhaseResult(
            phase_name="training_planning_finalize",
            status=PhaseStatus.COMPLETED,
            agent_response=(
                f"Training plan finalized and saved to {result.metadata.get('output_path')}"
            ),
            extracted_data=extracted_data,
            execution_time_seconds=execution_time,
        )

    def _generate_performance_summary(self, phase2_data: dict[str, Any]) -> str:
        """
        Generate a concise performance summary from phase 2 results.

        Args:
            phase2_data: Extracted data from phase 2 (performance analysis)

        Returns:
            Formatted text summary for training plan context
        """
        if not phase2_data:
            return "No performance data available."

        summary_lines = []

        # Extract performance data
        perf_data = phase2_data.get("performance_data", {})
        if perf_data:
            # Current period stats
            current_stats = perf_data.get("current_period_stats", {})
            if current_stats:
                summary_lines.append("**Current Performance:**")
                if "avg_power" in current_stats:
                    summary_lines.append(
                        f"- Average Power: {current_stats['avg_power']:.0f}W"
                    )
                if "avg_speed" in current_stats:
                    summary_lines.append(
                        f"- Average Speed: {current_stats['avg_speed']:.1f} km/h"
                    )
                if "total_distance" in current_stats:
                    summary_lines.append(
                        f"- Total Distance: {current_stats['total_distance']:.0f} km"
                    )
                if "total_time" in current_stats:
                    hours = current_stats["total_time"] / 3600
                    summary_lines.append(f"- Total Time: {hours:.1f} hours")

            # Trends
            trends = perf_data.get("trends", {})
            if trends:
                summary_lines.append("\n**Trends:**")
                if "power_trend" in trends:
                    summary_lines.append(f"- Power: {trends['power_trend']}")
                if "speed_trend" in trends:
                    summary_lines.append(f"- Speed: {trends['speed_trend']}")

        # Extract zones data
        zones_data = phase2_data.get("zones_data", {})
        if zones_data:
            distribution = zones_data.get("zone_distribution", {})
            if distribution:
                summary_lines.append("\n**Training Distribution (time in zones):**")
                for zone_id, zone_info in distribution.items():
                    percentage = zone_info.get("percentage", 0)
                    if percentage > 5:  # Only show zones with >5% time
                        zone_name = zone_info.get("zone_name", zone_id)
                        summary_lines.append(f"- {zone_name}: {percentage:.1f}%")

        if not summary_lines:
            return "Performance analysis completed. Use results to inform training plan."

        return "\n".join(summary_lines)

    def _validate_context(self, context: PhaseContext) -> None:
        """
        Validate that context has required data for training planning.

        Args:
            context: Phase context to validate

        Raises:
            ValueError: If required data missing
        """
        # Check for athlete profile path
        if "athlete_profile_path" not in context.previous_phase_data:
            raise ValueError(
                "[PHASE 3] Cannot proceed: athlete_profile_path not found in context. "
                "Phase 1 or Phase 2 must provide this."
            )

        # Training plan must be requested
        if not context.config.generate_training_plan:
            raise ValueError(
                "[PHASE 3] Cannot proceed: generate_training_plan is False. "
                "Training planning phase requires generate_training_plan=True."
            )

    def _extract_phase_data(
        self, response: str, session: ConversationSession
    ) -> dict[str, Any]:
        """
        Extract structured data from tool results in session.

        Args:
            response: Agent response text
            session: Conversation session with tool results

        Returns:
            Dictionary of extracted data
        """
        extracted: dict[str, Any] = {}

        # Look through session messages for tool results
        for message in session.messages:
            if message.role == "tool" and message.tool_results:
                for tool_result in message.tool_results:
                    if tool_result.get("success"):
                        tool_name = tool_result.get("tool_name", "")

                        try:
                            # Parse JSON from content
                            data = json.loads(message.content)

                            # For create_plan_overview, extract plan_id
                            if tool_name == "create_plan_overview":
                                if "plan_id" in data:
                                    extracted["plan_id"] = data["plan_id"]

                            # For add_week_details, accumulate weeks
                            elif tool_name == "add_week_details":
                                if "weeks_added" not in extracted:
                                    extracted["weeks_added"] = []
                                if "week_number" in data:
                                    extracted["weeks_added"].append(
                                        data["week_number"]
                                    )

                            # For finalize_training_plan, extract plan
                            elif tool_name == "finalize_training_plan":
                                if "training_plan" in data:
                                    extracted["training_plan"] = data["training_plan"]

                        except json.JSONDecodeError:
                            logger.warning(
                                f"Could not parse JSON from tool result: {tool_name}"
                            )

        return extracted

    def _get_retrieval_query(self, context: PhaseContext) -> str:
        """
        Build retrieval query for training plan templates.

        Phase 3 creates training plans, so retrieve:
        - Structured training plan templates
        - Periodization strategies for the specified duration
        - Plans appropriate for athlete's FTP level

        Args:
            context: Phase execution context

        Returns:
            Query string for training template retrieval with FTP and duration
        """
        weeks = context.config.training_plan_weeks

        # Extract athlete's current FTP from performance analysis
        # Performance data might be JSON string or dict
        perf_data = context.previous_phase_data.get("performance_analysis", {})
        if isinstance(perf_data, str):
            import json
            try:
                perf_data = json.loads(perf_data)
            except json.JSONDecodeError:
                perf_data = {}

        # Get current FTP, default to 250W if not available
        ftp = perf_data.get("current_ftp", 250)

        # Build query with athlete-specific context
        query = (
            f"training plan periodization {weeks} weeks duration "
            f"FTP {ftp} watts base building structured plan template"
        )

        return query

    def _get_retrieval_collection(self) -> str:
        """
        Get collection name for training planning retrieval.

        This is the ONLY phase that uses training_templates collection.
        All other phases use domain_knowledge.

        Returns:
            "training_templates" - Use structured training plan templates
        """
        return "training_templates"

    def _execute_phase(self, context: PhaseContext) -> PhaseResult:
        """
        Not used - TrainingPlanningPhase overrides execute() directly.

        Raises:
            NotImplementedError: Always
        """
        raise NotImplementedError(
            "TrainingPlanningPhase overrides execute() directly. "
            "Use execute(context) instead."
        )

    def _get_system_prompt(self, config: dict[str, Any], context: PhaseContext) -> str:
        """
        Not used - TrainingPlanningPhase has 3 sub-phases with different prompts.

        Raises:
            NotImplementedError: Always
        """
        raise NotImplementedError(
            "TrainingPlanningPhase uses different prompts for each sub-phase. "
            "This method is not applicable."
        )

    def _get_user_message(self, config: dict[str, Any], context: PhaseContext) -> str:
        """
        Not used - TrainingPlanningPhase has 3 sub-phases with different messages.

        Raises:
            NotImplementedError: Always
        """
        raise NotImplementedError(
            "TrainingPlanningPhase uses different messages for each sub-phase. "
            "This method is not applicable."
        )

    def _extract_data(self, session: ConversationSession) -> dict[str, Any]:
        """
        Not used - TrainingPlanningPhase extracts data differently per sub-phase.

        Raises:
            NotImplementedError: Always
        """
        raise NotImplementedError(
            "TrainingPlanningPhase extracts data per sub-phase. "
            "Use _extract_phase_data() instead."
        )
