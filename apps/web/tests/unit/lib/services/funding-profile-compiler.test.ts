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
    });

    expect(result.completeness_status).toBe('partial');
    expect(result.profile).toMatchObject({
      purpose: { publicSummary: 'A deliberate evidence-rich Goods summary.' },
      entities: [{ id: 'charity' }],
      geographies: ['AU-NT'],
      themes: ['circular economy'],
    });
    expect(result.provenance[0]).toEqual({ type: 'file', path: 'goods.json' });
  });
});
