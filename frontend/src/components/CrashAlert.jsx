import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Bot, PhoneCall, Check, Ambulance, Shield, Phone, Copy, X, Navigation2 } from "lucide-react";
import { speakText, buildDispatchText, cancelSpeech } from '../utils/speechUtils';
import { startAlarm, stopAlarm } from '../utils/alarmUtils';
import { safeAutoDial, guardedTelDial } from '../utils/demoMode';
import { encodePlusCode } from '../utils/plusCodes';
import { isWaCountry, buildSosLinks } from '../utils/sosDispatch';

const CHOOSE_SECONDS = 10;
const AUTO_SECONDS   = 4;
const CORRECT_PIN    = '0000';

// Helper: derive a friendly emergency name for the crash overlay
function topContactName(numbers) {
  if (!numbers) return 'Apollo';
  return numbers.ambulance ? 'Ambulance' : numbers.general ? 'Emergency' : 'Apollo';
}

const PHASE = {
  CHOOSING   : 'choosing',
  AUTOMATING : 'automating',
  CALLING    : 'calling',
  MANUAL     : 'manual',
};

export default function CrashAlert({ open, onConfirm, onCancel, numbers, location, landmark, countryCode }) {
  const [phase, setPhase]       = useState(PHASE.CHOOSING);
  const [seconds, setSeconds]   = useState(CHOOSE_SECONDS);
  const [pin, setPin]           = useState('');
  const [pinError, setPinError] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [copied, setCopied]     = useState(false);
  const [sosSent, setSosSent]   = useState(null);
  const intervalRef             = useRef(null);

  const callNumber = numbers?.ambulance || numbers?.general || '112';
  const preferWA   = isWaCountry(countryCode);

  const plusCode = useMemo(() => {
    if (!location?.lat || !location?.lon) return '';
    return encodePlusCode(location.lat, location.lon);
  }, [location?.lat, location?.lon]);

  const dispatchText = useMemo(() => buildDispatchText({
    landmark,
    lat     : location?.lat,
    lon     : location?.lon,
    plusCode,
    injured : true,
    blocking: true,
  }), [landmark, location?.lat, location?.lon, plusCode]);

  const doCopy = () => {
    if (location?.lat) {
      navigator.clipboard.writeText(`${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  // ─── Open / close lifecycle ────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      clearInterval(intervalRef.current);
      stopAlarm();
      cancelSpeech();
      setPhase(PHASE.CHOOSING);
      setSeconds(CHOOSE_SECONDS);
      setPin('');
      setPinError(false);
      setSpeaking(false);
      setSosSent(null);
      return;
    }

    startAlarm(callNumber);
    startCountdown(CHOOSE_SECONDS, () => triggerAutomatic());
  }, [open]);                                    // eslint-disable-line react-hooks/exhaustive-deps

  function dispatchSos() {
    const links = buildSosLinks(location, landmark);
    if (!links) return;
    if (preferWA) {
      window.open(links.perContact[0].waHref, '_blank');
      setSosSent({ channel: 'wa', links });
    } else {
      window.location.href = links.groupSmsHref;
      setSosSent({ channel: 'sms', links });
    }
  }

  // ─── Countdown helper ─────────────────────────────────────────────────
  function startCountdown(from, onZero) {
    clearInterval(intervalRef.current);
    setSeconds(from);
    intervalRef.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          clearInterval(intervalRef.current);
          onZero();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  // ─── Mode: AUTOMATING ─────────────────────────────────────────────────
  function triggerAutomatic() {
    stopAlarm();
    setPhase(PHASE.AUTOMATING);
    setSpeaking(true);
    speakText(dispatchText).finally(() => setSpeaking(false));
    startCountdown(AUTO_SECONDS, () => fireCall());
  }

  function fireCall() {
    clearInterval(intervalRef.current);
    setPhase(PHASE.CALLING);
    dispatchSos();
    setTimeout(() => safeAutoDial(callNumber, 'Ambulance'), 600);
    onConfirm?.();
  }

  // ─── Mode: MANUAL ─────────────────────────────────────────────────────
  function handleChooseManual() {
    clearInterval(intervalRef.current);
    stopAlarm();
    dispatchSos();
    setPhase(PHASE.MANUAL);
  }

  // ─── Cancel (false alarm) ─────────────────────────────────────────────
  function handleCancelFalseAlarm() {
    if (pin === CORRECT_PIN) {
      clearInterval(intervalRef.current);
      stopAlarm();
      cancelSpeech();
      onCancel?.();
    } else {
      setPinError(true);
      setPin('');
      setTimeout(() => setPinError(false), 1500);
    }
  }

  function handleCancelAuto() {
    clearInterval(intervalRef.current);
    cancelSpeech();
    onCancel?.();
  }

  if (!open) return null;

  // ─── SOS follow-up block ──────────────────────────────────────────────
  const SosFollowUp = sosSent ? (() => {
    const { channel, links } = sosSent;
    const contact0 = links.perContact[0];
    return (
      <div className="crash-sos-sent">
        <div className="crash-sos-sent__header">
          {channel === 'wa'
            ? `💬 WhatsApp SOS sent to ${contact0?.name}`
            : `📱 SMS SOS sent to all ${links.contacts?.length} contacts`
          }
        </div>
        <div className="crash-sos-sent__links">
          {links.perContact.map((c, i) => {
            const showWa  = channel === 'sms' || i > 0;
            const showSms = channel === 'wa';
            return (
              <div key={i} className="crash-sos-sent__row">
                <span className="crash-sos-sent__name">{c.name}</span>
                <span className="crash-sos-sent__btns">
                  {showWa && (
                    <a href={c.waHref} target="_blank" rel="noopener noreferrer"
                       className="crash-sos-sent__btn crash-sos-sent__btn--wa">💬 WA</a>
                  )}
                  {showSms && (
                    <a href={c.smsHref}
                       className="crash-sos-sent__btn crash-sos-sent__btn--sms">📱 SMS</a>
                  )}
                </span>
              </div>
            );
          })}
          {channel === 'wa' && links.contacts?.length > 0 && (
            <a href={links.groupSmsHref} className="crash-sos-sent__group-sms">
              📱 SMS all {links.contacts.length} contacts at once
            </a>
          )}
        </div>
      </div>
    );
  })() : null;

  // ─── CHOOSING phase ────────────────────────────────────────────────────
  // Final design: full-red gradient, big monospace countdown, raised "I'M OK — CANCEL" button
  if (phase === PHASE.CHOOSING) {
    const countText = String(seconds).padStart(2, '0');
    const speedKmh = location?.speed && location.speed > 0 ? Math.round(location.speed * 3.6) : 78;
    const alertedCount = numbers ? 1 : 0;

    return (
      <div className="crash-final-overlay" role="alertdialog" aria-modal="true">
        {/* Status pill */}
        <span className="cf-pill">
          <span className="cf-pill-dot" />
          CRASH DETECTED
        </span>

        {/* Content (centered, upper area) */}
        <div className="cf-content">
          <div className="cf-do-not-panic">DO NOT PANIC</div>
          <div className="cf-count">{countText}</div>
          <div className="cf-count-label">seconds until auto-SOS</div>

          <div className="cf-details">
            Sudden deceleration at {speedKmh} km/h.<br />
            <strong style={{ fontWeight: 800 }}>
              {callNumber} · {topContactName(numbers)} · {alertedCount > 0 ? 'emergency contacts' : 'no contacts set'}
            </strong>{' '}will be alerted.
          </div>
        </div>

        {/* Mode selection — Auto or Manual */}
        <div className="cf-modes">
          <button className="cf-mode cf-mode--auto" onClick={triggerAutomatic}>
            <Bot size={20} strokeWidth={2.2} />
            <span className="cf-mode-title">Automatic</span>
            <span className="cf-mode-desc">Calls + notifies contacts</span>
          </button>
          <button className="cf-mode cf-mode--manual" onClick={handleChooseManual}>
            <PhoneCall size={20} strokeWidth={2.2} />
            <span className="cf-mode-title">Manual</span>
            <span className="cf-mode-desc">I'll call — contacts notified</span>
          </button>
        </div>

        {/* Raised "I'M OK — CANCEL" button */}
        <button className="cf-cancel-btn" onClick={handleCancelAuto}>
          I'M OK — CANCEL
        </button>

        {/* PIN-gated false alarm cancel */}
        <div className="cf-pin-zone">
          <div className="cf-pin-label">False alarm? Enter PIN to silence:</div>
          <div className="cf-pin-row">
            <input
              className={`cf-pin-input ${pinError ? 'cf-pin-input--error' : ''}`}
              type="tel" inputMode="numeric" maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="0000"
            />
            <button className="cf-pin-btn" onClick={handleCancelFalseAlarm} disabled={pin.length !== 4}>
              Stop alarm
            </button>
          </div>
          {pinError && <div className="cf-pin-error">Incorrect PIN</div>}
        </div>

        {/* Spacer pushes Send SOS Now toward bottom */}
        <div className="cf-spacer" />

        <button className="cf-send-now" onClick={() => {
          clearInterval(intervalRef.current);
          stopAlarm();
          dispatchSos();
          fireCall();
        }}>
          Send SOS now
        </button>
      </div>
    );
  }

  // ─── AUTOMATING phase ──────────────────────────────────────────────────
  if (phase === PHASE.AUTOMATING) {
    return (
      <div className="modal-backdrop modal-backdrop--alert" role="alertdialog" aria-modal="true">
        <div style={{ width: '100%', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', paddingBottom: 32 }}>
          <div className="sheet">
            <div className="handle-bar"><div className="handle" /></div>

            {/* Header */}
            <div style={{ padding: '24px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                   <svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                      <path d="M24 4L6 10V22C6 31.3 13.7 40 24 44C34.3 40 42 31.3 42 22V10L24 4Z" fill="#3b82f6" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round"/>
                      <path d="M10 26 H 18 L 22 14 L 26 36 L 30 26 H 38" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                   </svg>
                   <div style={{ fontSize: '16px', fontWeight: 900, letterSpacing: '-0.05em', color: '#0f172a' }}>
                     Road<span style={{ color: '#3b82f6' }}>SOS</span>
                   </div>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
                  Calling {callNumber}
                </div>
              </div>
            </div>

            {/* Circular Timer */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0 24px' }}>
              <div style={{ 
                width: 130, height: 130, borderRadius: '50%', 
                background: '#FEF2F2', border: '5px solid #DC2626',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 20px rgba(220, 38, 38, 0.15)'
              }}>
                {seconds > 0 ? (
                  <>
                    <span style={{ fontSize: '48px', fontWeight: 900, color: '#DC2626', lineHeight: 1 }}>{seconds}</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#DC2626', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>seconds</span>
                  </>
                ) : (
                  <span style={{ fontSize: '16px', fontWeight: 800, color: '#DC2626' }}>Connecting</span>
                )}
              </div>
            </div>

            {/* Script Box */}
            <div style={{ padding: '0 20px 24px' }}>
              <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#475569', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {speaking ? '🔊 Listen — then say this:' : '📋 Say this to dispatcher:'}
                </div>
                <p style={{ fontSize: 15, fontWeight: 500, color: '#0f172a', lineHeight: 1.5 }}>"{dispatchText}"</p>
              </div>
            </div>

            {/* Big Cancel Button */}
            <div style={{ padding: '0 20px 24px' }}>
              <button 
                onClick={handleCancelAuto}
                style={{
                  width: '100%', height: 52, borderRadius: 12,
                  background: '#F1F5F9', border: '1.5px solid #E2E8F0', color: '#334155',
                  fontSize: 16, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#E2E8F0'}
                onMouseOut={(e) => e.target.style.background = '#F1F5F9'}
              >
                Cancel Auto-Dial
              </button>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ─── CALLING phase ────────────────────────────────────────────────────
  if (phase === PHASE.CALLING) {
    return (
      <div className="modal-backdrop modal-backdrop--alert" role="alertdialog" aria-modal="true">
        <div style={{ width: '100%', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', paddingBottom: 32 }}>
          <div className="sheet">
            <div className="handle-bar"><div className="handle" /></div>

            {/* Header */}
            <div style={{ padding: '24px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                   <svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                      <path d="M24 4L6 10V22C6 31.3 13.7 40 24 44C34.3 40 42 31.3 42 22V10L24 4Z" fill="#3b82f6" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round"/>
                      <path d="M10 26 H 18 L 22 14 L 26 36 L 30 26 H 38" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                   </svg>
                   <div style={{ fontSize: '16px', fontWeight: 900, letterSpacing: '-0.05em', color: '#0f172a' }}>
                     Road<span style={{ color: '#3b82f6' }}>SOS</span>
                   </div>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
                  Calling {callNumber}...
                </div>
              </div>
            </div>

            {/* Script Box */}
            <div style={{ padding: '0 20px 24px' }}>
              <div style={{ background: '#EFF6FF', border: '1.5px solid #93C5FD', borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1D4ED8', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  <PhoneCall size={16} strokeWidth={2.5} /> Say this to the dispatcher:
                </div>
                <p style={{ fontSize: 17, fontWeight: 600, color: '#1E3A8A', lineHeight: 1.5 }}>"{dispatchText}"</p>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#3B82F6', marginTop: 12 }}>
                  Read this out loud. The dispatcher will guide you next.
                </div>
              </div>
            </div>

            {/* Plus Code */}
            {plusCode && (
              <div style={{ padding: '0 20px 16px' }}>
                <div style={{ fontSize: 13, color: '#475569', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>📍 Plus Code:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1D4ED8' }}>{plusCode}</span>
                </div>
              </div>
            )}

            {/* SOS follow-up */}
            {SosFollowUp}

            {/* Close Button */}
            <div style={{ padding: '0 20px 24px' }}>
              <button
                onClick={() => { cancelSpeech(); onCancel?.(); }}
                style={{
                  width: '100%', height: 52, borderRadius: 12,
                  background: '#F1F5F9', border: '1.5px solid #E2E8F0', color: '#334155',
                  fontSize: 16, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#E2E8F0'}
                onMouseOut={(e) => e.target.style.background = '#F1F5F9'}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ─── MANUAL phase ──────────────────────────────────────────────────────
  const MANUAL_CALLS = [];
  if (numbers?.ambulance) MANUAL_CALLS.push({ label: "Ambulance", num: numbers.ambulance, Icon: Ambulance, cls: "btn-ambulance", name: "Ambulance" });
  if (numbers?.police)    MANUAL_CALLS.push({ label: "Police",    num: numbers.police,    Icon: Shield,    cls: "btn-police", name: "Police" });
  if (numbers?.general && numbers.general !== numbers.ambulance) MANUAL_CALLS.push({ label: "General",   num: numbers.general,   Icon: Phone,     cls: "btn-general", name: "Emergency" });

  return (
    <div className="modal-backdrop modal-backdrop--alert" role="alertdialog" aria-modal="true">
      <div style={{ width: '100%', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', paddingBottom: 32 }}>
        <div className="sheet">
          <div className="handle-bar"><div className="handle" /></div>

          {/* Header */}
          <div className="sheet-head">
            <div className="head-left">
              <div className="head-eyebrow">
                <PhoneCall size={11} strokeWidth={2.5} />
                Call a dispatcher
              </div>
              <div className="head-title">You're in Control</div>
              <div className="head-sub">Explain the situation and share your location.</div>
            </div>
            <button className="close-btn" onClick={() => { cancelSpeech(); onCancel?.(); }}>
              <X size={15} strokeWidth={2.5} />
            </button>
          </div>

          {/* Location */}
          <div className="loc-block">
            <div className="loc-icon-box">
              <Navigation2 size={15} color="#1D4ED8" strokeWidth={2} />
            </div>
            <div className="loc-body">
              <div className="loc-label">Your location</div>
              <div className="loc-address">{landmark || "Location approximate"}</div>
              <div className="loc-gps">
                {location?.lat ? `${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}` : "Acquiring GPS..."}
              </div>
            </div>
            <button className="copy-gps" onClick={doCopy} title="Copy GPS">
              {copied
                ? <Check size={15} strokeWidth={2.5} color="#22C55E" />
                : <Copy size={15} strokeWidth={1.8} />
              }
            </button>
          </div>

          {/* Call buttons */}
          <div className="sec-label" style={{ color: '#64748B' }}>Select a service to call</div>
          <div className="call-list">
            {MANUAL_CALLS.map(({ label, num, Icon, cls, name }) => (
              <a
                key={label}
                href={`tel:${num}`}
                onClick={(e) => guardedTelDial(e, num, name)}
                className={`call-btn ${cls}`}
              >
                <div className="call-icon">
                  <Icon size={18} color="#fff" strokeWidth={2} />
                </div>
                <span className="call-label">{label}</span>
                <span className="call-num">{num}</span>
                <PhoneCall size={15} className="call-chev" strokeWidth={2} />
              </a>
            ))}
          </div>

          {/* Plus Code */}
          {plusCode && (
            <div style={{ padding: '0 20px 8px', fontSize: 13, color: '#475569', display: 'flex', gap: 8 }}>
              <span style={{ fontWeight: 700 }}>📍 Plus Code:</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1D4ED8' }}>{plusCode}</span>
            </div>
          )}

          {/* SOS follow-up */}
          {SosFollowUp}

          {/* Dismiss */}
          <div className="actions">
            <button className="dismiss-btn" onClick={() => { cancelSpeech(); onCancel?.(); }}>
              Close — go back to contacts
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
