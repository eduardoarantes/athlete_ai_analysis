"""
Base abstractions for LLM provider adapters.

This module defines the interface that all provider adapters must implement,
ensuring consistent behavior across different LLM providers.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from cycling_ai.tools.base import ToolDefinition, ToolExecutionResult


@dataclass(frozen=True, slots=True)
class ProviderConfig:
    """
    Configuration for an LLM provider.

    Contains all settings needed to initialize and use a provider adapter.
    """

    provider_name: str  # "openai", "anthropic", "gemini", "ollama"
    api_key: str
    model: str
    max_tokens: int = 4096
    temperature: float = 0.7
    additional_params: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        """Validate configuration."""
        if not self.provider_name:
            raise ValueError("provider_name cannot be empty")
        if not self.model:
            raise ValueError("model cannot be empty")
        if self.max_tokens <= 0:
            raise ValueError("max_tokens must be positive")
        if not (0.0 <= self.temperature <= 2.0):
            raise ValueError("temperature must be between 0.0 and 2.0")


@dataclass(frozen=True, slots=True)
class ProviderMessage:
    """
    Standardized message format across providers.

    Provides a common structure that can be converted to provider-specific formats.
    """

    role: str  # "user", "assistant", "system", "tool"
    content: str
    tool_calls: list[dict[str, Any]] | None = None
    tool_results: list[dict[str, Any]] | None = None

    def __post_init__(self) -> None:
        """Validate message."""
        valid_roles = {"user", "assistant", "system", "tool"}
        if self.role not in valid_roles:
            raise ValueError(f"Invalid role '{self.role}'. Must be one of {valid_roles}")


@dataclass(slots=True)
class CompletionResponse:
    """
    Standardized completion response from a provider.

    Provides a consistent format for LLM responses regardless of the provider.
    """

    content: str
    tool_calls: list[dict[str, Any]] | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert response to dictionary."""
        return {
            "content": self.content,
            "tool_calls": self.tool_calls,
            "metadata": self.metadata,
        }


class BaseProvider(ABC):
    """
    Abstract base class for all LLM provider adapters.

    Each provider (OpenAI, Anthropic, Gemini, etc.) must implement this interface
    to ensure consistent behavior and tool support.
    """

    def __init__(self, config: ProviderConfig):
        """
        Initialize provider with configuration.

        Args:
            config: Provider configuration including API keys and model settings
        """
        self.config = config

    @abstractmethod
    def convert_tool_schema(self, tools: list[ToolDefinition]) -> Any:
        """
        Convert generic tool definitions to provider-specific schema format.

        Args:
            tools: List of generic tool definitions

        Returns:
            Provider-specific tool schemas (e.g., list of dicts for OpenAI/Anthropic,
            list of Tool objects for Gemini)
        """
        pass

    @abstractmethod
    def invoke_tool(self, tool_name: str, parameters: dict[str, Any]) -> ToolExecutionResult:
        """
        Execute a tool with provider-specific handling.

        Args:
            tool_name: Name of the tool to invoke
            parameters: Tool parameters

        Returns:
            Standardized tool execution result
        """
        pass

    @abstractmethod
    def format_response(self, result: ToolExecutionResult) -> dict[str, Any]:
        """
        Format tool execution result for the provider.

        Args:
            result: Tool execution result

        Returns:
            Provider-specific response format
        """
        pass

    @abstractmethod
    def create_completion(
        self,
        messages: list[ProviderMessage],
        tools: list[ToolDefinition] | None = None,
        force_tool_call: bool = False,
    ) -> CompletionResponse:
        """
        Create a completion using the provider's API.

        Args:
            messages: Conversation messages
            tools: Available tools (optional)
            force_tool_call: If True, force LLM to call tool instead of responding with text

        Returns:
            Standardized completion response
        """
        pass
