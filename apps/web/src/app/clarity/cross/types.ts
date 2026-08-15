/**
 * THE CROSS-SECTIONS — slice 4.
 *
 * The generative half of /clarity. A curated question registry can only surface
 * cross-sections somebody already thought to write down; a matrix surfaces the
 * ones nobody did.
 */
export const TABS = ['flow', 'join'] as const;
export type Tab = (typeof TABS)[number];

export function parseTab(v: string | undefined): Tab {
  return (TABS as readonly string[]).includes(v ?? '') ? (v as Tab) : 'flow';
}

export interface FlowCell {
  source_type: string;
  target_type: string;
  relationship_type: string;
  edges: number;
  edges_with_amount: number;
  amount_recorded: number | null;
  edges_with_year: number;
  distinct_sources: number;
  distinct_targets: number;
  year_min: number | null;
  year_max: number | null;
}

export interface JoinCell {
  src_domain: string;
  tgt_domain: string;
  edges: number;
  declared_edges: number;
  measured_edges: number;
  best_match_rate: number | null;
  worst_match_rate: number | null;
  rows_at_stake: number | null;
}

export interface SentinelRow {
  key: string;
  label: string;
  description: string;
  severity: string;
  guards_objects: string[];
}

/**
 * The log scale on the matrix. Four buckets, because the range runs from 1 edge
 * to 330,460 and a linear ramp would render everything except the two category
 * hubs as the same shade of nothing.
 */
export function bucket(edges: number): 0 | 1 | 2 | 3 {
  if (edges >= 100_000) return 3;
  if (edges >= 10_000) return 2;
  if (edges >= 100) return 1;
  return 0;
}

export const BUCKET_FILL = ['#2A2A2A', '#4A5B8C', '#8C6D1F', '#D02020'] as const;
export const BUCKET_LABEL = ['under 100', 'under 10k', 'under 100k', '100k or more'] as const;

/**
 * The diagonal is not self-funding, and each diagonal cell has to say what it
 * actually is. company→company is inter-corporate flow; person→person is board
 * co-membership. Leaving that unsaid is how a matrix tells its first small lie.
 */
export const DIAGONAL_MEANING: Record<string, string> = {
  company: 'inter-corporate flow, not a company funding itself',
  person: 'board co-membership, not a person funding themselves',
  charity: 'charity-to-charity granting and shared control',
  government: 'inter-governmental transfer between agencies',
  foundation: 'foundation-to-foundation granting',
  program: 'programme nested inside a programme',
};

export function niceType(t: string): string {
  return t.replace(/_/g, ' ');
}
