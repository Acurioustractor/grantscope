/**
 * Goods Command Center — canonical numbers + claim-label discipline.
 *
 * One source for the headline figures we quote, each tagged with the QBE
 * diagnostic claim taxonomy so a reviewer can see at a glance how solid each
 * number is. The taxonomy (QBE Diagnostic Area 01/04):
 *  - verified : checked against a source of truth (Notion, Xero, a live query)
 *  - modelled : a calculated estimate or planning band, not an audited actual
 *  - target   : a stated goal or aspiration, not yet achieved
 *  - future   : a projection of something that has not happened yet
 *
 * RECONCILED (Goods Asset Register canon, checked 2026-07-25):
 * 540 deployed beds = 177 Stretch + 363 Basket; 22 washers are in community
 * under Ben's manual ruling; 11 communities are served (12 distinct places
 * touched); and 3,540 kg is the Stretch-bed design-mass calculation
 * (177 x 20 kg), not a weighbridge measurement.
 *
 * Plan: thoughts/shared/plans/goods-command-center-2026-06-09.md
 */

export type ClaimLabel = 'verified' | 'modelled' | 'target' | 'future';

export type CanonicalNumber = {
  /** Stable key for lookups (e.g. 'deployed_bed_units'). */
  key: string;
  /** Human label for display. */
  label: string;
  /** The value. Strings allowed for ranges and money figures. */
  value: number | string;
  /** Unit shown after the value (e.g. 'beds', 'kg', 'AUD'). */
  unit: string;
  claimLabel: ClaimLabel;
  /** ISO date the figure was last checked or sourced. */
  asOf: string;
  /** Plain-language meaning, including any definitional caveat. */
  definition: string;
  /** Where the figure comes from (so a reviewer can re-check it). */
  source: string;
};

const QBE_SOURCE = 'QBE Diagnostic Area 01/04, checked 2026-06-01';
const QBE_AS_OF = '2026-06-01';
const ASSET_CANON_SOURCE =
  'Goods Asset Register v2 CANONICAL_ASSETS + Ben rulings in CONTEXT.md, checked 2026-07-25';
const ASSET_CANON_AS_OF = '2026-07-25';

/**
 * The canonical set. Current asset canon comes first, followed by verified
 * finance figures, the modelled cost band and the target scale figure.
 */
