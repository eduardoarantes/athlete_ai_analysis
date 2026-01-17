"""
FastAPI application configuration.

Manages environment variables and application settings using Pydantic.
"""

from __future__ import annotations

import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class APISettings(BaseSettings):
    """
    Application settings loaded from environment variables.

    All settings can be overridden with environment variables prefixed with FASTAPI_.
    Example: FASTAPI_PORT=8080
    """

    # Environment configuration
    environment: str = "development"  # development, staging, production

    # Server configuration
    host: str = "0.0.0.0"
    port: int = 8000  # Default, calculated from PORT_SHIFT if available
    reload: bool = False  # Enable auto-reload in development

    # CORS configuration
    allowed_origins: list[str] = []  # Calculated from PORT_SHIFT or set explicitly

    def _is_lambda(self) -> bool:
        """Detect if running in AWS Lambda environment."""
        return "AWS_LAMBDA_FUNCTION_NAME" in os.environ or "AWS_EXECUTION_ENV" in os.environ

    def _is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment.lower() in ("production", "prod") or self._is_lambda()

    def __init__(self, **kwargs):
        """Initialize settings and calculate port-based configurations from PORT_SHIFT."""
        super().__init__(**kwargs)

        # Auto-detect Lambda environment
        if self._is_lambda() and "environment" not in kwargs:
            self.environment = "production"

        # Get PORT_SHIFT
        port_shift_str = os.getenv("PORT_SHIFT")

        # Validate PORT_SHIFT requirement based on environment
        if not self._is_production() and port_shift_str is None:
            raise ValueError(
                "PORT_SHIFT environment variable is required in development/staging. "
                "Please set PORT_SHIFT in .env file"
            )

        if port_shift_str is not None:
            # Local development with PORT_SHIFT
            port_shift = int(port_shift_str)

            # Calculate port from PORT_SHIFT if not explicitly set
            if "port" not in kwargs:
                self.port = 8000 + port_shift

            # Calculate CORS origins from PORT_SHIFT for local development
            if not self.allowed_origins:
                web_port = 3000 + port_shift
                self.allowed_origins = [
                    f"http://localhost:{web_port}",
                    f"http://127.0.0.1:{web_port}",
                ]
        else:
            # Production/cloud deployment - use explicit configuration
            # Port is managed by Lambda runtime or explicitly set
            # CORS origins must be explicitly set via ALLOWED_ORIGINS env var
            if not self.allowed_origins:
                # Default fallback (should be overridden in production)
                self.allowed_origins = [
                    "http://localhost:3000",
                ]

    # Job storage
    job_storage_path: str = "/tmp/cycling-ai-jobs"

    # Supabase configuration
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None

    # Strava configuration
    strava_access_token: str | None = None  # Will be loaded from AWS Parameter Store in production

    # API metadata
    title: str = "Cycling AI API"
    description: str = "REST API for AI-powered cycling performance analysis"
    version: str = "1.0.0"

    # AI Provider configuration
    ai_provider: str = "anthropic"  # anthropic, openai, gemini, ollama
    ai_model: str | None = None  # Default model per provider if not specified
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    google_api_key: str | None = None
    ollama_base_url: str = "http://localhost:11434"

    # AI generation settings
    ai_max_tokens: int = 16384  # Increased for longer training plans
    ai_temperature: float = 0.7

    # Workout source: "library" (fast, deterministic) or "llm" (flexible)
    # "library" uses LLM for plan structure, then selects workouts from curated library
    # "llm" generates entire plan including workouts via LLM
    workout_source: str = "library"

    # Model configuration
    model_config = SettingsConfigDict(
        env_prefix="",  # No prefix - use direct env var names
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # Ignore extra fields like PORT_SHIFT, NEXT_PUBLIC_* from .env
    )

    def get_provider_api_key(self) -> str:
        """Get the API key for the configured provider."""
        provider = self.ai_provider.lower()
        api_keys = {
            "anthropic": self.anthropic_api_key or "",
            "openai": self.openai_api_key or "",
            "gemini": self.google_api_key or "",
            "ollama": "ollama",  # Ollama doesn't need API key
        }
        return api_keys.get(provider, "")

    def get_default_model(self) -> str:
        """Get the default model for the configured provider."""
        if self.ai_model:
            return self.ai_model
        provider = self.ai_provider.lower()
        defaults = {
            "anthropic": "claude-sonnet-4-20250514",
            "openai": "gpt-4o",
            "gemini": "gemini-2.0-flash",
            "ollama": "llama3.1:8b",
        }
        return defaults.get(provider, "claude-sonnet-4-20250514")


# Global settings instance
settings = APISettings()
