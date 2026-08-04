import { getServiceSupabase } from '@/lib/supabase';

export type CommunityDetail = {
  id: string;
  community_name: string;
  state: string | null;
  postcode: string | null;
  region_label: string | null;
  service_region: string | null;
  remoteness: string | null;
  lga_name: string | null;
  priority: string | null;
  demand_beds: number;
  demand_washers: number;
  assets_deployed: number;
  land_council: string | null;
  local_government: string | null;
  main_language: string | null;
  estimated_population: number | null;
  estimated_households: number | null;
  nearest_staging_hub: string | null;
  freight_corridor: string | null;
  last_mile_method: string | null;
  total_govt_contract_value: number | null;
  total_justice_funding: number | null;
  total_foundation_grants: number | null;
  proof_line: string | null;
  story: string | null;
  data_quality_score: number | null;
  last_profiled_at: string | null;
  data_sources: string[] | null;
};

export type MappedBuyer = {
  id: string;
  gs_id: string | null;
  entity_name: string;
  buyer_role: string | null;
  procurement_method: string | null;
  relationship_status: string | null;
  contact_surface: string | null;
  next_action: string | null;
  last_contact_date: string | null;
  fit_score: number | null;
  product_fit: string[];
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
  lga_name: string | null;
  source_count: number | null;
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
  overdue: number;
  attributed: number;
  latest_deployment_at: string | null;
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
    is_overdue: boolean;
    last_checkin_at: string | null;
  }>;
};

export type CommunityFundingSummary = {
  total_funding: number;
  community_controlled_funding: number;
  entity_count: number;
  community_controlled_count: number;
  relationship_count: number;
  seifa_irsd_decile: number | null;
  remoteness: string | null;
};

export type CommunityRelationshipPerson = {
  id: string;
  ghl_id: string | null;
  name: string;
  email: string | null;
  organisation: string | null;
  linked_organisation_name: string | null;
  linked_organisation_gs_id: string | null;
  last_contact_at: string | null;
  touchpoints: number;
  suggested_actions: string[];
  project_codes: string[];
  source: string;
};

export type CommunityProjectConnection = {
  code: string;
  name: string;
  basis: string;
  people: string[];
};

