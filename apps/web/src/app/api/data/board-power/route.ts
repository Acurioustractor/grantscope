import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/supabase';
import { esc, whitelist } from '@/lib/sql';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const limiter = rateLimit();

const SORTS = ['board_seats', 'total_org_revenue', 'total_org_assets', 'total_org_fte'] as const;

const schema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  sort: z.string().optional(),
  min_seats: z.coerce.number().int().min(2).max(100).optional().default(2),
  q: z.string().max(100).optional(),
});

export async function GET(request: Request) {
  const limited = limiter(request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });

  const { limit, offset, min_seats, q } = parsed.data;
  const safeSort = whitelist(parsed.data.sort ?? null, SORTS, 'board_seats');

  try {
    const supabase = getServiceSupabase();
    const conditions: string[] = [`board_seats >= ${min_seats}`];

    if (q) conditions.push(`person_name ILIKE '%${esc(q)}%'`);

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const [{ data, error }, { data: countData, error: countErr }] = await Promise.all([
      supabase.rpc('exec_sql', {
        query: `SELECT person_name, board_seats,
                  total_org_revenue::bigint, total_org_assets::bigint, total_org_fte::numeric(10,1),
                  organizations[1:5] as top_organizations,
                  array_length(organizations, 1) as org_count,
                  sectors, states
           FROM mv_board_power
           ${whereClause}
           ORDER BY ${safeSort} DESC NULLS LAST
           LIMIT ${limit} OFFSET ${offset}`,
      }),
      supabase.rpc('exec_sql', {
        query: `SELECT COUNT(*)::int as total FROM mv_board_power ${whereClause}`,
      }),
    ]);

    if (error) throw error;
    if (countErr) throw countErr;

    const total = (countData as Array<{ total: number }>)?.[0]?.total ?? 0;

    const response = NextResponse.json({ results: data || [], total, limit, offset });
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (error) {
    console.error('Board power error:', error);
    return NextResponse.json({ error: 'Failed to fetch board power data' }, { status: 500 });
  }
}
