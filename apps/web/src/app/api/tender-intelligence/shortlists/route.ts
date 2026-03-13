import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import {
  createProcurementShortlist,
  getProcurementTeamMembers,
  getProcurementContext,
  hasApprovalAccess,
  hasEditAccess,
  hasGovernanceAdminAccess,
  hasReopenAccess,
  hasSubmitAccess,
  updateProcurementShortlistSummary,
} from '../_lib/procurement-workspace';

async function canApproveShortlist(
  serviceDb: ReturnType<typeof getServiceSupabase>,
  userId: string,
  shortlistApproverUserId: string | null,
) {
  const { members } = await getProcurementTeamMembers(serviceDb, userId);
  const currentMember = members.find((member) => member.user_id === userId) || null;
  if (currentMember?.is_owner === true || hasGovernanceAdminAccess(currentMember)) {
    return true;
  }

  if (shortlistApproverUserId) {
    return shortlistApproverUserId === userId && hasApprovalAccess(currentMember);
  }

  return hasApprovalAccess(currentMember);
}

export async function POST(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;
  const { user } = auth;

  const serviceDb = getServiceSupabase();
  const context = await getProcurementContext(serviceDb, user.id);

  if (!context.orgProfileId) {
    return NextResponse.json({ error: 'Create an organisation profile before creating a shortlist.' }, { status: 400 });
  }

  if (!hasEditAccess(context.currentUserPermissions)) {
    return NextResponse.json({ error: 'You do not have edit access for this procurement workspace.' }, { status: 403 });
  }

  const body = await request.json();
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : null;

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  try {
    const result = await createProcurementShortlist(serviceDb, user.id, { name, description });
    return NextResponse.json({ shortlist: result.shortlist }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create shortlist';
    const status = message.includes('duplicate') || message.includes('unique') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json();
  const shortlistId = typeof body?.shortlistId === 'string' ? body.shortlistId : null;
  if (!shortlistId) {
    return NextResponse.json({ error: 'shortlistId is required' }, { status: 400 });
  }

  const serviceDb = getServiceSupabase();
  const context = await getProcurementContext(serviceDb, user.id, { shortlistId });
  if (!context.orgProfileId || !context.shortlist) {
    return NextResponse.json({ error: 'No procurement workspace found.' }, { status: 404 });
  }
  const reopenForChanges = body?.reopenForChanges === true;

  const nextApprovalStatus = body?.approvalStatus === 'draft'
    || body?.approvalStatus === 'review_ready'
    || body?.approvalStatus === 'submitted'
    || body?.approvalStatus === 'approved'
    || body?.approvalStatus === 'changes_requested'
    ? body.approvalStatus
    : undefined;

  const requestedPackExportId = typeof body?.lastPackExportId === 'string' ? body.lastPackExportId : body?.lastPackExportId === null ? null : undefined;
  const effectivePackExportId = requestedPackExportId === undefined
    ? context.shortlist.last_pack_export_id
    : requestedPackExportId;
  const nextApproverUserId = typeof body?.approverUserId === 'string'
    ? body.approverUserId
    : body?.approverUserId === null
      ? null
      : context.shortlist.approver_user_id;
  const nextOwnerUserId = typeof body?.ownerUserId === 'string'
    ? body.ownerUserId
    : body?.ownerUserId === null
      ? null
      : context.shortlist.owner_user_id;
  const { members } = await getProcurementTeamMembers(serviceDb, user.id);
  const distinctMembers = members.filter((member) => member.procurement_role !== 'observer' || member.is_owner);
  const requiresSeparateApprover = distinctMembers.length > 1;
  const nextApproverMember = nextApproverUserId
    ? members.find((member) => member.user_id === nextApproverUserId) || null
    : null;

  if (reopenForChanges && !hasReopenAccess(context.currentUserPermissions)) {
    return NextResponse.json(
      { error: 'Only procurement leads can reopen an approved shortlist.' },
      { status: 403 },
    );
  }

  if (!reopenForChanges && nextApprovalStatus === undefined && !hasEditAccess(context.currentUserPermissions)) {
    return NextResponse.json({ error: 'You do not have edit access for this procurement workspace.' }, { status: 403 });
  }

  if (nextApprovalStatus === 'submitted' && !hasSubmitAccess(context.currentUserPermissions)) {
    return NextResponse.json(
      { error: 'You do not have permission to submit this shortlist for sign-off.' },
      { status: 403 },
    );
  }

  if ((nextApprovalStatus === 'submitted' || nextApprovalStatus === 'approved') && !effectivePackExportId) {
    return NextResponse.json(
      { error: 'Generate a decision pack before submitting or approving this shortlist.' },
      { status: 400 },
    );
  }

  if ((nextApprovalStatus === 'submitted' || nextApprovalStatus === 'approved') && effectivePackExportId) {
    const { data: packExport, error: packExportError } = await serviceDb
      .from('procurement_pack_exports')
      .select('id, created_at')
      .eq('id', effectivePackExportId)
      .eq('shortlist_id', context.shortlist.id)
      .maybeSingle();

    if (packExportError) {
      return NextResponse.json({ error: packExportError.message }, { status: 500 });
    }

    if (!packExport) {
      return NextResponse.json(
        { error: 'The selected decision pack could not be found for this shortlist.' },
        { status: 404 },
      );
    }

    if (new Date(context.shortlist.updated_at).getTime() > new Date(packExport.created_at).getTime()) {
      return NextResponse.json(
        { error: 'This shortlist changed after the latest pack export. Generate a fresh decision pack before sign-off.' },
        { status: 400 },
      );
    }
  }

  if ((nextApprovalStatus === 'approved' || nextApprovalStatus === 'changes_requested') && context.shortlist.approval_status !== 'submitted') {
    return NextResponse.json(
      { error: 'Submit this shortlist for sign-off before recording an approval decision.' },
      { status: 400 },
    );
  }

  if (nextApprovalStatus === 'submitted' && requiresSeparateApprover) {
    if (!nextApproverUserId) {
      return NextResponse.json(
        { error: 'Assign an approver before submitting this shortlist for sign-off.' },
        { status: 400 },
      );
    }
    if (nextOwnerUserId && nextApproverUserId === nextOwnerUserId) {
      return NextResponse.json(
        { error: 'Assign a different approver so shortlist review and approval stay separate.' },
        { status: 400 },
      );
    }
  }

  if (nextApproverUserId && !nextApproverMember) {
    return NextResponse.json(
      { error: 'The selected approver is not part of this procurement workspace.' },
      { status: 400 },
    );
  }

  if (nextApproverMember && !hasApprovalAccess(nextApproverMember)) {
    return NextResponse.json(
      { error: 'Assign an approver with procurement approval access.' },
      { status: 400 },
    );
  }

  if (nextApprovalStatus === 'approved' || nextApprovalStatus === 'changes_requested') {
    const canApprove = await canApproveShortlist(
      serviceDb,
      user.id,
      nextApproverUserId,
    );
    if (!canApprove) {
      return NextResponse.json(
        { error: 'Only the assigned approver or workspace owner can approve or request changes.' },
        { status: 403 },
      );
    }
  }

  try {
    const result = await updateProcurementShortlistSummary(serviceDb, user.id, {
      shortlistId,
      recommendationSummary: typeof body?.recommendationSummary === 'string' ? body.recommendationSummary : body?.recommendationSummary === null ? null : undefined,
      whyNow: typeof body?.whyNow === 'string' ? body.whyNow : body?.whyNow === null ? null : undefined,
      riskSummary: typeof body?.riskSummary === 'string' ? body.riskSummary : body?.riskSummary === null ? null : undefined,
      nextAction: typeof body?.nextAction === 'string' ? body.nextAction : body?.nextAction === null ? null : undefined,
      ownerName: typeof body?.ownerName === 'string' ? body.ownerName : body?.ownerName === null ? null : undefined,
      ownerUserId: typeof body?.ownerUserId === 'string' ? body.ownerUserId : body?.ownerUserId === null ? null : undefined,
      approverUserId: typeof body?.approverUserId === 'string' ? body.approverUserId : body?.approverUserId === null ? null : undefined,
      decisionDueAt: typeof body?.decisionDueAt === 'string' ? body.decisionDueAt : body?.decisionDueAt === null ? null : undefined,
      approvalStatus: nextApprovalStatus,
      approvalNotes: typeof body?.approvalNotes === 'string' ? body.approvalNotes : body?.approvalNotes === null ? null : undefined,
      lastPackExportId: requestedPackExportId,
      approvedPackExportId:
        nextApprovalStatus === 'approved'
          ? effectivePackExportId || null
          : undefined,
      reopenForChanges,
    });
    return NextResponse.json({ shortlist: result.shortlist });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update shortlist summary' },
      { status: 500 },
    );
  }
}
