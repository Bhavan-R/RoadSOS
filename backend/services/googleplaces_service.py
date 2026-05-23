"""Google Places fallback for sparse OSM regions.

Only invoked when Overpass returns fewer than 10 results at the expanded radius.
We use Nearby Search to find places, then Place Details for each to get the
phone number (the Nearby endpoint does not return phones).

Costs money beyond the free tier. Capped to top 8 places per type per call to
control spend during the hackathon.
"""

from __future__ import annotations

import asyncio
import itertools
import logging
import os

import httpx
from unidecode import unidecode

from services.cache import google_cache, location_key
from services.geo_utils import haversine
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


# (type, keyword, category) tuples — enables both native type queries and keyword fallback
SEARCH_QUERIES: list[tuple[str | None, str | None, str]] = [
    ("hospital", None, "hospital"),
    ("police", None, "police"),
    ("car_repair", None, "repair"),
    ("fire_station", None, "ambulance"),
    # Showroom — keyword search gives better precision than the loose
    # car_dealer / automobile_dealer types, which return tours, HVAC, etc.
    (None, "car showroom dealership", "showroom"),
    # Keyword queries for categories Google has no native type for
    (None, "tyre puncture repair", "tyre"),
    (None, "puncture wala tire shop", "tyre"),  # Indian colloquial — catches more local shops
    (
        None,
        "towing service crane recovery",
        "towing",
    ),  # broader match for recovery/wrecker services
]

TYPE_CATEGORY_MAP = {
    "hospital": "hospital",
    "doctor": "hospital",
    "police": "police",
    "car_repair": "repair",
    "fire_station": "ambulance",
    "tyre": "tyre",
    "towing": "towing",
    "showroom": "showroom",
}

# Types that are NEVER relevant for emergency services.  Google Places
# `rankby=distance` sometimes returns loosely matched businesses (e.g.
# a fashion boutique tagged as "car_repair" by the owner for SEO).
# If ANY of these types appear in a place's type list, discard the place.
# Name substrings (lowercased) that indicate a place is NOT a useful
# emergency contact — e.g. teleconsult kiosks, virtual clinics, corporate
# offices that Google mis-categorises as hospitals/dealerships.
JUNK_NAME_PATTERNS: list[str] = [
    "tele-consult",
    "teleconsult",
    "telemedicine",
    "online consult",
    "virtual clinic",
    "24|7 doctor",
    "24/7 doctor",
    "pathology",
    "diagnostic",
    "lab ",
    " lab",
    "pharmacy",
    "chemist",
    "medical store",
    "medplus",
    "med plus",
    "apollo pharmacy",
    "netmeds",
    "1mg",
]


def _is_junk_name(name: str) -> bool:
    """Return True if the place name indicates it's not useful for emergencies."""
    low = name.lower()
    return any(pat in low for pat in JUNK_NAME_PATTERNS)


IRRELEVANT_TYPES: set[str] = {
    "clothing_store",
    "shoe_store",
    "jewelry_store",
    "beauty_salon",
    "hair_care",
    "spa",
    "gym",
    "night_club",
    "bar",
    "cafe",
    "bakery",
    "restaurant",
    "food",
    "meal_delivery",
    "meal_takeaway",
    "liquor_store",
    "supermarket",
    "grocery_or_supermarket",
    "convenience_store",
    "department_store",
    "shopping_mall",
    "furniture_store",
    "home_goods_store",
    "electronics_store",
    "book_store",
    "florist",
    "pet_store",
    "travel_agency",
    "real_estate_agency",
    "insurance_agency",
    "accounting",
    "lawyer",
    "laundry",
    "lodging",
    "movie_theater",
    "museum",
    "library",
    "church",
    "mosque",
    "hindu_temple",
    "synagogue",
    "cemetery",
    "funeral_home",
    "school",
    "university",
    "primary_school",
    "secondary_school",
    "amusement_park",
    "aquarium",
    "art_gallery",
    "bowling_alley",
    "casino",
    "zoo",
    "stadium",
    "park",
}


def _is_irrelevant(types: list[str]) -> bool:
    """Return True if the place's types indicate it's clearly not emergency-related."""
    return bool(IRRELEVANT_TYPES.intersection(types))


def map_google_types(types: list[str]) -> str | None:
    for t in types:
        if t in TYPE_CATEGORY_MAP:
            return TYPE_CATEGORY_MAP[t]
    return None


async def _get_place_details(
    client: httpx.AsyncClient, place_id: str, api_key: str, region: str | None
) -> dict:
    try:
        resp = await client.get(
            DETAILS_URL,
            params={
                "place_id": place_id,
                "fields": "formatted_phone_number,opening_hours",
                "key": api_key,
            },
            timeout=10.0,
        )
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
    region: str | None,
) -> str | None:
    """Find a phone number for an existing contact by name + location.

    Strategy:
    1. Find Place from Text (fast, name-based) — works when OSM name matches Google
    2. Nearby Search in 100 m radius (coordinate-based) — fallback for OSM typos
       e.g. "gs sustom" won't match "GS Custom" by text, but they share coordinates
    """
    # ── Step 1: name-based lookup ────────────────────────────────────────
    # Transliterate non-Latin names (Devanagari, Bengali, etc.) to Latin for Google lookup
    lookup_name = unidecode(name) if name else ""
    try:
        resp = await client.get(
            FINDPLACE_URL,
            params={
                "input": lookup_name,
                "inputtype": "textquery",
                "locationbias": f"circle:500@{lat},{lon}",
                "fields": "place_id",
                "key": api_key,
            },
            timeout=8.0,
        )
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
        resp = await client.get(
            NEARBY_URL,
            params={
                "location": f"{lat},{lon}",
                "radius": 100,  # 100 m — very tight, same building
                "key": api_key,
            },
            timeout=8.0,
        )
        places = resp.json().get("results", [])
        for place in places:
            place_id = place.get("place_id")
            if place_id:
                details = await _get_place_details(client, place_id, api_key, region)
                if details.get("phone"):
                    return details["phone"]
    except Exception:
        pass

    return None


