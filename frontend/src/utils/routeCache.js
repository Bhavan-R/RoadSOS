/**
 * Route pre-cache for offline-by-design road trips.
 *
 * Workflow:
 *   1. User picks origin + destination *before* leaving home (online).
 *   2. We ask OSRM (public, no key) for the actual driving polyline.
 *   3. We sample N waypoints evenly along that polyline.
 *   4. For each waypoint we hit /search and persist the result in
 *      localStorage via offlineDB.js using the same grid key the live
 *      app reads. The Service Worker also picks up the responses.
 *   5. When the user crashes in a dead zone on that highway, the
 *      app's existing offline fallback chain hits the localStorage
 *      entry seeded here and shows real local contacts.
 *
 * Reliability notes:
 * - OSRM falls back to great-circle interpolation if the routing call
 *   fails — better degraded coverage than no coverage.
 * - Concurrency capped at 3 in-flight `/search` calls so we don't trip
 *   the backend's per-IP rate limiter (30/min) or burn API quota.
 * - Progress callbacks fire after every waypoint so the UI can render
 *   a smooth bar.
 */
import { searchNearby } from './overpass';
import { saveSearchResult } from './offlineDB';

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';
const DEFAULT_WAYPOINTS = 6;

/** Sample N evenly-spaced points from a polyline of [lon, lat] pairs. */
function sampleEvenly(coords, n) {
  if (coords.length === 0) return [];
  if (coords.length <= n) return coords;
  const step = (coords.length - 1) / (n - 1);
  const out = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.round(i * step);
    out.push(coords[Math.min(idx, coords.length - 1)]);
  }
  return out;
}

/** Linear interpolation between two points — used when OSRM is unreachable. */
function greatCircleInterpolate(origin, destination, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    out.push([
      origin.lon + (destination.lon - origin.lon) * t,
      origin.lat + (destination.lat - origin.lat) * t,
    ]);
  }
  return out;
}

/** Fetch the OSRM driving polyline. Returns array of [lon, lat] or null. */
async function fetchOSRMPolyline(origin, destination) {
  const url =
    `${OSRM_URL}/${origin.lon},${origin.lat};${destination.lon},${destination.lat}` +
    `?overview=full&geometries=geojson`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const coords = data?.routes?.[0]?.geometry?.coordinates;
    return Array.isArray(coords) && coords.length > 0 ? coords : null;
  } catch {
    return null;
  }
}

/**
 * Pre-fetch and cache /search results for a trip.
 *
 * @param {object} origin       { lat, lon, name? }
 * @param {object} destination  { lat, lon, name? }
 * @param {object} [opts]
 * @param {number} [opts.waypoints=6]
 * @param {(progress: { done, total, lastPoint, status }) => void} [opts.onProgress]
 * @returns {Promise<{ cached: number, total: number, polylineSource: 'osrm' | 'linear' }>}
 */
export async function prefetchRoute(origin, destination, opts = {}) {
  const { waypoints = DEFAULT_WAYPOINTS, onProgress } = opts;

  // 1. Get a polyline — prefer OSRM, fall back to linear interpolation.
  let polyline = await fetchOSRMPolyline(origin, destination);
  const polylineSource = polyline ? 'osrm' : 'linear';
  if (!polyline) {
    polyline = greatCircleInterpolate(origin, destination, waypoints * 4);
  }

  // 2. Sample evenly-spaced waypoints.
  const samples = sampleEvenly(polyline, waypoints);
  const total = samples.length;

  // 3. Prefetch each waypoint, bounded concurrency = 3.
  let cached = 0;
  let inflight = 0;
  let cursor = 0;

  const fireOne = async (idx) => {
    const [lon, lat] = samples[idx];
    inflight += 1;
    onProgress?.({ done: cached, total, lastPoint: { lat, lon }, status: 'fetching' });
    try {
      const data = await searchNearby(lat, lon);
      saveSearchResult(lat, lon, data);
      cached += 1;
    } catch {
      // Single waypoint failure shouldn't abort the whole trip cache.
    } finally {
      inflight -= 1;
      onProgress?.({ done: cached, total, lastPoint: { lat, lon }, status: 'waypoint_done' });
    }
  };

  // Worker-pool pattern: keep up to 3 requests in flight at any time.
  await new Promise((resolve) => {
    const tick = () => {
      while (inflight < 3 && cursor < total) {
        fireOne(cursor++).then(tick);
      }
      if (cursor >= total && inflight === 0) resolve();
    };
    tick();
  });

  onProgress?.({ done: cached, total, status: 'complete' });
  return { cached, total, polylineSource };
}

// Quick-pick city presets moved to `geocode.js` (`QUICK_PICK_CITIES`)
// alongside the free-text geocoder they back up.
