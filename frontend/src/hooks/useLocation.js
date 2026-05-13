import { useState, useEffect, useRef, useCallback } from 'react';

// ─── GPS velocity crash detection ───────────────────────────────────────────
const GPS_TIMEOUT_MS = 10_000;
const VELOCITY_WINDOW_MS = 2_000;
const CRASH_SPEED_FROM_KMH = 25;   // was travelling at ≥ this speed
const CRASH_SPEED_TO_KMH   = 5;    // came to ≤ this speed

// ─── Accelerometer crash detection ──────────────────────────────────────────
// Accelerometer is a CONFIRMATION signal only — it never fires alone.
// Reason: a thrown or dropped phone easily hits 3.5 G, creating false alarms.
// We only use the accel spike to confirm what GPS velocity already suspects.
const CRASH_G_THRESHOLD  = 3.5;   // G-force that counts as a spike
const ACCEL_CONFIRM_MS   = 4_000; // accel must agree with GPS within this window
const CRASH_COOLDOWN_MS  = 12_000;

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

  const speedHistoryRef      = useRef([]);
  const watchIdRef           = useRef(null);
  const locationRef          = useRef(null);    // always-current location for callbacks
  const crashFiredRef        = useRef(false);   // de-duplicate alerts
  const gpsCollapseTimeRef   = useRef(null);    // timestamp of last GPS velocity collapse
  const accelSpikeTimeRef    = useRef(null);    // timestamp of last accelerometer spike

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
      gpsCollapseTimeRef.current = Date.now();

      // Check if accelerometer already spiked within the confirmation window
      const accelTime = accelSpikeTimeRef.current;
      if (accelTime && (Date.now() - accelTime) <= ACCEL_CONFIRM_MS) {
        fireCrash('gps+accel');   // both signals agree → high confidence
      } else {
        fireCrash('gps_velocity'); // GPS alone → still trigger (original behaviour)
      }
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
        // Record spike time — but do NOT fire alone.
        // A throw or drop reaches 3.5 G easily. We only confirm if GPS
        // velocity has already collapsed within ACCEL_CONFIRM_MS.
        accelSpikeTimeRef.current = Date.now();

        const gpsTime = gpsCollapseTimeRef.current;
        if (gpsTime && (Date.now() - gpsTime) <= ACCEL_CONFIRM_MS) {
          fireCrash('gps+accel');  // GPS already collapsed → confirmed
        }
        // else: accel spike recorded, waiting for GPS to confirm
      }
    };

    const setup = async () => {
      // iOS 13+: needs explicit requestPermission from a user gesture.
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        try {
          const perm = await DeviceMotionEvent.requestPermission();
          if (perm === 'granted') window.addEventListener('devicemotion', handleMotion);
        } catch {
          // No user gesture yet — GPS-only detection still works
        }
        return;
      }

      // Firefox / modern browsers: check Permissions API before adding listener
      // to avoid the "motion sensor deprecated" console warning.
      if (navigator.permissions) {
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

      // Android / desktop Chrome — add listener directly (no permission needed)
      window.addEventListener('devicemotion', handleMotion);
    };

    setup();
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [fireCrash]);

  // ─── GPS watch ──────────────────────────────────────────────────────────
  const lastReportedRef = useRef(null); // track last position we actually set

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
        const { latitude, longitude, speed, accuracy } = pos.coords;
        const speedKmh = speed != null ? mpsToKmh(speed) : 0;

        // Ignore very inaccurate first fixes (network/wifi positioning artefacts).
        // accuracy is in metres — skip if worse than 200 m and we already have a fix.
        if (accuracy > 200 && locationRef.current?.source === 'gps') return;

        // Distance gate: skip tiny GPS jitter updates (< 50 m moved).
        // Prevents constant re-searches from floating-point drift.
        const prev = lastReportedRef.current;
        if (prev) {
          const dLat = (latitude - prev.lat) * 111_000;
          const dLon = (longitude - prev.lon) * 111_000 * Math.cos(latitude * Math.PI / 180);
          const distM = Math.sqrt(dLat * dLat + dLon * dLon);
          if (distM < 50) {
            // Still feed velocity data for crash detection without re-rendering
            if (onCrashDetected && speed != null) checkVelocityCollapse(speedKmh, pos.timestamp);
            return;
          }
        }

        lastReportedRef.current = { lat: latitude, lon: longitude };
        setLocation({ lat: latitude, lon: longitude, speedKmh, source: 'gps' });
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
      // maximumAge: 0 — never use stale cached GPS positions.
      // A 5-second-old fix could be from a totally different location
      // (e.g. last place the phone had GPS locked), causing the "bounce".
      { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS, maximumAge: 0 }
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
