"""
Tests for provider utilities.

Tests shared utility functions used by multiple providers.
"""
from __future__ import annotations

import time
from typing import Any

import pytest

from cycling_ai.tools.base import ToolDefinition, ToolParameter


class TestRetryWithExponentialBackoff:
    """Tests for retry decorator."""

    def test_retry_success_first_attempt(self) -> None:
        """Test successful execution on first attempt."""
        from cycling_ai.providers.provider_utils import retry_with_exponential_backoff

        call_count = 0

        @retry_with_exponential_backoff(max_retries=3)
        def successful_function() -> str:
            nonlocal call_count
            call_count += 1
            return "success"

        result = successful_function()
        assert result == "success"
        assert call_count == 1

    def test_retry_success_after_failures(self) -> None:
        """Test successful execution after transient failures."""
        from cycling_ai.providers.provider_utils import retry_with_exponential_backoff

        call_count = 0

        @retry_with_exponential_backoff(max_retries=3, initial_delay=0.01)
        def eventually_successful() -> str:
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ConnectionError("Temporary network error")
            return "success"

        result = eventually_successful()
        assert result == "success"
        assert call_count == 3

    def test_retry_permanent_error_no_retry(self) -> None:
        """Test that permanent errors are not retried."""
        from cycling_ai.providers.provider_utils import retry_with_exponential_backoff

        call_count = 0

        @retry_with_exponential_backoff(max_retries=3)
        def permanent_error() -> str:
            nonlocal call_count
            call_count += 1
            raise ValueError("Invalid API key")

        with pytest.raises(ValueError, match="Invalid API key"):
            permanent_error()

        # Should only be called once (no retries for permanent errors)
        assert call_count == 1

    def test_retry_all_attempts_exhausted(self) -> None:
        """Test that exception is raised after all retries exhausted."""
        from cycling_ai.providers.provider_utils import retry_with_exponential_backoff

        call_count = 0

        @retry_with_exponential_backoff(max_retries=3, initial_delay=0.01)
        def always_fails() -> str:
            nonlocal call_count
            call_count += 1
            raise ConnectionError("Network error")

        with pytest.raises(ConnectionError, match="Network error"):
            always_fails()

        # Should be called max_retries times
        assert call_count == 3

    def test_retry_exponential_backoff(self) -> None:
        """Test that delays increase exponentially."""
        from cycling_ai.providers.provider_utils import retry_with_exponential_backoff

        delays: list[float] = []
        call_count = 0

        @retry_with_exponential_backoff(
            max_retries=3, initial_delay=0.1, exponential_base=2.0
        )
        def track_delays() -> str:
            nonlocal call_count
            call_count += 1
            if call_count > 1:
                delays.append(time.time())
            if call_count < 3:
                raise ConnectionError("Network error")
            return "success"

        track_delays()

        # Should have 2 delays (between 3 calls)
        assert len(delays) == 2

        # Second delay should be approximately 2x first delay (exponential)
        # (allowing for timing variance)
        if len(delays) == 2:
            time_diff = delays[1] - delays[0]
            # Should be roughly 0.2 seconds (0.1 * 2^1)
            assert 0.15 < time_diff < 0.35


class TestIsPermanentError:
    """Tests for permanent error detection."""

    def test_authentication_error_is_permanent(self) -> None:
        """Test that authentication errors are permanent."""
        from cycling_ai.providers.provider_utils import is_permanent_error

        class AuthenticationError(Exception):
            pass

        error = AuthenticationError("Invalid API key")
        assert is_permanent_error(error) is True

    def test_value_error_is_permanent(self) -> None:
        """Test that value errors are permanent."""
        from cycling_ai.providers.provider_utils import is_permanent_error

        error = ValueError("Invalid parameter")
        assert is_permanent_error(error) is True

    def test_connection_error_is_transient(self) -> None:
        """Test that connection errors are transient (not permanent)."""
        from cycling_ai.providers.provider_utils import is_permanent_error

        error = ConnectionError("Network timeout")
        assert is_permanent_error(error) is False

    def test_runtime_error_is_transient(self) -> None:
        """Test that runtime errors are transient."""
        from cycling_ai.providers.provider_utils import is_permanent_error

        error = RuntimeError("Temporary issue")
        assert is_permanent_error(error) is False


class TestConvertToOpenAIFormat:
    """Tests for OpenAI format conversion."""

    def test_convert_single_tool(self, sample_tool_definition: ToolDefinition) -> None:
        """Test converting a single tool to OpenAI format."""
        from cycling_ai.providers.provider_utils import convert_to_openai_format

        result = convert_to_openai_format([sample_tool_definition])

        assert len(result) == 1
        tool_schema = result[0]

        # Check structure
        assert tool_schema["type"] == "function"
        assert "function" in tool_schema

        func = tool_schema["function"]
        assert func["name"] == "analyze_performance"
        assert func["description"] == "Analyze cycling performance data"

        # Check parameters
        assert "parameters" in func
        params = func["parameters"]
        assert params["type"] == "object"
        assert "properties" in params
        assert "required" in params

        # Check individual parameters
        props = params["properties"]
        assert "period_months" in props
        assert props["period_months"]["type"] == "integer"
        assert props["period_months"]["description"] == "Number of months to analyze"

        assert "include_cross_training" in props
        assert props["include_cross_training"]["type"] == "boolean"

        assert "metric_type" in props
        assert props["metric_type"]["enum"] == ["power", "heart_rate", "cadence"]

        # Check required fields
        assert "period_months" in params["required"]
        assert "metric_type" in params["required"]
        assert "include_cross_training" not in params["required"]

    def test_convert_multiple_tools(self) -> None:
        """Test converting multiple tools."""
        from cycling_ai.providers.provider_utils import convert_to_openai_format

        tools = [
            ToolDefinition(
                name="tool1",
                description="First tool",
                category="analysis",
                parameters=[
                    ToolParameter(
                        name="param1",
                        type="string",
                        description="String parameter",
                        required=True,
                    )
                ],
                returns={"type": "json"},
            ),
            ToolDefinition(
                name="tool2",
                description="Second tool",
                category="analysis",
                parameters=[
                    ToolParameter(
                        name="param2",
                        type="number",
                        description="Number parameter",
                        required=False,
                    )
                ],
                returns={"type": "json"},
            ),
        ]

        result = convert_to_openai_format(tools)

        assert len(result) == 2
        assert result[0]["function"]["name"] == "tool1"
        assert result[1]["function"]["name"] == "tool2"

    def test_convert_tool_with_no_parameters(self) -> None:
        """Test converting tool with no parameters."""
        from cycling_ai.providers.provider_utils import convert_to_openai_format

        tool = ToolDefinition(
            name="simple_tool",
            description="Tool with no parameters",
            category="analysis",
            parameters=[],
            returns={"type": "json"},
        )

        result = convert_to_openai_format([tool])

        assert len(result) == 1
        func = result[0]["function"]
        assert func["name"] == "simple_tool"
        assert func["parameters"]["properties"] == {}
        assert func["parameters"]["required"] == []
