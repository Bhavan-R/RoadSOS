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
// skipWaiting() in sw.js makes the new SW activate immediately, then
// clients.claim() takes control of this page.  We detect that takeover
// via controllerchange and reload so the page gets the new bundle.
// Without this, users stay on stale cached JS until they manually reload.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}
