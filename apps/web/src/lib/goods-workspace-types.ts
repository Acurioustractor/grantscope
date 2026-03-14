// Types for the Goods workspace data layer

export type GoodsWorkspaceMode = 'need' | 'buyer' | 'capital' | 'partner';
export type GoodsTargetType = 'buyer' | 'capital' | 'partner';
export type GoodsTrackedIdentityRole = 'commercial' | 'philanthropic' | 'community' | 'general';

export type GoodsAssetRow = {
  unique_id: string;
  id: string;
  name: string;
  product: string;
  community: string;
  place: string;
  gps: string;
  contact_household: string;
  paint: string;
  photo: string;
  number: string;
  notes: string;
  supply_date: string;
  last_checkin_date: string;
  created_time: string;
  qr_url: string;
};

export type GoodsCommunitySeed = {
  name: string;
  state: string;
  postcode: string;
  regionLabel: string;
  priorityNeed: 'critical' | 'high' | 'emerging';
  demandBeds: number;
  demandWashers: number;
  knownBuyer: string | null;
  keyPartnerNames: string[];
  proofLine: string;
  story: string;
  youthJobs: string;
};

export type GoodsBuyerSeed = {
  key: string;
  matchPattern: string;
  name: string;
  role: string;
  states: string[];
  route: string;
  relationshipStatus: 'active' | 'warm' | 'prospect';
  contactSurface: string;
  knownOrderSignal: string | null;
  remoteFootprint: string;
  productFit: string;
  procurementPath: string;
  nextAction: string;
};

export type GoodsCapitalSeed = {
  key: string;
  foundationPattern?: string;
  grantPattern?: string;
  name: string;
  instrumentType: 'grant' | 'loan' | 'catalytic' | 'co-investment' | 'blended';
  relationshipStatus: 'active' | 'warm' | 'prospect';
  stageFit: string[];
  contactSurface: string;
  knownSignal: string;
  nextAction: string;
};

export type GoodsPartnerSeed = {
  key: string;
  matchPattern?: string;
  name: string;
  role: string;
  states: string[];
  relationshipStatus: 'active' | 'warm' | 'prospect';
  knownSignal: string;
  nextAction: string;
};

export type PlaceFundingRow = {
  postcode: string;
  state: string | null;
  remoteness: string | null;
  entity_count: number | null;
  total_funding: number | null;
  locality: string | null;
  lga_name: string | null;
};

export type CommunityControlRow = {
  postcode: string | null;
  local_count: number;
};

export type NdisSupplyRow = {
  state_code: string;
  service_district_name: string;
  provider_count: number;
};

export type NdisCaptureRow = {
  state_code: string;
  service_district_name: string;
  payment_share_top10_pct: number | null;
};

export type EntityMatchRow = {
  id: string;
  gs_id: string | null;
  canonical_name: string;
  abn: string | null;
  website: string | null;
  state: string | null;
  entity_type: string | null;
  sector: string | null;
  sub_sector: string | null;
  description: string | null;
  source_count: number | null;
  source_datasets: string[] | null;
  is_community_controlled: boolean | null;
  remoteness: string | null;
  lga_name: string | null;
  latest_revenue: number | null;
  latest_assets: number | null;
};

export type NtCommunityProcurementSummaryRow = {
  community_id: string;
  community_name: string;
  region_label: string | null;
  service_region: string | null;
  land_council: string | null;
  postcode: string | null;
  is_official_remote_community: boolean;
  goods_focus_priority: string;
  goods_signal_name: string | null;
  goods_signal_type: string;
  known_buyer_name: string | null;
  entity_match_count: number | null;
  buyer_match_count: number | null;
  store_count: number | null;
  health_count: number | null;
  housing_count: number | null;
  council_count: number | null;
  other_service_count: number | null;
  community_controlled_match_count: number | null;
  top_buyer_names: string[] | null;
  needs_postcode_enrichment: boolean | null;
  has_goods_signal: boolean | null;
};

export type NtCommunityBuyerCrosswalkRow = {
  community_name: string;
  buyer_name: string;
  buyer_type: string;
  gs_id: string | null;
  abn: string | null;
  website: string | null;
  is_official_remote_community: boolean;
};

export type FoundationRow = {
  id: string;
  name: string;
  website: string | null;
  profile_confidence: string | null;
  total_giving_annual: number | null;
  thematic_focus: string[] | null;
  geographic_focus: string[] | null;
  giving_philosophy: string | null;
  avg_grant_size: number | null;
  grant_range_min: number | null;
  grant_range_max: number | null;
  application_tips: string | null;
  open_programs: string[] | null;
};

export type FoundationPowerRow = {
  foundation_id: string;
  capital_holder_class: string;
  capital_source_class: string;
  reportable_in_power_map: boolean;
  openness_score: number | null;
  gatekeeping_score: number | null;
};

