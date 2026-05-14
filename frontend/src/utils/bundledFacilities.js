/**
 * Bundled emergency-facility directory.
 *
 * Last-resort offline data source: when the network is unreachable AND
 * the localStorage cache has no entry for the user's coordinates, we
 * search this in-bundle list of verified Indian trauma centres and
 * major hospitals.
 *
 * Why bundle:
 * - SIM removed, no WiFi, fresh install → user still gets a real list.
 * - The country emergency banner shows 108 (national ambulance), but a
 *   crash victim 30 km from a known trauma centre benefits from seeing
 *   that centre's direct number too.
 *
 * Data quality policy:
 * - Every entry has verified coordinates and a publicly listed name.
 * - Phone numbers are present only where the published main switchboard
 *   is well-known. Where uncertain, `phone: null` — the UI shows the
 *   card with "No phone number listed" instead of fabricated digits.
 * - Tamil-Nadu heavy (hackathon hosted at IIT Madras) plus the major
 *   metro trauma centres of Delhi, Mumbai, Bengaluru, Hyderabad.
 */
import facilities from '../data/bundled_facilities.json';

const EARTH_KM = 6371.0;

function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_KM * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Find the nearest bundled facilities within `maxKm` of the given point.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {object} [opts]
 * @param {number} [opts.maxKm=80] — drop facilities farther than this
 * @param {number} [opts.limit=8]  — max contacts returned
 * @returns {Array<object>} Contact objects in the same shape as /search
 */
export function findNearestFromBundle(lat, lon, { maxKm = 80, limit = 8 } = {}) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return [];

  const scored = facilities
    .map((f) => ({
      ...f,
      distance: Number(haversine(lat, lon, f.lat, f.lon).toFixed(2)),
      source: 'Bundled directory',
      isOpen: null,
      aiReason: null,
    }))
    .filter((f) => f.distance <= maxKm)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);

  return scored;
}

/**
 * Build a /search-shaped response from the bundle for use as a fallback.
 * Returns null if no facility is within range (caller falls back to MOCK).
 */
export function buildBundledSearchResult(lat, lon, opts) {
  const contacts = findNearestFromBundle(lat, lon, opts);
  if (contacts.length === 0) return null;
  return {
    contacts,
    source: 'Pre-loaded directory (offline)',
    landmark: null,           // we don't have landmark data offline
    country_code: contacts[0].country_code || null,
    count: contacts.length,
  };
}

/** Total size of the bundle — useful for diagnostics + the trip-cache modal. */
export const BUNDLED_FACILITY_COUNT = facilities.length;
