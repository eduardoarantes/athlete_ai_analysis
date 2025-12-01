"""
Unit tests for profile onboarding infrastructure.

Tests the core state machine, data models, and validation logic for
conversational profile creation.
"""

from __future__ import annotations

from typing import Any

import pytest

from cycling_ai.orchestration.profile_onboarding import (
    OnboardingState,
    PartialProfile,
    ProfileOnboardingManager,
    validate_age,
    validate_ftp,
    validate_max_hr,
    validate_training_availability,
    validate_weight,
)


class TestValidationHelpers:
    """Test suite for validation helper functions."""

    # Age validation tests
    def test_validate_age_valid(self) -> None:
        """Test validate_age accepts valid age."""
        valid, error = validate_age(35)
        assert valid is True
        assert error == ""

    def test_validate_age_boundary_low(self) -> None:
        """Test validate_age accepts minimum valid age."""
        valid, error = validate_age(18)
        assert valid is True
        assert error == ""

    def test_validate_age_boundary_high(self) -> None:
        """Test validate_age accepts maximum valid age."""
        valid, error = validate_age(100)
        assert valid is True
        assert error == ""

    def test_validate_age_too_young(self) -> None:
        """Test validate_age rejects age below 18."""
        valid, error = validate_age(17)
        assert valid is False
        assert "18" in error

    def test_validate_age_too_old(self) -> None:
        """Test validate_age rejects age above 100."""
        valid, error = validate_age(101)
        assert valid is False
        assert "100" in error

    # Weight validation tests
    def test_validate_weight_valid(self) -> None:
        """Test validate_weight accepts valid weight."""
        valid, error = validate_weight(70.0)
        assert valid is True
        assert error == ""

    def test_validate_weight_boundary_low(self) -> None:
        """Test validate_weight accepts minimum valid weight."""
        valid, error = validate_weight(40.0)
        assert valid is True
        assert error == ""

    def test_validate_weight_boundary_high(self) -> None:
        """Test validate_weight accepts maximum valid weight."""
        valid, error = validate_weight(200.0)
        assert valid is True
        assert error == ""

    def test_validate_weight_too_light(self) -> None:
        """Test validate_weight rejects weight below 40kg."""
        valid, error = validate_weight(39.9)
        assert valid is False
        assert "40" in error

    def test_validate_weight_too_heavy(self) -> None:
        """Test validate_weight rejects weight above 200kg."""
        valid, error = validate_weight(200.1)
        assert valid is False
        assert "200" in error

    # FTP validation tests
    def test_validate_ftp_valid(self) -> None:
        """Test validate_ftp accepts valid FTP."""
        valid, error = validate_ftp(250)
        assert valid is True
        assert error == ""

    def test_validate_ftp_too_low(self) -> None:
        """Test validate_ftp rejects FTP below 50."""
        valid, error = validate_ftp(49)
        assert valid is False
        assert "50" in error

    def test_validate_ftp_too_high(self) -> None:
        """Test validate_ftp rejects FTP above 600."""
        valid, error = validate_ftp(601)
        assert valid is False
        assert "600" in error

    # Max HR validation tests
    def test_validate_max_hr_valid(self) -> None:
        """Test validate_max_hr accepts valid heart rate."""
        valid, error = validate_max_hr(185)
        assert valid is True
        assert error == ""

    def test_validate_max_hr_too_low(self) -> None:
        """Test validate_max_hr rejects HR below 100."""
        valid, error = validate_max_hr(99)
        assert valid is False
        assert "100" in error

    def test_validate_max_hr_too_high(self) -> None:
        """Test validate_max_hr rejects HR above 220."""
        valid, error = validate_max_hr(221)
        assert valid is False
        assert "220" in error

    # Training availability tests
    def test_validate_training_availability_valid(self) -> None:
        """Test validate_training_availability accepts valid hours."""
        valid, error = validate_training_availability(8.0)
        assert valid is True
        assert error == ""

    def test_validate_training_availability_too_low(self) -> None:
        """Test validate_training_availability rejects hours below 1."""
        valid, error = validate_training_availability(0.5)
        assert valid is False
        assert "1" in error

    def test_validate_training_availability_too_high(self) -> None:
        """Test validate_training_availability rejects hours above 40."""
        valid, error = validate_training_availability(41.0)
        assert valid is False
        assert "40" in error


