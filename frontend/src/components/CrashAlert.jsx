import React, { useState, useEffect, useRef } from 'react';
import { speakText, buildDispatchText, cancelSpeech } from '../utils/speechUtils';

const CHOOSE_SECONDS  = 10;  // user has this long to pick a mode
const AUTO_SECONDS    = 4;   // countdown before auto-dial fires
const CORRECT_PIN     = '0000';

const PHASE = {
  CHOOSING   : 'choosing',    // show both buttons + countdown
  AUTOMATING : 'automating',  // counting down before call + speech
  MANUAL     : 'manual',      // user is in control
};

export default function CrashAlert({ open, onConfirm, onCancel, numbers, location, landmark }) {
  const [phase, setPhase]       = useState(PHASE.CHOOSING);
  const [seconds, setSeconds]   = useState(CHOOSE_SECONDS);
  const [pin, setPin]           = useState('');
  const [pinError, setPinError] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const intervalRef             = useRef(null);

  // Reset everything when modal opens/closes
  useEffect(() => {
    if (!open) {
      clearInterval(intervalRef.current);
      cancelSpeech();
      setPhase(PHASE.CHOOSING);
      setSeconds(CHOOSE_SECONDS);
      setPin('');
      setPinError(false);
      setSpeaking(false);
      return;
    }
    // Start choosing-phase countdown
    startCountdown(CHOOSE_SECONDS, () => triggerAutomatic());
  }, [open]);

  // ─── Helpers ──────────────────────────────────────────────────────────
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

  function triggerAutomatic() {
    setPhase(PHASE.AUTOMATING);
    startCountdown(AUTO_SECONDS, fireCall);
  }

  async function fireCall() {
    clearInterval(intervalRef.current);
    const callNum = numbers?.ambulance || numbers?.general || '112';
    const text = buildDispatchText({
      landmark,
      lat : location?.lat,
      lon : location?.lon,
      injured  : true,  // worst-case assumption at auto-trigger
      blocking : true,
    });

    // Start speaking immediately
    setSpeaking(true);
    speakText(text).finally(() => setSpeaking(false));

    // Open tel: link ~1 s later so speech begins before call setup
    setTimeout(() => {
      window.location.href = `tel:${callNum}`;
    }, 1200);

    onConfirm?.();
  }

  function handleChooseManual() {
    clearInterval(intervalRef.current);
    cancelSpeech();
    setPhase(PHASE.MANUAL);
  }

  function handleChooseAutomatic() {
    clearInterval(intervalRef.current);
    triggerAutomatic();
  }

  function handleCancelFalseAlarm() {
    if (pin === CORRECT_PIN) {
      clearInterval(intervalRef.current);
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
          <div className="crash-alert__header">
            <span className="crash-alert__icon">⚠️</span>
            <h2>Possible Crash Detected</h2>
          </div>
          <p className="modal__subtitle">
            Sudden deceleration detected. How do you want to respond?
          </p>

          <div className="crash-alert__countdown">
            Auto-mode in <strong>{seconds}s</strong> if no action
          </div>

          <div className="crash-alert__modes">
            <button
              className="crash-mode crash-mode--auto"
              onClick={handleChooseAutomatic}
            >
              <span className="crash-mode__icon">🤖</span>
              <span className="crash-mode__title">Automatic</span>
              <span className="crash-mode__desc">App calls + plays voice message to dispatcher</span>
            </button>

            <button
              className="crash-mode crash-mode--manual"
              onClick={handleChooseManual}
            >
              <span className="crash-mode__icon">📞</span>
              <span className="crash-mode__title">Manual</span>
              <span className="crash-mode__desc">I'll speak to the dispatcher myself</span>
            </button>
          </div>

          <div className="crash-alert__cancel-zone">
            <p className="crash-alert__cancel-label">False alarm? Enter PIN to cancel:</p>
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
              Cancel — false alarm
            </button>
            {pinError && <div className="pin-error-msg">Incorrect PIN (demo: 0000)</div>}
          </div>
        </div>
      </div>
    );
  }

  // ─── AUTOMATING phase ──────────────────────────────────────────────────
  if (phase === PHASE.AUTOMATING) {
    const callNum = numbers?.ambulance || numbers?.general || '112';
    return (
      <div className="modal-backdrop modal-backdrop--alert" role="alertdialog" aria-modal="true">
        <div className="modal modal--alert crash-alert">
          <div className="crash-alert__header">
            <span className="crash-alert__icon">🚨</span>
            <h2>Calling {callNum}</h2>
          </div>

          <div className="crash-alert__auto-countdown">
            {seconds > 0
              ? <><strong>{seconds}</strong><br /><span>seconds</span></>
              : <span>Connecting...</span>
            }
          </div>

          <p className="crash-alert__auto-info">
            Voice message will play automatically:<br />
            <em style={{ fontSize: '13px', opacity: 0.8 }}>
              "{buildDispatchText({ landmark, lat: location?.lat, lon: location?.lon, injured: true, blocking: true })}"
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
          Call a dispatcher and explain the situation. Tell them your location:
        </p>

        {landmark && (
          <div className="crash-alert__landmark">
            📍 {landmark}
          </div>
        )}

        {location?.lat && (
          <div className="crash-alert__coords">
            GPS: {location.lat.toFixed(5)}, {location.lon.toFixed(5)}
          </div>
        )}

        <div className="crash-alert__manual-calls">
          {numbers?.ambulance && (
            <a className="crash-call-btn crash-call-btn--ambulance" href={`tel:${numbers.ambulance}`}>
              🚑 Ambulance · {numbers.ambulance}
            </a>
          )}
          {numbers?.police && (
            <a className="crash-call-btn crash-call-btn--police" href={`tel:${numbers.police}`}>
              👮 Police · {numbers.police}
            </a>
          )}
          {numbers?.general && numbers.general !== numbers.ambulance && (
            <a className="crash-call-btn crash-call-btn--general" href={`tel:${numbers.general}`}>
              📟 General · {numbers.general}
            </a>
          )}
        </div>

        <button className="modal__secondary crash-alert__cancel-btn" onClick={() => { cancelSpeech(); onCancel?.(); }}>
          Close
        </button>
      </div>
    </div>
  );
}
