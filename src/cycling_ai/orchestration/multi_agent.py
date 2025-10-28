"""
Multi-agent workflow orchestrator.

Coordinates sequential execution of specialized agents across multiple phases,
with data handoffs between phases and comprehensive error handling.
"""
from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any

from cycling_ai.orchestration.agent import AgentFactory
from cycling_ai.orchestration.prompts import AgentPromptsManager
from cycling_ai.orchestration.session import (
    ConversationSession,
    SessionManager,
)
from cycling_ai.providers.base import BaseProvider


class PhaseStatus(Enum):
    """
    Status of a workflow phase.

    A phase progresses through states:
    PENDING → IN_PROGRESS → (COMPLETED | FAILED | SKIPPED)
    """

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class PhaseResult:
    """
    Result from executing a single workflow phase.

    Contains both the agent's response and extracted structured data
    that can be passed to subsequent phases.

    Attributes:
        phase_name: Identifier for this phase (e.g., "data_preparation")
        status: Execution status of the phase
        agent_response: Natural language response from the agent
        extracted_data: Structured data extracted from tool results
        errors: List of error messages (if any)
        execution_time_seconds: Time taken to execute this phase
        tokens_used: Estimated token count for cost tracking
    """

    phase_name: str
    status: PhaseStatus
    agent_response: str
    extracted_data: dict[str, Any] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)
    execution_time_seconds: float = 0.0
    tokens_used: int = 0

    @property
    def success(self) -> bool:
        """Whether phase completed successfully."""
        return self.status == PhaseStatus.COMPLETED

    def to_dict(self) -> dict[str, Any]:
        """
        Convert to dictionary for serialization.

        Returns:
            Dictionary representation suitable for JSON serialization
        """
        return {
            "phase_name": self.phase_name,
            "status": self.status.value,
            "agent_response": self.agent_response,
            "extracted_data": self.extracted_data,
            "errors": self.errors,
            "execution_time_seconds": self.execution_time_seconds,
            "tokens_used": self.tokens_used,
        }


@dataclass
class WorkflowConfig:
    """
    Configuration for multi-agent workflow.

    Defines inputs, outputs, and execution parameters for the workflow.

    Attributes:
        csv_file_path: Path to Strava activities CSV export (optional, required only if not using FIT-only mode)
        athlete_profile_path: Path to athlete profile JSON
        fit_dir_path: Optional path to directory containing FIT files (required for FIT-only mode)
        output_dir: Directory for generated reports
        period_months: Number of months for performance comparison
        generate_training_plan: Whether to generate training plan (Phase 3)
        training_plan_weeks: Number of weeks for training plan
        fit_only_mode: If True, build activities DataFrame from FIT files instead of CSV
        provider: LLM provider instance (optional, set by orchestrator)
        max_iterations_per_phase: Maximum tool execution loops per phase
        prompts_dir: Optional directory with custom prompt files
    """

    # Input paths
    csv_file_path: Path | None
    athlete_profile_path: Path
    fit_dir_path: Path | None = None

    # Output paths
    output_dir: Path = field(default_factory=lambda: Path("./reports"))

    # Execution parameters
    period_months: int = 6
    generate_training_plan: bool = True
    training_plan_weeks: int = 12
    fit_only_mode: bool = False

    # Provider configuration
    provider: Any = None  # BaseProvider, but avoid circular import
    max_iterations_per_phase: int = 5

    # Prompts configuration
    prompts_dir: Path | None = None

    def validate(self) -> None:
        """
        Validate configuration.

        Raises:
            ValueError: If configuration is invalid
        """
        # Validate that we have either CSV or FIT directory
        if self.csv_file_path is None and self.fit_dir_path is None:
            raise ValueError("Either csv_file_path or fit_dir_path must be provided")

        # Validate CSV file if provided
        if self.csv_file_path is not None and not self.csv_file_path.exists():
            raise ValueError(f"CSV file not found: {self.csv_file_path}")

        # Validate athlete profile
        if not self.athlete_profile_path.exists():
            raise ValueError(f"Athlete profile not found: {self.athlete_profile_path}")

        # Validate FIT directory if provided
        if self.fit_dir_path and not self.fit_dir_path.is_dir():
            raise ValueError(f"FIT directory not found: {self.fit_dir_path}")

        # Validate FIT-only mode requirements
        if self.fit_only_mode and self.csv_file_path is not None:
            raise ValueError("fit_only_mode=True but csv_file_path was provided. Remove CSV or set fit_only_mode=False")

        if self.fit_only_mode and self.fit_dir_path is None:
            raise ValueError("fit_only_mode=True requires fit_dir_path to be provided")

        # Validate numeric parameters
        if self.period_months < 1 or self.period_months > 24:
            raise ValueError("period_months must be between 1 and 24")

        if self.training_plan_weeks < 1 or self.training_plan_weeks > 52:
            raise ValueError("training_plan_weeks must be between 1 and 52")

        if self.max_iterations_per_phase < 1:
            raise ValueError("max_iterations_per_phase must be positive")


