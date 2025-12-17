# CARD 2: Pydantic Models (Request/Response)

**Status:** Pending
**Estimated Time:** 2 hours
**Dependencies:** CARD_1
**Assignee:** Implementation Agent

---

## Objective

Create Pydantic models for type-safe request/response validation across all API endpoints.

---

## Tasks

### 1. Create `src/cycling_ai/api/models/common.py`

Common models shared across all endpoints:

```python
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
    validation_errors: list[str] | None = Field(
        None, description="List of validation errors"
    )

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
```

### 2. Create `src/cycling_ai/api/models/plan.py`

Training plan models:

```python
"""
Pydantic models for training plan generation.

Defines request/response models for plan-related endpoints.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class AthleteProfileData(BaseModel):
    """Athlete profile embedded in requests."""

    ftp: float = Field(..., gt=0, description="Functional Threshold Power in watts")
    weight_kg: float = Field(..., gt=0, description="Athlete weight in kilograms")
    max_hr: int | None = Field(None, gt=0, le=220, description="Maximum heart rate")
    age: int = Field(..., gt=0, le=120, description="Athlete age")
    goals: list[str] | None = Field(None, description="Training goals")
    training_availability: dict[str, Any] | None = Field(
        None, description="Available training days and hours"
    )
    experience_level: str | None = Field(None, description="Experience level")
    weekly_hours_available: float | None = Field(
        None, gt=0, description="Available training hours per week"
    )
    training_days_per_week: int | None = Field(
        None, ge=3, le=7, description="Number of training days per week"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "ftp": 265,
                    "weight_kg": 70,
                    "max_hr": 186,
                    "age": 35,
                    "goals": ["Improve FTP", "Complete century ride"],
                    "training_availability": {
                        "hours_per_week": 7,
                        "week_days": "Monday, Wednesday, Friday, Saturday, Sunday",
                    },
                    "experience_level": "intermediate",
                    "weekly_hours_available": 7,
                    "training_days_per_week": 5,
                }
            ]
        }
    }


class TrainingPlanRequest(BaseModel):
    """Request model for training plan generation."""

    athlete_profile: AthleteProfileData = Field(
        ..., description="Athlete profile information"
    )
    weeks: int = Field(..., ge=4, le=24, description="Plan duration in weeks")
    target_ftp: float | None = Field(None, gt=0, description="Target FTP in watts")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "athlete_profile": {
                        "ftp": 265,
                        "weight_kg": 70,
                        "max_hr": 186,
                        "age": 35,
                        "goals": ["Improve FTP"],
                        "training_availability": {
                            "hours_per_week": 7,
                            "week_days": "Monday, Wednesday, Friday, Saturday, Sunday",
                        },
                    },
                    "weeks": 12,
                    "target_ftp": 278,
                }
            ]
        }
    }


class JobStatusResponse(BaseModel):
    """Response model for job creation."""

    job_id: str = Field(..., description="Unique job identifier")
    status: str = Field(..., description="Initial job status (queued)")
    message: str = Field(..., description="Status message")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "job_id": "plan_1734376800_a1b2c3d4",
                    "status": "queued",
                    "message": "Training plan generation started",
                }
            ]
        }
    }


class TrainingPlanResponse(BaseModel):
    """Response model for completed training plan."""

    training_plan: dict[str, Any] = Field(..., description="Generated training plan")
    metadata: dict[str, Any] | None = Field(None, description="Additional metadata")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "training_plan": {
                        "total_weeks": 12,
                        "current_ftp": 265,
                        "target_ftp": 278,
                        "weekly_plan": [],
                    },
                    "metadata": {
                        "generated_at": "2024-12-16T10:00:00Z",
                        "model": "anthropic/claude-3-5-sonnet",
                    },
                }
            ]
        }
    }
```

### 3. Create `tests/api/models/test_common.py`

