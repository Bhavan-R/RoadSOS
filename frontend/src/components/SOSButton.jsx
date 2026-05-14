import React, { useState } from 'react';

/**
 * SOSButton — sticky bottom bar with:
 *   1. Big red SOS button → WhatsApp deep link (SMS fallback)
 *   2. Copy-coordinates button
 *
 * Props:
 *   location   { lat, lon, source }
 *   landmark   string | null
 *   topContact { name, phone } | null
 *   onFirstTap function — called once on first tap (iOS motion permission)
 */

function buildSOSMessage({ lat, lon, landmark, topContact }) {
  const latStr = typeof lat === 'number' ? lat.toFixed(5) : '?';
  const lonStr = typeof lon === 'number' ? lon.toFixed(5) : '?';

  const lines = [
    'ROAD ACCIDENT. I need help.',
    `Location: ${latStr}, ${lonStr}`,
    `Nearest landmark: ${landmark || 'unknown'}`,
  ];

  if (topContact?.name) {
    const phoneStr = topContact.phone ? ` at ${topContact.phone}` : '';
    lines.push(`Call: ${topContact.name}${phoneStr}`);
  }

  return lines.join('\n');
}

export default function SOSButton({ location, landmark, topContact, onFirstTap }) {
  const [copied, setCopied] = useState(false);
  const [sent,   setSent]   = useState(false);
  const tappedRef = React.useRef(false);

  const hasLocation = !!(location?.lat && location?.lon);

  // ── SOS tap ───────────────────────────────────────────────────────────────
  const handleSOS = () => {
    // Request iOS motion permission exactly once
    if (!tappedRef.current) {
      tappedRef.current = true;
      onFirstTap?.();
    }

    if (!hasLocation) return;

    const message  = buildSOSMessage({
      lat: location.lat,
      lon: location.lon,
      landmark,
      topContact,
    });
    const encoded  = encodeURIComponent(message);
    const waUrl    = `https://wa.me/?text=${encoded}`;
    const smsUrl   = `sms:?body=${encoded}`;

    // Open WhatsApp; if blocked/unavailable fall back to SMS after 800ms
    const win = window.open(waUrl, '_blank');
    setSent(true);
    setTimeout(() => {
      if (!win || win.closed || win.closed === undefined) {
        window.location.href = smsUrl;
      }
      setSent(false);
    }, 800);
  };

  // ── Copy coords ───────────────────────────────────────────────────────────
  const handleCopyCoords = async () => {
    const text = hasLocation 
      ? `${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}`
      : "Searching for GPS coordinates...";
    
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API unavailable — silent fail
    }
  };

  return (
    <div className="sos-bar">
      <button
        id="sos-main-btn"
        className={`sos-button ${sent ? 'sos-button--sent' : ''}`}
        onClick={handleSOS}
        aria-label="Send SOS with your location via WhatsApp"
      >
        {sent ? '📤 Sending...' : (!hasLocation ? '🆘 SOS — Use Best Location' : '🆘 SOS — Send Location')}
      </button>

      <button
        id="copy-coords-btn"
        className="coords-button"
        onClick={handleCopyCoords}
        aria-label="Copy GPS coordinates to clipboard"
      >
        {copied ? '✓ Copied!' : '📍 Copy GPS'}
      </button>
    </div>
  );
}
