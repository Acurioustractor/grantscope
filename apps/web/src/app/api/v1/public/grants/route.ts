import { NextResponse } from 'next/server';
import { getDirectServiceSupabase } from '@/lib/supabase';
import { rateLimit, ipFromRequest, rateLimitHeaders } from '@/lib/atlas/rate-limit';

export const runtime = 'nodejs';
export const revalidate = 600;

export async function GET(req: Request) {
  const rl = rateLimit(ipFromRequest(req));
  if (!rl.ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  const url = new URL(req.url);
  const limit = clampInt(url.searchParams.get('limit'), 25, 1, 200);
  const offset = clampInt(url.searchParams.get('offset'), 0, 0, 50000);
  const category = url.searchParams.get('category');
  const minAmount = url.searchParams.get('min_amount');
  const dgr = url.searchParams.get('dgr_required');

  const supabase = getDirectServiceSupabase();
  let q = supabase
    .from('grant_opportunities')
    .select('id,name,provider,program,description,amount_min,amount_max,deadline,url,categories,focus_areas,dgr_required,accepts_sole_trader,accepts_pty_ltd,accepts_charity,status,closes_at,geography', { count: 'exact' })
    .or('status.is.null,status.eq.open')
    .order('deadline', { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (category) q = q.contains('categories', [category]);
  if (minAmount) q = q.gte('amount_max', Number(minAmount));
  if (dgr === 'true') q = q.eq('dgr_required', true);
  if (dgr === 'false') q = q.eq('dgr_required', false);

  const { data, error, count } = await q;
  if (error) {
    return NextResponse.json({ error: 'query_failed', message: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      meta: {
        source: 'grant_opportunities',
        generated_at: new Date().toISOString(),
        total: count ?? null,
        limit,
        offset,
        filters: { category, min_amount: minAmount, dgr_required: dgr },
        license: 'CC-BY 4.0',
      },
      data: data ?? [],
    },
    { headers: rateLimitHeaders(rl) }
  );
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  if (!raw) return fallback;
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
