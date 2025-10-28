"""Tests for generate CLI command."""
from __future__ import annotations

import os
from pathlib import Path
from unittest.mock import Mock, patch
from typing import Any

import pytest
from click.testing import CliRunner

from cycling_ai.cli.commands.generate import (
    generate,
    PhaseProgressTracker,
    _initialize_provider,
    _validate_output_directory,
    _display_config_summary,
    _display_success_results,
    _display_failure_results,
    _print_provider_help,
    _print_validation_help,
)
from cycling_ai.orchestration.multi_agent import (
    PhaseResult,
    PhaseStatus,
    WorkflowConfig,
    WorkflowResult,
)
from cycling_ai.providers.base import BaseProvider, ProviderConfig


class MockProvider(BaseProvider):
    """Mock provider for testing."""

    def __init__(self, config: ProviderConfig):
        super().__init__(config)

    def convert_tool_schema(self, tools: list[Any]) -> Any:
        return []

    def invoke_tool(self, tool_name: str, parameters: dict[str, Any]) -> Any:
        return {"success": True}

    def format_response(self, result: Any) -> dict[str, Any]:
        return {}

    def create_completion(
        self, messages: list[Any], tools: list[Any] | None = None
    ) -> Any:
        mock_response = Mock()
        mock_response.content = "Test response"
        mock_response.tool_calls = None
        return mock_response


class TestPhaseProgressTracker:
    """Tests for PhaseProgressTracker class."""

    def test_initialization(self) -> None:
        """Test tracker initialization."""
        tracker = PhaseProgressTracker()

        assert len(tracker.phases) == 4
        assert "data_preparation" in tracker.phases
        assert "performance_analysis" in tracker.phases
        assert "training_planning" in tracker.phases
        assert "report_generation" in tracker.phases

        # All should be pending
        for phase_info in tracker.phases.values():
            assert phase_info["status"] == PhaseStatus.PENDING

    def test_update_phase(self) -> None:
        """Test updating phase status."""
        tracker = PhaseProgressTracker()

        tracker.update_phase("data_preparation", PhaseStatus.IN_PROGRESS)
        assert tracker.phases["data_preparation"]["status"] == PhaseStatus.IN_PROGRESS

        tracker.update_phase("data_preparation", PhaseStatus.COMPLETED)
        assert tracker.phases["data_preparation"]["status"] == PhaseStatus.COMPLETED

    def test_update_unknown_phase(self) -> None:
        """Test updating unknown phase doesn't error."""
        tracker = PhaseProgressTracker()

        # Should not raise
        tracker.update_phase("unknown_phase", PhaseStatus.COMPLETED)

    def test_get_table(self) -> None:
        """Test table generation."""
        tracker = PhaseProgressTracker()

        table = tracker.get_table()

        assert table is not None
        assert len(table.columns) == 2

    def test_format_status(self) -> None:
        """Test status formatting."""
        tracker = PhaseProgressTracker()

        assert "Pending" in tracker._format_status(PhaseStatus.PENDING)
        assert "In Progress" in tracker._format_status(PhaseStatus.IN_PROGRESS)
        assert "Completed" in tracker._format_status(PhaseStatus.COMPLETED)
        assert "Failed" in tracker._format_status(PhaseStatus.FAILED)
        assert "Skipped" in tracker._format_status(PhaseStatus.SKIPPED)


class TestValidateOutputDirectory:
    """Tests for _validate_output_directory function."""

    def test_creates_directory_if_not_exists(self, tmp_path: Path) -> None:
        """Test directory creation."""
        output_dir = tmp_path / "new_dir"
        assert not output_dir.exists()

        _validate_output_directory(output_dir)

        assert output_dir.exists()
        assert output_dir.is_dir()

    def test_accepts_existing_directory(self, tmp_path: Path) -> None:
        """Test with existing directory."""
        _validate_output_directory(tmp_path)  # Should not raise

    def test_creates_nested_directories(self, tmp_path: Path) -> None:
        """Test creating nested directories."""
        output_dir = tmp_path / "a" / "b" / "c"

        _validate_output_directory(output_dir)

        assert output_dir.exists()


class TestInitializeProvider:
    """Tests for _initialize_provider function."""

    @pytest.fixture
    def mock_config(self) -> Mock:
        """Create mock config."""
        config = Mock()
        config.providers = Mock()
        config.providers.anthropic = Mock()
        config.providers.anthropic.model = "test-model"
        config.providers.anthropic.api_key = ""
        return config

    def test_with_explicit_model(self, mock_config: Mock) -> None:
        """Test provider initialization with explicit model."""
        os.environ["ANTHROPIC_API_KEY"] = "test-key"

        with patch(
            "cycling_ai.cli.commands.generate.ProviderFactory.create_provider"
        ) as mock_create:
            mock_provider = Mock()
            mock_create.return_value = mock_provider

            provider = _initialize_provider("anthropic", "custom-model", mock_config)

            # Verify ProviderConfig was created with custom model
            call_args = mock_create.call_args
            provider_config = call_args[0][0]
            assert provider_config.model == "custom-model"
            assert provider == mock_provider

        # Cleanup
        del os.environ["ANTHROPIC_API_KEY"]

    def test_with_default_model(self, mock_config: Mock) -> None:
        """Test provider initialization with default model."""
        os.environ["ANTHROPIC_API_KEY"] = "test-key"

        with patch(
            "cycling_ai.cli.commands.generate.ProviderFactory.create_provider"
        ) as mock_create:
            mock_provider = Mock()
            mock_create.return_value = mock_provider

            provider = _initialize_provider("anthropic", None, mock_config)

            # Should use model from config
            call_args = mock_create.call_args
            provider_config = call_args[0][0]
            assert provider_config.model == "test-model"

        del os.environ["ANTHROPIC_API_KEY"]

    def test_missing_api_key_raises_error(self, mock_config: Mock) -> None:
        """Test missing API key raises ValueError."""
        # Ensure no API key in environment
        if "ANTHROPIC_API_KEY" in os.environ:
            del os.environ["ANTHROPIC_API_KEY"]

        with pytest.raises(ValueError, match="API key not found"):
            _initialize_provider("anthropic", None, mock_config)


