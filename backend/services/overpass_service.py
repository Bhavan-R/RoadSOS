import httpx
import math
from typing import Optional

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

CATEGORY_MAP = [
    (("amenity", "hospital"), "hospital"),
    (("amenity", "clinic"), "hospital"),
    (("amenity", "doctors"), "hospital"),
    (("healthcare", "hospital"), "hospital"),
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
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def classify_element(tags: dict) -> Optional[str]:
    for (key, val), cat in CATEGORY_MAP:
        if tags.get(key) == val:
            return cat
    return None


def build_overpass_query(lat: float, lon: float, radius: int) -> str:
    r = radius
    c = f"{lat},{lon}"
    return f"""[out:json][timeout:25];
(
  node["amenity"="hospital"](around:{r},{c});
  way["amenity"="hospital"](around:{r},{c});
  node["amenity"="clinic"](around:{r},{c});
  node["amenity"="doctors"](around:{r},{c});
  node["healthcare"="hospital"](around:{r},{c});
  node["amenity"="police"](around:{r},{c});
  way["amenity"="police"](around:{r},{c});
  node["emergency"="ambulance_station"](around:{r},{c});
  node["amenity"="ambulance_station"](around:{r},{c});
  node["amenity"="fire_station"](around:{r},{c});
  node["shop"="car_repair"](around:{r},{c});
  node["amenity"="car_repair"](around:{r},{c});
  node["shop"="tyres"](around:{r},{c});
);
out body center;
>;
out skel qt;"""


def parse_element(element: dict, user_lat: float, user_lon: float) -> Optional[dict]:
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
    phone = (
        tags.get("phone")
        or tags.get("contact:phone")
        or tags.get("telephone")
        or tags.get("emergency:phone")
    )

    return {
        "id": f"osm_{element['id']}",
        "name": name,
        "category": category,
        "phone": phone,
        "distance": round(haversine(user_lat, user_lon, lat, lon), 2),
        "lat": lat,
        "lon": lon,
        "source": "OpenStreetMap",
        "isOpen": None,
        "aiReason": None,
    }


async def build_and_fetch_query(lat: float, lon: float, radius: int = 5000) -> list[dict]:
    query = build_overpass_query(lat, lon, radius)
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(OVERPASS_URL, data={"data": query})
        resp.raise_for_status()
        data = resp.json()

    results: list[dict] = []
    seen_names: set[str] = set()

    for element in data.get("elements", []):
        parsed = parse_element(element, lat, lon)
        if parsed is None:
            continue
        name_key = parsed["name"].lower().strip()
        if name_key in seen_names:
            continue
        seen_names.add(name_key)
        results.append(parsed)

    return sorted(results, key=lambda x: x["distance"])
