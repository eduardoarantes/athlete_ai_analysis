"""Rate limiting middleware for protecting LLM endpoints from abuse.

This module provides per-user rate limiting to prevent excessive API calls
that could lead to high LLM costs. Uses in-memory storage with sliding window.

Note: In-memory storage resets on Lambda cold starts, which is acceptable
for rate limiting (fails open, not closed). For stricter limits, use Redis/DynamoDB.
"""

from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from functools import wraps
from typing import Any

from fastapi import HTTPException, Request


@dataclass
class RateLimitConfig:
    """Configuration for rate limiting an endpoint."""

    max_requests: int
    window_seconds: int
    endpoint_name: str

    @property
    def window(self) -> timedelta:
        return timedelta(seconds=self.window_seconds)


@dataclass
class UserRequestLog:
    """Tracks request timestamps for a user."""

    timestamps: list[datetime] = field(default_factory=list)

    def add_request(self, now: datetime) -> None:
        """Add a new request timestamp."""
        self.timestamps.append(now)

    def count_in_window(self, now: datetime, window: timedelta) -> int:
        """Count requests within the time window."""
        cutoff = now - window
        # Clean old timestamps and count valid ones
        self.timestamps = [ts for ts in self.timestamps if ts > cutoff]
        return len(self.timestamps)


class RateLimiter:
    """In-memory rate limiter with per-user tracking.

    Uses a sliding window algorithm to track requests per user per endpoint.
    Thread-safe for Lambda's single-threaded execution model.
    """

    def __init__(self) -> None:
        # Structure: {endpoint_name: {user_id: UserRequestLog}}
        self._logs: dict[str, dict[str, UserRequestLog]] = defaultdict(
            lambda: defaultdict(UserRequestLog)
        )

    def check_rate_limit(
        self,
        user_id: str,
        config: RateLimitConfig,
    ) -> tuple[bool, int, int]:
        """Check if user is within rate limit.

        Args:
            user_id: The user's unique identifier
            config: Rate limit configuration

        Returns:
            Tuple of (is_allowed, current_count, max_requests)
        """
        now = datetime.utcnow()
        user_log = self._logs[config.endpoint_name][user_id]
        current_count = user_log.count_in_window(now, config.window)

        if current_count >= config.max_requests:
            return False, current_count, config.max_requests

        # Add this request
        user_log.add_request(now)
        return True, current_count + 1, config.max_requests

    def get_reset_time(self, user_id: str, config: RateLimitConfig) -> datetime:
        """Get the time when the rate limit resets for a user."""
        user_log = self._logs[config.endpoint_name].get(user_id)
        if not user_log or not user_log.timestamps:
            return datetime.utcnow()

        oldest_in_window = min(user_log.timestamps)
        return oldest_in_window + config.window


# Global rate limiter instance
_rate_limiter = RateLimiter()


# Pre-defined rate limit configurations for LLM endpoints
RATE_LIMITS = {
    "plan_generate": RateLimitConfig(
        max_requests=5,
        window_seconds=86400,  # 24 hours
        endpoint_name="plan_generate",
    ),
    "analysis_performance": RateLimitConfig(
        max_requests=10,
        window_seconds=86400,  # 24 hours
        endpoint_name="analysis_performance",
    ),
    "coach_suggest": RateLimitConfig(
        max_requests=20,
        window_seconds=3600,  # 1 hour
        endpoint_name="coach_suggest",
    ),
}


def rate_limit(config: RateLimitConfig) -> Callable[..., Any]:
    """Decorator to apply rate limiting to an endpoint.

    Usage:
        @router.post("/generate")
        @rate_limit(RATE_LIMITS["plan_generate"])
        async def generate_plan(
            request: Request,
            current_user: User = Depends(get_current_user),
        ):
            ...

    Args:
        config: Rate limit configuration

    Raises:
        HTTPException: 429 Too Many Requests if rate limit exceeded
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Extract user from kwargs (injected by Depends)
            current_user = kwargs.get("current_user")
            if current_user is None:
                # No user context, skip rate limiting
                return await func(*args, **kwargs)

            user_id = current_user.id
            is_allowed, current, maximum = _rate_limiter.check_rate_limit(
                user_id, config
            )

            if not is_allowed:
                reset_time = _rate_limiter.get_reset_time(user_id, config)
                reset_seconds = int((reset_time - datetime.utcnow()).total_seconds())
                reset_seconds = max(0, reset_seconds)

                raise HTTPException(
                    status_code=429,
                    detail={
                        "error": "Rate limit exceeded",
                        "message": f"You have reached the limit of {maximum} {config.endpoint_name} requests. "
                        f"Please try again in {_format_duration(reset_seconds)}.",
                        "limit": maximum,
                        "used": current,
                        "reset_seconds": reset_seconds,
                    },
                    headers={
                        "X-RateLimit-Limit": str(maximum),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": str(reset_seconds),
                        "Retry-After": str(reset_seconds),
                    },
                )

            # Call the original function
            result = await func(*args, **kwargs)

            # Note: We could add rate limit headers to successful responses too
            # but that requires modifying the response object

            return result

        return wrapper

    return decorator


def check_rate_limit_dependency(
    config: RateLimitConfig,
) -> Callable[..., None]:
    """FastAPI dependency for rate limiting.

    Usage:
        @router.post("/generate")
        async def generate_plan(
            _: None = Depends(check_rate_limit_dependency(RATE_LIMITS["plan_generate"])),
            current_user: User = Depends(get_current_user),
        ):
            ...
    """

    async def dependency(request: Request) -> None:
        # Get user from request state (set by auth middleware)
        current_user = getattr(request.state, "user", None)
        if current_user is None:
            return  # No user, skip rate limiting

        user_id = current_user.id
        is_allowed, current, maximum = _rate_limiter.check_rate_limit(user_id, config)

        if not is_allowed:
            reset_time = _rate_limiter.get_reset_time(user_id, config)
            reset_seconds = int((reset_time - datetime.utcnow()).total_seconds())
            reset_seconds = max(0, reset_seconds)

            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Rate limit exceeded",
                    "message": f"You have reached the limit of {maximum} {config.endpoint_name} requests. "
                    f"Please try again in {_format_duration(reset_seconds)}.",
                    "limit": maximum,
                    "used": current,
                    "reset_seconds": reset_seconds,
                },
                headers={
                    "X-RateLimit-Limit": str(maximum),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset_seconds),
                    "Retry-After": str(reset_seconds),
                },
            )

    return dependency


def _format_duration(seconds: int) -> str:
    """Format seconds into human-readable duration."""
    if seconds < 60:
        return f"{seconds} seconds"
    elif seconds < 3600:
        minutes = seconds // 60
        return f"{minutes} minute{'s' if minutes != 1 else ''}"
    else:
        hours = seconds // 3600
        return f"{hours} hour{'s' if hours != 1 else ''}"
