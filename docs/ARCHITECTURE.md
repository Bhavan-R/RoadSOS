# RoadSOS — Architecture Review

**Branch reviewed:** `main` @ `6fc2869`
**Date:** 2026-05-16
**Reviewer:** Architecture audit (post-merge of `arindam-branch-` into `main`)

---

## 1. System Overview

RoadSOS is a **PWA-first emergency-services discovery app**. A user opens it, the app fixes their position via GPS, finds the closest hospital / police / ambulance / fire / towing / repair / tyre / showroom contacts within ~5–10 km, and provides a single SOS button that dispatches their location to emergency contacts via WhatsApp or SMS depending on country.

```
┌─────────────────────────────────────────────────────────────────────┐
│                       BROWSER (PWA)                                 │
│                                                                     │
│  React 18 + Vite + Workbox SW                                       │
│  ├─ Leaflet (real OSM map)                                          │
│  ├─ i18next (43 languages)                                          │
│  ├─ IndexedDB-style localStorage cache                              │
│  └─ Bundled facilities JSON (249 records, 196 countries)            │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                FASTAPI BACKEND (Render free tier)                   │
│                                                                     │
│  /search ─ orchestrates 3 upstream sources in parallel              │
│  /triage ─ Claude Haiku 4.5 contact re-prioritization               │
│  /health ─ liveness                                                 │
└────────┬────────────────┬──────────────────┬────────────────────────┘
         │                │                  │
         ▼                ▼                  ▼
  ┌────────────┐   ┌────────────┐    ┌──────────────┐
  │ OSM        │   │ Google     │    │ Nominatim    │
  │ Overpass   │   │ Places API │    │ (reverse     │
  │ (free)     │   │ (paid)     │    │  geocode)    │
  └────────────┘   └────────────┘    └──────────────┘
```

**Deployment:**
- Frontend → Vercel (`vercel.json`)
- Backend → Render (`render.yaml`, Python 3.11.9)
- CI → GitHub Actions (3 workflows)

---

## 2. Backend Architecture

### 2.1 Module Layout (`backend/services/`)

| Module | Lines | Responsibility |
|---|---|---|
| `search_service.py` | 169 | `GET /search` orchestrator. Phase 1 parallel geocode + Overpass; Phase 2 conditional Google fallback; Phase 3 dedup; Phase 4 phone enrichment |
| `overpass_service.py` | 280+ | OSM Overpass query builder (8 categories), 3-mirror retry, smart proximity dedup, opening_hours parsing |
| `googleplaces_service.py` | 220 | Nearby Search + Place Details. Multi-key rotation (`Mapsplatformkey` comma-separated). Find-Place-from-Text for phone enrichment |
| `geocoder.py` | ~80 | Nominatim reverse-geocode. ISO-3166 alpha-2 country code validation. 24h cache |
| `ai_triage.py` | 175 | Claude Haiku 4.5 contact reordering. Deterministic rule-based fallback (4 priority rules based on injured + blocking flags) |
| `triage_service.py` | ~65 | `POST /triage` router. Double-layered fallback |
| `cache.py` | ~70 | Async-safe TTL cache with LRU eviction. 3 module singletons: overpass (1h/200), google (1h/200), geocode (24h/500) |
| `rate_limiter.py` | ~75 | Per-IP token bucket. `X-Forwarded-For` aware for Render reverse proxy. 30 req/min for `/search`, 20 for `/triage` |
| `phone_utils.py` | ~80 | `phonenumbers` library wrapper. `is_dialable` (3–15 digits), `phones_match` (last-10-digit equality) |
| `hours_parser.py` | ~120 | OSM `opening_hours` parser. Handles `24/7`, day ranges, time ranges, holidays |
| `health_service.py` | ~30 | `GET /health` liveness — version, UTC timestamp |
| `dispatch_service.py` | ~50 | Logging-only endpoint for SOS dispatch telemetry |
| `offline_service.py` | ~40 | `GET /offline-pack` — pre-bundled facility data for warm-cache fetch |

### 2.2 Request Lifecycle: `GET /search`

