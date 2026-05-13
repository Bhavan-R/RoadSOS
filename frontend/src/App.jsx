import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation } from './hooks/useLocation';
import { useNetwork } from './hooks/useNetwork';
import { searchNearby } from './utils/overpass';
import { triageContacts } from './utils/googlePlaces';
import { saveSearchResult, loadSearchResult } from './utils/offlineDB';
import { getEmergencyNumbers } from './utils/emergencyNumbers';

import CountryEmergency from './components/CountryEmergency';
import ContactList from './components/ContactList';
import SOSButton from './components/SOSButton';
import TriageModal from './components/TriageModal';
import OfflineBanner from './components/OfflineBanner';
import CrashAlert from './components/CrashAlert';
import { requestMotionPermission } from './hooks/useLocation';
import { DEMO_MODE } from './utils/demoMode';
import { startBackendWarmup } from './utils/backendWarmup';

// ─── Demo location picker ─────────────────────────────────────────────────────
const DEMO_LOCATIONS = [
  { label: '📍 Use my GPS', lat: null, lon: null, country: null },
  { label: '🇮🇳 Bengaluru, India', lat: 12.9716, lon: 77.5946, country: 'IN' },
  { label: '🇮🇳 Mumbai, India', lat: 19.0760, lon: 72.8777, country: 'IN' },
  { label: '🇬🇧 London, UK', lat: 51.5074, lon: -0.1278, country: 'GB' },
  { label: '🇯🇵 Tokyo, Japan', lat: 35.6762, lon: 139.6503, country: 'JP' },
  { label: '🇩🇪 Berlin, Germany', lat: 52.5200, lon: 13.4050, country: 'DE' },
];

// ─── Mock contacts (used as fallback when backend is unreachable) ─────────────
const MOCK_CONTACTS = [
  {
    id: 'mock-1',
    name: 'Apollo Hospitals, Bannerghatta',
    category: 'hospital',
    phone: '080-26793000',
    distance: 1.4,
    source: 'Google Places',
    isOpen: true,
    aiReason: 'Trauma unit available · nearest to crash location',
  },
  {
    id: 'mock-2',
    name: 'Jayanagar Police Station',
    category: 'police',
    phone: '080-22942000',
    distance: 2.1,
    source: 'OpenStreetMap',
    isOpen: true,
    aiReason: null,
  },
  {
    id: 'mock-3',
    name: 'CATS Ambulance Service',
    category: 'ambulance',
    phone: '108',
    distance: 3.0,
    source: 'OpenStreetMap',
    isOpen: null,
    aiReason: null,
  },
  {
    id: 'mock-4',
    name: 'Rapid Towing Services',
    category: 'towing',
    phone: '9845012345',
    distance: 3.8,
    source: 'Google Places',
    isOpen: true,
    aiReason: null,
  },
  {
    id: 'mock-5',
    name: 'Sri Auto Repairs',
    category: 'repair',
    phone: '9900887766',
    distance: 4.5,
    source: 'OpenStreetMap',
    isOpen: false,
    aiReason: null,
  },
];

