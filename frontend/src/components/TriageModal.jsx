import React, { useState } from 'react';

export default function TriageModal({ open, onSubmit, onSkip, loading }) {
  const [injured, setInjured] = useState(null);
  const [blocking, setBlocking] = useState(null);

  if (!open) return null;

  const ready = injured !== null && blocking !== null;

  const handleSubmit = () => {
    if (!ready || loading) return;
    onSubmit({ injured, blocking });
  };

  const Choice = ({ value, current, setter, label }) => (
    <button
      className={`choice ${current === value ? 'choice--selected' : ''}`}
      onClick={() => setter(value)}
      disabled={loading}
    >
      {label}
    </button>
  );

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <h2>Quick Triage</h2>
        <p className="modal__subtitle">Two questions. Our AI will prioritise contacts for your situation.</p>

        <div className="modal__question">
          <label>Is anyone injured?</label>
          <div className="choices">
            <Choice value={true} current={injured} setter={setInjured} label="Yes" />
            <Choice value={false} current={injured} setter={setInjured} label="No" />
          </div>
        </div>

        <div className="modal__question">
          <label>Is the vehicle blocking the road?</label>
          <div className="choices">
            <Choice value={true} current={blocking} setter={setBlocking} label="Yes" />
            <Choice value={false} current={blocking} setter={setBlocking} label="No" />
          </div>
        </div>

        <div className="modal__actions">
          <button
            className="modal__primary"
            onClick={handleSubmit}
            disabled={!ready || loading}
          >
            {loading ? 'AI is prioritising...' : 'Get Help'}
          </button>
          <button className="modal__secondary" onClick={onSkip} disabled={loading}>
            Skip · Show all contacts
          </button>
        </div>
      </div>
    </div>
  );
}
