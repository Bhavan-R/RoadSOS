import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { prefetchRoute } from '../utils/routeCache';
import { searchPlaces, QUICK_PICK_CITIES } from '../utils/geocode';

/**
 * RoutePlanner — pre-cache emergency contacts along a road trip so the
 * app keeps working in dead zones.
 *
 * UX (v2): free-text origin + destination — works for any city, town,
 * highway junction, or landmark anywhere on Earth via Nominatim. Quick-
 * pick chips below the inputs are shortcuts, not restrictions.
 *
 * Props:
 *   open      {boolean}
 *   onClose   {function}
 */

/**
 * PlaceInput — Google-Maps-style autocomplete for any place on Earth.
 *
 * Debounces typing 350 ms, then hits Nominatim for up to 5 candidates.
 * Suggestions appear as a dropdown beneath the input. Click a row to
 * select. Same-named places in different countries are disambiguated by
 * the secondary "context" line ("Assam, India" vs "Payeska, Bolivia").
 */
function PlaceInput({ label, value, onChange, onGeocoded, geo, disabled, id, placeholder }) {
  const [busy, setBusy]               = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showList, setShowList]       = useState(false);
  const [activeIdx, setActiveIdx]     = useState(-1);

  const debounceRef = useRef(null);
  const wrapRef     = useRef(null);

  // Fetch suggestions on every keystroke (debounced 200ms). Starts from
  // the *first* character so the dropdown feels responsive — same as
  // Google Maps' autocomplete. A keystroke after a successful selection
  // clears the resolved geo so the user can amend without leftover "✓".
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = (value || '').trim();
    if (q.length < 1 || (geo && geo.query === q)) {
      setSuggestions([]);
      setShowList(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setBusy(true);
      const list = await searchPlaces(q, 5);
      setBusy(false);
      setSuggestions(list);
      setShowList(list.length > 0);
      setActiveIdx(-1);
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [value, geo]);

  // Click-outside to close the dropdown.
  useEffect(() => {
    if (!showList) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setShowList(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showList]);

  const select = (s) => {
    onChange(s.shortName);
    onGeocoded({
      lat: s.lat, lon: s.lon,
      displayName: s.displayName,
      query: s.shortName,
    });
    setShowList(false);
    setSuggestions([]);
  };

  const handleKey = (e) => {
    if (!showList || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = activeIdx >= 0 ? suggestions[activeIdx] : suggestions[0];
      if (pick) select(pick);
    } else if (e.key === 'Escape') {
      setShowList(false);
    }
  };

  const statusIcon = busy
    ? '⏳'
    : geo?.error
      ? '⚠️'
      : geo && !geo.error
        ? '✓'
        : '';

  return (
    <label className="route-planner__field" ref={wrapRef}>
      <span className="route-planner__field-label">{label}</span>
      <div className="route-planner__input-wrap">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value); onGeocoded(null); }}
          onFocus={() => { if (suggestions.length > 0) setShowList(true); }}
          onKeyDown={handleKey}
          placeholder={placeholder || 'Start typing a city, town, or landmark'}
          disabled={disabled}
          autoComplete="off"
          spellCheck="false"
          aria-autocomplete="list"
          aria-expanded={showList}
        />
        <span className={`route-planner__input-status ${geo?.error ? 'route-planner__input-status--err' : ''}`}>
          {statusIcon}
        </span>

        {/* Dropdown of candidates */}
        {showList && suggestions.length > 0 && (
          <ul className="route-planner__suggest" role="listbox">
            {suggestions.map((s, i) => (
              <li
                key={`${s.lat},${s.lon}`}
                role="option"
                aria-selected={i === activeIdx}
                className={`route-planner__suggest-item ${i === activeIdx ? 'is-active' : ''}`}
                // onMouseDown (not onClick) so click fires before the
                // input loses focus and the dropdown closes.
                onMouseDown={(e) => { e.preventDefault(); select(s); }}
              >
                <span className="route-planner__suggest-pin" aria-hidden="true">📍</span>
                <span className="route-planner__suggest-text">
                  <span className="route-planner__suggest-primary">{s.shortName}</span>
                  {s.context && (
                    <span className="route-planner__suggest-context">{s.context}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {geo?.error && (
        <span className="route-planner__field-hint route-planner__field-hint--err">
          Couldn't find that place. Check spelling or pick from suggestions.
        </span>
      )}
      {geo && !geo.error && !showList && (
        <span className="route-planner__field-hint">
          {geo.displayName.length > 60 ? geo.displayName.slice(0, 57) + '…' : geo.displayName}
        </span>
      )}
    </label>
  );
}

export default function RoutePlanner({ open, onClose }) {
  const { t } = useTranslation();
  // Text + resolved geo state for each input
  const [originText, setOriginText] = useState('');
  const [originGeo,  setOriginGeo]  = useState(null);
  const [destText,   setDestText]   = useState('');
  const [destGeo,    setDestGeo]    = useState(null);

  const [progress,       setProgress]       = useState(null); // { done, total }
  const [status,         setStatus]         = useState('idle'); // idle | running | done | error
  const [polylineSource, setPolylineSource] = useState(null);

  // Reset when the modal opens
  useEffect(() => {
    if (open) {
      setOriginText(''); setOriginGeo(null);
      setDestText('');   setDestGeo(null);
      setProgress(null); setStatus('idle'); setPolylineSource(null);
    }
  }, [open]);

  const fillFromChip = (slot, city) => {
    const geo = {
      lat: city.lat, lon: city.lon,
      displayName: city.name, query: city.name,
    };
    if (slot === 'origin') {
      setOriginText(city.name); setOriginGeo(geo);
    } else {
      setDestText(city.name); setDestGeo(geo);
    }
  };

  const useCurrentForOrigin = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOriginText('Current location');
        setOriginGeo({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          displayName: `Current location (${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)})`,
          query: 'current',
        });
      },
      () => { /* permission denied — silent */ },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 }
    );
  };

  const ready = originGeo && !originGeo.error && destGeo && !destGeo.error &&
                !(originGeo.lat === destGeo.lat && originGeo.lon === destGeo.lon);

  const handleStart = useCallback(async () => {
    if (!ready) return;
    setStatus('running');
    setProgress({ done: 0, total: 6 });
    try {
      const result = await prefetchRoute(originGeo, destGeo, {
        waypoints: 6,
        onProgress: (p) => setProgress({ done: p.done, total: p.total }),
      });
      setPolylineSource(result.polylineSource);
      setStatus(result.cached > 0 ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  }, [ready, originGeo, destGeo]);

  const handleClose = useCallback(() => {
    if (status === 'running') return;
    onClose?.();
  }, [status, onClose]);

  if (!open) return null;

  const percent = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Plan offline route"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="modal route-planner">

        <div className="modal__header-row">
          <span className="modal__header-icon">🗺</span>
          <div>
            <h2>{t('plan_trip.title', 'Plan an offline trip')}</h2>
            <p className="modal__subtitle">
              {t('plan_trip.subtitle', "Cache hospitals + police along your route while you're online — works even in cellular dead zones later.")}
            </p>
          </div>
        </div>

        {/* From / To free-text inputs */}
        <div className="route-planner__form">
          <PlaceInput
            id="route-origin"
            label={t('plan_trip.from', 'From')}
            placeholder={t('plan_trip.placeholder', 'Start typing a city, town, or landmark')}
            value={originText}
            onChange={setOriginText}
            onGeocoded={setOriginGeo}
            geo={originGeo}
            disabled={status === 'running'}
          />
          <div className="route-planner__arrow" aria-hidden="true">→</div>
          <PlaceInput
            id="route-destination"
            label={t('plan_trip.to', 'To')}
            placeholder={t('plan_trip.placeholder', 'Start typing a city, town, or landmark')}
            value={destText}
            onChange={setDestText}
            onGeocoded={setDestGeo}
            geo={destGeo}
            disabled={status === 'running'}
          />
        </div>

        {/* "Use current location" + quick-pick chips */}
        {status === 'idle' && (
          <>
            <div className="route-planner__quick-row">
              <button
                type="button"
                className="route-planner__locate-btn"
                onClick={useCurrentForOrigin}
                disabled={!navigator.geolocation}
                title="Set origin to your current GPS coordinates"
              >
                📍 {t('plan_trip.use_current', 'Use current location as origin')}
              </button>
            </div>
            <div className="route-planner__chips">
              <span className="route-planner__chips-label">{t('plan_trip.quick_fill', 'Quick fill destination:')}</span>
              {QUICK_PICK_CITIES.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className="route-planner__chip"
                  onClick={() => fillFromChip('destination', c)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Progress / status */}
        {status === 'running' && progress && (
          <div className="route-planner__progress">
            <div className="route-planner__progress-label">
              Caching {progress.done} of {progress.total} highway segments…
            </div>
            <div className="route-planner__progress-bar">
              <div
                className="route-planner__progress-fill"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}

        {status === 'done' && (
          <div className="route-planner__result route-planner__result--ok">
            ✓ Cached {progress?.total || 0} highway segments for
            <strong> {originText} → {destText}</strong>.
            <div className="route-planner__result-sub">
              {polylineSource === 'osrm'
                ? 'Real driving route from OSRM.'
                : 'Linear waypoint fallback (OSRM unreachable).'}
              {' '}Safe to drive offline.
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="route-planner__result route-planner__result--err">
            Could not cache any waypoints. Check connection and try again.
          </div>
        )}

        {/* Actions */}
        <div className="modal__actions">
          {status === 'idle' && (
            <button
              className="modal__primary"
              onClick={handleStart}
              disabled={!ready}
              id="route-start-btn"
              title={!ready
                ? 'Type or pick origin + destination first'
                : 'Pre-fetch /search for waypoints along this route'}
            >
              🛣 {t('plan_trip.cache_route', 'Cache route for offline use')}
            </button>
          )}
          {status === 'running' && (
            <button className="modal__primary" disabled aria-busy="true">
              ⏳ Caching… ({percent}%)
            </button>
          )}
          {(status === 'done' || status === 'error') && (
            <button className="modal__primary" onClick={() => setStatus('idle')}>
              ↻ Cache another route
            </button>
          )}
          <button
            className="modal__secondary"
            onClick={handleClose}
            disabled={status === 'running'}
            id="route-close-btn"
          >
            {status === 'done' ? t('plan_trip.done', 'Done') : t('plan_trip.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
}
