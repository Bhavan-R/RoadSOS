import React, { useState, useMemo } from 'react';
import { getEmergencyContacts, buildSosSmsBody } from '../utils/medicalId';
import { encodePlusCode } from '../utils/plusCodes';

/**
 * SOSButton — sticky bottom bar.
 *
 * SOS tap behaviour (one reliable action per tap — mobile browsers block
 * parallel window.open + location.href calls after the first):
 *
 *   • 0 contacts  → WhatsApp share sheet (pick anyone manually)
 *   • 1 contact   → WhatsApp direct → SMS fallback if WA not installed
 *   • 2–3 contacts → group SMS to ALL contacts (window.location.href, always
 *                    reaches everyone). A secondary "WhatsApp → contact 1"
 *                    link appears right below so WA users get both channels.
 *
 * Props:
 *   location   { lat, lon, source }
 *   landmark   string | null
 *   topContact { name, phone } | null
 *   onFirstTap function — called once on first tap (iOS motion permission)
 */

function cleanPhone(raw) {
  return (raw || '').replace(/[^\d+]/g, '');
}

function waDirectUrl(phone, body) {
  const num = cleanPhone(phone).replace(/^\+/, '');
  return `https://wa.me/${num}?text=${encodeURIComponent(body)}`;
}

/** Group SMS URI. Comma-separated recipients work on modern Android & iOS. */
function buildGroupSmsHref(phones, body) {
  const nums = phones.map(cleanPhone).filter(Boolean).join(',');
  return `sms:${nums}?body=${encodeURIComponent(body)}`;
}

export default function SOSButton({ location, landmark, topContact, onFirstTap }) {
  const [copied, setCopied] = useState(false);
  const [sent,   setSent]   = useState(false);
  const tappedRef = React.useRef(false);

  const hasLocation = !!(location?.lat && location?.lon);

  // Read contacts fresh every render — cheap sync localStorage call.
  // Ensures the nudge and label update the moment Medical ID is saved.
  const contacts    = getEmergencyContacts();   // [{name, phone}]  0–3 items
  const hasContacts = contacts.length > 0;
  const multiContact = contacts.length > 1;

  // Build URLs only when location or contacts change.
  const phonesKey = contacts.map(c => c.phone).join(',');
  const { waUrl, groupSmsHref } = useMemo(() => {
    if (!hasLocation) return { waUrl: '', groupSmsHref: '' };

    const plusCode = encodePlusCode(location.lat, location.lon);
    const body = buildSosSmsBody({ lat: location.lat, lon: location.lon, plusCode, landmark });

    if (contacts.length === 0) {
      const encoded = encodeURIComponent(body);
      return {
        waUrl       : `https://wa.me/?text=${encoded}`,
        groupSmsHref: `sms:?body=${encoded}`,
      };
    }

    return {
      waUrl       : waDirectUrl(contacts[0].phone, body),
      groupSmsHref: buildGroupSmsHref(contacts.map(c => c.phone), body),
    };
  }, [hasLocation, location?.lat, location?.lon, landmark, phonesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SOS tap ───────────────────────────────────────────────────────────────
  const handleSOS = () => {
    if (!tappedRef.current) { tappedRef.current = true; onFirstTap?.(); }
    if (!hasLocation) return;

    if (multiContact) {
      // Multiple contacts: group SMS is the ONLY reliable single-tap action.
      // Mobile browsers silently drop a second window.open / location.href
      // that follows immediately — so we pick one action and do it well.
      // A secondary "Also via WhatsApp" link is rendered below for contact 1.
      window.location.href = groupSmsHref;
    } else if (hasContacts) {
      // Single contact: prefer WhatsApp, fall back to SMS if WA missing.
      const win = window.open(waUrl, '_blank');
      setTimeout(() => {
        if (!win || win.closed || win.closed === undefined) {
          window.location.href = groupSmsHref;
        }
      }, 800);
    } else {
      // No contact configured: WhatsApp share sheet (user picks manually).
      const win = window.open(waUrl, '_blank');
      setTimeout(() => {
        if (!win || win.closed || win.closed === undefined) {
          window.location.href = groupSmsHref;
        }
      }, 800);
    }

    setSent(true);
    setTimeout(() => setSent(false), 2500);
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
    } catch { /* silent */ }
  };

  // ── Labels ────────────────────────────────────────────────────────────────
  const contactSummary = multiContact
    ? `${contacts.length} contacts`
    : hasContacts
      ? (contacts[0].name || contacts[0].phone)
      : null;

  const btnLabel = sent
    ? '📤 Sending…'
    : !hasLocation
      ? '🆘 SOS — Waiting for GPS'
      : hasContacts
        ? `🆘 SOS → ${contactSummary}`
        : '🆘 SOS — Send Location';

  const btnTitle = multiContact
    ? `Send group SMS to all ${contacts.length} emergency contacts`
    : hasContacts
      ? `Send SOS directly to ${contactSummary} via WhatsApp`
      : 'Send SOS via WhatsApp — add emergency contacts in Medical ID for one-tap direct messaging';

  return (
    <div className="sos-bar">
      {/* Nudge when no contact is configured */}
      {!hasContacts && hasLocation && (
        <div className="sos-bar__nudge">
          ⚠️ No emergency contact set — add one in <strong>Medical ID</strong> for direct SOS
        </div>
      )}

      <button
        id="sos-main-btn"
        className={`sos-button ${sent ? 'sos-button--sent' : ''}`}
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

      {/* Secondary WhatsApp link for multi-contact mode.
          The main SOS fires group SMS (reaches everyone); this lets the user
          also ping contact 1 on WhatsApp with one more tap. */}
      {multiContact && hasLocation && waUrl && (
        <a
          className="sos-bar__wa-link"
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`Also send via WhatsApp to ${contacts[0].name || contacts[0].phone}`}
        >
          <span className="sos-bar__wa-icon">💬</span>
          Also WhatsApp → {contacts[0].name || contacts[0].phone}
        </a>
      )}
    </div>
  );
}
