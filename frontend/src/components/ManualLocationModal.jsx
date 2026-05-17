import React, { useState, useRef, useEffect } from 'react';
import { MapPin, X, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

export default function ManualLocationModal({ open, onClose, onSetLocation, mapRef }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState(null); // 'map' | 'search' | null
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef(null);

  if (!open) return null;

  // ── Fetch address suggestions ──
  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    clearTimeout(searchTimeoutRef.current);
    setSearching(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=5`
        );
        const data = await res.json();
        setSearchResults(
          data.map((r) => ({
            name: r.display_name,
            lat: parseFloat(r.lat),
            lon: parseFloat(r.lon),
          }))
        );
      } catch (err) {
        setSearchResults([]);
      }
      setSearching(false);
    }, 500);
  };

  // ── Handle result selection ──
  const selectResult = (result) => {
    onSetLocation({
      lat: result.lat,
      lon: result.lon,
      source: 'manual',
      landmark: result.name.split(',')[0].trim(),
    });
    onClose();
  };

  // ── Map click handler ──
  const handleMapClick = (e) => {
    const { latlng } = e;
    onSetLocation({
      lat: latlng.lat,
      lon: latlng.lng,
      source: 'manual',
      landmark: `${latlng.lat.toFixed(4)}°, ${latlng.lng.toFixed(4)}°`,
    });
    onClose();
  };

  // ── Attach map click listener when in map mode ──
  useEffect(() => {
    if (mode !== 'map' || !mapRef?.current) return;

    const map = mapRef.current;
    map.on('click', handleMapClick);
    return () => map.off('click', handleMapClick);
  }, [mode, mapRef]);

  return (
    <>
      {/* Overlay */}
      <div className="manual-location-overlay" onClick={onClose} />

      {/* Modal */}
      <div className="manual-location-modal">
        <div className="mlm-header">
          <div className="mlm-title">{t('manual_location.title', 'Set Location')}</div>
          <button className="mlm-close" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {!mode && (
          <div className="mlm-body">
            <div className="mlm-text">{t('manual_location.choose_method', 'How would you like to set your location?')}</div>
            <button
              className="mlm-option"
              onClick={() => setMode('map')}
            >
              <MapPin size={16} />
              <span>{t('manual_location.tap_map', 'Tap on map')}</span>
            </button>
            <button
              className="mlm-option"
              onClick={() => setMode('search')}
            >
              <Search size={16} />
              <span>{t('manual_location.search_address', 'Search address')}</span>
            </button>
          </div>
        )}

        {mode === 'search' && (
          <div className="mlm-body">
            <div className="mlm-back" onClick={() => setMode(null)}>
              ← Back
            </div>
            <input
              type="text"
              placeholder={t('manual_location.search_placeholder', 'City, address, or coordinates')}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="mlm-search-input"
              autoFocus
            />
            {searching && (
              <div className="mlm-searching">
                {t('manual_location.searching', 'Searching…')}
              </div>
            )}
            {searchResults.length > 0 && (
              <div className="mlm-results">
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    className="mlm-result-item"
                    onClick={() => selectResult(r)}
                  >
                    <div className="mlm-result-name">{r.name.split(',')[0]}</div>
                    <div className="mlm-result-sub">{r.name.split(',').slice(1).join(', ')}</div>
                  </button>
                ))}
              </div>
            )}
            {!searching && searchQuery && searchResults.length === 0 && (
              <div className="mlm-no-results">
                {t('manual_location.no_results', 'No results found')}
              </div>
            )}
          </div>
        )}

        {mode === 'map' && (
          <div className="mlm-body">
            <div className="mlm-back" onClick={() => setMode(null)}>
              ← Back
            </div>
            <div className="mlm-map-hint">
              {t('manual_location.tap_hint', 'Tap anywhere on the map to set your location')}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
