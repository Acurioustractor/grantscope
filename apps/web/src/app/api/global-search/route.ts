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

  if (!q || q.length < 2) {
    return NextResponse.json({ entities: [], grants: [] });
  }

  const db = getServiceSupabase();

  // Entity lookup is the homepage typeahead's fast path. Broad ILIKE scans over
  // grants/foundations can hit database statement timeouts, so only search those
  // lanes when the wording suggests a funding query.
  const entityResults = await EntityService.search(db, q, Math.min(limit, 10));
  const shouldSearchFunding = FUNDING_SEARCH_TERMS.test(q);
  const [grantResults, foundationResults] = shouldSearchFunding
    ? await Promise.all([
        GrantService.search(db, q, 5),
        FoundationService.search(db, q, 5),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];

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

  return NextResponse.json({ entities, foundations, grants });
}
