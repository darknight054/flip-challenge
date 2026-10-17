import math
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import Request

from app.core.errors import ApiError

# bucket -> (requests per window, window seconds, message)
LIMITS: dict[str, tuple[int, float, str]] = {
    "auth": (10, 60.0, "Too many attempts. Try again shortly."),
    "posts": (10, 60.0, "You're posting very fast. Try again shortly."),
    "comments": (20, 60.0, "You're commenting very fast. Try again shortly."),
    "user": (120, 60.0, "Too many requests. Try again shortly."),
}


class RateLimiter:
    """In-memory sliding window. Single-process only, which matches the single-host SQLite setup."""

    def __init__(self) -> None:
        self._hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def hit(self, bucket: str, key: str, limit: int, window: float) -> int | None:
        """Record a hit. Returns seconds to wait if the limit is exceeded, else None."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits[(bucket, key)]
            while hits and now - hits[0] >= window:
                hits.popleft()
            if len(hits) >= limit:
                return max(1, math.ceil(window - (now - hits[0])))
            hits.append(now)
            return None


def enforce(request: Request, bucket: str, key: str | int) -> None:
    if not request.app.state.settings.rate_limits_enabled:
        return
    limit, window, message = LIMITS[bucket]
    retry_after = request.app.state.rate_limiter.hit(bucket, str(key), limit, window)
    if retry_after is not None:
        raise ApiError(429, "rate_limited", message, retry_after=retry_after)


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"
