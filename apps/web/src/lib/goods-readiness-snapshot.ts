import { getServiceSupabase } from '@/lib/supabase';
import {
  goodsGovernanceRows,
  goodsRiskRows,
} from '@/lib/services/goods-operating-system';

type SourceStatus = 'ok' | 'partial' | 'empty' | 'error';
type ChecklistStatus = 'ready' | 'partial' | 'gap';
type GovernanceStatus = 'ready' | 'partial' | 'gap' | 'blocked' | 'unknown';
type GovernancePriority = 'critical' | 'high' | 'medium' | 'low';

interface QueryOutcome<T> {
  rows: T[];
  error: string | null;
}

interface GoodsCommunityRow {
  id: string;
  community_name: string | null;
  state: string | null;
  postcode: string | null;
  priority: string | null;
  demand_beds: number | null;
  demand_washers: number | null;
  demand_fridges: number | null;
  demand_mattresses: number | null;
  assets_deployed: number | null;
  assets_active: number | null;
  assets_overdue: number | null;
  known_buyer_name: string | null;
  buyer_entity_count: number | null;
  total_govt_contract_value: number | null;
  total_justice_funding: number | null;
  nearest_staging_hub: string | null;
  freight_corridor: string | null;
  data_quality_score: number | null;
  last_profiled_at: string | null;
  updated_at: string | null;
}

interface GoodsAssetRow {
  id: string;
  goods_asset_id: string | null;
  product_slug: string | null;
  product_type: string | null;
  community_name: string | null;
  current_status: string | null;
  deployed_at: string | null;
  last_checkin_at: string | null;
  is_overdue: boolean | null;
  needs_replacement: boolean | null;
  last_synced_at: string | null;
  updated_at: string | null;
}

interface GoodsProcurementSignalRow {
  id: string;
  signal_type: string | null;
  priority: string | null;
  title: string | null;
  description: string | null;
  estimated_value: number | null;
  estimated_units: number | null;
  products_needed: string[] | null;
  matched_grant_ids: string[] | null;
  matched_foundation_ids: string[] | null;
  funding_confidence: string | null;
  status: string | null;
  ghl_contact_id: string | null;
  ghl_synced_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  community_id: string | null;
  buyer_entity_id: string | null;
}

interface GoodsBuyerRow {
  id: string;
  entity_name: string | null;
  buyer_role: string | null;
  relationship_status: string | null;
  estimated_annual_spend: number | null;
  govt_contract_value: number | null;
  fit_score: number | null;
  next_action: string | null;
  last_contact_date: string | null;
  product_fit: string[] | null;
  community_id: string | null;
  updated_at: string | null;
}

interface GoodsProductRow {
  id: string;
  slug: string | null;
  name: string | null;
  status: string | null;
  material_cost_aud: number | null;
  manufacturing_cost_aud: number | null;
  wholesale_price_aud: number | null;
  typical_delivered_cost_remote: number | null;
  goods_delivered_cost_remote: number | null;
  expected_lifespan_months: number | null;
  warranty_months: number | null;
  updated_at: string | null;
}

interface GhlOpportunityRow {
  id: string;
  ghl_id: string | null;
  ghl_pipeline_id: string | null;
  ghl_stage_id: string | null;
  name: string | null;
  pipeline_name: string | null;
  stage_name: string | null;
  status: string | null;
  monetary_value: number | null;
  project_code: string | null;
  ghl_updated_at: string | null;
  last_synced_at: string | null;
}

interface GhlPipelineRow {
  id: string;
  ghl_id: string | null;
  name: string | null;
  stages: unknown;
  last_synced_at: string | null;
}

interface GoodsGovernanceReadinessDbRow {
  id: string;
  readiness_key: string;
  area: string;
  status: GovernanceStatus | null;
  priority: GovernancePriority | null;
  decision: string | null;
  position: string | null;
  owner: string | null;
  next_action: string | null;
  blocker: string | null;
  evidence_refs: unknown;
  source_refs: unknown;
  opportunity_lanes: string[] | null;
  public_visibility: string | null;
  reviewed_at: string | null;
  due_at: string | null;
  updated_at: string | null;
}

export interface GoodsReadinessSourceHealth {
  key:
    | 'goods_communities'
    | 'goods_asset_lifecycle'
    | 'goods_procurement_signals'
    | 'goods_procurement_entities'
    | 'goods_products'
    | 'goods_governance_readiness'
    | 'ghl_opportunities'
    | 'ghl_pipelines';
  label: string;
  status: SourceStatus;
  count: number;
  freshness: string | null;
  detail: string;
  error?: string;
}

export interface GoodsDemandSummary {
  communityCount: number;
  leadCount: number;
  activeCount: number;
  warmCount: number;
  monitorCount: number;
  assetsDeployed: number;
  totalDemand: {
    beds: number;
    washers: number;
    fridges: number;
    mattresses: number;
  };
  lastProfiledAt: string | null;
}

