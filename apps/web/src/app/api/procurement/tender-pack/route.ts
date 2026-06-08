import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireModule } from '@/lib/api-auth';
import { policyInsertsForStates } from '@/lib/social-procurement';

/**
 * POST /api/procurement/tender-pack
 *
 * Auto-generates a Tender Intelligence Pack for a given geographic area + categories.
 * Input: { lgas?: string[], postcodes?: string[], states?: string[], entity_types?: string[], keywords?: string }
 * Output: Verified supplier shortlist, compliance forecast, gap analysis
 */
interface SeRow {
  id: string;
  name: string | null;
  abn: string | null;
  state: string | null;
  postcode: string | null;
  sector: string[] | string | null;
  source_primary: string | null;
  org_type: string | null;
}

interface MergedEntity {
  gs_id: string | null;
  canonical_name: string | null;
  abn: string | null;
  entity_type: string | null;
  state: string | null;
  postcode: string | null;
  remoteness: string | null;
  seifa_irsd_decile: number | null;
  is_community_controlled: boolean | null;
  lga_name: string | null;
  lga_code: string | null;
  sector: string | null;
}

export async function POST(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;

  const body = await request.json();
  const {
    lgas = [],
    postcodes = [],
    states = [],
    se_ids = [],
    entity_types = ['indigenous_corp', 'social_enterprise', 'charity'],
    keywords,
    ipp_target = 3.0,
    sme_target = 30.0,
  } = body as {
    lgas?: string[];
    postcodes?: string[];
    states?: string[];
    se_ids?: string[];
    entity_types?: string[];
    keywords?: string;
    ipp_target?: number;
    sme_target?: number;
  };

  const fromShortlist = se_ids.length > 0;

  if (!fromShortlist && !lgas.length && !postcodes.length && !states.length) {
    return NextResponse.json(
      { error: 'Provide a shortlist (se_ids) or at least one of: lgas, postcodes, or states' },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();

  // Resolve the candidate supplier set two ways:
  //  - shortlist mode: the buyer's hand-picked social_enterprises (by id), enriched
  //    with gs_entities geography by ABN;
  //  - geography mode: gs_entities in the target area, overlaid with the SE registry.
  const GS_COLS =
    'gs_id, canonical_name, abn, entity_type, state, postcode, remoteness, seifa_irsd_decile, is_community_controlled, lga_name, lga_code, sector';

  let merged: MergedEntity[] = [];
  const seByAbn = new Map<string, SeRow>();

  if (fromShortlist) {
    const seResult = await supabase
      .from('social_enterprises')
      .select('id, name, abn, state, postcode, sector, source_primary, org_type')
      .in('id', se_ids.slice(0, 200));
    const seRows = (seResult.data || []) as SeRow[];
    for (const se of seRows) if (se.abn) seByAbn.set(se.abn, se);

    // Enrich the picked enterprises with gs_entities geography/remoteness/SEIFA by ABN.
    const seAbns = seRows.map((se) => se.abn).filter(Boolean) as string[];
    const gsByAbn = new Map<string, MergedEntity>();
    if (seAbns.length > 0) {
      const gsResult = await supabase.from('gs_entities').select(GS_COLS).in('abn', seAbns.slice(0, 200));
      for (const g of (gsResult.data || []) as MergedEntity[]) {
        if (g.abn) gsByAbn.set(g.abn, g);
      }
    }

    merged = seRows.map((se) => {
      const g = se.abn ? gsByAbn.get(se.abn) : undefined;
      if (g) return g;
      return {
        gs_id: null,
        canonical_name: se.name,
        abn: se.abn,
        entity_type: se.org_type || 'social_enterprise',
        state: se.state,
        postcode: se.postcode,
        remoteness: null,
        seifa_irsd_decile: null,
        is_community_controlled: null,
        lga_name: null,
        lga_code: null,
        sector: Array.isArray(se.sector) ? se.sector.join(', ') : se.sector,
      };
    });
  } else {
    // Geography mode — gs_entities in the target area, overlaid with the SE registry.
    let entityQuery = supabase.from('gs_entities').select(GS_COLS).in('entity_type', entity_types);

    if (lgas.length > 0) {
      entityQuery = entityQuery.in('lga_name', lgas);
    } else if (postcodes.length > 0) {
      entityQuery = entityQuery.in('postcode', postcodes);
    } else if (states.length > 0) {
      entityQuery = entityQuery.in('state', states);
    }
    if (keywords) {
      entityQuery = entityQuery.ilike('canonical_name', `%${keywords}%`);
    }
    const entityResult = await entityQuery.limit(500);
    const entities = (entityResult.data || []) as MergedEntity[];

    // Registered enterprises matching the entity shortlist get verification marks;
    // ones missing from the entity query are added as suppliers in their own right.
    let seQuery = supabase
      .from('social_enterprises')
      .select('id, name, abn, state, postcode, sector, source_primary, org_type')
      .not('abn', 'is', null);
    if (postcodes.length > 0) {
      seQuery = seQuery.in('postcode', postcodes);
    } else if (states.length > 0) {
      seQuery = seQuery.in('state', states);
    } else {
      // LGA-only request — social_enterprises has no LGA column, so overlay by ABN only
      const entityAbns = entities.map((e) => e.abn).filter(Boolean) as string[];
      seQuery = entityAbns.length > 0 ? seQuery.in('abn', entityAbns.slice(0, 200)) : seQuery.limit(0);
    }
    if (keywords) {
      seQuery = seQuery.ilike('name', `%${keywords}%`);
    }
    const seResult = await seQuery.limit(300);
    const seRows = (seResult.data || []) as SeRow[];
    for (const se of seRows) if (se.abn) seByAbn.set(se.abn, se);

    const entityAbnSet = new Set(entities.map((e) => e.abn).filter(Boolean));
    const seOnly = seRows.filter((se) => !entityAbnSet.has(se.abn));
    merged = [
      ...entities,
      ...seOnly.map((se) => ({
        gs_id: null,
        canonical_name: se.name,
        abn: se.abn,
        entity_type: se.org_type || 'social_enterprise',
        state: se.state,
        postcode: se.postcode,
        remoteness: null,
        seifa_irsd_decile: null,
        is_community_controlled: null,
        lga_name: null,
        lga_code: null,
        sector: Array.isArray(se.sector) ? se.sector.join(', ') : se.sector,
      })),
    ];
  }

  // Get contract history for these entities
  const abns = merged.map(e => e.abn).filter(Boolean) as string[];
  let contractHistory: Array<Record<string, unknown>> = [];
  if (abns.length > 0) {
    const contractResult = await supabase
      .from('austender_contracts')
      .select('supplier_abn, title, contract_value, buyer_name, contract_start, contract_end')
      .in('supplier_abn', abns.slice(0, 200))
      .order('contract_value', { ascending: false })
      .limit(1000);
    contractHistory = contractResult.data || [];
  }

  // Build contract stats per entity
  const contractsByAbn = new Map<string, { count: number; total_value: number; buyers: Set<string>; latest: string }>();
  for (const c of contractHistory) {
    const abn = c.supplier_abn as string;
    if (!contractsByAbn.has(abn)) {
      contractsByAbn.set(abn, { count: 0, total_value: 0, buyers: new Set(), latest: '' });
    }
    const stats = contractsByAbn.get(abn)!;
    stats.count++;
    stats.total_value += (c.contract_value as number) || 0;
    if (c.buyer_name) stats.buyers.add(c.buyer_name as string);
    const start = c.contract_start as string;
    if (start && start > stats.latest) stats.latest = start;
  }

  // Get area context — SEIFA, remoteness for the target area
  let areaContext: Record<string, unknown> = {};
  if (postcodes.length > 0) {
    const geoResult = await supabase
      .from('postcode_geo')
      .select('postcode, locality, state, remoteness_2021, lga_name')
      .in('postcode', postcodes)
      .limit(50);
    const seifaResult = await supabase
      .from('seifa_2021')
      .select('postcode, score, decile_national')
      .eq('index_type', 'irsd')
      .in('postcode', postcodes)
      .limit(50);

    areaContext = {
      postcodes: geoResult.data || [],
      seifa: seifaResult.data || [],
    };
  } else if (lgas.length > 0) {
    const lgaResult = await supabase
      .from('mv_funding_by_lga')
      .select('*')
      .in('lga_name', lgas)
      .limit(50);
    areaContext = { lga_funding: lgaResult.data || [] };
  }

  // Build supplier shortlist with enrichment
  const shortlist = merged.map(e => {
    const contracts = contractsByAbn.get(e.abn || '') || { count: 0, total_value: 0, buyers: new Set(), latest: '' };
    const se = e.abn ? seByAbn.get(e.abn) : undefined;
    return {
      gs_id: e.gs_id,
      name: e.canonical_name,
      abn: e.abn,
      entity_type: e.entity_type,
      state: e.state,
      postcode: e.postcode,
      remoteness: e.remoteness,
      seifa_decile: e.seifa_irsd_decile,
      is_community_controlled: e.is_community_controlled,
      lga: e.lga_name,
      sector: e.sector,
      se_registered: !!se,
      se_source: se?.source_primary || null,
      se_profile_url: se ? `/social-enterprises/${se.id}` : null,
      contract_history: {
        count: contracts.count,
        total_value: contracts.total_value,
        unique_buyers: contracts.buyers.size,
        latest_contract: contracts.latest || null,
      },
      capability_score: calculateCapabilityScore(e, contracts),
    };
  }).sort((a, b) => b.capability_score - a.capability_score);

  // Compliance forecast
  const totalInArea = shortlist.length;
  const indigenousInArea = shortlist.filter(s =>
    s.entity_type === 'indigenous_corp' ||
    (s.se_source && ['supply-nation', 'oric', 'kinaway'].includes(s.se_source))
  ).length;
  const seInArea = shortlist.filter(s =>
    s.entity_type === 'social_enterprise' || s.entity_type === 'charity' || s.se_registered
  ).length;
  const communityControlled = shortlist.filter(s => s.is_community_controlled).length;
  const withContracts = shortlist.filter(s => s.contract_history.count > 0).length;

  // Gap analysis — identify what's missing
  const gaps: Array<{ type: string; description: string; severity: 'high' | 'medium' | 'low' }> = [];

  if (indigenousInArea === 0) {
    gaps.push({
      type: 'indigenous_supply',
      description: `No verified Indigenous businesses found in the target area. Consider expanding search radius or engaging Supply Nation for introductions.`,
      severity: 'high',
    });
  } else if (indigenousInArea < 3) {
    gaps.push({
      type: 'indigenous_supply',
      description: `Only ${indigenousInArea} Indigenous business(es) in area — limited options for IPP compliance. Recommend broadening geographic scope.`,
      severity: 'medium',
    });
  }

  if (withContracts === 0) {
    gaps.push({
      type: 'contract_experience',
      description: 'No entities in the area have prior federal contract experience. May need capability building or mentoring component in tender response.',
      severity: 'medium',
    });
  }

  const remoteEntities = shortlist.filter(s => s.remoteness && !s.remoteness.includes('Major'));
  if (remoteEntities.length === 0 && (lgas.length > 0 || postcodes.length > 0)) {
    gaps.push({
      type: 'regional_presence',
      description: 'All shortlisted entities are in major cities. If project requires regional delivery, additional supplier development needed.',
      severity: 'low',
    });
  }

  const disadvantagedArea = shortlist.filter(s => s.seifa_decile && s.seifa_decile <= 3);
  if (disadvantagedArea.length > totalInArea * 0.5) {
    gaps.push({
      type: 'disadvantaged_area',
      description: `${disadvantagedArea.length} of ${totalInArea} suppliers operate in highly disadvantaged areas (SEIFA decile 1-3). Strong social value evidence for tender response.`,
      severity: 'low', // This is actually a positive
    });
  }

  return NextResponse.json({
    pack: {
      title: fromShortlist
        ? `Tender Intelligence Pack — Your shortlist (${merged.length} supplier${merged.length === 1 ? '' : 's'})`
        : `Tender Intelligence Pack — ${lgas.join(', ') || postcodes.join(', ') || states.join(', ')}`,
      generated_at: new Date().toISOString(),
      filters: { lgas, postcodes, states, entity_types, keywords },
      area_context: areaContext,
    },
    shortlist,
    compliance_forecast: {
      ipp_target: ipp_target / 100,
      sme_target: sme_target / 100,
      total_available: totalInArea,
      indigenous_available: indigenousInArea,
      social_enterprise_available: seInArea,
      community_controlled_available: communityControlled,
      with_contract_experience: withContracts,
      ipp_achievable: indigenousInArea >= 3,
      sme_achievable: seInArea >= 5,
    },
    gaps,
    // Social procurement policy inserts for the relevant jurisdictions —
    // paste-ready text tying this shortlist to the operative policy levers.
    policy_inserts: policyInsertsForStates(
      states.length > 0
        ? states
        : [...new Set(shortlist.map(s => s.state).filter(Boolean))] as string[],
    ),
    summary: {
      total_entities: totalInArea,
      by_type: shortlist.reduce((acc, s) => {
        const t = s.entity_type || 'unknown';
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      by_state: shortlist.reduce((acc, s) => {
        const st = s.state || 'Unknown';
        acc[st] = (acc[st] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      total_contract_value: shortlist.reduce((s, e) => s + e.contract_history.total_value, 0),
    },
  });
}

function calculateCapabilityScore(
  entity: MergedEntity,
  contracts: { count: number; total_value: number; buyers: Set<string>; latest: string }
): number {
  let score = 0;

  // Contract experience (0-40)
  score += Math.min(contracts.count * 5, 20);
  score += Math.min(contracts.buyers.size * 5, 10);
  if (contracts.total_value > 1_000_000) score += 5;
  if (contracts.total_value > 10_000_000) score += 5;

  // Recency (0-15)
  if (contracts.latest) {
    const years = (Date.now() - new Date(contracts.latest).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (years < 1) score += 15;
    else if (years < 2) score += 10;
    else if (years < 3) score += 5;
  }

  // Community credentials (0-25)
  if (entity.is_community_controlled) score += 15;
  if (entity.entity_type === 'indigenous_corp') score += 10;

  // Geographic disadvantage bonus (0-20)
  const seifa = entity.seifa_irsd_decile as number;
  if (seifa && seifa <= 2) score += 20;
  else if (seifa && seifa <= 4) score += 10;
  else if (seifa && seifa <= 6) score += 5;

  return Math.min(score, 100);
}
