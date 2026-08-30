import { describe, expect, it } from 'vitest';
import {
  applicantRequirementsFromEvidence,
  applicantRouteBlockers,
  toApplicantRouteOption,
  type ProjectApplicantRoute,
} from '@/lib/services/funding-applicant-registry';

const route: ProjectApplicantRoute = {
  id: 'route-act-jh',
  projectId: 'project-jh',
  projectCode: 'ACT-JH',
  projectName: 'JusticeHub',
  projectSlug: 'justicehub',
  routeType: 'direct',
  status: 'ready',
  isDefault: true,
  eligibleInstruments: ['grant_non_dgr'],
  constraints: ['DGR requires another route.'],
  rationale: 'Portfolio default.',
  entity: {
    id: 'entity-act',
    name: 'A Curious Tractor',
    entityType: 'company',
    status: 'active',
    abn: '21591780066',
    acn: '697347676',
    dgrStatus: 'unknown',
    verificationStatus: 'verified',
    verificationSource: 'org_profiles',
    isDefault: true,
  },
};

describe('funding applicant registry', () => {
  it('accepts a verified company route for a compatible non-DGR opportunity', () => {
    const option = toApplicantRouteOption(route, {
      requires_abn: true,
      requires_dgr: false,
      eligible_org_types: ['company', 'social_enterprise'],
      eligibility_decision: 'eligible_direct',
      profile_completeness: 'decision_ready',
    });
    expect(option.eligible).toBe(true);
    expect(option.blockers).toEqual([]);
  });

  it('blocks an unknown DGR claim before a GHL handoff', () => {
    const blockers = applicantRouteBlockers(route, {
      requiresAbn: true,
      requiresDgr: true,
      eligibleOrgTypes: ['company', 'charity'],
      eligibilityDecision: 'eligible_direct',
      profileCompleteness: 'decision_ready',
    });
    expect(blockers).toContain('This opportunity requires verified DGR endorsement.');
  });

  it('blocks a published charity-only route for a company applicant', () => {
    const option = toApplicantRouteOption(route, {
      requires_dgr: false,
      eligible_org_types: ['charity', 'not_for_profit'],
    });
    expect(option.eligible).toBe(false);
    expect(option.blockers.join(' ')).toContain('published eligible organisation types');
  });

  it('does not let a route label overstate the entity legal status', () => {
    const charityOption = toApplicantRouteOption({ ...route, routeType: 'charity' }, {
      eligible_org_types: ['charity'],
    });
    const dgrOption = toApplicantRouteOption({ ...route, routeType: 'dgr' }, {
      eligible_org_types: ['company'],
    });
    expect(charityOption.blockers).toContain('A charity route requires a registered charity or auspice entity.');
    expect(dgrOption.blockers).toContain('A DGR route requires verified DGR endorsement.');
  });

  it('normalises opportunity evidence without assuming missing requirements', () => {
    expect(applicantRequirementsFromEvidence({ eligible_org_types: ['Company'] })).toEqual({
      requiresAbn: false,
      requiresDgr: false,
      eligibleOrgTypes: ['company'],
      eligibilityDecision: null,
      profileCompleteness: null,
    });
  });

  it('blocks every route while project eligibility still needs verification', () => {
    const option = toApplicantRouteOption(route, {
      eligibility_decision: 'needs_verification',
      profile_completeness: 'baseline',
    });
    expect(option.eligible).toBe(false);
    expect(option.blockers).toContain('The project funding profile is not decision-ready.');
    expect(option.blockers).toContain('Project and opportunity eligibility still needs verification.');
  });
});
