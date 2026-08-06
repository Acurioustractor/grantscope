import { NextRequest, NextResponse } from 'next/server';
import { requireOrgWriteAccess } from '../../_lib/auth';

type Params = { params: Promise<{ orgProfileId: string }> };

const OWED_TO = ['funder', 'community'] as const;

function text(v: unknown, limit = 400): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, limit) : null;
}

function isoDate(v: unknown): string | null {
  const s = text(v, 10);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

// Mint an Obligation (delivery spec §4). Minting = acknowledging the promise;
// always human, never automated.
export async function POST(request: NextRequest, { params }: Params) {
  const { orgProfileId } = await params;
  const auth = await requireOrgWriteAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json() as Record<string, unknown>;
  const title = text(body.title, 300);
  const owedTo = OWED_TO.find((t) => t === body.owed_to);
  const projectCode = text(body.project_code, 20);
  if (!title || !owedTo || !projectCode) {
    return NextResponse.json({ error: 'title, owed_to (funder|community), and project_code are required' }, { status: 400 });
  }

  const { data, error } = await auth.serviceDb
    .from('act_obligations')
    .insert({
      org_profile_id: orgProfileId,
      project_code: projectCode,
      title,
      owed_to: owedTo,
      next_action: text(body.next_action, 800),
      due_date: isoDate(body.due_date),
      owner: text(body.owner, 120),
      source_ask_ghl_id: text(body.source_ask_ghl_id, 120),
      source_ask_name: text(body.source_ask_name, 300),
      promised_to: text(body.promised_to, 300),
      artefact_url: text(body.artefact_url, 800),
      community_id: text(body.community_id, 60),
      minted_by: auth.userId,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

// State changes + edits. Done/Dropped are terminal (#147); Dropped on
// community-owed work requires a reason — releasing a promise to community
// has a relationship cost and must be recorded.
export async function PATCH(request: NextRequest, { params }: Params) {
  const { orgProfileId } = await params;
  const auth = await requireOrgWriteAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json() as Record<string, unknown>;
  const id = text(body.id, 60);
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { data: existing, error: readError } = await auth.serviceDb
    .from('act_obligations')
    .select('id, state, owed_to')
    .eq('id', id)
    .eq('org_profile_id', orgProfileId)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Obligation not found' }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const state = text(body.state, 10);
  if (state) {
    if (existing.state !== 'open') {
      return NextResponse.json({ error: 'Done and Dropped are terminal — a resurfaced promise is a new mint' }, { status: 400 });
    }
    if (state === 'done') {
      patch.state = 'done';
      patch.discharged_at = new Date().toISOString();
    } else if (state === 'dropped') {
      const reason = text(body.drop_reason, 800);
      if (existing.owed_to === 'community' && !reason) {
        return NextResponse.json({ error: 'Dropping community-owed work requires a reason' }, { status: 400 });
      }
      patch.state = 'dropped';
      patch.drop_reason = reason;
      patch.discharged_at = new Date().toISOString();
    } else {
      return NextResponse.json({ error: 'state must be done or dropped' }, { status: 400 });
    }
  }
  for (const [key, limit] of [['title', 300], ['next_action', 800], ['owner', 120], ['promised_to', 300], ['artefact_url', 800]] as const) {
    if (key in body) patch[key] = text(body[key], limit);
  }
  if ('due_date' in body) patch.due_date = isoDate(body.due_date);
  // Community tag (ADR 0004) — null untags; the FK rejects unknown ids.
  if ('community_id' in body) patch.community_id = text(body.community_id, 60);
  if ('owed_to' in body) {
    const owedTo = OWED_TO.find((t) => t === body.owed_to);
    if (!owedTo) return NextResponse.json({ error: 'owed_to must be funder or community' }, { status: 400 });
    patch.owed_to = owedTo;
  }

  const { error } = await auth.serviceDb
    .from('act_obligations')
    .update(patch)
    .eq('id', id)
    .eq('org_profile_id', orgProfileId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
