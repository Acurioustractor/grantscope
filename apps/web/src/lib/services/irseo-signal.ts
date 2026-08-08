import irseoData from '@/data/irseo-2021.json';

/**
 * IRSEO — Indigenous Relative Socioeconomic Outcomes, 2021.
 *
 * A socioeconomic index built for the First Nations population specifically,
 * from the 2021 Census, across 401 Indigenous Areas. Every other disadvantage
 * measure on these pages is SEIFA, which describes the total population: fine
 * in a community that is 96% First Nations, wrong in a town that is 37%.
 *
 * The reason it matters here is smaller and sharper than the index itself.
 * Indigenous Areas are the only geography in this codebase that gives Utopia a
 * place of its own. Urapuntja has no council, no entry in the national
 * gazetteer, and every one of its organisations counted under Alice Springs.
 * ABS Indigenous Area 709012 is called Urapuntja, and it sits at the 99th
 * percentile of disadvantage nationally.
 *
 * Percentiles run the opposite way to SEIFA deciles: 100 is the most
 * disadvantaged, 1 the least. Darwin's inner suburbs are 8; Walungurru is 100.
 *
 * Source: Biddle N & Markham F (2023), 'Area-level socioeconomic outcomes for
 * Aboriginal and Torres Strait Islander Australians in the 2016 and 2021
 * Censuses', Centre for Aboriginal Economic Policy Research, Australian
 * National University. Attribution is rendered on every page that uses it.
 */

export interface IndigenousArea {
  code: string;
  name: string;
  state: string;
  /** 100 is the most disadvantaged, 1 the least. Opposite to SEIFA. */
  percentile2021: number;
  percentile2016: number | null;
  locationType: string;
}

const AREAS = irseoData as IndigenousArea[];
const BY_CODE = new Map(AREAS.map(area => [area.code, area]));

/**
 * Indigenous Areas belonging to each region, checked one at a time against the
 * published names.
 *
 * A code list, not a rule. Indigenous Areas do not nest inside council areas
 * and their names do not match council names, so there is no join to derive —
 * only names to read. That is the same discipline used for the hub-administered
 * organisations, and for the same reason: guessing would put a community
 * somewhere it is not.
 */
export const IRSEO_BY_PLACE_REGION: Record<string, string[]> = {
  // IREG 707 Barkly, 708 Alice Springs, 709 the remote centre — plus Anangu
  // Pitjantjatjara, which is in South Australia and inside this region because
  // the APY Lands are one of its councils.
  'central-australia': [
    '707001', '707002', '707003', '707004', '707005', '707006',
    '708002',
    '709001', '709002', '709003', '709004', '709005', '709006', '709007', '709008',
    '709009', '709010', '709011', '709012', '709013', '709014', '709015', '709017',
    '402001',
  ],
  kimberley: [
    '501001', '501002', '504001', '504003', '504004', '504006', '504007', '504008',
    '508001', '508003', '508005',
  ],
  'cape-york': [
    '303001', '303002', '303003', '303004', '303005', '303006', '303007', '303008',
    '303009', '309011',
  ],
  // Eyre is a separate Indigenous Area and is not the Far West Coast.
  'far-west-coast': ['403001', '403002'],
};

export interface IrseoRegionSignal {
  areas: IndigenousArea[];
  /** Areas at or above the 90th percentile of disadvantage nationally. */
  mostDisadvantaged: IndigenousArea[];
  medianPercentile: number;
  /** Codes named in the registry that are not in the published dataset. */
  missing: string[];
}

export function getIrseoForRegion(regionKey: string): IrseoRegionSignal | null {
  const codes = IRSEO_BY_PLACE_REGION[regionKey];
  if (!codes || codes.length === 0) return null;

  const areas = codes.map(code => BY_CODE.get(code)).filter((a): a is IndigenousArea => Boolean(a));
  if (areas.length === 0) return null;

  const sorted = [...areas].sort((a, b) => a.percentile2021 - b.percentile2021);
  const mid = Math.floor(sorted.length / 2);
  const medianPercentile =
    sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1].percentile2021 + sorted[mid].percentile2021) / 2)
      : sorted[mid].percentile2021;

  return {
    areas: [...areas].sort((a, b) => b.percentile2021 - a.percentile2021),
    mostDisadvantaged: areas.filter(a => a.percentile2021 >= 90).sort((a, b) => b.percentile2021 - a.percentile2021),
    medianPercentile,
    missing: codes.filter(code => !BY_CODE.has(code)),
  };
}

export function getIndigenousArea(code: string): IndigenousArea | null {
  return BY_CODE.get(code) ?? null;
}

export const IRSEO_AREA_COUNT = AREAS.length;

export const IRSEO_CITATION =
  "Biddle N & Markham F (2023), 'Area-level socioeconomic outcomes for Aboriginal and Torres Strait Islander Australians in the 2016 and 2021 Censuses', Centre for Aboriginal Economic Policy Research, Australian National University.";
