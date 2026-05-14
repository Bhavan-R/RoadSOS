import React, { useState, useCallback } from 'react';
import { prefetchRoute, CITY_PRESETS } from '../utils/routeCache';

/**
 * RoutePlanner — pre-cache emergency contacts along a road trip so the
 * app keeps working in dead zones.
 *
 * UX: pick origin + destination from a curated city dropdown, hit "Cache".
 * Progress bar fills as each waypoint completes.
 *
 * Props:
 *   open      {boolean}
 *   onClose   {function}
 */
export default function RoutePlanner({ open, onClose }) {
  const [originIdx,      setOriginIdx]      = useState(0);
  const [destinationIdx, setDestinationIdx] = useState(1);
  const [progress,       setProgress]       = useState(null); // { done, total }
  const [status,         setStatus]         = useState('idle'); // idle | running | done | error
  const [polylineSource, setPolylineSource] = useState(null);

  const origin      = CITY_PRESETS[originIdx];
  const destination = CITY_PRESETS[destinationIdx];
  const sameCity    = originIdx === destinationIdx;

  const handleStart = useCallback(async () => {
    if (sameCity) return;
    setStatus('running');
    setProgress({ done: 0, total: 6 });
    try {
      const result = await prefetchRoute(origin, destination, {
        waypoints: 6,
        onProgress: (p) => setProgress({ done: p.done, total: p.total }),
      });
      setPolylineSource(result.polylineSource);
      setStatus(result.cached > 0 ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  }, [origin, destination, sameCity]);

  const handleClose = useCallback(() => {
    if (status === 'running') return; // don't allow close mid-fetch
    setStatus('idle');
    setProgress(null);
    setPolylineSource(null);
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

        {/* Header */}
        <div className="modal__header-row">
          <span className="modal__header-icon">🗺</span>
          <div>
            <h2>Plan an offline trip</h2>
            <p className="modal__subtitle">
              Cache hospitals + police along your route while you're online —
              works even in cellular dead zones later.
            </p>
          </div>
        </div>

        {/* From / To */}
        <div className="route-planner__form">
          <label className="route-planner__field">
            <span className="route-planner__field-label">From</span>
            <select
              value={originIdx}
              onChange={(e) => setOriginIdx(Number(e.target.value))}
              disabled={status === 'running'}
              id="route-origin"
            >
              {CITY_PRESETS.map((c, i) => (
                <option key={c.code} value={i}>{c.name}</option>
              ))}
            </select>
          </label>

          <div className="route-planner__arrow" aria-hidden="true">→</div>

          <label className="route-planner__field">
            <span className="route-planner__field-label">To</span>
            <select
              value={destinationIdx}
              onChange={(e) => setDestinationIdx(Number(e.target.value))}
              disabled={status === 'running'}
              id="route-destination"
            >
              {CITY_PRESETS.map((c, i) => (
                <option key={c.code} value={i}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>

        {sameCity && status === 'idle' && (
          <p className="route-planner__hint route-planner__hint--warn">
            Pick a different destination than origin.
          </p>
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
            <strong> {origin.name} → {destination.name}</strong>.
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
            Could not cache any waypoints — check connection and try again.
          </div>
        )}

        {/* Actions */}
        <div className="modal__actions">
          {status === 'idle' && (
            <button
              className="modal__primary"
              onClick={handleStart}
              disabled={sameCity}
              id="route-start-btn"
            >
              🛣 Cache route for offline use
            </button>
          )}
          {status === 'running' && (
            <button className="modal__primary" disabled aria-busy="true">
              ⏳ Caching… ({percent}%)
            </button>
          )}
          {(status === 'done' || status === 'error') && (
            <button className="modal__primary" onClick={handleStart}>
              ↻ Cache another route
            </button>
          )}
          <button
            className="modal__secondary"
            onClick={handleClose}
            disabled={status === 'running'}
            id="route-close-btn"
          >
            {status === 'done' ? 'Done' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
