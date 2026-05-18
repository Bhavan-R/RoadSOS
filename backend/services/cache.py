"""In-memory TTL cache for external API responses.

Why: Overpass and Google Places are rate-limited. During a demo or load test the same coordinates may be queried many times in seconds. The cache reduces external dependency and makes repeated calls feel instant.

The cache is per-process (in-memory). It is not shared across worker processes — sufficient for the hackathon-tier single-worker Render deployment.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any


class TTLCache:
    def __init__(self, ttl_seconds: int = 300, max_entries: int = 200):
        self._ttl = ttl_seconds
        self._max = max_entries
        self._data: dict[str, tuple[float, Any]] = {}
        self._lock = asyncio.Lock()
        self.hits = 0
        self.misses = 0

    def _is_expired(self, ts: float) -> bool:
        return (time.monotonic() - ts) > self._ttl

    async def get(self, key: str) -> Any | None:
        async with self._lock:
            entry = self._data.get(key)
            if entry is None:
                self.misses += 1
                return None
            ts, val = entry
            if self._is_expired(ts):
                del self._data[key]
                self.misses += 1
                return None
            self.hits += 1
            return val

    async def set(self, key: str, value: Any) -> None:
        async with self._lock:
            now = time.monotonic()
            # Drop expired entries opportunistically
            expired = [k for k, (ts, _) in self._data.items() if (now - ts) > self._ttl]
            for k in expired:
                del self._data[k]
            # If still at capacity, evict the oldest entry
            if len(self._data) >= self._max:
                oldest = min(self._data, key=lambda k: self._data[k][0])
                del self._data[oldest]
            self._data[key] = (now, value)

    async def clear(self) -> None:
        async with self._lock:
            self._data.clear()
            self.hits = 0
            self.misses = 0

    def stats(self) -> dict:
        total = self.hits + self.misses
        return {
            "hits": self.hits,
            "misses": self.misses,
            "size": len(self._data),
            "hit_rate": round(self.hits / total, 3) if total > 0 else 0.0,
            "ttl_seconds": self._ttl,
        }


def location_key(lat: float, lon: float, suffix: str = "") -> str:
    """Cache key for a location.

    Rounded to 3 decimal places (~110 metres) to increase cache hit rate during
    demos when the same area is queried repeatedly. Still precise enough for
    emergency services categorization.
    """
    base = f"{lat:.3f}_{lon:.3f}"
    return f"{base}_{suffix}" if suffix else base


# Module-level singletons used by services.
overpass_cache = TTLCache(ttl_seconds=3600, max_entries=200)
google_cache = TTLCache(ttl_seconds=3600, max_entries=200)
geocode_cache = TTLCache(ttl_seconds=86400, max_entries=500)
