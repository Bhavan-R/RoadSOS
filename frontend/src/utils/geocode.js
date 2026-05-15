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
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function cacheGet(q) {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + q.toLowerCase());
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.t > TTL_MS) return null;
    return entry.v;
  } catch { return null; }
}

function cacheSet(q, v) {
  try {
    localStorage.setItem(
      CACHE_KEY_PREFIX + q.toLowerCase(),
      JSON.stringify({ v, t: Date.now() })
    );
  } catch { /* localStorage may be full */ }
}

/**
 * Forward-geocode a free-text place name to { lat, lon, displayName }.
 *
 * @param {string} query  — e.g. "Chennai", "Guwahati", "Times Square NYC"
 * @returns {Promise<{lat: number, lon: number, displayName: string} | null>}
 */
export async function geocodePlace(query) {
  const q = (query || '').trim();
  if (q.length < 2) return null;

  const cached = cacheGet(q);
  if (cached) return cached;

  const url = `${ENDPOINT}?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=0`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const hit = data[0];
    const out = {
      lat: parseFloat(hit.lat),
      lon: parseFloat(hit.lon),
      displayName: hit.display_name || q,
    };
    if (!isFinite(out.lat) || !isFinite(out.lon)) return null;
    cacheSet(q, out);
    return out;
  } catch {
    return null;
  }
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
