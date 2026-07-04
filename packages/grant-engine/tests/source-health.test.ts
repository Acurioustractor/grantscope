import assert from 'node:assert/strict';
import { test } from 'node:test';

import { classifySourceHealth, unhealthySources } from '../src/source-health';

const NOW = Date.parse('2026-07-04T00:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

test('a source whose latest run found 0 after previously yielding is "zeroed"', () => {
  const health = classifySourceHealth(
    [
      { source: 'vic-grants', startedAt: daysAgo(2), itemsFound: 40 },
      { source: 'vic-grants', startedAt: hoursAgo(2), itemsFound: 0 },
    ],
    { now: NOW },
  );
  assert.equal(health[0].source, 'vic-grants');
  assert.equal(health[0].status, 'zeroed');
});

test('a source yielding grants in its latest run is "healthy"', () => {
  const health = classifySourceHealth([{ source: 'qld-grants', startedAt: hoursAgo(1), itemsFound: 120 }], { now: NOW });
  assert.equal(health[0].status, 'healthy');
  assert.equal(health[0].latestYield, 120);
});

test('a source with no recent run is "stale"', () => {
  const health = classifySourceHealth([{ source: 'nt-grants', startedAt: daysAgo(9), itemsFound: 5 }], {
    now: NOW,
    staleDays: 3,
  });
  assert.equal(health[0].status, 'stale');
});

test('a failed latest run is "failing" regardless of yield', () => {
  const health = classifySourceHealth(
    [{ source: 'sa-grants', startedAt: hoursAgo(1), itemsFound: 0, status: 'failed' }],
    { now: NOW },
  );
  assert.equal(health[0].status, 'failing');
});

test('results are ordered most-concerning first and unhealthy filter works', () => {
  const health = classifySourceHealth(
    [
      { source: 'healthy-src', startedAt: hoursAgo(1), itemsFound: 10 },
      { source: 'zeroed-src', startedAt: daysAgo(1), itemsFound: 3 },
      { source: 'zeroed-src', startedAt: hoursAgo(1), itemsFound: 0 },
      { source: 'failing-src', startedAt: hoursAgo(1), itemsFound: 0, status: 'failed' },
    ],
    { now: NOW },
  );
  assert.deepEqual(health.map((h) => h.status), ['failing', 'zeroed', 'healthy']);
  assert.equal(unhealthySources(health).length, 2);
});
