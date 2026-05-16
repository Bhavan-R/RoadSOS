<div align="center">

# 🚨 RoadSOS

### **The right emergency contact, in one tap, even with no signal.**

*A location-aware Progressive Web App that connects road accident victims and bystanders to the right help in under 10 seconds — globally, offline, and intelligently.*

---

[![Status](https://img.shields.io/badge/Status-Hackathon%20Build-c0392b?style=for-the-badge)](https://coers.iitm.ac.in/events/Hackathon/2026/rule_book/)
[![Hackathon](https://img.shields.io/badge/IIT%20Madras-Road%20Safety%202026-1a1f2e?style=for-the-badge)](https://coers.iitm.ac.in/)
[![PWA](https://img.shields.io/badge/PWA-Installable-5a0fc8?style=for-the-badge&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Offline](https://img.shields.io/badge/Works-Offline-27ae60?style=for-the-badge&logo=serviceworker&logoColor=white)](#-offline-architecture)

[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Gemini](https://img.shields.io/badge/Google-Gemini%202.0%20Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev/gemini-api)
[![OSM](https://img.shields.io/badge/Data-OpenStreetMap-7EBC6F?logo=openstreetmap&logoColor=white)](https://www.openstreetmap.org/)

[![Backend Tests](https://github.com/Arthrevs/Roadproj/actions/workflows/backend-tests.yml/badge.svg)](https://github.com/Arthrevs/Roadproj/actions/workflows/backend-tests.yml)
[![Countries](https://img.shields.io/badge/Coverage-196%20Countries-3498db?style=flat-square)](#-international-coverage)
[![Categories](https://img.shields.io/badge/Service%20Types-8-9b59b6?style=flat-square)](#-features)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

**[🎯 Problem](#-the-problem) · [⚡ Features](#-features) · [🏗 Architecture](#-architecture) · [🚀 Quick Start](#-quick-start) · [🎤 Walkthrough](#-three-minute-walkthrough) · [📊 Capabilities](#-capabilities-summary) · [🗺 Roadmap](#-roadmap) · [📘 Docs](docs/)**

</div>

---

## 🎯 The Problem

> India records **1.5 lakh road accident deaths every year.** Most are not killed by the crash itself — they are killed by **delay**.

Medical professionals call the first sixty minutes after a severe injury *the golden hour*. Survival rates collapse once that window closes. Yet at a real crash scene on NH-37 or NH-48, a bystander does this:

1. Opens Google Maps
2. Searches "hospital near me"
3. Scrolls through generic results
4. Tries to identify which one has a trauma unit
5. Searches separately for the phone number
6. Repeats for police, ambulance, towing

**Two to three minutes lost. Minutes that decide outcomes.**

Emergency services exist. The problem is that nobody can find them quickly enough at the moment they need to be found.

**RoadSOS solves this.** One app. One list of verified contacts. Sorted by what *this specific situation* needs. Working with or without internet. In one tap.

---

## ⚡ Features

<table>
<tr>
<td width="50%">

### 📍 Location-Aware, Instantly
GPS detection with **10-second timeout** and automatic fallback to IP-based geolocation. The search starts the moment the app opens — no buttons to press, no menus to navigate.

</td>
<td width="50%">

### 🤖 AI-Prioritised Contacts
Two simple questions — *injured? blocking traffic?* — and an LLM reorders the entire contact list for your specific situation. The top card explicitly states **why** it was prioritised.

</td>
</tr>
<tr>
<td>

### 📶 Genuinely Offline (4-tier)
Service Worker + localStorage (24h TTL, ~1.1km grid) + **bundled 249-facility directory across all 196 countries** + bundled 196-country national emergency numbers. Pre-fetch hospitals along Chennai→Bengaluru before you leave, then crash anywhere on NH-44 — the right number is still there.

### 🆔 Emergency Medical ID
Stores blood type, allergies, conditions, medications, and an emergency contact entirely on-device (localStorage — **nothing ever leaves the phone**). A first responder arriving at a crash scene can tap the persistent **🆔 Medical ID** button on the home screen to see this in a high-contrast paramedic-friendly card.

### 📍 Plus Codes (Open Location Code)
Every crash alert encodes the GPS into a **dispatcher-friendly Plus Code** like `7M5CC9R6+VV` — recognized by Indian 112 ERSS, far easier to communicate by voice than `13.0827, 80.2707`. Encoder is hand-written in pure JS (~80 LOC, **fully offline, zero deps**) — the algorithm lives in `frontend/src/utils/plusCodes.js`.

### 📱 SOS-by-SMS
When voice fails but SMS still works (very common in cellular dead zones), the crash alert shows a one-tap **SOS-by-SMS** button that pre-composes a message to your emergency contact containing: blood type, allergies, Plus Code, GPS coordinates, and a tap-to-open Google Maps link. Uses the native `sms:` URL scheme — works on iOS and Android.

</td>
<td>

### 🌍 Globally Aware
Reverse-geocode-based country detection. Drive across the India–Nepal border and the emergency numbers switch from `108/100/101` to `102/100/101` automatically.

### 🌐 43 Languages, 6 RTL
All 22 official Indian languages (Schedule VIII) plus 21 global languages covering every UN region. RTL layout for Arabic, Persian, Hebrew, Urdu, Kashmiri, and Sindhi. First-launch picker requires manual selection — no surveillance-style auto-detection from GPS.

### 🗺 Real GPS-Anchored Map
Leaflet + OpenStreetMap (CartoDB Dark Matter tiles, no API key, free). Your actual surroundings — not a stock illustration. Up to six nearest contacts pinned at their real lat/lon with category-coloured markers (red = medical, blue = police, teal = mechanical).

</td>
</tr>
<tr>
<td>

### 🚨 SOS Broadcast
One tap composes a pre-filled WhatsApp message: GPS coordinates, nearest landmark, and the recommended contact. SMS fallback if WhatsApp is unavailable. Copy-coordinates button for verbal handoff.

</td>
<td>

### 🛡 GPS Velocity Crash Detection
Detects a collapse from highway speed (>25 km/h) to standstill (<5 km/h) within two seconds. **PIN-cancel** safety layer prevents accidental dismissal by an unconscious hand on a screen.

</td>
</tr>
</table>

---

## 🥊 How We're Different

| Scenario | Google Maps | Calling 112 | **RoadSOS** |
|---|---|---|---|
| Time to first emergency contact | 2–3 minutes (search + scroll + read) | 1 ring + dispatcher routing | **< 5 seconds** |
| Works without internet | ❌ | ✅ (voice only) | ✅ **(visual list + cached results)** |
| Surfaces trauma units specifically | ❌ (lists all hospitals) | Indirect (dispatcher decides) | ✅ **(category-tagged)** |
| Prioritises by injury / traffic context | ❌ | Manual via dispatcher | ✅ **(AI triage)** |
| Works internationally without re-learning | Partial | Numbers change per country | ✅ **(196 countries pre-loaded)** |
| Broadcasts location to a contact | Manual | Voice only | ✅ **(WhatsApp deep link)** |

> RoadSOS does not replace 112. It runs **in parallel** with it. Call 112 while a bystander uses RoadSOS to alert the specific trauma centre directly. **Parallel response saves minutes.**

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER (Browser / PWA)                        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌──────────────┐      ┌──────────────┐      ┌────────────────┐
│ useLocation  │      │  Service     │      │ Bundled Static │
│              │      │  Worker      │      │ Emergency DB   │
│ GPS → IP fb  │      │              │      │                │
│ velocity     │      │ NetworkFirst │      │ 196 countries   │
│ tracking     │      │ + CacheFirst │      │ always offline │
└──────┬───────┘      └──────┬───────┘      └────────────────┘
       │                     │
       ▼                     │
┌──────────────────────────────────────────────────────────────┐
│                    FastAPI Backend (Render)                   │
├──────────────────────────────────────────────────────────────┤
│  In-memory TTL Cache  (3600s Overpass · 3600s Google · 24h geocode) │
│                                                               │
│  GET /search                                                  │
│   ├─ Overpass (OSM) + Google Places ── fired in PARALLEL     │
│   │   ├─ Overpass: 5km, auto-expand to 10km                   │
│   │   └─ Google: only if OSM yields < 3 phoned contacts       │
│   ├─ Nominatim geocode  ──── runs in parallel · landmark+ISO │
│   ├─ Merge + deduplicate ─── by phone digits, then name      │
│   └─ Phone enrichment   ──── top-6 phoneless via Place Details │
│                                                               │
│  POST /triage                                                 │
│   ├─ Google Gemini 2.0 Flash    ─── situation-aware sort    │
│   └─ Rule-based fallback         ─── if API down             │
│                                                               │
│  POST /dispatch-summary                                       │
│   ├─ Gemini Flash  ─── human-readable accident description    │
│   └─ Template fallback ── if API unavailable                  │
│                                                               │
│  GET /health                                                  │
│   └─ Uptime · API key status · cache hit-rate stats           │
│                                                               │
│  GET /offline-pack                                            │
│   └─ Serves 196-country emergency numbers JSON                 │
└──────────────────────────────────────────────────────────────┘
```

### 🔄 Request Flow (Happy Path)

```
1. App opens
   └─► useLocation starts GPS watch + 10s timeout

2. Location detected
   └─► GET /search?lat=X&lon=Y
       └─► Backend fires OSM Overpass + reverse geocode IN PARALLEL
       └─► If OSM yields < 3 phoned contacts, also fires Google Places
       └─► Merges, dedupes by phone digits, sorts by distance
       └─► Returns: contacts[], landmark, country_code, source

3. App caches results to localStorage (24hr TTL)
   App renders CountryEmergency banner (country-specific numbers)

4. TriageModal asks: injured? blocking?
   └─► POST /triage with answers + contacts
       └─► Gemini reorders, returns one-line reason
       └─► If API fails: rule-based fallback produces same shape

5. ContactList renders with AI reason banner on top card
   SOSButton ready with pre-filled WhatsApp message
```

### 🔌 Offline Architecture (4-Tier Fallback)

```
ONLINE                                    OFFLINE
──────                                    ───────
GET /search ─────► Service Worker         Tier 1: Backend /search
                   │                              └─ unreachable
                   ├─ Cache (NetworkFirst,
                   │  8s timeout, 24h TTL)  Tier 2: Service Worker
                   │                              + localStorage cache
                   └─ Forward to backend          (24h TTL, ~1.1km grid)
                                                  └─ no entry for this grid

                                          Tier 3: Bundled JSON
                                                  (249 facilities across
                                                  196 countries, haversine
                                                  search, 80km → 600km
                                                  radius expansion)

                                          Always: CountryEmergency banner
                                                  (national numbers,
                                                  no network ever)
```

---

## 🧰 Tech Stack

<div align="center">

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | React 18.3 + Vite 8 + vite-plugin-pwa 1.3 | Fast HMR, native PWA support, mobile-first |
| **Map** | Leaflet 1.9 + react-leaflet 4.2 + CartoDB Dark tiles | Real OSM map, no API key, dark theme matches UI |
| **i18n** | i18next 26 + react-i18next 17 | 43 languages, RTL support, browser-detect fallback |
| **Backend** | FastAPI 0.115 + httpx 0.27 (async) | Async I/O for parallel upstream calls, type-safe |
| **AI Triage** | Google Gemini 2.0 Flash (REST, no SDK) | Free tier — 60 RPM / 1500 RPD, no billing required; deterministic rule-based fallback |
| **Location Data** | OpenStreetMap Overpass + Google Places | OSM is free + global; Places fills sparse regions and enriches phones |
| **Geocoding** | Nominatim (OSM) | Free, no API key, returns ISO-3166 country code |
| **Offline Cache** | Workbox 7 SW + localStorage + bundled JSON | 4-tier: network → cache → bundled facilities → mock |
| **Lint** | ruff 0.11 (backend), Vitest (frontend tests) | Single fast tool for E/W/F/I/UP/B/C4/SIM rules |
| **CI** | GitHub Actions × 3 workflows | Build/test on Node 20+22, pytest on Py 3.11+3.12, PR conflict detection |
| **Hosting** | Vercel (frontend) + Render (backend) | Free tier; auto-deploy from `main` |

</div>

---

## 📦 Project Structure

```
Roadproj/
├── backend/                          # FastAPI service
│   ├── main.py                       # App entry, middleware stack, CORS
│   ├── middleware.py                 # RequestID, RequestLog, ErrorHandling
│   ├── logging_config.py             # log format + library noise suppression
│   ├── requirements.txt              # FastAPI, httpx, phonenumbers, ...
│   ├── requirements-dev.txt          # pytest, pytest-asyncio, ruff
│   ├── pytest.ini
│   ├── ruff.toml                     # Lint rule set: E, W, F, I, UP, B, C4, SIM
│   ├── .env.example                  # GEMINI_API_KEY, Mapsplatformkey
│   └── services/
│       ├── search_service.py         # GET /search 4-phase orchestrator
│       ├── overpass_service.py       # OSM Overpass QL + 3-mirror retry + haversine
│       ├── googleplaces_service.py   # Nearby Search + Place Details + multi-key rotation
│       ├── geocoder.py               # Nominatim reverse-geocode → landmark + ISO code
│       ├── ai_triage.py              # Gemini 2.0 Flash + 4-rule deterministic fallback
│       ├── cache.py                  # Async TTL/LRU cache (3 module singletons)
│       ├── rate_limiter.py           # Per-IP token bucket, X-Forwarded-For aware
│       ├── phone_utils.py            # phonenumbers wrapper (normalise, match)
│       ├── hours_parser.py           # OSM opening_hours → isOpen bool
│       ├── triage_service.py         # POST /triage router
│       ├── dispatch_service.py       # POST /dispatch telemetry sink
│       ├── health_service.py         # GET /health router
│       └── offline_service.py        # GET /offline-pack router
│   └── tests/                        # 10 test files, pytest discoverable
│
├── frontend/                         # React 18 + Vite 8 PWA
│   ├── index.html
│   ├── vite.config.js                # React + vite-plugin-pwa (injectManifest)
│   ├── vitest.config.js              # test runner config
│   ├── package.json                  # Deps: leaflet, react-leaflet, i18next, lucide
│   ├── public/sw.js                  # Workbox service worker source
│   └── src/
│       ├── main.tsx                  # React root, i18n init
│       ├── App.jsx                   # Top-level state + 4-tier fallback orchestration
│       ├── final-design.css          # Design system, Leaflet overrides, RTL support
│       ├── components/
│       │   ├── MapHero.jsx           # Hero section: map + dock + SOS overlay
│       │   ├── RealMap.jsx           # Leaflet + CartoDB Dark + custom divIcon markers
│       │   ├── SOSButton.jsx         # WhatsApp/SMS country-aware dispatch
│       │   ├── LanguagePicker.jsx    # First-launch 43-language modal (no auto-select)
│       │   ├── MedicalIdModal.jsx    # Blood type, allergies, emergency contacts
│       │   ├── CrashAlert.jsx        # PIN-cancel safety layer
│       │   ├── DispatchScreen.jsx    # Post-SOS confirmation UI
│       │   ├── TriageModal.jsx       # 2-question intake → AI reorder
│       │   ├── CountryEmergency.jsx  # 4-button always-visible national numbers bar
│       │   └── ...
│       ├── hooks/
│       │   ├── useLocation.js        # GPS + IP fallback + crash detection
│       │   └── useNetwork.js         # Online/offline state
│       ├── utils/
│       │   ├── overpass.js           # /search client
│       │   ├── googlePlaces.js       # /triage client
│       │   ├── offlineDB.js          # localStorage cache, 24h TTL, ~1.1km grid
│       │   ├── bundledFacilities.js  # Tier-3 fallback: nearest from JSON
│       │   ├── emergencyNumbers.js   # ISO country → emergency dial codes
│       │   ├── sosDispatch.js        # WhatsApp/SMS country routing
│       │   ├── medicalId.js          # On-device emergency-contact storage
│       │   ├── plusCodes.js          # Open Location Code encoder (pure JS)
│       │   └── backendWarmup.js      # Render cold-start mitigation
│       ├── i18n/                     # 43 locales + RTL handler
│       │   ├── index.js              # i18next init
│       │   ├── locales.js            # Metadata: native, English, dir, region
│       │   └── *.json                # 43 translation bundles
│       └── data/
│           └── bundled_facilities.json # 249 facilities × 196 countries
│
├── docs/                             # Engineering documentation
│   ├── ARCHITECTURE.md               # System design + ADRs + risk assessment
│   ├── TECHNICAL.tex                 # LaTeX source for technical reference
│   └── TECHNICAL.pdf                 # Compiled 21-page PDF
│
├── .github/workflows/                # 3 CI workflows
│   ├── frontend-ci.yml               # Build + Vitest on Node 20 & 22
│   ├── backend-tests.yml             # ruff lint → app startup → pytest 3.11 & 3.12
│   └── pr-guard.yml                  # Merge conflict + branch staleness checks
│
├── render.yaml                       # Backend deployment config
├── vercel.json                       # Frontend deployment config
└── README.md
```

---

## 🚀 Quick Start

### 1. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate                 # Windows
# source venv/bin/activate             # macOS / Linux
pip install -r requirements.txt

cp .env.example .env                  # set GEMINI_API_KEY (required, free at aistudio.google.com/apikey)
uvicorn main:app --reload
```

Backend now serves at **http://localhost:8000**

Smoke test:
```
http://localhost:8000/search?lat=12.9716&lon=77.5946
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** on your phone or desktop browser.

The Vite dev server proxies `/search`, `/triage`, and `/offline-pack` to the backend automatically.

---

## 📡 API Reference

### `GET /search?lat={float}&lon={float}`

Returns nearby emergency services with reverse-geocoded location context.

**Response:**
```json
{
  "contacts": [
    {
      "id": "osm_123456",
      "name": "Apollo Hospital",
      "category": "hospital",
      "phone": "+91 80 2630 4050",
      "distance": 1.4,
      "lat": 12.9810,
      "lon": 77.5946,
      "source": "OpenStreetMap",
      "isOpen": true,
      "aiReason": null
    }
  ],
  "source": "OpenStreetMap",
  "landmark": "Bannerghatta Road, BTM Layout, Bengaluru, Karnataka",
  "country_code": "IN",
  "count": 12
}
```

### `POST /triage`

Reorders contacts using AI for a specific situation.

**Request:**
```json
{
  "injured": true,
  "blocking": false,
  "contacts": [ /* contacts from /search */ ]
}
```

**Response:**
```json
{
  "contacts": [ /* same contacts, AI-reordered */ ],
  "reason": "Trauma care prioritised · ambulance and hospital listed first"
}
```

### `POST /dispatch-summary`

Generates a ready-to-read dispatch text describing the accident — useful for handing a phone to a bystander or pasting into a WhatsApp message.

**Request:**
```json
{
  "lat": 12.9716,
  "lon": 77.5946,
  "landmark": "Bannerghatta Road, BTM Layout",
  "injured": true,
  "blocking": true
}
```

**Response:**
```json
{
  "summary": "Road accident at Bannerghatta Road, BTM Layout (12.9716, 77.5946). Injured persons on scene. Vehicle blocking traffic. Emergency services needed immediately.",
  "source": "ai"
}
```

`source` is `"ai"` when Gemini generated the text, `"template"` when the rule-based fallback was used.

---

### `GET /health`

System health check — useful for uptime monitors and the Render health-check probe.

**Response:**
```json
{
  "status": "ok",
  "uptime_seconds": 3821,
  "configured": {
    "gemini": true,
    "google_places": false
  },
  "cache": {
    "overpass": { "size": 4, "hits": 11, "misses": 4, "hit_rate": 0.73 },
    "google":   { "size": 0, "hits": 0,  "misses": 0, "hit_rate": 0.0 },
    "geocode":  { "size": 4, "hits": 9,  "misses": 4, "hit_rate": 0.69 }
  }
}
```

---

### `GET /offline-pack`

Returns the bundled 59-country emergency number database.

---

## 🌍 International Coverage

**196 countries pre-loaded — full global coverage.** GPS or IP-based country detection switches the visible national emergency numbers automatically. Every UN-recognised country has police, ambulance, fire, and general emergency numbers bundled in the app — no network required.

| Region | Countries Covered |
|---|---|
| **Asia** | 49 (India, China, Japan, all SAARC, all ASEAN, Middle East, Central Asia) |
| **Europe** | 50 (all EU + EFTA + UK + Balkans + post-Soviet) |
| **Africa** | 54 (all African Union members) |
| **Americas** | 35 (North, Central, South + Caribbean) |
| **Oceania** | 14 (Australia, NZ, all Pacific island nations) |

<details>
<summary><strong>View full country list</strong> (click to expand — 196 entries)</summary>

The complete database is in `backend/data/emergency_seed.json`. The file is the authoritative source — both the backend `/offline-pack` endpoint and the frontend bundle (`frontend/src/utils/emergencyNumbers.js`) are generated from it.

</details>

---

## 🎤 Three-Minute Walkthrough

A reproducible demo path that exercises every major capability:

| Time | Action | What you should see |
|---|---|---|
| 0:00 | Open Google Maps in another tab, search *"hospital near me"* | Baseline: 2–3 minutes of scrolling before a useful number appears |
| 0:30 | Open RoadSOS | National emergency numbers banner renders instantly from bundled data |
| 0:40 | Pick a language from the 43-language modal | UI re-renders in the chosen language; RTL languages flip layout |
| 0:55 | Real Leaflet map centres on your GPS position | Up to 6 nearest contacts pinned at their real lat/lon |
| 1:10 | Answer triage questions (injured? blocking?) | Top card carries a one-sentence AI reason explaining its priority |
| 1:40 | **Turn off WiFi live.** Reload | Cached results still render; banner stays online; map markers persist |
| 2:00 | Open the demo-location picker. Switch to London → Tokyo → Berlin | Numbers change to 999 → 119 → 110/112; map glides to each city |
| 2:30 | Tap SOS | WhatsApp (in WhatsApp-dominant countries) or SMS (elsewhere) opens with coordinates + landmark + top contact pre-filled |
| 2:50 | Count contacts vs the Google Maps tab | Single-screen list of categorised, phoned contacts vs scrolling through generic results |

---

## 🛡 What We Deliberately Did NOT Build

Every item here was considered, prototyped on paper, and rejected for a specific reason. Honesty about limits is part of building emergency software.

| Feature | Why We Dropped It |
|---|---|
| **Accelerometer crash detection** | Phone-drop forces (~40 m/s²) overlap with serious crash forces (20–80 m/s²) and large potholes (15–30 m/s²). Apple still gets false positives on roller coasters with dedicated hardware. Indian highways have continuous pothole jerks — false positive rate would make the app unusable. |
| **Vehicle ECU / Smartcar integration** | India's connected-car API coverage is near zero. Any demo would be a simulated mock. Out of scope for a phone-only PWA. |
| **Background passive monitoring** | iOS restricts background processes at the OS level. A significant portion of Indian users are on iPhones. A feature that does not work on iOS is not a feature. |
| **Real-time ambulance tracking** | Requires formal API agreements with dispatch services and live telemetry from ambulance vehicles. Not achievable in three weeks. |
| **User accounts / login** | Adds friction in an emergency. The worst possible moment to ask someone to log in is at a crash scene. |

**What we built instead:** GPS velocity collapse detection — a phone-only approximation of crash detection that works without dedicated hardware, with PIN-based cancel to prevent accidental dismissal by an unconscious hand on the screen.

---

## 🗺 Roadmap

**Phase 1 — Hackathon submission (current):** PWA shipped, AI triage live, offline mode functional, 196 countries covered.

**Phase 2 — Production hardening:**
- [ ] Government API integration (108 in India, 112 EU dispatcher tie-ins)
- [ ] Live ambulance tracking via dispatch partnerships
- [ ] Dedicated hardware crash detection module (Bluetooth dongle option)
- [ ] Multi-language UI (Hindi, Tamil, Telugu, Bengali)
- [ ] Verified-source overlay (data from regional 108 services, government trauma center directories)
- [ ] Push-based crowd-sourced incident reports

**Phase 3 — Platform:**
- [ ] Hospital intake pre-notification (calls trigger an incoming-patient API at the trauma centre)
- [ ] Insurance integration for direct accident reporting
- [ ] Native iOS and Android apps with native Emergency SOS hooks

---

## 🚢 Deployment

### Backend → Render

`render.yaml` is in the repo root. From the Render dashboard:

1. **New → Blueprint**
2. Connect this repository
3. Set environment variables:
   - `GEMINI_API_KEY` (required — free at https://aistudio.google.com/apikey)
   - `GOOGLE_PLACES_API_KEY` (optional)
4. Deploy

### Frontend → Vercel

`vercel.json` is in the repo root. From the Vercel dashboard:

1. **Add New Project** → Import this repo
2. Set environment variable:
   - `VITE_API_URL` = your Render backend URL (e.g. `https://roadsos-api.onrender.com`)
3. Deploy

---

## 📊 Capabilities Summary

| Capability | Implementation |
|---|---|
| **Dual-source contact discovery** | OSM Overpass and Google Places fired in **parallel** via `asyncio.gather`. Each result carries a `source` provenance tag (`OpenStreetMap`, `Google Places`, `OSM + Google`, `Bundled directory`). `tel:` links use phone numbers normalised by the `phonenumbers` library. |
| **Contact volume per query** | 9 OSM categories + 4 Google categories queried in parallel. Auto-expand from 5 km → 10 km radius when sparse. Top-6 phoneless results get Google Place Details lookups capped at 6 calls/search. Typical urban result: 10–15 contacts. |
| **Offline operation** | 4-tier fallback chain in `App.jsx`: (1) backend `/search` with 8-second Workbox `NetworkFirst`, (2) `localStorage` cache keyed by ~1.1 km grid with 24-hour TTL, (3) `bundled_facilities.json` — 249 verified trauma centres and major hospitals across all 196 countries with 80 km → 600 km radius expansion, (4) hardcoded mock as final placeholder. Country emergency-number banner renders entirely from bundled data with zero network dependency. |
| **AI integration** | Gemini 2.0 Flash triage with explicit reasoning visible on the top card. Three-layer fallback: model response → JSON validation → rule-based 4-quadrant priority table → original ordering. Free-tier API (60 RPM, 1500 RPD), no SDK — direct REST via httpx. |
| **Crash detection** | Two-signal fusion: GPS velocity collapse (≥25 km/h → ≤5 km/h within 2 s) AND accelerometer spike (≥3.5 G) within a 4-second alignment window. PIN-cancel safety layer. 12-second post-alert cooldown. |
| **International coverage** | 196 countries pre-loaded with national emergency numbers. ISO-3166 country code derived from Nominatim reverse-geocoding. Demo-location picker switches across cities (BLR / LON / TYO / BER) to verify cross-border behaviour. |
| **Languages** | 43 locales — all 22 Indian Schedule-VIII languages + 21 global. RTL layout for Arabic, Persian, Hebrew, Urdu, Kashmiri, Sindhi. |
| **Real map** | Leaflet 1.9 + CartoDB Dark Matter OSM tiles. No API key. Up to 6 nearest contacts plotted at their actual coordinates. Map re-centres smoothly when the location changes. |
| **Reliability hardening** | Every upstream call wrapped in `_safe_*` helper. API never returns 5xx for upstream failure — degrades to empty contacts with transparent `source`. Three-mirror Overpass with exponential backoff (overpass-api.de → kumi.systems → openstreetmap.fr). Multi-key Google Places rotation. Per-IP rate limiting (30/min `/search`, 20/min `/triage`). |

---

## 📄 License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built for the National Road Safety Hackathon 2026**
**CoERS × IIT Madras**
**Submission Deadline: 31 May 2026**

*Every design decision in this codebase serves one goal: shorten the time between an accident and the right call.*

</div>
