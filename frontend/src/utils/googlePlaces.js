// Backend handles Google Places fallback automatically via /search.
// This wraps the /triage API endpoint.

const API_BASE = import.meta.env.VITE_API_URL || '';

export async function triageContacts(injured, blocking, contacts) {
  const res = await fetch(`${API_BASE}/triage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ injured, blocking, contacts }),
  });
  if (!res.ok) throw new Error(`Triage failed: ${res.status}`);
  return res.json();
}
