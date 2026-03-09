import { getServiceSupabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 20), 50);

  if (!q || q.length < 2) {
    return NextResponse.json({ entities: [], grants: [] });
  }

  const supabase = getServiceSupabase();
  const escapedQ = q.replace(/[%_]/g, '');

  // Parallel search across entities, grants, and foundations
  const [entitiesRes, grantsRes, foundationsRes] = await Promise.all([
    supabase
      .from('gs_entities')
      .select('gs_id, canonical_name, entity_type, abn, state, source_count, latest_revenue')
      .or(`canonical_name.ilike.%${escapedQ}%,abn.eq.${escapedQ}`)
      .order('source_count', { ascending: false })
      .limit(Math.min(limit, 10)),
    supabase
      .from('grant_opportunities')
      .select('id, name, amount_min, amount_max, closes_at, program_type, source')
      .ilike('name', `%${escapedQ}%`)
      .limit(5),
    supabase
      .from('foundations')
      .select('id, name, acnc_abn, type, total_giving_annual, thematic_focus, geographic_focus')
      .ilike('name', `%${escapedQ}%`)
      .limit(5),
  ]);

  const entities = (entitiesRes.data || []).map(e => ({
    type: 'entity' as const,
    id: e.gs_id,
    name: e.canonical_name,
    entityType: e.entity_type,
    abn: e.abn,
    state: e.state,
    sourceCount: e.source_count,
    revenue: e.latest_revenue,
    href: `/entities/${e.gs_id}`,
  }));

  // Filter out foundations already represented in entities (by ABN match)
  const entityAbns = new Set(entities.map(e => e.abn).filter(Boolean));
  const foundations = (foundationsRes.data || [])
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

  const grants = (grantsRes.data || []).map(g => ({
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
