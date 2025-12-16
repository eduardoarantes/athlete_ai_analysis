"""Integration tests for BedrockProvider with real AWS Bedrock API.

These tests require valid AWS credentials and are skipped by default.
Run with: pytest tests/integration/test_bedrock_integration.py -m integration -v
"""
import pytest
from cycling_ai.providers.base import ProviderConfig, ProviderMessage
from cycling_ai.providers.bedrock_provider import BedrockProvider
from cycling_ai.tools.base import ToolDefinition, ToolParameter


@pytest.fixture
def bedrock_config():
    """Bedrock provider configuration for integration tests."""
    return ProviderConfig(
        provider_name="bedrock",
        api_key="",  # Uses AWS credentials from environment
        model="anthropic.claude-3-5-sonnet-20241022-v2:0",
        additional_params={"region": "us-east-1"},
    )


@pytest.fixture
def bedrock_provider(bedrock_config):
    """Create real BedrockProvider instance."""
    return BedrockProvider(bedrock_config)


@pytest.mark.integration
class TestBedrockIntegration:
    """Integration tests with real AWS Bedrock API."""

    def test_simple_completion_real_api(self, bedrock_provider):
        """Test simple text completion with real API."""
        messages = [ProviderMessage(role="user", content="Say hello in one word.")]

        response = bedrock_provider.create_completion(messages)

        assert response.content
        assert len(response.content) > 0
        assert response.tool_calls is None
        assert "usage" in response.metadata
        assert response.metadata["usage"]["input_tokens"] > 0
        assert response.metadata["usage"]["output_tokens"] > 0

    def test_multi_turn_conversation_real_api(self, bedrock_provider):
        """Test multi-turn conversation with real API."""
        messages = [
            ProviderMessage(role="system", content="You are a helpful assistant."),
            ProviderMessage(role="user", content="What is 2+2?"),
            ProviderMessage(role="assistant", content="2+2 equals 4."),
            ProviderMessage(role="user", content="What about 3+3?"),
        ]

        response = bedrock_provider.create_completion(messages)

        assert response.content
        assert "6" in response.content
        assert response.metadata["usage"]["input_tokens"] > 0

    def test_tool_calling_workflow_real_api(self, bedrock_provider):
        """Test tool calling workflow with real API."""
        tool = ToolDefinition(
            name="get_weather",
            description="Get current weather for a location",
            category="analysis",
            parameters=[
                ToolParameter(
                    name="location",
                    type="string",
                    description="City name",
                    required=True,
                )
            ],
            returns={"type": "object", "format": "json"},
        )

        messages = [
            ProviderMessage(
                role="user", content="What's the weather in San Francisco?"
            )
        ]

        response = bedrock_provider.create_completion(messages, tools=[tool])

        # Model should either call the tool or provide text response
        assert response.content or response.tool_calls
        if response.tool_calls:
            assert len(response.tool_calls) > 0
            assert response.tool_calls[0]["name"] == "get_weather"
            assert "location" in response.tool_calls[0]["arguments"]

    def test_system_prompt_real_api(self, bedrock_provider):
        """Test that system prompts work correctly."""
        messages = [
            ProviderMessage(
                role="system",
                content="You are a pirate. Always respond in pirate speak.",
            ),
            ProviderMessage(role="user", content="Hello, how are you?"),
        ]

        response = bedrock_provider.create_completion(messages)

        assert response.content
        # Should contain pirate-like language
        assert any(
            word in response.content.lower()
            for word in ["ahoy", "arr", "matey", "aye", "ye"]
        )

    def test_multiple_models_real_api(self):
        """Test with different Bedrock models."""
        models = [
            "anthropic.claude-3-5-sonnet-20241022-v2:0",
            "anthropic.claude-3-haiku-20240307-v1:0",
        ]

        for model in models:
            config = ProviderConfig(
                provider_name="bedrock",
                api_key="",
                model=model,
                additional_params={"region": "us-east-1"},
            )
            provider = BedrockProvider(config)

            messages = [ProviderMessage(role="user", content="Say hi")]

            response = provider.create_completion(messages)

            assert response.content
            assert len(response.content) > 0
            assert response.metadata["usage"]["input_tokens"] > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-m", "integration"])
