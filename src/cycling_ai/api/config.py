"""
FastAPI application configuration.

Manages environment variables and application settings using Pydantic.
"""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class APISettings(BaseSettings):
    """
    Application settings loaded from environment variables.

    All settings can be overridden with environment variables prefixed with FASTAPI_.
    Example: FASTAPI_PORT=8080
    """

    # Server configuration
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = False  # Enable auto-reload in development

    # CORS configuration
    allowed_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    # Job storage
    job_storage_path: str = "/tmp/cycling-ai-jobs"

    # API metadata
    title: str = "Cycling AI API"
    description: str = "REST API for AI-powered cycling performance analysis"
    version: str = "1.0.0"

    # Model configuration
    model_config = SettingsConfigDict(
        env_prefix="FASTAPI_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


# Global settings instance
settings = APISettings()
