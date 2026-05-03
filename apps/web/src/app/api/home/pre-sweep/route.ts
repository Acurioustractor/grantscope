import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import { classifyReviewSweep, type ReviewSweepGrantRow } from '@/lib/review-pre-sweep';
import { getServiceSupabase } from '@/lib/supabase';
import { createSupabaseServer } from '@/lib/supabase-server';

const PRE_SWEEP_FLAG_PATH = '/private/tmp/grantscope-home-pre-sweep-once.json';

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { applyExpired?: boolean };
  const applyExpired = body.applyExpired !== false;
  const db = getServiceSupabase();

  const [
    { data: rows, error: rowsError },
    { count: onlineFrontier, error: frontierError },
  ] = await Promise.all([
    db.from('saved_grants')
      .select('id, stage, grant:grant_opportunities(id, name, provider, amount_min, amount_max, closes_at, categories, url, updated_at, focus_areas, description, source, fit_score, relevance_score)')
      .eq('user_id', user.id)
      .eq('stage', 'discovered'),
    db.from('source_frontier')
      .select('id', { count: 'exact', head: true })
      .eq('enabled', true)
      .lte('next_check_at', new Date().toISOString()),
  ]);

  if (rowsError) return NextResponse.json({ error: rowsError.message }, { status: 500 });
  if (frontierError) return NextResponse.json({ error: frontierError.message }, { status: 500 });

  const sweepRows = (rows || []) as unknown as ReviewSweepGrantRow[];
  const sweepBefore = classifyReviewSweep(sweepRows, {
    onlineFrontier: onlineFrontier || 0,
  });

  let expiredUpdated = 0;
  if (applyExpired && sweepBefore.expiredIds.length > 0) {
    const { data: updatedRows, error: updateError } = await db
      .from('saved_grants')
      .update({ stage: 'expired', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .in('id', sweepBefore.expiredIds)
      .select('id');

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    expiredUpdated = updatedRows?.length || 0;
  }

  const remainingRows = applyExpired && sweepBefore.expiredIds.length > 0
    ? sweepRows.filter((row) => !sweepBefore.expiredIds.includes(row.id))
    : sweepRows;
  const sweepAfter = classifyReviewSweep(remainingRows, {
    onlineFrontier: onlineFrontier || 0,
  });
  const machinePassAfter = new Set(sweepAfter.machinePassIds);
  const humanReadyTop5 = remainingRows
    .filter((row) => row.grant && row.stage === 'discovered' && !machinePassAfter.has(row.id))
    .sort((a, b) => {
      const aDeadline = a.grant?.closes_at ? new Date(a.grant.closes_at).getTime() : Number.POSITIVE_INFINITY;
      const bDeadline = b.grant?.closes_at ? new Date(b.grant.closes_at).getTime() : Number.POSITIVE_INFINITY;
      if (aDeadline !== bDeadline) return aDeadline - bDeadline;
      const aScore = Math.max(a.grant?.fit_score || 0, a.grant?.relevance_score || 0);
      const bScore = Math.max(b.grant?.fit_score || 0, b.grant?.relevance_score || 0);
      return bScore - aScore;
    })
    .slice(0, 5)
    .map((row) => ({
      savedGrantId: row.id,
      grantId: row.grant!.id,
      name: row.grant!.name,
      provider: row.grant!.provider,
      amountMin: row.grant!.amount_min ?? null,
      amountMax: row.grant!.amount_max ?? null,
      closesAt: row.grant!.closes_at,
      categories: row.grant!.categories || [],
      url: row.grant!.url,
      fitScore: row.grant!.fit_score ?? null,
      relevanceScore: row.grant!.relevance_score ?? null,
    }));

  await unlink(PRE_SWEEP_FLAG_PATH).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    applied: {
      expiredUpdated,
      staleUpdated: 0,
      missingUrlUpdated: 0,
      noDeadlineUpdated: 0,
    },
    before: {
      total: sweepBefore.total,
      machinePass: sweepBefore.machinePass,
      humanReady: sweepBefore.humanReady,
      expired: sweepBefore.expired,
      stale: sweepBefore.stale,
      missingUrl: sweepBefore.missingUrl,
      noDeadline: sweepBefore.noDeadline,
      wikiCandidates: sweepBefore.wikiCandidates,
      onlineFrontier: sweepBefore.onlineFrontier,
    },
    sweep: {
      total: sweepAfter.total,
      machinePass: sweepAfter.machinePass,
      humanReady: sweepAfter.humanReady,
      expired: sweepAfter.expired,
      stale: sweepAfter.stale,
      missingUrl: sweepAfter.missingUrl,
      noDeadline: sweepAfter.noDeadline,
      wikiCandidates: sweepAfter.wikiCandidates,
      onlineFrontier: sweepAfter.onlineFrontier,
    },
    decisionBatch: {
      humanReadyTop5,
    },
    nextSteps: [
      'Review stale, missing-url, and no-deadline items as source-refresh work before human triage.',
      'Use Wiki enrich to attach Goods, JusticeHub, and Empathy Ledger context before deciding pursue/no-go.',
      'Use Online scout to refresh priority source pages and funder sites before promoting new work.',
    ],
  });
}
