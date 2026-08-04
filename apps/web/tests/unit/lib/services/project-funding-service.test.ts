import { describe, expect, it } from 'vitest';
import { buildHybridWeeklyQueue, buildWeeklyFundingQueue, type ProjectFundingProfileSummary } from '@/lib/services/project-funding-service';

const profile: ProjectFundingProfileSummary = { projectId: 'p1', projectCode: 'ACT-GD', projectName: 'Goods', projectSlug: 'goods', description: null, profileVersion: 'v1', completeness: 'partial', unresolvedDecisions: ['Confirm applicant'], entities: 2, fundingBlocks: 5, geographies: ['AU-NT'] };

describe('buildWeeklyFundingQueue', () => {
  it('caps the portfolio at five, deduplicates opportunities and excludes decided rows', () => {
    const recommendations = Array.from({ length: 7 }, (_, index) => ({ project_code: 'ACT-GD', opportunity_id: index === 6 ? 'opp-1' : `opp-${index}`, opportunity_name: `Opportunity ${index}`, funder_name: 'Funder', deadline: '2026-09-30', max_grant_amount: 10000, fit_score: 90 - index, eligibility_score: 80, source_url: 'https://official.example/grant', application_url: 'https://official.example/apply' }));
    const queue = buildWeeklyFundingQueue({ recommendations, decisions: [{ project_code: 'ACT-GD', opportunity_id: 'opp-0', decision: 'watching' }], profiles: [profile], now: new Date('2026-08-03T00:00:00Z') });
    expect(queue).toHaveLength(5);
    expect(queue.some(item => item.opportunityId === 'opp-0')).toBe(false);
    expect(new Set(queue.map(item => item.opportunityId)).size).toBe(5);
    expect(queue.every(item => item.eligibilityDecision === 'needs_verification')).toBe(true);
  });
});

describe('buildHybridWeeklyQueue', () => {
  it('selects the best project path per opportunity and preserves explainable signals', () => {
    const match = { opportunity_id: 'opp-1', project_code: 'ACT-GD', opportunity_name: 'Remote infrastructure', funder_name: 'Funder', deadline: '2026-09-30', max_grant_amount: 50000, source_url: 'https://official.example/grant', application_url: 'https://official.example/apply', lexical_score: 0.4, semantic_score: 0.82, recommendation_score: 75, hybrid_score: 65.2, eligibility_decision: 'needs_verification' as const, eligibility_evidence: { requires_dgr: true } };
    const duplicate = { ...match, opportunity_id: 'opp-2', hybrid_score: 60 };
    const queue = buildHybridWeeklyQueue({ matches: [match, duplicate], decisions: [], profiles: [profile], now: new Date('2026-08-03T00:00:00Z') });
    expect(queue).toHaveLength(1);
    expect(queue[0].hybridScore).toBe(65.2);
    expect(queue[0].eligibilityEvidence).toEqual({ requires_dgr: true });
  });
});
