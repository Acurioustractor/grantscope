export interface Entity {
  id: string;
  gs_id: string;
  entity_type: string;
  canonical_name: string;
  abn: string | null;
  acn: string | null;
  description: string | null;
  website: string | null;
  state: string | null;
  postcode: string | null;
  sector: string | null;
  sub_sector: string | null;
  tags: string[];
  source_datasets: string[];
  source_count: number;
  confidence: string;
  latest_revenue: number | null;
  latest_assets: number | null;
  latest_tax_payable: number | null;
  remoteness: string | null;
  lga_name: string | null;
  seifa_irsd_decile: number | null;
  financial_year: string | null;
  last_seen: string | null;
  updated_at: string | null;
  is_community_controlled: boolean | null;
}

export interface MvEntityStats {
  id: string;
  gs_id: string;
  canonical_name: string;
  entity_type: string;
  abn: string | null;
  source_count: number;
  outbound_relationships: number;
  inbound_relationships: number;
  total_relationships: number;
  total_outbound_amount: number;
  total_inbound_amount: number;
  outbound_types: string[] | null;
  inbound_types: string[] | null;
  type_breakdown: Record<string, { count: number; amount: number; direction: string }>;
  year_distribution: Record<string, number>;
  top_counterparty_share: number;
  distinct_counterparties: number;
}

export interface Relationship {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  amount: number | null;
  year: number | null;
  dataset: string;
  confidence: string;
  properties: Record<string, string | null>;
  start_date: string | null;
  end_date: string | null;
}

export interface ConnectedEntity {
  id: string;
  gs_id: string;
  canonical_name: string;
  entity_type: string;
}

export interface JusticeFundingRecord {
  id: string;
  recipient_name: string;
  recipient_abn: string | null;
  program_name: string;
  amount_dollars: number | null;
  sector: string | null;
  source: string;
  financial_year: string | null;
  location: string | null;
  project_description: string | null;
}

export interface PlaceContext {
  postcode: string;
  locality: string | null;
  state: string | null;
  remoteness: string | null;
  seifa_irsd_decile: number | null;
  seifa_irsd_score: number | null;
  entity_count: number;
}

export interface NdisSupplyRow {
  state_code: string;
  service_district_name: string;
  provider_count: number;
  report_date: string | null;
}

export interface NdisConcentrationRow {
  state_code: string;
  service_district_name: string;
  payment_share_top10_pct: number | null;
  payment_band: string | null;
  source_page_url: string | null;
  source_file_url: string | null;
  source_file_title: string | null;
}

export interface FoundationEnrichment {
  id: string;
  name: string;
  description: string | null;
  thematic_focus: string[];
  geographic_focus: string[];
  target_recipients: string[];
  giving_philosophy: string | null;
  application_tips: string | null;
  notable_grants: string[] | null;
  total_giving_annual: number | null;
  wealth_source: string | null;
  parent_company: string | null;
  board_members: string[] | null;
  endowment_size: number | null;
  giving_ratio: number | null;
}

export interface FoundationProgram {
  id: string;
  name: string;
  url: string | null;
  description: string | null;
  amount_min: number | null;
  amount_max: number | null;
  deadline: string | null;
  status: string;
  categories: string[];
  program_type: string | null;
  eligibility: string | null;
  application_process: string | null;
}

export interface CharityEnrichment {
  abn: string;
  name: string;
  charity_size: string | null;
  pbi: boolean | null;
  hpc: boolean | null;
  purposes: string[] | null;
  beneficiaries: string[] | null;
  operating_states: string[] | null;
}

export interface SocialEnterpriseEnrichment {
  id: string;
  name: string;
  org_type: string | null;
  certifications: string[] | null;
  sector: string[] | null;
  source_primary: string | null;
  target_beneficiaries: string[] | null;
  logo_url: string | null;
  business_model: string | null;
  website: string | null;
}

export interface AcncYear {
  ais_year: number;
  total_revenue: number | null;
  total_expenses: number | null;
  total_assets: number | null;
  net_surplus_deficit: number | null;
  donations_and_bequests: number | null;
  grants_donations_au: number | null;
  grants_donations_intl: number | null;
  employee_expenses: number | null;
  staff_fte: number | null;
  staff_volunteers: number | null;
  charity_size: string | null;
  revenue_from_government: number | null;
}

export interface AlmaIntervention {
  id: string;
  name: string;
  type: string;
}

export interface PlaceGeo {
  postcode: string;
  locality: string;
  state: string;
  remoteness_2021: string;
  lga_name: string | null;
  sa2_code: string | null;
  sa2_name: string | null;
}

export interface SeifaData {
  decile_national: number;
  score: number;
}

export interface GovernedProofBundle {
  subject_id: string;
  promotion_status: string;
  overall_confidence: number | null;
  output_context: Record<string, unknown> | null;
  capital_context?: Record<string, unknown> | null;
  evidence_context?: Record<string, unknown> | null;
  voice_context?: Record<string, unknown> | null;
  governance_context?: Record<string, unknown> | null;
  lifecycle_status?: string;
  review_status?: string;
  owner_system?: string;
  bundle_key?: string;
  id?: string;
  subject_type?: string;
  capital_confidence?: number | null;
  evidence_confidence?: number | null;
  voice_confidence?: number | null;
  governance_confidence?: number | null;
  freshness_at?: string | null;
  last_validated_at?: string | null;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EntityEnrichment {
  foundation: FoundationEnrichment | undefined;
  foundationPrograms: FoundationProgram[];
  charity: CharityEnrichment | undefined;
  socialEnterprise: SocialEnterpriseEnrichment | undefined;
  financialYears: AcncYear[];
  placeGeo: PlaceGeo | undefined;
  seifa: SeifaData | undefined;
  postcodeEntityCount: number;
  governedProofBundle: GovernedProofBundle | null;
  governedProofPack: { headline?: string; strengths: unknown[] } | null;
  governedProofStrengths: unknown[];
  justiceFunding: JusticeFundingRecord[];
  totalJusticeFunding: number;
  grants: Relationship[];
  jhOrg: { id: string; name: string; slug: string | null } | undefined;
  almaInterventions: AlmaIntervention[];
  almaInterventionCount: number;
  almaEvidenceCount: number;
  disabilityRelevant: boolean;
  ndisStateSupplyTotal: NdisSupplyRow | null;
  ndisStateDistricts: NdisSupplyRow[];
  ndisStateHotspots: NdisConcentrationRow[];
  ndisThinDistrictCount: number;
  ndisVeryThinDistrictCount: number;
  localDisabilityEnterpriseCount: number;
  localCommunityControlledCount: number;
  ndisSourceLink: string | null;
}

export interface WorkspaceContext {
  isPremium: boolean;
  workspaceOrgName: string | null;
  canEditWorkspace: boolean;
  workspaceShortlists: Array<{ id: string; name: string; is_default: boolean }>;
  workspaceMemberships: Array<Record<string, unknown>>;
  workspaceTasks: Array<Record<string, unknown>>;
}
