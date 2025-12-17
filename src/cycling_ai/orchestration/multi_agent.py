"""
Multi-agent workflow orchestrator.

Backward compatibility wrapper for FullReportWorkflow.
Delegates execution to modular phase-based workflow while preserving the original API.

DEPRECATED: New code should use FullReportWorkflow directly.
This module is kept for backward compatibility with existing tests and CLI commands.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from pathlib import Path
from typing import Any

from cycling_ai.orchestration.base import (
    PhaseStatus,
    WorkflowConfig,
    WorkflowResult,
)
from cycling_ai.orchestration.prompts import AgentPromptsManager
from cycling_ai.orchestration.session import SessionManager
from cycling_ai.orchestration.workflows.full_report import FullReportWorkflow
from cycling_ai.providers.base import BaseProvider

logger = logging.getLogger(__name__)


# Phase name constants
PHASE_DATA_PREPARATION = "data_preparation"
PHASE_PERFORMANCE_ANALYSIS = "performance_analysis"
PHASE_TRAINING_PLANNING = "training_planning"
PHASE_REPORT_DATA_PREPARATION = "report_data_preparation"


# Note: PhaseStatus, PhaseResult, WorkflowConfig, WorkflowResult, and PhaseContext
# have been moved to orchestration/base.py for better modularity


class MultiAgentOrchestrator:
    """
    Coordinates multi-agent workflow execution.

    DEPRECATED: This is a backward compatibility wrapper around FullReportWorkflow.
    New code should use FullReportWorkflow directly for better modularity.

    Orchestrates specialized agents across multiple phases with session isolation,
    data extraction, and comprehensive error handling.
    """

    def __init__(
        self,
        provider: BaseProvider,
        prompts_manager: AgentPromptsManager | None = None,
        session_manager: SessionManager | None = None,
        progress_callback: Callable[[str, PhaseStatus], None] | None = None,
    ):
        """
        Initialize multi-agent orchestrator.

        Args:
            provider: LLM provider instance
            prompts_manager: Prompts manager (defaults to embedded prompts)
            session_manager: Session manager (defaults to temp storage)
            progress_callback: Optional callback for progress updates
        """
        self.provider = provider
        self.prompts_manager = prompts_manager or AgentPromptsManager()
        self.session_manager = session_manager or self._get_default_session_manager()
        self.progress_callback = progress_callback

        # Create the underlying workflow instance
        self._workflow = FullReportWorkflow(
            provider=provider,
            prompts_manager=self.prompts_manager,
            session_manager=self.session_manager,
            progress_callback=progress_callback,
        )

    def _get_default_session_manager(self) -> SessionManager:
        """
        Get default session manager for workflow.

        Returns:
            Session manager with temporary storage
        """
        storage_dir = Path.home() / ".cycling-ai" / "workflow_sessions"
        return SessionManager(storage_dir=storage_dir)

    def _should_analyze_cross_training(
        self, cache_file_path: str, threshold_pct: float = 0.10, min_activities: int = 20
    ) -> bool:
        """
        Auto-detect if cross-training analysis is warranted.

        Analyzes activity distribution in cache to determine if athlete
        participates in multiple sports at a meaningful level.

        Args:
            cache_file_path: Path to Parquet cache file
            threshold_pct: Minimum percentage of non-cycling activities (default: 10%)
            min_activities: Minimum total activities required for analysis (default: 20)

        Returns:
            True if cross-training analysis should be performed, False otherwise

        Criteria for cross-training analysis:
        - At least min_activities total activities in cache
        - At least 2 different activity categories
        - At least threshold_pct of activities are non-cycling
        """
        try:
            import pandas as pd

            # Load cache
            cache_path = Path(cache_file_path)
            if not cache_path.exists():
                logger.warning(f"Cache file not found for cross-training detection: {cache_file_path}")
                return False

            df = pd.read_parquet(cache_path)

            # Check minimum activity count
            if len(df) < min_activities:
                logger.info(
                    f"Cross-training analysis skipped: only {len(df)} activities (minimum {min_activities} required)"
                )
                return False

            # Check for activity_category column (added by cache preparation)
            if "activity_category" not in df.columns:
                logger.warning("Cache missing 'activity_category' column - cross-training analysis not available")
                return False

            # Count activities by category
            category_counts = df["activity_category"].value_counts()

            # Need at least 2 categories
            if len(category_counts) < 2:
                logger.info("Cross-training analysis skipped: only 1 activity category detected")
                return False

            # Calculate non-cycling percentage
            non_cycling_count = (df["activity_category"] != "Cycling").sum()
            non_cycling_pct = non_cycling_count / len(df)

            if non_cycling_pct >= threshold_pct:
                logger.info(
                    f"Cross-training analysis enabled: {non_cycling_pct:.1%} non-cycling activities "
                    f"({non_cycling_count}/{len(df)} activities)"
                )
                return True
            else:
                logger.info(
                    f"Cross-training analysis skipped: only {non_cycling_pct:.1%} non-cycling activities "
                    f"(threshold: {threshold_pct:.1%})"
                )
                return False

        except Exception as e:
            logger.error(f"Error during cross-training auto-detection: {str(e)}")
            return False

    def _validate_weekly_hours(
        self,
        training_plan: dict[str, Any],
        plan_metadata: dict[str, Any],
        tolerance_pct: float = 0.10,
    ) -> list[dict[str, Any]]:
        """
        Validate that weekly training hours don't exceed guideline (with tolerance).

        Args:
            training_plan: Training plan data with weekly_plan array
            plan_metadata: Plan metadata containing weekly_training_hours guideline
            tolerance_pct: Tolerance percentage (default 10%)

        Returns:
            List of violation dictionaries, empty if all weeks are within limits
            Each violation: {"week": int, "actual_hours": float, "max_allowed": float}
        """
        violations: list[dict[str, Any]] = []

        # Get the weekly hours guideline
        weekly_hours_guideline = plan_metadata.get("weekly_training_hours")
        if weekly_hours_guideline is None:
            logger.debug("[HOURS VALIDATION] No weekly_training_hours guideline found, skipping validation")
            return violations

        # Convert to float
        try:
            weekly_hours_guideline = float(weekly_hours_guideline)
        except (ValueError, TypeError):
            logger.warning(f"[HOURS VALIDATION] Invalid weekly_training_hours: {weekly_hours_guideline}")
            return violations

        # Calculate max allowed with tolerance
        max_allowed = weekly_hours_guideline * (1 + tolerance_pct)

        # Check each week
        weekly_plan = training_plan.get("weekly_plan", [])
        for week_idx, week in enumerate(weekly_plan, start=1):
            if not isinstance(week, dict):
                continue

            # Sum up hours from all workouts in the week
            total_hours = 0.0
            workouts = week.get("workouts", [])

            for workout in workouts:
                if not isinstance(workout, dict):
                    continue

                # Get duration in minutes, convert to hours
                duration_minutes = workout.get("duration_minutes", 0)
                try:
                    total_hours += float(duration_minutes) / 60.0
                except (ValueError, TypeError):
                    logger.warning(
                        f"[HOURS VALIDATION] Invalid duration for workout in week {week_idx}: {duration_minutes}"
                    )
                    continue

            # Check if exceeds max allowed
            if total_hours > max_allowed:
                violations.append(
                    {
                        "week": week_idx,
                        "actual_hours": total_hours,
                        "max_allowed": max_allowed,
                        "guideline": weekly_hours_guideline,
                        "exceeds_by": total_hours - max_allowed,
                    }
                )

        return violations

    def execute_workflow(self, config: WorkflowConfig) -> WorkflowResult:
        """
        Execute complete multi-agent workflow.

        IMPLEMENTATION: Delegates to FullReportWorkflow for modular execution.

        Flow:
        1. Validate configuration
        2. Execute Phase 1: Data Preparation (or skip if cache exists)
        3. Execute Phase 2: Performance Analysis (LLM - uses Phase 1 data)
        4. Execute Phase 3: Training Planning (LLM - uses Phase 2 data)
        5. Execute Phase 4: Report Data Consolidation (consolidates Phase 2 + 3 into report_data.json)
           ↑ FINAL DATA GENERATION - ALL LLM OUTPUT COMPLETE
        6. Return aggregated WorkflowResult

        NOTE: Phase 4 is the final step. HTML report generation can be done
        separately using the report_data.json output from Phase 4.

        Args:
            config: Workflow configuration

        Returns:
            WorkflowResult with results from all phases

        Raises:
            ValueError: If configuration is invalid
        """
        # Delegate to FullReportWorkflow
        logger.info("[MULTI_AGENT] Delegating workflow execution to FullReportWorkflow")
        return self._workflow.execute_workflow(config)
