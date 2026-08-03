import { describe, expect, it } from 'vitest';
import {
  applyEvidenceGate,
  buildProjectContext,
  composeAnswer,
  FRESHNESS_LIMIT_DAYS,
  jurisdictionAllows,
  parseAskIntent,
  type AskProjectContext,
  type GatedOpportunity,
} from '@/lib/services/ask-grantscope';

const NOW = new Date('2026-08-03T00:00:00.000Z');

function opportunity(overrides: Partial<GatedOpportunity> = {}): GatedOpportunity {
  return {
    opportunityId: 'opp-1',
    name: 'Remote Food Systems Grant',
    funderName: 'NIAA',
    deadline: '2026-09-01T00:00:00.000Z',
    maxAmount: 250_000,
    sourceUrl: 'https://example.gov.au/grant',
    applicationUrl: 'https://example.gov.au/apply',
    feedStatus: 'apply_now',
    verificationStatus: 'verified',
    verifiedAt: '2026-08-01T00:00:00.000Z',
    evidenceCompleteness: 100,
    failedRequirements: [],
    jurisdictions: ['NT'],
    isNational: false,
    eligibleOrgTypes: [],
    requiresDgr: null,
    fitScore: null,
    ...overrides,
  };
}

const PROJECTS = [
  { projectCode: 'ACT-GD', projectName: 'Goods', projectSlug: 'goods' },
  { projectCode: 'ACT-HV', projectName: 'The Harvest', projectSlug: 'harvest' },
];

describe('applyEvidenceGate', () => {
  it('passes a verified, open, sourced opportunity', () => {
    const result = applyEvidenceGate(opportunity(), NOW);
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.daysRemaining).toBe(29);
  });

  it('fails a quarantined record', () => {
    const result = applyEvidenceGate(opportunity({ feedStatus: 'quarantined' }), NOW);
    expect(result.passed).toBe(false);
    expect(result.failures.join(' ')).toContain('not apply_now');
  });

  it('fails a passed deadline', () => {
    const result = applyEvidenceGate(opportunity({ deadline: '2026-07-01T00:00:00.000Z' }), NOW);
    expect(result.passed).toBe(false);
    expect(result.failures).toContain('Deadline has passed.');
  });

  it('fails a record with no official source URL', () => {
    const result = applyEvidenceGate(opportunity({ sourceUrl: null }), NOW);
    expect(result.passed).toBe(false);
    expect(result.failures.join(' ')).toContain('No official source URL');
  });

  it('fails verification older than the freshness limit', () => {
    const stale = new Date(NOW.getTime() - (FRESHNESS_LIMIT_DAYS + 5) * 86_400_000).toISOString();
    const result = applyEvidenceGate(opportunity({ verifiedAt: stale }), NOW);
    expect(result.passed).toBe(false);
    expect(result.failures.join(' ')).toContain('beyond the');
  });

  it('fails on unmet evidence requirements even when everything else is clean', () => {
    const result = applyEvidenceGate(
      opportunity({ failedRequirements: ['applicant_eligibility'] }),
      NOW,
    );
    expect(result.passed).toBe(false);
    expect(result.failures.join(' ')).toContain('applicant_eligibility');
  });
});

describe('parseAskIntent', () => {
  it('resolves a project by name and a state from a place', () => {
    const intent = parseAskIntent('What can fund Goods near Tennant Creek?', PROJECTS);
    expect(intent.projectCode).toBe('ACT-GD');
    expect(intent.state).toBe('NT');
    expect(intent.placeMention).toBe('tennant creek');
    expect(intent.kind).toBe('project_funding');
  });

  it('resolves eligibility questions', () => {
    const intent = parseAskIntent('Which applicant should lead, and do we need a DGR?', PROJECTS);
    expect(intent.kind).toBe('eligibility');
  });

  it('does not invent a project when none is named', () => {
    const intent = parseAskIntent('What grants are open in Victoria?', PROJECTS);
    expect(intent.projectCode).toBeNull();
    expect(intent.state).toBe('VIC');
  });

  it('detects a recency question', () => {
    expect(parseAskIntent('What changed this week?', PROJECTS).kind).toBe('changed_recently');
  });
});

