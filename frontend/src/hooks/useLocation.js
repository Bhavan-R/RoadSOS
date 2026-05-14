import { useState, useEffect, useRef, useCallback } from 'react';

// ─── GPS velocity crash detection ───────────────────────────────────────────
const GPS_TIMEOUT_MS = 10_000;
const VELOCITY_WINDOW_MS = 2_000;
const CRASH_SPEED_FROM_KMH = 25;   // was travelling at ≥ this speed
const CRASH_SPEED_TO_KMH   = 5;    // came to ≤ this speed

// ─── Accelerometer crash detection ──────────────────────────────────────────
// 3.5 G = significant frontal impact (potholes rarely exceed 2 G)
const CRASH_G_THRESHOLD = 3.5;
const CRASH_COOLDOWN_MS = 12_000;  // suppress duplicate alerts for 12 s

function mpsToKmh(mps) { return mps * 3.6; }

async function ipFallback() {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (data.latitude && data.longitude) {
      return { lat: data.latitude, lon: data.longitude, country_code: data.country_code };
    }
  } catch { /* silent */ }
  return null;
}

/**
 * Request DeviceMotion permission on iOS 13+.
 * Must be called from a user-gesture handler (button tap).
 * No-op on Android / desktop.
 */
export async function requestMotionPermission() {
  if (
    typeof DeviceMotionEvent !== 'undefined' &&
    typeof DeviceMotionEvent.requestPermission === 'function'
  ) {
    try {
      return await DeviceMotionEvent.requestPermission();
    } catch {
      return 'denied';
    }
  }
  return 'granted'; // Android / desktop never need explicit permission
}

export function useLocation({ onCrashDetected } = {}) {
  const [location, setLocation]   = useState(null);
  const [error, setError]         = useState(null);
  const [loading, setLoading]     = useState(true);

  const speedHistoryRef   = useRef([]);
  const watchIdRef        = useRef(null);
  const locationRef       = useRef(null);   // always-current location for callbacks
  const crashFiredRef     = useRef(false);  // de-duplicate alerts

  // Keep locationRef in sync
  useEffect(() => { locationRef.current = location; }, [location]);

  // ─── Shared crash trigger (de-duped) ────────────────────────────────────
  const fireCrash = useCallback((trigger) => {
    if (crashFiredRef.current) return;
    crashFiredRef.current = true;
    onCrashDetected?.({ ...locationRef.current, trigger });
    // Reset cooldown so a second genuine crash can still alert
    setTimeout(() => { crashFiredRef.current = false; }, CRASH_COOLDOWN_MS);
  }, [onCrashDetected]);

  // ─── GPS velocity collapse check ────────────────────────────────────────
  const checkVelocityCollapse = useCallback((speedKmh, timestamp) => {
    const history = speedHistoryRef.current;
    history.push({ speedKmh, timestamp });
    const cutoff = timestamp - VELOCITY_WINDOW_MS;
    speedHistoryRef.current = history.filter(e => e.timestamp >= cutoff);

    const recent = speedHistoryRef.current;
    if (recent.length < 2) return;

    const oldest = recent[0];
    const newest = recent[recent.length - 1];
    if (oldest.speedKmh >= CRASH_SPEED_FROM_KMH && newest.speedKmh <= CRASH_SPEED_TO_KMH) {
      speedHistoryRef.current = [];
      fireCrash('gps_velocity');
    }
  }, [fireCrash]);

  // ─── Accelerometer G-force check ────────────────────────────────────────
  useEffect(() => {
    if (typeof DeviceMotionEvent === 'undefined') return;

    const handleMotion = (event) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc || acc.x == null) return;

      const magnitude = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
      const gForce = magnitude / 9.81;

      if (gForce > CRASH_G_THRESHOLD) {
        fireCrash('accelerometer');
      }
    };

    // Android / desktop: add listener immediately
    // iOS 13+: requestPermission must be called from a user gesture (via
    // the exported requestMotionPermission helper). We attempt a silent
    // add here which works on Android; iOS will throw and we catch it.
    const setup = async () => {
      // 1. iOS 13+: needs explicit requestPermission from a user gesture.
      // This may fail silently inside an effect on first load; the listener 
      // will be successfully added later once the SOS button is tapped.
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        try {
          const perm = await DeviceMotionEvent.requestPermission();
          if (perm === 'granted') window.addEventListener('devicemotion', handleMotion);
        } catch {
          // No user gesture yet — GPS-only detection still works
        }
        return;
      }

      // 2. Firefox / modern browsers: check Permissions API before adding listener
      // to avoid the "motion sensor deprecated" console warning.
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const result = await navigator.permissions.query({ name: 'accelerometer' });
          if (result.state !== 'denied') {
            window.addEventListener('devicemotion', handleMotion);
          }
          return;
        } catch {
          // Browser supports Permissions API but not 'accelerometer' query — fall through
        }
      }

      // 3. Standard fallback for other browsers
      window.addEventListener('devicemotion', handleMotion);
    };

    setup();
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [fireCrash]);

  // ─── GPS watch ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const gpsTimeout = setTimeout(async () => {
      if (!cancelled && !locationRef.current) {
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
        setLocation({ lat: latitude, lon: longitude, speedKmh, source: 'gps' });
        setLoading(false);
        setError(null);
        if (onCrashDetected && speed !== null) {
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
