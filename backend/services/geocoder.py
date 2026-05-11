import httpx

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"


async def reverse_geocode(lat: float, lon: float) -> dict:
    """Returns dict with 'landmark' (human readable address) and 'country_code' (ISO 3166-1 alpha-2)."""
    headers = {"User-Agent": "RoadSOS/1.0 (hackathon@roadsos.dev)"}
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(NOMINATIM_URL, params={
                "lat": lat,
                "lon": lon,
                "format": "json",
                "zoom": 16,
            }, headers=headers)
            data = resp.json()
            addr = data.get("address", {})
            parts = [
                addr.get("road") or addr.get("pedestrian") or addr.get("path"),
                addr.get("suburb") or addr.get("neighbourhood") or addr.get("village"),
                addr.get("city") or addr.get("town") or addr.get("county"),
                addr.get("state"),
            ]
            landmark = ", ".join(p for p in parts if p) or data.get("display_name", f"{lat:.4f}, {lon:.4f}")
            country_code = (addr.get("country_code") or "").upper() or None
            return {"landmark": landmark, "country_code": country_code}
    except Exception:
        return {"landmark": f"{lat:.4f}°N, {lon:.4f}°E", "country_code": None}
