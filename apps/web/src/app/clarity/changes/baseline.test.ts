import { describe, expect, it } from 'vitest';
import { BASELINES, BASELINE_LABEL, parseBaseline } from './types';

describe('the baseline selector', () => {
  it('falls back to the last run rather than rejecting a bad parameter', () => {
    expect(parseBaseline(undefined)).toBe('last');
    expect(parseBaseline('')).toBe('last');
    expect(parseBaseline('60d')).toBe('last');
    expect(parseBaseline('<script>')).toBe('last');
  });

  it('accepts exactly the four baselines the delta table stores', () => {
    for (const b of BASELINES) expect(parseBaseline(b)).toBe(b);
    // The CHECK constraint on clarity_delta.baseline is the same four. If this
    // list ever grows, that constraint has to grow with it in the same migration.
    expect([...BASELINES]).toEqual(['last', '7d', '30d', '90d']);
  });

  it('labels every baseline in plain words', () => {
    for (const b of BASELINES) {
      expect(BASELINE_LABEL[b]).toBeTruthy();
      expect(BASELINE_LABEL[b]).not.toMatch(/baseline|window|delta/i);
    }
  });
});
