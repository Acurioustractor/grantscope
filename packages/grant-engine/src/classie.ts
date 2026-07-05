/**
 * CLASSIE — taxonomy alignment for grants.
 *
 * CLASSIE (Classification of Social Sector Initiatives and Entities, by Our
 * Community) is the de-facto Australian social-sector taxonomy: ACNC, SmartyGrants
 * and the Funding Centre all classify against it, across three facets — Subject,
 * Population, and UN Sustainable Development Goal. Tagging our grants against it
 * makes us interoperable with that ecosystem and gives far better filtering than
 * our home-grown regex categories.
 *
 * IMPORTANT — scope of this file: the SDG list below is the official UN set. The
 * Subject and Population lists are a **curated seed aligned to CLASSIE's structure**
 * (its top-level Philanthropy-Classification-System tiers), NOT the full proprietary
 * CLASSIE code list. It is deliberately small — enough to map our existing internal
 * categories deterministically and to constrain an LLM to a controlled vocabulary.
 * Reconcile against the official CLASSIE export when we license/obtain it.
 */

export type ClassieFacet = 'subject' | 'population' | 'sdg';

export interface ClassieTag {
  code: string;
  label: string;
}

export interface ClassieClassification {
  subjects: string[];
  populations: string[];
  sdgs: string[];
}

// ── Subject facet (curated seed of CLASSIE / PCS top tiers) ──────────────────
export const CLASSIE_SUBJECTS: ClassieTag[] = [
  { code: 'arts-culture-humanities', label: 'Arts, Culture & Humanities' },
  { code: 'education', label: 'Education' },
  { code: 'environment', label: 'Environment' },
  { code: 'animals', label: 'Animals' },
  { code: 'health', label: 'Health' },
  { code: 'human-services', label: 'Human Services' },
  { code: 'public-safety', label: 'Public Safety, Disaster & Justice' },
  { code: 'community-economic-development', label: 'Community & Economic Development' },
  { code: 'science-technology', label: 'Science & Technology' },
  { code: 'social-science-research', label: 'Social Science & Research' },
  { code: 'agriculture-food', label: 'Agriculture & Food Systems' },
  { code: 'international', label: 'International Affairs' },
  { code: 'religion', label: 'Religion' },
  { code: 'philanthropy-voluntarism', label: 'Philanthropy & Voluntarism' },
];

// ── Population facet (curated seed) ──────────────────────────────────────────
export const CLASSIE_POPULATIONS: ClassieTag[] = [
  { code: 'first-nations', label: 'Aboriginal & Torres Strait Islander peoples' },
  { code: 'children-youth', label: 'Children & Young People' },
  { code: 'older-people', label: 'Older People' },
  { code: 'people-with-disability', label: 'People with Disability' },
  { code: 'women-girls', label: 'Women & Girls' },
  { code: 'cald', label: 'Culturally & Linguistically Diverse' },
  { code: 'lgbtiqa', label: 'LGBTIQA+ People' },
  { code: 'rural-remote', label: 'Rural & Remote Communities' },
  { code: 'low-income', label: 'People on Low Incomes' },
];

// ── SDG facet (official UN 2030 Agenda — 17 goals) ───────────────────────────
export const SDGS: ClassieTag[] = [
  { code: 'sdg-1', label: 'No Poverty' },
  { code: 'sdg-2', label: 'Zero Hunger' },
  { code: 'sdg-3', label: 'Good Health & Well-being' },
  { code: 'sdg-4', label: 'Quality Education' },
  { code: 'sdg-5', label: 'Gender Equality' },
  { code: 'sdg-6', label: 'Clean Water & Sanitation' },
  { code: 'sdg-7', label: 'Affordable & Clean Energy' },
  { code: 'sdg-8', label: 'Decent Work & Economic Growth' },
  { code: 'sdg-9', label: 'Industry, Innovation & Infrastructure' },
  { code: 'sdg-10', label: 'Reduced Inequalities' },
  { code: 'sdg-11', label: 'Sustainable Cities & Communities' },
  { code: 'sdg-12', label: 'Responsible Consumption & Production' },
  { code: 'sdg-13', label: 'Climate Action' },
  { code: 'sdg-14', label: 'Life Below Water' },
  { code: 'sdg-15', label: 'Life on Land' },
  { code: 'sdg-16', label: 'Peace, Justice & Strong Institutions' },
  { code: 'sdg-17', label: 'Partnerships for the Goals' },
];

