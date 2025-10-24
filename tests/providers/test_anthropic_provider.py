"""
Tests for Anthropic provider adapter.

Tests Anthropic-specific functionality including schema conversion,
completion creation with system messages, and content block parsing.
"""
from __future__ import annotations

import json
from typing import Any
from unittest.mock import Mock, patch

import pytest

from cycling_ai.providers.base import CompletionResponse, ProviderConfig, ProviderMessage
from cycling_ai.tools.base import ToolDefinition


@pytest.fixture
def anthropic_config() -> ProviderConfig:
    """Create Anthropic provider config for testing."""
    return ProviderConfig(
        provider_name="anthropic",
        api_key="sk-ant-test-key",
        model="claude-3-5-sonnet-20241022",
        max_tokens=2048,
        temperature=0.7,
    )


class TestAnthropicProvider:
    """Tests for Anthropic provider adapter."""

    def test_initialization(self, anthropic_config: ProviderConfig) -> None:
        """Test provider initializes correctly."""
        from cycling_ai.providers.anthropic_provider import AnthropicProvider

        provider = AnthropicProvider(anthropic_config)
        assert provider.config.provider_name == "anthropic"
        assert provider.config.model == "claude-3-5-sonnet-20241022"

    def test_convert_tool_schema(
        self, anthropic_config: ProviderConfig, sample_tool_definition: ToolDefinition
    ) -> None:
        """Test tool schema conversion to Anthropic format."""
        from cycling_ai.providers.anthropic_provider import AnthropicProvider

        provider = AnthropicProvider(anthropic_config)
        schema = provider.convert_tool_schema([sample_tool_definition])

        assert len(schema) == 1
        tool_schema = schema[0]

        # Check structure (Anthropic uses different format)
        assert tool_schema["name"] == "analyze_performance"
        assert tool_schema["description"] == "Analyze cycling performance data"

        # Check input_schema
        assert "input_schema" in tool_schema
        input_schema = tool_schema["input_schema"]
        assert input_schema["type"] == "object"
        assert "properties" in input_schema
        assert "required" in input_schema

    @patch("cycling_ai.providers.anthropic_provider.anthropic.Anthropic")
    def test_create_completion_with_system_message(
        self, mock_anthropic_class: Mock, anthropic_config: ProviderConfig
    ) -> None:
        """Test completion with system message handling."""
        from cycling_ai.providers.anthropic_provider import AnthropicProvider

        # Mock Anthropic response
        mock_text_block = Mock()
        mock_text_block.type = "text"
        mock_text_block.text = "Hello, world!"

        mock_response = Mock()
        mock_response.content = [mock_text_block]
        mock_response.model = "claude-3-5-sonnet-20241022"
        mock_response.usage.input_tokens = 10
        mock_response.usage.output_tokens = 5
        mock_response.stop_reason = "end_turn"

        mock_client = Mock()
        mock_client.messages.create.return_value = mock_response
        mock_anthropic_class.return_value = mock_client

        # Test with system message
        provider = AnthropicProvider(anthropic_config)
        messages = [
            ProviderMessage(role="system", content="You are a coach."),
            ProviderMessage(role="user", content="Hello"),
        ]
        response = provider.create_completion(messages)

        assert response.content == "Hello, world!"
        # Verify system message was passed separately
        call_args = mock_client.messages.create.call_args
        assert call_args[1]["system"] == "You are a coach."

    @patch("cycling_ai.providers.anthropic_provider.anthropic.Anthropic")
    def test_create_completion_with_tool_calls(
        self,
        mock_anthropic_class: Mock,
        anthropic_config: ProviderConfig,
        sample_tool_definition: ToolDefinition,
    ) -> None:
        """Test completion with tool calls."""
        from cycling_ai.providers.anthropic_provider import AnthropicProvider

        # Mock tool use block
        mock_tool_block = Mock()
        mock_tool_block.type = "tool_use"
        mock_tool_block.name = "analyze_performance"
        mock_tool_block.input = {"period_months": 6, "metric_type": "power"}
        mock_tool_block.id = "toolu_123"

        mock_response = Mock()
        mock_response.content = [mock_tool_block]
        mock_response.model = "claude-3-5-sonnet-20241022"
        mock_response.usage.input_tokens = 15
        mock_response.usage.output_tokens = 8
        mock_response.stop_reason = "tool_use"

        mock_client = Mock()
        mock_client.messages.create.return_value = mock_response
        mock_anthropic_class.return_value = mock_client

        # Test
        provider = AnthropicProvider(anthropic_config)
        messages = [ProviderMessage(role="user", content="Analyze performance")]
        tools = [sample_tool_definition]
        response = provider.create_completion(messages, tools)

        assert response.tool_calls is not None
        assert len(response.tool_calls) == 1
        assert response.tool_calls[0]["name"] == "analyze_performance"
        assert response.tool_calls[0]["id"] == "toolu_123"
