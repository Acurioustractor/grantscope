import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { createSupabaseServer } from '@/lib/supabase-server';
import { logUsage } from '../_lib/log-usage';

/** Escape SQL LIKE wildcards in user input */
function sanitizeLike(s: string) {
  return s.replace(/[%_\\]/g, c => `\\${c}`);
}

/**
 * POST /api/tender-intelligence/discover
 *
 * Supplier discovery — query entities by category, geography, and type.
 * Returns matching suppliers with contract history and compliance metadata.
 */
export async function POST(request: NextRequest) {
  const authSupabase = await createSupabaseServer();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json();
  const {
    state,
    postcode,
    lga,
    entity_types = ['indigenous_corp', 'social_enterprise', 'charity', 'company'],
    category,
    remoteness,
    community_controlled,
    min_contracts = 0,
    limit: rawLimit = 50,
  } = body;

  // Input validation
  const VALID_TYPES = ['indigenous_corp', 'social_enterprise', 'charity', 'company', 'foundation', 'government_body'];
  const validatedTypes = (entity_types as string[]).filter((t: string) => VALID_TYPES.includes(t));
  if (validatedTypes.length === 0) {
    return NextResponse.json({ error: 'At least one valid entity_type required' }, { status: 400 });
  }
  const limit = Math.min(Math.max(1, Number(rawLimit) || 50), 200);

  const supabase = getServiceSupabase();

  // Build entity query
  let query = supabase
    .from('gs_entities')
    .select('gs_id, canonical_name, abn, entity_type, state, postcode, remoteness, seifa_irsd_decile, is_community_controlled, lga_name, latest_revenue, sector')
    .in('entity_type', validatedTypes)
    .order('latest_revenue', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (state && typeof state === 'string') query = query.eq('state', state.slice(0, 10));
  if (postcode && typeof postcode === 'string') query = query.eq('postcode', postcode.slice(0, 10));
  if (lga && typeof lga === 'string') query = query.ilike('lga_name', `%${sanitizeLike(lga.slice(0, 100))}%`);
  if (remoteness) query = query.eq('remoteness', remoteness);
  if (community_controlled) query = query.eq('is_community_controlled', true);

  const { data: entities, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!entities || entities.length === 0) {
    return NextResponse.json({ suppliers: [], count: 0, filters_applied: body });
  }

  // Get contract history for discovered entities
  const abns = entities.filter(e => e.abn).map(e => e.abn);
  let contractCounts: Record<string, { count: number; total_value: number }> = {};

  if (abns.length > 0) {
    const { data: contracts } = await supabase
      .from('austender_contracts')
      .select('supplier_abn, contract_value')
      .in('supplier_abn', abns);

    if (contracts) {
      for (const c of contracts) {
        if (!c.supplier_abn) continue;
        if (!contractCounts[c.supplier_abn]) {
          contractCounts[c.supplier_abn] = { count: 0, total_value: 0 };
        }
        contractCounts[c.supplier_abn].count++;
        contractCounts[c.supplier_abn].total_value += c.contract_value || 0;
      }
    }
  }

  // Enrich entities with contract data
  const suppliers = entities.map(e => ({
    ...e,
    contracts: contractCounts[e.abn || ''] || { count: 0, total_value: 0 },
  }));

  // Filter by minimum contracts if specified
  const filtered = min_contracts > 0
    ? suppliers.filter(s => s.contracts.count >= min_contracts)
    : suppliers;

  // Sort: entities with contracts first, then by revenue
  filtered.sort((a, b) => {
    if (a.contracts.count !== b.contracts.count) return b.contracts.count - a.contracts.count;
    return (b.latest_revenue || 0) - (a.latest_revenue || 0);
  });

  // Summary stats
  const summary = {
    total_found: filtered.length,
    indigenous_businesses: filtered.filter(s => s.entity_type === 'indigenous_corp').length,
    social_enterprises: filtered.filter(s => s.entity_type === 'social_enterprise').length,
    community_controlled: filtered.filter(s => s.is_community_controlled).length,
    with_federal_contracts: filtered.filter(s => s.contracts.count > 0).length,
    avg_seifa_decile: filtered.length > 0
      ? +(filtered.reduce((sum, s) => sum + (s.seifa_irsd_decile || 5), 0) / filtered.length).toFixed(1)
      : null,
  };

  logUsage({ user_id: user.id, endpoint: 'discover', filters: { state, postcode, lga, remoteness }, result_count: filtered.length });

  return NextResponse.json({
    suppliers: filtered,
    summary,
    filters_applied: body,
  });
}
