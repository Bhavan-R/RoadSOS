/**
 * Tests for the route prefetch utility.
 *
 * We focus on the pieces that don't require a live network:
 * - CITY_PRESETS shape (each entry has lat, lon, name, code).
 * - The linear-interpolation fallback geometry.
 * - prefetchRoute completes and reports progress even when every
 *   downstream search fails (offline simulation).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prefetchRoute } from '../routeCache';
import { QUICK_PICK_CITIES } from '../geocode';

// Mock the live `/search` and OSRM calls so the test is hermetic.
vi.mock('../overpass', () => ({
  searchNearby: vi.fn(),
}));
vi.mock('../offlineDB', () => ({
  saveSearchResult: vi.fn(),
}));

import { searchNearby } from '../overpass';
import { saveSearchResult } from '../offlineDB';

describe('QUICK_PICK_CITIES', () => {
  it('has at least 6 cities with valid coords', () => {
    expect(QUICK_PICK_CITIES.length).toBeGreaterThanOrEqual(6);
    for (const c of QUICK_PICK_CITIES) {
      expect(c.name).toBeTruthy();
      expect(typeof c.lat).toBe('number');
      expect(typeof c.lon).toBe('number');
      // Roughly bounded to India
      expect(c.lat).toBeGreaterThan(0);
      expect(c.lat).toBeLessThan(40);
    }
  });

  it('Chennai and Bengaluru are present', () => {
    const names = QUICK_PICK_CITIES.map((c) => c.name);
    expect(names).toContain('Chennai');
    expect(names).toContain('Bengaluru');
  });
});

describe('prefetchRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Force the OSRM fetch to fail so we use linear-interpolation path —
    // hermetic test, no real HTTP.
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));
  });

  it('calls searchNearby once per waypoint and saves each result', async () => {
    searchNearby.mockResolvedValue({ contacts: [{ id: 'x' }], landmark: 'X' });

    const origin      = { lat: 13.0827, lon: 80.2707 }; // Chennai
    const destination = { lat: 12.9716, lon: 77.5946 }; // Bengaluru

    const result = await prefetchRoute(origin, destination, { waypoints: 4 });

    expect(searchNearby).toHaveBeenCalledTimes(4);
    expect(saveSearchResult).toHaveBeenCalledTimes(4);
    expect(result.cached).toBe(4);
    expect(result.total).toBe(4);
    expect(result.polylineSource).toBe('linear');
  });

  it('reports progress via onProgress callbacks', async () => {
    searchNearby.mockResolvedValue({ contacts: [] });

    const events = [];
    await prefetchRoute(
      { lat: 13.0827, lon: 80.2707 },
      { lat: 12.9716, lon: 77.5946 },
      {
        waypoints: 3,
        onProgress: (p) => events.push(p.status),
      }
    );

    // At minimum: 3 'waypoint_done' + 1 'complete'
    expect(events.filter((e) => e === 'waypoint_done').length).toBe(3);
    expect(events[events.length - 1]).toBe('complete');
  });

  it('does not abort when individual waypoint searches fail', async () => {
    // First 2 succeed, next 2 fail
    searchNearby
      .mockResolvedValueOnce({ contacts: [] })
      .mockResolvedValueOnce({ contacts: [] })
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'));

    const result = await prefetchRoute(
      { lat: 13.0827, lon: 80.2707 },
      { lat: 12.9716, lon: 77.5946 },
      { waypoints: 4 }
    );

    expect(result.total).toBe(4);
    expect(result.cached).toBe(2);
  });
});
