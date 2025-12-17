"""
FastAPI dependency injection functions.

Provides reusable dependencies for routes (auth, config, etc.).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from .config import APISettings, settings


def get_settings() -> APISettings:
    """
    Get application settings.

    Returns:
        Application settings instance
    """
    return settings


# Type alias for settings dependency
SettingsDep = Annotated[APISettings, Depends(get_settings)]
