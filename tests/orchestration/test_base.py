"""Tests for orchestration base classes."""

import pytest
from pathlib import Path

from cycling_ai.orchestration.base import (
    PhaseContext,
    PhaseResult,
    PhaseStatus,
    WorkflowConfig,
    WorkflowResult,
)


class TestPhaseStatus:
    """Test PhaseStatus enum."""

    def test_phase_status_values(self):
        """Test all phase status values are defined."""
        assert PhaseStatus.PENDING.value == "pending"
        assert PhaseStatus.IN_PROGRESS.value == "in_progress"
        assert PhaseStatus.COMPLETED.value == "completed"
        assert PhaseStatus.FAILED.value == "failed"
        assert PhaseStatus.SKIPPED.value == "skipped"


class TestPhaseResult:
    """Test PhaseResult dataclass."""

    def test_phase_result_creation(self):
        """Test creating a phase result."""
        result = PhaseResult(
            phase_name="test_phase",
            status=PhaseStatus.COMPLETED,
            agent_response="Test response",
            extracted_data={"key": "value"},
            execution_time_seconds=1.5,
            tokens_used=100,
        )

        assert result.phase_name == "test_phase"
        assert result.status == PhaseStatus.COMPLETED
        assert result.success is True
        assert result.agent_response == "Test response"
        assert result.extracted_data == {"key": "value"}
        assert result.execution_time_seconds == 1.5
        assert result.tokens_used == 100

    def test_phase_result_success_property(self):
        """Test success property for different statuses."""
        completed_result = PhaseResult(
            phase_name="test",
            status=PhaseStatus.COMPLETED,
            agent_response="",
        )
        assert completed_result.success is True

        failed_result = PhaseResult(
            phase_name="test",
            status=PhaseStatus.FAILED,
            agent_response="",
        )
        assert failed_result.success is False

        skipped_result = PhaseResult(
            phase_name="test",
            status=PhaseStatus.SKIPPED,
            agent_response="",
        )
        assert skipped_result.success is False

    def test_phase_result_to_dict(self):
        """Test serialization to dictionary."""
        result = PhaseResult(
            phase_name="test_phase",
            status=PhaseStatus.COMPLETED,
            agent_response="Response",
            extracted_data={"data": "value"},
            errors=[],
            execution_time_seconds=2.0,
            tokens_used=200,
        )

        result_dict = result.to_dict()

        assert result_dict["phase_name"] == "test_phase"
        assert result_dict["status"] == "completed"
        assert result_dict["agent_response"] == "Response"
        assert result_dict["extracted_data"] == {"data": "value"}
        assert result_dict["errors"] == []
        assert result_dict["execution_time_seconds"] == 2.0
        assert result_dict["tokens_used"] == 200


class TestWorkflowConfig:
    """Test WorkflowConfig dataclass."""

    def test_workflow_config_creation_minimal(self):
        """Test creating config with minimal required fields."""
        config = WorkflowConfig(
            csv_file_path=None,
            athlete_profile_path=Path("/path/to/profile.json"),
            training_plan_weeks=12,
            fit_dir_path=Path("/path/to/fit"),
        )

        assert config.csv_file_path is None
        assert config.athlete_profile_path == Path("/path/to/profile.json")
        assert config.training_plan_weeks == 12
        assert config.period_months == 6  # default
        assert config.generate_training_plan is True  # default

    def test_workflow_config_validation_no_input_files(self, tmp_path):
        """Test validation fails when no input files provided."""
        profile_file = tmp_path / "profile.json"
        profile_file.touch()

        config = WorkflowConfig(
            csv_file_path=None,
            athlete_profile_path=profile_file,
            training_plan_weeks=12,
            fit_dir_path=None,
        )

        with pytest.raises(ValueError, match="Either csv_file_path or fit_dir_path"):
            config.validate()

    def test_workflow_config_validation_csv_not_found(self, tmp_path):
        """Test validation fails when CSV file doesn't exist."""
        profile_file = tmp_path / "profile.json"
        profile_file.touch()

        config = WorkflowConfig(
            csv_file_path=tmp_path / "nonexistent.csv",
            athlete_profile_path=profile_file,
            training_plan_weeks=12,
        )

        with pytest.raises(ValueError, match="CSV file not found"):
            config.validate()

    def test_workflow_config_validation_profile_not_found(self, tmp_path):
        """Test validation fails when profile doesn't exist."""
        csv_file = tmp_path / "activities.csv"
        csv_file.touch()

        config = WorkflowConfig(
            csv_file_path=csv_file,
            athlete_profile_path=tmp_path / "nonexistent.json",
            training_plan_weeks=12,
        )

        with pytest.raises(ValueError, match="Athlete profile not found"):
            config.validate()

    def test_workflow_config_validation_invalid_period_months(self, tmp_path):
        """Test validation fails for invalid period_months."""
        csv_file = tmp_path / "activities.csv"
        csv_file.touch()
        profile_file = tmp_path / "profile.json"
        profile_file.touch()

        config = WorkflowConfig(
            csv_file_path=csv_file,
            athlete_profile_path=profile_file,
            training_plan_weeks=12,
            period_months=0,
        )

        with pytest.raises(ValueError, match="period_months must be between"):
            config.validate()

    def test_workflow_config_validation_success(self, tmp_path):
        """Test validation succeeds with valid configuration."""
        csv_file = tmp_path / "activities.csv"
        csv_file.touch()
        profile_file = tmp_path / "profile.json"
        profile_file.touch()

        config = WorkflowConfig(
            csv_file_path=csv_file,
            athlete_profile_path=profile_file,
            training_plan_weeks=12,
        )

        # Should not raise
        config.validate()


