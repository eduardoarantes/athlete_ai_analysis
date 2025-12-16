"""Tests for plan Pydantic models."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from cycling_ai.api.models.plan import AthleteProfileData, TrainingPlanRequest


def test_athlete_profile_valid() -> None:
    """Test AthleteProfileData with valid data."""
    profile = AthleteProfileData(
        ftp=265,
        weight_kg=70,
        max_hr=186,
        age=35,
        goals=["Improve FTP"],
    )

    assert profile.ftp == 265
    assert profile.weight_kg == 70
    assert profile.age == 35


def test_athlete_profile_invalid_ftp() -> None:
    """Test AthleteProfileData rejects invalid FTP."""
    with pytest.raises(ValidationError) as exc_info:
        AthleteProfileData(
            ftp=-100,  # Invalid: must be positive
            weight_kg=70,
            age=35,
        )

    errors = exc_info.value.errors()
    assert any("ftp" in str(e) for e in errors)


def test_training_plan_request_valid() -> None:
    """Test TrainingPlanRequest with valid data."""
    request = TrainingPlanRequest(
        athlete_profile=AthleteProfileData(ftp=265, weight_kg=70, age=35),
        weeks=12,
        target_ftp=278,
    )

    assert request.weeks == 12
    assert request.target_ftp == 278


def test_training_plan_request_invalid_weeks() -> None:
    """Test TrainingPlanRequest rejects invalid weeks."""
    with pytest.raises(ValidationError) as exc_info:
        TrainingPlanRequest(
            athlete_profile=AthleteProfileData(ftp=265, weight_kg=70, age=35),
            weeks=100,  # Invalid: max is 24
        )

    errors = exc_info.value.errors()
    assert any("weeks" in str(e) for e in errors)
