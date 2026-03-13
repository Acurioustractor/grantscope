import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import {
  createProcurementTasks,
  getProcurementContext,
  hasTaskAccess,
  updateProcurementTask,
} from '../_lib/procurement-workspace';

export async function POST(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json();
  const shortlistId = typeof body?.shortlistId === 'string' ? body.shortlistId : null;
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (!shortlistId || !title) {
    return NextResponse.json({ error: 'shortlistId and title are required' }, { status: 400 });
  }

  const serviceDb = getServiceSupabase();
  const context = await getProcurementContext(serviceDb, user.id, { shortlistId });
  if (!context.orgProfileId || !context.shortlist) {
    return NextResponse.json({ error: 'No procurement workspace found.' }, { status: 404 });
  }
  if (!hasTaskAccess(context.currentUserPermissions)) {
    return NextResponse.json({ error: 'You do not have task access for this procurement workspace.' }, { status: 403 });
  }

  try {
    const tasks = await createProcurementTasks(serviceDb, {
      orgProfileId: context.orgProfileId,
      shortlistId: context.shortlist.id,
      userId: user.id,
      tasks: [{
        shortlistItemId: typeof body?.shortlistItemId === 'string' ? body.shortlistItemId : null,
        taskType: body?.taskType === 'evidence_check' || body?.taskType === 'pack_refresh' ? body.taskType : 'follow_up',
        title,
        description: typeof body?.description === 'string' ? body.description : null,
        priority: body?.priority === 'low' || body?.priority === 'high' || body?.priority === 'critical' ? body.priority : 'medium',
        dueAt: typeof body?.dueAt === 'string' ? body.dueAt : null,
        assigneeLabel: typeof body?.assigneeLabel === 'string' ? body.assigneeLabel : null,
        assigneeUserId: typeof body?.assigneeUserId === 'string' ? body.assigneeUserId : null,
        completionOutcome: body?.completionOutcome === 'resolved'
          || body?.completionOutcome === 'follow_up_required'
          || body?.completionOutcome === 'escalated'
          || body?.completionOutcome === 'approved_to_proceed'
          || body?.completionOutcome === 'excluded'
          ? body.completionOutcome
          : null,
        completionNote: typeof body?.completionNote === 'string' ? body.completionNote : null,
        taskKey: typeof body?.taskKey === 'string' ? body.taskKey : null,
        metadata: typeof body?.metadata === 'object' && body.metadata ? body.metadata : {},
      }],
    });
    return NextResponse.json({ task: tasks[0] || null }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create procurement task' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json();
  const taskId = typeof body?.taskId === 'string' ? body.taskId : '';
  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
  }

  try {
    const serviceDb = getServiceSupabase();
    const result = await updateProcurementTask(serviceDb, user.id, {
      taskId,
      shortlistId: typeof body?.shortlistId === 'string' ? body.shortlistId : null,
      status: body?.status === 'open' || body?.status === 'in_progress' || body?.status === 'done' ? body.status : undefined,
      priority: body?.priority === 'low' || body?.priority === 'medium' || body?.priority === 'high' || body?.priority === 'critical' ? body.priority : undefined,
      dueAt: typeof body?.dueAt === 'string' ? body.dueAt : body?.dueAt === null ? null : undefined,
      assigneeLabel: typeof body?.assigneeLabel === 'string' ? body.assigneeLabel : body?.assigneeLabel === null ? null : undefined,
      assigneeUserId: typeof body?.assigneeUserId === 'string' ? body.assigneeUserId : body?.assigneeUserId === null ? null : undefined,
      completionOutcome: body?.completionOutcome === 'resolved'
        || body?.completionOutcome === 'follow_up_required'
        || body?.completionOutcome === 'escalated'
        || body?.completionOutcome === 'approved_to_proceed'
        || body?.completionOutcome === 'excluded'
        ? body.completionOutcome
        : body?.completionOutcome === null
          ? null
          : undefined,
      completionNote: typeof body?.completionNote === 'string' ? body.completionNote : body?.completionNote === null ? null : undefined,
      title: typeof body?.title === 'string' ? body.title : undefined,
      description: typeof body?.description === 'string' ? body.description : body?.description === null ? null : undefined,
      shortlistItemId: typeof body?.shortlistItemId === 'string' ? body.shortlistItemId : body?.shortlistItemId === null ? null : undefined,
      metadata: typeof body?.metadata === 'object' && body.metadata ? body.metadata : undefined,
    });
    return NextResponse.json({ task: result.task });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update procurement task' },
      { status: 500 },
    );
  }
}
