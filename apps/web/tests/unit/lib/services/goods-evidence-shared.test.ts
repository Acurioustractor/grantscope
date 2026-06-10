import { describe, it, expect } from 'vitest';
import {
  statusRank,
  isOverdue,
  surfaceFor,
  compareAreas,
  summarize,
  SURFACE_MAP,
  type QbeArea,
} from '@/lib/services/goods-evidence-shared';

function area(overrides: Partial<QbeArea> = {}): QbeArea {
  return {
    number: 1,
    area: '01 - Vision & Ambition',
    diagnosticStatus: 'Strength',
    buildStatus: 'Built - needs review',
    priority: 'P1',
    timing: 'Ongoing',
    due: '2026-06-07',
    owner: 'Ben/Nic',
    primaryGap: 'A gap.',
    nextBuild: 'A build.',
    publicCopyRisk: 'A risk.',
    notionUrl: 'https://app.notion.com/p/x',
    ...overrides,
  };
}

describe('statusRank', () => {
  it('ranks Priority gap > Partial > unset > Strength', () => {
    expect(statusRank('Priority gap')).toBeGreaterThan(statusRank('Partial'));
    expect(statusRank('Partial')).toBeGreaterThan(statusRank(null));
    expect(statusRank(null)).toBeGreaterThan(statusRank('Strength'));
  });
});

describe('isOverdue', () => {
  const now = new Date('2026-06-10T00:00:00Z');

  it('is true when due is strictly before now', () => {
    expect(isOverdue('2026-06-07', now)).toBe(true);
  });

  it('is false when due is today', () => {
    expect(isOverdue('2026-06-10', now)).toBe(false);
  });

  it('is false when due is in the future', () => {
    expect(isOverdue('2026-06-14', now)).toBe(false);
  });

  it('is false for null or malformed dates', () => {
    expect(isOverdue(null, now)).toBe(false);
    expect(isOverdue(undefined, now)).toBe(false);
    expect(isOverdue('not-a-date', now)).toBe(false);
  });
});

describe('surfaceFor / SURFACE_MAP', () => {
  it('maps the live-evidence areas', () => {
    expect(surfaceFor(2)).toEqual({ href: '/proof', label: 'Proof Pack' });
    expect(surfaceFor(4)?.href).toBe('/money');
    expect(surfaceFor(7)?.href).toBe('/governance');
    expect(surfaceFor(9)?.href).toBe('/governance');
    expect(surfaceFor(10)?.href).toBe('/campaign');
    expect(surfaceFor(11)?.label).toBe('Cost band on Proof Pack');
    expect(surfaceFor(12)?.href).toBe('/campaign');
  });

  it('returns null for unmapped areas', () => {
    expect(surfaceFor(1)).toBeNull();
    expect(surfaceFor(3)).toBeNull();
    expect(surfaceFor(99)).toBeNull();
  });

  it('maps exactly seven areas', () => {
    expect(Object.values(SURFACE_MAP).filter(Boolean)).toHaveLength(7);
  });
});

describe('compareAreas', () => {
  it('orders by status rank first, then number', () => {
    const strength = area({ number: 1, diagnosticStatus: 'Strength' });
    const gap = area({ number: 5, diagnosticStatus: 'Priority gap' });
    const partial = area({ number: 3, diagnosticStatus: 'Partial' });
    const sorted = [strength, gap, partial].slice().sort(compareAreas);
    expect(sorted.map((a) => a.number)).toEqual([5, 3, 1]);
  });

  it('breaks status ties by number ascending', () => {
    const a = area({ number: 9, diagnosticStatus: 'Priority gap' });
    const b = area({ number: 2, diagnosticStatus: 'Priority gap' });
    const sorted = [a, b].slice().sort(compareAreas);
    expect(sorted.map((x) => x.number)).toEqual([2, 9]);
  });
});

describe('summarize', () => {
  const now = new Date('2026-06-10T00:00:00Z');

  it('rolls up counts and earliest due date', () => {
    const areas = [
      area({ number: 1, priority: 'P0', diagnosticStatus: 'Priority gap', due: '2026-06-07' }),
      area({ number: 2, priority: 'P0', diagnosticStatus: 'Partial', due: '2026-06-21' }),
      area({ number: 3, priority: 'P1', diagnosticStatus: 'Strength', due: '2026-06-14' }),
    ];
    const s = summarize(areas, now);
    expect(s.total).toBe(3);
    expect(s.p0Count).toBe(2);
    expect(s.priorityGaps).toBe(1);
    expect(s.overdueCount).toBe(1);
    expect(s.nextDue).toBe('2026-06-07');
  });

  it('handles an empty list', () => {
    const s = summarize([], now);
    expect(s).toEqual({ total: 0, p0Count: 0, priorityGaps: 0, overdueCount: 0, nextDue: null });
  });
});