describe('jurisdictionAllows', () => {
  it('treats national coverage as allowing any state', () => {
    expect(jurisdictionAllows([], true, 'NT')).toBe(true);
    expect(jurisdictionAllows(['National'], false, 'WA')).toBe(true);
  });

  it('matches a stated jurisdiction, including long form', () => {
    expect(jurisdictionAllows(['NT'], false, 'NT')).toBe(true);
    expect(jurisdictionAllows(['Northern Territory'], false, 'NT')).toBe(true);
  });

  it('rejects a mismatched state', () => {
    expect(jurisdictionAllows(['VIC'], false, 'NT')).toBe(false);
  });

  it('lets an unstated jurisdiction through as an unknown rather than dropping it', () => {
    expect(jurisdictionAllows([], false, 'NT')).toBe(true);
  });
});

describe('published applicant constraints', () => {
  const intent = parseAskIntent('What can fund Goods in the NT right now?', PROJECTS);

  it('raises a DGR requirement as a human decision, not an eligibility verdict', () => {
    const answer = composeAnswer({
      question: 'What can fund Goods in the NT right now?',
      intent,
      opportunities: [opportunity({ requiresDgr: true })],
      project: null,
      now: NOW,
    });
    const dgr = answer.unknowns.find(claim => claim.statement.includes('deductible gift recipient'));
    expect(dgr?.grade).toBe('human_decision');
    expect(dgr?.sources[0].url).toBe('https://example.gov.au/grant');
  });

  it('reports published eligible applicant types as structured inference', () => {
    const answer = composeAnswer({
      question: 'What can fund Goods in the NT right now?',
      intent,
      opportunities: [opportunity({ eligibleOrgTypes: ['charity', 'indigenous_corp'] })],
      project: null,
      now: NOW,
    });
    expect(answer.inference.some(claim =>
      claim.grade === 'structured_inference' && claim.statement.includes('charity, indigenous_corp'),
    )).toBe(true);
  });
});

describe('buildProjectContext', () => {
  it('reads labels out of profile v1 object arrays', () => {
    const context = buildProjectContext(
      { id: 'p1', code: 'ACT-GD', name: 'Goods', slug: 'goods' },
      {
        org_project_id: 'p1',
        completeness_status: 'partial',
        profile: {
          entities: [{ name: 'A Curious Tractor Pty Ltd' }, 'The Butterfly Movement Ltd'],
          geographies: [{ name: 'NT' }],
          partnerPathways: [{ partner: 'Community-controlled auspice' }],
          unresolvedDecisions: ['Confirm applicant and contracting entities.'],
        },
      },
    );
    expect(context.applicantEntities).toEqual([
      'A Curious Tractor Pty Ltd',
      'The Butterfly Movement Ltd',
    ]);
    expect(context.geographies).toEqual(['NT']);
    expect(context.partnerPathways).toEqual(['Community-controlled auspice']);
    expect(context.completeness).toBe('partial');
  });

  it('falls back to baseline when no profile exists', () => {
    const context = buildProjectContext(
      { id: 'p1', code: 'ACT-GD', name: 'Goods', slug: 'goods' },
      undefined,
    );
    expect(context.completeness).toBe('baseline');
    expect(context.unresolvedDecisions).toEqual([]);
  });
});

