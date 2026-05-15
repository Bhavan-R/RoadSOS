import React, { useState, useEffect } from 'react';
import {
  getMedicalId, saveMedicalId, clearMedicalId, hasMedicalId,
} from '../utils/medicalId';

/**
 * Medical ID — view + edit modal.
 *
 * Two states:
 *   - Display: high-contrast paramedic-friendly card. Shows blood type
 *     and allergies prominently. "Edit" and "Close" buttons.
 *   - Edit: form for all fields. Save persists to localStorage.
 *
 * Props:
 *   open       {boolean}
 *   onClose    {function}
 *   startInEdit {boolean}  — open straight into edit mode (first run)
 */
export default function MedicalIdModal({ open, onClose, startInEdit = false }) {
  const [editing, setEditing] = useState(startInEdit || !hasMedicalId());
  const [data, setData]       = useState(getMedicalId());

  useEffect(() => {
    if (open) {
      setData(getMedicalId());
      setEditing(startInEdit || !hasMedicalId());
    }
  }, [open, startInEdit]);

  if (!open) return null;

  const update = (field, value) => setData((d) => ({ ...d, [field]: value }));

  const handleSave = () => {
    saveMedicalId(data);
    setEditing(false);
  };

  const handleClear = () => {
    if (!window.confirm('Clear all Medical ID data?')) return;
    clearMedicalId();
    setData(getMedicalId());
    setEditing(true);
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Emergency Medical ID"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="modal medical-id">
        <div className="modal__header-row">
          <span className="modal__header-icon">🆔</span>
          <div>
            <h2>Emergency Medical ID</h2>
            <p className="modal__subtitle">
              Visible to first responders. Stored only on this device — never sent to any server.
            </p>
          </div>
        </div>

        {!editing && (
          <DisplayCard data={data} />
        )}

        {editing && (
          <EditForm data={data} update={update} />
        )}

        <div className="modal__actions">
          {!editing && (
            <>
              <button className="modal__primary" onClick={() => setEditing(true)}>
                ✏️ Edit
              </button>
              <button className="modal__secondary" onClick={onClose}>
                Close
              </button>
            </>
          )}
          {editing && (
            <>
              <button className="modal__primary" onClick={handleSave}>
                💾 Save
              </button>
              <button className="modal__secondary" onClick={hasMedicalId() ? () => setEditing(false) : onClose}>
                Cancel
              </button>
              {hasMedicalId() && (
                <button className="medical-id__clear" onClick={handleClear}>
                  Clear all
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────

function DisplayCard({ data }) {
  const has = (v) => v && String(v).trim().length > 0;
  if (!hasMedicalId()) {
    return (
      <p className="medical-id__empty">
        No Medical ID set yet. Tap <strong>Edit</strong> to add the info paramedics need (blood
        type, allergies, emergency contact, etc.).
      </p>
    );
  }
  return (
    <div className="medical-id__card">
      {has(data.name) && (
        <div className="medical-id__name">
          {data.name}{has(data.age) ? `, ${data.age}` : ''}
        </div>
      )}
      {has(data.bloodType) && (
        <Row label="Blood type" value={data.bloodType} highlight />
      )}
      {has(data.allergies) && (
        <Row label="Allergies" value={data.allergies} highlight />
      )}
      {has(data.conditions) && (
        <Row label="Conditions" value={data.conditions} />
      )}
      {has(data.medications) && (
        <Row label="Current medications" value={data.medications} />
      )}
      {(has(data.primaryContactName) || has(data.primaryContactPhone)) && (
        <Row
          label="Emergency contact"
          value={
            <span>
              {data.primaryContactName}
              {has(data.primaryContactPhone) && (
                <>
                  {' · '}
                  <a href={`tel:${data.primaryContactPhone}`}>
                    {data.primaryContactPhone}
                  </a>
                </>
              )}
            </span>
          }
        />
      )}
      {data.organDonor && (
        <Row label="Organ donor" value="Yes" highlight />
      )}
    </div>
  );
}

function Row({ label, value, highlight = false }) {
  return (
    <div className={`medical-id__row ${highlight ? 'medical-id__row--hl' : ''}`}>
      <span className="medical-id__row-label">{label}</span>
      <span className="medical-id__row-value">{value}</span>
    </div>
  );
}

function EditForm({ data, update }) {
  return (
    <div className="medical-id__form">
      <Field label="Full name"        value={data.name}                onChange={(v) => update('name', v)} />
      <Field label="Age"              value={data.age}                 onChange={(v) => update('age', v)} type="number" />
      <Field label="Blood type"       value={data.bloodType}           onChange={(v) => update('bloodType', v)} placeholder="e.g. O+, A-, AB+" />
      <Field label="Allergies"        value={data.allergies}           onChange={(v) => update('allergies', v)} placeholder="e.g. penicillin, peanuts" />
      <Field label="Medical conditions" value={data.conditions}         onChange={(v) => update('conditions', v)} placeholder="e.g. asthma, diabetes type II" />
      <Field label="Current medications" value={data.medications}       onChange={(v) => update('medications', v)} placeholder="e.g. metformin, salbutamol" />
      <Field label="Emergency contact name" value={data.primaryContactName} onChange={(v) => update('primaryContactName', v)} />
      <Field label="Emergency contact phone" value={data.primaryContactPhone} onChange={(v) => update('primaryContactPhone', v)} type="tel" placeholder="+91…" />
      <label className="medical-id__checkbox">
        <input
          type="checkbox"
          checked={!!data.organDonor}
          onChange={(e) => update('organDonor', e.target.checked)}
        />
        <span>I am an organ donor</span>
      </label>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <label className="medical-id__field">
      <span className="medical-id__field-label">{label}</span>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={type === 'tel' ? 'tel' : undefined}
      />
    </label>
  );
}
