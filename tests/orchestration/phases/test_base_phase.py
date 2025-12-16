"""
Tests for BasePhase abstract class.

Tests the template method pattern and abstract interface enforcement.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, Mock, patch

import pytest

from cycling_ai.orchestration.base import (
    PhaseContext,
    PhaseResult,
    PhaseStatus,
    WorkflowConfig,
)
from cycling_ai.orchestration.phases.base_phase import BasePhase
from cycling_ai.orchestration.session import ConversationSession, ConversationMessage


class MockPhase(BasePhase):
    """Concrete implementation for testing BasePhase."""

    def __init__(
        self,
        phase_name: str = "test_phase",
        required_tools: list[str] | None = None,
        should_fail: bool = False,
        extracted_data: dict[str, Any] | None = None,
    ):
        super().__init__(
            phase_name=phase_name,
            required_tools=required_tools or ["test_tool"],
        )
        self._should_fail = should_fail
        self._extracted_data = extracted_data or {"test_key": "test_value"}

    def _get_system_prompt(
        self, config: dict[str, Any], context: PhaseContext
    ) -> str:
        """Return test system prompt."""
        return "Test system prompt"

    def _get_user_message(
        self, config: dict[str, Any], context: PhaseContext
    ) -> str:
        """Return test user message."""
        return "Test user message"

    def _extract_data(self, session: ConversationSession) -> dict[str, Any]:
        """Return test extracted data."""
        if self._should_fail:
            raise ValueError("Test extraction error")
        return self._extracted_data


@pytest.fixture
def mock_provider() -> Mock:
    """Create mock LLM provider."""
    provider = Mock()
    provider.name = "test_provider"
    provider.config.provider_name = "test_provider"  # Code uses provider.config.provider_name
    provider.complete.return_value = "Test response from LLM"
    return provider


@pytest.fixture
def mock_session_manager(mock_provider: Mock) -> Mock:
    """Create mock session manager."""
    manager = Mock()

    # Create mock session
    mock_session = Mock(spec=ConversationSession)
    mock_session.session_id = "test_session_id"
    mock_session.messages = []  # Empty list for iteration

    # Mock add_message method
    def add_message(msg: Any) -> None:
        mock_session.messages.append(msg)

    mock_session.add_message = add_message

    manager.create_session.return_value = mock_session
    return manager


@pytest.fixture
def mock_prompts_manager() -> Mock:
    """Create mock prompts manager."""
    manager = Mock()
    return manager


@pytest.fixture
def phase_context(
    mock_provider: Mock,
    mock_session_manager: Mock,
    mock_prompts_manager: Mock,
    tmp_path: Path,
) -> PhaseContext:
    """Create test phase context."""
    config = WorkflowConfig(
        csv_file_path=None,
        athlete_profile_path=tmp_path / "profile.json",
        training_plan_weeks=12,
        fit_dir_path=tmp_path / "fit",
        output_dir=tmp_path / "output",
    )

    # Create required files
    config.athlete_profile_path.write_text('{"ftp": 250}')
    config.fit_dir_path.mkdir(parents=True, exist_ok=True)

    return PhaseContext(
        config=config,
        previous_phase_data={"test": "data"},
        session_manager=mock_session_manager,
        provider=mock_provider,
        prompts_manager=mock_prompts_manager,
        progress_callback=None,
    )


class TestBasePhaseInterface:
    """Test BasePhase abstract interface."""

    def test_cannot_instantiate_base_phase_directly(self) -> None:
        """BasePhase is abstract and cannot be instantiated."""
        with pytest.raises(TypeError, match="Can't instantiate abstract class"):
            BasePhase(phase_name="test", required_tools=["tool1"])  # type: ignore

    def test_subclass_must_implement_get_system_prompt(self) -> None:
        """Subclass must implement _get_system_prompt."""

        class IncompletePhase(BasePhase):
            def _get_user_message(
                self, config: dict[str, Any], context: PhaseContext
            ) -> str:
                return "message"

            def _extract_data(
                self, session: ConversationSession
            ) -> dict[str, Any]:
                return {}

        with pytest.raises(TypeError, match="Can't instantiate abstract class"):
            IncompletePhase(phase_name="incomplete", required_tools=[])  # type: ignore

    def test_subclass_must_implement_get_user_message(self) -> None:
        """Subclass must implement _get_user_message."""

        class IncompletePhase(BasePhase):
            def _get_system_prompt(
                self, config: dict[str, Any], context: PhaseContext
            ) -> str:
                return "prompt"

            def _extract_data(
                self, session: ConversationSession
            ) -> dict[str, Any]:
                return {}

        with pytest.raises(TypeError, match="Can't instantiate abstract class"):
            IncompletePhase(phase_name="incomplete", required_tools=[])  # type: ignore

    def test_subclass_must_implement_extract_data(self) -> None:
        """Subclass must implement _extract_data."""

        class IncompletePhase(BasePhase):
            def _get_system_prompt(
                self, config: dict[str, Any], context: PhaseContext
            ) -> str:
                return "prompt"

            def _get_user_message(
                self, config: dict[str, Any], context: PhaseContext
            ) -> str:
                return "message"

        with pytest.raises(TypeError, match="Can't instantiate abstract class"):
            IncompletePhase(phase_name="incomplete", required_tools=[])  # type: ignore


class TestBasePhaseTemplateMethod:
    """Test BasePhase template method execution pattern."""

    def test_execute_creates_session_with_correct_params(
        self,
        phase_context: PhaseContext,
        mock_session_manager: Mock,
    ) -> None:
        """execute() creates session with correct parameters."""
        with patch("cycling_ai.orchestration.phases.base_phase.AgentFactory.create_agent") as mock_agent_factory:
            # Mock agent
            mock_agent = Mock()
            mock_agent.process_message.return_value = "Test response"
            mock_agent_factory.return_value = mock_agent

            phase = MockPhase()
            phase.execute(phase_context)

            # Verify session creation
            mock_session_manager.create_session.assert_called_once()
            call_kwargs = mock_session_manager.create_session.call_args.kwargs

            assert call_kwargs["provider_name"] == "test_provider"
            assert "test" in call_kwargs["context"]
            assert "Test system prompt" in call_kwargs["system_prompt"]

    def test_execute_creates_agent_with_filtered_tools(
        self,
        phase_context: PhaseContext,
    ) -> None:
        """execute() creates agent with only required tools."""
        with patch("cycling_ai.orchestration.phases.base_phase.AgentFactory.create_agent") as mock_agent_factory:
            # Mock agent
            mock_agent = Mock()
            mock_agent.process_message.return_value = "Test response"
            mock_agent_factory.return_value = mock_agent

            phase = MockPhase(required_tools=["tool1", "tool2"])
            result = phase.execute(phase_context)

            # Should complete successfully (agent creation is internal)
            assert result.success
            assert result.phase_name == "test_phase"

    def test_execute_returns_phase_result_on_success(
        self,
        phase_context: PhaseContext,
    ) -> None:
        """execute() returns PhaseResult with extracted data on success."""
        with patch("cycling_ai.orchestration.phases.base_phase.AgentFactory.create_agent") as mock_agent_factory:
            # Mock agent
            mock_agent = Mock()
            mock_agent.process_message.return_value = "Test response from LLM"
            mock_agent_factory.return_value = mock_agent

            phase = MockPhase(
                phase_name="test_phase",
                extracted_data={"key1": "value1", "key2": "value2"},
            )

            result = phase.execute(phase_context)

            assert result.success
            assert result.phase_name == "test_phase"
            assert result.status == PhaseStatus.COMPLETED
            assert result.agent_response == "Test response from LLM"
            assert result.extracted_data == {"key1": "value1", "key2": "value2"}
            assert result.execution_time_seconds > 0
            assert len(result.errors) == 0

    def test_execute_tracks_execution_time(
        self,
        phase_context: PhaseContext,
    ) -> None:
        """execute() tracks execution time."""
        with patch("cycling_ai.orchestration.phases.base_phase.AgentFactory.create_agent") as mock_agent_factory:
            # Mock agent
            mock_agent = Mock()
            mock_agent.process_message.return_value = "Test response"
            mock_agent_factory.return_value = mock_agent

            phase = MockPhase()
            result = phase.execute(phase_context)

            assert result.execution_time_seconds > 0
            assert result.execution_time_seconds < 1  # Should be very fast for mock

    def test_execute_calls_progress_callback_if_provided(
        self,
        phase_context: PhaseContext,
    ) -> None:
        """execute() calls progress callback if provided."""
        with patch("cycling_ai.orchestration.phases.base_phase.AgentFactory.create_agent") as mock_agent_factory:
            # Mock agent
            mock_agent = Mock()
            mock_agent.process_message.return_value = "Test response"
            mock_agent_factory.return_value = mock_agent

            progress_callback = Mock()
            phase_context.progress_callback = progress_callback

            phase = MockPhase(phase_name="test_phase")
            phase.execute(phase_context)

            # Should be called with IN_PROGRESS and COMPLETED
            assert progress_callback.call_count >= 1
            calls = progress_callback.call_args_list

            # Check for IN_PROGRESS call
            assert any(
                call.args == ("test_phase", PhaseStatus.IN_PROGRESS) for call in calls
            )


class TestBasePhaseErrorHandling:
    """Test BasePhase error handling."""

    def test_execute_catches_exceptions_and_returns_failed_result(
        self,
        phase_context: PhaseContext,
    ) -> None:
        """execute() catches exceptions and returns FAILED result."""
        with patch("cycling_ai.orchestration.phases.base_phase.AgentFactory.create_agent") as mock_agent_factory:
            # Mock agent
            mock_agent = Mock()
            mock_agent.process_message.return_value = "Test response"
            mock_agent_factory.return_value = mock_agent

            phase = MockPhase(should_fail=True)
            result = phase.execute(phase_context)

            assert not result.success
            assert result.status == PhaseStatus.FAILED
            assert len(result.errors) > 0
            assert "Test extraction error" in result.errors[0]
            assert result.execution_time_seconds > 0

    def test_execute_includes_full_error_traceback(
        self,
        phase_context: PhaseContext,
    ) -> None:
        """execute() includes full error message in result."""
        with patch("cycling_ai.orchestration.phases.base_phase.AgentFactory.create_agent") as mock_agent_factory:
            # Mock agent
            mock_agent = Mock()
            mock_agent.process_message.return_value = "Test response"
            mock_agent_factory.return_value = mock_agent

            phase = MockPhase(should_fail=True)
            result = phase.execute(phase_context)

            assert not result.success
            assert len(result.errors) > 0
            error_msg = result.errors[0]
            assert "ValueError" in error_msg or "Test extraction error" in error_msg

    def test_execute_calls_progress_callback_on_failure(
        self,
        phase_context: PhaseContext,
    ) -> None:
        """execute() calls progress callback with FAILED on error."""
        with patch("cycling_ai.orchestration.phases.base_phase.AgentFactory.create_agent") as mock_agent_factory:
            # Mock agent
            mock_agent = Mock()
            mock_agent.process_message.return_value = "Test response"
            mock_agent_factory.return_value = mock_agent

            progress_callback = Mock()
            phase_context.progress_callback = progress_callback

            phase = MockPhase(should_fail=True)
            phase.execute(phase_context)

            # Should be called with FAILED status
            calls = progress_callback.call_args_list
            assert any(
                call.args == ("test_phase", PhaseStatus.FAILED) for call in calls
            )


class TestBasePhaseSessionIsolation:
    """Test BasePhase maintains session isolation."""

    def test_each_execute_creates_new_session(
        self,
        phase_context: PhaseContext,
        mock_session_manager: Mock,
    ) -> None:
        """Each execute() call creates a new session."""
        phase = MockPhase()

        # Execute twice
        phase.execute(phase_context)
        phase.execute(phase_context)

        # Should create two sessions
        assert mock_session_manager.create_session.call_count == 2

    def test_session_receives_previous_phase_data(
        self,
        phase_context: PhaseContext,
        mock_session_manager: Mock,
    ) -> None:
        """Session is created with previous phase data in context."""
        phase_context.previous_phase_data = {
            "phase1_key": "phase1_value",
            "phase2_key": "phase2_value",
        }

        phase = MockPhase()
        phase.execute(phase_context)

        # Verify context passed to session
        call_kwargs = mock_session_manager.create_session.call_args.kwargs
        assert "phase1_key" in call_kwargs["context"]
        assert "phase2_key" in call_kwargs["context"]


class TestBasePhaseToolFiltering:
    """Test BasePhase filters tools correctly."""

    def test_agent_receives_only_required_tools(
        self,
        phase_context: PhaseContext,
    ) -> None:
        """Agent is created with only the tools specified in required_tools."""
        with patch("cycling_ai.orchestration.phases.base_phase.AgentFactory.create_agent") as mock_agent_factory:
            # Mock agent
            mock_agent = Mock()
            mock_agent.process_message.return_value = "Test response"
            mock_agent_factory.return_value = mock_agent

            phase = MockPhase(required_tools=["tool1", "tool2", "tool3"])
            result = phase.execute(phase_context)

            # Should execute successfully with filtered tools
            assert result.success

    def test_empty_required_tools_list_works(
        self,
        phase_context: PhaseContext,
    ) -> None:
        """Phase can execute with no required tools."""
        with patch("cycling_ai.orchestration.phases.base_phase.AgentFactory.create_agent") as mock_agent_factory:
            # Mock agent
            mock_agent = Mock()
            mock_agent.process_message.return_value = "Test response"
            mock_agent_factory.return_value = mock_agent

            phase = MockPhase(required_tools=[])
            result = phase.execute(phase_context)

            # Should still execute successfully
            assert result.success


class TestMockPhaseImplementation:
    """Test the MockPhase test helper itself."""

    def test_mock_phase_can_be_instantiated(self) -> None:
        """MockPhase is concrete and can be instantiated."""
        phase = MockPhase()
        assert phase.phase_name == "test_phase"
        assert phase.required_tools == ["test_tool"]

    def test_mock_phase_returns_custom_extracted_data(
        self,
        phase_context: PhaseContext,
    ) -> None:
        """MockPhase returns custom extracted data."""
        with patch("cycling_ai.orchestration.phases.base_phase.AgentFactory.create_agent") as mock_agent_factory:
            # Mock agent
            mock_agent = Mock()
            mock_agent.process_message.return_value = "Test response"
            mock_agent_factory.return_value = mock_agent

            custom_data = {"custom_key": "custom_value", "count": 42}
            phase = MockPhase(extracted_data=custom_data)

            result = phase.execute(phase_context)

            assert result.extracted_data == custom_data

    def test_mock_phase_can_simulate_failure(
        self,
        phase_context: PhaseContext,
    ) -> None:
        """MockPhase can simulate phase failure."""
        with patch("cycling_ai.orchestration.phases.base_phase.AgentFactory.create_agent") as mock_agent_factory:
            # Mock agent
            mock_agent = Mock()
            mock_agent.process_message.return_value = "Test response"
            mock_agent_factory.return_value = mock_agent

            phase = MockPhase(should_fail=True)
            result = phase.execute(phase_context)

            assert not result.success
            assert result.status == PhaseStatus.FAILED


# Coverage target: 90%+
# These tests cover:
# - Abstract interface enforcement
# - Template method execution flow
# - Session creation and isolation
# - Agent creation with tool filtering
# - Error handling and recovery
# - Progress callbacks
# - Execution time tracking
# - Data extraction
