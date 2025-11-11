"""
Tool execution coordinator.

Simple orchestration layer for executing tools by name and managing results.
"""
from __future__ import annotations

import inspect
from typing import TYPE_CHECKING, Any

import cycling_ai.tools  # Trigger tool registration via load_all_tools()
from cycling_ai.tools.base import ToolExecutionResult
from cycling_ai.tools.registry import get_global_registry

if TYPE_CHECKING:
    from cycling_ai.orchestration.session import ConversationSession


class ToolExecutor:
    """
    Executes tools and manages results.

    Provides a simple interface for executing tools by name with parameters.
    Optionally supports filtering to only specific allowed tools.
    Supports context injection from session for tools that accept session_context.
    """

    def __init__(
        self,
        session: ConversationSession | None = None,
        allowed_tools: list[str] | None = None,
    ) -> None:
        """
        Initialize executor with global registry.

        Args:
            session: Optional conversation session for context injection.
                If provided, session.context will be injected into tools that
                accept a session_context parameter.
            allowed_tools: Optional list of tool names to restrict access to.
                If None, all registered tools are available.
        """
        # Ensure all tools are loaded before accessing registry
        cycling_ai.tools.load_all_tools()  # noqa: F405
        self.registry = get_global_registry()
        self.session = session
        self.allowed_tools = allowed_tools

    def execute_tool(
        self, tool_name: str, parameters: dict[str, Any]
    ) -> ToolExecutionResult:
        """
        Execute a tool by name.

        If a session is configured, injects session.context into tools that
        accept a session_context parameter. After execution, updates session
        context from tool result metadata if context_updates are present.

        Args:
            tool_name: Name of tool to execute (e.g., "analyze_performance")
            parameters: Tool parameters as dictionary

        Returns:
            Tool execution result

        Raises:
            KeyError: If tool not found in registry
        """
        # Check if tool is allowed
        if self.allowed_tools is not None and tool_name not in self.allowed_tools:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=[f"Tool '{tool_name}' is not available in this context"],
            )

        try:
            tool = self.registry.get_tool(tool_name)

            # Inject session context if session is available and tool accepts it
            parameters_with_context = parameters.copy()

            if self.session is not None:
                # Check if tool's execute method accepts session_context parameter
                tool_execute_sig = inspect.signature(tool.execute)
                if "session_context" in tool_execute_sig.parameters:
                    # Only inject if not already provided (allow explicit override)
                    if "session_context" not in parameters_with_context:
                        parameters_with_context["session_context"] = self.session.context

            # Execute tool
            result = tool.execute(**parameters_with_context)

            # Update session context from tool result metadata
            if self.session is not None and result.success:
                if result.metadata and "context_updates" in result.metadata:
                    context_updates = result.metadata["context_updates"]
                    if isinstance(context_updates, dict):
                        self.session.context.update(context_updates)

            return result

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

    def list_available_tools(self) -> list:
        """
        List available tool definitions.

        Returns filtered list if allowed_tools is set, otherwise all tools.

        Returns:
            List of ToolDefinition objects available in this executor's context
        """
        all_tools = self.registry.list_tools()

        # If no filter is set, return all tools
        if self.allowed_tools is None:
            return all_tools

        # Filter to only allowed tools that exist in registry
        return [
            tool for tool in all_tools
            if tool.name in self.allowed_tools
        ]
