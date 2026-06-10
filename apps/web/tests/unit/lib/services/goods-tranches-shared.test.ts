import { describe, it, expect } from 'vitest';
import {
  trancheAmount,
  isAllocated,
  rollupByFunder,
  rollupByTrack,
  allocationStats,
  tranchesTotal,
  trackLabel,
  type TrancheRow,
} from '@/lib/services/goods-tranches-shared';

function tranche(overrides: Partial<TrancheRow> = {}): TrancheRow {
  return {
    id: 'id-1',
    relationship_id: null,
    funder_name: 'Snow Foundation',
    xero_invoice_number: 'INV-0001',
    amount_aud: 1000,
    invoice_date: '2026-01-01',
    funding_track: 'grant',
    purpose: null,
    allocation: null,
    source: 'xero',
    notes: null,
    ...overrides,
  };
}

describe('trancheAmount', () => {
  it('coerces a numeric string to a number', () => {
    expect(trancheAmount('402929.79')).toBeCloseTo(402929.79, 2);
  });
  it('passes a number through', () => {
    expect(trancheAmount(1200)).toBe(1200);
  });
  it('defaults null, undefined and NaN to zero', () => {
    expect(trancheAmount(null)).toBe(0);
    expect(trancheAmount(undefined)).toBe(0);
    expect(trancheAmount('not a number')).toBe(0);
  });
});

describe('isAllocated', () => {
  it('treats null as unallocated', () => {
    expect(isAllocated(null)).toBe(false);
  });
  it('treats an empty object or array as unallocated (no placeholder gaming)', () => {
    expect(isAllocated({})).toBe(false);
    expect(isAllocated([])).toBe(false);
  });
  it('treats a populated object or array as allocated', () => {
    expect(isAllocated({ community: 'Yarrabah', beds: 4 })).toBe(true);
    expect(isAllocated([{ community: 'Yarrabah' }])).toBe(true);
  });
});

describe('rollupByFunder', () => {
  it('groups tranches by funder and sums totals', () => {
    const rows = [
      tranche({ id: 'a', funder_name: 'Snow', amount_aud: 100, invoice_date: '2026-01-01' }),
      tranche({ id: 'b', funder_name: 'Snow', amount_aud: 200, invoice_date: '2026-03-01' }),
      tranche({ id: 'c', funder_name: 'Centrecorp', amount_aud: 500, invoice_date: '2026-02-01' }),
    ];
    const out = rollupByFunder(rows);
    expect(out).toHaveLength(2);
    // sorted by total desc → Centrecorp (500) before Snow (300)
    expect(out[0].funderName).toBe('Centrecorp');
    expect(out[1].funderName).toBe('Snow');
    expect(out[1].count).toBe(2);
    expect(out[1].total).toBe(300);
  });

  it('captures the earliest and latest date span per funder', () => {
    const rows = [
      tranche({ id: 'a', funder_name: 'Snow', invoice_date: '2026-03-01' }),
      tranche({ id: 'b', funder_name: 'Snow', invoice_date: '2026-01-01' }),
      tranche({ id: 'c', funder_name: 'Snow', invoice_date: '2026-02-01' }),
    ];
    const [snow] = rollupByFunder(rows);
    expect(snow.earliestDate).toBe('2026-01-01');
    expect(snow.latestDate).toBe('2026-03-01');
  });

  it('keeps the first non-null relationship id for a funder', () => {
    const rows = [
      tranche({ id: 'a', funder_name: 'Snow', relationship_id: null }),
      tranche({ id: 'b', funder_name: 'Snow', relationship_id: 'rel-123' }),
    ];
    const [snow] = rollupByFunder(rows);
    expect(snow.relationshipId).toBe('rel-123');
  });

  it('returns an empty array for no rows', () => {
    expect(rollupByFunder([])).toEqual([]);
  });
});

describe('rollupByTrack', () => {
  it('keeps each funding track separate and sorts by total desc', () => {
    const rows = [
      tranche({ id: 'a', funding_track: 'grant', amount_aud: 577461.79 }),
      tranche({ id: 'b', funding_track: 'procurement', amount_aud: 73449 }),
      tranche({ id: 'c', funding_track: 'grant', amount_aud: 0 }),
    ];
    const out = rollupByTrack(rows);
    expect(out[0].track).toBe('grant');
    expect(out[0].count).toBe(2);
    expect(out[0].total).toBeCloseTo(577461.79, 2);
    expect(out[1].track).toBe('procurement');
    expect(out[1].total).toBe(73449);
  });
});

describe('allocationStats', () => {
  it('reports every NULL-allocation tranche as unallocated (the seeded state)', () => {
    const rows = Array.from({ length: 17 }, (_, i) => tranche({ id: `t${i}`, allocation: null }));
    expect(allocationStats(rows)).toEqual({ allocated: 0, unallocated: 17, total: 17 });
  });
  it('counts populated allocations as allocated', () => {
    const rows = [
      tranche({ id: 'a', allocation: { community: 'Yarrabah' } }),
      tranche({ id: 'b', allocation: null }),
      tranche({ id: 'c', allocation: {} }),
    ];
    expect(allocationStats(rows)).toEqual({ allocated: 1, unallocated: 2, total: 3 });
  });
});

describe('tranchesTotal', () => {
  it('sums the verified Xero paid figure exactly', () => {
    const rows = [
      tranche({ id: 'a', amount_aud: 577461.79 }),
      tranche({ id: 'b', amount_aud: 73449 }),
    ];
    expect(tranchesTotal(rows)).toBeCloseTo(650910.79, 2);
  });
});

describe('trackLabel', () => {
  it('labels known tracks and title-cases unknown ones', () => {
    expect(trackLabel('grant')).toBe('Grant');
    expect(trackLabel('procurement')).toBe('Procurement');
    expect(trackLabel('mystery')).toBe('Mystery');
  });
});