```
Request → middleware stack (outermost first)
  ErrorHandlingMiddleware  ← absorbs unhandled exceptions → 503
  RequestLogMiddleware     ← method, path, status, ms, request_id
  RequestIDMiddleware      ← UUID4 if no X-Request-ID
  GZipMiddleware           ← compresses response
  CORSMiddleware           ← innermost
       ↓
  rate_limiter.check(IP)   ← 429 + Retry-After if exceeded
       ↓
  ┌──── PHASE 1 (PARALLEL via asyncio.gather) ──────────────┐
  │                                                          │
  │  _safe_geocode()        _safe_overpass()                 │
  │  ├─ cache lookup        ├─ cache lookup                  │
  │  ├─ Nominatim GET       ├─ Build Overpass QL             │
  │  ├─ ISO country         ├─ 3 mirrors × 3 retries         │
  │  │  validation          │  (2^n backoff, 30s timeout)    │
  │  └─ try/except → {}     ├─ Parse elements → haversine    │
  │                         ├─ Drop "Unnamed *" + no phone   │
  │                         ├─ Dedup by 50m proximity        │
  │                         └─ try/except → []               │
  └──────────────────────────────────────────────────────────┘
       ↓
  ┌──── PHASE 2 (CONDITIONAL) ──────────────────────────────┐
  │  if phoned_osm < 3:                                      │
  │    _safe_google(lat, lon, country_code from Phase 1)     │
  │      ├─ Nearby Search per category                       │
  │      ├─ Place Details for phone field                    │
  │      └─ try/except → []                                  │
  └──────────────────────────────────────────────────────────┘
       ↓
  ┌──── PHASE 3 (DEDUP) ────────────────────────────────────┐
  │  deduplicate(osm + google)                               │
  │    1. phone match (last-10-digit equality, wins)         │
  │    2. name match (case-insensitive)                      │
  │  Sort by distance (with contextlib.suppress)             │
  └──────────────────────────────────────────────────────────┘
       ↓
  ┌──── PHASE 4 (PHONE ENRICHMENT, optional) ───────────────┐
  │  enrich_missing_phones(top 6 closest phoneless)          │
  │    ├─ Find Place from Text + 500m bias                   │
  │    └─ Fallback: Nearby Search + 100m radius              │
  │  Capped at 6 lookups to control Google quota             │
  └──────────────────────────────────────────────────────────┘
       ↓
  Response: { contacts, source, landmark, country_code, count }
```

**Latency profile (cold cache, normal upstream):**
- Phase 1: max(geocode, overpass) ≈ 1.5–3s (Overpass dominates)
- Phase 2: 0 (skipped if Overpass ≥ 3 phoned) or ~2s
- Phase 4: ≤ 1.5s per enrichment × 6 = ≤9s worst case
- **Total worst case:** ~12s
- **Total warm cache:** ~50ms (all from `cache.py`)

### 2.3 Reliability Guarantees

**Every external call is wrapped.** The orchestrator (`search_service.py`) defines `_safe_*` wrappers that always return a valid shape ([] or fallback dict) on any exception. Result: the API **never returns 5xx for upstream failures**. The middleware stack catches anything not caught upstream and returns 503 with a `request_id` so the user can report it.

If all three upstreams are down: returns `200 OK` with `{contacts: [], source: "none (upstreams unavailable)"}` rather than failing.

### 2.4 Caching Strategy

| Cache | TTL | Max entries | Key |
|---|---|---|---|
| `overpass_cache` | 1h | 200 | `lat,lon` rounded to 4 dp + radius (~11m granularity) |
| `google_cache` | 1h | 200 | same coordinate key + region |
| `geocode_cache` | 24h | 500 | same coordinate key |

Cache key resolution at ~11m means two users 10m apart get the same cached search — appropriate for "what's near me" semantics. Geocode rarely changes, hence 24h.

**Eviction:** LRU by oldest timestamp when capacity reached. Cleanup runs opportunistically on each `set` (no background thread).

**Concurrency:** Each cache instance is guarded by `asyncio.Lock`. Safe under high concurrency.

**Negative caching gap:** Overpass deliberately **doesn't cache** when zero phones returned — this is intentional so subsequent Google enrichment can run, but it means a sparse OSM region hits Overpass every request.

### 2.5 Rate Limiting

Token bucket per client IP. `get_client_ip()` respects `X-Forwarded-For` (Render is a reverse proxy). On exceed: 429 with `Retry-After` header. Buckets are in-memory — **resets on every Render cold start** (acceptable for a hackathon-grade free tier).

