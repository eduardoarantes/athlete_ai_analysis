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
    skip_data_prep: bool = False

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

        # Validate skip_data_prep requirements
        if self.skip_data_prep:
            # Cache must exist when skipping data prep
            cache_path = self.output_dir / "cache" / "activities_processed.parquet"
            if not cache_path.exists():
                raise ValueError(
                    f"Cache file not found: {cache_path}\n"
                    f"The --skip-data-prep flag requires an existing cache file.\n"
                    f"Run without this flag first to create the cache, or check the output directory path."
                )


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
                            if tool_name == "prepare_cache":
                                # Extract cache path and metadata from Phase 1
                                data = json.loads(message.content)
                                if "cache_path" in data:
                                    extracted["cache_file_path"] = data["cache_path"]
                                if "metadata_path" in data:
                                    extracted["cache_metadata_path"] = data["metadata_path"]
                                extracted["cache_info"] = data
                            elif tool_name == "validate_data_files":
                                # Extract profile path from validation
                                data = json.loads(message.content)
                                if "profile_file" in data:
                                    extracted["athlete_profile_path"] = data["profile_file"]
                            elif tool_name == "analyze_performance":
                                data = json.loads(message.content)
                                extracted["performance_data"] = data
                            elif tool_name in ("analyze_zones", "analyze_time_in_zones"):
                                data = json.loads(message.content)
                                extracted["zones_data"] = data
                            elif tool_name in ("generate_training_plan", "finalize_training_plan"):
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

            # Persist session to disk (agent adds messages but doesn't save)
            self.session_manager.update_session(session)

            # Extract structured data from tool results
            extracted_data = self._extract_phase_data(phase_name, response, session)

            # Store session ID for downstream phases that need access to session data
            extracted_data["session_id"] = session.session_id

            # For performance analysis phase, also store the markdown response
            if phase_name == "performance_analysis":
                extracted_data["performance_analysis_markdown"] = response

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

            # Persist session even on failure (agent may have added messages before failing)
            try:
                self.session_manager.update_session(session)
            except Exception:
                pass  # Don't fail the phase result if session persistence fails

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

        # Include analyze_time_in_zones tool if FIT files are provided
        # This tool enriches the cache with zone data during Phase 1
        tools = ["validate_data_files", "prepare_cache"]
        if config.fit_dir_path:
            tools.append("analyze_time_in_zones")

        return self._execute_phase(
            phase_name="data_preparation",
            config=config,
            prompt_getter=self.prompts_manager.get_data_preparation_prompt,
            tools=tools,
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
        # Extract file paths from Phase 1
        cache_file_path = phase1_result.extracted_data.get("cache_file_path", "Not available")
        athlete_profile_path = phase1_result.extracted_data.get("athlete_profile_path", str(config.athlete_profile_path))

        user_message = self.prompts_manager.get_performance_analysis_user_prompt(
            period_months=config.period_months,
            cache_file_path=cache_file_path,
            athlete_profile_path=athlete_profile_path,
        )

        # Phase 2 only does performance analysis - zone calculation moved to Phase 1
        return self._execute_phase(
            phase_name="performance_analysis",
            config=config,
            prompt_getter=self.prompts_manager.get_performance_analysis_prompt,
            tools=["analyze_performance"],
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
        from cycling_ai.core.power_zones import calculate_power_zones
        from cycling_ai.core.athlete import load_athlete_profile

        # Extract athlete profile path from Phase 2 context (originally from Phase 1)
        athlete_profile_path = phase2_result.extracted_data.get(
            "athlete_profile_path", str(config.athlete_profile_path)
        )

        # Load athlete profile to get FTP
        try:
            athlete_profile = load_athlete_profile(athlete_profile_path)
            ftp = athlete_profile.ftp
        except Exception:
            # Fallback to default FTP if profile can't be loaded
            ftp = 260  # Default FTP

        # Pre-calculate power zones
        power_zones = calculate_power_zones(ftp)

        # Format zones for prompt
        zones_text = f"**Power Zones (based on FTP {ftp}W):**\n"
        for zone_id, zone_data in power_zones.items():
            zones_text += f"- **{zone_id.upper()} ({zone_data['name']})**: {zone_data['min']}-{zone_data['max']}W ({int(zone_data['ftp_pct_min']*100)}-{int(zone_data['ftp_pct_max']*100)}% FTP) - {zone_data['description']}\n"

        user_message = self.prompts_manager.get_training_planning_user_prompt(
            training_plan_weeks=str(config.training_plan_weeks),
            athlete_profile_path=athlete_profile_path,
            power_zones=zones_text,
        )

        return self._execute_phase(
            phase_name="training_planning",
            config=config,
            prompt_getter=self.prompts_manager.get_training_planning_prompt,
            tools=["create_workout", "finalize_training_plan"],  # Removed calculate_power_zones
            phase_context=phase2_result.extracted_data,
            user_message=user_message,
        )

    def _execute_phase_4(
        self, config: WorkflowConfig, all_results: list[PhaseResult]
    ) -> PhaseResult:
        """
        Execute Phase 4: Report Data Preparation.

        Consolidates training plan data into report_data.json format
        for use with the HTML viewer and subsequent report generation.

        Args:
            config: Workflow configuration
            all_results: Results from all previous phases

        Returns:
            PhaseResult for report data preparation phase
        """
        from cycling_ai.tools.report_data_extractor import create_report_data

        phase_start = datetime.now()

        try:
            # Get the training planning phase result (Phase 3)
            training_phase_result = next(
                (r for r in all_results if r.phase_name == "training_planning"),
                None
            )

            if not training_phase_result or not training_phase_result.success:
                return PhaseResult(
                    phase_name="report_data_preparation",
                    status=PhaseStatus.FAILED,
                    agent_response="Training planning phase did not complete successfully",
                    errors=["Cannot prepare report data without training plan"],
                )

            # Get the training plan from Phase 3's extracted data
            training_plan = training_phase_result.extracted_data.get("training_plan")
            if not training_plan:
                return PhaseResult(
                    phase_name="report_data_preparation",
                    status=PhaseStatus.FAILED,
                    agent_response="Training plan not found in Phase 3 results",
                    errors=["Training plan was not extracted from Phase 3"],
                )

            # Load athlete profile
            import json
            with open(config.athlete_profile_path) as f:
                athlete_profile = json.load(f)

            # Create athlete data structure for report
            athlete_data = {
                "athlete_name": athlete_profile.get("name", "Unknown"),
                "training_plan": training_plan,
            }

            # Create report data structure
            generator_info = {
                "tool": "cycling-ai",
                "version": "0.1.0",
                "command": "generate (integrated workflow)",
            }

            report_data = create_report_data([athlete_data], generator_info)

            # Save report data to output directory
            output_path = config.output_dir / "report_data.json"
            with open(output_path, "w") as f:
                json.dump(report_data, f, indent=2)

            # Copy HTML viewer template to output directory
            import shutil
            from pathlib import Path

            # Get template path (relative to project root)
            project_root = Path(__file__).parent.parent.parent.parent
            template_path = project_root / "templates" / "training_plan_viewer.html"
            viewer_output_path = config.output_dir / "training_plan_viewer.html"

            if template_path.exists():
                shutil.copy2(template_path, viewer_output_path)
                viewer_copied = True
            else:
                viewer_copied = False

            phase_end = datetime.now()
            execution_time = (phase_end - phase_start).total_seconds()

            response_msg = f"Report data prepared successfully and saved to {output_path}"
            if viewer_copied:
                response_msg += f"\nHTML viewer copied to {viewer_output_path}"

            return PhaseResult(
                phase_name="report_data_preparation",
                status=PhaseStatus.COMPLETED,
                agent_response=response_msg,
                extracted_data={
                    "report_data_path": str(output_path),
                    "viewer_path": str(viewer_output_path) if viewer_copied else None,
                    "athlete_id": athlete_data["id"],
                    "athlete_name": athlete_data["name"],
                    "report_data": report_data,  # Make available for Phase 5
                },
                execution_time_seconds=execution_time,
            )

        except Exception as e:
            phase_end = datetime.now()
            execution_time = (phase_end - phase_start).total_seconds()

            return PhaseResult(
                phase_name="report_data_preparation",
                status=PhaseStatus.FAILED,
                agent_response=f"Report data preparation failed: {str(e)}",
                errors=[str(e)],
                execution_time_seconds=execution_time,
            )

    def _execute_phase_5(
        self, config: WorkflowConfig, all_results: list[PhaseResult]
    ) -> PhaseResult:
        """
        Execute Phase 5: Report Generation.

        Generates HTML reports using structured data from Phase 4.

        Args:
            config: Workflow configuration
            all_results: Results from all previous phases

        Returns:
            PhaseResult for report generation phase
        """
        # Get structured report data from Phase 4
        phase4_result = all_results[-1]  # Phase 4 is the last result
        report_data = phase4_result.extracted_data.get("report_data")

        if not report_data:
            # Fallback: try loading from file
            report_data_path = config.output_dir / "report_data.json"
            if report_data_path.exists():
                with open(report_data_path) as f:
                    report_data = json.load(f)
            else:
                return PhaseResult(
                    phase_name="report_generation",
                    status=PhaseStatus.FAILED,
                    agent_response="No structured data available from Phase 4",
                    errors=["report_data not found in Phase 4 results or file system"],
                )

        # Combine with any additional context from previous phases
        combined_data = {
            "report_data": report_data,
        }

        # Add performance/zones data if needed
        for result in all_results[:-1]:  # Exclude Phase 4
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
        2. Execute Phase 1: Data Preparation (or skip if cache exists)
        3. Execute Phase 2: Performance Analysis (uses Phase 1 data)
        4. Execute Phase 3: Training Planning (optional, uses Phase 2 data)
        5. Execute Phase 4: Report Data Preparation (consolidates into report_data.json)
        6. Execute Phase 5: Report Generation (LLM generates HTML using Phase 4 data)
        7. Return aggregated WorkflowResult

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

        # Phase 1: Data Preparation (skip if requested and cache exists)
        if config.skip_data_prep:
            # Skip Phase 1 - cache already validated in config.validate()
            # Populate extracted_data with cache file paths for Phase 2
            cache_file_path = str(config.output_dir / "cache" / "activities_processed.parquet")
            phase1_result = PhaseResult(
                phase_name="data_preparation",
                status=PhaseStatus.SKIPPED,
                agent_response="Data preparation skipped - using existing cache",
                extracted_data={
                    "cache_file_path": cache_file_path,
                    "athlete_profile_path": str(config.athlete_profile_path),
                    "zones_already_calculated": True,  # Cache includes zone data
                },
            )
            if self.progress_callback:
                self.progress_callback("data_preparation", PhaseStatus.SKIPPED)
        else:
            # Execute Phase 1 normally
            phase1_result = self._execute_phase_1(config)
            total_tokens += phase1_result.tokens_used

            if not phase1_result.success:
                return self._create_failed_workflow_result(
                    phase_results, workflow_start, total_tokens
                )

        phase_results.append(phase1_result)

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

        # Phase 4: Prepare Report Data (consolidate into report_data.json)
        if config.generate_training_plan:
            phase4_result = self._execute_phase_4(config, phase_results)
            phase_results.append(phase4_result)
            # This is a post-processing step, not an LLM call, so no tokens used

            if not phase4_result.success:
                return self._create_failed_workflow_result(
                    phase_results, workflow_start, total_tokens
                )
        else:
            # Skip if no training plan was generated
            phase_results.append(
                PhaseResult(
                    phase_name="report_data_preparation",
                    status=PhaseStatus.SKIPPED,
                    agent_response="Report data preparation skipped - no training plan generated",
                )
            )

        # Phase 5: Report Generation (LLM generates HTML reports)
        phase5_result = self._execute_phase_5(config, phase_results)
        phase_results.append(phase5_result)
        total_tokens += phase5_result.tokens_used

        if not phase5_result.success:
            return self._create_failed_workflow_result(
                phase_results, workflow_start, total_tokens
            )

        # Success! But validate output files were actually created
        workflow_end = datetime.now()
        total_time = (workflow_end - workflow_start).total_seconds()

        # Validate output files exist (from Phase 5 now)
        output_files = phase5_result.extracted_data.get("output_files", [])
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
