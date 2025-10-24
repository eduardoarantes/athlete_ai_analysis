"""
Tests for OpenAI provider adapter.

Tests OpenAI-specific functionality including schema conversion,
completion creation, and tool calling.
"""
from __future__ import annotations

import json
from typing import Any
from unittest.mock import Mock, patch

import pytest

from cycling_ai.providers.base import CompletionResponse, ProviderConfig, ProviderMessage
from cycling_ai.tools.base import ToolDefinition


@pytest.fixture
def openai_config() -> ProviderConfig:
    """Create OpenAI provider config for testing."""
    return ProviderConfig(
        provider_name="openai",
        api_key="sk-test-key",
        model="gpt-4",
        max_tokens=2048,
        temperature=0.7,
    )


class TestOpenAIProvider:
    """Tests for OpenAI provider adapter."""

    def test_initialization(self, openai_config: ProviderConfig) -> None:
        """Test provider initializes correctly."""
        from cycling_ai.providers.openai_provider import OpenAIProvider

        provider = OpenAIProvider(openai_config)
        assert provider.config.provider_name == "openai"
        assert provider.config.model == "gpt-4"
        assert provider.config.api_key == "sk-test-key"

    def test_convert_tool_schema(
        self, openai_config: ProviderConfig, sample_tool_definition: ToolDefinition
    ) -> None:
        """Test tool schema conversion to OpenAI format."""
        from cycling_ai.providers.openai_provider import OpenAIProvider

        provider = OpenAIProvider(openai_config)
        schema = provider.convert_tool_schema([sample_tool_definition])

        assert len(schema) == 1
        tool_schema = schema[0]

        # Check structure
        assert tool_schema["type"] == "function"
        assert "function" in tool_schema

        func = tool_schema["function"]
        assert func["name"] == "analyze_performance"
        assert func["description"] == "Analyze cycling performance data"

        # Check parameters
        params = func["parameters"]
        assert params["type"] == "object"
        assert "properties" in params
        assert "required" in params

        # Verify required parameters
        assert "period_months" in params["required"]
        assert "metric_type" in params["required"]
        assert "include_cross_training" not in params["required"]

    @patch("cycling_ai.providers.openai_provider.openai.OpenAI")
    def test_create_completion_no_tools(
        self, mock_openai_class: Mock, openai_config: ProviderConfig
    ) -> None:
        """Test completion without tool calls."""
        from cycling_ai.providers.openai_provider import OpenAIProvider

        # Mock OpenAI response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "Hello, world!"
        mock_response.choices[0].message.tool_calls = None
        mock_response.choices[0].finish_reason = "stop"
        mock_response.model = "gpt-4"
        mock_response.usage.model_dump.return_value = {
            "prompt_tokens": 10,
            "completion_tokens": 5,
            "total_tokens": 15,
        }

        mock_client = Mock()
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai_class.return_value = mock_client

        # Test
        provider = OpenAIProvider(openai_config)
        messages = [ProviderMessage(role="user", content="Hello")]
        response = provider.create_completion(messages)

        assert response.content == "Hello, world!"
        assert response.tool_calls is None
        assert response.metadata["model"] == "gpt-4"
        assert response.metadata["usage"]["total_tokens"] == 15

    @patch("cycling_ai.providers.openai_provider.openai.OpenAI")
    def test_create_completion_with_tools(
        self,
        mock_openai_class: Mock,
        openai_config: ProviderConfig,
        sample_tool_definition: ToolDefinition,
    ) -> None:
        """Test completion with tool calls."""
        from cycling_ai.providers.openai_provider import OpenAIProvider

        # Mock tool call response
        mock_tool_call = Mock()
        mock_tool_call.id = "call_123"
        mock_tool_call.function.name = "analyze_performance"
        mock_tool_call.function.arguments = '{"period_months": 6, "metric_type": "power"}'

        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = ""
        mock_response.choices[0].message.tool_calls = [mock_tool_call]
        mock_response.choices[0].finish_reason = "tool_calls"
        mock_response.model = "gpt-4"
        mock_response.usage.model_dump.return_value = {"total_tokens": 20}

        mock_client = Mock()
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai_class.return_value = mock_client

        # Test
        provider = OpenAIProvider(openai_config)
        messages = [ProviderMessage(role="user", content="Analyze my performance")]
        tools = [sample_tool_definition]
        response = provider.create_completion(messages, tools)

        assert response.tool_calls is not None
        assert len(response.tool_calls) == 1
        assert response.tool_calls[0]["name"] == "analyze_performance"
        assert response.tool_calls[0]["arguments"]["period_months"] == 6
        assert response.tool_calls[0]["id"] == "call_123"

    @patch("cycling_ai.providers.openai_provider.openai.OpenAI")
    def test_create_completion_authentication_error(
        self, mock_openai_class: Mock, openai_config: ProviderConfig
    ) -> None:
        """Test error handling for authentication failures."""
        from cycling_ai.providers.openai_provider import OpenAIProvider

        # Mock authentication error
        import openai

        mock_client = Mock()
        mock_client.chat.completions.create.side_effect = openai.AuthenticationError(
            "Invalid API key", response=Mock(), body=None
        )
        mock_openai_class.return_value = mock_client

        # Test
        provider = OpenAIProvider(openai_config)
        messages = [ProviderMessage(role="user", content="Hello")]

        with pytest.raises(ValueError, match="Invalid OpenAI API key"):
            provider.create_completion(messages)

    @patch("cycling_ai.providers.openai_provider.openai.OpenAI")
    def test_create_completion_retry_on_connection_error(
        self, mock_openai_class: Mock, openai_config: ProviderConfig
    ) -> None:
        """Test retry logic for connection errors."""
        from cycling_ai.providers.openai_provider import OpenAIProvider

        # Mock connection error followed by success
        import openai

        call_count = 0

        def side_effect(*args: Any, **kwargs: Any) -> Mock:
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise openai.APIConnectionError(request=Mock())

            # Return success on second call
            mock_response = Mock()
            mock_response.choices = [Mock()]
            mock_response.choices[0].message.content = "Success"
            mock_response.choices[0].message.tool_calls = None
            mock_response.choices[0].finish_reason = "stop"
            mock_response.model = "gpt-4"
            mock_response.usage.model_dump.return_value = {"total_tokens": 10}
            return mock_response

        mock_client = Mock()
        mock_client.chat.completions.create.side_effect = side_effect
        mock_openai_class.return_value = mock_client

        # Test
        provider = OpenAIProvider(openai_config)
        messages = [ProviderMessage(role="user", content="Hello")]
        response = provider.create_completion(messages)

        assert response.content == "Success"
        assert call_count == 2  # Should retry once

    def test_format_response(self, openai_config: ProviderConfig) -> None:
        """Test tool result formatting for OpenAI."""
        from cycling_ai.providers.openai_provider import OpenAIProvider
        from cycling_ai.tools.base import ToolExecutionResult

        provider = OpenAIProvider(openai_config)
        result = ToolExecutionResult(
            success=True,
            data={"analysis": "Great performance!"},
            format="json",
        )

        formatted = provider.format_response(result)

        assert formatted["role"] == "tool"
        assert "content" in formatted
        # Content should be JSON string
        content_data = json.loads(formatted["content"])
        assert content_data["success"] is True
        assert content_data["data"]["analysis"] == "Great performance!"
