import React, { useState, useMemo, useRef } from 'react';
import { Signal, Check, Copy, Link, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getEmergencyContacts, buildSosSmsBody } from '../utils/medicalId';
import { encodePlusCode } from '../utils/plusCodes';
import { isWaCountry } from '../utils/sosDispatch';
import { triggerSOSAlert } from '../utils/sosAlert';
import { createTrackingSession } from '../utils/trackingSession';
import i18n from '../i18n/index.js';

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
  const { t } = useTranslation();
  const [copied,       setCopied]       = useState(false);
  const [sent,         setSent]         = useState(false);
  const [dispatched,   setDispatched]   = useState(false);
  const [trackingUrl,  setTrackingUrl]  = useState(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackCopied,  setTrackCopied]  = useState(false);
  const tappedRef = useRef(false);

  const hasLocation = !!(location?.lat && location?.lon);
  const preferWA    = isWaCountry(countryCode);

  const contacts    = getEmergencyContacts();
  const hasContacts = contacts.length > 0;

  const phonesKey = contacts.map(c => c.phone).join(',');
  const { body, primaryWaUrl, allSmsUrl, perContact } = useMemo(() => {
    if (!hasLocation) return { body: '', primaryWaUrl: '', allSmsUrl: '', perContact: [] };

    const plusCode = encodePlusCode(location.lat, location.lon);
    // Pass the translation function + language so the message is bilingual
    // (native language block first, then English block for paramedics).
    const tNative = i18n.t.bind(i18n);
    const lang    = i18n.language || 'en';
    const msgBody = buildSosSmsBody(
      { lat: location.lat, lon: location.lon, plusCode, landmark },
      tNative,
      lang,
    );

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
  // CRITICAL: `window.open` must fire SYNCHRONOUSLY inside the click handler.
  // Browsers strip the "user gesture" flag after any `await`, so a popup opened
  // post-await gets silently blocked.  We therefore open the dispatch channel
  // FIRST (synchronously) and only then await the camera/alarm side effects.
  const handleSOS = async () => {
    if (!tappedRef.current) { tappedRef.current = true; onFirstTap?.(); }
    if (!hasLocation) return;

    // ① Open the primary SOS channel SYNCHRONOUSLY — must run in the original
    //    gesture frame or the popup gets blocked.
    let dispatchWindow = null;
    if (preferWA && hasContacts) {
      dispatchWindow = window.open(primaryWaUrl, '_blank');
    } else if (!preferWA && contacts.length > 1) {
      // Multi-contact SMS — single SMS app navigation reaches all contacts
      window.location.href = allSmsUrl;
    } else if (hasContacts) {
      dispatchWindow = window.open(primaryWaUrl, '_blank');
    } else {
      // No medical ID contacts — fire WhatsApp share dialog (no recipient)
      dispatchWindow = window.open(primaryWaUrl, '_blank');
    }

    setSent(true);
    setDispatched(true);
    setTimeout(() => setSent(false), 2500);

    // ② SMS fallback if WhatsApp didn't open (deferred — gesture is gone, but
    //    `location.href` doesn't need it).  Only when WA path was attempted.
    if (preferWA && hasContacts) {
      setTimeout(() => {
        if (!dispatchWindow || dispatchWindow.closed) {
          // WA likely blocked or not installed — fall back to SMS
          window.location.href = perContact[0]?.smsHref || allSmsUrl;
        }
      }, 1200);
    }

    // ③ Trigger audio + torch + scene photo capture in the background.
    //    These can run AFTER window.open without breaking it.
    let scenePhoto = null;
    try {
      scenePhoto = await triggerSOSAlert();
    } catch { /* alarm failure shouldn't block dispatch UX */ }

    // ④ Create a live-tracking session in the background — non-blocking
    setTrackingUrl(null);
    setTrackLoading(true);
    createTrackingSession(location, landmark).then(url => {
      setTrackingUrl(url);
      setTrackLoading(false);
    });

    // ⑤ Notify the app that SOS was sent (opens DispatchScreen with scene photo)
    try {
      window.dispatchEvent(new CustomEvent('roadsos:sos-sent', {
        detail: { location, landmark, countryCode, contacts, scenePhoto },
      }));
    } catch {}
  };

  // ── Copy tracking URL ─────────────────────────────────────────────────────
  const handleCopyTrackingUrl = async () => {
    if (!trackingUrl) return;
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setTrackCopied(true);
      setTimeout(() => setTrackCopied(false), 2500);
    } catch {
      // Clipboard unavailable
    }
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
    ? <><Check size={18} strokeWidth={2.5} /> {t('sos.sent')}</>
    : !hasLocation
      ? <><Signal size={16} strokeWidth={2.2} /> {t('sos.waiting')}</>
      : hasContacts
        ? <><Signal size={16} strokeWidth={2.2} /> {t('sos.to_contacts', { name: contactSummary })}</>
        : <><Signal size={16} strokeWidth={2.2} /> {t('sos.send')}</>;

  return (
    <div className="glass-sos-container">
      {/* No-contact nudge */}
      {!hasContacts && hasLocation && !dispatched && (
        <div className="sos-nudge">
          ⚠️ {t('sos.no_contact_warning')}
        </div>
      )}

      {/* SOS button row — relative wrapper for btn + copy icon */}
      <div className="glass-sos-row">
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
          {btnLabel}
        </button>

        <button
          id="copy-coords-btn"
          className="glass-copy-btn"
          onClick={handleCopyCoords}
          aria-label={t('sos.copy_coords')}
          title={t('sos.copy_coords')}
        >
          {copied
            ? <Check size={18} strokeWidth={2.5} color="#22C55E" />
            : <Copy size={18} strokeWidth={1.8} />
          }
        </button>
      </div>

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

          {/* Live tracking link */}
          <div className="sos-track-block">
            <span className="sos-track-label">
              <Link size={11} strokeWidth={2.3} />
              {t('track.share_prompt')}
            </span>
            {trackLoading && (
              <span className="sos-track-creating">
                <Loader2 size={11} strokeWidth={2.4} className="sos-track-spin" />
                {t('track.creating')}
              </span>
            )}
            {!trackLoading && trackingUrl && (
              <div className="sos-track-url-row">
                <span className="sos-track-url">{trackingUrl}</span>
                <button className="sos-track-copy" onClick={handleCopyTrackingUrl}>
                  {trackCopied
                    ? <><Check size={11} strokeWidth={2.5} /> {t('track.copied')}</>
                    : <><Copy size={11} strokeWidth={2}   /> {t('track.copy_link')}</>
                  }
                </button>
              </div>
            )}
            {!trackLoading && !trackingUrl && (
              <span className="sos-track-unavailable">{t('track.failed')}</span>
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
