from fastapi import APIRouter
from services.overpass_service import build_and_fetch_query
from services.googleplaces_service import search_nearby_places
from services.geocoder import reverse_geocode

search_router = APIRouter()


def deduplicate(contacts: list[dict]) -> list[dict]:
    seen_phones: set[str] = set()
    seen_names: set[str] = set()
    result: list[dict] = []
    for c in contacts:
        phone = (c.get("phone") or "").strip()
        name = c["name"].lower().strip()
        if phone and phone in seen_phones:
            continue
        if name in seen_names:
            continue
        if phone:
            seen_phones.add(phone)
        seen_names.add(name)
        result.append(c)
    return result


@search_router.get("/search")
async def search_facilities(lat: float, lon: float):
    contacts: list[dict] = []
    source = "OpenStreetMap"

    for radius in (5000, 10000):
        if len(contacts) >= 3:
            break
        try:
            contacts = await build_and_fetch_query(lat, lon, radius=radius)
        except Exception:
            pass

    if len(contacts) < 3:
        try:
            google = await search_nearby_places(lat, lon, radius=10000)
            if google:
                contacts = contacts + google
                source = "OpenStreetMap + Google Places"
        except Exception:
            pass

    contacts = deduplicate(contacts)
    contacts = sorted(contacts, key=lambda x: x["distance"])

    geo = await reverse_geocode(lat, lon)

    return {
        "contacts": contacts,
        "source": source,
        "landmark": geo["landmark"],
        "country_code": geo["country_code"],
        "count": len(contacts),
    }
