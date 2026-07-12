import { describe, expect, it } from 'vitest';
import {
  applyDecisionMemory,
  decisionMatchesRecord,
  latestRelationshipDecisionFor,
  movePriority,
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

function decision(overrides: Partial<OrgOpportunityDecision>): OrgOpportunityDecision {
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
  };
}

describe('act recommendation decision memory', () => {
  it('matches decisions on source and optional project/pathway', () => {
    expect(decisionMatchesRecord(decision({}), baseRecord)).toBe(true);
    expect(decisionMatchesRecord(decision({ project_code: null, pathway: null }), baseRecord)).toBe(true);
    expect(decisionMatchesRecord(decision({ source_ref: 'different' }), baseRecord)).toBe(false);
    expect(decisionMatchesRecord(decision({ project_code: 'ACT-HV' }), baseRecord)).toBe(false);
    expect(decisionMatchesRecord(decision({ pathway: 'foundation' }), baseRecord)).toBe(false);
  });

  it('parks rows with no or lost decisions', () => {
    const adjusted = applyDecisionMemory(baseRecord, [decision({ decision: 'no', reason: 'Poor eligibility' })]);

    expect(adjusted.readiness).toBe('park');
    expect(adjusted.recommendedMove).toBe('park');
    expect(adjusted.confidence).toBe(35);
    expect(adjusted.reason).toContain('Learning memory: past no');
    expect(adjusted.tags).toContain('memory:no');
  });

  it('lowers urgency for later decisions', () => {
    const adjusted = applyDecisionMemory(baseRecord, [decision({ decision: 'later' })]);

    expect(adjusted.recommendedMove).toBe('watch');
    expect(adjusted.confidence).toBe(52);
    expect(adjusted.reason).toContain('Learning memory: parked before');
  });

  it('moves more_info decisions back to proof pack with merged gaps', () => {
    const adjusted = applyDecisionMemory(baseRecord, [
      decision({ decision: 'more_info', evidence_gaps: ['audited accounts', 'partner letter'] }),
    ]);

    expect(adjusted.readiness).toBe('needs_proof');
    expect(adjusted.recommendedMove).toBe('build_proof_pack');
    expect(adjusted.confidence).toBe(62);
    expect(adjusted.evidenceGaps).toEqual(['final eligibility check', 'audited accounts', 'partner letter']);
  });

  it('boosts accepted application and partner decisions', () => {
    const applyAdjusted = applyDecisionMemory(
      { ...baseRecord, recommendedMove: 'watch', readiness: 'needs_proof' },
      [decision({ decision: 'apply' })],
    );
    const partnerAdjusted = applyDecisionMemory(baseRecord, [decision({ decision: 'partner' })]);

    expect(applyAdjusted.readiness).toBe('ready');
    expect(applyAdjusted.recommendedMove).toBe('apply_now');
    expect(applyAdjusted.confidence).toBe(82);
    expect(partnerAdjusted.recommendedMove).toBe('approach_now');
    expect(partnerAdjusted.confidence).toBe(80);
  });

  it('leaves nonmatching decisions untouched', () => {
    const adjusted = applyDecisionMemory(baseRecord, [decision({ source_ref: 'other-grant', decision: 'no' })]);

    expect(adjusted).toEqual(baseRecord);
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
