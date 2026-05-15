import React from 'react';

// Mini contact card for the dock
function MiniContact({ icon, name, kind, km, phone, tone, last }) {
  const tones = {
    red: { bg: 'rgba(220, 38, 38, 0.12)', fg: '#DC2626' },
    blue: { bg: 'rgba(29, 78, 216, 0.12)', fg: '#1D4ED8' },
    teal: { bg: 'rgba(20, 184, 166, 0.14)', fg: '#0F766E' },
  };
  const t = tones[tone];

  return (
    <div
      style={{
        padding: '11px 14px',
        borderTop: '1px solid #F1F5F9',
        display: 'grid',
        gridTemplateColumns: '32px 1fr auto',
        gap: 11,
        alignItems: 'center',
        borderBottomLeftRadius: last ? 16 : 0,
        borderBottomRightRadius: last ? 16 : 0,
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          background: t.bg,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {icon}
      </span>
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontFamily: 'var(--rs-font-display, "Space Grotesk", system-ui, sans-serif)',
            fontSize: 13,
            fontWeight: 700,
            color: '#0F172A',
            letterSpacing: '-0.2px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 10.5,
            color: '#64748B',
            marginTop: 1,
            fontWeight: 500,
          }}
        >
          {kind} <span style={{ color: '#CBD5E1' }}>·</span>{' '}
          <span style={{ fontFamily: 'var(--rs-font-mono, "JetBrains Mono", ui-monospace, monospace)' }}>
            {km} km
          </span>
        </span>
      </span>
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 10px',
          borderRadius: 10,
          background: '#EFF6FF',
          border: '1px solid #DBEAFE',
          color: '#1D4ED8',
          fontFamily: 'var(--rs-font-mono, "JetBrains Mono", ui-monospace, monospace)',
          fontSize: 11.5,
          fontWeight: 800,
          letterSpacing: '-0.3px',
          cursor: 'pointer',
        }}
      >
        ☎️ {phone}
      </button>
    </div>
  );
}

// Quick contacts dock (bottom sheet showing 3 nearest contacts)
export function QuickContactsDock({ contacts = [] }) {
  const topThree = contacts.slice(0, 3);

  if (!topThree.length) {
    return null;
  }

  const iconMap = {
    ambulance: '🚑',
    hospital: '🏥',
    police: '🚓',
    shield: '🛡️',
    fire: '🔥',
    towing: '🚗',
    repair: '🔧',
  };

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.55)',
      }}
    >
      <div
        style={{
          padding: '10px 14px 4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--rs-font-display, "Space Grotesk", system-ui, sans-serif)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.16em',
            color: '#64748B',
            textTransform: 'uppercase',
          }}
        >
          Nearest 3 · Tap to call
        </span>
        <span
          style={{
            fontFamily: 'var(--rs-font-display, "Space Grotesk", system-ui, sans-serif)',
            fontSize: 11,
            fontWeight: 700,
            color: '#1D4ED8',
            letterSpacing: '-0.1px',
            cursor: 'pointer',
          }}
        >
          See all →
        </span>
      </div>
      {topThree.map((contact, idx) => (
        <MiniContact
          key={contact.id}
          icon={iconMap[contact.category] || '📍'}
          name={contact.name}
          kind={contact.category.charAt(0).toUpperCase() + contact.category.slice(1)}
          km={contact.distance.toFixed(1)}
          phone={contact.phone}
          tone={contact.category === 'hospital' ? 'red' : contact.category === 'police' ? 'blue' : 'teal'}
          last={idx === topThree.length - 1}
        />
      ))}
    </div>
  );
}
