import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { getProcurementContext, hasGovernanceAdminAccess } from '../../_lib/procurement-workspace';
import { sendEmail } from '@/lib/gmail';

function buildInviteEmail(params: {
  email: string;
  profileName: string;
  procurementRole: string;
  notificationMode: string;
}) {
  return {
    subject: `${params.profileName} invited you into a CivicGraph procurement workspace`,
    body: [
      'Hi,',
      '',
      `${params.profileName} invited ${params.email} into its CivicGraph procurement workspace.`,
      `Procurement role: ${params.procurementRole}`,
      `Notification mode: ${params.notificationMode}`,
      '',
      'Create or sign in to your CivicGraph account to accept the invitation and open Tender Intelligence.',
      'https://civicgraph.au/login',
      '',
      'CivicGraph',
    ].join('\n'),
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json();
  const inviteId = typeof body?.inviteId === 'string' ? body.inviteId : '';
  if (!inviteId) {
    return NextResponse.json({ error: 'inviteId is required' }, { status: 400 });
  }

  const serviceDb = getServiceSupabase();
  const context = await getProcurementContext(serviceDb, user.id);
  if (!context.orgProfileId || !context.profile) {
    return NextResponse.json({ error: 'No procurement workspace found.' }, { status: 404 });
  }
  if (!hasGovernanceAdminAccess(context.currentUserPermissions)) {
    return NextResponse.json({ error: 'Only procurement leads can resend invites.' }, { status: 403 });
  }

  const { data: invite, error: inviteError } = await serviceDb
    .from('org_members')
    .select('id, invited_email, role')
    .eq('org_profile_id', context.orgProfileId)
    .eq('id', inviteId)
    .is('user_id', null)
    .maybeSingle();

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }
  if (!invite?.invited_email) {
    return NextResponse.json({ error: 'Pending invite not found.' }, { status: 404 });
  }

  const { data: inviteSetting, error: settingError } = await serviceDb
    .from('procurement_pending_team_invites')
    .select('procurement_role, notification_mode')
    .eq('org_profile_id', context.orgProfileId)
    .eq('invited_email', invite.invited_email)
    .maybeSingle();

  if (settingError) {
    return NextResponse.json({ error: settingError.message }, { status: 500 });
  }

  const invitedAt = new Date().toISOString();
  const { error: updateError } = await serviceDb
    .from('org_members')
    .update({
      invited_at: invitedAt,
      invited_by: user.id,
    })
    .eq('id', invite.id)
    .eq('org_profile_id', context.orgProfileId)
    .is('user_id', null);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.GOOGLE_DELEGATED_USER) {
    try {
      const email = buildInviteEmail({
        email: invite.invited_email,
        profileName: context.profile.name,
        procurementRole: inviteSetting?.procurement_role || 'reviewer',
        notificationMode: inviteSetting?.notification_mode || 'immediate',
      });
      await sendEmail({
        to: invite.invited_email,
        subject: email.subject,
        body: email.body,
        senderName: 'CivicGraph Procurement',
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Unable to send invite email' },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    inviteId: invite.id,
    invitedAt,
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json();
  const inviteId = typeof body?.inviteId === 'string' ? body.inviteId : '';
  if (!inviteId) {
    return NextResponse.json({ error: 'inviteId is required' }, { status: 400 });
  }

  const serviceDb = getServiceSupabase();
  const context = await getProcurementContext(serviceDb, user.id);
  if (!context.orgProfileId) {
    return NextResponse.json({ error: 'No procurement workspace found.' }, { status: 404 });
  }
  if (!hasGovernanceAdminAccess(context.currentUserPermissions)) {
    return NextResponse.json({ error: 'Only procurement leads can cancel invites.' }, { status: 403 });
  }

  const { data: invite, error: inviteError } = await serviceDb
    .from('org_members')
    .select('id, invited_email')
    .eq('org_profile_id', context.orgProfileId)
    .eq('id', inviteId)
    .is('user_id', null)
    .maybeSingle();

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }
  if (!invite?.invited_email) {
    return NextResponse.json({ error: 'Pending invite not found.' }, { status: 404 });
  }

  const { error: pendingDeleteError } = await serviceDb
    .from('procurement_pending_team_invites')
    .delete()
    .eq('org_profile_id', context.orgProfileId)
    .eq('invited_email', invite.invited_email);

  if (pendingDeleteError) {
    return NextResponse.json({ error: pendingDeleteError.message }, { status: 500 });
  }

  const { error: memberDeleteError } = await serviceDb
    .from('org_members')
    .delete()
    .eq('id', invite.id)
    .eq('org_profile_id', context.orgProfileId)
    .is('user_id', null);

  if (memberDeleteError) {
    return NextResponse.json({ error: memberDeleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inviteId });
}
