import { describe, expect, it } from 'vitest';
import {
  SMALL_COUNT_THRESHOLD,
  VISIBILITY_ORDER,
  assertRenderable,
  canRender,
  mostRestrictive,
  suppressSmallCount,
  withheldNote,
  type Surface,
  type Visibility,
} from './visibility';

const SURFACES: Surface[] = ['public', 'org', 'operator'];

describe('canRender — a screen may be stricter than its data, never looser', () => {
  it('never renders withheld data on any surface', () => {
    // The single most important assertion in this file. There is no surface, no session, no
    // admin flag that renders consent-governed content.
    for (const s of SURFACES) {
      expect(canRender('withheld', s)).toBe(false);
    }
  });

  it('renders public data everywhere', () => {
    for (const s of SURFACES) {
      expect(canRender('public', s)).toBe(true);
    }
  });

  it('never renders data above the surface clearance', () => {
    expect(canRender('org', 'public')).toBe(false);
    expect(canRender('operator', 'public')).toBe(false);
    expect(canRender('operator', 'org')).toBe(false);
  });

  it('renders data at or below the surface clearance', () => {
    expect(canRender('org', 'org')).toBe(true);
    expect(canRender('public', 'org')).toBe(true);
    expect(canRender('org', 'operator')).toBe(true);
    expect(canRender('operator', 'operator')).toBe(true);
  });

  it('is monotonic — nothing renders on a lower surface that is refused on a higher one', () => {
    // Guards against someone later "fixing" an ordering bug by special-casing a tier.
    const floors: Visibility[] = [...VISIBILITY_ORDER];
    for (const floor of floors) {
      const allowed = SURFACES.map((s) => canRender(floor, s));
      const firstTrue = allowed.indexOf(true);
      if (firstTrue === -1) continue;
      expect(allowed.slice(firstTrue).every(Boolean)).toBe(true);
    }
  });
});

describe('mostRestrictive — a page inherits the worst of what it reads', () => {
  it('returns public for an empty page', () => {
    expect(mostRestrictive([])).toBe('public');
  });

  it('is dragged down by a single restricted object', () => {
    // One incidental join is all it takes, which is exactly why pages compute this.
    expect(mostRestrictive(['public', 'public', 'withheld'])).toBe('withheld');
    expect(mostRestrictive(['public', 'org'])).toBe('org');
    expect(mostRestrictive(['public', 'operator', 'org'])).toBe('operator');
  });
});

describe('assertRenderable', () => {
  it('throws rather than returning empty', () => {
    // "Withheld" and "broken" must never look the same — the same rule the seams, wants and
    // baseline screens already follow for unmeasured vs zero.
    expect(() => assertRenderable('withheld', 'operator', 'stories')).toThrow(/refusing to render/);
    expect(() => assertRenderable('operator', 'public', 'unfiled counts')).toThrow(/never looser/);
  });

  it('is silent when the render is allowed', () => {
    expect(() => assertRenderable('public', 'public', 'a report')).not.toThrow();
  });
});

describe('withheldNote — absence is stated, never silent', () => {
  it('returns null when there is nothing to withhold', () => {
    expect(withheldNote('public', 'public', 'x')).toBeNull();
  });

  it('names consent, and denies that admin access is a consent basis', () => {
    const note = withheldNote('withheld', 'operator', 'Rows');
    expect(note).toMatch(/consent-governed/);
    expect(note).toMatch(/admin access is not a consent basis/);
  });

  it('explains a tier mismatch without invoking consent', () => {
    const note = withheldNote('operator', 'public', 'Unfiled counts');
    expect(note).toMatch(/operator-tier/);
    expect(note).not.toMatch(/consent/);
  });
});

describe('suppressSmallCount — a count of 1 in a small community is a name', () => {
  it('suppresses counts below the threshold', () => {
    expect(suppressSmallCount(1)).toEqual({ show: false, label: `<${SMALL_COUNT_THRESHOLD}` });
    expect(suppressSmallCount(4)).toEqual({ show: false, label: `<${SMALL_COUNT_THRESHOLD}` });
  });

  it('shows zero, because zero identifies nobody', () => {
    expect(suppressSmallCount(0)).toEqual({ show: true, label: '0' });
  });

  it('shows counts at or above the threshold', () => {
    expect(suppressSmallCount(5).show).toBe(true);
    expect(suppressSmallCount(1200).label).toBe('1200');
  });

  it('distinguishes null from zero', () => {
    expect(suppressSmallCount(null).show).toBe(false);
    expect(suppressSmallCount(null).label).toBe('—');
  });
});
