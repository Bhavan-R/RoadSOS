// Backend handles Overpass queries. This wraps the /search API endpoint.

const API_BASE = import.meta.env.VITE_API_URL || '';

export async function searchNearby(lat, lon, signal) {
  const res = await fetch(`${API_BASE}/search?lat=${lat}&lon=${lon}`, { signal });
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}
