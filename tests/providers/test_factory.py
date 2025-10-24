"""
Tests for provider factory.

Tests the provider registration and creation system.
"""
from __future__ import annotations

from typing import Any

import pytest

from cycling_ai.providers.base import (
    BaseProvider,
    CompletionResponse,
    ProviderConfig,
    ProviderMessage,
)
from cycling_ai.tools.base import ToolDefinition, ToolExecutionResult


class MockProvider(BaseProvider):
    """Mock provider for testing."""

    def convert_tool_schema(self, tools: list[ToolDefinition]) -> dict[str, Any]:
        """Mock tool schema conversion."""
        return {"tools": [tool.name for tool in tools]}

    def invoke_tool(self, tool_name: str, parameters: dict[str, Any]) -> ToolExecutionResult:
        """Mock tool invocation."""
        return ToolExecutionResult(
            success=True,
            data={"result": "mock"},
            format="json",
        )

    def format_response(self, result: ToolExecutionResult) -> dict[str, Any]:
        """Mock response formatting."""
        return {"role": "tool", "content": str(result.data)}

    def create_completion(
        self,
        messages: list[ProviderMessage],
        tools: list[ToolDefinition] | None = None,
    ) -> CompletionResponse:
        """Mock completion."""
        return CompletionResponse(
            content="Mock response",
            tool_calls=None,
            metadata={"provider": "mock"},
        )


class TestProviderFactory:
    """Tests for ProviderFactory."""

    def test_register_provider(self) -> None:
        """Test registering a provider class."""
        from cycling_ai.providers.factory import ProviderFactory

        # Register mock provider
        ProviderFactory.register_provider("mock", MockProvider)

        # Verify it's in the list
        assert "mock" in ProviderFactory.list_providers()

    def test_create_provider_success(self) -> None:
        """Test creating a provider instance."""
        from cycling_ai.providers.factory import ProviderFactory

        # Register mock provider
        ProviderFactory.register_provider("mock", MockProvider)

        # Create instance
        config = ProviderConfig(
            provider_name="mock",
            api_key="test-key",
            model="test-model",
        )
        provider = ProviderFactory.create_provider(config)

        # Verify instance
        assert isinstance(provider, BaseProvider)
        assert isinstance(provider, MockProvider)
        assert provider.config == config

    def test_create_provider_unknown(self) -> None:
        """Test error for unknown provider."""
        from cycling_ai.providers.factory import ProviderFactory

        config = ProviderConfig(
            provider_name="unknown_provider",
            api_key="test-key",
            model="test-model",
        )

        with pytest.raises(ValueError) as exc_info:
            ProviderFactory.create_provider(config)

        assert "Unknown provider 'unknown_provider'" in str(exc_info.value)
        assert "Available providers:" in str(exc_info.value)

    def test_list_providers(self) -> None:
        """Test listing all registered providers."""
        from cycling_ai.providers.factory import ProviderFactory

        # Register mock provider
        ProviderFactory.register_provider("mock", MockProvider)

        # Get list
        providers = ProviderFactory.list_providers()

        # Should be sorted
        assert providers == sorted(providers)

        # Should contain mock
        assert "mock" in providers

    def test_case_insensitive_provider_names(self) -> None:
        """Test that provider names are case-insensitive."""
        from cycling_ai.providers.factory import ProviderFactory

        # Register with lowercase
        ProviderFactory.register_provider("mock", MockProvider)

        # Create with uppercase
        config = ProviderConfig(
            provider_name="MOCK",
            api_key="test-key",
            model="test-model",
        )
        provider = ProviderFactory.create_provider(config)

        # Should work
        assert isinstance(provider, MockProvider)
