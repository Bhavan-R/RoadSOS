import httpx
import math
import os
from typing import Optional

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


async def get_place_details(client: httpx.AsyncClient, place_id: str, api_key: str) -> dict:
    resp = await client.get(DETAILS_URL, params={
        "place_id": place_id,
        "fields": "formatted_phone_number,opening_hours",
        "key": api_key,
    }, timeout=10.0)
    result = resp.json().get("result", {})
    return {
        "phone": result.get("formatted_phone_number"),
        "isOpen": result.get("opening_hours", {}).get("open_now"),
    }


async def search_nearby_places(lat: float, lon: float, radius: int = 5000) -> list[dict]:
    api_key = os.getenv("GOOGLE_PLACES_API_KEY", "")
    if not api_key:
        return []

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
            except Exception:
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
                try:
                    details = await get_place_details(client, place_id, api_key)
                except Exception:
                    details = {"phone": None, "isOpen": None}

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

    return sorted(results, key=lambda x: x["distance"])
