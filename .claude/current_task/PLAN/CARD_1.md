# CARD 1: FastAPI Project Setup

**Status:** Pending
**Estimated Time:** 2 hours
**Dependencies:** None
**Assignee:** Implementation Agent

---

## Objective

Set up the basic FastAPI application structure with configuration, dependencies, and the main application entry point.

---

## Tasks

### 1. Create Directory Structure

Create the following directories:

```bash
mkdir -p src/cycling_ai/api/models
mkdir -p src/cycling_ai/api/routers
mkdir -p src/cycling_ai/api/services
```

### 2. Create `src/cycling_ai/api/__init__.py`

```python
"""
FastAPI REST API for cycling-ai backend.

Provides HTTP endpoints for the Next.js web UI to interact with
Python tools and services without spawning CLI processes.
"""

__version__ = "1.0.0"
```

### 3. Create `src/cycling_ai/api/config.py`

```python
"""
FastAPI application configuration.

Manages environment variables and application settings using Pydantic.
"""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class APISettings(BaseSettings):
    """
    Application settings loaded from environment variables.

    All settings can be overridden with environment variables prefixed with FASTAPI_.
    Example: FASTAPI_PORT=8080
    """

    # Server configuration
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = False  # Enable auto-reload in development

    # CORS configuration
    allowed_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    # Job storage
    job_storage_path: str = "/tmp/cycling-ai-jobs"

    # API metadata
    title: str = "Cycling AI API"
    description: str = "REST API for AI-powered cycling performance analysis"
    version: str = "1.0.0"

    # Model configuration
    model_config = SettingsConfigDict(
        env_prefix="FASTAPI_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


# Global settings instance
settings = APISettings()
```

### 4. Create `src/cycling_ai/api/dependencies.py`

```python
"""
FastAPI dependency injection functions.

Provides reusable dependencies for routes (auth, config, etc.).
"""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from .config import APISettings, settings


def get_settings() -> APISettings:
    """
    Get application settings.

    Returns:
        Application settings instance
    """
    return settings


# Type alias for settings dependency
SettingsDep = Annotated[APISettings, Depends(get_settings)]
```

### 5. Create `src/cycling_ai/api/main.py`

```python
"""
FastAPI application entry point.

Creates and configures the FastAPI application with:
- CORS middleware for Next.js integration
- Health check endpoint
- API routers for plan, chat, and analysis
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan manager.

    Handles startup and shutdown events.
    """
    # Startup
    print(f"Starting {settings.title} v{settings.version}")
    print(f"Server: {settings.host}:{settings.port}")
    print(f"Allowed origins: {settings.allowed_origins}")

    yield

    # Shutdown
    print("Shutting down application")


# Create FastAPI application
app = FastAPI(
    title=settings.title,
    description=settings.description,
    version=settings.version,
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoint
@app.get("/health", tags=["health"])
async def health_check() -> JSONResponse:
    """
    Health check endpoint.

    Returns:
        JSON response with health status
    """
    return JSONResponse(
        content={
            "status": "healthy",
            "version": settings.version,
        }
    )


# Root endpoint
@app.get("/", tags=["root"])
async def root() -> JSONResponse:
    """
    Root endpoint with API information.

    Returns:
        JSON response with API metadata
    """
    return JSONResponse(
        content={
            "name": settings.title,
            "version": settings.version,
            "description": settings.description,
            "docs_url": "/docs",
            "health_url": "/health",
        }
    )


# Routers will be included in subsequent cards:
# app.include_router(plan_router, prefix="/api/v1/plan", tags=["plan"])
# app.include_router(chat_router, prefix="/api/v1/chat", tags=["chat"])
# app.include_router(analysis_router, prefix="/api/v1/analysis", tags=["analysis"])
```

### 6. Update `pyproject.toml`

Add FastAPI dependencies to the `[project.dependencies]` section:

```toml
[project.dependencies]
# Existing dependencies...
"fastapi>=0.109.0",
"uvicorn[standard]>=0.27.0",
"pydantic>=2.5.0",
"pydantic-settings>=2.1.0",
"python-multipart>=0.0.6",  # For file uploads (future use)
```

