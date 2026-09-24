import { getServiceSupabase } from '@/lib/supabase';

/** The desk's one decision record: Pursue, Pass, Save for later, on any grant, funder or buyer.
 *
 *  Stored in opportunity_decisions, append-only. Each new decision on the same
 *  (source_type, source_ref, project_code) supersedes the last, so the latest row is the state and the
 *  earlier rows are the history. No migration: the table and its decision CHECK already hold the verbs.
 *
 *  A Pass with the reason "Wrong project" is also a verdict on the tag. The nightly keyword and Jev scorers
 *  read it (scripts/lib/human-verdicts.mjs) and keep that project's tag off the grant. */

export type DeskDecisionKind = 'grant' | 'funder' | 'buyer';
export const DESK_DECISION_KINDS: readonly DeskDecisionKind[] = ['grant', 'funder', 'buyer'];

export type DeskVerb = 'pursue' | 'pass' | 'later' | 'undo';
export const DESK_VERBS: readonly DeskVerb[] = ['pursue', 'pass', 'later', 'undo'];

/** Verb to the opportunity_decisions.decision vocabulary (CHECK constraint). 'review' = back on the desk. */
export const VERB_DECISION: Record<DeskVerb, string> = {
  pursue: 'apply',
  pass: 'no',
  later: 'later',
  undo: 'review',
};

export type PassReason = 'wrong_project' | 'cannot_apply' | 'not_now';
export const PASS_REASONS: readonly PassReason[] = ['wrong_project', 'cannot_apply', 'not_now'];
export const PASS_REASON_LABEL: Record<PassReason, string> = {
  wrong_project: 'Wrong project',
  cannot_apply: "We can't apply",
  not_now: 'Not this time',
};

export type DeskDecisionState = 'pursuing' | 'passed' | 'saved' | 'open';

export interface DeskDecision {
  id: string;
  state: DeskDecisionState;
  reason: string | null;
  notes: string | null;
  at: string;
}

export interface DecisionRow {
  id: string;
  source_type: string;
  source_ref: string;
  project_code: string | null;
  decision: string;
  reason: string | null;
  notes: string | null;
  created_at: string;
}

export function decisionKey(kind: string, ref: string, projectCode: string | null | undefined): string {
  return `${kind}|${ref}|${projectCode ?? ''}`;
}

export function decisionState(decision: string): DeskDecisionState {
  if (decision === 'apply' || decision === 'send_to_ghl') return 'pursuing';
  if (decision === 'no') return 'passed';
  if (decision === 'later') return 'saved';
  return 'open';
}

/** Pure: the latest row per key wins. */
export function latestDecisions(rows: DecisionRow[]): Map<string, DeskDecision> {
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const out = new Map<string, DeskDecision>();
  for (const r of sorted) {
    out.set(decisionKey(r.source_type, r.source_ref, r.project_code), {
      id: r.id,
      state: decisionState(r.decision),
      reason: r.reason,
      notes: r.notes,
      at: r.created_at,
    });
  }
  return out;
}

/** Is this Pass a verdict that the project tag is wrong? The three passes of 2026-08-11 predate the reason
 *  code and read "Not relevant to Goods on Country"; they count. Keep in step with scripts/lib/human-verdicts.mjs. */
export function isWrongProject(reason: string | null | undefined): boolean {
  if (!reason) return false;
  return reason === 'wrong_project' || /^not relevant to/i.test(reason);
}

export function passReasonLabel(reason: string | null | undefined): string {
  if (!reason) return 'No reason given';
  if ((PASS_REASONS as readonly string[]).includes(reason)) return PASS_REASON_LABEL[reason as PassReason];
  return reason;
}

export async function getDeskDecisions(orgProfileId: string): Promise<Map<string, DeskDecision>> {
  const db = getServiceSupabase();
  const { data, error } = await db
    .from('opportunity_decisions')
    .select('id, source_type, source_ref, project_code, decision, reason, notes, created_at')
    .eq('org_profile_id', orgProfileId)
    .in('source_type', [...DESK_DECISION_KINDS])
    .order('created_at', { ascending: true })
    .limit(5000);
  if (error) throw new Error(`desk decisions: ${error.message}`);
  return latestDecisions((data ?? []) as DecisionRow[]);
}
