"""
OpenAI provider adapter.

Implements the provider interface for OpenAI's GPT models (GPT-4, GPT-3.5-turbo).
Supports native function calling and tool use.
"""
from __future__ import annotations

import json
from typing import Any

import openai

from cycling_ai.providers.base import (
    BaseProvider,
    CompletionResponse,
    ProviderConfig,
    ProviderMessage,
)
from cycling_ai.providers.provider_utils import retry_with_exponential_backoff
from cycling_ai.tools.base import ToolDefinition, ToolExecutionResult


class OpenAIProvider(BaseProvider):
    """
    OpenAI provider adapter for GPT models.

    Supports GPT-4, GPT-4 Turbo, GPT-3.5 Turbo with native function calling.

    Example:
        >>> config = ProviderConfig(
        ...     provider_name="openai",
        ...     api_key="sk-...",
        ...     model="gpt-4"
        ... )
        >>> provider = OpenAIProvider(config)
        >>> response = provider.create_completion(messages)
    """

    def __init__(self, config: ProviderConfig):
        """
        Initialize OpenAI provider.

        Args:
            config: Provider configuration including API key and model
        """
        super().__init__(config)
        self.client = openai.OpenAI(api_key=config.api_key)

    def convert_tool_schema(self, tools: list[ToolDefinition]) -> list[dict[str, Any]]:
        """
        Convert generic tool definitions to OpenAI function schema format.

        Args:
            tools: List of generic tool definitions

        Returns:
            List of OpenAI function schemas

        Example:
            >>> schema = provider.convert_tool_schema([tool_def])
            >>> schema[0]["type"]
            'function'
        """
        from cycling_ai.providers.provider_utils import convert_to_openai_format

        return convert_to_openai_format(tools)

    def invoke_tool(self, tool_name: str, parameters: dict[str, Any]) -> ToolExecutionResult:
        """
        Execute a tool by delegating to the tool registry.

        Args:
            tool_name: Name of the tool to invoke
            parameters: Tool parameters

        Returns:
            Tool execution result

        Example:
            >>> result = provider.invoke_tool("analyze_performance", {"period_months": 6})
        """
        from cycling_ai.tools.registry import get_global_registry

        registry = get_global_registry()
        tool = registry.get_tool(tool_name)
        return tool.execute(**parameters)

    def format_response(self, result: ToolExecutionResult) -> dict[str, Any]:
        """
        Format tool execution result for OpenAI.

        Args:
            result: Tool execution result

        Returns:
            OpenAI-format tool message

        Example:
            >>> formatted = provider.format_response(result)
            >>> formatted["role"]
            'tool'
        """
        return {
            "role": "tool",
            "content": json.dumps(result.to_dict()),
        }

    @retry_with_exponential_backoff(max_retries=3, initial_delay=1.0)
    def create_completion(
        self,
        messages: list[ProviderMessage],
        tools: list[ToolDefinition] | None = None,
    ) -> CompletionResponse:
        """
        Create completion using OpenAI Chat Completion API.

        Args:
            messages: Conversation messages
            tools: Available tools (optional)

        Returns:
            Standardized completion response

        Raises:
            ValueError: If authentication fails
            RuntimeError: If API error occurs

        Example:
            >>> messages = [ProviderMessage(role="user", content="Hello")]
            >>> response = provider.create_completion(messages)
        """
        try:
            # Convert messages to OpenAI format
            openai_messages = [{"role": m.role, "content": m.content} for m in messages]

            # Build request parameters
            request_params: dict[str, Any] = {
                "model": self.config.model,
                "messages": openai_messages,
                "max_tokens": self.config.max_tokens,
                "temperature": self.config.temperature,
            }

            # Add tools if provided
            if tools:
                request_params["tools"] = self.convert_tool_schema(tools)

            # Call OpenAI API
            response = self.client.chat.completions.create(**request_params)

            # Extract response content
            content = response.choices[0].message.content or ""
            tool_calls = None

            # Extract tool calls if present
            if response.choices[0].message.tool_calls:
                tool_calls = [
                    {
                        "name": tc.function.name,
                        "arguments": json.loads(tc.function.arguments),
                        "id": tc.id,
                    }
                    for tc in response.choices[0].message.tool_calls
                ]

            return CompletionResponse(
                content=content,
                tool_calls=tool_calls,
                metadata={
                    "model": response.model,
                    "usage": response.usage.model_dump(),
                    "finish_reason": response.choices[0].finish_reason,
                },
            )

        except openai.AuthenticationError as e:
            raise ValueError(f"Invalid OpenAI API key: {e}") from e
        except openai.APIError as e:
            raise RuntimeError(f"OpenAI API error: {e}") from e
