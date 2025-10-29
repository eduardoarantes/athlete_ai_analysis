"""
Google Gemini provider adapter.

Implements the provider interface for Google's Gemini models.
Supports function calling via function declarations.
"""
from __future__ import annotations

import time
from typing import Any

import google.generativeai as genai
from google.generativeai.types import FunctionDeclaration, Tool

from cycling_ai.providers.base import (
    BaseProvider,
    CompletionResponse,
    ProviderConfig,
    ProviderMessage,
)
from cycling_ai.providers.interaction_logger import get_interaction_logger
from cycling_ai.providers.provider_utils import retry_with_exponential_backoff
from cycling_ai.tools.base import ToolDefinition, ToolExecutionResult


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
        genai.configure(api_key=config.api_key)  # type: ignore[attr-defined]

    def convert_tool_schema(self, tools: list[ToolDefinition]) -> list[Tool]:
        """
        Convert generic tool definitions to Gemini function declarations.

        Args:
            tools: List of generic tool definitions

        Returns:
            List of Gemini Tool objects

        Example:
            >>> tools_schema = provider.convert_tool_schema([tool_def])
        """
        function_declarations = []

        for tool in tools:
            properties: dict[str, Any] = {}
            required: list[str] = []

            for param in tool.parameters:
                # Gemini uses uppercase type names (STRING, INTEGER, etc.)
                param_schema: dict[str, Any] = {
                    "type": param.type.upper(),
                    "description": param.description,
                }
                if param.enum:
                    param_schema["enum"] = param.enum
                # Add items schema for array types (required by Gemini)
                if param.type == "array" and param.items:
                    param_schema["items"] = param.items
                properties[param.name] = param_schema

                if param.required:
                    required.append(param.name)

            func_decl = FunctionDeclaration(
                name=tool.name,
                description=tool.description,
                parameters={
                    "type": "OBJECT",
                    "properties": properties,
                    "required": required,
                },
            )
            function_declarations.append(func_decl)

        return [Tool(function_declarations=function_declarations)]

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
    ) -> CompletionResponse:
        """
        Create completion using Gemini API.

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
        # Start timing
        start_time = time.time()

        try:
            if not messages:
                raise ValueError("messages list cannot be empty")

            # Create model with tools if provided
            model_kwargs: dict[str, Any] = {"model_name": self.config.model}
            if tools:
                model_kwargs["tools"] = self.convert_tool_schema(tools)

            model = genai.GenerativeModel(**model_kwargs)  # type: ignore[attr-defined]

            # Build chat history
            chat = model.start_chat(history=[])
            for msg in messages[:-1]:  # All but last message
                if not msg or not hasattr(msg, 'role') or not hasattr(msg, 'content'):
                    continue

                # Handle tool/function results specially
                if msg.role == "tool":
                    # Tool results need to be formatted as function responses
                    # Parse the JSON content and format as Gemini expects
                    import json
                    try:
                        tool_data = json.loads(msg.content) if msg.content else {}
                    except json.JSONDecodeError:
                        tool_data = {"response": msg.content}

                    # Extract tool name from tool_results metadata
                    tool_name = "unknown"
                    if hasattr(msg, 'tool_results') and msg.tool_results:
                        tool_name = msg.tool_results[0].get("tool_name", "unknown")

                    # DEBUG: Print what we're sending to Gemini
                    import logging
                    logging.info(f"[GEMINI DEBUG] Adding function response: name={tool_name}, data_keys={list(tool_data.keys())}")

                    chat.history.append({
                        "role": "function",
                        "parts": [{
                            "function_response": {
                                "name": tool_name,
                                "response": tool_data
                            }
                        }]
                    })  # type: ignore[arg-type]
                else:
                    # Regular messages
                    role = "user" if msg.role in ("user", "system") else "model"
                    content = msg.content if msg.content is not None else ""

                    # Handle assistant messages with tool calls
                    if msg.role == "assistant" and hasattr(msg, 'tool_calls') and msg.tool_calls:
                        # Assistant is making function calls
                        parts = []

                        # Add text content if present
                        if content:
                            parts.append(content)

                        # Add function calls
                        for tool_call in msg.tool_calls:
                            import google.ai.generativelanguage as glm
                            # Convert tool call to Gemini FunctionCall format
                            parts.append(glm.Part(
                                function_call=glm.FunctionCall(
                                    name=tool_call.get("name", ""),
                                    args=tool_call.get("arguments", {})
                                )
                            ))

                        chat.history.append({"role": role, "parts": parts})  # type: ignore[arg-type]
                    else:
                        # Regular text message
                        chat.history.append({"role": role, "parts": [content]})  # type: ignore[arg-type]

            # Send last message
            generation_config: dict[str, Any] = {
                "max_output_tokens": self.config.max_tokens,
                "temperature": self.config.temperature,
            }

            last_content = messages[-1].content if messages[-1].content is not None else ""
            response = chat.send_message(last_content, generation_config=generation_config)  # type: ignore[arg-type]

            # Extract response
            content = ""
            try:
                if hasattr(response, "text") and response.text:
                    content = response.text
            except (ValueError, AttributeError):
                # response.text can raise ValueError if there's no text content
                pass

            tool_calls = None

            # Extract function calls
            if hasattr(response, "candidates") and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, "content") and hasattr(candidate.content, "parts") and candidate.content.parts:
                    for i, part in enumerate(candidate.content.parts):
                        if hasattr(part, "function_call"):
                            # Skip if function_call.name is empty or missing
                            if not hasattr(part.function_call, "name") or not part.function_call.name:
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

            metadata: dict[str, Any] = {"model": self.config.model}
            if hasattr(response, "usage_metadata"):
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
                logger = get_interaction_logger()
                logger.log_interaction(
                    provider_name="gemini",
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

        except Exception as e:
            # Gemini exceptions are not well-typed, check by name
            if "unauthenticated" in str(e).lower():
                raise ValueError(f"Invalid Gemini API key: {e}") from e
            # Add better context for debugging
            import traceback
            tb_str = ''.join(traceback.format_tb(e.__traceback__))
            raise RuntimeError(f"Gemini API error: {e}\nTraceback:\n{tb_str}") from e
