"""
FastAPI application entry point.

Creates and configures the FastAPI application with:
- CORS middleware for Next.js integration
- Health check endpoint
- API routers for plan, chat, and analysis
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .routers import analysis, plan, workouts


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


# Health check endpoint (both at root and /api for CloudFront routing)
@app.get("/health", tags=["health"])
@app.get("/api/health", tags=["health"], include_in_schema=False)
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
@app.get("/api", tags=["root"], include_in_schema=False)
@app.get("/api/", tags=["root"], include_in_schema=False)
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


# Include routers
app.include_router(plan.router, prefix="/api/v1/plan", tags=["plan"])
app.include_router(analysis.router, prefix="/api/v1/analysis", tags=["analysis"])
app.include_router(workouts.router, prefix="/api/v1/workouts", tags=["workouts"])

# Future routers:
# app.include_router(chat_router, prefix="/api/v1/chat", tags=["chat"])
