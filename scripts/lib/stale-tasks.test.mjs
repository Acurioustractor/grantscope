/**
 * Tests for the orchestrator's stale-task sweep.
 * Run: node --test scripts/lib/stale-tasks.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findStaleTasks, STALE_GRACE_MS } from './stale-tasks.mjs';

const now = Date.parse('2026-09-22T12:00:00Z');
const agents = { quick: { timeoutMs: 600_000 }, graph: { timeoutMs: 4 * 3600_000 } };
const ago = ms => new Date(now - ms).toISOString();

test('the 2026-09-18 zombies are stale', () => {
  const tasks = [
    { id: 'a', agent_id: 'quick', started_at: '2026-09-18T11:51:50Z' },
    { id: 'b', agent_id: 'unregistered', started_at: '2026-09-18T23:37:04Z' },
  ];
  assert.deepEqual(findStaleTasks(tasks, { agents, activeIds: new Set(), now }).map(t => t.id), ['a', 'b']);
});

test('a task this orchestrator is running is never stale, however old', () => {
  const tasks = [{ id: 'a', agent_id: 'quick', started_at: ago(48 * 3600_000) }];
  assert.equal(findStaleTasks(tasks, { agents, activeIds: new Set(['a']), now }).length, 0);
});

test('a long agent inside its own timeout is not stale', () => {
  const tasks = [{ id: 'g', agent_id: 'graph', started_at: ago(3 * 3600_000) }];
  assert.equal(findStaleTasks(tasks, { agents, activeIds: new Set(), now }).length, 0);
});

test('grace period applies past the timeout', () => {
  const inside = [{ id: 'q', agent_id: 'quick', started_at: ago(600_000 + STALE_GRACE_MS - 1000) }];
  const past = [{ id: 'q', agent_id: 'quick', started_at: ago(600_000 + STALE_GRACE_MS + 1000) }];
  assert.equal(findStaleTasks(inside, { agents, activeIds: new Set(), now }).length, 0);
  assert.equal(findStaleTasks(past, { agents, activeIds: new Set(), now }).length, 1);
});

test('running with no started_at and no live child is stale', () => {
  assert.equal(findStaleTasks([{ id: 'x', agent_id: 'quick', started_at: null }], { agents, activeIds: new Set(), now }).length, 1);
});
