"""
Unit tests for chat onboarding mode integration.

Tests the onboarding mode functions that initialize, check completion,
and transition the chat session for profile creation.
"""

from pathlib import Path
from unittest.mock import Mock, patch

import pytest

from cycling_ai.cli.commands.chat import (
    _check_onboarding_completion,
    _get_onboarding_system_prompt,
    _initialize_onboarding_mode,
    _transition_to_normal_mode,
)
from cycling_ai.orchestration.profile_onboarding import (
    OnboardingState,
    PartialProfile,
    ProfileOnboardingManager,
)
from cycling_ai.orchestration.session import ConversationSession


class TestInitializeOnboardingMode:
    """Test suite for _initialize_onboarding_mode()."""

    def test_initialize_creates_onboarding_context(self) -> None:
        """Test that initialization creates correct session context."""
        session = Mock(spec=ConversationSession)
        session.context = {}

        _initialize_onboarding_mode(session)

        # Should set mode to onboarding
        assert session.context["mode"] == "onboarding"

        # Should create ProfileOnboardingManager
        assert "onboarding_manager" in session.context
        manager = session.context["onboarding_manager"]
        assert isinstance(manager, ProfileOnboardingManager)

        # Manager should be in NOT_STARTED state
        assert manager.state == OnboardingState.NOT_STARTED

    def test_initialize_starts_onboarding(self) -> None:
        """Test that initialization starts the onboarding flow."""
        session = Mock(spec=ConversationSession)
        session.context = {}

        _initialize_onboarding_mode(session)

        manager = session.context["onboarding_manager"]

        # Should transition to COLLECTING_CORE
        manager.start_onboarding()
        assert manager.state == OnboardingState.COLLECTING_CORE

    def test_initialize_preserves_existing_context(self) -> None:
        """Test that initialization preserves other context fields."""
        session = Mock(spec=ConversationSession)
        session.context = {"data_dir": "/some/path", "custom_field": "value"}

        _initialize_onboarding_mode(session)

        # Should preserve existing fields
        assert session.context["data_dir"] == "/some/path"
        assert session.context["custom_field"] == "value"

        # Should add onboarding fields
        assert session.context["mode"] == "onboarding"
        assert "onboarding_manager" in session.context


class TestGetOnboardingSystemPrompt:
    """Test suite for _get_onboarding_system_prompt()."""

    def test_returns_string_prompt(self) -> None:
        """Test that function returns a non-empty string."""
        prompt = _get_onboarding_system_prompt()

        assert isinstance(prompt, str)
        assert len(prompt) > 100  # Should be substantial

    def test_prompt_contains_key_instructions(self) -> None:
        """Test that prompt contains essential onboarding instructions."""
        prompt = _get_onboarding_system_prompt()

        # Should mention profile creation
        assert "profile" in prompt.lower()

        # Should mention available tools
        assert "tool" in prompt.lower()

        # Should mention required fields
        assert "field" in prompt.lower() or "information" in prompt.lower()

    def test_prompt_mentions_profile_tools(self) -> None:
        """Test that prompt mentions profile creation tools."""
        prompt = _get_onboarding_system_prompt()

        # Should mention the profile tools
        assert (
            "update_profile_field" in prompt
            or "finalize_profile" in prompt
            or "profile_field" in prompt.lower()
        )

    def test_prompt_is_conversational(self) -> None:
        """Test that prompt encourages conversational interaction."""
        prompt = _get_onboarding_system_prompt()

        # Should encourage friendly conversation
        conversation_indicators = [
            "conversational",
            "friendly",
            "natural",
            "chat",
            "ask",
        ]
        assert any(indicator in prompt.lower() for indicator in conversation_indicators)


