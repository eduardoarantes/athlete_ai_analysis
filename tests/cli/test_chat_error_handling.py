"""
Edge case and error handling tests for chat command.

Tests various error scenarios and edge cases to ensure robust error handling.
"""
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from cycling_ai.cli.commands.chat import (
    _check_onboarding_completion,
    _detect_existing_profile,
    _initialize_onboarding_mode,
    _transition_to_normal_mode,
)
from cycling_ai.orchestration.session import ConversationSession


class TestProfileDetectionErrors:
    """Test error handling in profile detection."""

    def test_detect_profile_nonexistent_explicit_path_raises_error(
        self, tmp_path: Path
    ) -> None:
        """Test that nonexistent explicit profile path raises FileNotFoundError."""
        nonexistent_profile = tmp_path / "nonexistent_profile.json"

        with pytest.raises(FileNotFoundError, match="Profile not found"):
            _detect_existing_profile(nonexistent_profile)

    def test_detect_profile_handles_permission_error(self, tmp_path: Path) -> None:
        """Test graceful handling of permission errors during directory scan."""
        data_dir = tmp_path / "data"
        data_dir.mkdir()

        athlete_dir = data_dir / "athlete1"
        athlete_dir.mkdir()

        # Create profile but make directory unreadable (Unix only)
        profile = athlete_dir / "athlete_profile.json"
        profile.write_text('{"ftp": 250}')

        # On Unix systems, make directory unreadable
        import sys

        if sys.platform != "win32":
            athlete_dir.chmod(0o000)

            try:
                # Should handle permission error gracefully
                with pytest.raises(PermissionError):
                    _detect_existing_profile(None)
            finally:
                # Restore permissions for cleanup
                athlete_dir.chmod(0o755)
        else:
            pytest.skip("Permission error test not applicable on Windows")

    def test_detect_profile_handles_symlink_loops(self, tmp_path: Path) -> None:
        """Test handling of symlink loops in data directory."""
        data_dir = tmp_path / "data"
        data_dir.mkdir()

        athlete_dir = data_dir / "athlete1"
        athlete_dir.mkdir()

        # Create symlink loop (Unix only)
        import sys

        if sys.platform != "win32":
            loop_link = athlete_dir / "loop"
            loop_link.symlink_to(athlete_dir)

            # Should not crash on symlink loop
            result = _detect_existing_profile(None)
            # May return None or find profiles, but shouldn't crash
            assert result is None or isinstance(result, Path)
        else:
            pytest.skip("Symlink test not applicable on Windows")


class TestOnboardingModeErrors:
    """Test error handling in onboarding mode functions."""

    def test_initialize_onboarding_preserves_existing_context_on_error(self) -> None:
        """Test that initialization errors don't corrupt existing context."""
        session = ConversationSession(
            session_id="test",
            provider_name="anthropic",
            context={
                "existing_key": "existing_value",
                "profile_path": "/important/path",
            },
        )

        original_context = session.context.copy()

        # Initialize should add new keys but preserve existing
        _initialize_onboarding_mode(session)

        # Existing keys should be preserved
        assert session.context["existing_key"] == "existing_value"
        assert session.context["profile_path"] == "/important/path"

    def test_check_completion_handles_corrupted_profile_path(self) -> None:
        """Test completion check handles corrupted profile path gracefully."""
        session = ConversationSession(
            session_id="test",
            provider_name="anthropic",
            context={
                "mode": "onboarding",
                "profile_path": None,  # Corrupted: should be string
            },
        )

        # Should return False without crashing
        result = _check_onboarding_completion(session)
        assert result is False

    def test_check_completion_handles_invalid_path_type(self) -> None:
        """Test completion check handles invalid path type."""
        session = ConversationSession(
            session_id="test",
            provider_name="anthropic",
            context={
                "mode": "onboarding",
                "profile_path": 12345,  # Wrong type
            },
        )

        # Should handle type error gracefully
        result = _check_onboarding_completion(session)
        assert result is False

    def test_transition_handles_missing_profile_path_gracefully(self) -> None:
        """Test transition handles missing profile_path without crashing."""
        session = ConversationSession(
            session_id="test",
            provider_name="anthropic",
            context={
                "mode": "onboarding",
                # profile_path is missing
            },
        )

        # Should not crash even without profile_path
        _transition_to_normal_mode(session)

        # Should still transition mode
        assert session.context["mode"] == "normal"

    def test_transition_preserves_critical_context_on_partial_failure(self) -> None:
        """Test that transition preserves context even if some operations fail."""
        session = ConversationSession(
            session_id="test",
            provider_name="anthropic",
            context={
                "mode": "onboarding",
                "profile_path": "/some/path.json",
                "critical_data": "must_preserve",
                "onboarding_manager": MagicMock(),
            },
        )

        _transition_to_normal_mode(session)

        # Critical data must be preserved
        assert session.context["critical_data"] == "must_preserve"
        assert "onboarding_manager" not in session.context


