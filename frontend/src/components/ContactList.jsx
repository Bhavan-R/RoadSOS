import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ContactCard from './ContactCard';
import { CATS } from '../App';

// Map filter chip keys to i18n keys. "All" + "Puncture" are filter-only;
// the rest already exist as category.* keys used elsewhere.
const FILTER_I18N = {
  All: 'filters.all',
  Hospital: 'category.hospital',
  Police: 'category.police',
  Repair: 'category.repair',
  Towing: 'category.towing',
  Fire: 'category.fire',
  Showroom: 'category.showroom',
  Puncture: 'filters.puncture',
};

export default function ContactList({ contacts, loading, error, cachedAt, cat, setCat }) {
  const { t } = useTranslation();

  // Memoize filtered contacts based on the selected category
  const filtered = useMemo(() => {
    if (!contacts) return [];
    if (cat === "All") return contacts;
    return contacts.filter(c => {
      const cCat = (c.category || 'repair').toLowerCase();
      const filterCat = cat === "Puncture" ? "tyre" : cat.toLowerCase();
      return cCat === filterCat;
    });
  }, [contacts, cat]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="loading-box">
        <div className="spinner" aria-hidden="true" />
        <div style={{ fontWeight: 500, color: '#FFFFFF' }}>{t('loading.finding')}</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>{t('loading.subtitle')}</div>
      </div>
    );
  }

  // ── Error state — only block if no fallback contacts available ───────────
  if (error && (!contacts || contacts.length === 0)) {
    return (
      <div className="loading-box" role="alert">
        <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
        <div style={{ fontWeight: 500, color: '#FFFFFF' }}>{t('loading.error')}</div>
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
            {t(FILTER_I18N[c] || c)}
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
          ⏱ {t('list.cached_results', { date: cachedAt })}
        </div>
      )}

      {/* Service List */}
      <div className="svc-list">
        {(!contacts || contacts.length === 0) ? (
          <div className="empty">{t('list.empty_all')}</div>
        ) : filtered.length === 0 ? (
          <div className="empty">{t('list.empty_category')}</div>
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
