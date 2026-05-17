import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { WifiOff, ChevronDown, AlertTriangle } from 'lucide-react';
import { useLocation } from './hooks/useLocation';
import { useNetwork } from './hooks/useNetwork';
import { searchNearby } from './utils/overpass';
import { triageContacts } from './utils/googlePlaces';
import { saveSearchResult, loadSearchResult } from './utils/offlineDB';
import { getEmergencyNumbers } from './utils/emergencyNumbers';
import { hasMedicalId } from './utils/medicalId';
import { autoFireSos } from './utils/sosDispatch';
import { buildBundledSearchResult, BUNDLED_FACILITY_COUNT } from './utils/bundledFacilities';

import CountryEmergency from './components/CountryEmergency';
import ContactList from './components/ContactList';
import SOSButton from './components/SOSButton';
import TriageModal from './components/TriageModal';
import CrashAlert from './components/CrashAlert';
// LocationCard.jsx exists but is unused — MapHero handles location display
import OfflineBanner from './components/OfflineBanner';
import RoutePlanner from './components/RoutePlanner';
import MedicalIdModal from './components/MedicalIdModal';
import MapHero from './components/MapHero';
import DispatchScreen from './components/DispatchScreen';
import LanguagePicker from './components/LanguagePicker';
import { hasUserChosenLanguage } from './i18n';
import { requestMotionPermission } from './hooks/useLocation';
import { DEMO_MODE } from './utils/demoMode';
import { startBackendWarmup, subscribeBackendStatus } from './utils/backendWarmup';