const SUBJECT_CODES = new Set(CLASSIE_SUBJECTS.map((t) => t.code));
const POPULATION_CODES = new Set(CLASSIE_POPULATIONS.map((t) => t.code));
const SDG_CODES = new Set(SDGS.map((t) => t.code));

export function isValidClassieCode(facet: ClassieFacet, code: string): boolean {
  if (facet === 'subject') return SUBJECT_CODES.has(code);
  if (facet === 'population') return POPULATION_CODES.has(code);
  return SDG_CODES.has(code);
}

/**
 * Deterministic map from our internal category vocabulary (produced by the
 * source plugins' inferCategories) to CLASSIE facets. This lets us tag the
 * entire existing corpus at zero LLM cost, and keeps our category filters
 * working while CLASSIE becomes the interoperable layer on top.
 */
const CATEGORY_MAP: Record<string, Partial<ClassieClassification>> = {
  indigenous: { populations: ['first-nations'], sdgs: ['sdg-10'] },
  arts: { subjects: ['arts-culture-humanities'] },
  health: { subjects: ['health'], sdgs: ['sdg-3'] },
  community: { subjects: ['community-economic-development'], sdgs: ['sdg-11'] },
  regenerative: { subjects: ['environment', 'agriculture-food'], sdgs: ['sdg-13', 'sdg-15'] },
  enterprise: { subjects: ['community-economic-development'], sdgs: ['sdg-8'] },
  education: { subjects: ['education'], sdgs: ['sdg-4'] },
  justice: { subjects: ['public-safety'], populations: ['children-youth'], sdgs: ['sdg-16'] },
  sport: { subjects: ['human-services'], sdgs: ['sdg-3'] },
  disaster_relief: { subjects: ['public-safety'], sdgs: ['sdg-11'] },
  research: { subjects: ['social-science-research', 'science-technology'] },
  technology: { subjects: ['science-technology'], sdgs: ['sdg-9'] },
};

function uniq(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Map internal categories → CLASSIE. Unknown categories are ignored; the result
 * only ever contains valid codes.
 */
export function mapCategoriesToClassie(categories: string[]): ClassieClassification {
  const subjects: string[] = [];
  const populations: string[] = [];
  const sdgs: string[] = [];

  for (const raw of categories || []) {
    const mapping = CATEGORY_MAP[raw.toLowerCase().trim()];
    if (!mapping) continue;
    if (mapping.subjects) subjects.push(...mapping.subjects);
    if (mapping.populations) populations.push(...mapping.populations);
    if (mapping.sdgs) sdgs.push(...mapping.sdgs);
  }

  return { subjects: uniq(subjects), populations: uniq(populations), sdgs: uniq(sdgs) };
}

/** True when a classification has at least one tag on any facet. */
export function hasAnyClassie(c: ClassieClassification): boolean {
  return c.subjects.length > 0 || c.populations.length > 0 || c.sdgs.length > 0;
}

/**
 * Build an LLM prompt that constrains the model to the controlled CLASSIE
 * vocabulary. Used only for grants whose categories don't map to anything
 * (the deterministic mapper handles the rest for free).
 */
export function buildClassiePrompt(grant: { name?: string; description?: string; provider?: string }): string {
  const list = (tags: ClassieTag[]) => tags.map((t) => `${t.code} (${t.label})`).join(', ');
  return [
    'Classify this Australian grant against the CLASSIE taxonomy. Use ONLY the codes listed.',
    '',
    `Subjects: ${list(CLASSIE_SUBJECTS)}`,
    `Populations: ${list(CLASSIE_POPULATIONS)}`,
    `SDGs: ${list(SDGS)}`,
    '',
    `Grant: ${grant.name ?? ''}`,
    grant.provider ? `Funder: ${grant.provider}` : '',
    grant.description ? `Description: ${String(grant.description).slice(0, 600)}` : '',
    '',
    'Return STRICT JSON only: {"subjects":[...],"populations":[...],"sdgs":[...]}.',
    'Include a facet only when confident; empty arrays are fine. Do not invent codes.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Keep only valid codes from an (untrusted) LLM response. */
export function sanitizeClassie(input: Partial<ClassieClassification>): ClassieClassification {
  return {
    subjects: uniq((input.subjects || []).filter((c) => isValidClassieCode('subject', c))),
    populations: uniq((input.populations || []).filter((c) => isValidClassieCode('population', c))),
    sdgs: uniq((input.sdgs || []).filter((c) => isValidClassieCode('sdg', c))),
  };
}
