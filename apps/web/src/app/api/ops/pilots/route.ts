import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { resolvePilotLinks, sanitizePilotParticipantInput } from '@/lib/pilot-participants';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json();
  const input = sanitizePilotParticipantInput(body);

  if (!input.participant_name || !input.email) {
    return NextResponse.json({ error: 'Participant name and email are required.' }, { status: 400 });
  }

  const { linkedUserId, linkedOrgProfileId } = await resolvePilotLinks(input.email);
  const db = getServiceSupabase();

  const { data, error } = await db
    .from('pilot_participants')
    .insert({
      owner_user_id: user.id,
      linked_user_id: linkedUserId,
      linked_org_profile_id: linkedOrgProfileId,
      participant_name: input.participant_name,
      email: input.email,
      organization_name: input.organization_name,
      role_title: input.role_title,
      cohort: input.cohort,
      stage: input.stage,
      payment_intent: input.payment_intent,
      sean_ellis_response: input.sean_ellis_response,
      pilot_source: input.pilot_source,
      funding_task: input.funding_task,
      notes: input.notes,
      last_contact_at: input.last_contact_at,
      onboarding_at: input.onboarding_at,
      observed_session_at: input.observed_session_at,
      closeout_at: input.closeout_at,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    const status = error.code === '23505' ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ pilot: data });
}
