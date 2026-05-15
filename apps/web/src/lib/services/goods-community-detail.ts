import { getServiceSupabase } from '@/lib/supabase';

export type CommunityDetail = {
  id: string;
  community_name: string;
  state: string | null;
  postcode: string | null;
  region_label: string | null;
  priority: string | null;
  demand_beds: number;
  demand_washers: number;
  assets_deployed: number;
  land_council: string | null;
  local_government: string | null;
  main_language: string | null;
  nearest_staging_hub: string | null;
  freight_corridor: string | null;
  last_mile_method: string | null;
  total_govt_contract_value: number | null;
  total_justice_funding: number | null;
  total_foundation_grants: number | null;
  proof_line: string | null;
  story: string | null;
};

export type MappedBuyer = {
  id: string;
  entity_name: string;
  buyer_role: string | null;
  procurement_method: string | null;
  relationship_status: string | null;
  contact_surface: string | null;
  estimated_annual_spend: number | null;
  govt_contract_value: number | null;
  is_community_controlled: boolean | null;
  website: string | null;
  entity_id: string | null;
  abn: string | null;
  postcode: string | null;
  ghl_contact_id: string | null;
  ghl_opportunity_id: string | null;
  ghl_stage_name: string | null;
  ghl_last_pushed_at: string | null;
  ghl_last_synced_at: string | null;
};

export type LocalEntity = {
  id: string;
  gs_id: string | null;
  canonical_name: string;
  entity_type: string | null;
  sector: string | null;
  abn: string | null;
  is_community_controlled: boolean | null;
  postcode: string | null;
};

export type SignalSummary = {
  id: string;
  signal_type: string;
  status: string;
  priority: string;
  title: string;
  funding_confidence: string | null;
  matched_grant_ids: string[];
  matched_foundation_ids: string[];
  estimated_value: number | null;
  created_at: string;
  actioned_at: string | null;
};

export type MatchedGrant = {
  id: string;
  name: string;
  provider: string | null;
  amount_max: number | null;
  geography: string | null;
  closes_at: string | null;
  goods_relevance_score: number | null;
  url: string | null;
};

export type MatchedFoundation = {
  id: string;
  name: string;
  total_giving_annual: number | null;
  geographic_focus: string[] | null;
  thematic_focus: string[] | null;
};

export type DeployedAssetSummary = {
  total: number;
  by_product: Record<string, number>;
  by_funder: Record<string, number>;
  total_funded_aud: number;
  recent: Array<{
    id: string;
    goods_asset_id: string | null;
    asset_name: string | null;
    product_type: string | null;
    funded_by_label: string | null;
    funded_amount_aud: number | null;
    deployed_at: string | null;
    current_status: string | null;
    household: string | null;
  }>;
};

export type DeploymentBatch = {
  id: string;
  product_slug: string;
  product_type: string | null;
  unit_count: number;
  funded_by_label: string | null;
  funded_amount_aud: number | null;
  funded_via_invoice: string | null;
  deployed_at: string;
  deployed_by: string | null;
  notes: string | null;
};

export type TimelineEvent = {
  at: string;
  kind: 'deployment' | 'signal_action' | 'ghl_push' | 'grant_tracked';
  summary: string;
  detail?: string;
  href?: string;
};

export type GoodsCommunityDetail = {
  community: CommunityDetail;
  mappedBuyers: MappedBuyer[];
  localEntities: LocalEntity[];
  signals: SignalSummary[];
  matchedGrants: MatchedGrant[];
  matchedFoundations: MatchedFoundation[];
  assets: DeployedAssetSummary;
  deploymentBatches: DeploymentBatch[];
  timeline: TimelineEvent[];
};

