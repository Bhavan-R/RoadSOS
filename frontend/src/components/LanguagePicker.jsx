import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LOCALES, changeLanguage, suggestLanguageForCountry } from '../i18n';

/**
 * First-launch language picker.
 *
 * Renders as a full-screen modal that gates the rest of the app until the
 * user picks a language. If we already know the country (from GPS / reverse
 * geocode), we pre-select the country's most-spoken language — the user can
 * still override before tapping Continue.
 *
 * Languages are grouped: India (22 Schedule-VIII languages) vs World.
 */
export default function LanguagePicker({ onConfirm, countryCode }) {
  const { t, i18n } = useTranslation();

  // Initial selection: prior session > country hint > current i18n lang > 'en'
  const suggested = useMemo(
    () => suggestLanguageForCountry(countryCode),
    [countryCode],
  );
  const [selected, setSelected] = useState(
    () => suggested || i18n.language || 'en',
  );

  // If country resolves after initial mount, gently update the suggestion
  // (but only if the user hasn't manually clicked anything yet — we detect
  // that by comparing against the suggestion-derived initial).
  const [userTouched, setUserTouched] = useState(false);
  useEffect(() => {
    if (!userTouched && suggested && suggested !== selected) {
      setSelected(suggested);
      changeLanguage(suggested);
    }
  }, [suggested]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePick = (code) => {
    setUserTouched(true);
    setSelected(code);
    // Live preview — change language immediately so the Continue button
    // updates in the chosen language before the user taps it.
    changeLanguage(code);
  };

  const handleConfirm = () => {
    changeLanguage(selected);
    onConfirm?.(selected);
  };

  const indiaLocales = LOCALES.filter((l) => l.region === 'India');
  const worldLocales = LOCALES.filter((l) => l.region === 'World');

  return (
    <div className="lang-picker-overlay" role="dialog" aria-modal="true">
      <div className="lang-picker-card">
        <div className="lang-picker-header">
          <div className="lang-picker-cross" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2v20M2 12h20" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="lang-picker-title">{t('lang.title')}</div>
            <div className="lang-picker-subtitle">{t('lang.subtitle')}</div>
          </div>
        </div>

        <div className="lang-picker-section-title">🇮🇳 India</div>
        <div className="lang-picker-grid">
          {indiaLocales.map((loc) => (
            <LangTile key={loc.code} loc={loc} selected={selected === loc.code} onPick={handlePick} />
          ))}
        </div>

        <div className="lang-picker-section-title">🌍 World</div>
        <div className="lang-picker-grid">
          {worldLocales.map((loc) => (
            <LangTile key={loc.code} loc={loc} selected={selected === loc.code} onPick={handlePick} />
          ))}
        </div>

        <button
          type="button"
          className="lang-picker-continue"
          onClick={handleConfirm}
        >
          {t('lang.continue')} →
        </button>
      </div>
    </div>
  );
}

function LangTile({ loc, selected, onPick }) {
  return (
    <button
      type="button"
      className={`lang-picker-tile ${selected ? 'is-selected' : ''}`}
      onClick={() => onPick(loc.code)}
      aria-pressed={selected}
      dir={loc.dir || 'ltr'}
    >
      <span className="lang-picker-native">{loc.native}</span>
      <span className="lang-picker-english">{loc.english}</span>
    </button>
  );
}
