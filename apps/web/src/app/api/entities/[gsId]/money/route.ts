import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

type RouteContext = { params: Promise<{ gsId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireModule('research');
  if (auth.error) return auth.error;

  const { gsId } = await context.params;
  const db = getServiceSupabase();
  const url = new URL(request.url);
  const typeFilter = url.searchParams.get('type'); // contract|donation|grant|all
  const cursorParam = url.searchParams.get('cursor'); // "amount:id" format
  const limit = Math.min(Number(url.searchParams.get('limit') || '50'), 100);

  // Look up entity by gs_id
  const { data: entity } = await db
    .from('gs_entities')
    .select('id')
    .eq('gs_id', gsId)
    .single();

  if (!entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }

  // Get total from MV
  const { data: mvStats } = await db
    .from('mv_gs_entity_stats')
    .select('total_relationships, type_breakdown')
    .eq('id', entity.id)
    .single();

  let total = mvStats?.total_relationships ?? 0;
  if (typeFilter && typeFilter !== 'all' && mvStats?.type_breakdown) {
    const tb = mvStats.type_breakdown as Record<string, { count: number }>;
    total = 0;
    for (const [key, val] of Object.entries(tb)) {
      if (key.startsWith(typeFilter + ':')) total += val.count;
    }
  }

  // Parse cursor: "amount:id" where amount is numeric and id is uuid
  let cursorAmount: number | null = null;
  let cursorId: string | null = null;
  if (cursorParam) {
    const sep = cursorParam.indexOf(':');
    if (sep > 0) {
      cursorAmount = Number(cursorParam.slice(0, sep));
      cursorId = cursorParam.slice(sep + 1);
    }
  }

  // Build keyset-paginated query
  // Union outbound + inbound, ordered by amount DESC, id DESC
  // Using raw SQL via RPC for keyset pagination with proper cursor support
  const fetchLimit = limit + 1; // +1 to detect hasMore

  // Fetch outbound relationships
  let outboundQuery = db
    .from('gs_relationships')
    .select('id, source_entity_id, target_entity_id, relationship_type, amount, year, dataset, confidence, properties, start_date, end_date')
    .eq('source_entity_id', entity.id)
    .order('amount', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(fetchLimit);

  if (typeFilter && typeFilter !== 'all') {
    outboundQuery = outboundQuery.eq('relationship_type', typeFilter);
  }

  // For keyset pagination, we need to handle cursor
  // Supabase JS doesn't support (amount, id) < ($1, $2) directly
  // So we use .or() with two conditions:
  // amount < cursor_amount OR (amount = cursor_amount AND id < cursor_id)
  if (cursorAmount !== null && cursorId) {
    outboundQuery = outboundQuery.or(
      `amount.lt.${cursorAmount},and(amount.eq.${cursorAmount},id.lt.${cursorId})`,
    );
  }

  let inboundQuery = db
    .from('gs_relationships')
    .select('id, source_entity_id, target_entity_id, relationship_type, amount, year, dataset, confidence, properties, start_date, end_date')
    .eq('target_entity_id', entity.id)
    .order('amount', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(fetchLimit);

  if (typeFilter && typeFilter !== 'all') {
    inboundQuery = inboundQuery.eq('relationship_type', typeFilter);
  }

  if (cursorAmount !== null && cursorId) {
    inboundQuery = inboundQuery.or(
      `amount.lt.${cursorAmount},and(amount.eq.${cursorAmount},id.lt.${cursorId})`,
    );
  }

  const [{ data: outbound }, { data: inbound }] = await Promise.all([outboundQuery, inboundQuery]);

  // Merge and sort by amount DESC, id DESC
  const allRels = [...(outbound || []), ...(inbound || [])].sort((a, b) => {
    const amtDiff = (b.amount ?? -Infinity) - (a.amount ?? -Infinity);
    if (amtDiff !== 0) return amtDiff;
    return b.id < a.id ? -1 : 1;
  });

  const hasMore = allRels.length > limit;
  const pageRels = allRels.slice(0, limit);

  // Collect connected entity IDs for name resolution
  const connectedIds = new Set<string>();
  for (const r of pageRels) {
    const otherId = r.source_entity_id === entity.id ? r.target_entity_id : r.source_entity_id;
    connectedIds.add(otherId);
  }

  const connectedMap = new Map<string, { canonical_name: string; gs_id: string; entity_type: string }>();
  if (connectedIds.size > 0) {
    const ids = Array.from(connectedIds);
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { data: entities } = await db
        .from('gs_entities')
        .select('id, gs_id, canonical_name, entity_type')
        .in('id', chunk);
      for (const ce of entities || []) {
        connectedMap.set(ce.id, { canonical_name: ce.canonical_name, gs_id: ce.gs_id, entity_type: ce.entity_type });
      }
    }
  }

  // Build response
  const relationships = pageRels.map((r) => {
    const otherId = r.source_entity_id === entity.id ? r.target_entity_id : r.source_entity_id;
    const ce = connectedMap.get(otherId);
    return {
      id: r.id,
      counterparty_name: ce?.canonical_name || 'Unknown',
      counterparty_gs_id: ce?.gs_id || '',
      counterparty_type: ce?.entity_type || 'unknown',
      relationship_type: r.relationship_type,
      amount: r.amount,
      year: r.year,
      dataset: r.dataset,
      properties: r.properties || {},
    };
  });

  // Build next cursor
  let nextCursor: string | null = null;
  if (hasMore && pageRels.length > 0) {
    const last = pageRels[pageRels.length - 1];
    nextCursor = `${last.amount ?? 0}:${last.id}`;
  }

  return NextResponse.json({ relationships, nextCursor, total });
}
