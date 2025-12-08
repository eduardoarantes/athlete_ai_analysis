"""Unit tests for BedrockProvider."""

import pytest
from unittest.mock import Mock, patch

from cycling_ai.providers.base import ProviderConfig, ProviderMessage
from cycling_ai.providers.bedrock_provider import BedrockProvider
from cycling_ai.tools.base import ToolDefinition, ToolParameter


@pytest.fixture
def bedrock_config():
    """Bedrock provider configuration."""
    return ProviderConfig(
        provider_name="bedrock",
        api_key="",  # Bedrock uses AWS credentials
        model="anthropic.claude-3-5-sonnet-20241022-v2:0",
        additional_params={"region": "us-east-1"},
    )


@pytest.fixture
def mock_boto3_client():
    """Mock boto3 bedrock-runtime client."""
    with patch("boto3.Session") as mock_session:
        mock_client = Mock()
        mock_session.return_value.client.return_value = mock_client
        yield mock_client


@pytest.fixture
def bedrock_provider(bedrock_config):
    """BedrockProvider instance with mocked boto3."""
    with patch("boto3.Session"):
        # Temporarily skip __init__ implementation
        provider = object.__new__(BedrockProvider)
        provider.config = bedrock_config
        return provider


class TestBedrockProvider:
    """Test suite for BedrockProvider."""

    def test_fixture_setup(self, bedrock_provider):
        """Test that fixtures are set up correctly."""
        assert bedrock_provider is not None
        assert bedrock_provider.config.provider_name == "bedrock"


