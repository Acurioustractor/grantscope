import type { FundingPowerTheme } from '../components/funding-intelligence-utils';

export type SavedGrantWorkspaceRow = {
  id: string;
  grant_id: string;
  stars: number;
  color: string | null;
  stage: string;
  notes: string | null;
  updated_at: string;
  grant: {
    id: string;
    name: string;
    provider: string;
    program: string | null;
    program_type: string | null;
    amount_min: number | null;
    amount_max: number | null;
    closes_at: string | null;
    categories: string[] | null;
    focus_areas: string[] | null;
    source: string | null;
    geography: string | null;
    application_status: string | null;
    last_verified_at: string | null;
    url: string | null;
  };
};

export type SavedFoundationWorkspaceRow = {
  id: string;
  foundation_id: string;
  stars: number;
  stage: string;
  notes: string | null;
  last_contact_date: string | null;
  updated_at: string;
  alignment_score: number | null;
  alignment_reasons: string[] | null;
  foundation: {
    id: string;
    name: string;
    type: string | null;
    website: string | null;
    total_giving_annual: number | null;
    thematic_focus: string[] | null;
    geographic_focus: string[] | null;
    profile_confidence: string | null;
    enriched_at: string | null;
    giving_philosophy: string | null;
    application_tips: string | null;
    avg_grant_size: number | null;
    grant_range_min: number | null;
    grant_range_max: number | null;
    wealth_source: string | null;
  };
};

export type FoundationPowerProfile = {
  foundation_id: string;
  capital_holder_class: string;
  capital_source_class: string;
  reportable_in_power_map: boolean;
  openness_score: number | null;
  gatekeeping_score: number | null;
};

export type CharityCandidate = {
  abn: string;
  name: string;
  purposes: string[] | null;
  beneficiaries: string[] | null;
  operating_states: string[] | null;
  pbi: boolean | null;
  hpc: boolean | null;
  website: string | null;
  total_revenue: number | null;
  total_grants_given: number | null;
  has_enrichment: boolean | null;
  ben_aboriginal_tsi: boolean | null;
  ben_rural_regional_remote: boolean | null;
  ben_people_with_disabilities: boolean | null;
  ben_youth: boolean | null;
  readinessScore?: number;
  score?: number;
  reasons?: string[];
};

export type SocialEnterpriseCandidate = {
  id: string;
  name: string;
  org_type: string;
  state: string | null;
  sector: string[] | null;
  source_primary: string | null;
  target_beneficiaries: string[] | null;
  website: string | null;
  profile_confidence: string | null;
  geographic_focus: string[] | null;
  certifications: unknown[] | null;
  description: string | null;
  business_model: string | null;
  readinessScore?: number;
  score?: number;
  reasons?: string[];
};

export type BlindSpotRow = {
  postcode: string;
  state: string | null;
  remoteness: string | null;
  entity_count: number | null;
  total_funding: number | null;
  locality: string | null;
  lga_name: string | null;
};

export type FundingWorkspaceSearchParams = {
  lens?: string;
  state?: string;
  theme?: string;
};

export type PowerSearchLens = 'pressure' | 'alternatives' | 'captured';

export type PowerSearchRow = BlindSpotRow & {
  localCommunityControlledCount: number;
  localThemedEnterpriseCount: number;
  stateThemedCommunityOrgCount: number;
  localAlternativeCount: number;
  stateThinDistrictCount: number;
  stateVeryThinDistrictCount: number;
  stateMaxCapturePct: number | null;
  justiceRows: number;
  score: number;
  reasons: string[];
};

export type NdisSupplyRow = {
  state_code: string;
  service_district_name: string;
  provider_count: number;
};

export type NdisConcentrationRow = {
  state_code: string;
  service_district_name: string;
  support_class: string;
  payment_share_top10_pct: number | null;
  payment_band: string | null;
};

export type OrgProfileDetail = {
  id: string;
  name: string;
  description: string | null;
  mission: string | null;
  website: string | null;
  geographic_focus: string[] | null;
  org_type: string | null;
  projects: Array<Record<string, unknown>> | null;
};

export type GrantRelationShape = SavedGrantWorkspaceRow & {
  grant: SavedGrantWorkspaceRow['grant'] | SavedGrantWorkspaceRow['grant'][];
};

export type FoundationRelationShape = SavedFoundationWorkspaceRow & {
  foundation: SavedFoundationWorkspaceRow['foundation'] | SavedFoundationWorkspaceRow['foundation'][];
};
