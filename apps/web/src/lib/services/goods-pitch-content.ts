/**
 * Goods on Country — canonical pitch / rhetoric content.
 *
 * The single governed source for the QBE-grade proposition. Every deck, email
 * and one-pager should derive from this file so the story stays consistent and
 * every numeric claim carries its QBE claim label (verified | modelled | target
 * | future). Content is lifted near-verbatim from the engagement review §5
 * (thoughts/shared/analysis/2026-06-10-goods-engagement-review.md).
 *
 * This file is static content only — no DB, no fetch. It is safe to import into
 * a Server Component and render directly.
 *
 * Claim taxonomy (QBE Diagnostic Area 01/04), mirrored from
 * goods-canonical-numbers.ts:
 *  - verified : checked against a source of truth (Xero, a live query)
 *  - modelled : a calculated estimate or planning band, not an audited actual
 *  - target   : a stated goal or aspiration, not yet achieved
 *  - future   : a projection of something that has not happened yet
 *
 * Writing-voice rule: no em-dashes in any copy string.
 */

import type { ClaimLabel } from './goods-canonical-numbers';

// ── The spine (use everywhere) ────────────────────────────────────────────

/**
 * The one-paragraph proposition. Verified asset metrics first, then the honest
 * margin frame, then the matched-capital ask. Quote it whole.
 */
export const PITCH_SPINE =
  'Goods on Country builds the bed that does not break: 540 beds deployed across 11 served communities, made up of 177 Stretch Beds and 363 Basket Beds; 22 washers in community under the current manual ruling; a calculated 3,540 kg of Stretch-bed plastic design mass, not a weighed diversion total; and $650,910.79 of receivables paid through A Curious Tractor. We know our delivered cost to the invoice line, we know the margin band that makes scale honest, and we are raising matched capital to move production from supplier-fabricated to community-operated.';

/** The verified spine facts, broken out so they can be claim-chipped inline. */
export type SpineFact = {
  value: string;
  label: string;
  claimLabel: ClaimLabel;
};

export const PITCH_SPINE_FACTS: SpineFact[] = [
  { value: '540', label: 'Beds deployed (177 Stretch + 363 Basket)', claimLabel: 'verified' },
  { value: '11', label: 'Communities served (12 distinct touched)', claimLabel: 'verified' },
  { value: '3,540 kg', label: 'Stretch design mass (177 × 20 kg)', claimLabel: 'modelled' },
  { value: '$650,910.79', label: 'Receivables paid (Xero)', claimLabel: 'verified' },
];

// ── The cost story (the part QBE will not move without) ─────────────────────

export type CostRow = {
  /** The claim being made (the row label). */
  claim: string;
  /** The number or band. */
  number: string;
  claimLabel: ClaimLabel;
  /** Where the figure comes from, so a reviewer can re-check it. */
  source: string;
  /** Whether this is one of the headline rows for the compact Proof Pack panel. */
  headline?: boolean;
};

/**
 * The cost ladder, in the order a reviewer should read it: current fabricated
 * cost, kit cost, delivered-by-route, the price bands, the in-house transition
 * states, and the fully-loaded volume curve down to the scale target.
 */
