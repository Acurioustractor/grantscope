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

  // Fetch MV stats, interventions, tax data, and lobbying connections in parallel
  const [{ data: mvStats }, { data: interventions }, { data: taxRecords }, lobbyLinks] = await Promise.all([
    db
      .from('mv_gs_entity_stats')
      .select('*')
      .eq('id', entity.id)
      .single(),
    db
      .from('alma_interventions')
      .select('id, name, type, description, evidence_level, cultural_authority, target_cohort, geography, years_operating, portfolio_score, review_status')
      .eq('gs_entity_id', entity.id)
      .order('portfolio_score', { ascending: false, nullsFirst: false }),
    entity.abn ? db
      .from('ato_tax_transparency')
      .select('report_year, total_income, taxable_income, tax_payable, entity_type, industry')
      .eq('abn', entity.abn)
      .order('report_year', { ascending: false }) : Promise.resolve({ data: [] }),
    EntityService.findLobbyConnections(db, entity.canonical_name),
  ]);

  return NextResponse.json({
    entity,
    stats: mvStats || null,
    interventions: interventions || [],
    tax_transparency: taxRecords || [],
    lobbying_connections: lobbyLinks,
    // Pagination endpoints for relationship detail
    _links: {
      money: `/api/entities/${gsId}/money`,
      network: `/api/entities/${gsId}/network`,
      evidence: `/api/entities/${gsId}/evidence`,
    },
  });
}
