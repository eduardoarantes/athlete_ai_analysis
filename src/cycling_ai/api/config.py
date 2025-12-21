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

    # Supabase configuration
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None

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
    # Note: "library" mode requires LLM orchestration - use "llm" for direct API calls
    workout_source: str = "llm"

    # Model configuration
    model_config = SettingsConfigDict(
        env_prefix="",  # No prefix - use direct env var names
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
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
