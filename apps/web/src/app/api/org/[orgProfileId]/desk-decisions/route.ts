import { NextRequest, NextResponse } from 'next/server';
import { requireOrgWriteAccess } from '../../_lib/auth';
import { pursueGrantInGhl } from '@/lib/services/act-desk-ghl';
import {
  DESK_DECISION_KINDS, DESK_VERBS, PASS_REASONS, VERB_DECISION,
  type DeskDecisionKind, type DeskVerb, type PassReason,
} from '@/lib/services/act-desk-decisions';

type Params = { params: Promise<{ orgProfileId: string }> };

function text(v: unknown, limit = 400): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, limit) : null;
}

/** What the row showed when the decision was made (fit, Jev, who tagged it), so a later measurement can
 *  compare Ben's verdicts with the scorers'. Flat scalars only, capped. */
function judgment(v: unknown): Record<string, string | number | boolean | null> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>).slice(0, 20)) {
    if (val === null || typeof val === 'number' || typeof val === 'boolean') out[k.slice(0, 40)] = val;
    else if (typeof val === 'string') out[k.slice(0, 40)] = val.slice(0, 200);
  }
  return out;
}

// Record Pursue, Pass, Save for later, or Undo on a desk row. Append-only: the new row supersedes the
// latest decision on the same grant/funder/buyer and project.
export async function POST(request: NextRequest, { params }: Params) {
  const { orgProfileId } = await params;
  const auth = await requireOrgWriteAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const kind = DESK_DECISION_KINDS.find((k) => k === body.kind) as DeskDecisionKind | undefined;
  const verb = DESK_VERBS.find((v) => v === body.verb) as DeskVerb | undefined;
  const ref = text(body.ref, 120);
  const projectCode = text(body.project_code, 20);
  const reason = PASS_REASONS.find((r) => r === body.reason) as PassReason | undefined;
  if (!kind || !verb || !ref) {
    return NextResponse.json({ error: 'kind (grant|funder|buyer), verb (pursue|pass|later|undo) and ref are required' }, { status: 400 });
  }
  if (verb === 'pass' && !reason) {
    return NextResponse.json({ error: 'A pass needs a reason: wrong_project, cannot_apply or not_now' }, { status: 400 });
  }

  let latest = auth.serviceDb
    .from('opportunity_decisions')
    .select('id')
    .eq('org_profile_id', orgProfileId)
    .eq('source_type', kind)
    .eq('source_ref', ref)
    .order('created_at', { ascending: false })
    .limit(1);
  latest = projectCode ? latest.eq('project_code', projectCode) : latest.is('project_code', null);
  const { data: prior, error: priorErr } = await latest;
  if (priorErr) return NextResponse.json({ error: priorErr.message }, { status: 500 });

  const { data, error } = await auth.serviceDb
    .from('opportunity_decisions')
    .insert({
      org_profile_id: orgProfileId,
      user_id: auth.userId,
      source_type: kind,
      source_ref: ref,
      project_code: projectCode,
      decision: VERB_DECISION[verb],
      reason: verb === 'pass' ? reason : null,
      notes: text(body.notes, 800),
      judgment: judgment(body.judgment),
      supersedes_id: prior?.[0]?.id ?? null,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Pursue on a grant puts it in the GHL Grants pipeline. The decision stands even if GHL fails; the
  // button says so and a second Pursue retries.
  if (kind === 'grant' && verb === 'pursue') {
    const ghl = await pursueGrantInGhl(auth.serviceDb, ref);
    if (ghl.status !== 'failed') {
      await auth.serviceDb
        .from('opportunity_decisions')
        .update({ judgment: { ...judgment(body.judgment), ghl_opportunity_id: ghl.opportunityId } })
        .eq('id', data.id);
    }
    return NextResponse.json({ id: data.id, ghl });
  }
  return NextResponse.json({ id: data.id });
}
