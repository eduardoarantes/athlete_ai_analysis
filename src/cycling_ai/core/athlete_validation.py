"""
Athlete profile validation logic.

Single source of truth for all athlete profile field validation.
Consolidates validation from profile_onboarding.py and profile_creation_tools.py.
"""

from __future__ import annotations

from typing import Any


class ValidationResult:
    """Result of a validation operation."""

    def __init__(self, is_valid: bool, error_message: str = ""):
        self.is_valid = is_valid
        self.error_message = error_message

    def __bool__(self) -> bool:
        """Allow using ValidationResult in boolean context."""
        return self.is_valid

    def to_tuple(self) -> tuple[bool, str]:
        """Convert to tuple format (is_valid, error_message) for backward compatibility."""
        return self.is_valid, self.error_message


# Validation constants
AGE_MIN = 18
AGE_MAX = 100

WEIGHT_MIN_KG = 40.0
WEIGHT_MAX_KG = 200.0

FTP_MIN_WATTS = 50
FTP_MAX_WATTS = 600

MAX_HR_MIN_BPM = 100
MAX_HR_MAX_BPM = 220

TRAINING_HOURS_MIN = 1.0
TRAINING_HOURS_MAX = 40.0

VALID_TRAINING_EXPERIENCE = {"beginner", "intermediate", "advanced"}
VALID_GENDERS = {"male", "female", "other"}


def validate_age(age: int) -> tuple[bool, str]:
    """
    Validate age is within acceptable range.

    Args:
        age: Age in years

    Returns:
        Tuple of (is_valid, error_message).
        error_message is empty string if valid.

    Examples:
        >>> validate_age(35)
        (True, '')
        >>> validate_age(17)
        (False, 'Age must be at least 18')
        >>> validate_age(101)
        (False, 'Age must be 100 or less')
    """
    if not isinstance(age, int):
        return False, "Age must be a whole number"
    if age < AGE_MIN:
        return False, f"Age must be at least {AGE_MIN}"
    if age > AGE_MAX:
        return False, f"Age must be {AGE_MAX} or less"
    return True, ""


def validate_weight(weight_kg: float) -> tuple[bool, str]:
    """
    Validate weight is within acceptable range.

    Args:
        weight_kg: Weight in kilograms

    Returns:
        Tuple of (is_valid, error_message).
        error_message is empty string if valid.

    Examples:
        >>> validate_weight(70.0)
        (True, '')
        >>> validate_weight(30.0)
        (False, 'Weight must be between 40.0 and 200.0 kg')
    """
    if not isinstance(weight_kg, (int, float)):
        return False, "Weight must be a number"
    if weight_kg < WEIGHT_MIN_KG:
        return False, f"Weight must be between {WEIGHT_MIN_KG} and {WEIGHT_MAX_KG} kg"
    if weight_kg > WEIGHT_MAX_KG:
        return False, f"Weight must be between {WEIGHT_MIN_KG} and {WEIGHT_MAX_KG} kg"
    return True, ""


def validate_ftp(ftp: int) -> tuple[bool, str]:
    """
    Validate FTP (Functional Threshold Power) is within acceptable range.

    Args:
        ftp: FTP in watts

    Returns:
        Tuple of (is_valid, error_message).
        error_message is empty string if valid.

    Examples:
        >>> validate_ftp(250)
        (True, '')
        >>> validate_ftp(30)
        (False, 'FTP must be between 50 and 600 watts')
    """
    if not isinstance(ftp, int):
        return False, "FTP must be a whole number"
    if ftp < FTP_MIN_WATTS:
        return False, f"FTP must be between {FTP_MIN_WATTS} and {FTP_MAX_WATTS} watts"
    if ftp > FTP_MAX_WATTS:
        return False, f"FTP must be between {FTP_MIN_WATTS} and {FTP_MAX_WATTS} watts"
    return True, ""


def validate_max_hr(max_hr: int) -> tuple[bool, str]:
    """
    Validate maximum heart rate is within acceptable range.

    Args:
        max_hr: Maximum heart rate in BPM

    Returns:
        Tuple of (is_valid, error_message).
        error_message is empty string if valid.

    Examples:
        >>> validate_max_hr(185)
        (True, '')
        >>> validate_max_hr(90)
        (False, 'Maximum heart rate must be between 100 and 220 BPM')
    """
    if not isinstance(max_hr, int):
        return False, "Maximum heart rate must be a whole number"
    if max_hr < MAX_HR_MIN_BPM:
        return (
            False,
            f"Maximum heart rate must be between {MAX_HR_MIN_BPM} and {MAX_HR_MAX_BPM} BPM",
        )
    if max_hr > MAX_HR_MAX_BPM:
        return (
            False,
            f"Maximum heart rate must be between {MAX_HR_MIN_BPM} and {MAX_HR_MAX_BPM} BPM",
        )
    return True, ""


def validate_training_availability(hours: float) -> tuple[bool, str]:
    """
    Validate training availability hours per week.

    Args:
        hours: Hours available for training per week

    Returns:
        Tuple of (is_valid, error_message).
        error_message is empty string if valid.

    Examples:
        >>> validate_training_availability(10.0)
        (True, '')
        >>> validate_training_availability(0.5)
        (False, 'Training availability must be between 1.0 and 40.0 hours per week')
    """
    if not isinstance(hours, (int, float)):
        return False, "Training availability must be a number"
    if hours < TRAINING_HOURS_MIN:
        return (
            False,
            f"Training availability must be between {TRAINING_HOURS_MIN} and {TRAINING_HOURS_MAX} hours per week",
        )
    if hours > TRAINING_HOURS_MAX:
        return (
            False,
            f"Training availability must be between {TRAINING_HOURS_MIN} and {TRAINING_HOURS_MAX} hours per week",
        )
    return True, ""


