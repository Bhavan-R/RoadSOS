"""
Real-time SOS location tracking.

After SOS fires, the mobile app POSTs the victim's coordinates to POST /track
and receives a short token.  The resulting URL  GET /track/{token}  can be
pasted into a WhatsApp/SMS follow-up message — when a rescuer taps it they see
a live Leaflet map that auto-refreshes every 30 s.

Storage: in-memory dict — no database needed at hackathon scale.
TTL    : 2 hours from last update.
Cap    : 500 concurrent sessions; oldest evicted when full.
"""

import secrets
import time
from html import escape

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, Field

tracking_router = APIRouter()

# ─── Store ────────────────────────────────────────────────────────────────────

_TTL_SECONDS: int = 2 * 60 * 60      # 2 hours
_MAX_TOKENS:  int = 500
_store: dict[str, dict] = {}


def _prune() -> None:
    """Evict expired tokens (called before every write)."""
    now     = time.time()
    expired = [t for t, v in _store.items() if now - v["updated_at"] > _TTL_SECONDS]
    for t in expired:
        del _store[t]


def _evict_oldest() -> None:
    """Evict the oldest entry when the store is at capacity."""
    if len(_store) >= _MAX_TOKENS:
        oldest = min(_store, key=lambda t: _store[t]["created_at"])
        del _store[oldest]


# ─── Models ───────────────────────────────────────────────────────────────────

class TrackCreate(BaseModel):
    lat:      float           = Field(..., ge=-90,  le=90)
    lon:      float           = Field(..., ge=-180, le=180)
    landmark: str | None   = Field(None, max_length=200)


class TrackUpdate(BaseModel):
    lat:      float           = Field(..., ge=-90,  le=90)
    lon:      float           = Field(..., ge=-180, le=180)
    landmark: str | None   = Field(None, max_length=200)


# ─── Routes ───────────────────────────────────────────────────────────────────

@tracking_router.post(
    "/track",
    summary="Create a live-location tracking session",
    tags=["Tracking"],
)
def create_track(body: TrackCreate):
    """
    Called by the app immediately after SOS fires.
    Returns a URL-safe token (≈20 chars) valid for 2 hours.
    Share  GET /track/{token}  with emergency contacts.
    """
    _prune()
    _evict_oldest()
    token = secrets.token_urlsafe(15)   # 20 base64url chars
    now   = time.time()
    _store[token] = {
        "lat"       : body.lat,
        "lon"       : body.lon,
        "landmark"  : body.landmark or "",
        "created_at": now,
        "updated_at": now,
    }
    return {"token": token, "expires_in": _TTL_SECONDS}


@tracking_router.patch(
    "/track/{token}",
    summary="Push an updated position to an existing session",
    tags=["Tracking"],
)
def update_track(token: str, body: TrackUpdate):
    """Push a fresh GPS fix for an existing token."""
    entry = _store.get(token)
    if not entry:
        raise HTTPException(status_code=404, detail="Token not found or expired")
    entry["lat"]        = body.lat
    entry["lon"]        = body.lon
    entry["landmark"]   = body.landmark or entry["landmark"]
    entry["updated_at"] = time.time()
    return {"ok": True}


@tracking_router.get(
    "/track/{token}",
    summary="Live-location map for an active tracking session",
    tags=["Tracking"],
)
def view_track(token: str, fmt: str = "html"):
    """
    Open this URL in any browser to see the victim's last-known position
    on an interactive map.  The page auto-refreshes every 30 s.

    Pass  ?fmt=json  to get raw coordinates instead of the HTML page.
    """
    entry = _store.get(token)
    if not entry:
        raise HTTPException(status_code=404, detail="Token not found or expired")
    if time.time() - entry["updated_at"] > _TTL_SECONDS:
        del _store[token]
        raise HTTPException(status_code=410, detail="Tracking session expired (2 h TTL)")

    lat      = entry["lat"]
    lon      = entry["lon"]
    age_s    = int(time.time() - entry["updated_at"])
    landmark = entry["landmark"]

    if fmt == "json":
        return JSONResponse({
            "lat"     : lat,
            "lon"     : lon,
            "landmark": landmark,
            "age_s"   : age_s,
        })

    # ── Build the HTML page ────────────────────────────────────────────────
    safe_landmark = escape(landmark or "Unknown location")
    gmaps_url     = f"https://maps.google.com/?q={lat},{lon}"

    # NOTE: All literal JS braces are doubled ({{ }}) so Python's f-string
    # leaves them as single braces in the output.
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="30">
<title>\U0001f198 RoadSOS — Live Location</title>
<link rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      crossorigin=""/>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;
     color:#f1f5f9;min-height:100vh;display:flex;flex-direction:column}}
#map{{flex:1;min-height:58vh}}
.bar{{padding:14px 16px;background:#1e293b;border-top:2px solid #ef444455}}
.bar h1{{font-size:1rem;font-weight:700;color:#ef4444;margin-bottom:6px;
        display:flex;align-items:center;gap:8px}}
.live{{display:inline-block;padding:2px 8px;border-radius:99px;font-size:.7rem;
      font-weight:700;background:#22c55e22;color:#22c55e;letter-spacing:.04em}}
.bar p{{font-size:.82rem;color:#94a3b8;margin:3px 0}}
.bar a{{display:inline-block;margin-top:10px;padding:10px 22px;
       background:#ef4444;color:#fff;border-radius:8px;
       text-decoration:none;font-weight:600;font-size:.88rem}}
</style>
</head>
<body>
<div id="map"></div>
<div class="bar">
  <h1>\U0001f198 RoadSOS &mdash; Emergency Location
    <span class="live">LIVE</span>
  </h1>
  <p><strong>{safe_landmark}</strong></p>
  <p>{lat:.5f}&deg;, {lon:.5f}&deg; &nbsp;&middot;&nbsp; Updated {age_s}s ago</p>
  <p style="font-size:.73rem;color:#64748b;margin-top:4px">
    Page auto-refreshes every 30 seconds
  </p>
  <a href="{gmaps_url}" target="_blank" rel="noopener noreferrer">
    \U0001f4cd Open in Google Maps
  </a>
</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        crossorigin=""></script>
<script>
(function(){{
  var map = L.map('map').setView([{lat},{lon}], 16);
  L.tileLayer(
    'https://{{s}}.basemaps.cartocdn.com/dark_all/{{z}}/{{x}}/{{y}}{{r}}.png',
    {{
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com">CARTO</a>',
      subdomains : 'abcd',
      maxZoom    : 20
    }}
  ).addTo(map);

  var icon = L.divIcon({{
    className: '',
    html: '<div style="width:22px;height:22px;border-radius:50%;'
        + 'background:#ef4444;border:3px solid #fff;'
        + 'box-shadow:0 0 0 8px #ef444433;"></div>',
    iconSize  : [22, 22],
    iconAnchor: [11, 11]
  }});

  L.marker([{lat},{lon}], {{icon:icon}})
   .addTo(map)
   .bindPopup('<b>{safe_landmark}</b><br>{lat:.5f}, {lon:.5f}')
   .openPopup();
}})();
</script>
</body>
</html>"""

    return HTMLResponse(content=html)
