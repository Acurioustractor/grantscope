import { describe, expect, it } from 'vitest';
import type {
  OpportunityIntelligenceResponse,
  OpportunityRoute,
  OpportunitySignal,
} from '@/lib/opportunity-intelligence';
import { buildActResourceDesk } from '@/lib/services/act-resource-desk';

function signal(overrides: Partial<OpportunitySignal> = {}): OpportunitySignal {
  return {
    id: 'grant:regional-making',
    title: 'Regional making infrastructure',
    summary: 'Capital for remote manufacturing and community enterprise.',
    source: 'grant',
    sourceLabel: 'Official grant index',
    sourceRef: 'regional-making',
    sourceUrl: 'https://example.gov.au/regional-making',
    lane: 'grant',
    status: 'qualified',
    project: 'Goods',
    projects: ['goods'],
    organisation: 'Example Department',
    amount: '$500,000',
    deadline: '2026-09-01',
    score: 91,
    scoreReasons: ['keyword match'],
    whyNow: 'Current round',
    readiness: { level: 'medium', notes: [] },
    evidence: [{ label: 'Official page', source: 'grant', detail: 'Current round' }],
    relationships: [],
    nextAction: { kind: 'research', label: 'Research', description: 'Verify eligibility' },
    browseLinks: [],
    lastSyncedAt: '2026-07-29T00:00:00.000Z',
    sourceConfidence: 'high',
    freshness: 'fresh',
    matchedKeys: [],
    ...overrides,
  };
}

function response(route: OpportunityRoute): OpportunityIntelligenceResponse {
  return {
    generatedAt: '2026-07-30T00:00:00.000Z',
    filters: {},
    signals: [route.signal],
    routes: [route],
    topDirective: route,
    projectQueues: [],
    learningSummary: {
      decisionCount: 4,
      negativeCount: 1,
      positiveCount: 2,
      moreInfoCount: 1,
      commonNoReasons: [],
      notes: [],
    },
    actions: [],
    sourceHealth: [],
    projectState: [],
    relationshipContext: {
      summary: '',
      warmCount: 0,
      staleCount: 0,
      priorityContacts: [],
      commonTags: [],
    },
    safety: {
      mode: 'mirror-plus-actions',
      externalWrites: 'disabled-by-default',
      notes: [],
    },
  };
}

function route(gaps: string[] = []): OpportunityRoute {
  const item = signal();
  return {
    id: 'route:goods',
    signalId: item.id,
    title: item.title,
    source: item.source,
    sourceRef: item.sourceRef,
    sourceUrl: item.sourceUrl,
    project: 'goods',
    project_code: 'ACT-GD',
    project_name: 'Goods',
    pathway: 'grant',
    recommended_role: 'lead',
    fit_score: 91,
    readiness_score: 60,
    relationship_score: 0,
    urgency_score: 40,
    overall_score: 72,
    why_recommended: 'Goods grant path',
    why_not: null,
    evidence_gaps: gaps,
    next_action: 'Confirm authority and applicant structure.',
    ghl: {
      recommendedPipeline: 'Grants',
      suggestedStage: 'Research',
      existingOpportunityId: null,
      contactId: null,
      tags: [],
    },
    signal: item,
  };
}

describe('buildActResourceDesk', () => {
  it('connects an opportunity to a concrete Goods matter without exposing scores', () => {
    const desk = buildActResourceDesk(
      response(route()),
      new Date('2026-07-30T00:00:00.000Z'),
    );
    const item = desk.items[0];

    expect(item.queue).toBe('needs-decision');
    expect(item.connections[0]).toMatchObject({
      projectId: 'goods',
      matterId: 'oonchiumpa',
      resourceRole: 'Grant funding',
    });
    expect(item).not.toHaveProperty('score');
    expect(item).not.toHaveProperty('overallScore');
  });

  it('keeps an evidence gap in verification rather than treating fit as readiness', () => {
    const desk = buildActResourceDesk(
      response(route(['Confirm applicant eligibility'])),
      new Date('2026-07-30T00:00:00.000Z'),
    );

    expect(desk.items[0].queue).toBe('needs-verification');
    expect(desk.items[0].evidence.gaps).toEqual(['Confirm applicant eligibility']);
  });
});

