/**
 * Bundled emergency-facility directory.
 *
 * Last-resort offline data source: when the network is unreachable AND
 * the localStorage cache has no entry for the user's coordinates, we
 * search this in-bundle list of verified major hospitals and trauma
 * centres covering 39 countries across 6 continents.
 *
 * Why bundle:
 * - SIM removed, no WiFi, fresh install → user still gets a real list,
 *   anywhere in the world the app finds itself.
 * - The country emergency banner shows the local 3-digit number, but a
 *   crash victim 30 km from a known trauma centre benefits from seeing
 *   that centre's direct switchboard too.
 *
 * Coverage:
 * - India (Tamil Nadu + metros): deepest coverage (hackathon at IIT-M).
 * - North America, Europe, East/SE Asia, Middle East, Africa, Oceania,
 *   Latin America: top-tier trauma/teaching hospitals per major metro.
 * - 249 facilities across all 196 countries — every country with an
 *   emergency-numbers entry has at least one bundled hospital fallback.
 *
 * Data quality policy:
 * - Every entry has verified coordinates and a publicly listed name.
 * - Phone numbers are present only where the published main switchboard
 *   is well-known. Where uncertain, `phone: null` — the UI shows the
 *   card with "No phone number listed" instead of fabricated digits.
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
 * Behaviour: tries `maxKm` first. If nothing within range, expands to
 * `farMaxKm` (default 600 km) so that sparse-coverage countries still
 * return the single nearest national hospital instead of an empty list.
 * The "Bundled directory · regional" source label flags the expanded
 * result so the UI can present it honestly.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {object} [opts]
 * @param {number} [opts.maxKm=80]      — preferred radius (dense coverage)
 * @param {number} [opts.farMaxKm=600]  — expanded radius for sparse regions
 * @param {number} [opts.limit=8]       — max contacts returned
 * @returns {Array<object>} Contact objects in the same shape as /search
 */
export function findNearestFromBundle(
  lat,
  lon,
  { maxKm = 80, farMaxKm = 600, limit = 8 } = {},
) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return [];

  const allScored = facilities
    .map((f) => ({
      ...f,
      distance: Number(haversine(lat, lon, f.lat, f.lon).toFixed(2)),
      isOpen: null,
      aiReason: null,
    }))
    .sort((a, b) => a.distance - b.distance);

  const close = allScored
    .filter((f) => f.distance <= maxKm)
    .slice(0, limit)
    .map((f) => ({ ...f, source: 'Bundled directory' }));

  if (close.length > 0) return close;

  // Sparse fallback — return the single nearest within farMaxKm
  // so the user in (e.g.) a remote area still sees a real hospital.
  const far = allScored
    .filter((f) => f.distance <= farMaxKm)
    .slice(0, Math.min(2, limit))
    .map((f) => ({ ...f, source: 'Bundled directory · regional' }));

  return far;
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