export const CANONICAL_NUMBERS: CanonicalNumber[] = [
  // ── Goods Asset Register canon ─────────────────────────────────────────
  {
    key: 'deployed_bed_units',
    label: 'Deployed bed units',
    value: 540,
    unit: 'beds',
    claimLabel: 'verified',
    asOf: ASSET_CANON_AS_OF,
    definition:
      'Deployed bed units in the current Goods Asset Register canon: 177 Stretch Beds plus 363 Basket Beds.',
    source: ASSET_CANON_SOURCE,
  },
  {
    key: 'stretch_beds_deployed',
    label: 'Stretch Beds deployed',
    value: 177,
    unit: 'beds',
    claimLabel: 'verified',
    asOf: ASSET_CANON_AS_OF,
    definition: 'Stretch Beds included in the 540 deployed-bed total.',
    source: ASSET_CANON_SOURCE,
  },
  {
    key: 'basket_beds_deployed',
    label: 'Basket Beds deployed',
    value: 363,
    unit: 'beds',
    claimLabel: 'verified',
    asOf: ASSET_CANON_AS_OF,
    definition: 'Basket Beds included in the 540 deployed-bed total.',
    source: ASSET_CANON_SOURCE,
  },
  {
    key: 'washers_in_community',
    label: 'Washers in community',
    value: 22,
    unit: 'washers',
    claimLabel: 'verified',
    asOf: ASSET_CANON_AS_OF,
    definition:
      "Ben's 2026-07-21 manual per-community ruling. This is curated, not row-derived: the register still contains 32 deployed washer rows because 10 stale rows await restatusing.",
    source: ASSET_CANON_SOURCE,
  },
  {
    key: 'served_communities',
    label: 'Served communities',
    value: 11,
    unit: 'communities',
    claimLabel: 'verified',
    asOf: ASSET_CANON_AS_OF,
    definition: 'Communities that have received deployed Goods units under the current canonical served definition.',
    source: ASSET_CANON_SOURCE,
  },
  {
    key: 'distinct_communities_touched',
    label: 'Distinct communities touched',
    value: 12,
    unit: 'communities',
    claimLabel: 'verified',
    asOf: ASSET_CANON_AS_OF,
    definition:
      'Distinct communities touched by Goods. This is broader than the 11-community served definition and must not replace it in served claims.',
    source: ASSET_CANON_SOURCE,
  },
  {
    key: 'stretch_design_mass_kg',
    label: 'Stretch-bed plastic design mass',
    value: 3540,
    unit: 'kg',
    claimLabel: 'modelled',
    asOf: ASSET_CANON_AS_OF,
    definition:
      'Calculated as 177 deployed Stretch Beds x 20 kg design mass per bed. This is a design-mass calculation, not a weighbridge measurement or audited waste-diversion total.',
    source: ASSET_CANON_SOURCE,
  },

  // ── Reviewer-verified finance figures ──────────────────────────────────
  {
    key: 'receivables_raised',
    label: 'Receivables raised',
    value: 733410.79,
    unit: 'AUD',
    claimLabel: 'verified',
    asOf: QBE_AS_OF,
    definition: 'Total ACT-GD receivables raised (invoiced), reviewer-verified against the ledger.',
    source: QBE_SOURCE,
  },
  {
    key: 'receivables_paid',
    label: 'Receivables paid',
    value: 650910.79,
    unit: 'AUD',
    claimLabel: 'verified',
    asOf: QBE_AS_OF,
    definition: 'ACT-GD receivables paid to date (Xero-verified). This is the cash-received source of truth.',
    source: QBE_SOURCE,
  },
  {
    key: 'receivables_due',
    label: 'Receivables due',
    value: 82500,
    unit: 'AUD',
    claimLabel: 'verified',
    asOf: QBE_AS_OF,
    definition: 'ACT-GD receivables raised but not yet paid, reviewer-verified.',
    source: QBE_SOURCE,
  },
  // ── Modelled (planning estimates) ──────────────────────────────────────
  {
    key: 'production_cost_band',
    label: 'Production cost per bed',
    value: '550-650',
    unit: 'AUD / bed',
    claimLabel: 'modelled',
    asOf: ASSET_CANON_AS_OF,
    definition:
      'Planning band for producing one bed (550 to 650 AUD, 600 midpoint), before route freight, warranty, support or margin. A modelled estimate, not an audited delivered actual.',
    source: 'Goods cost register',
  },

  // ── Target (stated goal) ───────────────────────────────────────────────
  {
    key: 'scale_target_beds',
    label: 'Scale target',
    value: '5000+',
    unit: 'beds',
    claimLabel: 'target',
    asOf: QBE_AS_OF,
    definition: 'Stated scale goal of more than 5,000 beds. A target, not yet achieved.',
    source: 'Goods strategy',
  },
];

/** One-phrase meanings for the four claim labels, mirroring the QBE taxonomy. */
export const CLAIM_LABEL_MEANINGS: Record<ClaimLabel, string> = {
  verified: 'Checked against a source of truth.',
  modelled: 'A calculated estimate or planning band.',
  target: 'A stated goal, not yet achieved.',
  future: 'A projection of something not yet happened.',
};

/** False once the outward asset figures match the current Goods canon. */
export const needsReconciliation = false;

/** One-line explanation of the reconciliation outcome. */
export const reconciliationNote =
  "RECONCILED (Goods Asset Register canon, checked 2026-07-25): 540 deployed beds = 177 Stretch + 363 Basket; 22 washers in community is Ben's manual per-community ruling and is not yet row-derived; 11 communities are served while 12 distinct communities have been touched; 3,540 kg = 177 Stretch Beds x 20 kg design mass and is not a weighbridge measurement.";

/** Lookup helper. Returns undefined if the key is not in the canonical set. */
export function getCanonical(key: string): CanonicalNumber | undefined {
  return CANONICAL_NUMBERS.find((n) => n.key === key);
}

/** Throwing lookup for known-present keys, so page code stays terse. */
export function canonical(key: string): CanonicalNumber {
  const found = getCanonical(key);
  if (!found) throw new Error(`Unknown canonical number key: ${key}`);
  return found;
}
