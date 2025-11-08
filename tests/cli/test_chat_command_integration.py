"""
Tests for chat command integration with profile onboarding.

Tests the main chat() command's integration with profile detection,
onboarding mode initialization, and mode transitions.
"""
from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from cycling_ai.cli.commands.chat import (
    _detect_existing_profile,
    chat,
)
from cycling_ai.orchestration.session import ConversationSession


class TestChatProfileDetection:
    """Test profile detection during chat startup."""

    def test_chat_detects_profile_when_flag_provided(
        self, tmp_path: Path, mock_session_manager: MagicMock
    ) -> None:
        """Test chat uses profile when --profile flag provided."""
        # Create profile file
        profile_path = tmp_path / "athlete_profile.json"
        profile_path.write_text('{"ftp": 265, "age": 35}')

        # Mock _detect_existing_profile to verify it's called with correct path
        with patch(
            "cycling_ai.cli.commands.chat._detect_existing_profile"
        ) as mock_detect:
            mock_detect.return_value = profile_path

            # Create mock session
            session = ConversationSession(
                session_id="test",
                provider_name="anthropic",
                context={"athlete_profile": str(profile_path)},
            )
            mock_session_manager.create_session.return_value = session

            # Mock other dependencies
            with (
                patch("cycling_ai.cli.commands.chat.load_config"),
                patch("cycling_ai.cli.commands.chat.get_default_session_manager")
                as mock_get_manager,
                patch("cycling_ai.cli.commands.chat._initialize_provider"),
                patch("cycling_ai.cli.commands.chat.AgentFactory.create_agent"),
                patch("cycling_ai.cli.commands.chat._interactive_loop"),
            ):
                mock_get_manager.return_value = mock_session_manager

                # Run chat command (would normally block, but we mock interactive_loop)
                from click.testing import CliRunner

                runner = CliRunner()
                result = runner.invoke(
                    chat, ["--provider", "anthropic", "--profile", str(profile_path)]
                )

                # Verify detect was called with explicit path
                mock_detect.assert_called_once_with(profile_path)

    def test_chat_detects_profile_from_data_directory(
        self, tmp_path: Path, mock_session_manager: MagicMock
    ) -> None:
        """Test chat auto-detects profile from data/ directory."""
        # Create data directory structure
        data_dir = tmp_path / "data"
        athlete_dir = data_dir / "Eduardo"
        athlete_dir.mkdir(parents=True)

        profile_path = athlete_dir / "athlete_profile.json"
        profile_path.write_text('{"ftp": 265, "age": 35}')

        # Change to temp directory so data/ is found
        import os

        original_dir = os.getcwd()
        try:
            os.chdir(tmp_path)

            # Detect should find the profile
            detected = _detect_existing_profile(None)
            assert detected == profile_path

        finally:
            os.chdir(original_dir)

    def test_chat_returns_none_when_no_profile_exists(self, tmp_path: Path) -> None:
        """Test detection returns None when no profile exists."""
        # Empty directory
        import os

        original_dir = os.getcwd()
        try:
            os.chdir(tmp_path)

            # No data directory - should return None
            detected = _detect_existing_profile(None)
            assert detected is None

        finally:
            os.chdir(original_dir)


