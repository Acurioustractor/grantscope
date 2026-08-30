import { describe, expect, it } from 'vitest';
import {
  compileFundingProfile,
  fundingProfileText,
  isFundingProfileCompiled,
} from '@/lib/services/funding-profile-compiler';

const org = {
  id: 'org-act',
  name: 'A Curious Tractor',
  abn: '21591780066',
  additional_abns: ['73669029341'],
  org_type: 'Social Enterprise Ecosystem',
  org_status: 'incorporated',
  auspice_org_name: null,
  geographic_focus: ['Queensland', 'Palm Island'],
};

const directApplicantRoute = {
  id: 'route-act-default',
  applicant_entity_id: 'entity-act',
  route_type: 'direct',
  status: 'ready',
  is_default: true,
  eligible_instruments: ['grant_non_dgr', 'contract'],
  constraints: ['DGR requires another route.'],
  entity: {
    id: 'entity-act',
    name: 'A Curious Tractor',
    entity_type: 'company',
    status: 'active',
    abn: '21591780066',
    dgr_status: 'unknown',
    verification_status: 'verified',
  },
};

describe('compileFundingProfile', () => {
  it('compiles canonical metadata without inventing applicant, place, budget or authority facts', () => {
    const project = {
      id: 'project-jh',
      org_profile_id: org.id,
      code: 'ACT-JH',
      name: 'JusticeHub',
      slug: 'justicehub',
      description: 'Justice data infrastructure.',
      category: 'justice',
      status: 'active',
      metadata: {
        profile_summary: 'Evidence infrastructure for community-led justice alternatives.',
        funding_brief: 'Prioritise community-led justice and systems-change funders.',
        funding_tags: ['justice reform', 'community-led alternatives'],
        proof_points: ['Evidence catalogue is live'],
      },
    };

    const first = compileFundingProfile({ org, project });
    const second = compileFundingProfile({ org, project });
    const profile = first.profile;

    expect(first.profile_version).toBe(second.profile_version);
    expect(first.completeness_status).toBe('baseline');
    expect(profile).toMatchObject({
      purpose: { publicSummary: 'Evidence infrastructure for community-led justice alternatives.' },
      entities: [],
      geographies: [],
      evidence: [],
      organisationContext: {
        abn: '21591780066',
        applicantRouteStatus: 'requires_project_decision',
      },
      searchContext: {
        fundingBrief: 'Prioritise community-led justice and systems-change funders.',
        proofPoints: ['Evidence catalogue is live'],
      },
    });
    expect(fundingProfileText(profile)).toContain('community-led alternatives');
    expect(isFundingProfileCompiled(profile, org, project)).toBe(true);
  });

  it('preserves a deliberate partial profile while adding compiler-owned context', () => {
    const project = {
      id: 'project-goods',
      code: 'ACT-GD',
      name: 'Goods',
      slug: 'goods',
      metadata: { profile_summary: 'A shorter canonical summary.', funding_tags: ['circular economy'] },
    };
    const result = compileFundingProfile({
      org,
      project,
      existing: {
        profile_version: 'goods-manual-v1',
        completeness_status: 'partial',
        provenance: [{ type: 'file', path: 'goods.json' }],
        profile: {
          purpose: { publicSummary: 'A deliberate evidence-rich Goods summary.', outcomes: [] },
          entities: [{ id: 'charity' }],
          fundingNeed: { currency: 'AUD', blocks: [{ id: 'equipment', label: 'Equipment' }] },
          geographies: ['AU-NT'],
          evidence: [],
          partnerPathways: [],
          beneficiaries: [],
          acceptedInstruments: ['grant'],
          constraints: [],
          relationships: [],
          unresolvedDecisions: ['Confirm applicant route.'],
        },
      },
      applicantRoutes: [directApplicantRoute],
    });

    expect(result.completeness_status).toBe('partial');
    expect(result.profile).toMatchObject({
      purpose: { publicSummary: 'A deliberate evidence-rich Goods summary.' },
      geographies: ['AU-NT'],
      themes: ['circular economy'],
    });
    const compiledEntities = result.profile.entities as Array<Record<string, unknown>>;
    expect(compiledEntities).toHaveLength(2);
    expect(compiledEntities[0]).toEqual({ id: 'charity' });
    expect(compiledEntities.find(entity => entity.registryEntityId === 'entity-act')).toMatchObject({
      registryEntityId: 'entity-act',
      registryRouteId: 'route-act-default',
    });
    expect(result.provenance[0]).toEqual({ type: 'file', path: 'goods.json' });
  });

  it('resolves the generic applicant gap from one canonical project route', () => {
    const project = {
      id: 'project-jh',
      org_profile_id: org.id,
      code: 'ACT-JH',
      name: 'JusticeHub',
      slug: 'justicehub',
      description: 'Justice data infrastructure.',
    };
    const result = compileFundingProfile({ org, project, applicantRoutes: [directApplicantRoute] });
    expect(result.completeness_status).toBe('partial');
    expect(result.profile).toMatchObject({
      organisationContext: {
        applicantRouteStatus: 'ready',
        defaultApplicantName: 'A Curious Tractor',
      },
      entities: [{
        legalName: 'A Curious Tractor',
        registryEntityId: 'entity-act',
        routeStatus: 'ready',
      }],
    });
    expect(result.profile.unresolvedDecisions).not.toContain('Confirm applicant and contracting entities.');
    expect(isFundingProfileCompiled(result.profile, org, project, [directApplicantRoute])).toBe(true);
    expect(isFundingProfileCompiled(result.profile, org, project)).toBe(false);
  });
});
