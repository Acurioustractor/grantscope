/**
 * The six nouns — the spine of the index.
 *
 * WHY NOT THE EXISTING DOMAINS
 *
 * `clarity_object.domain` has 17 values and is a *schema* taxonomy wearing subject clothing. Its
 * largest member is `platform_ops_auth` at 215 objects, more than double the next, so an index
 * sorted by domain puts auth tables above every dollar in the country. The nouns below are what a
 * person is actually looking for: a kind of thing, not a kind of table.
 *
 * WHY SOME DOMAINS DO NOT MAP
 *
 * Three domains — justice_youth_detention, social_services, child_protection — are *sectors*, not
 * nouns. A sector's objects span several nouns at once: `justice_funding` is money,
 * `mv_youth_justice_entities` is organisations, detention statistics are evidence. Filing a sector
 * under one noun would be a guess, and this project's rule is that an object with no confirmed
 * noun renders as UNFILED rather than being quietly mis-filed. So they sit in Unfiled with a
 * reason on screen, alongside the 667 objects that carry no domain at all.
 *
 * That produces a large honest number — see UNFILED_NOTE — and that number is the point. It is the
 * progress bar for slice 4, where rules propose a noun and a human confirms it via the
 * `verdict`/`verdict_by`/`verdict_at` columns that already exist and have never been used.
 *
 * This mapping is DELIBERATELY a hand-written table and not an algorithm. See
 * `thoughts/shared/plans/clarity-console.md`.
 */

export type Noun =
  | 'money'
  | 'organisations'
  | 'people'
  | 'places'
  | 'evidence'
  | 'machine'
  | 'unfiled';

export const NOUN_ORDER: Noun[] = [
  'money',
  'organisations',
  'people',
  'places',
  'evidence',
  'machine',
  'unfiled',
];

export const NOUN_LABEL: Record<Noun, string> = {
  money: 'Money',
  organisations: 'Organisations',
  people: 'People',
  places: 'Places',
  evidence: 'Evidence',
  machine: 'The Machine',
  unfiled: 'Unfiled',
};

export const NOUN_BLURB: Record<Noun, string> = {
  money: 'Grants, contracts, donations, budgets — every dollar the system can see.',
  organisations: 'Entities, charities, companies, the ABN register.',
  people: 'Persons, directors, boards, roles.',
  places: 'Postcodes, LGAs, SEIFA, geography.',
  evidence: 'Outcomes, interventions, stories, consent, media.',
  machine: 'Auth, agents, pipeline, staging. What runs the thing rather than what it is about.',
  unfiled: 'No noun confirmed yet. Shown, never guessed.',
};

/**
 * The reason an object is unfiled, rendered on the group so the number is legible rather than
 * looking like neglect. Two distinct causes that must not collapse into one.
 */
export const UNFILED_NOTE =
  'Two causes, kept apart: objects with no domain at all, and objects filed by SECTOR ' +
  '(justice, social services, child protection) — a sector spans several nouns, so filing it ' +
  'under one would be a guess.';

/** The unambiguous half. A domain absent from this map is unfiled BY DESIGN, not by omission. */
const DOMAIN_TO_NOUN: Record<string, Noun> = {
  grants_funding: 'money',
  philanthropy_giving: 'money',
  government_spend_procurement: 'money',
  political_influence: 'money',

  charities_ngo: 'organisations',
  corporate_registry: 'organisations',

  people_directors_governance: 'people',

  geography_place: 'places',

  evidence_outcomes_alma: 'evidence',
  storytelling_consent: 'evidence',
  media_narrative: 'evidence',

  platform_ops_auth: 'machine',
  ai_agents_pipeline: 'machine',
};

/** Sectors are filed, but not by noun. Tracked separately so the Unfiled group can explain itself. */
export const SECTOR_DOMAINS = new Set([
  'justice_youth_detention',
  'social_services',
  'child_protection',
  'unknown',
]);

/**
 * SINCE SLICE 4 the `clarity_object.noun` COLUMN is authoritative and the index reads it, not
 * this function. DOMAIN_TO_NOUN above was mirrored into the column by
 * migrations/2026-08-16-clarity-noun.sql (noun_source='domain_rule'); humans file the rest via
 * /clarity/unfiled → /api/clarity/nouns (noun_source='human'). This function remains as the
 * documented rule and its tests keep the SQL mirror honest — if you edit the mapping, edit the
 * migration's CASE too.
 */
export function nounFor(domain: string | null | undefined): Noun {
  if (!domain) return 'unfiled';
  return DOMAIN_TO_NOUN[domain] ?? 'unfiled';
}

/** Why this object landed in Unfiled — shown on the row so the state is never mysterious. */
export function unfiledReason(domain: string | null | undefined): string | null {
  if (!domain) return 'no domain';
  if (DOMAIN_TO_NOUN[domain]) return null;
  if (SECTOR_DOMAINS.has(domain)) return `sector: ${domain.replace(/_/g, ' ')}`;
  return `domain not mapped: ${domain.replace(/_/g, ' ')}`;
}

export type IndexSort = 'name' | 'rows' | 'degree';

export const SORT_LABEL: Record<IndexSort, string> = {
  name: 'A–Z',
  rows: 'Rows',
  degree: 'Degree',
};

export function parseSort(v: string | string[] | undefined): IndexSort {
  const s = Array.isArray(v) ? v[0] : v;
  return s === 'rows' || s === 'degree' ? s : 'name';
}
