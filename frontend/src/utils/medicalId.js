/**
 * Local-only Emergency Medical ID.
 *
 * Stores blood type, allergies, conditions, current medications, an
 * emergency contact, and organ-donor preference so a first responder
 * arriving at a crash scene can glance at the victim's phone and have
 * the critical info to start treatment.
 *
 * Design principles:
 * - 100% client-side: data lives in localStorage. Never sent to the
 *   server. No PII leaves the device. (Privacy is a real concern with
 *   medical info — we don't compromise on it.)
 * - Lockscreen-friendly format: the display modal is high-contrast,
 *   no auth required to view (matches Apple Health Medical ID).
 * - Survives uninstall? No — that's a trade-off we accept for privacy.
 */

const STORAGE_KEY = 'roadsos_medical_id_v1';

/** Schema: every field is optional so partial completion is fine. */
const EMPTY = {
  name: '',
  age: '',
  bloodType: '',          // O+, A-, etc.
  allergies: '',          // free text
  conditions: '',         // free text — diabetes, asthma, etc.
  medications: '',        // free text
  primaryContactName: '',
  primaryContactPhone: '',
  secondaryContactName: '',
  secondaryContactPhone: '',
  tertiaryContactName: '',
  tertiaryContactPhone: '',
  organDonor: false,
};

/**
 * Returns the list of configured emergency contacts (1–3) as
 * [{ name, phone }] with empties filtered out.
 */
export function getEmergencyContacts() {
  const m = getMedicalId();
  return [
    { name: m.primaryContactName,   phone: m.primaryContactPhone   },
    { name: m.secondaryContactName,  phone: m.secondaryContactPhone  },
    { name: m.tertiaryContactName,   phone: m.tertiaryContactPhone   },
  ].filter(c => c.phone && c.phone.trim().length > 0);
}

export function getMedicalId() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY };
  }
}

export function saveMedicalId(data) {
  try {
    // Only persist known fields — defends against accidental injection.
    const clean = {};
    for (const k of Object.keys(EMPTY)) {
      if (k in data) clean[k] = data[k];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    return true;
  } catch {
    return false;
  }
}

export function clearMedicalId() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

/** True if the user filled out at least one meaningful field. */
export function hasMedicalId() {
  const m = getMedicalId();
  return !!(
    m.name || m.bloodType || m.allergies || m.conditions
    || m.medications || m.primaryContactPhone
  );
}

/**
 * Compose an SMS body for SOS-by-SMS, using the Medical ID + coordinates.
 *
 * @param {object} args
 * @param {number} args.lat
 * @param {number} args.lon
 * @param {string} args.plusCode
 * @param {string} [args.landmark]
 * @returns {string}
 */
export function buildSosSmsBody({ lat, lon, plusCode, landmark }) {
  const m = getMedicalId();
  const lines = [];
  lines.push('🚨 EMERGENCY — I need help.');
  if (m.name) lines.push(`Name: ${m.name}${m.age ? `, age ${m.age}` : ''}`);
  if (m.bloodType) lines.push(`Blood: ${m.bloodType}`);
  if (m.allergies) lines.push(`Allergies: ${m.allergies}`);
  if (m.conditions) lines.push(`Conditions: ${m.conditions}`);
  lines.push('');
  if (plusCode)  lines.push(`Plus Code: ${plusCode}`);
  if (landmark)  lines.push(`Near: ${landmark}`);
  lines.push(`Coords: ${lat.toFixed(5)}, ${lon.toFixed(5)}`);
  lines.push(`Map: https://maps.google.com/?q=${lat.toFixed(6)},${lon.toFixed(6)}`);
  lines.push('');
  lines.push('Sent automatically by RoadSOS.');
  return lines.join('\n');
}

/**
 * Compose an `sms:` URL the browser/OS will open in the native SMS app.
 * On iOS we use `&body=`, on Android `?body=`. Modern browsers handle
 * both — we use `?body=` which is more portable.
 */
export function buildSosSmsHref(phone, body) {
  // sms:+91XXX?body=encoded
  const clean = (phone || '').replace(/[^\d+]/g, '');
  return `sms:${clean}?body=${encodeURIComponent(body)}`;
}
