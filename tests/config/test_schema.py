"""Tests for configuration schema models."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from cycling_ai.config.schema import (
    AnalysisSettings,
    CyclingAIConfig,
    OutputSettings,
    PathSettings,
    ProviderSettings,
    TrainingSettings,
)


class TestProviderSettings:
    """Tests for ProviderSettings model."""

    def test_valid_provider_settings(self) -> None:
        """Test creating valid provider settings."""
        settings = ProviderSettings(
            model="claude-sonnet-4",
            max_tokens=4096,
            temperature=0.7,
            api_key_env="ANTHROPIC_API_KEY",
        )

        assert settings.model == "claude-sonnet-4"
        assert settings.max_tokens == 4096
        assert settings.temperature == 0.7
        assert settings.api_key_env == "ANTHROPIC_API_KEY"

    def test_provider_settings_defaults(self) -> None:
        """Test provider settings with defaults."""
        settings = ProviderSettings(model="gpt-4")

        assert settings.model == "gpt-4"
        assert settings.max_tokens == 4096  # Default
        assert settings.temperature == 0.7  # Default
        assert settings.api_key_env == ""  # Default

    def test_provider_settings_invalid_max_tokens(self) -> None:
        """Test validation of max_tokens range."""
        with pytest.raises(ValidationError):
            ProviderSettings(model="gpt-4", max_tokens=0)

        with pytest.raises(ValidationError):
            ProviderSettings(model="gpt-4", max_tokens=200000)

    def test_provider_settings_invalid_temperature(self) -> None:
        """Test validation of temperature range."""
        with pytest.raises(ValidationError):
            ProviderSettings(model="gpt-4", temperature=-0.1)

        with pytest.raises(ValidationError):
            ProviderSettings(model="gpt-4", temperature=2.1)


class TestAnalysisSettings:
    """Tests for AnalysisSettings model."""

    def test_valid_analysis_settings(self) -> None:
        """Test creating valid analysis settings."""
        settings = AnalysisSettings(period_months=6, use_cache=True)

        assert settings.period_months == 6
        assert settings.use_cache is True

    def test_analysis_settings_defaults(self) -> None:
        """Test analysis settings defaults."""
        settings = AnalysisSettings()

        assert settings.period_months == 6
        assert settings.use_cache is True

    def test_analysis_settings_invalid_period(self) -> None:
        """Test validation of period_months range."""
        with pytest.raises(ValidationError):
            AnalysisSettings(period_months=0)

        with pytest.raises(ValidationError):
            AnalysisSettings(period_months=25)


class TestTrainingSettings:
    """Tests for TrainingSettings model."""

    def test_valid_training_settings(self) -> None:
        """Test creating valid training settings."""
        settings = TrainingSettings(total_weeks=12)

        assert settings.total_weeks == 12

    def test_training_settings_defaults(self) -> None:
        """Test training settings defaults."""
        settings = TrainingSettings()

        assert settings.total_weeks == 12

    def test_training_settings_invalid_weeks(self) -> None:
        """Test validation of total_weeks range."""
        with pytest.raises(ValidationError):
            TrainingSettings(total_weeks=3)

        with pytest.raises(ValidationError):
            TrainingSettings(total_weeks=25)


class TestPathSettings:
    """Tests for PathSettings model."""

    def test_valid_path_settings(self) -> None:
        """Test creating valid path settings."""
        settings = PathSettings(
            athlete_profile="/path/to/profile.json",
            activities_csv="/path/to/activities.csv",
            fit_files_directory="/path/to/fits",
        )

        assert settings.athlete_profile == "/path/to/profile.json"
        assert settings.activities_csv == "/path/to/activities.csv"
        assert settings.fit_files_directory == "/path/to/fits"

    def test_path_settings_defaults(self) -> None:
        """Test path settings defaults."""
        settings = PathSettings()

        assert settings.athlete_profile == ""
        assert settings.activities_csv == ""
        assert settings.fit_files_directory == ""


class TestOutputSettings:
    """Tests for OutputSettings model."""

    def test_valid_output_settings(self) -> None:
        """Test creating valid output settings."""
        settings = OutputSettings(format="json", verbose=True, color=False)

        assert settings.format == "json"
        assert settings.verbose is True
        assert settings.color is False

    def test_output_settings_defaults(self) -> None:
        """Test output settings defaults."""
        settings = OutputSettings()

        assert settings.format == "rich"
        assert settings.verbose is False
        assert settings.color is True

    def test_output_settings_invalid_format(self) -> None:
        """Test validation of format literal."""
        with pytest.raises(ValidationError):
            OutputSettings(format="xml")  # type: ignore


class TestCyclingAIConfig:
    """Tests for complete configuration model."""

    def test_valid_complete_config(self) -> None:
        """Test creating valid complete configuration."""
        config = CyclingAIConfig(
            version="1.0",
            default_provider="anthropic",
            providers={
                "anthropic": ProviderSettings(
                    model="claude-sonnet-4", api_key_env="ANTHROPIC_API_KEY"
                ),
                "openai": ProviderSettings(model="gpt-4", api_key_env="OPENAI_API_KEY"),
            },
            analysis=AnalysisSettings(period_months=6),
            training=TrainingSettings(total_weeks=12),
            paths=PathSettings(),
            output=OutputSettings(),
        )

        assert config.version == "1.0"
        assert config.default_provider == "anthropic"
        assert len(config.providers) == 2
        assert config.analysis.period_months == 6
        assert config.training.total_weeks == 12

    def test_config_with_defaults(self) -> None:
        """Test config with default subsettings."""
        config = CyclingAIConfig(
            default_provider="anthropic",
            providers={
                "anthropic": ProviderSettings(
                    model="claude-sonnet-4", api_key_env="ANTHROPIC_API_KEY"
                )
            },
        )

        assert config.version == "1.0"
        assert config.analysis.period_months == 6  # Default
        assert config.training.total_weeks == 12  # Default
        assert config.output.format == "rich"  # Default

    def test_config_invalid_default_provider(self) -> None:
        """Test validation that default_provider exists in providers."""
        with pytest.raises(ValidationError, match="default_provider"):
            CyclingAIConfig(
                default_provider="nonexistent",
                providers={
                    "anthropic": ProviderSettings(
                        model="claude-sonnet-4", api_key_env="ANTHROPIC_API_KEY"
                    )
                },
            )

    def test_config_from_dict(self) -> None:
        """Test creating config from dictionary (YAML equivalent)."""
        config_dict = {
            "version": "1.0",
            "default_provider": "anthropic",
            "providers": {
                "anthropic": {
                    "model": "claude-sonnet-4",
                    "max_tokens": 4096,
                    "temperature": 0.7,
                    "api_key_env": "ANTHROPIC_API_KEY",
                }
            },
            "analysis": {"period_months": 6, "use_cache": True},
            "training": {"total_weeks": 12},
            "paths": {
                "athlete_profile": "",
                "activities_csv": "",
                "fit_files_directory": "",
            },
            "output": {"format": "rich", "verbose": False, "color": True},
        }

        config = CyclingAIConfig(**config_dict)

        assert config.default_provider == "anthropic"
        assert config.providers["anthropic"].model == "claude-sonnet-4"
        assert config.analysis.period_months == 6
