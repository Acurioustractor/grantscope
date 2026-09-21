/**
 * Tests for grant amount plausibility.
 * Run: node --test scripts/lib/grant-amounts.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGrantAmount, hasPlausibleAmount, MIN_PLAUSIBLE_GRANT } from './grant-amounts.mjs';

test('a fractional amount is rounded, not rejected for being fractional', () => {
  assert.equal(normalizeGrantAmount(50000.4), 50000);
  assert.equal(normalizeGrantAmount('25000'), 25000);
});

test('the real junk values from the 2026-09-21 sync all become null', () => {
  for (const junk of [0.5, 9.3, 20, 30, 50, 55, 75, 88]) {
    assert.equal(normalizeGrantAmount(junk), null, `${junk} should not be a grant amount`);
  }
});

test('real micro-grants survive the floor', () => {
  assert.equal(normalizeGrantAmount(100), 100);
  assert.equal(normalizeGrantAmount(250), 250);
  assert.equal(normalizeGrantAmount(500), 500);
  assert.equal(MIN_PLAUSIBLE_GRANT, 100);
});

test('non-numbers are null, never NaN', () => {
  for (const bad of [null, undefined, '', 'varies', NaN, Infinity]) {
    assert.equal(normalizeGrantAmount(bad), null);
  }
});

test('a programme is only amount-backed when one of its amounts is plausible', () => {
  assert.equal(hasPlausibleAmount({ amount_max: 20 }), false);
  assert.equal(hasPlausibleAmount({ amount_min: null, amount_max: null }), false);
  assert.equal(hasPlausibleAmount({ amount_min: 5000 }), true);
  assert.equal(hasPlausibleAmount({ amount_min: 20, amount_max: 50000 }), true);
  assert.equal(hasPlausibleAmount(null), false);
});
