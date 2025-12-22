# syntax=docker/dockerfile:1

# Web App Test Environment Dockerfile
# Uses pnpm for fast dependency installation
# Build and cache this image for CI to speed up tests
#
# Usage:
#   docker build -f docker/web-test.Dockerfile -t cycling-ai-web-test .
#   docker run --rm cycling-ai-web-test pnpm type-check

FROM node:20-slim AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# ---- Dependencies Layer ----
# This layer is cached and only rebuilt when dependency files change
FROM base AS deps

# Copy only dependency files (for better layer caching)
COPY web/package.json web/pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# ---- Test Runner ----
FROM deps AS test-runner

# Copy source code
COPY web/ ./

# Build environment
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Default command runs type check
CMD ["pnpm", "type-check"]