def validate_training_experience(
    experience: str,
) -> tuple[bool, str]:
    """
    Validate training experience level.

    Args:
        experience: Training experience level (beginner, intermediate, advanced)

    Returns:
        Tuple of (is_valid, error_message).
        error_message is empty string if valid.

    Examples:
        >>> validate_training_experience("intermediate")
        (True, '')
        >>> validate_training_experience("expert")
        (False, 'Training experience must be one of: beginner, intermediate, advanced')
    """
    if not isinstance(experience, str):
        return False, "Training experience must be a string"

    experience_lower = experience.lower()
    if experience_lower not in VALID_TRAINING_EXPERIENCE:
        valid_options = ", ".join(sorted(VALID_TRAINING_EXPERIENCE))
        return False, f"Training experience must be one of: {valid_options}"
    return True, ""


def validate_gender(gender: str) -> tuple[bool, str]:
    """
    Validate gender.

    Args:
        gender: Gender (male, female, other)

    Returns:
        Tuple of (is_valid, error_message).
        error_message is empty string if valid.

    Examples:
        >>> validate_gender("male")
        (True, '')
        >>> validate_gender("unknown")
        (False, 'Gender must be one of: male, female, other')
    """
    if not isinstance(gender, str):
        return False, "Gender must be a string"

    gender_lower = gender.lower()
    if gender_lower not in VALID_GENDERS:
        valid_options = ", ".join(sorted(VALID_GENDERS))
        return False, f"Gender must be one of: {valid_options}"
    return True, ""


def validate_goals(goals: list[str]) -> tuple[bool, str]:
    """
    Validate goals list.

    Args:
        goals: List of training goals

    Returns:
        Tuple of (is_valid, error_message).
        error_message is empty string if valid.

    Examples:
        >>> validate_goals(["Improve FTP", "Complete century"])
        (True, '')
        >>> validate_goals([])
        (False, 'At least one goal is required')
    """
    if not isinstance(goals, list):
        return False, "Goals must be a list"

    if len(goals) == 0:
        return False, "At least one goal is required"

    for goal in goals:
        if not isinstance(goal, str):
            return False, "All goals must be strings"
        if len(goal.strip()) == 0:
            return False, "Goals cannot be empty strings"

    return True, ""


def validate_name(name: str) -> tuple[bool, str]:
    """
    Validate athlete name.

    Args:
        name: Athlete's name

    Returns:
        Tuple of (is_valid, error_message).
        error_message is empty string if valid.

    Examples:
        >>> validate_name("John Doe")
        (True, '')
        >>> validate_name("")
        (False, 'Name cannot be empty')
    """
    if not isinstance(name, str):
        return False, "Name must be a string"

    if len(name.strip()) == 0:
        return False, "Name cannot be empty"

    if len(name) > 100:
        return False, "Name must be 100 characters or less"

    return True, ""


# Validation registry for dynamic lookup
VALIDATORS: dict[str, Any] = {
    "age": validate_age,
    "weight_kg": validate_weight,
    "ftp": validate_ftp,
    "max_hr": validate_max_hr,
    "training_availability_hours_per_week": validate_training_availability,
    "training_experience": validate_training_experience,
    "gender": validate_gender,
    "goals": validate_goals,
    "name": validate_name,
}


def validate_field(field_name: str, value: Any) -> tuple[bool, str]:
    """
    Validate any athlete profile field using the appropriate validator.

    Args:
        field_name: Name of the field to validate
        value: Value to validate

    Returns:
        Tuple of (is_valid, error_message).
        error_message is empty string if valid.

    Raises:
        ValueError: If field_name has no registered validator

    Examples:
        >>> validate_field("age", 35)
        (True, '')
        >>> validate_field("ftp", 250)
        (True, '')
        >>> validate_field("unknown_field", "value")
        Traceback (most recent call last):
        ...
        ValueError: No validator registered for field: unknown_field
    """
    if field_name not in VALIDATORS:
        raise ValueError(f"No validator registered for field: {field_name}")

    validator = VALIDATORS[field_name]
    return validator(value)


def get_field_constraints(field_name: str) -> dict[str, Any]:
    """
    Get validation constraints for a field.

    Args:
        field_name: Name of the field

    Returns:
        Dictionary of constraints (min, max, valid_values, etc.)

    Examples:
        >>> get_field_constraints("age")
        {'type': 'int', 'min': 18, 'max': 100}
        >>> get_field_constraints("training_experience")
        {'type': 'str', 'valid_values': {'beginner', 'intermediate', 'advanced'}}
    """
    constraints_map = {
        "age": {"type": "int", "min": AGE_MIN, "max": AGE_MAX},
        "weight_kg": {"type": "float", "min": WEIGHT_MIN_KG, "max": WEIGHT_MAX_KG},
        "ftp": {"type": "int", "min": FTP_MIN_WATTS, "max": FTP_MAX_WATTS},
        "max_hr": {"type": "int", "min": MAX_HR_MIN_BPM, "max": MAX_HR_MAX_BPM},
        "training_availability_hours_per_week": {
            "type": "float",
            "min": TRAINING_HOURS_MIN,
            "max": TRAINING_HOURS_MAX,
        },
        "training_experience": {
            "type": "str",
            "valid_values": VALID_TRAINING_EXPERIENCE,
        },
        "gender": {"type": "str", "valid_values": VALID_GENDERS},
        "goals": {"type": "list[str]", "min_length": 1},
        "name": {"type": "str", "min_length": 1, "max_length": 100},
    }

    if field_name not in constraints_map:
        raise ValueError(f"No constraints defined for field: {field_name}")

    return constraints_map[field_name]
