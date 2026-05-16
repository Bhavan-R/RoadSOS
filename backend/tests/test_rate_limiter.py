"""Token-bucket rate limiter tests."""

import asyncio

import pytest
from fastapi import HTTPException

from services.rate_limiter import RateLimiter


class TestRateLimiter:
    async def test_allows_within_burst(self):
        limiter = RateLimiter(rate_per_minute=60, burst=5)
        for _ in range(5):
            await limiter.check("1.1.1.1")

    async def test_blocks_when_burst_exhausted(self):
        limiter = RateLimiter(rate_per_minute=6, burst=2)  # very slow refill
        await limiter.check("2.2.2.2")
        await limiter.check("2.2.2.2")
        with pytest.raises(HTTPException) as exc:
            await limiter.check("2.2.2.2")
        assert exc.value.status_code == 429
        assert "retry_after_seconds" in exc.value.detail

    async def test_independent_buckets_per_ip(self):
        limiter = RateLimiter(rate_per_minute=6, burst=1)
        await limiter.check("3.3.3.3")
        # Different IP — should not be limited
        await limiter.check("4.4.4.4")

    async def test_tokens_refill_over_time(self):
        limiter = RateLimiter(rate_per_minute=120, burst=1)  # 2 tokens/sec
        await limiter.check("5.5.5.5")
        with pytest.raises(HTTPException):
            await limiter.check("5.5.5.5")
        # Wait ~600 ms — should have a token again
        await asyncio.sleep(0.6)
        await limiter.check("5.5.5.5")
