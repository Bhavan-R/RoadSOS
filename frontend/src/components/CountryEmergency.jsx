import React from 'react';
import { guardedTelDial } from '../utils/demoMode';

/**
 * CountryEmergency — always-visible banner at top of screen.
 *
 * Props: { country, police, ambulance, fire, general }
 * Each value is a dial string (e.g. "108", "100").
 */

const BUTTONS = [
  { key: 'ambulance', icon: '🚑', label: 'Ambulance', colorClass: 'ce-btn--ambulance' },
  { key: 'police',    icon: '👮', label: 'Police',    colorClass: 'ce-btn--police'    },
  { key: 'fire',      icon: '🔥', label: 'Fire',      colorClass: 'ce-btn--fire'      },
  { key: 'general',   icon: '📟', label: 'General',   colorClass: 'ce-btn--general'   },
];

export default function CountryEmergency({ numbers }) {
  if (!numbers) return null;

  const { country, police, ambulance, fire, general } = numbers;
  const vals = { police, ambulance, fire, general };

  return (
    <section className="country-emergency" aria-label="National emergency numbers">
      {/* Header */}
      <div className="country-emergency__header">
        <div className="country-emergency__title-row">
          <span className="country-emergency__call-first">🚨 CALL FIRST</span>
          <span className="country-emergency__country">{country}</span>
        </div>
        <span className="country-emergency__always">Works offline · 196 countries</span>
      </div>

      {/* 4-button grid */}
      <div className="country-emergency__grid">
        {BUTTONS.map(({ key, icon, label, colorClass }) => {
          const num = vals[key];
          if (!num) return null;
          return (
            <a
              key={key}
              href={`tel:${num}`}
              className={`country-emergency__btn ${colorClass}`}
              id={`ce-btn-${key}`}
              aria-label={`Call ${label}: ${num}`}
              onClick={(e) => guardedTelDial(e, num, label)}
            >
              <span className="country-emergency__icon">{icon}</span>
              <span className="country-emergency__num">{num}</span>
              <span className="country-emergency__label">{label}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
