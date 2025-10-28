"""
Tests for LLM agent orchestration.
"""
from __future__ import annotations

from unittest.mock import Mock

import pytest

from cycling_ai.orchestration.agent import AgentFactory, LLMAgent
from cycling_ai.orchestration.executor import ToolExecutor
from cycling_ai.orchestration.session import ConversationSession
from cycling_ai.providers.base import CompletionResponse, ProviderConfig, ProviderMessage
from cycling_ai.tools.base import BaseTool, ToolDefinition, ToolExecutionResult, ToolParameter


# Mock provider for testing
class MockProvider:
    """Mock provider for testing agent behavior."""

    def __init__(self, config: ProviderConfig):
        self.config = config
        self.responses: list[CompletionResponse] = []
        self.call_count = 0

    def add_response(self, response: CompletionResponse) -> None:
        """Add a response to return on next call."""
        self.responses.append(response)

    def create_completion(
        self, messages: list[ProviderMessage], tools: list[ToolDefinition] | None = None
    ) -> CompletionResponse:
        """Return next queued response."""
        if self.call_count >= len(self.responses):
            # Default response if no more queued
            return CompletionResponse(content="No more responses queued")

        response = self.responses[self.call_count]
        self.call_count += 1
        return response

    def convert_tool_schema(self, tools: list[ToolDefinition]) -> dict:
        """Mock schema conversion."""
        return {"tools": [t.name for t in tools]}

    def invoke_tool(self, tool_name: str, parameters: dict) -> ToolExecutionResult:
        """Mock tool invocation."""
        return ToolExecutionResult(
            success=True,
            data={"result": "mocked"},
            format="json",
        )

    def format_response(self, result: ToolExecutionResult) -> dict:
        """Mock response formatting."""
        return {"formatted": result.data}


# Mock tool for testing
class MockTool(BaseTool):
    """Simple mock tool for testing."""

    def __init__(self, name: str = "mock_tool", should_succeed: bool = True):
        self._name = name
        self._should_succeed = should_succeed
        self.call_count = 0
        self.last_params = None

    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name=self._name,
            description="A mock tool for testing",
            category="analysis",
            parameters=[
                ToolParameter(
                    name="test_param",
                    type="string",
                    description="A test parameter",
                    required=False,
                )
            ],
            returns={"type": "string"},
        )

    def execute(self, **kwargs) -> ToolExecutionResult:
        self.call_count += 1
        self.last_params = kwargs

        if self._should_succeed:
            return ToolExecutionResult(
                success=True,
                data={"result": f"Mock execution with params: {kwargs}"},
                format="json",
            )
        else:
            return ToolExecutionResult(
                success=False,
                data=None,
                format="json",
                errors=["Mock tool error"],
            )


