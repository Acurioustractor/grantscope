'use server';

import { revalidatePath } from 'next/cache';
import { getServiceSupabase } from '@/lib/supabase';
import { requireWriteAccess, type ActionResult } from '@/lib/services/goods-write-guard';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const APPLICATION_STATES = new Set(['researching', 'concept', 'invited', 'drafting', 'ready', 'submitted', 'due_diligence', 'decided', 'withdrawn', 'closed']);
const ELIGIBILITY_STATES = new Set(['unknown', 'conditional', 'eligible', 'ineligible']);
const COMMITMENT_STATES = new Set(['none', 'proposed', 'offered', 'accepted', 'fulfilled', 'changed', 'declined', 'released', 'contested']);
const EVIDENCE_FORMS = new Set(['none', 'verbal', 'email', 'letter', 'executed_agreement']);
const MATCH_STATES = new Set(['unknown', 'eligible', 'ineligible']);

function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function nonNegative(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value));
}

function revalidateGoods(slug: string, routeCode?: string) {
  revalidatePath(`/org/${slug}/goods/today`);
  revalidatePath(`/org/${slug}/goods/capital`);
  revalidatePath(`/org/${slug}/goods/matters`);
  revalidatePath(`/org/${slug}/goods/network`);
  revalidatePath(`/org/${slug}/goods/applications`);
  revalidatePath(`/org/${slug}/goods/learning`);
  if (routeCode) revalidatePath(`/org/${slug}/goods/applications/${routeCode}`);
}

export async function saveFundingRouteFacts(input: {
  slug: string;
  routeId: string;
  routeCode: string;
  namedRoute: string | null;
  instrumentLabel: string | null;
  legalRecipientName: string | null;
  eligibilityState: string;
  applicationState: string;
  targetAmountAud: number | null;
  askMade: boolean;
  decisionDueAt: string | null;
  nextAction: string | null;
  nextActionOwner: string | null;
  nextActionDue: string | null;
}): Promise<ActionResult> {
  const denied = await requireWriteAccess();
  if (denied) return denied;
  if (!UUID.test(input.routeId)) return { ok: false, error: 'The persisted funding route is not available in this environment.' };
  if (!ELIGIBILITY_STATES.has(input.eligibilityState)) return { ok: false, error: 'Invalid eligibility state.' };
  if (!APPLICATION_STATES.has(input.applicationState)) return { ok: false, error: 'Invalid application state.' };

  const db = getServiceSupabase();
  const patch = {
    named_route: text(input.namedRoute),
    instrument_label: text(input.instrumentLabel),
    legal_recipient_name: text(input.legalRecipientName),
    eligibility_state: input.eligibilityState,
    application_state: input.applicationState,
    target_amount_aud: nonNegative(input.targetAmountAud),
    ask_made_at: input.askMade ? new Date().toISOString() : null,
    decision_due_at: text(input.decisionDueAt),
    next_action: text(input.nextAction),
    next_action_owner: text(input.nextActionOwner),
    next_action_due: text(input.nextActionDue),
  };
  const { error } = await db.from('goods_funding_routes').update(patch).eq('id', input.routeId);
  if (error) return { ok: false, error: error.message };
  revalidateGoods(input.slug, input.routeCode);
  return { ok: true };
}

export async function saveRouteAllocation(input: {
  slug: string;
  routeId: string;
  routeCode: string;
  capitalBlockId: string;
  proposedAmountAud: number | null;
  acceptedAmountAud: number | null;
  restrictions: string | null;
  allocationEvidenceRef: string | null;
}): Promise<ActionResult> {
  const denied = await requireWriteAccess();
  if (denied) return denied;
  if (!UUID.test(input.routeId) || !UUID.test(input.capitalBlockId)) {
    return { ok: false, error: 'Persisted route and capital-block records are required before allocating money.' };
  }
  const proposed = nonNegative(input.proposedAmountAud);
  const accepted = nonNegative(input.acceptedAmountAud);
  if (proposed == null && accepted == null) return { ok: false, error: 'Enter a proposed or accepted allocation amount.' };

  const db = getServiceSupabase();
  const { error } = await db.from('goods_route_allocations').upsert({
    route_id: input.routeId,
    capital_block_id: input.capitalBlockId,
    proposed_amount_aud: proposed,
    accepted_amount_aud: accepted,
    restrictions: text(input.restrictions),
    allocation_evidence_ref: text(input.allocationEvidenceRef),
  }, { onConflict: 'route_id,capital_block_id' });
  if (error) return { ok: false, error: error.message };
  revalidateGoods(input.slug, input.routeCode);
  return { ok: true };
}

export async function saveCommitmentEvidence(input: {
  slug: string;
  routeId: string;
  routeCode: string;
  commitmentState: string;
  commitmentAmountAud: number | null;
  evidenceForm: string;
  evidenceRef: string | null;
  matchAssessment: string;
  matchAssessmentReason: string | null;
}): Promise<ActionResult> {
  const denied = await requireWriteAccess();
  if (denied) return denied;
  if (!UUID.test(input.routeId)) return { ok: false, error: 'The persisted funding route is not available in this environment.' };
  if (!COMMITMENT_STATES.has(input.commitmentState)) return { ok: false, error: 'Invalid commitment state.' };
  if (!EVIDENCE_FORMS.has(input.evidenceForm)) return { ok: false, error: 'Invalid evidence form.' };
  if (!MATCH_STATES.has(input.matchAssessment)) return { ok: false, error: 'Invalid QBE match assessment.' };
  const amount = nonNegative(input.commitmentAmountAud);
  const evidenceRef = text(input.evidenceRef);
  if (input.commitmentState !== 'none' && amount == null) return { ok: false, error: 'A commitment state requires an amount.' };
  if (input.evidenceForm !== 'none' && !evidenceRef) return { ok: false, error: 'Name or link the written evidence.' };
  if (['accepted', 'fulfilled'].includes(input.commitmentState) && !['letter', 'executed_agreement'].includes(input.evidenceForm)) {
    return { ok: false, error: 'Accepted capital needs a letter or executed agreement before it can be recorded as evidence-backed.' };
  }

  const db = getServiceSupabase();
  const { error } = await db.from('goods_funding_routes').update({
    commitment_state: input.commitmentState,
    commitment_amount_aud: input.commitmentState === 'none' ? null : amount,
    commitment_evidence_form: input.evidenceForm,
    commitment_evidence_ref: evidenceRef,
    match_assessment: input.matchAssessment,
    match_assessment_reason: text(input.matchAssessmentReason),
  }).eq('id', input.routeId);
  if (error) return { ok: false, error: error.message };
  revalidateGoods(input.slug, input.routeCode);
  return { ok: true };
}
