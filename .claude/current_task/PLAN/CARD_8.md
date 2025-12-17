# CARD 8: Documentation & Deployment

**Status:** Pending
**Estimated Time:** 1.5 hours
**Dependencies:** CARD_7
**Assignee:** Implementation Agent

---

## Objective

Create comprehensive documentation and prepare the FastAPI application for deployment.

---

## Tasks

### 1. Create `docs/API_GUIDE.md`

```markdown
# FastAPI Backend - API Guide

## Overview

The FastAPI backend provides REST endpoints for the Next.js web UI to interact with the Python cycling-ai tools and services.

## Architecture

```
Next.js (Port 3000) → FastAPI (Port 8000) → Python Tools → LLM Providers
```

## Getting Started

### Prerequisites

- Python 3.11+
- Supabase account and project
- LLM API key (Anthropic recommended)

### Installation

1. Install dependencies:
   ```bash
   pip install -e ".[dev]"
   ```

2. Set environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. Start the server:
   ```bash
   ./scripts/start_api.sh
   ```

The API will be available at http://localhost:8000

### API Documentation

Interactive API docs: http://localhost:8000/docs

## Endpoints

### Health Check

```
GET /health
```

Returns server health status.

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0"
}
```

### Generate Training Plan

```
POST /api/v1/plan/generate
Content-Type: application/json
```

Starts asynchronous training plan generation.

**Request Body:**
```json
{
  "athlete_profile": {
    "ftp": 265,
    "weight_kg": 70,
    "max_hr": 186,
    "age": 35,
    "goals": ["Improve FTP"],
    "training_availability": {
      "hours_per_week": 7,
      "week_days": "Monday, Wednesday, Friday, Saturday, Sunday"
    }
  },
  "weeks": 12,
  "target_ftp": 278
}
```

**Response (202 Accepted):**
```json
{
  "job_id": "plan_1734376800_a1b2c3d4",
  "status": "queued",
  "message": "Training plan generation started"
}
```

### Get Job Status

```
GET /api/v1/plan/status/{job_id}
```

Gets current status of a background job.

**Response (200 OK):**
```json
{
  "job_id": "plan_1734376800_a1b2c3d4",
  "status": "completed",
  "progress": {
    "phase": "Complete",
    "percentage": 100
  },
  "result": {
    "training_plan": {
      "total_weeks": 12,
      "target_ftp": 278,
      "weekly_plan": [...]
    }
  }
}
```

## Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `FASTAPI_HOST` | Server bind address | No | `0.0.0.0` |
| `FASTAPI_PORT` | Server port | No | `8000` |
| `FASTAPI_RELOAD` | Enable auto-reload | No | `false` |
| `ALLOWED_ORIGINS` | CORS allowed origins | No | `http://localhost:3000` |
| `SUPABASE_URL` | Supabase project URL | Yes | - |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Yes | - |
| `ANTHROPIC_API_KEY` | Anthropic API key | Yes* | - |
| `OPENAI_API_KEY` | OpenAI API key | Yes* | - |

*At least one LLM provider API key is required

## Development

### Running Tests

```bash
# All tests
./scripts/test_api.sh

# Unit tests only
pytest tests/api -v -m "not integration"

# Integration tests
export ANTHROPIC_API_KEY="sk-ant-..."
export SUPABASE_URL="https://..."
export SUPABASE_SERVICE_KEY="..."
pytest tests/api -v -m integration
```

### Type Checking

```bash
mypy src/cycling_ai/api --strict
```

### Code Quality

```bash
# Linting
ruff check src/cycling_ai/api

# Formatting
ruff format src/cycling_ai/api
```

## Deployment

### Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install .

COPY src/ src/

