# syntax=docker/dockerfile:1

# Web App E2E Test Dockerfile
# Uses Playwright image with pre-installed browsers
# Build and cache this image for CI E2E tests
#
# Usage:
#   docker build -f docker/web-e2e.Dockerfile -t cycling-ai-web-e2e .
#   docker run --rm cycling-ai-web-e2e pnpm test

FROM mcr.microsoft.com/playwright:v1.57.0-jammy AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# ---- Dependencies Layer ----
# This layer is cached and only rebuilt when dependency files change
FROM base AS deps

# Copy only dependency files (for better layer caching)
COPY web/package.json web/pnpm-lock.yaml ./

# Install dependencies (including Playwright)
RUN pnpm install --frozen-lockfile

# ---- Test Runner ----
FROM deps AS test-runner

# Copy source code
COPY web/ ./

# Build environment
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=test
ENV CI=true

# Default command runs E2E tests
CMD ["pnpm", "test"]
