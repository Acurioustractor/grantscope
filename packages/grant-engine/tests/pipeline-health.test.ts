import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyPipelineHealth } from '../src/pipeline-health';

const now = Date.parse('2026-08-03T12:00:00.000Z');
const schedules = [{ agentId: 'nightly-grant-pipeline-ingest', enabled: true, intervalHours: 24, lastScheduledAt: null }];

test('reports a stale pending task as an orchestrator backlog', () => {
  const result = classifyPipelineHealth(schedules, [{ agentId: schedules[0].agentId, status: 'pending', createdAt: '2026-08-03T10:00:00.000Z' }], [], { now });
  assert.equal(result.status, 'backlogged');
  assert.match(result.phases[0].note, /120m/);
});

test('running work takes precedence over queued backlog', () => {
  const result = classifyPipelineHealth(schedules, [
    { agentId: schedules[0].agentId, status: 'pending', createdAt: '2026-08-03T10:00:00.000Z' },
    { agentId: schedules[0].agentId, status: 'running', createdAt: '2026-08-03T11:59:00.000Z' },
  ], [], { now });
  assert.equal(result.status, 'running');
});

test('surfaces a timed out latest run when no task is active', () => {
  const result = classifyPipelineHealth(schedules, [], [{ agentId: schedules[0].agentId, status: 'timed_out', startedAt: '2026-08-03T11:00:00.000Z' }], { now });
  assert.equal(result.status, 'failing');
});
