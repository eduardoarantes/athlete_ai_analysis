"""
Tests for Plan Router.

Tests API endpoints for training plan generation.
"""
from __future__ import annotations

import json
import tempfile
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

from cycling_ai.api.main import app

# Enable async testing
pytestmark = pytest.mark.anyio

# Test auth header (uses mock user when SUPABASE_JWT_SECRET not set)
TEST_AUTH_HEADERS = {"Authorization": "Bearer test-token"}


@pytest.fixture
def client() -> TestClient:
    """Create test client."""
    return TestClient(app)


@pytest.fixture
def athlete_profile_data() -> dict[str, Any]:
    """Create test athlete profile data for API requests."""
    return {
        "ftp": 265,
        "weight_kg": 70,
        "max_hr": 186,
        "age": 35,
        "goals": ["Improve FTP"],
        "training_availability": {
            "hours_per_week": 7,
            "week_days": "Monday, Wednesday, Friday, Saturday, Sunday",
        },
    }


@pytest.fixture
def athlete_profile_file_data() -> dict[str, Any]:
    """Create test athlete profile data for JSON file format."""
    return {
        "name": "Test Athlete",
        "age": 35,
        "weight": "70kg",
        "FTP": "265w",
        "critical_HR": 186,
        "gender": "male",
        "training_availability": {
            "hours_per_week": 7,
            "week_days": "Monday, Wednesday, Friday, Saturday, Sunday",
        },
        "goals": "Improve FTP",
        "current_training_status": "intermediate",
        "raw_training_data_path": "/tmp/test_data",
    }


@pytest.fixture
def athlete_profile_file(athlete_profile_file_data: dict[str, Any]) -> Path:
    """Create temporary athlete profile JSON file."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(athlete_profile_file_data, f)
        return Path(f.name)


def test_health_check(client: TestClient) -> None:
    """Test health check endpoint works."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


async def test_generate_plan_endpoint(
    athlete_profile_data: dict[str, Any],
) -> None:
    """Test POST /api/v1/plan/generate endpoint."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Use skeleton mode (use_ai=false) to avoid requiring API keys in CI
        response = await ac.post(
            "/api/v1/plan/generate?use_ai=false",
            json={
                "athlete_profile": athlete_profile_data,
                "weeks": 12,
                "target_ftp": 278,
            },
            headers=TEST_AUTH_HEADERS,
        )

    assert response.status_code == 202
    data = response.json()
    assert "job_id" in data
    assert data["status"] == "queued"
    assert "started" in data["message"]


async def test_generate_plan_invalid_request() -> None:
    """Test POST /api/v1/plan/generate with invalid data."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/plan/generate",
            json={
                "athlete_profile": {
                    "ftp": -100,  # Invalid: negative FTP
                    "weight_kg": 70,
                    "age": 35,
                },
                "weeks": 12,
            },
            headers=TEST_AUTH_HEADERS,
        )

    assert response.status_code == 422  # Validation error


async def test_generate_plan_invalid_weeks() -> None:
    """Test POST /api/v1/plan/generate with invalid weeks."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/plan/generate",
            json={
                "athlete_profile": {
                    "ftp": 265,
                    "weight_kg": 70,
                    "age": 35,
                },
                "weeks": 100,  # Invalid: exceeds max 24 weeks
            },
            headers=TEST_AUTH_HEADERS,
        )

    assert response.status_code == 422  # Validation error


async def test_get_job_status_not_found() -> None:
    """Test GET /api/v1/plan/status/{job_id} for non-existent job."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get(
            "/api/v1/plan/status/nonexistent_job_id",
            headers=TEST_AUTH_HEADERS,
        )

    assert response.status_code == 404
    data = response.json()
    assert "error" in data["detail"]


async def test_get_job_status_queued(
    athlete_profile_data: dict[str, Any],
) -> None:
    """Test GET /api/v1/plan/status/{job_id} for queued job."""
    # Create a job first
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Use skeleton mode to avoid requiring API keys in CI
        create_response = await ac.post(
            "/api/v1/plan/generate?use_ai=false",
            json={
                "athlete_profile": athlete_profile_data,
                "weeks": 12,
                "target_ftp": 278,
            },
            headers=TEST_AUTH_HEADERS,
        )

        job_id = create_response.json()["job_id"]

        # Get job status immediately (should be queued or running)
        status_response = await ac.get(
            f"/api/v1/plan/status/{job_id}",
            headers=TEST_AUTH_HEADERS,
        )

    assert status_response.status_code == 200
    data = status_response.json()
    assert data["job_id"] == job_id
    assert data["status"] in ["queued", "running", "completed"]


async def test_full_plan_generation_flow(
    athlete_profile_data: dict[str, Any],
) -> None:
    """Test complete flow: create job, wait for completion, get result."""
    import asyncio

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Create job with skeleton mode to avoid requiring API keys in CI
        create_response = await ac.post(
            "/api/v1/plan/generate?use_ai=false",
            json={
                "athlete_profile": athlete_profile_data,
                "weeks": 8,  # Shorter for faster test
                "target_ftp": 278,
            },
            headers=TEST_AUTH_HEADERS,
        )

        assert create_response.status_code == 202
        job_id = create_response.json()["job_id"]

        # Poll for completion (max 30 seconds)
        max_attempts = 30
        for attempt in range(max_attempts):
            status_response = await ac.get(
                f"/api/v1/plan/status/{job_id}",
                headers=TEST_AUTH_HEADERS,
            )
            data = status_response.json()

            if data["status"] == "completed":
                # Verify result structure
                assert "result" in data
                result = data["result"]
                assert "training_plan" in result
                plan = result["training_plan"]
                assert "plan_metadata" in plan
                assert plan["plan_metadata"]["total_weeks"] == 8
                return

            if data["status"] == "failed":
                pytest.fail(f"Job failed: {data.get('error')}")

            # Wait before next poll
            await asyncio.sleep(1)

        pytest.fail(f"Job did not complete within {max_attempts} seconds")
