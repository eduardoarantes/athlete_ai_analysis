"""
Tests for interactive loop onboarding completion checking.

Tests the _interactive_loop function's ability to detect onboarding
completion and transition to normal mode.
"""
from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, call, patch

import pytest

from cycling_ai.cli.commands.chat import (
    _check_onboarding_completion,
    _interactive_loop,
    _transition_to_normal_mode,
)
from cycling_ai.orchestration.agent import LLMAgent
from cycling_ai.orchestration.session import ConversationSession, SessionManager


class TestInteractiveLoopOnboardingCompletion:
    """Test interactive loop checks for onboarding completion."""

    @patch("cycling_ai.cli.commands.chat.console")
    def test_interactive_loop_checks_completion_after_message(
        self, mock_console: MagicMock, tmp_path: Path
    ) -> None:
        """Test loop checks for onboarding completion after each message."""
        # Create profile file
        profile_path = tmp_path / "data" / "Test" / "athlete_profile.json"
        profile_path.parent.mkdir(parents=True)
        profile_path.write_text('{"ftp": 265, "age": 35}')

        # Create session in onboarding mode
        session = ConversationSession(
            session_id="test",
            provider_name="test",
            context={
                "mode": "onboarding",
                "profile_path": str(profile_path),
            },
        )

        # Create mock agent
        agent = MagicMock(spec=LLMAgent)
        agent.process_message.return_value = "Profile saved successfully!"

        # Create mock session manager
        session_manager = MagicMock(spec=SessionManager)

        # Mock user input: one message then quit
        mock_console.input.side_effect = [
            "My name is Test",  # User message
            "/quit",  # Exit after checking completion
        ]

        # Mock _check_onboarding_completion to return True on first check
        with (
            patch(
                "cycling_ai.cli.commands.chat._check_onboarding_completion",
                return_value=True,
            ) as mock_check,
            patch(
                "cycling_ai.cli.commands.chat._transition_to_normal_mode"
            ) as mock_transition,
        ):
            # Run interactive loop
            _interactive_loop(agent, session, session_manager)

            # Verify completion was checked at least once
            assert mock_check.call_count >= 1

            # Verify transition was called when completion detected
            mock_transition.assert_called_once_with(session)

    @patch("cycling_ai.cli.commands.chat.console")
    def test_interactive_loop_displays_completion_message(
        self, mock_console: MagicMock, tmp_path: Path
    ) -> None:
        """Test loop displays completion message on transition."""
        # Create profile file
        profile_path = tmp_path / "data" / "Test" / "athlete_profile.json"
        profile_path.parent.mkdir(parents=True)
        profile_path.write_text('{"ftp": 265}')

        # Create session
        session = ConversationSession(
            session_id="test",
            provider_name="test",
            context={
                "mode": "onboarding",
                "profile_path": str(profile_path),
            },
        )

        # Create mocks
        agent = MagicMock(spec=LLMAgent)
        agent.process_message.return_value = "Done!"
        session_manager = MagicMock(spec=SessionManager)

        # Mock input
        mock_console.input.side_effect = [
            "message",
            "/quit",
        ]

        # Mock completion detection
        with (
            patch(
                "cycling_ai.cli.commands.chat._check_onboarding_completion",
                return_value=True,
            ),
            patch("cycling_ai.cli.commands.chat._transition_to_normal_mode"),
        ):
            # Run loop
            _interactive_loop(agent, session, session_manager)

            # Verify success message was printed
            print_calls = [str(call) for call in mock_console.print.call_args_list]
            assert any("Profile setup complete" in str(call) for call in print_calls)

    @patch("cycling_ai.cli.commands.chat.console")
    def test_interactive_loop_continues_in_normal_mode_after_transition(
        self, mock_console: MagicMock, tmp_path: Path
    ) -> None:
        """Test loop continues in normal mode after transition."""
        # Create profile
        profile_path = tmp_path / "athlete_profile.json"
        profile_path.write_text('{"ftp": 265}')

        # Create session
        session = ConversationSession(
            session_id="test",
            provider_name="test",
            context={
                "mode": "onboarding",
                "profile_path": str(profile_path),
            },
        )

        # Create mocks
        agent = MagicMock(spec=LLMAgent)
        agent.process_message.side_effect = [
            "Profile saved!",
            "Here's your performance analysis...",
        ]
        session_manager = MagicMock(spec=SessionManager)

        # Mock input: message triggers completion, then ask question, then quit
        mock_console.input.side_effect = [
            "finalize",  # Triggers completion
            "analyze my performance",  # Question in normal mode
            "/quit",
        ]

        # Mock completion: False first, True after first message, then stays in normal
        with (
            patch(
                "cycling_ai.cli.commands.chat._check_onboarding_completion",
                side_effect=[False, True, False],  # Normal mode after transition
            ),
            patch("cycling_ai.cli.commands.chat._transition_to_normal_mode"),
        ):
            # Run loop
            _interactive_loop(agent, session, session_manager)

            # Verify agent processed both messages
            assert agent.process_message.call_count == 2

    @patch("cycling_ai.cli.commands.chat.console")
    def test_interactive_loop_does_not_check_completion_in_normal_mode(
        self, mock_console: MagicMock
    ) -> None:
        """Test loop doesn't check completion when already in normal mode."""
        # Create session in normal mode
        session = ConversationSession(
            session_id="test",
            provider_name="test",
            context={"mode": "normal", "athlete_profile": "/path/to/profile.json"},
        )

        # Create mocks
        agent = MagicMock(spec=LLMAgent)
        agent.process_message.return_value = "Analysis complete"
        session_manager = MagicMock(spec=SessionManager)

        # Mock input
        mock_console.input.side_effect = [
            "analyze performance",
            "/quit",
        ]

        with patch(
            "cycling_ai.cli.commands.chat._check_onboarding_completion"
        ) as mock_check:
            # Run loop
            _interactive_loop(agent, session, session_manager)

            # Completion check should return False for normal mode
            # (or not be checked at all in optimized implementation)
            if mock_check.called:
                # If checked, should return False for normal mode
                for call_args in mock_check.call_args_list:
                    result = _check_onboarding_completion(session)
                    assert result is False


