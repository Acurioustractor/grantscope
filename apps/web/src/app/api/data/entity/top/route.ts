import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/supabase';
import { esc, whitelist } from '@/lib/sql';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const limiter = rateLimit();

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const;
const SORTS = ['power_score', 'total_dollar_flow', 'system_count', 'procurement_dollars', 'justice_dollars', 'donation_dollars'] as const;
const SYSTEMS = ['procurement', 'justice', 'donations', 'charity', 'foundation', 'alma', 'ato'] as const;

const schema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
  system: z.string().optional(),
  type: z.string().max(50).optional(),
  state: z.string().optional(),
  cc: z.string().optional(),
  min_systems: z.coerce.number().int().min(1).max(7).optional().default(1),
  sort: z.string().optional(),
});

export async function GET(request: Request) {
  const limited = limiter(request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });

  const { limit, offset, type, cc, min_systems } = parsed.data;
  const safeState = whitelist(parsed.data.state?.toUpperCase() ?? null, STATES, null as unknown as typeof STATES[number]);
  const safeSort = whitelist(parsed.data.sort ?? null, SORTS, 'power_score');
  const safeSystem = whitelist(parsed.data.system ?? null, SYSTEMS, null as unknown as typeof SYSTEMS[number]);

  try {
    const supabase = getServiceSupabase();
    const conditions: string[] = [`system_count >= ${min_systems}`];

    if (safeSystem) {
      const systemCol: Record<string, string> = {
        procurement: 'in_procurement',
        justice: 'in_justice_funding',
        donations: 'in_political_donations',
        charity: 'in_charity_registry',
        foundation: 'in_foundation',
        alma: 'in_alma_evidence',
        ato: 'in_ato_transparency',
      };
      const col = systemCol[safeSystem];
      if (col) conditions.push(`${col} > 0`);
    }

    if (type) conditions.push(`entity_type = '${esc(type)}'`);
    if (safeState) conditions.push(`UPPER(state) = '${safeState}'`);
    if (cc === 'true') conditions.push(`is_community_controlled = true`);

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
         ORDER BY ${safeSort} DESC NULLS LAST
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
