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
[![Anthropic](https://img.shields.io/badge/Anthropic-Claude%20Haiku%204.5-d97757)](https://www.anthropic.com/)
[![OSM](https://img.shields.io/badge/Data-OpenStreetMap-7EBC6F?logo=openstreetmap&logoColor=white)](https://www.openstreetmap.org/)

[![Backend Tests](https://github.com/Arthrevs/Roadproj/actions/workflows/backend-tests.yml/badge.svg)](https://github.com/Arthrevs/Roadproj/actions/workflows/backend-tests.yml)
[![Countries](https://img.shields.io/badge/Coverage-196%20Countries-3498db?style=flat-square)](#-international-coverage)
[![Categories](https://img.shields.io/badge/Service%20Types-8-9b59b6?style=flat-square)](#-features)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

**[🎯 Problem](#-the-problem) · [⚡ Features](#-features) · [🏗 Architecture](#-architecture) · [🚀 Quick Start](#-quick-start) · [🎤 Demo Script](#-demo-script-for-judges) · [🛡 What We Did Not Build](#-what-we-deliberately-did-not-build) · [🗺 Roadmap](#-roadmap)**

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

### 📶 Genuinely Offline (5-layer)
Service Worker + localStorage + **Plan-a-Trip pre-cache** + **bundled 28-facility trauma directory** + bundled 196-country national numbers. Pre-fetch hospitals along Chennai→Bengaluru before you leave, then crash anywhere on NH-44 — the right number is still there.

</td>
<td>

### 🌍 Globally Aware
Reverse-geocode-based country detection. Drive across the India–Nepal border and the emergency numbers switch from `108/100/101` to `102/100/101` automatically.

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
│   ├─ Anthropic Claude Haiku 4.5  ─── situation-aware sort    │
│   └─ Rule-based fallback         ─── if API down             │
│                                                               │
│  POST /dispatch-summary                                       │
│   ├─ Claude Haiku  ─── human-readable accident description    │
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
       └─► Claude reorders, returns one-line reason
       └─► If API fails: rule-based fallback produces same shape

5. ContactList renders with AI reason banner on top card
   SOSButton ready with pre-filled WhatsApp message
```

### 🔌 Offline Architecture

```
ONLINE                                    OFFLINE
──────                                    ───────
GET /search ─────► Service Worker         ► Service Worker checks cache
                   │                        │
                   ├─ Cache (NetworkFirst)  ├─ Returns cached results
                   └─ Forward to backend    │
                                            ├─ App reads localStorage
                                            │  (24hr TTL, ~1km grid)
                                            │
                                            └─ CountryEmergency banner
                                               always shows correct
                                               national numbers from
                                               bundled JS (no fetch)
```

---

## 🧰 Tech Stack

<div align="center">

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | React 18 + Vite + vite-plugin-pwa | Fast HMR, native PWA support, mobile-first |
| **Backend** | FastAPI + httpx (async) | Async I/O for parallel API calls, type-safe |
| **AI Triage** | Anthropic Claude Haiku 4.5 | Lowest-latency model on the Claude API — fits emergency-time SLAs |
| **Location Data** | OpenStreetMap Overpass + Google Places | OSM is free + global; Places fills India sparse-data gaps |
| **Geocoding** | Nominatim (OSM) | Free, no API key, returns ISO country code |
| **Offline Cache** | Workbox Service Worker + localStorage | Two-layer cache: network responses + UI state |
| **Hosting** | Vercel (frontend) + Render (backend) | Free tier sufficient for demo; auto-deploy from GitHub |

</div>

---

## 📦 Project Structure

```
Roadproj/
├── backend/                          # FastAPI service
│   ├── main.py                       # App entry, router registration, CORS
│   ├── requirements.txt
│   ├── .env.example                  # ANTHROPIC_API_KEY, GOOGLE_PLACES_API_KEY
│   ├── data/
│   │   └── emergency_seed.json       # 196 countries × 4 numbers (police, ambulance, fire, general)
│   └── services/
│       ├── overpass_service.py       # OSM Overpass QL builder + parser + Haversine sort
│       ├── googleplaces_service.py   # Nearby Search + Place Details fallback
│       ├── geocoder.py               # Nominatim reverse geocode → landmark + country ISO
│       ├── ai_triage.py              # Anthropic SDK + rule-based fallback
│       ├── cache.py                  # In-memory TTL cache (Overpass / Google / geocode)
│       ├── phone_utils.py            # E.164 normalization via phonenumbers library
│       ├── hours_parser.py           # OSM opening_hours → isOpen bool
│       ├── search_service.py         # GET /search orchestrator
│       ├── triage_service.py         # POST /triage router
│       ├── dispatch_service.py       # POST /dispatch-summary router
│       ├── health_service.py         # GET /health router
│       └── offline_service.py        # GET /offline-pack router
│   ├── tests/                        # Pure unit tests — no API keys or network needed
│   │   ├── test_overpass.py          # haversine, classify, parse, dedup, query builder
│   │   ├── test_ai_triage.py         # rule_based_triage all 4 cases + _validate_ai_result
│   │   ├── test_cache.py             # TTLCache expiry, eviction, stats, location_key
│   │   ├── test_hours_parser.py      # OSM opening_hours parsing + datetime injection
│   │   └── test_phone_utils.py       # E.164 normalize, is_dialable, phones_match
│   ├── pytest.ini
│   └── requirements-dev.txt
│
├── .github/
│   └── workflows/
│       └── backend-tests.yml         # CI: pytest on Python 3.11 + 3.12 on every push
│
├── frontend/                         # React PWA
│   ├── index.html
│   ├── vite.config.js                # React + PWA plugins, dev proxy
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example                  # VITE_API_URL
│   ├── public/
│   │   ├── favicon.svg
│   │   └── sw.js                     # Workbox Service Worker
│   └── src/
│       ├── main.tsx                  # React entry
│       ├── App.jsx                   # Top-level orchestration
│       ├── style.css                 # Dark theme, mobile-first, 48px+ touch targets
│       ├── components/
│       │   ├── ContactCard.jsx       # Category badge, AI reason banner, tel: link, data provenance
│       │   ├── ContactList.jsx       # Loading / empty / error / cached states
│       │   ├── CountryEmergency.jsx  # 4-button always-visible national numbers bar
│       │   ├── OfflineBanner.jsx     # Network status indicator
│       │   ├── SOSButton.jsx         # WhatsApp/SMS broadcast + copy-coordinates
│       │   ├── TriageModal.jsx       # 2-question intake with AI loading state
│       │   └── CrashAlert.jsx        # PIN-cancel safety layer for crash detection
│       ├── hooks/
│       │   ├── useLocation.js        # GPS + IP fallback + velocity collapse detection
│       │   └── useNetwork.js         # Online/offline state
│       └── utils/
│           ├── emergencyNumbers.js   # Bundled static 196-country map
│           ├── offlineDB.js          # localStorage cache, 24hr TTL, ~1km grid
│           ├── overpass.js           # Wraps GET /search
│           └── googlePlaces.js       # Wraps POST /triage
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

cp .env.example .env                  # set ANTHROPIC_API_KEY (required)
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

`source` is `"ai"` when Claude generated the text, `"template"` when the rule-based fallback was used.

---

### `GET /health`

System health check — useful for uptime monitors and the Render health-check probe.

**Response:**
```json
{
  "status": "ok",
  "uptime_seconds": 3821,
  "configured": {
    "anthropic": true,
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

## 🎤 Demo Script (For Judges)

A rehearsed three-minute narrative that hits every evaluation criterion:

| Time | Action | Criterion Demonstrated |
|---|---|---|
| 0:00 | Open Google Maps in another tab, search *"hospital near me"* — count the seconds out loud | Establishes baseline (the problem) |
| 0:30 | Open RoadSOS — national emergency numbers visible at top instantly | **Reliability**, **information integration** |
| 0:45 | Answer triage questions — show the AI reason banner appearing on the top contact | **Innovation**, **AI usage** |
| 1:15 | **Turn off WiFi live.** Reload. Cached results still show. National numbers still work. | **Offline functionality** |
| 1:45 | Open the demo-location picker. Switch to London. Numbers change to 999 instantly. Tokyo → 119. Berlin → 110/112. | **Information integration across countries** |
| 2:30 | Tap SOS Broadcast — WhatsApp opens with pre-filled message containing coords + landmark + top contact | **Innovation, real-world usability** |
| 2:50 | Count contacts on screen vs Google Maps results | **Number of contacts fetched** |

---

## 🛡 What We Deliberately Did NOT Build

Every item here was considered, prototyped on paper, and rejected for a specific reason. Honesty about limits is part of building emergency software.

| Feature | Why We Dropped It |
|---|---|
| **Accelerometer crash detection** | Phone-drop forces (~40 m/s²) overlap with serious crash forces (20–80 m/s²) and large potholes (15–30 m/s²). Apple still gets false positives on roller coasters with dedicated hardware. Indian highways have continuous pothole jerks — false positive rate would make the app unusable. |
| **Vehicle ECU / Smartcar integration** | India's connected-car API coverage is near zero. A demo would be a simulated mock that judges would see through. The evaluation criteria do not include crash detection. |
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
   - `ANTHROPIC_API_KEY` (required)
   - `GOOGLE_PLACES_API_KEY` (optional)
4. Deploy

### Frontend → Vercel

`vercel.json` is in the repo root. From the Vercel dashboard:

1. **Add New Project** → Import this repo
2. Set environment variable:
   - `VITE_API_URL` = your Render backend URL (e.g. `https://roadsos-api.onrender.com`)
3. Deploy

---

## 📊 Evaluation Score Card

The hackathon scores submissions on five criteria. Here is how RoadSOS addresses each:

| Criterion | How RoadSOS Scores |
|---|---|
| **Reliability & data accuracy** | Dual-source (OSM + Google Places fired in **parallel**) with provenance badge on every card. `tel:` links use raw E.164-normalised phone numbers. 4-layer fallback: Overpass mirrors → Google Places → bundled MOCK_DATA → national numbers always visible. |
| **Number of contacts fetched** | Eight OSM categories + four Google categories queried in parallel. Auto-expand from 5km → 10km radius. Top-6 phoneless contacts get a Google Place Details lookup for missing phones. Typical urban query: 10–15 contacts. |
| **Offline functionality** | **Five-layer offline cache** designed for highway dead zones: (1) Workbox Service Worker, (2) localStorage app cache, (3) **🆕 Route pre-cache** — user picks origin+destination *before* leaving home, app pulls the OSRM driving polyline, samples 6 waypoints and seeds `/search` for each, (4) **🆕 Bundled directory** — 28 verified Indian trauma centres (TN-heavy) + Delhi/Mumbai/Bengaluru/Hyderabad metros searched spatially when nothing else hits, (5) bundled 196-country national emergency numbers. Triage also works offline — client-side rule engine mirrors backend logic. |
| **Innovation & features** | AI triage with **visible** reasoning, GPS velocity crash detection with PIN-cancel safety layer, WhatsApp deep link broadcast, demo location picker. |
| **International integration** | 196 countries pre-loaded. ISO country code from reverse geocoding switches numbers automatically. Demo picker proves it works in London, Tokyo, Berlin, etc. |

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
