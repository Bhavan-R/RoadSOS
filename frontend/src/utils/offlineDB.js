const CACHE_KEY_PREFIX = 'roadsos_cache_';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — hospitals don't move; stale-local beats fresh-foreign

function locationKey(lat, lon) {
  // Round to 2 decimal places (~1.1 km grid — high hit rate for same-area revisits)
  return `${CACHE_KEY_PREFIX}${lat.toFixed(2)}_${lon.toFixed(2)}`;
}

export function saveSearchResult(lat, lon, data) {
  try {
    const entry = { data, timestamp: Date.now() };
    localStorage.setItem(locationKey(lat, lon), JSON.stringify(entry));
  } catch {
    // Storage full or unavailable — fail silently
  }
}

export function loadSearchResult(lat, lon) {
  try {
    const raw = localStorage.getItem(locationKey(lat, lon));
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > TTL_MS) {
      localStorage.removeItem(locationKey(lat, lon));
      return null;
    }
    return { ...entry.data, cachedAt: new Date(entry.timestamp).toLocaleString() };
  } catch {
    return null;
  }
}

export function clearCache() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_KEY_PREFIX)) keysToRemove.push(key);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch {
    // silent
  }
}
