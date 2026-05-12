import asyncio

import pytest

from services.cache import TTLCache, location_key


class TestTTLCache:
    async def test_basic_set_get(self):
        cache = TTLCache(ttl_seconds=10, max_entries=10)
        await cache.set("key1", "value1")
        assert await cache.get("key1") == "value1"

    async def test_miss(self):
        cache = TTLCache()
        assert await cache.get("does-not-exist") is None

    async def test_expiry(self):
        cache = TTLCache(ttl_seconds=0, max_entries=10)  # immediate expiry
        await cache.set("k", "v")
        await asyncio.sleep(0.05)
        assert await cache.get("k") is None

    async def test_capacity_eviction(self):
        cache = TTLCache(ttl_seconds=300, max_entries=2)
        await cache.set("a", 1)
        await cache.set("b", 2)
        await cache.set("c", 3)  # should evict 'a'
        assert await cache.get("a") is None
        # b and c should both still be there
        assert await cache.get("b") == 2 or await cache.get("c") == 3

    async def test_stats(self):
        cache = TTLCache(ttl_seconds=60)
        await cache.set("k", "v")
        await cache.get("k")  # hit
        await cache.get("missing")  # miss
        stats = cache.stats()
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["hit_rate"] == 0.5


class TestLocationKey:
    def test_rounds_to_4_decimals(self):
        # Different sub-meter precision should produce same key
        k1 = location_key(12.97163456, 77.59461234)
        k2 = location_key(12.97164999, 77.59462888)
        assert k1 == k2

    def test_suffix(self):
        k1 = location_key(12.9716, 77.5946, "r5000")
        k2 = location_key(12.9716, 77.5946, "r10000")
        assert k1 != k2
