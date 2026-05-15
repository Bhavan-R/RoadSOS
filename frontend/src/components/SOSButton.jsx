import React, { useState, useMemo } from 'react';
import { getMedicalId, buildSosSmsBody, buildSosSmsHref } from '../utils/medicalId';
import { encodePlusCode } from '../utils/plusCodes';

/**
 * SOSButton — sticky bottom bar with:
 *   1. Big red SOS button — sends directly to Medical ID emergency contact
 *      via WhatsApp (or SMS if WA is unavailable). Falls back to share
 *      sheet if no contact is configured.
 *   2. Copy-coordinates button
 *
 * Props:
 *   location   { lat, lon, source }
 *   landmark   string | null
 *   topContact { name, phone } | null  (nearest hospital/police — shown in message)
 *   onFirstTap function — called once on first tap (iOS motion permission)
 */

/** Strip everything except digits and a leading + so WhatsApp / sms: accept it. */
function cleanPhone(raw) {
  return (raw || '').replace(/[^\d+]/g, '');
}

/** wa.me direct-chat URL — includes country code, no spaces / dashes. */
function waDirectUrl(phone, body) {
  // wa.me requires the number WITHOUT the leading +
  const num = cleanPhone(phone).replace(/^\+/, '');
  return `https://wa.me/${num}?text=${encodeURIComponent(body)}`;
}

export default function SOSButton({ location, landmark, topContact, onFirstTap }) {
  const [copied, setCopied] = useState(false);
  const [sent,   setSent]   = useState(false);
  const tappedRef = React.useRef(false);

  const hasLocation = !!(location?.lat && location?.lon);

  // ── Derive contact + message once per location / landmark change ──────────
  const { contactName, contactPhone, waUrl, smsUrl, hasContact } = useMemo(() => {
    const m = getMedicalId();
    const phone = m.primaryContactPhone || '';
    const name  = m.primaryContactName  || 'emergency contact';

    if (!hasLocation) {
      return { contactName: name, contactPhone: phone, waUrl: '', smsUrl: '', hasContact: !!phone };
    }

    const plusCode = encodePlusCode(location.lat, location.lon);

    // Rich SOS body — same one used in CrashAlert. Includes blood type,
    // allergies, Plus Code, and a Google Maps link for the recipient.
    const body = buildSosSmsBody({
      lat: location.lat,
      lon: location.lon,
      plusCode,
      landmark,
    });

    if (phone) {
      return {
        contactName : name,
        contactPhone: phone,
        waUrl       : waDirectUrl(phone, body),
        smsUrl      : buildSosSmsHref(phone, body),
        hasContact  : true,
      };
    }

    // No emergency contact set — fall back to WhatsApp share sheet so the
    // user can at least pick someone manually.
    const encoded = encodeURIComponent(body);
    return {
      contactName : '',
      contactPhone: '',
      waUrl       : `https://wa.me/?text=${encoded}`,
      smsUrl      : `sms:?body=${encoded}`,
      hasContact  : false,
    };
  }, [location?.lat, location?.lon, landmark]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SOS tap ───────────────────────────────────────────────────────────────
  const handleSOS = () => {
    // Request iOS motion permission exactly once
    if (!tappedRef.current) {
      tappedRef.current = true;
      onFirstTap?.();
    }

    if (!hasLocation) return;

    // Try WhatsApp first (direct to contact if set, share sheet otherwise).
    // If WA is blocked or the device has no WA, fall back to SMS after 800ms.
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
      : 'Searching for GPS coordinates...';

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API unavailable — silent fail
    }
  };

  // ── Label ─────────────────────────────────────────────────────────────────
  const btnLabel = sent
    ? '📤 Sending...'
    : !hasLocation
      ? '🆘 SOS — Waiting for GPS'
      : hasContact
        ? `🆘 SOS → ${contactName}`
        : '🆘 SOS — Send Location';

  const btnTitle = hasContact
    ? `Send SOS with your location and medical info directly to ${contactName} (${contactPhone}) via WhatsApp`
    : 'Send SOS via WhatsApp — set an emergency contact in Medical ID for one-tap direct messaging';

  return (
    <div className="sos-bar">
      {/* Nudge when no emergency contact is configured */}
      {!hasContact && hasLocation && (
        <div className="sos-bar__nudge">
          ⚠️ No emergency contact set — <strong>Medical ID</strong> for direct SOS
        </div>
      )}

      <button
        id="sos-main-btn"
        className={`sos-button ${sent ? 'sos-button--sent' : ''} ${!hasContact ? 'sos-button--no-contact' : ''}`}
        onClick={handleSOS}
        aria-label={btnTitle}
        title={btnTitle}
      >
        {btnLabel}
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
