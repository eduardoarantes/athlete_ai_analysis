"""
Middleware modules for FastAPI application.
"""

from cycling_ai.api.middleware.auth import (
    JWTAuthMiddleware,
    get_current_user,
    get_optional_user,
)
from cycling_ai.api.middleware.rate_limit import (
    RATE_LIMITS,
    RateLimitConfig,
    check_rate_limit_dependency,
    rate_limit,
)

__all__ = [
    "JWTAuthMiddleware",
    "get_current_user",
    "get_optional_user",
    "RATE_LIMITS",
    "RateLimitConfig",
    "check_rate_limit_dependency",
    "rate_limit",
]
