import React, { useState } from 'react';

function buildMessage({ lat, lon, landmark, topContact }) {
  const lines = [
    'ROAD ACCIDENT. I need help.',
    `Location: ${lat?.toFixed(5)}, ${lon?.toFixed(5)}`,
    `Landmark: ${landmark || 'unknown'}`,
  ];
  if (topContact) {
    lines.push(`Nearest contact: ${topContact.name}${topContact.phone ? ' · ' + topContact.phone : ''}`);
  }
  return lines.join('\n');
}

export default function SOSButton({ location, landmark, topContact, onFirstTap }) {
  const [copied, setCopied] = useState(false);
  const tappedRef = React.useRef(false);

  const handleSOS = () => {
    // Request iOS motion permission on first user gesture
    if (!tappedRef.current) {
      tappedRef.current = true;
      onFirstTap?.();
    }
    if (!location) return;
    const message = buildMessage({ lat: location.lat, lon: location.lon, landmark, topContact });
    const encoded = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encoded}`;

    const win = window.open(whatsappUrl, '_blank');
    // Fallback to SMS if WhatsApp doesn't open
    setTimeout(() => {
      if (!win || win.closed) {
        window.location.href = `sms:?body=${encoded}`;
      }
    }, 800);
  };

  const handleCopyCoords = async () => {
    if (!location) return;
    const text = `${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silent
    }
  };

  return (
    <div className="sos-bar">
      <button className="sos-button" onClick={handleSOS} disabled={!location}>
        🆘 Send SOS with Location
      </button>
      <button className="coords-button" onClick={handleCopyCoords} disabled={!location}>
        {copied ? '✓ Copied' : '📍 Copy Coordinates'}
      </button>
    </div>
  );
}
