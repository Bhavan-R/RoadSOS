import React, { useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, XCircle, ArrowRight, Stethoscope, Car, Signal } from "lucide-react";
import { buildSosSmsBody } from '../utils/medicalId';
import { encodePlusCode } from '../utils/plusCodes';

const QUESTIONS = [
  {
    id: "injured",
    text: "Is anyone injured?",
    Icon: Stethoscope,
    iconColor: "#DC2626",
    yesLabel: "Yes, injured",
    noLabel: "No injuries",
  },
  {
    id: "blocking",
    text: "Is the vehicle blocking the road?",
    Icon: Car,
    iconColor: "#1D4ED8",
    yesLabel: "Yes, blocking",
    noLabel: "Road is clear",
  },
];

function getSummary(ans) {
  const { injured, blocking } = ans;
  if (injured === undefined || blocking === undefined) return { msg: "Answer both questions to get a priority recommendation.", type: "idle" };
  if (injured === true)
    return { msg: "Injury reported — Ambulance (108) will be prioritised first.", type: "urgent" };
  if (blocking === true)
    return { msg: "Road blocked — Police (100) and Towing recommended.", type: "clear" };
  return { msg: "No injury, road clear — Repair or Towing services suggested.", type: "clear" };
}

/**
 * TriageModal — appears on load, collects injury + blocking answers,
 * calls onSubmit({ injured, blocking }) and shows loading state.
 */
export default function TriageModal({ open, loading, onSubmit, onSkip, location, landmark, topContact }) {
  const [ans, setAns] = useState({});

  if (!open) return null;

  const toggle = (qid, val) => {
    if (loading) return; // prevent toggling while submitting
    setAns(prev => ({ ...prev, [qid]: prev[qid] === val ? undefined : val }));
  };

  const allAnswered = ans.injured !== undefined && ans.blocking !== undefined;
  const { msg, type } = getSummary(ans);

  const handleSubmit = () => {
    if (!allAnswered || loading) return;
    onSubmit({ injured: ans.injured, blocking: ans.blocking });
  };

  const handleMiniSOS = () => {
    if (!location?.lat || !location?.lon) {
      alert("GPS location not available yet.");
      return;
    }
    const plusCode = encodePlusCode(location.lat, location.lon);
    const message  = buildSosSmsBody({ lat: location.lat, lon: location.lon, plusCode, landmark });
    const encoded  = encodeURIComponent(message);
    const win = window.open(`https://wa.me/?text=${encoded}`, '_blank');
    setTimeout(() => {
      if (!win || win.closed || win.closed === undefined) {
        window.location.href = `sms:?body=${encoded}`;
      }
    }, 800);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Quick triage">
      <div className="sheet">

        {/* Handle */}
        <div className="handle-bar"><div className="handle" /></div>

        {/* Header */}
        <div className="sheet-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="sheet-label">
              <Activity size={13} strokeWidth={2.5} />
              Quick Triage
            </div>
            <div className="sheet-title">What happened?</div>
            <div className="sheet-sub">
              Two questions — we will prioritise the right help for your situation.
            </div>
          </div>
          
          <button 
            onClick={handleMiniSOS}
            className="triage-sos-btn"
            title="Send immediate SOS"
          >
            SOS
          </button>
        </div>

        {/* Questions */}
        <div className="questions">
          {QUESTIONS.map(({ id, text, Icon, iconColor, yesLabel, noLabel }) => (
            <div className="question-block" key={id}>
              <div className="question-text">
                <div className="q-icon">
                  <Icon size={14} color={iconColor} strokeWidth={2.2} />
                </div>
                {text}
              </div>
              <div className="choice-row">
                <button
                  className={`choice-btn ${ans[id] === true ? "yes-active" : "idle"}`}
                  onClick={() => toggle(id, true)}
                  disabled={loading}
                  aria-pressed={ans[id] === true}
                >
                  {ans[id] === true
                    ? <XCircle size={16} strokeWidth={2.2} />
                    : <span style={{ width: 16, height: 16, border: "2px solid #CBD5E1", borderRadius: "50%", display: "inline-block" }} />
                  }
                  {yesLabel}
                </button>
                <button
                  className={`choice-btn ${ans[id] === false ? "no-active" : "idle"}`}
                  onClick={() => toggle(id, false)}
                  disabled={loading}
                  aria-pressed={ans[id] === false}
                >
                  {ans[id] === false
                    ? <CheckCircle size={16} strokeWidth={2.2} />
                    : <span style={{ width: 16, height: 16, border: "2px solid #CBD5E1", borderRadius: "50%", display: "inline-block" }} />
                  }
                  {noLabel}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Summary bar */}
        <div className="sheet-divider" />
        <div className={`summary-bar ${type === "idle" ? "" : type}`}>
          {type === "urgent" && <AlertTriangle size={15} strokeWidth={2} style={{ flexShrink: 0 }} />}
          {type === "clear"  && <CheckCircle  size={15} strokeWidth={2} style={{ flexShrink: 0 }} />}
          {msg}
        </div>

        {/* Actions */}
        <div className="actions">
          <button 
            className="get-help-btn" 
            disabled={!allAnswered || loading}
            onClick={handleSubmit}
          >
            {loading ? (
              '⏳ Prioritising...'
            ) : (
              <>
                <ArrowRight size={18} strokeWidth={2.5} />
                {allAnswered ? "Get Prioritised Help" : "Answer both questions"}
              </>
            )}
          </button>
          <button 
            className="skip-btn"
            onClick={onSkip}
            disabled={loading}
          >
            Skip — show all contacts
          </button>
        </div>

      </div>
    </div>
  );
}
