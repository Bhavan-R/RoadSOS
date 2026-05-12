"""GET /search orchestrator.

Strategy:
1. Query Overpass at 5 km. If <3 results, retry at 10 km.
2. If still <3, fallback to Google Places at 10 km (if API key configured).
3. Deduplicate by phone digits, then by lowercased name.
4. Reverse-geocode for landmark + country code.

Reliability hardening:
- All external calls wrapped in try/except — search always returns a valid
  shape even if every upstream is down.
- Rate-limited per IP via services.rate_limiter.
- Empty results are explicitly handled and don't propagate as errors.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query, Request

from services.geocoder import reverse_geocode
from services.googleplaces_service import search_nearby_places
from services.overpass_service import build_and_fetch_query
from services.phone_utils import phones_match
from services.rate_limiter import get_client_ip, search_limiter

logger = logging.getLogger(__name__)

search_router = APIRouter()


def deduplicate(contacts: list[dict]) -> list[dict]:
    """Dedup by phone digits then by lowercased name."""
    out: list[dict] = []
    seen_names: set[str] = set()
    for c in contacts:
        if not isinstance(c, dict):
            continue
        name = c.get("name") or ""
        name_key = name.lower().strip()
        if not name_key:
            continue
        if name_key in seen_names:
            continue
        if any(phones_match(c.get("phone"), existing.get("phone")) for existing in out):
            continue
        seen_names.add(name_key)
        out.append(c)
    return out


async def _check_rate_limit(request: Request) -> None:
    await search_limiter.check(get_client_ip(request))


@search_router.get(
    "/search",
    summary="Find emergency services near a coordinate",
    description=(
        "Searches OpenStreetMap (Overpass) and falls back to Google Places "
        "for hospitals, police, ambulance, towing, repair, tyre, and showroom "
        "establishments within 5-10 km of the supplied coordinate. Reverse-"
        "geocodes the location for a human-readable landmark and ISO 3166-1 "
        "alpha-2 country code.\n\n"
        "Always returns a 200 with a valid response shape — empty arrays "
        "rather than errors if upstream services are unavailable."
    ),
)
async def search_facilities(
    lat: float = Query(..., ge=-90, le=90, description="Latitude, WGS84"),
    lon: float = Query(..., ge=-180, le=180, description="Longitude, WGS84"),
    _: None = Depends(_check_rate_limit),
):
    contacts: list[dict] = []
    source = "OpenStreetMap"

    # ─── Overpass first (with internal retry + mirror fallback) ──────────
    for radius in (5000, 10000):
        if len(contacts) >= 3:
            break
        try:
            contacts = await build_and_fetch_query(lat, lon, radius=radius)
        except Exception as exc:
            logger.warning("Overpass at %dm failed: %s", radius, exc)
            # Don't bail — continue to wider radius / Google fallback

    # ─── Geocode ─────────────────────────────────────────────────────────
    try:
        geo = await reverse_geocode(lat, lon)
    except Exception as exc:
        logger.warning("Geocode failed: %s", exc)
        geo = {"landmark": f"{lat:.4f}°, {lon:.4f}°", "country_code": None}

    # ─── Google Places fallback (only if we still need more contacts) ────
    if len(contacts) < 3:
        try:
            google = await search_nearby_places(
                lat, lon, radius=10000, region=geo.get("country_code")
            )
            if google:
                contacts = contacts + google
                source = "OpenStreetMap + Google Places"
        except Exception as exc:
            logger.warning("Google Places fallback failed: %s", exc)

    # ─── Defensive: ensure list, dedupe, sort ────────────────────────────
    contacts = deduplicate(contacts or [])
    try:
        contacts.sort(key=lambda x: x.get("distance", float("inf")))
    except Exception:
        pass  # malformed contact shouldn't break the response

    return {
        "contacts": contacts,
        "source": source,
        "landmark": geo.get("landmark"),
        "country_code": geo.get("country_code"),
        "count": len(contacts),
    }
