/**
 * Goods Match Campaign — PURE curated data + types + helpers. No server-only
 * imports, so this module is safe to import from client components AND server
 * code. The server join lives in goods-campaign.ts.
 *
 * This is the signed/eligible commitment register for the QBE Catalysing Impact
 * match raise (2026 cohort, via Social Impact Hub). The whole point of this
 * register is to enforce QBE's own rule from their diagnostic:
 *   "Pipeline is not committed capital. QBE match is contingent."
 * So evidence-backed capital and pipeline are kept strictly separate, and no
 * match amount is ever computed until QBE confirms the rules in writing.
 */

/** Kind of capital instrument. Grants route via Butterfly DGR; debt does not. */
export type CapitalKind =
  | 'matched_grant'
  | 'grant'
  | 'recoverable_grant'
  | 'loan'
  | 'catalytic';

/**
 * How committed the source is. Strict ladder — a source only advances past
 * 'eligible' when written evidence is attached. 'signed' is the only state that
 * represents money the funder has put on the record. 'parked' is off-ladder:
 * deliberately out of the active raise (paused, not pursued for now).
 */
export type Commitment =
  | 'target'
  | 'in_conversation'
  | 'eligible'
  | 'signed'
  | 'parked';

/**
 * Whether the source counts toward the QBE match. Held at 'unknown' for every
 * source until QBE's match rules are confirmed in writing — we never assume a
 * source is eligible.
 */
export type MatchEligibility = 'unknown' | 'eligible' | 'ineligible';

export interface CapitalSource {
  id: string;
  name: string;
  kind: CapitalKind;
  /** Dollar ask in AUD, or null when the ask is a label-only range / unconfirmed. */
  askAud: number | null;
  /** Human-facing ask string, always shown verbatim. */
  askLabel: string;
  commitment: Commitment;
  /** One line describing the written evidence on file, or null when none. */
  writtenEvidence: string | null;
  matchEligibility: MatchEligibility;
  /** Name to match against the live goods_relationships registry, or null. */
  registryName: string | null;
  /** Current factual status of the source. */
  status: string;
  /** The single next action that moves this source forward. */
  nextMove: string;
  /**
   * True when the source itself is unverified — i.e. we are not yet sure what it
   * refers to or whether it belongs in the stack. Renders a red VERIFY chip.
   */
  needsVerification?: boolean;
}

export const KIND_LABEL: Record<CapitalKind, string> = {
  matched_grant: 'Matched grant',
  grant: 'Grant',
  recoverable_grant: 'Recoverable grant',
  loan: 'Loan',
  catalytic: 'Catalytic',
};

export const COMMITMENT_LABEL: Record<Commitment, string> = {
  target: 'Target',
  in_conversation: 'In conversation',
  eligible: 'Eligible',
  signed: 'Signed',
  parked: 'Parked',
};

/**
 * Strict left-to-right ladder order for the active board columns. 'parked' is
 * deliberately excluded — parked sources render in a muted strip, not on the
 * active ladder.
 */
export const COMMITMENT_ORDER: Commitment[] = [
  'target',
  'in_conversation',
  'eligible',
  'signed',
];

/**
 * The curated capital stack for the QBE match raise. Every row is a deliberate,
 * human-verified fact, not a live DB read. Each carries a TODO so the numbers
 * get re-checked against the source-of-truth before any external use.
 */