export interface GoodsAssetSummary {
  assetCount: number;
  overdueCount: number;
  replacementCount: number;
  statusCounts: Array<{ label: string; count: number }>;
  productCounts: Array<{ label: string; count: number }>;
  lastSyncedAt: string | null;
}

export interface GoodsProcurementSummary {
  signalCount: number;
  newCount: number;
  reviewingCount: number;
  syncedToGhlCount: number;
  matchedGrantCount: number;
  matchedFoundationCount: number;
  estimatedValue: number;
  estimatedUnits: number;
  statusCounts: Array<{ label: string; count: number }>;
  priorityCounts: Array<{ label: string; count: number }>;
  buyerCount: number;
  lastUpdatedAt: string | null;
}

export interface GoodsProductSummary {
  productCount: number;
  activeCount: number;
  priceBookCoverage: number;
  remoteCostCoverage: number;
  products: Array<{
    slug: string;
    name: string;
    status: string;
    wholesalePrice: number | null;
    remoteDeliveredCost: number | null;
    expectedLifespanMonths: number | null;
    warrantyMonths: number | null;
  }>;
  lastUpdatedAt: string | null;
}

export interface GoodsGhlPipelineStage {
  pipeline: string;
  stage: string;
  status: string;
  count: number;
  value: number;
  lastSyncedAt: string | null;
}

export interface GoodsGhlMirrorSummary {
  opportunityCount: number;
  goodsOpportunityCount: number;
  pipelineCount: number;
  openValue: number;
  wonValue: number;
  lastSyncedAt: string | null;
  pipelineStages: GoodsGhlPipelineStage[];
}

export interface GoodsGovernanceReadinessItem {
  id: string;
  key: string;
  area: string;
  status: GovernanceStatus;
  priority: GovernancePriority;
  decision: string;
  position: string;
  owner: string | null;
  nextAction: string;
  blocker: string | null;
  evidenceRefs: Array<{ label: string; detail: string }>;
  sourceRefs: Array<{ source: string; ref: string }>;
  opportunityLanes: string[];
  publicVisibility: string;
  reviewedAt: string | null;
  dueAt: string | null;
}

export interface GoodsGovernanceSummary {
  itemCount: number;
  readyCount: number;
  partialCount: number;
  gapCount: number;
  blockedCount: number;
  criticalGapCount: number;
  promotionBlocked: boolean;
  sourceMode: 'supabase' | 'wiki-fallback';
  lastReviewedAt: string | null;
  nextCriticalAction: string;
  items: GoodsGovernanceReadinessItem[];
}

export interface GoodsTopCommunity {
  id: string;
  name: string;
  state: string | null;
  postcode: string | null;
  priority: string;
  demandUnits: number;
  assetsDeployed: number;
  buyerCount: number;
  knownBuyerName: string | null;
  contractValue: number;
  stagingHub: string | null;
  freightCorridor: string | null;
}

export interface GoodsTopSignal {
  id: string;
  title: string;
  signalType: string;
  priority: string;
  status: string;
  estimatedValue: number | null;
  estimatedUnits: number;
  productsNeeded: string[];
  fundingConfidence: string | null;
  syncedToGhl: boolean;
  updatedAt: string | null;
}

export interface GoodsTopBuyer {
  id: string;
  name: string;
  role: string;
  relationshipStatus: string;
  fitScore: number;
  estimatedAnnualSpend: number;
  govtContractValue: number;
  nextAction: string | null;
}

export interface GoodsReadinessChecklistItem {
  id: string;
  label: string;
  status: ChecklistStatus;
  detail: string;
  nextAction: string;
}

export interface GoodsReadinessSnapshot {
  generatedAt: string;
  sourceHealth: GoodsReadinessSourceHealth[];
  demand: GoodsDemandSummary;
  assets: GoodsAssetSummary;
  procurement: GoodsProcurementSummary;
  products: GoodsProductSummary;
  ghlMirror: GoodsGhlMirrorSummary;
  governance: GoodsGovernanceSummary;
  topCommunities: GoodsTopCommunity[];
  topSignals: GoodsTopSignal[];
  topBuyers: GoodsTopBuyer[];
  checklist: GoodsReadinessChecklistItem[];
  roadmapMoves: string[];
  safety: {
    mode: 'read-only-snapshot';
    notes: string[];
  };
}

export interface GoodsReadinessRows {
  communities: QueryOutcome<GoodsCommunityRow>;
  assets: QueryOutcome<GoodsAssetRow>;
  signals: QueryOutcome<GoodsProcurementSignalRow>;
  buyers: QueryOutcome<GoodsBuyerRow>;
  products: QueryOutcome<GoodsProductRow>;
  ghlOpportunities: QueryOutcome<GhlOpportunityRow>;
  ghlPipelines: QueryOutcome<GhlPipelineRow>;
  governance: QueryOutcome<GoodsGovernanceReadinessDbRow>;
}

