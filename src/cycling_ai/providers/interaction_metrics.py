"""
Data model for LLM interaction metrics.

This module defines the InteractionMetrics dataclass that captures comprehensive
metadata about LLM API interactions for analytics and cost tracking.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass(slots=True)
class InteractionMetrics:
    """
    Comprehensive metrics for an LLM interaction.

    This class captures all metadata needed for analytics, cost tracking,
    and performance monitoring. It excludes prompts and responses, which are
    stored separately in JSONL files.
    """

    # Core identifiers
    session_id: str
    request_id: str
    user_id: str | None

    # Provider information
    provider_name: str
    model: str
    prompt_version: str

    # Trigger context
    trigger_type: str  # "api_request", "background_task", "tool_call", "system"
    triggered_by: str | None

    # Token metrics
    input_tokens: int | None
    output_tokens: int | None
    estimated_cost: float | None

    # Performance metrics
    duration_ms: float | None
    api_latency_ms: float | None

    # Error tracking
    error_code: str | None = None
    retry_count: int = 0

    # Timestamp
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict[str, Any]:
        """
        Convert metrics to dictionary for database insertion.

        Returns:
            Dictionary with all fields serialized for database storage.
        """
        return {
            "session_id": self.session_id,
            "request_id": self.request_id,
            "user_id": self.user_id,
            "provider_name": self.provider_name,
            "model": self.model,
            "prompt_version": self.prompt_version,
            "trigger_type": self.trigger_type,
            "triggered_by": self.triggered_by,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "estimated_cost": self.estimated_cost,
            "duration_ms": self.duration_ms,
            "api_latency_ms": self.api_latency_ms,
            "error_code": self.error_code,
            "retry_count": self.retry_count,
            "timestamp": self.timestamp.isoformat(),
        }
