import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Hospital, Shield, Ambulance, Truck, Car, PhoneCall, Siren, WifiOff, Map, AlertTriangle, Zap, Cog, Loader2, RotateCw, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import RealMap from './RealMap';
import SOSButton from './SOSButton';
import ManualLocationModal from './ManualLocationModal';
import { subscribeBackendStatus } from '../utils/backendWarmup';
import { setManualLocation, clearManualLocation } from '../hooks/useLocation';

const CAT_ICONS = {
  hospital: Hospital,
  ambulance: Ambulance,
  police: Shield,
  fire: Siren,
  towing: Truck,
  repair: Car,
  showroom: Car,
  tyre: Cog
};

const CAT_TONES = {
  hospital: 'red',
  ambulance: 'red',
  police: 'blue',
  fire: 'red',
  towing: 'teal',
  repair: 'teal',
  showroom: 'teal',
  tyre: 'teal'
};

const CAT_BG = {
  red: { bg: 'rgba(220,38,38,0.12)', fg: '#DC2626' },
  blue: { bg: 'rgba(29,78,216,0.12)', fg: '#1D4ED8' },
  teal: { bg: 'rgba(20,184,166,0.14)', fg: '#0F766E' },
};

function MiniContact({ contact, last }) {
  const { t } = useTranslation();
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
          {t(`category.${cat}`, cat.charAt(0).toUpperCase() + cat.slice(1))}{' '}
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
  // Action buttons
  onPlanTrip,
  onMedicalId,
  medicalIdConfigured,
  onTestCrash,
  demoMode,
}) {
  const { t } = useTranslation();
  // Pick up to 6 nearest contacts for markers on real map
  const markerContacts = (contacts || []).slice(0, 6);
  const dockContacts = (contacts || []).slice(0, 3);

  // Backend readiness — drives the warming-up state of the status pill.
  // 'warming' / 'cold' downgrade the green online indicator to amber so
  // the user understands the search backend is still spinning up.
  const [backendStatus, setBackendStatus] = useState('unknown');
  const [refreshing, setRefreshing] = useState(false);
  const [manualLocationOpen, setManualLocationOpen] = useState(false);
  const mapRef = useRef(null);
  useEffect(() => subscribeBackendStatus(setBackendStatus), []);

  // ── Manual location refresh (fixes stale browser geolocation cache on laptops) ──
  // On Windows Edge / Chrome, browser geolocation can cache old results across
  // sessions. This button forces a fresh geolocation lookup.
  const handleRefreshLocation = useCallback(() => {
    setRefreshing(true);
    if (!navigator.geolocation) {
      setRefreshing(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setRefreshing(false),
      () => setRefreshing(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // ── Handle manual location set ──
  const handleSetManualLocation = useCallback((locData) => {
    setManualLocation(locData.lat, locData.lon, locData.landmark);
    // Force UI update by triggering a dummy state change
    // The location prop will be refreshed on next render from useLocation hook
  }, []);

  const formatCoords = (loc) => {
    if (!loc?.lat || !loc?.lon) return t('location.waiting');
    const ns = loc.lat >= 0 ? 'N' : 'S';
    const ew = loc.lon >= 0 ? 'E' : 'W';
    return `${Math.abs(loc.lat).toFixed(4)}°${ns} · ${Math.abs(loc.lon).toFixed(4)}°${ew}`;
  };

  return (
    <div className="map-hero">
      {/* Real GPS-anchored map (Leaflet + OSM)
          - draggable: user can pan/pinch to explore
          - countryCode drives the Survey-of-India boundary overlay
            when the user is in India (full J&K + Aksai Chin shown) */}
      <RealMap
        ref={mapRef}
        location={location}
        contacts={markerContacts}
        countryCode={countryCode}
        gpsLost={gpsLost}
        draggable={true}
        zoom={15}
      />

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
          <div className="mh-location-name">{landmark || t('location.finding')}</div>
          <div className="mh-location-coords">
            {formatCoords(location)}
            {gpsLost && ' · ' + t('location.cached')}
          </div>
        </div>

        {/* Action strip — Medical ID, Plan Trip, Refresh Location, Set Location, status pill */}
        <div className="mh-actions">
          <button
            className="mh-action-btn"
            onClick={handleRefreshLocation}
            disabled={refreshing}
            title="Refresh location (fixes stale cache on laptops)"
            aria-label="Refresh location"
          >
            <RotateCw size={14} strokeWidth={2} className={refreshing ? 'mh-action-spin' : ''} />
          </button>
          <button
            className="mh-action-btn"
            onClick={() => setManualLocationOpen(true)}
            title={t('actions.set_location', 'Set location manually')}
            aria-label={t('actions.set_location', 'Set location manually')}
          >
            <MapPin size={14} strokeWidth={2} />
          </button>
          {onPlanTrip && (
            <button
              className="mh-action-btn"
              onClick={onPlanTrip}
              title={t('actions.plan_trip')}
              aria-label={t('actions.plan_trip')}
            >
              <Map size={14} strokeWidth={2} />
            </button>
          )}
          {onMedicalId && (
            <button
              className={`mh-action-btn mh-action-btn--id ${!medicalIdConfigured ? 'mh-action-btn--unset' : ''}`}
              onClick={onMedicalId}
              title={medicalIdConfigured ? t('actions.medical_id') : t('actions.medical_id_unset')}
              aria-label={t('actions.medical_id')}
            >
              🆔{!medicalIdConfigured && <span className="mh-action-dot" />}
            </button>
          )}
          {demoMode && onTestCrash && (
            <button
              className="mh-action-btn mh-action-btn--crash"
              onClick={onTestCrash}
              title="Test crash alert"
              aria-label="Test crash"
            >
              <AlertTriangle size={13} strokeWidth={2.5} />
            </button>
          )}
          {(() => {
            // Four states, in priority order:
            //   1. Location is manually set     → purple 'MANUAL'
            //   2. Browser offline             → red 'OFFLINE'
            //   3. Backend cold/warming        → amber 'CONNECTING…'
            //   4. Otherwise (online + ready)  → green 'ONLINE'
            if (location?.source === 'manual') {
              return (
                <div
                  className="mh-status-pill mh-status-manual"
                  title="Using manually set location"
                >
                  <MapPin size={11} strokeWidth={2.4} />
                  {t('status.manual', 'MANUAL')}
                </div>
              );
            }
            const isOffline = !isOnline || gpsLost;
            const isWarming = !isOffline
              && (backendStatus === 'warming' || backendStatus === 'cold' || backendStatus === 'unknown');

            if (isOffline) {
              return (
                <div className="mh-status-pill mh-status-offline">
                  <WifiOff size={11} strokeWidth={2.4} />
                  {t('status.offline')}
                </div>
              );
            }
            if (isWarming) {
              return (
                <div
                  className="mh-status-pill mh-status-warming"
                  title="Backend is starting up (Render free tier cold start, ~30 s)"
                >
                  <Loader2 size={11} strokeWidth={2.6} className="mh-status-spin" />
                  {t('status.connecting', 'Connecting…')}
                </div>
              );
            }
            return (
              <div className="mh-status-pill mh-status-online">
                <span className="mh-status-dot" />
                {t('status.online')}
              </div>
            );
          })()}
        </div>
      </div>

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
              <span className="mh-dock-kicker">{t('dock.nearest', { count: dockContacts.length })}</span>
              <a href="#nearby-services" className="mh-dock-seeall">{t('dock.see_all')} →</a>
            </div>
            {dockContacts.map((c, i) => (
              <MiniContact key={c.id || i} contact={c} last={i === dockContacts.length - 1} />
            ))}
          </div>
        )}
      </div>

      <ManualLocationModal
        open={manualLocationOpen}
        onClose={() => setManualLocationOpen(false)}
        onSetLocation={handleSetManualLocation}
        mapRef={mapRef}
      />
    </div>
  );
}
