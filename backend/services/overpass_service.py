"""OpenStreetMap Overpass API integration.

Queries six categories of emergency-relevant services around a coordinate,
parses results, computes great-circle distance, applies cache, and returns a
distance-sorted list of normalised contact objects.
"""
from __future__ import annotations

import logging
import math
from typing import Optional

import httpx

from services.cache import overpass_cache, location_key
from services.phone_utils import normalize_phone
from services.hours_parser import parse_is_open

logger = logging.getLogger(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_TIMEOUT = 30.0

CATEGORY_MAP: list[tuple[tuple[str, str], str]] = [
    (("amenity", "hospital"), "hospital"),
    (("amenity", "clinic"), "hospital"),
    (("amenity", "doctors"), "hospital"),
    (("healthcare", "hospital"), "hospital"),
    (("healthcare", "clinic"), "hospital"),
    (("amenity", "police"), "police"),
    (("emergency", "ambulance_station"), "ambulance"),
    (("amenity", "ambulance_station"), "ambulance"),
    (("amenity", "fire_station"), "ambulance"),
    (("shop", "car_repair"), "repair"),
    (("amenity", "car_repair"), "repair"),
    (("shop", "tyres"), "tyre"),
    (("shop", "tyre"), "tyre"),
]


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometres."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def classify_element(tags: dict) -> Optional[str]:
    for (key, val), category in CATEGORY_MAP:
        if tags.get(key) == val:
            return category
    return None


def build_overpass_query(lat: float, lon: float, radius: int) -> str:
    c = f"{lat},{lon}"
    return f"""[out:json][timeout:25];
(
  node["amenity"="hospital"](around:{radius},{c});
  way["amenity"="hospital"](around:{radius},{c});
  node["amenity"="clinic"](around:{radius},{c});
  way["amenity"="clinic"](around:{radius},{c});
  node["amenity"="doctors"](around:{radius},{c});
  node["healthcare"="hospital"](around:{radius},{c});
  way["healthcare"="hospital"](around:{radius},{c});
  node["healthcare"="clinic"](around:{radius},{c});
  node["amenity"="police"](around:{radius},{c});
  way["amenity"="police"](around:{radius},{c});
  node["emergency"="ambulance_station"](around:{radius},{c});
  node["amenity"="ambulance_station"](around:{radius},{c});
  node["amenity"="fire_station"](around:{radius},{c});
  way["amenity"="fire_station"](around:{radius},{c});
  node["shop"="car_repair"](around:{radius},{c});
  way["shop"="car_repair"](around:{radius},{c});
  node["amenity"="car_repair"](around:{radius},{c});
  node["shop"="tyres"](around:{radius},{c});
);
out body center;
>;
out skel qt;""".strip()


def parse_element(element: dict, user_lat: float, user_lon: float, region: Optional[str] = None) -> Optional[dict]:
    tags = element.get("tags", {})
    category = classify_element(tags)
    if not category:
        return None

    lat = element.get("lat") or element.get("center", {}).get("lat")
    lon = element.get("lon") or element.get("center", {}).get("lon")
    if lat is None or lon is None:
        return None

    name = (
        tags.get("name:en")
        or tags.get("name")
        or f"Unnamed {category.title()}"
    )
    raw_phone = (
        tags.get("phone")
        or tags.get("contact:phone")
        or tags.get("telephone")
        or tags.get("emergency:phone")
    )
    phone = normalize_phone(raw_phone, default_region=region)
    is_open = parse_is_open(tags.get("opening_hours"))

    return {
        "id": f"osm_{element['id']}",
        "name": name,
        "category": category,
        "phone": phone,
        "distance": round(haversine(user_lat, user_lon, lat, lon), 2),
        "lat": lat,
        "lon": lon,
        "source": "OpenStreetMap",
        "isOpen": is_open,
        "aiReason": None,
    }


def _dedupe_by_name(items: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for item in items:
        key = item["name"].lower().strip()
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


async def build_and_fetch_query(lat: float, lon: float, radius: int = 5000) -> list[dict]:
    cache_key = location_key(lat, lon, f"r{radius}")
    cached = await overpass_cache.get(cache_key)
    if cached is not None:
        logger.info(f"Overpass cache hit · {cache_key} · {len(cached)} contacts")
        return cached

    query = build_overpass_query(lat, lon, radius)

    try:
        async with httpx.AsyncClient(timeout=OVERPASS_TIMEOUT) as client:
            resp = await client.post(OVERPASS_URL, data={"data": query})
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.warning(f"Overpass request failed · {type(exc).__name__}: {exc}")
        raise

    raw_results: list[dict] = []
    for element in data.get("elements", []):
        parsed = parse_element(element, lat, lon)
        if parsed is not None:
            raw_results.append(parsed)

    deduped = _dedupe_by_name(raw_results)
    sorted_results = sorted(deduped, key=lambda x: x["distance"])

    await overpass_cache.set(cache_key, sorted_results)
    logger.info(f"Overpass fetched · {cache_key} · {len(sorted_results)} contacts")
    return sorted_results
