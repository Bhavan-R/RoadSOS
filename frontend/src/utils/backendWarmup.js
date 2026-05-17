/**
 * Backend warmup + readiness tracker.
 *
 * Render's free-tier dyno sleeps after 15 min of inactivity. Cold start
 * is 25–55 s. The original warmup did a single 60-second ping — if it
 * timed out, the next attempt was 10 minutes away, which is useless
 * when a judge is starting a demo right now.
 *
 * This version:
 *   1. First ping with a tight 8 s timeout — succeeds immediately if
 *      the dyno is warm.
 *   2. If that fails, three retries at 12 s / 20 s / 30 s timeouts with
 *      short pauses between. Total worst-case wait: ~75 s, which covers
 *      every observed Render cold-start time.
 *   3. After success, ping every 10 min to keep the dyno awake.
 *   4. Listens for `visibilitychange`: if the tab regains focus more
 *      than 9 min after the last successful ping, fire an immediate
 *      warmup so the next user action doesn't pay the cold-start cost.
 *   5. Broadcasts state changes via `roadsos:backend-status` custom
 *      events on `window`, so UI components can show 'Warming up…' vs
 *      'Connected' badges without polling.
 *
 * Status values:
 *   'unknown' — initial state, no ping attempted yet
 *   'warming' — first ping in flight, or retries in progress
 *   'ready'   — last successful ping within KEEP_WARM_INTERVAL_MS
 *   'cold'    — all warmup retries exhausted; we'll keep trying via
 *               the 10-min interval but the user is on their own
 */

const KEEP_WARM_INTERVAL_MS = 10 * 60 * 1000;     // 10 min
const RESYNC_THRESHOLD_MS   = 9  * 60 * 1000;     // 9 min — re-ping on focus if stale
const ATTEMPTS = [
  { timeoutMs: 8_000,  pauseAfterMs: 2_000 },
  { timeoutMs: 12_000, pauseAfterMs: 5_000 },
  { timeoutMs: 20_000, pauseAfterMs: 8_000 },
  { timeoutMs: 30_000, pauseAfterMs: 0     },
];

// Fall back to deployed Render backend in production if env var is missing,
// so warmup pings still hit the real server. Dev uses Vite proxy.
const API_BASE = import.meta.env.VITE_API_URL
  || (import.meta.env.PROD ? 'https://roadsos-pl3k.onrender.com' : '');
const STATUS_EVENT = 'roadsos:backend-status';

let intervalId        = null;
let visibilityHandler = null;
let currentStatus     = 'unknown';
let lastSuccessAt     = 0;
let warmupInFlight    = false;

function setStatus(next) {
  if (next === currentStatus) return;
  currentStatus = next;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STATUS_EVENT, { detail: { status: next } }));
  }
}

async function pingOnce(timeoutMs) {
  try {
    const r = await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(timeoutMs),
      // Don't send credentials — /health is a public endpoint, and avoiding
      // credentials sidesteps a class of CORS preflight surprises.
      credentials: 'omit',
      cache: 'no-store',
    });
    return r.ok;
  } catch {
    return false;
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Run the multi-attempt warmup. Idempotent — concurrent calls are deduped. */
async function runWarmup() {
  if (warmupInFlight) return;
  warmupInFlight = true;
  setStatus('warming');

  try {
    for (let i = 0; i < ATTEMPTS.length; i += 1) {
      const { timeoutMs, pauseAfterMs } = ATTEMPTS[i];
      const ok = await pingOnce(timeoutMs);
      if (ok) {
        lastSuccessAt = Date.now();
        setStatus('ready');
        return;
      }
      // Not the last attempt — pause briefly then try again. Render's
      // cold-start usually finishes between attempt 2 and 3.
      if (i < ATTEMPTS.length - 1 && pauseAfterMs > 0) {
        await wait(pauseAfterMs);
      }
    }
    setStatus('cold');
  } finally {
    warmupInFlight = false;
  }
}

/** Schedule the 10-minute keep-warm loop (idempotent). */
function scheduleKeepAlive() {
  if (intervalId) return;
  intervalId = setInterval(() => {
    // Fire-and-forget; status updates flow through setStatus internally.
    runWarmup();
  }, KEEP_WARM_INTERVAL_MS);
}

/** Listen for tab visibility — if user returns after >9 min, re-warm. */
function attachVisibilityHandler() {
  if (visibilityHandler || typeof document === 'undefined') return;
  visibilityHandler = () => {
    if (document.visibilityState === 'visible') {
      const stale = Date.now() - lastSuccessAt > RESYNC_THRESHOLD_MS;
      if (stale && !warmupInFlight) {
        runWarmup();
      }
    }
  };
  document.addEventListener('visibilitychange', visibilityHandler);
}

/** Wake the backend immediately, keep it warm, and resync on focus. */
export function startBackendWarmup() {
  runWarmup();          // fire-and-forget; do not block UI thread
  scheduleKeepAlive();
  attachVisibilityHandler();
}

/** Stop pinging and detach handlers — call on unmount in dev/HMR. */
export function stopBackendWarmup() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (visibilityHandler && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
  warmupInFlight = false;
  currentStatus  = 'unknown';
  lastSuccessAt  = 0;
}

/** Current backend reachability — one of 'unknown' | 'warming' | 'ready' | 'cold'. */
export function getBackendStatus() {
  return currentStatus;
}

/**
 * Subscribe to backend-status changes. Returns an unsubscribe function.
 * The handler is called with the new status on every transition.
 *
 *   useEffect(() => {
 *     const off = subscribeBackendStatus((s) => setBackendStatus(s));
 *     return off;
 *   }, []);
 */
export function subscribeBackendStatus(handler) {
  if (typeof window === 'undefined' || typeof handler !== 'function') {
    return () => {};
  }
  const listener = (e) => handler(e.detail?.status);
  window.addEventListener(STATUS_EVENT, listener);
  // Fire once immediately so the subscriber learns the current state
  // without having to wait for the next transition.
  handler(currentStatus);
  return () => window.removeEventListener(STATUS_EVENT, listener);
}