export type CommunityOperatingModel = {
  authority: {
    state: 'context_recorded' | 'potential_holders' | 'unverified';
    label: string;
    summary: string;
    candidates: LocalEntity[];
    consent_recorded: false;
  };
  next_move: {
    title: string;
    detail: string;
    why_now: string;
  };
  evidence_gaps: string[];
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
  funding: CommunityFundingSummary;
  relationshipPeople: CommunityRelationshipPerson[];
  projectConnections: CommunityProjectConnection[];
  operatingModel: CommunityOperatingModel;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function deriveCommunityOperatingModel(input: {
  community: CommunityDetail;
  mappedBuyers: MappedBuyer[];
  localEntities: LocalEntity[];
  relationshipPeople: CommunityRelationshipPerson[];
  assets: DeployedAssetSummary;
  deploymentBatches: DeploymentBatch[];
  signals: SignalSummary[];
  funding: CommunityFundingSummary;
}): CommunityOperatingModel {
  const authorityCandidates = input.localEntities.filter((entity) => entity.is_community_controlled).slice(0, 8);
  const authorityState: CommunityOperatingModel['authority']['state'] = input.community.land_council || input.community.local_government
    ? 'context_recorded'
    : authorityCandidates.length > 0 ? 'potential_holders' : 'unverified';
  const authority = authorityState === 'context_recorded'
    ? {
        state: authorityState,
        label: 'Governance context recorded',
        summary: `${[input.community.land_council, input.community.local_government].filter(Boolean).join(' · ')} is recorded as place context. Community authority and consent still require confirmation.`,
      }
    : authorityState === 'potential_holders'
      ? {
          state: authorityState,
          label: 'Potential authority holders identified',
          summary: `${authorityCandidates.length} community-controlled organisations are visible in CivicGraph. Their presence does not prove authority, consent or a mandate for ACT.`,
        }
      : {
          state: authorityState,
          label: 'Authority not recorded',
          summary: 'No land council, local governance context or community-controlled authority candidate is connected to this place record.',
        };
  const activeSignals = input.signals.filter((signal) => ['new', 'reviewing'].includes(signal.status));
  const evidenceGaps = [
    'community authority, consent and decision rights',
    'named ACT relationship owner for this place',
    !input.community.story ? 'community-approved account of the work and what matters next' : null,
    (input.community.data_sources?.length ?? 0) === 0 ? 'source provenance for the place profile' : null,
    input.relationshipPeople.length === 0 ? 'named relationship path through a local organisation' : null,
    input.mappedBuyers.length === 0 ? 'verified buyer or procurement pathway' : null,
    input.assets.total > 0 && input.assets.attributed === 0 ? 'funding attribution for deployed assets' : null,
    input.assets.total > 0 && input.deploymentBatches.length === 0 ? 'deployment batches and accountable delivery dates' : null,
    input.assets.overdue > 0 ? 'current condition and consented check-in for overdue assets' : null,
    input.funding.total_funding === 0 ? 'place-level public funding context' : null,
  ].filter((gap): gap is string => Boolean(gap));

  const nextMove = input.assets.overdue > 0
    ? {
        title: 'Confirm an authority-led asset check-in',
        detail: `Name the local authority and ACT relationship owner, confirm consent, then validate ${input.assets.overdue.toLocaleString('en-AU')} overdue asset records before replacement, funding or procurement decisions.`,
        why_now: `${input.assets.total.toLocaleString('en-AU')} assets are recorded here, but no current, consented condition record is connected.`,
      }
    : input.relationshipPeople.length === 0
      ? {
          title: 'Establish the relationship path before proposing work',
          detail: 'Identify who holds local authority, who ACT already knows, and what information may be used before shaping an offer or outreach.',
          why_now: 'CivicGraph has place evidence but no named ACT relationship path.',
        }
      : activeSignals.length > 0
        ? {
            title: 'Review the live signals with a local relationship holder',
            detail: `Take the ${activeSignals.length.toLocaleString('en-AU')} active signals to a known local relationship and ask what is useful, accurate and authorised.`,
            why_now: 'Operational signals exist, but they should not become an ACT commitment without local interpretation.',
          }
        : {
            title: 'Ask what a useful next exchange would be',
            detail: 'Start from the strongest existing relationship and the work already recorded here; do not assume that adjacent activity creates a mandate for ACT.',
            why_now: 'The place record is ready for a relational review rather than another broad data-enrichment pass.',
          };

  return {
    authority: {
      ...authority,
      candidates: authorityCandidates,
      consent_recorded: false,
    },
    next_move: nextMove,
    evidence_gaps: evidenceGaps,
  };
}

export async function getGoodsCommunityDetail(communityId: string, orgProfileId?: string): Promise<GoodsCommunityDetail | null> {
  const db = getServiceSupabase();

  const { data: community, error } = await db
    .from('goods_communities')
    .select('id, community_name, state, postcode, region_label, service_region, remoteness, lga_name, priority, demand_beds, demand_washers, assets_deployed, land_council, local_government, main_language, estimated_population, estimated_households, nearest_staging_hub, freight_corridor, last_mile_method, total_govt_contract_value, total_justice_funding, total_foundation_grants, proof_line, story, data_quality_score, last_profiled_at, data_sources')
    .eq('id', communityId)
    .maybeSingle();
  if (error || !community) return null;

  // Mapped procurement entities at this community
  const { data: mappedBuyersRaw } = await db
    .from('goods_procurement_entities')
    .select('id, entity_id, gs_id, entity_name, buyer_role, procurement_method, relationship_status, contact_surface, next_action, last_contact_date, fit_score, product_fit, estimated_annual_spend, govt_contract_value, is_community_controlled, website, ghl_contact_id, ghl_opportunity_id, ghl_stage_name, ghl_last_pushed_at, ghl_last_synced_at')
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
    gs_id: (b.gs_id as string | null) ?? null,
    entity_id: (b.entity_id as string | null) ?? null,
    entity_name: b.entity_name as string,
    buyer_role: b.buyer_role as string | null,
    procurement_method: b.procurement_method as string | null,
    relationship_status: b.relationship_status as string | null,
    contact_surface: b.contact_surface as string | null,
    next_action: (b.next_action as string | null) ?? null,
    last_contact_date: (b.last_contact_date as string | null) ?? null,
    fit_score: b.fit_score == null ? null : numberValue(b.fit_score),
    product_fit: stringArray(b.product_fit),
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
      .select('id, gs_id, canonical_name, entity_type, sector, abn, is_community_controlled, postcode, lga_name, source_count')
      .eq('postcode', community.postcode)
      .in('entity_type', ['indigenous_corp', 'council', 'charity', 'health_service', 'land_council', 'housing_provider', 'store', 'community_org', 'education'])
      .limit(120);
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
    .select('id, goods_asset_id, asset_name, product_type, product_slug, funded_by_label, funded_amount_aud, deployed_at, current_status, household, is_overdue, last_checkin_at')
    .eq('community_id', communityId)
    .order('deployed_at', { ascending: false, nullsFirst: false })
    .limit(500);
  const assetRows = (assetsRaw || []) as any[];
  const assetSummary: DeployedAssetSummary = {
    total: assetRows.length,
    overdue: assetRows.filter((asset) => Boolean(asset.is_overdue)).length,
    attributed: assetRows.filter((asset) => Boolean(asset.funded_by_label || asset.funded_amount_aud)).length,
    latest_deployment_at: assetRows.map((asset) => asset.deployed_at as string | null).filter(Boolean).sort().reverse()[0] ?? null,
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
      is_overdue: Boolean(a.is_overdue),
      last_checkin_at: a.last_checkin_at,
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

  let funding: CommunityFundingSummary = {
    total_funding: numberValue(community.total_govt_contract_value) + numberValue(community.total_justice_funding) + numberValue(community.total_foundation_grants),
    community_controlled_funding: 0,
    entity_count: localEntities.length,
    community_controlled_count: localEntities.filter((entity) => entity.is_community_controlled).length,
    relationship_count: 0,
    seifa_irsd_decile: null,
    remoteness: (community.remoteness as string | null) ?? null,
  };
  if (community.postcode) {
    const { data: placeFunding, error: placeFundingError } = await db
      .from('mv_funding_by_postcode')
      .select('total_funding, community_controlled_funding, entity_count, community_controlled_count, relationship_count, seifa_irsd_decile, remoteness')
      .eq('postcode', community.postcode)
      .maybeSingle();
    let fundingRow = placeFunding;
    if ((!fundingRow || placeFundingError) && /^\d{4}$/.test(community.postcode)) {
      const { data: fallbackRows } = await db.rpc('exec_sql', {
        query: `SELECT total_funding, community_controlled_funding, entity_count, community_controlled_count,
          relationship_count, seifa_irsd_decile, remoteness
          FROM mv_funding_by_postcode WHERE postcode = '${community.postcode}' LIMIT 1`,
      });
      fundingRow = Array.isArray(fallbackRows) ? fallbackRows[0] ?? null : null;
    }
    if (fundingRow) {
      funding = {
        total_funding: numberValue(fundingRow.total_funding),
        community_controlled_funding: numberValue(fundingRow.community_controlled_funding),
        entity_count: numberValue(fundingRow.entity_count),
        community_controlled_count: numberValue(fundingRow.community_controlled_count),
        relationship_count: numberValue(fundingRow.relationship_count),
        seifa_irsd_decile: fundingRow.seifa_irsd_decile == null ? null : numberValue(fundingRow.seifa_irsd_decile),
        remoteness: (fundingRow.remoteness as string | null) ?? funding.remoteness,
      };
    }
  }

  const placeEntities = [
    ...localEntities.map((entity) => ({ id: entity.id, name: entity.canonical_name, gsId: entity.gs_id })),
    ...mappedBuyers.filter((buyer) => buyer.entity_id).map((buyer) => ({ id: buyer.entity_id as string, name: buyer.entity_name, gsId: buyer.gs_id })),
  ];
  const entityByIdForPeople = new Map(placeEntities.map((entity) => [entity.id, entity]));
  const placeEntityIds = [...entityByIdForPeople.keys()];
  const { data: identityLinksRaw } = placeEntityIds.length > 0
    ? await db.from('contact_entity_links').select('contact_id, entity_id, confidence_score').in('entity_id', placeEntityIds).gte('confidence_score', 0.8).limit(500)
    : { data: [] };
  const identityLinks = (identityLinksRaw ?? []) as Array<{ contact_id: string; entity_id: string; confidence_score: number | null }>;
  const linkedContactIds = [...new Set(identityLinks.map((link) => link.contact_id))];
  const buyerGhlIds = [...new Set(mappedBuyers.map((buyer) => buyer.ghl_contact_id).filter((value): value is string => Boolean(value)))];
  const [linkedContactsResult, buyerContactsResult, orgContactsResult] = await Promise.all([
    linkedContactIds.length > 0
      ? db.from('ghl_contacts').select('id, ghl_id, full_name, email, company_name, last_contact_date').in('id', linkedContactIds)
      : Promise.resolve({ data: [] }),
    buyerGhlIds.length > 0
      ? db.from('ghl_contacts').select('id, ghl_id, full_name, email, company_name, last_contact_date').in('ghl_id', buyerGhlIds)
      : Promise.resolve({ data: [] }),
    UUID_RE.test(orgProfileId ?? '') && placeEntityIds.length > 0
      ? db.from('org_contacts').select('id, name, email, organisation, last_contacted_at, linked_entity_id').eq('org_profile_id', orgProfileId as string).in('linked_entity_id', placeEntityIds)
      : Promise.resolve({ data: [] }),
  ]);
  type GhlPersonRow = { id: string; ghl_id: string | null; full_name: string | null; email: string | null; company_name: string | null; last_contact_date: string | null };
  type OrgPersonRow = { id: string; name: string; email: string | null; organisation: string | null; last_contacted_at: string | null; linked_entity_id: string | null };
  const ghlContactMap = new Map<string, GhlPersonRow>();
  for (const contact of [...(linkedContactsResult.data ?? []), ...(buyerContactsResult.data ?? [])] as GhlPersonRow[]) {
    if (contact.ghl_id) ghlContactMap.set(contact.ghl_id, contact);
  }
  const ghlIds = [...ghlContactMap.keys()];
  const [healthResult, projectLinksResult] = await Promise.all([
    ghlIds.length > 0
      ? db.from('relationship_health').select('ghl_contact_id, total_touchpoints, last_contact_at, suggested_actions').in('ghl_contact_id', ghlIds)
      : Promise.resolve({ data: [] }),
    ghlIds.length > 0
      ? db.from('contact_project_links').select('ghl_contact_id, project_code, confidence').in('ghl_contact_id', ghlIds).gte('confidence', 0.7)
      : Promise.resolve({ data: [] }),
  ]);
  const healthByGhl = new Map((healthResult.data ?? []).map((row) => [row.ghl_contact_id as string, row]));
  const projectsByGhl = new Map<string, string[]>();
  for (const row of (projectLinksResult.data ?? []) as Array<{ ghl_contact_id: string; project_code: string }>) {
    projectsByGhl.set(row.ghl_contact_id, [...new Set([...(projectsByGhl.get(row.ghl_contact_id) ?? []), row.project_code])]);
  }
  const linkByContactId = new Map(identityLinks.map((link) => [link.contact_id, link]));
  const relationshipPeople: CommunityRelationshipPerson[] = [...ghlContactMap.values()].map((contact) => {
    const link = linkByContactId.get(contact.id);
    const entity = link ? entityByIdForPeople.get(link.entity_id) : null;
    const health = contact.ghl_id ? healthByGhl.get(contact.ghl_id) : null;
    return {
      id: `ghl:${contact.ghl_id}`,
      ghl_id: contact.ghl_id,
      name: contact.full_name || contact.email || 'Unnamed ACT contact',
      email: contact.email,
      organisation: contact.company_name,
      linked_organisation_name: entity?.name ?? null,
      linked_organisation_gs_id: entity?.gsId ?? null,
      last_contact_at: (health?.last_contact_at as string | null) ?? contact.last_contact_date,
      touchpoints: numberValue(health?.total_touchpoints),
      suggested_actions: stringArray(health?.suggested_actions),
      project_codes: contact.ghl_id ? projectsByGhl.get(contact.ghl_id) ?? [] : [],
      source: entity ? 'CivicGraph organisation link' : 'Goods buyer relationship',
    };
  });
  const seenPeople = new Set(relationshipPeople.map((person) => person.email?.toLocaleLowerCase('en-AU') || person.name.toLocaleLowerCase('en-AU')));
  for (const contact of (orgContactsResult.data ?? []) as OrgPersonRow[]) {
    const key = contact.email?.toLocaleLowerCase('en-AU') || contact.name.toLocaleLowerCase('en-AU');
    if (seenPeople.has(key)) continue;
    const entity = contact.linked_entity_id ? entityByIdForPeople.get(contact.linked_entity_id) : null;
    relationshipPeople.push({
      id: `org:${contact.id}`,
      ghl_id: null,
      name: contact.name,
      email: contact.email,
      organisation: contact.organisation,
      linked_organisation_name: entity?.name ?? null,
      linked_organisation_gs_id: entity?.gsId ?? null,
      last_contact_at: contact.last_contacted_at,
      touchpoints: 0,
      suggested_actions: [],
      project_codes: [],
      source: 'ACT organisation contact',
    });
    seenPeople.add(key);
  }
  relationshipPeople.sort((left, right) => right.touchpoints - left.touchpoints || String(right.last_contact_at ?? '').localeCompare(String(left.last_contact_at ?? '')) || left.name.localeCompare(right.name));

  const projectCodes = [...new Set(['ACT-GD', ...relationshipPeople.flatMap((person) => person.project_codes)])];
  const { data: orgProjectRows } = UUID_RE.test(orgProfileId ?? '')
    ? await db.from('org_projects').select('code, name').eq('org_profile_id', orgProfileId as string).in('code', projectCodes)
    : { data: [] };
  const projectNames = new Map((orgProjectRows ?? []).map((project) => [project.code as string, project.name as string]));
  const projectConnections: CommunityProjectConnection[] = projectCodes.map((code) => ({
    code,
    name: projectNames.get(code) ?? (code === 'ACT-GD' ? 'Goods on Country' : code),
    basis: code === 'ACT-GD' ? 'Direct community delivery, asset and signal records' : 'Connected through a person linked to a local organisation',
    people: relationshipPeople.filter((person) => person.project_codes.includes(code)).map((person) => person.name),
  }));
  const typedCommunity = community as CommunityDetail;
  const operatingModel = deriveCommunityOperatingModel({
    community: typedCommunity,
    mappedBuyers,
    localEntities,
    relationshipPeople,
    assets: assetSummary,
    deploymentBatches,
    signals,
    funding,
  });

  return {
    community: typedCommunity,
    mappedBuyers,
    localEntities,
    signals,
    matchedGrants,
    matchedFoundations,
    assets: assetSummary,
    deploymentBatches,
    timeline,
    funding,
    relationshipPeople,
    projectConnections,
    operatingModel,
  };
}
