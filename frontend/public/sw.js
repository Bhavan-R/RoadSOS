import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

cleanupOutdatedCaches();

// Precache the app shell (vite-plugin-pwa injects self.__WB_MANIFEST)
precacheAndRoute(self.__WB_MANIFEST || []);

// API search results: NetworkFirst with 8s timeout, fallback to cache
registerRoute(
  ({ url }) => url.pathname === '/search' || url.pathname.startsWith('/search'),
  new NetworkFirst({
    cacheName: 'roadsos-api-search',
    networkTimeoutSeconds: 8,
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 86400 }),
    ],
  })
);

// Triage endpoint: NetworkFirst, short cache
registerRoute(
  ({ url }) => url.pathname === '/triage',
  new NetworkFirst({
    cacheName: 'roadsos-api-triage',
    networkTimeoutSeconds: 10,
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 3600 }),
    ],
  })
);

// Offline pack (emergency numbers): CacheFirst — rarely changes
registerRoute(
  ({ url }) => url.pathname === '/offline-pack',
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