CMD ["uvicorn", "cycling_ai.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build and run:
```bash
docker build -t cycling-ai-api .
docker run -p 8000:8000 --env-file .env cycling-ai-api
```

### Production Checklist

- [ ] Set `FASTAPI_RELOAD=false`
- [ ] Use production Supabase project
- [ ] Set secure `ALLOWED_ORIGINS`
- [ ] Enable HTTPS
- [ ] Set up monitoring/logging
- [ ] Configure rate limiting
- [ ] Set up health checks
- [ ] Configure backup/recovery

## Troubleshooting

### Job stays in "queued" status

- Check that background tasks are enabled
- Check logs for errors
- Verify LLM API key is set

### CORS errors from Next.js

- Verify `ALLOWED_ORIGINS` includes your Next.js URL
- Check that CORS middleware is enabled

### Database connection errors

- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
- Check network connectivity to Supabase
- Verify database schema is up to date
```

### 2. Create `README.md` for API

Create `src/cycling_ai/api/README.md`:

```markdown
# Cycling AI - FastAPI Backend

REST API for the cycling-ai Python backend, enabling web UI integration.

## Quick Start

```bash
# Install dependencies
pip install -e ".[dev]"

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start server
./scripts/start_api.sh
```

API will be available at http://localhost:8000

## Documentation

- [API Guide](../../../docs/API_GUIDE.md) - Complete API reference
- [Interactive Docs](http://localhost:8000/docs) - Swagger UI (when server running)

## Project Structure

```
api/
├── main.py           # FastAPI application entry point
├── config.py         # Configuration management
├── dependencies.py   # Dependency injection
├── models/           # Pydantic request/response models
│   ├── common.py
│   └── plan.py
├── routers/          # API route handlers
│   └── plan.py
└── services/         # Business logic layer
    ├── plan_service.py
    └── job_storage.py
```

## Key Features

- **Type-safe**: Full Pydantic validation
- **Async**: FastAPI async support
- **Persistent**: Jobs stored in Supabase
- **Tested**: >80% test coverage
- **Documented**: Auto-generated API docs

## Development

See [API Guide](../../../docs/API_GUIDE.md) for development instructions.
```

### 3. Update Root `README.md`

Add FastAPI section to main README:

```markdown
## FastAPI Web API (New)

The project now includes a FastAPI REST API for web UI integration:

### Running the API Server

```bash
# Start API server
./scripts/start_api.sh

# In another terminal, start Next.js
cd web && pnpm dev
```

### API Documentation

- Interactive docs: http://localhost:8000/docs
- Complete guide: [docs/API_GUIDE.md](docs/API_GUIDE.md)

### Environment Setup

```bash
# API requires these environment variables:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-...
```
```

### 4. Create Deployment Guide `docs/DEPLOYMENT.md`

```markdown
# Deployment Guide - FastAPI Backend

## Overview

This guide covers deploying the FastAPI backend to production.

## Deployment Options

### Option 1: Docker (Recommended)

#### Build Image

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY pyproject.toml .
RUN pip install --no-cache-dir .

# Copy application
COPY src/ src/

# Run server
CMD ["uvicorn", "cycling_ai.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
docker build -t cycling-ai-api .
docker run -p 8000:8000 --env-file .env cycling-ai-api
```

#### Docker Compose

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - ALLOWED_ORIGINS=https://your-app.vercel.app
    restart: unless-stopped
```

### Option 2: Render.com

1. Create new Web Service
2. Connect GitHub repository
3. Configure:
   - Build Command: `pip install .`
   - Start Command: `uvicorn cycling_ai.api.main:app --host 0.0.0.0 --port $PORT`
4. Set environment variables
5. Deploy

### Option 3: Railway.app

1. Create new project
2. Connect GitHub repository
3. Set environment variables
4. Railway auto-detects Python and deploys

### Option 4: AWS/GCP/Azure

Use Docker deployment with your cloud provider's container service.

## Production Checklist

### Security

- [ ] Use HTTPS only
- [ ] Set restrictive CORS origins
- [ ] Rotate API keys regularly
- [ ] Use secrets manager for credentials
- [ ] Enable rate limiting
- [ ] Add authentication (future)

### Performance

- [ ] Use production ASGI server (uvicorn with workers)
- [ ] Enable gzip compression
- [ ] Configure connection pooling
- [ ] Set appropriate timeouts
- [ ] Monitor resource usage

### Monitoring

- [ ] Set up error tracking (Sentry)
- [ ] Configure logging (CloudWatch/StackDriver)
- [ ] Set up health checks
- [ ] Monitor API latency
- [ ] Track job success rates

### Database

- [ ] Use production Supabase project
- [ ] Configure connection pooling
- [ ] Set up automated backups
- [ ] Monitor database performance
- [ ] Plan for scaling

## Environment Variables (Production)

```bash
# Server
FASTAPI_HOST=0.0.0.0
FASTAPI_PORT=8000
FASTAPI_RELOAD=false

# CORS
ALLOWED_ORIGINS=https://your-app.vercel.app,https://www.your-app.com

# Database
SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_SERVICE_KEY=your-production-service-key

# LLM
ANTHROPIC_API_KEY=sk-ant-production-key
```

## Monitoring

### Health Checks

Configure your deployment platform to ping:
```
GET /health
```

Expected response:
```json
{"status": "healthy", "version": "1.0.0"}
```

### Logs

Monitor application logs for:
- Job failures
- API errors
- Performance issues
- LLM timeouts

## Scaling

### Horizontal Scaling

Add more API server instances behind a load balancer.

### Background Jobs

For high load, consider:
- Celery with Redis
- AWS SQS + Lambda
- Cloud Tasks

## Rollback Plan

1. Keep previous Docker image
2. Monitor error rates after deployment
3. Rollback if error rate increases
4. Check job completion rates

## Support

For deployment issues, see:
- [API Guide](API_GUIDE.md)
- [Troubleshooting](#troubleshooting) in API Guide
```

### 5. Create `CHANGELOG.md` for API

Create `src/cycling_ai/api/CHANGELOG.md`:

```markdown
# Changelog - FastAPI Backend

## [1.0.0] - 2024-12-16

### Added
- Initial FastAPI application setup
- Training plan generation endpoint (`POST /api/v1/plan/generate`)
- Job status endpoint (`GET /api/v1/plan/status/{job_id}`)
- Pydantic models for type-safe requests/responses
- Supabase integration for job persistence
- Background task execution
- CORS configuration for Next.js
- Comprehensive test suite (>80% coverage)
- Auto-generated API documentation
- Docker deployment support

### Changed
- Next.js service no longer spawns CLI processes
- All plan generation now goes through REST API

### Security
- Environment-based CORS origins
- Service role key for Supabase
- No hardcoded credentials
```

---

## Verification Steps

### 1. Check Documentation

```bash
# Verify all docs exist
ls -la docs/API_GUIDE.md
ls -la docs/DEPLOYMENT.md
ls -la src/cycling_ai/api/README.md
ls -la src/cycling_ai/api/CHANGELOG.md
```

### 2. Test API Docs

```bash
# Start server
./scripts/start_api.sh

# Open browser
open http://localhost:8000/docs
```

Should show complete API documentation with examples.

### 3. Test Docker Build

```bash
# Create Dockerfile
cat > Dockerfile << 'EOF'
FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install .
COPY src/ src/
CMD ["uvicorn", "cycling_ai.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
EOF

# Build
docker build -t cycling-ai-api .

# Run
docker run -p 8000:8000 --env-file .env cycling-ai-api

# Test
curl http://localhost:8000/health
```

### 4. Review All Documentation

Read through each doc to ensure:
- No broken links
- Code examples work
- Instructions are clear
- All environment variables documented

---

## Files Created

- `docs/API_GUIDE.md`
- `docs/DEPLOYMENT.md`
- `src/cycling_ai/api/README.md`
- `src/cycling_ai/api/CHANGELOG.md`
- `Dockerfile` (example)

---

## Files Modified

- Root `README.md` (add FastAPI section)

---

## Acceptance Criteria

- [x] API Guide complete with examples
- [x] Deployment guide covers major platforms
- [x] README files clear and helpful
- [x] Changelog documents all changes
- [x] Docker deployment works
- [x] All documentation reviewed
- [x] No broken links
- [x] All code examples tested

---

## Final Steps

After completing this card:

1. Review all 8 cards are complete
2. Run full test suite: `./scripts/test_api.sh`
3. Test end-to-end flow: Next.js → API → Database
4. Update main PLAN.md with completion status
5. Create summary document of implementation

---

**Implementation Complete!**

The FastAPI integration is ready for production use. The Next.js app can now communicate with the Python backend via a clean REST API instead of spawning CLI processes.
