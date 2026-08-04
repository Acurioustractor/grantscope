import { getServiceSupabase } from '@/lib/supabase';
import {
  GOODS_MODEL_AS_OF,
  GOODS_PLACE_PATHWAYS,
  type GoodsEvidenceClaim,
  type GoodsPlacePathway,
} from '@/lib/services/goods-living-investment-model';

export type GoodsLivingPlaceId = GoodsPlacePathway['id'];

export type GoodsLivingSourceKey =
  | 'canonical_model'
  | 'goods_communities'
  | 'goods_asset_lifecycle'
  | 'goods_deployment_batches'
  | 'goods_procurement_signals'
  | 'goods_procurement_entities'
  | 'goods_relationships'
  | 'ghl_opportunities'
  | 'xero_invoices'
  | 'contact_entity_links'
  | 'ghl_contacts'
  | 'relationship_health';

export type GoodsLivingSourceAvailability =
  | 'available'
  | 'empty'
  | 'unavailable'
  | 'canonical';

export type GoodsLivingFreshness =
  | 'fresh'
  | 'aging'
  | 'stale'
  | 'undated'
  | 'canonical';

export interface GoodsLivingSourceTrace {
  key: GoodsLivingSourceKey;
  label: string;
  availability: GoodsLivingSourceAvailability;
  freshness: GoodsLivingFreshness;
  recordCount: number;
  latestAt: string | null;
  ageDays: number | null;
  freshForDays: number | null;
  provenance: string;
  error: string | null;
}

