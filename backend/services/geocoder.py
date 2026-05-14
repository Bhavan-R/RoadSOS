"""Reverse geocoding via OSM Nominatim.

Returns a human-readable landmark string and the ISO 3166-1 alpha-2 country code.
Cached aggressively (24h) — geocodes don't change.

Reliability hardening:
- Validates the country code matches `^[A-Z]{2}$` before trusting it
- Never raises — failures degrade to a coordinate string + None country
- Strict 8 s timeout
"""
from __future__ import annotations

import logging
import re

import httpx

from services.cache import geocode_cache, location_key

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "RoadSOS/1.1 (hackathon@roadsos.dev)"
ISO_ALPHA2 = re.compile(r"^[A-Z]{2}$")


def _validate_country_code(raw: str | None) -> str | None:
    if not raw:
        return None
    code = raw.strip().upper()
    if not ISO_ALPHA2.match(code):
        logger.warning("Nominatim returned invalid country code: %r", raw)
        return None
    return code


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
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning(f"Nominatim reverse geocode failed: {type(exc).__name__}: {exc}")
        return fallback

    if not isinstance(data, dict):
        logger.warning("Nominatim returned unexpected payload type: %s", type(data).__name__)
        return fallback

    addr = data.get("address", {}) if isinstance(data.get("address"), dict) else {}
    parts = [
        addr.get("road") or addr.get("pedestrian") or addr.get("path"),
        addr.get("suburb") or addr.get("neighbourhood") or addr.get("village"),
        addr.get("city") or addr.get("town") or addr.get("county"),
        addr.get("state"),
    ]
    landmark = ", ".join(p for p in parts if p) or data.get("display_name") or fallback["landmark"]
    country_code = _validate_country_code(addr.get("country_code"))

    result = {"landmark": landmark, "country_code": country_code}
    await geocode_cache.set(cache_key, result)
    return result
