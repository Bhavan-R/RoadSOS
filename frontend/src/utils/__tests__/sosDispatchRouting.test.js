// @vitest-environment jsdom
/**
 * Tests for country-aware SOS dispatch routing.
 *
 * The dispatch layer routes a SOS tap to the dominant messaging channel
 * per country: WhatsApp deep link in WA-dominant nations, native SMS
 * group-send elsewhere. Getting this wrong wastes the user's one chance
 * at notifying their emergency contact at a crash scene — so it's worth
 * locking in with tests.
 *
 * Scope:
 *   1. isWaCountry() returns the right channel for representative
 *      countries across every region.
 *   2. buildSosLinks() composes well-formed wa.me + sms: URLs with
 *      encoded coordinates and plus codes.
 *   3. autoFireSos() picks the right channel and invokes the right
 *      browser side effect for each country class.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isWaCountry, buildSosLinks, autoFireSos } from '../sosDispatch';

// ─── Mock the medical-ID storage so we can control the contact list ──────
vi.mock('../medicalId', () => ({
  getEmergencyContacts: vi.fn(() => [
    { name: 'Mom', phone: '+91 98765 43210' },
    { name: 'Dad', phone: '+91 98765 11111' },
  ]),
  buildSosSmsBody: vi.fn(({ lat, lon, landmark }) =>
    `EMERGENCY ${lat},${lon} ${landmark || ''}`),
}));

const LOCATION = { lat: 12.9716, lon: 77.5946 };

beforeEach(() => {
  // Stub window.open + window.location to spy on dispatch side effects
  vi.spyOn(window, 'open').mockImplementation(() => null);
  // window.location.href is read-only; replace the whole object with a stub
  const originalLocation = window.location;
  delete window.location;
  window.location = { href: '' };
  // Stash so we can restore in afterEach
  window.__originalLocation = originalLocation;
});

afterEach(() => {
  window.location = window.__originalLocation;
  delete window.__originalLocation;
  vi.restoreAllMocks();
});

// ─── 1. Country classification ──────────────────────────────────────────
describe('isWaCountry — channel selection per country', () => {
  it('classifies WhatsApp-dominant countries correctly', () => {
    // South Asia, LatAm, MENA, parts of Europe, parts of Africa
    const waCodes = ['IN', 'PK', 'BD', 'BR', 'MX', 'AR', 'ES', 'IT', 'NG', 'KE', 'SA', 'AE'];
    for (const code of waCodes) {
      expect(isWaCountry(code), `${code} should be WA-dominant`).toBe(true);
    }
  });

  it('classifies SMS-dominant countries correctly', () => {
    // Anglo + Nordic + East Asia + Australasia
    const smsCodes = ['US', 'CA', 'AU', 'NZ', 'JP', 'KR', 'CN'];
    for (const code of smsCodes) {
      expect(isWaCountry(code), `${code} should be SMS-dominant`).toBe(false);
    }
  });

  it('handles missing or empty country code gracefully', () => {
    // Default fallback is IN (covers GPS-not-yet-known case in India)
    expect(isWaCountry(null)).toBe(true);
    expect(isWaCountry(undefined)).toBe(true);
    expect(isWaCountry('')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isWaCountry('in')).toBe(true);
    expect(isWaCountry('Us')).toBe(false);
  });
});

// ─── 2. URL building ────────────────────────────────────────────────────
describe('buildSosLinks — URL composition', () => {
  it('returns null when location is missing', () => {
    expect(buildSosLinks(null)).toBeNull();
    expect(buildSosLinks({})).toBeNull();
    expect(buildSosLinks({ lat: 0 })).toBeNull();
  });

  it('builds one wa.me URL and one sms: URL per contact', () => {
    const links = buildSosLinks(LOCATION, 'Bannerghatta Road, BLR');
    expect(links).not.toBeNull();
    expect(links.perContact).toHaveLength(2);

    for (const c of links.perContact) {
      expect(c.waHref).toMatch(/^https:\/\/wa\.me\/91/);
      expect(c.waHref).toContain('text=');
      expect(c.smsHref).toMatch(/^sms:/);
      expect(c.smsHref).toContain('body=');
    }
  });

  it('groupSmsHref includes every contact phone, comma-separated', () => {
    const links = buildSosLinks(LOCATION);
    // Both numbers in the mock should appear in the recipients field
    const recipients = links.groupSmsHref.replace('sms:', '').split('?')[0];
    const numbers = recipients.split(',');
    expect(numbers).toHaveLength(2);
    expect(numbers.every((n) => n.startsWith('+91') || /^\+?\d/.test(n))).toBe(true);
  });

  it('URL-encodes the SOS body so coordinates survive in the query string', () => {
    const links = buildSosLinks(LOCATION, 'Six Mile, Dispur');
    const decoded = decodeURIComponent(links.perContact[0].smsHref.split('body=')[1]);
    expect(decoded).toContain('12.9716');
    expect(decoded).toContain('77.5946');
  });
});

// ─── 3. autoFireSos — side-effect routing ───────────────────────────────
describe('autoFireSos — country-driven side effects', () => {
  it('opens wa.me in a new tab for WA-dominant countries', () => {
    const channel = autoFireSos(LOCATION, 'Bengaluru', 'IN');
    expect(channel).toBe('wa');
    expect(window.open).toHaveBeenCalledTimes(1);
    const [url, target] = window.open.mock.calls[0];
    expect(url).toMatch(/^https:\/\/wa\.me\//);
    expect(target).toBe('_blank');
    // Importantly: location.href must NOT have been touched (no navigation)
    expect(window.location.href).toBe('');
  });

  it('navigates to group-sms: URI for SMS-dominant countries', () => {
    const channel = autoFireSos(LOCATION, 'New York', 'US');
    expect(channel).toBe('sms');
    expect(window.location.href).toMatch(/^sms:/);
    expect(window.location.href).toContain(',');  // multiple recipients
    expect(window.open).not.toHaveBeenCalled();
  });

  it('returns null when location is missing (no side effects)', () => {
    const channel = autoFireSos(null, '', 'IN');
    expect(channel).toBeNull();
    expect(window.open).not.toHaveBeenCalled();
    expect(window.location.href).toBe('');
  });
});
