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

/**
 * The legal/contracting shape of a capital instrument. We only ever record what
 * is KNOWN — repayment/security stay null (with a TODO) rather than inventing
 * loan or security terms we do not hold. `entityRequired` and `dgrRoute` encode
 * the hard ACT entity rule: tax-deductible philanthropy MUST route via Butterfly
 * (Item 1 DGR + PBI); commercial/repayable capital contracts through A Curious
 * Tractor Pty Ltd (t/a Goods on Country). DGR never runs through ACT Pty or AKT.
 */
export interface CapitalInstrument {
  /** e.g. 'non-repayable grant', 'debt, terms TBC', 'recoverable grant'. Null when unknown. */
  repayment: string | null;
  /** Security taken against the capital, or null when none/unknown. */
  security: string | null;
  /** Which ACT entity must contract / receive the capital. */
  entityRequired: string;
  /** True when the capital must route via Butterfly (tax-deductible philanthropy). */
  dgrRoute: boolean;
}

/** Canonical ACT contracting entity strings, used verbatim in instrument data. */
export const ACT_PTY_ENTITY =
  'A Curious Tractor Pty Ltd (t/a Goods on Country)';
export const BUTTERFLY_ENTITY =
  'The Butterfly Movement Ltd (Item 1 DGR + PBI, ABN 22 155 132 684)';

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
  /**
   * The legal/contracting shape of the capital, when known. Optional so a source
   * can exist before its instrument is understood — but every seeded source sets
   * one, holding unknown terms at null rather than inventing them.
   */
  instrument?: CapitalInstrument;
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
    instrument: {
      // Source: QBE Catalysing Impact diagnostic — non-repayable grant via Social
      // Impact Hub, gated on legally-binding matched co-funding; agreement signed
      // 17 Mar 2026. Commercial cohort capital contracts through ACT Pty.
      repayment: 'non-repayable grant (gated on legally-binding matched co-funding)',
      security: null,
      entityRequired: ACT_PTY_ENTITY,
      dgrRoute: false,
    },
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
    instrument: {
      // Philanthropic grant — must route via Butterfly DGR.
      repayment: 'non-repayable grant',
      security: null,
      // TODO(ben-verify): confirm grant routes via Butterfly (philanthropic DGR), not ACT Pty.
      entityRequired: BUTTERFLY_ENTITY,
      dgrRoute: true,
    },
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
    instrument: {
      // Debt/blended capital, no conversation yet — terms unknown, do not invent.
      repayment: 'debt, terms TBC',
      // TODO(ben-verify): SEFA security requirements unknown — no conversation held.
      security: null,
      entityRequired: ACT_PTY_ENTITY,
      dgrRoute: false,
    },
  },
  {
    // Ben 2026-06-10: PFI = QLD Partnering for Impact (QLD Gov repayable, $640K of a
    // $3.2M pool, wiki/projects/goods.md). The EOI was NOT submitted — parked, not live.
    id: 'pfi-recoverable-grant',
    name: 'QLD Partnering for Impact (PFI)',
    kind: 'recoverable_grant',
    askAud: null,
    askLabel: '$640K (not applied)',
    commitment: 'parked',
    writtenEvidence: null,
    matchEligibility: 'unknown',
    registryName: 'PFI',
    status: 'EOI NOT submitted (Ben, 2026-06-10) — wiki entry was aspirational',
    nextMove:
      'Parked: the QLD Partnering for Impact EOI was never submitted. Revisit only if a new QLD round opens and the QBE raise still needs repayable match.',
    instrument: {
      repayment: 'repayable investment (QLD Gov program terms)',
      security: null,
      entityRequired: ACT_PTY_ENTITY,
      dgrRoute: false,
    },
  },
  {
    // Ben 2026-06-10: "another social impact one — national round open now I think".
    // Likely the Social Enterprise Development Initiative (SEDI) — a registry row exists
    // at stage 'identified'. TODO(ben-verify): confirm the program, round dates, ask size, fit.
    id: 'sedi-national-round',
    name: 'Social Enterprise Development Initiative (SEDI)',
    kind: 'grant',
    askAud: null,
    askLabel: 'TBC',
    commitment: 'target',
    writtenEvidence: null,
    matchEligibility: 'unknown',
    registryName: 'Social Enterprise Development Initiative (SEDI)',
    status: 'National social-enterprise round believed open now (Ben, 2026-06-10) — unconfirmed',
    nextMove:
      'Confirm the program Ben means (SEDI?), the round deadline and eligibility, then size the ask. Replaces QLD PFI as the social-impact capital candidate.',
    needsVerification: true,
    instrument: {
      // TODO(ben-verify): grant vs blended; entity + DGR routing unknown until program confirmed.
      repayment: null,
      security: null,
      entityRequired: ACT_PTY_ENTITY,
      dgrRoute: false,
    },
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
    instrument: {
      // Indigenous Business Australia finance — terms unknown, no application lodged.
      // TODO(ben-verify): IBA finance terms (repayment, security) unknown.
      repayment: 'debt, terms TBC',
      security: null,
      entityRequired: ACT_PTY_ENTITY,
      dgrRoute: false,
    },
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
    instrument: {
      // Catalytic capital — shape unknown (no formal process started).
      // TODO(ben-verify): catalytic frame — confirm whether it routes via Butterfly DGR.
      repayment: 'catalytic, terms TBC',
      security: null,
      entityRequired: ACT_PTY_ENTITY,
      dgrRoute: false,
    },
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
    instrument: {
      // Philanthropic foundation grant for product — must route via Butterfly DGR.
      repayment: 'non-repayable grant',
      security: null,
      // TODO(ben-verify): confirm grant routes via Butterfly DGR, not ACT Pty.
      entityRequired: BUTTERFLY_ENTITY,
      dgrRoute: true,
    },
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
    instrument: {
      // Philanthropic grant — must route via Butterfly DGR.
      repayment: 'non-repayable grant',
      security: null,
      // TODO(ben-verify): confirm grant routes via Butterfly DGR, not ACT Pty.
      entityRequired: BUTTERFLY_ENTITY,
      dgrRoute: true,
    },
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

/** Grant-like kinds whose money must route via Butterfly DGR, never ACT Pty or AKT. */
export const GRANT_LIKE_KINDS: CapitalKind[] = [
  'matched_grant',
  'grant',
  'recoverable_grant',
];

/**
 * Grant-type sources whose DGR routing is NOT yet confirmed. A grant-like source
 * is a routing risk unless its instrument explicitly sets dgrRoute === true.
 * Tax-deductible philanthropy must route via Butterfly; a missing instrument or
 * dgrRoute !== true means the routing is unconfirmed and needs a human check.
 * NOTE: QBE matched grants are non-repayable but contract through ACT Pty (not a
 * DGR receipt), so they surface here too — that is intentional: the founder
 * should confirm each grant-type source's routing rather than the code guessing.
 */
export function dgrRoutingWarnings(sources: CapitalSource[]): CapitalSource[] {
  return sources.filter(
    (s) =>
      GRANT_LIKE_KINDS.includes(s.kind) && s.instrument?.dgrRoute !== true,
  );
}

/**
 * Whole days from `now` until an ISO date. Negative when the date has passed.
 * `now` is injectable so the countdown is testable without mocking the clock.
 */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return 0;
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}
