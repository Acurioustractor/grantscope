import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

type RouteContext = { params: Promise<{ gsId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { gsId } = await context.params;
  const supabase = getServiceSupabase();

  const { data: entity, error } = await supabase
    .from('gs_entities')
    .select('*')
    .eq('gs_id', gsId)
    .single();

  if (error || !entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }

  // Fetch relationships + connected entity names in parallel
  const [{ data: outbound }, { data: inbound }] = await Promise.all([
    supabase
      .from('gs_relationships')
      .select('id, target_entity_id, relationship_type, amount, year, dataset, confidence, properties, start_date, end_date')
      .eq('source_entity_id', entity.id)
      .order('amount', { ascending: false, nullsFirst: false }),
    supabase
      .from('gs_relationships')
      .select('id, source_entity_id, relationship_type, amount, year, dataset, confidence, properties, start_date, end_date')
      .eq('target_entity_id', entity.id)
      .order('amount', { ascending: false, nullsFirst: false }),
  ]);

  return NextResponse.json({
    entity,
    relationships: {
      outbound: outbound || [],
      inbound: inbound || [],
    },
  });
}
