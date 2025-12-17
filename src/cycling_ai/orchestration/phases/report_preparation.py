"""
Report Data Preparation Phase (Phase 4).

Consolidates data from previous phases into report_data.json format.
This phase does NOT use LLM - it executes Python consolidation directly.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from cycling_ai.orchestration.base import (
    PhaseContext,
    PhaseResult,
    PhaseStatus,
)
from cycling_ai.orchestration.phases.base_phase import BasePhase
from cycling_ai.orchestration.session import ConversationSession

logger = logging.getLogger(__name__)


class ReportPreparationPhase(BasePhase):
    """
    Phase 4: Report Data Preparation.

    Consolidates ALL data (performance analysis + training plan) into
    report_data.json format for use with the HTML viewer and report generation.

    This is the FINAL data generation step - no LLM orchestration needed.

    This phase executes data consolidation directly without LLM orchestration.

    Key Responsibilities:
    - Load athlete profile
    - Extract training plan from Phase 3
    - Extract performance analysis from Phase 2 (optional)
    - Consolidate all data using report_data_extractor utilities
    - Save report_data.json to output directory

    Extracted Data:
    - report_data_path: Path to report_data.json
    - athlete_name: Name extracted from profile path
    - report_data: Complete report data structure (for HTML generation)
    - has_performance_analysis: Whether performance analysis was included

    Example:
        >>> phase = ReportPreparationPhase()
        >>> context = PhaseContext(config=workflow_config, previous_phase_data={...})
        >>> result = phase.execute(context)
        >>> print(result.extracted_data["report_data_path"])
        /output/report_data.json
    """

    def __init__(self) -> None:
        """Initialize ReportPreparationPhase."""
        super().__init__(
            phase_name="report_data_preparation",
            required_tools=[],  # No tools - direct Python execution
            max_iterations=None,  # No iterations - direct execution
        )

    def execute(self, context: PhaseContext) -> PhaseResult:
        """
        Execute report preparation phase (overrides BasePhase.execute()).

        Phase 4 doesn't use LLM, so we override execute() to skip session/agent creation.

        Args:
            context: Phase execution context with data from Phases 1-3

        Returns:
            PhaseResult with report consolidation status and output path
        """
        phase_start = datetime.now()

        # Notify progress callback
        if context.progress_callback:
            context.progress_callback(self.phase_name, PhaseStatus.IN_PROGRESS)

        try:
            # Validate context has required data
            self._validate_context(context)

            # Execute phase logic
            result = self._execute_phase_logic(context)

            # Update execution time if not already set
            if result.execution_time_seconds == 0:
                result.execution_time_seconds = (datetime.now() - phase_start).total_seconds()

            # Notify completion or failure
            if context.progress_callback:
                context.progress_callback(self.phase_name, result.status)

            return result

        except Exception as e:
            # Handle any errors
            execution_time = (datetime.now() - phase_start).total_seconds()
            error_msg = f"{type(e).__name__}: {str(e)}"

            logger.error(f"Phase {self.phase_name} failed after {execution_time:.2f}s: {error_msg}")

            result = PhaseResult(
                phase_name=self.phase_name,
                status=PhaseStatus.FAILED,
                agent_response="",
                extracted_data={},
                errors=[error_msg],
                execution_time_seconds=execution_time,
                tokens_used=0,
            )

            # Notify failure
            if context.progress_callback:
                context.progress_callback(self.phase_name, PhaseStatus.FAILED)

            return result

    def _validate_context(self, context: PhaseContext) -> None:
        """
        Validate context has required data from previous phases.

        Args:
            context: Phase execution context

        Raises:
            ValueError: If required data from Phase 2 or Phase 3 is missing
        """
        required_keys = ["performance_data", "zones_data", "training_plan"]

        for key in required_keys:
            if key not in context.previous_phase_data:
                raise ValueError(
                    f"Missing required data from previous phases: {key}. Phase 4 requires data from Phases 2 and 3."
                )

    def _execute_phase_logic(self, context: PhaseContext) -> PhaseResult:
        """
        Execute the core report consolidation logic.

        Args:
            context: Phase execution context

        Returns:
            PhaseResult with consolidation status
        """
        from cycling_ai.tools.report_data_extractor import (
            consolidate_athlete_data,
            create_report_data,
            find_athlete_id_from_path,
            load_athlete_profile,
        )

        phase_start = datetime.now()

        logger.info("[PHASE 4] Starting report data preparation")

        # Get data from previous phases
        performance_data = context.previous_phase_data.get("performance_data")
        zones_data = context.previous_phase_data.get("zones_data")
        training_plan_raw = context.previous_phase_data.get("training_plan")

        logger.info(
            f"[PHASE 4] Retrieved data: performance={performance_data is not None}, "
            f"zones={zones_data is not None}, "
            f"training_plan={training_plan_raw is not None}"
        )

        # Validate training_plan is a dict (required by consolidate_athlete_data)
        if not isinstance(training_plan_raw, dict):
            raise ValueError(f"Training plan data must be a dict, got {type(training_plan_raw)}")

        training_plan: dict[str, Any] = training_plan_raw

        # Load athlete profile
        logger.info("[PHASE 4] Loading athlete profile")
        profile = load_athlete_profile(context.config.athlete_profile_path)
        athlete_id = find_athlete_id_from_path(context.config.athlete_profile_path)
        athlete_name = context.config.athlete_profile_path.parent.name

        logger.info(f"[PHASE 4] Athlete: {athlete_name} (ID: {athlete_id}), FTP: {profile.get('ftp', 'N/A')}")

        # Create a session for traceability
        report_session = context.session_manager.create_session(
            provider_name="report_preparation",
            context=context.previous_phase_data,
        )
        session_id = report_session.session_id

        logger.info(f"[PHASE 4] Created report session: {session_id}")

        # Consolidate all data using the extractor utility
        logger.info("[PHASE 4] Consolidating athlete data")
        athlete_data = consolidate_athlete_data(
            training_plan_data=training_plan,
            profile=profile,
            athlete_id=athlete_id,
            athlete_name=athlete_name,
            performance_analysis=performance_data,
        )

        logger.info("[PHASE 4] Athlete data consolidated successfully")
        logger.debug(f"[PHASE 4] athlete_data keys: {list(athlete_data.keys())}")

        # Create report data structure
        generator_info = {
            "tool": "cycling-ai",
            "version": "0.1.0",
            "command": "generate (integrated workflow)",
        }

        logger.info("[PHASE 4] Creating report_data structure")
        report_data = create_report_data([athlete_data], generator_info, session_id)
        logger.info(f"[PHASE 4] report_data created with keys: {list(report_data.keys())}")

        # Save report data to output directory
        output_path = context.config.output_dir / "report_data.json"
        logger.info(f"[PHASE 4] Saving report_data to: {output_path}")

        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, "w") as f:
            json.dump(report_data, f, indent=2)

        logger.info(f"[PHASE 4] report_data.json saved successfully, size: {output_path.stat().st_size} bytes")

        # Build execution result
        execution_time = (datetime.now() - phase_start).total_seconds()

        response_msg = "Complete report data prepared successfully:\n"
        if training_plan:
            weekly_plan_len = len(training_plan.get("weekly_plan", []))
            response_msg += f"  - Training plan: {weekly_plan_len} weeks\n"
        if performance_data:
            response_msg += "  - Performance analysis: included\n"
        response_msg += f"  - Saved to: {output_path}"

        logger.info(f"[PHASE 4] Completed in {execution_time:.2f}s")

        return PhaseResult(
            phase_name=self.phase_name,
            status=PhaseStatus.COMPLETED,
            agent_response=response_msg,
            extracted_data={
                "report_data_path": str(output_path),
                "athlete_name": athlete_name,
                "report_data": report_data,  # Make available for HTML generation
                "has_performance_analysis": performance_data is not None,
                "session_id": session_id,  # Include session_id for traceability
            },
            execution_time_seconds=execution_time,
            tokens_used=0,  # No LLM used
        )

    # Abstract method implementations (required by BasePhase, but not used by Phase 4)

    def _get_system_prompt(self, config: dict[str, Any], context: PhaseContext) -> str:
        """
        Get system prompt (not used by Phase 4).

        Args:
            config: Configuration dictionary
            context: Phase execution context

        Returns:
            Empty string (Phase 4 doesn't use LLM)
        """
        return ""

    def _get_user_message(self, config: dict[str, Any], context: PhaseContext) -> str:
        """
        Get user message (not used by Phase 4).

        Args:
            config: Configuration dictionary
            context: Phase execution context

        Returns:
            Empty string (Phase 4 doesn't use LLM)
        """
        return ""

    def _extract_data(self, session: ConversationSession) -> dict[str, Any]:
        """
        Extract data from session (not used by Phase 4).

        Args:
            session: Conversation session

        Returns:
            Empty dict (Phase 4 doesn't use LLM)
        """
        return {}

    def _get_retrieval_query(self, context: PhaseContext) -> str:
        """
        Build retrieval query for report generation guidance.

        Phase 4 generates reports, so retrieve guidance on:
        - Report generation and data presentation
        - Coaching insights and recommendations
        - Performance summary best practices

        Args:
            context: Phase execution context

        Returns:
            Query string for domain knowledge retrieval
        """
        return (
            "report generation coaching insights performance summary "
            "recommendations data presentation athlete communication"
        )

    def _get_retrieval_collection(self) -> str:
        """
        Get collection name for report preparation retrieval.

        Returns:
            "domain_knowledge" - Use cycling science knowledge
        """
        return "domain_knowledge"
