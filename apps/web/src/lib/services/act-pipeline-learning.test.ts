import { describe, expect, it } from 'vitest';
import {
  comparePipelineWork,
  isWorkingPipelineItem,
  pipelineNeedsAttention,
  pipelineNeedsPlan,
  pipelineSuggestedNextAction,
  pipelineLearningDecision,
  pipelineStatusRequiresReason,
} from './act-pipeline-learning';

describe('ACT pipeline learning', () => {
  it('maps pipeline movement into shared learning decisions', () => {
    expect(pipelineLearningDecision('researching', 'grant')).toBe('research');
    expect(pipelineLearningDecision('pursuing', 'relationship')).toBe('partner');
    expect(pipelineLearningDecision('submitted', 'grant')).toBe('apply');
    expect(pipelineLearningDecision('won', 'grant')).toBe('won');
    expect(pipelineLearningDecision('lost', 'grant')).toBe('lost');
    expect(pipelineLearningDecision('passed', 'grant')).toBe('no');
    expect(pipelineLearningDecision('parked', 'relationship')).toBe('later');
  });

  it('requires a lesson for terminal outcomes', () => {
    expect(pipelineStatusRequiresReason('won')).toBe(true);
    expect(pipelineStatusRequiresReason('lost')).toBe(true);
    expect(pipelineStatusRequiresReason('parked')).toBe(true);
    expect(pipelineStatusRequiresReason('submitted')).toBe(false);
  });

  it('keeps accepted work but removes stale discovery backlog', () => {
    const now = new Date('2026-07-10T00:00:00.000Z');
    expect(isWorkingPipelineItem({ status: 'submitted', created_at: '2026-03-01', deadline: '2026-03-20' }, now)).toBe(true);
    expect(isWorkingPipelineItem({ status: 'prospect', created_at: '2026-03-01', deadline: null }, now)).toBe(false);
    expect(isWorkingPipelineItem({ status: 'prospect', created_at: '2026-07-01', deadline: '2026-08-01' }, now)).toBe(true);
    expect(isWorkingPipelineItem({ status: 'passed', created_at: '2026-07-01', deadline: null }, now)).toBe(false);
  });

  it('orders source-backed and outcome-ready work first', () => {
    const sourceBacked = { status: 'pursuing', source_type: 'crm', deadline: null, updated_at: '2026-07-01' };
    const submitted = { status: 'submitted', source_type: null, deadline: '2026-06-01', updated_at: '2026-07-02' };
    const prospect = { status: 'prospect', source_type: null, deadline: null, updated_at: '2026-07-03' };

    expect([prospect, submitted, sourceBacked].sort(comparePipelineWork)).toEqual([sourceBacked, submitted, prospect]);
  });
});

describe('ACT daily action queue', () => {
  it('finds commitments without a complete owner, action, and date', () => {
    expect(pipelineNeedsPlan({ owner_name: null, next_action: 'Call funder', next_action_at: '2026-07-12' })).toBe(true);
    expect(pipelineNeedsPlan({ owner_name: 'Ben', next_action: 'Call funder', next_action_at: '2026-07-12' })).toBe(false);
  });

  it('keeps active work in attention and waiting work out', () => {
    const now = new Date('2026-07-11T00:00:00Z');
    expect(pipelineNeedsAttention({ status: 'pursuing', deadline: null, next_action_at: null }, now)).toBe(true);
    expect(pipelineNeedsAttention({ status: 'waiting', deadline: '2026-07-20', next_action_at: null }, now)).toBe(false);
    expect(pipelineNeedsAttention({ status: 'prospect', deadline: '2026-07-20', next_action_at: null }, now)).toBe(true);
  });

  it('turns relationship intelligence into a concrete suggested move', () => {
    const item = { name: 'Regional fund', next_action: null, funder: 'Regional Trust', grant_provider: null };
    expect(pipelineSuggestedNextAction(item, {
      recommendedMove: 'ask_for_intro',
      relationshipName: 'Ari at Regional Trust',
    })).toBe('Find a warm introduction to Ari at Regional Trust.');
    expect(pipelineSuggestedNextAction(item, {
      recommendedMove: 'build_proof_pack',
      evidenceGaps: ['community demand evidence'],
    })).toBe('Assemble the community demand evidence needed for this opportunity.');
  });

  it('never replaces a next action already chosen by the team', () => {
    const item = { name: 'Regional fund', next_action: 'Call Ari on Monday', funder: 'Regional Trust', grant_provider: null };
    expect(pipelineSuggestedNextAction(item, {
      recommendedMove: 'ask_for_intro',
      relationshipName: 'Someone else',
    })).toBe('Call Ari on Monday');
  });
});
