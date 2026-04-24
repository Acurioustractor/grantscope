'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState, useTransition } from 'react';
import type { GoodsMapLayer } from './goods-community-map';

const GoodsCommunityMap = dynamic(
  () => import('./goods-community-map').then((module) => ({ default: module.GoodsCommunityMap })),
  {
    ssr: false,
    loading: () => (
      <div className="border-4 border-bauhaus-black bg-white p-6 min-h-[440px] flex items-center justify-center">
        <div className="text-bauhaus-muted font-black text-sm uppercase tracking-widest animate-pulse">
          Loading Goods map...
        </div>
      </div>
    ),
  },
);

export type SearchMode = 'need-led' | 'buyer-led' | 'capital-led' | 'partner-led';

export interface GoodsCommunityRow {
  id: string;
  community_name: string;
  state: string | null;
  postcode: string | null;
  lga_name: string | null;
  region_label: string | null;
  service_region: string | null;
  land_council: string | null;
  remoteness: string | null;
  latitude: number | null;
  longitude: number | null;
  priority: string | null;
  signal_type: string | null;
  signal_source: string | null;
  demand_beds: number | null;
  demand_washers: number | null;
  demand_fridges: number | null;
  demand_mattresses: number | null;
  assets_deployed: number | null;
  assets_active: number | null;
  assets_overdue: number | null;
  latest_checkin_date: string | null;
  known_buyer_name: string | null;
  buyer_entity_count: number | null;
  store_count: number | null;
  health_service_count: number | null;
  housing_org_count: number | null;
  council_count: number | null;
  community_controlled_org_count: number | null;
  total_local_entities: number | null;
  total_govt_contract_value: number | null;
  total_justice_funding: number | null;
  total_foundation_grants: number | null;
  ndis_provider_count: number | null;
  ndis_thin_market: boolean | null;
  proof_line: string | null;
  story: string | null;
  youth_employment_angle: string | null;
  data_quality_score: number | null;
  updated_at: string | null;
}

export interface GoodsProcurementEntityRow {
  id: string;
  community_id: string | null;
  gs_id: string | null;
  entity_name: string | null;
  abn: string | null;
  entity_type: string | null;
  buyer_role: string | null;
  procurement_method: string | null;
  estimated_annual_spend: number | null;
  current_supplier: string | null;
  contract_cycle: string | null;
  relationship_status: string | null;
  contact_surface: string | null;
  product_fit: string[] | null;
  fit_score: number | null;
  next_action: string | null;
  govt_contract_count: number | null;
  govt_contract_value: number | null;
  is_community_controlled: boolean | null;
  website: string | null;
  updated_at: string | null;
}

export interface GoodsProcurementSignalRow {
  id: string;
  signal_type: string | null;
  priority: string | null;
  community_id: string | null;
  title: string | null;
  description: string | null;
  estimated_value: number | null;
  estimated_units: number | null;
  products_needed: string[] | null;
  funding_confidence: string | null;
  status: string | null;
  action_notes: string | null;
  source_agent: string | null;
  updated_at: string | null;
  created_at: string | null;
}

export interface GoodsFoundationRow {
  id: string;
  name: string | null;
  type: string | null;
  website: string | null;
  description: string | null;
  total_giving_annual: number | null;
  avg_grant_size: number | null;
  thematic_focus: string[] | null;
  geographic_focus: string[] | null;
  profile_confidence: string | null;
  open_programs: unknown;
}

export interface GoodsGrantRow {
  id: string;
  name: string | null;
  provider: string | null;
  url: string | null;
  amount_min: number | null;
  amount_max: number | null;
  closes_at: string | null;
  categories: string[] | null;
  focus_areas: string[] | null;
  geography: string | null;
  status: string | null;
  grant_type: string | null;
  program_type: string | null;
  last_verified_at: string | null;
}

export interface NtCommunityCoverageRow {
  community_name: string | null;
  region_label: string | null;
  postcode: string | null;
  goods_focus_priority: string | null;
  known_buyer_name: string | null;
  entity_match_count: number | null;
  buyer_match_count: number | null;
  store_count: number | null;
  health_count: number | null;
  housing_count: number | null;
  council_count: number | null;
  community_controlled_match_count: number | null;
  needs_postcode_enrichment: boolean | null;
}

export interface GoodsGhlPipelineStageRow {
  stage_name: string | null;
  stage_count: number | null;
  stage_value: number | null;
}

export interface GoodsGhlOpportunityRow {
  ghl_id: string | null;
  name: string | null;
  stage_name: string | null;
  status: string | null;
  monetary_value: number | null;
  assigned_to: string | null;
  ghl_contact_id: string | null;
  updated_at: string | null;
}

export interface GoodsBuyerGhlOpportunityRow {
  name: string | null;
  stage_name: string | null;
  status: string | null;
  monetary_value: number | null;
  assigned_to: string | null;
  ghl_contact_id: string | null;
  updated_at: string | null;
}

export interface GoodsBuyerGhlContactRow {
  ghl_id: string | null;
  company_name: string | null;
  engagement_status: string | null;
  last_contact_date: string | null;
  website: string | null;
  updated_at: string | null;
}

export interface GoodsCommunityPipelineRow {
  name: string | null;
  stage_name: string | null;
  status: string | null;
  monetary_value: number | null;
  assigned_to: string | null;
  updated_at: string | null;
}

export interface GoodsGhlSyncRow {
  id: string;
  operation: string | null;
  status: string | null;
  records_processed: number | null;
  records_created: number | null;
  records_updated: number | null;
  records_failed: number | null;
  triggered_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  metadata: unknown;
}

interface GoodsWorkspaceClientProps {
  userEmail: string | null;
  orgProfile: {
    id: string;
    name: string | null;
    abn: string | null;
    subscription_plan: string | null;
  } | null;
  ghlDefaultOwnerConfigured: boolean;
  ghlDefaultOwnerLabel: string | null;
  communities: GoodsCommunityRow[];
  buyers: GoodsProcurementEntityRow[];
  signals: GoodsProcurementSignalRow[];
  foundations: GoodsFoundationRow[];
  grants: GoodsGrantRow[];
  ntCoverageRows: NtCommunityCoverageRow[];
  goodsPipelineStages: GoodsGhlPipelineStageRow[];
  goodsPipelineOpportunities: GoodsGhlOpportunityRow[];
  goodsBuyerPipelineOpportunities: GoodsBuyerGhlOpportunityRow[];
  goodsBuyerContacts: GoodsBuyerGhlContactRow[];
  goodsCommunityPipelineRows: GoodsCommunityPipelineRow[];
  goodsPushLog: GoodsGhlSyncRow[];
}

type CapitalTarget = {
  key: string;
  source: 'foundation' | 'grant';
  name: string;
  provider: string;
  score: number;
  instrumentType: string;
  openness: 'open' | 'relationship-led' | 'mixed';
  amountHint: string;
  regionFit: string;
  reason: string;
  link: string | null;
};

type BuyerOutreachTarget = {
  key: string;
  type: 'buyer';
  name: string;
  company: string;
  community: string | null;
  state: string | null;
  score: number;
  reason: string;
  nextAction: string;
  recommendedAsk: string;
  targetSummary: string;
  contactSurface: string | null;
  relationshipStatus: string | null;
  link: string | null;
  crmPreviewOperation: 'create-opportunity' | 'update-opportunity';
  crmPreviewSummary: string;
  tags: string[];
};

type BuyerRankedEntry = {
  buyer: GoodsProcurementEntityRow;
  community: GoodsCommunityRow | undefined;
  score: { score: number; reason: string };
};

type CanonicalBuyerCard = {
  key: string;
  name: string;
  abn: string | null;
  score: number;
  reasons: string[];
  nextAction: string;
  contactSurface: string | null;
  relationshipStatus: string | null;
  link: string | null;
  contractCount: number;
  contractValue: number;
  roles: string[];
  communities: Array<{
    id: string;
    name: string;
    state: string | null;
  }>;
  primaryCommunity: GoodsCommunityRow | undefined;
  communityCount: number;
  matchedRows: number;
  representativeEntry: BuyerRankedEntry;
  isCommunityControlled: boolean;
};

type BuyerReadinessBucket = 'ready-now' | 'relationship-path' | 'contact-gap';

type BuyerPipelineCard = CanonicalBuyerCard & {
  readiness: BuyerReadinessBucket;
  readinessLabel: string;
  readinessSummary: string;
  readinessScore: number;
  buyerOpportunityStage: string | null;
  buyerOpportunityAssignedTo: string | null;
  buyerOpportunityUpdatedAt: string | null;
  buyerOpportunityValue: number;
  communityPipelineStage: string | null;
  communityPipelineAssignedTo: string | null;
  communityPipelineUpdatedAt: string | null;
  communityPipelineValue: number;
  engagementStatus: string | null;
  lastContactDate: string | null;
  outcomeSummary: string;
  outcomeBoost: number;
};

type CapitalOutreachTarget = {
  key: string;
  type: 'capital';
  name: string;
  company: string;
  community: string | null;
  state: string | null;
  score: number;
  reason: string;
  nextAction: string;
  recommendedAsk: string;
  targetSummary: string;
  link: string | null;
  tags: string[];
  source: CapitalTarget['source'];
  instrumentType: string;
  openness: CapitalTarget['openness'];
};

type PartnerOutreachTarget = {
  key: string;
  type: 'partner';
  name: string;
  company: string;
  community: string | null;
  state: string | null;
  score: number;
  reason: string;
  nextAction: string;
  recommendedAsk: string;
  targetSummary: string;
  tags: string[];
};

type OutreachPushTarget =
  | BuyerOutreachTarget
  | CapitalOutreachTarget
  | PartnerOutreachTarget;

const MODE_LABELS: Record<SearchMode, string> = {
  'need-led': 'Need-led',
  'buyer-led': 'Buyer-led',
  'capital-led': 'Capital-led',
  'partner-led': 'Partner-led',
};

const BUYER_ANCHOR_NAMES = [
  'centrecorp',
  'centrebuild',
  'outback stores',
  'alpa',
  'arnhem land progress',
  'miwatj',
];

const GOODS_KEYWORDS = [
  'bed',
  'mattress',
  'washer',
  'washing',
  'fridge',
  'refrigerat',
  'whitegoods',
  'household',
  'housing',
  'manufacturing',
  'community',
  'indigenous',
  'remote',
  'social enterprise',
  'youth',
  'employment',
  'circular',
];

