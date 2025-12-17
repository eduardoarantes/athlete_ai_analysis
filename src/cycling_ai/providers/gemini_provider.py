"""
Google Gemini provider adapter.

Implements the provider interface for Google's Gemini models.
Supports function calling via function declarations.

Uses the new google-genai SDK (unified Google Gen AI SDK).
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from google import genai
from google.genai import types

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


class GeminiProvider(BaseProvider):
    """
    Google Gemini provider adapter.

    Supports Gemini 1.5 Pro, Gemini 2.0 Flash, and other Gemini models
    with function calling capabilities.

    Example:
        >>> config = ProviderConfig(
        ...     provider_name="gemini",
        ...     api_key="...",
        ...     model="gemini-2.5-flash"
        ... )
        >>> provider = GeminiProvider(config)
        >>> response = provider.create_completion(messages)
    """

    def __init__(self, config: ProviderConfig):
        """
        Initialize Gemini provider.

        Args:
            config: Provider configuration including API key and model
        """
        super().__init__(config)
        self.client = genai.Client(api_key=config.api_key)

    def convert_tool_schema(self, tools: list[ToolDefinition]) -> list[types.Tool]:
        """
        Convert generic tool definitions to Gemini Tool objects.

        Args:
            tools: List of generic tool definitions

        Returns:
            List of Gemini Tool objects with function declarations

        Example:
            >>> tools_schema = provider.convert_tool_schema([tool_def])
        """
        function_declarations = []

        for tool in tools:
            properties: dict[str, types.Schema] = {}
            required: list[str] = []

            for param in tool.parameters:
                # Gemini uses uppercase type names (STRING, INTEGER, etc.)
                # Convert string type to types.Type enum
                type_map = {
                    "string": types.Type.STRING,
                    "number": types.Type.NUMBER,
                    "integer": types.Type.INTEGER,
                    "boolean": types.Type.BOOLEAN,
                    "array": types.Type.ARRAY,
                    "object": types.Type.OBJECT,
                }
                param_type = type_map.get(param.type.lower(), types.Type.STRING)

                param_schema = types.Schema(
                    type=param_type,
                    description=param.description,
                )
                if param.enum:
                    param_schema.enum = param.enum
                # Add items schema for array types (required by Gemini)
                if param.type == "array" and param.items and isinstance(param.items, dict):
                    item_type_str = param.items.get("type", "string")
                    item_type = type_map.get(item_type_str.lower(), types.Type.STRING)
                    param_schema.items = types.Schema(type=item_type)
                properties[param.name] = param_schema

                if param.required:
                    required.append(param.name)

            func_decl = types.FunctionDeclaration(
                name=tool.name,
                description=tool.description,
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties=properties,
                    required=required,
                ),
            )
            function_declarations.append(func_decl)

        # Wrap function declarations in a Tool object
        return [types.Tool(function_declarations=function_declarations)]

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

        logger.debug(f"[GEMINI PROVIDER] invoke_tool called: {tool_name}")
        logger.debug(f"[GEMINI PROVIDER] Parameters: {parameters}")

        try:
            registry = get_global_registry()
            tool = registry.get_tool(tool_name)
            logger.debug(f"[GEMINI PROVIDER] Tool retrieved from registry: {tool.definition.name}")

            result = tool.execute(**parameters)
            logger.info(f"[GEMINI PROVIDER] Tool {tool_name} executed: success={result.success}")
            if not result.success:
                logger.warning(f"[GEMINI PROVIDER] Tool {tool_name} errors: {result.errors}")
            return result
        except Exception as e:
            logger.error(f"[GEMINI PROVIDER] Tool {tool_name} execution failed: {e}", exc_info=True)
            raise

    def format_response(self, result: ToolExecutionResult) -> dict[str, Any]:
        """
        Format tool execution result for Gemini.

        Args:
            result: Tool execution result

        Returns:
            Gemini-format function response

        Example:
            >>> formatted = provider.format_response(result)
            >>> formatted["role"]
            'function'
        """
        return {"role": "function", "parts": [{"function_response": result.to_dict()}]}

    @retry_with_exponential_backoff(max_retries=3, initial_delay=1.0)
    def create_completion(
        self,
        messages: list[ProviderMessage],
        tools: list[ToolDefinition] | None = None,
        force_tool_call: bool = False,
    ) -> CompletionResponse:
        """
        Create completion using Gemini API.

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
        # Start timing
        start_time = time.time()

        try:
            if not messages:
                raise ValueError("messages list cannot be empty")

            # Build contents list from messages
            contents: list[types.Content] = []

            for msg in messages:
                if not msg or not hasattr(msg, "role") or not hasattr(msg, "content"):
                    continue

                # Handle tool/function results specially
                if msg.role == "tool":
                    # Tool results need to be formatted as function responses
                    try:
                        tool_data = json.loads(msg.content) if msg.content else {}
                    except json.JSONDecodeError:
                        tool_data = {"response": msg.content}

                    # Extract tool name from tool_results metadata
                    tool_name = "unknown"
                    if hasattr(msg, "tool_results") and msg.tool_results:
                        tool_name = msg.tool_results[0].get("tool_name", "unknown")

                    # DEBUG: Print what we're sending to Gemini
                    logger.info(
                        f"[GEMINI DEBUG] Adding function response: name={tool_name}, data_keys={list(tool_data.keys())}"
                    )

                    contents.append(
                        types.Content(
                            role="function",
                            parts=[
                                types.Part(function_response=types.FunctionResponse(name=tool_name, response=tool_data))
                            ],
                        )
                    )
                else:
                    # Regular messages
                    role = "user" if msg.role in ("user", "system") else "model"
                    content = msg.content if msg.content is not None else ""

                    # Handle assistant messages with tool calls
                    if msg.role == "assistant" and hasattr(msg, "tool_calls") and msg.tool_calls:
                        # Assistant is making function calls
                        parts: list[types.Part] = []

                        # Add text content if present
                        if content:
                            parts.append(types.Part(text=content))

                        # Add function calls
                        for tool_call in msg.tool_calls:
                            parts.append(
                                types.Part(
                                    function_call=types.FunctionCall(
                                        name=tool_call.get("name", ""),
                                        args=tool_call.get("arguments", {}),
                                    )
                                )
                            )

                        contents.append(types.Content(role=role, parts=parts))
                    else:
                        # Regular text message
                        contents.append(types.Content(role=role, parts=[types.Part(text=content)]))

            # Build configuration
            config_kwargs: dict[str, Any] = {
                "temperature": self.config.temperature,
                "max_output_tokens": self.config.max_tokens,
            }

            # Add tools if provided
            if tools:
                config_kwargs["tools"] = self.convert_tool_schema(tools)
                # Disable automatic function calling since we handle it manually
                config_kwargs["automatic_function_calling"] = types.AutomaticFunctionCallingConfig(disable=True)

            # Configure tool calling behavior
            if tools and force_tool_call:
                # Force tool calling if requested by phase configuration
                # This is crucial for phases like training_planning where the LLM
                # must call the tool rather than just explaining what it plans to do
                config_kwargs["tool_config"] = types.ToolConfig(
                    function_calling_config=types.FunctionCallingConfig(mode=types.FunctionCallingConfigMode.ANY)
                )

            generate_config = types.GenerateContentConfig(**config_kwargs)

            # Call the API
            response = self.client.models.generate_content(
                model=self.config.model,
                contents=contents,  # type: ignore[arg-type]  # list[Content] is compatible at runtime
                config=generate_config,
            )

            # Extract function calls first (to avoid accessing .text when there are function calls)
            content = ""
            tool_calls = None

            if hasattr(response, "candidates") and response.candidates:
                candidate = response.candidates[0]
                if (
                    hasattr(candidate, "content")
                    and candidate.content is not None
                    and hasattr(candidate.content, "parts")
                    and candidate.content.parts is not None
                ):
                    # Check if response contains function calls
                    has_function_calls = False
                    for i, part in enumerate(candidate.content.parts):
                        if hasattr(part, "function_call") and part.function_call:
                            has_function_calls = True
                            # Skip if function_call.name is empty or missing
                            has_name = hasattr(part.function_call, "name")
                            if not has_name or not part.function_call.name:
                                continue

                            if tool_calls is None:
                                tool_calls = []
                            # Convert args to dict, handling None case
                            args = part.function_call.args if part.function_call.args is not None else {}
                            tool_calls.append(
                                {
                                    "name": part.function_call.name,
                                    "arguments": dict(args),
                                    "id": f"call_{i}",  # Gemini doesn't provide IDs
                                }
                            )

                    # Only try to access .text if there are no function calls
                    # (accessing .text when function calls exist triggers SDK warning)
                    if not has_function_calls:
                        try:
                            if hasattr(response, "text") and response.text:
                                content = response.text
                        except (ValueError, AttributeError):
                            # response.text can raise ValueError if there's no text content
                            logger.debug("No text content in response")
            else:
                # No candidates, try to get text anyway
                try:
                    if hasattr(response, "text") and response.text:
                        content = response.text
                except (ValueError, AttributeError):
                    logger.debug("No text content in response")

            metadata: dict[str, Any] = {"model": self.config.model}
            if hasattr(response, "usage_metadata") and response.usage_metadata is not None:
                metadata["usage"] = {
                    "prompt_tokens": response.usage_metadata.prompt_token_count,
                    "total_tokens": response.usage_metadata.total_token_count,
                }
            if hasattr(response, "candidates") and response.candidates:
                metadata["finish_reason"] = str(response.candidates[0].finish_reason)

            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000

            # Create response object
            completion_response = CompletionResponse(content=content, tool_calls=tool_calls, metadata=metadata)

            # Log the interaction
            try:
                interaction_logger = get_interaction_logger()
                interaction_logger.log_interaction(
                    provider_name="gemini",
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

        except Exception as e:
            # Gemini exceptions are not well-typed, check by name
            if "unauthenticated" in str(e).lower():
                raise ValueError(f"Invalid Gemini API key: {e}") from e
            # Add better context for debugging
            import traceback

            tb_str = "".join(traceback.format_tb(e.__traceback__))
            raise RuntimeError(f"Gemini API error: {e}\nTraceback:\n{tb_str}") from e
