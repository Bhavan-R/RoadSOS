"""Google Places fallback for sparse OSM regions.

Only invoked when Overpass returns fewer than 3 results at the expanded radius.
We use Nearby Search to find places, then Place Details for each to get the
phone number (the Nearby endpoint does not return phones).

Costs money beyond the free tier. Capped to top 5 places per type per call to
control spend during the hackathon.
"""
from __future__ import annotations

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


async def search_nearby_places(lat: float, lon: float, radius: int = 5000, region: Optional[str] = None) -> list[dict]:
    api_key = os.getenv("GOOGLE_PLACES_API_KEY", "")
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
