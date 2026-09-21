/**
 * Tests for the foundation-programme → grant_opportunities promotion gate.
 * Run: node --test scripts/lib/foundation-program-gate.test.mjs
 *
 * Why this file exists (2026-09-21): 22 grant_opportunities rows were found
 * carrying deadlines no funder ever published — 50 distinct funders sharing
 * 2026-06-30, and Annamila First Nations Foundation's three streams all on
 * 2026-09-30 while their site said "grant rounds are currently closed until
 * further notice". The chain was circular:
 *
 *   discover-foundation-programs.mjs asked an LLM for a deadline, offering null
 *   -> the model returned a plausible month-end date instead
 *   -> sync's hasStructuredGrantSignal counted ANY deadline as proof of a grant
 *   -> a church mission trip to Malaysia and "Lions Biggest BBQ" became grants.
 *
 * The gate now needs a quote for a deadline, and respects applicant_type.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isGrantLikeFoundationProgram, evidencedDeadlineOf } from '../sync-foundation-programs.mjs';

const TRUSTED = { id: 'f1', name: 'Example Foundation', type: 'private_ancillary_fund', website: 'https://example.org' };
const QUOTE = 'Applications for the 2026 round close on 30 June 2026.';

test('an unevidenced deadline no longer proves a programme is a grant', () => {
  // This exact shape is what put "Lions Biggest BBQ" on the desk.
  const bbq = {
    name: 'Lions Biggest BBQ',
    description: 'Our annual community barbecue fundraiser.',
    deadline: '2026-12-31',
    metadata: {},
  };
  assert.equal(isGrantLikeFoundationProgram(bbq, TRUSTED), false);
});

test('an evidenced deadline still counts as a structured grant signal', () => {
  const real = {
    name: 'Community Fund',
    description: 'Supports community projects.',
    deadline: '2026-06-30',
    metadata: { deadline_evidence: QUOTE },
  };
  assert.equal(isGrantLikeFoundationProgram(real, TRUSTED), true);
});

test('legacy rows with no metadata lose the deadline signal, by design', () => {
  // Every pre-2026-09-21 row is in this state. Their dates are precisely the
  // unverified ones, so dropping the signal is the intent, not collateral.
  const legacy = { name: 'Some Programme', description: 'A programme.', deadline: '2026-12-31' };
  assert.equal(isGrantLikeFoundationProgram(legacy, TRUSTED), false);
  assert.equal(evidencedDeadlineOf(legacy), null);
});

test('scholarships and prizes to individuals are never grant-like', () => {
  const scholarship = {
    name: 'Winchester Boarding Scholarship Program',
    description: 'A scholarship awarded to a student, covering boarding fees. Applications open now.',
    amount_max: 20000,
    metadata: { applicant_type: 'individual' },
  };
  assert.equal(isGrantLikeFoundationProgram(scholarship, TRUSTED), false);
});

test('a way to DONATE to the foundation is never grant-like', () => {
  // "Family Scholarship Donation" and "Corporate Scholarship Partnership" both
  // read as grant language. Both are ways of giving the foundation money.
  const donation = {
    name: 'Family Scholarship Donation',
    description: 'Partner with us to fund a scholarship. Your grant supports a student for a full year.',
    metadata: { applicant_type: 'not_an_application' },
  };
  assert.equal(isGrantLikeFoundationProgram(donation, TRUSTED), false);
});

test('applicant_type overrides grant language and a grant-shaped URL', () => {
  const trip = {
    name: '2026 Mission Trip - Malaysia (Sibu, Sarawak)',
    description: 'Apply now for our funded mission trip. Grant funding covers travel.',
    url: 'https://example.org/grants/mission-trip',
    deadline: '2026-09-30',
    metadata: { applicant_type: 'not_an_application', deadline_evidence: QUOTE },
  };
  assert.equal(isGrantLikeFoundationProgram(trip, TRUSTED), false);
});

test('applicant_type "organisation" or absent leaves the other signals in charge', () => {
  const base = { name: 'Community Grants Program', description: 'Grants for community organisations to deliver projects.' };
  assert.equal(isGrantLikeFoundationProgram({ ...base, metadata: { applicant_type: 'organisation' } }, TRUSTED), true);
  assert.equal(isGrantLikeFoundationProgram({ ...base, metadata: {} }, TRUSTED), true);
  assert.equal(isGrantLikeFoundationProgram(base, TRUSTED), true);
});

test('an untrusted foundation type is still refused regardless of evidence', () => {
  const prog = { name: 'Community Grants', description: 'Grants for organisations.', metadata: { deadline_evidence: QUOTE } };
  assert.equal(isGrantLikeFoundationProgram(prog, { ...TRUSTED, type: 'operating_charity' }), false);
});

test('evidencedDeadlineOf passes a quoted date and nulls an unquoted one', () => {
  assert.equal(evidencedDeadlineOf({ deadline: '2026-06-30', metadata: { deadline_evidence: QUOTE } }), '2026-06-30');
  assert.equal(evidencedDeadlineOf({ deadline: '2026-06-30', metadata: {} }), null);
  assert.equal(evidencedDeadlineOf({ deadline: null, metadata: { deadline_evidence: QUOTE } }), null);
  assert.equal(evidencedDeadlineOf(null), null);
});

test('a programme whose page says it is not accepting applications is not grant-like', () => {
  // Amounts on a closed page describe money already given, not an opportunity.
  const shut = {
    name: 'Community Grants Program',
    description: 'Our grants program supports community projects.',
    amount_max: 50000,
    application_mode: 'not_accepting',
    metadata: {},
  };
  assert.equal(isGrantLikeFoundationProgram(shut, TRUSTED), false);
});

test('a ticket price is not a structured grant signal', () => {
  // "Underworld Laser tag Menai (1 hour) 3 x missions", amount_max 20, which
  // used to be enough to make a fundraising event grant-like.
  const lasertag = {
    name: 'Underworld Laser tag Menai (1 hour) 3 x missions',
    description: 'Join us for an afternoon of laser tag.',
    amount_max: 20,
    metadata: {},
  };
  assert.equal(isGrantLikeFoundationProgram(lasertag, TRUSTED), false);
});

test('a plausible amount still proves grant-hood', () => {
  const real = { name: 'Community Fund', description: 'Supports community projects.', amount_max: 50000, metadata: {} };
  assert.equal(isGrantLikeFoundationProgram(real, TRUSTED), true);
});
