import { describe, expect, it } from 'vitest';
import { rankFunders } from './goods-funder-scan';

describe('rankFunders', () => {
  it('ranks on grade, then real AIS giving, then fit', () => {
    const rows = [
      { name: 'fit only', evidenceGrade: 'B' as const, givingAnnual: null, fitScore: 99 },
      { name: 'gives', evidenceGrade: 'B' as const, givingAnnual: 2_000_000, fitScore: 40 },
      { name: 'grade A', evidenceGrade: 'A' as const, givingAnnual: 10_000, fitScore: 10 },
    ];
    expect(rows.sort(rankFunders).map((r) => r.name)).toEqual(['grade A', 'gives', 'fit only']);
  });
});
