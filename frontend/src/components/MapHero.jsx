import React from 'react';
import { Hospital, Shield, Ambulance, Truck, Car, PhoneCall, Siren, Wifi, WifiOff } from 'lucide-react';
import { MapBackground, UserDot, ServiceMarker } from './MapBackground';
import SOSButton from './SOSButton';

const CAT_ICONS = {
  hospital: Hospital,
  ambulance: Ambulance,
  police: Shield,
  fire: Siren,
  towing: Truck,
  repair: Car,
};

const CAT_TONES = {
  hospital: 'red',
  ambulance: 'red',
  police: 'blue',
  fire: 'red',
  towing: 'teal',
  repair: 'teal',
};

const CAT_BG = {
  red: { bg: 'rgba(220,38,38,0.12)', fg: '#DC2626' },
  blue: { bg: 'rgba(29,78,216,0.12)', fg: '#1D4ED8' },
  teal: { bg: 'rgba(20,184,166,0.14)', fg: '#0F766E' },
};

function MiniContact({ contact, last }) {
  const cat = (contact.category || 'repair').toLowerCase();
  const Icon = CAT_ICONS[cat] || Hospital;
  const tone = CAT_TONES[cat] || 'teal';
  const colors = CAT_BG[tone];

  const phoneClean = contact.phone ? contact.phone.replace(/\s+/g, '') : null;
  const callHref = phoneClean ? `tel:${phoneClean}` : null;

  return (
    <a
      href={callHref || '#'}
      className="mh-mini-contact"
      style={{
        borderBottomLeftRadius: last ? 16 : 0,
        borderBottomRightRadius: last ? 16 : 0,
      }}
    >
      <span className="mh-mini-icon" style={{ background: colors.bg }}>
        <Icon size={15} color={colors.fg} strokeWidth={2.3} />
      </span>
      <span className="mh-mini-body">
        <span className="mh-mini-name">{contact.name}</span>
        <span className="mh-mini-meta">
          {cat.charAt(0).toUpperCase() + cat.slice(1)}{' '}
          <span style={{ color: '#CBD5E1' }}>·</span>{' '}
          <span style={{ fontFamily: 'var(--rs-font-mono)' }}>
            {typeof contact.distance === 'number' ? contact.distance.toFixed(1) : '?'} km
          </span>
        </span>
      </span>
      <span className="mh-mini-call">
        <PhoneCall size={11} color="#1D4ED8" strokeWidth={2.4} fill="#1D4ED8" />
        <span>{contact.phone || 'No phone'}</span>
      </span>
    </a>
  );
}

/**
 * MapHero — the map-anchored home hero section.
 * Wraps map background, service markers, user dot, SOS button, and quick contacts dock.
 */
export default function MapHero({
  location,
  landmark,
  countryCode,
  contacts,
  topContact,
  isOnline,
  gpsLost,
  onFirstTap,
}) {
  // Pick up to 4 nearest contacts for markers on map
  const markerContacts = (contacts || []).slice(0, 4);
  const dockContacts = (contacts || []).slice(0, 3);

  // Position markers in fixed quadrants (top-left, top-right, bottom-left, bottom-right)
  const POSITIONS = [
    { top: '24%', left: '22%' },
    { top: '32%', left: '78%' },
    { top: '58%', left: '20%' },
    { top: '62%', left: '76%' },
  ];

  const formatCoords = (loc) => {
    if (!loc?.lat || !loc?.lon) return 'Waiting for signal...';
    const ns = loc.lat >= 0 ? 'N' : 'S';
    const ew = loc.lon >= 0 ? 'E' : 'W';
    return `${Math.abs(loc.lat).toFixed(4)}°${ns} · ${Math.abs(loc.lon).toFixed(4)}°${ew}`;
  };

  return (
    <div className="map-hero">
      {/* Map background */}
      <MapBackground muted />

      {/* Top gradient overlay for header readability */}
      <div className="map-hero-top-fade" />

      {/* Compact header */}
      <div className="map-hero-header">
        <div className="mh-brand-cross">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M12 2v20M2 12h20" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="mh-location">
          <div className="mh-location-name">{landmark || 'Finding location...'}</div>
          <div className="mh-location-coords">
            {formatCoords(location)}
            {gpsLost && ' · cached'}
          </div>
        </div>
        <div className={`mh-status-pill ${isOnline && !gpsLost ? 'mh-status-online' : 'mh-status-offline'}`}>
          {isOnline && !gpsLost ? (
            <>
              <span className="mh-status-dot" />
              ONLINE
            </>
          ) : (
            <>
              <WifiOff size={11} strokeWidth={2.4} />
              OFFLINE
            </>
          )}
        </div>
      </div>

      {/* User location dot (only when we have a location) */}
      {location?.lat && <UserDot gpsLost={gpsLost} />}

      {/* Service markers on the map */}
      {markerContacts.map((c, i) => {
        const cat = (c.category || 'repair').toLowerCase();
        const tone = CAT_TONES[cat] || 'teal';
        const iconName = cat === 'police' ? 'shield'
          : cat === 'fire' ? 'fire'
          : cat === 'towing' ? 'car'
          : 'ambulance';
        const pos = POSITIONS[i] || POSITIONS[0];
        const shortName = (c.name || '').split(/[,·\-]/)[0].trim().substring(0, 14);
        return (
          <ServiceMarker
            key={c.id || i}
            top={pos.top}
            left={pos.left}
            tone={tone}
            icon={iconName}
            label={shortName}
            km={typeof c.distance === 'number' ? c.distance.toFixed(1) : '?'}
          />
        );
      })}

      {/* Bottom dock gradient + SOS + Quick contacts */}
      <div className="map-hero-dock">
        <SOSButton
          location={location}
          landmark={landmark}
          topContact={topContact}
          countryCode={countryCode}
          onFirstTap={onFirstTap}
        />

        {dockContacts.length > 0 && (
          <div className="mh-dock-card">
            <div className="mh-dock-header">
              <span className="mh-dock-kicker">Nearest {dockContacts.length} · Tap to call</span>
              <a href="#nearby-services" className="mh-dock-seeall">See all →</a>
            </div>
            {dockContacts.map((c, i) => (
              <MiniContact key={c.id || i} contact={c} last={i === dockContacts.length - 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