### 2.6 AI Triage

Claude Haiku 4.5. Receives a prompt with the contact list and situational flags (`injured`, `blocking_traffic`). Returns reordered contacts plus a 1-sentence reason.

**3-layer fallback** for reliability:
1. Model call success + valid JSON + same contact count → use AI ordering
2. Any failure (no API key, network, malformed JSON, count mismatch) → rule-based ordering based on the 4 priority rules:
   - Injured + blocking → ambulance > hospital > police > towing > repair
   - Injured only → ambulance > hospital > police > repair > towing
   - Blocking only → police > towing > ambulance > hospital > repair
   - Neither → repair > tyre > police > towing > hospital > ambulance
3. Outer `try/except` in `triage_service.py` returns original ordering as last resort

---

## 3. Frontend Architecture

### 3.1 Application Flow (`App.jsx`)

```
mount
  ├─ startBackendWarmup()         ← ping Render to wake cold server
  ├─ useLocation()                ← GPS + motion sensors
  ├─ useNetwork()                 ← online/offline status
  └─ langPickerOpen?               ┐
        ├─ TRUE → LanguagePicker  │  gates remaining UI
        └─ FALSE → continue        ┘
              ↓
        first launch? → MedicalIdModal (one-time)
              ↓
        useEffect [searchLat, searchLon]
              ↓
        ┌──── 4-TIER FALLBACK CHAIN ────────────────┐
        │  1. searchNearby() → backend /search       │
        │  2. loadSearchResult() → localStorage      │
        │     (24h TTL, ~1.1km grid key)             │
        │  3. buildBundledSearchResult() →           │
        │     bundled_facilities.json (249 recs,     │
        │     80km → 600km fallback)                 │
        │  4. MOCK_DATA (7 hardcoded contacts)       │
        └────────────────────────────────────────────┘
              ↓
        MapHero (RealMap + SOSButton + dock)
```

### 3.2 Offline Capability Matrix

| Mechanism | What it caches | TTL | Invalidation |
|---|---|---|---|
| Workbox SW (`public/sw.js`) | App shell (JS/CSS/HTML) via `__WB_MANIFEST` | until next deploy | `skipWaiting()` on install |
| Workbox runtime cache | `/search` responses (NetworkFirst, 8s timeout) | 24h | LRU at 50 entries |
| `offlineDB.js` (localStorage) | Search results keyed by ~1.1km grid | 24h | manual `clearCache()` |
| `bundled_facilities.json` | 249 emergency facilities × 196 countries | build-time | new build |
| `emergencyNumbers.js` | Country code → emergency dial codes (108, 911, 112…) | build-time | new build |

**Offline-first guarantees:**
- App shell loads instantly from SW cache
- Last successful search restored from localStorage when offline
- If user never searched at this location before, falls back to bundled regional facilities
- WhatsApp/SMS deeplinks work offline (OS-level, not network-dependent)

**Offline gap:** OSM tile imagery is **not** cached — the basemap goes blank when offline, but markers + UI still render.

### 3.3 Map Layer (`RealMap.jsx`)

| Concern | Choice |
|---|---|
| Library | react-leaflet 4.2.1 + Leaflet 1.9.4 |
| Tile provider | CartoDB Dark Matter (no API key, free) |
| Attribution | Bottom-right, OSM + CARTO (legal requirement) |
| User marker | Custom divIcon: green pulsing dot + halo, greys when GPS lost |
| Service markers | Custom divIcon per category, color-coded (red=medical, blue=police, teal=mechanical), emoji + name + km chip |
| Interactivity | Disabled in hero (no pan/zoom/scroll) — keeps SOS button as primary focus |
| Recentering | Auto-pans when location prop changes (smooth 0.6s animation) |

Bundle cost: +150 KB minified (+44 KB gzipped) over the prior fake SVG. Trade-off accepted: real map > smaller bundle for an emergency app.

### 3.4 i18n

