import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { LOCALES, changeLanguage } from '../i18n';

/**
 * Detect browsers that may have reduced functionality with RoadSOS.
 * Returns a string description of the issue, or null if fully compatible.
 *
 * We check features, not UA strings, so future browser versions that fix
 * the issues automatically pass. UA is used only as a tie-breaker for
 * known incomplete implementations (e.g. Safari's DeviceMotion quirks).
 */
function detectCompatibilityWarning() {
  try {
    const ua = navigator.userAgent || '';

    // No geolocation = the app is fundamentally broken (GPS is core)
    if (!('geolocation' in navigator)) {
      return 'Your browser does not support GPS location. Emergency service search will not work. Please open RoadSOS in Chrome or Firefox.';
    }

    // Safari (desktop or iOS) — geolocation works but crash detection
    // requires user gesture for DeviceMotion, and private-mode IndexedDB
    // quota is near-zero which silently breaks the offline cache.
    const isSafari =
      /Safari/i.test(ua) && !/Chrome|Chromium|Android/i.test(ua);
    if (isSafari) {
      return 'Safari has limited support for crash detection and offline caching. For full functionality, use Chrome or Firefox.';
    }

    // Samsung Internet < 14 and UC Browser lack reliable motion APIs
    const isSamsungOld = /SamsungBrowser\/(\d+)/.exec(ua);
    if (isSamsungOld && Number(isSamsungOld[1]) < 14) {
      return 'Your Samsung Internet version may not support crash detection. Update to the latest version or use Chrome.';
    }
    const isUC = /UCBrowser|UCWEB/i.test(ua);
    if (isUC) {
      return 'UC Browser has known compatibility issues with GPS and offline features. Please use Chrome or Firefox.';
    }

    // Internet Explorer (any version)
    if (/Trident|MSIE/.test(ua)) {
      return 'Internet Explorer is not supported. Please open RoadSOS in Chrome, Firefox, or Edge.';
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * First-launch language picker.
 *
 * Renders as a full-screen modal that gates the rest of the app until the
 * user picks a language. All languages are displayed without pre-selection,
 * requiring manual user selection.
 *
 * Languages are grouped: India (22 Schedule-VIII languages) vs World.
 */
export default function LanguagePicker({ onConfirm }) {
  const { t, i18n } = useTranslation();
  const compatWarning = useMemo(() => detectCompatibilityWarning(), []);

  // No language pre-selected — user must actively choose.
  const [selected, setSelected] = useState(null);

  const handlePick = (code) => {
    setSelected(code);
    // Single-tap: change language and confirm immediately.
    changeLanguage(code);
    onConfirm?.(code);
  };

  const indiaLocales = LOCALES.filter((l) => l.region === 'India');
  const worldLocales = LOCALES.filter((l) => l.region === 'World');

  return (
    <div className="lang-picker-overlay" role="dialog" aria-modal="true">
      <div className="lang-picker-card">

        {/* Browser compatibility warning — shown before language tiles */}
        {compatWarning && (
          <div className="lang-picker-compat-warn" role="alert">
            <AlertTriangle size={15} strokeWidth={2.2} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{compatWarning}</span>
          </div>
        )}

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
