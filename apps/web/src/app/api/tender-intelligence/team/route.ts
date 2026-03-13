import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import {
  createProcurementTeamInvite,
  getProcurementContext,
  hasGovernanceAdminAccess,
  updateProcurementTeamMemberSetting,
} from '../_lib/procurement-workspace';
import { sendEmail } from '@/lib/gmail';

function buildInviteEmail(params: {
  email: string;
  profileName: string;
  procurementRole: string;
  notificationMode: string;
  status: string;
}) {
  const actionLine = params.status.startsWith('pending')
    ? 'Create or sign in to your CivicGraph account to accept the invitation and open Tender Intelligence.'
    : 'Sign in to CivicGraph to open Tender Intelligence and access the procurement workspace.';

  return {
    subject: `${params.profileName} invited you into a CivicGraph procurement workspace`,
    body: [
      `Hi,`,
      '',
      `${params.profileName} invited ${params.email} into its CivicGraph procurement workspace.`,
      `Procurement role: ${params.procurementRole}`,
      `Notification mode: ${params.notificationMode}`,
      '',
      actionLine,
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
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  if (!email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }

  const procurementRole = body?.procurementRole === 'lead'
    || body?.procurementRole === 'reviewer'
    || body?.procurementRole === 'approver'
    || body?.procurementRole === 'observer'
    ? body.procurementRole
    : 'reviewer';
  const notificationMode = body?.notificationMode === 'immediate'
    || body?.notificationMode === 'daily_digest'
    || body?.notificationMode === 'none'
    ? body.notificationMode
    : 'immediate';
  const orgRole = body?.orgRole === 'admin' || body?.orgRole === 'editor' || body?.orgRole === 'viewer'
    ? body.orgRole
    : 'viewer';

  const serviceDb = getServiceSupabase();
  const context = await getProcurementContext(serviceDb, user.id);
  if (!context.orgProfileId) {
    return NextResponse.json({ error: 'No procurement workspace found.' }, { status: 404 });
  }
  if (!hasGovernanceAdminAccess(context.currentUserPermissions)) {
    return NextResponse.json({ error: 'Only procurement leads can invite team members.' }, { status: 403 });
  }

  try {
    const result = await createProcurementTeamInvite(serviceDb, user.id, {
      email,
          procurementRole,
          notificationMode,
          orgRole,
          permissionOverrides: typeof body?.permissionOverrides === 'object' && body.permissionOverrides ? body.permissionOverrides : undefined,
        });

    void (async () => {
      try {
        const inviteEmail = buildInviteEmail({
          email: result.email,
          profileName: result.profileName,
          procurementRole: result.procurementRole,
          notificationMode: result.notificationMode,
          status: result.status,
        });
        await sendEmail({
          to: result.email,
          subject: inviteEmail.subject,
          body: inviteEmail.body,
          senderName: 'CivicGraph Procurement',
        });
      } catch (error) {
        console.error('Procurement team invite email failed:', error);
      }
    })();

    return NextResponse.json(result, { status: result.status === 'member_added' || result.status === 'pending_created' ? 201 : 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to invite procurement team member' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json();
  const targetUserId = typeof body?.targetUserId === 'string' ? body.targetUserId : '';
  if (!targetUserId) {
    return NextResponse.json({ error: 'targetUserId is required' }, { status: 400 });
  }

  const serviceDb = getServiceSupabase();
  const context = await getProcurementContext(serviceDb, user.id);
  if (!context.orgProfileId) {
    return NextResponse.json({ error: 'No procurement workspace found.' }, { status: 404 });
  }

  if (!hasGovernanceAdminAccess(context.currentUserPermissions)) {
    return NextResponse.json({ error: 'Only procurement leads can update procurement team settings.' }, { status: 403 });
  }

  const procurementRole = body?.procurementRole === 'lead'
    || body?.procurementRole === 'reviewer'
    || body?.procurementRole === 'approver'
    || body?.procurementRole === 'observer'
    ? body.procurementRole
    : undefined;
  const notificationMode = body?.notificationMode === 'immediate'
    || body?.notificationMode === 'daily_digest'
    || body?.notificationMode === 'none'
    ? body.notificationMode
    : undefined;
  const permissionOverrides = typeof body?.permissionOverrides === 'object' && body.permissionOverrides
    ? body.permissionOverrides
    : undefined;

  if (!procurementRole && !notificationMode && !permissionOverrides) {
    return NextResponse.json({ error: 'Provide procurementRole, notificationMode, or permissionOverrides to update.' }, { status: 400 });
  }

  try {
    const result = await updateProcurementTeamMemberSetting(serviceDb, user.id, {
      targetUserId,
      procurementRole,
      notificationMode,
      permissionOverrides,
    });
    return NextResponse.json({ setting: result.setting });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update procurement team settings' },
      { status: 500 },
    );
  }
}