class TestToolSchemaConversion:
    """Test tool schema conversion to Bedrock format."""

    def test_convert_simple_tool(self, bedrock_provider):
        """Test conversion of simple tool with string parameter."""
        tool = ToolDefinition(
            name="test_tool",
            description="A simple test tool",
            category="analysis",
            parameters=[
                ToolParameter(
                    name="input_text",
                    type="string",
                    description="Input text to process",
                    required=True,
                )
            ],
            returns={"type": "string", "format": "json"},
        )

        schema = bedrock_provider.convert_tool_schema([tool])

        assert len(schema) == 1
        assert schema[0]["toolSpec"]["name"] == "test_tool"
        assert schema[0]["toolSpec"]["description"] == "A simple test tool"
        assert "inputSchema" in schema[0]["toolSpec"]
        assert schema[0]["toolSpec"]["inputSchema"]["json"]["type"] == "object"
        assert "input_text" in schema[0]["toolSpec"]["inputSchema"]["json"]["properties"]
        assert (
            schema[0]["toolSpec"]["inputSchema"]["json"]["properties"]["input_text"]["type"]
            == "string"
        )
        assert (
            schema[0]["toolSpec"]["inputSchema"]["json"]["properties"]["input_text"]["description"]
            == "Input text to process"
        )
        assert schema[0]["toolSpec"]["inputSchema"]["json"]["required"] == ["input_text"]

    def test_convert_tool_multiple_parameters(self, bedrock_provider):
        """Test conversion of tool with multiple parameters of different types."""
        tool = ToolDefinition(
            name="analyze_data",
            description="Analyze cycling data",
            category="analysis",
            parameters=[
                ToolParameter(
                    name="file_path", type="string", description="Path to CSV file", required=True
                ),
                ToolParameter(
                    name="period_months",
                    type="integer",
                    description="Number of months to analyze",
                    required=True,
                ),
                ToolParameter(
                    name="include_zones",
                    type="boolean",
                    description="Whether to include zone analysis",
                    required=False,
                ),
                ToolParameter(
                    name="threshold",
                    type="number",
                    description="Performance threshold",
                    required=False,
                ),
            ],
            returns={"type": "object", "format": "json"},
        )

        schema = bedrock_provider.convert_tool_schema([tool])

        assert len(schema) == 1
        tool_spec = schema[0]["toolSpec"]
        assert tool_spec["name"] == "analyze_data"

        properties = tool_spec["inputSchema"]["json"]["properties"]
        assert properties["file_path"]["type"] == "string"
        assert properties["period_months"]["type"] == "integer"
        assert properties["include_zones"]["type"] == "boolean"
        assert properties["threshold"]["type"] == "number"

        assert set(tool_spec["inputSchema"]["json"]["required"]) == {"file_path", "period_months"}

    def test_convert_tool_with_enum(self, bedrock_provider):
        """Test conversion of tool parameter with enum values."""
        tool = ToolDefinition(
            name="set_mode",
            description="Set operation mode",
            category="data_prep",
            parameters=[
                ToolParameter(
                    name="mode",
                    type="string",
                    description="Operation mode",
                    required=True,
                    enum=["fast", "accurate", "balanced"],
                )
            ],
            returns={"type": "string", "format": "json"},
        )

        schema = bedrock_provider.convert_tool_schema([tool])

        properties = schema[0]["toolSpec"]["inputSchema"]["json"]["properties"]
        assert properties["mode"]["enum"] == ["fast", "accurate", "balanced"]

    def test_convert_tool_with_array_parameter(self, bedrock_provider):
        """Test conversion of tool with array parameter."""
        tool = ToolDefinition(
            name="process_list",
            description="Process a list of items",
            category="analysis",
            parameters=[
                ToolParameter(
                    name="items",
                    type="array",
                    description="List of items to process",
                    required=True,
                    items={"type": "string"},
                )
            ],
            returns={"type": "array", "format": "json"},
        )

        schema = bedrock_provider.convert_tool_schema([tool])

        properties = schema[0]["toolSpec"]["inputSchema"]["json"]["properties"]
        assert properties["items"]["type"] == "array"
        assert properties["items"]["items"] == {"type": "string"}

    def test_convert_tool_with_nested_object(self, bedrock_provider):
        """Test conversion of tool with nested object schema."""
        tool = ToolDefinition(
            name="complex_tool",
            description="Tool with complex nested schema",
            category="analysis",
            parameters=[
                ToolParameter(
                    name="config",
                    type="object",
                    description="Configuration object",
                    required=True,
                    items={
                        "type": "object",
                        "properties": {"name": {"type": "string"}, "value": {"type": "integer"}},
                    },
                )
            ],
            returns={"type": "object", "format": "json"},
        )

        schema = bedrock_provider.convert_tool_schema([tool])

        properties = schema[0]["toolSpec"]["inputSchema"]["json"]["properties"]
        assert properties["config"]["type"] == "object"
        assert "items" in properties["config"]
        assert properties["config"]["items"]["type"] == "object"

    def test_convert_multiple_tools(self, bedrock_provider):
        """Test conversion of multiple tools at once."""
        tools = [
            ToolDefinition(
                name="tool1",
                description="First tool",
                category="analysis",
                parameters=[
                    ToolParameter(
                        name="param1", type="string", description="Param 1", required=True
                    )
                ],
                returns={"type": "string", "format": "json"},
            ),
            ToolDefinition(
                name="tool2",
                description="Second tool",
                category="reporting",
                parameters=[
                    ToolParameter(
                        name="param2", type="integer", description="Param 2", required=True
                    )
                ],
                returns={"type": "string", "format": "json"},
            ),
        ]

        schema = bedrock_provider.convert_tool_schema(tools)

        assert len(schema) == 2
        assert schema[0]["toolSpec"]["name"] == "tool1"
        assert schema[1]["toolSpec"]["name"] == "tool2"

    def test_convert_tool_type_normalization(self, bedrock_provider):
        """Test that parameter types are normalized to lowercase in output."""
        # ToolParameter already validates types at creation, so we test
        # that the output is lowercase regardless of how it's stored
        tool = ToolDefinition(
            name="test_tool",
            description="Test type normalization",
            category="analysis",
            parameters=[
                ToolParameter(
                    name="param1", type="string", description="String param", required=True
                ),
                ToolParameter(
                    name="param2", type="integer", description="Integer param", required=True
                ),
            ],
            returns={"type": "string", "format": "json"},
        )

        schema = bedrock_provider.convert_tool_schema([tool])

        properties = schema[0]["toolSpec"]["inputSchema"]["json"]["properties"]
        # Verify types are lowercase in output
        assert properties["param1"]["type"] == "string"
        assert properties["param2"]["type"] == "integer"

    def test_convert_empty_tool_list(self, bedrock_provider):
        """Test conversion of empty tool list."""
        schema = bedrock_provider.convert_tool_schema([])
        assert schema == []


