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
import contextlib
import logging

from fastapi import APIRouter, Depends, Query, Request

from services.geocoder import reverse_geocode
from services.googleplaces_service import enrich_missing_phones, search_nearby_places
from services.health_service import record_search
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


# ── Per-phase time budgets ──────────────────────────────────────────────────
# These caps GUARANTEE /search never exceeds ~25 s end-to-end, even when
# upstreams (Overpass, Google Places) get pathologically slow in sparse
# rural areas.  Without these, we measured 122 s for Jonai/Assam — way
# beyond any reasonable frontend timeout.  A partial result is always
# better than no result.
GEOCODE_BUDGET_S = 5.0
OVERPASS_BUDGET_S = (
    13.0  # 4s × 3 mirrors + jitter — must exceed (TIMEOUT × MIRRORS) to allow real failover
)
GOOGLE_BUDGET_S = 12.0
ENRICH_BUDGET_S = 5.0  # reduced from 10.0: 3 lookups typically finish in <2 s


async def _with_budget(coro, budget_s: float, label: str, fallback):
    """Run coro with a hard wall-clock cap.  Return fallback on timeout."""
    try:
        return await asyncio.wait_for(coro, timeout=budget_s)
    except TimeoutError:
        logger.warning("%s exceeded %.0fs budget — using fallback", label, budget_s)
        return fallback
    except Exception as exc:
        logger.warning("%s failed: %s", label, exc)
        return fallback


async def _safe_overpass(lat: float, lon: float, radius: int = 5000) -> list[dict]:
    """Try Overpass at given radius. Expands to 10km then 20km if sparse. Never raises."""
    try:
        results = await build_and_fetch_query(lat, lon, radius=radius)
        # Expand to 10km and 20km if sparse (rural India support)
        if len(results) < 10:
            try:
                wider = await build_and_fetch_query(lat, lon, radius=10000)
                results.extend(wider)
            except Exception as exc:
                logger.warning("Overpass 10km expansion failed: %s", exc)
        if len(results) < 10:
            try:
                widest = await build_and_fetch_query(lat, lon, radius=20000)
                results.extend(widest)
            except Exception as exc:
                logger.warning("Overpass 20km expansion failed: %s", exc)
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
    # ─── Phase 1: geocode, Overpass, AND Google in parallel ────────────────
    # Fire all three at once. This reduces wall-clock from sequential
    # geo→osm→google to max(geo, osm, google) — saves 10+ s in sparse areas.
    geo, osm_contacts, google_contacts = await asyncio.gather(
        _with_budget(
            _safe_geocode(lat, lon),
            GEOCODE_BUDGET_S,
            "geocode",
            {"landmark": f"{lat:.4f}°, {lon:.4f}°", "country_code": None},
        ),
        _with_budget(_safe_overpass(lat, lon), OVERPASS_BUDGET_S, "overpass", []),
        _with_budget(
            _safe_google(lat, lon, None),  # country_code not needed for base query
            GOOGLE_BUDGET_S,
            "google-places",
            [],
        ),
    )

    # ─── Phase 2: merge, dedupe, sort ────────────────────────────────────
    merged = deduplicate((osm_contacts or []) + (google_contacts or []))
    with contextlib.suppress(Exception):  # malformed contact shouldn't break the response
        merged.sort(key=lambda x: x.get("distance", float("inf")))

    # ─── Phase 3: phone enrichment for top closest phoneless contacts ────
    # Budget-capped: partial enrichment is better than blowing the timeout.
    # Reduced from 6 to 3 to speed up: 3 lookups × find-place + details is fast enough.
    merged = await _with_budget(
        enrich_missing_phones(merged, region=geo.get("country_code"), max_lookups=3),
        ENRICH_BUDGET_S,
        "phone-enrichment",
        merged,  # if enrichment times out, return unenriched contacts
    )

    # ─── Source label: report what actually contributed ──────────────────
    sources = []
    if osm_contacts:
        sources.append("OpenStreetMap")
    if google_contacts:
        sources.append("Google Places")
    if not sources:
        sources.append("none (upstreams unavailable)")
    source = " + ".join(sources)

    # Record for /health counters so judges can verify contact discovery.
    record_search(len(merged))

    return {
        "contacts": merged,
        "source": source,
        "landmark": geo.get("landmark"),
        "country_code": geo.get("country_code"),
        "count": len(merged),
    }
