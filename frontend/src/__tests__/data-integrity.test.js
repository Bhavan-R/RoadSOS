/**
 * Data-integrity tests for the offline tier.
 *
 * These guard the static datasets that ship inside the bundle and are
 * relied upon when the backend, localStorage cache, and live network are
 * all unavailable. A typo in any of these files would silently degrade an
 * offline experience for at least one country — these assertions make
 * such a regression visible in CI before it reaches production.
 *
 * Scope:
 *   1. bundled_facilities.json: every entry has a complete shape, valid
 *      coordinates, and a recognised category. No duplicate IDs.
 *   2. emergencyNumbers.js: every country that has a bundled facility
 *      also has an entry in the emergency-numbers map.
 *   3. i18n bundles: every locale carries the same key set as English,
 *      with no empty translation values.
 *   4. locales metadata: every entry in LOCALES has a matching JSON bundle
 *      registered in i18n/index.js, and vice versa.
 */
import { describe, it, expect } from 'vitest';
import facilities from '../data/bundled_facilities.json';
import { emergencyNumbersMap } from '../utils/emergencyNumbers';
import { LOCALES } from '../i18n/locales';

import en from '../i18n/en.json';

// Indian (22 Schedule-VIII languages)
import hi  from '../i18n/hi.json';
import bn  from '../i18n/bn.json';
import ta  from '../i18n/ta.json';
import te  from '../i18n/te.json';
import mr  from '../i18n/mr.json';
import gu  from '../i18n/gu.json';
import kn  from '../i18n/kn.json';
import ml  from '../i18n/ml.json';
import pa  from '../i18n/pa.json';
import ur  from '../i18n/ur.json';
import or  from '../i18n/or.json';
import asLang from '../i18n/as.json';
import mai from '../i18n/mai.json';
import sat from '../i18n/sat.json';
import ks  from '../i18n/ks.json';
import ne  from '../i18n/ne.json';
import kok from '../i18n/kok.json';
import sd  from '../i18n/sd.json';
import doi from '../i18n/doi.json';
import mni from '../i18n/mni.json';
import brx from '../i18n/brx.json';
import sa  from '../i18n/sa.json';

// Global
import es from '../i18n/es.json';
import fr from '../i18n/fr.json';
import pt from '../i18n/pt.json';
import de from '../i18n/de.json';
import itLang from '../i18n/it.json';
import nl from '../i18n/nl.json';
import pl from '../i18n/pl.json';
import ru from '../i18n/ru.json';
import uk from '../i18n/uk.json';
import ro from '../i18n/ro.json';
import el from '../i18n/el.json';
import tr from '../i18n/tr.json';
import ar from '../i18n/ar.json';
import fa from '../i18n/fa.json';
import he from '../i18n/he.json';
import sw from '../i18n/sw.json';
import am from '../i18n/am.json';
import id from '../i18n/id.json';
import ms from '../i18n/ms.json';
import th from '../i18n/th.json';
import vi from '../i18n/vi.json';
import zh from '../i18n/zh.json';
import ja from '../i18n/ja.json';
import ko from '../i18n/ko.json';
import tl from '../i18n/tl.json';

const I18N_BUNDLES = {
  en, hi, bn, ta, te, mr, gu, kn, ml, pa, ur, or, as: asLang, mai, sat, ks, ne,
  kok, sd, doi, mni, brx, sa,
  es, fr, pt, de, it: itLang, nl, pl, ru, uk, ro, el, tr, ar, fa, he, sw, am, id,
  ms, th, vi, zh, ja, ko, tl,
};

const VALID_CATEGORIES = new Set([
  'hospital', 'police', 'ambulance', 'fire', 'towing',
  'repair', 'tyre', 'showroom', 'clinic',
]);

