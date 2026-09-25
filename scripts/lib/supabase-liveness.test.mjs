import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verdict, reallyRead, SUSPECT_COPY } from '../supabase-liveness.mjs';

const base = { kind: 'table', rows: 10, read: true, writes: 5, dependents: 0, functions: 0, crons: 0, codeRefs: 0, refreshed: false };

test('backup-level full scans do not count as reads; an index lookup does', () => {
  assert.equal(reallyRead(120, 0), false);
  assert.equal(reallyRead(120, 1), true);
  assert.equal(reallyRead(500, 0), true);
});

test('verdicts, first rule wins', () => {
  assert.equal(verdict(base), 'live');
  assert.equal(verdict({ ...base, rows: 0, read: false }), 'empty and unused');
  assert.equal(verdict({ ...base, read: false, writes: 0 }), 'dormant');
  assert.equal(verdict({ ...base, read: false, writes: 0, codeRefs: 2 }), 'dormant but referenced');
  assert.equal(verdict({ ...base, read: false }), 'written, never read');
  assert.equal(verdict({ ...base, writes: 0 }), 'read-only (reference or frozen)');
  assert.equal(verdict({ ...base, kind: 'view', rows: null }), 'unreferenced view');
});

test('suspect copy names', () => {
  for (const n of ['gs_entities_lga_backup_20260808', 'political_donations_pre_dedup_20260923', 'mv_person_identity_influence_v2', 'foo_old']) assert.ok(SUSPECT_COPY.test(n), n);
  assert.ok(!SUSPECT_COPY.test('gs_entities'));
});
