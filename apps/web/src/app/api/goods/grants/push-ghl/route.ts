import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { pushGoodsGrantToGHL, type GoodsGrantPushInput } from '@/lib/services/goods-grant-ghl';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireModule('tracker');
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => ({}))) as Partial<GoodsGrantPushInput>;
  if (!body.grantId || !body.name) {
    return NextResponse.json({ error: 'grantId and name required' }, { status: 400 });
  }

  const db = getServiceSupabase();

  // Idempotency: if the row is already linked, return the existing opportunity.
  const { data: existing } = await db
    .from('grant_opportunities')
    .select('ghl_opportunity_id')
    .eq('id', body.grantId)
    .maybeSingle();
  if (existing?.ghl_opportunity_id) {
    return NextResponse.json({ opportunityId: existing.ghl_opportunity_id, alreadyLinked: true });
  }

  const result = await pushGoodsGrantToGHL({
    grantId: body.grantId,
    name: body.name,
    provider: body.provider ?? null,
    fitScore: body.fitScore ?? null,
    deadline: body.deadline ?? null,
    url: body.url ?? null,
    geography: body.geography ?? null,
    amountMin: body.amountMin ?? null,
    amountMax: body.amountMax ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: 'GHL push failed', detail: result }, { status: 502 });
  }

  await db
    .from('grant_opportunities')
    .update({ ghl_opportunity_id: result.opportunityId })
    .eq('id', body.grantId);

  return NextResponse.json({ opportunityId: result.opportunityId });
}
