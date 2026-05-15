import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type DeployBody = {
  product_slug: string;          // e.g. 'basket-bed-double'
  product_type?: string;          // e.g. 'Basket Bed'
  count: number;                  // how many units
  funder_label?: string;          // e.g. 'Snow Foundation'
  funder_id?: string | null;      // optional foundations.id
  funded_amount_aud?: number;
  funded_via_invoice?: string;
  deployed_at?: string;           // ISO date
  notes?: string;
  household_list?: string[];      // optional per-asset household labels (must equal count if given)
  asset_name_prefix?: string;     // optional, default uses community + product
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModule('tracker');
  if (auth.error) return auth.error;
  const { user } = auth;

  const { id: communityId } = await params;
  const body = (await request.json().catch(() => ({}))) as Partial<DeployBody>;

  if (!body.product_slug || !body.count || body.count < 1) {
    return NextResponse.json({ error: 'product_slug and count >= 1 required' }, { status: 400 });
  }
  if (body.count > 500) {
    return NextResponse.json({ error: 'count too large (max 500 per batch)' }, { status: 400 });
  }
  if (body.household_list && body.household_list.length !== body.count) {
    return NextResponse.json({ error: 'household_list must be empty or length=count' }, { status: 400 });
  }

  const db = getServiceSupabase();
  const nowIso = new Date().toISOString();
  const deployedAt = body.deployed_at || new Date().toISOString().slice(0, 10);

  // Look up the community
  const { data: community, error: cErr } = await db
    .from('goods_communities')
    .select('id, community_name, state, assets_deployed')
    .eq('id', communityId)
    .maybeSingle();
  if (cErr || !community) {
    return NextResponse.json({ error: 'community not found' }, { status: 404 });
  }

  // Create deployment batch
  const { data: batch, error: bErr } = await db
    .from('goods_deployment_batches')
    .insert({
      community_id: communityId,
      community_name: community.community_name,
      product_slug: body.product_slug,
      product_type: body.product_type || null,
      unit_count: body.count,
      funded_by_label: body.funder_label || null,
      funded_by_funder_id: body.funder_id || null,
      funded_amount_aud: body.funded_amount_aud || null,
      funded_via_invoice: body.funded_via_invoice || null,
      deployed_at: deployedAt,
      deployed_by: user.email || user.id,
      notes: body.notes || null,
    })
    .select('id')
    .single();
  if (bErr || !batch) {
    return NextResponse.json({ error: 'batch insert failed', detail: bErr?.message }, { status: 500 });
  }

  // Build N asset rows. goods_asset_id pattern keeps them grouped + sequential.
  const baseId = `GD-${community.community_name.replace(/[^A-Z0-9]/gi, '').slice(0, 8).toUpperCase()}-${batch.id.slice(0, 4)}`;
  const namePrefix = body.asset_name_prefix || `${community.community_name} ${body.product_type || body.product_slug}`;
  const count = body.count;
  const rows = Array.from({ length: count }, (_, i) => ({
    goods_asset_id: `${baseId}-${i + 1}`,
    product_slug: body.product_slug,
    product_type: body.product_type || null,
    community_id: communityId,
    community_name: community.community_name,
    asset_name: `${namePrefix} ${i + 1}`,
    household: body.household_list?.[i] || null,
    deployed_at: deployedAt,
    current_status: 'deployed',
    funded_by_label: body.funder_label || null,
    funded_by_funder_id: body.funder_id || null,
    funded_amount_aud: body.funded_amount_aud ? Number(body.funded_amount_aud) / count : null, // per-unit allocation
    funded_via_invoice: body.funded_via_invoice || null,
    paid_at: deployedAt,
    deployment_batch_id: batch.id,
    deployment_notes: body.notes || null,
    needs_replacement: false,
    last_synced_at: nowIso,
  }));

  // Insert in chunks of 100
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const slice = rows.slice(i, i + 100);
    const { error } = await db.from('goods_asset_lifecycle').insert(slice);
    if (error) {
      // Partial failure — rollback by deleting what was inserted so far
      console.error('[goods-deploy] asset insert failed:', error.message);
      await db.from('goods_asset_lifecycle').delete().eq('deployment_batch_id', batch.id);
      await db.from('goods_deployment_batches').delete().eq('id', batch.id);
      return NextResponse.json({ error: 'asset insert failed', detail: error.message }, { status: 500 });
    }
    inserted += slice.length;
  }

  // Bump the community's assets_deployed counter
  const newCount = (community.assets_deployed || 0) + inserted;
  await db.from('goods_communities')
    .update({ assets_deployed: newCount, updated_at: nowIso })
    .eq('id', communityId);

  return NextResponse.json({
    ok: true,
    batch_id: batch.id,
    inserted,
    community_name: community.community_name,
    new_deployed_count: newCount,
    base_asset_id: baseId,
  });
}
