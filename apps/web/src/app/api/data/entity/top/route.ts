import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const system = searchParams.get('system'); // procurement, justice, donations, charity, foundation, alma, ato
  const type = searchParams.get('type');     // entity_type filter
  const state = searchParams.get('state');   // state filter
  const cc = searchParams.get('cc');         // community_controlled only
  const minSystems = parseInt(searchParams.get('min_systems') || '1', 10);
  const sort = searchParams.get('sort') || 'power_score'; // power_score, total_dollar_flow, system_count

  try {
    const supabase = getServiceSupabase();
    const conditions: string[] = [`system_count >= ${minSystems}`];

    if (system) {
      const systemCol: Record<string, string> = {
        procurement: 'in_procurement',
        justice: 'in_justice_funding',
        donations: 'in_political_donations',
        charity: 'in_charity_registry',
        foundation: 'in_foundation',
        alma: 'in_alma_evidence',
        ato: 'in_ato_transparency',
      };
      const col = systemCol[system];
      if (col) conditions.push(`${col} > 0`);
    }

    if (type) conditions.push(`entity_type = '${type.replace(/'/g, "''")}'`);
    if (state) conditions.push(`UPPER(state) = '${state.toUpperCase().replace(/'/g, "''")}'`);
    if (cc === 'true') conditions.push(`is_community_controlled = true`);

    const validSorts = ['power_score', 'total_dollar_flow', 'system_count', 'procurement_dollars', 'justice_dollars', 'donation_dollars'];
    const orderCol = validSorts.includes(sort) ? sort : 'power_score';

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { data, error } = await supabase.rpc('exec_sql', {
      query: `SELECT gs_id, canonical_name, entity_type, abn, state, remoteness,
                is_community_controlled, lga_name,
                system_count, power_score,
                in_procurement, in_justice_funding, in_political_donations,
                in_charity_registry, in_foundation, in_alma_evidence, in_ato_transparency,
                procurement_dollars, justice_dollars, donation_dollars,
                total_dollar_flow, contract_count, distinct_govt_buyers, distinct_parties_funded,
                charity_size
         FROM mv_entity_power_index
         ${whereClause}
         ORDER BY ${orderCol} DESC NULLS LAST
         LIMIT ${limit} OFFSET ${offset}`,
    });

    if (error) throw error;

    // Get total count for pagination
    const { data: countData, error: countErr } = await supabase.rpc('exec_sql', {
      query: `SELECT COUNT(*)::int as total FROM mv_entity_power_index ${whereClause}`,
    });
    if (countErr) throw countErr;

    const total = (countData as Array<{ total: number }>)?.[0]?.total ?? 0;

    const response = NextResponse.json({
      results: data || [],
      total,
      limit,
      offset,
    });
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (error) {
    console.error('Top entities error:', error);
    return NextResponse.json({ error: 'Failed to fetch top entities' }, { status: 500 });
  }
}
