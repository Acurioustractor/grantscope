import { describe, expect, it } from 'vitest';
import { buildFundingControlPlane } from '@/lib/services/funding-control-plane';
import { compileFundingProfile } from '@/lib/services/funding-profile-compiler';

describe('buildFundingControlPlane', () => {
  it('aligns every project and separates automatic reconciliation from human decisions', () => {
    const org = {
      id: 'org-act',
      name: 'A Curious Tractor',
      abn: '21591780066',
      additional_abns: ['73669029341'],
      org_type: 'Social Enterprise Ecosystem',
      org_status: 'incorporated',
      auspice_org_name: null,
      geographic_focus: ['Queensland'],
    };
    const goods = { id: 'project-goods', code: 'ACT-GD', name: 'Goods', slug: 'goods' };
    const compiledGoods = compileFundingProfile({
      org,
      project: goods,
      existing: {
        profile_version: 'goods-v1',
        completeness_status: 'partial',
        profile: { unresolvedDecisions: ['Confirm applicant'], entities: [{ id: 'applicant' }] },
      },
    });
    const controlPlane = buildFundingControlPlane({
      generatedAt: '2026-08-30T00:00:00.000Z',
      org,
      projects: [
        goods,
        { id: 'project-harvest', code: 'ACT-HV', name: 'The Harvest', slug: 'harvest' },
      ],
      profiles: [{
        org_project_id: 'project-goods',
        profile_version: compiledGoods.profile_version,
        completeness_status: compiledGoods.completeness_status,
        profile: compiledGoods.profile,
      }],
      recommendations: [
        { project_code: 'ACT-GD', opportunity_id: 'opportunity-1' },
        { project_code: 'ACT-HV', opportunity_id: 'opportunity-2' },
      ],
      decisions: [
        {
          project_code: 'ACT-HV',
          opportunity_id: 'opportunity-2',
          decision: 'pursuing',
        },
        {
          project_code: 'ACT-HV',
          opportunity_id: 'opportunity-3',
          decision: 'submitted',
        },
        {
          project_code: 'ACT-GD',
          opportunity_id: 'historical-opportunity',
          decision: 'won',
          decision_scope: 'historical_evidence',
          decision_origin: 'xero_invoices',
          notes: 'Backfilled from xero_invoices · paid invoice',
        },
      ],
      handoffs: [{
        project_code: 'ACT-GD',
        opportunity_id: 'opportunity-1',
        ghl_opportunity_id: 'ghl-1',
        notion_brief_url: null,
        sync_status: 'succeeded',
        last_error: null,
      }],
    });

    expect(controlPlane.summary).toMatchObject({
      activeProjects: 2,
      profileCoverage: 1,
      compiledProfiles: 1,
      evidenceSafeMatches: 2,
      uniqueOpportunities: 2,
      historicalWins: 1,
      ghlLinked: 1,
      notionLinked: 0,
      automaticActions: 2,
      humanActions: 2,
    });
    expect(controlPlane.actions.map(action => action.type)).toEqual([
      'complete_profile',
      'sync_notion_workspace',
      'ensure_profile',
      'repair_handoff',
    ]);
    expect(controlPlane.actions.at(-1)).toMatchObject({
      key: 'project:ACT-HV:legacy-handoffs',
      opportunityId: null,
      label: 'Reconcile 2 legacy pursued decisions for The Harvest as one reviewed GHL handoff batch.',
    });
    expect(controlPlane.projects.find(project => project.projectCode === 'ACT-GD')).toMatchObject({
      profileStatus: 'partial',
      evidenceSafeMatches: 1,
      ghlLinked: 1,
      notionLinked: 0,
      historicalWins: 1,
      attention: 2,
    });
  });
});