export async function getGoodsCommunityDetail(communityId: string): Promise<GoodsCommunityDetail | null> {
  const db = getServiceSupabase();

  const { data: community, error } = await db
    .from('goods_communities')
    .select('id, community_name, state, postcode, region_label, priority, demand_beds, demand_washers, assets_deployed, land_council, local_government, main_language, nearest_staging_hub, freight_corridor, last_mile_method, total_govt_contract_value, total_justice_funding, total_foundation_grants, proof_line, story')
    .eq('id', communityId)
    .maybeSingle();
  if (error || !community) return null;

  // Mapped procurement entities at this community
  const { data: mappedBuyersRaw } = await db
    .from('goods_procurement_entities')
    .select('id, entity_id, entity_name, buyer_role, procurement_method, relationship_status, contact_surface, estimated_annual_spend, govt_contract_value, is_community_controlled, website, ghl_contact_id, ghl_opportunity_id, ghl_stage_name, ghl_last_pushed_at, ghl_last_synced_at')
    .eq('community_id', communityId)
    .order('govt_contract_value', { ascending: false, nullsFirst: false });

  // Hydrate buyer ABN/postcode from gs_entities
  const entityIds = (mappedBuyersRaw || []).map(b => b.entity_id).filter(Boolean) as string[];
  let entityById = new Map<string, { abn: string | null; postcode: string | null }>();
  if (entityIds.length > 0) {
    const { data: ents } = await db
      .from('gs_entities')
      .select('id, abn, postcode')
      .in('id', entityIds);
    entityById = new Map((ents || []).map(e => [e.id as string, { abn: e.abn as string | null, postcode: e.postcode as string | null }]));
  }
  const mappedBuyers: MappedBuyer[] = (mappedBuyersRaw || []).map(b => ({
    id: b.id as string,
    entity_id: (b.entity_id as string | null) ?? null,
    entity_name: b.entity_name as string,
    buyer_role: b.buyer_role as string | null,
    procurement_method: b.procurement_method as string | null,
    relationship_status: b.relationship_status as string | null,
    contact_surface: b.contact_surface as string | null,
    estimated_annual_spend: b.estimated_annual_spend as number | null,
    govt_contract_value: b.govt_contract_value as number | null,
    is_community_controlled: b.is_community_controlled as boolean | null,
    website: b.website as string | null,
    abn: b.entity_id ? entityById.get(b.entity_id as string)?.abn || null : null,
    postcode: b.entity_id ? entityById.get(b.entity_id as string)?.postcode || null : null,
    ghl_contact_id: (b.ghl_contact_id as string | null) ?? null,
    ghl_opportunity_id: (b.ghl_opportunity_id as string | null) ?? null,
    ghl_stage_name: (b.ghl_stage_name as string | null) ?? null,
    ghl_last_pushed_at: (b.ghl_last_pushed_at as string | null) ?? null,
    ghl_last_synced_at: (b.ghl_last_synced_at as string | null) ?? null,
  }));

  // Other entities in the postcode (potential buyers we haven't mapped yet)
  let localEntities: LocalEntity[] = [];
  if (community.postcode) {
    const mappedEntityIds = new Set(mappedBuyers.map(b => b.entity_id).filter(Boolean));
    const { data: locals } = await db
      .from('gs_entities')
      .select('id, gs_id, canonical_name, entity_type, sector, abn, is_community_controlled, postcode')
      .eq('postcode', community.postcode)
      .in('entity_type', ['indigenous_corp', 'council', 'charity', 'health_service', 'land_council', 'housing_provider', 'store', 'community_org', 'education'])
      .limit(50);
    localEntities = ((locals || []) as any[])
      .filter(e => !mappedEntityIds.has(e.id))
      .sort((a, b) => Number(b.is_community_controlled ?? 0) - Number(a.is_community_controlled ?? 0));
  }

  // Signals at this community (active + historical)
  const { data: signalsRaw } = await db
    .from('goods_procurement_signals')
    .select('id, signal_type, status, priority, title, funding_confidence, matched_grant_ids, matched_foundation_ids, estimated_value, created_at, actioned_at')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false });
  const signals = ((signalsRaw || []) as any[]) as SignalSummary[];

  const grantIds = [...new Set(signals.flatMap(s => s.matched_grant_ids || []))];
  const foundationIds = [...new Set(signals.flatMap(s => s.matched_foundation_ids || []))];

  let matchedGrants: MatchedGrant[] = [];
  if (grantIds.length > 0) {
    const { data: gr } = await db
      .from('grant_opportunities')
      .select('id, name, provider, amount_max, geography, closes_at, goods_relevance_score, url')
      .in('id', grantIds);
    matchedGrants = (gr || []) as MatchedGrant[];
  }
  let matchedFoundations: MatchedFoundation[] = [];
  if (foundationIds.length > 0) {
    const { data: fnd } = await db
      .from('foundations')
      .select('id, name, total_giving_annual, geographic_focus, thematic_focus')
      .in('id', foundationIds);
    matchedFoundations = (fnd || []) as MatchedFoundation[];
  }

  // Deployed assets at this community
  const { data: assetsRaw } = await db
    .from('goods_asset_lifecycle')
    .select('id, goods_asset_id, asset_name, product_type, product_slug, funded_by_label, funded_amount_aud, deployed_at, current_status, household')
    .eq('community_id', communityId)
    .order('deployed_at', { ascending: false, nullsFirst: false })
    .limit(500);
  const assetRows = (assetsRaw || []) as any[];
  const assetSummary: DeployedAssetSummary = {
    total: assetRows.length,
    by_product: {},
    by_funder: {},
    total_funded_aud: 0,
    recent: assetRows.slice(0, 20).map(a => ({
      id: a.id,
      goods_asset_id: a.goods_asset_id,
      asset_name: a.asset_name,
      product_type: a.product_type,
      funded_by_label: a.funded_by_label,
      funded_amount_aud: a.funded_amount_aud,
      deployed_at: a.deployed_at,
      current_status: a.current_status,
      household: a.household,
    })),
  };
  for (const a of assetRows) {
    const p = a.product_type || a.product_slug || 'unknown';
    assetSummary.by_product[p] = (assetSummary.by_product[p] || 0) + 1;
    const f = a.funded_by_label || 'Unattributed';
    assetSummary.by_funder[f] = (assetSummary.by_funder[f] || 0) + 1;
    if (a.funded_amount_aud) assetSummary.total_funded_aud += Number(a.funded_amount_aud);
  }

  // Deployment batches at this community
  const { data: batchesRaw } = await db
    .from('goods_deployment_batches')
    .select('id, product_slug, product_type, unit_count, funded_by_label, funded_amount_aud, funded_via_invoice, deployed_at, deployed_by, notes')
    .eq('community_id', communityId)
    .order('deployed_at', { ascending: false })
    .limit(50);
  const deploymentBatches = (batchesRaw || []) as DeploymentBatch[];

  // Communications timeline — merge deployments, signal actions, GHL pushes, tracked grants
  const timeline: TimelineEvent[] = [];

  for (const b of deploymentBatches) {
    timeline.push({
      at: b.deployed_at,
      kind: 'deployment',
      summary: `Deployed ${b.unit_count} × ${b.product_type || b.product_slug}`,
      detail: [
        b.funded_by_label ? `funded by ${b.funded_by_label}` : null,
        b.funded_amount_aud ? `$${Number(b.funded_amount_aud).toLocaleString()}` : null,
        b.funded_via_invoice ? `inv ${b.funded_via_invoice}` : null,
        b.deployed_by ? `by ${b.deployed_by}` : null,
        b.notes,
      ].filter(Boolean).join(' · '),
    });
  }

  for (const s of signals) {
    if (s.actioned_at) {
      timeline.push({
        at: s.actioned_at,
        kind: 'signal_action',
        summary: `Signal ${s.status}: ${s.title}`,
        detail: s.funding_confidence ? `confidence: ${s.funding_confidence}` : undefined,
      });
    }
  }

  for (const b of mappedBuyers) {
    if (b.ghl_last_pushed_at) {
      timeline.push({
        at: b.ghl_last_pushed_at,
        kind: 'ghl_push',
        summary: `${b.entity_name} pushed to GHL`,
        detail: `stage: ${b.ghl_stage_name || 'Outreach Queued'}`,
      });
    }
  }

  // Sort newest first
  timeline.sort((a, b) => (b.at || '').localeCompare(a.at || ''));

  return {
    community: community as CommunityDetail,
    mappedBuyers,
    localEntities,
    signals,
    matchedGrants,
    matchedFoundations,
    assets: assetSummary,
    deploymentBatches,
    timeline,
  };
}
