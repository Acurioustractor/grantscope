import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sa2Code: string }> }
) {
  const { sa2Code } = await params;

  try {
    const supabase = getServiceSupabase();

    // Get postcodes in this SA2
    const { data: postcodes } = await supabase
      .from('postcode_geo')
      .select('postcode, locality, state, remoteness_2021, sa2_name')
      .eq('sa2_code', sa2Code);

    if (!postcodes?.length) {
      return NextResponse.json({ error: 'SA2 region not found' }, { status: 404 });
    }

    const sa2Name = postcodes[0].sa2_name;
    const state = postcodes[0].state;
    const remoteness = postcodes[0].remoteness_2021;
    const postcodeList = postcodes.map(p => p.postcode);

    // Get funding data for these postcodes
    const { data: fundingRows } = await supabase
      .from('mv_funding_by_postcode')
      .select('*')
      .in('postcode', postcodeList);

    const totalFunding = (fundingRows || []).reduce((s, r) => s + (Number(r.total_funding) || 0), 0);
    const entityCount = (fundingRows || []).reduce((s, r) => s + (Number(r.entity_count) || 0), 0);
    const communityControlled = (fundingRows || []).reduce((s, r) => s + (Number(r.community_controlled_count) || 0), 0);
    const communityFunding = (fundingRows || []).reduce((s, r) => s + (Number(r.community_controlled_funding) || 0), 0);
    const localPct = totalFunding > 0 ? Math.round((communityFunding / totalFunding) * 100) : 0;

    // Get SEIFA data
    const { data: seifaRows } = await supabase
      .from('seifa_2021')
      .select('*')
      .in('postcode', postcodeList)
      .eq('index_type', 'IRSD');

    const avgDecile = seifaRows?.length
      ? Math.round(seifaRows.reduce((s, r) => s + (r.decile_national || 5), 0) / seifaRows.length)
      : null;

    // Get top entities in this area (recipients)
    const { data: entities } = await supabase
      .from('gs_entities')
      .select('id, gs_id, canonical_name, entity_type, latest_revenue')
      .in('postcode', postcodeList)
      .order('latest_revenue', { ascending: false, nullsFirst: false })
      .limit(10);

    // Get top funders flowing into this area via relationships
    const entityIds = (entities || []).map(e => e.id);
    let topFunders: Array<{ name: string; amount: number; type: string }> = [];

    if (entityIds.length > 0) {
      const { data: inboundRels } = await supabase
        .from('gs_relationships')
        .select('source_entity_id, amount, relationship_type')
        .in('target_entity_id', entityIds)
        .in('relationship_type', ['grant', 'contract', 'donation'])
        .order('amount', { ascending: false })
        .limit(50);

      if (inboundRels?.length) {
        const funderIds = [...new Set(inboundRels.map(r => r.source_entity_id))];
        const { data: funderEntities } = await supabase
          .from('gs_entities')
          .select('id, canonical_name, entity_type')
          .in('id', funderIds.slice(0, 20));

        const funderLookup = new Map((funderEntities || []).map(e => [e.id, e]));

        // Aggregate by funder
        const funderAmounts = new Map<string, { name: string; amount: number; type: string }>();
        for (const rel of inboundRels) {
          const funder = funderLookup.get(rel.source_entity_id);
          if (!funder) continue;
          const existing = funderAmounts.get(funder.id);
          if (existing) {
            existing.amount += Number(rel.amount) || 0;
          } else {
            funderAmounts.set(funder.id, {
              name: funder.canonical_name,
              amount: Number(rel.amount) || 0,
              type: funder.entity_type,
            });
          }
        }

        topFunders = Array.from(funderAmounts.values())
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10);
      }
    }

    return NextResponse.json({
      sa2_code: sa2Code,
      sa2_name: sa2Name,
      state,
      remoteness,
      total_funding: totalFunding,
      entity_count: entityCount,
      community_controlled_count: communityControlled,
      local_pct: localPct,
      seifa_decile: avgDecile,
      top_recipients: (entities || []).map(e => ({
        gs_id: e.gs_id,
        name: e.canonical_name,
        type: e.entity_type,
        revenue: e.latest_revenue,
      })),
      top_funders: topFunders,
      postcodes: postcodes.map(p => ({ postcode: p.postcode, locality: p.locality })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
