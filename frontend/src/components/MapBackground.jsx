import React from 'react';

// SVG map background with grid, roads, and building blocks
export function MapBackground({ muted = false }) {
  const opacity = muted ? 0.5 : 1;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(circle at 50% 46%, rgba(29, 78, 216, 0.22), transparent 55%),
          linear-gradient(135deg, #0B1424, #060E1C 60%, #03060D)
        `,
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', inset: 0, opacity }}
        aria-hidden="true"
      >
        <defs>
          <pattern id="mb-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.07)" strokeWidth="1" />
          </pattern>
          <pattern id="mb-grid-sm" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 8 0 L 0 0 0 8" fill="none" stroke="rgba(148,163,184,0.025)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mb-grid-sm)" />
        <rect width="100%" height="100%" fill="url(#mb-grid)" />

        {/* major roads */}
        <path
          d="M -30 460 Q 80 380, 200 440 T 460 380"
          stroke="rgba(148,163,184,0.32)"
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M -30 460 Q 80 380, 200 440 T 460 380"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="1"
          strokeDasharray="8 12"
          fill="none"
        />

        <path
          d="M 80 -20 Q 100 200, 200 400 T 360 700"
          stroke="rgba(148,163,184,0.22)"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 60 -20 Q 100 220, 220 400"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="0.8"
          strokeDasharray="6 9"
          fill="none"
        />

        {/* minor roads */}
        <path d="M -10 200 Q 80 220, 180 200 T 420 220" stroke="rgba(148,163,184,0.16)" strokeWidth="4" fill="none" />
        <path d="M -10 620 Q 100 600, 200 620 T 420 640" stroke="rgba(148,163,184,0.15)" strokeWidth="4" fill="none" />
        <path d="M 280 -20 L 320 800" stroke="rgba(148,163,184,0.12)" strokeWidth="3" fill="none" />

        {/* building blocks (subtle) */}
        {[
          [40, 110, 60, 50],
          [120, 90, 50, 70],
          [200, 160, 70, 40],
          [310, 110, 50, 60],
          [40, 280, 80, 50],
          [200, 280, 60, 60],
          [300, 280, 90, 50],
          [40, 540, 60, 60],
          [140, 520, 70, 50],
          [260, 540, 80, 70],
          [40, 700, 80, 50],
          [200, 720, 90, 60],
        ].map(([x, y, w, h], i) => (
          <rect
            key={i}
            x={x}
            y={y}
            width={w}
            height={h}
            rx="3"
            fill="rgba(148,163,184,0.05)"
            stroke="rgba(148,163,184,0.08)"
            strokeWidth="1"
          />
        ))}
      </svg>

      {/* dim overlay for better readability */}
      {muted && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(6, 14, 28, 0.35)',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}

// User location dot with pulsing animation
export function UserDot({ gpsLost = false }) {
  const color = gpsLost ? '#94A3B8' : '#22C55E';
  const opacity = gpsLost ? 0.7 : 1;

  return (
    <div
      style={{
        position: 'absolute',
        top: '46%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        opacity,
      }}
    >
      {/* large soft halo */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 110,
          height: 110,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}55 0%, transparent 70%)`,
        }}
      />
      {/* pulse ring */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: color,
          opacity: 0.4,
          animation: 'rs-blip 2.5s ease-out infinite',
        }}
      />
      {/* dot */}
      <div
        style={{
          position: 'relative',
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: color,
          border: '3px solid #fff',
          boxShadow: `0 4px 12px ${color}88`,
        }}
      />
      {gpsLost && (
        <div
          style={{
            position: 'absolute',
            top: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '4px 8px',
            borderRadius: 999,
            background: 'rgba(6, 14, 28, 0.85)',
            border: '1px solid rgba(252, 211, 77, 0.3)',
            fontFamily: 'var(--rs-font-display, "Space Grotesk", system-ui, sans-serif)',
            fontSize: 9,
            fontWeight: 700,
            color: '#FCD34D',
            letterSpacing: '0.1em',
            whiteSpace: 'nowrap',
            textTransform: 'uppercase',
          }}
        >
          Last known location
        </div>
      )}
    </div>
  );
}

// Service marker (ambulance, police, towing, etc.)
export function ServiceMarker({ top, left, tone, icon, label, km }) {
  const tones = {
    red: '#EF4444',
    blue: '#3B82F6',
    teal: '#14B8A6',
  };
  const color = tones[tone] || tones.blue;

  const iconMap = {
    ambulance: '🚑',
    shield: '🛡️',
    fire: '🔥',
    car: '🚗',
    cross: '✚',
  };

  const iconSymbol = iconMap[icon] || icon;

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left,
        transform: 'translate(-50%, -100%)',
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* label chip */}
      <div
        style={{
          marginBottom: 4,
          padding: '3px 8px',
          borderRadius: 999,
          background: 'rgba(6, 14, 28, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          fontFamily: 'var(--rs-font-display, "Space Grotesk", system-ui, sans-serif)',
          fontSize: 9.5,
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '-0.1px',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <span>{label}</span>
        <span
          style={{
            color: '#94A3B8',
            fontFamily: 'var(--rs-font-mono, "JetBrains Mono", ui-monospace, monospace)',
          }}
        >
          {km}km
        </span>
      </div>
      {/* pin */}
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: color,
          border: '3px solid #fff',
          display: 'grid',
          placeItems: 'center',
          boxShadow: `0 4px 14px ${color}88`,
          fontSize: 14,
        }}
      >
        {iconSymbol}
      </div>
      {/* point */}
      <div
        style={{
          width: 0,
          height: 0,
          marginTop: -2,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '6px solid #fff',
        }}
      />
    </div>
  );
}
