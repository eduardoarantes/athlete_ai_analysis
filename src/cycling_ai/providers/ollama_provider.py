"""
Ollama provider adapter.

Implements the provider interface for Ollama's local LLM models.
Uses OpenAI-compatible schema for function calling (when supported).
"""
from __future__ import annotations

import json
from typing import Any

import ollama

from cycling_ai.providers.base import (
    BaseProvider,
    CompletionResponse,
    ProviderConfig,
    ProviderMessage,
)
from cycling_ai.providers.provider_utils import (
    convert_to_openai_format,
    retry_with_exponential_backoff,
)
from cycling_ai.tools.base import ToolDefinition, ToolExecutionResult


class OllamaProvider(BaseProvider):
    """
    Ollama provider adapter for local models.

    Supports Llama 3, Mistral, CodeLlama, and other Ollama models.
    Tool support depends on the model capabilities.

    Example:
        >>> config = ProviderConfig(
        ...     provider_name="ollama",
        ...     api_key="",  # Not needed for local
        ...     model="llama3",
        ...     additional_params={"base_url": "http://localhost:11434"}
        ... )
        >>> provider = OllamaProvider(config)
        >>> response = provider.create_completion(messages)
    """

    def __init__(self, config: ProviderConfig):
        """
        Initialize Ollama provider.

        Args:
            config: Provider configuration including model and optional base_url
        """
        super().__init__(config)
        base_url = config.additional_params.get("base_url", "http://localhost:11434")
        self.client = ollama.Client(host=base_url)
        self.base_url = base_url

    def convert_tool_schema(self, tools: list[ToolDefinition]) -> list[dict[str, Any]]:
        """
        Convert generic tool definitions to Ollama schema (OpenAI-compatible).

        Args:
            tools: List of generic tool definitions

        Returns:
            List of OpenAI-format function schemas

        Example:
            >>> schema = provider.convert_tool_schema([tool_def])
            >>> schema[0]["type"]
            'function'
        """
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
        Format tool execution result for Ollama.

        Args:
            result: Tool execution result

        Returns:
            Ollama-format tool message (OpenAI-compatible)

        Example:
            >>> formatted = provider.format_response(result)
            >>> formatted["role"]
            'tool'
        """
        return {
            "role": "tool",
            "content": json.dumps(result.to_dict()),
        }

    @retry_with_exponential_backoff(max_retries=2, initial_delay=0.5)  # Fewer retries for local
    def create_completion(
        self,
        messages: list[ProviderMessage],
        tools: list[ToolDefinition] | None = None,
    ) -> CompletionResponse:
        """
        Create completion using Ollama API.

        Args:
            messages: Conversation messages
            tools: Available tools (optional, support depends on model)

        Returns:
            Standardized completion response

        Raises:
            ValueError: If model not found
            RuntimeError: If API error occurs

        Example:
            >>> messages = [ProviderMessage(role="user", content="Hello")]
            >>> response = provider.create_completion(messages)
        """
        try:
            # Convert messages to Ollama format
            ollama_messages = [{"role": m.role, "content": m.content} for m in messages]

            # Build request parameters
            request_params: dict[str, Any] = {
                "model": self.config.model,
                "messages": ollama_messages,
                "options": {
                    "temperature": self.config.temperature,
                    "num_predict": self.config.max_tokens,
                },
            }

            # Add tools if provided (model support varies)
            if tools:
                request_params["tools"] = self.convert_tool_schema(tools)

            # Call Ollama API
            response = self.client.chat(**request_params)

            # Extract response
            content = response["message"]["content"]
            tool_calls = None

            # Extract tool calls if present
            if "tool_calls" in response["message"]:
                tool_calls = [
                    {
                        "name": tc["function"]["name"],
                        "arguments": tc["function"]["arguments"],
                        "id": tc.get("id", f"call_{i}"),
                    }
                    for i, tc in enumerate(response["message"]["tool_calls"])
                ]

            return CompletionResponse(
                content=content,
                tool_calls=tool_calls,
                metadata={
                    "model": response.get("model", self.config.model),
                    "eval_count": response.get("eval_count", 0),
                    "prompt_eval_count": response.get("prompt_eval_count", 0),
                },
            )

        except Exception as e:
            error_str = str(e).lower()
            if "not found" in error_str or "404" in error_str:
                raise ValueError(f"Model '{self.config.model}' not found in Ollama") from e
            if "connection" in error_str:
                raise RuntimeError(f"Cannot connect to Ollama at {self.base_url}: {e}") from e
            raise RuntimeError(f"Ollama API error: {e}") from e