export type GrantRow = {
  id: string;
  name: string;
  provider: string;
  amount_min: number | null;
  amount_max: number | null;
  closes_at: string | null;
  categories: string[] | null;
  focus_areas: string[] | null;
  source: string | null;
  url: string | null;
  geography: string | null;
  grant_type: string | null;
  application_status: string | null;
  last_verified_at: string | null;
};

export type SavedFoundationRow = {
  foundation_id: string;
  relationship_stage: string | null;
  notes: string | null;
  last_contact_date: string | null;
  alignment_score: number | null;
  alignment_reasons: string[] | null;
};

export type SavedGrantRow = {
  grant_id: string;
  stage: string;
  notes: string | null;
};

export type GoodsTrackedIdentitySource =
  | 'org_profile_abn'
  | 'org_profile_name'
  | 'env_abn'
  | 'env_name';

export type GoodsIdentityCandidate = {
  name: string | null;
  abn: string | null;
  trackedFrom: GoodsTrackedIdentitySource;
};

export type GoodsWorkflowStep = {
  id: string;
  label: string;
  description: string;
};

export type GoodsThesisPillar = {
  title: string;
  detail: string;
};

export type GoodsCommunityProof = {
  id: string;
  community: string;
  state: string;
  postcode: string;
  regionLabel: string;
  remoteness: string | null;
  lgaName: string | null;
  totalAssets: number;
  bedsDelivered: number;
  washersDelivered: number;
  supportSignals: number;
  staleAssets: number;
  demandBeds: number;
  demandWashers: number;
  latestCheckin: string | null;
  totalFunding: number | null;
  localEntityCount: number | null;
  localCommunityControlledCount: number;
  localNdisProviders: number | null;
  stateThinDistricts: number;
  stateCapturedDistricts: number;
  needLeverageScore: number;
  needReasons: string[];
  proofLine: string;
  story: string;
  youthJobs: string;
  keyPartnerNames: string[];
  knownBuyer: string | null;
};

export type GoodsNtCoverageGap = {
  community: string;
  regionLabel: string | null;
  serviceRegion: string | null;
  landCouncil: string | null;
  postcode: string | null;
  buyerMatchCount: number;
  communityControlledMatchCount: number;
  storeCount: number;
  healthCount: number;
  housingCount: number;
  councilCount: number;
  otherServiceCount: number;
  topBuyerNames: string[];
  knownBuyerName: string | null;
  hasGoodsSignal: boolean;
  goodsSignalName: string | null;
  needsPostcodeEnrichment: boolean;
};

export type GoodsNtBuyerReach = {
  buyerName: string;
  buyerType: string;
  coverageCount: number;
  officialCommunityCount: number;
  sampleCommunities: string[];
  gsId: string | null;
  abn: string | null;
  website: string | null;
};

export type GoodsNtCommunitySweep = {
  officialCommunityCount: number;
  officialCoveredCount: number;
  officialUncoveredCount: number;
  officialMissingPostcodeCount: number;
  goodsSignalCount: number;
  weakCoverage: GoodsNtCoverageGap[];
  topBuyerReach: GoodsNtBuyerReach[];
  dataNeeds: string[];
};

export type GoodsLifecycleProductStat = {
  productFamily: 'beds' | 'washers';
  label: string;
  assetCount: number;
  medianObservedAgeDays: number | null;
  p90ObservedAgeDays: number | null;
  staleOver365Count: number;
  staleOver730Count: number;
  supportSignalCount: number;
  failureSignalCount: number;
  affectedAssetCount: number;
  repairRequestCount: number;
  replacementRequestCount: number;
  dumpRiskCount: number;
  safetyRiskCount: number;
  topFailureCause: string | null;
  embodiedPlasticKg: number | null;
  insight: string;
};

export type GoodsLifecycleEvidencePoint = {
  title: string;
  value: string;
  detail: string;
};

export type GoodsLifecycleData = {
  productStats: GoodsLifecycleProductStat[];
  evidencePoints: GoodsLifecycleEvidencePoint[];
  researchNeeds: string[];
  landfillPressureSummary: string;
};

export type GoodsLifecycleTicketRow = {
  asset_id: string;
  category: string | null;
  priority: string | null;
  status: string | null;
  issue_description: string | null;
  submit_date: string | null;
};

export type GoodsLifecycleCheckinRow = {
  asset_id: string;
  status: string | null;
  comments: string | null;
  checkin_date: string | null;
};

export type GoodsLifecycleAlertRow = {
  asset_id: string;
  type: string | null;
  severity: string | null;
  details: string | null;
  alert_date: string | null;
  resolved: boolean | null;
};

export type GoodsLifecycleMetadata = {
  conditionStatus?: string;
  serviceability?: string;
  failureCause?: string;
  outcomeWanted?: string;
  oldItemDisposition?: string;
  safetyRisk?: boolean;
  observedAt?: string;
};

