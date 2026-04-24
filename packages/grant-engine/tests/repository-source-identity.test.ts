import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mergeGrantSources, resolveCanonicalSourceIdentity } from '../src/storage/repository';

test('preserves an existing canonical source id over a new discovery method', () => {
  assert.deepEqual(
    resolveCanonicalSourceIdentity('qld-grants', 'web-search'),
    { sourceId: 'qld-grants', discoveryMethod: 'qld-grants' },
  );
});

test('adopts the incoming discovery method when no source id exists yet', () => {
  assert.deepEqual(
    resolveCanonicalSourceIdentity(null, 'web-search'),
    { sourceId: 'web-search', discoveryMethod: 'web-search' },
  );
});

test('ignores duplicate shadow ids when choosing the canonical source key', () => {
  assert.deepEqual(
    resolveCanonicalSourceIdentity('qld-grants::duplicate::abc', 'qld-grants'),
    { sourceId: 'qld-grants', discoveryMethod: 'qld-grants' },
  );
});

test('merges existing and incoming grant sources without losing provenance', () => {
  const merged = mergeGrantSources(
    [{ pluginId: 'web-search', foundAt: '2026-04-24T00:00:00.000Z', rawUrl: 'https://example.com/a', confidence: 'verified' }],
    [{ pluginId: 'qld-grants', foundAt: '2026-04-24T01:00:00.000Z', rawUrl: 'https://example.com/b', confidence: 'scraped' }],
  );

  assert.deepEqual(
    merged,
    [
      { pluginId: 'web-search', foundAt: '2026-04-24T00:00:00.000Z', rawUrl: 'https://example.com/a', confidence: 'verified' },
      { pluginId: 'qld-grants', foundAt: '2026-04-24T01:00:00.000Z', rawUrl: 'https://example.com/b', confidence: 'scraped' },
    ],
  );
});

test('prefers stronger and newer provenance when the same plugin is seen again', () => {
  const merged = mergeGrantSources(
    [{ pluginId: 'web-search', foundAt: '2026-04-24T00:00:00.000Z', rawUrl: 'https://example.com/a', confidence: 'llm_knowledge' }],
    [{ pluginId: 'web-search', foundAt: '2026-04-24T02:00:00.000Z', rawUrl: 'https://example.com/b', confidence: 'verified' }],
  );

  assert.deepEqual(
    merged,
    [
      { pluginId: 'web-search', foundAt: '2026-04-24T02:00:00.000Z', rawUrl: 'https://example.com/a', confidence: 'verified' },
    ],
  );
});

test('parses existing JSON string sources before merging', () => {
  const merged = mergeGrantSources(
    '[{"pluginId":"web-search","foundAt":"2026-04-24T00:00:00.000Z","rawUrl":"https://example.com/a","confidence":"verified"}]',
    [{ pluginId: 'qld-grants', foundAt: '2026-04-24T03:00:00.000Z', rawUrl: 'https://example.com/b', confidence: 'verified' }],
  );

  assert.deepEqual(
    merged,
    [
      { pluginId: 'web-search', foundAt: '2026-04-24T00:00:00.000Z', rawUrl: 'https://example.com/a', confidence: 'verified' },
      { pluginId: 'qld-grants', foundAt: '2026-04-24T03:00:00.000Z', rawUrl: 'https://example.com/b', confidence: 'verified' },
    ],
  );
});
