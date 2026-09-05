import { NextResponse, type NextRequest } from 'next/server';
import { parseSearchQuery, searchIndex, type SearchHit, type SearchKind } from '@/lib/search/search-index';

export const dynamic = 'force-dynamic';

/**
 * /api/global-search — the live lanes behind the header box and the /search page.
 *
 * Until 2026-09-05 this ran five hand-written lanes (entity select, grants, foundations, an ILIKE over
 * mv_board_interlocks, postcode_geo), each with its own statement-timeout risk. It now runs one query per lane against
 * mv_search_index through search_index_query, in parallel.
 *
 * ONE call for all lanes was tried first and starves them: a globally ranked top-60 for "alice springs" is 60 companies
 * with "Alice Springs" in the name, so the grants, foundations, people and places lanes came back empty. Each lane needs
 * its own top-N. Six calls at ~170 ms each, issued together, cost about one call.
 */
const LANES: Record<'entities' | 'grants' | 'foundations' | 'people' | 'places', SearchKind[]> = {
  entities: ['charity', 'company', 'indigenous_corp', 'government_body', 'program', 'social_enterprise', 'intervention'],
  grants: ['grant_round'],
  foundations: ['foundation'],
  people: ['person'],
  places: ['postcode'],
};
const LANE_CAP = 8;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const fullScope = sp.get('scope') === 'full';
  const base = parseSearchQuery({ q: sp.get('q'), state: sp.get('state'), limit: String(LANE_CAP) });
  if (!base) return NextResponse.json({ entities: [], foundations: [], grants: [], people: [], places: [] });

  const wanted = fullScope ? (Object.keys(LANES) as (keyof typeof LANES)[]) : (['entities', 'grants'] as const);
  let results: SearchHit[][];
  try {
    results = await Promise.all(wanted.map((lane) => searchIndex({ ...base, kinds: LANES[lane] })));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  const byLane = Object.fromEntries(wanted.map((lane, i) => [lane, results[i]])) as Record<string, SearchHit[]>;
  const lane = (name: string) => byLane[name] ?? [];

  const entities = lane('entities').map((h) => ({
    id: h.id,
    name: h.name,
    entityType: h.kind.replace(/_/g, ' '),
    abn: h.abn,
    state: h.state,
    sourceCount: h.source_count ?? 0,
    revenue: h.money_in,
    href: h.href ?? `/entity/${encodeURIComponent(h.id)}`,
  }));
  const grants = lane('grants').map((h) => ({
    id: h.id,
    name: h.name,
    amountMin: h.amount_min,
    amountMax: h.money_in,
    closesAt: h.closes_at,
    programType: h.sector,
    source: h.meta,
    href: h.href ?? `/grants/${h.id}`,
  }));
  if (!fullScope) return NextResponse.json({ entities, grants });

  const foundations = lane('foundations').map((h) => ({
    id: h.id,
    name: h.name,
    abn: h.abn,
    totalGiving: h.money_out,
    focus: h.sector ? h.sector.split(', ').filter(Boolean) : null,
    href: h.href ?? `/foundations/${h.id}`,
  }));
  const people = lane('people').map((h) => ({
    name: h.name,
    boardCount: h.source_count ?? 0,
    href: h.href ?? `/person/${encodeURIComponent(h.name)}`,
  }));
  const places = lane('places').map((h) => ({
    postcode: h.postcode ?? '',
    locality: h.place,
    state: h.state,
    lga: null as string | null,
    href: h.href ?? `/places/${h.postcode}`,
  }));

  return NextResponse.json(
    { entities, foundations, grants, people, places },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } },
  );
}
