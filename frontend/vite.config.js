import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectManifest: {
        swSrc: 'public/sw.js',
        swDest: 'dist/sw.js',
      },
      manifest: {
        name: 'RoadSOS',
        short_name: 'RoadSOS',
        description: 'Emergency contact finder for road accidents. Works offline.',
        theme_color: '#c0392b',
        background_color: '#1a1a2e',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/search'          : 'http://localhost:8000',
      '/triage'          : 'http://localhost:8000',
      '/dispatch-summary': 'http://localhost:8000',
      '/health'          : 'http://localhost:8000',
      '/offline-pack'    : 'http://localhost:8000',
    },
  },
});
