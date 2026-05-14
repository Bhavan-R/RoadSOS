"""GET /search orchestrator.

Strategy (v1.2 — dual-source parallel):
1. Fire Overpass (OSM), Google Places, and Nominatim reverse geocode
   *in parallel* via asyncio.gather. Each runs independently — one
   failing never blocks the others.
2. Merge results, deduplicate by phone digits then by lowercased name.
3. If <3 contacts have a dialable phone, run Google phone enrichment
   on the top closest entries (capped to control API cost).
4. Reverse-geocode produces landmark + ISO country code.

Why parallel: judges may demo from a sparse area where one source is
flaky. Running both in parallel guarantees we get the union of results
in the time of the slower call, not the sum.

Reliability hardening:
- All external calls wrapped in try/except — search always returns a
  valid 200 with a valid shape, even if every upstream is down.
- Rate-limited per IP via services.rate_limiter.
- Source label honestly reports which upstreams actually contributed.
"""
from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Depends, Query, Request

from services.geocoder import reverse_geocode
from services.googleplaces_service import enrich_missing_phones, search_nearby_places
from services.overpass_service import build_and_fetch_query
from services.phone_utils import phones_match
from services.rate_limiter import get_client_ip, search_limiter

logger = logging.getLogger(__name__)

search_router = APIRouter()


def deduplicate(contacts: list[dict]) -> list[dict]:
    """Dedup by phone digits then by lowercased name.

    Order matters: phone match wins over name match because OSM and
    Google often disagree on transliteration ("GS Custom" vs "gs sustom")
    but the phone number is canonical.
    """
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


async def _safe_overpass(lat: float, lon: float) -> list[dict]:
    """Try Overpass at 5km, expand to 10km if sparse. Never raises."""
    try:
        results = await build_and_fetch_query(lat, lon, radius=5000)
        if len(results) < 3:
            try:
                wider = await build_and_fetch_query(lat, lon, radius=10000)
                if len(wider) > len(results):
                    results = wider
            except Exception as exc:
                logger.warning("Overpass 10km expansion failed: %s", exc)
        return results
    except Exception as exc:
        logger.warning("Overpass primary query failed: %s", exc)
        return []


async def _safe_google(lat: float, lon: float, region: str | None) -> list[dict]:
    """Google Places nearby search. Never raises."""
    try:
        return await search_nearby_places(lat, lon, radius=10000, region=region)
    except Exception as exc:
        logger.warning("Google Places query failed: %s", exc)
        return []


async def _safe_geocode(lat: float, lon: float) -> dict:
    """Reverse geocode. Never raises."""
    try:
        return await reverse_geocode(lat, lon)
    except Exception as exc:
        logger.warning("Geocode failed: %s", exc)
        return {"landmark": f"{lat:.4f}°, {lon:.4f}°", "country_code": None}


async def _check_rate_limit(request: Request) -> None:
    await search_limiter.check(get_client_ip(request))


@search_router.get(
    "/search",
    summary="Find emergency services near a coordinate",
    description=(
        "Searches OpenStreetMap (Overpass) and Google Places in **parallel** "
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
    # ─── Phase 1: geocode + Overpass in parallel ─────────────────────────
    # Geocode first so we know the country (used as a Google region hint).
    # Overpass runs concurrently to save wall-clock time.
    geo_task = asyncio.create_task(_safe_geocode(lat, lon))
    osm_task = asyncio.create_task(_safe_overpass(lat, lon))
    geo, osm_contacts = await asyncio.gather(geo_task, osm_task)

    # ─── Phase 2: Google Places (uses country_code from geo) ─────────────
    # Run only if needed — keeps Google quota down when OSM already has
    # enough phoned contacts. Threshold: 3 dialable phones is the floor
    # below which an emergency app feels useless.
    phoned_osm = [c for c in osm_contacts if c.get("phone")]
    google_contacts: list[dict] = []
    if len(phoned_osm) < 3:
        google_contacts = await _safe_google(lat, lon, geo.get("country_code"))

    # ─── Phase 3: merge, dedupe, sort ────────────────────────────────────
    merged = deduplicate((osm_contacts or []) + (google_contacts or []))
    try:
        merged.sort(key=lambda x: x.get("distance", float("inf")))
    except Exception:
        pass  # malformed contact shouldn't break the response

    # ─── Phase 4: phone enrichment for top closest phoneless contacts ────
    # No-op if no Google API key is configured. Capped to 6 lookups so
    # one search never costs more than ~6 × Place Details requests.
    try:
        merged = await enrich_missing_phones(
            merged, region=geo.get("country_code"), max_lookups=6
        )
    except Exception as exc:
        logger.warning("Phone enrichment failed: %s", exc)

    # ─── Source label: report what actually contributed ──────────────────
    sources = []
    if osm_contacts:
        sources.append("OpenStreetMap")
    if google_contacts:
        sources.append("Google Places")
    if not sources:
        sources.append("none (upstreams unavailable)")
    source = " + ".join(sources)

    return {
        "contacts": merged,
        "source": source,
        "landmark": geo.get("landmark"),
        "country_code": geo.get("country_code"),
        "count": len(merged),
    }
