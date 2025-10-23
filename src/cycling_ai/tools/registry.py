"""
Tool registry for managing and discovering tools.

This module provides a central registry where tools can be registered and
discovered, along with utilities for generating provider-specific schemas.
"""
from __future__ import annotations

from cycling_ai.tools.base import BaseTool, ToolDefinition


class ToolRegistry:
    """
    Central registry for all tools.

    Manages tool registration, discovery, and schema generation for different
    provider formats.
    """

    def __init__(self) -> None:
        """Initialize empty registry."""
        self._tools: dict[str, BaseTool] = {}
        self._categories: dict[str, list[str]] = {
            "data_prep": [],
            "analysis": [],
            "reporting": [],
        }

    def register(self, tool: BaseTool) -> None:
        """
        Register a tool in the registry.

        Args:
            tool: Tool instance to register

        Raises:
            ValueError: If tool with same name already registered
        """
        definition = tool.definition
        if definition.name in self._tools:
            raise ValueError(f"Tool '{definition.name}' is already registered")

        self._tools[definition.name] = tool

        # Add to category index
        if definition.category in self._categories:
            self._categories[definition.category].append(definition.name)

    def unregister(self, tool_name: str) -> None:
        """
        Unregister a tool from the registry.

        Args:
            tool_name: Name of tool to unregister

        Raises:
            KeyError: If tool not found
        """
        if tool_name not in self._tools:
            raise KeyError(f"Tool '{tool_name}' not found in registry")

        tool = self._tools[tool_name]
        category = tool.definition.category

        del self._tools[tool_name]

        # Remove from category index
        if category in self._categories:
            self._categories[category].remove(tool_name)

    def get_tool(self, name: str) -> BaseTool:
        """
        Get tool by name.

        Args:
            name: Tool name

        Returns:
            Tool instance

        Raises:
            KeyError: If tool not found
        """
        if name not in self._tools:
            raise KeyError(f"Tool '{name}' not found in registry")
        return self._tools[name]

    def has_tool(self, name: str) -> bool:
        """
        Check if tool is registered.

        Args:
            name: Tool name

        Returns:
            True if tool is registered, False otherwise
        """
        return name in self._tools

    def list_tools(self, category: str | None = None) -> list[ToolDefinition]:
        """
        List all tools or filter by category.

        Args:
            category: Optional category filter ("data_prep", "analysis", "reporting")

        Returns:
            List of tool definitions

        Raises:
            ValueError: If category is invalid
        """
        if category is None:
            # Return all tools
            return [tool.definition for tool in self._tools.values()]

        if category not in self._categories:
            raise ValueError(
                f"Invalid category '{category}'. "
                f"Must be one of {list(self._categories.keys())}"
            )

        # Return tools in category
        tool_names = self._categories[category]
        return [self._tools[name].definition for name in tool_names]

    def list_tool_names(self, category: str | None = None) -> list[str]:
        """
        List tool names, optionally filtered by category.

        Args:
            category: Optional category filter

        Returns:
            List of tool names
        """
        if category is None:
            return list(self._tools.keys())

        if category not in self._categories:
            raise ValueError(f"Invalid category '{category}'")

        return list(self._categories[category])

    def get_categories(self) -> list[str]:
        """
        Get list of all categories.

        Returns:
            List of category names
        """
        return list(self._categories.keys())

    def count_tools(self, category: str | None = None) -> int:
        """
        Count tools in registry, optionally by category.

        Args:
            category: Optional category filter

        Returns:
            Number of tools
        """
        if category is None:
            return len(self._tools)

        if category not in self._categories:
            raise ValueError(f"Invalid category '{category}'")

        return len(self._categories[category])

    def clear(self) -> None:
        """Clear all tools from registry."""
        self._tools.clear()
        for category in self._categories:
            self._categories[category].clear()


# Global registry instance
_global_registry: ToolRegistry | None = None


def get_global_registry() -> ToolRegistry:
    """
    Get the global tool registry instance.

    Returns:
        Global ToolRegistry instance
    """
    global _global_registry
    if _global_registry is None:
        _global_registry = ToolRegistry()
    return _global_registry


def register_tool(tool: BaseTool) -> None:
    """
    Register a tool in the global registry.

    Convenience function for registering tools without managing the registry instance.

    Args:
        tool: Tool to register
    """
    get_global_registry().register(tool)
