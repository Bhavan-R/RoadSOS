/**
 * Tests for the free-text geocoder that backs the trip planner.
 *
 * We mock fetch + localStorage so the test is hermetic — no real
 * Nominatim hit, no state bleed between tests.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => {
  const store = new Map();
  global.localStorage = {
    getItem: vi.fn((k) => (store.has(k) ? store.get(k) : null)),
    setItem: vi.fn((k, v) => { store.set(k, String(v)); }),
    removeItem: vi.fn((k) => { store.delete(k); }),
    clear: vi.fn(() => store.clear()),
  };
  global.fetch = vi.fn();
  vi.resetModules();
});

describe('geocodePlace', () => {
  it('returns null for empty queries but accepts 1-char prefixes', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ lat: '1', lon: '2', display_name: 'Test' }],
    });
    const { geocodePlace } = await import('../geocode');
    expect(await geocodePlace('')).toBeNull();
    expect(await geocodePlace('   ')).toBeNull();
    // 1-char queries DO hit the network so autocomplete feels responsive
    // from the first keystroke (Google-Maps style).
    expect(await geocodePlace('g')).not.toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns lat/lon/displayName for a successful lookup', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{
        lat: '13.0827',
        lon: '80.2707',
        display_name: 'Chennai, Tamil Nadu, India',
      }],
    });
    const { geocodePlace } = await import('../geocode');
    const out = await geocodePlace('Chennai');
    expect(out).toEqual({
      lat: 13.0827,
      lon: 80.2707,
      displayName: 'Chennai, Tamil Nadu, India',
    });
  });

  it('caches results so a second lookup does not hit the network', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ lat: '12.9716', lon: '77.5946', display_name: 'Bengaluru' }],
    });
    const { geocodePlace } = await import('../geocode');
    const a = await geocodePlace('Bengaluru');
    const b = await geocodePlace('Bengaluru');
    expect(a).toEqual(b);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('cache lookup is case-insensitive', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ lat: '19.07', lon: '72.87', display_name: 'Mumbai' }],
    });
    const { geocodePlace } = await import('../geocode');
    await geocodePlace('Mumbai');
    await geocodePlace('mumbai');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns null on empty Nominatim response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });
    const { geocodePlace } = await import('../geocode');
    expect(await geocodePlace('NotARealPlaceXYZ123')).toBeNull();
  });

  it('returns null on network failure', async () => {
    global.fetch.mockRejectedValueOnce(new Error('offline'));
    const { geocodePlace } = await import('../geocode');
    expect(await geocodePlace('Pune')).toBeNull();
  });

  it('returns null when Nominatim returns non-OK status', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, json: async () => [] });
    const { geocodePlace } = await import('../geocode');
    expect(await geocodePlace('Pune')).toBeNull();
  });
});

describe('searchPlaces (autocomplete)', () => {
  it('returns the list of candidates when Nominatim has multiple hits', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { lat: '26.18', lon: '91.74', display_name: 'Junai, Assam, India' },
        { lat: '13.65', lon: '-88.78', display_name: 'Junai, San Vicente, El Salvador' },
        { lat: '-15.5', lon: '-67.0',  display_name: 'Junai, Payeska, Bolivia' },
      ],
    });
    const { searchPlaces } = await import('../geocode');
    const out = await searchPlaces('Junai');
    expect(out).toHaveLength(3);
    // shortName is the first comma-separated segment
    expect(out[0].shortName).toBe('Junai');
    // Context is the remainder of display_name
    expect(out[0].context).toBe('Assam, India');
    expect(out[1].context).toBe('San Vicente, El Salvador');
    expect(out.every((r) => isFinite(r.lat) && isFinite(r.lon))).toBe(true);
  });

  it('returns [] for an empty query but accepts 1-char prefixes', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { lat: '12.0', lon: '77.0', display_name: 'Goa, India' },
      ],
    });
    const { searchPlaces } = await import('../geocode');
    expect(await searchPlaces('')).toEqual([]);
    expect(await searchPlaces('   ')).toEqual([]);
    const oneChar = await searchPlaces('g');
    expect(oneChar.length).toBeGreaterThan(0);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('caches suggestion lists per-query', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { lat: '13.08', lon: '80.27', display_name: 'Chennai, India' },
      ],
    });
    const { searchPlaces } = await import('../geocode');
    const a = await searchPlaces('Chennai');
    const b = await searchPlaces('Chennai');
    expect(a).toEqual(b);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns [] on network failure', async () => {
    global.fetch.mockRejectedValueOnce(new Error('offline'));
    const { searchPlaces } = await import('../geocode');
    expect(await searchPlaces('Pune')).toEqual([]);
  });
});

describe('QUICK_PICK_CITIES', () => {
  it('has at least 6 entries with valid coords', async () => {
    const { QUICK_PICK_CITIES } = await import('../geocode');
    expect(QUICK_PICK_CITIES.length).toBeGreaterThanOrEqual(6);
    for (const c of QUICK_PICK_CITIES) {
      expect(c.name).toBeTruthy();
      expect(typeof c.lat).toBe('number');
      expect(typeof c.lon).toBe('number');
    }
  });
});
