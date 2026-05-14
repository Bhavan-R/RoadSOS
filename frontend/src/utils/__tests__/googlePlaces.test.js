/**
 * Unit tests for client-side rule-based triage.
 *
 * The function mirrors the backend's `rule_based_triage()` exactly. These
 * tests pin the four crash scenarios so a future refactor cannot silently
 * change emergency-ordering behaviour.
 *
 * Run with `npm test` (vitest).
 */
import { describe, it, expect } from 'vitest';
import { ruleBasedTriage } from '../googlePlaces';

const sample = [
  { id: 'a', name: 'Apollo Hospital',    category: 'hospital',  distance: 1.0, phone: '108' },
  { id: 'b', name: 'CATS Ambulance',     category: 'ambulance', distance: 3.0, phone: '108' },
  { id: 'c', name: 'BTM Police',         category: 'police',    distance: 2.0, phone: '100' },
  { id: 'd', name: 'Rapid Towing',       category: 'towing',    distance: 5.0, phone: '9999' },
  { id: 'e', name: 'Sri Auto Repair',    category: 'repair',    distance: 0.5, phone: '8888' },
  { id: 'f', name: 'Modi Tyres',         category: 'tyre',      distance: 0.3, phone: '7777' },
];

const orderedCategories = (result) => result.contacts.map((c) => c.category);

describe('ruleBasedTriage', () => {
  it('injured + blocking road → ambulance leads, hospital second', () => {
    const r = ruleBasedTriage(true, true, sample);
    expect(orderedCategories(r).slice(0, 3)).toEqual(['ambulance', 'hospital', 'police']);
    expect(r.reason).toMatch(/Trauma care.*blocked road/i);
    expect(r._offline).toBe(true);
  });

  it('injured + not blocking → ambulance leads, hospital second, police third', () => {
    const r = ruleBasedTriage(true, false, sample);
    expect(orderedCategories(r).slice(0, 3)).toEqual(['ambulance', 'hospital', 'police']);
    expect(r.reason).toMatch(/Trauma care/i);
  });

  it('not injured + blocking → police and towing lead', () => {
    const r = ruleBasedTriage(false, true, sample);
    expect(orderedCategories(r).slice(0, 2)).toEqual(['police', 'towing']);
    expect(r.reason).toMatch(/blocking traffic/i);
  });

  it('not injured + not blocking → repair and tyre lead', () => {
    const r = ruleBasedTriage(false, false, sample);
    expect(orderedCategories(r).slice(0, 2)).toEqual(['repair', 'tyre']);
    expect(r.reason).toMatch(/No injuries/i);
  });

  it('stamps aiReason on the top contact', () => {
    const r = ruleBasedTriage(true, true, sample);
    expect(r.contacts[0].aiReason).toBe(r.reason);
    // Non-top cards should NOT carry the AI reason (matches backend behaviour)
    expect(r.contacts[1].aiReason).toBeUndefined();
  });

  it('breaks ties within a tier by ascending distance', () => {
    const sameCategory = [
      { id: '1', name: 'Far Hospital',   category: 'hospital', distance: 4.0 },
      { id: '2', name: 'Near Hospital',  category: 'hospital', distance: 0.8 },
      { id: '3', name: 'Mid Hospital',   category: 'hospital', distance: 2.1 },
    ];
    const r = ruleBasedTriage(true, false, sameCategory);
    expect(r.contacts.map((c) => c.id)).toEqual(['2', '3', '1']);
  });

  it('does not throw on empty list', () => {
    const r = ruleBasedTriage(true, true, []);
    expect(r.contacts).toEqual([]);
    expect(r._offline).toBe(true);
  });

  it('places unknown categories at the end', () => {
    const mixed = [
      { id: '1', name: 'Weird',     category: 'aquarium', distance: 0.1 },
      { id: '2', name: 'Ambulance', category: 'ambulance', distance: 5.0 },
    ];
    const r = ruleBasedTriage(true, true, mixed);
    expect(r.contacts[0].category).toBe('ambulance');
    expect(r.contacts[1].category).toBe('aquarium');
  });
});
