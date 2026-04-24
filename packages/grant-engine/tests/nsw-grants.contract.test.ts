import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { createNSWGrantsPlugin } from '../src/sources/nsw-grants';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetchWithHits(hits: Array<Record<string, unknown>>) {
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => ({
      hits: {
        total: { value: hits.length },
        hits: hits.map((_source) => ({ _source })),
      },
    }),
  })) as typeof fetch;
}

async function collectTitles(status: 'open' | 'all') {
  const plugin = createNSWGrantsPlugin();
  const grants = [];

  for await (const grant of plugin.discover({ status })) {
    grants.push(grant);
  }

  return grants;
}

test('nsw-grants excludes past-deadline grants when open grants are requested', async () => {
  mockFetchWithHits([
    {
      title: 'Past Grant',
      url: '/grants-and-funding/past-grant',
      field_summary: 'Closed grant round',
      grant_dates_end: '2025-01-10',
      agency_name: 'Create NSW',
    },
    {
      title: 'Future Grant',
      url: '/grants-and-funding/future-grant',
      field_summary: 'Current open grant round',
      grant_dates_end: '2026-12-10',
      agency_name: 'Create NSW',
    },
    {
      title: 'Rolling Grant',
      url: '/grants-and-funding/rolling-grant',
      field_summary: 'Rolling program',
      grant_is_ongoing: true,
      agency_name: 'Create NSW',
    },
  ]);

  const grants = await collectTitles('open');
  assert.deepEqual(
    grants.map((grant) => grant.title),
    ['Future Grant', 'Rolling Grant'],
  );
  assert.equal(grants[0]?.applicationStatus, 'open');
  assert.equal(grants[1]?.applicationStatus, 'ongoing');
  assert.equal(grants[1]?.deadline, undefined);
});

test('nsw-grants still exposes closed rounds when all grants are requested', async () => {
  mockFetchWithHits([
    {
      title: 'Past Grant',
      url: '/grants-and-funding/past-grant',
      field_summary: 'Closed grant round',
      grant_dates_end: '2025-01-10',
      agency_name: 'Create NSW',
    },
    {
      title: 'Future Grant',
      url: '/grants-and-funding/future-grant',
      field_summary: 'Current open grant round',
      grant_dates_end: '2026-12-10',
      agency_name: 'Create NSW',
    },
  ]);

  const grants = await collectTitles('all');
  assert.equal(grants.length, 2);

  const pastGrant = grants.find((grant) => grant.title === 'Past Grant');
  const futureGrant = grants.find((grant) => grant.title === 'Future Grant');

  assert.equal(pastGrant?.applicationStatus, 'closed');
  assert.equal(futureGrant?.applicationStatus, 'open');
});
