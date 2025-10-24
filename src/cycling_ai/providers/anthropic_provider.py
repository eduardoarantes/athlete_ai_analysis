"""
Anthropic provider adapter.

Implements the provider interface for Anthropic's Claude models.
Supports native tool use via the Messages API.
"""
from __future__ import annotations

import json
from typing import Any

import anthropic

from cycling_ai.providers.base import (
    BaseProvider,
    CompletionResponse,
    ProviderConfig,
    ProviderMessage,
)
from cycling_ai.providers.provider_utils import retry_with_exponential_backoff
from cycling_ai.tools.base import ToolDefinition, ToolExecutionResult


class AnthropicProvider(BaseProvider):
    """
    Anthropic Claude provider adapter.

    Supports Claude 3.5 Sonnet, Claude 3 Opus, and other Claude models
    with native tool use capabilities via the Messages API.

    Example:
        >>> config = ProviderConfig(
        ...     provider_name="anthropic",
        ...     api_key="sk-ant-...",
        ...     model="claude-3-5-sonnet-20241022"
        ... )
        >>> provider = AnthropicProvider(config)
        >>> response = provider.create_completion(messages)
    """

    def __init__(self, config: ProviderConfig):
        """
        Initialize Anthropic provider.

        Args:
            config: Provider configuration including API key and model
        """
        super().__init__(config)
        self.client = anthropic.Anthropic(api_key=config.api_key)

    def convert_tool_schema(self, tools: list[ToolDefinition]) -> list[dict[str, Any]]:
        """
        Convert generic tool definitions to Anthropic tool schema format.

        Args:
            tools: List of generic tool definitions

        Returns:
            List of Anthropic tool schemas

        Example:
            >>> schema = provider.convert_tool_schema([tool_def])
            >>> schema[0]["name"]
            'analyze_performance'
        """
        anthropic_tools = []

        for tool in tools:
            properties: dict[str, Any] = {}
            required: list[str] = []

            for param in tool.parameters:
                properties[param.name] = {
                    "type": param.type,
                    "description": param.description,
                }
                if param.enum:
                    properties[param.name]["enum"] = param.enum
                if param.required:
                    required.append(param.name)

            anthropic_tools.append(
                {
                    "name": tool.name,
                    "description": tool.description,
                    "input_schema": {
                        "type": "object",
                        "properties": properties,
                        "required": required,
                    },
                }
            )

        return anthropic_tools

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
        Format tool execution result for Anthropic.

        Args:
            result: Tool execution result

        Returns:
            Anthropic-format tool result message

        Example:
            >>> formatted = provider.format_response(result)
            >>> formatted["role"]
            'user'
        """
        return {
            "role": "user",
            "content": [
                {
                    "type": "tool_result",
                    "content": json.dumps(result.to_dict()),
                }
            ],
        }

    @retry_with_exponential_backoff(max_retries=3, initial_delay=1.0)
    def create_completion(
        self,
        messages: list[ProviderMessage],
        tools: list[ToolDefinition] | None = None,
    ) -> CompletionResponse:
        """
        Create completion using Anthropic Messages API.

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
            # Separate system message from conversation
            system_msg = None
            user_messages: list[dict[str, Any]] = []

            for msg in messages:
                if msg.role == "system":
                    system_msg = msg.content
                else:
                    user_messages.append({"role": msg.role, "content": msg.content})

            # Build request parameters
            request_params: dict[str, Any] = {
                "model": self.config.model,
                "messages": user_messages,
                "max_tokens": self.config.max_tokens,
                "temperature": self.config.temperature,
            }

            # Add system message if present
            if system_msg:
                request_params["system"] = system_msg

            # Add tools if provided
            if tools:
                request_params["tools"] = self.convert_tool_schema(tools)

            # Call Anthropic API
            response = self.client.messages.create(**request_params)

            # Parse content blocks
            content = ""
            tool_calls = None

            for block in response.content:
                if block.type == "text":
                    content += block.text
                elif block.type == "tool_use":
                    if tool_calls is None:
                        tool_calls = []
                    tool_calls.append(
                        {
                            "name": block.name,
                            "arguments": block.input,
                            "id": block.id,
                        }
                    )

            return CompletionResponse(
                content=content,
                tool_calls=tool_calls,
                metadata={
                    "model": response.model,
                    "usage": {
                        "input_tokens": response.usage.input_tokens,
                        "output_tokens": response.usage.output_tokens,
                    },
                    "stop_reason": response.stop_reason,
                },
            )

        except anthropic.AuthenticationError as e:
            raise ValueError(f"Invalid Anthropic API key: {e}") from e
        except anthropic.APIError as e:
            raise RuntimeError(f"Anthropic API error: {e}") from e
