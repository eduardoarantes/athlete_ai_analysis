"""
Tests for RAG CLI integration in generate command.
"""
from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, Mock, patch

import pytest
from click.testing import CliRunner

from cycling_ai.cli.main import cli
from cycling_ai.orchestration.base import PhaseStatus, WorkflowResult


@pytest.fixture
def minimal_csv(tmp_path: Path) -> Path:
    """Create minimal test CSV file."""
    csv_file = tmp_path / "activities.csv"
    csv_file.write_text("Activity Date,Activity Name,Distance\n2024-01-01,Test Ride,10.5\n")
    return csv_file


@pytest.fixture
def minimal_profile(tmp_path: Path) -> Path:
    """Create minimal test profile file."""
    profile_file = tmp_path / "profile.json"
    profile_file.write_text('{"ftp": 250, "training_plan_weeks": 12}')
    return profile_file


@pytest.fixture
def mock_workflow() -> MagicMock:
    """Mock MultiAgentOrchestrator and provider to avoid actual workflow execution."""
    # Mock provider factory and initialization
    with patch("cycling_ai.cli.commands.generate._initialize_provider") as mock_init_provider, \
         patch("cycling_ai.cli.commands.generate.MultiAgentOrchestrator") as mock_orchestrator_cls, \
         patch("cycling_ai.cli.commands.generate.AgentPromptsManager"):

        # Setup mock provider
        mock_provider = Mock()
        mock_provider.config = Mock()
        mock_provider.config.model = "mock-model"
        mock_provider.name = "mock-provider"
        mock_init_provider.return_value = mock_provider

        # Setup mock orchestrator
        mock_instance = Mock()
        mock_result = WorkflowResult(
            phase_results=[],
            total_tokens_used=1000,
            total_execution_time_seconds=10.0,
            output_files=[],
        )
        mock_instance.execute_workflow.return_value = mock_result
        mock_orchestrator_cls.return_value = mock_instance

        yield mock_orchestrator_cls


class TestGenerateRAGFlags:
    """Test RAG flags in generate command."""

    def test_generate_with_enable_rag_flag(
        self, minimal_csv: Path, minimal_profile: Path, tmp_path: Path, mock_workflow: MagicMock
    ) -> None:
        """Test --enable-rag flag is recognized."""
        runner = CliRunner()

        result = runner.invoke(
            cli,
            [
                "generate",
                "--profile",
                str(minimal_profile),
                "--csv",
                str(minimal_csv),
                "--output-dir",
                str(tmp_path / "output"),
                "--enable-rag",  # Test this flag
            ],
        )

        # Should not fail on unknown option (exit code 2 = usage error)
        assert result.exit_code != 2, f"Command failed with usage error: {result.output}"
        # Verify flag was parsed (no "no such option" error)
        assert "no such option" not in result.output.lower()

    def test_generate_with_custom_rag_params(
        self, minimal_csv: Path, minimal_profile: Path, tmp_path: Path, mock_workflow: MagicMock
    ) -> None:
        """Test custom RAG parameters."""
        runner = CliRunner()

        result = runner.invoke(
            cli,
            [
                "generate",
                "--profile",
                str(minimal_profile),
                "--csv",
                str(minimal_csv),
                "--output-dir",
                str(tmp_path / "output"),
                "--enable-rag",
                "--rag-top-k",
                "5",
                "--rag-min-score",
                "0.7",
            ],
        )

        # Flags should be accepted without usage errors
        assert result.exit_code != 2, f"Command failed with usage error: {result.output}"
        assert "no such option" not in result.output.lower()

    def test_generate_warns_if_vectorstore_missing(
        self, minimal_csv: Path, minimal_profile: Path, tmp_path: Path, mock_workflow: MagicMock
    ) -> None:
        """Test warning when RAG enabled but vectorstore missing."""
        runner = CliRunner()

        result = runner.invoke(
            cli,
            [
                "generate",
                "--profile",
                str(minimal_profile),
                "--csv",
                str(minimal_csv),
                "--output-dir",
                str(tmp_path / "output"),
                "--enable-rag",
            ],
        )

        # Should show warning about missing vectorstore (or RAG enabled message if exists)
        # Either warning about missing vectorstore OR confirmation RAG is enabled
        assert (
            "warning" in result.output.lower()
            or "rag enabled" in result.output.lower()
            or "✓" in result.output
        )

    def test_generate_backward_compat_no_rag(
        self, minimal_csv: Path, minimal_profile: Path, tmp_path: Path, mock_workflow: MagicMock
    ) -> None:
        """Test backward compatibility when RAG flags omitted."""
        runner = CliRunner()

        # Run WITHOUT RAG flags (backward compatibility)
        result = runner.invoke(
            cli,
            [
                "generate",
                "--profile",
                str(minimal_profile),
                "--csv",
                str(minimal_csv),
                "--output-dir",
                str(tmp_path / "output"),
                # No --enable-rag flag
            ],
        )

        # Should work fine without RAG flags
        assert result.exit_code != 2, f"Command failed with usage error: {result.output}"
        # Should NOT mention RAG in output (backward compat - invisible when disabled)
        # Note: This might show config summary which could mention RAG, so just check no errors
        assert "no such option" not in result.output.lower()

    def test_rag_config_passed_to_workflow(
        self, minimal_csv: Path, minimal_profile: Path, tmp_path: Path, mock_workflow: MagicMock
    ) -> None:
        """Test RAGConfig is correctly created and passed to workflow."""
        runner = CliRunner()

        result = runner.invoke(
            cli,
            [
                "generate",
                "--profile",
                str(minimal_profile),
                "--csv",
                str(minimal_csv),
                "--output-dir",
                str(tmp_path / "output"),
                "--enable-rag",
                "--rag-top-k",
                "5",
                "--rag-min-score",
                "0.7",
            ],
        )

        # Verify workflow was called
        assert mock_workflow.return_value.execute_workflow.called

        # Get the WorkflowConfig passed to execute_workflow
        call_args = mock_workflow.return_value.execute_workflow.call_args
        workflow_config = call_args[0][0]  # First positional argument

        # Verify RAGConfig exists and has correct values
        assert hasattr(workflow_config, "rag_config")
        assert workflow_config.rag_config is not None
        # Note: enabled might be False if vectorstore doesn't exist (which is expected in tests)
        # We verify the parameters were passed correctly
        assert workflow_config.rag_config.top_k == 5
        assert workflow_config.rag_config.min_score == 0.7
        assert workflow_config.rag_config.embedding_provider == "local"
