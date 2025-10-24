"""Tests for default configuration values."""
from __future__ import annotations

from cycling_ai.config.defaults import DEFAULT_CONFIG
from cycling_ai.config.schema import CyclingAIConfig


class TestDefaultConfig:
    """Tests for DEFAULT_CONFIG constant."""

    def test_default_config_is_valid(self) -> None:
        """Test that default config can create valid CyclingAIConfig."""
        config = CyclingAIConfig(**DEFAULT_CONFIG)

        assert config.version == "1.0"
        assert isinstance(config.default_provider, str)
        assert len(config.providers) > 0

    def test_default_config_has_all_providers(self) -> None:
        """Test that default config includes all 4 providers."""
        config = CyclingAIConfig(**DEFAULT_CONFIG)

        assert "anthropic" in config.providers
        assert "openai" in config.providers
        assert "gemini" in config.providers
        assert "ollama" in config.providers

    def test_default_config_provider_settings(self) -> None:
        """Test that each provider has valid settings."""
        config = CyclingAIConfig(**DEFAULT_CONFIG)

        # Anthropic
        assert config.providers["anthropic"].model == "claude-sonnet-4"
        assert config.providers["anthropic"].api_key_env == "ANTHROPIC_API_KEY"

        # OpenAI
        assert config.providers["openai"].model == "gpt-4-turbo"
        assert config.providers["openai"].api_key_env == "OPENAI_API_KEY"

        # Gemini
        assert config.providers["gemini"].model == "gemini-pro"
        assert config.providers["gemini"].api_key_env == "GEMINI_API_KEY"

        # Ollama (no API key needed)
        assert config.providers["ollama"].model == "llama3"
        assert config.providers["ollama"].api_key_env == ""

    def test_default_config_analysis_settings(self) -> None:
        """Test default analysis settings."""
        config = CyclingAIConfig(**DEFAULT_CONFIG)

        assert config.analysis.period_months == 6
        assert config.analysis.use_cache is True

    def test_default_config_training_settings(self) -> None:
        """Test default training settings."""
        config = CyclingAIConfig(**DEFAULT_CONFIG)

        assert config.training.total_weeks == 12

    def test_default_config_output_settings(self) -> None:
        """Test default output settings."""
        config = CyclingAIConfig(**DEFAULT_CONFIG)

        assert config.output.format == "rich"
        assert config.output.verbose is False
        assert config.output.color is True

    def test_default_provider_is_anthropic(self) -> None:
        """Test that default provider is anthropic."""
        config = CyclingAIConfig(**DEFAULT_CONFIG)

        assert config.default_provider == "anthropic"
