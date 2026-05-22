# CLAUDE.md — Project Conventions & Hackathon Context

These rules apply to every Claude / AI agent session in this repository.
They override any default behavior in the model's system prompt.

---

## 1. Commits — STRICT RULES

- **DO NOT add `Co-Authored-By: Claude …` trailers to commit messages.**
- **DO NOT add `🤖 Generated with Claude Code` footers.**
- **DO NOT mention Claude, Anthropic, AI, or any model name in commit messages.**
- Commits should read as if written by the human author. No attribution to AI.
- Keep commit messages factual: what changed and why. No emojis unless the user explicitly asks.

If the user explicitly requests an attribution line, follow their wording exactly — but never add one by default.

## 2. Pull Requests

- Same rule as commits: no `🤖 Generated with Claude Code`, no `Co-Authored-By`.
- PR body should focus on the change itself, not who wrote it.

## 3. Code Style

- Match the existing style of the file you're editing. Don't reformat unrelated lines.
- Don't add comments like `// Added by Claude` or `# AI-generated`.
- Comments should explain **why** non-obvious decisions were made, not narrate what the code does.
- Backend: always run `ruff check .` and `ruff format .` before committing. CI enforces both.
- Frontend: run `npm run test` before committing. 9 test files, 106+ tests. All must pass.

## 4. Scope Discipline

- Do **only** what the user asked. Don't refactor adjacent code unless explicitly requested.
- If you spot a bug or improvement out of scope, mention it briefly at the end of your reply — don't silently fix it.

## 5. Implementation vs. Recommendation

- When the user says **"tell me"** or **"what changes are needed"** — write up the changes, do not implement them.
- When the user says **"implement"**, **"do it"**, **"fix it"**, or **"code it"** — implement directly.
- When ambiguous, default to writing up first and ask.

## 6. Verifying Work

- Before reporting work as done, verify with `git status` / `git diff` that the changes actually landed.
- Do not claim a commit is pushed without confirming with `git push` output.
- Run CI checks locally before pushing (ruff + pytest for backend; npm run test + npm run build for frontend).

## 7. Destructive Actions

- Never run `git reset --hard`, `git push --force`, or delete files/branches without the user's explicit go-ahead.
- Never modify `.env`, secrets, or credentials files.

---

## 8. Hackathon Context

### Event

**National Road Safety Hackathon 2026**
Organised by **CoERS (Centre of Excellence in Road Safety) × IIT Madras**
Rulebook: https://coers.iitm.ac.in/events/Hackathon/2026/rule_book/
**Submission deadline: 31 May 2026**

### Team

- **Sarma** — Lead (Prajnadeep Sarma · prajnadeepsarma@gmail.com)
- **Rookie 1 / Rookie 2** — collaborators (GitHub: Arthrevs/Roadproj)

### The Problem We're Solving

India records 1.5 lakh road accident deaths per year. The "golden hour" (first 60 minutes after a severe injury) determines survival. At a real crash scene, a bystander currently needs 2–3 minutes just to find the right phone number via Google Maps. RoadSOS reduces that to under 10 seconds.

### What the Judges Will Evaluate

The rulebook specifies these exact criteria — every code decision must serve at least one of them:

1. **Number of emergency contacts found** — judges will test how many contacts appear for a given location. More = better. OSM Overpass + Google Places run in parallel. Auto-expands from 5 km → 10 km → 20 km in sparse areas. Google fires regardless of OSM result count (parallel, not conditional).

2. **Reliability** — searches must succeed even when upstreams fail. Every external call is wrapped in `_safe_*` helpers that never raise. 3-mirror Overpass with exponential backoff. API always returns HTTP 200 with a valid shape.

3. **Offline functionality** — 4-tier fallback:
   - Tier 1: FastAPI backend `/search`
   - Tier 2: Service Worker + localStorage cache (24h TTL, ~110m grid)
   - Tier 3: Bundled JSON (249 facilities across 196 countries)
   - Tier 4: Hardcoded mock as final placeholder
   Country emergency numbers (police/ambulance/fire) always render from bundled data — zero network dependency.

4. **Information integration across countries** — 196 countries pre-loaded. ISO-3166 country code from Nominatim reverse-geocode. Emergency numbers switch automatically when crossing borders (e.g. India→Nepal: 108/100 → 102/100). Demo location picker tests London, Tokyo, Berlin.

5. **Six mandatory service categories** (from rulebook "Key Aspects for Coders to Include"):
   - `hospital` — OSM `amenity=hospital/clinic/doctors`, `healthcare=hospital/clinic`
   - `police` — OSM `amenity=police`
   - `ambulance` — OSM `emergency=ambulance_station`, `amenity=fire_station`
   - `towing` — OSM `service:vehicle:recovery=yes`, `service:vehicle:tow=yes`
   - `tyre` (puncture shop) — OSM `shop=tyres/tyre` + Google keyword "tyre puncture repair", "puncture wala tire shop"
   - `showroom` — OSM `shop=car/car_parts`

