// Backend handles Overpass queries. This wraps the /search API endpoint.

// In production, fall back to the deployed Render backend so the app works
// even if VITE_API_URL env var isn't set on Vercel. In dev, default to ''
// so the Vite proxy handles routing.
const API_BASE = import.meta.env.VITE_API_URL
  || (import.meta.env.PROD ? 'https://roadsos-pl3k.onrender.com' : '');

export async function searchNearby(lat, lon, signal) {
  const res = await fetch(`${API_BASE}/search?lat=${lat}&lon=${lon}`, { signal });
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}
