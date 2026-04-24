import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { resolvePilotLinks, sanitizePilotParticipantInput } from '@/lib/pilot-participants';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ pilotId: string }> }) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const { pilotId } = await params;
  const body = await request.json();
  const input = sanitizePilotParticipantInput(body);
  const db = getServiceSupabase();

  const updatePayload: Record<string, unknown> = {
    ...(input.participant_name !== null ? { participant_name: input.participant_name } : {}),
    ...(input.email !== null ? { email: input.email } : {}),
    ...(input.organization_name !== null ? { organization_name: input.organization_name } : {}),
    ...(input.role_title !== null ? { role_title: input.role_title } : {}),
    ...(body.cohort !== undefined ? { cohort: input.cohort } : {}),
    ...(body.stage !== undefined ? { stage: input.stage } : {}),
    ...(body.payment_intent !== undefined ? { payment_intent: input.payment_intent } : {}),
    ...(body.sean_ellis_response !== undefined ? { sean_ellis_response: input.sean_ellis_response } : {}),
    ...(body.pilot_source !== undefined ? { pilot_source: input.pilot_source } : {}),
    ...(body.funding_task !== undefined ? { funding_task: input.funding_task } : {}),
    ...(body.notes !== undefined ? { notes: input.notes } : {}),
    ...(body.last_contact_at !== undefined ? { last_contact_at: input.last_contact_at } : {}),
    ...(body.onboarding_at !== undefined ? { onboarding_at: input.onboarding_at } : {}),
    ...(body.observed_session_at !== undefined ? { observed_session_at: input.observed_session_at } : {}),
    ...(body.closeout_at !== undefined ? { closeout_at: input.closeout_at } : {}),
    updated_at: new Date().toISOString(),
  };

  if (input.email) {
    const { linkedUserId, linkedOrgProfileId } = await resolvePilotLinks(input.email);
    updatePayload.linked_user_id = linkedUserId;
    updatePayload.linked_org_profile_id = linkedOrgProfileId;
  }

  const { data, error } = await db
    .from('pilot_participants')
    .update(updatePayload)
    .eq('id', pilotId)
    .select('*')
    .single();

  if (error) {
    const status = error.code === '23505' ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ pilot: data });
}
