import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import * as EntityService from '@/lib/services/entity-service';

type RouteContext = { params: Promise<{ gsId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await requireModule('research');
  if (auth.error) return auth.error;

  const { gsId } = await context.params;
  const db = getServiceSupabase();

  const { data: entity, error } = await EntityService.findByGsId(db, gsId);

  if (error || !entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }

  // Fetch relationships, interventions, tax data, lobbying connections in parallel
  const [{ data: outbound }, { data: inbound }, { data: interventions }, { data: taxRecords }, lobbyLinks] = await Promise.all([
    db
      .from('gs_relationships')
      .select('id, target_entity_id, relationship_type, amount, year, dataset, confidence, properties, start_date, end_date')
      .eq('source_entity_id', entity.id)
      .order('amount', { ascending: false, nullsFirst: false }),
    db
      .from('gs_relationships')
      .select('id, source_entity_id, relationship_type, amount, year, dataset, confidence, properties, start_date, end_date')
      .eq('target_entity_id', entity.id)
      .order('amount', { ascending: false, nullsFirst: false }),
    db
      .from('alma_interventions')
      .select('id, name, type, description, evidence_level, cultural_authority, target_cohort, geography, years_operating, portfolio_score, review_status')
      .eq('gs_entity_id', entity.id)
      .order('portfolio_score', { ascending: false, nullsFirst: false }),
    // ATO tax transparency data
    entity.abn ? db
      .from('ato_tax_transparency')
      .select('report_year, total_income, taxable_income, tax_payable, entity_type, industry')
      .eq('abn', entity.abn)
      .order('report_year', { ascending: false }) : Promise.resolve({ data: [] }),
    // Lobbying connections
    EntityService.findLobbyConnections(db, entity.canonical_name),
  ]);

  return NextResponse.json({
    entity,
    relationships: {
      outbound: outbound || [],
      inbound: inbound || [],
    },
    interventions: interventions || [],
    tax_transparency: taxRecords || [],
    lobbying_connections: lobbyLinks,
  });
}
