/**
 * Shared SOS dispatch logic.
 *
 * Used by SOSButton (manual tap), CrashAlert (auto-fire on call),
 * and App.jsx (auto-fire after triage submission).
 *
 * WhatsApp's wa.me API only opens ONE chat at a time.
 * Mobile browsers only allow ONE external-app redirect per user gesture.
 *
 * Strategy:
 *   - WA-dominant countries  → window.open(wa.me/contact1)   [doesn't navigate away]
 *   - SMS-dominant countries → window.location.href = group sms: URI [reaches all]
 *   Returns { channel, perContact, groupSmsHref } so callers can render follow-up links.
 */

import { getEmergencyContacts, buildSosSmsBody } from './medicalId';
import { encodePlusCode } from './plusCodes';

// ─── Country preference map ───────────────────────────────────────────────────
const WA_COUNTRIES = new Set([
  // South Asia
  'IN','PK','BD','LK','NP','BT',
  // Southeast Asia
  'ID','MY','SG','PH','MM','KH','LA','BN',
  // Latin America
  'BR','MX','AR','CO','VE','PE','CL','BO','PY','UY','EC','CR','PA',
  'GT','HN','SV','NI','DO','CU','PR',
  // Europe
  'DE','IT','ES','NL','FR','PT','BE','AT','CH','PL','RO','GR','HU',
  'CZ','SK','BG','HR','RS','SI','BA','MK','AL','LT','LV','EE','FI',
  'SE','NO','DK','IE','GB',
  // Middle East & North Africa
  'SA','AE','KW','QA','BH','OM','YE','JO','LB','IQ','SY','EG','LY',
  'TN','DZ','MA','MR','SD',
  // Africa
  'NG','ZA','KE','GH','ET','TZ','UG','RW','SN','CI','CM','AO','MZ',
  'ZM','ZW','BW','NA','MW',
  // Other
  'TR','IL','UA','RU',
]);

export function isWaCountry(code) {
  return WA_COUNTRIES.has((code || 'IN').toUpperCase());
}

function cleanPhone(raw) {
  return (raw || '').replace(/[^\d+]/g, '');
}

/**
 * Build all SOS URLs for the current location + contacts.
 * Returns null if no contacts or no location.
 *
 * @param {{ lat: number, lon: number }} location
 * @param {string} [landmark]
 * @returns {{ contacts, body, perContact, groupSmsHref } | null}
 */
export function buildSosLinks(location, landmark) {
  if (!location?.lat || !location?.lon) return null;
  const contacts = getEmergencyContacts();
  if (contacts.length === 0) return null;

  const plusCode = encodePlusCode(location.lat, location.lon);
  const body = buildSosSmsBody({ lat: location.lat, lon: location.lon, plusCode, landmark });

  const perContact = contacts.map(c => {
    const num = cleanPhone(c.phone).replace(/^\+/, '');
    return {
      name   : c.name || c.phone,
      waHref : `https://wa.me/${num}?text=${encodeURIComponent(body)}`,
      smsHref: `sms:${cleanPhone(c.phone)}?body=${encodeURIComponent(body)}`,
    };
  });

  const groupSmsHref = `sms:${contacts.map(c => cleanPhone(c.phone)).filter(Boolean).join(',')}?body=${encodeURIComponent(body)}`;

  return { contacts, body, perContact, groupSmsHref };
}

/**
 * Fire the preferred SOS channel for contact 1, based on country.
 *
 * WA countries  → window.open(wa.me)  (non-navigating, contact 1 only)
 * SMS countries → window.location.href = group sms (all contacts, navigating)
 *
 * @returns {'wa'|'sms'|null}  channel used, or null if no contacts/location
 */
export function autoFireSos(location, landmark, countryCode) {
  const links = buildSosLinks(location, landmark);
  if (!links) return null;

  if (isWaCountry(countryCode)) {
    window.open(links.perContact[0].waHref, '_blank');
    return 'wa';
  } else {
    window.location.href = links.groupSmsHref;
    return 'sms';
  }
}