export type GoodsLifecycleSignals = {
  tickets: GoodsLifecycleTicketRow[];
  checkins: GoodsLifecycleCheckinRow[];
  alerts: GoodsLifecycleAlertRow[];
};

export type GoodsBuyerTarget = {
  id: string;
  name: string;
  gsId: string | null;
  state: string | null;
  role: string;
  relationshipStatus: 'active' | 'warm' | 'prospect';
  remoteFootprint: string;
  productFit: string;
  procurementPath: string;
  contactSurface: string;
  nextAction: string;
  orderSignal: string | null;
  buyerPlausibilityScore: number;
  needLeverageScore: number;
  reasons: string[];
  relationshipNote: string;
  website: string | null;
  matchedEntityType: string | null;
  matchedCommunityControl: boolean;
  matchedSourceCount: number | null;
  ntCommunityReach: number;
  ntOfficialCommunityReach: number;
};

export type GoodsCapitalTarget = {
  id: string;
  name: string;
  foundationId: string | null;
  grantId: string | null;
  sourceKind: 'foundation' | 'grant';
  instrumentType: 'grant' | 'loan' | 'catalytic' | 'co-investment' | 'blended';
  relationshipStatus: 'active' | 'warm' | 'prospect';
  stageFit: string[];
  contactSurface: string;
  nextAction: string;
  capitalFitScore: number;
  opennessScore: number | null;
  gatekeepingScore: number | null;
  amountSignal: string;
  reasons: string[];
  thematicFocus: string[];
  geographicFocus: string[];
  deadline: string | null;
  relationshipNote: string;
  url: string | null;
};

export type GoodsPartnerTarget = {
  id: string;
  name: string;
  gsId: string | null;
  role: string;
  state: string | null;
  relationshipStatus: 'active' | 'warm' | 'prospect';
  contactSurface: string;
  nextAction: string;
  communityControlled: boolean;
  partnerScore: number;
  reasons: string[];
  website: string | null;
  relationshipNote: string;
};

export type GoodsCapitalPathway = {
  id: string;
  title: string;
  summary: string;
  targetIds: string[];
};

export type GoodsTrackedIdentity = {
  id: string;
  name: string;
  abn: string | null;
  gsId: string | null;
  entityId: string | null;
  entityType: string | null;
  state: string | null;
  website: string | null;
  matchStatus: 'matched' | 'pending';
  trackedFrom: GoodsTrackedIdentitySource;
  identityRole: GoodsTrackedIdentityRole;
};

export type GoodsOutboundIdentityRecommendation = {
  targetType: GoodsTargetType;
  identityId: string | null;
  strategyLabel: string;
  rationale: string;
};

export type GoodsWorkspaceData = {
  orgName: string;
  orgAbn: string | null;
  ghl: {
    locationId: string | null;
    opportunitiesListUrl: string | null;
  };
  primaryTrackedIdentity: GoodsTrackedIdentity | null;
  trackedIdentities: GoodsTrackedIdentity[];
  outboundIdentityRecommendations: Record<GoodsTargetType, GoodsOutboundIdentityRecommendation>;
  workspaceTitle: string;
  defaultMode: GoodsWorkspaceMode;
  workflow: GoodsWorkflowStep[];
  thesis: {
    headline: string;
    summary: string;
    pillars: GoodsThesisPillar[];
    currentStats: Array<{ label: string; value: string; detail: string }>;
  };
  buyerTargets: GoodsBuyerTarget[];
  capitalTargets: GoodsCapitalTarget[];
  partnerTargets: GoodsPartnerTarget[];
  communities: GoodsCommunityProof[];
  ntSweep: GoodsNtCommunitySweep;
  lifecycle: GoodsLifecycleData;
  capitalPathways: GoodsCapitalPathway[];
  topMoves: Array<{ title: string; detail: string }>;
  sourcePaths: string[];
};

export type GoodsExportRow = {
  target_type: string;
  target_name: string;
  score: number;
  relationship_status: string;
  next_action: string;
  contact_surface: string;
  why_plausible: string;
  region_focus: string;
  community_focus: string;
  community_postcode: string;
  community_state: string;
  recommended_pipeline: string;
  recommended_stage: string;
  source_url: string;
  source_org_name: string;
  source_org_abn: string;
  source_entity_gs_id: string;
};

export type GoodsCrmTargetPayload = {
  targetType: GoodsTargetType;
  targetId: string;
  organizationName: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  regionFocus: string;
  relationshipStatus: string;
  nextAction: string;
  contactSurface: string;
  whyPlausible: string;
  tags: string[];
  sourceUrl?: string;
  communityFocusName?: string;
  communityFocusPostcode?: string;
  communityFocusState?: string;
  suggestedPipelineLabel?: string;
  suggestedStageLabel?: string;
  sourceOrgName: string;
  sourceOrgAbn?: string;
  sourceEntityGsId?: string;
  sourceIdentityName: string;
};
