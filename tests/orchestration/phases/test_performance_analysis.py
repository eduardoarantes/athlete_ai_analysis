"""
Unit tests for PerformanceAnalysisPhase.

Tests the performance analysis phase implementation that orchestrates
LLM-driven performance analysis with optional cross-training detection.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any
from unittest.mock import Mock, MagicMock, call, patch
import json
import pytest

from cycling_ai.orchestration.base import (
    PhaseContext,
    PhaseResult,
    PhaseStatus,
    WorkflowConfig,
)
from cycling_ai.orchestration.phases.performance_analysis import PerformanceAnalysisPhase
from cycling_ai.orchestration.session import ConversationSession
from cycling_ai.orchestration.agent import LLMAgent


@pytest.fixture
def mock_provider() -> Mock:
    """Create mock LLM provider."""
    provider = Mock()
    provider.name = "test_provider"
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
    mock_session.provider_name = "test_provider"
    mock_session.system_prompt = "Test prompt"
    mock_session.context = {}

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
    manager.get_performance_analysis_prompt.return_value = "System prompt"
    manager.get_cross_training_instructions.return_value = ""
    manager.get_performance_analysis_user_prompt.return_value = "User message"
    return manager


class TestPerformanceAnalysisPhaseMetadata:
    """Test phase metadata and properties."""

    @pytest.fixture
    def phase(self) -> PerformanceAnalysisPhase:
        """Create PerformanceAnalysisPhase instance."""
        return PerformanceAnalysisPhase()

    def test_phase_name(self, phase):
        """Test phase name is correct."""
        assert phase.phase_name == "performance_analysis"

    def test_required_tools_base_list(self, phase):
        """Test required tools list contains base tools."""
        tools = phase.required_tools
        assert "analyze_performance" in tools


class TestPerformanceAnalysisContextValidation:
    """Test context validation."""

    @pytest.fixture
    def phase(self) -> PerformanceAnalysisPhase:
        """Create PerformanceAnalysisPhase instance."""
        return PerformanceAnalysisPhase()

    @pytest.fixture
    def valid_context(self, mock_provider, mock_session_manager, mock_prompts_manager):
        """Create valid phase context."""
        config = WorkflowConfig(
            athlete_profile_path=Path("profile.json"),
            csv_file_path=Path("data.csv"),
            output_dir=Path("output"),
            period_months=6,
            training_plan_weeks=12,
        )
        return PhaseContext(
            config=config,
            previous_phase_data={
                "cache_file_path": "cache.parquet",
                "athlete_profile_path": "profile.json",
            },
            session_manager=mock_session_manager,
            provider=mock_provider,
            prompts_manager=mock_prompts_manager,
            progress_callback=None,
        )

    def test_validate_context_success(self, phase, valid_context):
        """Test context validation passes with valid data."""
        # Should not raise
        phase._validate_context(valid_context)

    def test_validate_context_missing_cache_file(self, phase, valid_context):
        """Test validation fails when cache_file_path missing."""
        valid_context.previous_phase_data = {"athlete_profile_path": "profile.json"}

        with pytest.raises(ValueError, match="cache_file_path"):
            phase._validate_context(valid_context)

    def test_validate_context_missing_athlete_profile(self, phase, valid_context):
        """Test validation fails when athlete_profile_path missing."""
        valid_context.previous_phase_data = {"cache_file_path": "cache.parquet"}

        with pytest.raises(ValueError, match="athlete_profile_path"):
            phase._validate_context(valid_context)


class TestCrossTrainingDetection:
    """Test cross-training analysis auto-detection logic."""

    @pytest.fixture
    def phase(self) -> PerformanceAnalysisPhase:
        """Create PerformanceAnalysisPhase instance."""
        return PerformanceAnalysisPhase()

    @patch("pandas.read_parquet")
    def test_should_analyze_cross_training_enabled(self, mock_read_parquet, phase, tmp_path):
        """Test cross-training detection returns True for mixed activities."""
        # Create mock DataFrame with 25% non-cycling activities
        mock_df = MagicMock()
        mock_df.__len__.return_value = 100
        mock_df.columns = ["activity_category"]
        mock_df.__getitem__.return_value.value_counts.return_value = {
            "Cycling": 75,
            "Running": 20,
            "Swimming": 5,
        }
        mock_df.__getitem__.return_value.__ne__.return_value.sum.return_value = 25
        mock_read_parquet.return_value = mock_df

        cache_path = tmp_path / "cache.parquet"
        cache_path.touch()

        result = phase._should_analyze_cross_training(str(cache_path))
        assert result is True

    @patch("pandas.read_parquet")
    def test_should_analyze_cross_training_disabled_low_percentage(
        self, mock_read_parquet, phase, tmp_path
    ):
        """Test cross-training disabled when percentage below threshold."""
        # Only 5% non-cycling (below 10% threshold)
        mock_df = MagicMock()
        mock_df.__len__.return_value = 100
        mock_df.columns = ["activity_category"]
        mock_df.__getitem__.return_value.value_counts.return_value = {
            "Cycling": 95,
            "Running": 5,
        }
        mock_df.__getitem__.return_value.__ne__.return_value.sum.return_value = 5
        mock_read_parquet.return_value = mock_df

        cache_path = tmp_path / "cache.parquet"
        cache_path.touch()

        result = phase._should_analyze_cross_training(str(cache_path))
        assert result is False

    @patch("pandas.read_parquet")
    def test_should_analyze_cross_training_disabled_few_activities(
        self, mock_read_parquet, phase, tmp_path
    ):
        """Test cross-training disabled when too few activities."""
        mock_df = MagicMock()
        mock_df.__len__.return_value = 10  # Below 20 minimum
        mock_df.columns = ["activity_category"]
        mock_read_parquet.return_value = mock_df

        cache_path = tmp_path / "cache.parquet"
        cache_path.touch()

        result = phase._should_analyze_cross_training(str(cache_path))
        assert result is False

    @patch("pandas.read_parquet")
    def test_should_analyze_cross_training_disabled_single_category(
        self, mock_read_parquet, phase, tmp_path
    ):
        """Test cross-training disabled with only one activity category."""
        mock_df = MagicMock()
        mock_df.__len__.return_value = 100
        mock_df.columns = ["activity_category"]
        mock_df.__getitem__.return_value.value_counts.return_value = {"Cycling": 100}
        mock_read_parquet.return_value = mock_df

        cache_path = tmp_path / "cache.parquet"
        cache_path.touch()

        result = phase._should_analyze_cross_training(str(cache_path))
        assert result is False

    def test_should_analyze_cross_training_missing_file(self, phase, tmp_path):
        """Test cross-training detection handles missing cache file."""
        cache_path = tmp_path / "nonexistent.parquet"

        result = phase._should_analyze_cross_training(str(cache_path))
        assert result is False

    @patch("pandas.read_parquet")
    def test_should_analyze_cross_training_missing_column(
        self, mock_read_parquet, phase, tmp_path
    ):
        """Test cross-training detection handles missing activity_category column."""
        mock_df = MagicMock()
        mock_df.__len__.return_value = 100
        mock_df.columns = ["other_column"]  # Missing activity_category
        mock_read_parquet.return_value = mock_df

        cache_path = tmp_path / "cache.parquet"
        cache_path.touch()

        result = phase._should_analyze_cross_training(str(cache_path))
        assert result is False


class TestGetSystemPrompt:
    """Test system prompt generation."""

    @pytest.fixture
    def phase(self) -> PerformanceAnalysisPhase:
        """Create PerformanceAnalysisPhase instance."""
        return PerformanceAnalysisPhase()

    @pytest.fixture
    def context(self, mock_provider, mock_session_manager, mock_prompts_manager):
        """Create phase context."""
        config = WorkflowConfig(
            athlete_profile_path=Path("profile.json"),
            csv_file_path=Path("data.csv"),
            output_dir=Path("output"),
            period_months=6,
            training_plan_weeks=12,
        )
        return PhaseContext(
            config=config,
            previous_phase_data={
                "cache_file_path": "cache.parquet",
                "athlete_profile_path": "profile.json",
            },
            session_manager=mock_session_manager,
            provider=mock_provider,
            prompts_manager=mock_prompts_manager,
            progress_callback=None,
        )

    def test_get_system_prompt_calls_prompts_manager(self, phase, context):
        """Test system prompt is retrieved from prompts manager."""
        context.prompts_manager.get_performance_analysis_prompt.return_value = (
            "Test system prompt"
        )

        result = phase._get_system_prompt({}, context)

        assert result == "Test system prompt"
        context.prompts_manager.get_performance_analysis_prompt.assert_called_once()


class TestGetUserMessage:
    """Test user message generation."""

    @pytest.fixture
    def phase(self) -> PerformanceAnalysisPhase:
        """Create PerformanceAnalysisPhase instance."""
        return PerformanceAnalysisPhase()

    @pytest.fixture
    def context(self, mock_provider, mock_session_manager, mock_prompts_manager, tmp_path):
        """Create phase context with temp cache file."""
        config = WorkflowConfig(
            athlete_profile_path=Path("profile.json"),
            csv_file_path=Path("data.csv"),
            output_dir=Path("output"),
            period_months=6,
            training_plan_weeks=12,
        )

        # Create temp cache file to pass existence check
        cache_path = tmp_path / "cache.parquet"
        cache_path.touch()

        return PhaseContext(
            config=config,
            previous_phase_data={
                "cache_file_path": str(cache_path),
                "athlete_profile_path": "profile.json",
            },
            session_manager=mock_session_manager,
            provider=mock_provider,
            prompts_manager=mock_prompts_manager,
            progress_callback=None,
        )

    def test_get_user_message_includes_cache_path(self, phase, context):
        """Test user message includes cache file path."""
        context.prompts_manager.get_cross_training_instructions.return_value = ""
        context.prompts_manager.get_performance_analysis_user_prompt.return_value = (
            "Test user prompt"
        )

        result = phase._get_user_message({}, context)

        assert "Test user prompt" == result

        # Verify prompts manager was called with correct parameters
        context.prompts_manager.get_performance_analysis_user_prompt.assert_called_once()
        call_kwargs = context.prompts_manager.get_performance_analysis_user_prompt.call_args[1]
        assert str(context.previous_phase_data["cache_file_path"]) in call_kwargs["cache_file_path"]
        assert "6" in call_kwargs["period_months"]

    @patch.object(PerformanceAnalysisPhase, "_should_analyze_cross_training")
    def test_get_user_message_with_cross_training_enabled(
        self, mock_should_analyze, phase, context
    ):
        """Test user message includes cross-training instructions when enabled."""
        mock_should_analyze.return_value = True
        context.prompts_manager.get_cross_training_instructions.return_value = (
            "Cross-training instructions"
        )
        context.prompts_manager.get_performance_analysis_user_prompt.return_value = (
            "Test prompt with CT"
        )

        result = phase._get_user_message({}, context)

        assert result == "Test prompt with CT"
        context.prompts_manager.get_cross_training_instructions.assert_called_once_with(
            period_months="6"
        )

    @patch.object(PerformanceAnalysisPhase, "_should_analyze_cross_training")
    def test_get_user_message_with_cross_training_disabled(
        self, mock_should_analyze, phase, context
    ):
        """Test user message excludes cross-training when disabled."""
        mock_should_analyze.return_value = False
        context.prompts_manager.get_performance_analysis_user_prompt.return_value = (
            "Test prompt without CT"
        )

        result = phase._get_user_message({}, context)

        assert result == "Test prompt without CT"

        # Should pass empty string for cross_training_instructions
        call_kwargs = context.prompts_manager.get_performance_analysis_user_prompt.call_args[1]
        assert call_kwargs["cross_training_instructions"] == ""


class TestExtractData:
    """Test data extraction from session."""

    @pytest.fixture
    def phase(self) -> PerformanceAnalysisPhase:
        """Create PerformanceAnalysisPhase instance."""
        return PerformanceAnalysisPhase()

    def test_extract_data_performance_analysis_success(self, phase):
        """Test extracting performance_analysis_json from tool result."""
        mock_session = Mock()
        performance_data = {
            "total_distance": 1000,
            "avg_power": 250,
            "fitness_trend": "improving",
        }

        mock_session.messages = [
            Mock(
                role="tool",
                tool_results=[{"tool_name": "analyze_performance", "success": True}],
                content=json.dumps(performance_data),
            )
        ]

        extracted = phase._extract_data(mock_session)

        assert "performance_analysis_json" in extracted
        assert extracted["performance_analysis_json"]["total_distance"] == 1000
        assert extracted["performance_analysis_json"]["avg_power"] == 250

    def test_extract_data_cross_training_success(self, phase):
        """Test extracting cross-training data from tool result."""
        mock_session = Mock()
        ct_data = {"cross_training_hours": 10, "impact": "positive"}

        mock_session.messages = [
            Mock(
                role="tool",
                tool_results=[
                    {"tool_name": "analyze_cross_training_impact", "success": True}
                ],
                content=json.dumps(ct_data),
            )
        ]

        extracted = phase._extract_data(mock_session)

        assert "cross_training_analysis" in extracted
        assert extracted["cross_training_analysis"]["cross_training_hours"] == 10

    def test_extract_data_both_tools(self, phase):
        """Test extracting data from both performance and cross-training tools."""
        mock_session = Mock()
        perf_data = {"total_distance": 1000}
        ct_data = {"cross_training_hours": 10}

        mock_session.messages = [
            Mock(
                role="tool",
                tool_results=[{"tool_name": "analyze_performance", "success": True}],
                content=json.dumps(perf_data),
            ),
            Mock(
                role="tool",
                tool_results=[
                    {"tool_name": "analyze_cross_training_impact", "success": True}
                ],
                content=json.dumps(ct_data),
            ),
        ]

        extracted = phase._extract_data(mock_session)

        assert "performance_analysis_json" in extracted
        assert "cross_training_analysis" in extracted

    def test_extract_data_failed_tool_result(self, phase):
        """Test extraction skips failed tool results."""
        mock_session = Mock()
        mock_session.messages = [
            Mock(
                role="tool",
                tool_results=[{"tool_name": "analyze_performance", "success": False}],
                content=json.dumps({"error": "failed"}),
            )
        ]

        extracted = phase._extract_data(mock_session)

        assert "performance_analysis_json" not in extracted

    def test_extract_data_invalid_json(self, phase):
        """Test extraction handles invalid JSON gracefully."""
        mock_session = Mock()
        mock_session.messages = [
            Mock(
                role="tool",
                tool_results=[{"tool_name": "analyze_performance", "success": True}],
                content="invalid json {",
            )
        ]

        extracted = phase._extract_data(mock_session)

        # Should not raise, just skip invalid data
        assert "performance_analysis_json" not in extracted

    def test_extract_data_no_tool_results(self, phase):
        """Test extraction with no tool results returns empty dict."""
        mock_session = Mock()
        mock_session.messages = [
            Mock(role="user", tool_results=None, content="Hello"),
            Mock(role="assistant", tool_results=None, content="Hi"),
        ]

        extracted = phase._extract_data(mock_session)

        assert extracted == {}


class TestExecutePhaseIntegration:
    """Integration tests for full phase execution."""

    @pytest.fixture
    def phase(self) -> PerformanceAnalysisPhase:
        """Create PerformanceAnalysisPhase instance."""
        return PerformanceAnalysisPhase()

    @pytest.fixture
    def context(self, mock_provider, mock_session_manager, mock_prompts_manager, tmp_path):
        """Create valid phase context."""
        config = WorkflowConfig(
            athlete_profile_path=Path("profile.json"),
            csv_file_path=Path("data.csv"),
            output_dir=Path("output"),
            period_months=6,
            training_plan_weeks=12,
        )

        cache_path = tmp_path / "cache.parquet"
        cache_path.touch()

        return PhaseContext(
            config=config,
            previous_phase_data={
                "cache_file_path": str(cache_path),
                "athlete_profile_path": "profile.json",
            },
            session_manager=mock_session_manager,
            provider=mock_provider,
            prompts_manager=mock_prompts_manager,
            progress_callback=None,
        )

    @patch("cycling_ai.orchestration.phases.base_phase.AgentFactory")
    def test_execute_success(self, mock_agent_factory, phase, context):
        """Test successful phase execution."""
        # Mock session
        mock_session = Mock(spec=ConversationSession)
        mock_session.session_id = "test-session-id"  # Required by base_phase logging
        mock_session.messages = [
            Mock(
                role="tool",
                tool_results=[{"tool_name": "analyze_performance", "success": True}],
                content=json.dumps({"total_distance": 1000, "avg_power": 250}),
            )
        ]
        context.session_manager.create_session.return_value = mock_session

        # Mock agent
        mock_agent = Mock(spec=LLMAgent)
        mock_agent.process_message.return_value = "Performance analysis complete"
        mock_agent_factory.create_agent.return_value = mock_agent

        result = phase.execute(context)

        assert result.status == PhaseStatus.COMPLETED
        assert result.phase_name == "performance_analysis"
        assert "performance_analysis_json" in result.extracted_data
        assert result.extracted_data["performance_analysis_json"]["total_distance"] == 1000

    @patch("cycling_ai.orchestration.phases.base_phase.AgentFactory")
    def test_execute_with_progress_callback(self, mock_agent_factory, phase, context):
        """Test execution calls progress callback."""
        progress_calls = []

        def progress_callback(phase_name: str, status: PhaseStatus):
            progress_calls.append((phase_name, status))

        context.progress_callback = progress_callback

        # Mock session and agent
        mock_session = Mock(spec=ConversationSession)
        mock_session.session_id = "test-session-id"  # Required by base_phase logging
        mock_session.messages = [
            Mock(
                role="tool",
                tool_results=[{"tool_name": "analyze_performance", "success": True}],
                content=json.dumps({"total_distance": 1000}),
            )
        ]
        context.session_manager.create_session.return_value = mock_session

        mock_agent = Mock(spec=LLMAgent)
        mock_agent.process_message.return_value = "Done"
        mock_agent_factory.create_agent.return_value = mock_agent

        phase.execute(context)

        # Should have called with IN_PROGRESS and COMPLETED
        assert len(progress_calls) == 2
        assert progress_calls[0] == ("performance_analysis", PhaseStatus.IN_PROGRESS)
        assert progress_calls[1] == ("performance_analysis", PhaseStatus.COMPLETED)

    def test_execute_validation_failure(self, phase, context):
        """Test execution fails with validation error."""
        # Remove required field
        context.previous_phase_data = {}

        result = phase.execute(context)

        assert result.status == PhaseStatus.FAILED
        assert len(result.errors) > 0
