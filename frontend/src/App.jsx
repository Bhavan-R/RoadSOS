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
import RoutePlanner from './components/RoutePlanner';
import MedicalIdModal from './components/MedicalIdModal';
import { hasMedicalId } from './utils/medicalId';
import { requestMotionPermission } from './hooks/useLocation';
import { DEMO_MODE } from './utils/demoMode';
import { startBackendWarmup } from './utils/backendWarmup';
import { buildBundledSearchResult, BUNDLED_FACILITY_COUNT } from './utils/bundledFacilities';

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

// ─── First-launch detection ───────────────────────────────────────────────────
const ONBOARDED_KEY = 'roadsos_onboarded_v1';
function isFirstLaunch() {
  try { return !localStorage.getItem(ONBOARDED_KEY); } catch { return false; }
}
function markOnboarded() {
  try { localStorage.setItem(ONBOARDED_KEY, '1'); } catch {}
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  // Demo location picker index — only meaningful when DEMO_MODE is true.
  // In production DEMO_MODE === false and demoIdx stays 0 forever, so
  // activeLocation always falls through to real GPS. The select is hidden.
  const [demoIdx, setDemoIdx] = useState(0);

  // Crash alert
  const [crashOpen, setCrashOpen] = useState(false);

  // Trip planner modal
  const [routePlannerOpen, setRoutePlannerOpen] = useState(false);

  // Medical ID modal — auto-open on very first app launch
  const [medicalOpen, setMedicalOpen] = useState(() => isFirstLaunch());
  const [medicalIdConfigured, setMedicalIdConfigured] = useState(() => hasMedicalId());

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
  const [triaged, setTriaged] = useState(false);      // contacts were reordered
  const [triageOffline, setTriageOffline] = useState(false); // used offline fallback

  // Use precise coordinates — the 50 m distance gate in useLocation already
  // prevents jitter-induced re-renders. Sending precise lat/lon gives the
  // backend the best chance of finding real nearby services.
  const searchLat = activeLocation?.lat ?? null;
  const searchLon = activeLocation?.lon ?? null;

  // ── Run search whenever the location changes ────────────────────
  useEffect(() => {
    if (searchLat == null || searchLon == null) return;

    let cancelled = false;
    setSearchLoading(true);
    setSearchError(null);
    setCachedAt(null);
    setTriaged(false);
    setTriageOffline(false);

    // Hard 30-second timeout so a cold Render backend never leaves the
    // spinner stuck forever. (Backend itself retries Overpass up to ~21 s.)
    const controller = new AbortController();
    const hardTimeout = setTimeout(() => controller.abort(), 30_000);

    (async () => {
      try {
        const data = await searchNearby(searchLat, searchLon, controller.signal);
        if (cancelled) return;
        setSearchData(data);
        saveSearchResult(searchLat, searchLon, data);
      } catch (err) {
        if (cancelled) return;

        // ─── Offline fallback chain ──────────────────────────────────────
        // 1. localStorage cache (seeded by previous live searches OR by
        //    the trip planner pre-fetching highway waypoints).
        // 2. Bundled directory of verified Indian trauma centres + police.
        //    Useful in deep dead zones with no prior cache.
        // 3. MOCK_DATA — guaranteed-non-empty UI for demos and testing.

        const cached = loadSearchResult(searchLat, searchLon);
        if (cached) {
          setSearchData(cached);
          setCachedAt(cached.cachedAt);
        } else {
          const bundled = buildBundledSearchResult(searchLat, searchLon, {
            maxKm: 80,
            limit: 8,
          });
          if (bundled) {
            console.info('[RoadSOS] Live + cache miss — serving bundled directory');
            setSearchData(bundled);
            setSearchError(
              isOnline
                ? 'Network issue — showing pre-loaded directory.'
                : 'You are offline — showing pre-loaded directory.'
            );
          } else {
            // Final fallback so the UI is never empty during a demo.
            console.warn('[RoadSOS] Backend + cache + bundle all empty — using mock data:', err.message);
            setSearchData(MOCK_DATA);
            setSearchError(
              isOnline
                ? 'Could not reach server — showing demo data.'
                : 'You are offline and far from any pre-loaded facility — showing demo data.'
            );
          }
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
      // triageContacts never throws — it falls back to client-side rules offline
      const result = await triageContacts(injured, blocking, searchData.contacts);
      setSearchData(prev => ({ ...prev, contacts: result.contacts, reason: result.reason }));
      setTriaged(true);
      // _offline flag is set by ruleBasedTriage() when network wasn't available
      setTriageOffline(result._offline === true);
    } catch {
      // Should never reach here, but defensive just in case
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
          <button
            type="button"
            className="plan-trip-btn"
            onClick={() => setRoutePlannerOpen(true)}
            title={`Pre-cache emergency contacts along your route (${BUNDLED_FACILITY_COUNT} facilities also bundled offline)`}
            id="plan-trip-btn"
          >
            🗺 Plan Trip
          </button>
          <button
            type="button"
            className={`medical-id-btn ${medicalIdConfigured ? 'medical-id-btn--set' : ''}`}
            onClick={() => setMedicalOpen(true)}
            title={medicalIdConfigured
              ? 'View / edit your Medical ID — shown to first responders'
              : 'Set up your Medical ID so paramedics know your blood type and allergies'}
            id="medical-id-btn"
          >
            🆔 Medical ID{!medicalIdConfigured ? ' ●' : ''}
          </button>
          {DEMO_MODE && (
            <>
              <button
                type="button"
                className="test-crash-btn"
                onClick={() => setCrashOpen(true)}
                title="Manually trigger the crash alert for demonstration"
              >
                🧪 Test Crash
              </button>
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
            </>
          )}
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

        {/* Manual triage trigger — opt-in, not auto-open on every search */}
        {searchData?.contacts?.length > 0 && !triaged && (
          <button
            type="button"
            className="triage-trigger-btn"
            onClick={() => setTriageOpen(true)}
            id="open-triage-btn"
            title="Tell us if anyone is injured or the vehicle is blocking traffic — we'll reorder the list by priority"
          >
            🤖 Prioritise for my situation
          </button>
        )}
        {triaged && (
          <button
            type="button"
            className="triage-trigger-btn triage-trigger-btn--redo"
            onClick={() => setTriageOpen(true)}
          >
            🔄 Re-prioritise
          </button>
        )}

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
            {triaged && (triageOffline ? ' · ⚡ Prioritised offline' : ' · ✨ Prioritised by AI')}
          </div>
        )}
      </main>

      {/* ── SOS button bar — fixed bottom ── */}
      <SOSButton
        location={activeLocation}
        landmark={searchData?.landmark}
        topContact={topContact}
        countryCode={countryCode}
        onFirstTap={handleMotionPermissionOnce}
      />

      {/* ── Triage modal ── */}
      <TriageModal
        open={triageOpen && !!searchData?.contacts?.length}
        loading={triageLoading}
        onSubmit={handleTriage}
        onSkip={() => setTriageOpen(false)}
      />

      {/* ── Route planner — pre-cache trip waypoints for offline use ── */}
      <RoutePlanner
        open={routePlannerOpen}
        onClose={() => setRoutePlannerOpen(false)}
      />

      {/* ── Emergency Medical ID — paramedic-visible health profile ── */}
      <MedicalIdModal
        open={medicalOpen}
        startInEdit={!hasMedicalId()}
        onClose={() => {
          markOnboarded();
          setMedicalOpen(false);
          setMedicalIdConfigured(hasMedicalId());
        }}
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