class TestLLMAgent:
    """Tests for LLMAgent."""

    @pytest.fixture
    def mock_provider(self) -> MockProvider:
        """Create mock provider."""
        config = ProviderConfig(
            provider_name="mock",
            api_key="test-key",
            model="mock-model",
        )
        return MockProvider(config)

    @pytest.fixture
    def mock_executor(self) -> ToolExecutor:
        """Create executor with mock tool."""
        from cycling_ai.tools.registry import ToolRegistry

        # Create a fresh registry for each test
        executor = ToolExecutor()
        executor.registry = ToolRegistry()

        tool = MockTool("test_tool")
        executor.registry.register(tool)
        return executor

    @pytest.fixture
    def session(self) -> ConversationSession:
        """Create test session."""
        return ConversationSession(
            session_id="test-session",
            provider_name="mock",
        )

    @pytest.fixture
    def agent(
        self, mock_provider: MockProvider, mock_executor: ToolExecutor, session: ConversationSession
    ) -> LLMAgent:
        """Create agent for testing."""
        return LLMAgent(
            provider=mock_provider,
            executor=mock_executor,
            session=session,
        )

    def test_create_agent(self, agent: LLMAgent) -> None:
        """Test creating an agent."""
        assert agent.provider is not None
        assert agent.executor is not None
        assert agent.session is not None
        assert agent.max_iterations == 10

    def test_simple_message_no_tools(
        self, agent: LLMAgent, mock_provider: MockProvider
    ) -> None:
        """Test processing message that doesn't require tools."""
        # Queue a simple response
        mock_provider.add_response(
            CompletionResponse(content="Hello! How can I help you today?")
        )

        response = agent.process_message("Hi there!")

        # Check response
        assert response == "Hello! How can I help you today?"

        # Check session has both messages
        assert len(agent.session.messages) == 2
        assert agent.session.messages[0].role == "user"
        assert agent.session.messages[0].content == "Hi there!"
        assert agent.session.messages[1].role == "assistant"
        assert agent.session.messages[1].content == "Hello! How can I help you today?"

    def test_message_with_tool_call(
        self, agent: LLMAgent, mock_provider: MockProvider
    ) -> None:
        """Test processing message that requires a tool call."""
        # First response: LLM wants to call a tool
        mock_provider.add_response(
            CompletionResponse(
                content="",
                tool_calls=[
                    {
                        "id": "call_123",
                        "name": "test_tool",
                        "parameters": {"test_param": "value"},
                    }
                ],
            )
        )

        # Second response: LLM interprets the tool result
        mock_provider.add_response(
            CompletionResponse(
                content="Based on the tool results, here's my analysis..."
            )
        )

        response = agent.process_message("Analyze my data")

        # Check final response
        assert "analysis" in response.lower()

        # Check session contains all messages
        assert len(agent.session.messages) >= 3
        assert agent.session.messages[0].role == "user"
        assert agent.session.messages[-1].role == "assistant"

    def test_multiple_tool_calls(
        self, agent: LLMAgent, mock_provider: MockProvider
    ) -> None:
        """Test handling multiple tool calls in sequence."""
        # First call with tool use
        mock_provider.add_response(
            CompletionResponse(
                content="",
                tool_calls=[
                    {
                        "id": "call_1",
                        "name": "test_tool",
                        "parameters": {"test_param": "value1"},
                    }
                ],
            )
        )

        # Second call with another tool use
        mock_provider.add_response(
            CompletionResponse(
                content="",
                tool_calls=[
                    {
                        "id": "call_2",
                        "name": "test_tool",
                        "parameters": {"test_param": "value2"},
                    }
                ],
            )
        )

        # Final response
        mock_provider.add_response(
            CompletionResponse(content="All done!")
        )

        response = agent.process_message("Do multiple things")

        assert response == "All done!"

    def test_max_iterations_exceeded(
        self, agent: LLMAgent, mock_provider: MockProvider
    ) -> None:
        """Test that agent raises error when max iterations exceeded."""
        # Set low max iterations
        agent.max_iterations = 2

        # Always return tool calls (infinite loop)
        for _ in range(10):
            mock_provider.add_response(
                CompletionResponse(
                    content="",
                    tool_calls=[
                        {
                            "id": f"call_{_}",
                            "name": "test_tool",
                            "parameters": {},
                        }
                    ],
                )
            )

        with pytest.raises(RuntimeError, match="Maximum iterations.*exceeded"):
            agent.process_message("Cause infinite loop")

    def test_tool_execution_failure(
        self, mock_provider: MockProvider, session: ConversationSession
    ) -> None:
        """Test handling of tool execution failure."""
        # Create executor with failing tool
        executor = ToolExecutor()
        failing_tool = MockTool("failing_tool", should_succeed=False)
        executor.registry.register(failing_tool)

        agent = LLMAgent(
            provider=mock_provider,
            executor=executor,
            session=session,
        )

        # LLM wants to call the failing tool
        mock_provider.add_response(
            CompletionResponse(
                content="",
                tool_calls=[
                    {
                        "id": "call_fail",
                        "name": "failing_tool",
                        "parameters": {},
                    }
                ],
            )
        )

        # LLM handles the error
        mock_provider.add_response(
            CompletionResponse(
                content="I encountered an error with that operation."
            )
        )

        response = agent.process_message("Try to use failing tool")

        # Agent should handle gracefully
        assert "error" in response.lower()

    def test_get_conversation_history(self, agent: LLMAgent) -> None:
        """Test retrieving conversation history."""
        agent.session.add_message(
            Mock(role="user", content="First message")
        )
        agent.session.add_message(
            Mock(role="assistant", content="First response")
        )

        history = agent.get_conversation_history()

        assert len(history) == 2
        assert history[0].content == "First message"
        assert history[1].content == "First response"

    def test_clear_history(self, agent: LLMAgent) -> None:
        """Test clearing conversation history."""
        agent.session.add_message(
            Mock(role="user", content="Message 1")
        )
        agent.session.add_message(
            Mock(role="assistant", content="Response 1")
        )

        agent.clear_history(keep_system=False)

        assert len(agent.session.messages) == 0

    def test_clear_history_keep_system(self, agent: LLMAgent) -> None:
        """Test clearing history while keeping system message."""
        from cycling_ai.orchestration.session import ConversationMessage

        agent.session.add_message(
            ConversationMessage(role="system", content="You are a helpful assistant")
        )
        agent.session.add_message(
            ConversationMessage(role="user", content="Hello")
        )
        agent.session.add_message(
            ConversationMessage(role="assistant", content="Hi!")
        )

        agent.clear_history(keep_system=True)

        assert len(agent.session.messages) == 1
        assert agent.session.messages[0].role == "system"


