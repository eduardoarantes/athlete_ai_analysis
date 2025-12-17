"""
Unit tests for Phase 3 validation in TrainingPlanningPhase.

Ensures that Phase 3 fails with clear error messages when required data is missing,
instead of silently using defaults.

The validation logic is in TrainingPlanningPhase._execute_phase_3a_overview().
"""
import pytest
from pathlib import Path
from unittest.mock import Mock, patch

from cycling_ai.orchestration.base import PhaseContext, WorkflowConfig
from cycling_ai.orchestration.phases.training_planning import TrainingPlanningPhase


class TestPhase3Validation:
    """Test Phase 3 validation and error handling."""

    @pytest.fixture
    def mock_context(self, tmp_path: Path) -> PhaseContext:
        """Create a mock PhaseContext for testing."""
        config = WorkflowConfig(
            csv_file_path=None,
            fit_dir_path=tmp_path,
            athlete_profile_path=tmp_path / "athlete_profile.json",
            output_dir=tmp_path,
            training_plan_weeks=4,
            generate_training_plan=True,
        )

        # Create minimal mocks for context components
        mock_session_manager = Mock()
        mock_provider = Mock()
        mock_provider.config.provider_name = "mock"
        mock_prompts_manager = Mock()

        return PhaseContext(
            config=config,
            previous_phase_data={
                "athlete_profile_path": str(tmp_path / "athlete_profile.json")
            },
            session_manager=mock_session_manager,
            provider=mock_provider,
            prompts_manager=mock_prompts_manager,
        )

    def test_phase3_fails_when_profile_file_not_found(self, mock_context: PhaseContext):
        """Test that Phase 3 fails with clear error when athlete profile file doesn't exist."""
        # Set a non-existent profile path
        mock_context.previous_phase_data["athlete_profile_path"] = "/nonexistent/athlete_profile.json"

        phase = TrainingPlanningPhase()

        with pytest.raises(ValueError) as exc_info:
            phase._execute_phase_3a_overview(mock_context)

        error_msg = str(exc_info.value)
        assert "[PHASE 3a] Cannot proceed" in error_msg
        assert "Athlete profile not found" in error_msg
        assert "/nonexistent/athlete_profile.json" in error_msg
        assert "FTP" in error_msg
        assert "available training days" in error_msg

    def test_phase3_fails_when_profile_missing_ftp(self, mock_context: PhaseContext):
        """Test that Phase 3 fails when athlete profile doesn't have FTP."""
        # Mock athlete profile without FTP
        mock_profile = Mock()
        mock_profile.ftp = None  # Missing FTP!
        mock_profile.get_training_days.return_value = ["Monday", "Wednesday", "Friday"]
        mock_profile.get_weekly_training_hours.return_value = 8.0

        phase = TrainingPlanningPhase()

        # Patch at source module since import is local within the function
        with patch(
            "cycling_ai.core.athlete.load_athlete_profile",
            return_value=mock_profile,
        ):
            with pytest.raises(ValueError) as exc_info:
                phase._execute_phase_3a_overview(mock_context)

            error_msg = str(exc_info.value)
            assert "[PHASE 3a] Cannot proceed" in error_msg
            assert "does not have a valid FTP value" in error_msg
            assert "FTP is required" in error_msg

    def test_phase3_fails_when_no_available_days(self, mock_context: PhaseContext):
        """Test that Phase 3 fails when athlete profile has no available training days."""
        # Mock athlete profile with no available days
        mock_profile = Mock()
        mock_profile.ftp = 250
        mock_profile.get_training_days.return_value = []  # No days!
        mock_profile.get_weekly_training_hours.return_value = 8.0

        phase = TrainingPlanningPhase()

        # Patch at source module since import is local within the function
        with patch(
            "cycling_ai.core.athlete.load_athlete_profile",
            return_value=mock_profile,
        ):
            with pytest.raises(ValueError) as exc_info:
                phase._execute_phase_3a_overview(mock_context)

            error_msg = str(exc_info.value)
            assert "[PHASE 3a] Cannot proceed" in error_msg
            assert "does not specify available training days" in error_msg
            assert "At least one training day is required" in error_msg

    def test_phase3_fails_when_zero_weekly_hours(self, mock_context: PhaseContext):
        """Test that Phase 3 fails when weekly time budget is 0 or negative."""
        # Mock athlete profile with zero weekly hours
        mock_profile = Mock()
        mock_profile.ftp = 250
        mock_profile.get_training_days.return_value = ["Monday", "Wednesday", "Friday"]
        mock_profile.get_weekly_training_hours.return_value = 0  # Zero hours!

        phase = TrainingPlanningPhase()

        # Patch at source module since import is local within the function
        with patch(
            "cycling_ai.core.athlete.load_athlete_profile",
            return_value=mock_profile,
        ):
            with pytest.raises(ValueError) as exc_info:
                phase._execute_phase_3a_overview(mock_context)

            error_msg = str(exc_info.value)
            assert "[PHASE 3a] Cannot proceed" in error_msg
            assert "does not have a valid weekly time budget" in error_msg
            assert "must be greater than 0" in error_msg


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