export const COST_STORY: CostRow[] = [
  {
    claim: 'Fabricated bed, current supplier',
    number: '$600 / bed',
    claimLabel: 'verified',
    source: 'Defy INV-1507, Nov 2025, 25 beds',
    headline: true,
  },
  {
    claim: 'Bed kit (cut and finished)',
    number: '$344.05 / kit',
    claimLabel: 'verified',
    source: 'INV-1602 (92 + 50 kits)',
  },
  {
    claim: 'Delivered cost by route',
    number: '$602 to 702 road / $715 to 815 barge / $1,005 to 1,105 charter',
    claimLabel: 'modelled',
    source: 'cost-evidence + Defy freight lines (per-pallet $808 to 1,480 Botany to Alice, verified)',
    headline: true,
  },
  {
    claim: 'Buyer price band',
    number: '$850 to 1,200 / bed',
    claimLabel: 'modelled',
    source: 'cost-evidence (planning band)',
    headline: true,
  },
  {
    claim: 'Production planning band',
    number: '$550 to 650 / bed',
    claimLabel: 'modelled',
    source: 'canonical-numbers',
  },
  {
    claim: 'In-house at State 4 (raw shred, all in-house)',
    number: '$310 / bed direct, $160K new capex ($200K cumulative)',
    claimLabel: 'modelled',
    source: 'build-states CSV',
    headline: true,
  },
  {
    claim: 'State 5 (community plastic)',
    number: '$320 / bed direct, +$30K capex',
    claimLabel: 'modelled',
    source: 'build-states CSV',
  },
  {
    claim: 'Community fair-wage state',
    number: '$270.74 / bed direct',
    claimLabel: 'modelled',
    source: 'build-states CSV (wage scenarios)',
  },
  {
    claim: 'Fully-loaded today (100 / yr)',
    number: '$1,707 / bed',
    claimLabel: 'modelled',
    source: 'volume-scenarios CSV',
  },
  {
    claim: 'Fully-loaded at 500 / yr State 4',
    number: '$599 / bed',
    claimLabel: 'modelled',
    source: 'volume-scenarios CSV',
    headline: true,
  },
  {
    claim: 'Fully-loaded at 1,000 / yr State 4',
    number: '$485 / bed',
    claimLabel: 'modelled',
    source: 'volume-scenarios CSV',
  },
  {
    claim: 'Scale vision',
    number: '5,000+ / yr at ~$350 / unit, 50 to 55% gross margin',
    claimLabel: 'target',
    source: 'goods.md',
    headline: true,
  },
];

/** Headline subset for the compact Proof Pack "Unit economics" panel. */
export const COST_STORY_HEADLINE: CostRow[] = COST_STORY.filter((r) => r.headline);

// ── The decision band (state it — it is investor language) ──────────────────

export type DecisionBand = {
  margin: string;
  verdict: string;
  /** Bauhaus accent used to colour the band row. */
  accent: 'blue' | 'yellow' | 'red' | 'black';
};

export const DECISION_BAND: DecisionBand[] = [
  { margin: '>= 25% margin', verdict: 'Scale aggressively', accent: 'blue' },
  { margin: '15 to 24%', verdict: 'Workable', accent: 'yellow' },
  { margin: '5 to 14%', verdict: 'Red flag', accent: 'red' },
  { margin: '< 5%', verdict: 'Stop', accent: 'black' },
];

/** The whole investment case in one sentence. */
export const DECISION_BAND_NOTE =
  'At the $850 to 1,200 price band, State 1 today is margin-thin on remote routes; State 4 at 500 / yr clears the 25% line on every route. That sentence is the whole investment case.';

/**
 * Capex honesty rule (Area 11): bed-level BOM is mostly verified, but the
 * container / On-Country facility capex (~$100K) is modelled pending vendor
 * quotes. Never present it as quoted.
 */
export const CAPEX_HONESTY_RULE =
  'Bed-level BOM is mostly verified. Container and On-Country facility capex (~$100K) is modelled pending vendor quotes. Never present it as quoted.';

// ── The capital architecture (which money does which job) ───────────────────

export type CapitalInstrument = {
  /** Short instrument name. */
  name: string;
  /** What job this money does. */
  job: string;
  /** The fuller description, near-verbatim from §5.3. */
  detail: string;
  /** Bauhaus accent for the block. */
  accent: 'blue' | 'yellow' | 'red' | 'black';
};

/**
 * The "right type of finance" story, which is also the DGR story. Order matters:
 * philanthropy (community side) first, then the matched grant (transition capex),
 * then repayable capital (serviced by transition margin), then procurement
 * revenue (what makes the first three finite).
 */
