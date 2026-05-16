# RoadSOS — Stage 1 Submission Deck

**Format:** 7 slides per Section 7.1 of the rulebook
**Use:** Convert this Markdown to PowerPoint/PDF using Marp, Pandoc, or Google Slides.
**Recommended tool:** [Marp](https://marp.app/) — paste each slide into a new Marp deck for instant export.

---

## Slide 1 — Welcome

### 🚨 RoadSOS

> **The right emergency contact, in one tap, even with no signal.**

A location-aware Progressive Web App that connects road accident victims and bystanders to the right help in under 10 seconds — globally, offline, and intelligently.

**Team:** Sarma (Lead) · Rookie 1 · Rookie 2
**Submitted to:** CoERS × IIT Madras — National Road Safety Hackathon 2026
**Repository:** github.com/Arthrevs/Roadproj

---

## Slide 2 — The Problem We Solve

### India loses 1.5 lakh lives to road accidents every year.

**Most aren't killed by the crash. They're killed by delay.**

The "golden hour" — the first sixty minutes after a severe injury — determines survival. Yet today, at a real crash scene, a bystander does this:

1. Opens Google Maps
2. Searches "hospital near me"
3. Scrolls through generic results
4. Tries to identify which has a trauma unit
5. Searches separately for the phone number
6. Repeats for police, ambulance, towing

**2–3 minutes lost. Minutes that decide outcomes.**

Emergency services exist. **Finding them quickly enough is the problem.**

---

## Slide 3 — Our Solution

### One app. One verified contact list. Sorted for *this specific situation*. Works offline. One tap.

**Six rulebook-mandated categories — instantly:**

| Category | Coverage |
|---|---|
| 🏥 Hospitals & trauma centres | OSM + Google Places |
| 👮 Police stations | OSM |
| 🚑 Ambulance services | OSM + national numbers |
| 🚛 Towing & vehicle recovery | OSM `service:vehicle:tow` |
| 🛞 Puncture / tyre shops | OSM `shop=tyres` |
| 🚗 Showrooms & dealers | OSM `shop=car` |

**Plus:**
- 🤖 AI-prioritised by *injured?* and *blocking traffic?*
- 🌍 **196 countries** of bundled emergency numbers — offline
- 📱 Installable PWA — works on any phone, no app store
- 📶 GPS velocity crash detection with PIN-cancel

---

## Slide 4 — Architecture

```
┌─────────────────────────────────────────────────────────┐
│              USER  (Browser / Installable PWA)           │
└────────────────────────┬────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   useLocation     Service Worker   Bundled 196-Country DB
   GPS→IP fb       NetworkFirst     Always offline · 0 network
   velocity        + CacheFirst     calls
        │                │
        ▼                │
┌─────────────────────────────────────────────────────────┐
│             FastAPI Backend  (Python · Render)           │
│  In-memory TTL cache · GZipMiddleware · structured logs  │
├─────────────────────────────────────────────────────────┤
│  GET  /search          → OSM Overpass + Google Places   │
│  POST /triage          → Gemini 2.0 Flash + rule fallback│
│  POST /dispatch-summary → AI-generated dispatch text     │
│  GET  /health          → uptime · API status · cache    │
│  GET  /offline-pack    → 196-country JSON               │
└─────────────────────────────────────────────────────────┘

Open & free APIs preferred:
✅ OpenStreetMap (free, global, open data)
✅ Nominatim (free reverse geocoding)
✅ Google Gemini 2.0 Flash (with rule-based fallback)
```

**Stack:** React 18 + Vite 8 PWA · FastAPI (Python) · OpenStreetMap Overpass · Nominatim · Google Gemini 2.0 Flash

---

## Slide 5 — Mapped to Evaluation Criteria

| Criterion (from rulebook) | How RoadSOS Delivers |
|---|---|
| **Reliability & data accuracy** | In-memory TTL cache · rule-based AI fallback · `_validate_ai_result()` strict schema check · phone E.164 normalization via `phonenumbers` · 59 unit tests · CI on every push (Python 3.11 + 3.12) |
| **Number of contacts fetched** | 8 contact categories (rulebook asks for 6) · Overpass expanded to include ways for clinic, healthcare=*, fire_station, car_repair · auto-radius expansion 5 km → 10 km if < 3 results · Google Places fallback |
| **Offline functionality** | Workbox Service Worker · NetworkFirst for `/search` + `/triage` · CacheFirst for `/offline-pack` · localStorage 24h cache (1 km grid) · **196-country emergency numbers bundled in JS — zero network calls** |
| **Innovation & additional features** | AI triage with reason text · GPS velocity crash detection with PIN-cancel · WhatsApp-deeplink SOS broadcast · dispatch summary endpoint · demo location picker for judges · 196-country detection · structured `/health` endpoint |
| **Information integration across countries** | 196 countries (full UN coverage) · ISO 3166-1 country detection via reverse geocoding · automatic switch of police/ambulance/fire numbers based on detected country · cross-border behaviour: drive India→Nepal and numbers update from 108→102 instantly |

---

## Slide 6 — Demo & Differentiation

### Live demo flow (3 minutes)

| Time | Action | Criterion |
|---|---|---|
| 0:00 | Open Google Maps, search *"hospital near me"* — count seconds | Baseline |
| 0:30 | Open RoadSOS — emergency numbers visible instantly | Reliability |
| 0:45 | Answer 2 triage questions — AI reason banner appears | AI / Innovation |
| 1:15 | Toggle airplane mode — everything still works | Offline |
| 1:30 | Switch demo country to London/Tokyo/Berlin — numbers update | Global integration |
| 2:00 | Tap SOS — WhatsApp opens with GPS + landmark pre-filled | Broadcast |
| 2:30 | Show `/health` endpoint with cache hit-rate stats | Observability |

### How we're different

| | Google Maps | Calling 112 | **RoadSOS** |
|---|---|---|---|
| Time to first contact | 2–3 min | 1 ring + routing | **< 5 sec** |
| Works offline | ❌ | ✅ (voice) | ✅ (visual list) |
| Trauma units specifically | ❌ | Indirect | ✅ (tagged) |
| Context-aware prioritisation | ❌ | Manual | ✅ (AI) |
| Global without re-learning | Partial | Numbers change | ✅ (196 countries) |
| Location broadcast | Manual | Voice only | ✅ (WhatsApp) |

> *RoadSOS does not replace 112. It runs **in parallel.** Parallel response saves minutes.*

---

## Slide 7 — Thank You

### RoadSOS

> Built in **3 weeks** by a team of three for the National Road Safety Hackathon 2026.

**Submitted artifacts:**
- ✅ Full source code (Python preferred — FastAPI backend ✅)
- ✅ Structured database documentation → `docs/DATA_SCHEMA.md`
- ✅ This 7-slide deck
- ✅ Live demo at deployment URL
- ✅ Open & free APIs preferred — OSM, Nominatim ✅

**Repository:** github.com/Arthrevs/Roadproj
**Live demo:** [Deployment URL]
**Contact:** [Team contact email]

**Every minute saved is a life saved.**

🙏 Thank you to CoERS, RBG Labs, and IIT Madras for the opportunity to build for road safety.
