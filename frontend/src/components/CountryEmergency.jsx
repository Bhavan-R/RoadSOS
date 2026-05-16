import React from 'react';
import { Ambulance, Shield, Flame, Phone } from 'lucide-react';
import { guardedTelDial } from '../utils/demoMode';

const EMERGENCY_CONFIG = [
  { key: 'ambulance', label: 'Ambulance', short: 'AMB', Icon: Ambulance, color: '#DC2626' },
  { key: 'police',    label: 'Police',    short: 'POL', Icon: Shield,    color: '#1D4ED8' },
  { key: 'fire',      label: 'Fire',      short: 'FIR', Icon: Flame,     color: '#F59E0B' },
  { key: 'general',   label: 'Disaster',  short: 'DIS', Icon: Phone,     color: '#22C55E' },
];

export default function CountryEmergency({ numbers }) {
  if (!numbers) return null;

  const { police, ambulance, fire, general } = numbers;
  const vals = { police, ambulance, fire, general };

  return (
    <div className="national-grid">
      {EMERGENCY_CONFIG.map(({ key, label, short, Icon, color }) => {
        const num = vals[key];
        if (!num) return null;

        return (
          <a
            key={key}
            href={`tel:${num}`}
            className="nat-card"
            id={`ce-btn-${key}`}
            data-num={num}
            aria-label={`Call ${label}: ${num}`}
            onClick={(e) => guardedTelDial(e, num, label)}
          >
            <div className="nat-icon" style={{ background: color + '22' }}>
              <Icon size={20} color={color} strokeWidth={2.3} />
            </div>
            <div className="nat-body">
              <div className="nat-label" data-short={short}>{label}</div>
              <div className="nat-num">{num}</div>
            </div>
          </a>
        );
      })}
    </div>
  );
}
