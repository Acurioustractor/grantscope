import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { ckanDatastoreAll, ckanDatastoreSearch } from '../src/sources/lib/ckan';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/**
 * Mock a CKAN datastore_search endpoint backed by `total` synthetic records,
 * honouring the limit/offset query params like a real portal.
 */
function mockDatastore(total: number, opts: { calls?: string[] } = {}) {
  globalThis.fetch = (async (url: string) => {
    opts.calls?.push(url);
    const u = new URL(url);
    const limit = Number(u.searchParams.get('limit'));
    const offset = Number(u.searchParams.get('offset'));
    const records = [];
    for (let i = offset; i < Math.min(offset + limit, total); i++) {
      records.push({ _id: i, name: `grant-${i}` });
    }
    return { ok: true, json: async () => ({ success: true, result: { total, records } }) };
  }) as unknown as typeof fetch;
}

test('paginates through a resource larger than one page (no truncation)', async () => {
  const calls: string[] = [];
  mockDatastore(2300, { calls });
  const all = await ckanDatastoreAll('https://x/api/3/action', 'res', { pageSize: 1000 });
  assert.equal(all.length, 2300, 'should collect every record across pages');
  assert.equal(calls.length, 3, 'should make 3 paged requests for 2300 rows at pageSize 1000');
  assert.deepEqual([all[0], all[2299]].map((r: any) => r._id), [0, 2299]);
});

test('single short page stops immediately', async () => {
  const calls: string[] = [];
  mockDatastore(12, { calls });
  const all = await ckanDatastoreAll('https://x/api/3/action', 'res', { pageSize: 1000 });
  assert.equal(all.length, 12);
  assert.equal(calls.length, 1, 'a page shorter than the limit ends pagination');
});

test('empty resource yields nothing', async () => {
  mockDatastore(0);
  const all = await ckanDatastoreAll('https://x/api/3/action', 'res');
  assert.equal(all.length, 0);
});

test('maxRecords cap is honoured and does not over-fetch', async () => {
  const calls: string[] = [];
  mockDatastore(5000, { calls });
  const all = await ckanDatastoreAll('https://x/api/3/action', 'res', { pageSize: 1000, maxRecords: 1500 });
  assert.equal(all.length, 1500, 'should stop at maxRecords');
});

test('retries a failing request then succeeds', async () => {
  let attempts = 0;
  globalThis.fetch = (async () => {
    attempts++;
    if (attempts < 2) throw new Error('network blip');
    return { ok: true, json: async () => ({ success: true, result: { total: 1, records: [{ _id: 0 }] } }) };
  }) as unknown as typeof fetch;

  const out = [];
  for await (const r of ckanDatastoreSearch('https://x/api/3/action', 'res', { retries: 2 })) out.push(r);
  assert.equal(out.length, 1);
  assert.equal(attempts, 2, 'should have retried once');
});