async function safeQuery<T>(
  promise: PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<QueryOutcome<T>> {
  try {
    const result = await promise;
    if (result.error) return { rows: [], error: result.error.message };
    return { rows: (result.data ?? []) as T[], error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'Unknown query error' };
  }
}

async function safePagedQuery<T>(
  makeQuery: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<QueryOutcome<T>> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const page = await safeQuery<T>(makeQuery(from, from + pageSize - 1));
    if (page.error) return { rows, error: page.error };
    rows.push(...page.rows);
    if (page.rows.length < pageSize) return { rows, error: null };
    from += pageSize;
  }
}

function numberValue(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function sumNumber<T>(rows: T[], getValue: (row: T) => number | null | undefined) {
  return rows.reduce((total, row) => total + numberValue(getValue(row)), 0);
}

function countBy<T>(rows: T[], getValue: (row: T) => string | null | undefined) {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const label = getValue(row)?.trim() || 'unknown';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function maxDate(values: Array<string | null | undefined>) {
  let latest: Date | null = null;
  for (const value of values) {
    if (!value) continue;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) continue;
    if (!latest || date.getTime() > latest.getTime()) latest = date;
  }
  return latest?.toISOString() ?? null;
}

function ageDays(value: string | null, now: Date) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}

function sourceStatus(count: number, error: string | null, freshness: string | null, now: Date): SourceStatus {
  if (error) return 'error';
  if (count === 0) return 'empty';
  const age = ageDays(freshness, now);
  if (age !== null && age > 45) return 'partial';
  return 'ok';
}

function sourceHealth(
  key: GoodsReadinessSourceHealth['key'],
  label: string,
  outcome: QueryOutcome<unknown>,
  freshness: string | null,
  detail: string,
  now: Date,
): GoodsReadinessSourceHealth {
  return {
    key,
    label,
    status: sourceStatus(outcome.rows.length, outcome.error, freshness, now),
    count: outcome.rows.length,
    freshness,
    detail,
    ...(outcome.error ? { error: outcome.error } : {}),
  };
}

function isGoodsOpportunity(row: GhlOpportunityRow) {
  const haystack = [row.pipeline_name, row.name, row.project_code].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes('goods') || haystack.includes('act-gd');
}

function priorityWeight(priority: string | null | undefined) {
  if (priority === 'urgent') return 0;
  if (priority === 'high') return 1;
  if (priority === 'medium') return 2;
  return 3;
}

function governancePriorityWeight(priority: GovernancePriority) {
  if (priority === 'critical') return 0;
  if (priority === 'high') return 1;
  if (priority === 'medium') return 2;
  return 3;
}

function checklistStatus(condition: boolean, partial: boolean): ChecklistStatus {
  if (condition) return 'ready';
  if (partial) return 'partial';
  return 'gap';
}

function parseEvidenceRefs(value: unknown): Array<{ label: string; detail: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      return {
        label: String(record.label ?? record.source ?? 'Evidence'),
        detail: String(record.detail ?? record.ref ?? ''),
      };
    })
    .filter((item): item is { label: string; detail: string } => Boolean(item?.label));
}

function parseSourceRefs(value: unknown): Array<{ source: string; ref: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      return {
        source: String(record.source ?? 'Source'),
        ref: String(record.ref ?? record.detail ?? ''),
      };
    })
    .filter((item): item is { source: string; ref: string } => Boolean(item?.source));
}

function fallbackGovernanceItems(): GoodsGovernanceReadinessItem[] {
  const riskByOwner = new Map(goodsRiskRows.map((row) => [row.owner, row.risk]));

  return goodsGovernanceRows.map((row, index) => {
    const key = row.area.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const status: GovernanceStatus =
      row.area === 'ACT role'
        ? 'ready'
        : row.area === 'Community benefit'
          ? 'partial'
          : 'gap';
    const priority: GovernancePriority = row.area === 'ACT role' ? 'high' : 'critical';

    return {
      id: `wiki-governance-${key || index}`,
      key: key || `governance-${index}`,
      area: row.area,
      status,
      priority,
      decision: row.decision,
      position: row.position,
      owner:
        row.area === 'ACT role'
          ? 'ACT shared service'
          : row.area === 'Community benefit'
            ? 'Governance / community authority'
            : 'Governance / legal',
      nextAction:
        status === 'ready'
          ? 'Keep this position visible in briefs and opportunity promotion checks.'
          : row.decision,
      blocker:
        row.area === 'Goods vehicle'
          ? riskByOwner.get('Governance / legal') ?? 'First Nations governance and ownership pathway not settled.'
          : row.area === 'IP and licence'
            ? 'IP, licence, data, story, and brand permissions are not yet a structured proof row.'
            : status === 'partial'
              ? 'Narrative exists but reporting/proof fields are not yet structured.'
              : null,
      evidenceRefs: [{ label: 'Goods governance row', detail: row.position }],
      sourceRefs: [{ source: 'ACT wiki', ref: 'Goods operating system' }],
      opportunityLanes:
        row.area === 'ACT role'
          ? ['grant', 'foundation', 'procurement', 'capital', 'systems']
          : ['grant', 'procurement', 'capital', 'systems'],
      publicVisibility: row.area === 'Community benefit' ? 'community_approval_required' : 'internal',
      reviewedAt: null,
      dueAt: null,
    };
  });
}

