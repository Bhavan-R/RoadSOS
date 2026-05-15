/**
 * Free-text → coordinates geocoder for the trip planner.
 *
 * Uses the public Nominatim endpoint (same one the backend uses for
 * reverse geocoding). Nominatim's policy: max 1 request per second per
 * client, must set an identifiable User-Agent / Referer. Browsers send
 * Referer automatically.
 *
 * We deliberately *don't* fall back to coordinates when offline — typing
 * "Chennai" with no network gives a useful error message so the user
 * either retries online or picks a city from the chip presets (which
 * have coords baked in and don't need geocoding).
 *
 * Results are LRU-cached in localStorage so the same lookup never hits
 * the network twice. 7-day TTL.
 */

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const CACHE_KEY_PREFIX = 'roadsos_geocode_v1__';
const SUGGEST_KEY_PREFIX = 'roadsos_geosug_v1__';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function cacheGet(prefix, q) {
  try {
    const raw = localStorage.getItem(prefix + q.toLowerCase());
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.t > TTL_MS) return null;
    return entry.v;
  } catch { return null; }
}

function cacheSet(prefix, q, v) {
  try {
    localStorage.setItem(
      prefix + q.toLowerCase(),
      JSON.stringify({ v, t: Date.now() })
    );
  } catch { /* localStorage may be full */ }
}

/**
 * Forward-geocode a free-text place name to a list of candidate hits.
 *
 * Used by the autocomplete dropdown in the trip planner — same town
 * name often exists in multiple countries (e.g. "Junai" in Assam vs in
 * San Vicente). Returning N candidates lets the user disambiguate
 * visually instead of trusting Nominatim's "best match".
 *
 * Cached per-query for 7 days. Hits the network at most once per term.
 *
 * @param {string} query  — e.g. "Junai", "Chennai", "Times Square"
 * @param {number} [limit=5]
 * @returns {Promise<Array<{lat: number, lon: number, displayName: string, shortName: string}>>}
 */
export async function searchPlaces(query, limit = 5) {
  const q = (query || '').trim();
  if (q.length < 1) return [];

  const cached = cacheGet(SUGGEST_KEY_PREFIX, q);
  if (cached) return cached.slice(0, limit);

  const url = `${ENDPOINT}?q=${encodeURIComponent(q)}&format=json&limit=${limit}&addressdetails=1`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const out = data
      .map((hit) => {
        const lat = parseFloat(hit.lat);
        const lon = parseFloat(hit.lon);
        if (!isFinite(lat) || !isFinite(lon)) return null;
        const display = hit.display_name || q;
        // First comma-separated segment becomes the bold "primary" line.
        const [shortName, ...rest] = display.split(',');
        return {
          lat,
          lon,
          displayName: display,
          shortName: (shortName || q).trim(),
          context: rest.join(',').trim(),
        };
      })
      .filter(Boolean);

    cacheSet(SUGGEST_KEY_PREFIX, q, out);
    return out;
  } catch {
    return [];
  }
}

/**
 * Convenience wrapper that returns just the first hit. Kept for callers
 * that don't need the full candidate list.
 */
export async function geocodePlace(query) {
  const q = (query || '').trim();
  if (q.length < 1) return null;
  // Use the legacy single-hit cache so we don't double-store.
  const cached = cacheGet(CACHE_KEY_PREFIX, q);
  if (cached) return cached;
  const list = await searchPlaces(q, 1);
  if (list.length === 0) return null;
  const out = {
    lat: list[0].lat,
    lon: list[0].lon,
    displayName: list[0].displayName,
  };
  cacheSet(CACHE_KEY_PREFIX, q, out);
  return out;
}

/**
 * A small set of quick-pick city chips that fill the input without a
 * network call. We keep this short and India-leaning — the typed-input
 * path handles every other location the user might want.
 */
export const QUICK_PICK_CITIES = [
  { name: 'Chennai',    lat: 13.0827, lon: 80.2707 },
  { name: 'Bengaluru',  lat: 12.9716, lon: 77.5946 },
  { name: 'Coimbatore', lat: 11.0168, lon: 76.9558 },
  { name: 'Mumbai',     lat: 19.0760, lon: 72.8777 },
  { name: 'Delhi',      lat: 28.6139, lon: 77.2090 },
  { name: 'Hyderabad',  lat: 17.3850, lon: 78.4867 },
  { name: 'Kolkata',    lat: 22.5726, lon: 88.3639 },
  { name: 'Pune',       lat: 18.5204, lon: 73.8567 },
];
