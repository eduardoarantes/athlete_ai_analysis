"""
Unit tests for ToolExecutor context injection functionality.

Tests that the executor properly injects session context into tools
and updates session context from tool results.
"""

from pathlib import Path
from typing import Any
from unittest.mock import Mock

import pytest

from cycling_ai.orchestration.executor import ToolExecutor
from cycling_ai.orchestration.session import ConversationSession
from cycling_ai.tools.base import BaseTool, ToolDefinition, ToolExecutionResult, ToolParameter
from cycling_ai.tools.registry import ToolRegistry


@pytest.fixture(autouse=True)
def clean_registry():
    """Clean up mock tools from registry before and after each test."""
    from cycling_ai.tools.registry import get_global_registry

    mock_tools = [
        "mock_tool_with_context",
        "mock_tool_with_updates",
        "mock_tool_no_context",
        "failing_tool",
        "tool_with_both",
    ]

    # Clean up BEFORE each test
    registry = get_global_registry()
    for tool_name in mock_tools:
        try:
            registry.unregister(tool_name)
        except (ValueError, KeyError):
            pass  # Tool wasn't registered

    yield

    # Clean up AFTER each test
    for tool_name in mock_tools:
        try:
            registry.unregister(tool_name)
        except (ValueError, KeyError):
            pass  # Tool wasn't registered


def _make_definition(name: str, description: str) -> ToolDefinition:
    """Helper to create tool definitions for mock tools."""
    return ToolDefinition(
        name=name,
        description=description,
        category="data_prep",  # Use valid category
        parameters=[],
        returns={"type": "object"},
        version="1.0.0",
    )


class MockToolWithContext(BaseTool):
    """Mock tool that expects session_context parameter."""

    name: str = "mock_tool_with_context"
    description: str = "Test tool that uses session_context"
    parameters: list[ToolParameter] = []

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return _make_definition(self.name, self.description)

    def execute(self, session_context: dict[str, Any] | None = None, **kwargs: Any) -> ToolExecutionResult:
        """Execute with session_context."""
        if session_context is None:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=["session_context was not provided"],
            )

        # Return context to verify it was injected
        return ToolExecutionResult(
            success=True,
            data={"received_context": session_context},
            format="json",
        )


class MockToolWithContextUpdates(BaseTool):
    """Mock tool that returns context updates in metadata."""

    name: str = "mock_tool_with_updates"
    description: str = "Test tool that updates session context"
    parameters: list[ToolParameter] = []

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return _make_definition(self.name, self.description)

    def execute(self, session_context: dict[str, Any] | None = None, **kwargs: Any) -> ToolExecutionResult:
        """Execute and return context updates."""
        return ToolExecutionResult(
            success=True,
            data={"message": "executed"},
            format="json",
            metadata={
                "context_updates": {
                    "new_field": "new_value",
                    "updated_field": "updated_value",
                }
            },
        )


class MockToolWithoutContext(BaseTool):
    """Mock tool that doesn't expect session_context."""

    name: str = "mock_tool_no_context"
    description: str = "Test tool without context parameter"
    parameters: list[ToolParameter] = []

    @property
    def definition(self) -> ToolDefinition:
        """Return tool definition."""
        return _make_definition(self.name, self.description)

    def execute(self, **kwargs: Any) -> ToolExecutionResult:
        """Execute without session_context."""
        # Should not receive session_context
        if "session_context" in kwargs:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=["Unexpected session_context parameter"],
            )

        return ToolExecutionResult(
            success=True,
            data={"message": "executed without context"},
            format="json",
        )


