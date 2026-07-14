import { describe, expect, it } from 'vitest';
import {
  buildDailyActionMemory,
  dailyActionSourceRef,
  isActDailyActionStatus,
  perthDayKey,
  relationshipFollowUpActionId,
  relationshipFollowUpIdFromAction,
} from './act-daily-actions';

describe('ACT daily action receipts', () => {
  it('uses the Perth calendar day at UTC boundaries', () => {
    expect(perthDayKey(new Date('2026-07-10T15:59:59Z'))).toBe('2026-07-10');
    expect(perthDayKey(new Date('2026-07-10T16:00:00Z'))).toBe('2026-07-11');
  });

  it('scopes each action receipt to one day', () => {
    expect(dailyActionSourceRef('collect-sonas', '2026-07-11')).toBe('2026-07-11:collect-sonas');
  });

  it('accepts only the three daily workflow outcomes', () => {
    expect(isActDailyActionStatus('done')).toBe(true);
    expect(isActDailyActionStatus('waiting')).toBe(true);
    expect(isActDailyActionStatus('tomorrow')).toBe(true);
    expect(isActDailyActionStatus('paid')).toBe(false);
  });

  it('round-trips relationship follow-up action identities', () => {
    const actionId = relationshipFollowUpActionId('follow-up-123');
    expect(actionId).toBe('relationship-follow-up:follow-up-123');
    expect(relationshipFollowUpIdFromAction(actionId)).toBe('follow-up-123');
    expect(relationshipFollowUpIdFromAction('collect-sonas')).toBeNull();
  });

  it('counts consecutive deferred days before today', () => {
    const memory = buildDailyActionMemory([
      { source_thread_id: 'collect-sonas', source_ref: '2026-07-11:collect-sonas', happened_at: '2026-07-11T09:00:00Z', metadata: { day: '2026-07-11', status: 'tomorrow' } },
      { source_thread_id: 'collect-sonas', source_ref: '2026-07-10:collect-sonas', happened_at: '2026-07-10T09:00:00Z', metadata: { day: '2026-07-10', status: 'waiting' } },
      { source_thread_id: 'collect-sonas', source_ref: '2026-07-09:collect-sonas', happened_at: '2026-07-09T09:00:00Z', metadata: { day: '2026-07-09', status: 'done' } },
      { source_thread_id: 'collect-sonas', source_ref: '2026-07-12:collect-sonas', happened_at: '2026-07-12T09:00:00Z', metadata: { day: '2026-07-12', status: 'waiting' } },
    ], '2026-07-12');

    expect(memory['collect-sonas']).toEqual({ lastStatus: 'tomorrow', lastDay: '2026-07-11', deferredDays: 2 });
  });

  it('resets the carry count after a completed day', () => {
    const memory = buildDailyActionMemory([
      { source_thread_id: 'plan-dewr', source_ref: '2026-07-11:plan-dewr', happened_at: '2026-07-11T09:00:00Z', metadata: { status: 'done' } },
      { source_thread_id: 'plan-dewr', source_ref: '2026-07-10:plan-dewr', happened_at: '2026-07-10T09:00:00Z', metadata: { status: 'tomorrow' } },
    ], '2026-07-12');

    expect(memory['plan-dewr']).toEqual({ lastStatus: 'done', lastDay: '2026-07-11', deferredDays: 0 });
  });
});
