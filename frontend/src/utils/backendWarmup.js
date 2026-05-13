/**
 * Render free tier sleeps after 15 min of inactivity. The first request
 * after sleep takes 30-60 s while the container spins up. This is fatal
 * during a judging demo — judges think the app is broken.
 *
 * Fix: fire a /health ping the moment the app loads. By the time the user
 * picks a location or triggers a search, the container is already warm.
 *
 * Additionally, ping every 10 minutes to keep the container alive during a
 * long demo session.
 */

const KEEP_WARM_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
let intervalId = null;

async function ping() {
  try {
    await fetch('/health', { signal: AbortSignal.timeout(60_000) });
  } catch {
    // silent — first ping may take 30-60s on cold start, that's expected
  }
}

/** Wake the backend immediately and keep it warm. */
export function startBackendWarmup() {
  // Fire the initial ping immediately
  ping();

  // Repeat every 10 minutes so it never sleeps during a demo
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(ping, KEEP_WARM_INTERVAL_MS);
}

/** Stop pinging (e.g. on unmount). */
export function stopBackendWarmup() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