export const CAPITAL_ARCHITECTURE: CapitalInstrument[] = [
  {
    name: 'Philanthropy via The Butterfly Movement Ltd',
    job: 'Buys the community side',
    detail:
      'The Butterfly Movement Ltd (Item 1 DGR + PBI since 2012, ABN 22 155 132 684) funds the community side: deployment subsidy (currently ~$2,500 / bed at 100 / yr, falling to ~$500 / bed at 500 / yr), story and consent work, and the handover-of-ownership process. Tax-deductible and receiptable now. Never say "Goods is DGR": DGR runs only through Butterfly (Area 09 rule).',
    accent: 'yellow',
  },
  {
    name: 'Catalytic / matched grants (QBE pool)',
    job: 'Buys the transition',
    detail:
      'QBE Stage 2 grants ($150K to $400K pool; our cap is unconfirmed, so never quote $400K) buy the transition: the $200K to 230K States 4 to 5 capex that moves direct cost from $600 to $310 a bed.',
    accent: 'blue',
  },
  {
    name: 'Repayable capital (SEFA debt, IBA, Snow R4)',
    job: 'Serviced by transition margin',
    detail:
      'Repayable capital is serviced by the margin the transition creates. The receivables track record ($650,910.79 paid across 17 Xero tranches, tied to the cent) plus the buyer pipeline are the repayment evidence.',
    accent: 'red',
  },
  {
    name: 'Procurement revenue ($850 to 1,200 / bed)',
    job: 'Makes the rest finite',
    detail:
      'Procurement revenue is what makes the first three instruments finite, not perpetual. The QBE match multiplies every dollar in the first three that is evidence-backed by 31 Aug. Pipeline is not committed capital, and the primary Stage 2 criterion is the amount of external capital secured.',
    accent: 'black',
  },
];

/** The Stage 1 deliverable and the honest current count. */
export const CAPITAL_STAGE_NOTE =
  'Stage 1 deliverable: 3+ signed LOIs. Current honest count: 0 signed. Snow is nearest; Centrecorp (26 Jun) and Bryan (6 to 7 Jul) are the live paths.';

// ── Pitch shapes per audience ───────────────────────────────────────────────

export type AudienceShape = {
  audience: string;
  /** Who this shape is for, in plain examples. */
  examples: string;
  /** The ordered moves for this audience. */
  moves: string[];
  accent: 'blue' | 'yellow' | 'red' | 'black';
};

export const AUDIENCE_SHAPES: AudienceShape[] = [
  {
    audience: 'Philanthropy',
    examples: 'TFFF, Ian Potter, Bryan, Brian M Davis',
    moves: [
      'Lead with verified deployment and the falling-subsidy curve: "your dollars per bed halve as volume grows, you are funding a machine that needs you less every year".',
      'Route via Butterfly DGR.',
      'Separate verified asset metrics from modelled outcomes.',
      'No clinical-outcome claims without partner evidence (Area 02).',
    ],
    accent: 'yellow',
  },
  {
    audience: 'Impact investors',
    examples: 'QBE, Snow R4',
    moves: [
      'Delivered cost report first.',
      'Decision band second.',
      'States 1 to 4 transition third.',
      'LOI ask fourth.',
      'Only the Stretch Bed is a direct-sale product. Washers are prototype / register-interest, Basket Bed archived, no Weave Bed references (Area 03).',
    ],
    accent: 'blue',
  },
  {
    audience: 'Lenders',
    examples: 'SEFA, IBA',
    moves: [
      'Receivables history.',
      'Buyer pipeline.',
      'Margin after transition.',
      'Entity clarity: ACT Pty Ltd (t/a Goods on Country) is the trading and borrowing entity from 1 July. Do not blur sole-trader / company / charity roles (Area 09).',
    ],
    accent: 'red',
  },
  {
    audience: 'Buyers',
    examples: 'Centrecorp, WHSAC, councils, health services',
    moves: [
      'Delivered price by route.',
      'Proof pack (540 beds / 11 served communities; 22 washers in community under the manual ruling).',
      'Local-jobs trajectory (States 4 to 5 = community fabrication wages, $38.83 to $67.17 / bed labour across wage scenarios).',
      'Indigenous-led governance trajectory (Butterfly handover 26 Jun).',
    ],
    accent: 'black',
  },
];

// ── The NEVER-say list (QBE diagnostic rules) ───────────────────────────────

/**
 * Hard rules. To anyone, never present any of these. Render as a red-bordered
 * panel so it reads as a guardrail, not a footnote.
 */
export const NEVER_SAY: string[] = [
  'Community-owned manufacturing as already transferred.',
  'Pipeline as committed capital.',
  'The QBE match as unlocked.',
  'Advisory relationships as "a board".',
  'Management reports as audited.',
  'Household or story data without consent.',
  '"Goods is DGR" — DGR runs only through The Butterfly Movement Ltd (ABN 22 155 132 684).',
  'The $400K grant figure as our cap — our cap is unconfirmed.',
  'Container / facility capex as quoted — it is modelled pending vendor quotes.',
  'Clinical or household outcomes without partner evidence.',
];
