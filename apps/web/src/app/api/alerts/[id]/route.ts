import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { recordAlertEvents } from '@/lib/alert-events';
import { getAlertEntitlements } from '@/lib/subscription';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * PATCH /api/alerts/[id] — update alert
 * DELETE /api/alerts/[id] — delete alert
 */

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;
  const { user, tier } = auth;

  const { id } = await params;
  const body = await request.json();
  const entitlements = getAlertEntitlements(tier);
  const optimizationEvent = body.optimization_event as
    | {
      action?: string;
      recommendation_title?: string;
      previous_frequency?: string | null;
      next_frequency?: string | null;
    }
    | undefined;

  const updatePayload = {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
    ...(body.frequency !== undefined ? { frequency: body.frequency } : {}),
    ...(body.categories !== undefined ? { categories: body.categories } : {}),
    ...(body.focus_areas !== undefined ? { focus_areas: body.focus_areas } : {}),
    ...(body.states !== undefined ? { states: body.states } : {}),
    ...(body.min_amount !== undefined ? { min_amount: body.min_amount } : {}),
    ...(body.max_amount !== undefined ? { max_amount: body.max_amount } : {}),
    ...(body.keywords !== undefined ? { keywords: body.keywords } : {}),
    ...(body.entity_types !== undefined ? { entity_types: body.entity_types } : {}),
    updated_at: new Date().toISOString(),
  };

  if (body.frequency && !entitlements.frequencies.includes(body.frequency)) {
    return NextResponse.json(
      {
        error: 'This alert frequency is not available on your current plan.',
        tier,
        allowed_frequencies: entitlements.frequencies,
        upgrade_url: '/pricing',
      },
      { status: 403 }
    );
  }

  const db = getServiceSupabase();
  const { data, error } = await db
    .from('alert_preferences')
    .update(updatePayload)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAlertEvents([
    {
      userId: user.id,
      alertPreferenceId: data.id,
      eventType: 'alert_updated',
      metadata: {
        frequency: data.frequency,
        enabled: data.enabled,
      },
    },
    ...(optimizationEvent
      ? [{
        userId: user.id,
        alertPreferenceId: data.id,
        eventType: 'optimization_applied' as const,
        metadata: {
          action: optimizationEvent.action || null,
          recommendation_title: optimizationEvent.recommendation_title || null,
          previous_frequency: optimizationEvent.previous_frequency || null,
          next_frequency: optimizationEvent.next_frequency || null,
          result_enabled: data.enabled,
          result_frequency: data.frequency,
        },
      }]
      : []),
  ]);

  return NextResponse.json({ alert: data });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;
  const { user } = auth;

  const { id } = await params;
  const db = getServiceSupabase();
  const { error } = await db
    .from('alert_preferences')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAlertEvents([
    {
      userId: user.id,
      alertPreferenceId: Number(id),
      eventType: 'alert_deleted',
      metadata: {},
    },
  ]);
  return NextResponse.json({ deleted: true });
}