class TestCheckOnboardingCompletion:
    """Test suite for _check_onboarding_completion()."""

    def test_not_complete_when_not_started(self) -> None:
        """Test returns False when onboarding hasn't started."""
        session = Mock(spec=ConversationSession)
        session.context = {
            "mode": "onboarding",
            "onboarding_manager": ProfileOnboardingManager(),
        }

        result = _check_onboarding_completion(session)

        assert result is False

    def test_not_complete_when_collecting_core(self) -> None:
        """Test returns False when still collecting core fields."""
        manager = ProfileOnboardingManager()
        manager.start_onboarding()

        session = Mock(spec=ConversationSession)
        session.context = {"mode": "onboarding", "onboarding_manager": manager}

        result = _check_onboarding_completion(session)

        assert result is False

    def test_not_complete_when_profile_not_finalized(self, tmp_path: Path) -> None:
        """Test returns False when profile exists but not finalized."""
        manager = ProfileOnboardingManager()
        manager.start_onboarding()

        # Fill partial profile directly (tools would do this in practice)
        manager.partial_profile.name = "Test"
        manager.partial_profile.age = 35
        manager.partial_profile.gender = "Male"
        manager.partial_profile.weight_kg = 70.0
        manager.partial_profile.ftp = 265
        manager.partial_profile.max_hr = 186
        manager.partial_profile.training_experience = "intermediate"
        manager.partial_profile.training_availability_hours_per_week = 10.0
        manager.partial_profile.goals = ["Improve FTP", "Complete century ride"]

        session = Mock(spec=ConversationSession)
        session.context = {"mode": "onboarding", "onboarding_manager": manager}

        result = _check_onboarding_completion(session)

        # Should not be complete yet (needs finalization - profile_path)
        assert result is False

    def test_complete_when_profile_finalized(self, tmp_path: Path) -> None:
        """Test returns True when profile is finalized and file exists."""
        manager = ProfileOnboardingManager()
        manager.start_onboarding()

        # Create profile file manually (finalize_profile tool would do this)
        profile_path = tmp_path / "data" / "TestAthlete" / "athlete_profile.json"
        profile_path.parent.mkdir(parents=True)
        profile_path.write_text('{"name": "TestAthlete", "ftp": 265}')

        session = Mock(spec=ConversationSession)
        session.context = {
            "mode": "onboarding",
            "onboarding_manager": manager,
            "profile_path": str(profile_path),
        }

        result = _check_onboarding_completion(session)

        assert result is True

    def test_not_complete_when_file_missing(self) -> None:
        """Test returns False if profile_path in context but file doesn't exist."""
        manager = ProfileOnboardingManager()
        manager.start_onboarding()

        session = Mock(spec=ConversationSession)
        session.context = {
            "mode": "onboarding",
            "onboarding_manager": manager,
            "profile_path": "/nonexistent/profile.json",
        }

        result = _check_onboarding_completion(session)

        assert result is False

    def test_not_complete_in_normal_mode(self) -> None:
        """Test returns False if session is in normal mode."""
        session = Mock(spec=ConversationSession)
        session.context = {"mode": "normal", "profile_path": "/some/profile.json"}

        result = _check_onboarding_completion(session)

        assert result is False


class TestTransitionToNormalMode:
    """Test suite for _transition_to_normal_mode()."""

    def test_transitions_mode_to_normal(self, tmp_path: Path) -> None:
        """Test that mode is changed to 'normal'."""
        profile_path = tmp_path / "athlete_profile.json"
        profile_path.write_text('{"ftp": 265}')

        session = Mock(spec=ConversationSession)
        session.context = {
            "mode": "onboarding",
            "onboarding_manager": ProfileOnboardingManager(),
            "profile_path": str(profile_path),
        }

        _transition_to_normal_mode(session)

        assert session.context["mode"] == "normal"

    def test_removes_onboarding_manager(self, tmp_path: Path) -> None:
        """Test that onboarding_manager is removed from context."""
        profile_path = tmp_path / "athlete_profile.json"
        profile_path.write_text('{"ftp": 265}')

        manager = ProfileOnboardingManager()
        session = Mock(spec=ConversationSession)
        session.context = {
            "mode": "onboarding",
            "onboarding_manager": manager,
            "profile_path": str(profile_path),
        }

        _transition_to_normal_mode(session)

        assert "onboarding_manager" not in session.context

    def test_sets_athlete_profile_context(self, tmp_path: Path) -> None:
        """Test that athlete_profile is set in context."""
        profile_path = tmp_path / "athlete_profile.json"
        profile_path.write_text('{"ftp": 265}')

        session = Mock(spec=ConversationSession)
        session.context = {
            "mode": "onboarding",
            "profile_path": str(profile_path),
        }

        _transition_to_normal_mode(session)

        assert session.context["athlete_profile"] == str(profile_path)

    def test_preserves_profile_path(self, tmp_path: Path) -> None:
        """Test that profile_path remains in context."""
        profile_path = tmp_path / "athlete_profile.json"
        profile_path.write_text('{"ftp": 265}')

        session = Mock(spec=ConversationSession)
        session.context = {
            "mode": "onboarding",
            "profile_path": str(profile_path),
        }

        _transition_to_normal_mode(session)

        # profile_path should still be there
        assert session.context["profile_path"] == str(profile_path)

    def test_preserves_other_context_fields(self, tmp_path: Path) -> None:
        """Test that other context fields are preserved."""
        profile_path = tmp_path / "athlete_profile.json"
        profile_path.write_text('{"ftp": 265}')

        session = Mock(spec=ConversationSession)
        session.context = {
            "mode": "onboarding",
            "profile_path": str(profile_path),
            "data_dir": "/some/data",
            "custom_field": "value",
        }

        _transition_to_normal_mode(session)

        assert session.context["data_dir"] == "/some/data"
        assert session.context["custom_field"] == "value"

    def test_handles_missing_profile_path(self) -> None:
        """Test handles case where profile_path not in context."""
        session = Mock(spec=ConversationSession)
        session.context = {"mode": "onboarding"}

        _transition_to_normal_mode(session)

        # Should still transition mode
        assert session.context["mode"] == "normal"

        # athlete_profile should not be set
        assert "athlete_profile" not in session.context
