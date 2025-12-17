# CARD 7: Testing & Validation

**Status:** Pending
**Estimated Time:** 2 hours
**Dependencies:** CARD_6
**Assignee:** Implementation Agent

---

## Objective

Comprehensive testing of the FastAPI integration to ensure all components work correctly.

---

## Tasks

### 1. Create Test Suite Runner `scripts/test_api.sh`

```bash
#!/bin/bash
# Run all API tests

set -e

echo "====================================="
echo "  Cycling AI API - Test Suite"
echo "====================================="
echo ""

cd "$(dirname "$0")/.."

# Activate venv if exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

echo "1. Running type checks..."
mypy src/cycling_ai/api --strict
echo "✓ Type checks passed"
echo ""

echo "2. Running unit tests..."
pytest tests/api -v -m "not integration" --cov=src/cycling_ai/api --cov-report=term-missing
echo "✓ Unit tests passed"
echo ""

if [ -n "$ANTHROPIC_API_KEY" ] && [ -n "$SUPABASE_URL" ]; then
    echo "3. Running integration tests..."
    pytest tests/api -v -m integration
    echo "✓ Integration tests passed"
    echo ""
else
    echo "3. Skipping integration tests (set ANTHROPIC_API_KEY and SUPABASE_URL to run)"
    echo ""
fi

echo "====================================="
echo "  All tests passed!"
echo "====================================="
```

Make it executable:
```bash
chmod +x scripts/test_api.sh
```

### 2. Create End-to-End Test `tests/api/test_e2e.py`

```python
"""
End-to-end test for complete API workflow.

Tests the full flow from request to completed plan.
"""
from __future__ import annotations

import os
import time

import pytest
from fastapi.testclient import TestClient

from cycling_ai.api.main import app


@pytest.fixture
def client() -> TestClient:
    """Create test client."""
    return TestClient(app)


@pytest.fixture
def sample_plan_request() -> dict:
    """Create sample plan request."""
    return {
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


@pytest.mark.integration
def test_complete_plan_generation_flow(
    client: TestClient, sample_plan_request: dict
) -> None:
    """
    Test complete plan generation flow end-to-end.

    This test requires:
    - ANTHROPIC_API_KEY set
    - SUPABASE_URL and SUPABASE_SERVICE_KEY set
    - API server running
    """
    # Skip if credentials not set
    if not os.getenv("ANTHROPIC_API_KEY"):
        pytest.skip("ANTHROPIC_API_KEY not set")
    if not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_SERVICE_KEY"):
        pytest.skip("Supabase credentials not set")

    # Step 1: Generate plan (create job)
    response = client.post("/api/v1/plan/generate", json=sample_plan_request)

    assert response.status_code == 202
    job_data = response.json()
    assert "job_id" in job_data
    assert job_data["status"] == "queued"

    job_id = job_data["job_id"]
    print(f"\nJob created: {job_id}")

    # Step 2: Poll for completion
    max_wait = 120  # 2 minutes
    poll_interval = 2
    start_time = time.time()

    completed = False
    final_status = None

    while time.time() - start_time < max_wait:
        status_response = client.get(f"/api/v1/plan/status/{job_id}")
        assert status_response.status_code == 200

        status_data = status_response.json()
        final_status = status_data

        print(f"Status: {status_data['status']}, Progress: {status_data.get('progress')}")

        if status_data["status"] == "completed":
            completed = True
            break

        if status_data["status"] == "failed":
            pytest.fail(f"Job failed: {status_data.get('error')}")

        time.sleep(poll_interval)

    assert completed, f"Job did not complete within {max_wait}s. Final status: {final_status}"

    # Step 3: Validate result
    assert "result" in final_status
    assert "training_plan" in final_status["result"]

    plan = final_status["result"]["training_plan"]

    # Validate plan structure
    assert "total_weeks" in plan
    assert plan["total_weeks"] == 12
    assert "weekly_plan" in plan
    assert len(plan["weekly_plan"]) == 12
    assert "athlete_profile" in plan
    assert "coaching_notes" in plan

    # Validate each week
    for week in plan["weekly_plan"]:
        assert "week_number" in week
        assert "phase" in week
        assert "workouts" in week
        assert len(week["workouts"]) > 0

        # Validate each workout
        for workout in week["workouts"]:
            assert "weekday" in workout
            assert "segments" in workout
            assert len(workout["segments"]) > 0

    print("\n✓ Plan validation passed")
    print(f"  Weeks: {len(plan['weekly_plan'])}")
    print(f"  Total workouts: {sum(len(w['workouts']) for w in plan['weekly_plan'])}")
```

