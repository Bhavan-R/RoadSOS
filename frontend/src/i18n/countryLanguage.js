// ISO-3166 country → preferred i18n language code.
// Used by the language picker to pre-select a sensible default based on
// the user's GPS-derived country code. The user can always override it.
//
// Mapping rules:
//   - National / most-spoken language wins.
//   - Where a country has multiple co-official languages, we pick the
//     widest-reaching one (e.g. CH → de, BE → nl, CA → en).
//   - English is the fallback when we don't ship the local language.

export const COUNTRY_LANGUAGE = {
  // ── INDIA ────────────────────────────────────────────────────────────────
  IN: 'hi',

  // ── EUROPE ───────────────────────────────────────────────────────────────
  GB: 'en', IE: 'en', MT: 'en', CY: 'el',
  FR: 'fr', MC: 'fr', LU: 'fr',
  DE: 'de', AT: 'de', CH: 'de', LI: 'de',
  IT: 'it', SM: 'it', VA: 'it',
  ES: 'es', AD: 'es',
  PT: 'pt',
  NL: 'nl', BE: 'nl',
  GR: 'el',
  PL: 'pl', CZ: 'pl', SK: 'pl', HU: 'pl',  // closest Slavic/regional fit; fallback en otherwise
  HR: 'pl', SI: 'pl', BA: 'pl', ME: 'pl', RS: 'ru', MK: 'pl', AL: 'pl', XK: 'pl',
  RO: 'ro', MD: 'ro', BG: 'ru',
  RU: 'ru', BY: 'ru', UA: 'uk',
  SE: 'en', NO: 'en', DK: 'en', FI: 'en', IS: 'en', EE: 'ru', LV: 'ru', LT: 'pl',

  // ── MIDDLE EAST / NORTH AFRICA ───────────────────────────────────────────
  SA: 'ar', AE: 'ar', QA: 'ar', BH: 'ar', KW: 'ar', OM: 'ar', YE: 'ar',
  IQ: 'ar', SY: 'ar', JO: 'ar', LB: 'ar', PS: 'ar', EG: 'ar',
  LY: 'ar', TN: 'ar', DZ: 'ar', MA: 'ar', SD: 'ar', MR: 'ar', DJ: 'ar',
  KM: 'ar', SO: 'sw',
  IL: 'he',
  IR: 'fa', AF: 'fa', TJ: 'fa',
  TR: 'tr',

  // ── CENTRAL ASIA / CAUCASUS ──────────────────────────────────────────────
  KZ: 'ru', UZ: 'ru', TM: 'ru', KG: 'ru', AM: 'ru', AZ: 'tr', GE: 'ru', MN: 'ru',

  // ── SOUTH ASIA ───────────────────────────────────────────────────────────
  PK: 'ur', BD: 'bn', LK: 'ta', NP: 'ne', BT: 'ne', MV: 'en',

  // ── EAST ASIA ────────────────────────────────────────────────────────────
  CN: 'zh', TW: 'zh', HK: 'zh',
  JP: 'ja',
  KR: 'ko', KP: 'ko',

  // ── SOUTHEAST ASIA ───────────────────────────────────────────────────────
  ID: 'id', MY: 'ms', SG: 'en', BN: 'ms',
  TH: 'th', LA: 'th', KH: 'th',
  VN: 'vi', MM: 'en', PH: 'tl', TL: 'pt',

  // ── AFRICA ───────────────────────────────────────────────────────────────
  // Anglophone
  NG: 'en', GH: 'en', KE: 'sw', UG: 'sw', TZ: 'sw', RW: 'sw', BI: 'sw',
  ZW: 'en', ZM: 'en', MW: 'en', BW: 'en', SZ: 'en', LS: 'en', NA: 'en',
  ZA: 'en', SS: 'en', SC: 'en', MU: 'en', LR: 'en', SL: 'en', GM: 'en',
  ET: 'am', ER: 'am',
  // Francophone
  CI: 'fr', SN: 'fr', ML: 'fr', BF: 'fr', NE: 'fr', GN: 'fr', BJ: 'fr',
  TG: 'fr', CM: 'fr', CG: 'fr', CD: 'fr', GA: 'fr', CF: 'fr', TD: 'fr',
  MG: 'fr',
  // Lusophone
  AO: 'pt', MZ: 'pt', GW: 'pt', CV: 'pt', ST: 'pt', GQ: 'es',

  // ── NORTH AMERICA ────────────────────────────────────────────────────────
  US: 'en', CA: 'en', MX: 'es',

  // ── LATIN AMERICA & CARIBBEAN ────────────────────────────────────────────
  BR: 'pt',
  AR: 'es', CL: 'es', CO: 'es', PE: 'es', VE: 'es', EC: 'es', BO: 'es',
  PY: 'es', UY: 'es', GT: 'es', HN: 'es', NI: 'es', PA: 'es', SV: 'es',
  CR: 'es', CU: 'es', DO: 'es', PR: 'es',
  HT: 'fr', JM: 'en', BS: 'en', BB: 'en', TT: 'en', GY: 'en', SR: 'nl',
  BZ: 'en', AG: 'en', DM: 'en', GD: 'en', KN: 'en', LC: 'en', VC: 'en',

  // ── OCEANIA ──────────────────────────────────────────────────────────────
  AU: 'en', NZ: 'en', FJ: 'en', PG: 'en', SB: 'en', VU: 'fr', WS: 'en',
  TO: 'en', KI: 'en', TV: 'en', NR: 'en', FM: 'en', MH: 'en', PW: 'en',
};

export function languageForCountry(countryCode) {
  if (!countryCode) return null;
  return COUNTRY_LANGUAGE[countryCode.toUpperCase()] || null;
}
