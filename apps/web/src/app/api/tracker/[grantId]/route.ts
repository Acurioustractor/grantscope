import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { STAGE_TO_GHL } from '@/lib/ghl';

type RouteContext = { params: Promise<{ grantId: string }> };

const GHL_SYNC_STAGES = new Set(Object.keys(STAGE_TO_GHL));

export async function PUT(request: NextRequest, context: RouteContext) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { grantId } = await context.params;
  const body = await request.json();
  const { stars, color, stage, notes, partner_contact_ids } = body;

  // Use service role to bypass RLS — user authenticated above
  const serviceDb = getServiceSupabase();

  const { data, error } = await serviceDb
    .from('saved_grants')
    .upsert(
      {
        user_id: user.id,
        grant_id: grantId,
        ...(stars !== undefined && { stars }),
        ...(color !== undefined && { color }),
        ...(stage !== undefined && { stage }),
        ...(notes !== undefined && { notes }),
        ...(partner_contact_ids !== undefined && { partner_contact_ids }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,grant_id' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire-and-forget GHL sync when stage reaches "pursuing" or later
  if (stage && GHL_SYNC_STAGES.has(stage) && process.env.GHL_API_KEY) {
    syncToGHL(grantId, stage, data as { ghl_opportunity_id: string | null }, serviceDb, user.id).catch(
      (err) => console.error('[GHL sync]', err)
    );
  }

  return NextResponse.json(data);
}

async function syncToGHL(
  grantId: string,
  stage: string,
  savedGrant: { ghl_opportunity_id: string | null },
  serviceDb: ReturnType<typeof getServiceSupabase>,
  userId: string
) {
  const { createOpportunity, updateOpportunity, getPipelines } = await import('@/lib/ghl');

  const { pipelines } = await getPipelines();
  const pipeline = pipelines?.[0];
  if (!pipeline) return;

  const ghlStageName = STAGE_TO_GHL[stage];
  const pipelineStage = pipeline.stages?.find(
    (s: { name: string }) => s.name.toLowerCase() === ghlStageName?.toLowerCase()
  );
  if (!pipelineStage) return;

  if (savedGrant.ghl_opportunity_id) {
    await updateOpportunity(savedGrant.ghl_opportunity_id, {
      pipelineStageId: pipelineStage.id,
      status: stage === 'lost' || stage === 'expired' ? 'lost' : stage === 'realized' ? 'won' : 'open',
    });
  } else {
    const { data: grant } = await serviceDb
      .from('grant_opportunities')
      .select('name, amount_max')
      .eq('id', grantId)
      .single();

    const result = await createOpportunity({
      name: grant?.name || 'Unknown Grant',
      stage,
      monetaryValue: grant?.amount_max ?? 0,
      pipelineId: pipeline.id,
      pipelineStageId: pipelineStage.id,
    });

    if (result?.opportunity?.id) {
      await serviceDb
        .from('saved_grants')
        .update({ ghl_opportunity_id: result.opportunity.id })
        .eq('user_id', userId)
        .eq('grant_id', grantId);
    }
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { grantId } = await context.params;

  const serviceDb = getServiceSupabase();
  const { error } = await serviceDb
    .from('saved_grants')
    .delete()
    .eq('user_id', user.id)
    .eq('grant_id', grantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
