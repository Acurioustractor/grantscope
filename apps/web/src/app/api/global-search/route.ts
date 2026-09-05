import { NextResponse, type NextRequest } from 'next/server';
import { parseSearchQuery, searchIndex, type SearchHit } from '@/lib/search/search-index';

export const dynamic = 'force-dynamic';

/**
 * /api/global-search — the live lanes behind the header search and the /search page.
 *
 * Until 2026-09-05 this ran five separate lanes (entities, grants, foundations, people via ILIKE on
 * mv_board_interlocks, places via postcode_geo), each with its own statement-timeout risk. It now makes ONE call to
 * search_index_query over mv_search_index and sorts the hits into the five shapes the client already renders, so the
 * page did not change. Council-area rows (kind "place") have no lane in this client yet and are left out here;
 * /api/search/index serves every kind.
 *
 * scope=full is the /search page (every lane). Any other scope is the header box: entities and grants only.
 */
const ENTITY_KINDS = new Set(['charity', 'company', 'indigenous_corp', 'government_body', 'program', 'social_enterprise', 'intervention']);
const LANE_CAP = 8;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const fullScope = sp.get('scope') === 'full';
  const query = parseSearchQuery({ q: sp.get('q'), state: sp.get('state'), limit: '60' });
  if (!query) return NextResponse.json({ entities: [], foundations: [], grants: [], people: [], places: [] });

  let hits: SearchHit[];
  try {
    hits = await searchIndex(query);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const take = (pred: (h: SearchHit) => boolean) => hits.filter(pred).slice(0, LANE_CAP);

  const entities = take((h) => ENTITY_KINDS.has(h.kind)).map((h) => ({
    id: h.id,
    name: h.name,
    entityType: h.kind.replace(/_/g, ' '),
    abn: h.abn,
    state: h.state,
    sourceCount: h.source_count ?? 0,
    revenue: h.money_in,
    href: h.href ?? `/entity/${encodeURIComponent(h.id)}`,
  }));
  const grants = take((h) => h.kind === 'grant_round').map((h) => ({
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

  const foundations = take((h) => h.kind === 'foundation').map((h) => ({
    id: h.id,
    name: h.name,
    abn: h.abn,
    totalGiving: h.money_out,
    focus: h.sector ? h.sector.split(', ').filter(Boolean) : null,
    href: h.href ?? `/foundations/${h.id}`,
  }));
  const people = take((h) => h.kind === 'person').map((h) => ({
    name: h.name,
    boardCount: h.source_count ?? 0,
    href: h.href ?? `/person/${encodeURIComponent(h.name)}`,
  }));
  const places = take((h) => h.kind === 'postcode').map((h) => ({
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