function mapGovernanceRows(rows: GoodsGovernanceReadinessDbRow[]): GoodsGovernanceReadinessItem[] {
  return rows.map((row) => ({
    id: row.id,
    key: row.readiness_key,
    area: row.area,
    status: row.status ?? 'unknown',
    priority: row.priority ?? 'high',
    decision: row.decision ?? 'Decision not recorded.',
    position: row.position ?? 'Position not recorded.',
    owner: row.owner,
    nextAction: row.next_action ?? 'Assign an owner and next action.',
    blocker: row.blocker,
    evidenceRefs: parseEvidenceRefs(row.evidence_refs),
    sourceRefs: parseSourceRefs(row.source_refs),
    opportunityLanes: row.opportunity_lanes ?? [],
    publicVisibility: row.public_visibility ?? 'internal',
    reviewedAt: row.reviewed_at ?? row.updated_at,
    dueAt: row.due_at,
  }));
}

function buildGovernanceSummary(
  rows: QueryOutcome<GoodsGovernanceReadinessDbRow>,
): GoodsGovernanceSummary {
  const sourceMode: GoodsGovernanceSummary['sourceMode'] = rows.rows.length > 0 ? 'supabase' : 'wiki-fallback';
  const items = (rows.rows.length > 0 ? mapGovernanceRows(rows.rows) : fallbackGovernanceItems()).sort(
    (a, b) => governancePriorityWeight(a.priority) - governancePriorityWeight(b.priority) || a.area.localeCompare(b.area),
  );
  const criticalGaps = items.filter(
    (item) => item.priority === 'critical' && ['gap', 'blocked', 'unknown'].includes(item.status),
  );

  return {
    itemCount: items.length,
    readyCount: items.filter((item) => item.status === 'ready').length,
    partialCount: items.filter((item) => item.status === 'partial').length,
    gapCount: items.filter((item) => item.status === 'gap' || item.status === 'unknown').length,
    blockedCount: items.filter((item) => item.status === 'blocked').length,
    criticalGapCount: criticalGaps.length,
    promotionBlocked: criticalGaps.length > 0,
    sourceMode,
    lastReviewedAt: maxDate(items.map((item) => item.reviewedAt)),
    nextCriticalAction:
      criticalGaps[0]?.nextAction ??
      items.find((item) => item.status === 'partial')?.nextAction ??
      'Keep governance rows reviewed before promoting major Goods opportunities.',
    items,
  };
}

function governanceSourceHealth(
  outcome: QueryOutcome<GoodsGovernanceReadinessDbRow>,
  governance: GoodsGovernanceSummary,
  now: Date,
): GoodsReadinessSourceHealth {
  if (outcome.rows.length > 0) {
    return sourceHealth(
      'goods_governance_readiness',
      'Goods governance readiness',
      outcome,
      governance.lastReviewedAt,
      'Applicant, contracting, community benefit, IP/licence, insurance, bank, and compliance readiness.',
      now,
    );
  }

  return {
    key: 'goods_governance_readiness',
    label: 'Goods governance readiness',
    status: 'partial',
    count: governance.itemCount,
    freshness: governance.lastReviewedAt,
    detail:
      'Using ACT wiki fallback rows. Apply the goods_governance_readiness migration to make this a live Supabase source.',
    ...(outcome.error ? { error: outcome.error } : {}),
  };
}

