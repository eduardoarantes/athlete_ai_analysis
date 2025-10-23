"""Tests for provider base abstractions."""
from __future__ import annotations

import pytest

from cycling_ai.providers.base import (
    BaseProvider,
    CompletionResponse,
    ProviderConfig,
    ProviderMessage,
)
from cycling_ai.tools.base import ToolDefinition, ToolExecutionResult


class TestProviderConfig:
    """Tests for ProviderConfig."""

    def test_valid_config(self) -> None:
        """Test creating a valid provider config."""
        config = ProviderConfig(
            provider_name="openai",
            api_key="sk-test",
            model="gpt-4",
            max_tokens=2048,
            temperature=0.5,
        )

        assert config.provider_name == "openai"
        assert config.api_key == "sk-test"
        assert config.model == "gpt-4"

    def test_invalid_temperature(self) -> None:
        """Test that invalid temperature raises ValueError."""
        with pytest.raises(ValueError, match="temperature must be between"):
            ProviderConfig(
                provider_name="openai",
                api_key="test",
                model="gpt-4",
                temperature=3.0,
            )

    def test_invalid_max_tokens(self) -> None:
        """Test that invalid max_tokens raises ValueError."""
        with pytest.raises(ValueError, match="max_tokens must be positive"):
            ProviderConfig(
                provider_name="openai",
                api_key="test",
                model="gpt-4",
                max_tokens=-1,
            )


class TestProviderMessage:
    """Tests for ProviderMessage."""

    def test_valid_message(self) -> None:
        """Test creating a valid message."""
        msg = ProviderMessage(
            role="user",
            content="Hello, world!",
        )

        assert msg.role == "user"
        assert msg.content == "Hello, world!"
        assert msg.tool_calls is None

    def test_invalid_role(self) -> None:
        """Test that invalid role raises ValueError."""
        with pytest.raises(ValueError, match="Invalid role"):
            ProviderMessage(
                role="invalid",
                content="Test",
            )


class TestCompletionResponse:
    """Tests for CompletionResponse."""

    def test_response_to_dict(self) -> None:
        """Test converting response to dictionary."""
        response = CompletionResponse(
            content="Response text",
            metadata={"model": "gpt-4", "tokens": 100},
        )

        response_dict = response.to_dict()
        assert response_dict["content"] == "Response text"
        assert response_dict["metadata"]["model"] == "gpt-4"


class TestBaseProvider:
    """Tests for BaseProvider."""

    def test_cannot_instantiate_directly(self) -> None:
        """Test that BaseProvider cannot be instantiated directly."""
        config = ProviderConfig(
            provider_name="test",
            api_key="test",
            model="test",
        )

        with pytest.raises(TypeError):
            BaseProvider(config)  # type: ignore