class TestMessageConversion:
    """Test message conversion to Bedrock format."""

    def test_convert_messages_user_simple(self, bedrock_provider):
        """Test conversion of simple user message."""
        messages = [ProviderMessage(role="user", content="Hello, how are you?")]

        converted = bedrock_provider._convert_messages(messages)

        assert len(converted) == 1
        assert converted[0]["role"] == "user"
        assert len(converted[0]["content"]) == 1
        assert converted[0]["content"][0]["text"] == "Hello, how are you?"

    def test_convert_messages_system_filtered(self, bedrock_provider):
        """Test that system messages are filtered out (handled separately)."""
        messages = [
            ProviderMessage(role="system", content="You are a helpful assistant"),
            ProviderMessage(role="user", content="Hello"),
        ]

        converted = bedrock_provider._convert_messages(messages)

        # System message should be filtered out
        assert len(converted) == 1
        assert converted[0]["role"] == "user"

    def test_convert_messages_assistant_text_only(self, bedrock_provider):
        """Test conversion of assistant message with text only."""
        messages = [
            ProviderMessage(role="user", content="What is 2+2?"),
            ProviderMessage(role="assistant", content="The answer is 4."),
        ]

        converted = bedrock_provider._convert_messages(messages)

        assert len(converted) == 2
        assert converted[1]["role"] == "assistant"
        assert len(converted[1]["content"]) == 1
        assert converted[1]["content"][0]["text"] == "The answer is 4."

    def test_convert_messages_assistant_with_tool_calls(self, bedrock_provider):
        """Test conversion of assistant message with tool calls."""
        messages = [
            ProviderMessage(role="user", content="Analyze my data"),
            ProviderMessage(
                role="assistant",
                content="I'll analyze your data",
                tool_calls=[
                    {
                        "id": "toolu_123",
                        "name": "analyze_performance",
                        "arguments": {"period_months": 6},
                    }
                ],
            ),
        ]

        converted = bedrock_provider._convert_messages(messages)

        assert len(converted) == 2
        assert converted[1]["role"] == "assistant"
        # Should have both text and toolUse content blocks
        assert len(converted[1]["content"]) == 2
        assert converted[1]["content"][0]["text"] == "I'll analyze your data"
        assert converted[1]["content"][1]["toolUse"]["toolUseId"] == "toolu_123"
        assert converted[1]["content"][1]["toolUse"]["name"] == "analyze_performance"
        assert converted[1]["content"][1]["toolUse"]["input"] == {"period_months": 6}

    def test_convert_messages_tool_results_as_user_role(self, bedrock_provider):
        """Test conversion of tool results to user role with toolResult content."""
        messages = [
            ProviderMessage(role="user", content="Analyze my data"),
            ProviderMessage(
                role="assistant",
                content="",
                tool_calls=[
                    {
                        "id": "toolu_123",
                        "name": "analyze_performance",
                        "arguments": {"period_months": 6},
                    }
                ],
            ),
            ProviderMessage(
                role="tool",
                content='{"status": "success", "data": {...}}',
                tool_results=[
                    {
                        "tool_call_id": "toolu_123",
                        "tool_name": "analyze_performance",
                        "success": True,
                    }
                ],
            ),
        ]

        converted = bedrock_provider._convert_messages(messages)

        # Tool result should be converted to user role
        assert len(converted) == 3
        assert converted[2]["role"] == "user"
        assert len(converted[2]["content"]) == 1
        assert converted[2]["content"][0]["toolResult"]["toolUseId"] == "toolu_123"
        assert converted[2]["content"][0]["toolResult"]["content"] == [
            {"text": '{"status": "success", "data": {...}}'}
        ]

    def test_convert_messages_mixed_conversation(self, bedrock_provider):
        """Test conversion of mixed conversation with multiple message types."""
        messages = [
            ProviderMessage(role="system", content="You are a cycling coach"),
            ProviderMessage(role="user", content="How's my performance?"),
            ProviderMessage(role="assistant", content="Let me check"),
            ProviderMessage(
                role="assistant",
                content="",
                tool_calls=[{"id": "t1", "name": "analyze", "arguments": {}}],
            ),
            ProviderMessage(
                role="tool",
                content='{"result": "good"}',
                tool_results=[{"tool_call_id": "t1", "tool_name": "analyze", "success": True}],
            ),
            ProviderMessage(role="assistant", content="Your performance is good!"),
        ]

        converted = bedrock_provider._convert_messages(messages)

        # System filtered, tool converted to user
        assert len(converted) == 5
        assert converted[0]["role"] == "user"
        assert converted[1]["role"] == "assistant"
        assert converted[2]["role"] == "assistant"
        assert converted[3]["role"] == "user"  # Tool result
        assert converted[4]["role"] == "assistant"

    def test_extract_system_prompts_single(self, bedrock_provider):
        """Test extraction of single system message."""
        messages = [
            ProviderMessage(role="system", content="You are a helpful assistant"),
            ProviderMessage(role="user", content="Hello"),
        ]

        system_prompts = bedrock_provider._extract_system_prompts(messages)

        assert len(system_prompts) == 1
        assert system_prompts[0]["text"] == "You are a helpful assistant"

    def test_extract_system_prompts_multiple(self, bedrock_provider):
        """Test extraction of multiple system messages."""
        messages = [
            ProviderMessage(role="system", content="You are a coach"),
            ProviderMessage(role="user", content="Hi"),
            ProviderMessage(role="system", content="Use cycling terminology"),
        ]

        system_prompts = bedrock_provider._extract_system_prompts(messages)

        assert len(system_prompts) == 2
        assert system_prompts[0]["text"] == "You are a coach"
        assert system_prompts[1]["text"] == "Use cycling terminology"

    def test_extract_system_prompts_none(self, bedrock_provider):
        """Test extraction when no system messages present."""
        messages = [
            ProviderMessage(role="user", content="Hello"),
            ProviderMessage(role="assistant", content="Hi there"),
        ]

        system_prompts = bedrock_provider._extract_system_prompts(messages)

        assert len(system_prompts) == 0


