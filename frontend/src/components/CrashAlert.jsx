import React, { useState, useEffect, useRef, useMemo } from 'react';
import { speakText, buildDispatchText, cancelSpeech } from '../utils/speechUtils';
import { startAlarm, stopAlarm } from '../utils/alarmUtils';
import { safeAutoDial, guardedTelDial } from '../utils/demoMode';
import { encodePlusCode } from '../utils/plusCodes';
import { getEmergencyContacts, buildSosSmsBody } from '../utils/medicalId';
import { isWaCountry, buildSosLinks } from '../utils/sosDispatch';

const CHOOSE_SECONDS = 10;
const AUTO_SECONDS   = 4;
const CORRECT_PIN    = '0000';

const PHASE = {
  CHOOSING   : 'choosing',
  AUTOMATING : 'automating',
  CALLING    : 'calling',
  MANUAL     : 'manual',
};

/**
 * CrashAlert — full-screen emergency overlay triggered by crash detection.
 *
 * Props:
 *   open        boolean
 *   onConfirm   function
 *   onCancel    function
 *   numbers     { ambulance, police, general }
 *   location    { lat, lon }
 *   landmark    string | null
 *   countryCode string — e.g. 'IN', 'US' (determines WA vs SMS preference)
 */
export default function CrashAlert({ open, onConfirm, onCancel, numbers, location, landmark, countryCode }) {
  const [phase, setPhase]       = useState(PHASE.CHOOSING);
  const [seconds, setSeconds]   = useState(CHOOSE_SECONDS);
  const [pin, setPin]           = useState('');
  const [pinError, setPinError] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  // sosSent: null | { channel: 'wa'|'sms', links: object }
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
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Countdown helper ─────────────────────────────────────────────────
  function startCountdown(from, onZero) {
    clearInterval(intervalRef.current);
    setSeconds(from);
    intervalRef.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { clearInterval(intervalRef.current); onZero(); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  // ─── Auto-send SOS to emergency contacts ──────────────────────────────
  // Called from both fireCall() and triggerManualWithSos().
  // WA countries  → window.open(wa.me) — opens WhatsApp without navigating away,
  //                 so the ambulance dial setTimeout still fires.
  // SMS countries → window.location.href (group SMS to all) — navigates briefly
  //                 to SMS app; dial fires when user returns, or they can call
  //                 from the CALLING screen manually.
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

  // ─── AUTOMATING phase ─────────────────────────────────────────────────
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

    // 1. Auto-send SOS to emergency contacts NOW (before dial so gesture is fresh)
    dispatchSos();

    // 2. Dial ambulance 600ms later (enough time for WA to open)
    setTimeout(() => safeAutoDial(callNumber, 'Ambulance'), 600);

    onConfirm?.();
  }

  // ─── MANUAL phase ─────────────────────────────────────────────────────
  function handleChooseManual() {
    clearInterval(intervalRef.current);
    stopAlarm();
    // Auto-send SOS when the user consciously picks Manual too —
    // they've confirmed it's a real emergency.
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

  // ─── Shared SOS dispatch follow-up block ──────────────────────────────
  // Shows after SOS auto-fires: confirms who was reached + tap links for
  // remaining contacts / the alternate channel.
  const SosFollowUp = sosSent ? (() => {
    const { channel, links } = sosSent;
    const contact0 = links.perContact[0];
    return (
      <div className="crash-alert__sos-sent">
        <div className="crash-alert__sos-sent-header">
          {channel === 'wa'
            ? `💬 WhatsApp SOS sent to ${contact0.name}`
            : `📱 SMS SOS sent to all ${links.contacts.length} contacts`
          }
        </div>
        <div className="crash-alert__sos-links">
          {links.perContact.map((c, i) => {
            const showWa  = channel === 'sms' || i > 0;  // WA: show WA for contacts 2+
            const showSms = channel === 'wa';              // SMS: show SMS for all in WA mode
            return (
              <div key={i} className="crash-alert__sos-row">
                <span className="crash-alert__sos-name">{c.name}</span>
                <span className="crash-alert__sos-btns">
                  {showWa && (
                    <a href={c.waHref} target="_blank" rel="noopener noreferrer"
                       className="crash-alert__sos-btn crash-alert__sos-btn--wa">💬 WA</a>
                  )}
                  {showSms && (
                    <a href={c.smsHref}
                       className="crash-alert__sos-btn crash-alert__sos-btn--sms">📱 SMS</a>
                  )}
                </span>
              </div>
            );
          })}
          {/* Group SMS shortcut in WA mode */}
          {channel === 'wa' && links.contacts.length > 0 && (
            <a href={links.groupSmsHref} className="crash-alert__sos-group-sms">
              📱 SMS all {links.contacts.length} contacts at once
            </a>
          )}
        </div>
      </div>
    );
  })() : null;

  // ─── CHOOSING phase ────────────────────────────────────────────────────
  if (phase === PHASE.CHOOSING) {
    return (
      <div className="modal-backdrop modal-backdrop--alert" role="alertdialog" aria-modal="true">
        <div className="modal modal--alert crash-alert">

          <div className="crash-alert__bystander-banner">
            <span className="crash-alert__bystander-icon">🚨</span>
            <div>
              <div className="crash-alert__bystander-headline">ACCIDENT DETECTED</div>
              <div className="crash-alert__bystander-sub">
                Call <strong>{callNumber}</strong> for ambulance
              </div>
            </div>
          </div>

          <div className="crash-alert__siren-indicator">
            🔊 Alarm sounding — bystanders are being alerted
          </div>

          <p className="modal__subtitle" style={{ marginTop: 12 }}>
            Sudden deceleration detected. How do you want to respond?
          </p>

          <div className="crash-alert__countdown">
            Auto-mode in <strong>{seconds}s</strong> if no action taken
          </div>

          <div className="crash-alert__modes">
            <button className="crash-mode crash-mode--auto" onClick={triggerAutomatic}>
              <span className="crash-mode__icon">🤖</span>
              <span className="crash-mode__title">Automatic</span>
              <span className="crash-mode__desc">Calls + notifies your contacts automatically</span>
            </button>
            <button className="crash-mode crash-mode--manual" onClick={handleChooseManual}>
              <span className="crash-mode__icon">📞</span>
              <span className="crash-mode__title">Manual</span>
              <span className="crash-mode__desc">I'll call — contacts notified immediately</span>
            </button>
          </div>

          <div className="crash-alert__cancel-zone">
            <p className="crash-alert__cancel-label">False alarm? Enter PIN to stop alarm:</p>
            <input
              className={`pin-input ${pinError ? 'pin-input--error' : ''}`}
              type="tel" inputMode="numeric" maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="0000"
            />
            <button className="modal__secondary" onClick={handleCancelFalseAlarm} disabled={pin.length !== 4}>
              Stop alarm — false alarm
            </button>
            {pinError && <div className="pin-error-msg">Incorrect PIN (demo: 0000)</div>}
          </div>
        </div>
      </div>
    );
  }

  // ─── AUTOMATING phase ──────────────────────────────────────────────────
  if (phase === PHASE.AUTOMATING) {
    return (
      <div className="modal-backdrop modal-backdrop--alert" role="alertdialog" aria-modal="true">
        <div className="modal modal--alert crash-alert">
          <div className="crash-alert__header">
            <span className="crash-alert__icon">🚨</span>
            <h2>Calling {callNumber}</h2>
          </div>
          <div className="crash-alert__auto-countdown">
            {seconds > 0
              ? <><strong>{seconds}</strong><br /><span>seconds</span></>
              : <span>Connecting...</span>
            }
          </div>
          <div className="crash-alert__script-box">
            <div className="crash-alert__script-label">
              {speaking ? '🔊 Listen — then say this to dispatcher:' : '📋 Say this to dispatcher:'}
            </div>
            <p className="crash-alert__script-text">"{dispatchText}"</p>
          </div>
          <button className="modal__secondary crash-alert__cancel-btn" onClick={handleCancelAuto}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ─── CALLING phase ────────────────────────────────────────────────────
  if (phase === PHASE.CALLING) {
    return (
      <div className="modal-backdrop modal-backdrop--alert" role="alertdialog" aria-modal="true">
        <div className="modal modal--alert crash-alert">
          <div className="crash-alert__header">
            <span className="crash-alert__icon">📞</span>
            <h2>Say this to the dispatcher</h2>
          </div>

          <div className="crash-alert__script-box crash-alert__script-box--live">
            <p className="crash-alert__script-text crash-alert__script-text--large">
              "{dispatchText}"
            </p>
          </div>

          {plusCode && (
            <div className="crash-alert__pluscode">
              <span className="crash-alert__pluscode-label">📍 Plus Code</span>
              <span className="crash-alert__pluscode-value">{plusCode}</span>
            </div>
          )}

          {/* SOS follow-up — shows who got auto-notified + remaining contact links */}
          {SosFollowUp}

          <button className="modal__secondary crash-alert__cancel-btn"
            onClick={() => { cancelSpeech(); onCancel?.(); }}>
            Close
          </button>
        </div>
      </div>
    );
  }

  // ─── MANUAL phase ──────────────────────────────────────────────────────
  return (
    <div className="modal-backdrop modal-backdrop--alert" role="alertdialog" aria-modal="true">
      <div className="modal modal--alert crash-alert">
        <div className="crash-alert__header">
          <span className="crash-alert__icon">📞</span>
          <h2>You're in Control</h2>
        </div>
        <p className="modal__subtitle">
          Call a dispatcher and explain the situation. Your contacts have been notified.
        </p>

        {landmark && <div className="crash-alert__landmark">📍 {landmark}</div>}
        {location?.lat && (
          <div className="crash-alert__coords">
            GPS: {location.lat.toFixed(5)}, {location.lon.toFixed(5)}
          </div>
        )}
        {plusCode && (
          <div className="crash-alert__pluscode">
            <span className="crash-alert__pluscode-label">📍 Plus Code</span>
            <span className="crash-alert__pluscode-value">{plusCode}</span>
          </div>
        )}

        <div className="crash-alert__manual-calls">
          {numbers?.ambulance && (
            <a className="crash-call-btn crash-call-btn--ambulance"
               href={`tel:${numbers.ambulance}`}
               onClick={(e) => guardedTelDial(e, numbers.ambulance, 'Ambulance')}>
              🚑 Ambulance · {numbers.ambulance}
            </a>
          )}
          {numbers?.police && (
            <a className="crash-call-btn crash-call-btn--police"
               href={`tel:${numbers.police}`}
               onClick={(e) => guardedTelDial(e, numbers.police, 'Police')}>
              👮 Police · {numbers.police}
            </a>
          )}
          {numbers?.general && numbers.general !== numbers.ambulance && (
            <a className="crash-call-btn crash-call-btn--general"
               href={`tel:${numbers.general}`}
               onClick={(e) => guardedTelDial(e, numbers.general, 'Emergency')}>
              📟 General · {numbers.general}
            </a>
          )}
        </div>

        {/* SOS follow-up — contacts notified on entry to manual mode */}
        {SosFollowUp}

        <button className="modal__secondary crash-alert__cancel-btn"
          onClick={() => { cancelSpeech(); onCancel?.(); }}>
          Close
        </button>
      </div>
    </div>
  );
}