// ─── Demo location picker ─────────────────────────────────────────────────────
const DEMO_LOCATIONS = [
  { label: 'GPS', lat: null, lon: null, country: null },
  { label: 'JONAI', lat: 27.8322, lon: 95.1668, country: 'IN' },
  { label: 'BLR', lat: 12.9716, lon: 77.5946, country: 'IN' },
  { label: 'MUM', lat: 19.0760, lon: 72.8777, country: 'IN' },
  { label: 'LON', lat: 51.5074, lon: -0.1278, country: 'GB' },
  { label: 'TYO', lat: 35.6762, lon: 139.6503, country: 'JP' },
  { label: 'BER', lat: 52.5200, lon: 13.4050, country: 'DE' },
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
  {
    id: 'mock-6',
    name: 'City Motors Showroom',
    category: 'showroom',
    phone: '9876543210',
    distance: 2.1,
    source: 'Google Places',
    isOpen: true,
    aiReason: null,
  },
  {
    id: 'mock-7',
    name: 'QuickFix Puncture Shop',
    category: 'tyre',
    phone: '9988776655',
    distance: 0.8,
    source: 'OpenStreetMap',
    isOpen: true,
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

// CATS moved to ./constants.js to break the App ↔ ContactList circular
// import that caused a production TDZ crash. Re-export here so any
// external importer expecting it from App.jsx keeps working.
export { CATS } from './constants';

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
  const { t } = useTranslation();
  const [langPickerOpen, setLangPickerOpen] = useState(() => !hasUserChosenLanguage());
  const [demoIdx, setDemoIdx] = useState(0);
  const [crashOpen, setCrashOpen] = useState(false);
  const [cat, setCat] = useState("All");
  const [routePlannerOpen, setRoutePlannerOpen] = useState(false);
  // Show Medical ID only AFTER the user picks a language on first launch.
  const [medicalOpen, setMedicalOpen] = useState(
    () => !hasUserChosenLanguage() ? false : isFirstLaunch(),
  );
  const [medicalIdConfigured, setMedicalIdConfigured] = useState(() => hasMedicalId());
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchedAt, setDispatchedAt] = useState(null);
  const [dispatchContext, setDispatchContext] = useState({ isCrash: false, reason: null });

  const {
    location: gpsLocation,
    error: gpsError,
    loading: gpsLoading,
  } = useLocation({ onCrashDetected: () => setCrashOpen(true) });

  const isOnline = useNetwork();

  // Wake up the Render backend immediately on app load
  useEffect(() => {
    startBackendWarmup();
  }, []);

  // NOTE: the backend-status auto-retry effect lives further down, AFTER
  // searchHasRealData and searchLat are declared.  Placing it here caused
  // a Temporal Dead Zone crash because those consts hadn't been
  // initialised yet when this effect's dependency array was evaluated.

  // Listen for SOS dispatch events to open the dispatch screen
  useEffect(() => {
    const onDispatch = (e) => {
      setDispatchedAt(Date.now());
      setDispatchContext({
        isCrash: e.detail?.isCrash || false,
        reason: e.detail?.reason || null
      });
      setDispatchOpen(true);
    };
    window.addEventListener('roadsos:sos-sent', onDispatch);
    return () => window.removeEventListener('roadsos:sos-sent', onDispatch);
  }, []);

  const activeLocation = useMemo(() => {
    const demo = DEMO_LOCATIONS[demoIdx];
    if (demo.lat != null) {
      return { lat: demo.lat, lon: demo.lon, country_code: demo.country, source: 'demo' };
    }
    return gpsLocation;
  }, [demoIdx, gpsLocation]);

  const [searchData, setSearchData] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [cachedAt, setCachedAt] = useState(null);
  // searchRetry increments when the backend warms up after a failed attempt,
  // triggering a fresh search automatically without the user having to reload.
  const [searchRetry, setSearchRetry] = useState(0);
  const searchHasRealData = !!(searchData && !searchData._bundled && !searchData._mock);

  const [triageOpen, setTriageOpen] = useState(false);
  const [triageLoading, setTriageLoading] = useState(false);
  const [triaged, setTriaged] = useState(false);
  const [triageOffline, setTriageOffline] = useState(false);

  const searchLat = activeLocation?.lat ?? null;
  const searchLon = activeLocation?.lon ?? null;

  // Auto-retry search when backend finishes cold-starting.
  // Render free tier takes 35–55 s to cold-start.  If the first /search
  // attempt times out before the dyno is ready, the warmup utility will
  // eventually get a /health 200 and flip status → 'ready'.  At that
  // point, if we still have no real data, bump searchRetry so the search
  // effect re-runs against the now-warm backend.
  useEffect(() => {
    const unsub = subscribeBackendStatus((status) => {
      if (status === 'ready' && !searchHasRealData && searchLat != null) {
        setSearchRetry((n) => n + 1);
      }
    });
    return unsub;
  }, [searchHasRealData, searchLat]);

  // ── Periodic auto-refresh while stuck on bundled fallback ──
  // If the user is staring at pre-loaded directory data (network was
  // flaky, backend was sleeping), retry every 30 s automatically so the
  // app self-heals without the user reloading.  Cleared the moment real
  // data arrives — no point burning Render quota when we already have
  // live results.
  useEffect(() => {
    if (searchHasRealData || searchLat == null || !isOnline) return;
    const id = setInterval(() => {
      setSearchRetry((n) => n + 1);
    }, 30_000);
    return () => clearInterval(id);
  }, [searchHasRealData, searchLat, isOnline]);

  useEffect(() => {
    if (searchLat == null || searchLon == null) return;

    let cancelled = false;
    setSearchLoading(true);
    setSearchError(null);
    setCachedAt(null);
    setTriaged(false);
    setTriageOffline(false);

    const controller = new AbortController();
    // 25 s — covers the parallelized backend's worst case (Overpass 5-10 s
    // expansion + concurrent Google phone enrichment 10-15 s) for sparse
    // rural areas like Jonai.  Dense urban searches still return in 2-5 s.
    // First-load cold start is handled by the retry-on-warmup effect.
    const hardTimeout = setTimeout(() => controller.abort(), 25_000);

    (async () => {
      try {
        const data = await searchNearby(searchLat, searchLon, controller.signal);
        if (cancelled) return;
        setSearchData(data);
        saveSearchResult(searchLat, searchLon, data);
      } catch (err) {
        if (cancelled) return;

        const cached = loadSearchResult(searchLat, searchLon);
        if (cached) {
          setSearchData(cached);
          setCachedAt(cached.cachedAt);
        } else {
          const bundled = buildBundledSearchResult(searchLat, searchLon, { maxKm: 80, limit: 8 });
          if (bundled) {
            console.info('[RoadSOS] Live + cache miss — serving bundled directory');
            setSearchData({ ...bundled, _bundled: true });
            setSearchError(
              isOnline
                ? 'Network issue — showing pre-loaded directory.'
                : 'You are offline — showing pre-loaded directory.'
            );
          } else {
            console.warn('[RoadSOS] Backend + cache + bundle all empty — using mock data:', err.message);
            // Don't overwrite the user's real-location landmark / country with mock ones.
            setSearchData({
              ...MOCK_DATA,
              landmark: null,
              country_code: activeLocation?.country_code || MOCK_DATA.country_code,
              _mock: true,
            });
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
  // searchRetry increments when the warmup confirms the backend is ready
  // after a previous attempt failed — triggers a clean retry automatically.
  }, [searchLat, searchLon, searchRetry]);

  const countryCode = searchData?.country_code || activeLocation?.country_code || 'IN';

  const handleTriage = useCallback(async ({ injured, blocking }) => {
    if (!searchData?.contacts?.length) return;
    setTriageLoading(true);
    try {
      // triageContacts never throws — it falls back to client-side rules offline
      const result = await triageContacts(injured, blocking, searchData.contacts);
      setSearchData(prev => ({ ...prev, contacts: result.contacts, reason: result.reason }));
      setTriaged(true);
      setTriageOffline(result._offline === true);
      if (injured || blocking) {
        autoFireSos(activeLocation, searchData?.landmark, countryCode);
        window.dispatchEvent(new CustomEvent('roadsos:sos-sent', {
          detail: { isCrash: true, reason: result.reason }
        }));
      }
    } catch {
      // Should never reach here, but defensive just in case
    } finally {
      setTriageLoading(false);
      setTriageOpen(false);
    }
  }, [searchData, activeLocation, countryCode]);

  const numbers = getEmergencyNumbers(countryCode);
  const topContact = searchData?.contacts?.[0];

  const handleMotionPermissionOnce = useCallback(() => {
    requestMotionPermission();
  }, []);

  const countryName = numbers?.country || 'India';

  // GPS lost detection — use cached location flag when no live GPS
  const gpsLost = !activeLocation?.lat && !!gpsError;

  return (
    <div className="app has-map-hero">

      {/* ── First-launch language picker (gates Medical ID) ── */}
      {langPickerOpen && (
        <LanguagePicker
          onConfirm={() => {
            setLangPickerOpen(false);
            // After language chosen, open Medical ID on first launch
            if (isFirstLaunch()) setMedicalOpen(true);
          }}
        />
      )}

      {/* ── Map-anchored Hero (replaces old telemetry header + SOS section) ── */}
      <MapHero
        location={activeLocation}
        landmark={searchData?.landmark}
        countryCode={countryCode}
        contacts={searchData?.contacts || []}
        topContact={topContact}
        isOnline={isOnline}
        gpsLost={gpsLost}
        onFirstTap={handleMotionPermissionOnce}
        onPlanTrip={() => setRoutePlannerOpen(true)}
        onMedicalId={() => setMedicalOpen(true)}
        medicalIdConfigured={medicalIdConfigured}
        onTestCrash={() => setCrashOpen(true)}
        demoMode={DEMO_MODE}
        searchLoading={searchLoading}
        usingFallbackData={!!searchData && !searchHasRealData}
      />

      {/* ── (Legacy) Sticky Telemetry Header — kept hidden by CSS .has-map-hero override ── */}
      <header className="telemetry-header">
        <div className="telemetry-block">
          <div className="telemetry-glow" />
          <div className="telemetry-content">
            {/* Top Section */}
            <div className="telemetry-top">
              <div className="telemetry-brand">
                <svg width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                  <path d="M24 4L6 10V22C6 31.3 13.7 40 24 44C34.3 40 42 31.3 42 22V10L24 4Z" fill="#3b82f6" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round"/>
                  <path d="M10 26 H 18 L 22 14 L 26 36 L 30 26 H 38" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.05em', display: 'flex', alignItems: 'center' }}>
                  <span style={{ color: '#f8fafc' }}>Road</span>
                  <span style={{ color: '#3b82f6' }}>SOS</span>
                </div>
                {DEMO_MODE && <span className="demo-badge" style={{ marginLeft: 4 }}>🧪 DEMO</span>}
              </div>
              
              <div className="telemetry-status">
                <div className="header-actions" style={{ marginRight: 6 }}>
                  <button className="plan-trip-btn" onClick={() => setRoutePlannerOpen(true)} title={`Pre-cache emergency contacts along your route (${BUNDLED_FACILITY_COUNT} facilities bundled offline)`}>
                    🗺 Plan Trip
                  </button>
                  <button
                    className={`medical-id-btn ${medicalIdConfigured ? 'medical-id-btn--set' : ''}`}
                    onClick={() => setMedicalOpen(true)}
                    title={medicalIdConfigured ? 'View / edit your Medical ID' : 'Set up your Medical ID'}
                  >
                    🆔 ID{!medicalIdConfigured ? ' ●' : ''}
                  </button>
                  {DEMO_MODE && (
                    <button className="test-crash-btn" onClick={() => setCrashOpen(true)} title="Test crash alert">
                      <AlertTriangle size={12} strokeWidth={2.5} style={{ marginRight: 4 }} />
                      TEST CRASH
                    </button>
                  )}
                </div>

                <div className="telemetry-ping-container">
                  <span className={`telemetry-ping ${!isOnline ? 'offline' : ''}`} />
                  <span className={`telemetry-ping-dot ${!isOnline ? 'offline' : ''}`} />
                </div>
                {DEMO_MODE ? (
                  <div className="gps-dropdown-wrapper">
                    <span className="telemetry-status-text">
                      {isOnline ? (demoIdx === 0 ? 'MY GPS ACTIVE' : DEMO_LOCATIONS[demoIdx].label) : 'OFFLINE MODE'}
                    </span>
                    <ChevronDown size={12} color="#9ca3af" />
                    <select className="gps-dropdown-select" value={demoIdx} onChange={(e) => setDemoIdx(Number(e.target.value))}>
                      <option disabled>📍 GPS</option>
                      {DEMO_LOCATIONS.map((d, i) => <option key={i} value={i}>{d.label}</option>)}
                    </select>
                  </div>
                ) : (
                  <span className="telemetry-status-text">
                    {isOnline ? 'MY GPS ACTIVE' : 'OFFLINE MODE'}
                  </span>
                )}
              </div>
            </div>

            {/* Bottom Section: Location */}
            <div className="telemetry-bottom">
              <div className="telemetry-icon">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </div>
              <div className="telemetry-details">
                <p className="telemetry-address">
                  {(searchLoading && !searchData) ? 'Connecting to GPS...' : (searchData?.landmark || 'Finding nearest landmark...')}
                </p>
                <p className="telemetry-coords">
                  {activeLocation ? `Lat: ${activeLocation.lat.toFixed(4)} • Lon: ${activeLocation.lon.toFixed(4)}` : 'Waiting for signal...'}
                  {` • ${countryName}`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Offline banner (self-contained, uses useNetwork internally) ── */}
      <OfflineBanner />

      {/* ── GPS error strip ── */}
      {gpsError && demoIdx === 0 && !activeLocation && (
        <div className="status-strip status-strip--error" style={{ marginTop: 20 }}>
          {gpsError} — using national numbers below.
        </div>
      )}

      {/* ── National Emergency ── */}
      <div className="sec-head">
        <span className="sec-title">{t('header.emergency_numbers')}</span>
        <span className="sec-note">{t('header.always_offline')}</span>
      </div>
      <CountryEmergency numbers={numbers} />

      {/* ── Nearby Services ── */}
      <div id="nearby-services" className="sec-head" style={{ paddingTop: 22 }}>
        <span className="sec-title">{t('header.nearby_services')}</span>
        <span className="sec-note">
          {searchLoading
            ? t('header.searching')
            : t('header.found', { n: searchData?.count ?? searchData?.contacts?.length ?? 0 })}
          {triaged && (triageOffline ? ` ⚡ ${t('header.prioritised')}` : ` ✨ ${t('header.ai')}`)}
        </span>
      </div>

      {/* Manual triage trigger — opt-in, not auto-open on every search */}
      {searchData?.contacts?.length > 0 && !triaged && (
        <button
          type="button"
          className="triage-trigger-btn"
          onClick={() => setTriageOpen(true)}
          id="open-triage-btn"
          title={t('actions.prioritise')}
        >
          🤖 {t('actions.prioritise')}
        </button>
      )}
      {triaged && (
        <button
          type="button"
          className="triage-trigger-btn triage-trigger-btn--redo"
          onClick={() => setTriageOpen(true)}
        >
          🔄 {t('actions.re_prioritise')}
        </button>
      )}

      <ContactList
        contacts={searchData?.contacts}
        loading={searchLoading}
        error={searchError}
        cachedAt={cachedAt}
        cat={cat}
        setCat={setCat}
      />

      {/* ── Footer Note ── */}
      {(searchError || searchData?.source === 'Mock data') && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "14px 20px 0", opacity: 0.5 }}>
          <WifiOff size={12} color="#334E6E" strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 11, color: "#1E3655", lineHeight: 1.6 }}>
            {searchError || t('footer.offline_fallback')}
          </span>
        </div>
      )}
      {/* ── Footer Note ── */}

      {/* ── Modals ── */}
      <TriageModal
        open={triageOpen && !!searchData?.contacts?.length}
        loading={triageLoading}
        onSubmit={handleTriage}
        onSkip={() => setTriageOpen(false)}
        location={activeLocation}
        landmark={searchData?.landmark}
        topContact={topContact}
      />

      <CrashAlert
        open={crashOpen}
        onConfirm={() => setCrashOpen(false)}
        onCancel={() => setCrashOpen(false)}
        numbers={numbers}
        location={activeLocation}
        landmark={searchData?.landmark}
        countryCode={countryCode}
      />

      <RoutePlanner
        open={routePlannerOpen}
        onClose={() => setRoutePlannerOpen(false)}
      />

      <MedicalIdModal
        open={medicalOpen}
        startInEdit={!hasMedicalId()}
        onClose={() => {
          markOnboarded();
          setMedicalOpen(false);
          setMedicalIdConfigured(hasMedicalId());
        }}
      />

      {/* ── Full-screen Dispatch Glass overlay (after SOS sent) ── */}
      <DispatchScreen
        open={dispatchOpen}
        onClose={() => setDispatchOpen(false)}
        location={activeLocation}
        landmark={searchData?.landmark}
        contacts={searchData?.contacts || []}
        topContact={topContact}
        dispatchedAt={dispatchedAt}
        isCrash={dispatchContext.isCrash}
        triageReason={dispatchContext.reason}
      />
    </div>
  );
}
