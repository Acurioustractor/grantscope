import { getServiceSupabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import * as EntityService from '@/lib/services/entity-service';
import * as GrantService from '@/lib/services/grant-service';
import * as FoundationService from '@/lib/services/foundation-service';

export const dynamic = 'force-dynamic';

const FUNDING_SEARCH_TERMS =
  /\b(grant|grants|fund|funding|foundation|foundations|program|programs|fellowship|fellowships|award|awards|scholarship|scholarships|philanthropy|philanthropic)\b/i;

export async function GET(req: NextRequest) {

  const q = req.nextUrl.searchParams.get('q')?.trim();
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 20), 50);
  // scope=full is the /search page: every live lane runs, no wording heuristics.
  // The default (typeahead) path keeps its fast-path gating.
  const fullScope = req.nextUrl.searchParams.get('scope') === 'full';

  if (!q || q.length < 2) {
    return NextResponse.json({ entities: [], grants: [] });
  }

  const db = getServiceSupabase();

  // Entity lookup is the homepage typeahead's fast path. Broad ILIKE scans over
  // grants/foundations can hit database statement timeouts, so only search those
  // lanes when the wording suggests a funding query.
  const entityResults = await EntityService.search(db, q, Math.min(limit, 10));
  const shouldSearchFunding = fullScope || FUNDING_SEARCH_TERMS.test(q);
  const [grantResults, foundationResults, peopleResults, placeResults] = await Promise.all([
    shouldSearchFunding ? GrantService.search(db, q, 5) : Promise.resolve({ data: [], error: null }),
    shouldSearchFunding ? FoundationService.search(db, q, 5) : Promise.resolve({ data: [], error: null }),
    fullScope ? searchPeople(db, q) : Promise.resolve([]),
    fullScope ? searchPlaces(db, q) : Promise.resolve([]),
  ]);

  const entities = (entityResults.data).map((e, i) => {
    const sourceWeight = Math.min(e.source_count ?? 0, 5);
    return {
      type: 'entity' as const,
      id: e.gs_id,
      name: e.canonical_name,
      entityType: e.entity_type,
      abn: e.abn,
      state: e.state,
      sourceCount: e.source_count,
      revenue: e.latest_revenue,
      relationships: 0,
      systems: [] as string[],
      href: `/entities/${e.gs_id}`,
      // Keep the typeahead response lean; detail pages can load relationship stats.
      _score: (entityResults.data.length - i) + sourceWeight,
    };
  });

  // Re-sort: boost entities with more cross-system data to the top
  entities.sort((a, b) => b._score - a._score);

  // Filter out foundations already represented in entities (by ABN match)
  const entityAbns = new Set(entities.map(e => e.abn).filter(Boolean));
  const foundations = (foundationResults.data)
    .filter(f => !entityAbns.has(f.acnc_abn))
    .map(f => ({
      type: 'foundation' as const,
      id: f.id,
      name: f.name,
      foundationType: f.type,
      abn: f.acnc_abn,
      totalGiving: f.total_giving_annual,
      focus: f.thematic_focus,
      href: `/foundations/${f.id}`,
    }));

  const grants = (grantResults.data).map(g => ({
    type: 'grant' as const,
    id: g.id,
    name: g.name,
    amountMin: g.amount_min,
    amountMax: g.amount_max,
    closesAt: g.closes_at,
    programType: g.program_type,
    source: g.source,
    href: `/grants/${g.id}`,
  }));

  return NextResponse.json({ entities, foundations, grants, people: peopleResults, places: placeResults });
}

type Db = ReturnType<typeof getServiceSupabase>;

async function searchPeople(db: Db, q: string) {
  const { data } = await db
    .from('mv_board_interlocks')
    .select('person_name_display, board_count, interlock_score')
    .ilike('person_name_display', `%${q}%`)
    .order('interlock_score', { ascending: false, nullsFirst: false })
    .limit(5);
  return (data ?? []).map(p => ({
    type: 'person' as const,
    name: p.person_name_display,
    boardCount: p.board_count,
    // /person/[name] decodes dashes back to spaces before normalising.
    href: `/person/${encodeURIComponent(p.person_name_display.replace(/\s+/g, '-'))}`,
  }));
}

async function searchPlaces(db: Db, q: string) {
  const isPostcode = /^\d{2,4}$/.test(q);
  let query = db.from('postcode_geo').select('postcode, locality, state, lga_name').limit(24);
  query = isPostcode ? query.like('postcode', `${q}%`) : query.ilike('locality', `%${q}%`);
  const { data } = await query;
  // postcode_geo is one row per locality; a place result is a postcode. Some rows carry a
  // junk locality equal to the postcode itself — prefer a real name when one exists.
  const byPostcode = new Map<string, { postcode: string; locality: string | null; state: string | null; lga: string | null }>();
  for (const row of data ?? []) {
    const locality = row.locality && row.locality !== row.postcode ? row.locality : null;
    const existing = byPostcode.get(row.postcode);
    if (!existing || (!existing.locality && locality)) {
      byPostcode.set(row.postcode, { postcode: row.postcode, locality, state: row.state, lga: row.lga_name });
    }
  }
  return Array.from(byPostcode.values()).slice(0, 5).map(p => ({
    type: 'place' as const,
    ...p,
    href: `/places/${p.postcode}`,
  }));
}
