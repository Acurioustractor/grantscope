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
 * RECONCILED (Ben, 2026-06-10): 496 = 363 Basket Beds + 133 Stretch Beds (QBE
 * definition, excludes 21 Weave Beds); 2,660 kg HDPE = 133 Stretch x 20 kg.
 * 496 is the only externally quoted figure. The assets-sync 520 is retained
 * below for internal audit but is RETIRED from external use.
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
const ASSETS_SYNC_SOURCE = 'Goods v2 assets sync';
const ASSETS_SYNC_AS_OF = '2026-05-28';

/**
 * The canonical set. Reviewer-safe verified figures first, then the internal
 * assets-sync counts (same claim label but a different definition), then the
 * modelled cost band and the target scale figure.
 */
export const CANONICAL_NUMBERS: CanonicalNumber[] = [
  // ── Reviewer-verified (QBE) ────────────────────────────────────────────
  {
    key: 'deployed_bed_units',
    label: 'Deployed bed units',
    value: 496,
    unit: 'beds',
    claimLabel: 'verified',
    asOf: QBE_AS_OF,
    definition:
      'Bed units confirmed deployed to communities, counted under the QBE reviewer-verified definition. This is the figure to quote to funders and reviewers.',
    source: QBE_SOURCE,
  },
  {
    key: 'served_communities',
    label: 'Served communities',
    value: 9,
    unit: 'communities',
    claimLabel: 'verified',
    asOf: QBE_AS_OF,
    definition: 'Communities that have received deployed Goods units, reviewer-verified.',
    source: QBE_SOURCE,
  },
  {
    key: 'hdpe_diverted_kg',
    label: 'HDPE diverted (Stretch only)',
    value: 2660,
    unit: 'kg',
    claimLabel: 'verified',
    asOf: QBE_AS_OF,
    definition:
      'Kilograms of high-density polyethylene diverted from waste, counting the Stretch product line only, reviewer-verified.',
    source: QBE_SOURCE,
  },
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

  // ── Internal assets-sync (same claim label, different definition) ───────
  {
    key: 'beds_delivered_assets_sync',
    label: 'Beds delivered (assets sync)',
    value: 520,
    unit: 'beds',
    claimLabel: 'verified',
    asOf: ASSETS_SYNC_AS_OF,
    definition:
      'RETIRED from external use (reconciled 2026-06-10): internal assets-sync count under a different definition / stale cutoff. Quote 496 (= 363 Basket + 133 Stretch, excludes 21 Weave) externally, never this figure.',
    source: ASSETS_SYNC_SOURCE,
  },
  {
    key: 'washers_delivered_assets_sync',
    label: 'Washers delivered (assets sync)',
    value: 41,
    unit: 'washers',
    claimLabel: 'verified',
    asOf: ASSETS_SYNC_AS_OF,
    definition: 'Internal assets-sync count of washers delivered.',
    source: ASSETS_SYNC_SOURCE,
  },

  // ── Modelled (planning estimates) ──────────────────────────────────────
  {
    key: 'production_cost_band',
    label: 'Production cost per bed',
    value: '550-650',
    unit: 'AUD / bed',
    claimLabel: 'modelled',
    asOf: ASSETS_SYNC_AS_OF,
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

/**
 * True while the two delivered-bed definitions disagree. A founder must decide
 * which definition (and which figure) is correct before either is quoted
 * externally.
 */
export const needsReconciliation = false;

/** One-line explanation of the reconciliation outcome. */
export const reconciliationNote =
  'RECONCILED (Ben, 2026-06-10): 496 deployed bed units = 363 Basket Beds + 133 Stretch Beds (QBE definition, excludes the 21 Weave Beds), and 2,660 kg HDPE diverted = 133 Stretch Beds x 20 kg exactly. 496 is the ONLY externally quoted figure; the assets-sync 520 used a different definition / stale cutoff and is retired from external use.';

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
