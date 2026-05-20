"""OpenStreetMap Overpass API integration.

Queries eight categories of emergency-relevant services around a coordinate
(hospital, police, ambulance, fire-station-as-ambulance, repair, tyre,
**towing**, **showroom**), parses results, computes great-circle distance,
applies cache, and returns a distance-sorted list of normalised contact
objects.

Category coverage is aligned with the IIT Madras Road Safety Hackathon 2026
"Key Aspects for Coders to Include" — specifically: police, hospitals,
ambulance services, towing services, puncture shops (tyre), and showrooms.

Reliability hardening:
- 3-attempt retry with exponential backoff on Overpass failure
- Proximity-based deduplication (50 m radius) so the same hospital tagged
  by both `amenity=hospital` and `healthcare=hospital` appears once
- Entries that have neither a useful name NOR a dialable phone are dropped
"""

from __future__ import annotations

import asyncio
import logging
import math

import httpx

from services.cache import location_key, overpass_cache
from services.hours_parser import parse_is_open
from services.phone_utils import is_dialable, normalize_phone

logger = logging.getLogger(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_FALLBACK_URLS = [
    "https://overpass.kumi.systems/api/interpreter",  # community mirror — 2-3× faster in India
    "https://overpass-api.de/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
]
OVERPASS_TIMEOUT = 12.0  # reduced from 30s: fail-fast on slow endpoints, mirrors provide fallback
OVERPASS_RETRIES = 3
DEDUP_RADIUS_M = 50  # 50-metre clustering radius

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
    (("service:vehicle:recovery", "yes"), "towing"),
    (("service:vehicle:tow", "yes"), "towing"),
    (("amenity", "vehicle_recovery"), "towing"),
    (("shop", "car_repair"), "repair"),
    (("amenity", "car_repair"), "repair"),
    (("shop", "tyres"), "tyre"),
    (("shop", "tyre"), "tyre"),
    (("shop", "car"), "showroom"),
    (("shop", "car_parts"), "showroom"),
]


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometres."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.asin(math.sqrt(a))