@dataclass
class WorkflowResult:
    """
    Complete result from workflow execution.

    Contains results from all phases and metadata about the workflow run.

    Attributes:
        phase_results: Results from each executed phase
        total_execution_time_seconds: Total workflow execution time
        total_tokens_used: Total tokens across all phases
        output_files: List of generated output files (reports)
    """

    phase_results: list[PhaseResult]
    total_execution_time_seconds: float
    total_tokens_used: int
    output_files: list[Path] = field(default_factory=list)

    @property
    def success(self) -> bool:
        """
        Whether entire workflow completed successfully.

        Workflow is successful if all non-skipped phases completed.
        Skipped phases (like optional training plan) don't affect success.
        """
        return all(
            r.success for r in self.phase_results if r.status != PhaseStatus.SKIPPED
        )

    def get_phase_result(self, phase_name: str) -> PhaseResult | None:
        """
        Get result for specific phase.

        Args:
            phase_name: Name of phase to retrieve

        Returns:
            PhaseResult if found, None otherwise
        """
        for result in self.phase_results:
            if result.phase_name == phase_name:
                return result
        return None

    def to_dict(self) -> dict[str, Any]:
        """
        Convert to dictionary for serialization.

        Returns:
            Dictionary representation suitable for JSON serialization
        """
        return {
            "phase_results": [r.to_dict() for r in self.phase_results],
            "total_execution_time_seconds": self.total_execution_time_seconds,
            "total_tokens_used": self.total_tokens_used,
            "output_files": [str(f) for f in self.output_files],
            "success": self.success,
        }


