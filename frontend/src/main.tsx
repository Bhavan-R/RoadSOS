import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n';
import './style.css';
import './final-design.css';

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ── Service worker auto-update ─────────────────────────────────────────────
// When a new build deploys, the browser downloads the updated sw.js.
// skipWaiting() makes the new SW activate immediately; clients.claim()
// fires controllerchange on open pages.  We reload so the new bundle loads.
//
// IMPORTANT: capture hadController BEFORE adding the listener.
// On first SW install, controller is null → claim() fires controllerchange
// with null→SW transition.  We must NOT reload in that case or we get an
// infinite reload loop.  Only reload when there was already a controller
// (i.e. this is a genuine update from old SW → new SW).
if ('serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloading) {
      reloading = true;
      window.location.reload();
    }
  });
}
