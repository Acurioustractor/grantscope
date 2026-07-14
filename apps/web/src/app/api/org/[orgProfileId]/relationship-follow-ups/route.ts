import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { normaliseRelationshipIdentity } from '@/lib/services/act-relationship-ledger';
import { requireOrgWriteAccess } from '../../_lib/auth';

type RouteContext = { params: Promise<{ orgProfileId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { orgProfileId } = await context.params;
  const auth = await requireOrgWriteAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json() as Record<string, unknown>;
  const organisation = typeof body.organisation === 'string' ? body.organisation.trim().slice(0, 240) : '';
  const action = typeof body.action === 'string' ? body.action.trim().slice(0, 600) : '';
  const owner = typeof body.owner === 'string' ? body.owner.trim().slice(0, 120) : '';
  const dueAt = typeof body.due_at === 'string' ? body.due_at.trim() : '';
  if (!organisation || !action || !owner || !/^\d{4}-\d{2}-\d{2}$/.test(dueAt) || Number.isNaN(Date.parse(dueAt))) {
    return NextResponse.json({ error: 'Organisation, action, owner, and a valid date are required' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const identity = normaliseRelationshipIdentity(organisation).slice(0, 180);
  if (!identity) return NextResponse.json({ error: 'Organisation is invalid' }, { status: 400 });
  const { data, error } = await auth.serviceDb.from('opportunity_context_events').upsert({
    org_profile_id: orgProfileId,
    source_system: 'civicgraph',
    source_type: 'relationship_follow_up',
    source_ref: `relationship-follow-up:${identity}`,
    source_thread_id: identity,
    title: `${organisation}: follow-up`,
    summary: action,
    organisation,
    lane: 'relationship',
    signal_kind: 'relationship_follow_up',
    confidence: 1,
    happened_at: now,
    metadata: {
      action,
      owner,
      due_at: dueAt,
      status: 'planned',
      completed_at: null,
      recorded_by: auth.userId,
    },
    updated_at: now,
  }, { onConflict: 'org_profile_id,source_system,source_ref,signal_kind' })
    .select('id, organisation, summary, metadata')
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message || 'Could not save the follow-up' }, { status: 500 });

  revalidatePath('/org/act');
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { orgProfileId } = await context.params;
  const auth = await requireOrgWriteAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json() as Record<string, unknown>;
  const followUpId = typeof body.follow_up_id === 'string' ? body.follow_up_id.trim() : '';
  const status = body.status === 'completed' ? 'completed' : body.status === 'planned' ? 'planned' : null;
  if (!followUpId || !status) return NextResponse.json({ error: 'follow_up_id and a valid status are required' }, { status: 400 });

  const { data: existing, error: existingError } = await auth.serviceDb.from('opportunity_context_events')
    .select('id, metadata')
    .eq('id', followUpId)
    .eq('org_profile_id', orgProfileId)
    .eq('signal_kind', 'relationship_follow_up')
    .maybeSingle();
  if (existingError || !existing) return NextResponse.json({ error: 'Relationship follow-up was not found' }, { status: 404 });

  const now = new Date().toISOString();
  const metadata = existing.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata)
    ? existing.metadata as Record<string, unknown>
    : {};
  const { data, error } = await auth.serviceDb.from('opportunity_context_events').update({
    metadata: { ...metadata, status, completed_at: status === 'completed' ? now : null, updated_by: auth.userId },
    updated_at: now,
  }).eq('id', followUpId).eq('org_profile_id', orgProfileId).select('id, metadata').single();
  if (error || !data) return NextResponse.json({ error: error?.message || 'Could not update the follow-up' }, { status: 500 });

  revalidatePath('/org/act');
  return NextResponse.json(data);
}
