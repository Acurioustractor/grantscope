/**
 * Tests for the eligibility confidence floor.
 * Run: node --test scripts/lib/grant-eligibility-verdict.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEligibilityUpdate, ELIGIBILITY_CONFIDENCE_FLOOR } from './grant-eligibility-verdict.mjs';

const NOW = '2026-09-21T00:00:00.000Z';
const SURE = {
  dgr_required: false, accepts_charity: true, accepts_pty_ltd: false,
  accepts_sole_trader: null, accepts_unincorporated: true,
  eligible_summary: 'Applications are open to incorporated not-for-profits.',
  confidence: 0.95,
};

test('a confident verdict writes its flags and its evidence', () => {
  const { update, accepted, suppressed } = buildEligibilityUpdate(SURE, 'gemini', NOW);
  assert.equal(accepted, true);
  assert.equal(suppressed, 0);
  assert.equal(update.accepts_charity, true);
  assert.equal(update.dgr_required, false);
  assert.equal(update.accepts_sole_trader, null);
  assert.equal(update.eligibility_confidence, 0.95);
  assert.equal(update.eligibility_provider, 'gemini');
  assert.equal(update.eligibility_summary, 'Applications are open to incorporated not-for-profits.');
});

test('an unsure verdict writes no flags at all', () => {
  // The case that matters: a low-confidence dgr_required=true used to remove a
  // grant from the desk, indistinguishable from a certain one.
  const { update, accepted, suppressed } = buildEligibilityUpdate(
    { ...SURE, dgr_required: true, confidence: 0.3 }, 'gemini', NOW,
  );
  assert.equal(accepted, false);
  assert.equal(update.dgr_required, null);
  assert.equal(update.accepts_charity, null);
  assert.equal(suppressed, 4);
});

test('the floor is inclusive at its exact value', () => {
  const at = buildEligibilityUpdate({ ...SURE, confidence: ELIGIBILITY_CONFIDENCE_FLOOR }, 'g', NOW);
  assert.equal(at.accepted, true);
});

test('just under the floor is refused', () => {
  const below = buildEligibilityUpdate({ ...SURE, confidence: 0.69 }, 'g', NOW);
  assert.equal(below.accepted, false);
});

test('a missing confidence is treated as no confidence', () => {
  const { update, accepted } = buildEligibilityUpdate({ ...SURE, confidence: undefined }, 'g', NOW);
  assert.equal(accepted, false);
  assert.equal(update.eligibility_confidence, null);
  assert.equal(update.accepts_charity, null);
});

test('confidence is clamped, never stored out of range', () => {
  assert.equal(buildEligibilityUpdate({ confidence: 1.4 }, 'g', NOW).update.eligibility_confidence, 1);
  assert.equal(buildEligibilityUpdate({ confidence: -3 }, 'g', NOW).update.eligibility_confidence, 0);
});

test('we always stamp that we looked, so the row is not re-fetched forever', () => {
  const { update } = buildEligibilityUpdate({ confidence: 0.1 }, 'g', NOW);
  assert.equal(update.eligibility_signals_at, NOW);
});

test('a non-boolean flag never reaches the column', () => {
  const { update } = buildEligibilityUpdate(
    { ...SURE, accepts_charity: 'yes', accepts_pty_ltd: 1 }, 'g', NOW,
  );
  assert.equal(update.accepts_charity, null);
  assert.equal(update.accepts_pty_ltd, null);
});
