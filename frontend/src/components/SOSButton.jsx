import React, { useState, useMemo } from 'react';
import { getEmergencyContacts, buildSosSmsBody } from '../utils/medicalId';
import { encodePlusCode } from '../utils/plusCodes';

/**
 * SOSButton — sticky bottom bar.
 *
 * SOS tap behaviour:
 *   • 1 contact set  → WhatsApp direct, SMS fallback (same as before)
 *   • 2–3 contacts   → WhatsApp to contact 1  AND  group SMS to all contacts
 *   • No contacts    → WhatsApp share sheet (no recipient) + nudge
 *
 * Stale-data fix: contacts are read fresh on every render (cheap localStorage
 * call), so the nudge disappears immediately after the user saves Medical ID.
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

/** SMS URI supporting up to 3 recipients. iOS uses commas, Android semicolons;
 *  modern Android also accepts commas — comma is the safer default. */
function buildGroupSmsHref(phones, body) {
  const nums = phones.map(cleanPhone).filter(Boolean).join(',');
  return `sms:${nums}?body=${encodeURIComponent(body)}`;
}

export default function SOSButton({ location, landmark, topContact, onFirstTap }) {
  const [copied, setCopied] = useState(false);
  const [sent,   setSent]   = useState(false);
  const tappedRef = React.useRef(false);

  const hasLocation = !!(location?.lat && location?.lon);

  // ── Read contacts fresh every render — localStorage is synchronous and fast.
  // This is intentional: it means the nudge / button label update instantly
  // when the user saves Medical ID without needing a prop change.
  const contacts = getEmergencyContacts();     // [{name, phone}]  length 0–3
  const hasContacts = contacts.length > 0;

  // ── Build URLs only when location or contact list changes ─────────────────
  const phonesKey = contacts.map(c => c.phone).join(',');
  const { waUrl, groupSmsHref, multiContact } = useMemo(() => {
    if (!hasLocation) return { waUrl: '', groupSmsHref: '', multiContact: false };

    const plusCode = encodePlusCode(location.lat, location.lon);
    const body = buildSosSmsBody({ lat: location.lat, lon: location.lon, plusCode, landmark });

    if (contacts.length === 0) {
      // No contacts — share sheet fallback
      const encoded = encodeURIComponent(body);
      return {
        waUrl        : `https://wa.me/?text=${encoded}`,
        groupSmsHref : `sms:?body=${encoded}`,
        multiContact : false,
      };
    }

    return {
      waUrl        : waDirectUrl(contacts[0].phone, body),
      groupSmsHref : buildGroupSmsHref(contacts.map(c => c.phone), body),
      multiContact : contacts.length > 1,
    };
  }, [hasLocation, location?.lat, location?.lon, landmark, phonesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SOS tap ───────────────────────────────────────────────────────────────
  const handleSOS = () => {
    if (!tappedRef.current) { tappedRef.current = true; onFirstTap?.(); }
    if (!hasLocation) return;

    if (multiContact) {
      // Multiple contacts: open WhatsApp for contact 1, then immediately
      // open a group SMS so all contacts receive the message.
      window.open(waUrl, '_blank');
      setTimeout(() => { window.location.href = groupSmsHref; }, 600);
    } else if (hasContacts) {
      // Single contact: WhatsApp → SMS fallback if WA blocked/missing.
      const win = window.open(waUrl, '_blank');
      setTimeout(() => {
        if (!win || win.closed || win.closed === undefined) {
          window.location.href = groupSmsHref;
        }
      }, 800);
    } else {
      // No contact: WhatsApp share sheet.
      const win = window.open(waUrl, '_blank');
      setTimeout(() => {
        if (!win || win.closed || win.closed === undefined) {
          window.location.href = groupSmsHref;
        }
      }, 800);
    }

    setSent(true);
    setTimeout(() => setSent(false), 2000);
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

  // ── Label / title ─────────────────────────────────────────────────────────
  const contactSummary = contacts.length === 1
    ? contacts[0].name || contacts[0].phone
    : contacts.length > 1
      ? `${contacts.length} contacts`
      : null;

  const btnLabel = sent
    ? '📤 Sending…'
    : !hasLocation
      ? '🆘 SOS — Waiting for GPS'
      : hasContacts
        ? `🆘 SOS → ${contactSummary}`
        : '🆘 SOS — Send Location';

  const btnTitle = hasContacts
    ? multiContact
      ? `Send SOS to all ${contacts.length} emergency contacts via WhatsApp + group SMS`
      : `Send SOS directly to ${contactSummary} via WhatsApp`
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
    </div>
  );
}
