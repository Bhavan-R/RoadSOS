import React, { useState, useEffect, useRef } from 'react';
import { speakText, buildDispatchText, cancelSpeech } from '../utils/speechUtils';
import { startAlarm, stopAlarm } from '../utils/alarmUtils';
import { safeAutoDial, guardedTelDial, DEMO_MODE } from '../utils/demoMode';

const CHOOSE_SECONDS = 10;
const AUTO_SECONDS   = 4;
const CORRECT_PIN    = '0000';

const PHASE = {
  CHOOSING   : 'choosing',
  AUTOMATING : 'automating',
  MANUAL     : 'manual',
};

export default function CrashAlert({ open, onConfirm, onCancel, numbers, location, landmark }) {
  const [phase, setPhase]       = useState(PHASE.CHOOSING);
  const [seconds, setSeconds]   = useState(CHOOSE_SECONDS);
  const [pin, setPin]           = useState('');
  const [pinError, setPinError] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const intervalRef             = useRef(null);

  const callNumber = numbers?.ambulance || numbers?.general || '112';

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
      return;
    }

    // Start bystander alarm immediately — siren + looping voice announcement
    startAlarm(callNumber);

    // Start choosing-phase countdown
    startCountdown(CHOOSE_SECONDS, () => triggerAutomatic());
  }, [open]);                                    // eslint-disable-line react-hooks/exhaustive-deps

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
    stopAlarm();             // stop bystander alarm — we're now calling
    setPhase(PHASE.AUTOMATING);
    startCountdown(AUTO_SECONDS, fireCall);
  }

  async function fireCall() {
    clearInterval(intervalRef.current);
    const text = buildDispatchText({
      landmark,
      lat     : location?.lat,
      lon     : location?.lon,
      injured : true,
      blocking: true,
    });

    setSpeaking(true);
    speakText(text).finally(() => setSpeaking(false));

    // Demo mode: shows a toast instead of placing a real emergency call.
    // Production (?demo=0): dials the actual number.
    setTimeout(() => {
      safeAutoDial(callNumber, 'Ambulance');
    }, 1200);

    onConfirm?.();
  }

  // ─── Mode: MANUAL ─────────────────────────────────────────────────────
  function handleChooseManual() {
    clearInterval(intervalRef.current);
    stopAlarm();
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

  // ─── CHOOSING phase ────────────────────────────────────────────────────
  if (phase === PHASE.CHOOSING) {
    return (
      <div className="modal-backdrop modal-backdrop--alert" role="alertdialog" aria-modal="true">
        <div className="modal modal--alert crash-alert">

          {/* Bystander banner — large, readable from a distance */}
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
            <button
              className="crash-mode crash-mode--auto"
              onClick={triggerAutomatic}
            >
              <span className="crash-mode__icon">🤖</span>
              <span className="crash-mode__title">Automatic</span>
              <span className="crash-mode__desc">App calls + plays voice to dispatcher</span>
            </button>

            <button
              className="crash-mode crash-mode--manual"
              onClick={handleChooseManual}
            >
              <span className="crash-mode__icon">📞</span>
              <span className="crash-mode__title">Manual</span>
              <span className="crash-mode__desc">I'll speak to dispatcher myself</span>
            </button>
          </div>

          <div className="crash-alert__cancel-zone">
            <p className="crash-alert__cancel-label">False alarm? Enter PIN to stop alarm:</p>
            <input
              className={`pin-input ${pinError ? 'pin-input--error' : ''}`}
              type="tel"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="0000"
            />
            <button
              className="modal__secondary"
              onClick={handleCancelFalseAlarm}
              disabled={pin.length !== 4}
            >
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

          <p className="crash-alert__auto-info">
            Voice message will play to dispatcher:<br />
            <em style={{ fontSize: '13px', opacity: 0.8 }}>
              "{buildDispatchText({
                landmark,
                lat     : location?.lat,
                lon     : location?.lon,
                injured : true,
                blocking: true,
              })}"
            </em>
          </p>

          {speaking && (
            <div className="crash-alert__speaking">
              🔊 Speaking to dispatcher...
            </div>
          )}

          <button className="modal__secondary crash-alert__cancel-btn" onClick={handleCancelAuto}>
            Cancel
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
          Call a dispatcher and explain the situation. Your location:
        </p>

        {landmark && (
          <div className="crash-alert__landmark">📍 {landmark}</div>
        )}
        {location?.lat && (
          <div className="crash-alert__coords">
            GPS: {location.lat.toFixed(5)}, {location.lon.toFixed(5)}
          </div>
        )}

        <div className="crash-alert__manual-calls">
          {numbers?.ambulance && (
            <a
              className="crash-call-btn crash-call-btn--ambulance"
              href={`tel:${numbers.ambulance}`}
              onClick={(e) => guardedTelDial(e, numbers.ambulance, 'Ambulance')}
            >
              🚑 Ambulance · {numbers.ambulance}
            </a>
          )}
          {numbers?.police && (
            <a
              className="crash-call-btn crash-call-btn--police"
              href={`tel:${numbers.police}`}
              onClick={(e) => guardedTelDial(e, numbers.police, 'Police')}
            >
              👮 Police · {numbers.police}
            </a>
          )}
          {numbers?.general && numbers.general !== numbers.ambulance && (
            <a
              className="crash-call-btn crash-call-btn--general"
              href={`tel:${numbers.general}`}
              onClick={(e) => guardedTelDial(e, numbers.general, 'Emergency')}
            >
              📟 General · {numbers.general}
            </a>
          )}
        </div>

        <button
          className="modal__secondary crash-alert__cancel-btn"
          onClick={() => { cancelSpeech(); onCancel?.(); }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
