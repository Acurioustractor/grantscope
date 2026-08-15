import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getDirectServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
// Each probe is capped at 8s and a batch is 25, so the worst case is well past
// the default serverless budget. The batch size is the real bound; this raises
// the route's ceiling to match it rather than truncating a batch mid-sweep.
export const maxDuration = 300;

/**
 * POST /api/clarity/seams/measure — measure the next batch of unmeasured seams.
 *
 * Batched on purpose. There is no "measure everything" call anywhere in this
 * feature: 638 joins, some of them 2.5M rows against 609K, swept in one
 * statement on a pooler that has starved before is how you take the database
 * down. Small batches, each probe under its own timeout, timeouts recorded as
 * timeouts rather than as zeroes.
 */
export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  let limit = 25;
  try {
    const body = (await request.json()) as { limit?: unknown };
    if (typeof body.limit === 'number' && Number.isInteger(body.limit)) {
      limit = Math.min(Math.max(body.limit, 1), 50);
    }
  } catch {
    // An empty body is fine — the default batch is the point.
  }

  const supabase = getDirectServiceSupabase();
  const { data, error } = await supabase.rpc('clarity_measure_seams', {
    p_limit: limit,
    p_only_unmeasured: true,
    p_timeout_ms: 8000,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as { out_rate: number | null; out_method: string | null }[];
  const refused = rows.filter((r) => r.out_method && /^(timeout|error)/.test(r.out_method)).length;

  return NextResponse.json({
    measured: rows.length,
    refused,
    dead: rows.filter((r) => r.out_rate !== null && Number(r.out_rate) === 0).length,
  });
}
