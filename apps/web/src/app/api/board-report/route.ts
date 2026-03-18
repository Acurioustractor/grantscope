import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

interface BoardReportRequest {
  entity_gs_id?: string;
  abn?: string;
}

export async function POST(request: NextRequest) {
  // Auth: all tiers have research module access
  const auth = await requireModule('research');
  if (auth.error) return auth.error;

  try {
    const body: BoardReportRequest = await request.json();
    const { entity_gs_id, abn } = body;

    // Validate input
    if (!entity_gs_id && !abn) {
      return NextResponse.json(
        { error: 'Either entity_gs_id or abn is required' },
        { status: 400 }
      );
    }

    const db = getServiceSupabase();

    // Query entity details
    let entityQuery = db
      .from('gs_entities')
      .select('id, gs_id, canonical_name, abn, entity_type, state, sector, postcode, remoteness, seifa_irsd_decile, lga_name, description, website');

    if (entity_gs_id) {
      entityQuery = entityQuery.eq('gs_id', entity_gs_id);
    } else if (abn) {
      entityQuery = entityQuery.eq('abn', abn);
    }

    const { data: entity, error: entityError } = await entityQuery.maybeSingle();

    if (entityError) {
      return NextResponse.json(
        { error: `Database error: ${entityError.message}` },
        { status: 500 }
      );
    }

    if (!entity) {
      return NextResponse.json(
        { error: 'Entity not found' },
        { status: 404 }
      );
    }

    // Query outbound relationships (where entity is the source)
    const { data: outboundRels, error: outboundError } = await db
      .from('gs_relationships')
      .select('id, source_entity_id, target_entity_id, relationship_type, amount, year, dataset')
      .eq('source_entity_id', entity.id)
      .order('amount', { ascending: false, nullsFirst: false })
      .limit(10);

    if (outboundError) {
      return NextResponse.json(
        { error: `Database error querying outbound relationships: ${outboundError.message}` },
        { status: 500 }
      );
    }

    // Query inbound relationships (where entity is the target)
    const { data: inboundRels, error: inboundError } = await db
      .from('gs_relationships')
      .select('id, source_entity_id, target_entity_id, relationship_type, amount, year, dataset')
      .eq('target_entity_id', entity.id)
      .order('amount', { ascending: false, nullsFirst: false })
      .limit(10);

    if (inboundError) {
      return NextResponse.json(
        { error: `Database error querying inbound relationships: ${inboundError.message}` },
        { status: 500 }
      );
    }

    // Get entity names for relationships
    const outboundTargetIds = (outboundRels || []).map((r) => r.target_entity_id);
    const inboundSourceIds = (inboundRels || []).map((r) => r.source_entity_id);
    const allEntityIds = [...outboundTargetIds, ...inboundSourceIds];

    let entityNames: Record<string, string> = {};
    if (allEntityIds.length > 0) {
      const { data: entities } = await db
        .from('gs_entities')
        .select('id, canonical_name')
        .in('id', allEntityIds);

      if (entities) {
        entityNames = Object.fromEntries(
          entities.map((e) => [e.id, e.canonical_name])
        );
      }
    }

    // Attach names to relationships
    const outboundWithNames = (outboundRels || []).map((rel) => ({
      ...rel,
      target_name: entityNames[rel.target_entity_id] || 'Unknown',
    }));

    const inboundWithNames = (inboundRels || []).map((rel) => ({
      ...rel,
      source_name: entityNames[rel.source_entity_id] || 'Unknown',
    }));

    // Query justice funding if ABN available
    let justiceFunding: Array<{
      program_name: string;
      total: number;
      financial_year: string;
    }> = [];

    if (entity.abn) {
      const { data: fundingData } = await db
        .from('justice_funding')
        .select('program_name, amount_dollars, financial_year')
        .eq('recipient_abn', entity.abn);

      if (fundingData && fundingData.length > 0) {
        // Group by program and year
        const grouped = fundingData.reduce((acc, record) => {
          const key = `${record.program_name}|${record.financial_year || 'Unknown'}`;
          if (!acc[key]) {
            acc[key] = {
              program_name: record.program_name,
              financial_year: record.financial_year || 'Unknown',
              total: 0,
            };
          }
          acc[key].total += Number(record.amount_dollars || 0);
          return acc;
        }, {} as Record<string, { program_name: string; financial_year: string; total: number }>);

        justiceFunding = Object.values(grouped)
          .sort((a, b) => b.total - a.total)
          .slice(0, 10);
      }
    }

    // Query ALMA interventions linked to this entity
    const { data: almaData } = await db
      .from('alma_interventions')
      .select('name, type, evidence_level, description')
      .eq('gs_entity_id', entity.id)
      .limit(10);

    return NextResponse.json({
      entity: {
        gs_id: entity.gs_id,
        canonical_name: entity.canonical_name,
        abn: entity.abn,
        entity_type: entity.entity_type,
        state: entity.state,
        sector: entity.sector,
        postcode: entity.postcode,
        remoteness: entity.remoteness,
        seifa_irsd_decile: entity.seifa_irsd_decile,
        lga_name: entity.lga_name,
        description: entity.description,
        website: entity.website,
      },
      relationships: {
        outbound: outboundWithNames,
        inbound: inboundWithNames,
      },
      justice_funding: justiceFunding,
      alma_interventions: almaData || [],
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
