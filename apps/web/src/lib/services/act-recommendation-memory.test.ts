import { describe, expect, it } from 'vitest';
import {
  applyDecisionMemory,
  decisionMatchesRecord,
  latestRelationshipDecisionFor,
  movePriority,
  priorCasesFor,
  relationshipActionHandled,
  type RecommendationMemoryRecord,
} from './act-recommendation-memory';
import type { OrgOpportunityDecision } from './org-dashboard-service';

const baseRecord: RecommendationMemoryRecord = {
  sourceType: 'grant',
  sourceRef: 'grant-1',
  projectCode: 'ACT-GD',
  pathway: 'grant',
  readiness: 'ready',
  recommendedMove: 'apply_now',
  confidence: 70,
  reason: 'Good fit.',
  evidenceGaps: ['final eligibility check'],
  tags: ['grant'],
};

function decision(
  overrides: Partial<OrgOpportunityDecision> & { judgment?: unknown },
): OrgOpportunityDecision {
  return {
    id: 'decision-1',
    source_type: 'grant',
    source_ref: 'grant-1',
    project_code: 'ACT-GD',
    pathway: 'grant',
    decision: 'apply',
    reason: 'ACT chose this in triage',
    notes: null,
    evidence_gaps: [],
    outcome: null,
    created_at: '2026-07-09T00:00:00.000Z',
    ...overrides,
  } as OrgOpportunityDecision;
}

describe('act recommendation decision memory', () => {
  it('matches decisions on source and optional project/pathway', () => {
    expect(decisionMatchesRecord(decision({}), baseRecord)).toBe(true);
    expect(decisionMatchesRecord(decision({ project_code: null, pathway: null }), baseRecord)).toBe(true);
    expect(decisionMatchesRecord(decision({ source_ref: 'different' }), baseRecord)).toBe(false);
    expect(decisionMatchesRecord(decision({ project_code: 'ACT-HV' }), baseRecord)).toBe(false);
    expect(decisionMatchesRecord(decision({ pathway: 'foundation' }), baseRecord)).toBe(false);
  });

  it('adds prior cases without changing the current recommendation', () => {
    const remembered = applyDecisionMemory(baseRecord, [
      decision({
        decision: 'more_info',
        reason: 'The applicant authority was not confirmed',
        notes: 'This legacy note is not assumed to be a promise.',
        evidence_gaps: ['Who has authority to apply?'],
        outcome: '45c10bbb-ab94-42f6-b184-adc806f0404d',
        judgment: {
          whatChanged: 'The community partner needs to choose the applicant.',
          commitment: {
            kind: 'return',
            owner: 'Ben',
            action: 'Return the applicant options to the community partner.',
          },
          nextLearningQuestion: 'Who does the community partner authorise to apply?',
        },
      }),
    ], [
      {
        decisionId: 'decision-1',
        happenedAt: '2026-07-12T00:00:00.000Z',
        metadata: { what_happened: 'The community partner selected its preferred applicant.' },
      },
    ]);

    expect(remembered).toMatchObject(baseRecord);
    expect(remembered.readiness).toBe(baseRecord.readiness);
    expect(remembered.recommendedMove).toBe(baseRecord.recommendedMove);
    expect(remembered.confidence).toBe(baseRecord.confidence);
    expect(remembered.reason).toBe(baseRecord.reason);
    expect(remembered.evidenceGaps).toEqual(baseRecord.evidenceGaps);
    expect(remembered.tags).toEqual(baseRecord.tags);
    expect(remembered.priorCases).toEqual([
      {
        id: 'decision-1',
        decision: 'more_info',
        label: 'Proof requested',
        decidedAt: '2026-07-09T00:00:00.000Z',
        summary: 'What changed: The community partner needs to choose the applicant. · Promise / return: Return — Ben: Return the applicant options to the community partner. · What happened: The community partner selected its preferred applicant. · Next question: Who does the community partner authorise to apply?',
      },
    ]);
  });

  it('returns matching cases newest first, excludes unrelated decisions, and keeps unknown outcomes explicit', () => {
    const cases = priorCasesFor(baseRecord, [
      decision({ id: 'older', created_at: '2026-07-08T00:00:00.000Z', decision: 'later', reason: null }),
      decision({ id: 'unrelated', source_ref: 'other-grant', created_at: '2026-07-11T00:00:00.000Z' }),
      decision({
        id: 'newer',
        created_at: '2026-07-10T00:00:00.000Z',
        decision: 'apply',
        reason: 'Authority confirmed',
        outcome: '45c10bbb-ab94-42f6-b184-adc806f0404d',
      }),
    ]);

    expect(cases.map((item) => item.id)).toEqual(['newer', 'older']);
    expect(cases[0]?.summary).toBe('What changed: Authority confirmed · What happened: Not recorded yet');
    expect(cases[1]?.summary).toBe('What changed: Parked before · What happened: Not recorded yet');
  });

  it('adds an empty priorCases list for a recommendation with no matching case', () => {
    const remembered = applyDecisionMemory(baseRecord, [decision({ source_ref: 'other-grant', decision: 'no' })]);

    expect(remembered).toEqual({ ...baseRecord, priorCases: [] });
  });

  it('orders direct action moves before proof, watch, and park', () => {
    expect(movePriority('apply_now')).toBeLessThan(movePriority('approach_now'));
    expect(movePriority('approach_now')).toBeLessThan(movePriority('ask_for_intro'));
    expect(movePriority('ask_for_intro')).toBeLessThan(movePriority('build_proof_pack'));
    expect(movePriority('build_proof_pack')).toBeLessThan(movePriority('watch'));
    expect(movePriority('watch')).toBeLessThan(movePriority('park'));
  });

  it('removes handled relationship actions using their CRM source reference', () => {
    const record = { id: 'context:thread-1', signalAt: '2026-07-09T08:00:00.000Z' };
    const handled = decision({
      source_type: 'crm',
      source_ref: 'thread-1',
      decision: 'partner',
      created_at: '2026-07-09T09:00:00.000Z',
    });

    expect(latestRelationshipDecisionFor(record, [handled])).toEqual(handled);
    expect(relationshipActionHandled(record, [handled])).toBe(true);
  });

  it('resurfaces a relationship when a newer signal arrives', () => {
    const record = { id: 'context:thread-1', signalAt: '2026-07-10T09:00:00.000Z' };
    const oldDecision = decision({
      source_type: 'crm',
      source_ref: 'thread-1',
      decision: 'later',
      created_at: '2026-07-09T09:00:00.000Z',
    });

    expect(latestRelationshipDecisionFor(record, [oldDecision])).toBeNull();
    expect(relationshipActionHandled(record, [oldDecision])).toBe(false);
  });

  it('keeps proof-gap relationship actions visible', () => {
    const record = { id: 'contact-1', signalAt: null };
    const proofGap = decision({
      source_type: 'crm',
      source_ref: 'contact-1',
      decision: 'more_info',
    });

    expect(relationshipActionHandled(record, [proofGap])).toBe(false);
  });
});
