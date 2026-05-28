import { NextResponse } from 'next/server';
import { listFundingDeserts, getFundingDesertByLga } from '@/lib/atlas/funding-deserts';
import { rateLimit, ipFromRequest, rateLimitHeaders } from '@/lib/atlas/rate-limit';
import { logAuditEvent } from '@/lib/atlas/provenance';

export const runtime = 'nodejs';
export const revalidate = 600;

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

export async function GET(req: Request) {
  const rl = rateLimit(ipFromRequest(req));
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Limit 60 req/min. Contact us for an API key.' },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const url = new URL(req.url);
  const lga = url.searchParams.get('lga');
  const state = url.searchParams.get('state');

  const ip = ipFromRequest(req);
  const ua = req.headers.get('user-agent');
  logAuditEvent({
    surface: 'api/funding-deserts',
    event_type: 'api_call',
    resource_id: lga ?? null,
    query: Object.fromEntries(url.searchParams.entries()),
    actor_ip: ip,
    user_agent: ua,
  });

  const remoteness = url.searchParams.get('remoteness');
  const minDecile = url.searchParams.get('min_decile');
  const maxDecile = url.searchParams.get('max_decile');
  const sortRaw = url.searchParams.get('sort');
  const limitRaw = url.searchParams.get('limit');
  const offsetRaw = url.searchParams.get('offset');

  // Single-LGA fetch shortcut
  if (lga) {
    const row = await getFundingDesertByLga(lga, state);
    return NextResponse.json(
      {
        meta: { source: 'mv_funding_deserts', generated_at: new Date().toISOString() },
        data: row,
      },
      { headers: rateLimitHeaders(rl) }
    );
  }

  const stateFilter = state && STATES.includes(state) ? state : null;
  const sort = (['desert_score', 'total_funding', 'indexed_entities'].includes(sortRaw ?? '')
    ? (sortRaw as 'desert_score' | 'total_funding' | 'indexed_entities')
    : 'desert_score');
  const limit = clampInt(limitRaw, 25, 1, 500);
  const offset = clampInt(offsetRaw, 0, 0, 5000);

  const { rows, totalLgas } = await listFundingDeserts({
    limit,
    offset,
    state: stateFilter,
    remoteness: remoteness ?? null,
    minDecile: minDecile ? Number(minDecile) : null,
    maxDecile: maxDecile ? Number(maxDecile) : null,
    sort,
    order: sort === 'total_funding' ? 'asc' : 'desc',
  });

  return NextResponse.json(
    {
      meta: {
        source: 'mv_funding_deserts',
        generated_at: new Date().toISOString(),
        total: totalLgas,
        limit,
        offset,
        sort,
        filters: { state: stateFilter, remoteness, min_decile: minDecile, max_decile: maxDecile },
        methodology: 'https://civicgraph.au/atlas/funding-deserts/methodology',
        license: 'CC-BY 4.0',
      },
      data: rows,
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
