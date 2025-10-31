"""
Shared utilities for LLM provider adapters.

Common functionality used by multiple provider implementations including
retry logic, error handling, and schema conversion helpers.
"""
from __future__ import annotations

import functools
import time
from collections.abc import Callable
from typing import Any, ParamSpec, TypeVar

from cycling_ai.tools.base import ToolDefinition

P = ParamSpec("P")
T = TypeVar("T")


def retry_with_exponential_backoff(
    max_retries: int = 3,
    initial_delay: float = 1.0,
    exponential_base: float = 2.0,
    max_delay: float = 60.0,
) -> Callable[[Callable[P, T]], Callable[P, T]]:
    """
    Decorator for retrying functions with exponential backoff.

    Retries transient failures (network errors, rate limits) with exponentially
    increasing delays. Does not retry permanent failures (authentication errors,
    invalid parameters).

    Args:
        max_retries: Maximum number of retry attempts (default: 3)
        initial_delay: Initial delay in seconds (default: 1.0)
        exponential_base: Base for exponential backoff (default: 2.0)
        max_delay: Maximum delay between retries in seconds (default: 60.0)

    Returns:
        Decorated function with retry logic

    Example:
        >>> @retry_with_exponential_backoff(max_retries=3)
        ... def call_api():
        ...     return client.chat.completions.create(...)
    """

    def decorator(func: Callable[P, T]) -> Callable[P, T]:
        @functools.wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            delay = initial_delay
            last_exception: Exception | None = None

            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e

                    # Don't retry on permanent failures
                    if is_permanent_error(e):
                        raise

                    if attempt < max_retries - 1:
                        time.sleep(min(delay, max_delay))
                        delay *= exponential_base

            # All retries exhausted
            if last_exception is not None:
                raise last_exception
            raise RuntimeError("Retry logic failed without exception")

        return wrapper

    return decorator


def is_permanent_error(error: Exception) -> bool:
    """
    Check if an error is permanent and should not be retried.

    Permanent errors include authentication failures, invalid requests,
    and parameter validation errors. These indicate configuration problems
    that won't be resolved by retrying.

    Args:
        error: Exception to check

    Returns:
        True if error is permanent (should not retry), False otherwise

    Example:
        >>> is_permanent_error(ValueError("Invalid API key"))
        True
        >>> is_permanent_error(ConnectionError("Network timeout"))
        False
    """
    error_type = type(error).__name__
    permanent_errors = [
        "AuthenticationError",
        "InvalidRequestError",
        "NotFoundError",
        "ValueError",
        "JSONDecodeError",
    ]
    return error_type in permanent_errors


def convert_to_openai_format(tools: list[ToolDefinition]) -> list[dict[str, Any]]:
    """
    Convert generic tool definitions to OpenAI function schema format.

    DEPRECATED: This function is kept for backwards compatibility with Ollama provider.
    OpenAI provider now implements schema conversion directly.

    This format is also compatible with Ollama and other OpenAI-compatible APIs.

    Args:
        tools: List of generic tool definitions

    Returns:
        List of OpenAI-format function schemas (basic conversion only)

    Example:
        >>> tool = ToolDefinition(
        ...     name="analyze",
        ...     description="Analyze data",
        ...     category="analysis",
        ...     parameters=[
        ...         ToolParameter(name="months", type="integer", required=True)
        ...     ],
        ...     returns={"type": "json"}
        ... )
        >>> schemas = convert_to_openai_format([tool])
        >>> schemas[0]["type"]
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
            # Note: items are NOT processed here - use provider-specific implementation
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
