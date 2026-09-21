/**
 * Tests for the shared LLM evidence rule.
 * Run: node --test scripts/lib/llm-evidence.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quote, hasPageEvidence } from './llm-evidence.mjs';

test('a quote must read as a sentence, not a restatement of the value', () => {
  assert.equal(quote('2026-06-30'), null);
  assert.equal(quote('June'), null);
  assert.equal(quote('   '), null);
  assert.equal(quote(null), null);
  assert.equal(quote('Applications close on 30 June 2026.'), 'Applications close on 30 June 2026.');
});

test('a quote is trimmed and capped', () => {
  assert.equal(quote('  Applications close on 30 June 2026.  '), 'Applications close on 30 June 2026.');
  assert.equal(quote('x'.repeat(900)).length, 500);
});

test('a row needs both a quote and the page it came from', () => {
  const evidence = 'Jane Doe has chaired the board since 2019.';
  assert.equal(hasPageEvidence({ evidence_text: evidence, source_url: 'https://example.org/board' }), true);
  assert.equal(hasPageEvidence({ evidence_text: evidence, source_url: '' }), false);
  assert.equal(hasPageEvidence({ evidence_text: 'Chair', source_url: 'https://example.org/board' }), false);
  assert.equal(hasPageEvidence({}), false);
  assert.equal(hasPageEvidence(null), false);
});
