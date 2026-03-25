import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getPlaceBrief } from '@/lib/services/place-brief-service';
import { buildPlaceBriefPdf } from '@/lib/place-brief-pdf';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ postcode: string }> },
) {
  const { postcode } = await params;
  const db = getServiceSupabase();

  // Fetch geo data — prefer rows with state populated (skip stub rows)
  const { data: geoData } = await db
    .from('postcode_geo')
    .select('postcode, locality, state, remoteness_2021, lga_name')
    .eq('postcode', postcode)
    .not('state', 'is', null)
    .limit(1);

  if (!geoData?.length) {
    return NextResponse.json({ error: 'Postcode not found' }, { status: 404 });
  }

  const geo = geoData[0];
  const locality = geo.locality || postcode;
  const state = geo.state || '';

  // Fetch SEIFA
  const { data: seifaData } = await db
    .from('seifa_2021')
    .select('decile_national')
    .eq('postcode', postcode)
    .eq('index_type', 'IRSD')
    .limit(1);

  // Fetch entity count + funding summary
  const { data: entities } = await db
    .from('gs_entities')
    .select('id, is_community_controlled')
    .eq('postcode', postcode)
    .limit(500);

  const entityList = entities || [];
  const communityControlledCount = entityList.filter((e) => e.is_community_controlled).length;
  const entityIds = entityList.map((e) => e.id);

  // Funding totals
  let totalFunding = 0;
  let communityControlledFunding = 0;
  const ccIds = new Set(entityList.filter((e) => e.is_community_controlled).map((e) => e.id));

  if (entityIds.length > 0) {
    for (let i = 0; i < entityIds.length; i += 100) {
      const chunk = entityIds.slice(i, i + 100);
      const { data: rels } = await db
        .from('gs_relationships')
        .select('target_entity_id, amount')
        .in('target_entity_id', chunk)
        .in('relationship_type', ['grant', 'contract', 'donation']);

      for (const r of rels || []) {
        const amt = r.amount || 0;
        totalFunding += amt;
        if (ccIds.has(r.target_entity_id)) communityControlledFunding += amt;
      }
    }
  }

  const ccShare = totalFunding > 0 ? Math.round((communityControlledFunding / totalFunding) * 100) : 0;

  // Get Place Brief data (transcripts + ALMA + alignment)
  const brief = await getPlaceBrief(db, postcode, locality, state);

  // Generate PDF
  const { bytes, filename } = await buildPlaceBriefPdf({
    postcode,
    locality,
    state,
    remoteness: geo.remoteness_2021,
    seifaDecile: seifaData?.[0]?.decile_national ?? null,
    entityCount: entityList.length,
    totalFunding,
    communityControlledCount,
    communityControlledShare: ccShare,
    brief,
  });

  return new NextResponse(bytes.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'public, s-maxage=3600',
    },
  });
}