- **43 languages:** all 22 Indian Schedule-VIII languages + English + 20 global (Spanish, French, Portuguese, German, Italian, Dutch, Polish, Russian, Ukrainian, Romanian, Greek, Turkish, Arabic, Persian, Hebrew, Swahili, Amharic, Indonesian, Malay, Thai, Vietnamese, Chinese, Japanese, Korean, Filipino)
- **RTL support:** Urdu, Arabic, Kashmiri, Sindhi, Persian, Hebrew (`dir='rtl'` on `<html>`)
- **First-launch picker:** Manual selection only (no GPS-based auto-suggestion)
- **Persistence:** `localStorage['roadsos:lang']`
- **Fallback chain:** localStorage > `navigator.language` (if shipped) > `'en'`

### 3.5 Crash Detection (`useLocation.js`)

Two-signal verification to reduce false positives:

1. **GPS velocity collapse:** ≥25 km/h followed by ≤5 km/h within 2-second window
2. **Accelerometer spike:** ≥3.5G within 4 seconds of velocity collapse

Both must agree → `autoFireSos()` fires with crash flag, opens DispatchScreen, 12s cooldown before next alert. iOS 13+ requires explicit motion permission gesture, requested on first user tap.

### 3.6 SOS Dispatch (`sosDispatch.js`)

Country-aware multi-recipient dispatch:

- **WhatsApp-dominant countries** (80+ including IN, BR, GB, NG, ZA, MX, ID): `wa.me/<phone>` deeplink, one contact at a time, non-navigating (`window.open`)
- **SMS-dominant countries:** `sms:<contact1>,<contact2>,...` URI, all contacts in one go, navigates to native composer

Emits `roadsos:sos-sent` window event → App.jsx opens DispatchScreen for confirmation UI.

---

## 4. CI/CD Architecture

3 GitHub Actions workflows:

| Workflow | Triggers | Jobs |
|---|---|---|
| `frontend-ci.yml` | push/PR → main (`frontend/**`) | Node 20 + Node 22: `npm ci --legacy-peer-deps` → `vite build` → `vitest run`. Uploads `dist/` artifact (7d retention) |
| `backend-tests.yml` | push/PR → main (`backend/**`) | 1. `ruff check` + `ruff format --check`<br>2. App startup smoke test (`import main`)<br>3. pytest on Python 3.11 + 3.12 (parallel, only after lint+startup pass) |
| `pr-guard.yml` | PR → main | 1. Merge conflict detection (auto-attempts merge against `origin/main`, fails if conflict)<br>2. Branch staleness warning if >30 commits behind |

**Branch protection** (to apply manually from owner account):
- Required status checks: Build & Test (Node 20), (Node 22), pytest (3.11), (3.12), Lint (ruff), App startup check, Merge conflict check
- Block force pushes to main, block deletions
- Require strict mode (branches up to date before merge)

---

## 5. ADRs (Decision Records)

### ADR-01: Use OSM Overpass as primary data source, Google Places as fallback

**Status:** Accepted

**Context:** Need global emergency-facility coverage. Two viable options: Google Places (paid, complete metadata, $17 per 1k Nearby Search calls + $17 per 1k Place Details) vs OSM Overpass (free, variable quality, public servers).

**Decision:** Overpass primary, Google fallback only when phoned OSM results < 3.

| Dimension | Overpass | Google Places |
|---|---|---|
| Cost | $0 | ~$0.034/search worst case |
| Coverage | Excellent in EU/UK/IN, sparse elsewhere | Excellent globally |
| Phone numbers | ~30% have phone tag | ~80% have phone via Place Details |
| Rate limits | ~100 req/day/IP (soft) | Quota-based |
| Latency | 1.5–3s | 0.5–1s per call |

**Trade-off:** Free tier for normal use; pay only when needed. Worst case per search: ~6 Place Details + 4 Nearby = ~$0.17 (rare).

**Consequences:** Three Overpass mirrors required for reliability (kumi.systems, openstreetmap.fr as backups to overpass-api.de). Phoneless results trigger enrichment automatically.

### ADR-02: Bundled facility JSON as offline tier

**Status:** Accepted

**Context:** First-time users in low-connectivity regions can't reach backend or use cached results.

**Decision:** Ship 249-record facility catalog with the app (`bundled_facilities.json`, ~50KB gzipped).

**Trade-off:** +50KB bundle vs zero-network usefulness. Critical for hackathon demo offline criterion. Falls back from 80km → 600km radius when sparse.

### ADR-03: PWA with Workbox + injectManifest

