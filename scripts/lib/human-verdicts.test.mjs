import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verdictsFromRows, enforceOnRow, humanNoFor, isWrongProject } from './human-verdicts.mjs';
import { applyProjectTags } from './project-relevance.mjs';
import { applyGoodsTag } from './goods-relevance.mjs';

const d = (over) => ({ source_ref: 'g1', project_code: 'ACT-GD', decision: 'no', reason: 'wrong_project', created_at: '2026-09-24T01:00:00Z', ...over });

test('a wrong-project pass is a verdict; other passes and later decisions are not', () => {
  const v = verdictsFromRows([
    d({}),
    d({ source_ref: 'g2', reason: 'not_now' }),
    d({ source_ref: 'g3', reason: 'Not relevant to Goods on Country' }),
    d({ source_ref: 'g4' }),
    d({ source_ref: 'g4', decision: 'review', reason: null, created_at: '2026-09-24T02:00:00Z' }),
  ]);
  assert.deepEqual(humanNoFor(v, 'g1'), ['ACT-GD']);
  assert.deepEqual(humanNoFor(v, 'g2'), []);
  assert.deepEqual(humanNoFor(v, 'g3'), ['ACT-GD']);
  assert.deepEqual(humanNoFor(v, 'g4'), [], 'put back on the desk undoes the verdict');
  assert.equal(isWrongProject(null), false);
});

test('applyGoodsTag keeps a rejected Goods tag off even at a high keyword score', () => {
  const row = { aligned_projects: ['ACT-GD', 'goods'], goods_relevance_score: 73, human_no: ['ACT-GD'] };
  const out = applyGoodsTag(row, 73, {});
  assert.deepEqual(out.tagged, []);
  assert.equal(out.change, 'removed');
  assert.equal(out.signals.tagged_by, 'human_no');
  assert.equal(out.signals.tag_change.by, 'human');
});

test('applyProjectTags keeps a rejected project tag off and leaves the others alone', () => {
  const row = { aligned_projects: ['ACT-JH', 'ACT-CN'], project_relevance: {}, human_no: ['ACT-CN'] };
  const hit = { score: 60, signals: {} };
  const results = { justicehub: hit, contained: hit, 'empathy-ledger': { score: 0, signals: {} }, harvest: { score: 0, signals: {} }, farm: { score: 0, signals: {} } };
  const out = applyProjectTags(row, results, '2026-09-24T00:00:00Z');
  assert.ok(out.tagged.includes('ACT-JH'));
  assert.ok(!out.tagged.includes('ACT-CN'));
  assert.equal(out.relevance.contained.tagged_by, 'human_no');
  assert.equal(out.changes.contained.by, 'human');
});

test('enforceOnRow removes only rejected tags and says nothing when there is nothing to remove', () => {
  const row = { aligned_projects: ['ACT-GD', 'goods', 'ACT-JH'], goods_relevance_score: 55, project_relevance: { justicehub: { score: 40 } } };
  const up = enforceOnRow(row, ['ACT-GD'], 'T');
  assert.deepEqual(up.aligned_projects, ['ACT-JH']);
  assert.equal(up.goods_relevance_signals.tagged_by, 'human_no');
  assert.equal(up.project_relevance, undefined);
  const up2 = enforceOnRow(row, ['ACT-JH'], 'T');
  assert.deepEqual(up2.aligned_projects, ['ACT-GD', 'goods']);
  assert.equal(up2.project_relevance.justicehub.tagged_by, 'human_no');
  assert.equal(up2.project_relevance.justicehub.score, 40);
  assert.equal(enforceOnRow({ aligned_projects: ['ACT-JH'] }, ['ACT-GD']), null);
});
