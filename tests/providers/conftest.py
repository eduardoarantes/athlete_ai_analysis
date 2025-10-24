"""
Pytest fixtures for provider tests.

Provides common test fixtures and utilities for testing provider adapters.
"""
from __future__ import annotations

import pytest

from cycling_ai.providers.base import ProviderConfig, ProviderMessage
from cycling_ai.tools.base import ToolDefinition, ToolParameter


@pytest.fixture
def sample_tool_definition() -> ToolDefinition:
    """Sample tool definition for testing schema conversion."""
    return ToolDefinition(
        name="analyze_performance",
        description="Analyze cycling performance data",
        category="analysis",
        parameters=[
            ToolParameter(
                name="period_months",
                type="integer",
                description="Number of months to analyze",
                required=True,
            ),
            ToolParameter(
                name="include_cross_training",
                type="boolean",
                description="Include cross-training analysis",
                required=False,
            ),
            ToolParameter(
                name="metric_type",
                type="string",
                description="Type of metric to analyze",
                required=True,
                enum=["power", "heart_rate", "cadence"],
            ),
        ],
        returns={"type": "json", "format": "analysis_report"},
        version="1.0.0",
    )


@pytest.fixture
def sample_messages() -> list[ProviderMessage]:
    """Sample messages for testing completions."""
    return [
        ProviderMessage(role="system", content="You are a cycling coach."),
        ProviderMessage(role="user", content="Analyze my recent performance."),
    ]


@pytest.fixture(params=["openai", "anthropic", "gemini", "ollama"])
def provider_config(request: pytest.FixtureRequest) -> ProviderConfig:
    """Parameterized fixture for all provider configs."""
    return ProviderConfig(
        provider_name=request.param,
        api_key="test-key",
        model="test-model",
    )
