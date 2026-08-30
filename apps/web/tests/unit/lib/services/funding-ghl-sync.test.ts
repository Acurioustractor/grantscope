import { describe, expect, it } from 'vitest';
import {
  fundingGhlOpportunityChanged,
  ghlCustomFieldValue,
  normalizeFundingGhlOpportunity,
} from '@/lib/services/funding-ghl-sync';

const contract = {
  pipelineId: 'pipeline-grants',
  pipelineName: 'Grants',
  stageIds: {
    'Grant Opportunity Identified': 'stage-identified',
    'Application In Progress': 'stage-progress',
  },
  fieldIds: { projectCode: 'field-project' },
};

describe('funding GHL scheduled sync', () => {
  it('reads the custom-field shapes returned by different GHL endpoints', () => {
    expect(ghlCustomFieldValue([{ id: 'a', fieldValueString: 'ACT-ALMA' }], 'a')).toBe('ACT-ALMA');
    expect(ghlCustomFieldValue([{ id: 'a', fieldValue: 'ACT-GD' }], 'a')).toBe('ACT-GD');
    expect(ghlCustomFieldValue([{ id: 'a', field_value: 'ACT-JH' }], 'a')).toBe('ACT-JH');
    expect(ghlCustomFieldValue([{ id: 'a', value: ['ACT', 'ALMA'] }], 'a')).toBe('ACT, ALMA');
  });

  it('normalizes a remote opportunity into the canonical mirror and contact link', () => {
    const row = normalizeFundingGhlOpportunity({
      opportunity: {
        id: 'opp-1',
        name: 'Community-led alternatives fund',
        contact: { id: 'contact-1', name: 'Example Foundation' },
        pipelineId: 'pipeline-grants',
        pipelineStageId: 'stage-progress',
        status: 'open',
        monetaryValue: '75000',
        assignedTo: 'owner-1',
        customFields: [{ id: 'field-project', fieldValue: 'ACT-ALMA' }],
        updatedAt: '2026-08-30T01:02:03Z',
      },
      contract,
      syncedAt: '2026-08-30T02:00:00.000Z',
    });
    expect(row).toMatchObject({
      ghl_id: 'opp-1',
      ghl_contact_id: 'contact-1',
      stage_name: 'Application In Progress',
      monetary_value: 75000,
      project_code: 'ACT-ALMA',
      ghl_updated_at: '2026-08-30T01:02:03.000Z',
    });
  });

  it('does not preserve a legacy local project code when GHL lacks governed evidence', () => {
    const row = normalizeFundingGhlOpportunity({
      opportunity: { id: 'opp-legacy', pipelineStageId: 'stage-identified' },
      contract,
      syncedAt: '2026-08-30T02:00:00.000Z',
    });
    expect(row?.project_code).toBeNull();
  });

  it('is idempotent but detects operational stage changes', () => {
    const remote = normalizeFundingGhlOpportunity({
      opportunity: {
        id: 'opp-1',
        name: 'A grant',
        pipelineId: 'pipeline-grants',
        pipelineStageId: 'stage-identified',
        status: 'open',
        monetaryValue: 100,
        updatedAt: '2026-08-30T01:00:00Z',
      },
      contract,
      syncedAt: '2026-08-30T02:00:00Z',
    });
    expect(remote).not.toBeNull();
    if (!remote) return;
    const local = {
      ghl_id: remote.ghl_id,
      ghl_contact_id: remote.ghl_contact_id,
      ghl_pipeline_id: remote.ghl_pipeline_id,
      ghl_stage_id: remote.ghl_stage_id,
      name: remote.name,
      status: remote.status,
      monetary_value: remote.monetary_value,
      assigned_to: remote.assigned_to,
      ghl_updated_at: remote.ghl_updated_at,
      project_code: remote.project_code,
      sync_status: 'synced',
    };
    expect(fundingGhlOpportunityChanged(remote, local)).toBe(false);
    expect(fundingGhlOpportunityChanged({ ...remote, ghl_stage_id: 'stage-progress' }, local)).toBe(true);
    expect(fundingGhlOpportunityChanged(remote, { ...local, sync_status: 'deleted' })).toBe(true);
  });
});