class MultiAgentOrchestrator:
    """
    Coordinates multi-agent workflow execution.

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

    def _get_default_session_manager(self) -> SessionManager:
        """
        Get default session manager for workflow.

        Returns:
            Session manager with temporary storage
        """
        storage_dir = Path.home() / ".cycling-ai" / "workflow_sessions"
        return SessionManager(storage_dir=storage_dir)

    def _extract_phase_data(
        self,
        phase_name: str,
        response: str,
        session: ConversationSession,
    ) -> dict[str, Any]:
        """
        Extract structured data from phase execution.

        Examines tool results in session messages to extract data
        that can be passed to subsequent phases.

        Args:
            phase_name: Name of the phase
            response: Agent's response text
            session: Conversation session with messages

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

                        # Extract data based on tool type
                        try:
                            if tool_name == "analyze_performance":
                                data = json.loads(message.content)
                                extracted["performance_data"] = data
                            elif tool_name in ("analyze_zones", "analyze_time_in_zones"):
                                data = json.loads(message.content)
                                extracted["zones_data"] = data
                            elif tool_name == "generate_training_plan":
                                data = json.loads(message.content)
                                extracted["training_plan"] = data
                            elif tool_name == "analyze_cross_training_impact":
                                data = json.loads(message.content)
                                extracted["cross_training_data"] = data
                            elif tool_name == "generate_report":
                                data = json.loads(message.content)
                                extracted["report_data"] = data
                        except json.JSONDecodeError:
                            # Skip malformed JSON
                            pass

        return extracted

    def _estimate_tokens(self, session: ConversationSession) -> int:
        """
        Estimate token count for session.

        Uses rough approximation: 1 token ≈ 4 characters.

        Args:
            session: Conversation session

        Returns:
            Estimated token count
        """
        total_chars = sum(len(msg.content) for msg in session.messages)
        return total_chars // 4

    def _create_failed_workflow_result(
        self,
        phase_results: list[PhaseResult],
        workflow_start: datetime,
        total_tokens: int,
    ) -> WorkflowResult:
        """
        Create workflow result for failed execution.

        Args:
            phase_results: Results from executed phases
            workflow_start: Workflow start time
            total_tokens: Total tokens used

        Returns:
            WorkflowResult indicating failure
        """
        total_time = (datetime.now() - workflow_start).total_seconds()
        return WorkflowResult(
            phase_results=phase_results,
            total_execution_time_seconds=total_time,
            total_tokens_used=total_tokens,
            output_files=[],
        )

    def _execute_phase(
        self,
        phase_name: str,
        config: WorkflowConfig,
        prompt_getter: Callable[[], str],
        tools: list[str],
        phase_context: dict[str, Any],
        user_message: str,
    ) -> PhaseResult:
        """
        Execute a single workflow phase with session isolation.

        Args:
            phase_name: Name of the phase
            config: Workflow configuration
            prompt_getter: Function to get system prompt
            tools: List of available tool names
            phase_context: Context data for this phase
            user_message: User message to send to agent

        Returns:
            PhaseResult with execution details
        """
        phase_start = datetime.now()

        # Notify progress callback
        if self.progress_callback:
            self.progress_callback(phase_name, PhaseStatus.IN_PROGRESS)

        try:
            # Create isolated session for this phase
            session = self.session_manager.create_session(
                provider_name=self.provider.config.provider_name,
                context=phase_context,
                model=self.provider.config.model,
                system_prompt=prompt_getter(),
            )

            # Create agent with filtered tools
            agent = AgentFactory.create_agent(
                provider=self.provider,
                session=session,
                max_iterations=config.max_iterations_per_phase,
                allowed_tools=tools,
            )

            # Execute phase
            response = agent.process_message(user_message)

            # Extract structured data from tool results
            extracted_data = self._extract_phase_data(phase_name, response, session)

            # Calculate metrics
            execution_time = (datetime.now() - phase_start).total_seconds()
            tokens_used = self._estimate_tokens(session)

            # Create successful result
            result = PhaseResult(
                phase_name=phase_name,
                status=PhaseStatus.COMPLETED,
                agent_response=response,
                extracted_data=extracted_data,
                execution_time_seconds=execution_time,
                tokens_used=tokens_used,
            )

            if self.progress_callback:
                self.progress_callback(phase_name, PhaseStatus.COMPLETED)

            return result

        except Exception as e:
            # Handle failure gracefully
            execution_time = (datetime.now() - phase_start).total_seconds()

            result = PhaseResult(
                phase_name=phase_name,
                status=PhaseStatus.FAILED,
                agent_response="",
                errors=[str(e)],
                execution_time_seconds=execution_time,
            )

            if self.progress_callback:
                self.progress_callback(phase_name, PhaseStatus.FAILED)

            return result

    def _execute_phase_1(self, config: WorkflowConfig) -> PhaseResult:
        """
        Execute Phase 1: Data Preparation.

        Args:
            config: Workflow configuration

        Returns:
            PhaseResult for data preparation phase
        """
        # Prepare mode-specific instructions
        if config.fit_only_mode:
            mode_instructions = (
                "MODE: FIT-Only (no CSV file)\n"
                "- Build activities DataFrame from FIT files\n"
                "- Include output_dir_path parameter in prepare_cache() call\n"
                "- Zone enrichment will be automatic"
            )
        else:
            mode_instructions = (
                "MODE: CSV (with optional FIT enrichment)\n"
                "- Convert CSV to Parquet cache\n"
                "- Zone enrichment optional if FIT directory provided\n"
                "- Cache will be in CSV parent directory"
            )

        user_message = self.prompts_manager.get_data_preparation_user_prompt(
            csv_file_path=str(config.csv_file_path) if config.csv_file_path else "Not provided (FIT-only mode)",
            athlete_profile_path=str(config.athlete_profile_path),
            fit_dir_path=str(config.fit_dir_path) if config.fit_dir_path else "Not provided",
            output_dir_path=str(config.output_dir),
            mode_specific_instructions=mode_instructions,
        )

        return self._execute_phase(
            phase_name="data_preparation",
            config=config,
            prompt_getter=self.prompts_manager.get_data_preparation_prompt,
            tools=["validate_data_files", "prepare_cache"],
            phase_context={
                "csv_file_path": str(config.csv_file_path),
                "athlete_profile_path": str(config.athlete_profile_path),
                "fit_dir_path": str(config.fit_dir_path) if config.fit_dir_path else None,
            },
            user_message=user_message,
        )

    def _execute_phase_2(
        self, config: WorkflowConfig, phase1_result: PhaseResult
    ) -> PhaseResult:
        """
        Execute Phase 2: Performance Analysis.

        Args:
            config: Workflow configuration
            phase1_result: Result from Phase 1

        Returns:
            PhaseResult for performance analysis phase
        """
        user_message = self.prompts_manager.get_performance_analysis_user_prompt(
            period_months=config.period_months
        )

        return self._execute_phase(
            phase_name="performance_analysis",
            config=config,
            prompt_getter=self.prompts_manager.get_performance_analysis_prompt,
            tools=["analyze_performance", "analyze_time_in_zones"],
            phase_context=phase1_result.extracted_data,
            user_message=user_message,
        )

    def _execute_phase_3(
        self, config: WorkflowConfig, phase2_result: PhaseResult
    ) -> PhaseResult:
        """
        Execute Phase 3: Training Planning.

        Args:
            config: Workflow configuration
            phase2_result: Result from Phase 2

        Returns:
            PhaseResult for training planning phase
        """
        user_message = self.prompts_manager.get_training_planning_user_prompt(
            training_plan_weeks=config.training_plan_weeks
        )

        return self._execute_phase(
            phase_name="training_planning",
            config=config,
            prompt_getter=self.prompts_manager.get_training_planning_prompt,
            tools=["generate_training_plan"],
            phase_context=phase2_result.extracted_data,
            user_message=user_message,
        )

    def _execute_phase_4(
        self, config: WorkflowConfig, all_results: list[PhaseResult]
    ) -> PhaseResult:
        """
        Execute Phase 4: Report Generation.

        Args:
            config: Workflow configuration
            all_results: Results from all previous phases

        Returns:
            PhaseResult for report generation phase
        """
        # Combine data from all previous phases
        combined_data = {}
        for result in all_results:
            combined_data.update(result.extracted_data)

        user_message = self.prompts_manager.get_report_generation_user_prompt(
            output_dir=str(config.output_dir)
        )

        return self._execute_phase(
            phase_name="report_generation",
            config=config,
            prompt_getter=self.prompts_manager.get_report_generation_prompt,
            tools=["generate_report"],
            phase_context=combined_data,
            user_message=user_message,
        )

    def execute_workflow(self, config: WorkflowConfig) -> WorkflowResult:
        """
        Execute complete multi-agent workflow.

        Flow:
        1. Validate configuration
        2. Execute Phase 1: Data Preparation
        3. Execute Phase 2: Performance Analysis (uses Phase 1 data)
        4. Execute Phase 3: Training Planning (optional, uses Phase 2 data)
        5. Execute Phase 4: Report Generation (uses all previous data)
        6. Return aggregated WorkflowResult

        Args:
            config: Workflow configuration

        Returns:
            WorkflowResult with results from all phases

        Raises:
            ValueError: If configuration is invalid
        """
        # Validate configuration
        config.validate()

        phase_results: list[PhaseResult] = []
        workflow_start = datetime.now()
        total_tokens = 0

        # Phase 1: Data Preparation
        phase1_result = self._execute_phase_1(config)
        phase_results.append(phase1_result)
        total_tokens += phase1_result.tokens_used

        if not phase1_result.success:
            return self._create_failed_workflow_result(
                phase_results, workflow_start, total_tokens
            )

        # Phase 2: Performance Analysis
        phase2_result = self._execute_phase_2(config, phase1_result)
        phase_results.append(phase2_result)
        total_tokens += phase2_result.tokens_used

        if not phase2_result.success:
            return self._create_failed_workflow_result(
                phase_results, workflow_start, total_tokens
            )

        # Phase 3: Training Planning (optional)
        if config.generate_training_plan:
            phase3_result = self._execute_phase_3(config, phase2_result)
            phase_results.append(phase3_result)
            total_tokens += phase3_result.tokens_used

            if not phase3_result.success:
                # Training plan failure is non-fatal, mark as skipped
                phase3_result.status = PhaseStatus.SKIPPED
        else:
            # Skip training planning
            phase_results.append(
                PhaseResult(
                    phase_name="training_planning",
                    status=PhaseStatus.SKIPPED,
                    agent_response="Training plan generation was not requested",
                )
            )

        # Phase 4: Report Generation
        phase4_result = self._execute_phase_4(config, phase_results)
        phase_results.append(phase4_result)
        total_tokens += phase4_result.tokens_used

        if not phase4_result.success:
            return self._create_failed_workflow_result(
                phase_results, workflow_start, total_tokens
            )

        # Success! But validate output files were actually created
        workflow_end = datetime.now()
        total_time = (workflow_end - workflow_start).total_seconds()

        # Validate output files exist
        output_files = phase4_result.extracted_data.get("output_files", [])
        validated_files: list[Path] = []

        if output_files:
            for file_path in output_files:
                file_obj = Path(file_path)
                if file_obj.exists():
                    validated_files.append(file_obj.absolute())
                else:
                    # File was reported but doesn't exist - log warning
                    pass

        return WorkflowResult(
            phase_results=phase_results,
            total_execution_time_seconds=total_time,
            total_tokens_used=total_tokens,
            output_files=validated_files,
        )
