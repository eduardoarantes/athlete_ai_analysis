"""Tests for multi-agent data structures."""
from pathlib import Path

import pytest

from cycling_ai.orchestration.multi_agent import (
    PhaseResult,
    PhaseStatus,
    WorkflowConfig,
    WorkflowResult,
)


class TestPhaseStatus:
    """Tests for PhaseStatus enum."""

    def test_enum_values(self) -> None:
        """Test enum has expected values."""
        assert PhaseStatus.PENDING.value == "pending"
        assert PhaseStatus.IN_PROGRESS.value == "in_progress"
        assert PhaseStatus.COMPLETED.value == "completed"
        assert PhaseStatus.FAILED.value == "failed"
        assert PhaseStatus.SKIPPED.value == "skipped"


class TestPhaseResult:
    """Tests for PhaseResult dataclass."""

    def test_creation_minimal(self) -> None:
        """Test creating PhaseResult with minimal arguments."""
        result = PhaseResult(
            phase_name="test_phase",
            status=PhaseStatus.COMPLETED,
            agent_response="Test response",
        )

        assert result.phase_name == "test_phase"
        assert result.status == PhaseStatus.COMPLETED
        assert result.agent_response == "Test response"
        assert result.extracted_data == {}
        assert result.errors == []
        assert result.execution_time_seconds == 0.0
        assert result.tokens_used == 0

    def test_success_property_completed(self) -> None:
        """Test success property returns True for COMPLETED status."""
        result = PhaseResult(
            phase_name="test",
            status=PhaseStatus.COMPLETED,
            agent_response="Success",
        )
        assert result.success is True

    def test_success_property_failed(self) -> None:
        """Test success property returns False for FAILED status."""
        result = PhaseResult(
            phase_name="test",
            status=PhaseStatus.FAILED,
            agent_response="",
            errors=["Test error"],
        )
        assert result.success is False

    def test_to_dict_serialization(self) -> None:
        """Test to_dict produces correct structure."""
        result = PhaseResult(
            phase_name="test_phase",
            status=PhaseStatus.COMPLETED,
            agent_response="Response text",
            extracted_data={"key": "value"},
            errors=[],
            execution_time_seconds=1.5,
            tokens_used=100,
        )

        data = result.to_dict()

        assert data["phase_name"] == "test_phase"
        assert data["status"] == "completed"
        assert data["agent_response"] == "Response text"
        assert data["extracted_data"] == {"key": "value"}
        assert data["errors"] == []
        assert data["execution_time_seconds"] == 1.5
        assert data["tokens_used"] == 100


class TestWorkflowConfig:
    """Tests for WorkflowConfig dataclass."""

    @pytest.fixture
    def temp_files(self, tmp_path: Path) -> dict[str, Path]:
        """Create temporary test files."""
        csv_file = tmp_path / "activities.csv"
        csv_file.write_text("Activity Date,Distance")

        profile_file = tmp_path / "profile.json"
        profile_file.write_text('{"name": "Test", "ftp": 250}')

        fit_dir = tmp_path / "fit_files"
        fit_dir.mkdir()

        return {
            "csv": csv_file,
            "profile": profile_file,
            "fit_dir": fit_dir,
            "output_dir": tmp_path / "reports",
        }

    def test_creation_with_defaults(self, temp_files: dict[str, Path]) -> None:
        """Test creating WorkflowConfig with default values."""
        config = WorkflowConfig(
            csv_file_path=temp_files["csv"],
            athlete_profile_path=temp_files["profile"],
        )

        assert config.csv_file_path == temp_files["csv"]
        assert config.athlete_profile_path == temp_files["profile"]
        assert config.fit_dir_path is None
        assert config.output_dir == Path("./reports")
        assert config.period_months == 6
        assert config.generate_training_plan is True
        assert config.training_plan_weeks == 12
        assert config.max_iterations_per_phase == 5
        assert config.prompts_dir is None

    def test_validation_success(self, temp_files: dict[str, Path]) -> None:
        """Test validation passes with valid config."""
        config = WorkflowConfig(
            csv_file_path=temp_files["csv"],
            athlete_profile_path=temp_files["profile"],
            fit_dir_path=temp_files["fit_dir"],
        )

        # Should not raise
        config.validate()

    def test_validation_missing_csv(self, temp_files: dict[str, Path]) -> None:
        """Test validation fails with missing CSV file."""
        config = WorkflowConfig(
            csv_file_path=Path("/nonexistent/activities.csv"),
            athlete_profile_path=temp_files["profile"],
        )

        with pytest.raises(ValueError, match="CSV file not found"):
            config.validate()

    def test_validation_missing_profile(self, temp_files: dict[str, Path]) -> None:
        """Test validation fails with missing profile."""
        config = WorkflowConfig(
            csv_file_path=temp_files["csv"],
            athlete_profile_path=Path("/nonexistent/profile.json"),
        )

        with pytest.raises(ValueError, match="Athlete profile not found"):
            config.validate()

    def test_validation_invalid_period_months(self, temp_files: dict[str, Path]) -> None:
        """Test validation fails with invalid period_months."""
        config = WorkflowConfig(
            csv_file_path=temp_files["csv"],
            athlete_profile_path=temp_files["profile"],
            period_months=0,
        )

        with pytest.raises(ValueError, match="period_months must be between 1 and 24"):
            config.validate()

    def test_validation_invalid_training_weeks(self, temp_files: dict[str, Path]) -> None:
        """Test validation fails with invalid training_plan_weeks."""
        config = WorkflowConfig(
            csv_file_path=temp_files["csv"],
            athlete_profile_path=temp_files["profile"],
            training_plan_weeks=100,
        )

        with pytest.raises(ValueError, match="training_plan_weeks must be between 1 and 52"):
            config.validate()