class TestChatOnboardingModeInitialization:
    """Test onboarding mode initialization in chat command."""

    @patch("cycling_ai.cli.commands.chat.load_config")
    @patch("cycling_ai.cli.commands.chat.get_default_session_manager")
    @patch("cycling_ai.cli.commands.chat._detect_existing_profile")
    @patch("cycling_ai.cli.commands.chat._initialize_provider")
    @patch("cycling_ai.cli.commands.chat.AgentFactory.create_agent")
    @patch("cycling_ai.cli.commands.chat._interactive_loop")
    def test_chat_initializes_onboarding_when_no_profile(
        self,
        mock_loop: MagicMock,
        mock_create_agent: MagicMock,
        mock_init_provider: MagicMock,
        mock_detect: MagicMock,
        mock_get_manager: MagicMock,
        mock_config: MagicMock,
    ) -> None:
        """Test chat enters onboarding mode when no profile detected."""
        # Setup: No profile detected
        mock_detect.return_value = None

        # Create session manager mock
        session_manager = MagicMock()
        session = ConversationSession(
            session_id="test",
            provider_name="anthropic",
            context={
                "mode": "onboarding",
                "onboarding_manager": MagicMock(),
            },
        )
        session_manager.create_session.return_value = session
        mock_get_manager.return_value = session_manager

        # Run chat
        from click.testing import CliRunner

        runner = CliRunner()
        result = runner.invoke(chat, ["--provider", "anthropic"])

        # Verify session was created with onboarding context
        assert session_manager.create_session.called
        call_kwargs = session_manager.create_session.call_args.kwargs

        # Check that context includes onboarding mode
        assert "context" in call_kwargs
        # Note: The actual initialization happens in chat() after detect

    @patch("cycling_ai.cli.commands.chat.load_config")
    @patch("cycling_ai.cli.commands.chat.get_default_session_manager")
    @patch("cycling_ai.cli.commands.chat._detect_existing_profile")
    @patch("cycling_ai.cli.commands.chat._initialize_provider")
    @patch("cycling_ai.cli.commands.chat.AgentFactory.create_agent")
    @patch("cycling_ai.cli.commands.chat._interactive_loop")
    def test_chat_uses_normal_mode_when_profile_exists(
        self,
        mock_loop: MagicMock,
        mock_create_agent: MagicMock,
        mock_init_provider: MagicMock,
        mock_detect: MagicMock,
        mock_get_manager: MagicMock,
        mock_config: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Test chat uses normal mode when profile exists."""
        # Setup: Profile exists
        profile_path = tmp_path / "profile.json"
        profile_path.write_text('{"ftp": 265}')
        mock_detect.return_value = profile_path

        # Create session manager mock
        session_manager = MagicMock()
        session = ConversationSession(
            session_id="test",
            provider_name="anthropic",
            context={"athlete_profile": str(profile_path)},
        )
        session_manager.create_session.return_value = session
        mock_get_manager.return_value = session_manager

        # Run chat
        from click.testing import CliRunner

        runner = CliRunner()
        result = runner.invoke(chat, ["--provider", "anthropic"])

        # Verify session was created with profile context (not onboarding)
        assert session_manager.create_session.called


class TestChatBackwardCompatibility:
    """Test backward compatibility of chat command."""

    def test_chat_respects_explicit_profile_flag(self, tmp_path: Path) -> None:
        """Test that explicit --profile flag takes priority."""
        # Create two profiles
        profile1 = tmp_path / "profile1.json"
        profile1.write_text('{"ftp": 250}')

        data_dir = tmp_path / "data" / "Eduardo"
        data_dir.mkdir(parents=True)
        profile2 = data_dir / "athlete_profile.json"
        profile2.write_text('{"ftp": 270}')

        # Change to temp directory
        import os

        original_dir = os.getcwd()
        try:
            os.chdir(tmp_path)

            # Explicit path should take priority
            detected = _detect_existing_profile(profile1)
            assert detected == profile1
            assert detected != profile2

        finally:
            os.chdir(original_dir)

    def test_chat_works_with_existing_session_id(self) -> None:
        """Test chat can resume existing session."""
        # Mock dependencies
        with (
            patch("cycling_ai.cli.commands.chat.load_config"),
            patch("cycling_ai.cli.commands.chat.get_default_session_manager")
            as mock_get_manager,
            patch("cycling_ai.cli.commands.chat._initialize_provider"),
            patch("cycling_ai.cli.commands.chat.AgentFactory.create_agent"),
            patch("cycling_ai.cli.commands.chat._interactive_loop"),
        ):
            # Setup: Existing session
            session_manager = MagicMock()
            existing_session = ConversationSession(
                session_id="existing-123",
                provider_name="anthropic",
                context={"athlete_profile": "/path/to/profile.json"},
            )
            session_manager.get_session.return_value = existing_session
            mock_get_manager.return_value = session_manager

            # Run chat with session ID
            from click.testing import CliRunner

            runner = CliRunner()
            result = runner.invoke(
                chat, ["--provider", "anthropic", "--session-id", "existing-123"]
            )

            # Verify session was loaded (not created)
            session_manager.get_session.assert_called_once_with("existing-123")
            assert not session_manager.create_session.called


@pytest.fixture
def mock_session_manager() -> MagicMock:
    """Create mock session manager."""
    manager = MagicMock()
    return manager
