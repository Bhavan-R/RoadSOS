"""Google Places fallback for sparse OSM regions.

Only invoked when Overpass returns fewer than 3 results at the expanded radius.
We use Nearby Search to find places, then Place Details for each to get the
phone number (the Nearby endpoint does not return phones).

Costs money beyond the free tier. Capped to top 5 places per type per call to
control spend during the hackathon.
"""
from __future__ import annotations

import itertools
import logging
import math
import os
from typing import Optional

import httpx

from services.cache import google_cache, location_key
from services.phone_utils import normalize_phone

logger = logging.getLogger(__name__)

NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
FINDPLACE_URL = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"

# ─── Key rotation ────────────────────────────────────────────────────────────
# Set Mapsplatformkey as a comma-separated list of keys on Render to
# distribute load across multiple billing accounts.
def _load_keys() -> list[str]:
    multi = os.getenv("Mapsplatformkey", "")
    keys = [k.strip() for k in multi.split(",") if k.strip()]
    if not keys:
        single = os.getenv("Mapsplatformkey", "")
        keys = [single] if single else []
    return keys

_KEY_POOL: list[str] = _load_keys()
_key_cycle = itertools.cycle(_KEY_POOL) if _KEY_POOL else None

def _next_key() -> str:
    """Round-robin across all configured API keys."""
    if not _KEY_POOL:
        return ""
    return next(_key_cycle)  # type: ignore[arg-type]

SEARCH_TYPES = ["hospital", "police", "car_repair", "fire_station"]

TYPE_CATEGORY_MAP = {
    "hospital": "hospital",
    "doctor": "hospital",
    "police": "police",
    "car_repair": "repair",
    "fire_station": "ambulance",
}


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def map_google_types(types: list[str]) -> Optional[str]:
    for t in types:
        if t in TYPE_CATEGORY_MAP:
            return TYPE_CATEGORY_MAP[t]
    return None


async def _get_place_details(client: httpx.AsyncClient, place_id: str, api_key: str, region: Optional[str]) -> dict:
    try:
        resp = await client.get(DETAILS_URL, params={
            "place_id": place_id,
            "fields": "formatted_phone_number,opening_hours",
            "key": api_key,
        }, timeout=10.0)
        result = resp.json().get("result", {})
        return {
            "phone": normalize_phone(result.get("formatted_phone_number"), default_region=region),
            "isOpen": result.get("opening_hours", {}).get("open_now"),
        }
    except Exception:
        return {"phone": None, "isOpen": None}


async def enrich_phone_for_contact(
    client: httpx.AsyncClient,
    name: str,
    lat: float,
    lon: float,
    api_key: str,
    region: Optional[str],
) -> Optional[str]:
    """Find a phone number for an existing contact by name + location.

    Strategy:
    1. Find Place from Text (fast, name-based) — works when OSM name matches Google
    2. Nearby Search in 100 m radius (coordinate-based) — fallback for OSM typos
       e.g. "gs sustom" won't match "GS Custom" by text, but they share coordinates
    """
    # ── Step 1: name-based lookup ────────────────────────────────────────
    try:
        resp = await client.get(FINDPLACE_URL, params={
            "input": name,
            "inputtype": "textquery",
            "locationbias": f"circle:500@{lat},{lon}",
            "fields": "place_id",
            "key": api_key,
        }, timeout=8.0)
        candidates = resp.json().get("candidates", [])
        if candidates:
            place_id = candidates[0].get("place_id")
            if place_id:
                details = await _get_place_details(client, place_id, api_key, region)
                if details.get("phone"):
                    return details["phone"]
    except Exception:
        pass

    # ── Step 2: coordinate-based fallback (handles OSM name typos) ──────
    try:
        resp = await client.get(NEARBY_URL, params={
            "location": f"{lat},{lon}",
            "radius": 100,          # 100 m — very tight, same building
            "key": api_key,
        }, timeout=8.0)
        places = resp.json().get("results", [])
        if places:
            place_id = places[0].get("place_id")
            if place_id:
                details = await _get_place_details(client, place_id, api_key, region)
                if details.get("phone"):
                    return details["phone"]
    except Exception:
        pass

    return None


async def enrich_missing_phones(
    contacts: list[dict],
    region: Optional[str],
    max_lookups: int = 6,
) -> list[dict]:
    """Look up missing phone numbers for the top contacts via Google.

    Only enriches contacts that are missing a phone, capped at `max_lookups`
    to control API spend. Mutates the contact dicts in place and returns
    the same list.
    """
    api_key = _next_key()
    if not api_key:
        return contacts

    # Sort by distance ascending so we enrich the closest places first.
    sorted_contacts = sorted(contacts, key=lambda c: c.get("distance", float("inf")))
    needs_phone = [c for c in sorted_contacts if not c.get("phone") and c.get("name")][:max_lookups]
    if not needs_phone:
        return contacts

    logger.info(f"Enriching {len(needs_phone)} contacts with Google phone lookup")
    enriched_count = 0
    async with httpx.AsyncClient(timeout=15.0) as client:
        for c in needs_phone:
            phone = await enrich_phone_for_contact(
                client,
                c["name"],
                c.get("lat", 0),
                c.get("lon", 0),
                api_key,
                region,
            )
            if phone:
                c["phone"] = phone
                enriched_count += 1
    logger.info(f"Phone enrichment: {enriched_count}/{len(needs_phone)} found")
    return contacts


async def search_nearby_places(lat: float, lon: float, radius: int = 5000, region: Optional[str] = None) -> list[dict]:
    api_key = _next_key()
    if not api_key:
        return []

    cache_key = location_key(lat, lon, f"r{radius}")
    cached = await google_cache.get(cache_key)
    if cached is not None:
        logger.info(f"Google Places cache hit · {cache_key} · {len(cached)} contacts")
        return cached

    results: list[dict] = []
    seen_ids: set[str] = set()

    async with httpx.AsyncClient(timeout=20.0) as client:
        for place_type in SEARCH_TYPES:
            try:
                resp = await client.get(NEARBY_URL, params={
                    "location": f"{lat},{lon}",
                    "radius": radius,
                    "type": place_type,
                    "key": api_key,
                })
                places = resp.json().get("results", [])[:5]
            except Exception as exc:
                logger.warning(f"Google Places nearby query failed for {place_type}: {exc}")
                continue

            for place in places:
                place_id = place.get("place_id", "")
                if not place_id or place_id in seen_ids:
                    continue
                seen_ids.add(place_id)

                category = map_google_types(place.get("types", []))
                if not category:
                    continue

                loc = place["geometry"]["location"]
                details = await _get_place_details(client, place_id, api_key, region)

                results.append({
                    "id": f"gp_{place_id}",
                    "name": place.get("name", "Unknown"),
                    "category": category,
                    "phone": details["phone"],
                    "distance": round(haversine(lat, lon, loc["lat"], loc["lng"]), 2),
                    "lat": loc["lat"],
                    "lon": loc["lng"],
                    "source": "Google Places",
                    "isOpen": details["isOpen"],
                    "aiReason": None,
                })

    sorted_results = sorted(results, key=lambda x: x["distance"])
    await google_cache.set(cache_key, sorted_results)
    logger.info(f"Google Places fetched · {cache_key} · {len(sorted_results)} contacts")
    return sorted_results
