"""Default configuration values."""

from __future__ import annotations

from typing import Any

DEFAULT_CONFIG: dict[str, Any] = {
    "version": "1.0",
    "default_provider": "anthropic",
    "providers": {
        "anthropic": {
            "model": "claude-sonnet-4",
            "max_tokens": 4096,
            "temperature": 0.7,
            "api_key_env": "ANTHROPIC_API_KEY",
        },
        "openai": {
            "model": "gpt-4-turbo",
            "max_tokens": 4096,
            "temperature": 0.7,
            "api_key_env": "OPENAI_API_KEY",
        },
        "gemini": {
            "model": "gemini-pro",
            "max_tokens": 4096,
            "temperature": 0.7,
            "api_key_env": "GEMINI_API_KEY",
        },
        "ollama": {
            "model": "llama3",
            "max_tokens": 4096,
            "temperature": 0.7,
            "api_key_env": "",  # No API key needed for local Ollama
        },
    },
    "analysis": {
        "period_months": 6,
        "use_cache": True,
    },
    "training": {
        "total_weeks": 12,
    },
    "paths": {
        "athlete_profile": "",
        "activities_csv": "",
        "fit_files_directory": "",
    },
    "output": {
        "format": "rich",
        "verbose": False,
        "color": True,
    },
}
