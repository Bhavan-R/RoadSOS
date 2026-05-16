# RoadSOS — Structured Database Documentation

**Submission artifact for Section 7.1 of the IIT Madras Road Safety Hackathon 2026 rulebook:**
> *"Structured database used for the models are to be submitted."*

This document describes every persistent data structure used by RoadSOS, its schema, its source, and how it is consumed by the runtime.

---

## 1. Emergency Numbers Database

**Authoritative source:** `backend/data/emergency_seed.json`
**Frontend bundle (generated):** `frontend/src/utils/emergencyNumbers.js`
**Endpoint exposing it:** `GET /offline-pack`

### 1.1 Coverage

| Metric | Value |
|---|---|
| Total countries | **196** |
| UN-recognised states covered | 100% |
| Asia | 49 |
| Europe | 50 |
| Africa | 54 |
| Americas | 35 |
| Oceania | 14 |
| File size (raw JSON) | ~28 KB |
| File size (gzipped) | ~9 KB |

### 1.2 Schema

```json
{
  "country":       "string  — Human-readable English country name",
  "country_code":  "string  — ISO 3166-1 alpha-2 code, uppercase",
  "calling_code":  "string  — International dialling prefix incl. '+'",
  "police":        "string  — National police emergency number",
  "ambulance":     "string  — National ambulance / medical emergency number",
  "fire":          "string  — National fire department emergency number",
  "general":       "string  — Universal emergency number (often 112 / 911)"
}
```

### 1.3 Example record

```json
{
  "country": "India",
  "country_code": "IN",
  "calling_code": "+91",
  "police": "100",
  "ambulance": "108",
  "fire": "101",
  "general": "112"
}
```

### 1.4 Data sourcing & verification

Primary source: **Wikipedia "List of emergency telephone numbers"** (canonical, government-maintained). Each entry was cross-checked against:
1. The country's official government emergency services portal where available
2. ITU-T E.164 numbering plan documentation
3. EU-wide 112 standard for European jurisdictions

Where a country uses different numbers for different services, the most-publicised national number is recorded. For countries where 112 is universally accepted as a fallback (e.g. all GSM networks), `general` is set to `112`.

### 1.5 Update policy

Static. Emergency numbers change roughly once per decade. Changes are made by editing `backend/data/emergency_seed.json` and regenerating the frontend bundle:

```bash
# Regenerate frontend/src/utils/emergencyNumbers.js from backend JSON
python scripts/sync_emergency_numbers.py
```

---

## 2. OSM Category Classification Map

**Source:** `backend/services/overpass_service.py` → `CATEGORY_MAP`
**Purpose:** Maps OpenStreetMap tag (key, value) pairs to the six visible RoadSOS contact categories.

### 2.1 Schema

```python
CATEGORY_MAP: list[tuple[tuple[str, str], str]]
# [ ((osm_key, osm_value), roadsos_category), ... ]
```

### 2.2 Full mapping

| OSM Key | OSM Value | RoadSOS Category | Notes |
|---|---|---|---|
| `amenity` | `hospital` | `hospital` | Tagged hospitals |
| `amenity` | `clinic` | `hospital` | Polyclinics, walk-in clinics |
| `amenity` | `doctors` | `hospital` | General practitioner offices |
| `healthcare` | `hospital` | `hospital` | Healthcare-namespace hospitals |
| `healthcare` | `clinic` | `hospital` | Healthcare-namespace clinics |
| `amenity` | `police` | `police` | Police stations |
| `emergency` | `ambulance_station` | `ambulance` | Dedicated ambulance bases |
| `amenity` | `ambulance_station` | `ambulance` | Alternate tagging |
| `amenity` | `fire_station` | `ambulance` | Fire stations (often run ambulances) |
| `service:vehicle:recovery` | `yes` | `towing` | Vehicle recovery / breakdown |
| `service:vehicle:tow` | `yes` | `towing` | Tow truck services |
| `amenity` | `vehicle_recovery` | `towing` | Dedicated recovery yards |
| `shop` | `car_repair` | `repair` | Mechanic / garage |
| `amenity` | `car_repair` | `repair` | Alternate tagging |
| `shop` | `tyres` | `tyre` | Tyre / puncture shops |
| `shop` | `tyre` | `tyre` | Alternate spelling |
| `shop` | `car` | `showroom` | Car dealerships / showrooms |
| `shop` | `car_parts` | `showroom` | Auto parts dealers |

### 2.3 Category alignment with rulebook

The rulebook (Section 1.3.3 "Key Aspects for Coders to Include") explicitly lists:
- Nearest **Police Station** → `police` category
- **Hospitals** → `hospital` category
- **Ambulance services** → `ambulance` category
- **Towing services** → `towing` category ✅
- **Nearest puncture shops** → `tyre` category ✅
- **Showrooms** → `showroom` category ✅

All six rulebook-mandated categories are covered.

---

## 3. Search Result Contact Object

**Source:** `backend/services/overpass_service.py` → `parse_element()`
**Returned by:** `GET /search`, `POST /triage`, cached in `localStorage`

### 3.1 Schema

```json
{
  "id":         "string  — Stable unique ID, format 'osm_{id}' or 'gp_{place_id}'",
  "name":       "string  — Establishment name (English preferred, falls back to local)",
  "category":   "enum    — hospital | police | ambulance | towing | repair | tyre | showroom",
  "phone":      "string|null — E.164-normalised phone, or basic-cleaned fallback",
  "distance":   "float   — Great-circle distance from user in kilometres, 2-decimal",
  "lat":        "float   — Latitude of establishment, WGS84",
  "lon":        "float   — Longitude of establishment, WGS84",
  "source":     "string  — 'OpenStreetMap' or 'Google Places'",
  "isOpen":     "boolean|null — Parsed from opening_hours; null if unparseable",
  "aiReason":   "string|null  — Set after /triage if AI prioritised this contact"
}
```

