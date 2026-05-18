// Backend handles Overpass queries. This wraps the /search API endpoint.

// In production, fall back to the deployed Render backend so the app works
// even if VITE_API_URL env var isn't set on Vercel. In dev, default to ''
// so the Vite proxy handles routing.
// Strip any leading BOM (﻿) that can sneak in when the env var is
// copy-pasted from Windows or a BOM-encoded file into the Vercel dashboard.
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/^﻿/, '')
  || (import.meta.env.PROD ? 'https://roadsos-pl3k.onrender.com' : '');

export async function searchNearby(lat, lon, signal, accuracy = null) {
  // Pass accuracy to backend so it can dynamically choose search radius
  const params = new URLSearchParams({ lat, lon });
  if (accuracy != null) params.append('accuracy', accuracy);
  const res = await fetch(`${API_BASE}/search?${params}`, { signal });
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}
