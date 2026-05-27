/**
 * Tests for the Goods relevance scorer.
 * Run: node --test scripts/lib/goods-relevance.test.mjs
 *
 * Locks the 2026-05-27 scoring-noise fix so it can't silently regress:
 *   - arc-grants / qld-arts-data / university providers hard-zero
 *   - "sediment" never gets a SEDI boost; real SEDI scores high
 *   - real Goods-shaped grants still score high
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreGrantForGoods, GOODS_TAG_THRESHOLD } from './goods-relevance.mjs';

test('arc-grants source hard-zeros even a First-Nations-themed research grant', () => {
  const { score, signals } = scoreGrantForGoods({
    name: 'Policy for self-determination: the case study of ATSIC',
    provider: 'The University of Queensland',
    description: 'Indigenous Aboriginal Torres Strait self-determination community research.',
    amount_max: 1_200_000,
    source: 'arc-grants',
  });
  assert.equal(score, 0);
  assert.equal(signals.hard_disqualified, 'source:arc-grants');
});

test('qld-arts-data source hard-zeros an Indigenous arts grant', () => {
  const { score } = scoreGrantForGoods({
    name: 'Indigenous Regional Arts Development Fund (IRADF) — Yarrabah',
    provider: 'Queensland Government',
    description: 'Aboriginal community arts development.',
    source: 'qld-arts-data',
  });
  assert.equal(score, 0);
});

test('university provider hard-zeros regardless of source', () => {
  const { score, signals } = scoreGrantForGoods({
    name: 'Remote Indigenous housing study',
    provider: 'University of New South Wales',
    description: 'Aboriginal remote housing community infrastructure.',
    source: 'grantconnect',
  });
  assert.equal(score, 0);
  assert.equal(signals.hard_disqualified, 'provider:university');
});

test('"sediment" never receives a SEDI boost and scores low', () => {
  const { score, signals } = scoreGrantForGoods({
    name: 'Shallow water carbonate sediment dissolution dynamics',
    provider: 'Geoscience Australia',
    description: 'Sedimentary basin drilling and dissolution modelling.',
    amount_max: 500_000,
    source: 'grantconnect',
  });
  assert.equal(signals.sedi_hit, undefined);
  assert.ok(score < GOODS_TAG_THRESHOLD, `expected < ${GOODS_TAG_THRESHOLD}, got ${score}`);
});

test('real SEDI Capability grant scores at/above the tag threshold', () => {
  const { score, signals } = scoreGrantForGoods({
    name: 'SEDI Capability Building Grant',
    provider: 'Impact Investing Australia (admin) — Dept of Social Services (funder)',
    description: 'Capability-building grants up to $120K for trading social enterprises (Indigenous-owned/controlled eligible, typically >$50K revenue).',
    amount_max: 120_000,
    geography: 'AU',
    source: 'dss',
  });
  assert.equal(signals.sedi_hit, true);
  assert.ok(score >= GOODS_TAG_THRESHOLD, `expected >= ${GOODS_TAG_THRESHOLD}, got ${score}`);
});

test('a real Goods-shaped Indigenous housing grant still scores high', () => {
  const { score } = scoreGrantForGoods({
    name: 'Remote Aboriginal Housing Essential Goods Program',
    provider: 'NSW Government — Aboriginal Housing Office',
    description: 'Funding for whitegoods, beds and furniture for remote Aboriginal community housing.',
    amount_max: 250_000,
    geography: 'AU-NT',
    source: 'nsw-grants',
  });
  assert.ok(score >= GOODS_TAG_THRESHOLD, `expected >= ${GOODS_TAG_THRESHOLD}, got ${score}`);
});

test('founder-development fellowship (no academic context) is NOT zeroed', () => {
  const { score, signals } = scoreGrantForGoods({
    name: 'Westpac Social Change Fellowship',
    provider: 'Westpac Scholars Trust',
    description: 'Development program for social entrepreneurs creating community change. Indigenous social enterprise founders eligible.',
    amount_max: 50_000,
    geography: 'AU',
    source: 'foundation_program',
  });
  assert.ok(!signals.disqualifier_hits.includes('fellowship(academic)'), 'should not penalise a non-academic fellowship');
  assert.ok(score > 0, `expected > 0, got ${score}`);
});

test('research fellowship (academic context) is still penalised', () => {
  const { signals } = scoreGrantForGoods({
    name: 'Indigenous Health Research Fellowship',
    provider: 'NHMRC',
    description: 'Postdoctoral research fellowship for academic study of Aboriginal community health.',
    amount_max: 500_000,
    source: 'grantconnect',
  });
  assert.ok(signals.disqualifier_hits.includes('fellowship(academic)'), 'academic fellowship should still be penalised');
});

test('discovery_method=indigenous-finance boosts a capital opportunity', () => {
  const withBoost = scoreGrantForGoods({
    name: 'IBA Start-Up Finance Package',
    provider: 'Indigenous Business Australia',
    description: 'Loan with up to 30% grant component to buy business assets.',
    amount_max: 150_000,
    source: 'indigenous-finance-crawler',
    discovery_method: 'indigenous-finance',
  });
  assert.equal(withBoost.signals.discovery_boost, 'indigenous-finance');
  assert.ok(withBoost.score >= GOODS_TAG_THRESHOLD, `expected >= ${GOODS_TAG_THRESHOLD}, got ${withBoost.score}`);
});
