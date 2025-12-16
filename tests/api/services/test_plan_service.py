"""
Tests for Plan Service Layer.

Tests the service that wraps TrainingPlanTool for FastAPI integration.
"""
from __future__ import annotations

import json
import tempfile
from pathlib import Path
from typing import Any

import pytest

from cycling_ai.api.models.plan import TrainingPlanRequest
from cycling_ai.api.services.plan_service import PlanService
from cycling_ai.core.athlete import AthleteProfile

# Enable async testing with asyncio only
# Note: anyio_backends configured in pyproject.toml to use asyncio only
pytestmark = pytest.mark.anyio


@pytest.fixture
def athlete_profile_data() -> dict[str, Any]:
    """Create test athlete profile data for API requests."""
    return {
        "ftp": 265,
        "weight_kg": 70,
        "max_hr": 186,
        "age": 35,
        "goals": ["Improve FTP"],
        "training_availability": {
            "hours_per_week": 7,
            "week_days": "Monday, Wednesday, Friday, Saturday, Sunday",
        },
    }


@pytest.fixture
def athlete_profile_file_data() -> dict[str, Any]:
    """Create test athlete profile data for JSON file format."""
    return {
        "name": "Test Athlete",
        "age": 35,
        "weight": "70kg",
        "FTP": "265w",
        "critical_HR": 186,
        "gender": "male",
        "training_availability": {
            "hours_per_week": 7,
            "week_days": "Monday, Wednesday, Friday, Saturday, Sunday",
        },
        "goals": "Improve FTP",
        "current_training_status": "intermediate",
        "raw_training_data_path": "/tmp/test_data",
    }


@pytest.fixture
def athlete_profile_file(athlete_profile_file_data: dict[str, Any]) -> Path:
    """Create temporary athlete profile JSON file."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(athlete_profile_file_data, f)
        return Path(f.name)


@pytest.fixture
def plan_service() -> PlanService:
    """Create PlanService instance."""
    return PlanService()


def test_plan_service_initialization(plan_service: PlanService) -> None:
    """Test that PlanService initializes correctly."""
    assert plan_service is not None
    assert hasattr(plan_service, "tool")


async def test_generate_plan_success(
    plan_service: PlanService,
    athlete_profile_file: Path,
    athlete_profile_data: dict[str, Any],
) -> None:
    """Test successful plan generation."""
    from cycling_ai.api.models.plan import AthleteProfileData

    # Create request
    request = TrainingPlanRequest(
        athlete_profile=AthleteProfileData(**athlete_profile_data),
        weeks=12,
        target_ftp=278,
    )

    # Generate plan
    result = await plan_service.generate_plan(
        request=request,
        athlete_profile_path=athlete_profile_file,
    )

    # Verify result structure
    assert result is not None
    assert "training_plan" in result

    # Verify training plan contents
    plan = result["training_plan"]
    assert "plan_metadata" in plan
    assert plan["plan_metadata"]["total_weeks"] == 12
    assert plan["plan_metadata"]["target_ftp"] == 278
    assert plan["plan_metadata"]["current_ftp"] == 265
    assert "weekly_plan" in plan
    assert isinstance(plan["weekly_plan"], list)
    assert len(plan["weekly_plan"]) == 12
    assert "athlete_profile" in plan


async def test_generate_plan_missing_profile_file(
    plan_service: PlanService,
    athlete_profile_data: dict[str, Any],
) -> None:
    """Test plan generation with missing profile file."""
    from cycling_ai.api.models.plan import AthleteProfileData

    # Create request
    request = TrainingPlanRequest(
        athlete_profile=AthleteProfileData(**athlete_profile_data),
        weeks=12,
        target_ftp=278,
    )

    # Use non-existent file path
    non_existent_path = Path("/tmp/non_existent_profile.json")

    # Should raise ValueError or return error
    with pytest.raises(ValueError) as exc_info:
        await plan_service.generate_plan(
            request=request,
            athlete_profile_path=non_existent_path,
        )

    assert "not found" in str(exc_info.value).lower()


async def test_generate_plan_invalid_weeks(
    plan_service: PlanService,
    athlete_profile_file: Path,
    athlete_profile_data: dict[str, Any],
) -> None:
    """Test plan generation with invalid weeks parameter."""
    from cycling_ai.api.models.plan import AthleteProfileData

    # Request with invalid weeks (should be caught by Pydantic validation)
    with pytest.raises(ValueError):
        TrainingPlanRequest(
            athlete_profile=AthleteProfileData(**athlete_profile_data),
            weeks=100,  # Invalid: max is 24
            target_ftp=278,
        )


async def test_generate_plan_default_target_ftp(
    plan_service: PlanService,
    athlete_profile_file: Path,
    athlete_profile_data: dict[str, Any],
) -> None:
    """Test plan generation without explicit target FTP."""
    from cycling_ai.api.models.plan import AthleteProfileData

    # Create request without target_ftp
    request = TrainingPlanRequest(
        athlete_profile=AthleteProfileData(**athlete_profile_data),
        weeks=8,
        target_ftp=None,  # Use default (current FTP * 1.05)
    )

    # Generate plan
    result = await plan_service.generate_plan(
        request=request,
        athlete_profile_path=athlete_profile_file,
    )

    # Verify result
    assert result is not None
    assert "training_plan" in result
    plan = result["training_plan"]
    assert plan["plan_metadata"]["total_weeks"] == 8

    # Target FTP should be calculated (current FTP * 1.05 = 265 * 1.05 = 278.25)
    assert plan["plan_metadata"]["target_ftp"] > plan["plan_metadata"]["current_ftp"]


def test_convert_profile_to_json_format(
    plan_service: PlanService,
    athlete_profile_data: dict[str, Any],
) -> None:
    """Test conversion of AthleteProfileData to JSON format."""
    from cycling_ai.api.models.plan import AthleteProfileData

    profile = AthleteProfileData(**athlete_profile_data)

    # Convert to dict
    profile_dict = plan_service._profile_to_dict(profile)

    # Verify structure matches expected format
    assert profile_dict["ftp"] == 265
    assert profile_dict["weight_kg"] == 70
    assert profile_dict["max_hr"] == 186
    assert profile_dict["age"] == 35
    assert profile_dict["goals"] == ["Improve FTP"]
    assert "training_availability" in profile_dict