export const CAPITAL_STACK: CapitalSource[] = [
  {
    // TODO(ben-verify): cap reported as up to $400K but UNCONFIRMED in writing.
    id: 'qbe-catalysing-impact',
    name: 'QBE Catalysing Impact',
    kind: 'matched_grant',
    askAud: null,
    askLabel: 'up to $400K (cap unconfirmed)',
    commitment: 'in_conversation',
    writtenEvidence: null,
    matchEligibility: 'unknown',
    registryName: 'QBE',
    status: '2026 cohort via Social Impact Hub; match rules not confirmed in writing',
    nextMove: 'Confirm match rules and cap in writing with Social Impact Hub',
  },
  {
    // TODO(ben-verify): ask amount and decision timing.
    id: 'snow-foundation-r4',
    name: 'Snow Foundation Round 4',
    kind: 'grant',
    askAud: 200_000,
    askLabel: '~$200K',
    commitment: 'in_conversation',
    writtenEvidence: null,
    matchEligibility: 'unknown',
    registryName: 'Snow Foundation',
    status: 'Applied, awaiting decision',
    // email sweep 2026-06-10
    nextMove:
      'Grant WON — agreement sent 19 May. Ask Snow to convert into signed matched-capital LOI. Email contacts: Sally Grimsley-Ballard / Georgie Byron / Maree Meredith (NOT Carolyn Ludovici — no email history).',
  },
  {
    // TODO(ben-verify): LOI scope and loan terms.
    id: 'sefa-loan',
    name: 'SEFA loan',
    kind: 'loan',
    askAud: 300_000,
    askLabel: '~$300K',
    commitment: 'in_conversation',
    writtenEvidence: 'LOI on file (verify scope)',
    matchEligibility: 'unknown',
    registryName: 'SEFA',
    status: 'LOI held; not yet formal',
    // email sweep 2026-06-10
    nextMove:
      'No capital conversation exists in email. Open fresh thread with Chelsea Baker re debt/blended capital LOI.',
  },
  {
    // TODO(ben-verify): PFI EOI status and recoverable-grant terms.
    id: 'pfi-recoverable-grant',
    name: 'PFI recoverable grant',
    kind: 'recoverable_grant',
    askAud: 640_000,
    askLabel: '$640K',
    commitment: 'in_conversation',
    writtenEvidence: null,
    matchEligibility: 'unknown',
    registryName: 'PFI',
    status: 'EOI submitted March 2026',
    // email sweep 2026-06-10
    nextMove:
      "No email substrate found for 'PFI' — founder to confirm what PFI refers to before it stays in the stack.",
    needsVerification: true,
  },
  {
    // TODO(ben-verify): whether IBA debt belongs in this raise at all.
    id: 'iba-business-loan',
    name: 'IBA Business Loan',
    kind: 'loan',
    askAud: null,
    askLabel: 'up to $5M',
    commitment: 'target',
    writtenEvidence: null,
    matchEligibility: 'unknown',
    registryName: 'IBA',
    status: 'Eligibility confirmed; no application lodged',
    // email sweep 2026-06-10
    nextMove: 'No email relationship at all. Source warm intro via SIH or Snow networks.',
  },
  {
    // TODO(ben-verify): Minderoo catalytic frame and ask size.
    id: 'minderoo-catalytic',
    name: 'Minderoo catalytic',
    kind: 'catalytic',
    askAud: 200_000,
    askLabel: '~$200K',
    // email sweep 2026-06-10
    commitment: 'parked',
    writtenEvidence: null,
    matchEligibility: 'unknown',
    registryName: 'Minderoo',
    status: 'Warm; no formal process started',
    nextMove:
      'Lucy Stronach paused justice conversations 14 May (internal). No pitch; light Contained-in-Perth touchpoint July.',
  },
  {
    // TODO(ben-verify): proposal value, board date, and contact still current.
    // email sweep 2026-06-10
    id: 'centrecorp-foundation',
    name: 'Centrecorp Foundation',
    kind: 'grant',
    askAud: null,
    askLabel: 'TBC (130 Stretch Beds proposal)',
    commitment: 'in_conversation',
    writtenEvidence: null,
    matchEligibility: 'unknown',
    registryName: 'Centrecorp',
    status: 'Proposal to Centrecorp board 26 June',
    nextMove:
      '130 Stretch Beds proposal $106,150 (GHL) goes to Centrecorp board 26 June. Last email 13 Feb — confirm agenda + board pack needs with Randle Walker.',
  },
  {
    // TODO(ben-verify): visit dates, attendance, and ask framing.
    // email sweep 2026-06-10
    id: 'bryan-foundation',
    name: 'The Bryan Foundation',
    kind: 'grant',
    askAud: null,
    askLabel: 'TBC',
    commitment: 'in_conversation',
    writtenEvidence: null,
    matchEligibility: 'unknown',
    registryName: 'Bryan Foundation',
    status: 'Site visit + brainstorm proposed 6–7 July',
    nextMove:
      'Matthew Cox site visit + brainstorm 6–7 July invited (accepted?). Prepare agenda with explicit matched-capital ask.',
  },
];

/**
 * Evidence-backed capital: only sources that are 'eligible' or 'signed' AND have
 * written evidence on file. This is the only number that may ever be quoted to
 * QBE. Sources with a null askAud contribute zero (no number to count yet).
 */
export function evidenceBackedTotal(sources: CapitalSource[]): number {
  return sources.reduce((sum, s) => {
    const backed =
      (s.commitment === 'eligible' || s.commitment === 'signed') &&
      s.writtenEvidence !== null;
    return backed ? sum + (s.askAud ?? 0) : sum;
  }, 0);
}

/**
 * Pipeline (not committed): the dollar ask of everything that is NOT
 * evidence-backed. This number must never be presented as committed capital.
 */
export function pipelineTotal(sources: CapitalSource[]): number {
  return sources.reduce((sum, s) => {
    const backed =
      (s.commitment === 'eligible' || s.commitment === 'signed') &&
      s.writtenEvidence !== null;
    return backed ? sum : sum + (s.askAud ?? 0);
  }, 0);
}

/** Group sources by commitment stage, preserving COMMITMENT_ORDER for the board. */
export function byCommitment(
  sources: CapitalSource[],
): Record<Commitment, CapitalSource[]> {
  const out: Record<Commitment, CapitalSource[]> = {
    target: [],
    in_conversation: [],
    eligible: [],
    signed: [],
    parked: [],
  };
  for (const s of sources) out[s.commitment].push(s);
  return out;
}

/**
 * The QBE Stage-1 headline metric: count of sources that are 'signed' AND carry
 * written evidence on file. QBE Catalysing Impact Stage 1 requires 3+ signed
 * LOIs of matched capital by 31 Aug 2026, so this is the number the page leads
 * with. A 'signed' commitment with no evidence does NOT count — evidence is the
 * gate, and code never flips evidence (the founder verifies).
 */
export function loisSigned(sources: CapitalSource[]): number {
  return sources.reduce(
    (n, s) => (s.commitment === 'signed' && s.writtenEvidence !== null ? n + 1 : n),
    0,
  );
}

/** QBE Stage-1 target: minimum signed LOIs required. */
export const LOI_TARGET = 3;

/**
 * Whole days from `now` until an ISO date. Negative when the date has passed.
 * `now` is injectable so the countdown is testable without mocking the clock.
 */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return 0;
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}
