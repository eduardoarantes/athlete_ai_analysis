"""
Tests for InteractionMetrics data model.
"""

from __future__ import annotations

from datetime import datetime

import pytest

from cycling_ai.providers.interaction_metrics import InteractionMetrics


class TestInteractionMetrics:
    """Test the InteractionMetrics dataclass."""

    def test_minimal_metrics_creation(self) -> None:
        """Test creating metrics with minimal required fields."""
        metrics = InteractionMetrics(
            session_id="session_123",
            request_id="request_456",
            user_id=None,
            provider_name="anthropic",
            model="claude-sonnet-4",
            prompt_version="1.0",
            trigger_type="system",
            triggered_by=None,
            input_tokens=None,
            output_tokens=None,
            estimated_cost=None,
            duration_ms=None,
            api_latency_ms=None,
        )

        assert metrics.session_id == "session_123"
        assert metrics.request_id == "request_456"
        assert metrics.user_id is None
        assert metrics.provider_name == "anthropic"
        assert metrics.model == "claude-sonnet-4"
        assert metrics.prompt_version == "1.0"
        assert metrics.trigger_type == "system"
        assert metrics.error_code is None
        assert metrics.retry_count == 0
        assert isinstance(metrics.timestamp, datetime)

    def test_full_metrics_creation(self) -> None:
        """Test creating metrics with all fields populated."""
        timestamp = datetime(2026, 1, 11, 12, 0, 0)

        metrics = InteractionMetrics(
            session_id="session_123",
            request_id="request_456",
            user_id="user_789",
            provider_name="openai",
            model="gpt-4o",
            prompt_version="2.3",
            trigger_type="api_request",
            triggered_by="/api/v1/plan/generate",
            input_tokens=1500,
            output_tokens=800,
            estimated_cost=0.045,
            duration_ms=1234.56,
            api_latency_ms=1100.25,
            error_code="rate_limit",
            retry_count=2,
            timestamp=timestamp,
        )

        assert metrics.session_id == "session_123"
        assert metrics.request_id == "request_456"
        assert metrics.user_id == "user_789"
        assert metrics.provider_name == "openai"
        assert metrics.model == "gpt-4o"
        assert metrics.prompt_version == "2.3"
        assert metrics.trigger_type == "api_request"
        assert metrics.triggered_by == "/api/v1/plan/generate"
        assert metrics.input_tokens == 1500
        assert metrics.output_tokens == 800
        assert metrics.estimated_cost == 0.045
        assert metrics.duration_ms == 1234.56
        assert metrics.api_latency_ms == 1100.25
        assert metrics.error_code == "rate_limit"
        assert metrics.retry_count == 2
        assert metrics.timestamp == timestamp

    def test_to_dict_with_all_fields(self) -> None:
        """Test converting metrics to dictionary for database insertion."""
        timestamp = datetime(2026, 1, 11, 12, 0, 0)

        metrics = InteractionMetrics(
            session_id="session_123",
            request_id="request_456",
            user_id="user_789",
            provider_name="gemini",
            model="gemini-2.0-flash",
            prompt_version="1.5",
            trigger_type="background_task",
            triggered_by="generate_weekly_report",
            input_tokens=2000,
            output_tokens=1200,
            estimated_cost=0.0015,
            duration_ms=850.0,
            api_latency_ms=800.0,
            error_code=None,
            retry_count=0,
            timestamp=timestamp,
        )

        result = metrics.to_dict()

        assert result == {
            "session_id": "session_123",
            "request_id": "request_456",
            "user_id": "user_789",
            "provider_name": "gemini",
            "model": "gemini-2.0-flash",
            "prompt_version": "1.5",
            "trigger_type": "background_task",
            "triggered_by": "generate_weekly_report",
            "input_tokens": 2000,
            "output_tokens": 1200,
            "estimated_cost": 0.0015,
            "duration_ms": 850.0,
            "api_latency_ms": 800.0,
            "error_code": None,
            "retry_count": 0,
            "timestamp": "2026-01-11T12:00:00",
        }

    def test_to_dict_with_none_values(self) -> None:
        """Test that None values are preserved in to_dict()."""
        metrics = InteractionMetrics(
            session_id="session_123",
            request_id="request_456",
            user_id=None,
            provider_name="ollama",
            model="llama3",
            prompt_version="default",
            trigger_type="tool_call",
            triggered_by=None,
            input_tokens=None,
            output_tokens=None,
            estimated_cost=None,
            duration_ms=None,
            api_latency_ms=None,
        )

        result = metrics.to_dict()

        assert result["user_id"] is None
        assert result["triggered_by"] is None
        assert result["input_tokens"] is None
        assert result["output_tokens"] is None
        assert result["estimated_cost"] is None
        assert result["duration_ms"] is None
        assert result["api_latency_ms"] is None
        assert result["error_code"] is None

    def test_default_timestamp_is_set(self) -> None:
        """Test that timestamp defaults to current time if not provided."""
        before = datetime.now()

        metrics = InteractionMetrics(
            session_id="session_123",
            request_id="request_456",
            user_id=None,
            provider_name="anthropic",
            model="claude-sonnet-4",
            prompt_version="1.0",
            trigger_type="system",
            triggered_by=None,
            input_tokens=None,
            output_tokens=None,
            estimated_cost=None,
            duration_ms=None,
            api_latency_ms=None,
        )

        after = datetime.now()

        # Timestamp should be between before and after
        assert before <= metrics.timestamp <= after

    def test_default_retry_count_is_zero(self) -> None:
        """Test that retry_count defaults to 0."""
        metrics = InteractionMetrics(
            session_id="session_123",
            request_id="request_456",
            user_id=None,
            provider_name="anthropic",
            model="claude-sonnet-4",
            prompt_version="1.0",
            trigger_type="system",
            triggered_by=None,
            input_tokens=None,
            output_tokens=None,
            estimated_cost=None,
            duration_ms=None,
            api_latency_ms=None,
        )

        assert metrics.retry_count == 0

    def test_trigger_types(self) -> None:
        """Test different trigger types are accepted."""
        trigger_types = ["api_request", "background_task", "tool_call", "system"]

        for trigger_type in trigger_types:
            metrics = InteractionMetrics(
                session_id="session_123",
                request_id="request_456",
                user_id=None,
                provider_name="anthropic",
                model="claude-sonnet-4",
                prompt_version="1.0",
                trigger_type=trigger_type,
                triggered_by=None,
                input_tokens=None,
                output_tokens=None,
                estimated_cost=None,
                duration_ms=None,
                api_latency_ms=None,
            )

            assert metrics.trigger_type == trigger_type