class TestAgentFactory:
    """Tests for AgentFactory."""

    def test_create_agent(self) -> None:
        """Test creating agent via factory."""
        config = ProviderConfig(
            provider_name="mock",
            api_key="test-key",
            model="mock-model",
        )
        provider = MockProvider(config)
        session = ConversationSession(
            session_id="test",
            provider_name="mock",
        )

        agent = AgentFactory.create_agent(
            provider=provider,
            session=session,
        )

        assert isinstance(agent, LLMAgent)
        assert agent.provider == provider
        assert agent.session == session

    def test_create_agent_with_system_prompt(self) -> None:
        """Test creating agent with system prompt."""
        config = ProviderConfig(
            provider_name="mock",
            api_key="test-key",
            model="mock-model",
        )
        provider = MockProvider(config)
        session = ConversationSession(
            session_id="test",
            provider_name="mock",
        )

        agent = AgentFactory.create_agent(
            provider=provider,
            session=session,
            system_prompt="You are a cycling coach.",
        )

        # Should have system message
        assert len(agent.session.messages) == 1
        assert agent.session.messages[0].role == "system"
        assert "cycling coach" in agent.session.messages[0].content

    def test_create_agent_doesnt_duplicate_system(self) -> None:
        """Test that factory doesn't add duplicate system messages."""
        from cycling_ai.orchestration.session import ConversationMessage

        config = ProviderConfig(
            provider_name="mock",
            api_key="test-key",
            model="mock-model",
        )
        provider = MockProvider(config)
        session = ConversationSession(
            session_id="test",
            provider_name="mock",
        )

        # Add system message manually
        session.add_message(
            ConversationMessage(role="system", content="Existing system message")
        )

        agent = AgentFactory.create_agent(
            provider=provider,
            session=session,
            system_prompt="New system prompt",
        )

        # Should only have one system message (the original)
        system_messages = [m for m in agent.session.messages if m.role == "system"]
        assert len(system_messages) == 1
        assert "Existing" in system_messages[0].content

    def test_get_default_system_prompt(self) -> None:
        """Test getting default system prompt."""
        prompt = AgentFactory.get_default_system_prompt()

        assert len(prompt) > 100
        assert "cycling" in prompt.lower()
        assert "performance" in prompt.lower()
        assert "tools" in prompt.lower()

    def test_create_agent_with_allowed_tools(self) -> None:
        """Test creating agent with tool filtering."""
        config = ProviderConfig(
            provider_name="mock",
            api_key="test-key",
            model="mock-model",
        )
        provider = MockProvider(config)
        session = ConversationSession(
            session_id="test",
            provider_name="mock",
        )

        # Create agent with only specific tools allowed
        allowed_tools = ["analyze_performance", "analyze_time_in_zones"]
        agent = AgentFactory.create_agent(
            provider=provider,
            session=session,
            allowed_tools=allowed_tools,
        )

        assert isinstance(agent, LLMAgent)
        assert agent.allowed_tools == allowed_tools
        assert agent.executor.allowed_tools == allowed_tools

        # Verify executor only returns allowed tools
        available_tools = agent.executor.list_available_tools()
        available_tool_names = [t.name for t in available_tools]

        # Should only contain tools that exist AND are in allowed list
        for tool_name in available_tool_names:
            assert tool_name in allowed_tools

    def test_tool_filtering_prevents_disallowed_tool_execution(self) -> None:
        """Test that disallowed tools cannot be executed."""
        config = ProviderConfig(
            provider_name="mock",
            api_key="test-key",
            model="mock-model",
        )
        provider = MockProvider(config)
        session = ConversationSession(
            session_id="test",
            provider_name="mock",
        )

        # Create agent with restricted tool access
        allowed_tools = ["analyze_performance"]
        agent = AgentFactory.create_agent(
            provider=provider,
            session=session,
            allowed_tools=allowed_tools,
        )

        # Try to execute a disallowed tool directly via executor
        result = agent.executor.execute_tool("generate_training_plan", {})

        # Should fail with appropriate error
        assert not result.success
        assert "not available in this context" in result.errors[0]
