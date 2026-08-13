import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getGoodsGrantWriteContext } from '@/lib/services/goods-grant-write-context';

export async function POST(request: NextRequest) {
  const context = await getGoodsGrantWriteContext();
  if (context.error) return context.error;
  const body = await request.json().catch(() => ({})) as { grantId?: string; reason?: string; reasonCode?: string; projectCode?: string };
  if (!body.grantId) return NextResponse.json({ error: 'grantId is required' }, { status: 400 });

  const db = getServiceSupabase();
  const { error } = await db.from('opportunity_decisions').insert({
    user_id: context.userId,
    org_profile_id: context.orgProfileId,
    source_type: 'grant',
    source_ref: body.grantId,
    project_code: body.projectCode || 'ACT-GD',
    pathway: 'grant',
    decision: 'no',
    reason: body.reason?.trim() || body.reasonCode || 'Not relevant to selected ACT project',
    evidence_gaps: [],
    judgment: {
      whatChanged: 'Human review marked this opportunity as not relevant.',
      dismissalReason: body.reasonCode || 'other',
      projectCode: body.projectCode || 'ACT-GD',
    },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