describe('composeAnswer', () => {
  const project: AskProjectContext = {
    projectCode: 'ACT-GD',
    projectName: 'Goods',
    projectSlug: 'goods',
    orgProjectId: 'p1',
    completeness: 'partial',
    unresolvedDecisions: ['Confirm applicant and contracting entities.'],
    geographies: ['NT'],
    applicantEntities: ['A Curious Tractor Pty Ltd'],
    partnerPathways: ['Community-controlled auspice'],
  };
  const intent = parseAskIntent('What can fund Goods in the NT right now?', PROJECTS);

  it('grades gate-passing opportunities as verified facts with provenance', () => {
    const answer = composeAnswer({
      question: 'What can fund Goods in the NT right now?',
      intent,
      opportunities: [opportunity()],
      project,
      now: NOW,
    });
    expect(answer.facts).toHaveLength(1);
    expect(answer.facts[0].grade).toBe('verified_fact');
    expect(answer.facts[0].sources[0].url).toBe('https://example.gov.au/grant');
    expect(answer.facts[0].sources[0].freshnessDays).toBe(2);
    expect(answer.results).toHaveLength(1);
  });

  it('never presents a withheld opportunity as a fact', () => {
    const answer = composeAnswer({
      question: 'What can fund Goods in the NT right now?',
      intent,
      opportunities: [opportunity({ feedStatus: 'quarantined' })],
      project,
      now: NOW,
    });
    expect(answer.facts).toEqual([]);
    expect(answer.results).toEqual([]);
    expect(answer.withheld).toHaveLength(1);
    expect(answer.headline).toContain('No opportunity currently clears the evidence gate');
  });

  it('carries unresolved profile decisions through as human decisions', () => {
    const answer = composeAnswer({
      question: 'What can fund Goods in the NT right now?',
      intent,
      opportunities: [opportunity()],
      project,
      now: NOW,
    });
    const humanDecisions = answer.unknowns.filter(claim => claim.grade === 'human_decision');
    expect(humanDecisions.map(claim => claim.statement)).toContain(
      'Confirm applicant and contracting entities.',
    );
    expect(answer.nextAction).toContain('Resolve the open profile decisions for Goods');
  });

  it('flags missing evidence when no applicant entity is recorded', () => {
    const answer = composeAnswer({
      question: 'What can fund Goods in the NT right now?',
      intent,
      opportunities: [opportunity()],
      project: { ...project, applicantEntities: [] },
      now: NOW,
    });
    expect(answer.unknowns.some(claim =>
      claim.grade === 'missing_evidence' && claim.statement.includes('no applicant entity'),
    )).toBe(true);
    expect(answer.inference.some(claim => claim.statement.includes('recorded applicant'))).toBe(false);
  });

  it('flags a geography mismatch rather than assuming eligibility', () => {
    const answer = composeAnswer({
      question: 'What can fund Goods in the NT right now?',
      intent,
      opportunities: [opportunity()],
      project: { ...project, geographies: ['QLD'] },
      now: NOW,
    });
    expect(answer.unknowns.some(claim =>
      claim.statement.includes('Geographic eligibility is unconfirmed'),
    )).toBe(true);
  });

  it('says so plainly when no project resolved', () => {
    const answer = composeAnswer({
      question: 'What grants are open?',
      intent: parseAskIntent('What grants are open?', PROJECTS),
      opportunities: [opportunity()],
      project: null,
      now: NOW,
    });
    expect(answer.unknowns.some(claim =>
      claim.statement.includes('No project was resolved'),
    )).toBe(true);
  });

  it('keeps the result set bounded and soonest-deadline first', () => {
    const many = Array.from({ length: 9 }, (_, index) => opportunity({
      opportunityId: `opp-${index}`,
      deadline: new Date(NOW.getTime() + (30 - index) * 86_400_000).toISOString(),
    }));
    const answer = composeAnswer({
      question: 'What can fund Goods in the NT right now?',
      intent,
      opportunities: many,
      project,
      now: NOW,
      limit: 5,
    });
    expect(answer.results).toHaveLength(5);
    expect(answer.results[0].opportunityId).toBe('opp-8');
  });

  it('ranks by project fit ahead of urgency when fit is known', () => {
    const answer = composeAnswer({
      question: 'What can fund Goods in the NT right now?',
      intent,
      opportunities: [
        opportunity({ opportunityId: 'urgent-poor-fit', deadline: '2026-08-10T00:00:00.000Z', fitScore: 0.1 }),
        opportunity({ opportunityId: 'later-strong-fit', deadline: '2026-09-20T00:00:00.000Z', fitScore: 0.9 }),
      ],
      project,
      now: NOW,
    });
    expect(answer.results.map(result => result.opportunityId)).toEqual([
      'later-strong-fit',
      'urgent-poor-fit',
    ]);
  });
});
