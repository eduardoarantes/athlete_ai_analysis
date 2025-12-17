"""Configuration loading from YAML files and environment."""

from __future__ import annotations

import os
from pathlib import Path

import yaml

from .defaults import DEFAULT_CONFIG
from .schema import CyclingAIConfig


def get_config_path() -> Path:
    """
    Get configuration file path.

    Searches in this order:
    1. CYCLING_AI_CONFIG environment variable
    2. ./.cycling-ai.yaml (current directory) - PRIORITIZED
    3. ~/.cycling-ai/config.yaml (home directory)
    4. Default: ./.cycling-ai.yaml (created in current directory if missing)

    Returns:
        Path to configuration file
    """
    # Check environment variable
    if config_env := os.getenv("CYCLING_AI_CONFIG"):
        return Path(config_env)

    # Check current directory FIRST (project-local config)
    local_config = Path.cwd() / ".cycling-ai.yaml"
    if local_config.exists():
        return local_config

    # Check home directory
    home_config = Path.home() / ".cycling-ai" / "config.yaml"
    if home_config.exists():
        return home_config

    # Return default path - prefer local config (will be created if needed)
    return local_config


def load_config() -> CyclingAIConfig:
    """
    Load configuration from YAML file.

    Creates default configuration if no config file exists.

    Returns:
        Loaded configuration

    Raises:
        ValueError: If configuration file is invalid
    """
    config_path = get_config_path()

    if not config_path.exists():
        # Create default config
        return create_default_config(config_path)

    try:
        with open(config_path) as f:
            config_data = yaml.safe_load(f)

        if not isinstance(config_data, dict):
            raise ValueError("Configuration file must contain a YAML object/dictionary")

        return CyclingAIConfig(**config_data)

    except yaml.YAMLError as e:
        raise ValueError(f"Error loading config from {config_path}: Invalid YAML: {e}") from e
    except Exception as e:
        raise ValueError(f"Error loading config from {config_path}: {e}") from e


def create_default_config(config_path: Path) -> CyclingAIConfig:
    """
    Create default configuration file.

    Args:
        config_path: Path where config file should be created

    Returns:
        Default configuration instance
    """
    # Ensure directory exists
    config_path.parent.mkdir(parents=True, exist_ok=True)

    # Write default config with comments
    config_content = """# Cycling AI Configuration
version: "1.3"

# Default provider to use
default_provider: "anthropic"

# Provider configurations
providers:
  anthropic:
    model: "claude-sonnet-4"
    max_tokens: 4096
    temperature: 0.7
    api_key_env: "ANTHROPIC_API_KEY"

  openai:
    model: "gpt-4-turbo"
    max_tokens: 4096
    temperature: 0.7
    api_key_env: "OPENAI_API_KEY"

  gemini:
    model: "gemini-pro"
    max_tokens: 4096
    temperature: 0.7
    api_key_env: "GEMINI_API_KEY"

  ollama:
    model: "llama3"
    max_tokens: 4096
    temperature: 0.7
    api_key_env: ""  # No API key needed for local

# Analysis defaults
analysis:
  period_months: 6
  use_cache: true

# Training plan defaults
training:
  total_weeks: 12

# Paths (optional, can be overridden by CLI)
paths:
  athlete_profile: ""  # Auto-detect from current directory
  activities_csv: ""
  fit_files_directory: ""

# Output preferences
output:
  format: "rich"  # "json", "markdown", "rich"
  verbose: false
  color: true
"""

    with open(config_path, "w") as f:
        f.write(config_content)

    return CyclingAIConfig(**DEFAULT_CONFIG)


def get_api_key(provider_name: str, config: CyclingAIConfig) -> str:
    """
    Get API key for provider from environment.

    Args:
        provider_name: Name of provider
        config: Configuration instance

    Returns:
        API key from environment or empty string

    Raises:
        ValueError: If provider not configured or API key not found
    """
    if provider_name not in config.providers:
        raise ValueError(
            f"Provider '{provider_name}' not configured. "
            f"Available providers: {', '.join(config.providers.keys())}"
        )

    provider_config = config.providers[provider_name]

    if not provider_config.api_key_env:
        return ""  # No API key needed (e.g., Ollama)

    api_key = os.getenv(provider_config.api_key_env)
    if not api_key:
        raise ValueError(
            f"API key not found. Set environment variable: {provider_config.api_key_env}"
        )

    return api_key
