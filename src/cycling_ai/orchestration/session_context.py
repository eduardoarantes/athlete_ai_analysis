"""
Session context constants and utilities.

Centralized constants for session context keys to prevent typos and ensure consistency.
"""
from enum import Enum


class SessionContextKey(str, Enum):
    """Standard keys for session context dictionary.

    Using string enum allows both type checking and string usage:
    - Type-safe: session.context[SessionContextKey.MODE]
    - String-compatible: session.context["mode"]
    """

    # Mode tracking
    MODE = "mode"

    # Onboarding-related keys
    ONBOARDING_STATE = "onboarding_state"
    ONBOARDING_MANAGER = "onboarding_manager"
    PARTIAL_PROFILE = "partial_profile"

    # Profile paths
    PROFILE_PATH = "profile_path"
    ATHLETE_PROFILE = "athlete_profile"

    # Data paths
    DATA_DIR = "data_dir"

    # Provider context
    PROVIDER = "provider"


class SessionMode(str, Enum):
    """Valid session modes."""

    ONBOARDING = "onboarding"
    NORMAL = "normal"


# Type hints for common context structures
SessionContext = dict[str, any]
