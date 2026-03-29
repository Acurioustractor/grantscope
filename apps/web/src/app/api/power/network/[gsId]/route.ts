import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gsId: string }> }
) {
  const { gsId } = await params;

  try {
    const supabase = getServiceSupabase();

    // Get the entity
    const { data: entity } = await supabase
      .from('gs_entities')
      .select('id, gs_id, canonical_name, entity_type')
      .eq('gs_id', gsId)
      .single();

    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    // Get relationships (both directions)
    const { data: outbound } = await supabase
      .from('gs_relationships')
      .select('target_entity_id, relationship_type, amount')
      .eq('source_entity_id', entity.id)
      .order('amount', { ascending: false })
      .limit(15);

    const { data: inbound } = await supabase
      .from('gs_relationships')
      .select('source_entity_id, relationship_type, amount')
      .eq('target_entity_id', entity.id)
      .order('amount', { ascending: false })
      .limit(15);

    // Get connected entity details
    const connectedIds = [
      ...(outbound || []).map(r => r.target_entity_id),
      ...(inbound || []).map(r => r.source_entity_id),
    ];
    const uniqueIds = [...new Set(connectedIds)];

    const { data: connectedEntities } = await supabase
      .from('gs_entities')
      .select('id, gs_id, canonical_name, entity_type')
      .in('id', uniqueIds.slice(0, 30));

    const entityLookup = new Map((connectedEntities || []).map(e => [e.id, e]));

    // Build relationships array
    const relationships = [
      ...(outbound || []).map(r => ({
        source_entity_id: entity.id,
        target_entity_id: r.target_entity_id,
        relationship_type: r.relationship_type,
        amount: r.amount,
        source_entity: { id: entity.id, canonical_name: entity.canonical_name, entity_type: entity.entity_type },
        target_entity: entityLookup.get(r.target_entity_id) || null,
      })),
      ...(inbound || []).map(r => ({
        source_entity_id: r.source_entity_id,
        target_entity_id: entity.id,
        relationship_type: r.relationship_type,
        amount: r.amount,
        source_entity: entityLookup.get(r.source_entity_id) || null,
        target_entity: { id: entity.id, canonical_name: entity.canonical_name, entity_type: entity.entity_type },
      })),
    ].filter(r => r.source_entity && r.target_entity);

    return NextResponse.json({ entity, relationships });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