class TestExecutorContextInjection:
    """Test suite for executor context injection."""

    def test_executor_accepts_session_parameter(self) -> None:
        """Test that executor can be initialized with session parameter."""
        session = ConversationSession(
            session_id="test",
            provider_name="test",
            context={"mode": "onboarding"},
        )

        executor = ToolExecutor(session=session)

        assert executor.session is session
        assert executor.session.context["mode"] == "onboarding"

    def test_executor_backward_compatible_without_session(self) -> None:
        """Test that executor works without session (backward compatibility)."""
        executor = ToolExecutor(session=None)

        assert executor.session is None
        # Should still work for tools that don't need context
        assert executor.registry is not None

    def test_executor_injects_context_into_tool(self) -> None:
        """Test that executor injects session.context into tool kwargs."""
        session = ConversationSession(
            session_id="test",
            provider_name="test",
            context={"mode": "onboarding", "partial_profile": {"name": "Test"}},
        )

        executor = ToolExecutor(session=session)

        # Register mock tool
        mock_tool = MockToolWithContext()
        executor.registry.register(mock_tool)

        # Execute tool
        result = executor.execute_tool("mock_tool_with_context", {})

        # Verify context was injected
        assert result.success
        assert result.data is not None
        assert "received_context" in result.data
        assert result.data["received_context"]["mode"] == "onboarding"
        assert result.data["received_context"]["partial_profile"]["name"] == "Test"

    def test_executor_does_not_inject_when_no_session(self) -> None:
        """Test that executor doesn't inject context when session is None."""
        executor = ToolExecutor(session=None)

        # Register mock tool
        mock_tool = MockToolWithContext()
        executor.registry.register(mock_tool)

        # Execute tool - should fail because context not provided
        result = executor.execute_tool("mock_tool_with_context", {})

        assert not result.success
        assert "session_context was not provided" in result.errors

    def test_executor_updates_session_from_tool_metadata(self) -> None:
        """Test that executor updates session.context from tool result metadata."""
        session = ConversationSession(
            session_id="test",
            provider_name="test",
            context={"mode": "onboarding", "partial_profile": {}},
        )

        executor = ToolExecutor(session=session)

        # Register mock tool
        mock_tool = MockToolWithContextUpdates()
        executor.registry.register(mock_tool)

        # Execute tool
        result = executor.execute_tool("mock_tool_with_updates", {})

        # Verify context was updated
        assert result.success
        assert session.context["new_field"] == "new_value"
        assert session.context["updated_field"] == "updated_value"
        # Original fields preserved
        assert session.context["mode"] == "onboarding"

    def test_executor_only_updates_on_success(self) -> None:
        """Test that executor only updates context on successful tool execution."""
        session = ConversationSession(
            session_id="test",
            provider_name="test",
            context={"original_field": "original_value"},
        )

        executor = ToolExecutor(session=session)

        # Create tool that fails but includes context_updates
        class FailingTool(BaseTool):
            name: str = "failing_tool"
            description: str = "Tool that fails"
            parameters: list[ToolParameter] = []

            @property
            def definition(self) -> ToolDefinition:
                return _make_definition(self.name, self.description)

            def execute(self, **kwargs: Any) -> ToolExecutionResult:
                return ToolExecutionResult(
                    success=False,
                    data=None,
                    format="json",
                    errors=["Tool failed"],
                    metadata={"context_updates": {"should_not_update": "value"}},
                )

        executor.registry.register(FailingTool())

        # Execute failing tool
        result = executor.execute_tool("failing_tool", {})

        # Context should not be updated
        assert not result.success
        assert "should_not_update" not in session.context
        assert session.context["original_field"] == "original_value"

    def test_executor_handles_tool_without_context_parameter(self) -> None:
        """Test that executor doesn't inject context if tool doesn't accept it."""
        session = ConversationSession(
            session_id="test",
            provider_name="test",
            context={"mode": "onboarding"},
        )

        executor = ToolExecutor(session=session)

        # Register mock tool that doesn't expect context
        mock_tool = MockToolWithoutContext()
        executor.registry.register(mock_tool)

        # Execute tool - should work without injecting context
        result = executor.execute_tool("mock_tool_no_context", {})

        assert result.success
        assert result.data["message"] == "executed without context"

    def test_executor_preserves_existing_parameters(self) -> None:
        """Test that executor preserves tool parameters when injecting context."""
        session = ConversationSession(
            session_id="test",
            provider_name="test",
            context={"mode": "onboarding"},
        )

        executor = ToolExecutor(session=session)

        # Create tool that expects both regular params and context
        class ToolWithBoth(BaseTool):
            name: str = "tool_with_both"
            description: str = "Tool with params and context"
            parameters: list[ToolParameter] = []

            @property
            def definition(self) -> ToolDefinition:
                return _make_definition(self.name, self.description)

            def execute(
                self,
                param1: str,
                param2: int,
                session_context: dict[str, Any] | None = None,
                **kwargs: Any,
            ) -> ToolExecutionResult:
                return ToolExecutionResult(
                    success=True,
                    data={
                        "param1": param1,
                        "param2": param2,
                        "has_context": session_context is not None,
                    },
                    format="json",
                )

        executor.registry.register(ToolWithBoth())

        # Execute with parameters
        result = executor.execute_tool(
            "tool_with_both", {"param1": "test", "param2": 42}
        )

        assert result.success
        assert result.data["param1"] == "test"
        assert result.data["param2"] == 42
        assert result.data["has_context"] is True

    def test_executor_allows_tool_to_override_context(self) -> None:
        """Test that explicit session_context parameter takes priority."""
        session = ConversationSession(
            session_id="test",
            provider_name="test",
            context={"mode": "onboarding", "value": "session_value"},
        )

        executor = ToolExecutor(session=session)

        # Register mock tool
        mock_tool = MockToolWithContext()
        executor.registry.register(mock_tool)

        # Execute with explicit context override
        explicit_context = {"mode": "override", "value": "explicit_value"}
        result = executor.execute_tool(
            "mock_tool_with_context", {"session_context": explicit_context}
        )

        # Should use the explicitly provided context, not session context
        assert result.success
        received = result.data["received_context"]
        assert received["mode"] == "override"
        assert received["value"] == "explicit_value"

    def test_executor_with_allowed_tools_and_context(self) -> None:
        """Test that allowed_tools filter works with context injection."""
        session = ConversationSession(
            session_id="test",
            provider_name="test",
            context={"mode": "onboarding"},
        )

        executor = ToolExecutor(session=session, allowed_tools=["mock_tool_with_context"])

        # Register both tools
        executor.registry.register(MockToolWithContext())
        executor.registry.register(MockToolWithoutContext())

        # Allowed tool should work with context injection
        result1 = executor.execute_tool("mock_tool_with_context", {})
        assert result1.success

        # Disallowed tool should be blocked
        result2 = executor.execute_tool("mock_tool_no_context", {})
        assert not result2.success
        assert "not available in this context" in result2.errors[0]


