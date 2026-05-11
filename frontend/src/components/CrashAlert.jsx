import React, { useState, useEffect } from 'react';

const COUNTDOWN_SECONDS = 15;
const CORRECT_PIN = '0000';

export default function CrashAlert({ open, onConfirm, onCancel }) {
  const [seconds, setSeconds] = useState(COUNTDOWN_SECONDS);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);

  useEffect(() => {
    if (!open) {
      setSeconds(COUNTDOWN_SECONDS);
      setPin('');
      setPinError(false);
      return;
    }
    const interval = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          clearInterval(interval);
          onConfirm?.();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [open, onConfirm]);

  if (!open) return null;

  const handleCancel = () => {
    if (pin === CORRECT_PIN) {
      onCancel?.();
    } else {
      setPinError(true);
      setPin('');
      setTimeout(() => setPinError(false), 1500);
    }
  };

  return (
    <div className="modal-backdrop modal-backdrop--alert" role="alertdialog" aria-modal="true">
      <div className="modal modal--alert">
        <h2>⚠ Possible Crash Detected</h2>
        <p className="modal__subtitle">
          Your vehicle decelerated rapidly. SOS will broadcast in <strong>{seconds}s</strong>.
        </p>
        <p className="modal__subtitle">
          To cancel, enter the safety PIN (demo: <code>0000</code>):
        </p>
        <input
          className={`pin-input ${pinError ? 'pin-input--error' : ''}`}
          type="tel"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="0000"
          autoFocus
        />
        <div className="modal__actions">
          <button className="modal__primary modal__primary--danger" onClick={onConfirm}>
            Send SOS Now
          </button>
          <button
            className="modal__secondary"
            onClick={handleCancel}
            disabled={pin.length !== 4}
          >
            Cancel with PIN
          </button>
        </div>
        {pinError && <div className="pin-error-msg">Incorrect PIN</div>}
      </div>
    </div>
  );
}
