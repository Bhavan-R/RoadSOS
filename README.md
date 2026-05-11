# RoadSOS

**National Road Safety Hackathon 2026 · CoERS × IIT Madras**
**Submission deadline: 31 May 2026 (Unstop)**

RoadSOS is a Progressive Web App for road accidents. It opens, finds your location, fetches every relevant emergency service nearby, sorts them based on your specific situation using AI, and connects you in one tap. It works offline. It works globally.

## Quick start

### Backend (FastAPI)

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
copy .env.example .env         # Windows (or `cp` on Unix)
# Edit .env and add your ANTHROPIC_API_KEY
uvicorn main:app --reload
```

Backend runs at `http://localhost:8000`. Test it:

```
http://localhost:8000/search?lat=12.9716&lon=77.5946
```

### Frontend (React PWA)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`. The Vite dev server proxies `/search`, `/triage`, and `/offline-pack` to the backend automatically.

## Project structure

```
backend/
  main.py                   FastAPI app entry
  requirements.txt
  data/emergency_seed.json  59 countries · police, ambulance, fire, general
  services/
    overpass_service.py     OSM Overpass API query + parse + Haversine sort
    googleplaces_service.py Google Places fallback (when OSM < 3 results)
    geocoder.py             Nominatim reverse geocoding for landmark + country
    claude_service.py       Claude Haiku AI triage + rule-based fallback
    search_service.py       GET /search · orchestrates everything
    triage_service.py       POST /triage · AI prioritisation
    offline_service.py      GET /offline-pack · serves the 59-country DB

frontend/
  vite.config.js            React + PWA plugins + dev proxy
  public/sw.js              Workbox Service Worker · NetworkFirst for API
  src/
    main.tsx                React entry
    App.jsx                 Orchestration
    style.css               Dark theme · big touch targets
    components/
      ContactCard.jsx       Single emergency contact with AI reason banner
      ContactList.jsx       List + loading + error + empty states
      CountryEmergency.jsx  National numbers · always offline
      OfflineBanner.jsx     Network status indicator
      SOSButton.jsx         WhatsApp/SMS broadcast + copy coordinates
      TriageModal.jsx       2-question intake
      CrashAlert.jsx        GPS velocity collapse · PIN-cancel safety layer
    hooks/
      useLocation.js        GPS → IP fallback · velocity tracking
      useNetwork.js         Online/offline state
    utils/
      emergencyNumbers.js   Bundled 59-country DB · always offline
      offlineDB.js          localStorage cache · 24hr TTL
      overpass.js           Wraps GET /search
      googlePlaces.js       Wraps POST /triage

render.yaml                 Render deployment config (backend)
vercel.json                 Vercel deployment config (frontend)
```

## Architecture

```
User opens app
  ↓
useLocation: GPS (10s timeout) → IP fallback (ipapi.co)
  ↓
GET /search?lat=X&lon=Y
  ├─ Overpass API (OSM) within 5km
  ├─ If <3 results, expand to 10km
  ├─ If still <3, fallback to Google Places
  ├─ Deduplicate by phone + name
  └─ Reverse geocode for landmark + country code
  ↓
Show CountryEmergency banner with detected country
Open TriageModal (2 questions: injured? blocking?)
  ↓
POST /triage with contacts + answers
  ├─ Claude Haiku 4.5 prioritises by situation
  └─ Rule-based fallback if API down
  ↓
Render ContactList · top card shows AI reason banner
SOSButton at bottom · WhatsApp deep link with coords + landmark
```

## Offline architecture

- **App shell**: precached via Workbox on first load
- **Search results**: cached per location (rounded to ~1km grid), 24hr TTL, via Service Worker (NetworkFirst) + localStorage backup
- **National emergency numbers**: bundled in JS at build time (`emergencyNumbers.js`) — never need network
- **When fully offline**: CountryEmergency banner always shows correct national numbers; ContactList shows cached results with timestamp; OfflineBanner indicates state

## What we deliberately did NOT build (and why)

| Feature | Reason |
|---|---|
| Accelerometer crash detection | Phone-drop / pothole false positives. Apple still hasn't fully solved it with dedicated hardware. |
| Vehicle ECU integration | India's connected-car API coverage is near zero. Demo would be a mock. |
| Background passive monitoring | Apple restricts background processes on iOS at the OS level. |
| Real-time ambulance tracking | Requires formal API agreements with dispatch services. |
| User accounts / login | Adds friction. Emergency apps must be one-tap-zero-setup. |

GPS velocity collapse detection is implemented in `useLocation.js` as an honest substitute for accelerometer crash detection — it activates when the app is open and the user is moving.

## Tech stack

- **Frontend**: React 18 + Vite + vite-plugin-pwa
- **Backend**: FastAPI + httpx + anthropic
- **Data**: OpenStreetMap Overpass + Google Places (fallback) + Nominatim (geocoding)
- **AI**: Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
- **Offline**: Workbox Service Worker + localStorage + bundled JSON
- **Hosting**: Vercel (frontend) + Render (backend)

## Deployment

### Backend → Render

`render.yaml` is in the repo root. From Render dashboard: New → Blueprint → connect this repo. Set `ANTHROPIC_API_KEY` and optionally `GOOGLE_PLACES_API_KEY` as environment variables.

### Frontend → Vercel

`vercel.json` is in the repo root. From Vercel dashboard: Add New Project → import this repo. Set `VITE_API_URL` to your deployed Render backend URL (e.g. `https://roadsos-api.onrender.com`).

## Demo script (for judges)

1. Open Google Maps in another tab and search "hospital near me" — count the seconds.
2. Open RoadSOS — results in under 5 seconds with national numbers visible at top.
3. Answer the 2 triage questions — show how the AI reason banner appears on the top contact.
4. **Turn off WiFi live** — show OfflineBanner, cached results with timestamp, national numbers still working.
5. Use the demo-location picker to switch to London/Tokyo/Berlin — show country detection and emergency numbers updating.
6. Tap SOS Broadcast — show the pre-filled WhatsApp message with coords + landmark.

## Team

- Prajnadeep Sarma (lead)
- (Rookie 1)
- (Rookie 2)