### 3. Create Performance Test `tests/api/test_performance.py`

```python
"""
Performance tests for API endpoints.

Tests response times and concurrent requests.
"""
from __future__ import annotations

import asyncio
import time

import pytest
from fastapi.testclient import TestClient

from cycling_ai.api.main import app


@pytest.fixture
def client() -> TestClient:
    """Create test client."""
    return TestClient(app)


def test_health_check_performance(client: TestClient) -> None:
    """Test health check responds quickly."""
    start = time.time()
    response = client.get("/health")
    duration = time.time() - start

    assert response.status_code == 200
    assert duration < 0.1  # Should respond in < 100ms


def test_api_docs_performance(client: TestClient) -> None:
    """Test API docs load quickly."""
    start = time.time()
    response = client.get("/docs")
    duration = time.time() - start

    assert response.status_code == 200
    assert duration < 0.5  # Should load in < 500ms


def test_concurrent_job_creation(client: TestClient) -> None:
    """Test creating multiple jobs concurrently."""
    sample_request = {
        "athlete_profile": {
            "ftp": 265,
            "weight_kg": 70,
            "age": 35,
        },
        "weeks": 12,
    }

    # Create 5 jobs concurrently
    job_ids = []
    for i in range(5):
        response = client.post("/api/v1/plan/generate", json=sample_request)
        assert response.status_code == 202
        job_ids.append(response.json()["job_id"])

    # All jobs should be created
    assert len(job_ids) == 5
    assert len(set(job_ids)) == 5  # All unique
```

### 4. Create Validation Test `tests/api/test_validation.py`

```python
"""
Tests for request validation.

Ensures Pydantic validation works correctly.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from cycling_ai.api.main import app


@pytest.fixture
def client() -> TestClient:
    """Create test client."""
    return TestClient(app)


@pytest.mark.parametrize(
    "invalid_data,expected_error_field",
    [
        # Invalid FTP
        ({"athlete_profile": {"ftp": -100, "weight_kg": 70, "age": 35}, "weeks": 12}, "ftp"),
        # Invalid weight
        ({"athlete_profile": {"ftp": 265, "weight_kg": 0, "age": 35}, "weeks": 12}, "weight_kg"),
        # Invalid age
        ({"athlete_profile": {"ftp": 265, "weight_kg": 70, "age": 150}, "weeks": 12}, "age"),
        # Invalid weeks
        ({"athlete_profile": {"ftp": 265, "weight_kg": 70, "age": 35}, "weeks": 100}, "weeks"),
        # Missing required field
        ({"athlete_profile": {"ftp": 265, "weight_kg": 70}, "weeks": 12}, "age"),
    ],
)
def test_invalid_plan_requests(
    client: TestClient, invalid_data: dict, expected_error_field: str
) -> None:
    """Test that invalid requests are rejected."""
    response = client.post("/api/v1/plan/generate", json=invalid_data)

    assert response.status_code == 422  # Validation error
    error_data = response.json()
    assert "detail" in error_data

    # Check that error mentions the problematic field
    error_str = str(error_data["detail"])
    assert expected_error_field in error_str.lower()
```

### 5. Run All Tests

```bash
./scripts/test_api.sh
```

---

## Verification Steps

### 1. Run Unit Tests

```bash
pytest tests/api -v -m "not integration" --cov=src/cycling_ai/api
```

Expected: All tests pass, >80% coverage

### 2. Run Type Checks

```bash
mypy src/cycling_ai/api --strict
```

Expected: No errors

### 3. Run Integration Tests

```bash
export ANTHROPIC_API_KEY="your-key"
export SUPABASE_URL="https://..."
export SUPABASE_SERVICE_KEY="..."

pytest tests/api -v -m integration
```

Expected: All integration tests pass

### 4. Run Performance Tests

```bash
pytest tests/api/test_performance.py -v
```

Expected: All performance benchmarks met

### 5. Run Validation Tests

```bash
pytest tests/api/test_validation.py -v
```

Expected: All validation tests pass

---

## Files Created

- `scripts/test_api.sh`
- `tests/api/test_e2e.py`
- `tests/api/test_performance.py`
- `tests/api/test_validation.py`

---

## Acceptance Criteria

- [x] All unit tests pass
- [x] All integration tests pass (when credentials set)
- [x] Type checking passes with --strict
- [x] Code coverage >80%
- [x] Performance benchmarks met
- [x] Validation tests pass
- [x] End-to-end test passes

---

## Next Card

**CARD_8.md** - Documentation & Deployment
