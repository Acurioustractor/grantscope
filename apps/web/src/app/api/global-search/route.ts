import { getServiceSupabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import * as EntityService from '@/lib/services/entity-service';
import * as GrantService from '@/lib/services/grant-service';
import * as FoundationService from '@/lib/services/foundation-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {

  const q = req.nextUrl.searchParams.get('q')?.trim();
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 20), 50);

  if (!q || q.length < 2) {
    return NextResponse.json({ entities: [], grants: [] });
  }

  const db = getServiceSupabase();

  // Parallel search across entities, grants, and foundations
  const [entityResults, grantResults, foundationResults] = await Promise.all([
    EntityService.search(db, q, Math.min(limit, 10)),
    GrantService.search(db, q, 5),
    FoundationService.search(db, q, 5),
  ]);

  // Enrich entities with relationship counts from MV
  const entityIds = entityResults.data.map(e => e.id);
  let statsMap = new Map<string, { total_relationships: number; type_breakdown: Record<string, { count: number; amount: number }> }>();
  if (entityIds.length > 0) {
    const { data: statsData } = await db
      .from('mv_gs_entity_stats')
      .select('id, total_relationships, type_breakdown')
      .in('id', entityIds);
    for (const s of statsData || []) {
      statsMap.set(s.id, { total_relationships: s.total_relationships, type_breakdown: s.type_breakdown || {} });
    }
  }

  const entities = (entityResults.data).map((e, i) => {
    const st = statsMap.get(e.id);
    const tb = st?.type_breakdown || {};
    const systems: string[] = [];
    if ((tb['contract:inbound']?.count ?? 0) > 0 || (tb['contract:outbound']?.count ?? 0) > 0) systems.push('procurement');
    if ((tb['grant:inbound']?.count ?? 0) > 0) systems.push('grants');
    if ((tb['donation:outbound']?.count ?? 0) > 0) systems.push('donations');
    const rels = st?.total_relationships ?? 0;
    return {
      type: 'entity' as const,
      id: e.gs_id,
      name: e.canonical_name,
      entityType: e.entity_type,
      abn: e.abn,
      state: e.state,
      sourceCount: e.source_count,
      revenue: e.latest_revenue,
      relationships: rels,
      systems,
      href: `/entities/${e.gs_id}`,
      // Blend fuzzy rank with relationship weight for relevance
      _score: (entityResults.data.length - i) + Math.min(Math.log10(rels + 1) * 3, 15),
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
