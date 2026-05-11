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

const DEMO_LOCATIONS = [
  { label: 'Use my GPS', lat: null, lon: null },
  { label: 'Bengaluru, India', lat: 12.9716, lon: 77.5946, country: 'IN' },
  { label: 'Mumbai, India', lat: 19.0760, lon: 72.8777, country: 'IN' },
  { label: 'London, UK', lat: 51.5074, lon: -0.1278, country: 'GB' },
  { label: 'Tokyo, Japan', lat: 35.6762, lon: 139.6503, country: 'JP' },
  { label: 'Berlin, Germany', lat: 52.5200, lon: 13.4050, country: 'DE' },
];

export default function App() {
  const [demoIdx, setDemoIdx] = useState(0);
  const [crashOpen, setCrashOpen] = useState(false);
  const { location: gpsLocation, error: gpsError, loading: gpsLoading } = useLocation({
    onCrashDetected: () => setCrashOpen(true),
  });
  const isOnline = useNetwork();

  const activeLocation = useMemo(() => {
    const demo = DEMO_LOCATIONS[demoIdx];
    if (demo.lat != null) return { lat: demo.lat, lon: demo.lon, country_code: demo.country, source: 'demo' };
    return gpsLocation;
  }, [demoIdx, gpsLocation]);

  const [searchData, setSearchData] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [cachedAt, setCachedAt] = useState(null);

  const [triageOpen, setTriageOpen] = useState(false);
  const [triageLoading, setTriageLoading] = useState(false);
  const [triaged, setTriaged] = useState(false);

  // Run the search whenever active location changes
  useEffect(() => {
    if (!activeLocation) return;

    let cancelled = false;
    setSearchLoading(true);
    setSearchError(null);
    setCachedAt(null);

    (async () => {
      try {
        const data = await searchNearby(activeLocation.lat, activeLocation.lon);
        if (cancelled) return;
        setSearchData(data);
        setTriaged(false);
        setTriageOpen(true);
        saveSearchResult(activeLocation.lat, activeLocation.lon, data);
      } catch (err) {
        if (cancelled) return;
        const cached = loadSearchResult(activeLocation.lat, activeLocation.lon);
        if (cached) {
          setSearchData(cached);
          setCachedAt(cached.cachedAt);
          setTriaged(false);
          setTriageOpen(true);
        } else {
          setSearchError(isOnline ? 'Could not fetch nearby services.' : 'You are offline and have no cached results for this location.');
        }
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [activeLocation?.lat, activeLocation?.lon]);

  const handleTriage = useCallback(async ({ injured, blocking }) => {
    if (!searchData?.contacts?.length) return;
    setTriageLoading(true);
    try {
      const result = await triageContacts(injured, blocking, searchData.contacts);
      setSearchData(prev => ({ ...prev, contacts: result.contacts, reason: result.reason }));
      setTriaged(true);
    } catch {
      // Backend has its own fallback; if even that fails, just close the modal
    } finally {
      setTriageLoading(false);
      setTriageOpen(false);
    }
  }, [searchData]);

  const countryCode = searchData?.country_code || activeLocation?.country_code || 'IN';
  const numbers = getEmergencyNumbers(countryCode);
  const topContact = searchData?.contacts?.[0];

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo">🚨</span>
          <span className="app__title">RoadSOS</span>
        </div>
        <select
          className="demo-picker"
          value={demoIdx}
          onChange={(e) => setDemoIdx(Number(e.target.value))}
          aria-label="Demo location"
        >
          {DEMO_LOCATIONS.map((d, i) => (
            <option key={i} value={i}>{d.label}</option>
          ))}
        </select>
      </header>

      <OfflineBanner isOnline={isOnline} />

      <CountryEmergency numbers={numbers} />

      <main className="app__main">
        {gpsLoading && demoIdx === 0 && (
          <div className="status-strip">📍 Detecting your location...</div>
        )}
        {gpsError && demoIdx === 0 && !activeLocation && (
          <div className="status-strip status-strip--error">
            {gpsError} Showing national numbers above.
          </div>
        )}
        {searchData?.landmark && (
          <div className="landmark">📍 {searchData.landmark}</div>
        )}

        <ContactList
          contacts={searchData?.contacts}
          loading={searchLoading}
          error={searchError}
          cachedAt={cachedAt}
        />

        {searchData?.source && (
          <div className="source-note">
            Data: {searchData.source} · {searchData.count} services found
            {triaged && ' · Prioritised by AI'}
          </div>
        )}
      </main>

      <SOSButton
        location={activeLocation}
        landmark={searchData?.landmark}
        topContact={topContact}
      />

      <TriageModal
        open={triageOpen && !!searchData?.contacts?.length}
        loading={triageLoading}
        onSubmit={handleTriage}
        onSkip={() => setTriageOpen(false)}
      />

      <CrashAlert
        open={crashOpen}
        onConfirm={() => setCrashOpen(false)}
        onCancel={() => setCrashOpen(false)}
      />
    </div>
  );
}