```python
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
    assert len(error.validation_errors) == 2


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
    assert job.progress["percentage"] == 100


def test_job_status_invalid_status() -> None:
    """Test JobStatus rejects invalid status."""
    with pytest.raises(ValidationError) as exc_info:
        JobStatus(job_id="plan_123", status="invalid_status")

    errors = exc_info.value.errors()
    assert any("status" in str(e) for e in errors)
```

### 4. Create `tests/api/models/test_plan.py`

```python
"""Tests for plan Pydantic models."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from cycling_ai.api.models.plan import AthleteProfileData, TrainingPlanRequest


def test_athlete_profile_valid() -> None:
    """Test AthleteProfileData with valid data."""
    profile = AthleteProfileData(
        ftp=265,
        weight_kg=70,
        max_hr=186,
        age=35,
        goals=["Improve FTP"],
    )

    assert profile.ftp == 265
    assert profile.weight_kg == 70
    assert profile.age == 35


def test_athlete_profile_invalid_ftp() -> None:
    """Test AthleteProfileData rejects invalid FTP."""
    with pytest.raises(ValidationError) as exc_info:
        AthleteProfileData(
            ftp=-100,  # Invalid: must be positive
            weight_kg=70,
            age=35,
        )

    errors = exc_info.value.errors()
    assert any("ftp" in str(e) for e in errors)


def test_training_plan_request_valid() -> None:
    """Test TrainingPlanRequest with valid data."""
    request = TrainingPlanRequest(
        athlete_profile=AthleteProfileData(ftp=265, weight_kg=70, age=35),
        weeks=12,
        target_ftp=278,
    )

    assert request.weeks == 12
    assert request.target_ftp == 278


def test_training_plan_request_invalid_weeks() -> None:
    """Test TrainingPlanRequest rejects invalid weeks."""
    with pytest.raises(ValidationError) as exc_info:
        TrainingPlanRequest(
            athlete_profile=AthleteProfileData(ftp=265, weight_kg=70, age=35),
            weeks=100,  # Invalid: max is 24
        )

    errors = exc_info.value.errors()
    assert any("weeks" in str(e) for e in errors)
```

---

## Verification Steps

### 1. Run Tests

```bash
pytest tests/api/models/ -v
```

Expected:
```
tests/api/models/test_common.py::test_error_response_valid PASSED
tests/api/models/test_common.py::test_job_status_valid PASSED
tests/api/models/test_common.py::test_job_status_invalid_status PASSED
tests/api/models/test_plan.py::test_athlete_profile_valid PASSED
tests/api/models/test_plan.py::test_athlete_profile_invalid_ftp PASSED
tests/api/models/test_plan.py::test_training_plan_request_valid PASSED
tests/api/models/test_plan.py::test_training_plan_request_invalid_weeks PASSED
```

### 2. Type Check

```bash
mypy src/cycling_ai/api/models --strict
```

Expected: No errors

### 3. Test Serialization

```python
# In Python REPL
from cycling_ai.api.models.plan import TrainingPlanRequest, AthleteProfileData

request = TrainingPlanRequest(
    athlete_profile=AthleteProfileData(ftp=265, weight_kg=70, age=35),
    weeks=12,
    target_ftp=278
)

# Serialize to JSON
json_str = request.model_dump_json(indent=2)
print(json_str)

# Deserialize from JSON
request2 = TrainingPlanRequest.model_validate_json(json_str)
assert request2.weeks == 12
```

---

## Files Created

- `src/cycling_ai/api/models/common.py`
- `src/cycling_ai/api/models/plan.py`
- `tests/api/models/__init__.py` (empty)
- `tests/api/models/test_common.py`
- `tests/api/models/test_plan.py`

---

## Acceptance Criteria

- [x] All models have type hints
- [x] All models have docstrings
- [x] All models have validation rules
- [x] All models have examples in `model_config`
- [x] Tests cover valid and invalid cases
- [x] Type checking passes
- [x] Serialization/deserialization works

---

## Next Card

**CARD_3.md** - Create plan service layer
