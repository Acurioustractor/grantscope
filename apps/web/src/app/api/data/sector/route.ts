import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/supabase';
import { safe, esc } from '@/lib/sql';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const limiter = rateLimit();

const schema = z.object({
  sector: z.string().min(1).max(100).optional(),
  type: z.string().max(50).optional(),
  state: z.string().max(10).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(request: Request) {
  const limited = limiter(request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });

  const { sector, type, state, limit = 50 } = parsed.data;

  try {
    const supabase = getServiceSupabase();

    // If no sector specified, return sector overview
    if (!sector) {
      const overview = await safe(supabase.rpc('exec_sql', {
        query: `SELECT sector, entity_type, COUNT(*)::int as entity_count,
                  COUNT(*) FILTER (WHERE is_community_controlled)::int as cc_count,
                  COUNT(DISTINCT state)::int as state_count
           FROM gs_entities
           WHERE sector IS NOT NULL
           GROUP BY sector, entity_type
           ORDER BY COUNT(*) DESC
           LIMIT 100`,
      }));

      // Aggregate by sector
      const sectorMap = new Map<string, { entities: number; cc: number; states: number; types: string[] }>();
      for (const r of (overview ?? []) as Array<{ sector: string; entity_type: string; entity_count: number; cc_count: number; state_count: number }>) {
        const existing = sectorMap.get(r.sector) || { entities: 0, cc: 0, states: 0, types: [] };
        existing.entities += r.entity_count;
        existing.cc += r.cc_count;
        existing.states = Math.max(existing.states, r.state_count);
        if (!existing.types.includes(r.entity_type)) existing.types.push(r.entity_type);
        sectorMap.set(r.sector, existing);
      }

      const sectors = [...sectorMap.entries()]
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.entities - a.entities);

      const response = NextResponse.json({ sectors });
      response.headers.set('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200');
      return response;
    }

    // Sector detail view
    const safeSector = esc(sector);
    const clauses: string[] = [`sector = '${safeSector}'`];
    if (type) clauses.push(`entity_type = '${esc(type)}'`);
    if (state) clauses.push(`UPPER(state) = '${esc(state.toUpperCase())}'`);
    const where = clauses.join(' AND ');

    const [entities, stats, byState, byType, topPowered] = await Promise.all([
      safe(supabase.rpc('exec_sql', {
        query: `SELECT ge.gs_id, ge.canonical_name, ge.abn, ge.entity_type, ge.state, ge.lga_name,
                  ge.is_community_controlled,
                  pi.power_score, pi.system_count, pi.total_dollar_flow
           FROM gs_entities ge
           LEFT JOIN mv_entity_power_index pi ON pi.id = ge.id
           WHERE ${where}
           ORDER BY pi.power_score DESC NULLS LAST
           LIMIT ${limit}`,
      })),
      safe(supabase.rpc('exec_sql', {
        query: `SELECT COUNT(*)::int as total,
                  COUNT(*) FILTER (WHERE is_community_controlled)::int as community_controlled,
                  COUNT(DISTINCT state)::int as states,
                  COUNT(DISTINCT lga_name)::int as lgas
           FROM gs_entities WHERE ${where}`,
      })),
      safe(supabase.rpc('exec_sql', {
        query: `SELECT UPPER(state) as state, COUNT(*)::int as count
           FROM gs_entities WHERE ${where} AND state IS NOT NULL
           GROUP BY UPPER(state) ORDER BY count DESC`,
      })),
      safe(supabase.rpc('exec_sql', {
        query: `SELECT entity_type, COUNT(*)::int as count
           FROM gs_entities WHERE ${where}
           GROUP BY entity_type ORDER BY count DESC`,
      })),
      safe(supabase.rpc('exec_sql', {
        query: `SELECT ge.gs_id, ge.canonical_name, ge.entity_type, ge.state,
                  pi.power_score, pi.system_count, pi.total_dollar_flow
           FROM gs_entities ge
           JOIN mv_entity_power_index pi ON pi.id = ge.id
           WHERE ${where} AND pi.power_score > 0
           ORDER BY pi.power_score DESC
           LIMIT 10`,
      })),
    ]);

    const response = NextResponse.json({
      sector,
      entities: entities ?? [],
      stats: (stats as Array<{ total: number; community_controlled: number; states: number; lgas: number }>)?.[0] ?? null,
      byState: byState ?? [],
      byType: byType ?? [],
      topPowered: topPowered ?? [],
    });
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (error) {
    console.error('Sector API error:', error);
    return NextResponse.json({ error: 'Failed to fetch sector data' }, { status: 500 });
  }
}
