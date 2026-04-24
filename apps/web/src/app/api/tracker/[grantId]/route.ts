import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { hasProductEvent, recordProductEvents } from '@/lib/product-events';
import { MODULE_LABELS, TIER_LABELS, hasModule, minimumTier } from '@/lib/subscription';
import { getServiceSupabase } from '@/lib/supabase';
import { STAGE_TO_GHL } from '@/lib/ghl';
import { resolveRecentAlertAttribution, type SavedGrantAttributionType } from '@/lib/alert-attribution';

type RouteContext = { params: Promise<{ grantId: string }> };

const GHL_SYNC_STAGES = new Set(Object.keys(STAGE_TO_GHL));

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;
  const { user, tier } = auth;

  const { grantId } = await context.params;
  const body = await request.json();
  const {
    stars,
    color,
    stage,
    notes,
    partner_contact_ids,
    org_profile_id,
    source_alert_preference_id,
    source_notification_id,
    source_attribution_type,
  } = body as {
    stars?: number;
    color?: string;
    stage?: string;
    notes?: string;
    partner_contact_ids?: string[];
    org_profile_id?: string;
    source_alert_preference_id?: number | null;
    source_notification_id?: string | null;
    source_attribution_type?: SavedGrantAttributionType | null;
  };

  // Use service role to bypass RLS — user authenticated above
  const serviceDb = getServiceSupabase();

  // If saving for org, verify user is a member with edit access
  if (org_profile_id) {
    if (!hasModule(tier, 'tracker')) {
      const required = minimumTier('tracker');
      return NextResponse.json(
        {
          error: 'Upgrade required',
          module: 'tracker',
          module_label: MODULE_LABELS.tracker,
          current_tier: tier,
          required_tier: required,
          required_tier_label: TIER_LABELS[required],
          upgrade_url: '/pricing',
        },
        { status: 403 }
      );
    }

    const { data: membership } = await serviceDb
      .from('org_members')
      .select('role')
      .eq('org_profile_id', org_profile_id)
      .eq('user_id', user.id)
      .in('role', ['admin', 'editor'])
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Not authorized to edit org grants' }, { status: 403 });
    }
  }

  const { data: existingSavedGrant, error: existingSavedGrantError } = await serviceDb
    .from('saved_grants')
    .select('stage, source_alert_preference_id, source_notification_id, source_attribution_type, source_attributed_at')
    .eq('user_id', user.id)
    .eq('grant_id', grantId)
    .maybeSingle();

  if (existingSavedGrantError) {
    return NextResponse.json({ error: existingSavedGrantError.message }, { status: 500 });
  }

  const hasExistingAttribution = Boolean(
    existingSavedGrant?.source_alert_preference_id
    || existingSavedGrant?.source_notification_id
    || existingSavedGrant?.source_attribution_type
  );

  let attributionUpdate:
    | {
      source_alert_preference_id: number | null;
      source_notification_id: string | null;
      source_attribution_type: SavedGrantAttributionType;
      source_attributed_at: string;
    }
    | undefined;

  if (!hasExistingAttribution) {
    if (
      source_alert_preference_id !== undefined
      || source_notification_id !== undefined
      || source_attribution_type !== undefined
    ) {
      attributionUpdate = {
        source_alert_preference_id: source_alert_preference_id ?? null,
        source_notification_id: source_notification_id ?? null,
        source_attribution_type: source_attribution_type ?? 'manual',
        source_attributed_at: new Date().toISOString(),
      };
    } else {
      const recentAttribution = await resolveRecentAlertAttribution(serviceDb, user.id, grantId);
      attributionUpdate = recentAttribution
        ? {
          source_alert_preference_id: recentAttribution.alertPreferenceId,
          source_notification_id: recentAttribution.notificationId,
          source_attribution_type: recentAttribution.attributionType,
          source_attributed_at: recentAttribution.attributedAt,
        }
        : {
          source_alert_preference_id: null,
          source_notification_id: null,
          source_attribution_type: 'manual',
          source_attributed_at: new Date().toISOString(),
        };
    }
  }

  const { data, error } = await serviceDb
    .from('saved_grants')
    .upsert(
      {
        user_id: user.id,
        grant_id: grantId,
        ...(org_profile_id && { org_profile_id }),
        ...(stars !== undefined && { stars }),
        ...(color !== undefined && { color }),
        ...(stage !== undefined && { stage }),
        ...(notes !== undefined && { notes }),
        ...(partner_contact_ids !== undefined && { partner_contact_ids }),
        ...(attributionUpdate || {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,grant_id' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const isNewSavedGrant = !existingSavedGrant;
  const nextStage = stage ?? existingSavedGrant?.stage ?? 'discovered';
  const stageEnteredPipeline = nextStage !== 'discovered' && (existingSavedGrant?.stage == null || existingSavedGrant.stage === 'discovered');
  const productEvents: Parameters<typeof recordProductEvents>[0] = [];

  if (isNewSavedGrant) {
    const { count: existingShortlists, error: shortlistCountError } = await serviceDb
      .from('saved_grants')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (!shortlistCountError && (existingShortlists ?? 0) === 0) {
      productEvents.push({
        userId: user.id,
        orgProfileId: org_profile_id ?? null,
        eventType: 'first_grant_shortlisted',
        metadata: {
          grant_id: grantId,
          source_alert_preference_id: attributionUpdate?.source_alert_preference_id ?? null,
          source_attribution_type: attributionUpdate?.source_attribution_type ?? null,
        },
      });
    }
  }

  if (stageEnteredPipeline) {
    const pipelineAlreadyStarted = await hasProductEvent(user.id, 'pipeline_started');
    if (!pipelineAlreadyStarted) {
      productEvents.push({
        userId: user.id,
        orgProfileId: org_profile_id ?? null,
        eventType: 'pipeline_started',
        metadata: {
          grant_id: grantId,
          stage: nextStage,
        },
      });
    }
  }

  if (productEvents.length > 0) {
    await recordProductEvents(productEvents);
  }

  // Fire-and-forget GHL sync when stage reaches "pursuing" or later
  if (stage && GHL_SYNC_STAGES.has(stage) && process.env.GHL_API_KEY && hasModule(tier, 'tracker')) {
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
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;
  const { user } = auth;

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
