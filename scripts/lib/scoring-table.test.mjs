import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoringTable, columnsFor } from './scoring-table.mjs';

test('defaults to grant_opportunities and accepts the private table', () => {
  assert.equal(scoringTable([]), 'grant_opportunities');
  assert.equal(scoringTable(['--table=act_private_grant_rounds']), 'act_private_grant_rounds');
  assert.throws(() => scoringTable(['--table=anything_else']));
});

test('drops focus_areas for the private table only', () => {
  assert.equal(columnsFor('grant_opportunities', 'id,focus_areas,name'), 'id,focus_areas,name');
  assert.equal(columnsFor('act_private_grant_rounds', 'id, focus_areas, name'), 'id, name');
});
