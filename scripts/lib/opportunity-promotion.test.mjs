import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalUrl, evaluateGhlGate, evaluateNotionGate, promotionKey } from './opportunity-promotion.mjs';

test('canonical URL removes tracking and normalises trailing slash', () => {
  assert.equal(canonicalUrl('https://Example.org/grants/?utm_source=x#top'), 'https://example.org/grants');
});

test('promotion key is deterministic', () => {
  const input = { projectCode: 'ACT-GD', provider: 'Example Foundation', program: 'Round One', round: '2027', receivingEntity: 'charity' };
  assert.equal(promotionKey(input), promotionKey(input));
});

test('Notion gate requires current official evidence and an eligible pathway', () => {
  const result = evaluateNotionGate({ id: 'abc', url: 'https://example.org/grant', fundingBlock: 'measured_run', receivingEntity: 'charity', eligibility: 'Confirmed', lastVerifiedAt: '2026-08-01' }, new Date('2026-08-12'));
  assert.equal(result.pass, true);
});

test('GHL gate rejects research without owned execution', () => {
  const result = evaluateGhlGate({ grantScopeId: 'abc', decisionState: 'Qualify', canonicalStatus: 'Active', evidenceStatus: 'Ready', eligibility: 'Likely' });
  assert.equal(result.pass, false);
  assert.ok(result.gaps.includes('Decision state Work'));
  assert.ok(result.gaps.includes('owner'));
});