export function buildGoodsReadinessSnapshotFromRows(
  rows: GoodsReadinessRows,
  now = new Date(),
): GoodsReadinessSnapshot {
  const communities = rows.communities.rows;
  const assets = rows.assets.rows;
  const signals = rows.signals.rows;
  const buyers = rows.buyers.rows;
  const products = rows.products.rows;
  const opportunities = rows.ghlOpportunities.rows;
  const pipelines = rows.ghlPipelines.rows;
  const goodsOpportunities = opportunities.filter(isGoodsOpportunity);
  const governance = buildGovernanceSummary(rows.governance);

  const demand: GoodsDemandSummary = {
    communityCount: communities.length,
    leadCount: communities.filter((row) => row.priority === 'lead').length,
    activeCount: communities.filter((row) => row.priority === 'active').length,
    warmCount: communities.filter((row) => row.priority === 'warm').length,
    monitorCount: communities.filter((row) => row.priority === 'monitor').length,
    assetsDeployed: sumNumber(communities, (row) => row.assets_deployed),
    totalDemand: {
      beds: sumNumber(communities, (row) => row.demand_beds),
      washers: sumNumber(communities, (row) => row.demand_washers),
      fridges: sumNumber(communities, (row) => row.demand_fridges),
      mattresses: sumNumber(communities, (row) => row.demand_mattresses),
    },
    lastProfiledAt: maxDate(communities.map((row) => row.last_profiled_at ?? row.updated_at)),
  };

  const assetSummary: GoodsAssetSummary = {
    assetCount: assets.length,
    overdueCount: assets.filter((row) => row.is_overdue).length,
    replacementCount: assets.filter((row) => row.needs_replacement).length,
    statusCounts: countBy(assets, (row) => row.current_status).slice(0, 8),
    productCounts: countBy(assets, (row) => row.product_type ?? row.product_slug).slice(0, 8),
    lastSyncedAt: maxDate(assets.map((row) => row.last_synced_at ?? row.updated_at)),
  };

  const procurement: GoodsProcurementSummary = {
    signalCount: signals.length,
    newCount: signals.filter((row) => row.status === 'new').length,
    reviewingCount: signals.filter((row) => row.status === 'reviewing').length,
    syncedToGhlCount: signals.filter((row) => Boolean(row.ghl_synced_at || row.ghl_contact_id)).length,
    matchedGrantCount: signals.filter((row) => (row.matched_grant_ids ?? []).length > 0).length,
    matchedFoundationCount: signals.filter((row) => (row.matched_foundation_ids ?? []).length > 0).length,
    estimatedValue: sumNumber(signals, (row) => row.estimated_value),
    estimatedUnits: sumNumber(signals, (row) => row.estimated_units),
    statusCounts: countBy(signals, (row) => row.status).slice(0, 8),
    priorityCounts: countBy(signals, (row) => row.priority).slice(0, 8),
    buyerCount: buyers.length,
    lastUpdatedAt: maxDate(signals.map((row) => row.updated_at ?? row.created_at)),
  };

  const priceCovered = products.filter((row) => row.wholesale_price_aud || row.goods_delivered_cost_remote);
  const remoteCostCovered = products.filter((row) => row.goods_delivered_cost_remote || row.typical_delivered_cost_remote);
  const productSummary: GoodsProductSummary = {
    productCount: products.length,
    activeCount: products.filter((row) => row.status === 'active' || row.status === 'prototype').length,
    priceBookCoverage: products.length ? Math.round((priceCovered.length / products.length) * 100) : 0,
    remoteCostCoverage: products.length ? Math.round((remoteCostCovered.length / products.length) * 100) : 0,
    products: products.slice(0, 8).map((row) => ({
      slug: row.slug ?? row.id,
      name: row.name ?? row.slug ?? 'Goods product',
      status: row.status ?? 'unknown',
      wholesalePrice: row.wholesale_price_aud,
      remoteDeliveredCost: row.goods_delivered_cost_remote ?? row.typical_delivered_cost_remote,
      expectedLifespanMonths: row.expected_lifespan_months,
      warrantyMonths: row.warranty_months,
    })),
    lastUpdatedAt: maxDate(products.map((row) => row.updated_at)),
  };

  const stageMap = new Map<string, GoodsGhlPipelineStage>();
  for (const opportunity of goodsOpportunities) {
    const key = [
      opportunity.pipeline_name ?? 'Unknown pipeline',
      opportunity.stage_name ?? 'Unknown stage',
      opportunity.status ?? 'unknown',
    ].join('|');
    const existing = stageMap.get(key) ?? {
      pipeline: opportunity.pipeline_name ?? 'Unknown pipeline',
      stage: opportunity.stage_name ?? 'Unknown stage',
      status: opportunity.status ?? 'unknown',
      count: 0,
      value: 0,
      lastSyncedAt: null,
    };
    existing.count += 1;
    existing.value += numberValue(opportunity.monetary_value);
    existing.lastSyncedAt = maxDate([existing.lastSyncedAt, opportunity.last_synced_at ?? opportunity.ghl_updated_at]);
    stageMap.set(key, existing);
  }

  const ghlMirror: GoodsGhlMirrorSummary = {
    opportunityCount: opportunities.length,
    goodsOpportunityCount: goodsOpportunities.length,
    pipelineCount: new Set(goodsOpportunities.map((row) => row.pipeline_name).filter(Boolean)).size,
    openValue: sumNumber(
      goodsOpportunities.filter((row) => row.status === 'open'),
      (row) => row.monetary_value,
    ),
    wonValue: sumNumber(
      goodsOpportunities.filter((row) => row.status === 'won'),
      (row) => row.monetary_value,
    ),
    lastSyncedAt: maxDate([
      ...opportunities.map((row) => row.last_synced_at ?? row.ghl_updated_at),
      ...pipelines.map((row) => row.last_synced_at),
    ]),
    pipelineStages: Array.from(stageMap.values()).sort((a, b) => b.count - a.count).slice(0, 10),
  };

  const topCommunities = communities
    .map((row): GoodsTopCommunity => {
      const demandUnits =
        numberValue(row.demand_beds) +
        numberValue(row.demand_washers) +
        numberValue(row.demand_fridges) +
        numberValue(row.demand_mattresses);
      return {
        id: row.id,
        name: row.community_name ?? 'Unnamed community',
        state: row.state,
        postcode: row.postcode,
        priority: row.priority ?? 'unknown',
        demandUnits,
        assetsDeployed: numberValue(row.assets_deployed),
        buyerCount: numberValue(row.buyer_entity_count),
        knownBuyerName: row.known_buyer_name,
        contractValue: numberValue(row.total_govt_contract_value) + numberValue(row.total_justice_funding),
        stagingHub: row.nearest_staging_hub,
        freightCorridor: row.freight_corridor,
      };
    })
    .sort((a, b) => b.demandUnits - a.demandUnits || b.buyerCount - a.buyerCount)
    .slice(0, 12);

  const topSignals = signals
    .map((row): GoodsTopSignal => ({
      id: row.id,
      title: row.title ?? row.signal_type ?? 'Goods procurement signal',
      signalType: row.signal_type ?? 'unknown',
      priority: row.priority ?? 'unknown',
      status: row.status ?? 'unknown',
      estimatedValue: row.estimated_value,
      estimatedUnits: row.estimated_units ?? 0,
      productsNeeded: row.products_needed ?? [],
      fundingConfidence: row.funding_confidence,
      syncedToGhl: Boolean(row.ghl_synced_at || row.ghl_contact_id),
      updatedAt: row.updated_at ?? row.created_at,
    }))
    .sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority) || (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    .slice(0, 12);

  const topBuyers = buyers
    .map((row): GoodsTopBuyer => ({
      id: row.id,
      name: row.entity_name ?? 'Unnamed buyer',
      role: row.buyer_role ?? 'unknown',
      relationshipStatus: row.relationship_status ?? 'unknown',
      fitScore: numberValue(row.fit_score),
      estimatedAnnualSpend: numberValue(row.estimated_annual_spend),
      govtContractValue: numberValue(row.govt_contract_value),
      nextAction: row.next_action,
    }))
    .sort((a, b) => b.fitScore - a.fitScore || b.govtContractValue - a.govtContractValue)
    .slice(0, 12);

  const assetFreshAge = ageDays(assetSummary.lastSyncedAt, now);
  const ghlFreshAge = ageDays(ghlMirror.lastSyncedAt, now);
  const communityFreshAge = ageDays(demand.lastProfiledAt, now);

  const checklist: GoodsReadinessChecklistItem[] = [
    {
      id: 'demand-proof',
      label: 'Demand proof',
      status: checklistStatus(demand.communityCount > 0 && demand.totalDemand.beds + demand.totalDemand.washers > 0, false),
      detail: `${demand.communityCount.toLocaleString()} communities with ${(
        demand.totalDemand.beds + demand.totalDemand.washers + demand.totalDemand.fridges
      ).toLocaleString()} bed/washer/fridge demand units indexed.`,
      nextAction: 'Pick the top 25 communities and mark which are evidence-backed, inferred, or no-go.',
    },
    {
      id: 'asset-proof',
      label: 'Asset lifecycle proof',
      status: checklistStatus(assetSummary.assetCount > 0 && (assetFreshAge === null || assetFreshAge <= 14), assetSummary.assetCount > 0),
      detail: `${assetSummary.assetCount.toLocaleString()} assets, ${assetSummary.overdueCount.toLocaleString()} overdue check-ins, ${assetSummary.replacementCount.toLocaleString()} replacements flagged.`,
      nextAction: 'Resolve overdue/replacement rows into support claims, repair tasks, or buyer renewal signals.',
    },
    {
      id: 'buyer-offer',
      label: 'Buyer offer',
      status: checklistStatus(buyers.length > 0 && productSummary.priceBookCoverage >= 75, buyers.length > 0 || productSummary.productCount > 0),
      detail: `${buyers.length.toLocaleString()} buyer entities and ${productSummary.priceBookCoverage}% price-book coverage across ${productSummary.productCount} products.`,
      nextAction: 'Freeze price book, MOQ, warranty/support, delivery, and reporting terms for the first buyer brief.',
    },
    {
      id: 'ghl-mirror',
      label: 'GHL pipeline mirror',
      status: checklistStatus(ghlMirror.goodsOpportunityCount > 0 && (ghlFreshAge === null || ghlFreshAge <= 7), ghlMirror.goodsOpportunityCount > 0),
      detail: `${ghlMirror.goodsOpportunityCount.toLocaleString()} Goods opportunities mirrored across ${ghlMirror.pipelineCount} pipelines.`,
      nextAction: 'Use GHL for human next touches only; do not auto-send or auto-change stages from the cockpit.',
    },
    {
      id: 'procurement-signals',
      label: 'Procurement signals',
      status: checklistStatus(procurement.signalCount > 0 && procurement.syncedToGhlCount > 0, procurement.signalCount > 0),
      detail: `${procurement.signalCount.toLocaleString()} signals, ${procurement.newCount.toLocaleString()} new, ${procurement.syncedToGhlCount.toLocaleString()} linked or synced to GHL.`,
      nextAction: 'Triage the top new signals into contact, brief, no-go, or ingestion-fix buckets.',
    },
    {
      id: 'source-freshness',
      label: 'Source freshness',
      status: checklistStatus(
        (assetFreshAge === null || assetFreshAge <= 14) && (ghlFreshAge === null || ghlFreshAge <= 7) && (communityFreshAge === null || communityFreshAge <= 45),
        assetSummary.assetCount > 0 || ghlMirror.goodsOpportunityCount > 0 || demand.communityCount > 0,
      ),
      detail: `Assets ${assetFreshAge ?? 'unknown'} days old, GHL ${ghlFreshAge ?? 'unknown'} days old, community profiles ${communityFreshAge ?? 'unknown'} days old.`,
      nextAction: 'Run lifecycle, GHL mirror, and community hydration jobs before sending any high-value Goods brief.',
    },
    {
      id: 'governance-vehicle',
      label: 'Governance vehicle',
      status: governance.promotionBlocked ? 'gap' : governance.partialCount > 0 ? 'partial' : 'ready',
      detail:
        governance.sourceMode === 'supabase'
          ? `${governance.itemCount} governance rows: ${governance.readyCount} ready, ${governance.partialCount} partial, ${governance.criticalGapCount} critical gaps.`
          : `${governance.itemCount} wiki fallback rows: ${governance.readyCount} ready, ${governance.partialCount} partial, ${governance.criticalGapCount} critical gaps. Supabase governance source is not live yet.`,
      nextAction: governance.nextCriticalAction,
    },
  ];

  return {
    generatedAt: now.toISOString(),
    sourceHealth: [
      sourceHealth(
        'goods_communities',
        'Goods communities and demand',
        rows.communities,
        demand.lastProfiledAt,
        'Community demand, buyer counts, staging hubs, freight corridors, and profile freshness.',
        now,
      ),
      sourceHealth(
        'goods_asset_lifecycle',
        'Goods asset lifecycle',
        rows.assets,
        assetSummary.lastSyncedAt,
        'Assets deployed, check-ins, replacement flags, support state, and lifecycle freshness.',
        now,
      ),
      sourceHealth(
        'goods_procurement_signals',
        'Goods procurement signals',
        rows.signals,
        procurement.lastUpdatedAt,
        'Unmet demand, end-of-life, grant links, GHL contact links, and action status.',
        now,
      ),
      sourceHealth(
        'goods_procurement_entities',
        'Goods buyer entities',
        rows.buyers,
        maxDate(buyers.map((row) => row.updated_at ?? row.last_contact_date)),
        'Buyer roles, relationship status, spend clues, fit score, and next action.',
        now,
      ),
      sourceHealth(
        'goods_products',
        'Goods products and price book',
        rows.products,
        productSummary.lastUpdatedAt,
        'Product state, cost, remote delivered cost, lifespan, warranty, and price-book coverage.',
        now,
      ),
      governanceSourceHealth(rows.governance, governance, now),
      sourceHealth(
        'ghl_opportunities',
        'GHL opportunity mirror',
        rows.ghlOpportunities,
        ghlMirror.lastSyncedAt,
        'Read-only CRM pipeline state. Used for visibility only, not automatic writeback.',
        now,
      ),
      sourceHealth(
        'ghl_pipelines',
        'GHL pipeline definitions',
        rows.ghlPipelines,
        maxDate(pipelines.map((row) => row.last_synced_at)),
        'Pipeline names and stages for relationship routing.',
        now,
      ),
    ],
    demand,
    assets: assetSummary,
    procurement,
    products: productSummary,
    ghlMirror,
    governance,
    topCommunities,
    topSignals,
    topBuyers,
    checklist,
    roadmapMoves: [
      'Freeze a Goods proof pack from live demand, assets, products, and buyer rows.',
      'Choose five buyer next touches from top signals and top buyers; queue them in GHL manually.',
      'Create a Goods buyer brief using price book, delivery terms, support model, and top community demand.',
      'Create a Goods capital stack row that separates buyer revenue, pre-purchase, grants, foundation support, and patient capital.',
      'Create a governance-readiness source before promoting high-value opportunities.',
    ],
    safety: {
      mode: 'read-only-snapshot',
      notes: [
        'This snapshot does not write to GHL, Notion, Supabase pipeline stages, or communications systems.',
        'GHL remains the relationship action system. The cockpit only mirrors visibility and prepares human-triggered next actions.',
        'Private CRM fields should stay out of the cockpit unless they are intentionally exposed in a read model.',
      ],
    },
  };
}

