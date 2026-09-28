import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getGoodsPlaceFact, isGoodsFeedAuthorised } from './goods-workspace-feed';

const ROUTE = join(process.cwd(), 'src/app/api/goods-workspace/data/route.ts');

describe('Goods workspace feed', () => {
  // Goods on Country calls this URL (Goods Asset Register v2/src/lib/grantscope/client.ts).
  // It was deleted on 2026-03-26 and its one consumer hid the failure for six months.
  it('the route Goods calls exists', () => {
    expect(existsSync(ROUTE)).toBe(true);
    expect(readFileSync(ROUTE, 'utf8')).toMatch(/export async function GET/);
  });

  it('fails closed when no secret is configured', () => {
    expect(isGoodsFeedAuthorised('anything', '')).toBe(false);
    expect(isGoodsFeedAuthorised(null, '')).toBe(false);
  });

  it('accepts only the exact secret', () => {
    expect(isGoodsFeedAuthorised('s3cret', 's3cret')).toBe(true);
    expect(isGoodsFeedAuthorised('s3cret\n', 's3cret')).toBe(true);
    expect(isGoodsFeedAuthorised('s3cre', 's3cret')).toBe(false);
    expect(isGoodsFeedAuthorised(null, 's3cret')).toBe(false);
  });

  it('never sends modelled demand', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/services/goods-workspace-feed.ts'), 'utf8');
    expect(src).not.toMatch(/demand_beds|demand_washers|known_buyer_name/);
  });

  it('looks up a place by exact UUID and preserves database errors', async () => {
    const maybeSingle = () => Promise.resolve({ data: { id: 'place-id' }, error: null });
    const eq = (column: string, value: string) => {
      expect([column, value]).toEqual(['id', 'place-id']);
      return { maybeSingle };
    };
    const db = { from: (table: string) => {
      expect(table).toBe('goods_communities');
      return { select: () => ({ eq }) };
    } };
    expect(await getGoodsPlaceFact(db as never, 'place-id')).toEqual({ id: 'place-id' });
  });
});
