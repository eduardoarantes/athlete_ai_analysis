"""
Multi-agent workflow orchestrator.

Coordinates sequential execution of specialized agents across multiple phases,
with data handoffs between phases and comprehensive error handling.
"""
from __future__ import annotations

import json
import logging
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

logger = logging.getLogger(__name__)


# Phase name constants
PHASE_DATA_PREPARATION = "data_preparation"
PHASE_PERFORMANCE_ANALYSIS = "performance_analysis"
PHASE_TRAINING_PLANNING = "training_planning"
PHASE_REPORT_DATA_PREPARATION = "report_data_preparation"


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
        analyze_cross_training: Whether to analyze cross-training impact (None=auto-detect, True=force, False=skip)
        provider: LLM provider instance (optional, set by orchestrator)
        max_iterations_per_phase: Maximum tool execution loops per phase
        prompts_dir: Optional directory with custom prompt files
    """

    # Input paths (required fields first)
    csv_file_path: Path | None
    athlete_profile_path: Path
    training_plan_weeks: int  # Required, no default - must come from athlete profile

    # Input paths (with defaults)
    fit_dir_path: Path | None = None

    # Output paths
    output_dir: Path = field(default_factory=lambda: Path("./reports"))

    # Execution parameters
    period_months: int = 6
    generate_training_plan: bool = True
    fit_only_mode: bool = False
    skip_data_prep: bool = False

    # Cross-training analysis (uses same period_months as cycling analysis)
    analyze_cross_training: bool | None = None  # None = auto-detect, True = force, False = skip

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

    def _should_analyze_cross_training(
        self,
        cache_file_path: str,
        threshold_pct: float = 0.10,
        min_activities: int = 20
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
                    f"Cross-training analysis skipped: only {len(df)} activities "
                    f"(minimum {min_activities} required)"
                )
                return False

            # Check for activity_category column (added by cache preparation)
            if 'activity_category' not in df.columns:
                logger.warning("Cache missing 'activity_category' column - cross-training analysis not available")
                return False

            # Count activities by category
            category_counts = df['activity_category'].value_counts()

            # Need at least 2 categories
            if len(category_counts) < 2:
                logger.info("Cross-training analysis skipped: only 1 activity category detected")
                return False

            # Calculate non-cycling percentage
            non_cycling_count = (df['activity_category'] != 'Cycling').sum()
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

    def _extract_phase_data(
        self,
        phase_name: str,
        response: str,
        session: ConversationSession,
    ) -> dict[str, Any]:
        """
        Extract structured data from phase execution.

        Examines tool results in session messages to extract data
        that can be passed to subsequent phases. For Phase 2 and Phase 3,
        also extracts and validates the LLM's JSON response content.

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
                            elif tool_name == "create_plan_overview":
                                # Phase 3a: Extract plan_id from overview creation
                                data = json.loads(message.content)
                                logger.info(f"[PHASE {phase_name.upper()}] Extracting plan_id from create_plan_overview")
                                logger.debug(f"[PHASE {phase_name.upper()}] Tool result data keys: {list(data.keys())}")

                                if "plan_id" in data:
                                    extracted["plan_id"] = data["plan_id"]
                                    logger.info(f"[PHASE {phase_name.upper()}] Extracted plan_id: {data['plan_id']}")
                                else:
                                    logger.error(f"[PHASE {phase_name.upper()}] No plan_id found in create_plan_overview result")

                                # Also store the full overview data
                                extracted["plan_overview"] = data
                            elif tool_name == "add_week_details":
                                # Phase 3b: Track weekly details addition
                                data = json.loads(message.content)
                                logger.info(f"[PHASE {phase_name.upper()}] Week details added")
                                logger.debug(f"[PHASE {phase_name.upper()}] Tool result: {data}")

                                # Keep track of week count
                                if "weeks_added" not in extracted:
                                    extracted["weeks_added"] = 0
                                extracted["weeks_added"] += 1
                            elif tool_name in ("generate_training_plan", "finalize_training_plan"):
                                data = json.loads(message.content)
                                logger.info(f"[PHASE {phase_name.upper()}] Extracting training plan from tool result")
                                logger.debug(f"[PHASE {phase_name.upper()}] Tool result data keys: {list(data.keys())}")
                                logger.debug(f"[PHASE {phase_name.upper()}] Tool result data type: {type(data)}")

                                # The tool wrapper returns {"training_plan": {...}}
                                if "training_plan" in data:
                                    extracted["training_plan"] = data["training_plan"]
                                    logger.info(f"[PHASE {phase_name.upper()}] Extracted nested training_plan")
                                    logger.debug(f"[PHASE {phase_name.upper()}] Nested training_plan keys: {list(data['training_plan'].keys())}")
                                else:
                                    # Fallback if structure is different
                                    extracted["training_plan"] = data
                                    logger.warning(f"[PHASE {phase_name.upper()}] No 'training_plan' wrapper found, using data directly")

                                # Validate we have the expected structure
                                plan_data = extracted.get("training_plan", {})
                                if isinstance(plan_data, dict):
                                    weekly_plan_count = len(plan_data.get("weekly_plan", []))
                                    logger.info(f"[PHASE {phase_name.upper()}] Training plan has {weekly_plan_count} weeks")
                                    # target_ftp is nested in plan_metadata (not at top level)
                                    plan_metadata = plan_data.get('plan_metadata', {})
                                    target_ftp_value = plan_metadata.get('target_ftp', 'N/A')
                                    logger.info(f"[PHASE {phase_name.upper()}] Training plan target_ftp: {target_ftp_value}")

                                    # Validate weekly hours (10% tolerance)
                                    hours_violations = self._validate_weekly_hours(plan_data, plan_metadata)
                                    if hours_violations:
                                        logger.warning(
                                            f"[PHASE {phase_name.upper()}] Training plan has {len(hours_violations)} "
                                            f"weeks exceeding hours_per_week guideline (+10% tolerance)"
                                        )
                                        for violation in hours_violations:
                                            logger.warning(f"  Week {violation['week']}: {violation['actual_hours']:.1f}h > {violation['max_allowed']:.1f}h")
                                else:
                                    logger.error(f"[PHASE {phase_name.upper()}] Training plan is not a dict: {type(plan_data)}")
                            elif tool_name == "analyze_cross_training_impact":
                                data = json.loads(message.content)
                                extracted["cross_training_data"] = data
                            elif tool_name == "generate_report":
                                data = json.loads(message.content)
                                extracted["report_data"] = data
                        except json.JSONDecodeError:
                            # Skip malformed JSON
                            pass

        # For Phase 2 (Performance Analysis), extract the LLM's formatted JSON response
        if phase_name == PHASE_PERFORMANCE_ANALYSIS and response:
            extracted["performance_analysis_json"] = self._extract_and_validate_phase2_response(response)

        # For Phase 3 (Training Planning), extract the training plan from tool result
        # (Already handled above via finalize_training_plan tool result)

        return extracted

    def _extract_and_validate_phase2_response(self, response: str) -> dict[str, Any] | None:
        """
        Extract and validate Phase 2 Performance Analysis JSON response.

        Args:
            response: LLM's response text (may be wrapped in markdown code fence)

        Returns:
            Validated performance analysis dict or None if invalid
        """
        try:
            # Strip markdown code fence if present
            cleaned = response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]  # Remove ```json
            elif cleaned.startswith("```"):
                cleaned = cleaned[3:]  # Remove ```

            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]  # Remove trailing ```

            cleaned = cleaned.strip()

            # Try to parse response as JSON
            data = json.loads(cleaned)

            # Validate against schema
            if self._validate_performance_analysis_schema(data):
                logger.info("[PHASE 2] Successfully extracted and validated performance analysis JSON")
                return dict(data)  # Cast Any to dict[str, Any]
            else:
                logger.warning("[PHASE 2] Performance analysis JSON does not match expected schema")
                return None

        except json.JSONDecodeError as e:
            logger.warning(f"[PHASE 2] Could not parse response as JSON: {e}")
            return None

    def _validate_performance_analysis_schema(self, data: dict[str, Any]) -> bool:
        """
        Validate performance analysis data against expected schema.

        Args:
            data: Performance analysis dictionary

        Returns:
            True if valid, False otherwise
        """
        required_fields = [
            "athlete_profile",
            "performance_comparison",
            "time_in_zones",
            "key_trends",
            "insights",
            "recommendations",
            "analysis_period_months"
        ]

        # Check all required top-level fields exist
        for field in required_fields:
            if field not in data:
                logger.warning(f"[PHASE 2 VALIDATION] Missing required field: {field}")
                return False

        # Basic structure validation
        if not isinstance(data["athlete_profile"], dict):
            logger.warning("[PHASE 2 VALIDATION] athlete_profile must be an object")
            return False

        if not isinstance(data["performance_comparison"], list):
            logger.warning("[PHASE 2 VALIDATION] performance_comparison must be an array")
            return False

        if not isinstance(data["time_in_zones"], list):
            logger.warning("[PHASE 2 VALIDATION] time_in_zones must be an array")
            return False

        if not isinstance(data["key_trends"], list):
            logger.warning("[PHASE 2 VALIDATION] key_trends must be an array")
            return False

        if not isinstance(data["insights"], list):
            logger.warning("[PHASE 2 VALIDATION] insights must be an array")
            return False

        if not isinstance(data["recommendations"], dict):
            logger.warning("[PHASE 2 VALIDATION] recommendations must be an object")
            return False

        logger.debug("[PHASE 2 VALIDATION] Schema validation passed")
        return True

    def _validate_weekly_hours(
        self,
        training_plan: dict[str, Any],
        plan_metadata: dict[str, Any],
        tolerance_pct: float = 0.10
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
                    logger.warning(f"[HOURS VALIDATION] Invalid duration for workout in week {week_idx}: {duration_minutes}")
                    continue

            # Check if exceeds max allowed
            if total_hours > max_allowed:
                violations.append({
                    "week": week_idx,
                    "actual_hours": total_hours,
                    "max_allowed": max_allowed,
                    "guideline": weekly_hours_guideline,
                    "exceeds_by": total_hours - max_allowed
                })

        return violations

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
                    summary_lines.append(f"- Average Power: {current_stats['avg_power']:.0f}W")
                if "avg_speed" in current_stats:
                    summary_lines.append(f"- Average Speed: {current_stats['avg_speed']:.1f} km/h")
                if "total_distance" in current_stats:
                    summary_lines.append(f"- Total Distance: {current_stats['total_distance']:.0f} km")
                if "total_time" in current_stats:
                    hours = current_stats['total_time'] / 3600
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
        force_tool_call: bool = False,
        max_iterations: int | None = None,
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
            force_tool_call: If True, force LLM to call tool instead of responding with text
            max_iterations: Override max iterations for this phase (defaults to config value)

        Returns:
            PhaseResult with execution details
        """
        phase_start = datetime.now()

        # Phase execution logging
        effective_max_iterations = max_iterations or config.max_iterations_per_phase
        logger.info(f"[PHASE {phase_name.upper()}] Starting execution")
        logger.debug(f"[PHASE {phase_name.upper()}] Available tools: {tools}")
        logger.debug(f"[PHASE {phase_name.upper()}] Context keys: {list(phase_context.keys())}")
        logger.debug(f"[PHASE {phase_name.upper()}] Max iterations: {effective_max_iterations}")

        # Notify progress callback
        if self.progress_callback:
            self.progress_callback(phase_name, PhaseStatus.IN_PROGRESS)

        try:
            # Create isolated session for this phase
            logger.debug(f"[PHASE {phase_name.upper()}] Creating session...")
            session = self.session_manager.create_session(
                provider_name=self.provider.config.provider_name,
                context=phase_context,
                model=self.provider.config.model,
                system_prompt=prompt_getter(),
            )
            logger.info(f"[PHASE {phase_name.upper()}] Session created: {session.session_id}")

            # Create agent with filtered tools
            logger.debug(f"[PHASE {phase_name.upper()}] Creating agent with {len(tools)} tools...")
            if force_tool_call:
                logger.debug(f"[PHASE {phase_name.upper()}] Force tool call enabled")
            agent = AgentFactory.create_agent(
                provider=self.provider,
                session=session,
                max_iterations=effective_max_iterations,
                allowed_tools=tools,
                force_tool_call=force_tool_call,  # Pass flag to agent
            )

            # Execute phase
            logger.info(f"[PHASE {phase_name.upper()}] Starting agent execution...")
            logger.debug(f"[PHASE {phase_name.upper()}] User message: {user_message[:100]}...")
            response = agent.process_message(user_message)
            logger.info(f"[PHASE {phase_name.upper()}] Agent completed successfully")
            logger.debug(f"[PHASE {phase_name.upper()}] Response length: {len(response)} characters")

            # Persist session to disk (agent adds messages but doesn't save)
            logger.debug(f"[PHASE {phase_name.upper()}] Persisting session to disk...")
            self.session_manager.update_session(session)

            # Extract structured data from tool results
            logger.debug(f"[PHASE {phase_name.upper()}] Extracting structured data...")
            extracted_data = self._extract_phase_data(phase_name, response, session)
            logger.info(f"[PHASE {phase_name.upper()}] Extracted data keys: {list(extracted_data.keys())}")

            # Store session ID for downstream phases that need access to session data
            extracted_data["session_id"] = session.session_id

            # For performance analysis phase, the JSON is already extracted and validated
            # by _extract_phase_data() - don't overwrite it with the raw response
            if phase_name == PHASE_PERFORMANCE_ANALYSIS and "performance_analysis_json" in extracted_data:
                logger.debug(f"[PHASE {phase_name.upper()}] Performance analysis JSON already extracted and validated")

            # Calculate metrics
            execution_time = (datetime.now() - phase_start).total_seconds()
            tokens_used = self._estimate_tokens(session)
            logger.info(f"[PHASE {phase_name.upper()}] Execution time: {execution_time:.2f}s")
            logger.info(f"[PHASE {phase_name.upper()}] Estimated tokens used: {tokens_used}")

            # Create successful result
            result = PhaseResult(
                phase_name=phase_name,
                status=PhaseStatus.COMPLETED,
                agent_response=response,
                extracted_data=extracted_data,
                execution_time_seconds=execution_time,
                tokens_used=tokens_used,
            )

            logger.info(f"[PHASE {phase_name.upper()}] Status: COMPLETED")

            if self.progress_callback:
                self.progress_callback(phase_name, PhaseStatus.COMPLETED)

            return result

        except Exception as e:
            # Handle failure gracefully
            execution_time = (datetime.now() - phase_start).total_seconds()
            logger.error(f"[PHASE {phase_name.upper()}] Failed with exception: {e}", exc_info=True)
            logger.info(f"[PHASE {phase_name.upper()}] Execution time before failure: {execution_time:.2f}s")

            # Persist session even on failure (agent may have added messages before failing)
            try:
                logger.debug(f"[PHASE {phase_name.upper()}] Attempting to persist session despite failure...")
                self.session_manager.update_session(session)
            except Exception as persist_error:
                logger.warning(f"[PHASE {phase_name.upper()}] Failed to persist session: {persist_error}")
                pass  # Don't fail the phase result if session persistence fails

            result = PhaseResult(
                phase_name=phase_name,
                status=PhaseStatus.FAILED,
                agent_response="",
                errors=[str(e)],
                execution_time_seconds=execution_time,
            )

            logger.info(f"[PHASE {phase_name.upper()}] Status: FAILED")
            logger.warning(f"[PHASE {phase_name.upper()}] Errors: {result.errors}")

            if self.progress_callback:
                self.progress_callback(phase_name, PhaseStatus.FAILED)

            return result

    def _execute_phase_1(self, config: WorkflowConfig) -> PhaseResult:
        """
        Execute Phase 1: Data Preparation (Direct execution, no LLM).

        Validates data files and creates optimized cache without LLM orchestration.

        Args:
            config: Workflow configuration

        Returns:
            PhaseResult for data preparation phase
        """
        from cycling_ai.tools.wrappers.data_validation_tool import DataValidationTool
        from cycling_ai.tools.wrappers.cache_preparation_tool import CachePreparationTool

        phase_start = datetime.now()

        logger.info("[PHASE DATA_PREPARATION] Starting direct execution (no LLM)")

        try:
            # Step 1: Validate data files
            logger.info("[PHASE DATA_PREPARATION] Validating data files...")
            validation_tool = DataValidationTool()
            validation_params = {
                "athlete_profile_path": str(config.athlete_profile_path),
            }
            if config.csv_file_path:
                validation_params["csv_file_path"] = str(config.csv_file_path)
            if config.fit_dir_path:
                validation_params["fit_dir_path"] = str(config.fit_dir_path)

            validation_result = validation_tool.execute(**validation_params)

            if not validation_result.success:
                errors = validation_result.data.get("issues", ["Validation failed"])
                logger.error(f"[PHASE DATA_PREPARATION] Validation failed: {errors}")
                return PhaseResult(
                    phase_name=PHASE_DATA_PREPARATION,
                    status=PhaseStatus.FAILED,
                    agent_response="Data validation failed",
                    errors=errors,
                    execution_time_seconds=(datetime.now() - phase_start).total_seconds(),
                )

            logger.info("[PHASE DATA_PREPARATION] Validation passed")

            # Step 2: Create cache
            logger.info("[PHASE DATA_PREPARATION] Creating optimized cache...")
            cache_tool = CachePreparationTool()
            cache_params = {
                "athlete_profile_path": str(config.athlete_profile_path),
            }
            if config.csv_file_path:
                cache_params["csv_file_path"] = str(config.csv_file_path)
            if config.fit_dir_path:
                cache_params["fit_dir_path"] = str(config.fit_dir_path)
            if config.fit_only_mode or not config.csv_file_path:
                cache_params["output_dir_path"] = str(config.output_dir)

            cache_result = cache_tool.execute(**cache_params)

            if not cache_result.success:
                errors = cache_result.errors or ["Cache creation failed"]
                logger.error(f"[PHASE DATA_PREPARATION] Cache creation failed: {errors}")
                return PhaseResult(
                    phase_name=PHASE_DATA_PREPARATION,
                    status=PhaseStatus.FAILED,
                    agent_response="Cache creation failed",
                    errors=errors,
                    execution_time_seconds=(datetime.now() - phase_start).total_seconds(),
                )

            logger.info("[PHASE DATA_PREPARATION] Cache created successfully")

            # Build response message
            validation_msg = validation_result.data.get("message", "Validation passed")
            cache_msg = cache_result.data.get("message", "Cache created")
            response = f"{validation_msg}\n\n{cache_msg}\n\nData preparation complete. Ready for analysis."

            # Extract data for Phase 2
            extracted_data = {
                "cache_file_path": cache_result.data.get("cache_path"),
                "cache_metadata_path": cache_result.data.get("metadata_path"),
                "athlete_profile_path": str(config.athlete_profile_path),
                "zone_enriched": cache_result.data.get("zone_enriched", False),
                "cache_info": cache_result.data,
            }

            execution_time = (datetime.now() - phase_start).total_seconds()
            logger.info(f"[PHASE DATA_PREPARATION] Completed in {execution_time:.2f}s (no tokens used)")

            if self.progress_callback:
                self.progress_callback(PHASE_DATA_PREPARATION, PhaseStatus.COMPLETED)

            return PhaseResult(
                phase_name=PHASE_DATA_PREPARATION,
                status=PhaseStatus.COMPLETED,
                agent_response=response,
                extracted_data=extracted_data,
                execution_time_seconds=execution_time,
                tokens_used=0,  # No LLM calls
            )

        except Exception as e:
            execution_time = (datetime.now() - phase_start).total_seconds()
            logger.error(f"[PHASE DATA_PREPARATION] Failed with exception: {e}", exc_info=True)

            if self.progress_callback:
                self.progress_callback(PHASE_DATA_PREPARATION, PhaseStatus.FAILED)

            return PhaseResult(
                phase_name=PHASE_DATA_PREPARATION,
                status=PhaseStatus.FAILED,
                agent_response=f"Data preparation failed: {str(e)}",
                errors=[str(e)],
                execution_time_seconds=execution_time,
                tokens_used=0,
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

        # Determine if cross-training analysis should be performed
        should_analyze_ct = False
        if config.analyze_cross_training is None:
            # Auto-detect
            should_analyze_ct = self._should_analyze_cross_training(cache_file_path)
        else:
            # Explicit override
            should_analyze_ct = config.analyze_cross_training

        # Build cross-training instructions (empty if not needed)
        if should_analyze_ct:
            cross_training_instructions = self.prompts_manager.get_cross_training_instructions(
                period_months=str(config.period_months)
            )
            logger.info("[PHASE 2] Cross-training analysis ENABLED")
        else:
            cross_training_instructions = ""
            logger.info("[PHASE 2] Cross-training analysis DISABLED")

        # Build user message with conditional cross-training section
        user_message = self.prompts_manager.get_performance_analysis_user_prompt(
            period_months=str(config.period_months),
            cache_file_path=cache_file_path,
            athlete_profile_path=athlete_profile_path,
            cross_training_instructions=cross_training_instructions,
        )

        # Build tools list (conditionally include cross-training tool)
        tools = ["analyze_performance"]
        if should_analyze_ct:
            tools.append("analyze_cross_training_impact")

        # Phase 2 only does performance analysis - zone calculation moved to Phase 1
        return self._execute_phase(
            phase_name=PHASE_PERFORMANCE_ANALYSIS,
            config=config,
            prompt_getter=self.prompts_manager.get_performance_analysis_prompt,
            tools=tools,
            phase_context=phase1_result.extracted_data,
            user_message=user_message,
        )

    def _execute_phase_3a_overview(
        self, config: WorkflowConfig, phase2_result: PhaseResult
    ) -> PhaseResult:
        """
        Execute Phase 3a: Training Plan Overview Generation.

        Generates high-level plan structure with weekly phases, TSS targets, and focus areas.
        Returns plan_id for subsequent phases.

        Args:
            config: Workflow configuration
            phase2_result: Result from Phase 2

        Returns:
            PhaseResult with plan_id and overview data
        """
        from cycling_ai.core.power_zones import calculate_power_zones
        from cycling_ai.core.athlete import load_athlete_profile

        # Extract athlete profile path from Phase 2 context (originally from Phase 1)
        athlete_profile_path = phase2_result.extracted_data.get(
            "athlete_profile_path", str(config.athlete_profile_path)
        )

        # Load athlete profile to get FTP and training availability
        try:
            athlete_profile = load_athlete_profile(athlete_profile_path)
        except FileNotFoundError as e:
            raise ValueError(
                f"[PHASE 3] Cannot proceed: Athlete profile not found at '{athlete_profile_path}'. "
                f"Phase 3 requires a valid athlete profile with FTP, available training days, "
                f"and weekly time budget. Error: {e}"
            ) from e
        except Exception as e:
            raise ValueError(
                f"[PHASE 3] Cannot proceed: Failed to load athlete profile from '{athlete_profile_path}'. "
                f"Phase 3 requires a valid athlete profile. Error: {e}"
            ) from e

        # Validate required fields
        if not hasattr(athlete_profile, 'ftp') or athlete_profile.ftp is None:
            raise ValueError(
                f"[PHASE 3] Cannot proceed: Athlete profile at '{athlete_profile_path}' "
                f"does not have a valid FTP value. FTP is required for training plan generation."
            )

        ftp = athlete_profile.ftp
        available_days = athlete_profile.get_training_days()
        weekly_time_budget_hours = athlete_profile.get_weekly_training_hours()

        # Validate available days
        if not available_days or len(available_days) == 0:
            raise ValueError(
                f"[PHASE 3] Cannot proceed: Athlete profile at '{athlete_profile_path}' "
                f"does not specify available training days. At least one training day is required."
            )

        # Validate weekly time budget
        if weekly_time_budget_hours is None or weekly_time_budget_hours <= 0:
            raise ValueError(
                f"[PHASE 3] Cannot proceed: Athlete profile at '{athlete_profile_path}' "
                f"does not have a valid weekly time budget. Weekly time budget must be greater than 0."
            )

        # Get daily time caps if available (for prompt version 1.1+)
        daily_time_caps = getattr(athlete_profile, 'daily_time_caps', None)

        # Pre-calculate power zones
        power_zones = calculate_power_zones(ftp)

        # Format zones for prompt
        zones_text = f"**Power Zones (based on FTP {ftp}W):**\n"
        for zone_id, zone_data in power_zones.items():
            zones_text += f"- **{zone_id.upper()} ({zone_data['name']})**: {zone_data['min']}-{zone_data['max']}W ({int(zone_data['ftp_pct_min']*100)}-{int(zone_data['ftp_pct_max']*100)}% FTP) - {zone_data['description']}\n"

        # Format available days and daily time caps for prompt
        import json
        available_days_str = ", ".join(available_days)
        daily_time_caps_json = json.dumps(daily_time_caps) if daily_time_caps else "None"

        # Prepare prompt parameters (used for both system and user prompts)
        prompt_params = {
            "training_plan_weeks": str(config.training_plan_weeks),
            "athlete_profile_path": athlete_profile_path,
            "power_zones": zones_text,
            "available_days": available_days_str,
            "weekly_time_budget_hours": str(weekly_time_budget_hours),
            "daily_time_caps_json": daily_time_caps_json,
        }

        # Calculate additional template variables for v1.2 prompts
        num_available_days = len(available_days)
        num_rest_days = 7 - num_available_days
        total_tool_calls = 1 + config.training_plan_weeks + 1  # overview + weeks + finalize
        training_plan_weeks_plus_1 = config.training_plan_weeks + 1

        # Extract performance summary from phase 2 results (if available)
        performance_summary = self._generate_performance_summary(phase2_result.extracted_data)

        # Add v1.2-specific template variables
        prompt_params.update({
            "num_available_days": str(num_available_days),
            "num_rest_days": str(num_rest_days),
            "total_tool_calls": str(total_tool_calls),
            "training_plan_weeks_plus_1": str(training_plan_weeks_plus_1),
            "performance_summary": performance_summary,
        })

        user_message = self.prompts_manager.get_training_planning_overview_user_prompt(**prompt_params)

        return self._execute_phase(
            phase_name="training_planning_overview",
            config=config,
            prompt_getter=lambda: self.prompts_manager.get_training_planning_overview_prompt(**prompt_params),
            tools=["create_plan_overview"],  # Phase 3a: Only overview generation
            phase_context=phase2_result.extracted_data,
            user_message=user_message,
            force_tool_call=True,  # Force LLM to call tool
            max_iterations=5,  # Simple phase - just 1 tool call + buffer
        )

    def _execute_phase_3b_weeks(
        self, config: WorkflowConfig, phase3a_result: PhaseResult
    ) -> PhaseResult:
        """
        Execute Phase 3b: Weekly Workout Details Generation.

        Generates detailed workouts for each week iteratively.
        Uses plan_id from Phase 3a.

        Args:
            config: Workflow configuration
            phase3a_result: Result from Phase 3a with plan_id

        Returns:
            PhaseResult with all weeks added
        """
        from cycling_ai.core.power_zones import calculate_power_zones
        from cycling_ai.core.athlete import load_athlete_profile

        # Extract plan_id from Phase 3a
        plan_id = phase3a_result.extracted_data.get("plan_id")
        if not plan_id:
            raise ValueError(
                "[PHASE 3b] Cannot proceed: No plan_id found in Phase 3a results. "
                "Phase 3a must complete successfully first."
            )

        # Get athlete profile info (same as Phase 3a)
        athlete_profile_path = phase3a_result.extracted_data.get(
            "athlete_profile_path", str(config.athlete_profile_path)
        )
        athlete_profile = load_athlete_profile(athlete_profile_path)
        ftp = athlete_profile.ftp
        available_days = athlete_profile.get_training_days()
        weekly_time_budget_hours = athlete_profile.get_weekly_training_hours()
        daily_time_caps = getattr(athlete_profile, 'daily_time_caps', None)

        # Pre-calculate power zones
        power_zones = calculate_power_zones(ftp)
        zones_text = f"**Power Zones (based on FTP {ftp}W):**\n"
        for zone_id, zone_data in power_zones.items():
            zones_text += f"- **{zone_id.upper()} ({zone_data['name']})**: {zone_data['min']}-{zone_data['max']}W ({int(zone_data['ftp_pct_min']*100)}-{int(zone_data['ftp_pct_max']*100)}% FTP) - {zone_data['description']}\n"

        # Format prompt parameters
        import json
        available_days_str = ", ".join(available_days)
        daily_time_caps_json = json.dumps(daily_time_caps) if daily_time_caps else "None"

        prompt_params = {
            "plan_id": plan_id,
            "training_plan_weeks": str(config.training_plan_weeks),
            "athlete_profile_path": athlete_profile_path,
            "power_zones": zones_text,
            "available_days": available_days_str,
            "weekly_time_budget_hours": str(weekly_time_budget_hours),
            "daily_time_caps_json": daily_time_caps_json,
            "num_available_days": str(len(available_days)),
            "num_rest_days": str(7 - len(available_days)),
        }

        user_message = self.prompts_manager.get_training_planning_weeks_user_prompt(**prompt_params)

        return self._execute_phase(
            phase_name="training_planning_weeks",
            config=config,
            prompt_getter=lambda: self.prompts_manager.get_training_planning_weeks_prompt(**prompt_params),
            tools=["add_week_details"],  # Phase 3b: Only week details
            phase_context=phase3a_result.extracted_data,
            user_message=user_message,
            force_tool_call=True,  # Force LLM to call tool initially
            max_iterations=config.training_plan_weeks + 3,  # N weeks + small buffer for final response
        )

    def _execute_phase_3c_finalize(
        self, config: WorkflowConfig, phase3a_result: PhaseResult
    ) -> PhaseResult:
        """
        Execute Phase 3c: Training Plan Finalization (Python only - no LLM).

        Assembles complete plan from overview + all weeks, validates, and saves.
        Similar to Phase 1 data preparation - direct tool execution.

        Args:
            config: Workflow configuration
            phase3a_result: Result from Phase 3a with plan_id

        Returns:
            PhaseResult with complete training plan
        """
        phase_start = datetime.now()

        # Extract plan_id from Phase 3a
        plan_id = phase3a_result.extracted_data.get("plan_id")
        if not plan_id:
            raise ValueError(
                "[PHASE 3c] Cannot proceed: No plan_id found in Phase 3a results."
            )

        logger.info("[PHASE 3c FINALIZE] Starting plan finalization (no LLM)")
        logger.info(f"[PHASE 3c FINALIZE] plan_id: {plan_id}")

        # Directly call finalize_plan tool
        from cycling_ai.tools.wrappers.finalize_plan_tool import FinalizePlanTool

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
        logger.info(f"[PHASE 3c FINALIZE] Completed in {execution_time:.2f}s (no tokens used)")

        return PhaseResult(
            phase_name="training_planning_finalize",
            status=PhaseStatus.COMPLETED,
            agent_response=f"Training plan finalized and saved to {result.metadata.get('output_path')}",
            extracted_data=extracted_data,
            execution_time_seconds=execution_time,
        )

    def _execute_phase_4(
        self, config: WorkflowConfig, all_results: list[PhaseResult]
    ) -> PhaseResult:
        """
        Execute Phase 4: Report Data Preparation.

        Consolidates ALL data (performance analysis + training plan) into
        report_data.json format for use with the HTML viewer and report generation.

        This is the FINAL data generation step - no more LLM calls after this.

        Args:
            config: Workflow configuration
            all_results: Results from all previous phases

        Returns:
            PhaseResult for report data preparation phase
        """
        from cycling_ai.tools.report_data_extractor import (
            create_report_data,
            consolidate_athlete_data,
            load_athlete_profile,
            find_athlete_id_from_path
        )

        phase_start = datetime.now()

        try:
            # Get Phase 2: Performance Analysis result
            performance_phase_result = next(
                (r for r in all_results if r.phase_name == PHASE_PERFORMANCE_ANALYSIS),
                None
            )

            # Get Phase 3c: Training Planning Finalization result (contains complete plan)
            training_phase_result = next(
                (r for r in all_results if r.phase_name == "training_planning_finalize"),
                None
            )

            if not training_phase_result or not training_phase_result.success:
                return PhaseResult(
                    phase_name=PHASE_REPORT_DATA_PREPARATION,
                    status=PhaseStatus.FAILED,
                    agent_response="Training planning phase did not complete successfully",
                    errors=["Cannot prepare report data without training plan"],
                )

            # Get the training plan from Phase 3's extracted data
            logger.info("[PHASE 4] Retrieving training plan from Phase 3 extracted data")
            logger.debug(f"[PHASE 4] Phase 3 extracted_data keys: {list(training_phase_result.extracted_data.keys())}")

            training_plan = training_phase_result.extracted_data.get("training_plan")
            if not training_plan:
                logger.error("[PHASE 4] Training plan not found in Phase 3 extracted_data")
                logger.debug(f"[PHASE 4] Full extracted_data: {training_phase_result.extracted_data}")
                return PhaseResult(
                    phase_name=PHASE_REPORT_DATA_PREPARATION,
                    status=PhaseStatus.FAILED,
                    agent_response="Training plan not found in Phase 3 results",
                    errors=["Training plan was not extracted from Phase 3"],
                )

            logger.info(f"[PHASE 4] Retrieved training plan, type: {type(training_plan)}")
            if isinstance(training_plan, dict):
                logger.info(f"[PHASE 4] Training plan keys: {list(training_plan.keys())}")
                weekly_plan_len = len(training_plan.get("weekly_plan", []))
                logger.info(f"[PHASE 4] Training plan weekly_plan length: {weekly_plan_len}")
                logger.info(f"[PHASE 4] Training plan target_ftp: {training_plan.get('target_ftp', 'N/A')}")
            else:
                logger.error(f"[PHASE 4] Training plan is not a dict: {type(training_plan)}")

            # Get performance analysis from Phase 2 (optional)
            performance_analysis = None
            if performance_phase_result and performance_phase_result.success:
                performance_analysis = performance_phase_result.extracted_data.get("performance_analysis_json")
                if performance_analysis:
                    logger.info("[PHASE 4] Including performance analysis in report data")
                else:
                    logger.warning("[PHASE 4] Performance analysis phase succeeded but no data found")
            else:
                logger.warning("[PHASE 4] No performance analysis available")


            # Normalize profile using extractor utility
            profile = load_athlete_profile(config.athlete_profile_path)
            athlete_id = find_athlete_id_from_path(config.athlete_profile_path)
            athlete_name = config.athlete_profile_path.parent.name

            # Consolidate all data using the extractor utility
            logger.info("[PHASE 4] Calling consolidate_athlete_data()")
            logger.debug(f"[PHASE 4] Input: training_plan type={type(training_plan)}, keys={list(training_plan.keys()) if isinstance(training_plan, dict) else 'N/A'}")
            logger.debug(f"[PHASE 4] Input: athlete_id={athlete_id}, athlete_name={athlete_name}")
            logger.debug(f"[PHASE 4] Input: performance_analysis available={performance_analysis is not None}")

            athlete_data = consolidate_athlete_data(
                training_plan_data=training_plan,
                profile=profile,
                athlete_id=athlete_id,
                athlete_name=athlete_name,
                performance_analysis=performance_analysis
            )

            logger.info("[PHASE 4] consolidate_athlete_data() completed")
            logger.debug(f"[PHASE 4] athlete_data keys: {list(athlete_data.keys())}")
            if "training_plan" in athlete_data:
                tp = athlete_data["training_plan"]
                logger.info(f"[PHASE 4] athlete_data['training_plan'] keys: {list(tp.keys())}")
                # Extract data from training_plan (single level structure)
                weekly_plan_len = len(tp.get('weekly_plan', []))
                plan_metadata = tp.get('plan_metadata', {})
                target_ftp = plan_metadata.get('target_ftp', 'N/A')
                logger.info(f"[PHASE 4] athlete_data['training_plan']['weekly_plan'] length: {weekly_plan_len}")
                logger.info(f"[PHASE 4] athlete_data['training_plan']['plan_metadata']['target_ftp']: {target_ftp}")
            else:
                logger.error("[PHASE 4] No 'training_plan' key in athlete_data!")

            # Create report data structure
            generator_info = {
                "tool": "cycling-ai",
                "version": "0.1.0",
                "command": "generate (integrated workflow)",
            }

            logger.info("[PHASE 4] Creating report_data structure")
            report_data = create_report_data([athlete_data], generator_info)
            logger.info(f"[PHASE 4] report_data created with keys: {list(report_data.keys())}")
            logger.debug(f"[PHASE 4] report_data['athletes'] count: {len(report_data.get('athletes', []))}")

            # Save report data to output directory
            output_path = config.output_dir / "report_data.json"
            logger.info(f"[PHASE 4] Saving report_data to: {output_path}")
            with open(output_path, "w") as f:
                json.dump(report_data, f, indent=2)
            logger.info(f"[PHASE 4] report_data.json saved successfully, size: {output_path.stat().st_size} bytes")

           
            phase_end = datetime.now()
            execution_time = (phase_end - phase_start).total_seconds()

            response_msg = f"Complete report data prepared successfully:\n"
            response_msg += f"  - Training plan: {len(training_plan.get('weekly_plan', []))} weeks\n"
            if performance_analysis:
                response_msg += f"  - Performance analysis: included\n"
            response_msg += f"  - Saved to: {output_path}"


            logger.info(f"[PHASE 4] Creating PhaseResult, execution time={execution_time:.2f}s")

            result = PhaseResult(
                phase_name=PHASE_REPORT_DATA_PREPARATION,
                status=PhaseStatus.COMPLETED,
                agent_response=response_msg,
                extracted_data={
                    "report_data_path": str(output_path),
                    "athlete_name": athlete_name,
                    "report_data": report_data,  # Make available for HTML generation
                    "has_performance_analysis": performance_analysis is not None,
                },
                execution_time_seconds=execution_time,
            )

            logger.info(f"[PHASE 4] Returning PhaseResult with status={result.status}")
            return result

        except Exception as e:
            phase_end = datetime.now()
            execution_time = (phase_end - phase_start).total_seconds()

            import traceback
            error_details = traceback.format_exc()
            logger.error(f"[PHASE 4] Error: {error_details}")

            return PhaseResult(
                phase_name=PHASE_REPORT_DATA_PREPARATION,
                status=PhaseStatus.FAILED,
                agent_response=f"Report data preparation failed: {str(e)}",
                errors=[str(e), error_details],
                execution_time_seconds=execution_time,
            )


    def execute_workflow(self, config: WorkflowConfig) -> WorkflowResult:
        """
        Execute complete multi-agent workflow.

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
                phase_name=PHASE_DATA_PREPARATION,
                status=PhaseStatus.SKIPPED,
                agent_response="Data preparation skipped - using existing cache",
                extracted_data={
                    "cache_file_path": cache_file_path,
                    "athlete_profile_path": str(config.athlete_profile_path),
                    "zones_already_calculated": True,  # Cache includes zone data
                },
            )
            if self.progress_callback:
                self.progress_callback(PHASE_DATA_PREPARATION, PhaseStatus.SKIPPED)
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

        # Phase 3: Training Planning (optional) - Split into 3 sub-phases
        if config.generate_training_plan:
            # Phase 3a: Generate plan overview
            phase3a_result = self._execute_phase_3a_overview(config, phase2_result)
            phase_results.append(phase3a_result)
            total_tokens += phase3a_result.tokens_used

            if not phase3a_result.success:
                # Training plan failure is non-fatal, mark as skipped
                phase3a_result.status = PhaseStatus.SKIPPED
            else:
                # Phase 3b: Generate weekly details
                phase3b_result = self._execute_phase_3b_weeks(config, phase3a_result)
                phase_results.append(phase3b_result)
                total_tokens += phase3b_result.tokens_used

                if phase3b_result.success:
                    # Phase 3c: Finalize plan (Python only - no LLM)
                    phase3c_result = self._execute_phase_3c_finalize(config, phase3a_result)
                    phase_results.append(phase3c_result)
                    # No tokens used in Phase 3c
                else:
                    # Weekly details failed, mark as skipped
                    phase3b_result.status = PhaseStatus.SKIPPED
        else:
            # Skip training planning
            phase_results.append(
                PhaseResult(
                    phase_name=PHASE_TRAINING_PLANNING,
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
                    phase_name=PHASE_REPORT_DATA_PREPARATION,
                    status=PhaseStatus.SKIPPED,
                    agent_response="Report data preparation skipped - no training plan generated",
                )
            )

        # Workflow complete
        workflow_end = datetime.now()
        total_time = (workflow_end - workflow_start).total_seconds()

        # Collect output files from Phase 4 (report_data.json)
        validated_files: list[Path] = []
        if config.generate_training_plan:
            report_data_path = phase4_result.extracted_data.get("report_data_path")
            if report_data_path:
                file_obj = Path(report_data_path)
                if file_obj.exists():
                    validated_files.append(file_obj.absolute())

        return WorkflowResult(
            phase_results=phase_results,
            total_execution_time_seconds=total_time,
            total_tokens_used=total_tokens,
            output_files=validated_files,
        )
