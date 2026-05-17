/**
 * Real-time location tracking session.
 *
 * After SOS fires, call createTrackingSession() to get a short-lived URL
 * (valid 2 h) that an emergency contact can open to see the victim's
 * last-known coordinates on a live map.
 *
 * The URL points to the backend's /track/{token} HTML page, which
 * auto-refreshes every 30 s and embeds a Leaflet map.
 *
 * If the backend is unreachable (cold start / offline), returns null —
 * the caller should degrade gracefully.
 */

// Production fallback to deployed Render backend if env var is missing.
// Strip any leading BOM that can appear when pasting into the Vercel dashboard.
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/^﻿/, '')
  || (import.meta.env.PROD ? 'https://roadsos-pl3k.onrender.com' : '');

/**
 * Create a tracking session on the backend.
 *
 * @param {{ lat: number, lon: number }} location
 * @param {string} [landmark]
 * @returns {Promise<string | null>}  Full tracking URL, or null on failure.
 */
export async function createTrackingSession(location, landmark) {
  if (!location?.lat || !location?.lon) return null;
  try {
    const res = await fetch(`${API_BASE}/track`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        lat     : location.lat,
        lon     : location.lon,
        landmark: landmark || '',
      }),
      signal: AbortSignal.timeout(8_000),   // don't block indefinitely
    });
    if (!res.ok) return null;
    const { token } = await res.json();
    // The tracking page is rendered by the backend
    const backendBase = import.meta.env.VITE_API_URL
      || (import.meta.env.PROD ? 'https://roadsos-pl3k.onrender.com' : window.location.origin);
    return `${backendBase}/track/${token}`;
  } catch {
    return null;   // offline, cold start, or timeout
  }
}

/**
 * Push an updated position to an existing tracking session.
 * Fire-and-forget — callers don't need to await this.
 *
 * @param {string}  trackingUrl  URL returned by createTrackingSession
 * @param {{ lat: number, lon: number }} location
 * @param {string}  [landmark]
 */
export async function updateTrackingSession(trackingUrl, location, landmark) {
  if (!trackingUrl || !location?.lat) return;
  try {
    // Extract token from the URL's last path segment
    const token = trackingUrl.split('/').pop();
    const patchUrl = trackingUrl.replace(/\/track\/[^/]+$/, `/track/${token}`);
    await fetch(patchUrl.replace('/track/', '/track/').replace(token, token), {
      method : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        lat     : location.lat,
        lon     : location.lon,
        landmark: landmark || '',
      }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // Best-effort — silently drop
  }
}
