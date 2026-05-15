import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { pushGoodsBuyerToGHL, type GoodsBuyerPushInput } from '@/lib/services/goods-buyer-ghl';

export const dynamic = 'force-dynamic';

type Payload = Partial<GoodsBuyerPushInput> & {
  communityId?: string;
  entityId?: string;
  buyerEntityRowId?: string;
};

export async function POST(request: NextRequest) {
  const auth = await requireModule('tracker');
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => ({}))) as Payload;
  if (!body.entityName || !body.communityName) {
    return NextResponse.json({ error: 'entityName and communityName required' }, { status: 400 });
  }

  const result = await pushGoodsBuyerToGHL({
    entityName: body.entityName,
    buyerRole: body.buyerRole ?? null,
    abn: body.abn ?? null,
    website: body.website ?? null,
    communityName: body.communityName,
    communityState: body.communityState ?? null,
    isCommunityControlled: !!body.isCommunityControlled,
    relationshipStatus: body.relationshipStatus ?? null,
    govtContractValue: body.govtContractValue ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: 'GHL push failed', detail: result }, { status: 500 });
  }

  // Persist GHL IDs back to goods_procurement_entities so the UI knows the
  // buyer is in GHL and we don't create duplicates on re-push.
  const db = getServiceSupabase();
  const nowIso = new Date().toISOString();
  const ghlPatch = {
    ghl_contact_id: result.contactId,
    ghl_opportunity_id: result.opportunityId || null,
    ghl_pipeline_id: process.env.GHL_GOODS_PIPELINE_ID || null,
    ghl_stage_id: process.env.GHL_GOODS_BUYER_STAGE_ID || null,
    ghl_stage_name: 'Outreach Queued',
    ghl_last_pushed_at: nowIso,
  };

  let promotedRowId: string | null = null;

  if (body.buyerEntityRowId) {
    // Existing mapped buyer — just update
    await db.from('goods_procurement_entities')
      .update(ghlPatch)
      .eq('id', body.buyerEntityRowId);
  } else if (body.communityId && body.entityId) {
    // Local org being pushed for the first time — promote to mapped buyer
    const { data: existing } = await db.from('goods_procurement_entities')
      .select('id')
      .eq('community_id', body.communityId)
      .eq('entity_id', body.entityId)
      .maybeSingle();

    if (existing) {
      await db.from('goods_procurement_entities')
        .update(ghlPatch)
        .eq('id', existing.id);
      promotedRowId = existing.id;
    } else {
      const { data: inserted, error: insertErr } = await db.from('goods_procurement_entities').insert({
        community_id: body.communityId,
        entity_id: body.entityId,
        entity_name: body.entityName,
        buyer_role: body.buyerRole || 'other',
        relationship_status: 'prospect',
        is_community_controlled: body.isCommunityControlled,
        ...ghlPatch,
      }).select('id').single();
      if (insertErr) console.error('[push-ghl] promote insert failed:', insertErr.message);
      else promotedRowId = inserted?.id || null;
    }
  }

  return NextResponse.json({
    ok: true,
    contactId: result.contactId,
    opportunityId: result.opportunityId,
    opportunityWarning: result.opportunityWarning,
    promotedToBuyerRowId: promotedRowId,
  });
}