export async function getGoodsReadinessSnapshot(): Promise<GoodsReadinessSnapshot> {
  const db = getServiceSupabase().schema('public');
  const [
    communities,
    assets,
    signals,
    buyers,
    products,
    ghlOpportunities,
    ghlPipelines,
    governance,
  ] = await Promise.all([
    safePagedQuery<GoodsCommunityRow>((from, to) =>
      db
        .from('goods_communities')
        .select(
          'id, community_name, state, postcode, priority, demand_beds, demand_washers, demand_fridges, demand_mattresses, assets_deployed, assets_active, assets_overdue, known_buyer_name, buyer_entity_count, total_govt_contract_value, total_justice_funding, nearest_staging_hub, freight_corridor, data_quality_score, last_profiled_at, updated_at',
        )
        .range(from, to),
    ),
    safePagedQuery<GoodsAssetRow>((from, to) =>
      db
        .from('goods_asset_lifecycle')
        .select(
          'id, goods_asset_id, product_slug, product_type, community_name, current_status, deployed_at, last_checkin_at, is_overdue, needs_replacement, last_synced_at, updated_at',
        )
        .order('last_synced_at', { ascending: false, nullsFirst: false })
        .range(from, to),
    ),
    safePagedQuery<GoodsProcurementSignalRow>((from, to) =>
      db
        .from('goods_procurement_signals')
        .select(
          'id, signal_type, priority, title, description, estimated_value, estimated_units, products_needed, matched_grant_ids, matched_foundation_ids, funding_confidence, status, ghl_contact_id, ghl_synced_at, created_at, updated_at, community_id, buyer_entity_id',
        )
        .order('updated_at', { ascending: false, nullsFirst: false })
        .range(from, to),
    ),
    safePagedQuery<GoodsBuyerRow>((from, to) =>
      db
        .from('goods_procurement_entities')
        .select(
          'id, entity_name, buyer_role, relationship_status, estimated_annual_spend, govt_contract_value, fit_score, next_action, last_contact_date, product_fit, community_id, updated_at',
        )
        .order('fit_score', { ascending: false, nullsFirst: false })
        .range(from, to),
    ),
    safePagedQuery<GoodsProductRow>((from, to) =>
      db
        .from('goods_products')
        .select(
          'id, slug, name, status, material_cost_aud, manufacturing_cost_aud, wholesale_price_aud, typical_delivered_cost_remote, goods_delivered_cost_remote, expected_lifespan_months, warranty_months, updated_at',
        )
        .order('updated_at', { ascending: false, nullsFirst: false })
        .range(from, to),
      250,
    ),
    safePagedQuery<GhlOpportunityRow>((from, to) =>
      db
        .from('ghl_opportunities')
        .select(
          'id, ghl_id, ghl_pipeline_id, ghl_stage_id, name, pipeline_name, stage_name, status, monetary_value, project_code, ghl_updated_at, last_synced_at',
        )
        .order('last_synced_at', { ascending: false, nullsFirst: false })
        .range(from, to),
    ),
    safePagedQuery<GhlPipelineRow>((from, to) =>
      db
        .from('ghl_pipelines')
        .select('id, ghl_id, name, stages, last_synced_at')
        .order('last_synced_at', { ascending: false, nullsFirst: false })
        .range(from, to),
      250,
    ),
    safePagedQuery<GoodsGovernanceReadinessDbRow>((from, to) =>
      db
        .from('goods_governance_readiness')
        .select(
          'id, readiness_key, area, status, priority, decision, position, owner, next_action, blocker, evidence_refs, source_refs, opportunity_lanes, public_visibility, reviewed_at, due_at, updated_at',
        )
        .order('priority', { ascending: true })
        .range(from, to),
      250,
    ),
  ]);

  return buildGoodsReadinessSnapshotFromRows({
    communities,
    assets,
    signals,
    buyers,
    products,
    ghlOpportunities,
    ghlPipelines,
    governance,
  });
}
