import { describe, expect, it } from 'vitest';
import {
  OVERCROWDING_AUSTRALIA,
  OVERCROWDING_BY_REMOTENESS,
  getOvercrowdingForRemoteness,
  overcrowdedPct,
  overcrowdingRateRatio,
} from './overcrowding-signal';

describe('OVERCROWDING_BY_REMOTENESS', () => {
  const entries = Object.entries(OVERCROWDING_BY_REMOTENESS);

  it('keys every entry by the remoteness string the database uses', () => {
    // These must match gs_entities.remoteness exactly or the lookup silently
    // returns nothing and the panel quietly loses its most important figure.
    for (const [key, signal] of entries) {
      expect(signal.remoteness).toBe(key);
      expect(key.endsWith('Australia'), `${key} is not an ABS remoteness label`).toBe(true);
    }
  });

  it('never reports more overcrowded households than total households', () => {
    for (const [key, signal] of entries) {
      expect(signal.firstNationsOvercrowded, key).toBeLessThan(signal.firstNationsTotal);
      expect(signal.otherOvercrowded, key).toBeLessThan(signal.otherTotal);
      expect(signal.firstNationsSevere, key).toBeLessThanOrEqual(signal.firstNationsOvercrowded);
    }
  });

  it('sums to the national figure', () => {
    // The five remoteness classes should account for the Australia row. A
    // transcription slip in any one of them shows up here.
    const summed = entries.reduce((total, [, s]) => total + s.firstNationsOvercrowded, 0);
    expect(Math.abs(summed - OVERCROWDING_AUSTRALIA.firstNationsOvercrowded)).toBeLessThan(200);
  });

  it('gets worse as places get more remote', () => {
    const order = [
      'Major Cities of Australia',
      'Inner Regional Australia',
      'Outer Regional Australia',
      'Remote Australia',
      'Very Remote Australia',
    ];
    const rates = order.map(key => overcrowdedPct(OVERCROWDING_BY_REMOTENESS[key], 'firstNations'));
    for (let i = 1; i < rates.length; i += 1) {
      expect(rates[i], `${order[i]} is not worse than ${order[i - 1]}`).toBeGreaterThan(rates[i - 1]);
    }
  });

  it('reports very remote First Nations overcrowding at 31.3% and 11.6 times the other rate', () => {
    const veryRemote = OVERCROWDING_BY_REMOTENESS['Very Remote Australia'];
    expect(overcrowdedPct(veryRemote, 'firstNations')).toBe(31.3);
    expect(overcrowdedPct(veryRemote, 'other')).toBe(2.7);
    expect(overcrowdingRateRatio(veryRemote)).toBe(11.6);
  });

  it('returns nothing for an unknown or missing remoteness', () => {
    expect(getOvercrowdingForRemoteness(null)).toBeNull();
    expect(getOvercrowdingForRemoteness('Remote')).toBeNull();
    expect(getOvercrowdingForRemoteness('Very Remote Australia')?.label).toBe('Very remote');
  });
});
