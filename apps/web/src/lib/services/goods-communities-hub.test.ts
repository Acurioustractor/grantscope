import { describe, expect, it } from 'vitest';
import { fetchGoodsCommunityRows } from './goods-communities-hub';

function pagedDb(rows: Array<{ id: string }>) {
  const ranges: Array<[number, number]> = [];
  const query: any = {
    select: () => query,
    order: () => query,
    in: () => query,
    eq: () => query,
    gt: () => query,
    range: async (from: number, to: number) => {
      ranges.push([from, to]);
      return { data: rows.slice(from, to + 1), error: null };
    },
  };
  return { db: { from: () => query }, ranges };
}

describe('fetchGoodsCommunityRows', () => {
  it('continues beyond the Supabase 1,000-row response cap', async () => {
    const source = Array.from({ length: 1546 }, (_, i) => ({ id: `community-${i}` }));
    const { db, ranges } = pagedDb(source);

    const rows = await fetchGoodsCommunityRows(db, { scope: 'all' });

    expect(rows).toHaveLength(1546);
    expect(ranges).toEqual([[0, 999], [1000, 1999]]);
    expect(new Set(rows.map(row => row.id)).size).toBe(1546);
  });
});
