"""
Tool execution coordinator.

Simple orchestration layer for executing tools by name and managing results.
"""
from __future__ import annotations

from typing import Any

from cycling_ai.tools.base import ToolExecutionResult
from cycling_ai.tools.registry import get_global_registry


class ToolExecutor:
    """
    Executes tools and manages results.

    Provides a simple interface for executing tools by name with parameters.
    """

    def __init__(self) -> None:
        """Initialize executor with global registry."""
        self.registry = get_global_registry()

    def execute_tool(
        self, tool_name: str, parameters: dict[str, Any]
    ) -> ToolExecutionResult:
        """
        Execute a tool by name.

        Args:
            tool_name: Name of tool to execute (e.g., "analyze_performance")
            parameters: Tool parameters as dictionary

        Returns:
            Tool execution result

        Raises:
            KeyError: If tool not found in registry
        """
        try:
            tool = self.registry.get_tool(tool_name)
            return tool.execute(**parameters)
        except KeyError:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Tool '{tool_name}' not found in registry"],
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Execution error: {str(e)}"],
            )

    def list_available_tools(self) -> list[str]:
        """
        List all registered tool names.

        Returns:
            List of tool names available in registry
        """
        return self.registry.list_tools()
