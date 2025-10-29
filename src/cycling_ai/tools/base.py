"""
Base abstractions for tool definitions and execution.

This module provides the foundation for defining provider-agnostic tools
that can be used across different LLM providers (OpenAI, Anthropic, Gemini, etc.).
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True, slots=True)
class ToolParameter:
    """
    Definition of a single parameter for a tool.

    This provides a provider-agnostic way to define tool parameters that can be
    converted to provider-specific schemas (OpenAI JSON Schema, Anthropic input_schema, etc.).
    """

    name: str
    type: str  # "string", "integer", "number", "boolean", "object", "array"
    description: str
    required: bool = False
    default: Any = None
    enum: list[Any] | None = None
    min_value: float | None = None
    max_value: float | None = None
    pattern: str | None = None  # Regex pattern for string validation
    items: dict[str, Any] | None = None  # Schema for array items (required for type="array")

    def __post_init__(self) -> None:
        """Validate parameter definition."""
        valid_types = {"string", "integer", "number", "boolean", "object", "array"}
        if self.type not in valid_types:
            raise ValueError(
                f"Invalid parameter type '{self.type}'. Must be one of {valid_types}"
            )

        if self.enum is not None and not self.enum:
            raise ValueError("enum must be non-empty if provided")


@dataclass(frozen=True, slots=True)
class ToolDefinition:
    """
    Complete specification of a tool.

    Defines everything needed to register, invoke, and document a tool
    in a provider-agnostic way.
    """

    name: str
    description: str
    category: str  # "data_prep", "analysis", "reporting"
    parameters: list[ToolParameter]
    returns: dict[str, Any]  # {"type": "string", "format": "json"}
    version: str = "1.0.0"

    def __post_init__(self) -> None:
        """Validate tool definition."""
        if not self.name:
            raise ValueError("Tool name cannot be empty")
        if not self.description:
            raise ValueError("Tool description cannot be empty")

        valid_categories = {"data_prep", "analysis", "reporting"}
        if self.category not in valid_categories:
            raise ValueError(
                f"Invalid category '{self.category}'. Must be one of {valid_categories}"
            )

    def get_required_parameters(self) -> list[ToolParameter]:
        """Get list of required parameters."""
        return [p for p in self.parameters if p.required]

    def get_optional_parameters(self) -> list[ToolParameter]:
        """Get list of optional parameters."""
        return [p for p in self.parameters if not p.required]


@dataclass(slots=True)
class ToolExecutionResult:
    """
    Standardized result from tool execution.

    Provides a consistent format for returning tool results regardless of
    the underlying provider or execution context.
    """

    success: bool
    data: Any
    format: str  # "json", "markdown", "html", "text"
    metadata: dict[str, Any] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        """Validate execution result."""
        valid_formats = {"json", "markdown", "html", "text"}
        if self.format not in valid_formats:
            raise ValueError(
                f"Invalid format '{self.format}'. Must be one of {valid_formats}"
            )

        if not self.success and not self.errors:
            raise ValueError("Failed execution must include error messages")

    def to_dict(self) -> dict[str, Any]:
        """Convert result to dictionary for serialization."""
        return {
            "success": self.success,
            "data": self.data,
            "format": self.format,
            "metadata": self.metadata,
            "errors": self.errors,
        }


class BaseTool(ABC):
    """
    Abstract base class for all tools.

    All tools must inherit from this class and implement the required methods.
    This ensures a consistent interface across all tools.
    """

    @property
    @abstractmethod
    def definition(self) -> ToolDefinition:
        """
        Return the tool's definition.

        This should be a static definition that describes the tool's
        parameters, return type, and metadata.
        """
        pass

    @abstractmethod
    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """
        Execute the tool with provided parameters.

        Args:
            **kwargs: Named parameters as defined in the tool's definition

        Returns:
            ToolExecutionResult with execution status and data
        """
        pass

    def validate_parameters(self, **kwargs: Any) -> None:
        """
        Validate provided parameters against tool definition.

        Raises:
            ValueError: If required parameters are missing or invalid
        """
        # Check required parameters
        required_params = {p.name for p in self.definition.get_required_parameters()}
        provided_params = set(kwargs.keys())

        missing = required_params - provided_params
        if missing:
            raise ValueError(f"Missing required parameters: {', '.join(sorted(missing))}")

        # Validate parameter types (basic validation)
        for param in self.definition.parameters:
            if param.name in kwargs:
                value = kwargs[param.name]
                # Type validation could be expanded here
                if param.enum and value not in param.enum:
                    raise ValueError(f"Parameter '{param.name}' must be one of {param.enum}")

                # Validate min/max values for numeric parameters
                if param.min_value is not None and isinstance(value, (int, float)):
                    if value < param.min_value:
                        raise ValueError(
                            f"Parameter '{param.name}' must be >= {param.min_value}, got {value}"
                        )

                if param.max_value is not None and isinstance(value, (int, float)):
                    if value > param.max_value:
                        raise ValueError(
                            f"Parameter '{param.name}' must be <= {param.max_value}, got {value}"
                        )