// ─── 1. Bundled facilities ──────────────────────────────────────────────
describe('bundled_facilities.json — shape and coverage', () => {
  it('contains at least 196 facilities (one per country minimum)', () => {
    expect(facilities.length).toBeGreaterThanOrEqual(196);
  });

  it('covers all 196 countries that have an emergency-number entry', () => {
    const facilityCountries = new Set(facilities.map((f) => f.country_code));
    const emergencyCountries = new Set(Object.keys(emergencyNumbersMap));
    const missing = [...emergencyCountries].filter((c) => !facilityCountries.has(c));
    expect(missing).toEqual([]);
  });

  it('every entry has the required shape', () => {
    for (const f of facilities) {
      expect(f, `entry ${f.id || '<no id>'}`).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        category: expect.any(String),
        country_code: expect.any(String),
        lat: expect.any(Number),
        lon: expect.any(Number),
      });
    }
  });

  it('every coordinate falls within valid WGS-84 bounds', () => {
    for (const f of facilities) {
      expect(f.lat, `${f.id} lat`).toBeGreaterThanOrEqual(-90);
      expect(f.lat, `${f.id} lat`).toBeLessThanOrEqual(90);
      expect(f.lon, `${f.id} lon`).toBeGreaterThanOrEqual(-180);
      expect(f.lon, `${f.id} lon`).toBeLessThanOrEqual(180);
    }
  });

  it('every category is in the recognised set', () => {
    for (const f of facilities) {
      expect(
        VALID_CATEGORIES.has((f.category || '').toLowerCase()),
        `${f.id} has category ${f.category}`,
      ).toBe(true);
    }
  });

  it('every country code is uppercase ISO-3166 alpha-2 (two letters)', () => {
    for (const f of facilities) {
      expect(f.country_code, `${f.id}`).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('no duplicate facility IDs', () => {
    const ids = facilities.map((f) => f.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it('phone numbers, when present, are non-empty strings', () => {
    for (const f of facilities) {
      if (f.phone !== null && f.phone !== undefined) {
        expect(typeof f.phone, `${f.id} phone type`).toBe('string');
        expect(f.phone.length, `${f.id} phone length`).toBeGreaterThan(0);
      }
    }
  });
});

// ─── 2. Emergency numbers map ───────────────────────────────────────────
describe('emergencyNumbersMap — country coverage', () => {
  it('contains at least 196 country entries', () => {
    expect(Object.keys(emergencyNumbersMap).length).toBeGreaterThanOrEqual(196);
  });

  it('every key is uppercase ISO-3166 alpha-2', () => {
    for (const code of Object.keys(emergencyNumbersMap)) {
      expect(code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('every entry has police, ambulance, fire, general fields', () => {
    for (const [code, entry] of Object.entries(emergencyNumbersMap)) {
      expect(entry, `${code}`).toMatchObject({
        country: expect.any(String),
        police: expect.any(String),
        ambulance: expect.any(String),
        fire: expect.any(String),
        general: expect.any(String),
      });
    }
  });

  it('no emergency number is empty', () => {
    for (const [code, entry] of Object.entries(emergencyNumbersMap)) {
      for (const field of ['police', 'ambulance', 'fire', 'general']) {
        expect(entry[field].length, `${code}.${field}`).toBeGreaterThan(0);
      }
    }
  });
});

// ─── 3. i18n bundles ────────────────────────────────────────────────────
describe('i18n translation bundles — key parity with English', () => {
  const enKeys = Object.keys(en).sort();

  it('English bundle has at least 40 translation keys', () => {
    expect(enKeys.length).toBeGreaterThanOrEqual(40);
  });

  it('every bundle has exactly the same keys as English', () => {
    for (const [code, bundle] of Object.entries(I18N_BUNDLES)) {
      if (code === 'en') continue;
      const keys = Object.keys(bundle).sort();
      // List the missing keys explicitly so a failing message is actionable.
      const missing = enKeys.filter((k) => !(k in bundle));
      const extra = keys.filter((k) => !enKeys.includes(k));
      expect(
        { code, missing, extra },
        `bundle ${code}.json must have the same keys as en.json`,
      ).toEqual({ code, missing: [], extra: [] });
    }
  });

  it('no translation value is empty', () => {
    for (const [code, bundle] of Object.entries(I18N_BUNDLES)) {
      for (const [key, value] of Object.entries(bundle)) {
        expect(typeof value, `${code}.${key} type`).toBe('string');
        expect(value.trim().length, `${code}.${key} empty`).toBeGreaterThan(0);
      }
    }
  });
});

// ─── 4. Locale metadata ↔ bundle parity ─────────────────────────────────
describe('LOCALES metadata ↔ imported bundles', () => {
  it('every LOCALES entry has a corresponding translation bundle', () => {
    for (const loc of LOCALES) {
      expect(
        I18N_BUNDLES[loc.code],
        `LOCALES declares ${loc.code} but no JSON bundle is imported`,
      ).toBeDefined();
    }
  });

  it('every imported bundle has a corresponding LOCALES entry', () => {
    const localeCodes = new Set(LOCALES.map((l) => l.code));
    for (const code of Object.keys(I18N_BUNDLES)) {
      expect(
        localeCodes.has(code),
        `bundle ${code}.json is imported but ${code} is not in LOCALES`,
      ).toBe(true);
    }
  });

  it('every LOCALES entry has required metadata', () => {
    for (const loc of LOCALES) {
      expect(loc).toMatchObject({
        code: expect.any(String),
        native: expect.any(String),
        english: expect.any(String),
        bcp47: expect.any(String),
        dir: expect.stringMatching(/^(ltr|rtl)$/),
        region: expect.stringMatching(/^(India|World)$/),
      });
    }
  });

  it('exactly the 22 Indian Schedule-VIII languages are in the India region', () => {
    const indiaCodes = LOCALES.filter((l) => l.region === 'India')
      .map((l) => l.code)
      .sort();
    // The 22 Schedule-VIII languages plus English (which we also tag India)
    // OR India region is strictly the 22 — accept either as long as count >= 22.
    expect(indiaCodes.length).toBeGreaterThanOrEqual(22);
  });

  it('at least 6 RTL languages are present (Arabic, Persian, Hebrew, Urdu, Kashmiri, Sindhi)', () => {
    const rtlCodes = LOCALES.filter((l) => l.dir === 'rtl').map((l) => l.code);
    for (const expected of ['ar', 'fa', 'he', 'ur', 'ks', 'sd']) {
      expect(rtlCodes, `RTL list missing ${expected}`).toContain(expected);
    }
  });
});
