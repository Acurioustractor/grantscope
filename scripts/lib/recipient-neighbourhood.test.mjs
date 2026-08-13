import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateFunders, classifyDoorway, scoreAnalogue } from './recipient-neighbourhood.mjs';

const base = {
  foundation_id: 'f-1',
  foundation_name: 'Example Foundation',
  grantee_name: 'Remote Healthy Homes Aboriginal Corporation',
  program_name: 'Essential beds and First Nations employment program',
  evidence_text: 'Community-led delivery in remote Northern Territory communities with training and maintenance.',
  source_url: 'https://example.org/grants',
  grantee_entity_id: 'e-1',
  grant_amount: 75000,
  thematic_focus: ['indigenous', 'community'],
  geographic_focus: ['AU-NT'],
};

test('scores analogue evidence across multiple Goods funding blocks', () => {
  const result = scoreAnalogue(base);
  assert.ok(result.score >= 40);
  assert.ok(result.blockMatches.some(match => match.id === 'measured_run'));
  assert.ok(result.blockMatches.some(match => match.id === 'employment_pathways'));
  assert.ok(result.blockMatches.some(match => match.id === 'servicing_and_scoping'));
});

test('classifies trustee and corporate community doorways', () => {
  assert.equal(classifyDoorway({ foundation_name: 'Perpetual IMPACT Philanthropy' }), 'trustee_application');
  assert.equal(classifyDoorway({ foundation_name: 'Example', program_description: 'Our community investment and sponsorship program' }), 'corporate_community_investment');
});

test('aggregates analogue evidence and penalises already-engaged funders', () => {
  const [unengaged] = aggregateFunders([base], []);
  const [engaged] = aggregateFunders([base], ['Example Foundation']);
  assert.equal(unengaged.analogues.length, 1);
  assert.ok(unengaged.score > engaged.score);
  assert.equal(engaged.alreadyEngaged, true);
});

test('rejects evidence-rich records without a Goods funding block', () => {
  const result = scoreAnalogue({
    ...base,
    grantee_name: 'University Research Centre',
    program_name: 'Medical research fellowship',
    evidence_text: 'A fully documented research award.',
  });
  assert.equal(result.score, 0);
});

test('normalises ampersands when matching already-engaged funders', () => {
  const [result] = aggregateFunders([
    { ...base, foundation_name: 'Foundation For Rural And Regional Renewal' },
  ], ['Foundation for Rural & Regional Renewal']);
  assert.equal(result.alreadyEngaged, true);
});
