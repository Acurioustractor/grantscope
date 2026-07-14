import { describe, expect, it } from 'vitest';
import {
  BARKLY_INITIATIVES,
  dedupeBarklyOrganisations,
  deriveBarklyFieldSummary,
  type BarklyCommunity,
} from './act-barkly-field';

describe('Barkly Regional Field', () => {
  it('keeps the official May 2026 progress groups complete and mutually exclusive', () => {
    expect(BARKLY_INITIATIVES).toHaveLength(28);
    expect(new Set(BARKLY_INITIATIVES.map((initiative) => initiative.number)).size).toBe(28);
    expect(BARKLY_INITIATIVES.filter((initiative) => initiative.status === 'underway')).toHaveLength(10);
    expect(BARKLY_INITIATIVES.filter((initiative) => initiative.status === 'ongoing')).toHaveLength(5);
    expect(BARKLY_INITIATIVES.filter((initiative) => initiative.status === 'ready_for_closure')).toHaveLength(3);
    expect(BARKLY_INITIATIVES.filter((initiative) => initiative.status === 'complete')).toHaveLength(10);
  });

  it('deduplicates ABN and ORIC records by name while preferring the ABN identity', () => {
    const organisations = dedupeBarklyOrganisations([
      {
        id: 'oric-id',
        gs_id: 'AU-ORIC-10267',
        canonical_name: 'Barkly Alliance Aboriginal Corporation',
        abn: null,
        entity_type: 'indigenous_corp',
        sector: 'Community',
        postcode: '0860',
        is_community_controlled: true,
        source_count: 1,
      },
      {
        id: 'abn-id',
        gs_id: 'AU-ABN-65479980769',
        canonical_name: 'Barkly Alliance Aboriginal Corporation',
        abn: '65479980769',
        entity_type: 'indigenous_corp',
        sector: 'Indigenous',
        postcode: '0860',
        is_community_controlled: true,
        source_count: 2,
      },
    ]);

    expect(organisations).toHaveLength(1);
    expect(organisations[0]?.gsId).toBe('AU-ABN-65479980769');
    expect(organisations[0]?.communityControlled).toBe(true);
  });

  it('keeps regional evidence relational and does not infer consent from organisations', () => {
    const community: BarklyCommunity = {
      id: 'tennant-creek',
      name: 'TENNANT CREEK',
      state: 'NT',
      postcode: '0860',
      remoteness: 'Remote Australia',
      population: null,
      need: 0,
      assets: 146,
      buyers: 0,
      communityControlledOrganisations: 0,
      dataQuality: 0,
      sourceCount: 0,
    };
    const summary = deriveBarklyFieldSummary({
      communities: [community],
      organisations: [{
        id: 'entity-1',
        gsId: 'AU-ABN-1',
        name: 'Local Aboriginal Corporation',
        abn: '11111111111',
        entityType: 'indigenous_corp',
        sector: 'Community',
        postcode: '0860',
        communityControlled: true,
        sourceCount: 2,
      }],
      relationships: [],
      justiceRecords: [],
      contracts: [],
    });

    expect(summary.recordedAssets).toBe(146);
    expect(summary.communityControlledOrganisationCount).toBe(1);
    expect(summary.nextMove.title).toBe('Confirm a Barkly authority and relationship path');
    expect(summary.evidenceGaps).toContain('Barkly authority, consent and decision rights are not recorded in CivicGraph');
  });
});
