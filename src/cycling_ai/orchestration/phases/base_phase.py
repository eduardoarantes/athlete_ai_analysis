"""
Abstract base class for workflow phases.

Provides template method pattern for phase execution with:
- Session isolation
- Tool filtering
- Error handling
- Progress tracking
"""

from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

from cycling_ai.orchestration.base import PhaseContext, PhaseResult, PhaseStatus
from cycling_ai.orchestration.session import ConversationSession
from cycling_ai.orchestration.agent import AgentFactory

logger = logging.getLogger(__name__)


class BasePhase(ABC):
    """
    Abstract base class for all workflow phases.

    Implements template method pattern where execute() orchestrates:
    1. Session creation with system prompt
    2. Agent creation with filtered tools
    3. Agent execution with user message
    4. Data extraction from tool results
    5. Error handling and progress tracking

    Subclasses must implement:
    - _get_system_prompt(): Build system prompt for this phase
    - _get_user_message(): Craft user message for this phase
    - _extract_data(): Extract structured data from session

    Example:
        >>> class MyPhase(BasePhase):
        ...     def __init__(self):
        ...         super().__init__(
        ...             phase_name="my_phase",
        ...             required_tools=["analyze_performance"]
        ...         )
        ...
        ...     def _get_system_prompt(self, config, context):
        ...         return "You are a performance analyst..."
        ...
        ...     def _get_user_message(self, config, context):
        ...         return "Analyze the athlete's performance"
        ...
        ...     def _extract_data(self, session):
        ...         return {"performance_data": {...}}
    """

    def __init__(
        self,
        phase_name: str,
        required_tools: list[str],
        max_iterations: int | None = None,
    ):
        """
        Initialize base phase.

        Args:
            phase_name: Unique identifier for this phase
            required_tools: List of tool names this phase needs
            max_iterations: Maximum tool execution loops (None = use context default)
        """
        self.phase_name = phase_name
        self.required_tools = required_tools
        self.max_iterations = max_iterations

    def execute(
        self,
        context: PhaseContext,
    ) -> PhaseResult:
        """
        Execute phase using template method pattern.

        This is the main entry point. Subclasses should NOT override this method.
        Instead, implement the abstract methods below.

        Supports two execution modes:
        1. Normal: Agent calls tools, results extracted from session
        2. Prefetch: Tools pre-executed, results embedded in prompt (1 interaction)

        Args:
            context: Phase execution context with config and previous phase data

        Returns:
            PhaseResult with status, response, and extracted data
        """
        phase_start = datetime.now()

        # Notify progress callback
        if context.progress_callback:
            context.progress_callback(self.phase_name, PhaseStatus.IN_PROGRESS)

        try:
            # Check if phase wants to prefetch tool data
            prefetched_data = self._prefetch_tool_data(context)

            if prefetched_data is not None:
                # OPTIMIZED PATH: Prefetch mode (1 interaction)
                logger.info(
                    f"[{self.phase_name}] Using prefetch optimization - "
                    f"tools pre-executed, synthesis-only mode"
                )
                result = self._execute_with_prefetch(context, prefetched_data, phase_start)
            else:
                # NORMAL PATH: Agent calls tools
                logger.debug(f"[{self.phase_name}] Using normal tool-calling mode")
                result = self._execute_normal(context, phase_start)

            # Notify completion
            if context.progress_callback:
                context.progress_callback(self.phase_name, PhaseStatus.COMPLETED)

            return result

        except Exception as e:
            # Handle any errors
            import traceback

            execution_time = (datetime.now() - phase_start).total_seconds()
            error_msg = f"{type(e).__name__}: {str(e)}"

            # Get full traceback for debugging
            tb_lines = traceback.format_exception(type(e), e, e.__traceback__)
            full_traceback = "".join(tb_lines)

            logger.error(
                f"Phase {self.phase_name} failed after {execution_time:.2f}s: "
                f"{error_msg}\n{full_traceback}"
            )

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

    def _execute_normal(
        self,
        context: PhaseContext,
        phase_start: datetime,
    ) -> PhaseResult:
        """
        Normal execution path: agent calls tools.

        Args:
            context: Phase execution context
            phase_start: Start time for tracking

        Returns:
            PhaseResult with extracted data from tool results
        """
        # Step 1: Create session with system prompt
        session = self._create_session(context)

        # Step 2: Create agent with filtered tools
        agent = self._create_agent(context, session)

        # Step 3: Execute agent with user message
        user_message = self._get_user_message(
            config=self._context_to_config_dict(context),
            context=context,
        )
        response = agent.process_message(user_message)

        # Step 4: Extract structured data from tool results
        extracted_data = self._extract_data(session)

        # Step 5: Build successful result
        execution_time = (datetime.now() - phase_start).total_seconds()

        result = PhaseResult(
            phase_name=self.phase_name,
            status=PhaseStatus.COMPLETED,
            agent_response=response,
            extracted_data=extracted_data,
            errors=[],
            execution_time_seconds=execution_time,
            tokens_used=self._estimate_tokens(session),
        )

        logger.info(
            f"Phase {self.phase_name} completed successfully in "
            f"{execution_time:.2f}s (normal mode)"
        )

        return result

    def _execute_with_prefetch(
        self,
        context: PhaseContext,
        prefetched_data: dict[str, Any],
        phase_start: datetime,
    ) -> PhaseResult:
        """
        Optimized execution path: tools pre-executed, synthesis-only.

        This reduces LLM interactions from 2-3 to 1 by:
        1. Pre-executing deterministic tool calls
        2. Embedding results directly in prompt
        3. Agent only synthesizes (no tool access)

        Args:
            context: Phase execution context
            prefetched_data: Pre-executed tool results
            phase_start: Start time for tracking

        Returns:
            PhaseResult with prefetched data as extracted_data
        """
        # Step 1: Create session with system prompt
        session = self._create_session(context)

        # Step 2: Create agent WITHOUT tools (synthesis only)
        max_iterations = (
            self.max_iterations
            if self.max_iterations is not None
            else 1  # Only 1 iteration needed for synthesis
        )

        agent = AgentFactory.create_agent(
            provider=context.provider,
            session=session,
            allowed_tools=[],  # No tools - synthesis only!
            max_iterations=max_iterations,
        )

        # Step 3: Execute agent with user message (includes prefetched data)
        user_message = self._get_user_message_with_data(
            config=self._context_to_config_dict(context),
            context=context,
            prefetched_data=prefetched_data,
        )
        response = agent.process_message(user_message)

        # Step 4: Extract data from LLM response (not tool results!)
        extracted_data = self._extract_data_from_response(response, prefetched_data)

        # Step 5: Build successful result
        execution_time = (datetime.now() - phase_start).total_seconds()

        result = PhaseResult(
            phase_name=self.phase_name,
            status=PhaseStatus.COMPLETED,
            agent_response=response,
            extracted_data=extracted_data,
            errors=[],
            execution_time_seconds=execution_time,
            tokens_used=self._estimate_tokens(session),
        )

        logger.info(
            f"Phase {self.phase_name} completed successfully in "
            f"{execution_time:.2f}s (prefetch mode - 1 interaction)"
        )

        return result

    def _create_session(self, context: PhaseContext) -> ConversationSession:
        """
        Create fresh session for this phase (session isolation).

        Args:
            context: Phase execution context

        Returns:
            New ConversationSession with system prompt and previous phase data
        """
        system_prompt = self._get_system_prompt(
            config=self._context_to_config_dict(context),
            context=context,
        )

        session: ConversationSession = context.session_manager.create_session(
            provider_name=context.provider.config.provider_name,
            context=context.previous_phase_data,  # Pass previous phase data
            system_prompt=system_prompt,
        )

        logger.debug(
            f"Created session {session.session_id} for phase {self.phase_name}"
        )

        return session

    def _create_agent(
        self,
        context: PhaseContext,
        session: ConversationSession,
    ) -> Any:  # Returns LLMAgent but avoid circular import
        """
        Create agent with filtered tools.

        Only tools in self.required_tools are passed to the agent.

        Args:
            context: Phase execution context
            session: Session for this phase

        Returns:
            LLMAgent configured with filtered tools
        """
        # Determine max iterations
        max_iterations = (
            self.max_iterations
            if self.max_iterations is not None
            else context.config.max_iterations_per_phase
        )

        # Create agent with allowed_tools filter
        agent = AgentFactory.create_agent(
            provider=context.provider,
            session=session,
            allowed_tools=self.required_tools,  # This filters tools
            max_iterations=max_iterations,
        )

        logger.debug(
            f"Created agent for phase {self.phase_name} with "
            f"{len(self.required_tools)} allowed tools"
        )

        return agent

    def _context_to_config_dict(self, context: PhaseContext) -> dict[str, Any]:
        """
        Convert PhaseContext to config dictionary for prompt building.

        Args:
            context: Phase execution context

        Returns:
            Dictionary with config values
        """
        config = context.config
        return {
            "csv_file_path": str(config.csv_file_path) if config.csv_file_path else None,
            "athlete_profile_path": str(config.athlete_profile_path),
            "fit_dir_path": str(config.fit_dir_path) if config.fit_dir_path else None,
            "output_dir": str(config.output_dir),
            "period_months": config.period_months,
            "generate_training_plan": config.generate_training_plan,
            "training_plan_weeks": config.training_plan_weeks,
            "fit_only_mode": config.fit_only_mode,
            "analyze_cross_training": config.analyze_cross_training,
        }

    def _estimate_tokens(self, session: ConversationSession) -> int:
        """
        Estimate token usage for this phase.

        Rough estimation: 1 token ≈ 4 characters for English text.

        Args:
            session: Session for this phase

        Returns:
            Estimated token count
        """
        total_chars = 0

        for message in session.messages:
            total_chars += len(message.content)

        # Rough estimate: 1 token ≈ 4 chars
        return total_chars // 4

    def _prefetch_tool_data(self, context: PhaseContext) -> dict[str, Any] | None:
        """
        Optional hook for phases to pre-execute deterministic tools.

        If this returns data, the phase will use optimized prefetch mode:
        - Tools are executed BEFORE agent creation
        - Results are embedded directly in the user prompt
        - Agent has NO tool access (synthesis only)
        - Reduces from 2-3 LLM interactions to 1

        Use this when:
        1. Tool calls are 100% deterministic (no LLM decision needed)
        2. Tools just fetch/process data (no reasoning required)
        3. LLM's job is to synthesize results

        Args:
            context: Phase execution context

        Returns:
            Dictionary with prefetched tool results, or None for normal mode
        """
        return None

    def _get_user_message_with_data(
        self,
        config: dict[str, Any],
        context: PhaseContext,
        prefetched_data: dict[str, Any],
    ) -> str:
        """
        Build user message with prefetched data embedded.

        Default implementation falls back to normal _get_user_message().
        Subclasses using prefetch should override this to inject data.

        Args:
            config: Configuration dictionary
            context: Phase execution context
            prefetched_data: Pre-executed tool results

        Returns:
            User message with data embedded
        """
        # Default: fall back to normal message
        return self._get_user_message(config, context)

    def _extract_data_from_response(
        self,
        response: str,
        prefetched_data: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Extract data from LLM response in prefetch mode.

        Default implementation returns prefetched_data as-is.
        Subclasses can override to parse structured output from LLM.

        Args:
            response: LLM's synthesis response
            prefetched_data: Original prefetched tool results

        Returns:
            Extracted data (defaults to prefetched_data)
        """
        # Default: return prefetched data as-is
        return prefetched_data

    @abstractmethod
    def _get_system_prompt(
        self, config: dict[str, Any], context: PhaseContext
    ) -> str:
        """
        Get system prompt for this phase.

        Subclasses must implement this to provide phase-specific system prompt.

        Args:
            config: Configuration dictionary
            context: Phase execution context

        Returns:
            System prompt string
        """
        pass

    @abstractmethod
    def _get_user_message(
        self, config: dict[str, Any], context: PhaseContext
    ) -> str:
        """
        Craft user message for this phase.

        Subclasses must implement this to provide phase-specific user message.

        Args:
            config: Configuration dictionary
            context: Phase execution context

        Returns:
            User message string
        """
        pass

    @abstractmethod
    def _extract_data(self, session: ConversationSession) -> dict[str, Any]:
        """
        Extract structured data from session.

        Subclasses must implement this to extract phase-specific data from
        tool results in the session.

        Args:
            session: Session containing tool results

        Returns:
            Dictionary with extracted data
        """
        pass
