import test from 'node:test';
import assert from 'node:assert/strict';
import { assessGrantEvidence } from './grant-evidence-gate.mjs';

const evidenceItem = (quote) => ({ url: 'https://example.org.au/grants/round-one', quote });

function completeCandidate() {
  return {
    name: 'Regional Community Innovation Round 1',
    source_url: 'https://example.org.au/grants/round-one',
    official_domains: ['example.org.au'],
    official_source_confirmed: true,
    deadline: '2026-09-30T23:59:00+10:00',
    intake_type: 'fixed',
    eligible_org_types: ['charity'],
    funding_amount_status: 'known',
    amount_min: 5000,
    amount_max: 25000,
    project_codes: ['ACT-GD'],
    project_fit_reason: 'Funds community-owned manufacturing capability.',
    retrieved_at: '2026-07-28T00:00:00Z',
    evidence: {
      official_source: evidenceItem('Official grant page published by Example Foundation.'),
      named_round: evidenceItem('Regional Community Innovation Round 1.'),
      intake_timing: evidenceItem('Applications close 30 September 2026.'),
      applicant_eligibility: evidenceItem('Australian registered charities may apply.'),
      funding_amount: evidenceItem('Grants from $5,000 to $25,000 are available.'),
      project_fit: evidenceItem('Supports community-owned manufacturing capability.'),
    },
  };
}

test('passes a complete, current and evidenced opportunity', () => {
  const result = assessGrantEvidence(completeCandidate(), { now: '2026-07-28T00:00:00Z' });
  assert.equal(result.passes, true);
  assert.equal(result.evidence_completeness, 100);
});

test('rejects a warm but undated opportunity', () => {
  const candidate = completeCandidate();
  candidate.deadline = null;
  candidate.intake_type = 'unknown';
  const result = assessGrantEvidence(candidate, { now: '2026-07-28T00:00:00Z' });
  assert.equal(result.passes, false);
  assert.ok(result.failed_requirements.includes('current_timing'));
});

test('accepts rolling intake only with evidence and a review date', () => {
  const candidate = completeCandidate();
  candidate.deadline = null;
  candidate.intake_type = 'rolling';
  candidate.next_review_at = '2026-08-28T00:00:00Z';
  candidate.evidence.intake_timing = evidenceItem('Applications are accepted continuously and assessed monthly.');
  const result = assessGrantEvidence(candidate, { now: '2026-07-28T00:00:00Z' });
  assert.equal(result.passes, true);
});

test('rejects aggregator URLs even when marked confirmed', () => {
  const candidate = completeCandidate();
  candidate.source_url = 'https://facebook.com/example-foundation/posts/1';
  candidate.official_domains = ['facebook.com'];
  const result = assessGrantEvidence(candidate, { now: '2026-07-28T00:00:00Z' });
  assert.ok(result.failed_requirements.includes('official_source'));
});
