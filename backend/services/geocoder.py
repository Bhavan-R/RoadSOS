"""Reverse geocoding via OSM Nominatim.

Returns a human-readable landmark string and the ISO 3166-1 alpha-2 country code.
Cached aggressively (24h) — geocodes don't change.
"""
from __future__ import annotations

import logging

import httpx

from services.cache import geocode_cache, location_key

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "RoadSOS/1.0 (hackathon@roadsos.dev)"


async def reverse_geocode(lat: float, lon: float) -> dict:
    """Returns {'landmark': str, 'country_code': str | None}.

    Never raises — failures degrade to coordinate string + None country.
    """
    cache_key = location_key(lat, lon, "geo")
    cached = await geocode_cache.get(cache_key)
    if cached is not None:
        return cached

    fallback = {"landmark": f"{lat:.4f}°N, {lon:.4f}°E", "country_code": None}

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                NOMINATIM_URL,
                params={"lat": lat, "lon": lon, "format": "json", "zoom": 16},
                headers={"User-Agent": USER_AGENT},
            )
            data = resp.json()
    except Exception as exc:
        logger.warning(f"Nominatim reverse geocode failed: {exc}")
        return fallback

    addr = data.get("address", {}) if isinstance(data, dict) else {}
    parts = [
        addr.get("road") or addr.get("pedestrian") or addr.get("path"),
        addr.get("suburb") or addr.get("neighbourhood") or addr.get("village"),
        addr.get("city") or addr.get("town") or addr.get("county"),
        addr.get("state"),
    ]
    landmark = ", ".join(p for p in parts if p) or data.get("display_name", fallback["landmark"])
    country_code = (addr.get("country_code") or "").upper() or None

    result = {"landmark": landmark, "country_code": country_code}
    await geocode_cache.set(cache_key, result)
    return result