class TestCreateCompletion:
    """Test create_completion() method with Bedrock Converse API."""

    def test_init_default_region(self, bedrock_config):
        """Test initialization with default region from config."""
        with patch("boto3.Session") as mock_session:
            mock_client = Mock()
            mock_session.return_value.client.return_value = mock_client

            provider = BedrockProvider(bedrock_config)

            # Should create session and client
            mock_session.assert_called_once()
            mock_session.return_value.client.assert_called_once_with(
                "bedrock-runtime", region_name="us-east-1"
            )
            assert provider.bedrock_client == mock_client

    def test_init_custom_region(self):
        """Test initialization with custom region."""
        config = ProviderConfig(
            provider_name="bedrock",
            api_key="",
            model="anthropic.claude-3-5-sonnet-20241022-v2:0",
            additional_params={"region": "us-west-2"},
        )

        with patch("boto3.Session") as mock_session:
            mock_client = Mock()
            mock_session.return_value.client.return_value = mock_client

            provider = BedrockProvider(config)

            mock_session.return_value.client.assert_called_once_with(
                "bedrock-runtime", region_name="us-west-2"
            )

    def test_init_with_profile(self):
        """Test initialization with AWS profile."""
        config = ProviderConfig(
            provider_name="bedrock",
            api_key="",
            model="anthropic.claude-3-5-sonnet-20241022-v2:0",
            additional_params={"profile_name": "my-profile", "region": "us-east-1"},
        )

        with patch("boto3.Session") as mock_session:
            mock_client = Mock()
            mock_session.return_value.client.return_value = mock_client

            provider = BedrockProvider(config)

            mock_session.assert_called_once_with(profile_name="my-profile")

    def test_create_completion_simple_text(self, bedrock_config):
        """Test simple text completion without tools."""
        with patch("boto3.Session") as mock_session:
            mock_client = Mock()
            mock_session.return_value.client.return_value = mock_client

            # Mock Bedrock response
            mock_client.converse.return_value = {
                "output": {
                    "message": {
                        "role": "assistant",
                        "content": [{"text": "Hello! How can I help you?"}],
                    }
                },
                "usage": {"inputTokens": 10, "outputTokens": 8, "totalTokens": 18},
            }

            provider = BedrockProvider(bedrock_config)
            messages = [ProviderMessage(role="user", content="Hello")]

            response = provider.create_completion(messages)

            assert response.content == "Hello! How can I help you?"
            assert response.tool_calls is None
            assert response.metadata["usage"]["input_tokens"] == 10
            assert response.metadata["usage"]["output_tokens"] == 8

            # Verify API call
            mock_client.converse.assert_called_once()
            call_args = mock_client.converse.call_args[1]
            assert call_args["modelId"] == bedrock_config.model
            assert len(call_args["messages"]) == 1
            assert call_args["messages"][0]["role"] == "user"

    def test_create_completion_with_system_prompt(self, bedrock_config):
        """Test completion with system prompt."""
        with patch("boto3.Session") as mock_session:
            mock_client = Mock()
            mock_session.return_value.client.return_value = mock_client

            mock_client.converse.return_value = {
                "output": {
                    "message": {"role": "assistant", "content": [{"text": "I'm a cycling coach!"}]}
                },
                "usage": {"inputTokens": 15, "outputTokens": 6, "totalTokens": 21},
            }

            provider = BedrockProvider(bedrock_config)
            messages = [
                ProviderMessage(role="system", content="You are a cycling coach"),
                ProviderMessage(role="user", content="Who are you?"),
            ]

            response = provider.create_completion(messages)

            assert "cycling coach" in response.content

            # Verify system prompt passed separately
            call_args = mock_client.converse.call_args[1]
            assert "system" in call_args
            assert call_args["system"][0]["text"] == "You are a cycling coach"
            # User message only (system filtered from messages)
            assert len(call_args["messages"]) == 1

    def test_create_completion_with_tool_calls(self, bedrock_config):
        """Test completion that returns tool calls."""
        with patch("boto3.Session") as mock_session:
            mock_client = Mock()
            mock_session.return_value.client.return_value = mock_client

            mock_client.converse.return_value = {
                "output": {
                    "message": {
                        "role": "assistant",
                        "content": [
                            {"text": "I'll analyze that for you."},
                            {
                                "toolUse": {
                                    "toolUseId": "toolu_123",
                                    "name": "analyze_performance",
                                    "input": {"period_months": 6},
                                }
                            },
                        ],
                    }
                },
                "usage": {"inputTokens": 100, "outputTokens": 50, "totalTokens": 150},
            }

            provider = BedrockProvider(bedrock_config)

            tool = ToolDefinition(
                name="analyze_performance",
                description="Analyze performance data",
                category="analysis",
                parameters=[
                    ToolParameter(
                        name="period_months", type="integer", description="Months", required=True
                    )
                ],
                returns={"type": "object", "format": "json"},
            )

            messages = [ProviderMessage(role="user", content="Analyze my performance")]
            response = provider.create_completion(messages, tools=[tool])

            assert "analyze" in response.content.lower()
            assert response.tool_calls is not None
            assert len(response.tool_calls) == 1
            assert response.tool_calls[0]["id"] == "toolu_123"
            assert response.tool_calls[0]["name"] == "analyze_performance"
            assert response.tool_calls[0]["arguments"] == {"period_months": 6}

    def test_create_completion_force_tool_call(self, bedrock_config):
        """Test forcing model to call a tool."""
        with patch("boto3.Session") as mock_session:
            mock_client = Mock()
            mock_session.return_value.client.return_value = mock_client

            mock_client.converse.return_value = {
                "output": {
                    "message": {
                        "role": "assistant",
                        "content": [
                            {
                                "toolUse": {
                                    "toolUseId": "toolu_456",
                                    "name": "test_tool",
                                    "input": {},
                                }
                            }
                        ],
                    }
                },
                "usage": {"inputTokens": 10, "outputTokens": 10, "totalTokens": 20},
            }

            provider = BedrockProvider(bedrock_config)

            tool = ToolDefinition(
                name="test_tool",
                description="Test tool",
                category="analysis",
                parameters=[],
                returns={"type": "string", "format": "json"},
            )

            messages = [ProviderMessage(role="user", content="Test")]
            response = provider.create_completion(messages, tools=[tool], force_tool_call=True)

            # Verify toolChoice was set to force tool use
            call_args = mock_client.converse.call_args[1]
            assert "toolChoice" in call_args
            assert call_args["toolChoice"] == {"any": {}}

    def test_create_completion_access_denied_error(self, bedrock_config):
        """Test handling of AWS access denied error."""
        from botocore.exceptions import ClientError

        with patch("boto3.Session") as mock_session:
            mock_client = Mock()
            mock_session.return_value.client.return_value = mock_client

            # Simulate AccessDeniedException
            mock_client.converse.side_effect = ClientError(
                {"Error": {"Code": "AccessDeniedException", "Message": "Not authorized"}},
                "Converse",
            )

            provider = BedrockProvider(bedrock_config)
            messages = [ProviderMessage(role="user", content="Hello")]

            with pytest.raises(ValueError) as exc_info:
                provider.create_completion(messages)

            assert "Access denied" in str(exc_info.value)

    def test_create_completion_model_not_found_error(self, bedrock_config):
        """Test handling of model not found error."""
        from botocore.exceptions import ClientError

        with patch("boto3.Session") as mock_session:
            mock_client = Mock()
            mock_session.return_value.client.return_value = mock_client

            mock_client.converse.side_effect = ClientError(
                {"Error": {"Code": "ResourceNotFoundException", "Message": "Model not found"}},
                "Converse",
            )

            provider = BedrockProvider(bedrock_config)
            messages = [ProviderMessage(role="user", content="Hello")]

            with pytest.raises(ValueError) as exc_info:
                provider.create_completion(messages)

            assert "not found" in str(exc_info.value).lower()

    def test_create_completion_throttling_error(self, bedrock_config):
        """Test handling of throttling error."""
        from botocore.exceptions import ClientError

        with patch("boto3.Session") as mock_session:
            mock_client = Mock()
            mock_session.return_value.client.return_value = mock_client

            mock_client.converse.side_effect = ClientError(
                {"Error": {"Code": "ThrottlingException", "Message": "Rate exceeded"}}, "Converse"
            )

            provider = BedrockProvider(bedrock_config)
            messages = [ProviderMessage(role="user", content="Hello")]

            with pytest.raises(RuntimeError) as exc_info:
                provider.create_completion(messages)

            assert "throttling" in str(exc_info.value).lower()

    def test_create_completion_interaction_logging(self, bedrock_config):
        """Test that interactions are logged correctly."""
        with patch("boto3.Session") as mock_session:
            mock_client = Mock()
            mock_session.return_value.client.return_value = mock_client

            mock_client.converse.return_value = {
                "output": {"message": {"role": "assistant", "content": [{"text": "Response"}]}},
                "usage": {"inputTokens": 5, "outputTokens": 5, "totalTokens": 10},
            }

            with patch(
                "cycling_ai.providers.bedrock_provider.get_interaction_logger"
            ) as mock_get_logger:
                mock_logger = Mock()
                mock_get_logger.return_value = mock_logger

                provider = BedrockProvider(bedrock_config)
                messages = [ProviderMessage(role="user", content="Test")]

                response = provider.create_completion(messages)

                # Verify logger was called
                assert mock_logger.log_interaction.called