class TestWorkflowResult:
    """Test WorkflowResult dataclass."""

    def test_workflow_result_success_all_completed(self):
        """Test workflow is successful when all phases completed."""
        phase_results = [
            PhaseResult("phase1", PhaseStatus.COMPLETED, "response1"),
            PhaseResult("phase2", PhaseStatus.COMPLETED, "response2"),
        ]

        result = WorkflowResult(
            phase_results=phase_results,
            total_execution_time_seconds=5.0,
            total_tokens_used=500,
        )

        assert result.success is True

    def test_workflow_result_success_with_skipped(self):
        """Test workflow is successful when some phases skipped."""
        phase_results = [
            PhaseResult("phase1", PhaseStatus.COMPLETED, "response1"),
            PhaseResult("phase2", PhaseStatus.SKIPPED, "skipped"),
        ]

        result = WorkflowResult(
            phase_results=phase_results,
            total_execution_time_seconds=3.0,
            total_tokens_used=300,
        )

        assert result.success is True

    def test_workflow_result_failure_when_phase_failed(self):
        """Test workflow fails when any non-skipped phase failed."""
        phase_results = [
            PhaseResult("phase1", PhaseStatus.COMPLETED, "response1"),
            PhaseResult("phase2", PhaseStatus.FAILED, "error", errors=["Error occurred"]),
        ]

        result = WorkflowResult(
            phase_results=phase_results,
            total_execution_time_seconds=2.0,
            total_tokens_used=200,
        )

        assert result.success is False

    def test_workflow_result_get_phase_result(self):
        """Test retrieving specific phase result."""
        phase1 = PhaseResult("phase1", PhaseStatus.COMPLETED, "response1")
        phase2 = PhaseResult("phase2", PhaseStatus.COMPLETED, "response2")

        result = WorkflowResult(
            phase_results=[phase1, phase2],
            total_execution_time_seconds=5.0,
            total_tokens_used=500,
        )

        assert result.get_phase_result("phase1") == phase1
        assert result.get_phase_result("phase2") == phase2
        assert result.get_phase_result("nonexistent") is None

    def test_workflow_result_to_dict(self):
        """Test serialization to dictionary."""
        phase_results = [
            PhaseResult("phase1", PhaseStatus.COMPLETED, "response1"),
        ]

        result = WorkflowResult(
            phase_results=phase_results,
            total_execution_time_seconds=3.5,
            total_tokens_used=350,
            output_files=[Path("/path/to/output.json")],
        )

        result_dict = result.to_dict()

        assert result_dict["total_execution_time_seconds"] == 3.5
        assert result_dict["total_tokens_used"] == 350
        assert result_dict["output_files"] == ["/path/to/output.json"]
        assert result_dict["success"] is True
        assert len(result_dict["phase_results"]) == 1


class TestPhaseContext:
    """Test PhaseContext dataclass."""

    def test_phase_context_creation(self):
        """Test creating a phase context."""
        config = WorkflowConfig(
            csv_file_path=None,
            athlete_profile_path=Path("/path/to/profile.json"),
            training_plan_weeks=12,
            fit_dir_path=Path("/path/to/fit"),
        )

        context = PhaseContext(
            config=config,
            previous_phase_data={"key": "value"},
            session_manager=None,
            provider=None,
            prompts_manager=None,
        )

        assert context.config == config
        assert context.previous_phase_data == {"key": "value"}
        assert context.progress_callback is None

    def test_phase_context_with_callback(self):
        """Test creating a phase context with progress callback."""
        config = WorkflowConfig(
            csv_file_path=None,
            athlete_profile_path=Path("/path/to/profile.json"),
            training_plan_weeks=12,
            fit_dir_path=Path("/path/to/fit"),
        )

        callback_called = []

        def callback(phase_name: str, status: PhaseStatus) -> None:
            callback_called.append((phase_name, status))

        context = PhaseContext(
            config=config,
            previous_phase_data={},
            session_manager=None,
            provider=None,
            prompts_manager=None,
            progress_callback=callback,
        )

        assert context.progress_callback is not None

        # Test callback works
        context.progress_callback("test_phase", PhaseStatus.IN_PROGRESS)
        assert callback_called == [("test_phase", PhaseStatus.IN_PROGRESS)]