class TestPartialProfile:
    """Test suite for PartialProfile dataclass."""

    def test_partial_profile_default_values(self) -> None:
        """Test PartialProfile initializes with None/empty defaults."""
        profile = PartialProfile()

        # All core fields should be None or empty
        assert profile.name is None
        assert profile.age is None
        assert profile.gender is None
        assert profile.weight_kg is None
        assert profile.ftp is None
        assert profile.max_hr is None
        assert profile.training_experience is None
        assert profile.training_availability_hours_per_week is None
        assert profile.goals == []

        # All optional fields should be None
        assert profile.target_event is None
        assert profile.previous_cycling_history is None
        assert profile.limitations is None

    def test_is_core_complete_empty(self) -> None:
        """Test is_core_complete returns False for empty profile."""
        profile = PartialProfile()
        assert profile.is_core_complete() is False

    def test_is_core_complete_partial(self) -> None:
        """Test is_core_complete returns False when only some fields filled."""
        profile = PartialProfile(
            name="Test User",
            age=35,
            gender="Male",
            weight_kg=70.0,
            ftp=250,
        )
        # Only 5 of 9 core fields filled
        assert profile.is_core_complete() is False

    def test_is_core_complete_missing_goals(self) -> None:
        """Test is_core_complete returns False when goals list is empty."""
        profile = PartialProfile(
            name="Test User",
            age=35,
            gender="Male",
            weight_kg=70.0,
            ftp=250,
            max_hr=185,
            training_experience="intermediate",
            training_availability_hours_per_week=8.0,
            # goals intentionally left empty
        )
        assert profile.is_core_complete() is False

    def test_is_core_complete_all_filled(self) -> None:
        """Test is_core_complete returns True when all core fields filled."""
        profile = PartialProfile(
            name="Test User",
            age=35,
            gender="Male",
            weight_kg=70.0,
            ftp=250,
            max_hr=185,
            training_experience="intermediate",
            training_availability_hours_per_week=8.0,
            goals=["Improve FTP", "Race"],
        )
        assert profile.is_core_complete() is True

    def test_get_completion_percentage_empty(self) -> None:
        """Test get_completion_percentage returns 0.0 for empty profile."""
        profile = PartialProfile()
        assert profile.get_completion_percentage() == 0.0

    def test_get_completion_percentage_one_field(self) -> None:
        """Test get_completion_percentage with one field filled."""
        profile = PartialProfile(name="Test User")
        # 1 of 9 fields = 0.111...
        assert abs(profile.get_completion_percentage() - (1 / 9)) < 0.001

    def test_get_completion_percentage_half(self) -> None:
        """Test get_completion_percentage with ~half fields filled."""
        profile = PartialProfile(
            name="Test User",
            age=35,
            gender="Male",
            weight_kg=70.0,
        )
        # 4 of 9 fields = 0.444...
        assert abs(profile.get_completion_percentage() - (4 / 9)) < 0.001

    def test_get_completion_percentage_complete(self) -> None:
        """Test get_completion_percentage returns 1.0 when complete."""
        profile = PartialProfile(
            name="Test User",
            age=35,
            gender="Male",
            weight_kg=70.0,
            ftp=250,
            max_hr=185,
            training_experience="intermediate",
            training_availability_hours_per_week=8.0,
            goals=["Improve FTP"],
        )
        assert profile.get_completion_percentage() == 1.0

    def test_to_dict_empty(self) -> None:
        """Test to_dict returns dict with None values for empty profile."""
        profile = PartialProfile()
        data = profile.to_dict()

        # Core fields should all be present (even if None)
        assert "name" in data
        assert "age" in data
        assert "goals" in data
        assert data["goals"] == []

        # Optional fields should not be in dict if None
        assert "target_event" not in data
        assert "previous_cycling_history" not in data
        assert "limitations" not in data

    def test_to_dict_with_core_data(self) -> None:
        """Test to_dict returns correct dict for profile with core data."""
        profile = PartialProfile(
            name="Test User",
            age=35,
            gender="Male",
            weight_kg=70.0,
            ftp=250,
            max_hr=185,
            training_experience="intermediate",
            training_availability_hours_per_week=8.0,
            goals=["Improve FTP", "Race"],
        )
        data = profile.to_dict()

        assert data["name"] == "Test User"
        assert data["age"] == 35
        assert data["gender"] == "Male"
        assert data["weight_kg"] == 70.0
        assert data["ftp"] == 250
        assert data["max_hr"] == 185
        assert data["training_experience"] == "intermediate"
        assert data["training_availability_hours_per_week"] == 8.0
        assert data["goals"] == ["Improve FTP", "Race"]

    def test_to_dict_with_optional_data(self) -> None:
        """Test to_dict includes optional fields when present."""
        profile = PartialProfile(
            name="Test User",
            age=35,
            goals=["Race"],
            target_event={"name": "Century Ride", "date": "2025-06-15"},
            previous_cycling_history="2 years recreational",
            limitations="Minor knee issue",
        )
        data = profile.to_dict()

        assert "target_event" in data
        assert data["target_event"]["name"] == "Century Ride"
        assert "previous_cycling_history" in data
        assert data["previous_cycling_history"] == "2 years recreational"
        assert "limitations" in data
        assert data["limitations"] == "Minor knee issue"

    def test_from_dict_empty(self) -> None:
        """Test from_dict creates empty profile from empty dict."""
        data: dict[str, Any] = {}
        profile = PartialProfile.from_dict(data)

        assert profile.name is None
        assert profile.age is None
        assert profile.goals == []

    def test_from_dict_with_data(self) -> None:
        """Test from_dict creates profile from populated dict."""
        data = {
            "name": "Test User",
            "age": 35,
            "gender": "Male",
            "weight_kg": 70.0,
            "ftp": 250,
            "max_hr": 185,
            "training_experience": "intermediate",
            "training_availability_hours_per_week": 8.0,
            "goals": ["Improve FTP", "Race"],
            "target_event": {"name": "Century Ride"},
        }
        profile = PartialProfile.from_dict(data)

        assert profile.name == "Test User"
        assert profile.age == 35
        assert profile.gender == "Male"
        assert profile.weight_kg == 70.0
        assert profile.ftp == 250
        assert profile.max_hr == 185
        assert profile.training_experience == "intermediate"
        assert profile.training_availability_hours_per_week == 8.0
        assert profile.goals == ["Improve FTP", "Race"]
        assert profile.target_event == {"name": "Century Ride"}

    def test_to_dict_from_dict_roundtrip(self) -> None:
        """Test to_dict and from_dict are inverses."""
        original = PartialProfile(
            name="Test User",
            age=35,
            gender="Male",
            weight_kg=70.0,
            ftp=250,
            max_hr=185,
            training_experience="intermediate",
            training_availability_hours_per_week=8.0,
            goals=["Improve FTP"],
            target_event={"name": "Race"},
        )

        # Convert to dict and back
        data = original.to_dict()
        restored = PartialProfile.from_dict(data)

        # All fields should match
        assert restored.name == original.name
        assert restored.age == original.age
        assert restored.gender == original.gender
        assert restored.weight_kg == original.weight_kg
        assert restored.ftp == original.ftp
        assert restored.max_hr == original.max_hr
        assert restored.training_experience == original.training_experience
        assert (
            restored.training_availability_hours_per_week
            == original.training_availability_hours_per_week
        )
        assert restored.goals == original.goals
        assert restored.target_event == original.target_event