class TestHelperMethods:
    """Test helper methods for tool invocation and response formatting."""

    def test_invoke_tool_delegates_to_registry(self, bedrock_config):
        """Test that invoke_tool delegates to the tool registry."""
        from cycling_ai.tools.base import ToolExecutionResult
        from cycling_ai.tools.registry import get_global_registry

        with patch("boto3.Session"):
            provider = BedrockProvider(bedrock_config)

            with patch("cycling_ai.tools.registry.get_global_registry") as mock_registry_func:
                mock_tool = Mock()
                mock_result = ToolExecutionResult(
                    success=True, data={"result": "success"}, format="json"
                )
                mock_tool.execute.return_value = mock_result

                mock_registry = Mock()
                mock_registry.get_tool.return_value = mock_tool
                mock_registry_func.return_value = mock_registry

                result = provider.invoke_tool("test_tool", {"param": "value"})

                # Verify registry was called
                mock_registry.get_tool.assert_called_once_with("test_tool")
                mock_tool.execute.assert_called_once_with(param="value")
                assert result == mock_result

    def test_format_response_structure(self, bedrock_config):
        """Test that format_response returns correct structure."""
        from cycling_ai.tools.base import ToolExecutionResult

        with patch("boto3.Session"):
            provider = BedrockProvider(bedrock_config)

            result = ToolExecutionResult(success=True, data={"data": "test"}, format="json")

            formatted = provider.format_response(result)

            assert "role" in formatted
            assert "content" in formatted
            assert formatted["role"] == "tool"

    def test_format_response_with_tool_use_id(self, bedrock_config):
        """Test format_response includes tool_use_id if provided."""
        from cycling_ai.tools.base import ToolExecutionResult

        with patch("boto3.Session"):
            provider = BedrockProvider(bedrock_config)

            result = ToolExecutionResult(
                success=True,
                data={"data": "test"},
                format="json",
                metadata={"tool_call_id": "toolu_789"},
            )

            formatted = provider.format_response(result)

            # Should have content as JSON string
            assert isinstance(formatted["content"], str)