async def enrich_missing_phones(
    contacts: list[dict],
    region: str | None,
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
    # PARALLEL via asyncio.gather — was sequential, causing 6 × 15 s = 90 s
    # in the worst case (real measurement: Jonai/Assam took 122 s end-to-end).
    # Running concurrently caps the wall-clock at ~15 s regardless of count.
    async with httpx.AsyncClient(timeout=15.0) as client:
        results = await asyncio.gather(
            *[
                enrich_phone_for_contact(
                    client,
                    c["name"],
                    c.get("lat", 0),
                    c.get("lon", 0),
                    api_key,
                    region,
                )
                for c in needs_phone
            ],
            return_exceptions=True,
        )
    enriched_count = 0
    for c, phone in zip(needs_phone, results, strict=False):
        # gather() can return an Exception per task when return_exceptions=True;
        # treat exceptions as "no phone found" and move on.
        if isinstance(phone, BaseException):
            logger.warning("Phone enrichment for %s failed: %s", c.get("name"), phone)
            continue
        if phone:
            c["phone"] = phone
            enriched_count += 1
    logger.info(f"Phone enrichment: {enriched_count}/{len(needs_phone)} found")
    return contacts


async def search_nearby_places(
    lat: float, lon: float, radius: int = 5000, region: str | None = None
) -> list[dict]:
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
        # ─── PARALLEL Nearby Search across all SEARCH_TYPES ─────────────
        # Previously sequential: 4 categories × 5-10 s = 20-40 s.
        # Now ~5-10 s total (slowest category bounds the wall clock).
        async def _nearby(place_type: str | None, keyword: str | None) -> list[dict]:
            try:
                params = {
                    "location": f"{lat},{lon}",
                    "key": api_key,
                    "language": "en",
                }
                # Use rankby=distance for accuracy: returns nearest results first, not
                # prominence-ranked. Mutually exclusive with radius.
                params["rankby"] = "distance"

                if place_type:
                    params["type"] = place_type
                if keyword:
                    params["keyword"] = keyword
                resp = await client.get(NEARBY_URL, params=params)
                return resp.json().get("results", [])[:20]
            except Exception as exc:
                query_label = place_type or keyword or "unknown"
                logger.warning(f"Google Places nearby query failed for {query_label}: {exc}")
                return []

        nearby_results = await asyncio.gather(
            *[_nearby(place_type, keyword) for place_type, keyword, _ in SEARCH_QUERIES],
            return_exceptions=False,
        )

        # ─── Collect unique places we still need to enrich with Details ─
        places_to_enrich: list[dict] = []
        for (_, _, fallback_category), places in zip(SEARCH_QUERIES, nearby_results, strict=False):
            for place in places:
                place_id = place.get("place_id", "")
                if not place_id or place_id in seen_ids:
                    continue
                place_types = place.get("types", [])
                # Skip businesses that are obviously irrelevant (fashion
                # stores, restaurants, etc.) — Google's loose matching
                # sometimes returns them for car_repair or keyword queries.
                if _is_irrelevant(place_types):
                    logger.debug(
                        "Skipping irrelevant place: %s (types: %s)", place.get("name"), place_types
                    )
                    continue
                place_name = place.get("name", "")
                if _is_junk_name(place_name):
                    logger.debug("Skipping junk-name place: %s", place_name)
                    continue
                category = map_google_types(place_types) or fallback_category
                if not category:
                    continue
                seen_ids.add(place_id)
                places_to_enrich.append(
                    {"place": place, "category": category, "place_id": place_id}
                )

        # ─── PARALLEL Place Details lookups ─────────────────────────────
        # Was up to 20 sequential awaits × 5-10 s each = 100-200 s.
        # Now ~5-10 s total.
        details_list = await asyncio.gather(
            *[
                _get_place_details(client, item["place_id"], api_key, region)
                for item in places_to_enrich
            ],
            return_exceptions=True,
        )

        for item, details in zip(places_to_enrich, details_list, strict=False):
            if isinstance(details, BaseException):
                logger.warning("Place Details failed for %s: %s", item["place_id"], details)
                details = {"phone": None, "isOpen": None}
            place = item["place"]
            loc = place["geometry"]["location"]
            results.append(
                {
                    "id": f"gp_{item['place_id']}",
                    "name": place.get("name", "Unknown"),
                    "category": item["category"],
                    "phone": details["phone"],
                    "distance": round(haversine(lat, lon, loc["lat"], loc["lng"]), 2),
                    "lat": loc["lat"],
                    "lon": loc["lng"],
                    "source": "Google Places",
                    "isOpen": details["isOpen"],
                    "aiReason": None,
                }
            )

    sorted_results = sorted(results, key=lambda x: x["distance"])
    await google_cache.set(cache_key, sorted_results)
    logger.info(f"Google Places fetched · {cache_key} · {len(sorted_results)} contacts")
    return sorted_results