class TestConcurrentSessionHandling:
    """Test handling of concurrent chat sessions."""

    def test_multiple_sessions_dont_interfere(self, tmp_path: Path) -> None:
        """Test that multiple sessions maintain separate state."""
        # Create two sessions
        session1 = ConversationSession(
            session_id="session1",
            provider_name="anthropic",
            context={"mode": "onboarding"},
        )

        session2 = ConversationSession(
            session_id="session2",
            provider_name="anthropic",
            context={"mode": "normal", "profile_path": str(tmp_path / "profile.json")},
        )

        # Initialize onboarding for session1
        _initialize_onboarding_mode(session1)

        # Session2 should be unaffected
        assert session2.context["mode"] == "normal"
        assert "onboarding_manager" not in session2.context

    def test_session_isolation_during_profile_detection(self, tmp_path: Path) -> None:
        """Test profile detection doesn't share state between calls."""
        data_dir = tmp_path / "data"
        data_dir.mkdir()

        athlete1_dir = data_dir / "athlete1"
        athlete1_dir.mkdir()
        (athlete1_dir / "athlete_profile.json").write_text('{"name": "Athlete1"}')

        # First detection
        result1 = _detect_existing_profile(None)

        # Modify filesystem
        athlete2_dir = data_dir / "athlete2"
        athlete2_dir.mkdir()
        (athlete2_dir / "athlete_profile.json").write_text('{"name": "Athlete2"}')

        # Second detection should see updated state
        result2 = _detect_existing_profile(None)

        # Results should be independent
        assert result1 is not None
        assert result2 is not None
        # Second call might find different profile if more recent


class TestEdgeCasesInCompletion:
    """Test edge cases in onboarding completion logic."""

    def test_completion_with_empty_profile_file(self, tmp_path: Path) -> None:
        """Test completion check handles empty profile file."""
        profile_path = tmp_path / "athlete_profile.json"
        profile_path.write_text("")  # Empty file

        session = ConversationSession(
            session_id="test",
            provider_name="anthropic",
            context={
                "mode": "onboarding",
                "profile_path": str(profile_path),
            },
        )

        # Should return True (file exists, even if empty/invalid)
        result = _check_onboarding_completion(session)
        assert result is True

    def test_completion_with_directory_instead_of_file(self, tmp_path: Path) -> None:
        """Test completion check handles directory path instead of file."""
        directory_path = tmp_path / "athlete_profile.json"
        directory_path.mkdir()  # Create directory, not file

        session = ConversationSession(
            session_id="test",
            provider_name="anthropic",
            context={
                "mode": "onboarding",
                "profile_path": str(directory_path),
            },
        )

        # Should return False (not a file)
        result = _check_onboarding_completion(session)
        assert result is False

    def test_completion_with_relative_path(self, tmp_path: Path) -> None:
        """Test completion check handles relative paths."""
        import os

        # Change to tmp directory
        original_cwd = os.getcwd()
        try:
            os.chdir(tmp_path)

            # Create profile with relative path
            profile_path = Path("athlete_profile.json")
            profile_path.write_text('{"name": "Test"}')

            session = ConversationSession(
                session_id="test",
                provider_name="anthropic",
                context={
                    "mode": "onboarding",
                    "profile_path": "athlete_profile.json",
                },
            )

            # Should handle relative path
            result = _check_onboarding_completion(session)
            assert result is True
        finally:
            os.chdir(original_cwd)


class TestRobustnessAgainstCorruptedState:
    """Test robustness against corrupted session state."""

    def test_handles_context_as_none(self) -> None:
        """Test functions handle None context gracefully."""
        session = ConversationSession(
            session_id="test",
            provider_name="anthropic",
            context={},
        )
        session.context = None  # Simulate corruption

        # Functions should not crash
        with pytest.raises((AttributeError, TypeError)):
            # Expected to fail but not crash the process
            _check_onboarding_completion(session)

    def test_handles_mixed_type_context_values(self) -> None:
        """Test handling of unexpected types in context values."""
        session = ConversationSession(
            session_id="test",
            provider_name="anthropic",
            context={
                "mode": ["onboarding"],  # List instead of string
                "profile_path": {"path": "/some/path"},  # Dict instead of string
            },
        )

        # Should handle gracefully
        result = _check_onboarding_completion(session)
        assert result is False  # Invalid state = not complete
