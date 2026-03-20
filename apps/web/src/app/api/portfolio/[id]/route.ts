import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { getImpersonateSlug } from '@/lib/org-profile';

/** GET /api/portfolio/[id] — full portfolio with entity details + aggregate stats */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireModule('allocation');
  if (auth.error) return auth.error;

  const { id } = await params;
  const db = getServiceSupabase();

  // Check impersonation
  const impersonateSlug = await getImpersonateSlug();
  let effectiveUserId = auth.user.id;
  if (impersonateSlug) {
    const { data: impOrg } = await db
      .from('org_profiles')
      .select('user_id')
      .eq('slug', impersonateSlug)
      .maybeSingle();
    if (impOrg?.user_id) effectiveUserId = impOrg.user_id;
  }

  // Verify ownership
  const { data: portfolio } = await db
    .from('funder_portfolios')
    .select('id, name, description, created_at, updated_at')
    .eq('id', id)
    .eq('user_id', effectiveUserId)
    .single();

  if (!portfolio) {
    return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
  }

  // Get all entities in this portfolio with their stats
  const { data: entries } = await db
    .from('funder_portfolio_entities')
    .select('id, gs_id, notes, added_at, entity_id')
    .eq('portfolio_id', id)
    .order('added_at', { ascending: false });

  if (!entries || entries.length === 0) {
    return NextResponse.json({
      ...portfolio,
      entities: [],
      aggregate: { total_entities: 0, total_inbound: 0, total_outbound: 0, total_relationships: 0 },
    });
  }

  // Fetch entity details + stats in parallel
  const entityIds = entries.map((e) => e.entity_id);
  const gsIds = entries.map((e) => e.gs_id);

  const [{ data: entities }, { data: stats }] = await Promise.all([
    db.from('gs_entities')
      .select('id, gs_id, canonical_name, abn, entity_type, sector, state, postcode, remoteness, seifa_irsd_decile, is_community_controlled, lga_name')
      .in('id', entityIds),
    db.from('mv_gs_entity_stats')
      .select('id, total_relationships, total_inbound_amount, total_outbound_amount, counterparty_count')
      .in('id', entityIds),
  ]);

  const entityMap = new Map((entities || []).map((e) => [e.id, e]));
  const statsMap = new Map((stats || []).map((s) => [s.id, s]));

  const enrichedEntities = entries.map((entry) => {
    const entity = entityMap.get(entry.entity_id);
    const entityStats = statsMap.get(entry.entity_id);
    return {
      portfolio_entry_id: entry.id,
      gs_id: entry.gs_id,
      notes: entry.notes,
      added_at: entry.added_at,
      entity: entity || null,
      stats: entityStats || null,
    };
  });

  // Aggregate stats
  const aggregate = {
    total_entities: enrichedEntities.length,
    total_inbound: (stats || []).reduce((s, r) => s + (r.total_inbound_amount || 0), 0),
    total_outbound: (stats || []).reduce((s, r) => s + (r.total_outbound_amount || 0), 0),
    total_relationships: (stats || []).reduce((s, r) => s + (r.total_relationships || 0), 0),
  };

  return NextResponse.json({
    ...portfolio,
    entities: enrichedEntities,
    aggregate,
  });
}

/** DELETE /api/portfolio/[id] — delete a portfolio */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireModule('allocation');
  if (auth.error) return auth.error;

  const { id } = await params;
  const db = getServiceSupabase();

  // Check impersonation
  const impSlug = await getImpersonateSlug();
  let delUserId = auth.user.id;
  if (impSlug) {
    const { data: impOrg } = await db
      .from('org_profiles')
      .select('user_id')
      .eq('slug', impSlug)
      .maybeSingle();
    if (impOrg?.user_id) delUserId = impOrg.user_id;
  }

  const { error } = await db
    .from('funder_portfolios')
    .delete()
    .eq('id', id)
    .eq('user_id', delUserId);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete portfolio' }, { status: 500 });
  }

  return NextResponse.json({ status: 'deleted' });
}
