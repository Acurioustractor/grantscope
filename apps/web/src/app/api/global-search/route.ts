import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import * as EntityService from '@/lib/services/entity-service';
import * as GrantService from '@/lib/services/grant-service';
import * as FoundationService from '@/lib/services/foundation-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireModule('research');
  if (auth.error) return auth.error;

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

  const entities = (entityResults.data).map(e => ({
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
