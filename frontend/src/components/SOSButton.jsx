import React, { useState, useMemo } from 'react';
import { Signal, Check, Copy } from 'lucide-react';
import { getEmergencyContacts, buildSosSmsBody } from '../utils/medicalId';
import { encodePlusCode } from '../utils/plusCodes';
import { isWaCountry } from '../utils/sosDispatch';

function cleanPhone(raw) {
  return (raw || '').replace(/[^\d+]/g, '');
}

function waUrl(phone, body) {
  const num = cleanPhone(phone).replace(/^\+/, '');
  return `https://wa.me/${num}?text=${encodeURIComponent(body)}`;
}

function smsUrl(phones, body) {
  const nums = (Array.isArray(phones) ? phones : [phones])
    .map(cleanPhone).filter(Boolean).join(',');
  return `sms:${nums}?body=${encodeURIComponent(body)}`;
}

export default function SOSButton({ location, landmark, countryCode, onFirstTap }) {
  const [copied,     setCopied]     = useState(false);
  const [sent,       setSent]       = useState(false);
  const [dispatched, setDispatched] = useState(false);
  const tappedRef = React.useRef(false);

  const hasLocation = !!(location?.lat && location?.lon);
  const preferWA    = isWaCountry(countryCode);

  const contacts    = getEmergencyContacts();
  const hasContacts = contacts.length > 0;

  const phonesKey = contacts.map(c => c.phone).join(',');
  const { body, primaryWaUrl, allSmsUrl, perContact } = useMemo(() => {
    if (!hasLocation) return { body: '', primaryWaUrl: '', allSmsUrl: '', perContact: [] };

    const plusCode = encodePlusCode(location.lat, location.lon);
    const msgBody  = buildSosSmsBody({ lat: location.lat, lon: location.lon, plusCode, landmark });

    if (contacts.length === 0) {
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
        name   : c.name || c.phone,
        waHref : waUrl(c.phone, msgBody),
        smsHref: smsUrl([c.phone], msgBody),
      })),
    };
  }, [hasLocation, location?.lat, location?.lon, landmark, phonesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Primary SOS tap ───────────────────────────────────────────────────────
  const handleSOS = () => {
    if (!tappedRef.current) { tappedRef.current = true; onFirstTap?.(); }
    if (!hasLocation) return;

    if (preferWA && hasContacts) {
      window.open(primaryWaUrl, '_blank');
    } else if (!preferWA && contacts.length > 1) {
      window.location.href = allSmsUrl;
    } else if (hasContacts) {
      const win = window.open(primaryWaUrl, '_blank');
      setTimeout(() => {
        if (!win || win.closed || win.closed === undefined) {
          window.location.href = perContact[0]?.smsHref || allSmsUrl;
        }
      }, 800);
    } else {
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

    // Notify the app that SOS was sent (opens DispatchScreen)
    try {
      window.dispatchEvent(new CustomEvent('roadsos:sos-sent', {
        detail: { location, landmark, countryCode, contacts },
      }));
    } catch {}
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
      // Clipboard API unavailable
    }
  };

  const contactSummary = contacts.length > 1
    ? `${contacts.length} contacts`
    : hasContacts
      ? (contacts[0].name || contacts[0].phone)
      : null;

  const channelLabel = preferWA ? 'WhatsApp' : 'SMS';

  const btnLabel = sent
    ? <><Check size={18} strokeWidth={2.5} /> Location Sent</>
    : !hasLocation
      ? <><Signal size={16} strokeWidth={2.2} /> SOS — Waiting for GPS</>
      : hasContacts
        ? <><Signal size={16} strokeWidth={2.2} /> SOS → {contactSummary}</>
        : <><Signal size={16} strokeWidth={2.2} /> SOS — Send Location</>;

  return (
    <div className="glass-sos-container">
      {/* No-contact nudge */}
      {!hasContacts && hasLocation && !dispatched && (
        <div className="sos-nudge">
          ⚠️ No emergency contact — add one in <strong>Medical ID</strong> for direct SOS
        </div>
      )}

      {/* Main SOS button */}
      <button
        id="sos-main-btn"
        className={`glass-sos-btn ${sent ? 'sent' : ''}`}
        onClick={handleSOS}
        aria-label={hasContacts
          ? `Send SOS via ${channelLabel} to ${contactSummary}`
          : 'Send SOS with your location via WhatsApp'}
        title={hasContacts
          ? `Sends via ${channelLabel} to ${contactSummary}`
          : 'Set emergency contacts in Medical ID for direct messaging'}
      >
        {!sent && (
          <>
            <div className="glass-sonar" />
            <div className="glass-sonar" />
          </>
        )}
        {btnLabel}
      </button>

      <button
        id="copy-coords-btn"
        className="glass-copy-btn"
        onClick={handleCopyCoords}
        aria-label="Copy GPS coordinates to clipboard"
        title="Copy GPS coordinates"
      >
        {copied
          ? <Check size={18} strokeWidth={2.5} color="#22C55E" />
          : <Copy size={18} strokeWidth={1.8} />
        }
      </button>

      {/* Follow-up dispatch panel */}
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

            {preferWA && contacts.length > 0 && (
              <a href={allSmsUrl} className="sos-dispatch__group-link">
                📱 SMS all {contacts.length} contacts at once
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