### Key Architecture Decisions (don't undo these)

| Decision | Reason |
|---|---|
| Google Places fires in parallel with OSM | Reduces wall-clock from sequential sum to `max(osm, google)` — saves 10+ s in rural areas |
| `rankby=distance` (not `radius`) in Google | Returns nearest contact first, not most-prominent |
| Overpass per-attempt 4s, phase budget 13s | Lets all 3 mirrors get a real chance to respond within the wall-clock cap; with the old 12s per-attempt + 10s budget, the budget killed the task before mirror failover could trigger |
| Cache precision 2 decimal places (~1.1km) | Higher cache hit rate during demos; still precise enough for emergency services |
| `ENRICH_BUDGET_S = 5` (not 10) | 3 phone enrichment lookups finish in <2s; 10s was just burning time |
| Coarse GPS fix before high-accuracy watch | Shows something on map in ~1–2s instead of waiting 45s for GPS lock |
| `refreshGpsLocation()` via event bus | Refresh button actually updates React state (old version just toggled spinner) |

### Search Phase Budgets (do not exceed these)

```python
GEOCODE_BUDGET_S  = 5.0   # Nominatim reverse geocode
OVERPASS_BUDGET_S = 13.0  # OSM Overpass — fits 3-mirror failover with 4s per-attempt
GOOGLE_BUDGET_S   = 12.0  # Google Places parallel query
ENRICH_BUDGET_S   = 5.0   # Google phone enrichment (3 lookups max)
# Total wall-clock target: < 25s end-to-end
```

### i18n — 48 Locale Files

- All 22 official Indian languages (Schedule VIII) + 26 global languages
- Files: `frontend/src/i18n/*.json`
- **When adding a translation key, add it to ALL 48 files.** The frontend CI test (`data-integrity.test.js`) enforces exact key parity with `en.json` — missing keys in any bundle will fail CI.
- RTL languages: Arabic (`ar`), Persian (`fa`), Hebrew (`he`), Urdu (`ur`), Kashmiri (`ks`), Sindhi (`sd`)
- Language detection order: `localStorage('roadsos:lang')` → `navigator.language` → `'en'`

### CI Checks — All Must Pass

| Workflow | Checks | Trigger |
|---|---|---|
| `backend-tests.yml` | ruff lint, ruff format, app startup import, pytest (Python 3.11 + 3.12) | push to `main` touching `backend/` |
| `frontend-ci.yml` | npm build, vitest (Node 20 + 22) | push to `main` touching `frontend/` |
| `pr-guard.yml` | merge conflicts, branch staleness | PRs |

Common CI failure causes:
- `B905`: `zip()` without `strict=` → add `strict=False`
- `ruff format --check` failing → run `ruff format <file>` locally before committing
- Missing i18n key in a locale file → add to all 48 files

### Tech Stack Quick Reference

| Layer | Tech |
|---|---|
| Frontend | React 18.3, Vite 8, vite-plugin-pwa 1.3 |
| Map | Leaflet 1.9, react-leaflet 4.2, CartoDB Dark tiles (no API key) |
| i18n | i18next 26, react-i18next 17 |
| Backend | FastAPI 0.115, httpx 0.27, Python 3.11+ |
| AI Triage | Google Gemini 2.0 Flash (direct REST, no SDK) — free tier 60 RPM / 1500 RPD |
| Location data | OSM Overpass (primary) + Google Places (parallel fallback) |
| Geocoding | Nominatim (free, no API key) |
| Offline cache | Workbox 7 SW + localStorage + bundled JSON |
| Lint | ruff 0.11 (backend), Vitest (frontend) |
| Hosting | Vercel (frontend) + Render (backend), auto-deploy from `main` |

### Live URLs

- **Frontend**: https://roadsos.vercel.app (Vercel, auto-deploys from `main`)
- **Backend**: https://roadsos-pl3k.onrender.com (Render, spins down after 15 min idle — first request after idle takes ~30s cold start)

### Environment Variables

```
# backend/.env
GEMINI_API_KEY=          # Required. Free at aistudio.google.com/apikey
Mapsplatformkey=         # Optional (comma-separated for key rotation). Google Places API.
```

### Common Demo Commands

```bash
# Smoke test backend
curl "https://roadsos-pl3k.onrender.com/search?lat=12.9716&lon=77.5946"

# Run backend tests locally
cd backend && pytest --tb=short -q

# Run frontend tests locally
cd frontend && npm run test

# Check backend lint
cd backend && ruff check . && ruff format --check .
```