class TestWorkflowResult:
    """Tests for WorkflowResult dataclass."""

    def test_success_property_all_completed(self) -> None:
        """Test success property with all phases completed."""
        result = WorkflowResult(
            phase_results=[
                PhaseResult("phase1", PhaseStatus.COMPLETED, "Done"),
                PhaseResult("phase2", PhaseStatus.COMPLETED, "Done"),
            ],
            total_execution_time_seconds=10.0,
            total_tokens_used=1000,
        )

        assert result.success is True

    def test_success_property_with_failure(self) -> None:
        """Test success property with one phase failed."""
        result = WorkflowResult(
            phase_results=[
                PhaseResult("phase1", PhaseStatus.COMPLETED, "Done"),
                PhaseResult("phase2", PhaseStatus.FAILED, "", errors=["Error"]),
            ],
            total_execution_time_seconds=10.0,
            total_tokens_used=1000,
        )

        assert result.success is False

    def test_success_property_with_skipped(self) -> None:
        """Test success property ignores skipped phases."""
        result = WorkflowResult(
            phase_results=[
                PhaseResult("phase1", PhaseStatus.COMPLETED, "Done"),
                PhaseResult("phase2", PhaseStatus.SKIPPED, "Skipped"),
            ],
            total_execution_time_seconds=10.0,
            total_tokens_used=1000,
        )

        assert result.success is True  # Skipped doesn't affect success

    def test_get_phase_result(self) -> None:
        """Test retrieving specific phase result."""
        phase1 = PhaseResult("phase1", PhaseStatus.COMPLETED, "Done")
        phase2 = PhaseResult("phase2", PhaseStatus.COMPLETED, "Done")

        result = WorkflowResult(
            phase_results=[phase1, phase2],
            total_execution_time_seconds=10.0,
            total_tokens_used=1000,
        )

        retrieved = result.get_phase_result("phase1")
        assert retrieved is phase1

        not_found = result.get_phase_result("nonexistent")
        assert not_found is None

    def test_to_dict_serialization(self) -> None:
        """Test to_dict produces correct structure."""
        result = WorkflowResult(
            phase_results=[
                PhaseResult("phase1", PhaseStatus.COMPLETED, "Done"),
            ],
            total_execution_time_seconds=10.5,
            total_tokens_used=1500,
            output_files=[Path("/reports/index.html")],
        )

        data = result.to_dict()

        assert len(data["phase_results"]) == 1
        assert data["total_execution_time_seconds"] == 10.5
        assert data["total_tokens_used"] == 1500
        assert data["output_files"] == ["/reports/index.html"]
        assert data["success"] is True
