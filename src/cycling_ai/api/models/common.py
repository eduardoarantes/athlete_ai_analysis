"""
Common Pydantic models for API requests and responses.

Provides shared models used across multiple endpoints.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    """
    Standard error response model.

    Used for all API error responses to ensure consistency.
    """

    error: str = Field(..., description="Error message")
    details: str | None = Field(None, description="Additional error details")
    validation_errors: list[str] | None = Field(None, description="List of validation errors")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "error": "Invalid request",
                    "details": "Missing required fields",
                    "validation_errors": ["FTP must be positive", "Weight is required"],
                }
            ]
        }
    }


class JobStatus(BaseModel):
    """
    Job status model for async operations.

    Tracks the state of long-running background jobs.
    """

    job_id: str = Field(..., description="Unique job identifier")
    status: str = Field(
        ...,
        description="Job status",
        pattern="^(queued|running|completed|failed)$",
    )
    progress: dict[str, Any] | None = Field(None, description="Progress information")
    result: dict[str, Any] | None = Field(None, description="Job result (when completed)")
    error: str | None = Field(None, description="Error message (when failed)")
    created_at: str | None = Field(None, description="Job creation timestamp")
    updated_at: str | None = Field(None, description="Last update timestamp")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "job_id": "plan_1734376800_a1b2c3d4",
                    "status": "completed",
                    "progress": {"phase": "Finalizing plan", "percentage": 100},
                    "result": {"training_plan": {"total_weeks": 12}},
                }
            ]
        }
    }


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = Field(..., description="Health status")
    version: str = Field(..., description="API version")
