"""
Tests for DatabaseStorage adapter.
"""

from __future__ import annotations

from datetime import datetime
from unittest.mock import MagicMock

import pytest

from cycling_ai.providers.db_storage import DatabaseStorage
from cycling_ai.providers.interaction_metrics import InteractionMetrics


class TestDatabaseStorage:
    """Test the DatabaseStorage class."""

    @pytest.fixture
    def sample_metrics(self) -> InteractionMetrics:
        """Create sample interaction metrics."""
        return InteractionMetrics(
            session_id="session_123",
            request_id="request_456",
            user_id="user_789",
            provider_name="anthropic",
            model="claude-sonnet-4",
            prompt_version="1.0",
            trigger_type="api_request",
            triggered_by="/api/v1/plan/generate",
            input_tokens=1500,
            output_tokens=800,
            estimated_cost=0.0165,
            duration_ms=1234.56,
            api_latency_ms=1100.25,
            error_code=None,
            retry_count=0,
            timestamp=datetime(2026, 1, 11, 12, 0, 0),
        )

    def test_successful_insertion_with_mock(self, sample_metrics: InteractionMetrics) -> None:
        """Test successful database insertion with mocked client."""
        # Create storage (won't be enabled due to missing supabase module in test env)
        storage = DatabaseStorage(
            supabase_url="https://test.supabase.co", supabase_key="test-key"
        )

        # Manually set up mock client
        mock_client = MagicMock()
        mock_client.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{"id": "test-id"}]
        )

        storage.client = mock_client
        storage.enabled = True

        # Store interaction
        storage.store_interaction(sample_metrics)

        # Verify Supabase client was called correctly
        mock_client.table.assert_called_once_with("llm_interactions")
        mock_client.table.return_value.insert.assert_called_once()

        # Get the data that was inserted
        call_args = mock_client.table.return_value.insert.call_args
        inserted_data = call_args[0][0]

        # Verify all fields were included
        assert inserted_data["session_id"] == "session_123"
        assert inserted_data["request_id"] == "request_456"
        assert inserted_data["user_id"] == "user_789"
        assert inserted_data["provider_name"] == "anthropic"
        assert inserted_data["model"] == "claude-sonnet-4"
        assert inserted_data["prompt_version"] == "1.0"
        assert inserted_data["trigger_type"] == "api_request"
        assert inserted_data["triggered_by"] == "/api/v1/plan/generate"
        assert inserted_data["input_tokens"] == 1500
        assert inserted_data["output_tokens"] == 800
        assert inserted_data["estimated_cost"] == 0.0165
        assert inserted_data["duration_ms"] == 1234.56
        assert inserted_data["api_latency_ms"] == 1100.25
        assert inserted_data["error_code"] is None
        assert inserted_data["retry_count"] == 0

    def test_graceful_degradation_on_insert_error(self, sample_metrics: InteractionMetrics) -> None:
        """Test that insert failures don't crash the application."""
        storage = DatabaseStorage(
            supabase_url="https://test.supabase.co", supabase_key="test-key"
        )

        # Set up mock that raises an exception
        mock_client = MagicMock()
        mock_client.table.return_value.insert.side_effect = Exception("Insert failed")

        storage.client = mock_client
        storage.enabled = True

        # Should not raise exception
        storage.store_interaction(sample_metrics)

    def test_none_values_handled(self) -> None:
        """Test that None values are handled correctly."""
        storage = DatabaseStorage(
            supabase_url="https://test.supabase.co", supabase_key="test-key"
        )

        mock_client = MagicMock()
        storage.client = mock_client
        storage.enabled = True

        metrics = InteractionMetrics(
            session_id="session_123",
            request_id="request_456",
            user_id=None,
            provider_name="ollama",
            model="llama3",
            prompt_version="default",
            trigger_type="system",
            triggered_by=None,
            input_tokens=None,
            output_tokens=None,
            estimated_cost=None,
            duration_ms=None,
            api_latency_ms=None,
        )

        storage.store_interaction(metrics)

        # Verify insertion was attempted
        mock_client.table.return_value.insert.assert_called_once()

        # Get the data that was inserted
        call_args = mock_client.table.return_value.insert.call_args
        inserted_data = call_args[0][0]

        # Verify None values are preserved
        assert inserted_data["user_id"] is None
        assert inserted_data["triggered_by"] is None
        assert inserted_data["input_tokens"] is None
        assert inserted_data["output_tokens"] is None
        assert inserted_data["estimated_cost"] is None

    def test_disabled_storage(self, sample_metrics: InteractionMetrics) -> None:
        """Test that storage can be disabled."""
        storage = DatabaseStorage(supabase_url=None, supabase_key=None)

        # Should not raise exception (storage is disabled)
        storage.store_interaction(sample_metrics)

        assert not storage.enabled

    def test_partial_credentials_disables_storage(self, sample_metrics: InteractionMetrics) -> None:
        """Test that missing either credential disables storage."""
        # Missing URL
        storage1 = DatabaseStorage(supabase_url=None, supabase_key="test-key")
        assert not storage1.enabled
        storage1.store_interaction(sample_metrics)

        # Missing key
        storage2 = DatabaseStorage(supabase_url="https://test.supabase.co", supabase_key=None)
        assert not storage2.enabled
        storage2.store_interaction(sample_metrics)

        # Should not raise exceptions
