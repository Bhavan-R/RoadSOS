// Backend handles Google Places fallback automatically via /search.
// This wraps the /triage API endpoint with a client-side rule-based fallback
// so triage works even when the device is completely offline.

// Production fallback to deployed Render backend if env var is missing.
// Strip any leading BOM that can appear when pasting into the Vercel dashboard.
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/^﻿/, '')
  || (import.meta.env.PROD ? 'https://roadsos-pl3k.onrender.com' : '');

// ─── Client-side rule-based triage ──────────────────────────────────────────
// Mirrors backend/services/ai_triage.py :: rule_based_triage() exactly.
// Used when the /triage network call fails (offline, timeout, server error).
const PRIORITY_ORDERS = {
  injuredBlocking:    ['ambulance', 'hospital', 'police', 'towing', 'repair', 'tyre', 'showroom'],
  injuredNoBlock:     ['ambulance', 'hospital', 'police', 'repair', 'towing', 'tyre', 'showroom'],
  blockingNoInjury:   ['police', 'towing', 'ambulance', 'hospital', 'repair', 'tyre', 'showroom'],
  noInjuryNoBlock:    ['repair', 'tyre', 'police', 'towing', 'hospital', 'ambulance', 'showroom'],
};

const PRIORITY_REASONS = {
  injuredBlocking:  'Trauma care plus blocked road · ambulance and hospital listed first',
  injuredNoBlock:   'Trauma care prioritised · ambulance and hospital listed first',
  blockingNoInjury: 'Vehicle blocking traffic · police and towing listed first',
  noInjuryNoBlock:  'No injuries reported · roadside repair services listed first',
};

export function ruleBasedTriage(injured, blocking, contacts) {
  const key = injured && blocking ? 'injuredBlocking'
    : injured                    ? 'injuredNoBlock'
    : blocking                   ? 'blockingNoInjury'
    :                              'noInjuryNoBlock';

  const order = PRIORITY_ORDERS[key];
  const sorted = [...contacts].sort((a, b) => {
    const ai = order.indexOf(a.category ?? '') === -1 ? 99 : order.indexOf(a.category ?? '');
    const bi = order.indexOf(b.category ?? '') === -1 ? 99 : order.indexOf(b.category ?? '');
    if (ai !== bi) return ai - bi;
    return (a.distance ?? 9999) - (b.distance ?? 9999);
  });

  // Stamp the reason on the top contact (same contract as backend)
  const reason = PRIORITY_REASONS[key];
  if (sorted.length > 0) {
    sorted[0] = { ...sorted[0], aiReason: reason };
  }

  return { contacts: sorted, reason, _offline: true };
}

// ─── Network triage with offline fallback ───────────────────────────────────
export async function triageContacts(injured, blocking, contacts) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000); // 8s hard timeout

    const res = await fetch(`${API_BASE}/triage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ injured, blocking, contacts }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`Triage HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    // Network offline, timeout, or server error — use client-side rules.
    // This is intentional and logged so developers can see it in the console.
    console.info('[RoadSOS] Triage offline fallback activated:', err.message);
    return ruleBasedTriage(injured, blocking, contacts);
  }
}
