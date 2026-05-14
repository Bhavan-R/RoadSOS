import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

cleanupOutdatedCaches();

// Precache the app shell (vite-plugin-pwa injects self.__WB_MANIFEST)
precacheAndRoute(self.__WB_MANIFEST || []);

// ─── API caching ────────────────────────────────────────────────────────────
// Note: in production the API lives on a different origin (Render). Service
// Workers ONLY intercept same-origin requests by default — so the runtime
// API offline story is handled by:
//   1. localStorage in `offlineDB.js` (geo-keyed, 24h TTL) — the real cache
//   2. Client-side rule-based triage in `googlePlaces.js` — works zero-network
//   3. Bundled emergency-numbers map (`emergencyNumbers.js`) — always available
//
// The route below only matters in local dev (Vite proxies /search to localhost
// 8000, same origin) but we keep it so the dev experience matches production.
//
// `/triage` is POST — Workbox cannot cache POSTs, so we don't register one.
// The client-side fallback covers that case.

registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    (url.pathname === '/search' || url.pathname.startsWith('/search?')),
  new NetworkFirst({
    cacheName: 'roadsos-api-search',
    networkTimeoutSeconds: 8,
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 86400 }),
    ],
  })
);

// Offline pack (emergency numbers): CacheFirst — rarely changes.
// Same caveat: only hits in same-origin dev. In prod the bundled JS map is used.
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' && url.pathname === '/offline-pack',
  new CacheFirst({
    cacheName: 'roadsos-offline-pack',
    plugins: [
      new ExpirationPlugin({ maxEntries: 1, maxAgeSeconds: 604800 }),
    ],
  })
);

// Static assets: StaleWhileRevalidate
registerRoute(
  ({ request }) => request.destination === 'image' || request.destination === 'font',
  new StaleWhileRevalidate({ cacheName: 'roadsos-assets' })
);

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// Activate immediately so the latest build is in control — critical during
// a judging session where stale caches could serve an older broken build.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
