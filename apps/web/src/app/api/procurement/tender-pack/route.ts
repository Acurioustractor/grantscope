import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireModule } from '@/lib/api-auth';

/**
 * POST /api/procurement/tender-pack
 *
 * Auto-generates a Tender Intelligence Pack for a given geographic area + categories.
 * Input: { lgas?: string[], postcodes?: string[], states?: string[], entity_types?: string[], keywords?: string }
 * Output: Verified supplier shortlist, compliance forecast, gap analysis
 */
export async function POST(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;

  const body = await request.json();
  const {
    lgas = [],
    postcodes = [],
    states = [],
    entity_types = ['indigenous_corp', 'social_enterprise', 'charity'],
    keywords,
    ipp_target = 3.0,
    sme_target = 30.0,
  } = body as {
    lgas?: string[];
    postcodes?: string[];
    states?: string[];
    entity_types?: string[];
    keywords?: string;
    ipp_target?: number;
    sme_target?: number;
  };

  if (!lgas.length && !postcodes.length && !states.length) {
    return NextResponse.json(
      { error: 'Provide at least one of: lgas, postcodes, or states' },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();

  // Build entity query with geographic filters
  let entityQuery = supabase
    .from('gs_entities')
    .select('gs_id, canonical_name, abn, entity_type, state, postcode, remoteness, seifa_irsd_decile, is_community_controlled, lga_name, lga_code, sector')
    .in('entity_type', entity_types);

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
  const entities = entityResult.data || [];

  // Get contract history for these entities
  const abns = entities.map(e => e.abn).filter(Boolean) as string[];
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
  const shortlist = entities.map(e => {
    const contracts = contractsByAbn.get(e.abn || '') || { count: 0, total_value: 0, buyers: new Set(), latest: '' };
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
  const indigenousInArea = shortlist.filter(s => s.entity_type === 'indigenous_corp').length;
  const seInArea = shortlist.filter(s =>
    s.entity_type === 'social_enterprise' || s.entity_type === 'charity'
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
      title: `Tender Intelligence Pack — ${lgas.join(', ') || postcodes.join(', ') || states.join(', ')}`,
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
    summary: {
      total_entities: totalInArea,
      by_type: shortlist.reduce((acc, s) => {
        acc[s.entity_type] = (acc[s.entity_type] || 0) + 1;
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
  entity: Record<string, unknown>,
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
