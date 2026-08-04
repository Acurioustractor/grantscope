import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { requireOrgWriteAccess } from '../../_lib/auth';

type RouteContext = { params: Promise<{ orgProfileId: string }> };

const DIRECTIONS = new Set(['given', 'received']);
const CONTRIBUTION_TYPES = new Set(['work', 'introduction', 'advice', 'space', 'art', 'event', 'support', 'other']);
const PAYMENT_STATES = new Set(['paid', 'unpaid', 'not_expected', 'unknown']);

export async function POST(request: Request, context: RouteContext) {
  const { orgProfileId } = await context.params;
  const auth = await requireOrgWriteAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json() as Record<string, unknown>;
  const organisation = typeof body.organisation === 'string' ? body.organisation.trim().slice(0, 240) : '';
  const summary = typeof body.summary === 'string' ? body.summary.trim().slice(0, 1_200) : '';
  const person = typeof body.person === 'string' ? body.person.trim().slice(0, 240) : '';
  const direction = typeof body.direction === 'string' ? body.direction.trim() : '';
  const contributionType = typeof body.contribution_type === 'string' ? body.contribution_type.trim() : '';
  const paymentState = typeof body.payment_state === 'string' ? body.payment_state.trim() : '';
  const sourceEventId = typeof body.source_event_id === 'string' ? body.source_event_id.trim().slice(0, 100) : '';
  const happenedAt = typeof body.happened_at === 'string' && body.happened_at.trim()
    ? body.happened_at.trim()
    : new Date().toISOString();
  const amount = body.amount == null || body.amount === '' ? null : Number(body.amount);

  if (!organisation || !summary || !DIRECTIONS.has(direction) || !CONTRIBUTION_TYPES.has(contributionType) || !PAYMENT_STATES.has(paymentState)) {
    return NextResponse.json({ error: 'Organisation, direction, contribution type, payment state, and summary are required' }, { status: 400 });
  }
  if (Number.isNaN(Date.parse(happenedAt))) {
    return NextResponse.json({ error: 'Contribution date is invalid' }, { status: 400 });
  }
  if (amount != null && (!Number.isFinite(amount) || amount < 0)) {
    return NextResponse.json({ error: 'Amount must be zero or greater' }, { status: 400 });
  }

  let sourceSystem: string | null = null;
  if (sourceEventId) {
    const { data: sourceEvent, error: sourceError } = await auth.serviceDb
      .from('opportunity_context_events')
      .select('id, source_system')
      .eq('id', sourceEventId)
      .eq('org_profile_id', orgProfileId)
      .in('source_system', ['gmail', 'notion'])
      .maybeSingle();
    if (sourceError || !sourceEvent) {
      return NextResponse.json({ error: 'Suggested source evidence was not found' }, { status: 400 });
    }
    sourceSystem = sourceEvent.source_system;
  }

  const now = new Date().toISOString();
  const record = {
    org_profile_id: orgProfileId,
    source_system: 'civicgraph',
    source_type: 'relationship_contribution',
    source_ref: `relationship-contribution:${sourceEventId || crypto.randomUUID()}`,
    title: `${organisation}: ${direction} ${contributionType}`,
    summary,
    actor_name: person || null,
    organisation,
    lane: 'relationship',
    signal_kind: 'relationship_contribution',
    confidence: 1,
    happened_at: new Date(happenedAt).toISOString(),
    metadata: {
      direction,
      contribution_type: contributionType,
      payment_state: paymentState,
      amount,
      recorded_by: auth.userId,
      source_event_id: sourceEventId || null,
      source_system: sourceSystem,
    },
    updated_at: now,
  };
  const write = sourceEventId
    ? auth.serviceDb.from('opportunity_context_events').upsert(record, { onConflict: 'org_profile_id,source_system,source_ref,signal_kind' })
    : auth.serviceDb.from('opportunity_context_events').insert(record);
  const { data, error } = await write.select('id, organisation, actor_name, summary, happened_at, metadata').single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Could not record the exchange' }, { status: 500 });
  }

  revalidatePath('/org/act');
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { orgProfileId } = await context.params;
  const auth = await requireOrgWriteAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json() as Record<string, unknown>;
  const sourceEventId = typeof body.source_event_id === 'string' ? body.source_event_id.trim().slice(0, 100) : '';
  if (!sourceEventId || body.decision !== 'dismissed') {
    return NextResponse.json({ error: 'source_event_id and the dismissed decision are required' }, { status: 400 });
  }

  const { data: sourceEvent, error: sourceError } = await auth.serviceDb
    .from('opportunity_context_events')
    .select('id, source_system, title, summary, organisation, happened_at')
    .eq('id', sourceEventId)
    .eq('org_profile_id', orgProfileId)
    .in('source_system', ['gmail', 'notion'])
    .maybeSingle();
  if (sourceError || !sourceEvent) {
    return NextResponse.json({ error: 'Suggested source evidence was not found' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { data, error } = await auth.serviceDb.from('opportunity_context_events').upsert({
    org_profile_id: orgProfileId,
    source_system: 'civicgraph',
    source_type: 'relationship_contribution_review',
    source_ref: `relationship-contribution-review:${sourceEventId}`,
    title: `Dismissed exchange suggestion: ${sourceEvent.title}`,
    summary: sourceEvent.summary,
    organisation: sourceEvent.organisation,
    lane: 'relationship',
    signal_kind: 'relationship_contribution_review',
    confidence: 1,
    happened_at: sourceEvent.happened_at || now,
    metadata: {
      source_event_id: sourceEventId,
      source_system: sourceEvent.source_system,
      decision: 'dismissed',
      reviewed_by: auth.userId,
      reviewed_at: now,
    },
    updated_at: now,
  }, { onConflict: 'org_profile_id,source_system,source_ref,signal_kind' })
    .select('id, metadata')
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Could not dismiss the suggestion' }, { status: 500 });
  }

  revalidatePath('/org/act');
  return NextResponse.json(data);
}
