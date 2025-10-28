"""Tests for MultiAgentOrchestrator."""
from pathlib import Path
from unittest.mock import Mock, MagicMock
from typing import Any

import pytest

from cycling_ai.orchestration.multi_agent import (
    MultiAgentOrchestrator,
    PhaseResult,
    PhaseStatus,
    WorkflowConfig,
    WorkflowResult,
)
from cycling_ai.orchestration.prompts import AgentPromptsManager
from cycling_ai.orchestration.session import ConversationMessage, ConversationSession
from cycling_ai.providers.base import BaseProvider, ProviderConfig


class MockProvider(BaseProvider):
    """Mock provider for testing."""

    def __init__(self, config: ProviderConfig, responses: list[str] | None = None):
        super().__init__(config)
        self.responses = responses or ["Mock response"]
        self.call_count = 0

    def convert_tool_schema(self, tools: list[Any]) -> Any:
        """Mock implementation."""
        return []

    def invoke_tool(self, tool_name: str, parameters: dict[str, Any]) -> Any:
        """Mock implementation."""
        return {"success": True}

    def format_response(self, result: Any) -> dict[str, Any]:
        """Mock implementation."""
        return {}

    def create_completion(self, messages: list[Any], tools: list[Any] | None = None) -> Any:
        """Mock implementation."""
        response = self.responses[min(self.call_count, len(self.responses) - 1)]
        self.call_count += 1

        # Return mock response object
        mock_response = Mock()
        mock_response.content = response
        mock_response.tool_calls = None
        return mock_response


class TestMultiAgentOrchestrator:
    """Tests for MultiAgentOrchestrator class."""

    @pytest.fixture
    def mock_provider(self) -> MockProvider:
        """Create mock provider."""
        config = ProviderConfig(
            provider_name="mock",
            api_key="test-key",
            model="test-model",
        )
        return MockProvider(config)

    @pytest.fixture
    def temp_files(self, tmp_path: Path) -> dict[str, Path]:
        """Create temporary test files."""
        csv_file = tmp_path / "activities.csv"
        csv_file.write_text("Activity Date,Distance\n2025-01-01,10")

        profile_file = tmp_path / "profile.json"
        profile_file.write_text('{"name": "Test", "ftp": 250}')

        return {
            "csv": csv_file,
            "profile": profile_file,
            "tmp_path": tmp_path,
        }

    def test_initialization(self, mock_provider: MockProvider) -> None:
        """Test orchestrator initialization."""
        orchestrator = MultiAgentOrchestrator(mock_provider)

        assert orchestrator.provider == mock_provider
        assert orchestrator.prompts_manager is not None
        assert orchestrator.session_manager is not None
        assert orchestrator.progress_callback is None

    def test_initialization_with_prompts_manager(self, mock_provider: MockProvider) -> None:
        """Test initialization with custom prompts manager."""
        custom_prompts = AgentPromptsManager()
        orchestrator = MultiAgentOrchestrator(
            mock_provider, prompts_manager=custom_prompts
        )

        assert orchestrator.prompts_manager is custom_prompts

    def test_initialization_with_progress_callback(self, mock_provider: MockProvider) -> None:
        """Test initialization with progress callback."""
        callback_called = []

        def callback(phase: str, status: PhaseStatus) -> None:
            callback_called.append((phase, status))

        orchestrator = MultiAgentOrchestrator(
            mock_provider, progress_callback=callback
        )

        assert orchestrator.progress_callback is callback

    def test_extract_phase_data_empty_session(self, mock_provider: MockProvider) -> None:
        """Test extracting data from empty session."""
        orchestrator = MultiAgentOrchestrator(mock_provider)
        session = ConversationSession(
            session_id="test",
            provider_name="mock",
        )

        data = orchestrator._extract_phase_data("test_phase", "response", session)

        assert data == {}

    def test_extract_phase_data_with_tool_results(self, mock_provider: MockProvider) -> None:
        """Test extracting data from session with tool results."""
        import json

        orchestrator = MultiAgentOrchestrator(mock_provider)
        session = ConversationSession(
            session_id="test",
            provider_name="mock",
        )

        # Add tool result message
        tool_data = {"performance": "improved", "power": 250}
        session.add_message(
            ConversationMessage(
                role="tool",
                content=json.dumps(tool_data),
                tool_results=[
                    {
                        "success": True,
                        "tool_name": "analyze_performance",
                    }
                ],
            )
        )

        data = orchestrator._extract_phase_data("test_phase", "response", session)

        assert "performance_data" in data
        assert data["performance_data"]["performance"] == "improved"

    def test_estimate_tokens(self, mock_provider: MockProvider) -> None:
        """Test token estimation."""
        orchestrator = MultiAgentOrchestrator(mock_provider)
        session = ConversationSession(
            session_id="test",
            provider_name="mock",
        )

        # Add messages
        session.add_message(ConversationMessage(role="user", content="A" * 100))
        session.add_message(ConversationMessage(role="assistant", content="B" * 200))

        tokens = orchestrator._estimate_tokens(session)

        # Should be roughly (100 + 200) / 4 = 75
        assert 70 <= tokens <= 80

    def test_create_failed_workflow_result(self, mock_provider: MockProvider) -> None:
        """Test creating failed workflow result."""
        from datetime import datetime

        orchestrator = MultiAgentOrchestrator(mock_provider)

        phase_results = [
            PhaseResult("phase1", PhaseStatus.COMPLETED, "Done", tokens_used=100),
            PhaseResult("phase2", PhaseStatus.FAILED, "", errors=["Error"], tokens_used=50),
        ]

        workflow_start = datetime.now()
        total_tokens = 150

        result = orchestrator._create_failed_workflow_result(
            phase_results, workflow_start, total_tokens
        )

        assert isinstance(result, WorkflowResult)
        assert result.success is False
        assert len(result.phase_results) == 2
        assert result.total_tokens_used == 150
        assert result.total_execution_time_seconds > 0