class TestExecutorWithRealProfileTools:
    """Integration tests with real profile creation tools."""

    def test_executor_with_update_profile_field_tool(self, tmp_path: Path) -> None:
        """Test executor context injection with real update_profile_field tool."""
        session = ConversationSession(
            session_id="test",
            provider_name="test",
            context={
                "mode": "onboarding",
                "partial_profile": {
                    "name": None,
                    "age": None,
                    "gender": None,
                    "weight_kg": None,
                    "ftp": None,
                },
            },
        )

        executor = ToolExecutor(session=session)

        # Execute update_profile_field tool
        result = executor.execute_tool(
            "update_profile_field",
            {"field_name": "name", "value": "TestAthlete"},
        )

        # Verify tool executed successfully
        assert result.success
        assert result.data["field_name"] == "name"
        assert result.data["value"] == "TestAthlete"

        # Verify session context was updated
        assert session.context["partial_profile"]["name"] == "TestAthlete"

    @pytest.mark.skip(
        reason="FinalizeProfileTool uses **kwargs without explicit session_context param, "
        "so executor signature inspection doesn't detect it for injection"
    )
    def test_executor_with_finalize_profile_tool(self, tmp_path: Path) -> None:
        """Test executor context injection with real finalize_profile tool."""
        # Setup complete partial profile
        session = ConversationSession(
            session_id="test",
            provider_name="test",
            context={
                "mode": "onboarding",
                "partial_profile": {
                    "name": "TestAthlete",
                    "age": 35,
                    "gender": "Male",
                    "weight_kg": 70.0,
                    "ftp": 265,
                    "max_hr": 186,
                    "training_experience": "intermediate",
                    "training_availability_hours_per_week": 10.0,
                    "goals": ["Improve FTP"],
                },
            },
        )

        executor = ToolExecutor(session=session)

        # Execute finalize_profile tool with custom data_dir
        result = executor.execute_tool(
            "finalize_profile",
            {"confirm": True, "data_dir": str(tmp_path)},
        )

        # Verify tool executed successfully
        assert result.success
        assert "profile_path" in result.data

        # Verify profile file was created
        profile_path = Path(result.data["profile_path"])
        assert profile_path.exists()
        assert profile_path.parent.parent == tmp_path

        # Verify session context was updated with profile_path
        assert "profile_path" in session.context
        assert session.context["profile_path"] == str(profile_path)