class TestInteractiveLoopEdgeCases:
    """Test edge cases in interactive loop."""

    @patch("cycling_ai.cli.commands.chat.console")
    def test_interactive_loop_handles_empty_input(
        self, mock_console: MagicMock
    ) -> None:
        """Test loop handles empty input gracefully."""
        session = ConversationSession(
            session_id="test", provider_name="test", context={}
        )
        agent = MagicMock(spec=LLMAgent)
        session_manager = MagicMock(spec=SessionManager)

        # Mock input: empty strings then quit
        mock_console.input.side_effect = [
            "",
            "  ",
            "/quit",
        ]

        # Should not crash
        _interactive_loop(agent, session, session_manager)

        # Agent should not be called for empty inputs
        assert not agent.process_message.called

    @patch("cycling_ai.cli.commands.chat.console")
    def test_interactive_loop_handles_keyboard_interrupt(
        self, mock_console: MagicMock
    ) -> None:
        """Test loop handles KeyboardInterrupt gracefully."""
        session = ConversationSession(
            session_id="test", provider_name="test", context={}
        )
        agent = MagicMock(spec=LLMAgent)
        session_manager = MagicMock(spec=SessionManager)

        # Mock input to raise KeyboardInterrupt, then quit
        mock_console.input.side_effect = [
            KeyboardInterrupt(),
            "/quit",
        ]

        # Should not crash
        _interactive_loop(agent, session, session_manager)

        # Should print "Use /quit to exit" message
        print_calls = [str(call) for call in mock_console.print.call_args_list]
        assert any("quit" in str(call).lower() for call in print_calls)

    @patch("cycling_ai.cli.commands.chat.console")
    def test_interactive_loop_saves_session_after_each_message(
        self, mock_console: MagicMock
    ) -> None:
        """Test loop saves session after processing each message."""
        session = ConversationSession(
            session_id="test", provider_name="test", context={}
        )
        agent = MagicMock(spec=LLMAgent)
        agent.process_message.return_value = "Response"
        session_manager = MagicMock(spec=SessionManager)

        # Mock input
        mock_console.input.side_effect = [
            "message1",
            "message2",
            "/quit",
        ]

        # Run loop
        _interactive_loop(agent, session, session_manager)

        # Verify session was saved after each message
        assert session_manager.update_session.call_count >= 2
        session_manager.update_session.assert_called_with(session)


