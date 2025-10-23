"""Tests for tool registry."""
from __future__ import annotations

from typing import Any

import pytest

from cycling_ai.tools.base import (
    BaseTool,
    ToolDefinition,
    ToolExecutionResult,
    ToolParameter,
)
from cycling_ai.tools.registry import ToolRegistry, get_global_registry, register_tool


class DummyTool(BaseTool):
    """Dummy tool for testing."""

    def __init__(self, name: str, category: str = "analysis"):
        self._name = name
        self._category = category

    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name=self._name,
            description=f"Test tool {self._name}",
            category=self._category,
            parameters=[
                ToolParameter(
                    name="param1",
                    type="string",
                    description="Test param",
                    required=True,
                )
            ],
            returns={"type": "string"},
        )

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        return ToolExecutionResult(success=True, data="test", format="text")


class TestToolRegistry:
    """Tests for ToolRegistry."""

    def test_register_tool(self) -> None:
        """Test registering a tool."""
        registry = ToolRegistry()
        tool = DummyTool("test_tool")

        registry.register(tool)

        assert registry.has_tool("test_tool")
        assert registry.count_tools() == 1

    def test_duplicate_registration(self) -> None:
        """Test that duplicate registration raises error."""
        registry = ToolRegistry()
        tool1 = DummyTool("test_tool")
        tool2 = DummyTool("test_tool")

        registry.register(tool1)

        with pytest.raises(ValueError, match="already registered"):
            registry.register(tool2)

    def test_get_tool(self) -> None:
        """Test getting a registered tool."""
        registry = ToolRegistry()
        tool = DummyTool("test_tool")
        registry.register(tool)

        retrieved = registry.get_tool("test_tool")
        assert retrieved is tool
        assert retrieved.definition.name == "test_tool"

    def test_get_nonexistent_tool(self) -> None:
        """Test getting a non-existent tool raises KeyError."""
        registry = ToolRegistry()

        with pytest.raises(KeyError, match="not found"):
            registry.get_tool("nonexistent")

    def test_unregister_tool(self) -> None:
        """Test unregistering a tool."""
        registry = ToolRegistry()
        tool = DummyTool("test_tool")
        registry.register(tool)

        assert registry.has_tool("test_tool")

        registry.unregister("test_tool")

        assert not registry.has_tool("test_tool")
        assert registry.count_tools() == 0

    def test_list_tools_all(self) -> None:
        """Test listing all tools."""
        registry = ToolRegistry()
        tool1 = DummyTool("tool1", "analysis")
        tool2 = DummyTool("tool2", "data_prep")
        tool3 = DummyTool("tool3", "reporting")

        registry.register(tool1)
        registry.register(tool2)
        registry.register(tool3)

        all_tools = registry.list_tools()
        assert len(all_tools) == 3
        tool_names = {t.name for t in all_tools}
        assert tool_names == {"tool1", "tool2", "tool3"}

    def test_list_tools_by_category(self) -> None:
        """Test listing tools filtered by category."""
        registry = ToolRegistry()
        tool1 = DummyTool("tool1", "analysis")
        tool2 = DummyTool("tool2", "analysis")
        tool3 = DummyTool("tool3", "data_prep")

        registry.register(tool1)
        registry.register(tool2)
        registry.register(tool3)

        analysis_tools = registry.list_tools(category="analysis")
        assert len(analysis_tools) == 2
        tool_names = {t.name for t in analysis_tools}
        assert tool_names == {"tool1", "tool2"}

    def test_list_tool_names(self) -> None:
        """Test listing tool names."""
        registry = ToolRegistry()
        tool1 = DummyTool("tool1")
        tool2 = DummyTool("tool2")

        registry.register(tool1)
        registry.register(tool2)

        names = registry.list_tool_names()
        assert set(names) == {"tool1", "tool2"}

    def test_count_tools(self) -> None:
        """Test counting tools."""
        registry = ToolRegistry()

        assert registry.count_tools() == 0

        registry.register(DummyTool("tool1", "analysis"))
        assert registry.count_tools() == 1
        assert registry.count_tools("analysis") == 1

        registry.register(DummyTool("tool2", "data_prep"))
        assert registry.count_tools() == 2
        assert registry.count_tools("analysis") == 1
        assert registry.count_tools("data_prep") == 1

    def test_clear(self) -> None:
        """Test clearing registry."""
        registry = ToolRegistry()
        registry.register(DummyTool("tool1"))
        registry.register(DummyTool("tool2"))

        assert registry.count_tools() == 2

        registry.clear()

        assert registry.count_tools() == 0
        assert len(registry.list_tool_names()) == 0


class TestGlobalRegistry:
    """Tests for global registry functions."""

    def test_get_global_registry(self) -> None:
        """Test getting global registry singleton."""
        reg1 = get_global_registry()
        reg2 = get_global_registry()

        assert reg1 is reg2  # Same instance

    def test_register_tool_helper(self) -> None:
        """Test register_tool helper function."""
        # Clear global registry first
        get_global_registry().clear()

        tool = DummyTool("global_tool")
        register_tool(tool)

        assert get_global_registry().has_tool("global_tool")

        # Clean up
        get_global_registry().clear()
