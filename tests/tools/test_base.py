"""Tests for tool base abstractions."""
from __future__ import annotations

from typing import Any

import pytest

from cycling_ai.tools.base import (
    BaseTool,
    ToolDefinition,
    ToolExecutionResult,
    ToolParameter,
)


class TestToolParameter:
    """Tests for ToolParameter."""

    def test_valid_parameter(self) -> None:
        """Test creating a valid parameter."""
        param = ToolParameter(
            name="test_param",
            type="string",
            description="A test parameter",
            required=True,
        )
        assert param.name == "test_param"
        assert param.type == "string"
        assert param.required is True

    def test_invalid_type(self) -> None:
        """Test that invalid types raise ValueError."""
        with pytest.raises(ValueError, match="Invalid parameter type"):
            ToolParameter(
                name="test",
                type="invalid",
                description="Test",
            )

    def test_empty_enum(self) -> None:
        """Test that empty enum raises ValueError."""
        with pytest.raises(ValueError, match="enum must be non-empty"):
            ToolParameter(
                name="test",
                type="string",
                description="Test",
                enum=[],
            )


class TestToolDefinition:
    """Tests for ToolDefinition."""

    def test_valid_definition(self) -> None:
        """Test creating a valid tool definition."""
        definition = ToolDefinition(
            name="test_tool",
            description="A test tool",
            category="analysis",
            parameters=[
                ToolParameter(
                    name="param1",
                    type="string",
                    description="First param",
                    required=True,
                ),
                ToolParameter(
                    name="param2",
                    type="integer",
                    description="Second param",
                    required=False,
                    default=10,
                ),
            ],
            returns={"type": "string", "format": "json"},
        )

        assert definition.name == "test_tool"
        assert len(definition.parameters) == 2
        assert len(definition.get_required_parameters()) == 1
        assert len(definition.get_optional_parameters()) == 1

    def test_invalid_category(self) -> None:
        """Test that invalid category raises ValueError."""
        with pytest.raises(ValueError, match="Invalid category"):
            ToolDefinition(
                name="test",
                description="Test",
                category="invalid",
                parameters=[],
                returns={},
            )


class TestToolExecutionResult:
    """Tests for ToolExecutionResult."""

    def test_successful_result(self) -> None:
        """Test creating a successful result."""
        result = ToolExecutionResult(
            success=True,
            data={"key": "value"},
            format="json",
            metadata={"duration": 1.23},
        )

        assert result.success is True
        assert result.data == {"key": "value"}
        assert result.errors == []

    def test_failed_result_without_errors(self) -> None:
        """Test that failed result without errors raises ValueError."""
        with pytest.raises(ValueError, match="Failed execution must include"):
            ToolExecutionResult(
                success=False,
                data=None,
                format="json",
            )

    def test_invalid_format(self) -> None:
        """Test that invalid format raises ValueError."""
        with pytest.raises(ValueError, match="Invalid format"):
            ToolExecutionResult(
                success=True,
                data="test",
                format="invalid",
            )

    def test_to_dict(self) -> None:
        """Test converting result to dictionary."""
        result = ToolExecutionResult(
            success=True,
            data="test data",
            format="text",
            metadata={"key": "value"},
        )

        result_dict = result.to_dict()
        assert result_dict["success"] is True
        assert result_dict["data"] == "test data"
        assert result_dict["format"] == "text"
        assert result_dict["metadata"] == {"key": "value"}


class TestBaseTool:
    """Tests for BaseTool."""

    def test_cannot_instantiate_directly(self) -> None:
        """Test that BaseTool cannot be instantiated directly."""
        with pytest.raises(TypeError):
            BaseTool()  # type: ignore

    def test_concrete_implementation(self) -> None:
        """Test that concrete tool implementation works."""

        class ConcreteTool(BaseTool):
            @property
            def definition(self) -> ToolDefinition:
                return ToolDefinition(
                    name="concrete",
                    description="Test",
                    category="analysis",
                    parameters=[
                        ToolParameter(
                            name="required_param",
                            type="string",
                            description="Required",
                            required=True,
                        )
                    ],
                    returns={"type": "string"},
                )

            def execute(self, **kwargs: Any) -> ToolExecutionResult:
                return ToolExecutionResult(success=True, data="result", format="text")

        tool = ConcreteTool()
        assert tool.definition.name == "concrete"

        # Should raise on missing required parameter
        with pytest.raises(ValueError, match="Missing required parameters"):
            tool.validate_parameters()

        # Should pass with required parameter
        tool.validate_parameters(required_param="value")
