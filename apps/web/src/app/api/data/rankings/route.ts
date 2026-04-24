import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/supabase';
import { esc, whitelist } from '@/lib/sql';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const limiter = rateLimit();

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const;
const SORTS = [
  'score_composite', 'revenue', 'cagr', 'fte', 'volunteers',
  'vol_fte_ratio', 'rev_per_fte', 'network_connections', 'expenses', 'assets',
  'score_revenue', 'score_growth', 'score_leverage', 'score_efficiency', 'score_network', 'score_health',
] as const;
const SIZES = ['Small', 'Medium', 'Large'] as const;

const schema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  sort: z.string().optional(),
  state: z.string().optional(),
  size: z.string().optional(),
  type: z.string().max(50).optional(),
  cc: z.string().optional(),
  q: z.string().max(100).optional(),
  abn: z.string().max(11).optional(),
});

export async function GET(request: Request) {
  const limited = limiter(request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });

  const { limit, offset, type, cc, q, abn } = parsed.data;
  const safeSort = whitelist(parsed.data.sort ?? null, SORTS, 'score_composite');
  const safeState = whitelist(parsed.data.state?.toUpperCase() ?? null, STATES, null as unknown as typeof STATES[number]);
  const safeSize = whitelist(parsed.data.size ?? null, SIZES, null as unknown as typeof SIZES[number]);

  try {
    const supabase = getServiceSupabase();
    const conditions: string[] = [];

    if (safeState) conditions.push(`state = '${safeState}'`);
    if (safeSize) conditions.push(`charity_size = '${safeSize}'`);
    if (type) conditions.push(`entity_type = '${esc(type)}'`);
    if (cc === 'true') conditions.push(`is_community_controlled = true`);
    if (q) conditions.push(`name ILIKE '%${esc(q)}%'`);

    // Single-entity lookup by ABN
    if (abn) {
      const { data, error } = await supabase.rpc('exec_sql', {
        query: `SELECT * FROM mv_charity_rankings WHERE abn = '${esc(abn)}' LIMIT 1`,
      });
      if (error) throw error;
      return NextResponse.json({ result: (data as unknown[])?.[0] ?? null });
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortDir = ['cagr'].includes(safeSort) ? 'DESC NULLS LAST' : 'DESC NULLS LAST';

    const [{ data, error }, { data: countData, error: countErr }] = await Promise.all([
      supabase.rpc('exec_sql', {
        query: `SELECT abn, name, gs_id, entity_type, sector, state, charity_size,
                  is_community_controlled,
                  revenue::bigint, expenses::bigint, assets::bigint,
                  fte, volunteers, vol_fte_ratio::numeric(10,1), rev_per_fte::bigint,
                  cagr::numeric(10,1), network_connections,
                  score_composite, score_revenue::numeric(10,1), score_growth::numeric(10,1),
                  score_leverage::numeric(10,1), score_efficiency::numeric(10,1),
                  score_network::numeric(10,1), score_health::numeric(10,1),
                  rank_composite, rank_revenue, rank_growth, total_ranked
           FROM mv_charity_rankings
           ${whereClause}
           ORDER BY ${safeSort} ${sortDir}
           LIMIT ${limit} OFFSET ${offset}`,
      }),
      supabase.rpc('exec_sql', {
        query: `SELECT COUNT(*)::int as total FROM mv_charity_rankings ${whereClause}`,
      }),
    ]);

    if (error) throw error;
    if (countErr) throw countErr;

    const total = (countData as Array<{ total: number }>)?.[0]?.total ?? 0;

    const response = NextResponse.json({ results: data || [], total, limit, offset });
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (error) {
    console.error('Rankings error:', error);
    return NextResponse.json({ error: 'Failed to fetch rankings' }, { status: 500 });
  }
}
