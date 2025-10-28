"""Tests for configuration loader."""
from __future__ import annotations

import os
from pathlib import Path

import pytest
import yaml

from cycling_ai.config.loader import (
    create_default_config,
    get_api_key,
    get_config_path,
    load_config,
)
from cycling_ai.config.schema import CyclingAIConfig


class TestGetConfigPath:
    """Tests for get_config_path function."""

    def test_get_config_path_from_env(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test getting config path from environment variable."""
        config_file = tmp_path / "custom_config.yaml"
        monkeypatch.setenv("CYCLING_AI_CONFIG", str(config_file))

        path = get_config_path()

        assert path == config_file

    def test_get_config_path_home_directory(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test getting config path from home directory."""
        # Clear environment variable
        monkeypatch.delenv("CYCLING_AI_CONFIG", raising=False)

        # Mock home directory
        home_dir = tmp_path / "home"
        home_dir.mkdir()
        monkeypatch.setattr(Path, "home", lambda: home_dir)

        # Create config file in expected location
        config_dir = home_dir / ".cycling-ai"
        config_dir.mkdir()
        config_file = config_dir / "config.yaml"
        config_file.touch()

        path = get_config_path()

        assert path == config_file

    def test_get_config_path_current_directory(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test getting config path from current directory."""
        # Clear environment variable
        monkeypatch.delenv("CYCLING_AI_CONFIG", raising=False)

        # Mock home directory to non-existent path
        # This prevents finding ~/.cycling-ai/config.yaml
        home_dir = tmp_path / "mock_home"
        home_dir.mkdir()
        monkeypatch.setattr(Path, "home", lambda: home_dir)

        # Change to temp directory
        monkeypatch.chdir(tmp_path)

        # Create local config file
        config_file = tmp_path / ".cycling-ai.yaml"
        config_file.touch()

        path = get_config_path()

        assert path == config_file

    def test_get_config_path_default(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test default config path when no config exists."""
        # Clear environment variable
        monkeypatch.delenv("CYCLING_AI_CONFIG", raising=False)

        # Mock home directory
        home_dir = tmp_path / "home"
        home_dir.mkdir()
        monkeypatch.setattr(Path, "home", lambda: home_dir)

        path = get_config_path()

        # Should return default path even if it doesn't exist
        assert path == home_dir / ".cycling-ai" / "config.yaml"


class TestLoadConfig:
    """Tests for load_config function."""

    def test_load_config_from_file(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test loading config from existing YAML file."""
        config_file = tmp_path / "config.yaml"

        config_data = {
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

        with open(config_file, "w") as f:
            yaml.safe_dump(config_data, f)

        monkeypatch.setenv("CYCLING_AI_CONFIG", str(config_file))

        config = load_config()

        assert isinstance(config, CyclingAIConfig)
        assert config.default_provider == "anthropic"
        assert config.providers["anthropic"].model == "claude-sonnet-4"

    def test_load_config_creates_default(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test that load_config creates default config if none exists."""
        # Mock home directory
        home_dir = tmp_path / "home"
        home_dir.mkdir()
        monkeypatch.setattr(Path, "home", lambda: home_dir)
        monkeypatch.delenv("CYCLING_AI_CONFIG", raising=False)

        config = load_config()

        assert isinstance(config, CyclingAIConfig)
        assert config.default_provider == "anthropic"

        # Verify default config file was created
        config_file = home_dir / ".cycling-ai" / "config.yaml"
        assert config_file.exists()

    def test_load_config_invalid_yaml(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test error handling for invalid YAML."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("invalid: yaml: content: [")

        monkeypatch.setenv("CYCLING_AI_CONFIG", str(config_file))

        with pytest.raises(ValueError, match="Error loading config"):
            load_config()

    def test_load_config_invalid_schema(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test error handling for invalid config schema."""
        config_file = tmp_path / "config.yaml"

        # Missing required fields
        config_data = {"version": "1.0"}

        with open(config_file, "w") as f:
            yaml.safe_dump(config_data, f)

        monkeypatch.setenv("CYCLING_AI_CONFIG", str(config_file))

        with pytest.raises(ValueError, match="Error loading config"):
            load_config()


class TestCreateDefaultConfig:
    """Tests for create_default_config function."""

    def test_create_default_config_creates_file(self, tmp_path: Path) -> None:
        """Test that create_default_config creates config file."""
        config_path = tmp_path / ".cycling-ai" / "config.yaml"

        config = create_default_config(config_path)

        assert isinstance(config, CyclingAIConfig)
        assert config_path.exists()

    def test_create_default_config_creates_directory(self, tmp_path: Path) -> None:
        """Test that create_default_config creates parent directory."""
        config_path = tmp_path / "subdir" / "config.yaml"

        config = create_default_config(config_path)

        assert config_path.parent.exists()
        assert config_path.exists()

    def test_create_default_config_valid_yaml(self, tmp_path: Path) -> None:
        """Test that created config file is valid YAML."""
        config_path = tmp_path / "config.yaml"

        create_default_config(config_path)

        with open(config_path) as f:
            loaded_data = yaml.safe_load(f)

        assert isinstance(loaded_data, dict)
        assert "version" in loaded_data
        assert "default_provider" in loaded_data
        assert "providers" in loaded_data


class TestGetApiKey:
    """Tests for get_api_key function."""

    def test_get_api_key_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test getting API key from environment variable."""
        from cycling_ai.config.defaults import DEFAULT_CONFIG
        from cycling_ai.config.schema import CyclingAIConfig

        config = CyclingAIConfig(**DEFAULT_CONFIG)
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-123")

        api_key = get_api_key("anthropic", config)

        assert api_key == "test-key-123"

    def test_get_api_key_missing_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test error when API key env var is not set."""
        from cycling_ai.config.defaults import DEFAULT_CONFIG
        from cycling_ai.config.schema import CyclingAIConfig

        config = CyclingAIConfig(**DEFAULT_CONFIG)
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

        with pytest.raises(ValueError, match="API key not found"):
            get_api_key("anthropic", config)

    def test_get_api_key_no_key_needed(self) -> None:
        """Test provider with no API key (e.g., Ollama)."""
        from cycling_ai.config.defaults import DEFAULT_CONFIG
        from cycling_ai.config.schema import CyclingAIConfig

        config = CyclingAIConfig(**DEFAULT_CONFIG)

        api_key = get_api_key("ollama", config)

        assert api_key == ""

    def test_get_api_key_invalid_provider(self) -> None:
        """Test error for non-existent provider."""
        from cycling_ai.config.defaults import DEFAULT_CONFIG
        from cycling_ai.config.schema import CyclingAIConfig

        config = CyclingAIConfig(**DEFAULT_CONFIG)

        with pytest.raises(ValueError, match="Provider .* not configured"):
            get_api_key("nonexistent", config)
