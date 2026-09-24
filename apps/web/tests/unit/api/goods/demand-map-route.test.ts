import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/services/goods-demand-map', () => ({
  getGoodsDemandMap: vi.fn(async () => ({ household: [], custodial: [], community: [], places: [] })),
}));

const call = async (secret?: string) => {
  const { GET } = await import('@/app/api/goods/demand-map/route');
  const headers = secret ? { 'x-grantscope-secret': secret } : undefined;
  return GET(new Request('http://x/api/goods/demand-map', { headers }) as never);
};

describe('/api/goods/demand-map', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('refuses everyone when no secret is configured', async () => {
    vi.stubEnv('GOODS_GRANTSCOPE_SYNC_SECRET', '');
    expect((await call('anything')).status).toBe(401);
  });

  it('refuses a wrong secret and serves the right one', async () => {
    vi.stubEnv('GOODS_GRANTSCOPE_SYNC_SECRET', 's3cret\n');
    expect((await call('nope')).status).toBe(401);
    const ok = await call('s3cret');
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ places: [] });
  });
});