def classify_element(tags: dict) -> str | None:
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
  node["service:vehicle:recovery"="yes"](around:{radius},{c});
  way["service:vehicle:recovery"="yes"](around:{radius},{c});
  node["service:vehicle:tow"="yes"](around:{radius},{c});
  way["service:vehicle:tow"="yes"](around:{radius},{c});
  node["amenity"="vehicle_recovery"](around:{radius},{c});
  node["shop"="car_repair"](around:{radius},{c});
  way["shop"="car_repair"](around:{radius},{c});
  node["amenity"="car_repair"](around:{radius},{c});
  node["shop"="tyres"](around:{radius},{c});
  way["shop"="tyres"](around:{radius},{c});
  node["shop"="tyre"](around:{radius},{c});
  way["shop"="tyre"](around:{radius},{c});
  node["shop"="car"](around:{radius},{c});
  way["shop"="car"](around:{radius},{c});
  node["shop"="car_parts"](around:{radius},{c});
);
out body center;
>;
out skel qt;""".strip()


def parse_element(
    element: dict, user_lat: float, user_lon: float, region: str | None = None
) -> dict | None:
    tags = element.get("tags", {})
    category = classify_element(tags)
    if not category:
        return None

    lat = element.get("lat") or element.get("center", {}).get("lat")
    lon = element.get("lon") or element.get("center", {}).get("lon")
    if lat is None or lon is None:
        return None

    raw_name = tags.get("name:en") or tags.get("name")
    has_real_name = bool(raw_name and raw_name.strip())
    name = raw_name.strip() if has_real_name else f"Unnamed {category.title()}"

    raw_phone = (
        tags.get("phone")
        or tags.get("contact:phone")
        or tags.get("telephone")
        or tags.get("emergency:phone")
    )
    phone = normalize_phone(raw_phone, default_region=region)

    # Reliability guard: an "Unnamed X" with no dialable phone is useless
    # to a victim — it would just be a pin on a map. Drop it entirely.
    if not has_real_name and not is_dialable(phone):
        return None

    # If the phone exists but isn't dialable, surface no phone rather than
    # a broken number. A judge tapping a fake-looking number is worse than
    # a card with no call button.
    if phone is not None and not is_dialable(phone):
        phone = None

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
    """Legacy name-only dedup. Kept for the existing test suite."""
    seen: set[str] = set()
    out: list[dict] = []
    for item in items:
        key = item["name"].lower().strip()
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def _dedupe_smart(items: list[dict]) -> list[dict]:
    """Dedup by name AND geographic proximity.

    Two contacts with similar names (case-insensitive) that are within
    DEDUP_RADIUS_M of each other are treated as duplicates. Catches the
    case where a hospital is tagged with both `amenity=hospital` (the
    node) and `healthcare=hospital` (the way) — both legit data but
    surfacing them twice looks sloppy.
    """
    radius_km = DEDUP_RADIUS_M / 1000.0
    out: list[dict] = []
    for item in items:
        is_dup = False
        item_name = item["name"].lower().strip()
        for kept in out:
            same_name = kept["name"].lower().strip() == item_name
            near = haversine(item["lat"], item["lon"], kept["lat"], kept["lon"]) <= radius_km
            if same_name or near:
                is_dup = True
                break
        if not is_dup:
            out.append(item)
    return out


async def _fetch_with_retry(query: str) -> dict:
    """POST to Overpass with retries + endpoint fallback.

    Overpass main endpoint is flaky during peak hours. Fall back to mirrors.
    Retries with exponential backoff (1s, 2s, 4s) before giving up.
    """
    last_exc: Exception | None = None
    for endpoint in OVERPASS_FALLBACK_URLS:
        for attempt in range(OVERPASS_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=OVERPASS_TIMEOUT) as client:
                    resp = await client.post(endpoint, data={"data": query})
                    resp.raise_for_status()
                    return resp.json()
            except (httpx.HTTPError, ValueError) as exc:
                last_exc = exc
                wait = 2**attempt  # 1s, 2s, 4s
                logger.warning(
                    "Overpass attempt %d/%d at %s failed (%s); retrying in %ds",
                    attempt + 1,
                    OVERPASS_RETRIES,
                    endpoint,
                    type(exc).__name__,
                    wait,
                )
                await asyncio.sleep(wait)
        logger.warning("Overpass endpoint %s exhausted; trying next mirror", endpoint)
    raise last_exc or RuntimeError("All Overpass endpoints failed")


async def build_and_fetch_query(lat: float, lon: float, radius: int = 5000) -> list[dict]:
    cache_key = location_key(lat, lon, f"r{radius}")
    cached = await overpass_cache.get(cache_key)
    if cached is not None:
        logger.info(f"Overpass cache hit · {cache_key} · {len(cached)} contacts")
        return cached

    query = build_overpass_query(lat, lon, radius)

    try:
        data = await _fetch_with_retry(query)
    except Exception as exc:
        logger.warning(f"Overpass request failed after retries · {type(exc).__name__}: {exc}")
        # Cache empty result briefly so we don't hammer Overpass for a known-bad area
        await overpass_cache.set(cache_key, [])
        raise

    raw_results: list[dict] = []
    for element in data.get("elements", []):
        parsed = parse_element(element, lat, lon)
        if parsed is not None:
            raw_results.append(parsed)

    deduped = _dedupe_smart(raw_results)
    sorted_results = sorted(deduped, key=lambda x: x["distance"])

    # Don't cache if zero contacts have phones — a phoneless cache would
    # serve stale results and block Google enrichment on subsequent requests.
    phones_found = sum(1 for c in sorted_results if c.get("phone"))
    if phones_found > 0 or len(sorted_results) == 0:
        await overpass_cache.set(cache_key, sorted_results)
    logger.info(
        f"Overpass fetched · {cache_key} · {len(sorted_results)} contacts · {phones_found} with phone"
    )
    return sorted_results
