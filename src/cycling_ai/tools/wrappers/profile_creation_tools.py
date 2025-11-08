"""
Profile creation tools for conversational onboarding.

This module provides MCP-style tools that enable conversational profile creation
in the cycling-ai chat application. These tools work with the ProfileOnboardingManager
to collect, validate, estimate, and finalize athlete profile data.

Tools:
    - UpdateProfileFieldTool: Update individual profile fields with validation
    - EstimateFTPTool: Estimate FTP using 3 different methods
    - EstimateMaxHRTool: Estimate max heart rate from age
    - FinalizeProfileTool: Validate complete profile and save to JSON
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from cycling_ai.orchestration.profile_onboarding import (
    validate_age,
    validate_ftp,
    validate_max_hr,
    validate_training_availability,
    validate_weight,
)
from cycling_ai.tools.base import (
    BaseTool,
    ToolDefinition,
    ToolExecutionResult,
    ToolParameter,
)
from cycling_ai.tools.registry import register_tool


class UpdateProfileFieldTool(BaseTool):
    """
    Tool for updating individual profile fields during conversational onboarding.

    Validates input based on field type and stores in session context. Supports
    all 12 profile fields (9 core required + 3 optional enrichment).
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="update_profile_field",
            description=(
                "Update a field in the athlete profile being created. Validates input "
                "and stores in session state. Use this after collecting each piece of "
                "information from the user. Supports 12 fields: name, age, gender, "
                "weight_kg, ftp, max_hr, training_experience, "
                "training_availability_hours_per_week, goals, target_event, "
                "previous_cycling_history, limitations."
            ),
            category="data_prep",
            parameters=[
                ToolParameter(
                    name="field_name",
                    type="string",
                    description=(
                        "Name of the field to update. Valid fields: name, age, gender, "
                        "weight_kg, ftp, max_hr, training_experience, "
                        "training_availability_hours_per_week, goals, target_event, "
                        "previous_cycling_history, limitations"
                    ),
                    required=True,
                ),
                ToolParameter(
                    name="value",
                    type="string",  # Can be converted to correct type
                    description="Value to set for the field",
                    required=True,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": "Confirmation with field_name and value",
            },
            version="1.0.0",
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute profile field update.

        Args:
            **kwargs: Tool parameters (field_name, value, session_context)

        Returns:
            ToolExecutionResult with updated field confirmation or errors
        """
        try:
            # Validate parameters
            self.validate_parameters(**kwargs)

            field_name = kwargs["field_name"]
            value = kwargs["value"]
            session_context = kwargs.get("session_context", {})

            # Initialize session context if needed
            if "partial_profile" not in session_context:
                session_context["partial_profile"] = {}

            # Validate field name
            valid_fields = {
                "name",
                "age",
                "gender",
                "weight_kg",
                "ftp",
                "max_hr",
                "training_experience",
                "training_availability_hours_per_week",
                "goals",
                "target_event",
                "previous_cycling_history",
                "limitations",
            }

            if field_name not in valid_fields:
                valid_list = ", ".join(sorted(valid_fields))
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Invalid field name '{field_name}'. Valid fields: {valid_list}"],
                )

            # Validate and convert value based on field type
            try:
                validated_value = self._validate_field_value(field_name, value)
            except ValueError as e:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[str(e)],
                )

            # Store in session context
            session_context["partial_profile"][field_name] = validated_value

            return ToolExecutionResult(
                success=True,
                data={"field_name": field_name, "value": validated_value},
                format="json",
                metadata={
                    "message": f"Updated {field_name}",
                    "context_updates": {
                        "partial_profile": session_context["partial_profile"]
                    },
                },
            )

        except ValueError as e:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Parameter validation error: {str(e)}"],
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Unexpected error: {str(e)}"],
            )

    def _validate_field_value(self, field_name: str, value: Any) -> Any:
        """
        Validate and convert field value based on field type.

        Args:
            field_name: Name of the field
            value: Value to validate

        Returns:
            Validated and converted value

        Raises:
            ValueError: If validation fails
        """
        # Age validation
        if field_name == "age":
            try:
                age_val = int(value)
            except (TypeError, ValueError):
                raise ValueError(f"Age must be a whole number, got: {value}") from None
            is_valid, error_msg = validate_age(age_val)
            if not is_valid:
                raise ValueError(error_msg)
            return age_val

        # Weight validation
        if field_name == "weight_kg":
            try:
                weight_val = float(value)
            except (TypeError, ValueError):
                raise ValueError(f"Weight must be a number, got: {value}") from None
            is_valid, error_msg = validate_weight(weight_val)
            if not is_valid:
                raise ValueError(error_msg)
            return weight_val

        # FTP validation
        if field_name == "ftp":
            try:
                ftp_val = int(value)
            except (TypeError, ValueError):
                raise ValueError(f"FTP must be a whole number, got: {value}") from None
            is_valid, error_msg = validate_ftp(ftp_val)
            if not is_valid:
                raise ValueError(error_msg)
            return ftp_val

        # Max HR validation
        if field_name == "max_hr":
            try:
                max_hr_val = int(value)
            except (TypeError, ValueError):
                raise ValueError(
                    f"Maximum heart rate must be a whole number, got: {value}"
                ) from None
            is_valid, error_msg = validate_max_hr(max_hr_val)
            if not is_valid:
                raise ValueError(error_msg)
            return max_hr_val

        # Training availability validation
        if field_name == "training_availability_hours_per_week":
            try:
                hours_val = float(value)
            except (TypeError, ValueError):
                raise ValueError(f"Training availability must be a number, got: {value}") from None
            is_valid, error_msg = validate_training_availability(hours_val)
            if not is_valid:
                raise ValueError(error_msg)
            return hours_val

        # Gender validation
        if field_name == "gender":
            valid_genders = {"male", "female", "other"}
            gender_lower = str(value).lower()
            if gender_lower not in valid_genders:
                raise ValueError(f"Gender must be one of {valid_genders}, got: {value}")
            return gender_lower

        # Training experience validation
        if field_name == "training_experience":
            valid_levels = {"beginner", "intermediate", "advanced"}
            exp_lower = str(value).lower()
            if exp_lower not in valid_levels:
                raise ValueError(f"Training experience must be one of {valid_levels}, got: {value}")
            return exp_lower

        # Goals validation (must be list with at least 1 item)
        if field_name == "goals":
            if isinstance(value, str):
                # Single goal as string - convert to list
                if not value.strip():
                    raise ValueError("Goals list cannot be empty")
                return [value.strip()]
            elif isinstance(value, list):
                if len(value) == 0:
                    raise ValueError("Goals list must contain at least one goal")
                return value
            else:
                raise ValueError(f"Goals must be a string or list, got: {type(value)}")

        # Name, target_event, previous_cycling_history, limitations - no validation
        return value


class EstimateFTPTool(BaseTool):
    """
    Tool for estimating FTP using one of three proven methods.

    Methods:
        - twenty_min_test: FTP = 0.95 × 20min avg power
        - weight_based: FTP = weight_kg × 2.5-3.5
        - ramp_test: FTP = max_power × 0.75
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="estimate_ftp",
            description=(
                "Estimate Functional Threshold Power (FTP) using one of three methods: "
                "twenty_min_test (FTP = 0.95 × 20min avg power), "
                "weight_based (FTP = weight_kg × 2.5-3.5), or "
                "ramp_test (FTP = max_power × 0.75)"
            ),
            category="analysis",
            parameters=[
                ToolParameter(
                    name="method",
                    type="string",
                    description="Estimation method to use",
                    required=True,
                    enum=["twenty_min_test", "weight_based", "ramp_test"],
                ),
                ToolParameter(
                    name="input_value",
                    type="number",
                    description=(
                        "Input value for calculation: "
                        "twenty_min_test: 20-minute average power in watts, "
                        "weight_based: body weight in kg, "
                        "ramp_test: maximum power reached in watts"
                    ),
                    required=True,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": "Estimated FTP with method and explanation",
            },
            version="1.0.0",
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute FTP estimation.

        Args:
            **kwargs: Tool parameters (method, input_value)

        Returns:
            ToolExecutionResult with estimated FTP or errors
        """
        try:
            # Validate parameters
            self.validate_parameters(**kwargs)

            method = kwargs["method"]
            input_value = float(kwargs["input_value"])

            if input_value <= 0:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=["Input value must be positive"],
                )

            # Calculate FTP based on method
            if method == "twenty_min_test":
                estimated_ftp = int(input_value * 0.95)
                explanation = (
                    f"FTP = {input_value}W × 0.95 = {estimated_ftp}W\n"
                    f"The 20-minute test assumes FTP is 95% of your 20-minute best effort."
                )

            elif method == "weight_based":
                low = int(input_value * 2.5)
                mid = int(input_value * 3.0)
                high = int(input_value * 3.5)
                estimated_ftp = mid
                explanation = (
                    f"Weight-based FTP estimation for {input_value}kg:\n"
                    f"Conservative (2.5 W/kg): {low}W\n"
                    f"Average (3.0 W/kg): {mid}W\n"
                    f"Strong (3.5 W/kg): {high}W\n"
                    f"Using average: {estimated_ftp}W"
                )

            elif method == "ramp_test":
                estimated_ftp = int(input_value * 0.75)
                explanation = (
                    f"FTP = {input_value}W × 0.75 = {estimated_ftp}W\n"
                    f"The ramp test assumes FTP is 75% of your maximum 1-minute power."
                )

            else:
                # Should not reach here due to enum validation
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Invalid method: {method}"],
                )

            return ToolExecutionResult(
                success=True,
                data={
                    "estimated_ftp": estimated_ftp,
                    "method": method,
                    "explanation": explanation,
                },
                format="json",
                metadata={"input_value": input_value},
            )

        except ValueError as e:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Parameter validation error: {str(e)}"],
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Unexpected error: {str(e)}"],
            )


class EstimateMaxHRTool(BaseTool):
    """
    Tool for estimating maximum heart rate using age-based formula.

    Uses the standard formula: Max HR = 220 - age
    Also provides typical range (±10 bpm).
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="estimate_max_hr",
            description=(
                "Estimate maximum heart rate using age-based formula: 220 - age. "
                "Also provides typical range (±10 bpm) to account for individual variation."
            ),
            category="analysis",
            parameters=[
                ToolParameter(
                    name="age",
                    type="integer",
                    description="Athlete's age in years",
                    required=True,
                    min_value=18,
                    max_value=100,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": "Estimated max HR with range and explanation",
            },
            version="1.0.0",
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute max HR estimation.

        Args:
            **kwargs: Tool parameters (age)

        Returns:
            ToolExecutionResult with estimated max HR or errors
        """
        try:
            # Validate parameters
            self.validate_parameters(**kwargs)

            age = int(kwargs["age"])

            # Additional validation using Phase 1 helper
            is_valid, error_msg = validate_age(age)
            if not is_valid:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[error_msg],
                )

            # Calculate max HR
            estimated_max_hr = 220 - age
            lower_bound = estimated_max_hr - 10
            upper_bound = estimated_max_hr + 10

            explanation = (
                f"Max HR = 220 - {age} = {estimated_max_hr} bpm\n"
                f"Typical range: {lower_bound}-{upper_bound} bpm\n"
                f"This is an age-based estimate. Your actual max HR may vary by ±10 bpm "
                f"due to individual differences. For most accurate results, perform a "
                f"maximum effort field test."
            )

            return ToolExecutionResult(
                success=True,
                data={
                    "estimated_max_hr": estimated_max_hr,
                    "range": {"lower": lower_bound, "upper": upper_bound},
                    "explanation": explanation,
                },
                format="json",
                metadata={"age": age},
            )

        except ValueError as e:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Parameter validation error: {str(e)}"],
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Unexpected error: {str(e)}"],
            )


class FinalizeProfileTool(BaseTool):
    """
    Tool for validating complete profile and saving to JSON file.

    Validates that all 9 required core fields are present and saves the profile
    to data/{name}/athlete_profile.json.
    """

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return ToolDefinition(
            name="finalize_profile",
            description=(
                "Validate complete athlete profile and save to JSON file. "
                "Creates directory structure at data/{name}/athlete_profile.json. "
                "Requires all 9 core fields to be populated: name, age, gender, "
                "weight_kg, ftp, max_hr, training_experience, "
                "training_availability_hours_per_week, goals."
            ),
            category="data_prep",
            parameters=[
                ToolParameter(
                    name="confirm",
                    type="boolean",
                    description="Confirmation that profile is ready to save",
                    required=True,
                ),
                ToolParameter(
                    name="data_dir",
                    type="string",
                    description="Base directory for profile storage (defaults to 'data')",
                    required=False,
                ),
            ],
            returns={
                "type": "object",
                "format": "json",
                "description": "Profile path and saved profile data",
            },
            version="1.0.0",
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute profile finalization.

        Args:
            **kwargs: Tool parameters (confirm, session_context)

        Returns:
            ToolExecutionResult with profile path or errors
        """
        try:
            # Validate parameters
            self.validate_parameters(**kwargs)

            confirm = kwargs.get("confirm", False)
            data_dir = kwargs.get("data_dir", "data")
            session_context = kwargs.get("session_context", {})

            # Check confirmation
            if not confirm:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=["Profile must be confirmed before finalizing"],
                )

            # Check session context exists
            if "partial_profile" not in session_context:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=["No profile data found in session context"],
                )

            profile_data = session_context["partial_profile"]

            # Validate all required fields are present
            required_fields = [
                "name",
                "age",
                "gender",
                "weight_kg",
                "ftp",
                "max_hr",
                "training_experience",
                "training_availability_hours_per_week",
                "goals",
            ]

            missing_fields = []
            for field in required_fields:
                if field not in profile_data or profile_data[field] is None:
                    missing_fields.append(field)

            if missing_fields:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=[f"Missing required fields: {', '.join(missing_fields)}"],
                )

            # Validate goals is not empty
            if not profile_data.get("goals") or len(profile_data["goals"]) == 0:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=["Goals list cannot be empty"],
                )

            # Create directory structure
            athlete_name = profile_data["name"]
            profile_dir = Path(data_dir) / athlete_name
            profile_dir.mkdir(parents=True, exist_ok=True)

            # Save profile to JSON
            profile_path = profile_dir / "athlete_profile.json"
            with open(profile_path, "w") as f:
                json.dump(profile_data, f, indent=2)

            return ToolExecutionResult(
                success=True,
                data={
                    "profile_path": str(profile_path),
                    "profile": profile_data,
                },
                format="json",
                metadata={
                    "athlete_name": athlete_name,
                    "context_updates": {"profile_path": str(profile_path)},
                },
            )

        except ValueError as e:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Parameter validation error: {str(e)}"],
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Unexpected error: {str(e)}"],
            )


# Register tools on module import
register_tool(UpdateProfileFieldTool())
register_tool(EstimateFTPTool())
register_tool(EstimateMaxHRTool())
register_tool(FinalizeProfileTool())