---

## 4. Triage Request/Response

**Endpoint:** `POST /triage`
**Source:** `backend/services/ai_triage.py`

### 4.1 Request schema

```json
{
  "injured":  "boolean — Are there injured persons on scene?",
  "blocking": "boolean — Is the vehicle blocking traffic?",
  "contacts": "Contact[] — Array of contact objects from /search"
}
```

### 4.2 Response schema

```json
{
  "contacts": "Contact[] — Same contacts, AI-reordered, top one has aiReason set",
  "reason":   "string — One-line explanation of the prioritisation"
}
```

### 4.3 Priority matrix (rule-based fallback)

| `injured` | `blocking` | Top priority order |
|---|---|---|
| true | true | ambulance → hospital → police → towing → repair → tyre → showroom |
| true | false | ambulance → hospital → police → towing → repair → tyre → showroom |
| false | true | police → towing → repair → ambulance → hospital → tyre → showroom |
| false | false | repair → tyre → towing → showroom → police → ambulance → hospital |

Within each tier, contacts are sorted by ascending distance.

---

## 5. Dispatch Summary Request

**Endpoint:** `POST /dispatch-summary`
**Source:** `backend/services/dispatch_service.py`

### 5.1 Request schema

```json
{
  "lat":      "float — Latitude, WGS84",
  "lon":      "float — Longitude, WGS84",
  "landmark": "string|null — Reverse-geocoded landmark text",
  "injured":  "boolean — Injured persons present",
  "blocking": "boolean — Vehicle blocking traffic"
}
```

### 5.2 Response schema

```json
{
  "summary": "string — Human-readable dispatch text, ready to read aloud or paste",
  "source":  "enum   — 'ai' (Gemini-generated) or 'template' (rule-based fallback)"
}
```

---

## 6. Health Check Response

**Endpoint:** `GET /health`
**Source:** `backend/services/health_service.py`

### 6.1 Schema

```json
{
  "status":         "string — 'ok' when service is up",
  "uptime_seconds": "integer — Seconds since process start",
  "configured": {
    "gemini":        "boolean — Gemini API key present",
    "google_places": "boolean — Google Places API key present"
  },
  "cache": {
    "overpass": { "size": "int", "hits": "int", "misses": "int", "hit_rate": "float" },
    "google":   { "size": "int", "hits": "int", "misses": "int", "hit_rate": "float" },
    "geocode":  { "size": "int", "hits": "int", "misses": "int", "hit_rate": "float" }
  }
}
```

---

## 7. In-Memory TTL Cache

**Source:** `backend/services/cache.py` → `TTLCache`
**Not persisted to disk** — rebuilt on each process start.

### 7.1 Instances

| Cache | TTL | Max Entries | Cached payload |
|---|---|---|---|
| `overpass_cache` | 3600 s (1 hour) | 200 | List of contact objects per (lat, lon, radius) |
| `google_cache` | 3600 s (1 hour) | 200 | List of contact objects per (lat, lon, radius) |
| `geocode_cache` | 86400 s (24 hours) | 500 | `{landmark, country_code}` per (lat, lon) |

### 7.2 Cache key format

```
{lat:.4f}_{lon:.4f}_{suffix}
```

Coordinates are rounded to 4 decimal places (~11 m grid) so sub-meter GPS jitter does not cause cache misses.

---

## 8. Frontend Local Cache (offlineDB.js)

**Source:** `frontend/src/utils/offlineDB.js`
**Storage:** `localStorage`
**Purpose:** Last-known-good results when the user is fully offline.

### 8.1 Schema (localStorage value, JSON-encoded)

```json
{
  "key":        "string — '{lat:.2f}_{lon:.2f}' (1km grid)",
  "contacts":   "Contact[]",
  "landmark":   "string|null",
  "countryCode":"string|null",
  "timestamp":  "integer — Unix milliseconds when cached"
}
```

### 8.2 TTL

24 hours. Older entries are returned with a "stale" indicator but not silently discarded — a stale cached contact is better than nothing in an emergency.

---

## 9. Service Worker Cache Strategy

**Source:** `frontend/public/sw.js` (Workbox)
**Storage:** Cache Storage API (managed by browser)

| Pattern | Strategy | Reason |
|---|---|---|
| `/search*` | NetworkFirst (5s timeout) | Fresh data preferred, cache is fallback |
| `/triage*` | NetworkFirst (5s timeout) | Same |
| `/offline-pack` | CacheFirst | Static seed; only updates with new deploys |
| `/static/*` | CacheFirst | App shell — versioned by Vite |

---

## 10. Summary — All persistent structures

| # | Artifact | Type | Size | Update cadence |
|---|---|---|---|---|
| 1 | Emergency numbers DB | Static JSON | 196 entries | ~once per decade |
| 2 | OSM category map | Source code | 18 mappings | When OSM tags evolve |
| 3 | Contact object | Runtime schema | Per query | Live |
| 4 | Triage I/O | Runtime schema | Per query | Live |
| 5 | Dispatch I/O | Runtime schema | Per query | Live |
| 6 | Health response | Runtime schema | Per ping | Live |
| 7 | Server TTL cache | In-memory | Up to 900 entries | Auto-evicting |
| 8 | Browser localStorage | Per device | 1 entry per area | 24h TTL |
| 9 | Service Worker cache | Per device | Up to 50 entries | NetworkFirst |

**RoadSOS does not store any user data on a server.** No accounts, no telemetry, no user identifiers. All user state is local to the device.