const MOCK_DATA = {
  contacts: MOCK_CONTACTS,
  landmark: 'Bannerghatta Road, BTM Layout, Bengaluru, Karnataka (MOCK)',
  country_code: 'IN',
  source: 'Mock data',
  count: MOCK_CONTACTS.length,
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  // Demo location picker index
  const [demoIdx, setDemoIdx] = useState(0);

  // Crash alert
  const [crashOpen, setCrashOpen] = useState(false);

  // GPS hook
  const {
    location: gpsLocation,
    error: gpsError,
    loading: gpsLoading,
  } = useLocation({ onCrashDetected: () => setCrashOpen(true) });

  const isOnline = useNetwork();

  // Wake up the Render backend immediately on app load to avoid 30-60s
  // cold-start delays during a judging demo.
  useEffect(() => {
    startBackendWarmup();
  }, []);

  // ── Active location: demo override OR real GPS ──────────────────────────
  const activeLocation = useMemo(() => {
    const demo = DEMO_LOCATIONS[demoIdx];
    if (demo.lat != null) {
      return { lat: demo.lat, lon: demo.lon, country_code: demo.country, source: 'demo' };
    }
    return gpsLocation; // may be null while GPS is loading
  }, [demoIdx, gpsLocation]);

  // ── Search state ───────────────────────────────────────────────────────
  const [searchData, setSearchData] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [cachedAt, setCachedAt] = useState(null);

  // ── Triage state ───────────────────────────────────────────────────────
  const [triageOpen, setTriageOpen] = useState(false);
  const [triageLoading, setTriageLoading] = useState(false);
  const [triaged, setTriaged] = useState(false);

  // Round to 2 decimal places (~1 km grid) so GPS jitter never triggers
  // a redundant search. The distance gate in useLocation handles <50 m moves;
  // this is a second layer of defence at the search level.
  const searchLat = activeLocation ? Math.round(activeLocation.lat * 100) / 100 : null;
  const searchLon = activeLocation ? Math.round(activeLocation.lon * 100) / 100 : null;

  // ── Run search whenever the location changes ────────────────────
  useEffect(() => {
    if (searchLat == null || searchLon == null) return;

    let cancelled = false;
    setSearchLoading(true);
    setSearchError(null);
    setCachedAt(null);
    setTriaged(false);

    // Hard 30-second timeout so a cold Render backend never leaves the
    // spinner stuck forever. (Backend itself retries Overpass up to ~21 s.)
    const controller = new AbortController();
    const hardTimeout = setTimeout(() => controller.abort(), 30_000);

    (async () => {
      try {
        const data = await searchNearby(searchLat, searchLon, controller.signal);
        if (cancelled) return;
        setSearchData(data);
        setTriageOpen(true);
        saveSearchResult(searchLat, searchLon, data);
      } catch (err) {
        if (cancelled) return;

        // Try localStorage cache first
        const cached = loadSearchResult(searchLat, searchLon);
        if (cached) {
          setSearchData(cached);
          setCachedAt(cached.cachedAt);
          setTriageOpen(true);
        } else {
          // Fall back to mock data so the UI is never empty
          console.warn('[RoadSOS] Backend unreachable — using mock data:', err.message);
          setSearchData(MOCK_DATA);
          setTriageOpen(true);
          setSearchError(
            isOnline
              ? 'Could not reach server — showing demo data.'
              : 'You are offline — showing demo data.'
          );
        }
      } finally {
        clearTimeout(hardTimeout);
        if (!cancelled) setSearchLoading(false);
      }
    })();

    return () => { cancelled = true; controller.abort(); clearTimeout(hardTimeout); };
  }, [searchLat, searchLon]);

  // ── Triage submit ──────────────────────────────────────────────────────
  const handleTriage = useCallback(async ({ injured, blocking }) => {
    if (!searchData?.contacts?.length) return;
    setTriageLoading(true);
    try {
      const result = await triageContacts(injured, blocking, searchData.contacts);
      setSearchData(prev => ({ ...prev, contacts: result.contacts, reason: result.reason }));
      setTriaged(true);
    } catch {
      // Backend triage failed — leave contacts in current order, still close modal
    } finally {
      setTriageLoading(false);
      setTriageOpen(false);
    }
  }, [searchData]);

  // ── Derived values ─────────────────────────────────────────────────────
  const countryCode = searchData?.country_code || activeLocation?.country_code || 'IN';
  const numbers = getEmergencyNumbers(countryCode);
  const topContact = searchData?.contacts?.[0];

  // ── iOS motion permission ──────────────────────────────────────────────
  const handleMotionPermissionOnce = useCallback(() => {
    requestMotionPermission();
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="app">

      {/* ── Sticky header ── */}
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo">🚨</span>
          <span className="app__title">RoadSOS</span>
          {DEMO_MODE && <span className="demo-badge" title="Calls are simulated. Add ?demo=0 to enable real dialing.">🧪 DEMO</span>}
        </div>
        <div className="app__header-actions">
          {DEMO_MODE && (
            <button
              type="button"
              className="test-crash-btn"
              onClick={() => setCrashOpen(true)}
              title="Manually trigger the crash alert for demonstration"
            >
              🧪 Test Crash
            </button>
          )}
          <select
            className="demo-picker"
            value={demoIdx}
            onChange={(e) => setDemoIdx(Number(e.target.value))}
            aria-label="Demo location"
            id="demo-location-picker"
          >
            {DEMO_LOCATIONS.map((d, i) => (
              <option key={i} value={i}>{d.label}</option>
            ))}
          </select>
        </div>
      </header>

      {/* ── Offline banner (self-contained, uses useNetwork internally) ── */}
      <OfflineBanner />

      {/* ── Country emergency numbers — always visible ── */}
      <CountryEmergency numbers={numbers} />

      {/* ── Main content ── */}
      <main className="app__main">

        {/* GPS status strip */}
        {gpsLoading && demoIdx === 0 && (
          <div className="status-strip">
            📡 Detecting your location…
          </div>
        )}
        {gpsError && demoIdx === 0 && !activeLocation && (
          <div className="status-strip status-strip--error">
            {gpsError} — using national numbers above.
          </div>
        )}

        {/* Landmark */}
        {searchData?.landmark && (
          <div className="landmark">
            📍 {searchData.landmark}
          </div>
        )}

        {/* Section label */}
        <div className="section-divider">
          <span className="section-divider__label">
            Nearby services — hospitals · police · ambulance · towing · repair
          </span>
        </div>

        {/* Contact list */}
        <ContactList
          contacts={searchData?.contacts}
          loading={searchLoading}
          error={searchError}
          cachedAt={cachedAt}
        />

        {/* Footer note */}
        {searchData?.source && (
          <div className="source-note">
            Data: {searchData.source} · {searchData.count ?? searchData.contacts?.length ?? 0} services
            {triaged && ' · ✨ Prioritised by AI'}
          </div>
        )}
      </main>

      {/* ── SOS button bar — fixed bottom ── */}
      <SOSButton
        location={activeLocation}
        landmark={searchData?.landmark}
        topContact={topContact}
        onFirstTap={handleMotionPermissionOnce}
      />

      {/* ── Triage modal ── */}
      <TriageModal
        open={triageOpen && !!searchData?.contacts?.length}
        loading={triageLoading}
        onSubmit={handleTriage}
        onSkip={() => setTriageOpen(false)}
      />

      {/* ── Crash alert (velocity collapse detection) ── */}
      <CrashAlert
        open={crashOpen}
        onConfirm={() => setCrashOpen(false)}
        onCancel={() => setCrashOpen(false)}
        numbers={numbers}
        location={activeLocation}
        landmark={searchData?.landmark}
      />
    </div>
  );
}
