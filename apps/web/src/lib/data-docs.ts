import { getDirectServiceSupabase } from '@/lib/supabase';

/**
 * The public-safe data documentation registry — what CivicGraph holds, where it came from,
 * and what each dataset cannot tell you.
 *
 * SAFETY BY CONSTRUCTION. This module is hand-curated from the internal data map; it is NEVER
 * generated from it. The internal map catalogues the whole shared database, roughly a third of
 * which is A Curious Tractor's private business systems — none of that may appear on a public
 * surface, so the rule is allowlist-only: a dataset exists here because someone typed it in,
 * with its caveat, after deciding it is public. Do not add entries by copying from
 * thoughts/shared/data-map/*.
 *
 * Row counts are fetched live via PostgREST's `estimated` count (the planner's statistics) —
 * approximate by design, checked 2026-08-16 to track measured counts within a few percent,
 * and — unlike a typed-in number — never years stale.
 */

export interface DataDoc {
  id: string;
  name: string;
  /** The public origin of the data, in plain words. */
  source: string;
  /** Table the live count is read from. Allowlist — only civic tables belong here. */
  table: string;
  description: string;
  /** What this dataset cannot tell you. Rendered with the dataset, always. */
  caveat?: string;
}

export const DATA_DOCS: DataDoc[] = [
  {
    id: 'abr',
    name: 'Australian Business Register',
    source: 'ABR bulk extract (Commonwealth open data)',
    table: 'abr_registry',
    description: 'Every ABN ever issued — the base layer that lets a name in one dataset be matched to the same organisation in another.',
  },
  {
    id: 'entities',
    name: 'The entity graph',
    source: 'Built by CivicGraph from all sources below',
    table: 'gs_entities',
    description: 'Organisations and people resolved across registers — one entity per real-world organisation, reached by ABN, name and place.',
    caveat: 'Entity resolution is probabilistic below the ABN tier. Where a match is uncertain, records stay unlinked rather than guessed.',
  },
  {
    id: 'contracts',
    name: 'Commonwealth contracts',
    source: 'AusTender (published contract notices)',
    table: 'austender_contracts',
    description: 'The full published history of Commonwealth contract notices — buyer, supplier, value, dates.',
    caveat: 'Contract value is the published commitment, not money actually paid. A small number of outlier rows carry a large share of total value.',
  },
  {
    id: 'grants-awarded',
    name: 'Commonwealth grants',
    source: 'GrantConnect (published grant awards)',
    table: 'grantconnect_awards',
    description: 'Awarded Commonwealth grants — recipient, program, amount.',
  },
  {
    id: 'justice-funding',
    name: 'Justice & community funding',
    source: 'State budget papers, grant registers and FOI releases, compiled and tagged by service area',
    table: 'justice_funding',
    description: 'Grants in youth justice, child protection, family services, NDIS and related areas, tagged by topic so a theme can be summed.',
    caveat: 'A floor, never a total: money that was never published, never tagged, or spent through a departmental budget line is not here. Budget aggregates and spreadsheet total rows are excluded from every figure — the exclusions are disclosed next to each number.',
  },
  {
    id: 'donations',
    name: 'Political donations',
    source: 'AEC transparency register',
    table: 'political_donations',
    description: 'Declared receipts of registered political entities.',
    caveat: 'Most declared receipts are not donations — our donation figures count only rows the AEC classifies as “donation received”. Under half of all receipts can be attributed to a specific organisation; the rest carry no ABN and no reliable name match.',
  },
  {
    id: 'charities',
    name: 'Charity register & financials',
    source: 'ACNC register and Annual Information Statements',
    table: 'acnc_charities',
    description: 'Registered charities, their purposes and beneficiaries, and yearly financials from their Annual Information Statements.',
  },
  {
    id: 'companies',
    name: 'Company register',
    source: 'ASIC company register',
    table: 'asic_companies',
    description: 'Registered companies, used to resolve suppliers and follow name changes.',
  },
  {
    id: 'board-roles',
    name: 'Board & director roles',
    source: 'ACNC and ASIC filings',
    table: 'person_roles',
    description: 'Who holds which role at which organisation — the governance layer.',
    caveat: 'People are counted, never priced: no dollar figure is ever attributed to an individual. Board counts are capped at 10 per person — above that sits the professional-nominee artefact, not a power signal.',
  },
  {
    id: 'tax',
    name: 'Corporate tax transparency',
    source: 'ATO corporate tax transparency reports',
    table: 'ato_tax_transparency',
    description: 'Total income, taxable income and tax payable for large entities, by report year.',
  },
  {
    id: 'foundations',
    name: 'Philanthropic foundations',
    source: 'ACNC data classified by CivicGraph',
    table: 'foundations',
    description: 'Grant-making foundations, their scale and thematic focus.',
    caveat: 'Annual giving figures are estimates for many foundations; treat rankings as indicative.',
  },
  {
    id: 'opportunities',
    name: 'Grant opportunities',
    source: 'GrantConnect and state grant portals',
    table: 'grant_opportunities',
    description: 'Open and historical grant rounds — amounts, deadlines, focus areas.',
  },
  {
    id: 'alma',
    name: 'Australian Living Map of Alternatives (ALMA)',
    source: 'Curated evidence register, maintained with practitioners',
    table: 'alma_interventions',
    description: 'Interventions that work — programs, their evidence and recorded outcomes — so funding can be read against evidence.',
    caveat: 'Small by design and growing. Absence of an evidence link means the register has not recorded one — it is not evidence that a program does not work.',
  },
];

export async function liveCounts(): Promise<Map<string, number>> {
  const supabase = getDirectServiceSupabase();
  const out = new Map<string, number>();
  await Promise.all(
    DATA_DOCS.map(async (d) => {
      try {
        const { count, error } = await supabase
          .from(d.table)
          .select('*', { count: 'estimated', head: true });
        if (!error && count != null && count > 0) out.set(d.id, count);
      } catch {
        // A missing count renders as absent, not zero — zero would be a claim.
      }
    }),
  );
  return out;
}

export function approxCount(n: number): string {
  if (n >= 1e6) return `~${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `~${Math.round(n / 1e3).toLocaleString('en-AU')}K`;
  return `~${n}`;
}
