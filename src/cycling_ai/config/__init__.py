"""Configuration management for cycling AI analysis."""

from __future__ import annotations

from .loader import create_default_config, get_api_key, get_config_path, load_config
from .schema import (
    AnalysisSettings,
    CyclingAIConfig,
    OutputSettings,
    PathSettings,
    ProviderSettings,
    TrainingSettings,
)

__all__ = [
    # Schema
    "CyclingAIConfig",
    "ProviderSettings",
    "AnalysisSettings",
    "TrainingSettings",
    "PathSettings",
    "OutputSettings",
    # Loader
    "load_config",
    "create_default_config",
    "get_config_path",
    "get_api_key",
]
