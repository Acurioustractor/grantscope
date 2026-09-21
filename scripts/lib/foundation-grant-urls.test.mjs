/**
 * Tests for foundation programme URL assignment.
 * Run: node --test scripts/lib/foundation-grant-urls.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignProgramUrls, programSlug, stripFragment } from './foundation-grant-urls.mjs';

test('a programme with its own distinct URL keeps it, unaltered', () => {
  const got = assignProgramUrls([
    { id: 1, name: 'Community Fund', baseUrl: 'https://example.org/community-fund' },
    { id: 2, name: 'Arts Fund', baseUrl: 'https://example.org/arts-fund' },
  ]);
  assert.deepEqual(got.get(1), { url: 'https://example.org/community-fund', synthetic: false });
  assert.deepEqual(got.get(2), { url: 'https://example.org/arts-fund', synthetic: false });
});

test('programmes sharing one page are still told apart by an anchor', () => {
  // This is what the anchor is actually for: a unique index on url.
  const got = assignProgramUrls([
    { id: 1, name: 'Community Fund', baseUrl: 'https://example.org/grants' },
    { id: 2, name: 'Arts Fund', baseUrl: 'https://example.org/grants' },
  ]);
  assert.deepEqual(got.get(1), { url: 'https://example.org/grants#community-fund', synthetic: true });
  assert.deepEqual(got.get(2), { url: 'https://example.org/grants#arts-fund', synthetic: true });
});

test('an incoming fragment is never trusted — we decide the fragment', () => {
  const got = assignProgramUrls([
    { id: 1, name: 'Community Fund', baseUrl: 'https://example.org/grants#stale-anchor' },
  ]);
  assert.deepEqual(got.get(1), { url: 'https://example.org/grants', synthetic: false });
});

test('a URL already owned by a different row is disambiguated', () => {
  const owner = new Map([['https://example.org/grants', 'other-source-id']]);
  const got = assignProgramUrls(
    [{ id: 1, name: 'Community Fund', baseUrl: 'https://example.org/grants' }],
    owner,
  );
  assert.deepEqual(got.get(1), { url: 'https://example.org/grants#community-fund', synthetic: true });
});

test('a URL this very programme already owns is kept bare', () => {
  const owner = new Map([['https://example.org/grants', 1]]);
  const got = assignProgramUrls(
    [{ id: 1, name: 'Community Fund', baseUrl: 'https://example.org/grants' }],
    owner,
  );
  assert.deepEqual(got.get(1), { url: 'https://example.org/grants', synthetic: false });
});

test('no URL at all stays null', () => {
  const got = assignProgramUrls([{ id: 1, name: 'Community Fund', baseUrl: null }]);
  assert.deepEqual(got.get(1), { url: null, synthetic: false });
});

test('slugs and fragment stripping behave', () => {
  assert.equal(programSlug('Arts & Culture Fund (2026)'), 'arts-culture-fund-2026');
  assert.equal(programSlug(''), 'program');
  assert.equal(stripFragment('https://x.org/a#b'), 'https://x.org/a');
  assert.equal(stripFragment(null), null);
});

test('two identically named programmes on one page do not collide', () => {
  const got = assignProgramUrls([
    { id: 1, name: 'Annual Grants', baseUrl: 'https://example.org/grants' },
    { id: 2, name: 'Annual Grants', baseUrl: 'https://example.org/grants' },
  ]);
  assert.equal(got.get(1).url, 'https://example.org/grants#annual-grants');
  assert.equal(got.get(2).url, 'https://example.org/grants#annual-grants-2');
  assert.notEqual(got.get(1).url, got.get(2).url);
});