const GOODS_ADMIN_BASE_URL = 'https://www.goodsoncountry.com/admin';
const GOODS_QBE_PROGRAM_URL = `${GOODS_ADMIN_BASE_URL}/qbe-program`;
const GOODS_QBE_ACTIONS_URL = `${GOODS_ADMIN_BASE_URL}/qbe-actions`;

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function money(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${Math.round(value).toLocaleString()}`;
}

function dateLabel(value: string | null): string {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function dateTimeLabel(value: string | null): string {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function normalise(value: string | null | undefined): string {
  return (value || '').toLowerCase().trim();
}

function roleWeight(role: string | null): number {
  switch (normalise(role)) {
    case 'store':
      return 18;
    case 'housing_provider':
      return 20;
    case 'health_service':
      return 14;
    case 'council':
      return 13;
    case 'land_council':
      return 16;
    case 'community_org':
      return 12;
    case 'government':
      return 10;
    case 'education':
      return 9;
    default:
      return 3;
  }
}

function needScore(community: GoodsCommunityRow): { score: number; reason: string } {
  const demandBeds = toNumber(community.demand_beds);
  const demandWashers = toNumber(community.demand_washers);
  const demandFridges = toNumber(community.demand_fridges);
  const demandMattresses = toNumber(community.demand_mattresses);
  const demandTotal = demandBeds + demandWashers + demandFridges + demandMattresses;
  const overdue = toNumber(community.assets_overdue);
  const deployed = toNumber(community.assets_deployed);
  const buyers = toNumber(community.buyer_entity_count);
  const ccPartners = toNumber(community.community_controlled_org_count);
  const isNt = normalise(community.state) === 'nt';
  const remoteWeight = normalise(community.remoteness).includes('very remote')
    ? 16
    : normalise(community.remoteness).includes('remote')
      ? 10
      : 2;
  const thinMarketWeight = community.ndis_thin_market ? 8 : 0;
  const missingBuyerWeight = buyers === 0 ? 20 : Math.max(0, 10 - buyers);
  const lowCoveragePenalty = deployed === 0 ? 18 : Math.max(0, 8 - deployed);
  const score = Math.round(
    demandTotal * 1.7 +
      overdue * 12 +
      missingBuyerWeight +
      lowCoveragePenalty +
      remoteWeight +
      thinMarketWeight +
      (isNt ? 10 : 3) +
      ccPartners * 1.2
  );

  const parts: string[] = [];
  if (demandTotal > 0) parts.push(`${demandTotal} requested units`);
  if (overdue > 0) parts.push(`${overdue} overdue assets`);
  if (buyers === 0) parts.push('no known buyer coverage');
  if (isNt) parts.push('NT priority lane');
  if (thinMarketWeight > 0) parts.push('NDIS thin market pressure');
  return { score, reason: parts.join(' • ') || 'baseline signal' };
}

function buyerPlausibilityScore(buyer: GoodsProcurementEntityRow, community: GoodsCommunityRow | undefined): { score: number; reason: string } {
  const fit = toNumber(buyer.fit_score);
  const contracts = toNumber(buyer.govt_contract_count);
  const contractValue = toNumber(buyer.govt_contract_value);
  const hasContact = buyer.contact_surface ? 8 : 0;
  const hasNextAction = buyer.next_action ? 6 : 0;
  const relationship = normalise(buyer.relationship_status);
  const relationshipWeight = relationship === 'active' ? 12 : relationship === 'warm' ? 8 : relationship === 'cold' ? 2 : 4;
  const anchorHit = BUYER_ANCHOR_NAMES.some((name) => normalise(buyer.entity_name).includes(name)) ? 25 : 0;
  const communityWeight = community && normalise(community.state) === 'nt' ? 8 : 3;
  const products = (buyer.product_fit || []).join(' ').toLowerCase();
  const productWeight = ['bed', 'mattress', 'washer', 'fridge', 'whitegoods', 'housing'].reduce((acc, token) => {
    return products.includes(token) ? acc + 3 : acc;
  }, 0);
  const score = Math.round(
    fit +
      roleWeight(buyer.buyer_role) +
      Math.min(contracts * 1.5, 15) +
      Math.min(contractValue / 250_000, 20) +
      hasContact +
      hasNextAction +
      relationshipWeight +
      anchorHit +
      communityWeight +
      productWeight +
      (buyer.is_community_controlled ? 6 : 0)
  );

  const reason = [
    buyer.buyer_role ? `${buyer.buyer_role.replace('_', ' ')} role` : null,
    contracts > 0 ? `${contracts} contract records` : null,
    hasContact ? 'contact surface visible' : 'contact surface missing',
    anchorHit > 0 ? 'known remote buyer anchor' : null,
  ]
    .filter(Boolean)
    .join(' • ');

  return { score, reason: reason || 'scored from baseline fit and relationship status' };
}

function canonicalBuyerKey(buyer: GoodsProcurementEntityRow): string {
  const abn = (buyer.abn || '').replace(/\D/g, '');
  if (abn) return `abn:${abn}`;
  const name = normalise(buyer.entity_name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (name) return `name:${name}`;
  return `buyer:${buyer.id}`;
}

function relationshipPriority(status: string | null | undefined): number {
  switch (normalise(status)) {
    case 'active':
      return 5;
    case 'warm':
      return 4;
    case 'prospect':
      return 3;
    case 'reviewing':
      return 2;
    case 'cold':
      return 1;
    default:
      return 0;
  }
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function roleLabel(role: string): string {
  return role.replace(/_/g, ' ');
}

function buyerReadinessMeta(buyer: CanonicalBuyerCard): {
  readiness: BuyerReadinessBucket;
  readinessLabel: string;
  readinessSummary: string;
  readinessScore: number;
} {
  const relationship = normalise(buyer.relationshipStatus);
  const hasDirectContact = Boolean(buyer.contactSurface);
  const hasWebsite = Boolean(buyer.link);
  const hasWarmPath = relationship === 'active' || relationship === 'warm' || relationship === 'prospect';

  if (hasDirectContact) {
    return {
      readiness: 'ready-now',
      readinessLabel: 'Ready now',
      readinessSummary: 'Direct contact path visible. Push into live outreach this week.',
      readinessScore: 30,
    };
  }

  if (hasWarmPath || hasWebsite) {
    return {
      readiness: 'relationship-path',
      readinessLabel: 'Needs path',
      readinessSummary: hasWarmPath
        ? 'Relationship signal exists. Use a warm intro or named path before broad outreach.'
        : 'Website visible, but direct contact still needs to be found.',
      readinessScore: 18,
    };
  }

  return {
    readiness: 'contact-gap',
    readinessLabel: 'Contact gap',
    readinessSummary: 'High-value buyer, but contact discovery is still missing.',
    readinessScore: 4,
  };
}

function parseBuyerOpportunityName(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^\[Buyer\]\s*(.+?)(?:\s+—\s+.*)?$/);
  return match?.[1]?.trim() || null;
}

function parseCommunityOpportunityName(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(.+?)\s+—\s+Goods Demand\b/i);
  return match?.[1]?.trim() || null;
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(','));
  }
  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8;') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function toggleValue(current: string[], value: string): string[] {
  return current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
}

function communityLabel(community: GoodsCommunityRow | null | undefined): string {
  if (!community) return 'unassigned community';
  const parts = [community.community_name, community.state].filter(Boolean);
  return parts.join(', ') || 'unassigned community';
}

function buyerRecommendedAsk(buyer: GoodsProcurementEntityRow, community: GoodsCommunityRow | undefined): string {
  const communityText = communityLabel(community || null);
  const role = normalise(buyer.buyer_role);
  if (role === 'housing_provider') {
    return `Open a housing fit conversation for remote-ready beds and mattresses in ${communityText}.`;
  }
  if (role === 'store') {
    return `Test whether ${buyer.entity_name || 'this buyer'} can distribute a 100+ bed order or recurring essentials supply into ${communityText}.`;
  }
  if (role === 'health_service') {
    return `Explore a health + housing pathway for beds, mattresses, and replacement assets in ${communityText}.`;
  }
  if (role === 'council' || role === 'land_council') {
    return `Ask for the procurement entry path and local production appetite for community-made beds in ${communityText}.`;
  }
  return `Book a first scoping call on beds, mattresses, or essential asset supply into ${communityText}.`;
}

function capitalRecommendedAsk(target: CapitalTarget, community: GoodsCommunityRow | null): string {
  const communityText = communityLabel(community);
  if (target.instrumentType.toLowerCase().includes('loan') || target.instrumentType.toLowerCase().includes('catalytic')) {
    return `Pitch plant + working-capital support for community production in ${communityText}, backed by bed demand and buyer pathways.`;
  }
  return `Pitch remote community manufacturing, youth jobs, and durable bed delivery in ${communityText}.`;
}

function partnerRecommendedAsk(partnerRole: string, community: GoodsCommunityRow | null): string {
  const communityText = communityLabel(community);
  return `Open a partnership conversation with ${partnerRole.replace('_', ' ')} organisations that could host production, assembly, distribution, or aftercare in ${communityText}.`;
}

function buyerTargetSummary(buyer: GoodsProcurementEntityRow, community: GoodsCommunityRow | undefined, reason: string): string {
  return [
    buyer.entity_name || 'Unnamed buyer',
    buyer.buyer_role ? `${buyer.buyer_role.replace('_', ' ')} role` : null,
    community ? `linked to ${communityLabel(community)}` : null,
    reason,
  ]
    .filter(Boolean)
    .join(' • ');
}

function canonicalBuyerTargetSummary(buyer: CanonicalBuyerCard, reason: string): string {
  const communitySummary =
    buyer.communities.length > 1
      ? `${buyer.communities.slice(0, 3).map((community) => community.name).join(', ')}${buyer.communities.length > 3 ? ` +${buyer.communities.length - 3} more` : ''}`
      : buyer.primaryCommunity
        ? communityLabel(buyer.primaryCommunity)
        : null;
  return [
    buyer.name,
    buyer.roles.length ? `${buyer.roles.map(roleLabel).join(' / ')} role` : null,
    communitySummary ? `covers ${communitySummary}` : null,
    reason,
  ]
    .filter(Boolean)
    .join(' • ');
}

function capitalTargetSummary(target: CapitalTarget, community: GoodsCommunityRow | null): string {
  return [
    `${target.name} via ${target.provider}`,
    target.instrumentType,
    community ? `best tied to ${communityLabel(community)}` : 'national / multi-community pathway',
    target.reason,
  ]
    .filter(Boolean)
    .join(' • ');
}

function partnerTargetSummary(role: string, count: number, topNames: string[], community: GoodsCommunityRow | null): string {
  return [
    `${count} ${role.replace('_', ' ')} organisations`,
    community ? `around ${communityLabel(community)}` : null,
    topNames.length ? `examples: ${topNames.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join(' • ');
}

function capitalTargetsFromFoundations(foundations: GoodsFoundationRow[]): CapitalTarget[] {
  return foundations.map((foundation) => {
    const text = [
      foundation.name,
      foundation.description,
      (foundation.thematic_focus || []).join(' '),
      (foundation.geographic_focus || []).join(' '),
    ]
      .join(' ')
      .toLowerCase();
    const geographyText = (foundation.geographic_focus || []).join(', ') || 'National / unspecified';
    const confidence = normalise(foundation.profile_confidence);
    const hasOpenPrograms =
      Array.isArray(foundation.open_programs)
        ? foundation.open_programs.length > 0
        : !!foundation.open_programs;
    const score =
      (text.includes('indigenous') ? 18 : 0) +
      (text.includes('community') ? 12 : 0) +
      (text.includes('remote') ? 12 : 0) +
      (text.includes('social enterprise') ? 11 : 0) +
      (text.includes('manufacturing') ? 8 : 0) +
      (text.includes('circular') ? 7 : 0) +
      (text.includes('youth') ? 7 : 0) +
      (text.includes('housing') ? 7 : 0) +
      (text.includes('nt') || text.includes('northern territory') ? 10 : 0) +
      (text.includes('qld') || text.includes('queensland') ? 5 : 0) +
      (hasOpenPrograms ? 8 : 0) +
      (toNumber(foundation.total_giving_annual) > 2_000_000 ? 12 : toNumber(foundation.total_giving_annual) > 500_000 ? 8 : 4) +
      (confidence === 'high' ? 8 : confidence === 'medium' ? 4 : 1);

    const openness: CapitalTarget['openness'] = hasOpenPrograms ? 'open' : 'relationship-led';
    const instrumentType =
      text.includes('loan') || text.includes('debt') || text.includes('catalytic')
        ? 'Catalytic / blended finance'
        : 'Grant / philanthropy';
    const reason = [
      text.includes('indigenous') ? 'Indigenous fit' : null,
      text.includes('community') ? 'Community enterprise fit' : null,
      text.includes('remote') ? 'Remote-region fit' : null,
      hasOpenPrograms ? 'Open programs visible' : 'Likely relationship-led',
    ]
      .filter(Boolean)
      .join(' • ');

    return {
      key: `foundation:${foundation.id}`,
      source: 'foundation',
      name: foundation.name || 'Unnamed foundation',
      provider: foundation.type || 'Foundation',
      score,
      instrumentType,
      openness,
      amountHint: foundation.total_giving_annual ? `${money(toNumber(foundation.total_giving_annual))}/yr giving` : 'Amount undisclosed',
      regionFit: geographyText,
      reason: reason || 'Theme and geography fit',
      link: foundation.website || null,
    };
  });
}

function capitalTargetsFromGrants(grants: GoodsGrantRow[]): CapitalTarget[] {
  return grants.map((grant) => {
    const text = [
      grant.name,
      grant.provider,
      grant.geography,
      (grant.categories || []).join(' '),
      (grant.focus_areas || []).join(' '),
      grant.grant_type,
      grant.program_type,
    ]
      .join(' ')
      .toLowerCase();
    const maxAmount = Math.max(toNumber(grant.amount_max), toNumber(grant.amount_min));
    const score =
      (text.includes('indigenous') ? 18 : 0) +
      (text.includes('community') ? 10 : 0) +
      (text.includes('remote') ? 11 : 0) +
      (text.includes('housing') ? 8 : 0) +
      (text.includes('manufacturing') ? 9 : 0) +
      (text.includes('social enterprise') ? 10 : 0) +
      (text.includes('youth') ? 7 : 0) +
      (text.includes('employment') ? 6 : 0) +
      (text.includes('nt') || text.includes('northern territory') ? 10 : 0) +
      (text.includes('qld') || text.includes('queensland') ? 6 : 0) +
      (maxAmount >= 500_000 ? 14 : maxAmount >= 100_000 ? 8 : maxAmount > 0 ? 4 : 2);
    const grantType = normalise(grant.grant_type);
    const instrumentType = grantType.includes('loan') ? 'Loan / debt' : 'Grant';
    const openness: CapitalTarget['openness'] =
      grant.url || grant.status === 'open' || grant.status === null ? 'open' : 'mixed';
    const reason = [
      text.includes('indigenous') ? 'Indigenous/community fit' : null,
      text.includes('remote') ? 'Remote geography fit' : null,
      maxAmount > 0 ? `Ticket ${money(maxAmount)}` : 'Ticket not disclosed',
      grant.closes_at ? `Closes ${dateLabel(grant.closes_at)}` : 'Rolling / no deadline',
    ]
      .filter(Boolean)
      .join(' • ');
    return {
      key: `grant:${grant.id}`,
      source: 'grant',
      name: grant.name || 'Unnamed grant',
      provider: grant.provider || 'Unknown provider',
      score,
      instrumentType,
      openness,
      amountHint: maxAmount > 0 ? money(maxAmount) : 'Amount undisclosed',
      regionFit: grant.geography || 'National / unspecified',
      reason,
      link: grant.url || null,
    };
  });
}

export default function GoodsWorkspaceClient({
  userEmail,
  orgProfile,
  ghlDefaultOwnerConfigured,
  ghlDefaultOwnerLabel,
  communities,
  buyers,
  signals,
  foundations,
  grants,
  ntCoverageRows,
  goodsPipelineStages,
  goodsPipelineOpportunities,
  goodsBuyerPipelineOpportunities,
  goodsBuyerContacts,
  goodsCommunityPipelineRows,
  goodsPushLog,
}: GoodsWorkspaceClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [mode, setMode] = useState<SearchMode>('need-led');
  const [query, setQuery] = useState('');
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [showOnlyNt, setShowOnlyNt] = useState(true);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushStatus, setPushStatus] = useState('');
  const [selectedBuyerKeys, setSelectedBuyerKeys] = useState<string[]>([]);
  const [selectedCapitalKeys, setSelectedCapitalKeys] = useState<string[]>([]);
  const [selectedPartnerKeys, setSelectedPartnerKeys] = useState<string[]>([]);
  const [ownerMode, setOwnerMode] = useState<'unassigned' | 'default-owner'>('unassigned');
  const [relationshipMode, setRelationshipMode] = useState<'preserve' | 'advance'>('preserve');
  const [buyerView, setBuyerView] = useState<'all' | BuyerReadinessBucket>('ready-now');
  const [mapLayer, setMapLayer] = useState<GoodsMapLayer>('need');
  const [mapExpanded, setMapExpanded] = useState(false);

  const communityById = useMemo(() => {
    return new Map(communities.map((community) => [community.id, community]));
  }, [communities]);

  useEffect(() => {
    const modeParam = searchParams.get('mode');
    const ntOnlyParam = searchParams.get('ntOnly');
    const communityParam = searchParams.get('community')?.trim() || searchParams.get('place')?.trim() || '';
    const lgaParam = searchParams.get('lga')?.trim() || '';
    const stateParam = searchParams.get('state')?.trim().toUpperCase() || '';

    if (modeParam && Object.prototype.hasOwnProperty.call(MODE_LABELS, modeParam)) {
      setMode(modeParam as SearchMode);
    }

    if (ntOnlyParam === 'true') setShowOnlyNt(true);
    if (ntOnlyParam === 'false') setShowOnlyNt(false);

    if (!communityParam && !lgaParam) return;

    const communityNeedle = normalise(communityParam);
    const lgaNeedle = normalise(lgaParam);
    const stateNeedle = normalise(stateParam);

    const matchedCommunity = communities.find((community) => {
      const matchesState = !stateNeedle || normalise(community.state) === stateNeedle;
      if (!matchesState) return false;

      const communityName = normalise(community.community_name);
      const lgaName = normalise(community.lga_name);

      const matchesCommunity =
        !!communityNeedle &&
        (communityName === communityNeedle ||
          communityName.includes(communityNeedle) ||
          communityNeedle.includes(communityName));

      const matchesLga =
        !!lgaNeedle &&
        (lgaName === lgaNeedle || lgaName.includes(lgaNeedle) || lgaNeedle.includes(lgaName));

      return matchesCommunity || matchesLga;
    });

    if (!matchedCommunity) return;

    setSelectedCommunityId(matchedCommunity.id);
    setQuery(matchedCommunity.community_name || matchedCommunity.lga_name || '');

    if (stateParam === 'NT') setShowOnlyNt(true);
    if (stateParam === 'QLD') setShowOnlyNt(false);
  }, [communities, searchParams]);

  const scopedCommunities = useMemo(() => {
    const q = query.trim().toLowerCase();
    return communities.filter((community) => {
      if (showOnlyNt && normalise(community.state) !== 'nt') return false;
      if (!q) return true;
      const haystack = [
        community.community_name,
        community.postcode,
        community.lga_name,
        community.region_label,
        community.service_region,
        community.land_council,
        community.known_buyer_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [communities, query, showOnlyNt]);

  const sortedNeedCommunities = useMemo(() => {
    return [...scopedCommunities]
      .map((community) => ({ community, ...needScore(community) }))
      .sort((a, b) => b.score - a.score);
  }, [scopedCommunities]);

  const selectedCommunity = useMemo(() => {
    if (selectedCommunityId) {
      return communityById.get(selectedCommunityId) || null;
    }
    return sortedNeedCommunities[0]?.community || null;
  }, [communityById, selectedCommunityId, sortedNeedCommunities]);

  function openCommunityDossier() {
    const node = document.getElementById('goods-community-dossier');
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const sortedBuyers = useMemo<BuyerRankedEntry[]>(() => {
    const q = query.trim().toLowerCase();
    const filtered = buyers.filter((buyer) => {
      const community = buyer.community_id ? communityById.get(buyer.community_id) : undefined;
      if (showOnlyNt && community && normalise(community.state) !== 'nt') return false;
      if (!q) return true;
      const haystack = [
        buyer.entity_name,
        buyer.abn,
        buyer.buyer_role,
        buyer.contact_surface,
        buyer.next_action,
        community?.community_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

    const buyerRoleFilter = mode === 'partner-led'
      ? new Set(['community_org', 'land_council', 'council', 'housing_provider', 'health_service'])
      : null;

    const scoped = buyerRoleFilter
      ? filtered.filter((buyer) => buyerRoleFilter.has(normalise(buyer.buyer_role)))
      : filtered;

    return scoped
      .map((buyer) => {
        const community = buyer.community_id ? communityById.get(buyer.community_id) : undefined;
        const score = buyerPlausibilityScore(buyer, community);
        return { buyer, community, score };
      })
      .sort((a, b) => b.score.score - a.score.score);
  }, [buyers, communityById, mode, query, showOnlyNt]);

  const canonicalBuyers = useMemo<CanonicalBuyerCard[]>(() => {
    const grouped = new Map<
      string,
      {
        key: string;
        name: string;
        abn: string | null;
        rows: BuyerRankedEntry[];
        roles: Set<string>;
        communities: Map<string, { id: string; name: string; state: string | null }>;
        reasons: string[];
        nextAction: string | null;
        contactSurface: string | null;
        relationshipStatus: string | null;
        link: string | null;
        contractCount: number;
        contractValue: number;
        representativeEntry: BuyerRankedEntry;
        isCommunityControlled: boolean;
      }
    >();

    for (const entry of sortedBuyers) {
      const key = canonicalBuyerKey(entry.buyer);
      const existing = grouped.get(key);
      const community = entry.community
        ? {
            id: entry.community.id,
            name: entry.community.community_name,
            state: entry.community.state,
          }
        : null;

      if (!existing) {
        grouped.set(key, {
          key,
          name: entry.buyer.entity_name || 'Unnamed buyer',
          abn: entry.buyer.abn || null,
          rows: [entry],
          roles: new Set(entry.buyer.buyer_role ? [entry.buyer.buyer_role] : []),
          communities: new Map(community ? [[community.id, community]] : []),
          reasons: entry.score.reason ? [entry.score.reason] : [],
          nextAction: entry.buyer.next_action || null,
          contactSurface: entry.buyer.contact_surface || null,
          relationshipStatus: entry.buyer.relationship_status || null,
          link: entry.buyer.website || null,
          contractCount: toNumber(entry.buyer.govt_contract_count),
          contractValue: toNumber(entry.buyer.govt_contract_value),
          representativeEntry: entry,
          isCommunityControlled: Boolean(entry.buyer.is_community_controlled),
        });
        continue;
      }

      existing.rows.push(entry);
      if (entry.buyer.buyer_role) existing.roles.add(entry.buyer.buyer_role);
      if (community) existing.communities.set(community.id, community);
      if (entry.score.reason) existing.reasons.push(entry.score.reason);
      existing.contractCount = Math.max(existing.contractCount, toNumber(entry.buyer.govt_contract_count));
      existing.contractValue = Math.max(existing.contractValue, toNumber(entry.buyer.govt_contract_value));
      existing.isCommunityControlled = existing.isCommunityControlled || Boolean(entry.buyer.is_community_controlled);

      if (!existing.contactSurface && entry.buyer.contact_surface) {
        existing.contactSurface = entry.buyer.contact_surface;
      }
      if (!existing.link && entry.buyer.website) {
        existing.link = entry.buyer.website;
      }
      if (!existing.nextAction && entry.buyer.next_action) {
        existing.nextAction = entry.buyer.next_action;
      }
      if (relationshipPriority(entry.buyer.relationship_status) > relationshipPriority(existing.relationshipStatus)) {
        existing.relationshipStatus = entry.buyer.relationship_status;
      }

      const existingIsSelectedCommunity =
        selectedCommunity && existing.representativeEntry.community?.id === selectedCommunity.id;
      const nextIsSelectedCommunity = selectedCommunity && entry.community?.id === selectedCommunity.id;
      if (
        (!existingIsSelectedCommunity && nextIsSelectedCommunity) ||
        (existingIsSelectedCommunity === nextIsSelectedCommunity &&
          entry.score.score > existing.representativeEntry.score.score)
      ) {
        existing.representativeEntry = entry;
      }
    }

    return Array.from(grouped.values())
      .map((group) => {
        const communities = Array.from(group.communities.values()).sort((a, b) => a.name.localeCompare(b.name));
        const communityCount = communities.length;
        const coversSelectedCommunity = Boolean(
          selectedCommunity && communities.some((community) => community.id === selectedCommunity.id),
        );
        const primaryCommunity =
          (coversSelectedCommunity
            ? group.rows.find((row) => row.community?.id === selectedCommunity?.id)?.community
            : undefined) || group.representativeEntry.community;
        const reasons = uniqueStrings(group.reasons).slice(0, 3);
        const score = Math.round(
          group.representativeEntry.score.score +
            Math.min(Math.max(communityCount - 1, 0) * 4, 20) +
            (coversSelectedCommunity ? 18 : 0) +
            (group.contactSurface ? 4 : 0) +
            (group.isCommunityControlled ? 4 : 0),
        );

        return {
          key: group.key,
          name: group.name,
          abn: group.abn,
          score,
          reasons,
          nextAction:
            group.nextAction || 'Find the procurement or supply contact and ask for the current buying path.',
          contactSurface: group.contactSurface,
          relationshipStatus: group.relationshipStatus,
          link: group.link,
          contractCount: group.contractCount,
          contractValue: group.contractValue,
          roles: Array.from(group.roles),
          communities,
          primaryCommunity,
          communityCount,
          matchedRows: group.rows.length,
          representativeEntry: group.representativeEntry,
          isCommunityControlled: group.isCommunityControlled,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [selectedCommunity, sortedBuyers]);

  const buyerOpportunityLookup = useMemo(() => {
    const lookup = new Map<string, GoodsBuyerGhlOpportunityRow>();
    for (const opportunity of goodsBuyerPipelineOpportunities) {
      const key = normalise(parseBuyerOpportunityName(opportunity.name));
      if (!key || lookup.has(key)) continue;
      lookup.set(key, opportunity);
    }
    return lookup;
  }, [goodsBuyerPipelineOpportunities]);

  const buyerContactLookup = useMemo(() => {
    const lookup = new Map<string, GoodsBuyerGhlContactRow>();
    for (const contact of goodsBuyerContacts) {
      const key = normalise(contact.company_name);
      if (!key || lookup.has(key)) continue;
      lookup.set(key, contact);
    }
    return lookup;
  }, [goodsBuyerContacts]);

  const communityPipelineLookup = useMemo(() => {
    const lookup = new Map<string, GoodsCommunityPipelineRow>();
    for (const opportunity of goodsCommunityPipelineRows) {
      const key = normalise(parseCommunityOpportunityName(opportunity.name));
      if (!key || lookup.has(key)) continue;
      lookup.set(key, opportunity);
    }
    return lookup;
  }, [goodsCommunityPipelineRows]);

  const buyerPipelineCards = useMemo<BuyerPipelineCard[]>(() => {
    return canonicalBuyers
      .map((buyer) => {
        const readiness = buyerReadinessMeta(buyer);
        const buyerOpportunity = buyerOpportunityLookup.get(normalise(buyer.name));
        const buyerContact = buyerContactLookup.get(normalise(buyer.name));
        const communityPipeline = buyer.primaryCommunity
          ? communityPipelineLookup.get(normalise(buyer.primaryCommunity.community_name))
          : undefined;
        const activeBuyerStage = normalise(buyerOpportunity?.stage_name);
        const buyerOutcomeBoost =
          buyerOpportunity
            ? (buyerOpportunity.assigned_to ? 10 : 4) +
              (activeBuyerStage && activeBuyerStage !== 'new lead' && activeBuyerStage !== 'unknown' ? 12 : 0)
            : 0;
        const communityOutcomeBoost =
          communityPipeline
            ? (communityPipeline.assigned_to ? 6 : 2) +
              (normalise(communityPipeline.stage_name) && normalise(communityPipeline.stage_name) !== 'new lead' ? 4 : 0)
            : 0;
        const outcomeBoost = buyerOutcomeBoost + communityOutcomeBoost;
        const outcomeSummary = buyerOpportunity
          ? `Buyer CRM live: ${buyerOpportunity.stage_name || 'Unknown'}${buyerOpportunity.assigned_to ? ` • ${buyerOpportunity.assigned_to}` : ''}`
          : communityPipeline
            ? `Community demand live: ${communityPipeline.stage_name || 'Unknown'}${communityPipeline.assigned_to ? ` • ${communityPipeline.assigned_to}` : ''}`
            : 'No Goods CRM activity recorded yet';
        return {
          ...buyer,
          ...readiness,
          readinessScore: readiness.readinessScore + outcomeBoost,
          buyerOpportunityStage: buyerOpportunity?.stage_name || null,
          buyerOpportunityAssignedTo: buyerOpportunity?.assigned_to || null,
          buyerOpportunityUpdatedAt: buyerOpportunity?.updated_at || null,
          buyerOpportunityValue: toNumber(buyerOpportunity?.monetary_value),
          communityPipelineStage: communityPipeline?.stage_name || null,
          communityPipelineAssignedTo: communityPipeline?.assigned_to || null,
          communityPipelineUpdatedAt: communityPipeline?.updated_at || null,
          communityPipelineValue: toNumber(communityPipeline?.monetary_value),
          engagementStatus: buyerContact?.engagement_status || null,
          lastContactDate: buyerContact?.last_contact_date || null,
          outcomeSummary,
          outcomeBoost,
        };
      })
      .sort((a, b) => {
        if (b.readinessScore !== a.readinessScore) return b.readinessScore - a.readinessScore;
        return b.score - a.score;
      });
  }, [buyerContactLookup, buyerOpportunityLookup, canonicalBuyers, communityPipelineLookup]);

  const capitalTargets = useMemo(() => {
    const foundationTargets = capitalTargetsFromFoundations(foundations);
    const grantTargets = capitalTargetsFromGrants(grants);
    const merged = [...foundationTargets, ...grantTargets];
    const q = query.trim().toLowerCase();
    const filtered = merged.filter((target) => {
      if (!q) return true;
      const haystack = [target.name, target.provider, target.reason, target.regionFit].join(' ').toLowerCase();
      return haystack.includes(q);
    });
    return filtered.sort((a, b) => b.score - a.score);
  }, [foundations, grants, query]);

  const selectedCommunitySignals = useMemo(() => {
    if (!selectedCommunity) return [];
    return signals
      .filter((signal) => signal.community_id === selectedCommunity.id)
      .slice(0, 8);
  }, [selectedCommunity, signals]);

  const partnerGraphRows = useMemo(() => {
    const rows = canonicalBuyers.slice(0, 160).reduce<Record<string, { role: string; count: number; topNames: string[] }>>((acc, buyer) => {
      const roles = buyer.roles.length > 0 ? buyer.roles : ['other'];
      for (const role of roles) {
        if (!acc[role]) {
          acc[role] = { role, count: 0, topNames: [] };
        }
        acc[role].count += 1;
        if (buyer.name && !acc[role].topNames.includes(buyer.name) && acc[role].topNames.length < 4) {
          acc[role].topNames.push(buyer.name);
        }
      }
      return acc;
    }, {});
    return Object.values(rows).sort((a, b) => b.count - a.count);
  }, [canonicalBuyers]);

  const crosswalkLookup = useMemo(() => {
    const lookup = new Map<string, NtCommunityCoverageRow>();
    for (const row of ntCoverageRows) {
      const key = normalise(row.community_name);
      if (key) lookup.set(key, row);
    }
    return lookup;
  }, [ntCoverageRows]);

  const mapPoints = useMemo(() => {
    return sortedNeedCommunities
      .map((row) => ({
        id: row.community.id,
        name: row.community.community_name,
        state: row.community.state,
        lat: toNumber(row.community.latitude),
        lng: toNumber(row.community.longitude),
        needScore: row.score,
        needReason: row.reason,
        demandBeds: toNumber(row.community.demand_beds),
        demandWashers: toNumber(row.community.demand_washers),
        demandFridges: toNumber(row.community.demand_fridges),
        buyerCount: toNumber(row.community.buyer_entity_count),
        partnerCount: toNumber(row.community.community_controlled_org_count),
        goodsBuyerGap: normalise(row.community.state) === 'nt' && toNumber(row.community.buyer_entity_count) === 0,
        crosswalkBuyerGap: toNumber(crosswalkLookup.get(normalise(row.community.community_name))?.buyer_match_count) === 0,
        postcodeGap: Boolean(crosswalkLookup.get(normalise(row.community.community_name))?.needs_postcode_enrichment),
        remoteness: row.community.remoteness,
        proofLine: row.community.proof_line,
      }))
      .filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng) && row.lat !== 0 && row.lng !== 0);
  }, [crosswalkLookup, sortedNeedCommunities]);

  const selectedMapPoint = useMemo(() => {
    if (!selectedCommunity) return mapPoints[0] || null;
    return mapPoints.find((point) => point.id === selectedCommunity.id) || mapPoints[0] || null;
  }, [mapPoints, selectedCommunity]);

  const crosswalkZeroBuyerRows = useMemo(() => {
    return ntCoverageRows.filter((row) => toNumber(row.buyer_match_count) === 0).slice(0, 20);
  }, [ntCoverageRows]);

  const crosswalkZeroBuyerCount = useMemo(() => {
    return ntCoverageRows.filter((row) => toNumber(row.buyer_match_count) === 0).length;
  }, [ntCoverageRows]);

  const goodsZeroBuyerRows = useMemo(() => {
    return scopedCommunities
      .filter((community) => normalise(community.state) === 'nt' && toNumber(community.buyer_entity_count) === 0)
      .slice(0, 20);
  }, [scopedCommunities]);

  const goodsZeroBuyerCount = goodsZeroBuyerRows.length;

  const postcodeGaps = useMemo(() => {
    return ntCoverageRows.filter((row) => row.needs_postcode_enrichment).length;
  }, [ntCoverageRows]);

  const buyerOutreachTargets = useMemo<BuyerOutreachTarget[]>(() => {
    return buyerPipelineCards.map((entry) => {
      const roleTags = entry.roles.map((role) => `buyer-role-${normalise(role).replace(/\s+/g, '-')}`);
      const tags = [
        'goods-workspace',
        'buyer-target',
        showOnlyNt ? 'nt-priority' : 'nt-qld',
        ...roleTags,
      ];
      const reason = uniqueStrings([
        ...entry.reasons,
        entry.communityCount > 1 ? `covers ${entry.communityCount} linked communities` : null,
        entry.primaryCommunity && selectedCommunity && entry.primaryCommunity.id === selectedCommunity.id
          ? 'selected community match'
          : null,
      ]).join(' • ');
      const crmPreviewOperation = entry.buyerOpportunityStage ? 'update-opportunity' : 'create-opportunity';
      const crmPreviewSummary = entry.buyerOpportunityStage
        ? `Will update existing buyer opportunity in ${entry.buyerOpportunityStage}${entry.buyerOpportunityAssignedTo ? ` • owner ${entry.buyerOpportunityAssignedTo}` : ''}.`
        : entry.communityPipelineStage
          ? `Will create a new buyer opportunity. Community demand lane already exists in ${entry.communityPipelineStage}.`
          : 'Will create a new buyer opportunity in the Goods pipeline.';

      return {
        key: entry.key,
        type: 'buyer',
        name: entry.name,
        company: entry.name,
        community: entry.primaryCommunity?.community_name || null,
        state: entry.primaryCommunity?.state || null,
        score: entry.score,
        reason: reason || entry.representativeEntry.score.reason,
        nextAction: entry.nextAction,
        recommendedAsk: buyerRecommendedAsk(entry.representativeEntry.buyer, entry.primaryCommunity),
        targetSummary: canonicalBuyerTargetSummary(entry, reason || entry.representativeEntry.score.reason),
        contactSurface: entry.contactSurface,
        relationshipStatus: entry.relationshipStatus,
        link: entry.link,
        crmPreviewOperation,
        crmPreviewSummary,
        tags,
      };
    });
  }, [buyerPipelineCards, selectedCommunity, showOnlyNt]);

  const buyerPipelineCounts = useMemo(() => {
    return buyerPipelineCards.reduce(
      (acc, buyer) => {
        acc.all += 1;
        acc[buyer.readiness] += 1;
        return acc;
      },
      {
        all: 0,
        'ready-now': 0,
        'relationship-path': 0,
        'contact-gap': 0,
      } as Record<'all' | BuyerReadinessBucket, number>,
    );
  }, [buyerPipelineCards]);

  const visibleBuyerPipelineCards = useMemo(() => {
    return buyerView === 'all'
      ? buyerPipelineCards
      : buyerPipelineCards.filter((buyer) => buyer.readiness === buyerView);
  }, [buyerPipelineCards, buyerView]);

  const capitalOutreachTargets = useMemo<CapitalOutreachTarget[]>(() => {
    return capitalTargets.map((target) => ({
      key: target.key,
      type: 'capital',
      name: target.name,
      company: target.provider,
      community: selectedCommunity?.community_name || null,
      state: selectedCommunity?.state || null,
      score: target.score,
      reason: target.reason,
      nextAction:
        target.openness === 'open'
          ? 'Export this target with a tailored ask and move to first outreach.'
          : 'Treat this as relationship-led: identify introducers, warm links, or board-level pathway first.',
      recommendedAsk: capitalRecommendedAsk(target, selectedCommunity),
      targetSummary: capitalTargetSummary(target, selectedCommunity),
      link: target.link,
      tags: ['goods-workspace', 'capital-target', target.source, target.openness],
      source: target.source,
      instrumentType: target.instrumentType,
      openness: target.openness,
    }));
  }, [capitalTargets, selectedCommunity]);

  const partnerOutreachTargets = useMemo<PartnerOutreachTarget[]>(() => {
    return partnerGraphRows.map((partner) => ({
      key: partner.role,
      type: 'partner',
      name: partner.topNames[0] || partner.role.replace('_', ' '),
      company: partner.topNames[0] || partner.role.replace('_', ' '),
      community: selectedCommunity?.community_name || null,
      state: selectedCommunity?.state || null,
      score: partner.count * 10,
      reason: `Partner cluster ${partner.role.replace('_', ' ')} (${partner.count})`,
      nextAction: 'Open a production or distribution scoping conversation with the strongest named organisations in this cluster.',
      recommendedAsk: partnerRecommendedAsk(partner.role, selectedCommunity),
      targetSummary: partnerTargetSummary(partner.role, partner.count, partner.topNames, selectedCommunity),
      tags: ['goods-workspace', 'partner-target', partner.role],
    }));
  }, [partnerGraphRows, selectedCommunity]);

  const selectedBuyerTargets = useMemo(() => {
    const explicit = buyerOutreachTargets.filter((target) => selectedBuyerKeys.includes(target.key));
    if (explicit.length > 0) return explicit;

    const readyNow = buyerOutreachTargets.filter((target) => {
      const source = buyerPipelineCards.find((buyer) => buyer.key === target.key);
      return source?.readiness === 'ready-now';
    });
    const relationshipPath = buyerOutreachTargets.filter((target) => {
      const source = buyerPipelineCards.find((buyer) => buyer.key === target.key);
      return source?.readiness === 'relationship-path';
    });
    const contactGaps = buyerOutreachTargets.filter((target) => {
      const source = buyerPipelineCards.find((buyer) => buyer.key === target.key);
      return source?.readiness === 'contact-gap';
    });

    return [...readyNow, ...relationshipPath, ...contactGaps].slice(0, 6);
  }, [buyerOutreachTargets, buyerPipelineCards, selectedBuyerKeys]);

  const selectedCapitalTargets = useMemo(() => {
    const explicit = capitalOutreachTargets.filter((target) => selectedCapitalKeys.includes(target.key));
    return explicit.length > 0 ? explicit : capitalOutreachTargets.slice(0, 5);
  }, [capitalOutreachTargets, selectedCapitalKeys]);

  const selectedPartnerTargets = useMemo(() => {
    const explicit = partnerOutreachTargets.filter((target) => selectedPartnerKeys.includes(target.key));
    return explicit.length > 0 ? explicit : partnerOutreachTargets.slice(0, 3);
  }, [partnerOutreachTargets, selectedPartnerKeys]);

  const hasExplicitSelection =
    selectedBuyerKeys.length > 0 || selectedCapitalKeys.length > 0 || selectedPartnerKeys.length > 0;

  const ghlTargets = useMemo<OutreachPushTarget[]>(() => {
    return [...selectedBuyerTargets, ...selectedCapitalTargets, ...selectedPartnerTargets];
  }, [selectedBuyerTargets, selectedCapitalTargets, selectedPartnerTargets]);

  const crmPayload = useMemo(() => {
    return {
      workspace: 'goods-workspace',
      selected_community: selectedCommunity
        ? {
            name: selectedCommunity.community_name,
            state: selectedCommunity.state,
            postcode: selectedCommunity.postcode,
            need_signal: needScore(selectedCommunity),
          }
        : null,
      selection_mode: hasExplicitSelection ? 'manual' : 'top-ranked-defaults',
      buyers: selectedBuyerTargets,
      capital: selectedCapitalTargets,
      partners: selectedPartnerTargets,
    };
  }, [hasExplicitSelection, selectedBuyerTargets, selectedCapitalTargets, selectedCommunity, selectedPartnerTargets]);

  async function runGhlPush(dryRun: boolean) {
    setPushBusy(true);
    setPushStatus('');
    try {
      const response = await fetch('/api/goods-workspace/ghl-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dryRun,
          maxTargets: 30,
          ownerMode,
          relationshipMode,
          targets: ghlTargets,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setPushStatus(`Push failed: ${data.error || 'Unknown error'}`);
        return;
      }
      setPushStatus(
        dryRun
          ? `Dry run OK: ${data.total} targets prepared for GHL.`
          : `GHL push complete: ${data.succeeded}/${data.total} succeeded${data.created ? `, ${data.created} created` : ''}${data.updated ? `, ${data.updated} updated` : ''}${data.failed > 0 ? `, ${data.failed} failed` : ''}.`,
      );
      if (!dryRun) {
        startRefreshTransition(() => {
          router.refresh();
        });
      }
    } catch (error) {
      setPushStatus(`Push failed: ${error instanceof Error ? error.message : 'Network error'}`);
    } finally {
      setPushBusy(false);
    }
  }

  const pipelineTotals = useMemo(() => {
    return goodsPipelineStages.reduce(
      (acc, row) => {
        acc.count += toNumber(row.stage_count);
        acc.value += toNumber(row.stage_value);
        return acc;
      },
      { count: 0, value: 0 },
    );
  }, [goodsPipelineStages]);

  const pushLogRows = useMemo(() => {
    return goodsPushLog.map((row) => {
      const metadata = row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : {};
      return {
        id: row.id,
        status: row.status || 'unknown',
        processed: toNumber(row.records_processed),
        created: toNumber(row.records_created),
        updated: toNumber(row.records_updated),
        failed: toNumber(row.records_failed),
        triggeredBy: row.triggered_by || 'unknown',
        startedAt: row.started_at,
        ownerMode: typeof metadata.ownerMode === 'string' ? metadata.ownerMode : 'unknown',
        relationshipMode: typeof metadata.relationshipMode === 'string' ? metadata.relationshipMode : 'unknown',
        dryRun: Boolean(metadata.dryRun),
      };
    });
  }, [goodsPushLog]);

  const latestLivePush = useMemo(() => {
    return pushLogRows.find((row) => !row.dryRun) || null;
  }, [pushLogRows]);

  const recentMovement = useMemo(() => {
    const assignedCount = goodsPipelineOpportunities.filter((opportunity) => Boolean(opportunity.assigned_to)).length;
    const activeCount = goodsPipelineOpportunities.filter((opportunity) => {
      const stageName = normalise(opportunity.stage_name);
      return Boolean(stageName) && stageName !== 'new lead' && stageName !== 'unknown';
    }).length;

    const latestPushTs = latestLivePush?.startedAt ? new Date(latestLivePush.startedAt).getTime() : Number.NaN;
    const updatedSinceLastPush =
      Number.isFinite(latestPushTs)
        ? goodsPipelineOpportunities.filter((opportunity) => {
            const updatedTs = opportunity.updated_at ? new Date(opportunity.updated_at).getTime() : Number.NaN;
            return Number.isFinite(updatedTs) && updatedTs > latestPushTs;
          })
        : [];

    return {
      assignedCount,
      activeCount,
      updatedSinceLastPush,
    };
  }, [goodsPipelineOpportunities, latestLivePush]);

  const exportBuyerRows = useMemo(() => {
    return buyerOutreachTargets.slice(0, 50).map((entry) => ({
      buyer_name: entry.name,
      company: entry.company,
      community: entry.community || '',
      state: entry.state || '',
      readiness:
        buyerPipelineCards.find((buyer) => buyer.key === entry.key)?.readinessLabel || '',
      communities_covered:
        buyerPipelineCards.find((buyer) => buyer.key === entry.key)?.communities.map((community) => community.name).join(' | ') || '',
      plausibility_score: entry.score,
      why_plausible: entry.reason,
      relationship_status: entry.relationshipStatus || '',
      contact_surface: entry.contactSurface || '',
      recommended_ask: entry.recommendedAsk,
      next_action: entry.nextAction,
      target_summary: entry.targetSummary,
      website: entry.link || '',
    }));
  }, [buyerOutreachTargets, buyerPipelineCards]);

  const exportCapitalRows = useMemo(() => {
    return capitalOutreachTargets.slice(0, 60).map((target) => ({
      source: target.source,
      target_name: target.name,
      provider: target.company,
      capital_fit_score: target.score,
      instrument_type: target.instrumentType,
      openness: target.openness,
      community: target.community || '',
      state: target.state || '',
      why_fit: target.reason,
      recommended_ask: target.recommendedAsk,
      next_action: target.nextAction,
      target_summary: target.targetSummary,
      url: target.link || '',
    }));
  }, [capitalOutreachTargets]);

  const selectedTargetRows = useMemo(() => {
    return ghlTargets.map((target) => ({
      target_type: target.type,
      target_name: target.name,
      company_or_provider: target.company,
      community: target.community || '',
      state: target.state || '',
      score: target.score,
      why_now: target.reason,
      recommended_ask: target.recommendedAsk,
      next_action: target.nextAction,
      relationship_or_openness:
        target.type === 'buyer'
          ? target.relationshipStatus || ''
          : target.type === 'capital'
            ? target.openness
            : 'partner cluster',
      contact_surface_or_link:
        target.type === 'buyer'
          ? target.contactSurface || target.link || ''
          : target.type === 'capital'
            ? target.link || ''
            : '',
      crm_push_preview:
        target.type === 'buyer'
          ? target.crmPreviewSummary
          : target.type === 'capital'
            ? 'Will create or update a capital target opportunity in Goods pipeline.'
            : 'Will create or update a partner target opportunity in Goods pipeline.',
      target_summary: target.targetSummary,
      tags: target.tags.join(' | '),
    }));
  }, [ghlTargets]);

  const selectedBuyerPushSummary = useMemo(() => {
    return selectedBuyerTargets.reduce(
      (acc, target) => {
        if (target.crmPreviewOperation === 'update-opportunity') acc.update += 1;
        else acc.create += 1;
        return acc;
      },
      { create: 0, update: 0 },
    );
  }, [selectedBuyerTargets]);

  const weeklySnapshotMarkdown = useMemo(() => {
    const leadCommunity = selectedCommunity
      ? `- Focus community: ${communityLabel(selectedCommunity)}\n- Need signal: ${needScore(selectedCommunity).reason}\n`
      : '- Focus community: none selected\n';
    const buyerLines = selectedBuyerTargets
      .map((target, index) => `${index + 1}. ${target.name} (${target.score})\n   Why: ${target.reason}\n   Ask: ${target.recommendedAsk}\n   Next: ${target.nextAction}`)
      .join('\n');
    const capitalLines = selectedCapitalTargets
      .map((target, index) => `${index + 1}. ${target.name} (${target.score})\n   Why: ${target.reason}\n   Ask: ${target.recommendedAsk}\n   Next: ${target.nextAction}`)
      .join('\n');
    const partnerLines = selectedPartnerTargets
      .map((target, index) => `${index + 1}. ${target.name} (${target.score})\n   Why: ${target.reason}\n   Ask: ${target.recommendedAsk}`)
      .join('\n');
    return `# Goods Workspace Weekly Operating Snapshot

Generated from CivicGraph Goods Workspace.

## Focus
${leadCommunity}
- Selection mode: ${hasExplicitSelection ? 'manual selection' : 'top-ranked defaults'}
- Buyer targets in push set: ${selectedBuyerTargets.length}
- Capital targets in push set: ${selectedCapitalTargets.length}
- Partner targets in push set: ${selectedPartnerTargets.length}

## Buyer pipeline
${buyerLines || 'No buyer targets selected.'}

## Capital stack
${capitalLines || 'No capital targets selected.'}

## Partner graph
${partnerLines || 'No partner targets selected.'}

## Immediate next actions
1. Push the selected targets into GHL.
2. Start outreach on buyers with visible contact surfaces first.
3. Export capital targets into the Notion outreach table with the recommended ask attached.
`;
  }, [hasExplicitSelection, selectedBuyerTargets, selectedCapitalTargets, selectedCommunity, selectedPartnerTargets]);

  const workflowLeadText = mode === 'need-led'
    ? 'Start from highest-need communities with weakest current coverage, then route to buyers.'
    : mode === 'buyer-led'
      ? 'Start from highest-plausibility buyers, then confirm need and production leverage in-community.'
      : mode === 'capital-led'
        ? 'Start from strongest funding pathways, then connect to delivery proof and procurement demand.'
        : 'Start from strongest community partner clusters, then tie to buyers and capital pathways.';

  return (
    <div className="max-w-[1700px] mx-auto pb-16">
      <div className="mb-4">
        <Link href="/tender-intelligence" className="text-xs font-black uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-black">
          &larr; Back to Tender Intelligence
        </Link>
      </div>

      <section className="border-4 border-bauhaus-black bg-bauhaus-black text-white p-6">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-bauhaus-yellow mb-3">Goods Workspace</p>
        <h1 className="text-4xl font-black uppercase tracking-tight mb-3">NT + Remote Buyer & Capital Engine</h1>
        <p className="text-base text-white/80 max-w-5xl mb-4">
          Discovery workspace for Goods on Country: map community need, rank plausible procurement buyers for beds and household essentials,
          and connect to grants, catalytic capital, and philanthropy before pushing approved targets into GHL and the weekly QBE cockpit.
        </p>
        <div className="mb-4 grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-4 border-2 border-white/30 bg-white/5 p-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-bauhaus-yellow mb-2">Research Workspace</p>
            <p className="text-sm text-white/85 max-w-4xl">
              Use this page to discover and rank buyers, capital targets, and partner paths. Run the live weekly raise and outreach process in
              Goods <span className="font-black">QBE Program</span> and <span className="font-black">QBE Actions</span>, with
              <span className="font-black"> GHL</span> as the relationship system of record.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-2 xl:justify-end">
            <a
              href={GOODS_QBE_PROGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="border-2 border-white bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-yellow"
            >
              Open QBE Program
            </a>
            <a
              href={GOODS_QBE_ACTIONS_URL}
              target="_blank"
              rel="noreferrer"
              className="border-2 border-white/70 px-3 py-2 text-xs font-black uppercase tracking-widest text-white hover:border-white hover:bg-white hover:text-bauhaus-black"
            >
              Open QBE Actions
            </a>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <div className="border-2 border-white/40 p-3">
            <p className="text-[10px] uppercase tracking-widest text-white/70 mb-1">1. Need Signal</p>
            <p className="font-bold">Map high-pressure communities first.</p>
          </div>
          <div className="border-2 border-white/40 p-3">
            <p className="text-[10px] uppercase tracking-widest text-white/70 mb-1">2. Buyer Pipeline</p>
            <p className="font-bold">Rank who can plausibly buy/distribute 100+ beds.</p>
          </div>
          <div className="border-2 border-white/40 p-3">
            <p className="text-[10px] uppercase tracking-widest text-white/70 mb-1">3. Capital Stack</p>
            <p className="font-bold">Match grants, loans, and catalytic capital to stage fit.</p>
          </div>
          <div className="border-2 border-white/40 p-3">
            <p className="text-[10px] uppercase tracking-widest text-white/70 mb-1">4. Outreach Exports</p>
            <p className="font-bold">Push prepared targets into GHL, then work them from QBE Actions.</p>
          </div>
        </div>
      </section>

      <section className="mt-4 border-4 border-bauhaus-black bg-white p-5">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-4 items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue mb-2">Goods Thesis</p>
            <p className="text-sm text-bauhaus-black leading-relaxed">
              Build community-owned production and delivery pathways for beds and essentials in remote communities.
              Use Oonchiumpa and partner communities as proof nodes: local manufacturing, youth jobs, lower freight waste, and stronger asset longevity.
            </p>
            <p className="mt-3 text-xs font-medium uppercase tracking-widest text-bauhaus-muted">
              Discovery here. Execution in GHL + QBE Program.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 min-w-[320px]">
            <div className="border-2 border-bauhaus-black p-2">
              <p className="text-[10px] uppercase tracking-widest text-bauhaus-muted">Communities</p>
              <p className="text-2xl font-black">{scopedCommunities.length}</p>
            </div>
            <div className="border-2 border-bauhaus-black p-2">
              <p className="text-[10px] uppercase tracking-widest text-bauhaus-muted">Buyer Targets</p>
              <p className="text-2xl font-black">{canonicalBuyers.length}</p>
              <p className="text-[10px] uppercase tracking-widest text-bauhaus-muted mt-1">{sortedBuyers.length} linked rows</p>
            </div>
            <div className="border-2 border-bauhaus-black p-2">
              <p className="text-[10px] uppercase tracking-widest text-bauhaus-muted">Capital Targets</p>
              <p className="text-2xl font-black">{capitalTargets.length}</p>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search community, postcode, buyer, funder, role, or region"
            className="border-4 border-bauhaus-black px-4 py-3 text-base font-medium w-full"
          />
          <div className="flex flex-wrap gap-2">
            {(Object.keys(MODE_LABELS) as SearchMode[]).map((nextMode) => (
              <button
                key={nextMode}
                onClick={() => setMode(nextMode)}
                className={`px-3 py-2 border-2 border-bauhaus-black text-xs font-black uppercase tracking-widest ${
                  mode === nextMode ? 'bg-bauhaus-black text-white' : 'bg-white text-bauhaus-black'
                }`}
              >
                {MODE_LABELS[nextMode]}
              </button>
            ))}
            <button
              onClick={() => setShowOnlyNt((current) => !current)}
              className={`px-3 py-2 border-2 border-bauhaus-black text-xs font-black uppercase tracking-widest ${
                showOnlyNt ? 'bg-bauhaus-red text-white' : 'bg-white text-bauhaus-black'
              }`}
            >
              {showOnlyNt ? 'NT-only' : 'NT + QLD'}
            </button>
          </div>
        </div>
        <p className="mt-3 text-sm text-bauhaus-muted">{workflowLeadText}</p>
      </section>

      <section className="mt-4 grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-4">
        <div className="border-4 border-bauhaus-black bg-white p-4">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Need Signal</p>
              <h2 className="text-2xl font-black mt-1">Community Need Map</h2>
            </div>
            <div className="text-right text-xs text-bauhaus-muted">
              <p>{mapPoints.length} mapped communities</p>
              <p>{goodsZeroBuyerCount} NT communities with no Goods buyer leads</p>
              <p>{crosswalkZeroBuyerCount} NT crosswalk buyer-match gaps</p>
              <p>{postcodeGaps} NT postcode/enrichment gaps</p>
            </div>
          </div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {([
                ['need', 'Need'],
                ['beds', 'Beds'],
                ['washers', 'Washers'],
                ['fridges', 'Fridges'],
                ['buyer-gaps', 'Buyer gaps'],
                ['partners', 'Partners'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMapLayer(value)}
                  className={`border-2 px-3 py-2 text-xs font-black uppercase tracking-widest ${
                    mapLayer === value
                      ? 'border-bauhaus-black bg-bauhaus-black text-white'
                      : 'border-bauhaus-black bg-white text-bauhaus-black'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setMapExpanded(true)}
              className="border-2 border-bauhaus-black px-3 py-2 text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white"
            >
              Expand map
            </button>
          </div>
          <GoodsCommunityMap
            points={mapPoints}
            selectedPoint={selectedMapPoint}
            selectedLayer={mapLayer}
            onSelect={setSelectedCommunityId}
            onOpenDossier={openCommunityDossier}
            ntOnly={showOnlyNt}
          />
          <div className="mt-3 space-y-2">
            {sortedNeedCommunities.slice(0, 6).map((entry) => (
              <button
                key={entry.community.id}
                onClick={() => setSelectedCommunityId(entry.community.id)}
                className={`w-full text-left border-2 px-3 py-2 ${
                  selectedCommunity?.id === entry.community.id
                    ? 'border-bauhaus-red bg-bauhaus-red/5'
                    : 'border-bauhaus-black hover:bg-bauhaus-canvas/40'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black text-bauhaus-black">
                    {entry.community.community_name} {entry.community.state ? `(${entry.community.state})` : ''}
                  </p>
                  <p className="text-sm font-black text-bauhaus-red">{entry.score}</p>
                </div>
                <p className="text-xs text-bauhaus-muted mt-1">{entry.reason}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div id="goods-community-dossier" className="border-4 border-bauhaus-black bg-white p-4">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Community Need + Proof</p>
            {selectedCommunity ? (
              <>
                <h2 className="text-2xl font-black mt-1">{selectedCommunity.community_name}</h2>
                <p className="text-sm text-bauhaus-muted">
                  {(selectedCommunity.state || '—')} • {selectedCommunity.region_label || selectedCommunity.lga_name || 'Region unknown'} • {selectedCommunity.remoteness || 'Remoteness unknown'}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="border-2 border-bauhaus-black p-2">
                    <p className="text-[10px] uppercase tracking-widest text-bauhaus-muted">Demand</p>
                    <p className="font-black">
                      {toNumber(selectedCommunity.demand_beds)} beds • {toNumber(selectedCommunity.demand_washers)} washers
                    </p>
                  </div>
                  <div className="border-2 border-bauhaus-black p-2">
                    <p className="text-[10px] uppercase tracking-widest text-bauhaus-muted">Coverage</p>
                    <p className="font-black">{toNumber(selectedCommunity.buyer_entity_count)} buyer entities</p>
                  </div>
                  <div className="border-2 border-bauhaus-black p-2">
                    <p className="text-[10px] uppercase tracking-widest text-bauhaus-muted">Assets</p>
                    <p className="font-black">
                      {toNumber(selectedCommunity.assets_deployed)} deployed • {toNumber(selectedCommunity.assets_overdue)} overdue
                    </p>
                  </div>
                  <div className="border-2 border-bauhaus-black p-2">
                    <p className="text-[10px] uppercase tracking-widest text-bauhaus-muted">Community Partners</p>
                    <p className="font-black">{toNumber(selectedCommunity.community_controlled_org_count)} controlled orgs</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-bauhaus-black">
                  <span className="font-black">Proof:</span> {selectedCommunity.proof_line || selectedCommunity.story || 'No proof line recorded yet.'}
                </p>
                <p className="mt-1 text-sm text-bauhaus-muted">
                  Updated {dateLabel(selectedCommunity.updated_at)} • Source {selectedCommunity.signal_source || 'goods profile'}
                </p>
              </>
            ) : (
              <p className="text-sm text-bauhaus-muted mt-2">No community selected.</p>
            )}
          </div>

          <div className="border-4 border-bauhaus-black bg-white p-4">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Delivery + Partner Graph</p>
            <p className="text-sm text-bauhaus-muted mt-1">
              Role clusters from current procurement entities. Use this to decide where to build local production partnerships versus buyer outreach.
            </p>
            <div className="mt-3 space-y-2">
              {partnerGraphRows.slice(0, 8).map((row) => (
                <div key={row.role} className="border-2 border-bauhaus-black p-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black uppercase tracking-wide">{row.role.replace('_', ' ')}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-bauhaus-blue">{row.count}</p>
                      <button
                        onClick={() => setSelectedPartnerKeys((current) => toggleValue(current, row.role))}
                        className={`border-2 px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
                          selectedPartnerKeys.includes(row.role)
                            ? 'border-bauhaus-red bg-bauhaus-red text-white'
                            : 'border-bauhaus-black bg-white text-bauhaus-black'
                        }`}
                      >
                        {selectedPartnerKeys.includes(row.role) ? 'Selected' : 'Select'}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-bauhaus-muted mt-1">{row.topNames.join(' • ') || 'No named examples yet'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="border-4 border-bauhaus-black bg-white p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Buyer Pipeline</p>
              <h2 className="text-2xl font-black mt-1">Canonical Buyer Targets</h2>
            </div>
            <button
              onClick={() => downloadCsv('goods-buyer-pipeline.csv', exportBuyerRows)}
              className="border-2 border-bauhaus-black px-3 py-2 text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white"
            >
              Export CSV
            </button>
          </div>
          <p className="text-sm text-bauhaus-muted mb-3">
            Deduped to one card per buyer entity, with rolled-up community coverage, contracts, contact path, and the strongest current outreach angle.
          </p>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {([
              ['ready-now', 'Ready now'],
              ['relationship-path', 'Needs path'],
              ['contact-gap', 'Contact gap'],
              ['all', 'All buyers'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setBuyerView(value)}
                className={`border-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest ${
                  buyerView === value
                    ? 'border-bauhaus-black bg-bauhaus-black text-white'
                    : 'border-bauhaus-black bg-white text-bauhaus-black'
                }`}
              >
                {label}
                {' '}
                (
                {value === 'all'
                  ? buyerPipelineCounts.all
                  : buyerPipelineCounts[value]}
                )
              </button>
            ))}
          </div>
          <div className="mb-3 border-2 border-bauhaus-black bg-bauhaus-canvas/30 p-3">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Buyer action queue</p>
            <p className="mt-1 text-sm text-bauhaus-black">
              {buyerView === 'ready-now'
                ? 'Start here for direct outreach. These buyers already have a contact path.'
                : buyerView === 'relationship-path'
                  ? 'These buyers are plausible, but you should use a warm intro or named route before treating them as active outreach.'
                  : buyerView === 'contact-gap'
                    ? 'These buyers matter, but the next task is contact discovery, not pitching.'
                    : 'Full buyer universe, sorted with outreach-ready buyers first.'}
            </p>
          </div>
          <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
            {visibleBuyerPipelineCards.slice(0, 30).map((entry) => (
              <div key={entry.key} className="border-2 border-bauhaus-black p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-bauhaus-black">{entry.name}</h3>
                    <p className="text-xs text-bauhaus-muted mt-1">
                      {entry.roles.length ? entry.roles.map(roleLabel).join(' • ') : 'unknown role'} • {entry.communityCount} linked communities
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
                        entry.readiness === 'ready-now'
                          ? 'border-green-700 bg-green-700 text-white'
                          : entry.readiness === 'relationship-path'
                            ? 'border-bauhaus-blue bg-bauhaus-blue text-white'
                            : 'border-bauhaus-red bg-bauhaus-red text-white'
                      }`}
                    >
                      {entry.readinessLabel}
                    </span>
                    <p className="text-sm font-black text-bauhaus-red">{entry.score}</p>
                    <button
                      onClick={() => setSelectedBuyerKeys((current) => toggleValue(current, entry.key))}
                      className={`border-2 px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
                        selectedBuyerKeys.includes(entry.key)
                          ? 'border-bauhaus-red bg-bauhaus-red text-white'
                          : 'border-bauhaus-black bg-white text-bauhaus-black'
                      }`}
                    >
                      {selectedBuyerKeys.includes(entry.key) ? 'Selected' : 'Select'}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-bauhaus-black mt-1">
                  <span className="font-black">Why plausible:</span> {entry.reasons.join(' • ')}
                </p>
                <p className="text-xs text-bauhaus-black mt-1">
                  <span className="font-black">Next action:</span> {entry.nextAction}
                </p>
                <p className="text-xs text-bauhaus-muted mt-1">{entry.readinessSummary}</p>
                <div className="mt-2 border border-bauhaus-black bg-bauhaus-canvas/30 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">CRM signal</p>
                  <p className="mt-1 text-xs text-bauhaus-black">{entry.outcomeSummary}</p>
                  <p className="mt-1 text-xs text-bauhaus-muted">
                    {entry.buyerOpportunityStage
                      ? `Buyer opp updated ${dateLabel(entry.buyerOpportunityUpdatedAt)}`
                      : entry.communityPipelineStage
                        ? `Community lane updated ${dateLabel(entry.communityPipelineUpdatedAt)}`
                        : 'Run a live buyer push to create direct buyer CRM tracking.'}
                    {entry.lastContactDate ? ` • Last contact ${dateLabel(entry.lastContactDate)}` : ''}
                    {entry.engagementStatus ? ` • Contact ${entry.engagementStatus}` : ''}
                  </p>
                </div>
                <p className="mt-2 text-xs text-bauhaus-black">
                  <span className="font-black">Push preview:</span>{' '}
                  {entry.buyerOpportunityStage ? 'Update existing buyer opp' : 'Create new buyer opp'}
                  {entry.buyerOpportunityStage ? ` • ${entry.buyerOpportunityStage}` : ''}
                </p>
                <p className="text-xs text-bauhaus-muted mt-1">
                  Contact: {entry.contactSurface || 'missing'} • Relationship: {entry.relationshipStatus || 'unclassified'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {entry.communities.slice(0, 5).map((community) => (
                    <span
                      key={community.id}
                      className={`border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
                        selectedCommunity?.id === community.id
                          ? 'border-bauhaus-red bg-bauhaus-red text-white'
                          : 'border-bauhaus-black bg-bauhaus-canvas/40 text-bauhaus-black'
                      }`}
                    >
                      {community.name} {community.state ? `(${community.state})` : ''}
                    </span>
                  ))}
                  {entry.communityCount > 5 ? (
                    <span className="border border-bauhaus-black bg-bauhaus-canvas/40 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-black">
                      +{entry.communityCount - 5} more
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-bauhaus-muted">
                  <span>{entry.contractCount} contracts</span>
                  <span>•</span>
                  <span>{money(entry.contractValue)} contract value</span>
                  <span>•</span>
                  <span>{entry.matchedRows} matched rows</span>
                  {entry.link ? (
                    <>
                      <span>•</span>
                      <a href={entry.link} target="_blank" rel="noreferrer" className="underline font-semibold">
                        website
                      </a>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
            {visibleBuyerPipelineCards.length === 0 ? (
              <div className="border-2 border-bauhaus-black bg-bauhaus-canvas/30 p-4 text-sm text-bauhaus-muted">
                No buyers match this readiness filter.
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-4 border-bauhaus-black bg-white p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Capital Stack</p>
              <h2 className="text-2xl font-black mt-1">Grants + Philanthropy + Catalytic Pathways</h2>
            </div>
            <button
              onClick={() => downloadCsv('goods-capital-stack.csv', exportCapitalRows)}
              className="border-2 border-bauhaus-black px-3 py-2 text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white"
            >
              Export CSV
            </button>
          </div>
          <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
            {capitalTargets.slice(0, 30).map((target) => (
              <div key={target.key} className="border-2 border-bauhaus-black p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-bauhaus-black">{target.name}</h3>
                    <p className="text-xs text-bauhaus-muted">{target.provider}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-bauhaus-red">{target.score}</p>
                    <p className="text-[11px] text-bauhaus-muted uppercase tracking-widest">{target.source}</p>
                    <button
                      onClick={() => setSelectedCapitalKeys((current) => toggleValue(current, target.key))}
                      className={`mt-2 border-2 px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
                        selectedCapitalKeys.includes(target.key)
                          ? 'border-bauhaus-red bg-bauhaus-red text-white'
                          : 'border-bauhaus-black bg-white text-bauhaus-black'
                      }`}
                    >
                      {selectedCapitalKeys.includes(target.key) ? 'Selected' : 'Select'}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-bauhaus-black mt-2">
                  <span className="font-black">Why fit:</span> {target.reason}
                </p>
                <div className="mt-2 text-xs text-bauhaus-muted flex flex-wrap gap-x-2 gap-y-1">
                  <span>{target.instrumentType}</span>
                  <span>•</span>
                  <span>{target.openness}</span>
                  <span>•</span>
                  <span>{target.amountHint}</span>
                  <span>•</span>
                  <span>{target.regionFit}</span>
                </div>
                {target.link ? (
                  <a href={target.link} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs font-black underline">
                    Open source
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-4">
        <div className="border-4 border-bauhaus-black bg-white p-4">
          <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Outreach Exports</p>
          <h2 className="text-2xl font-black mt-1">Notion + CSV + CRM Push Payload</h2>
          <p className="text-sm text-bauhaus-muted mt-2">
            Use this payload as the handoff into Goods CRM automation. It is built from your selected targets, or from the current top-ranked defaults if you have not explicitly selected anything yet.
          </p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
            <div className="border-2 border-bauhaus-black p-2">
              <p className="text-[10px] uppercase tracking-widest text-bauhaus-muted">Selection Mode</p>
              <p className="font-black">{hasExplicitSelection ? 'Manual' : 'Top-ranked defaults'}</p>
            </div>
            <div className="border-2 border-bauhaus-black p-2">
              <p className="text-[10px] uppercase tracking-widest text-bauhaus-muted">Buyer Targets</p>
              <p className="font-black">{selectedBuyerTargets.length}</p>
            </div>
            <div className="border-2 border-bauhaus-black p-2">
              <p className="text-[10px] uppercase tracking-widest text-bauhaus-muted">Capital Targets</p>
              <p className="font-black">{selectedCapitalTargets.length}</p>
            </div>
            <div className="border-2 border-bauhaus-black p-2">
              <p className="text-[10px] uppercase tracking-widest text-bauhaus-muted">Partner Targets</p>
              <p className="font-black">{selectedPartnerTargets.length}</p>
            </div>
          </div>
          <div className="mt-3 border-2 border-bauhaus-black p-3 bg-bauhaus-canvas/30">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue mb-2">Selected target set</p>
            <div className="mb-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
              <div className="border border-bauhaus-black bg-white p-2">
                <p className="text-[10px] uppercase tracking-widest text-bauhaus-muted">Buyer opps to create</p>
                <p className="font-black">{selectedBuyerPushSummary.create}</p>
              </div>
              <div className="border border-bauhaus-black bg-white p-2">
                <p className="text-[10px] uppercase tracking-widest text-bauhaus-muted">Buyer opps to update</p>
                <p className="font-black">{selectedBuyerPushSummary.update}</p>
              </div>
              <div className="border border-bauhaus-black bg-white p-2">
                <p className="text-[10px] uppercase tracking-widest text-bauhaus-muted">Push shape</p>
                <p className="font-black">{hasExplicitSelection ? 'Manual set' : 'Default set'}</p>
              </div>
            </div>
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {ghlTargets.map((target) => (
                <div key={target.key} className="border border-bauhaus-black px-3 py-2 bg-white">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black text-sm">{target.name}</p>
                    <p className="text-[10px] uppercase tracking-widest text-bauhaus-muted">{target.type}</p>
                  </div>
                  <p className="text-xs text-bauhaus-muted mt-1">{target.targetSummary}</p>
                  <p className="text-xs text-bauhaus-black mt-1">
                    <span className="font-black">Ask:</span> {target.recommendedAsk}
                  </p>
                  <p className="text-xs text-bauhaus-black mt-1">
                    <span className="font-black">Next:</span> {target.nextAction}
                  </p>
                  {target.type === 'buyer' ? (
                    <p className="text-xs text-bauhaus-muted mt-1">
                      <span className="font-black text-bauhaus-black">CRM preview:</span> {target.crmPreviewSummary}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="border-2 border-bauhaus-black p-3">
              <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue mb-2">Push owner mode</p>
              <div className="flex flex-wrap gap-2">
                {([
                  ['unassigned', 'Leave unassigned'],
                  ['default-owner', 'Assign default owner'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setOwnerMode(value)}
                    disabled={value === 'default-owner' && !ghlDefaultOwnerConfigured}
                    className={`border-2 px-3 py-2 text-xs font-black uppercase tracking-widest ${
                      ownerMode === value
                        ? 'border-bauhaus-black bg-bauhaus-black text-white'
                        : 'border-bauhaus-black bg-white text-bauhaus-black'
                    } ${value === 'default-owner' && !ghlDefaultOwnerConfigured ? 'cursor-not-allowed opacity-40' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {ghlDefaultOwnerConfigured ? (
                <p className="mt-2 text-xs text-green-700">
                  Default owner ready{ghlDefaultOwnerLabel ? `: ${ghlDefaultOwnerLabel}` : ''}. Pushes can land directly with an owner in the Goods pipeline.
                </p>
              ) : (
                <p className="mt-2 text-xs text-bauhaus-red">
                  Configure <span className="font-black">GHL_GOODS_DEFAULT_ASSIGNED_TO</span> to enable direct owner assignment into the Goods pipeline.
                </p>
              )}
            </div>
            <div className="border-2 border-bauhaus-black p-3">
              <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue mb-2">Relationship mode</p>
              <div className="flex flex-wrap gap-2">
                {([
                  ['preserve', 'Preserve current'],
                  ['advance', 'Advance to active push'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setRelationshipMode(value)}
                    className={`border-2 px-3 py-2 text-xs font-black uppercase tracking-widest ${
                      relationshipMode === value
                        ? 'border-bauhaus-black bg-bauhaus-black text-white'
                        : 'border-bauhaus-black bg-white text-bauhaus-black'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-bauhaus-muted">
                Preserve uses the current buyer relationship status where available. Advance moves the pushed target into a live outreach lane.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => {
                setSelectedBuyerKeys([]);
                setSelectedCapitalKeys([]);
                setSelectedPartnerKeys([]);
              }}
              className="border-2 border-bauhaus-black px-3 py-2 text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white"
            >
              Reset to defaults
            </button>
            <button
              onClick={() => downloadCsv('goods-outreach-notion-ready.csv', selectedTargetRows)}
              className="border-2 border-bauhaus-black px-3 py-2 text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white"
            >
              Notion-ready table
            </button>
            <button
              onClick={() => downloadCsv('goods-buyer-targets.csv', exportBuyerRows)}
              className="border-2 border-bauhaus-black px-3 py-2 text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white"
            >
              Buyer CSV
            </button>
            <button
              onClick={() => downloadCsv('goods-capital-targets.csv', exportCapitalRows)}
              className="border-2 border-bauhaus-black px-3 py-2 text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white"
            >
              Capital CSV
            </button>
            <button
              onClick={() => downloadText('goods-weekly-operating-snapshot.md', weeklySnapshotMarkdown, 'text/markdown;charset=utf-8;')}
              className="border-2 border-bauhaus-black px-3 py-2 text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white"
            >
              Weekly snapshot
            </button>
            <button
              onClick={() => runGhlPush(true)}
              disabled={pushBusy}
              className="border-2 border-bauhaus-black px-3 py-2 text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white disabled:opacity-50"
            >
              Dry-run GHL push
            </button>
            <button
              onClick={() => runGhlPush(false)}
              disabled={pushBusy || isRefreshing}
              className="border-2 border-bauhaus-red bg-bauhaus-red text-white px-3 py-2 text-xs font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-50"
            >
              {isRefreshing ? 'Refreshing Goods data…' : 'Push selected targets to GHL'}
            </button>
            <a
              href={GOODS_QBE_ACTIONS_URL}
              target="_blank"
              rel="noreferrer"
              className="border-2 border-bauhaus-black px-3 py-2 text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white"
            >
              Open QBE Actions
            </a>
          </div>
          {pushStatus ? (
            <p className={`mt-3 text-sm font-semibold ${pushStatus.includes('failed') ? 'text-bauhaus-red' : 'text-green-700'}`}>
              {pushStatus}
            </p>
          ) : null}
          <pre className="mt-3 border-2 border-bauhaus-black bg-bauhaus-canvas/40 p-3 text-xs overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(crmPayload, null, 2)}
          </pre>
        </div>

        <div className="space-y-4">
          <div className="border-4 border-bauhaus-black bg-white p-4">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Pipeline outcomes</p>
            <h3 className="text-xl font-black mt-1">Live Goods pipeline state</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="border-2 border-bauhaus-black p-2">
                <p className="text-[10px] uppercase tracking-widest text-bauhaus-muted">Pipeline opportunities</p>
                <p className="text-2xl font-black">{pipelineTotals.count}</p>
              </div>
              <div className="border-2 border-bauhaus-black p-2">
                <p className="text-[10px] uppercase tracking-widest text-bauhaus-muted">Pipeline value</p>
                <p className="text-2xl font-black">{money(pipelineTotals.value)}</p>
              </div>
              <div className="border-2 border-bauhaus-black p-2">
                <p className="text-[10px] uppercase tracking-widest text-bauhaus-muted">Assigned now</p>
                <p className="text-2xl font-black">{recentMovement.assignedCount}</p>
              </div>
              <div className="border-2 border-bauhaus-black p-2">
                <p className="text-[10px] uppercase tracking-widest text-bauhaus-muted">Out of new lead</p>
                <p className="text-2xl font-black">{recentMovement.activeCount}</p>
              </div>
            </div>
            <div className="mt-3 border-2 border-bauhaus-black p-3 bg-bauhaus-canvas/30">
              <p className="text-[10px] uppercase tracking-widest text-bauhaus-blue">What moved since last live push</p>
              {latestLivePush ? (
                <>
                  <p className="mt-1 text-sm text-bauhaus-muted">
                    Last live push: <span className="font-black text-bauhaus-black">{dateTimeLabel(latestLivePush.startedAt)}</span>
                  </p>
                  <p className="mt-2 text-sm text-bauhaus-black">
                    <span className="font-black">{recentMovement.updatedSinceLastPush.length}</span> recent Goods opportunities updated after that push.
                  </p>
                  <p className="mt-1 text-xs text-bauhaus-muted">
                    Latest push created {latestLivePush.created} and updated {latestLivePush.updated} records from {latestLivePush.processed} selected targets.
                  </p>
                  <div className="mt-3 space-y-2">
                    {recentMovement.updatedSinceLastPush.length > 0 ? (
                      recentMovement.updatedSinceLastPush.slice(0, 5).map((opportunity, index) => (
                        <div
                          key={opportunity.ghl_id || `${opportunity.name || 'moved-opportunity'}-${index}`}
                          className="border border-bauhaus-black bg-white px-3 py-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-black text-sm">{opportunity.name || 'Unnamed opportunity'}</p>
                            <p className="text-[10px] uppercase tracking-widest text-bauhaus-red">
                              {opportunity.stage_name || 'Unknown'}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-bauhaus-muted">
                            {money(toNumber(opportunity.monetary_value))} • updated {dateTimeLabel(opportunity.updated_at)}
                          </p>
                          <p className="mt-1 text-xs text-bauhaus-black">
                            Assigned to: {opportunity.assigned_to || 'unassigned'}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-bauhaus-muted">
                        No recent Goods opportunities in the latest list have updated after the last recorded live push.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-bauhaus-muted">
                  No live Goods workspace push has been recorded yet. Run a push and this panel will show what changed afterwards.
                </p>
              )}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {goodsPipelineStages.map((row) => (
                <div key={row.stage_name || 'Unknown'} className="border-2 border-bauhaus-black p-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-sm">{row.stage_name || 'Unknown'}</p>
                    <p className="text-xs text-bauhaus-muted">{money(toNumber(row.stage_value))}</p>
                  </div>
                  <p className="text-xl font-black text-bauhaus-red">{toNumber(row.stage_count)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-4 border-bauhaus-black bg-white p-4">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Recent push activity</p>
            <div className="mt-3 space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {pushLogRows.length > 0 ? pushLogRows.map((row) => (
                <div key={row.id} className="border-2 border-bauhaus-black p-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black text-sm">{row.dryRun ? 'Dry run' : 'CRM push'} • {row.status}</p>
                    <p className="text-xs text-bauhaus-muted">{dateLabel(row.startedAt)}</p>
                  </div>
                  <p className="text-xs text-bauhaus-black mt-1">
                    {row.processed} targets • {row.created} created • {row.updated} updated • {row.failed} failed
                  </p>
                  <p className="text-xs text-bauhaus-muted mt-1">
                    {row.triggeredBy} • owner: {row.ownerMode} • relationship: {row.relationshipMode}
                  </p>
                </div>
              )) : (
                <p className="text-sm text-bauhaus-muted">No Goods workspace push log yet.</p>
              )}
            </div>
          </div>

          <div className="border-4 border-bauhaus-black bg-white p-4">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Recent Goods opportunities</p>
            <div className="mt-3 space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {goodsPipelineOpportunities.map((opportunity, index) => (
                <div key={opportunity.ghl_id || `${opportunity.name || 'opportunity'}-${index}`} className="border-2 border-bauhaus-black p-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-black text-sm">{opportunity.name || 'Unnamed opportunity'}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">{opportunity.stage_name || 'Unknown'}</p>
                  </div>
                  <p className="text-xs text-bauhaus-muted mt-1">
                    {money(toNumber(opportunity.monetary_value))} • {opportunity.status || 'open'} • updated {dateLabel(opportunity.updated_at)}
                  </p>
                  <p className="text-xs text-bauhaus-black mt-1">
                    Assigned to: {opportunity.assigned_to || 'unassigned'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-4 border-bauhaus-black bg-white p-4">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">NT Coverage Gaps</p>
            <h3 className="text-xl font-black mt-1">Crosswalk + Goods buyer gap check</h3>
            <p className="text-sm text-bauhaus-muted mt-1">
              Crosswalk gaps are strict entity-graph keyword matches. Goods buyer leads include crosswalk matches plus verified anchor inference.
            </p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div className="border-2 border-bauhaus-black p-2">
                <p className="text-[10px] uppercase tracking-widest text-bauhaus-muted">Goods buyer lead gaps</p>
                <p className="text-2xl font-black text-bauhaus-red">{goodsZeroBuyerCount}</p>
              </div>
              <div className="border-2 border-bauhaus-black p-2">
                <p className="text-[10px] uppercase tracking-widest text-bauhaus-muted">Crosswalk buyer gaps</p>
                <p className="text-2xl font-black text-bauhaus-red">{crosswalkZeroBuyerCount}</p>
              </div>
            </div>
            <p className="mt-3 text-xs font-black uppercase tracking-widest text-bauhaus-blue">Crosswalk gap communities</p>
            <div className="mt-3 space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {crosswalkZeroBuyerRows.map((row, index) => (
                <div key={`${row.community_name || 'unknown'}-${index}`} className="border-2 border-bauhaus-black p-2">
                  <p className="font-black text-sm">{row.community_name || 'Unknown community'}</p>
                  <p className="text-xs text-bauhaus-muted">
                    {row.region_label || 'Region unknown'} • Postcode {row.postcode || 'missing'} • Priority {row.goods_focus_priority || 'unset'}
                  </p>
                </div>
              ))}
            </div>
            {goodsZeroBuyerCount === 0 ? (
              <p className="mt-3 text-sm text-green-700 font-semibold">All NT Goods communities currently have at least one buyer lead row.</p>
            ) : (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-black uppercase tracking-widest text-bauhaus-red">NT communities still missing Goods buyer leads</p>
                {goodsZeroBuyerRows.map((community) => (
                  <div key={community.id} className="border-2 border-bauhaus-red p-2">
                    <p className="font-black text-sm">{community.community_name}</p>
                    <p className="text-xs text-bauhaus-muted">
                      {community.region_label || community.lga_name || 'Region unknown'} • Postcode {community.postcode || 'missing'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="border-4 border-bauhaus-black bg-white p-4">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">ABN Ownership</p>
            <p className="text-sm text-bauhaus-black mt-1">
              Signed in as {userEmail || 'unknown user'}.
            </p>
            <p className="text-sm text-bauhaus-black mt-1">
              Current org: <span className="font-black">{orgProfile?.name || 'Unclaimed org profile'}</span>
            </p>
            <p className="text-sm text-bauhaus-black mt-1">
              Tracked ABN: <span className="font-black">{orgProfile?.abn || 'Missing — add ABN in /profile to claim Goods output under your entity.'}</span>
            </p>
            <Link href="/profile" className="inline-block mt-3 border-2 border-bauhaus-black px-3 py-2 text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white">
              Open profile
            </Link>
          </div>
        </div>
      </section>

      {selectedCommunity && selectedCommunitySignals.length > 0 ? (
        <section className="mt-4 border-4 border-bauhaus-black bg-white p-4">
          <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Live Procurement Signals</p>
          <h2 className="text-2xl font-black mt-1">
            {selectedCommunity.community_name} signal queue
          </h2>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            {selectedCommunitySignals.map((signal) => (
              <div key={signal.id} className="border-2 border-bauhaus-black p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black text-bauhaus-black">{signal.title || 'Untitled signal'}</p>
                  <p className="text-xs font-black uppercase tracking-widest text-bauhaus-red">{signal.priority || 'unset'}</p>
                </div>
                <p className="text-xs text-bauhaus-muted mt-1">{signal.signal_type || 'signal'} • {signal.status || 'new'} • {dateLabel(signal.created_at)}</p>
                <p className="text-sm text-bauhaus-black mt-2">{signal.description || 'No description yet.'}</p>
                <p className="text-xs text-bauhaus-muted mt-2">
                  Units {toNumber(signal.estimated_units)} • Value {money(toNumber(signal.estimated_value))}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {mapExpanded ? (
        <div className="fixed inset-4 z-[1200] border-4 border-bauhaus-black bg-white p-4 shadow-[12px_12px_0_0_rgba(0,0,0,0.12)]">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Expanded map</p>
              <h2 className="text-2xl font-black mt-1">Goods community operating map</h2>
              <p className="mt-1 text-sm text-bauhaus-muted">
                Work one community at a time, switch layers, then jump straight into the dossier.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMapExpanded(false)}
              className="border-2 border-bauhaus-black px-3 py-2 text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white"
            >
              Close map
            </button>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {([
              ['need', 'Need'],
              ['beds', 'Beds'],
              ['washers', 'Washers'],
              ['fridges', 'Fridges'],
              ['buyer-gaps', 'Buyer gaps'],
              ['partners', 'Partners'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMapLayer(value)}
                className={`border-2 px-3 py-2 text-xs font-black uppercase tracking-widest ${
                  mapLayer === value
                    ? 'border-bauhaus-black bg-bauhaus-black text-white'
                    : 'border-bauhaus-black bg-white text-bauhaus-black'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <GoodsCommunityMap
            points={mapPoints}
            selectedPoint={selectedMapPoint}
            selectedLayer={mapLayer}
            onSelect={setSelectedCommunityId}
            onOpenDossier={() => {
              setMapExpanded(false);
              setTimeout(() => openCommunityDossier(), 120);
            }}
            expanded
            ntOnly={showOnlyNt}
          />
        </div>
      ) : null}
    </div>
  );
}
