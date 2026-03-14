import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import * as EntityService from '@/lib/services/entity-service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ postcode: string }> }
) {
  const auth = await requireModule('allocation');
  if (auth.error) return auth.error;

  const { postcode } = await params;
  const db = getServiceSupabase();

  // Fetch geo, SEIFA, entities in parallel
  const [{ data: geo }, { data: seifa }, entityResult] = await Promise.all([
    db
      .from('postcode_geo')
      .select('postcode, locality, state, remoteness_2021, sa2_name, sa3_name')
      .eq('postcode', postcode)
      .limit(1),
    db
      .from('seifa_2021')
      .select('decile_national, score')
      .eq('postcode', postcode)
      .eq('index_type', 'IRSD')
      .limit(1),
    EntityService.findByPostcode(db, postcode),
  ]);

  if (!geo?.length) {
    return NextResponse.json({ error: 'Postcode not found' }, { status: 404 });
  }

  const entityList = entityResult.data;
  const entityIds = entityList.map(e => e.id);

  // Fetch inbound funding relationships for entities in this postcode
  let totalFunding = 0;
  let communityControlledFunding = 0;
  const recipientFunding = new Map<number, number>();
  const communityControlledIds = new Set(
    entityList.filter(e => e.is_community_controlled).map(e => e.id)
  );

  if (entityIds.length > 0) {
    for (let i = 0; i < entityIds.length; i += 100) {
      const chunk = entityIds.slice(i, i + 100);
      const { data: rels } = await db
        .from('gs_relationships')
        .select('target_entity_id, amount, relationship_type')
        .in('target_entity_id', chunk)
        .in('relationship_type', ['grant', 'contract', 'donation']);

      for (const r of rels || []) {
        const amt = r.amount || 0;
        totalFunding += amt;
        if (communityControlledIds.has(r.target_entity_id)) {
          communityControlledFunding += amt;
        }
        recipientFunding.set(
          r.target_entity_id,
          (recipientFunding.get(r.target_entity_id) || 0) + amt
        );
      }
    }
  }

  const topRecipients = entityList
    .map(e => ({
      gs_id: e.gs_id,
      name: e.canonical_name,
      entity_type: e.entity_type,
      is_community_controlled: e.is_community_controlled || false,
      total_funding: recipientFunding.get(e.id) || 0,
    }))
    .sort((a, b) => b.total_funding - a.total_funding)
    .slice(0, 20);

  const communityControlledCount = entityList.filter(e => e.is_community_controlled).length;
  const communityControlledShare = totalFunding > 0
    ? communityControlledFunding / totalFunding
    : 0;

  return NextResponse.json({
    postcode,
    locality: geo[0].locality,
    state: geo[0].state,
    remoteness: geo[0].remoteness_2021,
    sa2_name: geo[0].sa2_name,
    sa3_name: geo[0].sa3_name,
    seifa: seifa?.[0] ? {
      irsd_decile: seifa[0].decile_national,
      irsd_score: seifa[0].score,
    } : null,
    funding_summary: {
      total_funding: totalFunding,
      entity_count: entityList.length,
      community_controlled_count: communityControlledCount,
      community_controlled_share: communityControlledShare,
      community_controlled_funding: communityControlledFunding,
    },
    top_recipients: topRecipients,
  });
}
