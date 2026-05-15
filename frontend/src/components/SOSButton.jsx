import React, { useState, useMemo } from 'react';
import { getEmergencyContacts, buildSosSmsBody } from '../utils/medicalId';
import { encodePlusCode } from '../utils/plusCodes';
import { isWaCountry } from '../utils/sosDispatch';

/**
 * SOSButton — sticky bottom bar.
 *
 * Channel selection is country-aware:
 *   WhatsApp-dominant regions (India, Brazil, Indonesia, most of Europe,
 *   Middle East, Africa, SE Asia) → WhatsApp fires first.
 *   SMS-dominant regions (USA, Canada, Japan, Korea, Australia) → SMS fires first.
 *
 * Mobile browsers only allow ONE external-app redirect per user gesture.
 * WhatsApp's wa.me API also only opens ONE chat at a time (no bulk-send).
 *
 * Strategy:
 *   1. SOS tap → auto-fires the preferred channel for contact 1 immediately.
 *   2. A follow-up panel expands below showing tap-to-send links for:
 *      - Remaining contacts (WA + SMS per contact)
 *      - The alternate channel for contact 1
 *   The user taps 1–2 more times to reach all contacts on both channels.
 *
 * Props:
 *   location    { lat, lon, source }
 *   landmark    string | null
 *   topContact  { name, phone } | null
 *   countryCode string  e.g. 'IN', 'US'
 *   onFirstTap  function — called once on first tap (iOS motion permission)
 */

// isWaCountry imported from sosDispatch.js

function cleanPhone(raw) {
  return (raw || '').replace(/[^\d+]/g, '');
}

/** Direct WhatsApp URL for a single contact. */
function waUrl(phone, body) {
  const num = cleanPhone(phone).replace(/^\+/, '');
  return `https://wa.me/${num}?text=${encodeURIComponent(body)}`;
}

