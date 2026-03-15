import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

type RouteContext = { params: Promise<{ gsId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await requireModule('research');
  if (auth.error) return auth.error;

  const { gsId } = await context.params;
  const db = getServiceSupabase();

  // Look up entity
  const { data: entity } = await db
    .from('gs_entities')
    .select('id, gs_id, canonical_name, entity_type')
    .eq('gs_id', gsId)
    .single();

  if (!entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }

  // Get top 50 connected entities by total amount
  // Union outbound + inbound, group by counterparty, order by total
  const [{ data: outbound }, { data: inbound }] = await Promise.all([
    db
      .from('gs_relationships')
      .select('target_entity_id, relationship_type, amount')
      .eq('source_entity_id', entity.id)
      .not('amount', 'is', null),
    db
      .from('gs_relationships')
      .select('source_entity_id, relationship_type, amount')
      .eq('target_entity_id', entity.id)
      .not('amount', 'is', null),
  ]);

  // Aggregate by counterparty
  const counterpartyStats = new Map<string, { total: number; types: Set<string> }>();

  for (const r of outbound || []) {
    const id = r.target_entity_id;
    const existing = counterpartyStats.get(id) || { total: 0, types: new Set() };
    existing.total += r.amount || 0;
    existing.types.add(r.relationship_type);
    counterpartyStats.set(id, existing);
  }

  for (const r of inbound || []) {
    const id = r.source_entity_id;
    const existing = counterpartyStats.get(id) || { total: 0, types: new Set() };
    existing.total += r.amount || 0;
    existing.types.add(r.relationship_type);
    counterpartyStats.set(id, existing);
  }

  // Get top 50 by amount
  const topCounterparties = Array.from(counterpartyStats.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 50);

  if (topCounterparties.length === 0) {
    return NextResponse.json({
      nodes: [],
      edges: [],
      center: { id: entity.id, gs_id: entity.gs_id, name: entity.canonical_name, entity_type: entity.entity_type },
      entityTypes: {},
    });
  }

  // Fetch entity details for top counterparties
  const cpIds = topCounterparties.map(([id]) => id);
  const entityMap = new Map<string, { id: string; gs_id: string; canonical_name: string; entity_type: string }>();

  for (let i = 0; i < cpIds.length; i += 100) {
    const chunk = cpIds.slice(i, i + 100);
    const { data: entities } = await db
      .from('gs_entities')
      .select('id, gs_id, canonical_name, entity_type')
      .in('id', chunk);
    for (const e of entities || []) {
      entityMap.set(e.id, e);
    }
  }

  // Build nodes
  const nodes = topCounterparties.map(([id, stats]) => {
    const e = entityMap.get(id);
    return {
      id,
      gs_id: e?.gs_id || '',
      name: e?.canonical_name || 'Unknown',
      entity_type: e?.entity_type || 'unknown',
      total_amount: stats.total,
      relationship_types: Array.from(stats.types),
    };
  });

  // Build edges (simplified: one edge per counterparty with dominant type)
  const edges = topCounterparties.map(([id, stats]) => ({
    source: entity.id,
    target: id,
    amount: stats.total,
    relationship_type: Array.from(stats.types)[0], // dominant type
  }));

  // Entity type distribution
  const entityTypes: Record<string, number> = {};
  for (const node of nodes) {
    entityTypes[node.entity_type] = (entityTypes[node.entity_type] || 0) + 1;
  }

  return NextResponse.json({
    nodes,
    edges,
    center: {
      id: entity.id,
      gs_id: entity.gs_id,
      name: entity.canonical_name,
      entity_type: entity.entity_type,
    },
    entityTypes,
  });
}
