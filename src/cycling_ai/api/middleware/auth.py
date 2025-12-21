"""
JWT Authentication middleware for Supabase integration.

Validates Supabase JWT tokens and extracts user information.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# JWT configuration from environment
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")
ALGORITHM = "HS256"

# Paths that don't require authentication
PUBLIC_PATHS = {
    "/",
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
}


@dataclass
class User:
    """Authenticated user information from JWT."""

    id: str
    email: str | None
    role: str
    metadata: dict[str, Any]


class JWTAuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware to validate JWT tokens on all requests.

    Public paths (health, docs) are excluded from authentication.
    """

    async def dispatch(self, request: Request, call_next: Any) -> Any:
        """Process request and validate JWT if required."""
        path = request.url.path

        # Allow public paths without authentication
        if path in PUBLIC_PATHS or path.startswith("/docs") or path.startswith("/redoc"):
            return await call_next(request)

        # Allow OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)

        # In development (no JWT secret), skip auth and use mock user
        if not SUPABASE_JWT_SECRET:
            logger.debug("No SUPABASE_JWT_SECRET configured, using development user")
            request.state.user = User(
                id="development-user",
                email="dev@example.com",
                role="authenticated",
                metadata={},
            )
            return await call_next(request)

        # Check for Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Missing authorization header"},
            )

        # Validate Bearer token format
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid authorization header format"},
            )

        token = parts[1]

        # Validate JWT
        try:
            payload = validate_jwt(token)
            # Store user info in request state for route handlers
            request.state.user = User(
                id=payload.get("sub", ""),
                email=payload.get("email"),
                role=payload.get("role", "authenticated"),
                metadata=payload.get("user_metadata", {}),
            )
        except HTTPException as e:
            return JSONResponse(
                status_code=e.status_code,
                content={"detail": e.detail},
            )

        return await call_next(request)


# Security scheme for OpenAPI docs
security = HTTPBearer(auto_error=False)


def validate_jwt(token: str) -> dict[str, Any]:
    """
    Validate a Supabase JWT token.

    Args:
        token: JWT token string

    Returns:
        Decoded token payload

    Raises:
        HTTPException: If token is invalid or expired
    """
    if not SUPABASE_JWT_SECRET:
        logger.warning("SUPABASE_JWT_SECRET not configured, skipping validation")
        # In development/testing, return mock payload
        return {
            "sub": "development-user",
            "email": "dev@example.com",
            "role": "authenticated",
        }

    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=[ALGORITHM],
            audience="authenticated",
        )
        return payload
    except JWTError as e:
        logger.warning(f"JWT validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from e


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),  # noqa: B008
) -> User:
    """
    FastAPI dependency to get the current authenticated user.

    Use this in route handlers that require authentication:
        @app.get("/protected")
        async def protected(user: User = Depends(get_current_user)):
            return {"user_id": user.id}

    Args:
        request: FastAPI request
        credentials: Bearer token from header

    Returns:
        Authenticated User object

    Raises:
        HTTPException: If not authenticated
    """
    # First check request state (set by middleware)
    if hasattr(request.state, "user"):
        user: User = request.state.user
        return user

    # In development (no JWT secret), return mock user
    if not SUPABASE_JWT_SECRET:
        logger.debug("No SUPABASE_JWT_SECRET configured, using development user")
        return User(
            id="development-user",
            email="dev@example.com",
            role="authenticated",
            metadata={},
        )

    # Fall back to manual validation if middleware didn't run
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    payload = validate_jwt(credentials.credentials)
    return User(
        id=payload.get("sub", ""),
        email=payload.get("email"),
        role=payload.get("role", "authenticated"),
        metadata=payload.get("user_metadata", {}),
    )


async def get_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),  # noqa: B008
) -> User | None:
    """
    FastAPI dependency to get the current user if authenticated.

    Use this in route handlers that work with or without authentication:
        @app.get("/public-or-private")
        async def endpoint(user: User | None = Depends(get_optional_user)):
            if user:
                return {"message": f"Hello {user.email}"}
            return {"message": "Hello guest"}

    Args:
        request: FastAPI request
        credentials: Bearer token from header (optional)

    Returns:
        User object if authenticated, None otherwise
    """
    # Check request state first
    if hasattr(request.state, "user"):
        user: User = request.state.user
        return user

    # No credentials = no user
    if not credentials:
        return None

    try:
        payload = validate_jwt(credentials.credentials)
        return User(
            id=payload.get("sub", ""),
            email=payload.get("email"),
            role=payload.get("role", "authenticated"),
            metadata=payload.get("user_metadata", {}),
        )
    except HTTPException:
        return None