**Status:** Accepted

**Context:** Need install-to-home-screen, offline shell, near-instant repeat loads.

**Decision:** `vite-plugin-pwa` with `injectManifest` (more control than `generateSW`). `skipWaiting()` on install so fresh deploys take effect immediately — essential for hackathon judging where the demo URL might be hit repeatedly.

### ADR-04: 4-tier client-side fallback chain

**Status:** Accepted

**Context:** Emergency app must work in every failure mode.

**Decision:** Backend `/search` → localStorage cache (24h) → bundled JSON → mock data. Each tier explicitly tagged in the response so the UI can show source.

### ADR-05: Leaflet + CartoDB tiles (not Google Maps)

**Status:** Accepted (May 2026, replacing fake SVG)

**Context:** Old build shipped with a hardcoded SVG "map" — fake roads, fake building blocks. Not a real map.

**Options considered:**

| Option | Cost | API key | Bundle | Dark theme |
|---|---|---|---|---|
| Google Maps JS | Free under $200/mo | Yes (already have one) | ~80KB | Custom styling |
| Mapbox GL JS | Free under 50k MAU | Yes (separate) | ~220KB | Built-in |
| **Leaflet + CartoDB Dark Matter** | **Free** | **No** | **~150KB** | **Built-in** |
| OSM raw tiles | Free | No | ~150KB | No (light only) |

**Decision:** Leaflet + CartoDB Dark Matter. No API key burden, matches existing dark theme, ships in any environment.

**Consequences:** OSM tile attribution is legally required (rendered bottom-right). Tile imagery is not yet cached for offline — a future improvement.

### ADR-06: AI triage with deterministic fallback

**Status:** Accepted

**Context:** Claude API can fail (network, quota, malformed JSON). Triage cannot be allowed to block a working contact list.

**Decision:** Claude Haiku 4.5 attempts reorder; if anything fails, 4 explicit priority rules take over.

**Trade-off:** Slightly less context-aware ordering on fallback, but the rules cover the dominant cases (injured/blocking quadrants). Cheap model (Haiku) keeps cost trivial.

---

## 6. Strengths

1. **Reliability-first orchestration.** Every external call has a `_safe_*` wrapper. The API never 5xxs on upstream failure — it degrades to empty contacts with a transparent `source` field.
2. **Cost-aware fallback.** Google Places is paid; the design only invokes it when free Overpass is insufficient (< 3 phoned results), and caps enrichment at 6 Place Details calls/search.
3. **Offline-first frontend.** 4-tier fallback (backend → localStorage → bundled JSON → mock) means the app produces useful output even in a Faraday cage.
4. **Parallelism where it matters.** Geocode and Overpass run concurrently via `asyncio.gather`; clients see max-of-two latency instead of sum.
5. **Multi-mirror Overpass.** Three independent Overpass endpoints with exponential backoff. Single-mirror downtime invisible to users.
6. **Coordinate-grid caching.** 4-decimal rounding (~11m) means a busy demo location (judge hammering the same coords) gets sub-50ms repeat responses.
7. **Smart dedup.** Phone-equality dedup wins over name-match — handles OSM/Google transliteration mismatches (e.g., "GS Custom" vs "gs sustom" with same phone).
8. **Country-aware SOS routing.** WhatsApp vs SMS dispatch chosen per country; no false assumption that everyone uses SMS or WhatsApp.
9. **Two-signal crash detection.** GPS velocity drop + accelerometer spike must agree → meaningfully reduces false positives vs single-sensor designs.
10. **43-language i18n with RTL.** Cover all 22 Indian Schedule-VIII languages plus 20 global. RTL for Urdu/Arabic/Persian/Hebrew/Kashmiri/Sindhi is rendered correctly.
11. **CI with lint + format + tests + conflict detection** is wired for both frontend and backend before any code lands on main.

---

## 7. Weaknesses & Tech Debt

