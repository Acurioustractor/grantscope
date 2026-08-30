import { describe, expect, it } from 'vitest';
import {
  FUNDING_GHL_FIELDS,
  FUNDING_GHL_STAGES,
  buildFundingGhlContractSnapshot,
  buildFundingGhlCustomFields,
  fundingDecisionForGhlStage,
} from '@/lib/services/funding-ghl-contract';

describe('funding GHL operating contract', () => {
  it('requires the canonical pipeline, stages, fields and a native owner', () => {
    const fields = FUNDING_GHL_FIELDS.map(field => ({ id: `field-${field.key}`, name: field.name }));
    const snapshot = buildFundingGhlContractSnapshot({
      pipelinesPayload: {
        pipelines: [{
          id: 'grants',
          name: 'Grants',
          stages: FUNDING_GHL_STAGES.map((name, index) => ({ id: `stage-${index}`, name })),
        }],
      },
      fields,
      users: [{ id: 'ben', name: 'Benjamin Knight', email: 'benjamin@act.place' }],
    });
    expect(snapshot.ready).toBe(true);
    expect(snapshot.initialStageId).toBe('stage-0');
    expect(snapshot.missingFields).toEqual([]);
    expect(snapshot.missingStages).toEqual([]);
  });

  it('reports missing configuration instead of silently degrading', () => {
    const snapshot = buildFundingGhlContractSnapshot({
      pipelinesPayload: { pipelines: [{ id: 'grants', name: 'Grants', stages: [] }] },
      fields: [],
      users: [],
    });
    expect(snapshot.ready).toBe(false);
    expect(snapshot.missingStages).toHaveLength(FUNDING_GHL_STAGES.length);
    expect(snapshot.missingFields).toHaveLength(FUNDING_GHL_FIELDS.length);
  });

  it('builds only governed, non-empty custom field values', () => {
    const fields = buildFundingGhlCustomFields(
      { projectCode: 'project', sourceRef: 'source', notionUrl: 'notion' },
      { projectCode: 'ACT-GD', sourceRef: 'grantscope:alma_funding_opportunities:123', notionUrl: null }
    );
    expect(fields).toEqual([
      { id: 'project', fieldValue: 'ACT-GD' },
      { id: 'source', fieldValue: 'grantscope:alma_funding_opportunities:123' },
    ]);
  });

  it('maps every live Grants stage into the decision projection', () => {
    expect(fundingDecisionForGhlStage('Grant Opportunity Identified')).toBe('pursuing');
    expect(fundingDecisionForGhlStage('Application In Progress')).toBe('applied');
    expect(fundingDecisionForGhlStage('Grant Submitted')).toBe('submitted');
    expect(fundingDecisionForGhlStage('Grant Awarded')).toBe('won');
    expect(fundingDecisionForGhlStage('Grant Declined')).toBe('lost');
    expect(fundingDecisionForGhlStage('Unknown')).toBeNull();
  });
});
