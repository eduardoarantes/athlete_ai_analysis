"""Tests for common Pydantic models."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from cycling_ai.api.models.common import ErrorResponse, JobStatus


def test_error_response_valid() -> None:
    """Test ErrorResponse with valid data."""
    error = ErrorResponse(
        error="Test error",
        details="Additional details",
        validation_errors=["Error 1", "Error 2"],
    )

    assert error.error == "Test error"
    assert error.details == "Additional details"
    assert len(error.validation_errors) == 2  # type: ignore


def test_job_status_valid() -> None:
    """Test JobStatus with valid data."""
    job = JobStatus(
        job_id="plan_123",
        status="completed",
        progress={"phase": "Done", "percentage": 100},
        result={"plan": "data"},
    )

    assert job.job_id == "plan_123"
    assert job.status == "completed"
    assert job.progress["percentage"] == 100  # type: ignore


def test_job_status_invalid_status() -> None:
    """Test JobStatus rejects invalid status."""
    with pytest.raises(ValidationError) as exc_info:
        JobStatus(job_id="plan_123", status="invalid_status")

    errors = exc_info.value.errors()
    assert any("status" in str(e) for e in errors)