/** SMS URI for one or more contacts (comma-separated — works on Android + iOS). */
function smsUrl(phones, body) {
  const nums = (Array.isArray(phones) ? phones : [phones])
    .map(cleanPhone).filter(Boolean).join(',');
  return `sms:${nums}?body=${encodeURIComponent(body)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SOSButton({ location, landmark, countryCode, onFirstTap }) {
  const [sent,       setSent]       = useState(false);
  const [dispatched, setDispatched] = useState(false); // follow-up panel open
  const [copied,     setCopied]     = useState(false);
  const tappedRef = React.useRef(false);

  const hasLocation  = !!(location?.lat && location?.lon);
  const preferWA     = isWaCountry(countryCode);

  // Contacts — fresh read every render so the UI reflects saves instantly.
  const contacts    = getEmergencyContacts();   // [{name, phone}] 0–3
  const hasContacts = contacts.length > 0;

  // Build all message URLs once per location / contacts change.
  const phonesKey = contacts.map(c => c.phone).join(',');
  const { body, primaryWaUrl, allSmsUrl, perContact } = useMemo(() => {
    if (!hasLocation) return { body: '', primaryWaUrl: '', allSmsUrl: '', perContact: [] };

    const plusCode = encodePlusCode(location.lat, location.lon);
    const msgBody  = buildSosSmsBody({ lat: location.lat, lon: location.lon, plusCode, landmark });

    if (contacts.length === 0) {
      // No contacts — share sheet fallback
      const enc = encodeURIComponent(msgBody);
      return {
        body        : msgBody,
        primaryWaUrl: `https://wa.me/?text=${enc}`,
        allSmsUrl   : `sms:?body=${enc}`,
        perContact  : [],
      };
    }

    return {
      body        : msgBody,
      primaryWaUrl: waUrl(contacts[0].phone, msgBody),
      allSmsUrl   : smsUrl(contacts.map(c => c.phone), msgBody),
      perContact  : contacts.map(c => ({
        name  : c.name || c.phone,
        waHref: waUrl(c.phone, msgBody),
        smsHref: smsUrl([c.phone], msgBody),
      })),
    };
  }, [hasLocation, location?.lat, location?.lon, landmark, phonesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Primary SOS tap ───────────────────────────────────────────────────────
  const handleSOS = () => {
    if (!tappedRef.current) { tappedRef.current = true; onFirstTap?.(); }
    if (!hasLocation) return;

    // Auto-fire preferred channel for contact 1 (the only reliable single-gesture action).
    // The follow-up panel then lets the user reach remaining contacts.
    if (preferWA && hasContacts) {
      // WA countries: open WhatsApp to contact 1
      window.open(primaryWaUrl, '_blank');
    } else if (!preferWA && contacts.length > 1) {
      // SMS countries with multiple contacts: group SMS reaches everyone at once
      window.location.href = allSmsUrl;
    } else if (hasContacts) {
      // SMS countries, single contact: WhatsApp → SMS fallback
      const win = window.open(primaryWaUrl, '_blank');
      setTimeout(() => {
        if (!win || win.closed || win.closed === undefined) {
          window.location.href = perContact[0]?.smsHref || allSmsUrl;
        }
      }, 800);
    } else {
      // No contacts: WhatsApp share sheet → SMS fallback
      const win = window.open(primaryWaUrl, '_blank');
      setTimeout(() => {
        if (!win || win.closed || win.closed === undefined) {
          window.location.href = allSmsUrl;
        }
      }, 800);
    }

    setSent(true);
    setDispatched(true);
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
  const contactSummary = contacts.length > 1
    ? `${contacts.length} contacts`
    : hasContacts
      ? (contacts[0].name || contacts[0].phone)
      : null;

  const channelLabel = preferWA ? 'WhatsApp' : 'SMS';

  const btnLabel = sent
    ? '📤 Sending…'
    : !hasLocation
      ? '🆘 SOS — Waiting for GPS'
      : hasContacts
        ? `🆘 SOS → ${contactSummary}`
        : '🆘 SOS — Send Location';

  return (
    <div className="sos-bar">

      {/* No-contact nudge */}
      {!hasContacts && hasLocation && !dispatched && (
        <div className="sos-bar__nudge">
          ⚠️ No emergency contact — add one in <strong>Medical ID</strong> for direct SOS
        </div>
      )}

      {/* ── Main buttons ── */}
      <button
        id="sos-main-btn"
        className={`sos-button ${sent ? 'sos-button--sent' : ''}`}
        onClick={handleSOS}
        title={hasContacts
          ? `Sends via ${channelLabel} to ${contactSummary}`
          : 'Set emergency contacts in Medical ID for direct messaging'}
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

      {/* ── Follow-up dispatch panel ──────────────────────────────────────────
          Appears after the primary SOS fires. Shows per-contact WA + SMS links
          so the user can reach everyone with 1–2 more taps.              ── */}
      {dispatched && hasContacts && hasLocation && (
        <div className="sos-dispatch">
          <div className="sos-dispatch__header">
            {preferWA
              ? `WhatsApp sent to ${perContact[0]?.name}. Also notify:`
              : contacts.length > 1
                ? `SMS sent to all ${contacts.length} contacts. Also via WhatsApp:`
                : `Sent to ${perContact[0]?.name}. Also:`
            }
          </div>

          <div className="sos-dispatch__links">
            {perContact.map((c, i) => {
              // WA countries: auto-fired WA for contact 0, show SMS + WA for rest
              // SMS countries: auto-fired SMS for all, show WA per contact
              const showWa  = !preferWA || i > 0;
              const showSms = preferWA || contacts.length === 1;
              return (
                <div key={i} className="sos-dispatch__row">
                  <span className="sos-dispatch__name">{c.name}</span>
                  <div className="sos-dispatch__btns">
                    {showWa && (
                      <a href={c.waHref} target="_blank" rel="noopener noreferrer"
                         className="sos-dispatch__btn sos-dispatch__btn--wa">
                        💬 WA
                      </a>
                    )}
                    {showSms && (
                      <a href={c.smsHref}
                         className="sos-dispatch__btn sos-dispatch__btn--sms">
                        📱 SMS
                      </a>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Always show group SMS option in WA mode, and WA for all in SMS mode */}
            {preferWA && contacts.length > 0 && (
              <a href={allSmsUrl}
                 className="sos-dispatch__group-link">
                📱 Send SMS to all {contacts.length} contacts at once
              </a>
            )}
          </div>

          <button className="sos-dispatch__done" onClick={() => setDispatched(false)}>
            ✓ Done
          </button>
        </div>
      )}
    </div>
  );
}
