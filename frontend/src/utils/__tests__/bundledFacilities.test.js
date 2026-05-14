/**
 * Tests for the bundled facility directory.
 *
 * Goals:
 * - Spatial search returns the closest facilities first.
 * - maxKm cutoff is honoured.
 * - Empty / out-of-range inputs degrade safely.
 * - The bundle has reasonable coverage (≥ 25 entries, no duplicate ids).
 */
import { describe, it, expect } from 'vitest';
import facilities from '../../data/bundled_facilities.json';
import {
  findNearestFromBundle,
  buildBundledSearchResult,
  BUNDLED_FACILITY_COUNT,
} from '../bundledFacilities';

describe('bundled facilities — data integrity', () => {
  it('has at least 25 verified entries', () => {
    expect(BUNDLED_FACILITY_COUNT).toBeGreaterThanOrEqual(25);
  });

  it('all entries have non-empty id, name, lat, lon, category', () => {
    for (const f of facilities) {
      expect(f.id).toBeTruthy();
      expect(f.name).toBeTruthy();
      expect(typeof f.lat).toBe('number');
      expect(typeof f.lon).toBe('number');
      expect(['hospital', 'police', 'ambulance', 'towing', 'repair']).toContain(f.category);
    }
  });

  it('all ids are unique', () => {
    const ids = facilities.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('findNearestFromBundle', () => {
  it('returns Chennai trauma centres when searching near Chennai', () => {
    // Anna Salai, Chennai ≈ 13.06, 80.26
    const results = findNearestFromBundle(13.0612, 80.2438, { maxKm: 30, limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    // The Greams Road Apollo entry should be < 1 km from those coords.
    const apollo = results.find((r) => r.id === 'bf-apollo-greams-chennai');
    expect(apollo).toBeDefined();
    expect(apollo.distance).toBeLessThan(1);
  });

  it('sorts results by ascending distance', () => {
    const results = findNearestFromBundle(13.0612, 80.2438, { maxKm: 80, limit: 8 });
    for (let i = 1; i < results.length; i++) {
      expect(results[i].distance).toBeGreaterThanOrEqual(results[i - 1].distance);
    }
  });

  it('respects the maxKm cutoff', () => {
    // Tight 5 km radius from Chennai should yield only Chennai-area entries.
    const results = findNearestFromBundle(13.0612, 80.2438, { maxKm: 5 });
    for (const r of results) {
      expect(r.distance).toBeLessThanOrEqual(5);
    }
  });

  it('respects the limit cap', () => {
    const results = findNearestFromBundle(13.0827, 80.2707, { maxKm: 2000, limit: 3 });
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('returns empty array for non-numeric coordinates', () => {
    expect(findNearestFromBundle(null, null)).toEqual([]);
    expect(findNearestFromBundle(undefined, 80.0)).toEqual([]);
  });

  it('stamps source = "Bundled directory" on every result', () => {
    const results = findNearestFromBundle(13.0612, 80.2438, { limit: 3 });
    for (const r of results) {
      expect(r.source).toBe('Bundled directory');
    }
  });
});

describe('buildBundledSearchResult', () => {
  it('returns null when no facility is within range', () => {
    // Middle of the Pacific Ocean
    const result = buildBundledSearchResult(0, -150, { maxKm: 80 });
    expect(result).toBeNull();
  });

  it('returns a /search-shaped response when facilities are nearby', () => {
    const result = buildBundledSearchResult(13.0612, 80.2438, { maxKm: 30 });
    expect(result).not.toBeNull();
    expect(result.contacts.length).toBeGreaterThan(0);
    expect(result.source).toBe('Pre-loaded directory (offline)');
    expect(result.count).toBe(result.contacts.length);
    expect(result.country_code).toBe('IN');
  });
});
