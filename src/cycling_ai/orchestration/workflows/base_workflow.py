"""
Abstract base class for workflow orchestration.

Provides template method pattern for coordinating phase execution.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable
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
from cycling_ai.orchestration.prompts import AgentPromptsManager
from cycling_ai.orchestration.session import SessionManager
from cycling_ai.orchestration.phases.base_phase import BasePhase


class BaseWorkflow(ABC):
    """
    Abstract base class for workflow orchestration.

    Coordinates execution of multiple phases in sequence, handling:
    - Phase context creation
    - Data accumulation between phases
    - Error handling and early termination
    - Progress tracking

    Subclasses must implement:
    - get_phases(): Return list of phases to execute
    - execute_workflow(): Orchestrate phase execution logic

    Example:
        >>> class MyWorkflow(BaseWorkflow):
        ...     def get_phases(self) -> list[BasePhase]:
        ...         return [
        ...             DataPreparationPhase(),
        ...             PerformanceAnalysisPhase(),
        ...         ]
        ...
        ...     def execute_workflow(self, config: WorkflowConfig) -> WorkflowResult:
        ...         config.validate()
        ...         phase_results = []
        ...         previous_data = {}
        ...
        ...         for phase in self.get_phases():
        ...             context = self._create_phase_context(config, previous_data)
        ...             result = phase.execute(context)
        ...             phase_results.append(result)
        ...
        ...             if not result.success:
        ...                 return self._create_failed_workflow_result(...)
        ...
        ...             previous_data.update(result.extracted_data)
        ...
        ...         return WorkflowResult(...)
    """

    def __init__(
        self,
        provider: Any,  # BaseProvider (avoid circular import)
        prompts_manager: AgentPromptsManager | None = None,
        session_manager: SessionManager | None = None,
        progress_callback: Callable[[str, PhaseStatus], None] | None = None,
    ):
        """
        Initialize workflow orchestrator.

        Args:
            provider: LLM provider for agent interactions
            prompts_manager: Optional custom prompts manager
            session_manager: Optional custom session manager
            progress_callback: Optional callback for progress updates
        """
        self.provider = provider
        self.prompts_manager = prompts_manager or AgentPromptsManager()
        self.session_manager = session_manager or SessionManager()
        self.progress_callback = progress_callback

    @abstractmethod
    def get_phases(self) -> list[BasePhase]:
        """
        Get list of phases to execute in this workflow.

        Returns:
            List of BasePhase instances in execution order

        Example:
            >>> def get_phases(self) -> list[BasePhase]:
            ...     return [
            ...         DataPreparationPhase(),
            ...         PerformanceAnalysisPhase(),
            ...         TrainingPlanningPhase(),
            ...         ReportPreparationPhase(),
            ...     ]
        """
        pass

    @abstractmethod
    def execute_workflow(self, config: WorkflowConfig) -> WorkflowResult:
        """
        Execute complete workflow.

        This is the main entry point for workflow execution. Subclasses
        should implement their workflow logic here, using helper methods
        like _create_phase_context() and _create_failed_workflow_result().

        Args:
            config: Workflow configuration

        Returns:
            WorkflowResult with results from all executed phases

        Raises:
            ValueError: If configuration is invalid

        Example:
            >>> def execute_workflow(self, config: WorkflowConfig) -> WorkflowResult:
            ...     config.validate()
            ...     workflow_start = datetime.now()
            ...     phase_results = []
            ...     previous_data: dict[str, Any] = {}
            ...     total_tokens = 0
            ...
            ...     for phase in self.get_phases():
            ...         context = self._create_phase_context(config, previous_data)
            ...         result = phase.execute(context)
            ...         phase_results.append(result)
            ...
            ...         if not result.success:
            ...             return self._create_failed_workflow_result(
            ...                 phase_results, workflow_start, total_tokens
            ...             )
            ...
            ...         previous_data.update(result.extracted_data)
            ...         total_tokens += result.tokens_used
            ...
            ...     total_time = (datetime.now() - workflow_start).total_seconds()
            ...     return WorkflowResult(
            ...         phase_results=phase_results,
            ...         total_execution_time_seconds=total_time,
            ...         total_tokens_used=total_tokens,
            ...         output_files=[],
            ...     )
        """
        pass

    def _create_phase_context(
        self, config: WorkflowConfig, previous_phase_data: dict[str, Any]
    ) -> PhaseContext:
        """
        Create phase execution context.

        Helper method to build PhaseContext with config and accumulated data
        from previous phases.

        Args:
            config: Workflow configuration
            previous_phase_data: Data extracted from previous phases

        Returns:
            PhaseContext ready for phase execution

        Example:
            >>> context = self._create_phase_context(config, {})
            >>> result = phase.execute(context)
        """
        return PhaseContext(
            config=config,
            previous_phase_data=previous_phase_data,
            session_manager=self.session_manager,
            provider=self.provider,
            prompts_manager=self.prompts_manager,
            progress_callback=self.progress_callback,
        )

    def _create_failed_workflow_result(
        self,
        phase_results: list[PhaseResult],
        workflow_start: datetime,
        total_tokens: int,
    ) -> WorkflowResult:
        """
        Create workflow result for failed execution.

        Helper method to build WorkflowResult when a phase fails.

        Args:
            phase_results: Results from phases executed before failure
            workflow_start: Workflow start time for duration calculation
            total_tokens: Total tokens used before failure

        Returns:
            WorkflowResult with failed status

        Example:
            >>> if not result.success:
            ...     return self._create_failed_workflow_result(
            ...         phase_results, workflow_start, total_tokens
            ...     )
        """
        total_time = (datetime.now() - workflow_start).total_seconds()
        return WorkflowResult(
            phase_results=phase_results,
            total_execution_time_seconds=total_time,
            total_tokens_used=total_tokens,
            output_files=[],
        )
