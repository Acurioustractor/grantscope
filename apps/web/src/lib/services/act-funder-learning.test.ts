import { describe, expect, it } from 'vitest';
import { funderOutcomeEffect, isActFunderOutcome } from './act-funder-learning';

describe('ACT funder outcome learning', () => {
  it('moves a proposal invitation into proposal work', () => {
    expect(funderOutcomeEffect('proposal_invited')).toEqual({
      interactionType: 'proposal',
      engagementStatus: 'proposal',
      learningDecision: 'apply',
      clearsNextMove: false,
    });
  });

  it('turns a no-fit decision into reusable negative evidence', () => {
    expect(funderOutcomeEffect('not_a_fit')).toEqual({
      interactionType: 'decision',
      engagementStatus: 'parked',
      learningDecision: 'no',
      clearsNextMove: true,
    });
  });

  it('rejects arbitrary outcome values', () => {
    expect(isActFunderOutcome('meeting_held')).toBe(true);
    expect(isActFunderOutcome('maybe')).toBe(false);
  });
});
