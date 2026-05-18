const CACHE_KEY_PREFIX = 'roadsos_cache_';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function locationKey(lat, lon) {
  // Round to 2 decimal places (~1.1km grid)
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

/**
 * Get offline fallback for nearby cities when online search is unavailable.
 * Uses precompiled 200-city dataset as last-resort when no cached results nearby.
 * Distance calculated via haversine; returns up to 10 closest cities with emergency #s.
 */
export async function getOfflineNearestCities(lat, lon, maxResults = 10) {
  try {
    const response = await fetch('/data/offline_cities_fallback.json');
    if (!response.ok) return [];
    const { cities } = await response.json();
    
    // Calculate distances using Haversine formula
    const R = 6371; // Earth's radius in km
    const nearby = cities
      .map(city => {
        const dLat = (city.lat - lat) * (Math.PI / 180);
        const dLon = (city.lon - lon) * (Math.PI / 180);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(lat * (Math.PI / 180)) *
            Math.cos(city.lat * (Math.PI / 180)) *
            Math.sin(dLon / 2) ** 2;
        const distance = R * 2 * Math.asin(Math.sqrt(a));
        return { ...city, distance };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxResults);
    
    return nearby;
  } catch {
    return []; // Fallback gracefully
  }
}
