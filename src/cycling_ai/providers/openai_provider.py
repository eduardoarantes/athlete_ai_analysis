"""
OpenAI provider adapter.

Implements the provider interface for OpenAI's GPT models (GPT-4, GPT-3.5-turbo).
Supports native function calling and tool use.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

import openai

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


def _normalize_type(type_str: str) -> str:
    """
    Normalize type string to lowercase for OpenAI compatibility.

    Args:
        type_str: Type string (may be uppercase or lowercase)

    Returns:
        Lowercase type string
    """
    return type_str.lower()


def _convert_items_schema(items: dict[str, Any]) -> dict[str, Any]:
    """
    Recursively convert items schema to OpenAI format.

    Handles nested objects, arrays, and type normalization.

    Args:
        items: Items schema dictionary

    Returns:
        OpenAI-format items schema
    """
    result: dict[str, Any] = {}

    # Normalize type to lowercase
    if "type" in items:
        result["type"] = _normalize_type(items["type"])

    # Copy description
    if "description" in items:
        result["description"] = items["description"]

    # Process properties for object types
    if "properties" in items:
        properties = {}
        for key, value in items["properties"].items():
            prop: dict[str, Any] = {}

            # Normalize type
            if "type" in value:
                prop["type"] = _normalize_type(value["type"])

            # Copy description
            if "description" in value:
                prop["description"] = value["description"]

            # Recursively process nested items
            if "items" in value:
                prop["items"] = _convert_items_schema(value["items"])

            # Recursively process nested properties (for nested objects)
            if "properties" in value:
                nested_result = _convert_items_schema(value)
                prop["properties"] = nested_result["properties"]
                if "required" in nested_result:
                    prop["required"] = nested_result["required"]

            properties[key] = prop

        result["properties"] = properties

        # Copy required fields
        if "required" in items:
            result["required"] = items["required"]

    # Recursively process nested items (for arrays)
    if "items" in items:
        result["items"] = _convert_items_schema(items["items"])

    return result


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
        openai_tools = []

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
                if param.items:
                    # Convert items schema for array types
                    properties[param.name]["items"] = _convert_items_schema(param.items)
                if param.required:
                    required.append(param.name)

            openai_tools.append(
                {
                    "type": "function",
                    "function": {
                        "name": tool.name,
                        "description": tool.description,
                        "parameters": {
                            "type": "object",
                            "properties": properties,
                            "required": required,
                        },
                    },
                }
            )

        return openai_tools

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
        import logging

        from cycling_ai.tools.registry import get_global_registry

        logger = logging.getLogger(__name__)
        logger.debug(f"[OPENAI PROVIDER] invoke_tool called: {tool_name}")
        logger.debug(f"[OPENAI PROVIDER] Parameters: {parameters}")

        try:
            registry = get_global_registry()
            tool = registry.get_tool(tool_name)
            logger.debug(f"[OPENAI PROVIDER] Tool retrieved from registry: {tool.definition.name}")

            result = tool.execute(**parameters)
            logger.info(f"[OPENAI PROVIDER] Tool {tool_name} executed: success={result.success}")
            if not result.success:
                logger.warning(f"[OPENAI PROVIDER] Tool {tool_name} errors: {result.errors}")
            return result
        except Exception as e:
            logger.error(f"[OPENAI PROVIDER] Tool {tool_name} execution failed: {e}", exc_info=True)
            raise

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
        force_tool_call: bool = False,
    ) -> CompletionResponse:
        """
        Create completion using OpenAI Chat Completion API.

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
            # Convert messages to OpenAI format
            openai_messages: list[dict[str, Any]] = []
            for m in messages:
                msg: dict[str, Any] = {"role": m.role, "content": m.content}

                # If assistant message has tool_calls, include them
                if m.role == "assistant" and m.tool_calls:
                    # Convert to OpenAI format with proper structure
                    msg["tool_calls"] = [
                        {
                            "id": tc.get("id"),
                            "type": "function",
                            "function": {
                                "name": tc.get("name"),
                                "arguments": json.dumps(tc.get("arguments", {})),
                            },
                        }
                        for tc in m.tool_calls
                    ]

                # If tool message, include tool_call_id
                elif m.role == "tool" and m.tool_results:
                    # Extract tool_call_id from tool_results
                    tool_call_id = m.tool_results[0].get("tool_call_id")
                    if tool_call_id:
                        msg["tool_call_id"] = tool_call_id

                openai_messages.append(msg)

            # Build request parameters with model-specific logic
            # Ensures compatibility across GPT-3.5, GPT-4, GPT-4o, GPT-5, and reasoning variants
            model_name = self.config.model

            # Base payload (always required)
            request_params: dict[str, Any] = {
                "model": model_name,
                "messages": openai_messages,
            }

            # --- Token parameter logic ---
            # Determine which token limit parameter to use based on model family
            # IMPORTANT: Check reasoning models FIRST before checking gpt-4o/gpt-5
            # (since "gpt-4o-reasoning" contains "gpt-4o")

            # --- Token parameter logic ---
            if any(
                m in model_name
                for m in [
                    "gpt-3.5",  # legacy models
                    "gpt-4-0613",
                    "gpt-4-turbo-1106",
                ]
            ):
                request_params["max_tokens"] = self.config.max_tokens

            elif any(
                m in model_name
                for m in [
                    "gpt-4.1",  # modern unified API
                    "gpt-4o",
                    "gpt-4o-mini",
                    "gpt-5",
                    "gpt-5-mini",
                ]
            ):
                request_params["max_completion_tokens"] = self.config.max_tokens

            elif "reasoning" in model_name:
                request_params["max_output_tokens"] = self.config.max_tokens

            else:
                # Fallback — assume modern API structure
                request_params["max_completion_tokens"] = self.config.max_tokens

            # --- Temperature logic ---
            # Reasoning models only accept temperature=1
            if "reasoning" in model_name or any(m in model_name for m in ["o1", "o3"]) or model_name == "gpt-5-mini":
                request_params["temperature"] = 1
            else:
                request_params["temperature"] = self.config.temperature

            # Add tools if provided
            if tools:
                request_params["tools"] = self.convert_tool_schema(tools)

                # Force tool calling if requested by phase configuration
                # This is crucial for phases like training_planning where the LLM
                # must call the tool rather than just explaining what it plans to do
                if force_tool_call:
                    request_params["tool_choice"] = "required"

            # Track timing
            start_time = time.time()

            # Call OpenAI API
            response = self.client.chat.completions.create(**request_params)

            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000

            # Extract response content
            content = response.choices[0].message.content or ""
            tool_calls = None

            # Extract tool calls if present
            if response.choices[0].message.tool_calls:
                tool_calls = []
                for tc in response.choices[0].message.tool_calls:
                    try:
                        arguments = json.loads(tc.function.arguments)
                        tool_calls.append(
                            {
                                "name": tc.function.name,
                                "arguments": arguments,
                                "id": tc.id,
                            }
                        )
                    except json.JSONDecodeError as e:
                        # Log the malformed JSON for debugging
                        logger.error(f"Failed to parse tool call arguments for {tc.function.name}: {e}")
                        logger.error(f"Malformed JSON (first 500 chars): {tc.function.arguments[:500]}")
                        logger.error(f"Malformed JSON (last 500 chars): {tc.function.arguments[-500:]}")
                        logger.error(f"JSON length: {len(tc.function.arguments)} characters")
                        # Re-raise as a permanent error
                        raise ValueError(
                            f"OpenAI returned malformed JSON for tool call {tc.function.name}: {e}. "
                            f"JSON length: {len(tc.function.arguments)} characters. "
                            f"This may indicate the response payload is too large."
                        ) from e

            completion_response = CompletionResponse(
                content=content,
                tool_calls=tool_calls,
                metadata={
                    "model": response.model,
                    "usage": response.usage.model_dump(),
                    "finish_reason": response.choices[0].finish_reason,
                },
            )

            # Log the interaction
            try:
                interaction_logger = get_interaction_logger()
                interaction_logger.log_interaction(
                    provider_name="openai",
                    model=self.config.model,
                    messages=messages,
                    tools=tools,
                    response=completion_response,
                    duration_ms=duration_ms,
                )
            except Exception as e:
                # Don't fail the request if logging fails
                import logging as log

                log.warning(f"Failed to log LLM interaction: {e}")

            return completion_response

        except openai.AuthenticationError as e:
            raise ValueError(f"Invalid OpenAI API key: {e}") from e
        except openai.APIError as e:
            raise RuntimeError(f"OpenAI API error: {e}") from e
