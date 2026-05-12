"""GET /search orchestrator.

Strategy:
1. Query Overpass at 5 km. If <3 results, retry at 10 km.
2. If still <3, fallback to Google Places at 10 km.
3. Deduplicate by phone digits, then by lowercased name.
4. Reverse-geocode for landmark + country code.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query

from services.geocoder import reverse_geocode
from services.googleplaces_service import search_nearby_places
from services.overpass_service import build_and_fetch_query
from services.phone_utils import phones_match

logger = logging.getLogger(__name__)

search_router = APIRouter()


def deduplicate(contacts: list[dict]) -> list[dict]:
    out: list[dict] = []
    seen_names: set[str] = set()
    for c in contacts:
        name_key = c["name"].lower().strip()
        if name_key in seen_names:
            continue
        # Phone-based dedup with last-10-digit match
        if any(phones_match(c.get("phone"), existing.get("phone")) for existing in out):
            continue
        seen_names.add(name_key)
        out.append(c)
    return out


@search_router.get("/search", summary="Find emergency services near a coordinate")
async def search_facilities(
    lat: float = Query(..., ge=-90, le=90, description="Latitude"),
    lon: float = Query(..., ge=-180, le=180, description="Longitude"),
):
    contacts: list[dict] = []
    source = "OpenStreetMap"

    for radius in (5000, 10000):
        if len(contacts) >= 3:
            break
        try:
            contacts = await build_and_fetch_query(lat, lon, radius=radius)
        except Exception as exc:
            logger.warning(f"Overpass attempt at {radius}m failed: {exc}")

    geo = await reverse_geocode(lat, lon)

    if len(contacts) < 3:
        try:
            google = await search_nearby_places(
                lat, lon, radius=10000, region=geo.get("country_code")
            )
            if google:
                contacts = contacts + google
                source = "OpenStreetMap + Google Places"
        except Exception as exc:
            logger.warning(f"Google Places fallback failed: {exc}")

    contacts = deduplicate(contacts)
    contacts.sort(key=lambda x: x["distance"])

    return {
        "contacts": contacts,
        "source": source,
        "landmark": geo["landmark"],
        "country_code": geo["country_code"],
        "count": len(contacts),
    }
