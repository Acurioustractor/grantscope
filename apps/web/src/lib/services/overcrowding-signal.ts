/**
 * Household overcrowding by remoteness.
 *
 * This is the measure Goods responds to. Crowding drives streptococcal
 * transmission, which causes acute rheumatic fever, which causes rheumatic
 * heart disease — the outcome already on the Central Australia page. Crowding
 * is the predictor, and unlike RHD it is published by remoteness, which every
 * council in this codebase carries.
 *
 * Overcrowding here is the Canadian National Occupancy Standard: a household
 * needing one or more additional bedrooms. The framework itself notes CNOS does
 * not account for extended family obligations in First Nations households, so
 * it is a conservative floor rather than a full account. That caveat travels to
 * the page.
 *
 * Source: Aboriginal and Torres Strait Islander Health Performance Framework
 * measure 2.01, table D2.01.10, published 11 March 2026, from the 2021 Census.
 * Licensed CC BY 4.0.
 */

export interface OvercrowdingSignal {
  /** Matches gs_entities.remoteness and mv_lga_place_profile.remoteness. */
  remoteness: string;
  label: string;
  firstNationsOvercrowded: number;
  firstNationsTotal: number;
  otherOvercrowded: number;
  otherTotal: number;
  /** First Nations households needing four or more additional bedrooms. */
  firstNationsSevere: number;
}

export const OVERCROWDING_BY_REMOTENESS: Record<string, OvercrowdingSignal> = {
  'Major Cities of Australia': {
    remoteness: 'Major Cities of Australia',
    label: 'Major cities',
    firstNationsOvercrowded: 11483,
    firstNationsTotal: 153579,
    otherOvercrowded: 228491,
    otherTotal: 6227717,
    firstNationsSevere: 167,
  },
  'Inner Regional Australia': {
    remoteness: 'Inner Regional Australia',
    label: 'Inner regional',
    firstNationsOvercrowded: 6803,
    firstNationsTotal: 86520,
    otherOvercrowded: 32732,
    otherTotal: 1547592,
    firstNationsSevere: 124,
  },
  'Outer Regional Australia': {
    remoteness: 'Outer Regional Australia',
    label: 'Outer regional',
    firstNationsOvercrowded: 5602,
    firstNationsTotal: 58365,
    otherOvercrowded: 15618,
    otherTotal: 667587,
    firstNationsSevere: 142,
  },
  'Remote Australia': {
    remoteness: 'Remote Australia',
    label: 'Remote',
    firstNationsOvercrowded: 2142,
    firstNationsTotal: 13751,
    otherOvercrowded: 1894,
    otherTotal: 77099,
    firstNationsSevere: 202,
  },
  'Very Remote Australia': {
    remoteness: 'Very Remote Australia',
    label: 'Very remote',
    firstNationsOvercrowded: 5248,
    firstNationsTotal: 16761,
    otherOvercrowded: 798,
    otherTotal: 29166,
    firstNationsSevere: 933,
  },
};

export const OVERCROWDING_AUSTRALIA: OvercrowdingSignal = {
  remoteness: 'Australia',
  label: 'Australia',
  firstNationsOvercrowded: 31268,
  firstNationsTotal: 328981,
  otherOvercrowded: 279531,
  otherTotal: 8549163,
  firstNationsSevere: 1573,
};

export function overcrowdedPct(signal: OvercrowdingSignal, group: 'firstNations' | 'other'): number {
  const [part, total] =
    group === 'firstNations'
      ? [signal.firstNationsOvercrowded, signal.firstNationsTotal]
      : [signal.otherOvercrowded, signal.otherTotal];
  return total === 0 ? 0 : Math.round((1000 * part) / total) / 10;
}

/** How many times the First Nations rate exceeds the rate for other households. */
export function overcrowdingRateRatio(signal: OvercrowdingSignal): number {
  const other = overcrowdedPct(signal, 'other');
  return other === 0 ? 0 : Math.round((10 * overcrowdedPct(signal, 'firstNations')) / other) / 10;
}

export function getOvercrowdingForRemoteness(remoteness: string | null): OvercrowdingSignal | null {
  if (!remoteness) return null;
  return OVERCROWDING_BY_REMOTENESS[remoteness] ?? null;
}
