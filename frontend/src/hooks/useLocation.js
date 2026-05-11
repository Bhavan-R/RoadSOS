import { useState, useEffect, useRef, useCallback } from 'react';

const GPS_TIMEOUT_MS = 10_000;
const VELOCITY_WINDOW_MS = 2_000;
const CRASH_SPEED_FROM_KMH = 25;
const CRASH_SPEED_TO_KMH = 5;

function mpsToKmh(mps) {
  return mps * 3.6;
}

async function ipFallback() {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (data.latitude && data.longitude) {
      return { lat: data.latitude, lon: data.longitude, country_code: data.country_code };
    }
  } catch {
    // silent fail
  }
  return null;
}

export function useLocation({ onCrashDetected } = {}) {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const speedHistoryRef = useRef([]);
  const watchIdRef = useRef(null);

  const checkVelocityCollapse = useCallback((speedKmh, timestamp) => {
    const history = speedHistoryRef.current;
    history.push({ speedKmh, timestamp });

    // Prune entries older than VELOCITY_WINDOW_MS
    const cutoff = timestamp - VELOCITY_WINDOW_MS;
    speedHistoryRef.current = history.filter(e => e.timestamp >= cutoff);

    const recent = speedHistoryRef.current;
    if (recent.length < 2) return;

    const oldest = recent[0];
    const newest = recent[recent.length - 1];

    if (
      oldest.speedKmh >= CRASH_SPEED_FROM_KMH &&
      newest.speedKmh <= CRASH_SPEED_TO_KMH
    ) {
      onCrashDetected?.({ lat: location?.lat, lon: location?.lon });
      speedHistoryRef.current = [];
    }
  }, [location, onCrashDetected]);

  useEffect(() => {
    let cancelled = false;

    const gpsTimeout = setTimeout(async () => {
      if (!cancelled && !location) {
        const fallback = await ipFallback();
        if (!cancelled && fallback) {
          setLocation({ lat: fallback.lat, lon: fallback.lon, country_code: fallback.country_code, source: 'ip' });
          setLoading(false);
        }
      }
    }, GPS_TIMEOUT_MS);

    if (!navigator.geolocation) {
      clearTimeout(gpsTimeout);
      ipFallback().then(fb => {
        if (!cancelled && fb) {
          setLocation({ lat: fb.lat, lon: fb.lon, country_code: fb.country_code, source: 'ip' });
        }
        setLoading(false);
      });
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        clearTimeout(gpsTimeout);
        if (cancelled) return;

        const { latitude, longitude, speed } = pos.coords;
        const speedKmh = speed != null ? mpsToKmh(speed) : 0;

        setLocation(prev => {
          const next = { lat: latitude, lon: longitude, speedKmh, source: 'gps' };
          return next;
        });
        setLoading(false);
        setError(null);

        if (onCrashDetected && speed != null) {
          checkVelocityCollapse(speedKmh, pos.timestamp);
        }
      },
      async (err) => {
        clearTimeout(gpsTimeout);
        if (cancelled) return;
        const fallback = await ipFallback();
        if (!cancelled) {
          if (fallback) {
            setLocation({ lat: fallback.lat, lon: fallback.lon, country_code: fallback.country_code, source: 'ip' });
          } else {
            setError('Unable to determine location. Please allow location access.');
          }
          setLoading(false);
        }
      },
      { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS, maximumAge: 5000 }
    );

    return () => {
      cancelled = true;
      clearTimeout(gpsTimeout);
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { location, error, loading };
}
