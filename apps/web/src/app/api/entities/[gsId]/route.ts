import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

type RouteContext = { params: Promise<{ gsId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await requireModule('research');
  if (auth.error) return auth.error;

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

  // Fetch relationships, interventions in parallel
  const [{ data: outbound }, { data: inbound }, { data: interventions }] = await Promise.all([
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
    supabase
      .from('alma_interventions')
      .select('id, name, type, description, evidence_level, cultural_authority, target_cohort, geography, years_operating, portfolio_score, review_status')
      .eq('gs_entity_id', entity.id)
      .order('portfolio_score', { ascending: false, nullsFirst: false }),
  ]);

  return NextResponse.json({
    entity,
    relationships: {
      outbound: outbound || [],
      inbound: inbound || [],
    },
    interventions: interventions || [],
  });
}
