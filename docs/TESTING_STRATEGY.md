# Testing Strategy

**Question asked:** *Are the tests we have enough, or should we add more?*

**Short answer:** What we have is solid for unit-level correctness but has three structural gaps. The recommendations below are ordered by ratio of impact to effort.

---

## 1. Current Coverage Inventory

### Backend (10 test files, ~810 LOC)

| File | LOC | What it locks down |
|---|---|---|
| `test_overpass.py` | 207 | Overpass element parsing, haversine accuracy, proximity dedup, category classification, query builder |
| `test_middleware.py` | 107 | RequestID propagation, log line format, ErrorHandlingMiddleware → 503 |
| `test_overpass_parsing.py` | 93 | Edge-case element shapes: ways without center, tags missing |
| `test_ai_triage.py` | 90 | All 4 rule-based fallback orderings; AI JSON validation; count mismatch detection |
| `test_phone_utils.py` | 75 | E.164 normalisation, `is_dialable` (3–15 digits), `phones_match` (last-10) |
| `test_search_service.py` | 63 | `deduplicate()`: invalid dicts, empty names, case-insensitive name, phone equality |
| `test_hours_parser.py` | 56 | `opening_hours`: `24/7`, day ranges, time ranges, holidays |
| `test_cache.py` | 52 | TTL expiry, LRU eviction, hit/miss stats, `location_key` |
| `test_rate_limiter.py` | 39 | Token bucket refill, `X-Forwarded-For` extraction, retry-after |
| `test_geocoder.py` | 25 | ISO-3166 alpha-2 country code regex |

### Frontend (6 test files, ~640 LOC)

| File | LOC | What it locks down |
|---|---|---|
| `geocode.test.js` | 166 | Trip-planner geocoder: fetch + localStorage mocked; cache hits, miss flow |
| `medicalId.test.js` | 104 | On-device emergency-contact store + SOS-by-SMS composer |
| `routeCache.test.js` | 103 | Route prefetch: city presets, shape validation |
| `bundledFacilities.test.js` | 98 | Spatial search: closest-first ordering, radius expansion |
| `plusCodes.test.js` | 93 | Plus Code encoder: round-trip with canonical codes |
| `googlePlaces.test.js` | 82 | Client-side rule-based triage: all 4 crash scenarios |

### CI Status

All three workflows green on `main`: `frontend-ci.yml` (Node 20+22 build+vitest), `backend-tests.yml` (ruff → startup → pytest 3.11+3.12), `pr-guard.yml` (conflict + staleness).

---

## 2. Structural Gaps

Three gaps where adding tests would tighten the safety net materially:

### Gap A — No integration test for `/search`

Every component of the orchestrator is unit-tested in isolation, but no test exercises the full pipeline: Phase 1 parallel geocode + Overpass → Phase 2 conditional Google → Phase 3 merge/dedupe → Phase 4 phone enrichment. A regression that, for instance, broke `asyncio.gather` ordering or changed the dedup contract would slip through.

### Gap B — Zero tests for `googleplaces_service.py`

The entire Google Places integration is untested. Concretely missing:

- Multi-key rotation (`Mapsplatformkey` comma-split)
- Place Details enrichment loop respecting the 6-call cap
- Find-Place-from-Text → Nearby-Search fallback path
- "No key configured" silent disable

### Gap C — No data-integrity assertions

The dataset behind the offline tier is large and easy to break by hand:

- `bundled_facilities.json` — 249 entries, every entry needs valid `lat`, `lon`, `category`, `country_code`
- `emergencyNumbers.js` — every ISO-3166 country code that has bundled facilities should also have an emergency number entry
- 48 i18n JSON bundles — should all carry the same key set; a missing key in one file causes UI text to fall back silently

Today's audit (May 2026) shows the data is clean: 249 facilities × 196 unique countries, all 48 i18n bundles have all 49 keys. The risk is that nothing locks this in for the future. One typo in a PR could silently degrade an offline scenario for a single country, and no CI signal would fire.

---

## 3. Recommended Additions, by Leverage

The three additions below are all small, all high-signal, and address the three gaps above:

### P0 — Data-integrity tests (highest leverage, smallest effort)

Single Vitest file that asserts:

1. Every entry in `bundled_facilities.json` has `id`, `name`, `category`, `country_code`, `lat ∈ [-90, 90]`, `lon ∈ [-180, 180]`.
2. Every distinct `country_code` in `bundled_facilities.json` also appears in `emergencyNumbers.js`.
3. Every i18n bundle has exactly the same key set as `en.json`.
4. Every locale in `locales.js` has a matching JSON bundle.

**Why P0:** runs in 50 ms, no mocks, no flake risk. Catches the kind of one-line PR mistake that's invisible at review time but breaks an offline experience for a real country.

### P1 — Backend integration test for `/search`

One test using `httpx.MockTransport` (or `respx`) to inject canned Overpass + Google + Nominatim responses. Asserts the response shape, dedup behaviour across sources, and the never-5xx guarantee when every upstream is mocked to fail.

**Why P1:** locks in the full pipeline contract. Cheap because all collaborators are already designed for mocking (httpx everywhere). Three test cases cover most of the contract: happy path, all-fail path, "Overpass returns 2 phoned → Google fires" path.

### P2 — Google Places service tests

Three tests using mocked httpx for `googleplaces_service.py`:

1. Multi-key rotation cycles through the comma-separated list.
2. Enrichment loop stops at the 6-call cap even when 20 contacts lack phones.
3. Missing API key returns empty list cleanly, no exception.

**Why P2:** lower priority because the orchestration test (P1) covers the failure path indirectly. But Google Places is the only service module with zero direct tests.

---

## 4. Explicitly Not Recommended

The following would not add value relative to their cost:

| Test type | Why skip |
|---|---|
| E2E browser tests (Playwright / Cypress) | High maintenance overhead. Most failures they catch are already caught by Vitest + integration tests. |
| Visual regression tests | Stitch-style mockups change weekly during development. Snapshots would be churn-only. |
| Load tests | No production traffic to baseline against. In-memory cache hit rates can be reasoned from cache size. |
| Mutation testing | Useful at scale, distracting at hackathon scope. |
| Tests for `RealMap.jsx` (Leaflet rendering) | Leaflet draws to canvas/DOM and JSDOM doesn't render it; tests would mock so heavily they'd verify mocks, not behaviour. |

---

## 5. Implementation Decisions

Implementing P0 immediately (committed alongside this document). P1 and P2 are next-tier items — written up clearly enough that any developer can pick them up.

The new P0 test file is `frontend/src/__tests__/data-integrity.test.js`. It runs as part of the existing Vitest suite, so the frontend CI workflow picks it up automatically with no workflow changes.
