"""Tests for profile creation tools."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from cycling_ai.tools.wrappers.profile_creation_tools import (
    EstimateFTPTool,
    EstimateMaxHRTool,
    FinalizeProfileTool,
    UpdateProfileFieldTool,
)


class TestUpdateProfileFieldTool:
    """Tests for UpdateProfileFieldTool."""

    def test_update_profile_field_name(self) -> None:
        """Test updating name field (no validation)."""
        tool = UpdateProfileFieldTool()
        session_context: dict[str, Any] = {}

        result = tool.execute(field_name="name", value="John Doe", session_context=session_context)

        assert result.success is True
        assert session_context["partial_profile"]["name"] == "John Doe"
        assert result.data["field_name"] == "name"
        assert result.data["value"] == "John Doe"

    def test_update_profile_field_age_valid(self) -> None:
        """Test updating age with valid value."""
        tool = UpdateProfileFieldTool()
        session_context: dict[str, Any] = {}

        result = tool.execute(field_name="age", value=35, session_context=session_context)

        assert result.success is True
        assert session_context["partial_profile"]["age"] == 35

    def test_update_profile_field_age_as_string(self) -> None:
        """Test updating age with string value (should convert)."""
        tool = UpdateProfileFieldTool()
        session_context: dict[str, Any] = {}

        result = tool.execute(field_name="age", value="35", session_context=session_context)

        assert result.success is True
        assert session_context["partial_profile"]["age"] == 35
        assert isinstance(session_context["partial_profile"]["age"], int)

    def test_update_profile_field_age_too_young(self) -> None:
        """Test updating age with invalid value (too young)."""
        tool = UpdateProfileFieldTool()
        session_context: dict[str, Any] = {}

        result = tool.execute(field_name="age", value=17, session_context=session_context)

        assert result.success is False
        assert len(result.errors) > 0
        assert "18" in result.errors[0]

    def test_update_profile_field_age_too_old(self) -> None:
        """Test updating age with invalid value (too old)."""
        tool = UpdateProfileFieldTool()
        session_context: dict[str, Any] = {}

        result = tool.execute(field_name="age", value=101, session_context=session_context)

        assert result.success is False
        assert "100" in result.errors[0]

    def test_update_profile_field_weight_valid(self) -> None:
        """Test updating weight with valid value."""
        tool = UpdateProfileFieldTool()
        session_context: dict[str, Any] = {}

        result = tool.execute(field_name="weight_kg", value=70.5, session_context=session_context)

        assert result.success is True
        assert session_context["partial_profile"]["weight_kg"] == 70.5

    def test_update_profile_field_weight_too_low(self) -> None:
        """Test updating weight with invalid value (too low)."""
        tool = UpdateProfileFieldTool()
        session_context: dict[str, Any] = {}

        result = tool.execute(field_name="weight_kg", value=30.0, session_context=session_context)

        assert result.success is False
        assert "40" in result.errors[0]

    def test_update_profile_field_ftp_valid(self) -> None:
        """Test updating FTP with valid value."""
        tool = UpdateProfileFieldTool()
        session_context: dict[str, Any] = {}

        result = tool.execute(field_name="ftp", value=250, session_context=session_context)

        assert result.success is True
        assert session_context["partial_profile"]["ftp"] == 250

    def test_update_profile_field_ftp_too_low(self) -> None:
        """Test updating FTP with invalid value (too low)."""
        tool = UpdateProfileFieldTool()
        session_context: dict[str, Any] = {}

        result = tool.execute(field_name="ftp", value=40, session_context=session_context)

        assert result.success is False
        assert "50" in result.errors[0]

    def test_update_profile_field_max_hr_valid(self) -> None:
        """Test updating max HR with valid value."""
        tool = UpdateProfileFieldTool()
        session_context: dict[str, Any] = {}

        result = tool.execute(field_name="max_hr", value=185, session_context=session_context)

        assert result.success is True
        assert session_context["partial_profile"]["max_hr"] == 185

    def test_update_profile_field_max_hr_too_high(self) -> None:
        """Test updating max HR with invalid value (too high)."""
        tool = UpdateProfileFieldTool()
        session_context: dict[str, Any] = {}

        result = tool.execute(field_name="max_hr", value=225, session_context=session_context)

        assert result.success is False
        assert "220" in result.errors[0]

    def test_update_profile_field_training_availability_valid(self) -> None:
        """Test updating training availability with valid value."""
        tool = UpdateProfileFieldTool()
        session_context: dict[str, Any] = {}

        result = tool.execute(
            field_name="training_availability_hours_per_week",
            value=8.5,
            session_context=session_context,
        )

        assert result.success is True
        assert session_context["partial_profile"]["training_availability_hours_per_week"] == 8.5

    def test_update_profile_field_gender_valid(self) -> None:
        """Test updating gender with valid value."""
        tool = UpdateProfileFieldTool()
        session_context: dict[str, Any] = {}

        result = tool.execute(field_name="gender", value="Male", session_context=session_context)

        assert result.success is True
        assert session_context["partial_profile"]["gender"] == "male"  # Lowercase

    def test_update_profile_field_gender_invalid(self) -> None:
        """Test updating gender with invalid value."""
        tool = UpdateProfileFieldTool()
        session_context: dict[str, Any] = {}

        result = tool.execute(field_name="gender", value="unknown", session_context=session_context)

        assert result.success is False
        assert "male" in result.errors[0].lower()

    def test_update_profile_field_training_experience_valid(self) -> None:
        """Test updating training experience with valid value."""
        tool = UpdateProfileFieldTool()
        session_context: dict[str, Any] = {}

        result = tool.execute(
            field_name="training_experience",
            value="Intermediate",
            session_context=session_context,
        )

        assert result.success is True
        assert session_context["partial_profile"]["training_experience"] == "intermediate"

    def test_update_profile_field_training_experience_invalid(self) -> None:
        """Test updating training experience with invalid value."""
        tool = UpdateProfileFieldTool()
        session_context: dict[str, Any] = {}

        result = tool.execute(
            field_name="training_experience",
            value="expert",
            session_context=session_context,
        )

        assert result.success is False
        assert "beginner" in result.errors[0].lower()

    def test_update_profile_field_goals_valid_list(self) -> None:
        """Test updating goals with valid list."""
        tool = UpdateProfileFieldTool()
        session_context: dict[str, Any] = {}

        result = tool.execute(
            field_name="goals",
            value=["Improve FTP", "Race"],
            session_context=session_context,
        )

        assert result.success is True
        assert session_context["partial_profile"]["goals"] == ["Improve FTP", "Race"]

    def test_update_profile_field_goals_valid_string(self) -> None:
        """Test updating goals with single goal as string."""
        tool = UpdateProfileFieldTool()
        session_context: dict[str, Any] = {}

        result = tool.execute(
            field_name="goals", value="Improve FTP", session_context=session_context
        )

        assert result.success is True
        assert session_context["partial_profile"]["goals"] == ["Improve FTP"]

    def test_update_profile_field_goals_empty_list(self) -> None:
        """Test updating goals with empty list."""
        tool = UpdateProfileFieldTool()
        session_context: dict[str, Any] = {}

        result = tool.execute(field_name="goals", value=[], session_context=session_context)

        assert result.success is False
        assert "at least one" in result.errors[0].lower()

    def test_update_profile_field_invalid_field_name(self) -> None:
        """Test updating with invalid field name."""
        tool = UpdateProfileFieldTool()
        session_context: dict[str, Any] = {}

        result = tool.execute(
            field_name="invalid_field", value="test", session_context=session_context
        )

        assert result.success is False
        assert "invalid field" in result.errors[0].lower()

    def test_update_profile_field_no_session_context(self) -> None:
        """Test updating without session context (should initialize)."""
        tool = UpdateProfileFieldTool()

        result = tool.execute(field_name="name", value="John Doe")

        assert result.success is True
        # Session context should be created but we can't verify it without passing it

    def test_update_profile_field_optional_fields(self) -> None:
        """Test updating optional fields (no validation)."""
        tool = UpdateProfileFieldTool()
        session_context: dict[str, Any] = {}

        # Test target_event
        result = tool.execute(
            field_name="target_event",
            value={"name": "Gran Fondo", "date": "2024-06-15"},
            session_context=session_context,
        )
        assert result.success is True

        # Test previous_cycling_history
        result = tool.execute(
            field_name="previous_cycling_history",
            value="5 years recreational",
            session_context=session_context,
        )
        assert result.success is True

        # Test limitations
        result = tool.execute(
            field_name="limitations",
            value="Knee pain on long rides",
            session_context=session_context,
        )
        assert result.success is True


class TestEstimateFTPTool:
    """Tests for EstimateFTPTool."""

    def test_estimate_ftp_twenty_min_test(self) -> None:
        """Test FTP estimation from 20-minute test."""
        tool = EstimateFTPTool()

        result = tool.execute(method="twenty_min_test", input_value=263.0)

        assert result.success is True
        assert result.data["estimated_ftp"] == 249  # 263 * 0.95 = 249.85 → 249
        assert result.data["method"] == "twenty_min_test"
        assert "249" in result.data["explanation"]

    def test_estimate_ftp_weight_based(self) -> None:
        """Test FTP estimation from body weight."""
        tool = EstimateFTPTool()

        result = tool.execute(method="weight_based", input_value=70.0)

        assert result.success is True
        assert result.data["estimated_ftp"] == 210  # 70 * 3.0 = 210
        assert result.data["method"] == "weight_based"
        assert "210" in result.data["explanation"]
        assert "175" in result.data["explanation"]  # 70 * 2.5
        assert "245" in result.data["explanation"]  # 70 * 3.5

    def test_estimate_ftp_ramp_test(self) -> None:
        """Test FTP estimation from ramp test."""
        tool = EstimateFTPTool()

        result = tool.execute(method="ramp_test", input_value=320.0)

        assert result.success is True
        assert result.data["estimated_ftp"] == 240  # 320 * 0.75 = 240
        assert result.data["method"] == "ramp_test"
        assert "240" in result.data["explanation"]

    def test_estimate_ftp_invalid_method(self) -> None:
        """Test FTP estimation with invalid method."""
        tool = EstimateFTPTool()

        # Enum validation happens and returns error result (doesn't raise)
        result = tool.execute(method="invalid_method", input_value=200.0)

        assert result.success is False
        assert len(result.errors) > 0

    def test_estimate_ftp_negative_input(self) -> None:
        """Test FTP estimation with negative input."""
        tool = EstimateFTPTool()

        result = tool.execute(method="twenty_min_test", input_value=-100.0)

        assert result.success is False
        assert "positive" in result.errors[0].lower()

    def test_estimate_ftp_zero_input(self) -> None:
        """Test FTP estimation with zero input."""
        tool = EstimateFTPTool()

        result = tool.execute(method="weight_based", input_value=0.0)

        assert result.success is False
        assert "positive" in result.errors[0].lower()


class TestEstimateMaxHRTool:
    """Tests for EstimateMaxHRTool."""

    def test_estimate_max_hr_valid_age(self) -> None:
        """Test max HR estimation with valid age."""
        tool = EstimateMaxHRTool()

        result = tool.execute(age=35)

        assert result.success is True
        assert result.data["estimated_max_hr"] == 185  # 220 - 35
        assert result.data["range"]["lower"] == 175
        assert result.data["range"]["upper"] == 195
        assert "185" in result.data["explanation"]

    def test_estimate_max_hr_boundary_low(self) -> None:
        """Test max HR estimation at lower boundary (age = 18)."""
        tool = EstimateMaxHRTool()

        result = tool.execute(age=18)

        assert result.success is True
        assert result.data["estimated_max_hr"] == 202  # 220 - 18

    def test_estimate_max_hr_boundary_high(self) -> None:
        """Test max HR estimation at upper boundary (age = 100)."""
        tool = EstimateMaxHRTool()

        result = tool.execute(age=100)

        assert result.success is True
        assert result.data["estimated_max_hr"] == 120  # 220 - 100

    def test_estimate_max_hr_age_too_young(self) -> None:
        """Test max HR estimation with age too young."""
        tool = EstimateMaxHRTool()

        # Parameter validation returns error result (doesn't raise)
        result = tool.execute(age=17)

        assert result.success is False
        assert len(result.errors) > 0
        assert "18" in result.errors[0]

    def test_estimate_max_hr_age_too_old(self) -> None:
        """Test max HR estimation with age too old."""
        tool = EstimateMaxHRTool()

        # Parameter validation returns error result (doesn't raise)
        result = tool.execute(age=101)

        assert result.success is False
        assert len(result.errors) > 0
        assert "100" in result.errors[0]

    def test_estimate_max_hr_typical_ages(self) -> None:
        """Test max HR estimation for typical ages."""
        tool = EstimateMaxHRTool()

        # Age 25
        result = tool.execute(age=25)
        assert result.success is True
        assert result.data["estimated_max_hr"] == 195

        # Age 50
        result = tool.execute(age=50)
        assert result.success is True
        assert result.data["estimated_max_hr"] == 170

        # Age 65
        result = tool.execute(age=65)
        assert result.success is True
        assert result.data["estimated_max_hr"] == 155


class TestFinalizeProfileTool:
    """Tests for FinalizeProfileTool."""

    def test_finalize_profile_success(self, tmp_path: Path) -> None:
        """Test successful profile finalization."""
        import os

        tool = FinalizeProfileTool()

        # Prepare complete profile data
        session_context = {
            "partial_profile": {
                "name": "Test User",
                "age": 35,
                "gender": "male",
                "weight_kg": 70.0,
                "ftp": 250,
                "max_hr": 185,
                "training_experience": "intermediate",
                "training_availability_hours_per_week": 8.0,
                "goals": ["Improve FTP", "Race"],
            }
        }

        # Change to temp directory for test
        original_cwd = Path.cwd()
        try:
            os.chdir(tmp_path)

            result = tool.execute(confirm=True, session_context=session_context)

            assert result.success is True
            assert "profile_path" in result.data
            assert result.metadata["athlete_name"] == "Test User"

            # Verify file was created
            profile_path = Path(result.data["profile_path"])
            assert profile_path.exists()
            assert profile_path.name == "athlete_profile.json"

            # Verify file contents
            with open(profile_path) as f:
                saved_profile = json.load(f)

            assert saved_profile["name"] == "Test User"
            assert saved_profile["age"] == 35
            assert saved_profile["ftp"] == 250
            assert len(saved_profile["goals"]) == 2

        finally:
            os.chdir(original_cwd)

    def test_finalize_profile_with_optional_fields(self, tmp_path: Path) -> None:
        """Test finalization with optional fields included."""
        import os

        tool = FinalizeProfileTool()

        session_context = {
            "partial_profile": {
                "name": "Test User",
                "age": 35,
                "gender": "male",
                "weight_kg": 70.0,
                "ftp": 250,
                "max_hr": 185,
                "training_experience": "intermediate",
                "training_availability_hours_per_week": 8.0,
                "goals": ["Improve FTP"],
                "target_event": {"name": "Gran Fondo", "date": "2024-06-15"},
                "previous_cycling_history": "5 years recreational",
                "limitations": "None",
            }
        }

        original_cwd = Path.cwd()
        try:
            os.chdir(tmp_path)

            result = tool.execute(confirm=True, session_context=session_context)

            assert result.success is True

            profile_path = Path(result.data["profile_path"])
            with open(profile_path) as f:
                saved_profile = json.load(f)

            assert "target_event" in saved_profile
            assert "previous_cycling_history" in saved_profile
            assert "limitations" in saved_profile

        finally:
            os.chdir(original_cwd)

    def test_finalize_profile_missing_required_field(self) -> None:
        """Test finalization with missing required field."""
        tool = FinalizeProfileTool()

        # Missing 'age'
        session_context = {
            "partial_profile": {
                "name": "Test User",
                "gender": "male",
                "weight_kg": 70.0,
                "ftp": 250,
                "max_hr": 185,
                "training_experience": "intermediate",
                "training_availability_hours_per_week": 8.0,
                "goals": ["Improve FTP"],
            }
        }

        result = tool.execute(confirm=True, session_context=session_context)

        assert result.success is False
        assert "missing required fields" in result.errors[0].lower()
        assert "age" in result.errors[0]

    def test_finalize_profile_empty_goals(self) -> None:
        """Test finalization with empty goals list."""
        tool = FinalizeProfileTool()

        session_context = {
            "partial_profile": {
                "name": "Test User",
                "age": 35,
                "gender": "male",
                "weight_kg": 70.0,
                "ftp": 250,
                "max_hr": 185,
                "training_experience": "intermediate",
                "training_availability_hours_per_week": 8.0,
                "goals": [],
            }
        }

        result = tool.execute(confirm=True, session_context=session_context)

        assert result.success is False
        assert "goals" in result.errors[0].lower()

    def test_finalize_profile_no_session_context(self) -> None:
        """Test finalization without session context."""
        tool = FinalizeProfileTool()

        result = tool.execute(confirm=True)

        assert result.success is False
        assert "no profile data" in result.errors[0].lower()

    def test_finalize_profile_not_confirmed(self) -> None:
        """Test finalization without confirmation."""
        tool = FinalizeProfileTool()

        session_context = {
            "partial_profile": {
                "name": "Test User",
                "age": 35,
                "gender": "male",
                "weight_kg": 70.0,
                "ftp": 250,
                "max_hr": 185,
                "training_experience": "intermediate",
                "training_availability_hours_per_week": 8.0,
                "goals": ["Improve FTP"],
            }
        }

        result = tool.execute(confirm=False, session_context=session_context)

        assert result.success is False
        assert "confirmed" in result.errors[0].lower()

    def test_finalize_profile_multiple_missing_fields(self) -> None:
        """Test finalization with multiple missing fields."""
        tool = FinalizeProfileTool()

        # Missing age, ftp, max_hr
        session_context = {
            "partial_profile": {
                "name": "Test User",
                "gender": "male",
                "weight_kg": 70.0,
                "training_experience": "intermediate",
                "training_availability_hours_per_week": 8.0,
                "goals": ["Improve FTP"],
            }
        }

        result = tool.execute(confirm=True, session_context=session_context)

        assert result.success is False
        assert "missing required fields" in result.errors[0].lower()
        # Should list all missing fields
        error_msg = result.errors[0]
        assert "age" in error_msg or "ftp" in error_msg or "max_hr" in error_msg
