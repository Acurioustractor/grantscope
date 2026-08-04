import { describe, expect, it } from 'vitest';
import {
  deriveCommunityOperatingModel,
  type CommunityDetail,
  type CommunityFundingSummary,
  type DeployedAssetSummary,
  type LocalEntity,
} from './goods-community-detail';

const community: CommunityDetail = {
  id: 'community-1',
  community_name: 'TENNANT CREEK',
  state: 'NT',
  postcode: '0860',
  region_label: 'Barkly',
  service_region: null,
  remoteness: 'Remote Australia',
  lga_name: 'Barkly',
  priority: 'lead',
  demand_beds: 0,
  demand_washers: 0,
  assets_deployed: 146,
  land_council: null,
  local_government: null,
  main_language: null,
  estimated_population: null,
  estimated_households: null,
  nearest_staging_hub: null,
  freight_corridor: null,
  last_mile_method: null,
  total_govt_contract_value: null,
  total_justice_funding: null,
  total_foundation_grants: null,
  proof_line: null,
  story: null,
  data_quality_score: null,
  last_profiled_at: null,
  data_sources: null,
};

const authorityCandidate: LocalEntity = {
  id: 'entity-1',
  gs_id: 'AU-ABN-1',
  canonical_name: 'Local Aboriginal Corporation',
  entity_type: 'indigenous_corp',
  sector: 'Community',
  abn: '11111111111',
  is_community_controlled: true,
  postcode: '0860',
  lga_name: 'Barkly',
  source_count: 2,
};

const funding: CommunityFundingSummary = {
  total_funding: 46_880_444,
  community_controlled_funding: 10_170_528,
  entity_count: 101,
  community_controlled_count: 42,
  relationship_count: 90,
  seifa_irsd_decile: 1,
  remoteness: 'Remote Australia',
};

const assets: DeployedAssetSummary = {
  total: 146,
  overdue: 146,
  attributed: 0,
  latest_deployment_at: '2001-02-28T16:00:00Z',
  by_product: { bed: 146 },
  by_funder: { Unattributed: 146 },
  total_funded_aud: 0,
  recent: [],
};

describe('community operating model', () => {
  it('treats community-controlled organisations as possible authority holders, not consent', () => {
    const model = deriveCommunityOperatingModel({
      community,
      mappedBuyers: [],
      localEntities: [authorityCandidate],
      relationshipPeople: [{
        id: 'person-1',
        ghl_id: 'ghl-1',
        name: 'Local contact',
        email: null,
        organisation: 'Local Aboriginal Corporation',
        linked_organisation_name: 'Local Aboriginal Corporation',
        linked_organisation_gs_id: 'AU-ABN-1',
        last_contact_at: '2026-01-01T00:00:00Z',
        touchpoints: 4,
        suggested_actions: [],
        project_codes: ['ACT-GD'],
        source: 'CivicGraph organisation link',
      }],
      assets,
      deploymentBatches: [],
      signals: [],
      funding,
    });

    expect(model.authority.state).toBe('potential_holders');
    expect(model.authority.consent_recorded).toBe(false);
    expect(model.authority.summary).toContain('does not prove authority, consent or a mandate');
    expect(model.next_move.title).toBe('Confirm an authority-led asset check-in');
    expect(model.next_move.detail).toContain('146 overdue asset records');
    expect(model.evidence_gaps).toContain('funding attribution for deployed assets');
    expect(model.evidence_gaps).not.toContain('place-level public funding context');
  });

  it('prioritises a relationship path when a place has no known ACT people', () => {
    const model = deriveCommunityOperatingModel({
      community: { ...community, assets_deployed: 0, story: 'Community-approved account', data_sources: ['goods'] },
      mappedBuyers: [],
      localEntities: [],
      relationshipPeople: [],
      assets: { ...assets, total: 0, overdue: 0, attributed: 0, by_product: {}, by_funder: {} },
      deploymentBatches: [],
      signals: [],
      funding,
    });

    expect(model.authority.state).toBe('unverified');
    expect(model.next_move.title).toBe('Establish the relationship path before proposing work');
    expect(model.evidence_gaps).toContain('named relationship path through a local organisation');
  });
});
