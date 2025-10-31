"""
Unit tests for Phase 3 validation in multi_agent.py.

Ensures that Phase 3 fails with clear error messages when required data is missing,
instead of silently using defaults.
"""
import pytest
from pathlib import Path
from unittest.mock import Mock, patch
from cycling_ai.orchestration.multi_agent import MultiAgentOrchestrator, WorkflowConfig, PhaseResult


class TestPhase3Validation:
    """Test Phase 3 validation and error handling."""

    @pytest.fixture
    def mock_orchestrator(self):
        """Create a mock orchestrator with minimal setup."""
        mock_provider = Mock()
        return MultiAgentOrchestrator(provider=mock_provider)

    def test_phase3_fails_when_profile_file_not_found(self, mock_orchestrator):
        """Test that Phase 3 fails with clear error when athlete profile file doesn't exist."""
        config = WorkflowConfig(
            athlete_profile_path=Path("/nonexistent/athlete_profile.json"),
            data_directory=Path("/tmp/test"),
            training_plan_weeks=4
        )

        phase2_result = PhaseResult(
            phase_name="performance_analysis",
            success=True,
            extracted_data={
                "athlete_profile_path": "/nonexistent/athlete_profile.json"
            }
        )

        with pytest.raises(ValueError) as exc_info:
            mock_orchestrator._execute_phase_3(config, phase2_result)

        error_msg = str(exc_info.value)
        assert "[PHASE 3] Cannot proceed" in error_msg
        assert "Athlete profile not found" in error_msg
        assert "/nonexistent/athlete_profile.json" in error_msg
        assert "FTP" in error_msg
        assert "available training days" in error_msg

    def test_phase3_fails_when_profile_missing_ftp(self, mock_orchestrator):
        """Test that Phase 3 fails when athlete profile doesn't have FTP."""
        config = WorkflowConfig(
            athlete_profile_path=Path("/tmp/test_profile.json"),
            data_directory=Path("/tmp/test"),
            training_plan_weeks=4
        )

        phase2_result = PhaseResult(
            phase_name="performance_analysis",
            success=True,
            extracted_data={
                "athlete_profile_path": "/tmp/test_profile.json"
            }
        )

        # Mock athlete profile without FTP
        mock_profile = Mock()
        mock_profile.ftp = None  # Missing FTP!
        mock_profile.get_training_days.return_value = ["Monday", "Wednesday", "Friday"]
        mock_profile.get_weekly_training_hours.return_value = 8.0

        with patch('cycling_ai.orchestration.multi_agent.load_athlete_profile', return_value=mock_profile):
            with pytest.raises(ValueError) as exc_info:
                mock_orchestrator._execute_phase_3(config, phase2_result)

            error_msg = str(exc_info.value)
            assert "[PHASE 3] Cannot proceed" in error_msg
            assert "does not have a valid FTP value" in error_msg
            assert "FTP is required" in error_msg

    def test_phase3_fails_when_no_available_days(self, mock_orchestrator):
        """Test that Phase 3 fails when athlete profile has no available training days."""
        config = WorkflowConfig(
            athlete_profile_path=Path("/tmp/test_profile.json"),
            data_directory=Path("/tmp/test"),
            training_plan_weeks=4
        )

        phase2_result = PhaseResult(
            phase_name="performance_analysis",
            success=True,
            extracted_data={
                "athlete_profile_path": "/tmp/test_profile.json"
            }
        )

        # Mock athlete profile with no available days
        mock_profile = Mock()
        mock_profile.ftp = 250
        mock_profile.get_training_days.return_value = []  # No days!
        mock_profile.get_weekly_training_hours.return_value = 8.0

        with patch('cycling_ai.orchestration.multi_agent.load_athlete_profile', return_value=mock_profile):
            with pytest.raises(ValueError) as exc_info:
                mock_orchestrator._execute_phase_3(config, phase2_result)

            error_msg = str(exc_info.value)
            assert "[PHASE 3] Cannot proceed" in error_msg
            assert "does not specify available training days" in error_msg
            assert "At least one training day is required" in error_msg

    def test_phase3_fails_when_zero_weekly_hours(self, mock_orchestrator):
        """Test that Phase 3 fails when weekly time budget is 0 or negative."""
        config = WorkflowConfig(
            athlete_profile_path=Path("/tmp/test_profile.json"),
            data_directory=Path("/tmp/test"),
            training_plan_weeks=4
        )

        phase2_result = PhaseResult(
            phase_name="performance_analysis",
            success=True,
            extracted_data={
                "athlete_profile_path": "/tmp/test_profile.json"
            }
        )

        # Mock athlete profile with zero weekly hours
        mock_profile = Mock()
        mock_profile.ftp = 250
        mock_profile.get_training_days.return_value = ["Monday", "Wednesday", "Friday"]
        mock_profile.get_weekly_training_hours.return_value = 0  # Zero hours!

        with patch('cycling_ai.orchestration.multi_agent.load_athlete_profile', return_value=mock_profile):
            with pytest.raises(ValueError) as exc_info:
                mock_orchestrator._execute_phase_3(config, phase2_result)

            error_msg = str(exc_info.value)
            assert "[PHASE 3] Cannot proceed" in error_msg
            assert "does not have a valid weekly time budget" in error_msg
            assert "must be greater than 0" in error_msg


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
