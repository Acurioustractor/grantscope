/**
 * Tests for the grant_opportunities deadline gate.
 * Run: node --test scripts/lib/grant-deadline-update.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDeadlineUpdate } from './grant-deadline-update.mjs';

const NOW = '2026-09-21T00:00:00.000Z';
const EMPTY = { deadline: null, closes_at: null, amount_min: null, amount_max: null, metadata: null };
const QUOTE = 'Applications close at 5pm on 30 June 2026.';
const STATUS_QUOTE = 'This round is currently open and accepting applications.';

test('an unquoted deadline is refused and recorded', () => {
  const { update, deadlineAccepted, deadlineRejected } = buildDeadlineUpdate(
    { status: 'open', deadline: '2026-06-30', status_evidence: STATUS_QUOTE }, EMPTY, NOW,
  );
  assert.equal(deadlineAccepted, false);
  assert.equal(update.deadline, undefined);
  assert.equal(update.closes_at, undefined);
  assert.equal(deadlineRejected, '2026-06-30');
  assert.equal(update.metadata.deadline_provenance.deadline_rejected, '2026-06-30');
});

test('a quoted deadline writes both deadline and closes_at', () => {
  const { update } = buildDeadlineUpdate(
    { status: 'open', deadline: '2026-06-30', deadline_evidence: QUOTE, status_evidence: STATUS_QUOTE },
    EMPTY, NOW,
  );
  assert.equal(update.deadline, '2026-06-30');
  assert.equal(update.closes_at, '2026-06-30');
  assert.equal(update.metadata.deadline_provenance.deadline_evidence, QUOTE);
});

test('evidence that only restates the date is not evidence', () => {
  const { update } = buildDeadlineUpdate(
    { status: 'open', deadline: '2026-06-30', deadline_evidence: '30/06/2026' }, EMPTY, NOW,
  );
  assert.equal(update.deadline, undefined);
});

test('an existing deadline is never overwritten', () => {
  const { update } = buildDeadlineUpdate(
    { status: 'open', deadline: '2026-06-30', deadline_evidence: QUOTE },
    { ...EMPTY, deadline: '2026-01-01' }, NOW,
  );
  assert.equal(update.deadline, undefined);
});

test('an unquoted open claim falls back to unknown rather than opening a grant', () => {
  const { update } = buildDeadlineUpdate({ status: 'open' }, EMPTY, NOW);
  assert.equal(update.status, undefined);
  assert.equal(update.metadata.deadline_provenance.status_claimed, 'open');
});

test('closed needs no quote — it only ever removes a grant from the desk', () => {
  const { update } = buildDeadlineUpdate({ status: 'closed' }, EMPTY, NOW);
  assert.equal(update.status, 'closed');
});

test('rolling no longer overwrites a quoted status', () => {
  const { update } = buildDeadlineUpdate(
    { status: 'closed', is_rolling: true }, EMPTY, NOW,
  );
  assert.equal(update.status, 'closed');

  const quiet = buildDeadlineUpdate({ status: 'unknown', is_rolling: true }, EMPTY, NOW);
  assert.equal(quiet.update.status, 'ongoing');
});

test('provenance is stamped on every run and preserves existing metadata', () => {
  const { update } = buildDeadlineUpdate(
    { status: 'unknown', provider: 'gemini' },
    { ...EMPTY, metadata: { keep: 'me' } }, NOW,
  );
  assert.equal(update.metadata.keep, 'me');
  assert.equal(update.metadata.deadline_provenance.source, 'scrape-grant-deadlines');
  assert.equal(update.metadata.deadline_provenance.provider, 'gemini');
  assert.equal(update.metadata.deadline_provenance.at, NOW);
});

test('amounts and eligibility still fill empty fields', () => {
  const { update } = buildDeadlineUpdate(
    { status: 'unknown', amount_min: 5000.4, amount_max: 50000, eligibility_summary: 'Not-for-profits only.' },
    EMPTY, NOW,
  );
  assert.equal(update.amount_min, 5000);
  assert.equal(update.amount_max, 50000);
  assert.equal(update.requirements_summary, 'Not-for-profits only.');
});