class TestGuardrails:
    """Test guardrail configuration and usage."""

    def test_guardrails_added_to_request_when_configured(self, bedrock_config):
        """Test that guardrails are added to request when configured."""
        # Add guardrail configuration
        bedrock_config.additional_params["guardrail_id"] = "test-guardrail-id"
        bedrock_config.additional_params["guardrail_version"] = "1.0"

        with patch("boto3.Session"):
            provider = BedrockProvider(bedrock_config)

            # Mock Bedrock client
            mock_response = {
                "output": {"message": {"content": [{"text": "Test response"}]}},
                "usage": {"inputTokens": 10, "outputTokens": 20, "totalTokens": 30},
            }
            provider.bedrock_client.converse = Mock(return_value=mock_response)

            # Call with no tools (guardrails compatible)
            messages = [ProviderMessage(role="user", content="Hello")]
            provider.create_completion(messages)

            # Verify guardrailConfig was added
            call_kwargs = provider.bedrock_client.converse.call_args.kwargs
            assert "guardrailConfig" in call_kwargs
            assert call_kwargs["guardrailConfig"]["guardrailIdentifier"] == "test-guardrail-id"
            assert call_kwargs["guardrailConfig"]["guardrailVersion"] == "1.0"

    def test_guardrails_not_added_with_tools(self, bedrock_config):
        """Test that guardrails are NOT added when tools are present (incompatible)."""
        from cycling_ai.tools.base import ToolDefinition, ToolParameter

        # Add guardrail configuration
        bedrock_config.additional_params["guardrail_id"] = "test-guardrail-id"

        with patch("boto3.Session"):
            provider = BedrockProvider(bedrock_config)

            # Mock Bedrock client
            mock_response = {
                "output": {"message": {"content": [{"text": "Test response"}]}},
                "usage": {"inputTokens": 10, "outputTokens": 20, "totalTokens": 30},
            }
            provider.bedrock_client.converse = Mock(return_value=mock_response)

            # Call with tools (incompatible with guardrails)
            messages = [ProviderMessage(role="user", content="Hello")]
            tools = [
                ToolDefinition(
                    name="test_tool",
                    description="Test tool",
                    category="analysis",
                    parameters=[
                        ToolParameter(
                            name="param",
                            type="string",
                            description="Test parameter",
                            required=True,
                        )
                    ],
                    returns={"type": "string", "format": "json"},
                )
            ]

            with patch("logging.Logger.warning") as mock_warning:
                provider.create_completion(messages, tools=tools)

                # Verify warning was logged
                mock_warning.assert_called_once()
                warning_msg = mock_warning.call_args[0][0]
                assert "not compatible" in warning_msg.lower()

            # Verify guardrailConfig was NOT added
            call_kwargs = provider.bedrock_client.converse.call_args.kwargs
            assert "guardrailConfig" not in call_kwargs

    def test_guardrails_with_trace_enabled(self, bedrock_config):
        """Test that trace can be enabled for guardrails."""
        bedrock_config.additional_params["guardrail_id"] = "test-guardrail-id"
        bedrock_config.additional_params["guardrail_trace"] = True

        with patch("boto3.Session"):
            provider = BedrockProvider(bedrock_config)

            # Mock Bedrock client
            mock_response = {
                "output": {"message": {"content": [{"text": "Test response"}]}},
                "usage": {"inputTokens": 10, "outputTokens": 20, "totalTokens": 30},
                "trace": {"guardrail": "trace data"},
            }
            provider.bedrock_client.converse = Mock(return_value=mock_response)

            messages = [ProviderMessage(role="user", content="Hello")]
            response = provider.create_completion(messages)

            # Verify trace was added to request
            call_kwargs = provider.bedrock_client.converse.call_args.kwargs
            assert call_kwargs["guardrailConfig"]["trace"] == "enabled"

            # Verify trace was added to response metadata
            assert "guardrail_trace" in response.metadata

    def test_guardrails_default_version_draft(self, bedrock_config):
        """Test that guardrail version defaults to DRAFT if not specified."""
        bedrock_config.additional_params["guardrail_id"] = "test-guardrail-id"
        # Don't specify version

        with patch("boto3.Session"):
            provider = BedrockProvider(bedrock_config)

            mock_response = {
                "output": {"message": {"content": [{"text": "Test response"}]}},
                "usage": {"inputTokens": 10, "outputTokens": 20, "totalTokens": 30},
            }
            provider.bedrock_client.converse = Mock(return_value=mock_response)

            messages = [ProviderMessage(role="user", content="Hello")]
            provider.create_completion(messages)

            # Verify version defaults to DRAFT
            call_kwargs = provider.bedrock_client.converse.call_args.kwargs
            assert call_kwargs["guardrailConfig"]["guardrailVersion"] == "DRAFT"
