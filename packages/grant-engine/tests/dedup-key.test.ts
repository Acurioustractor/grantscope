import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canonicalizeProvider, generateDedupKey } from '../src/normalizer';
import { deduplicateGrants } from '../src/deduplicator';
import type { CanonicalGrant } from '../src/types';

test('canonicalizeProvider collapses state abbreviations and gov boilerplate', () => {
  const a = canonicalizeProvider('QLD Government');
  const b = canonicalizeProvider('Queensland Government');
  assert.equal(a, b, '"QLD Government" and "Queensland Government" should canonicalize equal');

  const c = canonicalizeProvider('Department of Health');
  const d = canonicalizeProvider('Health Department Pty Ltd');
  assert.equal(c, d, 'department boilerplate + legal suffix should normalize away');
});

test('generateDedupKey merges the same grant across provider aliases', () => {
  const k1 = generateDedupKey('QLD Government', 'Community Arts Fund');
  const k2 = generateDedupKey('Queensland Government', 'Community Arts Fund');
  assert.equal(k1, k2);
});

test('generateDedupKey does NOT merge distinct year rounds', () => {
  const k2023 = generateDedupKey('Creative Victoria', '2023 Community Grant');
  const k2024 = generateDedupKey('Creative Victoria', '2024 Community Grant');
  assert.notEqual(k2023, k2024, 'different funding-year rounds must remain distinct');
});

test('generateDedupKey normalizes ampersands and punctuation in titles', () => {
  const k1 = generateDedupKey('Arts NSW', 'Arts & Culture Program');
  const k2 = generateDedupKey('Arts NSW', 'Arts and Culture Program!');
  assert.equal(k1, k2);
});

function grant(partial: Partial<CanonicalGrant> & { provider: string; name: string }): CanonicalGrant {
  return {
    name: partial.name,
    provider: partial.provider,
    program: null,
    amountMin: null,
    amountMax: null,
    currency: 'AUD',
    closesAt: null,
    url: null,
    description: null,
    categories: [],
    geography: ['AU'],
    applicationStatus: null,
    sources: [{ pluginId: 'x', foundAt: '2026-01-01T00:00:00Z', confidence: 'scraped' }],
    discoveryMethod: 'x',
    dedupKey: generateDedupKey(partial.provider, partial.name),
    ...partial,
  };
}

test('deduplicateGrants collapses alias-provider duplicates and merges data', () => {
  const grants = [
    grant({ provider: 'QLD Government', name: 'Community Arts Fund', url: null, description: 'short' }),
    grant({
      provider: 'Queensland Government',
      name: 'Community Arts Fund',
      url: 'https://example.gov.au/caf',
      description: 'a much longer and more complete description of the fund',
      sources: [{ pluginId: 'grantconnect', foundAt: '2026-01-02T00:00:00Z', confidence: 'verified' }],
    }),
  ];
  const deduped = deduplicateGrants(grants);
  assert.equal(deduped.length, 1, 'the two alias records should merge into one');
  assert.equal(deduped[0].url, 'https://example.gov.au/caf', 'merge keeps the record with a URL');
  assert.equal(deduped[0].sources.length, 2, 'merge unions the source list');
});
