import React from 'react';
import ContactCard from './ContactCard';

export default function ContactList({ contacts, loading, error, cachedAt }) {
  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="contact-list contact-list--loading">
        <div className="spinner" aria-hidden="true" />
        <p>Finding nearby help...</p>
        <p className="contact-list__hint">Searching hospitals, police, ambulance &amp; more</p>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="contact-list contact-list--error" role="alert">
        <div className="contact-list__error-icon">⚠️</div>
        <p><strong>Could not load contacts</strong></p>
        <p className="contact-list__error-msg">{error}</p>
        <p className="contact-list__hint">
          National emergency numbers above are always available offline.
        </p>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!contacts || contacts.length === 0) {
    return (
      <div className="contact-list contact-list--empty">
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
        <p>No services found in your area.</p>
        <p className="contact-list__hint">
          Call the national emergency number above.
        </p>
      </div>
    );
  }

  // ── Results ───────────────────────────────────────────────────────────────
  return (
    <div className="contact-list">
      {cachedAt && (
        <div className="cached-note">
          ⏱ Showing cached results from {cachedAt}
        </div>
      )}
      {contacts.map((c, idx) => (
        <ContactCard
          key={c.id || `contact-${idx}`}
          contact={c}
          isTop={idx === 0}
        />
      ))}
    </div>
  );
}
