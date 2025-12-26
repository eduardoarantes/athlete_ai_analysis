# syntax=docker/dockerfile:1

# Python Test Environment Dockerfile
# Uses uv for fast dependency installation
# Build and cache this image for CI to speed up tests
#
# Usage:
#   docker build -f docker/python-test.Dockerfile -t cycling-ai-test .
#   docker run --rm cycling-ai-test pytest tests/ -v

FROM python:3.11-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv (fast Python package manager)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# ---- Dependencies Layer ----
# This layer is cached and only rebuilt when dependency files change
FROM base AS deps

# Copy only dependency files (for better layer caching)
COPY pyproject.toml uv.lock ./

# Sync dependencies WITHOUT installing the local project
# This allows caching even when source code changes
RUN uv sync --frozen --all-extras --dev --no-install-project

# ---- Test Runner ----
FROM deps AS test-runner

# Copy source code and required files
COPY src/ ./src/
COPY tests/ ./tests/
COPY README.md ./

# Copy data, prompts, and scripts directories needed for tests
COPY data/ ./data/
COPY prompts/ ./prompts/
COPY scripts/ ./scripts/

# Now install the local project (uses cached dependencies)
RUN uv sync --frozen --all-extras --dev

# The virtual environment is already in .venv
# Set PATH to use the venv
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app/src"

# Default command runs tests
CMD ["pytest", "tests/", "-v", "--tb=short"]