class TestExecutePhase:
    """Tests for _execute_phase method."""

    @pytest.fixture
    def mock_provider(self) -> MockProvider:
        """Create mock provider."""
        config = ProviderConfig(
            provider_name="mock",
            api_key="test-key",
            model="test-model",
        )
        return MockProvider(config, responses=["Phase completed successfully"])

    @pytest.fixture
    def temp_files(self, tmp_path: Path) -> dict[str, Path]:
        """Create temporary test files."""
        csv_file = tmp_path / "activities.csv"
        csv_file.write_text("Activity Date,Distance\n2025-01-01,10")

        profile_file = tmp_path / "profile.json"
        profile_file.write_text('{"name": "Test", "ftp": 250}')

        return {
            "csv": csv_file,
            "profile": profile_file,
        }

    def test_execute_phase_success(
        self, mock_provider: MockProvider, temp_files: dict[str, Path]
    ) -> None:
        """Test successful phase execution."""
        orchestrator = MultiAgentOrchestrator(mock_provider)

        config = WorkflowConfig(
            csv_file_path=temp_files["csv"],
            athlete_profile_path=temp_files["profile"],
        )

        result = orchestrator._execute_phase(
            phase_name="test_phase",
            config=config,
            prompt_getter=lambda: "Test prompt",
            tools=[],
            phase_context={},
            user_message="Test message",
        )

        assert result.phase_name == "test_phase"
        assert result.status == PhaseStatus.COMPLETED
        assert result.success is True
        assert result.execution_time_seconds > 0

    def test_execute_phase_with_progress_callback(
        self, mock_provider: MockProvider, temp_files: dict[str, Path]
    ) -> None:
        """Test phase execution triggers progress callback."""
        callback_calls = []

        def callback(phase: str, status: PhaseStatus) -> None:
            callback_calls.append((phase, status))

        orchestrator = MultiAgentOrchestrator(
            mock_provider, progress_callback=callback
        )

        config = WorkflowConfig(
            csv_file_path=temp_files["csv"],
            athlete_profile_path=temp_files["profile"],
        )

        orchestrator._execute_phase(
            phase_name="test_phase",
            config=config,
            prompt_getter=lambda: "Test prompt",
            tools=[],
            phase_context={},
            user_message="Test message",
        )

        # Should have been called with IN_PROGRESS and COMPLETED
        assert len(callback_calls) == 2
        assert callback_calls[0] == ("test_phase", PhaseStatus.IN_PROGRESS)
        assert callback_calls[1] == ("test_phase", PhaseStatus.COMPLETED)

    def test_execute_phase_failure(
        self, mock_provider: MockProvider, temp_files: dict[str, Path]
    ) -> None:
        """Test phase execution handles errors gracefully."""
        # Create provider that will raise an error
        error_provider = MockProvider(
            ProviderConfig(provider_name="mock", api_key="test", model="test")
        )
        error_provider.create_completion = Mock(side_effect=Exception("Test error"))

        orchestrator = MultiAgentOrchestrator(error_provider)

        config = WorkflowConfig(
            csv_file_path=temp_files["csv"],
            athlete_profile_path=temp_files["profile"],
        )

        result = orchestrator._execute_phase(
            phase_name="test_phase",
            config=config,
            prompt_getter=lambda: "Test prompt",
            tools=[],
            phase_context={},
            user_message="Test message",
        )

        assert result.status == PhaseStatus.FAILED
        assert result.success is False
        assert len(result.errors) > 0
        assert "Test error" in result.errors[0]
