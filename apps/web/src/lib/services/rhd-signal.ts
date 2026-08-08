/**
 * Rheumatic heart disease, where a register reports it by region.
 *
 * Goods makes beds. The chain from crowded housing to streptococcal
 * transmission to acute rheumatic fever to rheumatic heart disease is why
 * bedding and washing capacity are treated as health infrastructure rather than
 * furniture. This is the outcome end of that chain, from the National Rheumatic
 * Heart Disease Data Collection — jurisdictional registers of notified cases,
 * not survey estimates.
 *
 * Held as typed values rather than a table because there are three rows, they
 * change once a year, and every one needs its provenance carried with it. A
 * migration would add ceremony without adding a guarantee.
 *
 * Licence: CC BY 4.0. Attribution is required and rendered on the page.
 *
 * The geography is the catch. The NT RHD Register reports two regions, Top End
 * and Central Australia, and neither is a council area. Central Australia here
 * is the NT health service region, which is close to but not the same as this
 * codebase's central-australia region — ours also carries the APY Lands, which
 * are in South Australia and counted by a different register. The page says so
 * rather than implying a boundary we do not have.
 */

export interface RhdRegionSignal {
  /** The region as the register names it. */
  region: string;
  jurisdiction: string;
  /** First Nations people on the register living with RHD. */
  firstNationsCases: number;
  firstNationsRatePer100k: number;
  nonIndigenousCases: number;
  nonIndigenousRatePer100k: number;
  /** First Nations rate divided by the non-Indigenous rate. */
  rateRatio: number;
  asAt: string;
  sourceTable: string;
  /** What this region does and does not cover, relative to ours. */
  boundaryNote: string;
}

/**
 * Prevalence of rheumatic heart disease, as at 31 December 2021.
 *
 * Table D1.06.12, Aboriginal and Torres Strait Islander Health Performance
 * Framework measure 1.06, published 21 March 2024. Figures transcribed from the
 * published workbook and checked against it.
 */
export const RHD_REGIONS: Record<string, RhdRegionSignal> = {
  'nt-central-australia': {
    region: 'Central Australia',
    jurisdiction: 'NT',
    firstNationsCases: 625,
    firstNationsRatePer100k: 2902.7,
    nonIndigenousCases: 23,
    nonIndigenousRatePer100k: 93.8,
    rateRatio: 31,
    asAt: '31 December 2021',
    sourceTable: 'D1.06.12',
    boundaryNote:
      'The NT Rheumatic Heart Disease Register reports Central Australia as a health service region. It covers Mparntwe (Alice Springs), the Barkly and the surrounding communities, but not the APY Lands, which are in South Australia and appear on a separate register.',
  },
  'nt-top-end': {
    region: 'Northern Territory Top End',
    jurisdiction: 'NT',
    firstNationsCases: 1704,
    firstNationsRatePer100k: 3193.8,
    nonIndigenousCases: 79,
    nonIndigenousRatePer100k: 52.7,
    rateRatio: 60.6,
    asAt: '31 December 2021',
    sourceTable: 'D1.06.12',
    boundaryNote: 'The northern half of the Northern Territory, as the register defines it.',
  },
};

/**
 * Which of our regions a register region can honestly be shown against.
 *
 * Deliberately sparse. A region only appears here when the register reports a
 * geography that genuinely overlaps it — not when a state-level figure could be
 * stretched to fit. Three of the four place regions have no entry, and showing
 * them a jurisdiction number would imply a local one.
 */
export const RHD_BY_PLACE_REGION: Record<string, string> = {
  'central-australia': 'nt-central-australia',
};

export function getRhdSignalForRegion(regionKey: string): RhdRegionSignal | null {
  const rhdKey = RHD_BY_PLACE_REGION[regionKey];
  return rhdKey ? RHD_REGIONS[rhdKey] ?? null : null;
}

/**
 * The prevalence rate as a share of population, which is how a person reads it.
 * 2,902.7 per 100,000 is 2.9 in every 100.
 */
export function ratePerHundred(ratePer100k: number): string {
  return (ratePer100k / 1000).toFixed(1);
}
