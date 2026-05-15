import React, { useMemo } from 'react';
import ContactCard from './ContactCard';
import { CATS } from '../App';

export default function ContactList({ contacts, loading, error, cachedAt, cat, setCat }) {
  // Memoize filtered contacts based on the selected category
  const filtered = useMemo(() => {
    if (!contacts) return [];
    if (cat === "All") return contacts;
    return contacts.filter(c => {
      const cCat = (c.category || 'repair').toLowerCase();
      return cCat === cat.toLowerCase();
    });
  }, [contacts, cat]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="loading-box">
        <div className="spinner" aria-hidden="true" />
        <div style={{ fontWeight: 500, color: '#FFFFFF' }}>Finding nearby help...</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>Searching hospitals, police &amp; more</div>
      </div>
    );
  }

  // ── Error state — only block if no fallback contacts available ───────────
  if (error && (!contacts || contacts.length === 0)) {
    return (
      <div className="loading-box" role="alert">
        <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
        <div style={{ fontWeight: 500, color: '#FFFFFF' }}>Could not load contacts</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>{error}</div>
      </div>
    );
  }

  // ── Results ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Category Filters */}
      <div className="filters" style={{ marginBottom: 10 }}>
        {CATS.map(c => (
          <button
            key={c}
            className={`chip ${c === cat ? "chip-on" : "chip-off"}`}
            onClick={() => setCat(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {error && (
        <div className="cached-note" role="alert" style={{ background: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.4)', color: '#fbbf24' }}>
          ⚠️ {error}
        </div>
      )}

      {cachedAt && (
        <div className="cached-note">
          ⏱ Showing cached results from {cachedAt}
        </div>
      )}

      {/* Service List */}
      <div className="svc-list">
        {(!contacts || contacts.length === 0) ? (
          <div className="empty">No services found here. Call the national emergency number above.</div>
        ) : filtered.length === 0 ? (
          <div className="empty">No services found in this category</div>
        ) : (
          filtered.map((c, idx) => (
            <ContactCard
              key={c.id || `contact-${idx}`}
              contact={c}
              isLast={idx === filtered.length - 1}
            />
          ))
        )}
      </div>
    </>
  );
}
