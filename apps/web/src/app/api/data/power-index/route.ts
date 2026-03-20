import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * Power Index API — cross-system power concentration data.
 *
 * GET /api/data/power-index
 *   ?min_systems=2    (minimum system count, default 2)
 *   &state=NSW        (filter by state)
 *   &type=company     (filter by entity type)
 *   &community=true   (only community-controlled)
 *   &sort=power_score (sort field: power_score, system_count, total_dollar_flow, procurement_dollars)
 *   &limit=100        (max results, default 100, max 1000)
 *
 * GET /api/data/power-index?view=deserts
 *   &state=NSW
 *   &min_desert=100   (minimum desert score)
 *   &limit=50
 *
 * GET /api/data/power-index?view=summary
 *   Returns aggregate stats by entity_type, remoteness, community_controlled
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'entities';
    const supabase = getServiceSupabase();

    if (view === 'deserts') {
      const state = searchParams.get('state');
      const minDesert = parseInt(searchParams.get('min_desert') || '0', 10);
      const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 500);

      let query = supabase
        .from('mv_funding_deserts')
        .select('*')
        .not('desert_score', 'is', null)
        .gte('desert_score', minDesert)
        .order('desert_score', { ascending: false })
        .limit(limit);

      if (state) query = query.eq('state', state.toUpperCase());

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      const response = NextResponse.json({
        deserts: data,
        meta: { count: data?.length || 0, filters: { state, minDesert, limit } },
      });
      response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return response;
    }

    if (view === 'summary') {
      const { data: byType, error: e1 } = await supabase.rpc('exec_sql', {
        query: `SELECT entity_type, COUNT(*) as entities, ROUND(AVG(system_count),2) as avg_systems, ROUND(AVG(power_score),2) as avg_power, ROUND(SUM(procurement_dollars)/1e9,2) as procurement_b, ROUND(SUM(justice_dollars)/1e9,2) as justice_b, ROUND(SUM(donation_dollars)/1e6,2) as donations_m FROM mv_entity_power_index GROUP BY entity_type ORDER BY avg_power DESC`,
      });
      if (e1) throw new Error(e1.message);

      const { data: byRemoteness, error: e2 } = await supabase.rpc('exec_sql', {
        query: `SELECT remoteness, COUNT(*) as entities, ROUND(AVG(system_count),2) as avg_systems, ROUND(AVG(power_score),2) as avg_power, ROUND(SUM(total_dollar_flow)/1e9,2) as flow_b FROM mv_entity_power_index WHERE remoteness IS NOT NULL GROUP BY remoteness ORDER BY avg_power DESC`,
      });
      if (e2) throw new Error(e2.message);

      const { data: byCommunity, error: e3 } = await supabase.rpc('exec_sql', {
        query: `SELECT is_community_controlled, COUNT(*) as entities, ROUND(AVG(system_count),2) as avg_systems, ROUND(SUM(procurement_dollars)/1e9,2) as procurement_b, ROUND(SUM(donation_dollars)/1e6,2) as donations_m FROM mv_entity_power_index GROUP BY is_community_controlled`,
      });
      if (e3) throw new Error(e3.message);

      const { data: distribution, error: e4 } = await supabase.rpc('exec_sql', {
        query: `SELECT system_count, COUNT(*) as entities FROM mv_entity_power_index GROUP BY system_count ORDER BY system_count DESC`,
      });
      if (e4) throw new Error(e4.message);

      const response = NextResponse.json({
        by_entity_type: byType,
        by_remoteness: byRemoteness,
        by_community_controlled: byCommunity,
        system_distribution: distribution,
      });
      response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return response;
    }

    // Default: entity list
    const minSystems = parseInt(searchParams.get('min_systems') || '2', 10);
    const state = searchParams.get('state');
    const entityType = searchParams.get('type');
    const communityOnly = searchParams.get('community') === 'true';
    const sort = searchParams.get('sort') || 'power_score';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000);

    const validSorts = ['power_score', 'system_count', 'total_dollar_flow', 'procurement_dollars', 'donation_dollars', 'justice_dollars'];
    const sortField = validSorts.includes(sort) ? sort : 'power_score';

    let query = supabase
      .from('mv_entity_power_index')
      .select('id, gs_id, canonical_name, entity_type, abn, state, lga_name, remoteness, is_community_controlled, system_count, power_score, in_procurement, in_justice_funding, in_political_donations, in_charity_registry, in_foundation, in_alma_evidence, in_ato_transparency, procurement_dollars, justice_dollars, donation_dollars, total_dollar_flow, contract_count, justice_record_count, donation_count, distinct_govt_buyers, distinct_parties_funded, charity_size, parties_funded')
      .gte('system_count', minSystems)
      .order(sortField, { ascending: false })
      .limit(limit);

    if (state) query = query.eq('state', state.toUpperCase());
    if (entityType) query = query.eq('entity_type', entityType);
    if (communityOnly) query = query.eq('is_community_controlled', true);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const response = NextResponse.json({
      entities: data,
      meta: { count: data?.length || 0, filters: { minSystems, state, entityType, communityOnly, sort: sortField, limit } },
    });
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
