import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
  const type = searchParams.get('type');
  const lga = searchParams.get('lga')?.trim();

  // LGA mode: return top entities in an LGA (for map detail panel)
  if (lga) {
    try {
      const supabase = getServiceSupabase();
      const escapedLga = lga.replace(/'/g, "''");
      const typeFilter = type ? `AND ge.entity_type = '${type.replace(/'/g, "''")}'` : '';

      const { data, error } = await supabase.rpc('exec_sql', {
        query: `SELECT ge.gs_id, ge.canonical_name, ge.abn, ge.entity_type, ge.sector,
                  ge.state, ge.lga_name, ge.is_community_controlled,
                  pi.power_score, pi.system_count
           FROM gs_entities ge
           LEFT JOIN mv_entity_power_index pi ON pi.id = ge.id
           WHERE ge.lga_name = '${escapedLga}' ${typeFilter}
           ORDER BY pi.power_score DESC NULLS LAST
           LIMIT ${limit}`,
      });
      if (error) throw error;
      const response = NextResponse.json({ results: data || [] });
      response.headers.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
      return response;
    } catch (error) {
      console.error('LGA entity search error:', error);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
  }

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const supabase = getServiceSupabase();
    const escaped = q.replace(/'/g, "''");
    const abnClean = q.replace(/\s/g, '');
    const isABN = /^\d{11}$/.test(abnClean);

    const typeFilter = type ? `AND ge.entity_type = '${type.replace(/'/g, "''")}'` : '';

    const query = isABN
      ? `SELECT ge.gs_id, ge.canonical_name, ge.abn, ge.entity_type, ge.sector,
                ge.state, ge.lga_name, ge.is_community_controlled,
                pi.power_score, pi.system_count
         FROM gs_entities ge
         LEFT JOIN mv_entity_power_index pi ON pi.id = ge.id
         WHERE ge.abn = '${abnClean}'
         LIMIT ${limit}`
      : `SELECT ge.gs_id, ge.canonical_name, ge.abn, ge.entity_type, ge.sector,
                ge.state, ge.lga_name, ge.is_community_controlled,
                pi.power_score, pi.system_count
         FROM gs_entities ge
         LEFT JOIN mv_entity_power_index pi ON pi.id = ge.id
         WHERE UPPER(ge.canonical_name) LIKE '%${escaped.toUpperCase()}%' ${typeFilter}
         ORDER BY pi.power_score DESC NULLS LAST
         LIMIT ${limit}`;

    const { data, error } = await supabase.rpc('exec_sql', { query });
    if (error) throw error;

    const response = NextResponse.json({ results: data || [] });
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    return response;
  } catch (error) {
    console.error('Entity search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
