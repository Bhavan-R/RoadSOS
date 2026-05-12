import React, { useState } from 'react';

/**
 * TriageModal — appears on load, collects injury + blocking answers,
 * calls onSubmit({ injured, blocking }) and shows loading state.
 *
 * Props:
 *   open     {boolean}
 *   loading  {boolean}  — true while AI is prioritising
 *   onSubmit {function} — called with { injured, blocking }
 *   onSkip   {function} — user wants to skip triage
 */
export default function TriageModal({ open, loading, onSubmit, onSkip }) {
  const [injured,  setInjured]  = useState(null);
  const [blocking, setBlocking] = useState(null);

  if (!open) return null;

  const ready = injured !== null && blocking !== null;

  const handleSubmit = () => {
    if (!ready || loading) return;
    onSubmit({ injured, blocking });
  };

  const Choice = ({ value, current, setter, label, emoji }) => (
    <button
      className={`choice ${current === value ? 'choice--selected' : ''}`}
      onClick={() => setter(value)}
      disabled={loading}
      aria-pressed={current === value}
      id={`choice-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <span className="choice__emoji">{emoji}</span>
      {label}
    </button>
  );

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Quick triage"
    >
      <div className="modal">
        {/* Header */}
        <div className="modal__header-row">
          <span className="modal__header-icon">🩺</span>
          <div>
            <h2>Quick Triage</h2>
            <p className="modal__subtitle">
              Two questions · AI will prioritise the right help for your situation.
            </p>
          </div>
        </div>

        {/* Q1: injured? */}
        <div className="modal__question">
          <label className="modal__question-label">
            Is anyone injured?
          </label>
          <div className="choices">
            <Choice value={true}  current={injured} setter={setInjured}  label="Yes" emoji="🤕" />
            <Choice value={false} current={injured} setter={setInjured}  label="No"  emoji="✅" />
          </div>
        </div>

        {/* Q2: blocking? */}
        <div className="modal__question">
          <label className="modal__question-label">
            Is the vehicle blocking the road?
          </label>
          <div className="choices">
            <Choice value={true}  current={blocking} setter={setBlocking} label="Yes" emoji="🚧" />
            <Choice value={false} current={blocking} setter={setBlocking} label="No"  emoji="✅" />
          </div>
        </div>

        {/* Actions */}
        <div className="modal__actions">
          <button
            className="modal__primary"
            id="triage-submit-btn"
            onClick={handleSubmit}
            disabled={!ready || loading}
            aria-busy={loading}
          >
            {loading
              ? '⏳ AI is prioritising contacts...'
              : '🆘 Get Help'}
          </button>
          <button
            className="modal__secondary"
            id="triage-skip-btn"
            onClick={onSkip}
            disabled={loading}
          >
            Skip · Show all contacts as-is
          </button>
        </div>
      </div>
    </div>
  );
}
