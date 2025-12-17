"""
Middleware modules for FastAPI application.
"""

from cycling_ai.api.middleware.auth import (
    JWTAuthMiddleware,
    get_current_user,
    get_optional_user,
)

__all__ = [
    "JWTAuthMiddleware",
    "get_current_user",
    "get_optional_user",
]
