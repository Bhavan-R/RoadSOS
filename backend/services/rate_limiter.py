"""Per-IP in-memory token-bucket rate limiter.

Protects /search and /triage from abuse. Automated load testing or a
single malicious user cannot exhaust the Overpass quota or the Gemini
free-tier rate limits.

Why in-memory: a hackathon backend on Render's free tier has one process.
No need for Redis. If we ever scale horizontally, swap to slowapi+Redis.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field

from fastapi import HTTPException, Request, status

logger = logging.getLogger(__name__)


@dataclass
class Bucket:
    tokens: float
    last_refill: float = field(default_factory=time.monotonic)


class RateLimiter:
    """Token-bucket per client IP. Default: 30 requests/minute, burst of 10."""

    def __init__(self, rate_per_minute: int = 30, burst: int = 10) -> None:
        self.rate_per_sec = rate_per_minute / 60.0
        self.burst = burst
        self._buckets: dict[str, Bucket] = defaultdict(lambda: Bucket(tokens=float(burst)))
        self._lock = asyncio.Lock()

    async def check(self, client_ip: str) -> None:
        """Raise 429 if the client has exhausted its budget."""
        async with self._lock:
            bucket = self._buckets[client_ip]
            now = time.monotonic()
            elapsed = now - bucket.last_refill
            bucket.tokens = min(float(self.burst), bucket.tokens + elapsed * self.rate_per_sec)
            bucket.last_refill = now
            if bucket.tokens < 1.0:
                retry_after = int((1.0 - bucket.tokens) / self.rate_per_sec) + 1
                logger.info("Rate limit hit · ip=%s · retry_after=%ds", client_ip, retry_after)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "error": "rate_limit_exceeded",
                        "retry_after_seconds": retry_after,
                    },
                    headers={"Retry-After": str(retry_after)},
                )
            bucket.tokens -= 1.0


# Shared instance — sized so a venue of 10 judges sharing a NAT IP during
# live demo (one /search per judge in 5–10 s) does not trip 429s, while
# still capping automated abuse.  60 reqs/min, 30 burst → ~3 quick demos
# back-to-back without bottoming the bucket.
search_limiter = RateLimiter(rate_per_minute=60, burst=30)
triage_limiter = RateLimiter(rate_per_minute=40, burst=15)


def get_client_ip(request: Request) -> str:
    """Resolve the real client IP, respecting common reverse-proxy headers."""
    # Render/Cloudflare/Vercel forward via X-Forwarded-For
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