class TestProfileOnboardingManager:
    """Test suite for ProfileOnboardingManager."""

    def test_initial_state(self) -> None:
        """Test manager initializes in NOT_STARTED state."""
        manager = ProfileOnboardingManager()
        assert manager.state == OnboardingState.NOT_STARTED
        assert manager.partial_profile is not None

    def test_start_onboarding(self) -> None:
        """Test start_onboarding transitions to COLLECTING_CORE."""
        manager = ProfileOnboardingManager()

        prompt = manager.start_onboarding()

        assert manager.state == OnboardingState.COLLECTING_CORE
        assert isinstance(prompt, str)
        assert len(prompt) > 0
        # Prompt should mention core fields
        assert "name" in prompt.lower()
        assert "age" in prompt.lower()
        assert "ftp" in prompt.lower()

    def test_should_continue_onboarding_not_started(self) -> None:
        """Test should_continue returns False in NOT_STARTED state."""
        manager = ProfileOnboardingManager()
        assert manager.should_continue_onboarding() is False

    def test_should_continue_onboarding_collecting_core(self) -> None:
        """Test should_continue returns True in COLLECTING_CORE state."""
        manager = ProfileOnboardingManager()
        manager.start_onboarding()
        assert manager.should_continue_onboarding() is True

    def test_should_continue_onboarding_completed(self) -> None:
        """Test should_continue returns False in COMPLETED state."""
        manager = ProfileOnboardingManager()
        manager.state = OnboardingState.COMPLETED
        assert manager.should_continue_onboarding() is False

    def test_should_continue_onboarding_intermediate_states(self) -> None:
        """Test should_continue returns True for all intermediate states."""
        manager = ProfileOnboardingManager()

        intermediate_states = [
            OnboardingState.COLLECTING_CORE,
            OnboardingState.COLLECTING_OPTIONAL,
            OnboardingState.REVIEWING,
            OnboardingState.CONFIRMED,
            OnboardingState.ESTIMATING_VALUES,
            OnboardingState.FINALIZING,
        ]

        for state in intermediate_states:
            manager.state = state
            assert manager.should_continue_onboarding() is True, f"Expected True for state {state}"

    def test_advance_to_optional(self) -> None:
        """Test advance_to_optional transitions to COLLECTING_OPTIONAL."""
        manager = ProfileOnboardingManager()

        prompt = manager.advance_to_optional()

        assert manager.state == OnboardingState.COLLECTING_OPTIONAL
        assert isinstance(prompt, str)
        assert len(prompt) > 0
        # Prompt should mention optional fields
        assert "optional" in prompt.lower()

    def test_advance_to_review_empty_profile(self) -> None:
        """Test advance_to_review with empty profile."""
        manager = ProfileOnboardingManager()

        prompt = manager.advance_to_review()

        assert manager.state == OnboardingState.REVIEWING
        assert isinstance(prompt, str)
        assert "summary" in prompt.lower()

    def test_advance_to_review_complete_profile(self) -> None:
        """Test advance_to_review with complete profile includes all data."""
        manager = ProfileOnboardingManager()
        manager.partial_profile = PartialProfile(
            name="Test User",
            age=35,
            gender="Male",
            weight_kg=70.0,
            ftp=250,
            max_hr=185,
            training_experience="intermediate",
            training_availability_hours_per_week=8.0,
            goals=["Improve FTP", "Race"],
        )

        prompt = manager.advance_to_review()

        assert manager.state == OnboardingState.REVIEWING
        # Summary should include all profile data
        assert "Test User" in prompt
        assert "35" in prompt
        assert "Male" in prompt
        assert "70" in prompt
        assert "250" in prompt
        assert "185" in prompt
        assert "intermediate" in prompt
        assert "8" in prompt
        assert "Improve FTP" in prompt

    def test_advance_to_review_with_optional_fields(self) -> None:
        """Test advance_to_review includes optional fields when present."""
        manager = ProfileOnboardingManager()
        manager.partial_profile = PartialProfile(
            name="Test User",
            age=35,
            goals=["Race"],
            target_event={"name": "Century Ride", "date": "2025-06-15"},
            previous_cycling_history="2 years recreational",
            limitations="Minor knee issue",
        )

        prompt = manager.advance_to_review()

        assert "Century Ride" in prompt
        assert "2 years recreational" in prompt
        assert "Minor knee issue" in prompt

    def test_confirm_profile(self) -> None:
        """Test confirm_profile transitions to CONFIRMED."""
        manager = ProfileOnboardingManager()

        manager.confirm_profile()

        assert manager.state == OnboardingState.CONFIRMED

    def test_advance_to_estimating(self) -> None:
        """Test advance_to_estimating transitions to ESTIMATING_VALUES."""
        manager = ProfileOnboardingManager()

        prompt = manager.advance_to_estimating()

        assert manager.state == OnboardingState.ESTIMATING_VALUES
        assert isinstance(prompt, str)

    def test_advance_to_finalizing(self) -> None:
        """Test advance_to_finalizing transitions to FINALIZING."""
        manager = ProfileOnboardingManager()

        prompt = manager.advance_to_finalizing()

        assert manager.state == OnboardingState.FINALIZING
        assert isinstance(prompt, str)

    def test_mark_completed(self) -> None:
        """Test mark_completed transitions to COMPLETED."""
        manager = ProfileOnboardingManager()

        manager.mark_completed()

        assert manager.state == OnboardingState.COMPLETED

    def test_get_completion_percentage_empty(self) -> None:
        """Test get_completion_percentage returns 0.0 for empty profile."""
        manager = ProfileOnboardingManager()

        percentage = manager.get_completion_percentage()

        assert percentage == 0.0

    def test_get_completion_percentage_partial(self) -> None:
        """Test get_completion_percentage returns correct value for partial profile."""
        manager = ProfileOnboardingManager()
        manager.partial_profile.name = "Test"
        manager.partial_profile.age = 35

        percentage = manager.get_completion_percentage()

        # 2 of 9 fields = 0.222...
        assert abs(percentage - (2 / 9)) < 0.001

    def test_get_completion_percentage_complete(self) -> None:
        """Test get_completion_percentage returns 1.0 for complete profile."""
        manager = ProfileOnboardingManager()
        manager.partial_profile = PartialProfile(
            name="Test User",
            age=35,
            gender="Male",
            weight_kg=70.0,
            ftp=250,
            max_hr=185,
            training_experience="intermediate",
            training_availability_hours_per_week=8.0,
            goals=["Race"],
        )

        percentage = manager.get_completion_percentage()

        assert percentage == 1.0

    def test_full_state_flow(self) -> None:
        """Test complete state machine flow from start to completion."""
        manager = ProfileOnboardingManager()

        # Start
        assert manager.state == OnboardingState.NOT_STARTED
        manager.start_onboarding()
        assert manager.state == OnboardingState.COLLECTING_CORE

        # Advance through states
        manager.advance_to_optional()
        assert manager.state == OnboardingState.COLLECTING_OPTIONAL

        manager.advance_to_review()
        assert manager.state == OnboardingState.REVIEWING

        manager.confirm_profile()
        assert manager.state == OnboardingState.CONFIRMED

        manager.advance_to_estimating()
        assert manager.state == OnboardingState.ESTIMATING_VALUES

        manager.advance_to_finalizing()
        assert manager.state == OnboardingState.FINALIZING

        manager.mark_completed()
        assert manager.state == OnboardingState.COMPLETED
