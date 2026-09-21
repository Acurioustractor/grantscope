/**
 * Tests for the foundation programme record builder.
 * Run: node --test scripts/lib/foundation-program-record.test.mjs
 *
 * The thesis these guard (2026-09-21): every significant extraction bug that
 * day was a model allowed to answer when it should have abstained. So each
 * invented-value field here has a test that it stays null without a quote.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProgramRecord } from './foundation-program-record.mjs';

const CTX = { foundationId: 'f1', scannedAt: '2026-09-21T00:00:00.000Z' };
const QUOTE = 'Applications for the 2026 round close on 30 June 2026.';
const ELIG_QUOTE = 'Applicants must be an incorporated not-for-profit operating in regional Queensland.';
const APPLY_QUOTE = 'Submit an expression of interest through our online portal by the closing date.';

test('a programme with no usable name is rejected', () => {
  assert.equal(buildProgramRecord({ name: 'x' }, CTX), null);
  assert.equal(buildProgramRecord(null, CTX), null);
});

test('an unquoted deadline is dropped but kept for audit', () => {
  const rec = buildProgramRecord({ name: 'Community Fund', deadline: '2026-06-30' }, CTX);
  assert.equal(rec.deadline, null);
  assert.equal(rec.metadata.deadline_rejected, '2026-06-30');
});

test('a quoted deadline is accepted', () => {
  const rec = buildProgramRecord(
    { name: 'Community Fund', deadline: '2026-06-30', deadline_evidence: QUOTE },
    CTX,
  );
  assert.equal(rec.deadline, '2026-06-30');
  assert.equal(rec.metadata.deadline_rejected, null);
});

test('evidence that just restates the date is not evidence', () => {
  const rec = buildProgramRecord(
    { name: 'Community Fund', deadline: '2026-06-30', deadline_evidence: '30 June 2026' },
    CTX,
  );
  assert.equal(rec.deadline, null);
});

test('eligibility is written only when the page is quoted', () => {
  const guessed = buildProgramRecord(
    { name: 'Community Fund', eligibility: 'Not-for-profits in Queensland.' },
    CTX,
  );
  assert.equal(guessed.eligibility, null);
  assert.equal(guessed.metadata.eligibility_rejected, 'Not-for-profits in Queensland.');

  const quoted = buildProgramRecord(
    { name: 'Community Fund', eligibility: 'Incorporated not-for-profits in regional QLD.', eligibility_evidence: ELIG_QUOTE },
    CTX,
  );
  assert.equal(quoted.eligibility, 'Incorporated not-for-profits in regional QLD.');
  assert.equal(quoted.metadata.eligibility_evidence, ELIG_QUOTE);
});

test('how to apply is written only when the page is quoted', () => {
  const guessed = buildProgramRecord({ name: 'Community Fund', how_to_apply: 'Apply online.' }, CTX);
  assert.equal(guessed.application_process, null);

  const quoted = buildProgramRecord(
    { name: 'Community Fund', how_to_apply: 'EOI through the online portal.', how_to_apply_evidence: APPLY_QUOTE },
    CTX,
  );
  assert.equal(quoted.application_process, 'EOI through the online portal.');
});

test('application_mode and cadence accept only known values', () => {
  const rec = buildProgramRecord(
    { name: 'Community Fund', application_mode: 'carrier pigeon', assessment_cadence: 'annual' },
    CTX,
  );
  assert.equal(rec.application_mode, null);
  assert.equal(rec.metadata.assessment_cadence, 'annual');

  const ok = buildProgramRecord({ name: 'Community Fund', application_mode: 'eoi' }, CTX);
  assert.equal(ok.application_mode, 'eoi');
});

test('a contact needs a real email, phone or page', () => {
  const junk = buildProgramRecord(
    { name: 'Community Fund', contact: { name: 'The Grants Team' } },
    CTX,
  );
  assert.equal(junk.metadata.contact, null);

  const real = buildProgramRecord(
    { name: 'Community Fund', contact: { name: 'Grants Team', email: 'Grants@Example.ORG', phone: '07 1234 5678' } },
    CTX,
  );
  assert.equal(real.metadata.contact.email, 'grants@example.org');
  assert.equal(real.metadata.contact.phone, '07 1234 5678');
});

test('the programme url leads source_urls and is never duplicated', () => {
  const rec = buildProgramRecord(
    {
      name: 'Community Fund',
      url: 'https://example.org/fund',
      source_urls: ['https://example.org/fund', 'https://example.org/guidelines', 'not-a-url'],
    },
    CTX,
  );
  assert.deepEqual(rec.source_urls, ['https://example.org/fund', 'https://example.org/guidelines']);
});

test('a closed round is closed even with no deadline at all', () => {
  const rec = buildProgramRecord({ name: 'Community Fund', round_status: 'closed' }, CTX);
  assert.equal(rec.status, 'closed');
});

test('an unknown round stays unknown rather than defaulting to open', () => {
  const rec = buildProgramRecord({ name: 'Community Fund' }, CTX);
  assert.equal(rec.status, 'unknown');
  assert.equal(rec.metadata.applicant_type, 'unknown');
  assert.equal(rec.metadata.extraction_version, 3);
});

test('a quoted past deadline closes the round', () => {
  const rec = buildProgramRecord(
    { name: 'Community Fund', deadline: '2026-01-01', deadline_evidence: QUOTE, round_status: 'open' },
    CTX,
  );
  assert.equal(rec.status, 'closed');
});
