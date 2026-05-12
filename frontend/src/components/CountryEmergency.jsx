import React from 'react';
import { guardedTelDial } from '../utils/demoMode';

export default function CountryEmergency({ numbers }) {
  if (!numbers) return null;
  const { country, police, ambulance, fire, general } = numbers;

  const Button = ({ label, num, icon }) => (
    <a
      className="country-emergency__btn"
      href={`tel:${num}`}
      onClick={(e) => guardedTelDial(e, num, label)}
    >
      <span className="country-emergency__icon">{icon}</span>
      <span className="country-emergency__num">{num}</span>
      <span className="country-emergency__label">{label}</span>
    </a>
  );

  return (
    <div className="country-emergency">
      <div className="country-emergency__header">
        <div className="country-emergency__title-row">
          <span className="country-emergency__call-first">🚨 CALL FIRST</span>
          <span className="country-emergency__country">{country}</span>
        </div>
        <span className="country-emergency__always">Works offline · 196 countries</span>
      </div>
      <div className="country-emergency__grid">
        <Button icon="🚑" label="Ambulance" num={ambulance} />
        <Button icon="👮" label="Police"    num={police}    />
        <Button icon="🔥" label="Fire"      num={fire}      />
        <Button icon="📟" label="General"   num={general}   />
      </div>
    </div>
  );
}