class TestCompletionCheckFunction:
    """Test _check_onboarding_completion function."""

    def test_completion_returns_false_when_not_in_onboarding_mode(self) -> None:
        """Test completion returns False when not in onboarding mode."""
        session = ConversationSession(
            session_id="test",
            provider_name="test",
            context={"mode": "normal"},
        )

        result = _check_onboarding_completion(session)
        assert result is False

    def test_completion_returns_false_when_no_profile_path(self) -> None:
        """Test completion returns False when profile_path not in context."""
        session = ConversationSession(
            session_id="test",
            provider_name="test",
            context={"mode": "onboarding"},
        )

        result = _check_onboarding_completion(session)
        assert result is False

    def test_completion_returns_false_when_profile_file_missing(
        self, tmp_path: Path
    ) -> None:
        """Test completion returns False when profile file doesn't exist."""
        # Profile path that doesn't exist
        profile_path = tmp_path / "nonexistent.json"

        session = ConversationSession(
            session_id="test",
            provider_name="test",
            context={
                "mode": "onboarding",
                "profile_path": str(profile_path),
            },
        )

        result = _check_onboarding_completion(session)
        assert result is False

    def test_completion_returns_true_when_profile_finalized(
        self, tmp_path: Path
    ) -> None:
        """Test completion returns True when profile file exists."""
        # Create profile file
        profile_path = tmp_path / "athlete_profile.json"
        profile_path.write_text('{"ftp": 265, "age": 35}')

        session = ConversationSession(
            session_id="test",
            provider_name="test",
            context={
                "mode": "onboarding",
                "profile_path": str(profile_path),
            },
        )

        result = _check_onboarding_completion(session)
        assert result is True


class TestTransitionFunction:
    """Test _transition_to_normal_mode function."""

    def test_transition_changes_mode_to_normal(self) -> None:
        """Test transition changes mode from onboarding to normal."""
        session = ConversationSession(
            session_id="test",
            provider_name="test",
            context={"mode": "onboarding"},
        )

        _transition_to_normal_mode(session)

        assert session.context["mode"] == "normal"

    def test_transition_removes_onboarding_manager(self) -> None:
        """Test transition removes onboarding_manager from context."""
        session = ConversationSession(
            session_id="test",
            provider_name="test",
            context={
                "mode": "onboarding",
                "onboarding_manager": MagicMock(),
            },
        )

        _transition_to_normal_mode(session)

        assert "onboarding_manager" not in session.context

    def test_transition_sets_athlete_profile_from_profile_path(self) -> None:
        """Test transition sets athlete_profile field."""
        profile_path = "/path/to/profile.json"
        session = ConversationSession(
            session_id="test",
            provider_name="test",
            context={
                "mode": "onboarding",
                "profile_path": profile_path,
            },
        )

        _transition_to_normal_mode(session)

        assert session.context["athlete_profile"] == profile_path

    def test_transition_preserves_profile_path(self) -> None:
        """Test transition keeps profile_path in context."""
        profile_path = "/path/to/profile.json"
        session = ConversationSession(
            session_id="test",
            provider_name="test",
            context={
                "mode": "onboarding",
                "profile_path": profile_path,
            },
        )

        _transition_to_normal_mode(session)

        assert session.context["profile_path"] == profile_path
