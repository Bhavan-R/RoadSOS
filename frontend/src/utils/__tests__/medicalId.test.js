/**
 * Tests for the local-only Medical ID store + SOS-by-SMS composer.
 *
 * We mock localStorage so the tests are hermetic and isolated.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Minimal in-memory localStorage shim
beforeEach(() => {
  const store = new Map();
  global.localStorage = {
    getItem: vi.fn((k) => (store.has(k) ? store.get(k) : null)),
    setItem: vi.fn((k, v) => { store.set(k, String(v)); }),
    removeItem: vi.fn((k) => { store.delete(k); }),
    clear: vi.fn(() => store.clear()),
  };
  vi.resetModules();
});

describe('getMedicalId / saveMedicalId', () => {
  it('returns empty defaults when nothing is saved', async () => {
    const { getMedicalId, hasMedicalId } = await import('../medicalId');
    const m = getMedicalId();
    expect(m.name).toBe('');
    expect(m.bloodType).toBe('');
    expect(m.organDonor).toBe(false);
    expect(hasMedicalId()).toBe(false);
  });

  it('round-trips a saved profile', async () => {
    const { saveMedicalId, getMedicalId, hasMedicalId } = await import('../medicalId');
    saveMedicalId({
      name: 'Priya Iyer',
      age: 28,
      bloodType: 'O+',
      allergies: 'penicillin',
      primaryContactPhone: '+919999999999',
      organDonor: true,
    });
    const m = getMedicalId();
    expect(m.name).toBe('Priya Iyer');
    expect(m.bloodType).toBe('O+');
    expect(m.allergies).toBe('penicillin');
    expect(m.organDonor).toBe(true);
    expect(hasMedicalId()).toBe(true);
  });

  it('drops unknown fields (defends against accidental injection)', async () => {
    const { saveMedicalId, getMedicalId } = await import('../medicalId');
    saveMedicalId({ name: 'Test', evilField: 'naughty', __proto__: 'x' });
    const m = getMedicalId();
    expect(m.name).toBe('Test');
    expect(m).not.toHaveProperty('evilField');
  });

  it('clearMedicalId wipes the profile', async () => {
    const { saveMedicalId, clearMedicalId, hasMedicalId } = await import('../medicalId');
    saveMedicalId({ name: 'Test', bloodType: 'B-' });
    expect(hasMedicalId()).toBe(true);
    clearMedicalId();
    expect(hasMedicalId()).toBe(false);
  });
});

describe('buildSosSmsBody', () => {
  it('includes plus code, coordinates, and a Google Maps link', async () => {
    const { saveMedicalId, buildSosSmsBody } = await import('../medicalId');
    saveMedicalId({ name: 'A', bloodType: 'A+' });
    const body = buildSosSmsBody({
      lat: 13.0827,
      lon: 80.2707,
      plusCode: '7J5CC9R6+VV',
      landmark: 'Anna Salai, Chennai',
    });
    expect(body).toMatch(/EMERGENCY/);
    expect(body).toMatch(/7J5CC9R6\+VV/);
    expect(body).toMatch(/Anna Salai, Chennai/);
    expect(body).toMatch(/13\.08270/);
    expect(body).toMatch(/maps\.google\.com/);
    expect(body).toMatch(/Blood: A\+/);
  });

  it('omits empty Medical ID fields gracefully', async () => {
    const { buildSosSmsBody } = await import('../medicalId');
    const body = buildSosSmsBody({ lat: 1, lon: 2, plusCode: '' });
    expect(body).toMatch(/EMERGENCY/);
    expect(body).not.toMatch(/Name:/);
    expect(body).not.toMatch(/Blood:/);
  });
});

describe('buildSosSmsHref', () => {
  it('builds a valid sms: URL with URL-encoded body', async () => {
    const { buildSosSmsHref } = await import('../medicalId');
    const href = buildSosSmsHref('+91 99999 99999', 'hello world');
    expect(href).toMatch(/^sms:\+919999999999\?body=hello%20world$/);
  });

  it('strips non-digit junk from the phone number', async () => {
    const { buildSosSmsHref } = await import('../medicalId');
    const href = buildSosSmsHref('(+91) 9-99-99 99999', 'x');
    expect(href).toMatch(/^sms:\+919999999999\?/);
  });
});
