import { NextResponse } from 'next/server';
import { listRevolvingDoor } from '@/lib/atlas/revolving-door';
import { rateLimit, ipFromRequest, rateLimitHeaders } from '@/lib/atlas/rate-limit';
import { logAuditEvent } from '@/lib/atlas/provenance';

export const runtime = 'nodejs';
export const revalidate = 600;

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];
const VECTORS = ['lobbies', 'donates', 'contracts', 'receives_funding'];

export async function GET(req: Request) {
  const rl = rateLimit(ipFromRequest(req));
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Limit 60 req/min.' },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const url = new URL(req.url);
  const state = url.searchParams.get('state');
  const vector = url.searchParams.get('vector');
  const minVectors = url.searchParams.get('min_vectors');
  const limitRaw = url.searchParams.get('limit');
  const offsetRaw = url.searchParams.get('offset');

  const stateFilter = state && STATES.includes(state) ? state : null;
  const vectorFilter = (vector && VECTORS.includes(vector) ? vector : null) as
    | 'lobbies' | 'donates' | 'contracts' | 'receives_funding' | null;
  const limit = clampInt(limitRaw, 25, 1, 500);
  const offset = clampInt(offsetRaw, 0, 0, 10000);
  const minV = minVectors ? Math.max(2, Math.min(4, Number(minVectors) || 2)) : null;

  logAuditEvent({
    surface: 'api/revolving-door',
    event_type: 'api_call',
    query: Object.fromEntries(url.searchParams.entries()),
    actor_ip: ipFromRequest(req),
    user_agent: req.headers.get('user-agent'),
  });

  const rows = await listRevolvingDoor({ limit, offset, state: stateFilter, vector: vectorFilter, minVectors: minV });

  return NextResponse.json(
    {
      meta: {
        source: 'mv_revolving_door',
        generated_at: new Date().toISOString(),
        limit,
        offset,
        filters: { state: stateFilter, vector: vectorFilter, min_vectors: minV },
        methodology: 'https://civicgraph.au/atlas/revolving-door/methodology',
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