Add testing dependencies to `[project.optional-dependencies]`:

```toml
[project.optional-dependencies]
dev = [
    # Existing dev dependencies...
    "httpx>=0.26.0",  # For testing FastAPI
    "pytest-asyncio>=0.23.0",  # For async tests
]
```

### 7. Create Test File `tests/api/test_main.py`

```python
"""
Tests for FastAPI application main module.

Tests health check, root endpoint, and CORS configuration.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from cycling_ai.api.main import app


@pytest.fixture
def client() -> TestClient:
    """Create test client."""
    return TestClient(app)


def test_health_check(client: TestClient) -> None:
    """Test health check endpoint."""
    response = client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data


def test_root_endpoint(client: TestClient) -> None:
    """Test root endpoint."""
    response = client.get("/")

    assert response.status_code == 200
    data = response.json()
    assert "name" in data
    assert "version" in data
    assert "docs_url" in data


def test_cors_headers(client: TestClient) -> None:
    """Test CORS headers are present."""
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert "access-control-allow-origin" in response.headers
```

### 8. Create Development Script `scripts/start_api.sh`

```bash
#!/bin/bash
# Start FastAPI development server

set -e

echo "Starting FastAPI development server..."
echo "API will be available at: http://localhost:8000"
echo "API docs: http://localhost:8000/docs"
echo ""

# Navigate to project root
cd "$(dirname "$0")/.."

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Start uvicorn with hot reload
uvicorn cycling_ai.api.main:app \
    --reload \
    --host 0.0.0.0 \
    --port 8000 \
    --log-level info
```

Make it executable:
```bash
chmod +x scripts/start_api.sh
```

---

## Verification Steps

### 1. Install Dependencies

```bash
cd /Users/eduardo/Documents/projects/cycling-ai-analysis
pip install -e ".[dev]"
```

### 2. Start FastAPI Server

```bash
./scripts/start_api.sh
```

Expected output:
```
Starting FastAPI development server...
Starting Cycling AI API v1.0.0
Server: 0.0.0.0:8000
Allowed origins: ['http://localhost:3000', 'http://localhost:3001']
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

### 3. Test Endpoints

```bash
# Health check
curl http://localhost:8000/health
# Expected: {"status":"healthy","version":"1.0.0"}

# Root endpoint
curl http://localhost:8000/
# Expected: {"name":"Cycling AI API","version":"1.0.0",...}

# API documentation (in browser)
open http://localhost:8000/docs
# Should show Swagger UI with endpoints
```

### 4. Run Tests

```bash
pytest tests/api/test_main.py -v
```

Expected:
```
tests/api/test_main.py::test_health_check PASSED
tests/api/test_main.py::test_root_endpoint PASSED
tests/api/test_main.py::test_cors_headers PASSED
```

### 5. Type Check

```bash
mypy src/cycling_ai/api --strict
```

Expected: No errors

---

## Files Created

- `src/cycling_ai/api/__init__.py`
- `src/cycling_ai/api/config.py`
- `src/cycling_ai/api/dependencies.py`
- `src/cycling_ai/api/main.py`
- `src/cycling_ai/api/models/__init__.py` (empty)
- `src/cycling_ai/api/routers/__init__.py` (empty)
- `src/cycling_ai/api/services/__init__.py` (empty)
- `tests/api/__init__.py` (empty)
- `tests/api/test_main.py`
- `scripts/start_api.sh`

---

## Files Modified

- `pyproject.toml` (add FastAPI dependencies)

---

## Acceptance Criteria

- [x] FastAPI server starts without errors
- [x] Health check endpoint returns 200
- [x] Root endpoint returns API metadata
- [x] CORS headers present in responses
- [x] Tests pass
- [x] Type checking passes (`mypy --strict`)
- [x] API documentation accessible at `/docs`

---

## Next Card

**CARD_2.md** - Create Pydantic models for request/response validation