| # | Issue | Severity | Recommended fix |
|---|---|---|---|
| 1 | No integration test for full `/search` flow | Medium | Add `test_search_integration.py` mocking Overpass + Google httpx clients |
| 2 | No tests for Google Places module (`googleplaces_service.py`) | Medium | Mock Google REST responses; test enrichment loop, key rotation |
| 3 | No tests for Nominatim reverse-geocode | Low | Mock httpx; verify country code validation regex |
| 4 | Rate limiter buckets reset on Render cold start | Low | Acceptable for free tier; for prod move to Redis |
| 5 | OSM tiles not cached for offline use | Medium | Add Workbox runtime caching rule for `cartocdn.com/dark_all` pattern |
| 6 | `Mapsplatformkey` env var name (mixed case) — confusing | Low | Already pinned because Render config locks the name. Documented in ruff.toml ignore |
| 7 | `negative caching gap` — phoneless Overpass results don't cache, repeated hits on sparse regions | Low | Cache with shorter TTL (15min) instead of skipping |
| 8 | No structured logging — request_id present but not in log lines per service | Low | Add contextvar with request_id; format logs with it |
| 9 | Bundle size 610KB JS (181 KB gzipped) — Leaflet is heavy | Low | Dynamic import RealMap; render the dock immediately, lazy-load the map |
| 10 | `MOCK_DATA` in `App.jsx` (7 entries, Bengaluru) ships in production bundle | Low | Tree-shake under `if (DEMO_MODE)` |
| 11 | No P99 latency or SLO metrics | Medium | Add `Server-Timing` headers per phase; emit to a stats endpoint |
| 12 | Three Anthropic-Claude bypasses in tests but no test for actual prompt format | Low | Snapshot test on system prompt + golden output for fixed input |
| 13 | Branch protection rules not yet applied (require owner access) | High | Set via Settings → Branches as owner |
| 14 | `--legacy-peer-deps` flag everywhere (i18next peer warnings) | Low | Upgrade `vite-plugin-pwa` to a version compatible with current Vite 8 |
| 15 | No CSRF / origin check on backend POST endpoints | Medium | Add origin allowlist middleware for `/triage`, `/dispatch` |

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation in place? |
|---|---|---|---|
| Render free tier cold start (~30s) | High | High UX | Yes — `startBackendWarmup()` on app mount |
| All 3 Overpass mirrors down | Low | Medium | Yes — falls through to Google + bundled |
| Google API key exhausted | Medium | Low | Yes — multi-key rotation + free Overpass primary |
| Anthropic API outage | Medium | Low | Yes — rule-based triage fallback |
| User in zero-network region | High | High | Yes — bundled facilities cover 196 countries |
| GPS unavailable (indoors) | Medium | Medium | Partial — IP geolocation fallback in `useLocation.js` |
| Browser blocks motion permission | High | Low (crash detection only) | Yes — manual SOS button always works |
| Tile CDN (CartoDB) down | Low | Low | None — markers still render, basemap blank |
| Service worker stuck on stale build | Medium | High | Yes — `skipWaiting()` on install |

---

## 9. Recommendations (Prioritized)

### P0 — Before judging
- [ ] Apply branch protection from owner account
- [ ] Lazy-load `RealMap` to cut initial bundle by ~150KB
- [ ] Add Workbox runtime cache for CartoDB tiles (offline basemap)

### P1 — Quality
- [ ] Integration test for `/search` (mock Overpass + Google)
- [ ] Test coverage for `googleplaces_service.py` enrichment loop
- [ ] Structured logging with `request_id` propagation in service-level logs

### P2 — Production hardening (post-event)
- [ ] Redis-backed rate limiter (survive Render restarts)
- [ ] Origin allowlist on POST endpoints (`/triage`, `/dispatch`)
- [ ] `Server-Timing` headers per orchestration phase
- [ ] Distributed tracing (OpenTelemetry → free Honeycomb / Grafana Cloud tier)
- [ ] Upgrade `vite-plugin-pwa` to remove `--legacy-peer-deps` requirement

---

## 10. Verdict

The architecture is **purpose-fit for an emergency-services demo with hackathon constraints**: every dollar saved (Overpass first, Google capped), every failure mode handled (4-tier offline fallback, 3-layer triage fallback, never-raises orchestration), every byte cached (3-tier coordinate-grid TTL caches). The codebase shows consistent reliability discipline — `try/except` wrappers around every I/O, deterministic fallbacks for AI, graceful degradation everywhere.

Tech debt is **predominantly testing depth and observability**, not structural — there is nothing fundamental to redesign before shipping. Recommendations are additive, not corrective.