class TestDisplayFunctions:
    """Tests for display functions."""

    def test_display_config_summary(self, tmp_path: Path, capsys: Any) -> None:
        """Test config summary display."""
        csv_file = tmp_path / "test.csv"
        profile_file = tmp_path / "profile.json"
        csv_file.write_text("test")
        profile_file.write_text("{}")

        config = WorkflowConfig(
            csv_file_path=csv_file,
            athlete_profile_path=profile_file,
            output_dir=tmp_path,
            period_months=6,
            training_plan_weeks=12,
        )

        _display_config_summary(config)
        # Should not raise, output to console

    def test_display_success_results(self, tmp_path: Path, capsys: Any) -> None:
        """Test success results display."""
        result = WorkflowResult(
            phase_results=[
                PhaseResult(
                    phase_name="test",
                    status=PhaseStatus.COMPLETED,
                    agent_response="test",
                )
            ],
            total_execution_time_seconds=10.5,
            total_tokens_used=1000,
            output_files=[tmp_path / "report.html"],
        )

        _display_success_results(result)
        # Should not raise
        assert result.success  # Verify it's a successful result

    def test_display_failure_results(self, capsys: Any) -> None:
        """Test failure results display."""
        result = WorkflowResult(
            phase_results=[
                PhaseResult(
                    phase_name="test",
                    status=PhaseStatus.FAILED,
                    agent_response="test",
                    errors=["Error 1", "Error 2"],
                )
            ],
            total_execution_time_seconds=5.0,
            total_tokens_used=500,
        )

        _display_failure_results(result)
        # Should not raise
        assert not result.success  # Verify it's a failed result


class TestHelpFunctions:
    """Tests for help/troubleshooting functions."""

    def test_print_provider_help_anthropic(self, capsys: Any) -> None:
        """Test provider help for Anthropic."""
        _print_provider_help("anthropic")
        captured = capsys.readouterr()
        assert "ANTHROPIC_API_KEY" in captured.out

    def test_print_provider_help_openai(self, capsys: Any) -> None:
        """Test provider help for OpenAI."""
        _print_provider_help("openai")
        captured = capsys.readouterr()
        assert "OPENAI_API_KEY" in captured.out

    def test_print_validation_help_csv(self, capsys: Any) -> None:
        """Test validation help for CSV error."""
        error = ValueError("CSV file not found: test.csv")
        _print_validation_help(error)
        captured = capsys.readouterr()
        assert "CSV" in captured.out or "Strava" in captured.out


class TestGenerateCommandIntegration:
    """Integration tests for generate command."""

    @pytest.fixture
    def test_files(self, tmp_path: Path) -> tuple[Path, Path]:
        """Create test CSV and profile files."""
        csv_file = tmp_path / "test.csv"
        csv_file.write_text("Activity Date,Distance\n2025-01-01,10")

        profile_file = tmp_path / "profile.json"
        profile_file.write_text('{"name": "Test", "ftp": 250, "weight_kg": 70}')

        return csv_file, profile_file

    def test_generate_command_missing_csv(self) -> None:
        """Test command with missing CSV file."""
        runner = CliRunner()
        result = runner.invoke(generate, [])

        assert result.exit_code != 0
        assert "Missing option" in result.output or "Error" in result.output

    def test_generate_command_with_valid_files(
        self, test_files: tuple[Path, Path], tmp_path: Path
    ) -> None:
        """Test command with valid files (mocked orchestrator)."""
        csv_file, profile_file = test_files
        output_dir = tmp_path / "output"

        runner = CliRunner()

        # Set API key
        os.environ["ANTHROPIC_API_KEY"] = "test-key"

        # Mock the orchestrator
        with patch(
            "cycling_ai.cli.commands.generate.MultiAgentOrchestrator"
        ) as mock_orch_class:
            mock_orch = Mock()
            mock_result = WorkflowResult(
                phase_results=[
                    PhaseResult(
                        phase_name="test",
                        status=PhaseStatus.COMPLETED,
                        agent_response="test",
                    )
                ],
                total_execution_time_seconds=1.0,
                total_tokens_used=100,
                output_files=[],
            )
            mock_orch.execute_workflow.return_value = mock_result
            mock_orch_class.return_value = mock_orch

            # Mock provider factory
            with patch(
                "cycling_ai.cli.commands.generate.ProviderFactory.create_provider"
            ) as mock_provider_factory:
                mock_provider_factory.return_value = MockProvider(
                    ProviderConfig(
                        provider_name="anthropic",
                        api_key="test-key",
                        model="test-model",
                    )
                )

                result = runner.invoke(
                    generate,
                    [
                        "--csv",
                        str(csv_file),
                        "--profile",
                        str(profile_file),
                        "--output-dir",
                        str(output_dir),
                    ],
                )

                # Should succeed
                assert result.exit_code == 0
                assert "✓" in result.output or "Completed" in result.output

        # Cleanup
        del os.environ["ANTHROPIC_API_KEY"]
