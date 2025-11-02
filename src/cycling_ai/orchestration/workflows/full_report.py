"""
Full report generation workflow.

Orchestrates all 4 phases: data preparation, performance analysis,
training planning, and report preparation.
"""

from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from cycling_ai.orchestration.base import (
    PhaseContext,
    PhaseResult,
    PhaseStatus,
    WorkflowConfig,
    WorkflowResult,
)
from cycling_ai.orchestration.workflows.base_workflow import BaseWorkflow
from cycling_ai.orchestration.phases.data_preparation import DataPreparationPhase
from cycling_ai.orchestration.phases.performance_analysis import (
    PerformanceAnalysisPhase,
)
from cycling_ai.orchestration.phases.training_planning import TrainingPlanningPhase
from cycling_ai.orchestration.phases.report_preparation import ReportPreparationPhase
from cycling_ai.orchestration.phases.base_phase import BasePhase

logger = logging.getLogger(__name__)


class FullReportWorkflow(BaseWorkflow):
    """
    Complete 4-phase workflow for generating comprehensive reports.

    Phases:
    1. Data Preparation: Validate inputs, create Parquet cache
    2. Performance Analysis: Compare periods, analyze zones
    3. Training Planning: Generate periodized plan (optional)
    4. Report Preparation: Consolidate data into JSON

    Example:
        >>> from cycling_ai.providers.anthropic_provider import AnthropicProvider
        >>> provider = AnthropicProvider(...)
        >>> workflow = FullReportWorkflow(provider=provider)
        >>>
        >>> config = WorkflowConfig(
        ...     csv_file_path=Path("activities.csv"),
        ...     athlete_profile_path=Path("profile.json"),
        ...     training_plan_weeks=12,
        ... )
        >>>
        >>> result = workflow.execute_workflow(config)
        >>> print(f"Success: {result.success}")
        >>> print(f"Phases: {len(result.phase_results)}")
    """

    def get_phases(self) -> list[BasePhase]:
        """
        Get all 4 phases for full report generation.

        Returns:
            List of 4 phases: data prep, performance, training, report

        Example:
            >>> workflow = FullReportWorkflow(provider=provider)
            >>> phases = workflow.get_phases()
            >>> [p.phase_name for p in phases]
            ['data_preparation', 'performance_analysis', 'training_planning', 'report_preparation']
        """
        return [
            DataPreparationPhase(),
            PerformanceAnalysisPhase(),
            TrainingPlanningPhase(),
            ReportPreparationPhase(),
        ]

    def execute_workflow(self, config: WorkflowConfig) -> WorkflowResult:
        """
        Execute complete 4-phase workflow.

        Handles:
        - skip_data_prep flag (phase 1)
        - generate_training_plan flag (phases 3-4)
        - Data accumulation between phases
        - Early termination on failure

        Args:
            config: Workflow configuration

        Returns:
            WorkflowResult with results from all executed phases

        Raises:
            ValueError: If configuration is invalid

        Example:
            >>> result = workflow.execute_workflow(config)
            >>> if result.success:
            ...     print(f"Generated {len(result.output_files)} files")
            ... else:
            ...     print(f"Failed at phase: {result.phase_results[-1].phase_name}")
        """
        # Validate configuration
        config.validate()

        workflow_start = datetime.now()
        phase_results: list[PhaseResult] = []
        previous_data: dict[str, Any] = {}
        total_tokens = 0

        logger.info("Starting FullReportWorkflow execution")

        # ===================================================================
        # PHASE 1: Data Preparation (or skip)
        # ===================================================================
        if config.skip_data_prep:
            logger.info("Skipping Phase 1 (data preparation) per config.skip_data_prep=True")
            phase1_result = self._create_skipped_phase_1_result(config)
        else:
            logger.info("Executing Phase 1: Data Preparation")
            phase1 = DataPreparationPhase()
            context = self._create_phase_context(config, previous_data.copy())
            phase1_result = phase1.execute(context)

        phase_results.append(phase1_result)
        previous_data.update(phase1_result.extracted_data)
        total_tokens += phase1_result.tokens_used

        # Check for failure (SKIPPED is OK)
        if phase1_result.status == PhaseStatus.FAILED:
            logger.error("Phase 1 failed, stopping workflow")
            return self._create_failed_workflow_result(
                phase_results, workflow_start, total_tokens
            )

        # ===================================================================
        # PHASE 2: Performance Analysis
        # ===================================================================
        logger.info("Executing Phase 2: Performance Analysis")
        phase2 = PerformanceAnalysisPhase()
        context = self._create_phase_context(config, previous_data.copy())
        phase2_result = phase2.execute(context)

        phase_results.append(phase2_result)
        previous_data.update(phase2_result.extracted_data)
        total_tokens += phase2_result.tokens_used

        if phase2_result.status == PhaseStatus.FAILED:
            logger.error("Phase 2 failed, stopping workflow")
            return self._create_failed_workflow_result(
                phase_results, workflow_start, total_tokens
            )

        # ===================================================================
        # PHASE 3 & 4: Training Planning and Report Preparation (optional)
        # ===================================================================
        if config.generate_training_plan:
            # Phase 3: Training Planning
            logger.info("Executing Phase 3: Training Planning")
            phase3 = TrainingPlanningPhase()
            context = self._create_phase_context(config, previous_data.copy())
            phase3_result = phase3.execute(context)

            phase_results.append(phase3_result)
            previous_data.update(phase3_result.extracted_data)
            total_tokens += phase3_result.tokens_used

            if phase3_result.status == PhaseStatus.FAILED:
                logger.error("Phase 3 failed, stopping workflow")
                return self._create_failed_workflow_result(
                    phase_results, workflow_start, total_tokens
                )

            # Phase 4: Report Preparation
            logger.info("Executing Phase 4: Report Preparation")
            phase4 = ReportPreparationPhase()
            context = self._create_phase_context(config, previous_data.copy())
            phase4_result = phase4.execute(context)

            phase_results.append(phase4_result)
            previous_data.update(phase4_result.extracted_data)
            total_tokens += phase4_result.tokens_used

            if phase4_result.status == PhaseStatus.FAILED:
                logger.error("Phase 4 failed, stopping workflow")
                return self._create_failed_workflow_result(
                    phase_results, workflow_start, total_tokens
                )
        else:
            logger.info(
                "Skipping Phase 3 and 4 per config.generate_training_plan=False"
            )

        # ===================================================================
        # Workflow Complete
        # ===================================================================
        total_time = (datetime.now() - workflow_start).total_seconds()

        logger.info(
            f"FullReportWorkflow completed successfully in {total_time:.2f}s "
            f"({total_tokens} tokens)"
        )

        return WorkflowResult(
            phase_results=phase_results,
            total_execution_time_seconds=total_time,
            total_tokens_used=total_tokens,
            output_files=[],  # Will be populated by CLI layer
        )

    def _create_skipped_phase_1_result(self, config: WorkflowConfig) -> PhaseResult:
        """
        Create skipped result for Phase 1 when skip_data_prep=True.

        Args:
            config: Workflow configuration

        Returns:
            PhaseResult with SKIPPED status and cache path from config

        Example:
            >>> result = workflow._create_skipped_phase_1_result(config)
            >>> result.status
            <PhaseStatus.SKIPPED: 'skipped'>
        """
        cache_path = config.output_dir / "cache" / "activities_processed.parquet"
        return PhaseResult(
            phase_name="data_preparation",
            status=PhaseStatus.SKIPPED,
            agent_response="Data preparation skipped (using existing cache)",
            extracted_data={
                "cache_file_path": str(cache_path),
                "athlete_profile_path": str(config.athlete_profile_path),
            },
            execution_time_seconds=0.0,
            tokens_used=0,
        )
