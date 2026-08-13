import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getGoodsGrantWriteContext } from '@/lib/services/goods-grant-write-context';

export async function POST(request: NextRequest) {
  const context = await getGoodsGrantWriteContext();
  if (context.error) return context.error;
  const body = await request.json().catch(() => ({})) as { grantId?: string; orgProfileId?: string };
  if (!body.grantId) return NextResponse.json({ error: 'grantId is required' }, { status: 400 });
  const db = getServiceSupabase();
  const { error } = await db.from('opportunity_decisions').insert({
    user_id: context.userId, org_profile_id: context.orgProfileId, source_type: 'grant', source_ref: body.grantId,
    project_code: 'ACT-GD', pathway: 'grant', decision: 'research', reason: 'Restored for reconsideration', evidence_gaps: [],
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
