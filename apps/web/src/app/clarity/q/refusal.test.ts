import { describe, expect, it } from 'vitest';
import { isRefusedCard, stampLabel } from '../board-types';

describe('isRefusedCard', () => {
  it('refuses on either the form or the state', () => {
    expect(isRefusedCard({ form: 'refused', state: 'refused' })).toBe(true);
    expect(isRefusedCard({ form: 'scalar', state: 'refused' })).toBe(true);
    expect(isRefusedCard({ form: 'refused', state: 'draft' })).toBe(true);
  });

  it('leaves every answerable card alone', () => {
    expect(isRefusedCard({ form: 'scalar', state: 'answered' })).toBe(false);
    // Contested is NOT refused. A contested card still renders its number, struck through with
    // the defect named — collapsing the two would hide 45.3× measure_kind inflation behind a
    // blank page instead of showing it.
    expect(isRefusedCard({ form: 'stacked_three', state: 'contested' })).toBe(false);
    expect(isRefusedCard({ form: 'scalar', state: 'unanswerable' })).toBe(false);
  });
});

describe('stampLabel', () => {
  it('stamps only the two states that need one', () => {
    expect(stampLabel({ verification_stamp: 'unverified' })).toBe('UNVERIFIED');
    expect(stampLabel({ verification_stamp: 'pilot' })).toBe('PILOT');
  });

  it('does not stamp the normal case', () => {
    expect(stampLabel({ verification_stamp: 'verified' })).toBeNull();
    expect(stampLabel({ verification_stamp: null })).toBeNull();
  });
});
