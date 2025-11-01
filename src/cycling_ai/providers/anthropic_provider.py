"""
Anthropic provider adapter.

Implements the provider interface for Anthropic's Claude models.
Supports native tool use via the Messages API.
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any

import anthropic

from cycling_ai.providers.base import (
    BaseProvider,
    CompletionResponse,
    ProviderConfig,
    ProviderMessage,
)
from cycling_ai.providers.interaction_logger import get_interaction_logger
from cycling_ai.providers.provider_utils import retry_with_exponential_backoff
from cycling_ai.tools.base import ToolDefinition, ToolExecutionResult

logger = logging.getLogger(__name__)


def _normalize_schema_types(schema: dict[str, Any]) -> dict[str, Any]:
    """
    Recursively normalize type values to lowercase for JSON Schema draft 2020-12 compliance.

    Anthropic requires strict adherence to JSON Schema specification, which mandates
    lowercase type values (e.g., "object", not "OBJECT").

    Args:
        schema: Schema dictionary to normalize

    Returns:
        Normalized schema with lowercase types
    """
    result: dict[str, Any] = {}

    for key, value in schema.items():
        if key == "type" and isinstance(value, str):
            # Normalize type to lowercase
            result[key] = value.lower()
        elif key == "properties" and isinstance(value, dict):
            # Recursively normalize nested properties
            result[key] = {
                prop_name: _normalize_schema_types(prop_value)
                for prop_name, prop_value in value.items()
            }
        elif key == "items" and isinstance(value, dict):
            # Recursively normalize array item schemas
            result[key] = _normalize_schema_types(value)
        else:
            # Copy other fields as-is
            result[key] = value

    return result


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
                    "type": param.type.lower(),  # Normalize to lowercase for JSON Schema compliance
                    "description": param.description,
                }
                if param.enum:
                    properties[param.name]["enum"] = param.enum
                if param.items:
                    # Handle array item schemas (for array-type parameters)
                    # Normalize types recursively for JSON Schema draft 2020-12 compliance
                    properties[param.name]["items"] = _normalize_schema_types(param.items)
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
        force_tool_call: bool = False,
    ) -> CompletionResponse:
        """
        Create completion using Anthropic Messages API.

        Args:
            messages: Conversation messages
            tools: Available tools (optional)
            force_tool_call: If True, force LLM to call tool instead of responding with text

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
                elif msg.role == "tool":
                    # Tool results must be sent as user messages with tool_result content
                    try:
                        tool_data = json.loads(msg.content) if msg.content else {}
                    except json.JSONDecodeError:
                        tool_data = {"response": msg.content}

                    # Extract tool_call_id from tool_results
                    tool_call_id = "unknown"
                    if msg.tool_results and len(msg.tool_results) > 0:
                        tool_call_id = msg.tool_results[0].get("tool_call_id", "unknown")

                    user_messages.append({
                        "role": "user",
                        "content": [{
                            "type": "tool_result",
                            "tool_use_id": tool_call_id,
                            "content": json.dumps(tool_data),
                        }]
                    })
                elif msg.role == "assistant":
                    # Assistant messages with tool calls need special handling
                    if msg.tool_calls:
                        # Convert tool calls to Anthropic's content block format
                        content_blocks: list[dict[str, Any]] = []

                        # Add text content if present
                        if msg.content:
                            content_blocks.append({"type": "text", "text": msg.content})

                        # Add tool_use blocks
                        for tc in msg.tool_calls:
                            content_blocks.append({
                                "type": "tool_use",
                                "id": tc.get("id"),
                                "name": tc.get("name"),
                                "input": tc.get("arguments", {}),
                            })

                        user_messages.append({
                            "role": "assistant",
                            "content": content_blocks,
                        })
                    else:
                        # Regular assistant message (skip if empty to avoid API errors)
                        if msg.content:
                            user_messages.append({"role": msg.role, "content": msg.content})
                else:
                    # User or other role messages
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

                # Force tool calling if requested by phase configuration
                # This is crucial for phases like training_planning where the LLM
                # must call the tool rather than just explaining what it plans to do
                if force_tool_call:
                    request_params["tool_choice"] = {"type": "any"}

            # Track timing
            start_time = time.time()

            # Call Anthropic API
            response = self.client.messages.create(**request_params)

            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000

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

            completion_response = CompletionResponse(
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

            # Log the interaction
            try:
                interaction_logger = get_interaction_logger()
                interaction_logger.log_interaction(
                    provider_name="anthropic",
                    model=self.config.model,
                    messages=messages,
                    tools=tools,
                    response=completion_response,
                    duration_ms=duration_ms,
                )
            except Exception as e:
                # Don't fail the request if logging fails
                logger.warning(f"Failed to log LLM interaction: {e}")

            return completion_response

        except anthropic.AuthenticationError as e:
            raise ValueError(f"Invalid Anthropic API key: {e}") from e
        except anthropic.APIError as e:
            raise RuntimeError(f"Anthropic API error: {e}") from e