export interface GoodsLivingCommunityRow {
  id: string;
  community_name: string | null;
  aliases: string[] | null;
  state: string | null;
  postcode: string | null;
  priority: string | null;
  signal_type: string | null;
  signal_source: string | null;
  demand_beds: number | string | null;
  demand_washers: number | string | null;
  assets_deployed: number | string | null;
  assets_active: number | string | null;
  assets_overdue: number | string | null;
  latest_checkin_date: string | null;
  known_buyer_name: string | null;
  proof_line: string | null;
  story: string | null;
  data_quality_score: number | string | null;
  last_profiled_at: string | null;
  data_sources: string[] | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface GoodsLivingAssetRow {
  id: string;
  goods_asset_id: string | null;
  community_id: string | null;
  product_slug: string | null;
  product_type: string | null;
  community_name: string | null;
  current_status: string | null;
  deployed_at: string | null;
  last_checkin_at: string | null;
  is_overdue: boolean | null;
  needs_replacement: boolean | null;
  funded_by_label: string | null;
  funded_via_invoice: string | null;
  last_synced_at: string | null;
  updated_at: string | null;
}

export interface GoodsLivingDeploymentRow {
  id: string;
  community_id: string | null;
  community_name: string | null;
  product_slug: string | null;
  product_type: string | null;
  unit_count: number | string | null;
  funded_by_label: string | null;
  funded_via_invoice: string | null;
  deployed_at: string | null;
  deployed_by: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface GoodsLivingProcurementSignalRow {
  id: string;
  community_id: string | null;
  buyer_entity_id: string | null;
  signal_type: string | null;
  priority: string | null;
  title: string | null;
  description: string | null;
  estimated_value: number | string | null;
  estimated_units: number | string | null;
  products_needed: string[] | null;
  funding_confidence: string | null;
  status: string | null;
  action_notes: string | null;
  actioned_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface GoodsLivingProcurementEntityRow {
  id: string;
  community_id: string | null;
  entity_id: string | null;
  entity_name: string | null;
  buyer_role: string | null;
  relationship_status: string | null;
  next_action: string | null;
  last_contact_date: string | null;
  estimated_annual_spend: number | string | null;
  product_fit: string[] | null;
  is_community_controlled: boolean | null;
  updated_at: string | null;
}

export interface GoodsLivingRelationshipRow {
  id: string;
  relationship_type: string;
  display_name: string;
  entity_id: string | null;
  ghl_contact_id: string | null;
  ghl_opportunity_id: string | null;
  stage: string;
  last_touch_at: string | null;
  next_action: string | null;
  next_action_due: string | null;
  ask_amount_aud: number | string | null;
  ask_purpose: string | null;
  updated_at: string | null;
}

export interface GoodsLivingGhlOpportunityRow {
  ghl_id: string;
  name: string | null;
  pipeline_name: string | null;
  stage_name: string | null;
  status: string | null;
  monetary_value: number | string | null;
  xero_invoice_id: string | null;
  ghl_updated_at: string | null;
  last_synced_at: string | null;
  updated_at: string | null;
}

export interface GoodsLivingXeroInvoiceRow {
  xero_id: string;
  invoice_number: string;
  type: string | null;
  status: string | null;
  contact_name: string | null;
  date: string | null;
  total: number | string | null;
  amount_paid: number | string | null;
  amount_due: number | string | null;
  reference: string | null;
  project_code: string | null;
  updated_at: string | null;
  synced_at: string | null;
}

export interface GoodsLivingContactEntityLinkRow {
  contact_id: string;
  entity_id: string;
  confidence_score: number | string | null;
  verified: boolean | null;
  updated_at: string | null;
}

export interface GoodsLivingGhlContactRow {
  id: string;
  ghl_id: string | null;
  full_name: string | null;
  company_name: string | null;
  last_contact_date: string | null;
  last_synced_at: string | null;
  updated_at: string | null;
}

export interface GoodsLivingRelationshipHealthRow {
  ghl_contact_id: string;
  total_touchpoints: number | string | null;
  last_contact_at: string | null;
  calculated_at: string | null;
  updated_at: string | null;
}

export interface GoodsLivingRowsBundle {
  communities: GoodsLivingSourceRows<GoodsLivingCommunityRow>;
  assets: GoodsLivingSourceRows<GoodsLivingAssetRow>;
  deployments: GoodsLivingSourceRows<GoodsLivingDeploymentRow>;
  procurementSignals: GoodsLivingSourceRows<GoodsLivingProcurementSignalRow>;
  procurementEntities: GoodsLivingSourceRows<GoodsLivingProcurementEntityRow>;
  relationships: GoodsLivingSourceRows<GoodsLivingRelationshipRow>;
  ghlOpportunities: GoodsLivingSourceRows<GoodsLivingGhlOpportunityRow>;
  xeroInvoices: GoodsLivingSourceRows<GoodsLivingXeroInvoiceRow>;
  contactEntityLinks: GoodsLivingSourceRows<GoodsLivingContactEntityLinkRow>;
  ghlContacts: GoodsLivingSourceRows<GoodsLivingGhlContactRow>;
  relationshipHealth: GoodsLivingSourceRows<GoodsLivingRelationshipHealthRow>;
}

export interface GoodsLivingSourceRows<T> {
  rows: T[];
  error: string | null;
}

export interface GoodsLivingRelationshipSignal {
  id: string;
  name: string;
  kind: string;
  state: string;
  lastTouchAt: string | null;
  nextAction: string | null;
  source:
    | 'goods_procurement_entities'
    | 'goods_relationships'
    | 'contact_entity_links';
}

export interface GoodsLivingOrderSignal {
  id: string;
  title: string;
  signalType: string;
  state: string;
  priority: string;
  estimatedUnits: number | null;
  estimatedValue: number | null;
  products: string[];
  observedAt: string | null;
  source: 'goods_procurement_signals';
}

export interface GoodsLivingEvidenceSignal {
  label: string;
  value: string;
  note: string;
  observedAt: string | null;
  source:
    | 'goods_communities'
    | 'goods_asset_lifecycle'
    | 'goods_deployment_batches';
}

export type GoodsDecisionQualityState =
  | 'clear'
  | 'partial'
  | 'review-required'
  | 'source-unavailable';

export interface GoodsDecisionConflict {
  id: string;
  label: string;
  note: string;
  source:
    | 'goods_asset_lifecycle'
    | 'goods_procurement_signals'
    | 'goods_procurement_entities'
    | 'ghl_opportunities'
    | 'xero_invoices';
  observedAt: string | null;
  quarantined: true;
}

export interface GoodsHistoricalTradeItem {
  invoiceNumber: string;
  label: string;
  note: string;
  status: 'PAID' | 'VOIDED';
  product: 'beds' | 'washer' | 'non-product' | 'mixed';
  units: number;
  amount: number;
  paidAmount: number;
  invoiceDate: string | null;
  sourceCheckedAt: string | null;
  source: 'xero_invoices';
}

export interface GoodsDecisionRead {
  authority: {
    status: 'unconfirmed';
    label: 'Community authority unconfirmed';
    note: string;
    artifactConnected: false;
    source: 'canonical_model';
    observedAt: null;
  };
  currentAuthorisedRequest: {
    status: 'absent';
    label: 'No current authorised request is evidenced';
    note: string;
    product: null;
    units: null;
    value: null;
    source: null;
    observedAt: null;
  };
  coordination: {
    status: 'connected' | 'unavailable' | 'not-recorded';
    label: string;
    stage: string | null;
    pipeline: string | null;
    opportunityStatus: string | null;
    note: string;
    source: 'ghl_opportunities';
    sourceId: string;
    sourceCheckedAt: string | null;
    evidenceTruth: 'internal-coordination-only';
  };
  historicalTrade: {
    label: 'Historical trade, separated by evidence state';
    paidProduct: GoodsHistoricalTradeItem[];
    paidNonProduct: GoodsHistoricalTradeItem[];
    voided: GoodsHistoricalTradeItem[];
    note: string;
    source: 'xero_invoices';
    sourceCheckedAt: string | null;
  };
  relationshipEvidence: {
    status: 'connected' | 'empty' | 'unavailable';
    label: string;
    linkedContactCount: number;
    totalTouchpoints: number;
    latestContactAt: string | null;
    people: Array<{
      id: string;
      name: string | null;
      organisation: string | null;
    }>;
    note: string;
    source: 'contact_entity_links + ghl_contacts + relationship_health';
    sourceCheckedAt: string | null;
  };
  humanReview: {
    connected: false;
    status: 'not-connected';
    label: 'Human review memory not connected';
    reviewedAt: null;
    reviewDueAt: null;
    note: string;
    source: null;
  };
  openAction: {
    label: 'Current open decision';
    action: string;
    owner: null;
    dueAt: null;
    note: string;
    source: 'canonical_model';
    observedAt: null;
  };
  qualityState: GoodsDecisionQualityState;
  conflicts: GoodsDecisionConflict[];
}

export interface GoodsLivingPlaceSnapshot {
  id: GoodsLivingPlaceId;
  name: string;
  country: string;
  mode: 'live-overlay' | 'canonical-fallback';
  canonical: GoodsPlacePathway;
  matchedCommunity: {
    id: string;
    name: string;
    matchedBy: 'explicit-id';
    lastProfiledAt: string | null;
  } | null;
  community: {
    priority: string | null;
    postcode: string | null;
    signalType: string | null;
    signalSource: string | null;
    proofLine: string | null;
    story: string | null;
    dataQualityScore: number | null;
  } | null;
  demand: {
    recordedBeds: number | null;
    recordedWashers: number | null;
    requestSignalCount: number;
    basis: 'recorded-context' | 'canonical-only' | 'source-unavailable';
    note: string;
  };
  assets: {
    lifecycleRecordCount: number | null;
    trustedLifecycleRecordCount: number | null;
    quarantinedRecordCount: number | null;
    denormalizedCommunityCount: number | null;
    activeCount: number | null;
    overdueCount: number | null;
    replacementCount: number | null;
    latestDeploymentAt: string | null;
    latestCheckinAt: string | null;
    byProduct: Array<{ product: string; count: number }>;
    basis: 'lifecycle-records' | 'community-summary' | 'canonical-only' | 'source-unavailable';
  };
  relationships: {
    signals: GoodsLivingRelationshipSignal[];
    note: string;
  };
  orders: {
    signals: GoodsLivingOrderSignal[];
    estimatedSignalUnits: number;
    estimatedSignalValue: number;
    proofState: 'signal-recorded' | 'no-signal' | 'source-unavailable';
    signedOrderEvidence: {
      connected: false;
      source: null;
      note: string;
    };
    note: string;
  };
  evidence: {
    canonicalClaims: GoodsEvidenceClaim[];
    liveSignals: GoodsLivingEvidenceSignal[];
  };
  decisionRead: GoodsDecisionRead;
  provenance: GoodsLivingSourceTrace[];
  fallbackReasons: string[];
  cautions: string[];
}

export interface GoodsLivingDataSnapshot {
  asOf: string;
  canonicalModelAsOf: string;
  mode: 'read-only';
  places: Record<GoodsLivingPlaceId, GoodsLivingPlaceSnapshot>;
  sourceHealth: GoodsLivingSourceTrace[];
  notes: string[];
}

export interface GoodsCanonicalImpactSummary {
  sourceUrl: 'https://www.goodsoncountry.com/api/impact-summary';
  mode: 'live' | 'static-fallback';
  sourceLabel: string;
  generatedAt: string | null;
  fallbackAsOf: string | null;
  beds: {
    deployed: number;
    stretch: number;
    basket: number;
  };
  washers: {
    inCommunity: number;
  };
  communitiesServed: number;
  plasticDivertedKg: number;
  livesImpactedModelled: number;
  notes: {
    plastic: string;
    washers: string;
    basis: string;
  };
  error: string | null;
}

export interface GoodsLivingModelSnapshot extends GoodsLivingDataSnapshot {
  impact: GoodsCanonicalImpactSummary;
}

export const GOODS_CANONICAL_IMPACT_URL =
  'https://www.goodsoncountry.com/api/impact-summary' as const;

export const GOODS_CANONICAL_IMPACT_FALLBACK = {
  beds: {
    deployed: 540,
    stretch: 177,
    basket: 363,
  },
  washers: {
    inCommunity: 22,
  },
  communitiesServed: 11,
  plasticDivertedKg: 3_540,
  livesImpactedModelled: 1_350,
} as const;

export interface GoodsPlaceCrosswalkEntry {
  communityId: string | null;
  entityIds: readonly string[];
  goodsRelationshipIds: readonly string[];
  ghlPathwayId: string;
  additionalGhlOpportunityIds: readonly string[];
  xeroInvoiceNumbers: readonly string[];
  unlinkedAssetIdentity: {
    communityId: null;
    communityName: string;
  } | null;
}

/**
 * Curated identity crosswalk for the four current place decisions.
 *
 * No caller may substitute name, alias, postcode, LGA or text similarity for
 * one of these identifiers. A null id means the source is not connected yet.
 */
export const GOODS_PLACE_CROSSWALK: Record<
  GoodsLivingPlaceId,
  GoodsPlaceCrosswalkEntry
> = {
  oonchiumpa: {
    communityId: null,
    entityIds: ['16cadc21-083d-4d5e-8b9f-7dc6dca33b38'],
    goodsRelationshipIds: [],
    ghlPathwayId: '1JmWFa6nNFc4RAv6mggx',
    additionalGhlOpportunityIds: [],
    xeroInvoiceNumbers: [],
    unlinkedAssetIdentity: null,
  },
  utopia: {
    communityId: null,
    entityIds: ['6e1c9849-b5d5-4c1b-b129-e75b0d518bd8'],
    goodsRelationshipIds: [],
    ghlPathwayId: 'T7Gb96DbTOQbhIeI1O87',
    additionalGhlOpportunityIds: [],
    xeroInvoiceNumbers: ['INV-0291'],
    unlinkedAssetIdentity: {
      communityId: null,
      communityName: 'Utopia Homelands',
    },
  },
  'tennant-creek': {
    communityId: '61184d6b-bfc7-4e30-8567-77809f8d0361',
    entityIds: ['d2d567dc-6ede-43cb-9a7a-cbbc97e39074'],
    goodsRelationshipIds: [],
    ghlPathwayId: 'rL9QFdJqVs0OfqBQW5Vn',
    additionalGhlOpportunityIds: [],
    xeroInvoiceNumbers: ['INV-0260', 'INV-0308', 'INV-0311', 'INV-0331'],
    unlinkedAssetIdentity: null,
  },
  'palm-island': {
    communityId: '61475b5b-3617-47c4-9fb7-3e8f8b4171df',
    entityIds: ['18fc2705-463c-4b27-8dbd-0ca79c640582'],
    goodsRelationshipIds: ['0dfec60d-eabc-4328-aeae-498ca6c7e03b'],
    ghlPathwayId: 'rrV0rZBqRkr3l5ifm5Rt',
    additionalGhlOpportunityIds: ['KoXLnuCmAxIp8Nrpeb0W'],
    xeroInvoiceNumbers: ['INV-0317', 'INV-0327'],
    unlinkedAssetIdentity: null,
  },
};

export const GOODS_LIVING_COMMUNITY_IDS = Object.values(GOODS_PLACE_CROSSWALK)
  .map((place) => place.communityId)
  .filter((id): id is string => id !== null);

export const GOODS_LIVING_ENTITY_IDS = Object.values(GOODS_PLACE_CROSSWALK)
  .flatMap((place) => [...place.entityIds]);

export const GOODS_LIVING_GHL_OPPORTUNITY_IDS = Object.values(
  GOODS_PLACE_CROSSWALK,
).flatMap((place) => [
  place.ghlPathwayId,
  ...place.additionalGhlOpportunityIds,
]);

export const GOODS_LIVING_XERO_INVOICE_NUMBERS = Object.values(
  GOODS_PLACE_CROSSWALK,
).flatMap((place) => [...place.xeroInvoiceNumbers]);

const GOODS_TRADE_RULES: Record<
  string,
  {
    placeId: GoodsLivingPlaceId;
    label: string;
    note: string;
    product: GoodsHistoricalTradeItem['product'];
    units: number;
    allocation: 'place' | 'mixed';
  }
> = {
  'INV-0260': {
    placeId: 'tennant-creek',
    label: '30 Basket Beds',
    note: 'Paid historical bed trade with Our Community Shed.',
    product: 'beds',
    units: 30,
    allocation: 'place',
  },
  'INV-0291': {
    placeId: 'utopia',
    label: '107 Weave Beds plus workshops',
    note: 'Paid historical Utopia bed trade and three workshop units.',
    product: 'beds',
    units: 107,
    allocation: 'place',
  },
  'INV-0308': {
    placeId: 'tennant-creek',
    label: '1 washing machine plus transport and install',
    note: 'Paid historical washing-machine trade with Our Community Shed.',
    product: 'washer',
    units: 1,
    allocation: 'place',
  },
  'INV-0311': {
    placeId: 'tennant-creek',
    label: '100 Weave Beds plus workshop',
    note: 'Voided invoice. It is not paid trade and cannot evidence current demand.',
    product: 'beds',
    units: 100,
    allocation: 'place',
  },
  'INV-0317': {
    placeId: 'palm-island',
    label: '20 Stretch Beds plus delivery',
    note: 'Voided invoice. It contradicts an open CRM opportunity still marked Invoiced.',
    product: 'beds',
    units: 20,
    allocation: 'place',
  },
  'INV-0327': {
    placeId: 'palm-island',
    label: 'Travel and video work',
    note: 'Paid travel and accommodation for video work. It is not a bed order.',
    product: 'non-product',
    units: 0,
    allocation: 'place',
  },
  'INV-0331': {
    placeId: 'tennant-creek',
    label: '130 beds across Tennant Creek and Mparntwe plus workshops',
    note: 'Voided mixed-place invoice. No portion is allocated as current Tennant Creek demand.',
    product: 'mixed',
    units: 130,
    allocation: 'mixed',
  },
};

const ORDER_SIGNAL_TYPES = new Set([
  'buyer_reorder',
  'community_request',
  'tender_match',
]);

const SOURCE_CONFIG: Record<
  Exclude<GoodsLivingSourceKey, 'canonical_model'>,
  { label: string; provenance: string; freshForDays: number }
> = {
  goods_communities: {
    label: 'Goods community profiles',
    provenance: 'GrantScope goods_communities. Demand is recorded context, not an order.',
    freshForDays: 90,
  },
  goods_asset_lifecycle: {
    label: 'Goods asset lifecycle mirror',
    provenance: 'GrantScope mirror of Goods Asset Register lifecycle records.',
    freshForDays: 30,
  },
  goods_deployment_batches: {
    label: 'Goods deployment batches',
    provenance: 'GrantScope delivery batches with unit, date and attribution evidence.',
    freshForDays: 90,
  },
  goods_procurement_signals: {
    label: 'Goods procurement signals',
    provenance: 'GrantScope operational signals. A signal is not a signed or authorised order.',
    freshForDays: 30,
  },
  goods_procurement_entities: {
    label: 'Goods place-linked organisations',
    provenance: 'GrantScope organisations mapped to a Goods community profile.',
    freshForDays: 60,
  },
  goods_relationships: {
    label: 'Goods relationship registry',
    provenance: 'GrantScope Goods relationship rows selected only by curated relationship id.',
    freshForDays: 60,
  },
  ghl_opportunities: {
    label: 'GHL coordination pathways',
    provenance: 'Internal CRM coordination stage selected only by curated GHL opportunity id. It is not authority, consent or an order.',
    freshForDays: 14,
  },
  xero_invoices: {
    label: 'Xero invoice evidence',
    provenance: 'Exact invoice-number evidence. Paid and voided history are kept separate from current authorised demand.',
    freshForDays: 30,
  },
  contact_entity_links: {
    label: 'Contact to entity crosswalk',
    provenance: 'High-confidence contact links selected only through the curated place entity ids.',
    freshForDays: 90,
  },
  ghl_contacts: {
    label: 'GHL contact episodes',
    provenance: 'Internal contact episodes for linked entity contacts. No email or phone is exposed.',
    freshForDays: 30,
  },
  relationship_health: {
    label: 'Relationship interaction roll-up',
    provenance: 'Touchpoint and latest-contact aggregates only. They are coordination evidence, not relationship quality, authority or consent.',
    freshForDays: 30,
  },
};

function numberValue(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function communityMatchByCrosswalk(
  placeId: GoodsLivingPlaceId,
  rows: GoodsLivingCommunityRow[],
): GoodsLivingCommunityRow | null {
  const communityId = GOODS_PLACE_CROSSWALK[placeId].communityId;
  if (!communityId) return null;
  return rows.find((row) => row.id === communityId) ?? null;
}

function maxDate(values: Array<string | null | undefined>): string | null {
  let latest: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (!value) continue;
    const time = new Date(value).getTime();
    if (!Number.isFinite(time) || time <= latestTime) continue;
    latest = value;
    latestTime = time;
  }
  return latest;
}

function dateAgeDays(value: string | null, now: Date): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((now.getTime() - time) / 86_400_000));
}

function sourceTrace(
  key: Exclude<GoodsLivingSourceKey, 'canonical_model'>,
  outcome: GoodsLivingSourceRows<unknown>,
  latestAt: string | null,
  now: Date,
): GoodsLivingSourceTrace {
  const config = SOURCE_CONFIG[key];
  const ageDays = dateAgeDays(latestAt, now);
  const availability: GoodsLivingSourceAvailability = outcome.error
    ? 'unavailable'
    : outcome.rows.length > 0
      ? 'available'
      : 'empty';
  const freshness: GoodsLivingFreshness = latestAt === null
    ? 'undated'
    : ageDays !== null && ageDays <= config.freshForDays
      ? 'fresh'
      : ageDays !== null && ageDays <= config.freshForDays * 2
        ? 'aging'
        : 'stale';

  return {
    key,
    label: config.label,
    availability,
    freshness,
    recordCount: outcome.rows.length,
    latestAt,
    ageDays,
    freshForDays: config.freshForDays,
    provenance: config.provenance,
    error: outcome.error,
  };
}

function canonicalTrace(recordCount: number): GoodsLivingSourceTrace {
  return {
    key: 'canonical_model',
    label: 'Goods canonical place model',
    availability: 'canonical',
    freshness: 'canonical',
    recordCount,
    latestAt: null,
    ageDays: null,
    freshForDays: null,
    provenance: `Goods canonical rulings and place pathways as at ${GOODS_MODEL_AS_OF}.`,
    error: null,
  };
}

function sourceOutcomeForPlace<T>(
  source: GoodsLivingSourceRows<T>,
  rows: T[],
): GoodsLivingSourceRows<T> {
  return { rows, error: source.error };
}

function byProduct(rows: GoodsLivingAssetRow[]): Array<{ product: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const product = row.product_type || row.product_slug || 'Unspecified product';
    counts.set(product, (counts.get(product) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([product, count]) => ({ product, count }))
    .sort((left, right) => right.count - left.count || left.product.localeCompare(right.product));
}

function relationshipSignalsForPlace(
  placeId: GoodsLivingPlaceId,
  communityId: string | null,
  entities: GoodsLivingProcurementEntityRow[],
  relationships: GoodsLivingRelationshipRow[],
  contactLinks: GoodsLivingContactEntityLinkRow[],
  contacts: GoodsLivingGhlContactRow[],
  healthRows: GoodsLivingRelationshipHealthRow[],
): GoodsLivingRelationshipSignal[] {
  const crosswalk = GOODS_PLACE_CROSSWALK[placeId];
  const allowedEntityIds = new Set(crosswalk.entityIds);
  const allowedRelationshipIds = new Set(crosswalk.goodsRelationshipIds);
  const mapped = entities
    .filter((entity) =>
      placeId !== 'palm-island'
      && communityId !== null
      && entity.community_id === communityId
      && entity.entity_id !== null
      && allowedEntityIds.has(entity.entity_id),
    )
    .map((entity): GoodsLivingRelationshipSignal => ({
      id: `procurement:${entity.id}`,
      name: entity.entity_name || 'Unnamed place organisation',
      kind: entity.buyer_role || 'place organisation',
      state: entity.relationship_status || 'unrecorded',
      lastTouchAt: entity.last_contact_date,
      nextAction: entity.next_action,
      source: 'goods_procurement_entities',
    }));
  const registry = relationships
    .filter((relationship) => allowedRelationshipIds.has(relationship.id))
    .map((relationship): GoodsLivingRelationshipSignal => ({
      id: `relationship:${relationship.id}`,
      name: relationship.display_name,
      kind: relationship.relationship_type,
      state: relationship.stage,
      lastTouchAt: relationship.last_touch_at,
      nextAction: relationship.next_action,
      source: 'goods_relationships',
    }));
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  const healthByGhlId = new Map(
    healthRows.map((health) => [health.ghl_contact_id, health]),
  );
  const linked = contactLinks
    .filter((link) => allowedEntityIds.has(link.entity_id))
    .flatMap((link): GoodsLivingRelationshipSignal[] => {
      const contact = contactById.get(link.contact_id);
      if (!contact) return [];
      const health = contact.ghl_id
        ? healthByGhlId.get(contact.ghl_id)
        : null;
      return [{
        id: `contact:${contact.id}`,
        name: contact.full_name || contact.company_name || 'Named internal contact',
        kind: contact.company_name || 'entity-linked contact',
        state: 'coordination episode',
        lastTouchAt: health?.last_contact_at ?? contact.last_contact_date,
        nextAction: null,
        source: 'contact_entity_links',
      }];
    });

  return [...mapped, ...registry, ...linked].sort(
    (left, right) =>
      String(right.lastTouchAt ?? '').localeCompare(String(left.lastTouchAt ?? ''))
      || left.name.localeCompare(right.name),
  );
}

function evidenceSignalsForPlace(
  community: GoodsLivingCommunityRow | null,
  assets: GoodsLivingAssetRow[],
  deployments: GoodsLivingDeploymentRow[],
): GoodsLivingEvidenceSignal[] {
  const evidence: GoodsLivingEvidenceSignal[] = [];
  if (community?.proof_line) {
    evidence.push({
      label: 'Community profile',
      value: community.proof_line,
      note: 'Recorded place profile. Community authority and consent are not inferred from this row.',
      observedAt: community.last_profiled_at ?? community.updated_at,
      source: 'goods_communities',
    });
  }
  if (assets.length > 0) {
    evidence.push({
      label: 'Asset records',
      value: `${assets.length.toLocaleString('en-AU')} lifecycle records`,
      note: 'Current count in the GrantScope mirror for the matched community record.',
      observedAt: maxDate(assets.map((row) => row.last_synced_at ?? row.updated_at)),
      source: 'goods_asset_lifecycle',
    });
  }
  if (deployments.length > 0) {
    evidence.push({
      label: 'Recorded deployment batches',
      value: `${deployments.reduce((sum, row) => sum + numberValue(row.unit_count), 0).toLocaleString('en-AU')} units`,
      note: `${deployments.length.toLocaleString('en-AU')} historical batches. Delivery does not create a new order or a current mandate.`,
      observedAt: maxDate(deployments.map((row) => row.updated_at ?? row.deployed_at)),
      source: 'goods_deployment_batches',
    });
  }
  return evidence;
}

function assetsForPlace(
  placeId: GoodsLivingPlaceId,
  rows: GoodsLivingAssetRow[],
): GoodsLivingAssetRow[] {
  const crosswalk = GOODS_PLACE_CROSSWALK[placeId];
  if (crosswalk.communityId) {
    return rows.filter((row) => row.community_id === crosswalk.communityId);
  }
  if (crosswalk.unlinkedAssetIdentity) {
    return rows.filter(
      (row) =>
        row.community_id === crosswalk.unlinkedAssetIdentity?.communityId
        && row.community_name === crosswalk.unlinkedAssetIdentity.communityName,
    );
  }
  return [];
}

function tradeItemsForPlace(
  placeId: GoodsLivingPlaceId,
  invoices: GoodsLivingXeroInvoiceRow[],
): GoodsHistoricalTradeItem[] {
  return invoices.flatMap((invoice): GoodsHistoricalTradeItem[] => {
    const rule = GOODS_TRADE_RULES[invoice.invoice_number];
    if (!rule || rule.placeId !== placeId) return [];
    const status = String(invoice.status ?? '').toUpperCase();
    if (status !== 'PAID' && status !== 'VOIDED') return [];
    return [{
      invoiceNumber: invoice.invoice_number,
      label: rule.label,
      note: rule.note,
      status,
      product: rule.product,
      units: rule.units,
      amount: numberValue(invoice.total),
      paidAmount: numberValue(invoice.amount_paid),
      invoiceDate: invoice.date,
      sourceCheckedAt: invoice.synced_at ?? invoice.updated_at,
      source: 'xero_invoices',
    }];
  });
}

function relationshipEvidenceForPlace(
  placeId: GoodsLivingPlaceId,
  rows: GoodsLivingRowsBundle,
): GoodsDecisionRead['relationshipEvidence'] {
  const entityIds = new Set(GOODS_PLACE_CROSSWALK[placeId].entityIds);
  const links = rows.contactEntityLinks.rows.filter((link) =>
    entityIds.has(link.entity_id),
  );
  const contactById = new Map(
    rows.ghlContacts.rows.map((contact) => [contact.id, contact]),
  );
  const linkedContacts = links.flatMap((link) => {
    const contact = contactById.get(link.contact_id);
    return contact ? [contact] : [];
  });
  const healthByGhlId = new Map(
    rows.relationshipHealth.rows.map((health) => [
      health.ghl_contact_id,
      health,
    ]),
  );
  const healthRows = linkedContacts.flatMap((contact) => {
    if (!contact.ghl_id) return [];
    const health = healthByGhlId.get(contact.ghl_id);
    return health ? [health] : [];
  });
  const unavailable = Boolean(
    rows.contactEntityLinks.error
    || rows.ghlContacts.error
    || rows.relationshipHealth.error,
  );
  const sourceCheckedAt = maxDate([
    ...links.map((link) => link.updated_at),
    ...linkedContacts.map(
      (contact) => contact.last_synced_at ?? contact.updated_at,
    ),
    ...healthRows.map(
      (health) => health.calculated_at ?? health.updated_at,
    ),
  ]);

  return {
    status: unavailable
      ? 'unavailable'
      : linkedContacts.length > 0
        ? 'connected'
        : 'empty',
    label: linkedContacts.length > 0
      ? `${linkedContacts.length.toLocaleString('en-AU')} entity-linked contact episodes`
      : 'No entity-linked contact episodes found',
    linkedContactCount: linkedContacts.length,
    totalTouchpoints: healthRows.reduce(
      (sum, health) => sum + numberValue(health.total_touchpoints),
      0,
    ),
    latestContactAt: maxDate([
      ...linkedContacts.map((contact) => contact.last_contact_date),
      ...healthRows.map((health) => health.last_contact_at),
    ]),
    people: linkedContacts.map((contact) => ({
      id: contact.id,
      name: contact.full_name,
      organisation: contact.company_name,
    })),
    note: unavailable
      ? 'One or more relationship episode sources were unavailable. No authority, consent or relationship quality is inferred.'
      : 'These are aggregate internal coordination episodes linked through the curated entity id. Counts and dates do not prove authority, consent or relationship quality.',
    source: 'contact_entity_links + ghl_contacts + relationship_health',
    sourceCheckedAt,
  };
}

function decisionConflictsForPlace(
  placeId: GoodsLivingPlaceId,
  assets: GoodsLivingAssetRow[],
  signals: GoodsLivingProcurementSignalRow[],
  entities: GoodsLivingProcurementEntityRow[],
  opportunities: GoodsLivingGhlOpportunityRow[],
  invoices: GoodsLivingXeroInvoiceRow[],
): GoodsDecisionConflict[] {
  const conflicts: GoodsDecisionConflict[] = [];
  const latestAssetAt = maxDate(
    assets.map((row) => row.last_synced_at ?? row.updated_at),
  );
  const everyAssetOverdue =
    assets.length > 0 && assets.every((asset) => asset.is_overdue === true);

  if (everyAssetOverdue) {
    conflicts.push({
      id: `${placeId}:all-assets-overdue`,
      label: `${assets.length.toLocaleString('en-AU')} lifecycle rows are all flagged overdue`,
      note: 'The all-overdue pattern is quarantined as a sync/data-quality conflict. It is not replacement demand or a current order.',
      source: 'goods_asset_lifecycle',
      observedAt: latestAssetAt,
      quarantined: true,
    });
  }
  const pre2010Assets = assets.filter((asset) => {
    if (!asset.deployed_at) return false;
    const deployedAt = new Date(asset.deployed_at).getTime();
    return Number.isFinite(deployedAt)
      && deployedAt < Date.UTC(2010, 0, 1);
  });
  if (pre2010Assets.length > 0) {
    conflicts.push({
      id: `${placeId}:pre-2010-deployment-dates`,
      label: `${pre2010Assets.length.toLocaleString('en-AU')} lifecycle rows have pre-2010 deployment dates`,
      note: 'These dates predate the current Goods product history and are quarantined as import/date-quality conflicts. They cannot evidence delivery timing, asset age, replacement need or an order.',
      source: 'goods_asset_lifecycle',
      observedAt: latestAssetAt,
      quarantined: true,
    });
  }
  if (placeId === 'utopia' && assets.some((asset) => asset.community_id === null)) {
    conflicts.push({
      id: 'utopia:unlinked-assets',
      label: `${assets.filter((asset) => asset.community_id === null).length.toLocaleString('en-AU')} Utopia lifecycle rows are not linked to a community id`,
      note: 'The exact Utopia Homelands label is known, but the rows are not identity-linked. They remain quarantined and cannot evidence an order.',
      source: 'goods_asset_lifecycle',
      observedAt: latestAssetAt,
      quarantined: true,
    });
  }
  if (placeId === 'utopia') {
    const paidInvoice = invoices.find(
      (invoice) =>
        invoice.invoice_number === 'INV-0291'
        && String(invoice.status ?? '').toUpperCase() === 'PAID',
    );
    const unlinkedAssetCount = assets.filter(
      (asset) => asset.community_id === null,
    ).length;
    if (paidInvoice && unlinkedAssetCount > 0) {
      conflicts.push({
        id: 'utopia:count-definition-conflict',
        label: `147 canonical Stretch Beds vs 107 paid Weave Beds vs ${unlinkedAssetCount.toLocaleString('en-AU')} unlinked mirror rows`,
        note: 'These are three different sources and definitions: the canonical place model says 147 Stretch Beds in community; PAID INV-0291 evidences 107 Weave Beds plus workshops; the lifecycle mirror contains 68 rows without a community id. Do not reconcile them by arithmetic or turn any difference into current demand.',
        source: 'goods_asset_lifecycle',
        observedAt: maxDate([
          latestAssetAt,
          paidInvoice.synced_at ?? paidInvoice.updated_at,
        ]),
        quarantined: true,
      });
    }
  }

  const replacementSignals = signals.filter(
    (signal) => signal.signal_type === 'asset_end_of_life',
  );
  if (replacementSignals.length > 0) {
    conflicts.push({
      id: `${placeId}:replacement-signals`,
      label: `${replacementSignals.length.toLocaleString('en-AU')} generated replacement signals quarantined`,
      note: 'The generated asset-end-of-life signals inherit the conflicted overdue state. They are not authorised replacement requests.',
      source: 'goods_procurement_signals',
      observedAt: maxDate(
        replacementSignals.map((signal) => signal.updated_at ?? signal.created_at),
      ),
      quarantined: true,
    });
  }

  if (placeId === 'palm-island' && entities.length > 0) {
    conflicts.push({
      id: 'palm-island:mapped-organisations',
      label: `${entities.length.toLocaleString('en-AU')} algorithmically mapped organisations suppressed`,
      note: 'The mapped organisations resolve to the wrong postcode/LGA geography. None are exposed as a Palm Island relationship path.',
      source: 'goods_procurement_entities',
      observedAt: maxDate(entities.map((entity) => entity.updated_at)),
      quarantined: true,
    });
  }
  if (placeId === 'palm-island' && signals.length > 0) {
    conflicts.push({
      id: 'palm-island:algorithmic-signals',
      label: `${signals.length.toLocaleString('en-AU')} Palm Island algorithmic signals suppressed`,
      note: 'Signals generated from the conflicted place overlay are quarantined. They are not need, authority, consent or an order.',
      source: 'goods_procurement_signals',
      observedAt: maxDate(
        signals.map((signal) => signal.updated_at ?? signal.created_at),
      ),
      quarantined: true,
    });
  }

  if (placeId === 'palm-island') {
    const buyerOpportunity = opportunities.find(
      (opportunity) => opportunity.ghl_id === 'KoXLnuCmAxIp8Nrpeb0W',
    );
    const invoice = invoices.find(
      (candidate) => candidate.invoice_number === 'INV-0317',
    );
    if (
      buyerOpportunity?.stage_name === 'Invoiced'
      && buyerOpportunity.status === 'open'
      && String(invoice?.status ?? '').toUpperCase() === 'VOIDED'
    ) {
      conflicts.push({
        id: 'palm-island:crm-xero-contradiction',
        label: 'CRM says Invoiced/open while linked Xero invoice is VOIDED',
        note: 'The Palm buyer opportunity cannot evidence an order until CRM is reconciled with INV-0317, which is voided with $0 paid.',
        source: 'ghl_opportunities',
        observedAt: maxDate([
          buyerOpportunity.last_synced_at
            ?? buyerOpportunity.ghl_updated_at
            ?? buyerOpportunity.updated_at,
          invoice?.synced_at ?? invoice?.updated_at,
        ]),
        quarantined: true,
      });
    }
  }

  return conflicts;
}

function buildDecisionRead(
  pathway: GoodsPlacePathway,
  rows: GoodsLivingRowsBundle,
  assets: GoodsLivingAssetRow[],
  signals: GoodsLivingProcurementSignalRow[],
  entities: GoodsLivingProcurementEntityRow[],
): GoodsDecisionRead {
  const crosswalk = GOODS_PLACE_CROSSWALK[pathway.id];
  const pathwayOpportunity = rows.ghlOpportunities.rows.find(
    (opportunity) => opportunity.ghl_id === crosswalk.ghlPathwayId,
  );
  const placeOpportunities = rows.ghlOpportunities.rows.filter(
    (opportunity) =>
      opportunity.ghl_id === crosswalk.ghlPathwayId
      || crosswalk.additionalGhlOpportunityIds.includes(opportunity.ghl_id),
  );
  const placeInvoices = rows.xeroInvoices.rows.filter((invoice) =>
    crosswalk.xeroInvoiceNumbers.includes(invoice.invoice_number),
  );
  const tradeItems = tradeItemsForPlace(pathway.id, placeInvoices);
  const conflicts = decisionConflictsForPlace(
    pathway.id,
    assets,
    signals,
    entities,
    placeOpportunities,
    placeInvoices,
  );
  const relationshipEvidence = relationshipEvidenceForPlace(pathway.id, rows);
  const hasUnavailableDecisionSource = Boolean(
    rows.ghlOpportunities.error
    || rows.xeroInvoices.error
    || rows.contactEntityLinks.error
    || rows.ghlContacts.error
    || rows.relationshipHealth.error,
  );
  const qualityState: GoodsDecisionQualityState = hasUnavailableDecisionSource
    ? 'source-unavailable'
    : conflicts.length > 0
      ? 'review-required'
      : 'partial';

  return {
    authority: {
      status: 'unconfirmed',
      label: 'Community authority unconfirmed',
      note: 'No current authority or consent artifact is connected. Entity links, contact episodes, CRM stages and past trade do not substitute for it.',
      artifactConnected: false,
      source: 'canonical_model',
      observedAt: null,
    },
    currentAuthorisedRequest: {
      status: 'absent',
      label: 'No current authorised request is evidenced',
      note: 'No signed community decision, contract or purchase order is connected for the current action. Recorded need and CRM coordination remain separate.',
      product: null,
      units: null,
      value: null,
      source: null,
      observedAt: null,
    },
    coordination: {
      status: rows.ghlOpportunities.error
        ? 'unavailable'
        : pathwayOpportunity
          ? 'connected'
          : 'not-recorded',
      label: pathwayOpportunity?.stage_name
        ? `Internal coordination: ${pathwayOpportunity.stage_name}`
        : rows.ghlOpportunities.error
          ? 'Internal coordination source unavailable'
          : 'No internal coordination stage recorded',
      stage: pathwayOpportunity?.stage_name ?? null,
      pipeline: pathwayOpportunity?.pipeline_name ?? null,
      opportunityStatus: pathwayOpportunity?.status ?? null,
      note: 'This is an internal GHL workflow stage selected by exact opportunity id. It is not community authority, consent, demand or a signed order.',
      source: 'ghl_opportunities',
      sourceId: crosswalk.ghlPathwayId,
      sourceCheckedAt: pathwayOpportunity
        ? pathwayOpportunity.last_synced_at
          ?? pathwayOpportunity.ghl_updated_at
          ?? pathwayOpportunity.updated_at
        : null,
      evidenceTruth: 'internal-coordination-only',
    },
    historicalTrade: {
      label: 'Historical trade, separated by evidence state',
      paidProduct: tradeItems.filter(
        (item) => item.status === 'PAID' && item.product !== 'non-product',
      ),
      paidNonProduct: tradeItems.filter(
        (item) => item.status === 'PAID' && item.product === 'non-product',
      ),
      voided: tradeItems.filter((item) => item.status === 'VOIDED'),
      note: rows.xeroInvoices.error
        ? 'Invoice evidence source unavailable. No historical trade state is inferred.'
        : 'Paid product history, paid non-product work and voided invoices are separated. None are treated as a current authorised request.',
      source: 'xero_invoices',
      sourceCheckedAt: maxDate(
        placeInvoices.map((invoice) => invoice.synced_at ?? invoice.updated_at),
      ),
    },
    relationshipEvidence,
    humanReview: {
      connected: false,
      status: 'not-connected',
      label: 'Human review memory not connected',
      reviewedAt: null,
      reviewDueAt: null,
      note: 'No review-memory table or artifact is available. Automated evidence must not be presented as human-approved.',
      source: null,
    },
    openAction: {
      label: 'Current open decision',
      action: pathway.nextDecision,
      owner: null,
      dueAt: null,
      note: 'Carried from the canonical Goods place decision. No owner or due date is fabricated from stale CRM tasks.',
      source: 'canonical_model',
      observedAt: null,
    },
    qualityState,
    conflicts,
  };
}

function buildPlaceSnapshot(
  pathway: GoodsPlacePathway,
  rows: GoodsLivingRowsBundle,
  now: Date,
): GoodsLivingPlaceSnapshot {
  const crosswalk = GOODS_PLACE_CROSSWALK[pathway.id];
  const community = communityMatchByCrosswalk(
    pathway.id,
    rows.communities.rows,
  );
  const communityId = crosswalk.communityId;
  const assets = assetsForPlace(pathway.id, rows.assets.rows);
  const deployments = rows.deployments.rows.filter((row) =>
    communityId ? row.community_id === communityId : false,
  );
  const signals = rows.procurementSignals.rows.filter((row) =>
    communityId ? row.community_id === communityId : false,
  );
  const entities = rows.procurementEntities.rows.filter((row) =>
    communityId ? row.community_id === communityId : false,
  );
  const relationshipSignals = relationshipSignalsForPlace(
    pathway.id,
    communityId,
    rows.procurementEntities.rows,
    rows.relationships.rows,
    rows.contactEntityLinks.rows,
    rows.ghlContacts.rows,
    rows.relationshipHealth.rows,
  );
  const orderSignals: GoodsLivingOrderSignal[] = signals
    .filter(
      (signal) =>
        pathway.id !== 'palm-island'
        && ORDER_SIGNAL_TYPES.has(signal.signal_type ?? '')
        && signal.signal_type !== 'asset_end_of_life',
    )
    .map((signal): GoodsLivingOrderSignal => ({
      id: signal.id,
      title: signal.title || signal.signal_type || 'Procurement signal',
      signalType: signal.signal_type || 'unrecorded',
      state: signal.status || 'unrecorded',
      priority: signal.priority || 'unrecorded',
      estimatedUnits: nullableNumber(signal.estimated_units),
      estimatedValue: nullableNumber(signal.estimated_value),
      products: signal.products_needed ?? [],
      observedAt: signal.updated_at ?? signal.created_at,
      source: 'goods_procurement_signals',
    }))
    .sort((left, right) =>
      String(right.observedAt ?? '').localeCompare(String(left.observedAt ?? '')),
    );

  const communityOutcome = sourceOutcomeForPlace(
    rows.communities,
    community ? [community] : [],
  );
  const assetOutcome = sourceOutcomeForPlace(rows.assets, assets);
  const deploymentOutcome = sourceOutcomeForPlace(rows.deployments, deployments);
  const signalOutcome = sourceOutcomeForPlace(rows.procurementSignals, signals);
  const entityOutcome = sourceOutcomeForPlace(rows.procurementEntities, entities);
  const placeRelationships = rows.relationships.rows.filter((relationship) =>
    relationshipSignals.some(
      (signal) => signal.id === `relationship:${relationship.id}`,
    ),
  );
  const relationshipOutcome = sourceOutcomeForPlace(rows.relationships, placeRelationships);
  const placeOpportunities = rows.ghlOpportunities.rows.filter(
    (opportunity) =>
      opportunity.ghl_id === crosswalk.ghlPathwayId
      || crosswalk.additionalGhlOpportunityIds.includes(opportunity.ghl_id),
  );
  const opportunityOutcome = sourceOutcomeForPlace(
    rows.ghlOpportunities,
    placeOpportunities,
  );
  const placeInvoices = rows.xeroInvoices.rows.filter((invoice) =>
    crosswalk.xeroInvoiceNumbers.includes(invoice.invoice_number),
  );
  const invoiceOutcome = sourceOutcomeForPlace(rows.xeroInvoices, placeInvoices);
  const entityIdSet = new Set(crosswalk.entityIds);
  const placeContactLinks = rows.contactEntityLinks.rows.filter((link) =>
    entityIdSet.has(link.entity_id),
  );
  const contactLinkOutcome = sourceOutcomeForPlace(
    rows.contactEntityLinks,
    placeContactLinks,
  );
  const contactIdSet = new Set(
    placeContactLinks.map((link) => link.contact_id),
  );
  const placeContacts = rows.ghlContacts.rows.filter((contact) =>
    contactIdSet.has(contact.id),
  );
  const contactOutcome = sourceOutcomeForPlace(rows.ghlContacts, placeContacts);
  const ghlContactIdSet = new Set(
    placeContacts
      .map((contact) => contact.ghl_id)
      .filter((id): id is string => id !== null),
  );
  const placeHealthRows = rows.relationshipHealth.rows.filter((health) =>
    ghlContactIdSet.has(health.ghl_contact_id),
  );
  const healthOutcome = sourceOutcomeForPlace(
    rows.relationshipHealth,
    placeHealthRows,
  );
  const provenance = [
    canonicalTrace(pathway.proof.length),
    sourceTrace(
      'goods_communities',
      communityOutcome,
      maxDate(
        communityOutcome.rows.map((row) => row.last_profiled_at ?? row.updated_at),
      ),
      now,
    ),
    sourceTrace(
      'goods_asset_lifecycle',
      assetOutcome,
      maxDate(assetOutcome.rows.map((row) => row.last_synced_at ?? row.updated_at)),
      now,
    ),
    sourceTrace(
      'goods_deployment_batches',
      deploymentOutcome,
      maxDate(deploymentOutcome.rows.map((row) => row.updated_at ?? row.deployed_at)),
      now,
    ),
    sourceTrace(
      'goods_procurement_signals',
      signalOutcome,
      maxDate(signalOutcome.rows.map((row) => row.updated_at ?? row.created_at)),
      now,
    ),
    sourceTrace(
      'goods_procurement_entities',
      entityOutcome,
      maxDate(entityOutcome.rows.map((row) => row.last_contact_date ?? row.updated_at)),
      now,
    ),
    sourceTrace(
      'goods_relationships',
      relationshipOutcome,
      maxDate(
        relationshipOutcome.rows.map(
          (row) => row.updated_at ?? row.last_touch_at,
        ),
      ),
      now,
    ),
    sourceTrace(
      'ghl_opportunities',
      opportunityOutcome,
      maxDate(
        opportunityOutcome.rows.map(
          (row) => row.last_synced_at ?? row.ghl_updated_at ?? row.updated_at,
        ),
      ),
      now,
    ),
    sourceTrace(
      'xero_invoices',
      invoiceOutcome,
      maxDate(
        invoiceOutcome.rows.map((row) => row.synced_at ?? row.updated_at),
      ),
      now,
    ),
    sourceTrace(
      'contact_entity_links',
      contactLinkOutcome,
      maxDate(contactLinkOutcome.rows.map((row) => row.updated_at)),
      now,
    ),
    sourceTrace(
      'ghl_contacts',
      contactOutcome,
      maxDate(
        contactOutcome.rows.map(
          (row) => row.last_synced_at ?? row.updated_at,
        ),
      ),
      now,
    ),
    sourceTrace(
      'relationship_health',
      healthOutcome,
      maxDate(
        healthOutcome.rows.map(
          (row) => row.calculated_at ?? row.updated_at,
        ),
      ),
      now,
    ),
  ];

  const fallbackReasons: string[] = [];
  if (!community) fallbackReasons.push('No matching Goods community profile was available.');
  for (const trace of provenance) {
    if (trace.availability === 'unavailable') {
      fallbackReasons.push(`${trace.label} was unavailable: ${trace.error}`);
    }
  }
  if (rows.assets.error === null && community && assets.length === 0) {
    fallbackReasons.push('No place-linked lifecycle rows were returned, so canonical proof remains visible.');
  }

  const assetBasis: GoodsLivingPlaceSnapshot['assets']['basis'] = rows.assets.error
    ? 'source-unavailable'
    : assets.length > 0
      ? 'lifecycle-records'
      : community
        ? 'community-summary'
        : 'canonical-only';
  const demandBasis: GoodsLivingPlaceSnapshot['demand']['basis'] = rows.communities.error
    ? 'source-unavailable'
    : community
      ? 'recorded-context'
      : 'canonical-only';
  const orderProofState: GoodsLivingPlaceSnapshot['orders']['proofState'] =
    rows.procurementSignals.error
      ? 'source-unavailable'
      : orderSignals.length > 0
        ? 'signal-recorded'
        : 'no-signal';
  const assetMirrorConflicted =
    assets.length > 0
    && (
      assets.every((asset) => asset.is_overdue === true)
      || (
        pathway.id === 'utopia'
        && assets.some((asset) => asset.community_id === null)
      )
    );
  const trustedAssets = assetMirrorConflicted ? [] : assets;
  const decisionRead = buildDecisionRead(
    pathway,
    rows,
    assets,
    signals,
    entities,
  );

  const cautions = [
    pathway.caution,
    'Recorded demand is context. It is not a purchase order.',
    'Relationship and delivery records do not prove current community authority or consent.',
  ];
  if (orderSignals.length > 0) {
    cautions.push('A won or actioned procurement signal still needs contract, purchase order or other authorisation evidence.');
  }
  if (provenance.some((trace) => trace.freshness === 'stale')) {
    cautions.push('At least one live source is stale against its operational freshness window.');
  }
  if (decisionRead.conflicts.length > 0) {
    cautions.push('Conflicted generated records are quarantined and cannot become need, replacement demand, authority or an order.');
  }

  return {
    id: pathway.id,
    name: pathway.name,
    country: pathway.country,
    mode:
      community
      || relationshipSignals.length > 0
      || decisionRead.coordination.status === 'connected'
      ? 'live-overlay'
      : 'canonical-fallback',
    canonical: pathway,
    matchedCommunity: community
      ? {
          id: community.id,
          name: community.community_name || pathway.name,
          matchedBy: 'explicit-id',
          lastProfiledAt: community.last_profiled_at ?? community.updated_at,
        }
      : null,
    community: community
      ? {
          priority: community.priority,
          postcode: community.postcode,
          signalType: community.signal_type,
          signalSource: community.signal_source,
          proofLine: community.proof_line,
          story: community.story,
          dataQualityScore: nullableNumber(community.data_quality_score),
        }
      : null,
    demand: {
      recordedBeds: community ? nullableNumber(community.demand_beds) : null,
      recordedWashers: community ? nullableNumber(community.demand_washers) : null,
      requestSignalCount: signals.filter(
        (signal) => signal.signal_type === 'community_request',
      ).length,
      basis: demandBasis,
      note: community
        ? 'The goods_communities beds and washers fields are population-modelled signals. They are not recorded need, a community request, a buyer commitment or an order.'
        : 'No live community row was matched. The canonical place pathway remains the fallback.',
    },
    assets: {
      lifecycleRecordCount: rows.assets.error ? null : assets.length,
      trustedLifecycleRecordCount: rows.assets.error
        ? null
        : trustedAssets.length,
      quarantinedRecordCount: rows.assets.error
        ? null
        : assets.length - trustedAssets.length,
      denormalizedCommunityCount: community
        ? nullableNumber(community.assets_deployed)
        : null,
      activeCount: rows.assets.error
        ? null
        : assets.length > 0
          ? assets.filter((row) => row.current_status === 'active').length
          : community
            ? nullableNumber(community.assets_active)
            : null,
      overdueCount: rows.assets.error
        ? null
        : assets.length > 0
          ? assets.filter((row) => row.is_overdue).length
          : community
            ? nullableNumber(community.assets_overdue)
            : null,
      replacementCount: rows.assets.error
        ? null
        : assets.filter((row) => row.needs_replacement).length,
      latestDeploymentAt: maxDate([
        ...assets.map((row) => row.deployed_at),
        ...deployments.map((row) => row.deployed_at),
      ]),
      latestCheckinAt: maxDate([
        community?.latest_checkin_date,
        ...assets.map((row) => row.last_checkin_at),
      ]),
      byProduct: byProduct(trustedAssets),
      basis: assetBasis,
    },
    relationships: {
      signals: relationshipSignals,
      note: relationshipSignals.length > 0
        ? 'These are recorded relationship paths. They identify possible people and organisations to review with, not automatic authority.'
        : 'No place-linked relationship row was found. Use the canonical relationship account and verify the current people before acting.',
    },
    orders: {
      signals: orderSignals,
      estimatedSignalUnits: orderSignals.reduce(
        (sum, signal) => sum + (signal.estimatedUnits ?? 0),
        0,
      ),
      estimatedSignalValue: orderSignals.reduce(
        (sum, signal) => sum + (signal.estimatedValue ?? 0),
        0,
      ),
      proofState: orderProofState,
      signedOrderEvidence: {
        connected: false,
        source: null,
        note: 'No signed contract or purchase-order evidence source is connected to this adapter.',
      },
      note: orderSignals.length > 0
        ? 'These are procurement signals only. The adapter does not convert estimated units, demand or CRM stage into authorised demand.'
        : 'No current order signal was returned. Zero signals does not mean zero need, and it does not prove an order.',
    },
    evidence: {
      canonicalClaims: pathway.proof,
      liveSignals: evidenceSignalsForPlace(
        community,
        trustedAssets,
        deployments,
      ),
    },
    decisionRead,
    provenance,
    fallbackReasons,
    cautions,
  };
}

function sourceHealthForBundle(
  rows: GoodsLivingRowsBundle,
  now: Date,
): GoodsLivingSourceTrace[] {
  return [
    canonicalTrace(GOODS_PLACE_PATHWAYS.reduce((sum, pathway) => sum + pathway.proof.length, 0)),
    sourceTrace(
      'goods_communities',
      rows.communities,
      maxDate(rows.communities.rows.map((row) => row.last_profiled_at ?? row.updated_at)),
      now,
    ),
    sourceTrace(
      'goods_asset_lifecycle',
      rows.assets,
      maxDate(rows.assets.rows.map((row) => row.last_synced_at ?? row.updated_at)),
      now,
    ),
    sourceTrace(
      'goods_deployment_batches',
      rows.deployments,
      maxDate(rows.deployments.rows.map((row) => row.updated_at ?? row.deployed_at)),
      now,
    ),
    sourceTrace(
      'goods_procurement_signals',
      rows.procurementSignals,
      maxDate(rows.procurementSignals.rows.map((row) => row.updated_at ?? row.created_at)),
      now,
    ),
    sourceTrace(
      'goods_procurement_entities',
      rows.procurementEntities,
      maxDate(rows.procurementEntities.rows.map((row) => row.last_contact_date ?? row.updated_at)),
      now,
    ),
    sourceTrace(
      'goods_relationships',
      rows.relationships,
      maxDate(
        rows.relationships.rows.map(
          (row) => row.updated_at ?? row.last_touch_at,
        ),
      ),
      now,
    ),
    sourceTrace(
      'ghl_opportunities',
      rows.ghlOpportunities,
      maxDate(
        rows.ghlOpportunities.rows.map(
          (row) => row.last_synced_at ?? row.ghl_updated_at ?? row.updated_at,
        ),
      ),
      now,
    ),
    sourceTrace(
      'xero_invoices',
      rows.xeroInvoices,
      maxDate(
        rows.xeroInvoices.rows.map((row) => row.synced_at ?? row.updated_at),
      ),
      now,
    ),
    sourceTrace(
      'contact_entity_links',
      rows.contactEntityLinks,
      maxDate(rows.contactEntityLinks.rows.map((row) => row.updated_at)),
      now,
    ),
    sourceTrace(
      'ghl_contacts',
      rows.ghlContacts,
      maxDate(
        rows.ghlContacts.rows.map(
          (row) => row.last_synced_at ?? row.updated_at,
        ),
      ),
      now,
    ),
    sourceTrace(
      'relationship_health',
      rows.relationshipHealth,
      maxDate(
        rows.relationshipHealth.rows.map(
          (row) => row.calculated_at ?? row.updated_at,
        ),
      ),
      now,
    ),
  ];
}

export function buildGoodsLivingDataSnapshot(
  rows: GoodsLivingRowsBundle,
  now = new Date(),
): GoodsLivingDataSnapshot {
  const placeRows = GOODS_PLACE_PATHWAYS.map((pathway) =>
    buildPlaceSnapshot(pathway, rows, now),
  );
  return {
    asOf: now.toISOString(),
    canonicalModelAsOf: GOODS_MODEL_AS_OF,
    mode: 'read-only',
    places: Object.fromEntries(
      placeRows.map((place) => [place.id, place]),
    ) as Record<GoodsLivingPlaceId, GoodsLivingPlaceSnapshot>,
    sourceHealth: sourceHealthForBundle(rows, now),
    notes: [
      'This adapter only reads. It does not update Supabase, GHL, orders, evidence or community records.',
      'The canonical place model remains visible when a live source is empty, stale or unavailable.',
      'Demand, procurement signals and historical delivery are kept separate from signed or authorised orders.',
      'Place identity uses a curated id crosswalk. Names, aliases, postcodes and fuzzy text are never used to join decision evidence.',
      'Source freshness is reported separately from evidence truth and human review state.',
    ],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonNegativeNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return value;
}

export function parseGoodsCanonicalImpactSummary(
  payload: unknown,
): GoodsCanonicalImpactSummary | null {
  if (!isRecord(payload) || !isRecord(payload.beds) || !isRecord(payload.washers)) {
    return null;
  }
  const deployed = nonNegativeNumber(payload.beds.deployed);
  const stretch = nonNegativeNumber(payload.beds.stretch);
  const basket = nonNegativeNumber(payload.beds.basket);
  const inCommunity = nonNegativeNumber(payload.washers.inCommunity);
  const communitiesServed = nonNegativeNumber(payload.communitiesServed);
  const plasticDivertedKg = nonNegativeNumber(payload.plasticDivertedKg);
  const livesImpactedModelled = nonNegativeNumber(payload.livesImpactedModelled);
  if (
    deployed === null
    || stretch === null
    || basket === null
    || inCommunity === null
    || communitiesServed === null
    || plasticDivertedKg === null
    || livesImpactedModelled === null
  ) {
    return null;
  }

  const notes = isRecord(payload.notes) ? payload.notes : {};
  return {
    sourceUrl: GOODS_CANONICAL_IMPACT_URL,
    mode: 'live',
    sourceLabel:
      typeof payload.source === 'string'
        ? payload.source
        : 'Goods on Country canonical impact summary',
    generatedAt:
      typeof payload.generatedAt === 'string' ? payload.generatedAt : null,
    fallbackAsOf: null,
    beds: { deployed, stretch, basket },
    washers: { inCommunity },
    communitiesServed,
    plasticDivertedKg,
    livesImpactedModelled,
    notes: {
      plastic:
        typeof notes.plastic === 'string'
          ? notes.plastic
          : 'Stretch beds only. Basket beds are not counted as plastic diversion.',
      washers:
        typeof notes.washers === 'string'
          ? notes.washers
          : 'Washing machines recorded as in community.',
      basis:
        typeof notes.basis === 'string'
          ? notes.basis
          : "status='deployed', summed by quantity; excludes pipeline and requested placeholders.",
    },
    error: null,
  };
}

export function goodsCanonicalImpactFallback(
  error: string | null,
): GoodsCanonicalImpactSummary {
  return {
    sourceUrl: GOODS_CANONICAL_IMPACT_URL,
    mode: 'static-fallback',
    sourceLabel: `Goods canonical asset ruling as at ${GOODS_MODEL_AS_OF}`,
    generatedAt: null,
    fallbackAsOf: GOODS_MODEL_AS_OF,
    beds: { ...GOODS_CANONICAL_IMPACT_FALLBACK.beds },
    washers: { ...GOODS_CANONICAL_IMPACT_FALLBACK.washers },
    communitiesServed: GOODS_CANONICAL_IMPACT_FALLBACK.communitiesServed,
    plasticDivertedKg: GOODS_CANONICAL_IMPACT_FALLBACK.plasticDivertedKg,
    livesImpactedModelled: GOODS_CANONICAL_IMPACT_FALLBACK.livesImpactedModelled,
    notes: {
      plastic: 'Stretch Beds only. Basket Beds are not a plastic-diversion product.',
      washers:
        '22 washing machines in community is the 21 July 2026 manual ruling. It supersedes stale raw register rows.',
      basis:
        "Deployed beds are summed by quantity; pipeline and requested placeholders are excluded.",
    },
    error,
  };
}

type GoodsImpactFetch = (
  input: string,
  init?: RequestInit & { next?: { revalidate?: number } },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export async function getGoodsCanonicalImpactSummary(
  fetchImpl: GoodsImpactFetch = fetch,
): Promise<GoodsCanonicalImpactSummary> {
  try {
    const response = await fetchImpl(GOODS_CANONICAL_IMPACT_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      return goodsCanonicalImpactFallback(
        `Canonical impact API returned HTTP ${response.status}.`,
      );
    }
    const parsed = parseGoodsCanonicalImpactSummary(await response.json());
    return parsed
      ?? goodsCanonicalImpactFallback(
        'Canonical impact API returned an invalid response shape.',
      );
  } catch (error) {
    return goodsCanonicalImpactFallback(
      error instanceof Error
        ? error.message
        : 'Canonical impact API read failed.',
    );
  }
}

type ReadResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

async function safeRead<T>(
  query: PromiseLike<ReadResult<T>>,
): Promise<GoodsLivingSourceRows<T>> {
  try {
    const result = await query;
    return {
      rows: result.data ?? [],
      error: result.error?.message ?? null,
    };
  } catch (error) {
    return {
      rows: [],
      error: error instanceof Error ? error.message : 'Live source read failed.',
    };
  }
}

function unavailableRows<T>(reason: string): GoodsLivingSourceRows<T> {
  return { rows: [], error: reason };
}

function emptyRows<T>(): GoodsLivingSourceRows<T> {
  return { rows: [], error: null };
}

export async function getGoodsLivingDataSnapshot(
  now = new Date(),
): Promise<GoodsLivingDataSnapshot> {
  const db = getServiceSupabase().schema('public');
  const [
    communities,
    linkedAssets,
    unlinkedUtopiaAssets,
    deployments,
    procurementSignals,
    procurementEntities,
    relationships,
    ghlOpportunities,
    xeroInvoices,
    contactEntityLinks,
  ] = await Promise.all([
    safeRead<GoodsLivingCommunityRow>(
      db
        .from('goods_communities')
        .select(
          'id, community_name, aliases, state, postcode, priority, signal_type, signal_source, demand_beds, demand_washers, assets_deployed, assets_active, assets_overdue, latest_checkin_date, known_buyer_name, proof_line, story, data_quality_score, last_profiled_at, data_sources, created_at, updated_at',
        )
        .in('id', GOODS_LIVING_COMMUNITY_IDS),
    ),
    safeRead<GoodsLivingAssetRow>(
      db
        .from('goods_asset_lifecycle')
        .select(
          'id, goods_asset_id, community_id, product_slug, product_type, community_name, current_status, deployed_at, last_checkin_at, is_overdue, needs_replacement, funded_by_label, funded_via_invoice, last_synced_at, updated_at',
        )
        .in('community_id', GOODS_LIVING_COMMUNITY_IDS),
    ),
    safeRead<GoodsLivingAssetRow>(
      db
        .from('goods_asset_lifecycle')
        .select(
          'id, goods_asset_id, community_id, product_slug, product_type, community_name, current_status, deployed_at, last_checkin_at, is_overdue, needs_replacement, funded_by_label, funded_via_invoice, last_synced_at, updated_at',
        )
        .is('community_id', null)
        .eq('community_name', 'Utopia Homelands'),
    ),
    safeRead<GoodsLivingDeploymentRow>(
      db
        .from('goods_deployment_batches')
        .select(
          'id, community_id, community_name, product_slug, product_type, unit_count, funded_by_label, funded_via_invoice, deployed_at, deployed_by, notes, created_at, updated_at',
        )
        .in('community_id', GOODS_LIVING_COMMUNITY_IDS),
    ),
    safeRead<GoodsLivingProcurementSignalRow>(
      db
        .from('goods_procurement_signals')
        .select(
          'id, community_id, buyer_entity_id, signal_type, priority, title, description, estimated_value, estimated_units, products_needed, funding_confidence, status, action_notes, actioned_at, created_at, updated_at',
        )
        .in('community_id', GOODS_LIVING_COMMUNITY_IDS),
    ),
    safeRead<GoodsLivingProcurementEntityRow>(
      db
        .from('goods_procurement_entities')
        .select(
          'id, community_id, entity_id, entity_name, buyer_role, relationship_status, next_action, last_contact_date, estimated_annual_spend, product_fit, is_community_controlled, updated_at',
        )
        .in('community_id', GOODS_LIVING_COMMUNITY_IDS),
    ),
    safeRead<GoodsLivingRelationshipRow>(
      db
        .from('goods_relationships')
        .select(
          'id, relationship_type, display_name, entity_id, ghl_contact_id, ghl_opportunity_id, stage, last_touch_at, next_action, next_action_due, ask_amount_aud, ask_purpose, updated_at',
        )
        .in(
          'id',
          Object.values(GOODS_PLACE_CROSSWALK).flatMap((place) => [
            ...place.goodsRelationshipIds,
          ]),
        ),
    ),
    safeRead<GoodsLivingGhlOpportunityRow>(
      db
        .from('ghl_opportunities')
        .select(
          'ghl_id, name, pipeline_name, stage_name, status, monetary_value, xero_invoice_id, ghl_updated_at, last_synced_at, updated_at',
        )
        .in('ghl_id', GOODS_LIVING_GHL_OPPORTUNITY_IDS),
    ),
    safeRead<GoodsLivingXeroInvoiceRow>(
      db
        .from('xero_invoices')
        .select(
          'xero_id, invoice_number, type, status, contact_name, date, total, amount_paid, amount_due, reference, project_code, updated_at, synced_at',
        )
        .in('invoice_number', GOODS_LIVING_XERO_INVOICE_NUMBERS),
    ),
    safeRead<GoodsLivingContactEntityLinkRow>(
      db
        .from('contact_entity_links')
        .select(
          'contact_id, entity_id, confidence_score, verified, updated_at',
        )
        .in('entity_id', GOODS_LIVING_ENTITY_IDS)
        .gte('confidence_score', 0.8),
    ),
  ]);
  const assets: GoodsLivingSourceRows<GoodsLivingAssetRow> = {
    rows: [...linkedAssets.rows, ...unlinkedUtopiaAssets.rows],
    error: [linkedAssets.error, unlinkedUtopiaAssets.error]
      .filter((error): error is string => error !== null)
      .join(' | ') || null,
  };

  let ghlContacts: GoodsLivingSourceRows<GoodsLivingGhlContactRow>;
  if (contactEntityLinks.error) {
    ghlContacts = unavailableRows(
      `Skipped because contact entity links were unavailable: ${contactEntityLinks.error}`,
    );
  } else {
    const contactIds = [
      ...new Set(contactEntityLinks.rows.map((link) => link.contact_id)),
    ];
    ghlContacts = contactIds.length > 0
      ? await safeRead<GoodsLivingGhlContactRow>(
          db
            .from('ghl_contacts')
            .select(
              'id, ghl_id, full_name, company_name, last_contact_date, last_synced_at, updated_at',
            )
            .in('id', contactIds),
        )
      : emptyRows();
  }

  let relationshipHealth: GoodsLivingSourceRows<GoodsLivingRelationshipHealthRow>;
  if (ghlContacts.error) {
    relationshipHealth = unavailableRows(
      `Skipped because linked GHL contacts were unavailable: ${ghlContacts.error}`,
    );
  } else {
    const ghlContactIds = [
      ...new Set(
        ghlContacts.rows
          .map((contact) => contact.ghl_id)
          .filter((id): id is string => id !== null),
      ),
    ];
    relationshipHealth = ghlContactIds.length > 0
      ? await safeRead<GoodsLivingRelationshipHealthRow>(
          db
            .from('relationship_health')
            .select(
              'ghl_contact_id, total_touchpoints, last_contact_at, calculated_at, updated_at',
            )
            .in('ghl_contact_id', ghlContactIds),
        )
      : emptyRows();
  }

  return buildGoodsLivingDataSnapshot(
    {
      communities,
      assets,
      deployments,
      procurementSignals,
      procurementEntities,
      relationships,
      ghlOpportunities,
      xeroInvoices,
      contactEntityLinks,
      ghlContacts,
      relationshipHealth,
    },
    now,
  );
}

/**
 * One serializable, read-only model snapshot for the Goods story and model UI.
 * Place rows are keyed by the four canonical pathway ids so callers never have
 * to infer identity from a community name.
 */
export async function getGoodsLivingModelSnapshot(
  now = new Date(),
): Promise<GoodsLivingModelSnapshot> {
  const [data, impact] = await Promise.all([
    getGoodsLivingDataSnapshot(now),
    getGoodsCanonicalImpactSummary(),
  ]);
  return { ...data, impact };
}
