import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/supabase';
import { esc, validateAbn } from '@/lib/sql';

export const dynamic = 'force-dynamic';

const schema = z.object({
  q: z.string().max(200).optional(),
  lga: z.string().max(100).optional(),
  type: z.string().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });

  const { limit, type } = parsed.data;
  const q = parsed.data.q?.trim();
  const lga = parsed.data.lga?.trim();

  const typeFilter = type ? `AND ge.entity_type = '${esc(type)}'` : '';

  // LGA mode: return top entities in an LGA (for map detail panel)
  if (lga) {
    try {
      const supabase = getServiceSupabase();

      const { data, error } = await supabase.rpc('exec_sql', {
        query: `SELECT ge.gs_id, ge.canonical_name, ge.abn, ge.entity_type, ge.sector,
                  ge.state, ge.lga_name, ge.is_community_controlled,
                  pi.power_score, pi.system_count
           FROM gs_entities ge
           LEFT JOIN mv_entity_power_index pi ON pi.id = ge.id
           WHERE ge.lga_name = '${esc(lga)}' ${typeFilter}
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
    const abnClean = q.replace(/\s/g, '');
    const isABN = !!validateAbn(abnClean);

    const query = isABN
      ? `SELECT ge.gs_id, ge.canonical_name, ge.abn, ge.entity_type, ge.sector,
                ge.state, ge.lga_name, ge.is_community_controlled,
                pi.power_score, pi.system_count
         FROM gs_entities ge
         LEFT JOIN mv_entity_power_index pi ON pi.id = ge.id
         WHERE ge.abn = '${esc(abnClean)}'
         LIMIT ${limit}`
      : `SELECT ge.gs_id, ge.canonical_name, ge.abn, ge.entity_type, ge.sector,
                ge.state, ge.lga_name, ge.is_community_controlled,
                pi.power_score, pi.system_count
         FROM gs_entities ge
         LEFT JOIN mv_entity_power_index pi ON pi.id = ge.id
         WHERE UPPER(ge.canonical_name) LIKE '%${esc(q.toUpperCase())}%' ${typeFilter}
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
