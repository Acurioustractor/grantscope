import { getServiceSupabase } from '@/lib/supabase';
import { searchGrantsSemantic } from '@grant-engine/embeddings';
import { CLASSIE_SUBJECTS } from '@grant-engine/classie';
import { ListPreviewProvider, GrantPreviewTrigger } from '../components/list-preview';
import { dedupeGrantList, sortGrantList, type GrantListItem } from './grant-list-utils';
import { getWikiSupportProject } from '@/lib/services/wiki-support-index';
import { getCachedGrantCoverageRows, type GrantCoverageRow as CoverageRow } from '@/lib/services/grant-opportunity-cache';

export const dynamic = 'force-dynamic';

interface Grant extends GrantListItem {
  focus_areas?: string[] | null;
  target_recipients?: string[] | null;
  geography?: string | null;
  aligned_projects?: string[] | null;
  grant_type?: string | null;
  discovery_method?: string | null;
  classie_subjects?: string[] | null;
}

// CLASSIE subject code→label lookup for filter chips + card badges. Codes with no
// curated label fall back to the raw code.
const CLASSIE_SUBJECT_LABEL = new Map(CLASSIE_SUBJECTS.map((t) => [t.code, t.label]));
function classieSubjectLabel(code: string): string {
  return CLASSIE_SUBJECT_LABEL.get(code) ?? code;
}

function matchesClassieSubject(grant: Grant, code: string): boolean {
  if (!code) return true;
  return (grant.classie_subjects ?? []).includes(code);
}

function formatAmount(min: number | null, max: number | null): string {
  if (min && max) return `$${min.toLocaleString()} – $${max.toLocaleString()}`;
  if (max) return `Up to $${max.toLocaleString()}`;
  if (min) return `From $${min.toLocaleString()}`;
  return 'Amount not specified';
}

function formatDate(date: string | null): string {
  if (!date) return 'Ongoing';
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATES = [
  { value: 'AU-National', label: 'National' },
  { value: 'AU-QLD', label: 'Queensland' },
  { value: 'AU-NSW', label: 'New South Wales' },
  { value: 'AU-VIC', label: 'Victoria' },
  { value: 'AU-WA', label: 'Western Australia' },
  { value: 'AU-SA', label: 'South Australia' },
  { value: 'AU-TAS', label: 'Tasmania' },
  { value: 'AU-ACT', label: 'ACT' },
  { value: 'AU-NT', label: 'Northern Territory' },
];

const GEO_SOURCE_MAP: Record<string, string[]> = {
  'AU-National': ['arc-grants', 'grantconnect', 'nhmrc', 'data-gov-au'],
  'AU-QLD': ['qld-grants', 'qld-arts-data', 'brisbane-grants'],
  'AU-NSW': ['nsw-grants'],
  'AU-VIC': ['vic-grants'],
  'AU-WA': ['wa-grants'],
  'AU-SA': ['sa-grants'],
  'AU-TAS': ['tas-grants'],
  'AU-ACT': ['act-grants'],
  'AU-NT': ['nt-grants'],
};

const GEO_TERMS: Record<string, string[]> = {
  'AU-National': ['national', 'australia', 'australian', 'all states', 'commonwealth', 'au-national'],
  'AU-QLD': ['qld', 'queensland', 'au-qld'],
  'AU-NSW': ['nsw', 'new south wales', 'au-nsw'],
  'AU-VIC': ['vic', 'victoria', 'au-vic'],
  'AU-WA': ['wa', 'western australia', 'au-wa'],
  'AU-SA': ['sa', 'south australia', 'au-sa'],
  'AU-TAS': ['tas', 'tasmania', 'au-tas'],
  'AU-ACT': ['act', 'australian capital territory', 'au-act'],
  'AU-NT': ['nt', 'northern territory', 'au-nt'],
};

const NATIONAL_GEO_TERMS = GEO_TERMS['AU-National'];

// Unambiguous state names that, if typed in the free-text query, should be read
// as a geography filter (which already includes National grants) rather than
// required as literal text in a grant's name/description. Deliberately excludes
// ambiguous abbreviations (act, sa, wa, nt, vic, tas) and "national"/"australia"
// so an ordinary topic query is never mis-routed into a state filter.
const QUERY_GEO_TERMS: Array<[string, string[]]> = [
  ['AU-QLD', ['queensland', 'qld']],
  ['AU-NSW', ['new south wales', 'nsw']],
  ['AU-VIC', ['victoria']],
  ['AU-WA', ['western australia']],
  ['AU-SA', ['south australia']],
  ['AU-TAS', ['tasmania']],
  ['AU-NT', ['northern territory']],
  ['AU-ACT', ['australian capital territory']],
];

/** Pull a recognised state name out of the query text. Returns the matched geo
 *  key (or '') and the query with that term removed (the remaining topic). So
 *  "youth justice queensland" becomes topic "youth justice" + geo AU-QLD, which
 *  surfaces QLD and National grants instead of demanding the literal word. */
function parseGeoFromQuery(raw: string): { geo: string; topic: string } {
  if (!raw.trim()) return { geo: '', topic: '' };
  let topic = raw;
  let geo = '';
  for (const [key, terms] of QUERY_GEO_TERMS) {
    for (const term of terms) {
      const re = new RegExp(`(^|\\W)${term}(\\W|$)`, 'i');
      if (re.test(topic)) {
        geo = key;
        topic = topic.replace(new RegExp(`(^|\\W)${term}(\\W|$)`, 'ig'), ' ');
      }
    }
    if (geo) break;
  }
  return { geo, topic: topic.replace(/\s+/g, ' ').trim() };
}

const PROJECT_PRESETS = [
  {
    value: 'goods',
    label: 'Goods',
    hint: 'procurement, social enterprise, equipment, practical delivery',
    orgHref: '/org/act/goods#funding-feed',
    category: 'enterprise',
    terms: ['goods', 'procurement', 'supplier', 'buyer', 'enterprise', 'social enterprise', 'equipment', 'tools', 'manufacturing', 'first nations', 'aboriginal', 'community controlled', 'remote'],
  },
  {
    value: 'justicehub',
    label: 'JusticeHub',
    hint: 'justice, diversion, reinvestment, community safety',
    orgHref: '/org/act/justicehub#funding-feed',
    category: 'justice',
    terms: ['justice', 'youth justice', 'diversion', 'reinvestment', 'community safety', 'legal', 'corrections', 'first nations', 'aboriginal', 'family violence'],
  },
  {
    value: 'civicgraph',
    label: 'CivicGraph',
    hint: 'data, transparency, governance, public-interest infrastructure',
    orgHref: '/org/act/justicehub/civicgraph#funding-feed',
    category: 'technology',
    terms: ['civicgraph', 'data', 'transparency', 'accountability', 'governance', 'digital', 'procurement', 'open data', 'public interest', 'evidence'],
  },
  {
    value: 'empathy-ledger',
    label: 'Empathy Ledger',
    hint: 'story, lived experience, evidence, culture',
    orgHref: '/org/act/empathy-ledger#funding-feed',
    category: 'community',
    terms: ['empathy ledger', 'storytelling', 'lived experience', 'community voice', 'culture', 'first nations data', 'evidence', 'media', 'arts'],
  },
  {
    value: 'picc',
    label: 'PICC',
    hint: 'Palm Island, housing, community infrastructure',
    orgHref: '/org/act/picc#funding-feed',
    category: 'community',
    terms: ['palm island', 'picc', 'housing', 'community infrastructure', 'community', 'indigenous', 'first nations', 'health', 'youth', 'remote'],
  },
  {
    value: 'harvest',
    label: 'Harvest / Farm',
    hint: 'regenerative, food, circular economy, agriculture',
    orgHref: '/org/act/harvest#funding-feed',
    category: 'regenerative',
    terms: ['harvest', 'farm', 'regenerative', 'agriculture', 'food', 'circular economy', 'landcare', 'sustainability', 'climate', 'social enterprise'],
  },
] as const;

type ProjectPreset = (typeof PROJECT_PRESETS)[number];
interface ActiveProjectPreset extends Omit<ProjectPreset, 'terms'> {
  terms: readonly string[];
  wikiTermCount: number;
}

const RESEARCH_SOURCES = new Set(['arc-grants', 'nhmrc']);
const RESEARCH_TERMS = ['research', 'fellowship', 'scholarship', 'phd', 'postdoctoral', 'clinical trial', 'discovery project'];

// Funding-type segmentation by discovery_method (set by the source-vector seed +
// open-tender feed). Capital = loans-with-grant-features (IBA/NAIF/Many Rivers/ABA);
// Procurement = the demand side (Supply Nation + AusTender open tenders); Grant =
// everything else, including uncategorised rows (so nothing disappears by default).
const METHOD_CHIPS = [
  { value: '', label: 'All types', hint: 'capital, procurement and grants' },
  { value: 'capital', label: 'Capital', hint: 'loans-with-grant: IBA Start-Up Finance, NAIF, Many Rivers, ABA' },
  { value: 'procurement', label: 'Procurement', hint: 'demand side: Supply Nation + AusTender open tenders' },
  { value: 'grant', label: 'Grants', hint: 'competitive grant programs' },
] as const;

function matchesDiscoveryMethod(grant: Grant, method: string): boolean {
  if (!method) return true;
  const dm = normalize(grant.discovery_method);
  if (method === 'capital') return dm === 'indigenous-finance';
  if (method === 'procurement') return dm === 'procurement';
  if (method === 'grant') return dm !== 'indigenous-finance' && dm !== 'procurement';
  return true;
}

function normalize(value: string | null | undefined): string {
  return (value || '').toLowerCase();
}

function fieldList(grant: Grant): string[] {
  return [
    grant.name,
    grant.provider,
    grant.program,
    grant.description,
    grant.geography,
    grant.source,
    ...(grant.categories || []),
    ...(grant.focus_areas || []),
    ...(grant.target_recipients || []),
    ...(grant.aligned_projects || []),
  ].filter(Boolean) as string[];
}

function textHaystack(grant: Grant): string {
  return fieldList(grant).join(' ').toLowerCase();
}

function termHitCount(grant: Grant, terms: readonly string[]): number {
  const haystack = textHaystack(grant);
  return terms.reduce((total, term) => total + (haystack.includes(term.toLowerCase()) ? 1 : 0), 0);
}

function mergeSearchTerms(terms: readonly string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const term of terms) {
    const key = term.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(term);
  }
  return merged;
}

function findProjectPreset(value: string): ProjectPreset | undefined {
  return PROJECT_PRESETS.find((preset) => preset.value === value);
}

function enrichProjectPreset(preset: ProjectPreset | undefined): ActiveProjectPreset | undefined {
  if (!preset) return undefined;
  const wikiProject = getWikiSupportProject(preset.value);
  const wikiTerms = wikiProject
    ? mergeSearchTerms([
        ...wikiProject.search_terms,
        ...wikiProject.themes,
        ...wikiProject.routes.flatMap((route) => route.search_terms),
      ])
    : [];
  return {
    ...preset,
    terms: mergeSearchTerms([...preset.terms, ...wikiTerms]),
    wikiTermCount: wikiTerms.length,
  };
}

function matchesProjectPreset(grant: Grant, preset: ActiveProjectPreset | undefined): boolean {
  if (!preset) return true;
  return termHitCount(grant, preset.terms) > 0;
}

function matchesSearchText(grant: Grant, query: string): boolean {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/[^a-z0-9-]/g, ''))
    .filter((term) => term.length > 2);
  if (terms.length === 0) return true;
  const haystack = textHaystack(grant);
  return terms.every((term) => haystack.includes(term));
}

function matchesGeography(grant: Grant, geoFilter: string): boolean {
  if (!geoFilter) return true;
  const geography = normalize(grant.geography);
  const source = normalize(grant.source);
  const terms = GEO_TERMS[geoFilter] || [];
  const stateMatch = terms.some((term) => geography.includes(term));
  const nationalMatch = geoFilter !== 'AU-National' && NATIONAL_GEO_TERMS.some((term) => geography.includes(term));
  const sourceMatch = GEO_SOURCE_MAP[geoFilter]?.includes(source) ?? false;
  return stateMatch || nationalMatch || sourceMatch;
}

function isResearchHeavy(grant: Grant): boolean {
  const source = normalize(grant.source);
  const programType = normalize(grant.program_type);
  const haystack = textHaystack(grant);
  return RESEARCH_SOURCES.has(source) || programType === 'fellowship' || programType === 'scholarship' || RESEARCH_TERMS.some((term) => haystack.includes(term));
}

function shouldIncludeResearch(query: string, sourceFilter: string, programTypeFilter: string, includeResearch: boolean): boolean {
  if (includeResearch || sourceFilter || programTypeFilter) return true;
  const lowered = query.toLowerCase();
  return RESEARCH_TERMS.some((term) => lowered.includes(term));
}

function rankGrantForFinder(grant: Grant, opts: { query: string; preset?: ActiveProjectPreset; geoFilter: string; includeResearch: boolean }): number {
  let score = 0;
  if (opts.preset) score += termHitCount(grant, opts.preset.terms) * 8;
  if (opts.geoFilter && matchesGeography(grant, opts.geoFilter)) score += 18;
  if (opts.query) score += termHitCount(grant, opts.query.split(/\s+/)) * 5;
  if (grant.closes_at) score += 4;
  if (grant.amount_min != null || grant.amount_max != null) score += 3;
  if (grant.last_verified_at) score += 2;
  if (!opts.includeResearch && isResearchHeavy(grant)) score -= 30;
  if (normalize(grant.geography).includes('national')) score -= opts.geoFilter && opts.geoFilter !== 'AU-National' ? 4 : 0;
  return score;
}

function uniqueLabels(values: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  return (values || []).filter((value) => {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isOpenishCoverage(row: CoverageRow, today: string): boolean {
  if (row.status === 'duplicate') return false;
  if (row.application_status === 'open') return true;
  if (row.closes_at && row.closes_at >= today) return true;
  return !row.closes_at && row.application_status !== 'closed' && row.status !== 'closed';
}

function sourceFamily(row: CoverageRow): string {
  const source = normalize(row.source);
  const provider = normalize(row.provider);
  if (source === 'foundation_program') return 'Foundations';
  if (source === 'grantconnect' || source === 'business-gov-au' || source === 'data-gov-au') return 'Federal / national';
  if (source === 'arc-grants' || source === 'nhmrc') return 'Research';
  if (
    source.includes('public-discovered')
    || source.includes('brisbane')
    || source.includes('sunshine')
    || source.includes('toowoomba')
    || source.includes('noosa')
    || source.includes('lockyer')
    || source.includes('centralhighlands')
  ) {
    return 'Council / local';
  }
  if (
    source.includes('nsw')
    || source.includes('qld')
    || source.includes('vic')
    || source.includes('wa')
    || source.includes('sa')
    || source.includes('tas')
    || source.includes('act')
    || source.includes('nt')
  ) {
    return 'State / territory';
  }
  if (source === 'ghl_sync' || provider.includes('curated')) return 'Curated';
  return 'Other';
}

function inferCoverageState(row: CoverageRow): string {
  const haystack = `${row.geography || ''} ${row.source || ''} ${row.provider || ''}`.toLowerCase();
  for (const state of STATES) {
    const terms = GEO_TERMS[state.value] || [];
    if (terms.some((term) => haystack.includes(term))) return state.label;
  }
  return 'Unspecified';
}

function buildCountMap<T extends string>(values: T[]): Array<{ label: T; count: number }> {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()]
    .map(([label, rowCount]) => ({ label, count: rowCount }))
    .sort((a, b) => b.count - a.count || String(a.label).localeCompare(String(b.label)));
}

const SOURCES = [
  { value: 'foundation_program', label: 'Foundation Programs' },
  { value: 'grantconnect', label: 'GrantConnect' },
  { value: 'business-gov-au', label: 'business.gov.au' },
  { value: 'public-discovered-grant-page', label: 'Public Council / Finder Pages' },
  { value: 'qld-grants', label: 'QLD Grants' },
  { value: 'nsw-grants', label: 'NSW Grants' },
  { value: 'vic-grants', label: 'VIC Grants' },
  { value: 'arc-grants', label: 'ARC Grants' },
  { value: 'nhmrc', label: 'NHMRC' },
  { value: 'ghl_sync', label: 'Curated' },
];

const PUBLIC_GRANTS_LIST_TABLE = 'grant_opportunities';
const GRANT_LIST_CANDIDATE_LIMIT = 500;

function sourceLabel(value: string): string {
  const known = SOURCES.find((source) => source.value === value);
  if (known) return known.label;
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const FAST_ACT_PIPELINE_GRANTS: Grant[] = [
  {
    id: 'act-pipeline-community-impact-innovation-nt',
    name: 'Community Impact and Innovation Grant - Aboriginal Investment NT',
    provider: 'Aboriginal Investment NT',
    program: 'Community Impact and Innovation Grants',
    program_type: 'grant',
    grant_type: 'open_opportunity',
    amount_min: 300000,
    amount_max: 1000000,
    closes_at: '2026-04-30',
    url: 'https://www.aboriginalinvestment.org.au/community-impact-and-innovation-grants',
    description: 'Medium-scale Aboriginal community-led projects in the NT. Useful for place-based employment, training, enterprise and community infrastructure.',
    categories: ['ACT pipeline', 'indigenous', 'community', 'enterprise'],
    focus_areas: ['first-nations', 'social-enterprise', 'place-based'],
    target_recipients: ['aboriginal_org'],
    geography: 'NT',
    aligned_projects: ['goods', 'picc'],
    source: 'act_pipeline',
    status: 'upcoming',
    sources: null,
    created_at: null,
    updated_at: null,
    last_verified_at: null,
  },
  {
    id: 'act-pipeline-justice-fellowships-2026',
    name: 'Justice Fellowships 2026',
    provider: 'Law and Justice Foundation NSW',
    program: 'Research fellowship',
    program_type: 'fellowship',
    grant_type: 'open_opportunity',
    amount_min: null,
    amount_max: 10000,
    closes_at: '2026-05-01',
    url: null,
    description: 'Research fellowship pathway for justice data analysis and CivicGraph justice outcomes work.',
    categories: ['ACT pipeline', 'justice', 'research'],
    focus_areas: ['justice', 'evidence', 'data'],
    target_recipients: [],
    geography: 'NSW',
    aligned_projects: ['justicehub', 'civicgraph'],
    source: 'act_pipeline',
    status: 'upcoming',
    sources: null,
    created_at: null,
    updated_at: null,
    last_verified_at: null,
  },
  {
    id: 'act-pipeline-business-startup-nt',
    name: 'Business Start-Up Grant - Aboriginal Investment NT',
    provider: 'Aboriginal Investment NT',
    program: 'Business Start-Up Grants',
    program_type: 'grant',
    grant_type: 'open_opportunity',
    amount_min: null,
    amount_max: 100000,
    closes_at: null,
    url: 'https://www.aboriginalinvestment.org.au/business-start-up-grants',
    description: 'Rolling start-up support for Aboriginal businesses. Relevant to enterprise setup, equipment, containers, and production readiness.',
    categories: ['ACT pipeline', 'enterprise', 'indigenous'],
    focus_areas: ['business-startup', 'first-nations'],
    target_recipients: ['aboriginal_business'],
    geography: 'NT',
    aligned_projects: ['goods'],
    source: 'act_pipeline',
    status: 'prospect',
    sources: null,
    created_at: null,
    updated_at: null,
    last_verified_at: null,
  },
  {
    id: 'act-pipeline-arts-social-impact',
    name: 'Arts and Social Impact Grant',
    provider: 'Philanthropy Australia',
    program: 'Arts and social impact',
    program_type: 'grant',
    grant_type: 'open_opportunity',
    amount_min: 20000,
    amount_max: 75000,
    closes_at: '2026-06-30',
    url: null,
    description: 'Potential support for Contained, Empathy Ledger and ALMA data visualisation: art as evidence translation.',
    categories: ['ACT pipeline', 'arts', 'impact'],
    focus_areas: ['storytelling', 'evidence', 'social-impact'],
    target_recipients: [],
    geography: 'National',
    aligned_projects: ['empathy-ledger', 'justicehub'],
    source: 'act_pipeline',
    status: 'upcoming',
    sources: null,
    created_at: null,
    updated_at: null,
    last_verified_at: null,
  },
  {
    id: 'act-pipeline-qbe-community-resilience',
    name: 'QBE Foundation - Community Resilience',
    provider: 'QBE Foundation',
    program: 'Catalysing Impact / community resilience',
    program_type: 'program',
    grant_type: 'open_opportunity',
    amount_min: null,
    amount_max: 200000,
    closes_at: null,
    url: null,
    description: 'Active Goods relationship pathway tied to the QBE Catalysing Impact program and match-funding stack.',
    categories: ['ACT pipeline', 'foundation', 'goods'],
    focus_areas: ['community-resilience', 'social-enterprise', 'climate'],
    target_recipients: [],
    geography: 'National',
    aligned_projects: ['goods'],
    source: 'act_pipeline',
    status: 'active',
    sources: null,
    created_at: null,
    updated_at: null,
    last_verified_at: null,
  },
  {
    id: 'act-pipeline-snow-social-enterprise',
    name: 'Snow Foundation - Goods Social Enterprise Scale-Up',
    provider: 'The Snow Foundation',
    program: 'Social enterprise / impact capital',
    program_type: 'program',
    grant_type: 'open_opportunity',
    amount_min: null,
    amount_max: 200000,
    closes_at: null,
    url: null,
    description: 'Warm foundation pathway for Goods scale-up, blended grant/capital sequencing, and production readiness evidence.',
    categories: ['ACT pipeline', 'foundation', 'capital'],
    focus_areas: ['social-enterprise', 'systems-change', 'goods'],
    target_recipients: [],
    geography: 'National',
    aligned_projects: ['goods'],
    source: 'act_pipeline',
    status: 'prospect',
    sources: null,
    created_at: null,
    updated_at: null,
    last_verified_at: null,
  },
];

function matchesSourceFamily(grant: Grant, familyFilter: string): boolean {
  if (!familyFilter) return true;
  return sourceFamily({
    source: grant.source ?? null,
    provider: grant.provider ?? null,
    geography: grant.geography ?? null,
    status: grant.status ?? null,
    application_status: null,
    closes_at: grant.closes_at ?? null,
    grant_type: grant.grant_type ?? null,
    updated_at: grant.updated_at ?? null,
    last_verified_at: grant.last_verified_at ?? null,
  }) === familyFilter;
}

function daysSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000));
}

function matchesQuality(grant: Pick<Grant, 'closes_at' | 'last_verified_at' | 'updated_at'>, qualityFilter: string): boolean {
  if (!qualityFilter) return true;
  if (qualityFilter === 'needs_dates') return !grant.closes_at;
  if (qualityFilter === 'needs_verification') return !grant.last_verified_at;
  if (qualityFilter === 'stale') return (daysSince(grant.last_verified_at || grant.updated_at) ?? 9999) > 90;
  if (qualityFilter === 'ready') return Boolean(grant.closes_at && grant.last_verified_at);
  return true;
}

function grantQualityLabel(grant: Pick<Grant, 'closes_at' | 'last_verified_at' | 'updated_at'>): string {
  if (matchesQuality(grant, 'ready')) return 'Ready';
  if (matchesQuality(grant, 'needs_dates')) return 'Needs date';
  if (matchesQuality(grant, 'needs_verification')) return 'Needs verification';
  if (matchesQuality(grant, 'stale')) return 'Stale';
  return 'Needs triage';
}

function grantSourceFamily(grant: Grant): string {
  return sourceFamily({
    source: grant.source ?? null,
    provider: grant.provider ?? null,
    geography: grant.geography ?? null,
    status: grant.status ?? null,
    application_status: null,
    closes_at: grant.closes_at ?? null,
    grant_type: grant.grant_type ?? null,
    updated_at: grant.updated_at ?? null,
    last_verified_at: grant.last_verified_at ?? null,
  });
}

function grantGeographyLabel(grant: Grant): string {
  const inferred = inferCoverageState({
    source: grant.source ?? null,
    provider: grant.provider ?? null,
    geography: grant.geography ?? null,
    status: grant.status ?? null,
    application_status: null,
    closes_at: grant.closes_at ?? null,
    grant_type: grant.grant_type ?? null,
    updated_at: grant.updated_at ?? null,
    last_verified_at: grant.last_verified_at ?? null,
  });
  return inferred === 'Unspecified' ? 'Geo unclear' : inferred;
}

function projectFitLabel(grant: Grant, preset: ActiveProjectPreset | undefined): string | null {
  if (!preset) return null;
  const hits = termHitCount(grant, preset.terms);
  if (hits >= 4) return `${preset.label} strong fit`;
  if (hits >= 2) return `${preset.label} fit`;
  if (hits >= 1) return `${preset.label} possible`;
  return null;
}

const PROGRAM_TYPES = [
  { value: 'fellowship', label: 'Fellowships' },
  { value: 'scholarship', label: 'Scholarships' },
  { value: 'grant', label: 'Grants' },
  { value: 'program', label: 'Programs' },
  { value: 'award', label: 'Awards' },
];

interface SearchParams {
  q?: string;
  category?: string;
  page?: string;
  type?: string;
  mode?: string;
  amount_min?: string;
  amount_max?: string;
  geo?: string;
  closing?: string;
  sort?: string;
  hide_ongoing?: string;
  source?: string;
  program_type?: string;
  project?: string;
  include_research?: string;
  family?: string;
  quality?: string;
  method?: string;
  classie?: string;
}

export default async function GrantsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const rawQuery = params.q || '';
  const category = params.category || '';
  const grantType = params.type || 'open_opportunity';
  const searchMode = params.mode || 'keyword';
  const amountMin = params.amount_min ? parseInt(params.amount_min, 10) : null;
  const amountMax = params.amount_max ? parseInt(params.amount_max, 10) : null;
  const rawGeo = params.geo || '';
  // A recognised state name typed in the query becomes a geography filter (which
  // includes National grants); the remaining words are the topic we text-match.
  // An explicit geo chip (rawGeo) always wins.
  const parsedGeo = parseGeoFromQuery(rawQuery);
  const query = parsedGeo.topic;
  const geoFilter = rawGeo || parsedGeo.geo;
  const closingFilter = params.closing || '';
  const sortOrder = params.sort || 'newest';
  const hideOngoing = params.hide_ongoing === '1';
  const sourceFilter = params.source || '';
  const programTypeFilter = params.program_type || '';
  const projectFilter = params.project || '';
  const familyFilter = params.family || '';
  const qualityFilter = params.quality || '';
  const methodFilter = params.method || '';
  const classieFilter = params.classie || '';
  const activeProjectPreset = enrichProjectPreset(findProjectPreset(projectFilter));
  const includeResearchParam = params.include_research === '1';
  const includeResearch = shouldIncludeResearch(query, sourceFilter, programTypeFilter, includeResearchParam);
  const page = parseInt(params.page || '1', 10);
  const pageSize = 25;
  const offset = (page - 1) * pageSize;
  const isFastGrantIndex =
    !query &&
    !category &&
    grantType === 'open_opportunity' &&
    searchMode === 'keyword' &&
    amountMin == null &&
    amountMax == null &&
    !geoFilter &&
    !closingFilter &&
    sortOrder === 'newest' &&
    !hideOngoing &&
    !sourceFilter &&
    !programTypeFilter &&
    !projectFilter &&
    !familyFilter &&
    !qualityFilter &&
    !includeResearchParam &&
    !methodFilter &&
    !classieFilter &&
    page === 1;

  const supabase = getServiceSupabase();
  let grants: Grant[] = [];
  let count = 0;
  let usedSemantic = false;

  const forceSemantic = searchMode === 'ai';
  const shouldSemantic = forceSemantic || (query && (query.trim().split(/\s+/).length > 5 || query.includes('?')));

  if (isFastGrantIndex) {
    grants = FAST_ACT_PIPELINE_GRANTS;
    count = grants.length;
  } else if (query && shouldSemantic && process.env.OPENAI_API_KEY) {
    try {
      const results = await searchGrantsSemantic(supabase, query, {
        apiKey: process.env.OPENAI_API_KEY,
        matchThreshold: 0.65,
        matchCount: 50,
        category: category || undefined,
        grantType: grantType !== 'all' ? grantType : undefined,
      });

      const semanticIds = results.map((result) => result.id);
      const { data: semanticDetails } = semanticIds.length > 0
        ? await supabase
            .from(PUBLIC_GRANTS_LIST_TABLE)
            .select('id, program, program_type, grant_type, source, status, sources, created_at, updated_at, last_verified_at, focus_areas, target_recipients, geography, aligned_projects, discovery_method, classie_subjects')
            .in('id', semanticIds)
        : { data: [] };
      const semanticDetailMap = new Map(
        (semanticDetails || []).map((row) => [row.id, row]),
      );

      grants = results.map(r => ({
        ...(semanticDetailMap.get(r.id) || {}),
        id: r.id,
        name: r.name,
        provider: r.provider,
        program: semanticDetailMap.get(r.id)?.program ?? null,
        program_type: semanticDetailMap.get(r.id)?.program_type ?? null,
        grant_type: semanticDetailMap.get(r.id)?.grant_type ?? null,
        amount_min: r.amount_min,
        amount_max: r.amount_max,
        closes_at: r.closes_at,
        url: r.url,
        description: r.description ?? null,
        categories: r.categories || [],
        source: semanticDetailMap.get(r.id)?.source ?? null,
        status: semanticDetailMap.get(r.id)?.status || 'open',
        sources: semanticDetailMap.get(r.id)?.sources ?? null,
        focus_areas: semanticDetailMap.get(r.id)?.focus_areas ?? [],
        target_recipients: semanticDetailMap.get(r.id)?.target_recipients ?? [],
        geography: semanticDetailMap.get(r.id)?.geography ?? null,
        aligned_projects: semanticDetailMap.get(r.id)?.aligned_projects ?? [],
        discovery_method: semanticDetailMap.get(r.id)?.discovery_method ?? null,
        classie_subjects: semanticDetailMap.get(r.id)?.classie_subjects ?? [],
        similarity: r.similarity,
      }));

      // Apply client-side filters to semantic results
      // Exclude expired grants by default
      if (closingFilter !== 'all') {
        const now = new Date().toISOString();
        grants = grants.filter(g => !g.closes_at || g.closes_at > now);
      }
      if (amountMin) grants = grants.filter(g => (g.amount_max || 0) >= amountMin);
      if (amountMax) grants = grants.filter(g => (g.amount_min || 0) <= amountMax);
      if (sourceFilter) {
        grants = grants.filter(g => g.source === sourceFilter);
      }
      if (programTypeFilter) {
        grants = grants.filter(g => g.program_type === programTypeFilter);
      }
      if (geoFilter) {
        grants = grants.filter(g => matchesGeography(g, geoFilter));
      }
      if (activeProjectPreset) {
        grants = grants.filter(g => matchesProjectPreset(g, activeProjectPreset));
      }
      if (methodFilter) {
        grants = grants.filter(g => matchesDiscoveryMethod(g, methodFilter));
      }
      if (classieFilter) {
        grants = grants.filter(g => matchesClassieSubject(g, classieFilter));
      }
      if (familyFilter) {
        grants = grants.filter(g => matchesSourceFamily(g, familyFilter));
      }
      if (qualityFilter) {
        grants = grants.filter(g => matchesQuality(g, qualityFilter));
      }
      if (!includeResearch) {
        grants = grants.filter(g => !isResearchHeavy(g));
      }
      if (closingFilter === '30') {
        const cutoff = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        grants = grants.filter(g => g.closes_at && g.closes_at <= cutoff);
      } else if (closingFilter === '90') {
        const cutoff = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
        grants = grants.filter(g => g.closes_at && g.closes_at <= cutoff);
      } else if (closingFilter === 'ongoing') {
        grants = grants.filter(g => !g.closes_at);
      }

      grants = sortGrantList(dedupeGrantList(grants), sortOrder, { semantic: true }) as Grant[];
      if (sortOrder === 'newest' && (activeProjectPreset || geoFilter || !includeResearch)) {
        grants = grants.sort((a, b) => rankGrantForFinder(b, { query, preset: activeProjectPreset, geoFilter, includeResearch }) - rankGrantForFinder(a, { query, preset: activeProjectPreset, geoFilter, includeResearch }));
      }
      count = grants.length;
      usedSemantic = true;
    } catch {
      usedSemantic = false;
    }
  }

  if (!usedSemantic && !isFastGrantIndex) {
    const grantFields = [
      'id',
      'name',
      'provider',
      'program',
      'program_type',
      'grant_type',
      'amount_min',
      'amount_max',
      'closes_at',
      'url',
      'description',
      'categories',
      'focus_areas',
      'target_recipients',
      'geography',
      'aligned_projects',
      'discovery_method',
      'classie_subjects',
      'source',
      'status',
      'sources',
      'created_at',
      'updated_at',
      'last_verified_at',
    ].join(', ');

    let dbQuery = supabase
      .from(PUBLIC_GRANTS_LIST_TABLE)
      .select(grantFields);

    if (grantType !== 'all') {
      dbQuery = dbQuery.eq('grant_type', grantType);
    }

    if (query) {
      // Tokenise: match each term in ANY field and require ALL terms (AND across
      // terms, OR across fields). This mirrors matchesSearchText so the DB
      // pre-filter returns the candidate set the client matcher expects, instead
      // of demanding the whole query as one contiguous substring, which silently
      // zeroed every multi-word search (e.g. "youth justice queensland").
      const searchFields = ['name', 'provider', 'program', 'description', 'geography'];
      const terms = query
        .toLowerCase()
        .split(/\s+/)
        .map((term) => term.replace(/[^a-z0-9-]/g, ''))
        .filter((term) => term.length > 2);
      if (terms.length > 0) {
        for (const term of terms) {
          dbQuery = dbQuery.or(searchFields.map((field) => `${field}.ilike.%${term}%`).join(','));
        }
      } else {
        const escapedQuery = query.replace(/[%_,()]/g, '');
        dbQuery = dbQuery.or(searchFields.map((field) => `${field}.ilike.%${escapedQuery}%`).join(','));
      }
    }

    if (category) {
      dbQuery = dbQuery.contains('categories', [category]);
    }

    if (classieFilter) {
      dbQuery = dbQuery.contains('classie_subjects', [classieFilter]);
    }

    if (amountMin) {
      dbQuery = dbQuery.gte('amount_max', amountMin);
    }
    if (amountMax) {
      dbQuery = dbQuery.lte('amount_min', amountMax);
    }

    if (sourceFilter) {
      dbQuery = dbQuery.eq('source', sourceFilter);
    }

    if (programTypeFilter) {
      dbQuery = dbQuery.eq('program_type', programTypeFilter);
    }

    // Capital/procurement are tiny sets; pin them at the DB so they survive the
    // candidate cap. 'grant' is the majority — handled by the client residual filter.
    if (methodFilter === 'capital') {
      dbQuery = dbQuery.eq('discovery_method', 'indigenous-finance');
    } else if (methodFilter === 'procurement') {
      dbQuery = dbQuery.eq('discovery_method', 'procurement');
    }

    if (closingFilter === '30') {
      dbQuery = dbQuery.gt('closes_at', new Date().toISOString());
      dbQuery = dbQuery.lt('closes_at', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
    } else if (closingFilter === '90') {
      dbQuery = dbQuery.gt('closes_at', new Date().toISOString());
      dbQuery = dbQuery.lt('closes_at', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString());
    } else if (closingFilter === 'ongoing') {
      dbQuery = dbQuery.is('closes_at', null);
    } else if (closingFilter !== 'all') {
      // Default: exclude expired grants (past close date)
      dbQuery = dbQuery.or(`closes_at.gt.${new Date().toISOString()},closes_at.is.null`);
    }

    if (hideOngoing) {
      dbQuery = dbQuery.not('closes_at', 'is', null);
    }

    if (sortOrder === 'closing_asc') {
      dbQuery = dbQuery.order('closes_at', { ascending: true, nullsFirst: false });
    } else if (sortOrder === 'amount_desc') {
      dbQuery = dbQuery.order('amount_max', { ascending: false, nullsFirst: false });
    } else {
      dbQuery = dbQuery.order('updated_at', { ascending: false, nullsFirst: false });
    }

    dbQuery = dbQuery.range(0, Math.max(GRANT_LIST_CANDIDATE_LIMIT, offset + pageSize * 4) - 1);

    const result = await dbQuery;
    const filteredRows = (((result.data || []) as unknown) as Grant[])
      .filter((grant) => matchesSearchText(grant, query))
      .filter((grant) => matchesGeography(grant, geoFilter))
      .filter((grant) => matchesProjectPreset(grant, activeProjectPreset))
      .filter((grant) => matchesDiscoveryMethod(grant, methodFilter))
      .filter((grant) => matchesClassieSubject(grant, classieFilter))
      .filter((grant) => matchesSourceFamily(grant, familyFilter))
      .filter((grant) => matchesQuality(grant, qualityFilter))
      .filter((grant) => includeResearch || !isResearchHeavy(grant));
    let uniqueGrants = sortGrantList(dedupeGrantList(filteredRows), sortOrder) as Grant[];
    if (sortOrder === 'newest' && (activeProjectPreset || geoFilter || !includeResearch)) {
      uniqueGrants = uniqueGrants.sort((a, b) => rankGrantForFinder(b, { query, preset: activeProjectPreset, geoFilter, includeResearch }) - rankGrantForFinder(a, { query, preset: activeProjectPreset, geoFilter, includeResearch }));
    }

    count = uniqueGrants.length;
    grants = uniqueGrants.slice(offset, offset + pageSize);
  }

  const totalPages = usedSemantic || isFastGrantIndex ? 1 : Math.ceil((count || 0) / pageSize);
  const today = new Date().toISOString().slice(0, 10);
  const coverageRows = isFastGrantIndex ? [] as CoverageRow[] : await getCachedGrantCoverageRows();
  const openCoverageRows = coverageRows.filter((row) => isOpenishCoverage(row, today));
  const qualityCounts = {
    ready: openCoverageRows.filter((row) => matchesQuality(row, 'ready')).length,
    needs_dates: openCoverageRows.filter((row) => matchesQuality(row, 'needs_dates')).length,
    needs_verification: openCoverageRows.filter((row) => matchesQuality(row, 'needs_verification')).length,
    stale: openCoverageRows.filter((row) => matchesQuality(row, 'stale')).length,
  };
  const liveSources = buildCountMap(
    openCoverageRows
      .map((row) => row.source)
      .filter((source): source is string => Boolean(source)),
  ).slice(0, 24);
  const liveSourceCountByValue = new Map(liveSources.map((item) => [item.label, item.count]));
  const sourceOptions = [
    ...SOURCES,
    ...liveSources
      .filter((item) => !SOURCES.some((source) => source.value === item.label))
      .map((item) => ({ value: item.label, label: sourceLabel(item.label) })),
  ];

  const categories = ['indigenous', 'arts', 'community', 'health', 'education', 'enterprise', 'regenerative', 'technology', 'justice'];
  const grantTypes = [
    { value: 'open_opportunity', label: 'Open Opportunities' },
    { value: 'historical_award', label: 'Historical Awards' },
    { value: 'all', label: 'All' },
  ];

  // Build filter query string for pagination
  const filterParams = new URLSearchParams();
  filterParams.set('type', grantType);
  if (query) filterParams.set('q', query);
  if (category) filterParams.set('category', category);
  if (searchMode !== 'keyword') filterParams.set('mode', searchMode);
  if (amountMin) filterParams.set('amount_min', String(amountMin));
  if (amountMax) filterParams.set('amount_max', String(amountMax));
  if (geoFilter) filterParams.set('geo', geoFilter);
  if (closingFilter) filterParams.set('closing', closingFilter);
  if (sortOrder !== 'newest') filterParams.set('sort', sortOrder);
  if (hideOngoing) filterParams.set('hide_ongoing', '1');
  if (sourceFilter) filterParams.set('source', sourceFilter);
  if (programTypeFilter) filterParams.set('program_type', programTypeFilter);
  if (projectFilter) filterParams.set('project', projectFilter);
  if (methodFilter) filterParams.set('method', methodFilter);
  if (classieFilter) filterParams.set('classie', classieFilter);
  if (includeResearchParam) filterParams.set('include_research', '1');
  if (familyFilter) filterParams.set('family', familyFilter);
  if (qualityFilter) filterParams.set('quality', qualityFilter);
  const filterQS = filterParams.toString();

  const hrefFor = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    next.set('type', updates.type ?? grantType);
    const nextMode = updates.mode ?? searchMode;
    if (nextMode !== 'keyword') next.set('mode', nextMode);
    const nextQuery = updates.q ?? query;
    if (nextQuery) next.set('q', nextQuery);
    const nextCategory = updates.category ?? category;
    if (nextCategory) next.set('category', nextCategory);
    const nextAmountMin = updates.amount_min ?? (amountMin ? String(amountMin) : '');
    if (nextAmountMin) next.set('amount_min', nextAmountMin);
    const nextAmountMax = updates.amount_max ?? (amountMax ? String(amountMax) : '');
    if (nextAmountMax) next.set('amount_max', nextAmountMax);
    const nextGeo = updates.geo ?? geoFilter;
    if (nextGeo) next.set('geo', nextGeo);
    const nextClosing = updates.closing ?? closingFilter;
    if (nextClosing) next.set('closing', nextClosing);
    const nextSort = updates.sort ?? sortOrder;
    if (nextSort !== 'newest') next.set('sort', nextSort);
    const nextHideOngoing = updates.hide_ongoing ?? (hideOngoing ? '1' : '');
    if (nextHideOngoing) next.set('hide_ongoing', nextHideOngoing);
    const nextSource = updates.source ?? sourceFilter;
    if (nextSource) next.set('source', nextSource);
    const nextFamily = updates.family ?? familyFilter;
    if (nextFamily) next.set('family', nextFamily);
    const nextQuality = updates.quality ?? qualityFilter;
    if (nextQuality) next.set('quality', nextQuality);
    const nextProgramType = updates.program_type ?? programTypeFilter;
    if (nextProgramType) next.set('program_type', nextProgramType);
    const nextProject = updates.project ?? projectFilter;
    if (nextProject) next.set('project', nextProject);
    const nextMethod = updates.method ?? methodFilter;
    if (nextMethod) next.set('method', nextMethod);
    const nextClassie = updates.classie ?? classieFilter;
    if (nextClassie) next.set('classie', nextClassie);
    const nextIncludeResearch = updates.include_research ?? (includeResearchParam ? '1' : '');
    if (nextIncludeResearch) next.set('include_research', nextIncludeResearch);
    return `/grants?${next.toString()}`;
  };

  const activeFilters = [
    query ? `Search: ${query}` : null,
    category ? `Category: ${category}` : null,
    activeProjectPreset ? `Project: ${activeProjectPreset.label}` : null,
    methodFilter ? `Path: ${METHOD_CHIPS.find((chip) => chip.value === methodFilter)?.label ?? methodFilter}` : null,
    geoFilter ? `Place: ${STATES.find((state) => state.value === geoFilter)?.label ?? geoFilter}` : null,
    closingFilter ? `Closing: ${closingFilter === '30' ? '30 days' : closingFilter === '90' ? '90 days' : closingFilter}` : null,
    sourceFilter ? `Source: ${sourceLabel(sourceFilter)}` : null,
    programTypeFilter ? `Type: ${PROGRAM_TYPES.find((type) => type.value === programTypeFilter)?.label ?? programTypeFilter}` : null,
    classieFilter ? `Subject: ${classieSubjectLabel(classieFilter)}` : null,
    qualityFilter ? `Quality: ${qualityFilter.replace(/_/g, ' ')}` : null,
    includeResearchParam ? 'Research feeds included' : null,
    hideOngoing ? 'Ongoing hidden' : null,
  ].filter((item): item is string => Boolean(item));
  const clearHref = '/grants?type=open_opportunity&sort=closing_asc&quality=ready';
  const primaryViews = [
    {
      label: 'Ready deadlines',
      detail: `${qualityCounts.ready.toLocaleString()} verified with dates`,
      href: hrefFor({ type: 'open_opportunity', sort: 'closing_asc', quality: 'ready', project: '', method: '', category: '', classie: '', source: '', family: '', closing: '', geo: '', q: '' }),
      active: grantType === 'open_opportunity' && sortOrder === 'closing_asc' && qualityFilter === 'ready' && !projectFilter && !methodFilter && !category && !classieFilter,
    },
    {
      label: 'Goods',
      detail: 'ACT delivery lane',
      href: hrefFor({ project: 'goods', method: '', category: '', classie: '', sort: 'closing_asc', quality: 'ready' }),
      active: projectFilter === 'goods',
    },
    {
      label: 'Procurement',
      detail: 'buyers and tenders',
      href: hrefFor({ method: 'procurement', project: '', category: '', classie: '', sort: 'closing_asc', quality: '' }),
      active: methodFilter === 'procurement',
    },
    {
      label: 'Arts / festivals',
      detail: 'culture pathways',
      href: hrefFor({ category: 'arts', classie: '', project: '', method: '', sort: 'closing_asc', quality: 'ready' }),
      active: category === 'arts',
    },
    {
      label: 'Capital',
      detail: 'loans and blended finance',
      href: hrefFor({ method: 'capital', project: '', category: '', classie: '', sort: 'closing_asc', quality: '' }),
      active: methodFilter === 'capital',
    },
  ];
  const resultNoun = grantType === 'historical_award' ? 'historical awards' : grantType === 'all' ? 'records' : 'open opportunities';

  return (
    <ListPreviewProvider>
    <div className="mx-auto max-w-[1280px]">
      <section className="mb-4 rounded-md border border-bauhaus-black/10 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-bauhaus-muted">Grant finder</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-bauhaus-black">Find money to act on</h1>
            <p className="mt-1 text-sm text-bauhaus-muted">
              {count.toLocaleString()} {resultNoun}. Search first, then narrow only when the list is too broad.
            </p>
          </div>
          <div className="flex shrink-0 gap-1 overflow-x-auto pb-1 xl:flex-wrap xl:overflow-visible xl:pb-0">
            {grantTypes.map((t) => (
              <a
                key={t.value}
                href={hrefFor({ type: t.value })}
                className={`inline-flex min-h-9 items-center rounded-md border px-3 text-xs font-semibold ${
                  grantType === t.value
                    ? 'border-bauhaus-black bg-bauhaus-black text-white'
                    : 'border-bauhaus-black/10 bg-white text-bauhaus-muted hover:bg-bauhaus-canvas'
                }`}
              >
                {t.label}
              </a>
            ))}
          </div>
        </div>

        <form method="get" className="mt-4 grid gap-2 lg:grid-cols-[minmax(0,1fr)_180px_110px]">
          <input type="hidden" name="type" value={grantType} />
          <input type="hidden" name="mode" value={searchMode} />
          {projectFilter && <input type="hidden" name="project" value={projectFilter} />}
          {methodFilter && <input type="hidden" name="method" value={methodFilter} />}
          {familyFilter && <input type="hidden" name="family" value={familyFilter} />}
          {qualityFilter && <input type="hidden" name="quality" value={qualityFilter} />}
          {includeResearchParam && <input type="hidden" name="include_research" value="1" />}
          {amountMin && <input type="hidden" name="amount_min" value={amountMin} />}
          {amountMax && <input type="hidden" name="amount_max" value={amountMax} />}
          {geoFilter && <input type="hidden" name="geo" value={geoFilter} />}
          {closingFilter && <input type="hidden" name="closing" value={closingFilter} />}
          {sortOrder !== 'newest' && <input type="hidden" name="sort" value={sortOrder} />}
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={searchMode === 'ai' ? 'Describe the funding need' : 'Search grants, funders, places, themes'}
            className="min-h-11 w-full rounded-md border border-bauhaus-black/15 bg-white px-3 text-sm outline-none focus:border-bauhaus-blue focus:ring-2 focus:ring-blue-100"
          />
          <select
            name="category"
            defaultValue={category}
            className="min-h-11 rounded-md border border-bauhaus-black/15 bg-white px-3 text-sm outline-none focus:border-bauhaus-blue"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
          <button type="submit" className="min-h-11 rounded-md bg-bauhaus-black px-4 text-sm font-semibold text-white hover:bg-bauhaus-blue">
            Search
          </button>
        </form>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-5 md:overflow-visible md:pb-0">
          {primaryViews.map((view) => (
            <a
              key={view.label}
              href={view.href}
              className={`min-w-[178px] rounded-md border p-3 text-sm md:min-w-0 ${
                view.active
                  ? 'border-bauhaus-black bg-bauhaus-black text-white'
                  : 'border-bauhaus-black/10 bg-bauhaus-canvas/50 text-bauhaus-black hover:border-bauhaus-blue hover:bg-link-light'
              }`}
            >
              <div className="font-semibold">{view.label}</div>
              <div className={`mt-1 text-xs ${view.active ? 'text-white/70' : 'text-bauhaus-muted'}`}>{view.detail}</div>
            </a>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {activeFilters.length > 0 ? activeFilters.slice(0, 8).map((filter) => (
              <span key={filter} className="rounded-md border border-bauhaus-black/10 bg-white px-2 py-1 text-xs font-semibold text-bauhaus-muted">
                {filter}
              </span>
            )) : (
              <span className="text-xs text-bauhaus-muted">No extra filters applied.</span>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <a href={clearHref} className="inline-flex min-h-9 items-center rounded-md border border-bauhaus-black/10 px-3 text-xs font-semibold text-bauhaus-muted hover:bg-bauhaus-canvas">
              Reset
            </a>
            <details className="relative">
              <summary className="flex min-h-9 cursor-pointer list-none items-center rounded-md border border-bauhaus-black/10 px-3 text-xs font-semibold text-bauhaus-black hover:bg-bauhaus-canvas">
                Advanced filters
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-[min(920px,calc(100vw-2rem))] rounded-md border border-bauhaus-black/10 bg-white p-4 shadow-xl">
                <form method="get" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <input type="hidden" name="type" value={grantType} />
                  <input type="hidden" name="mode" value={searchMode} />
                  {query && <input type="hidden" name="q" value={query} />}
                  {category && <input type="hidden" name="category" value={category} />}
                  <label className="text-xs font-semibold text-bauhaus-muted">
                    Project
                    <select name="project" defaultValue={projectFilter} className="mt-1 min-h-10 w-full rounded-md border border-bauhaus-black/15 bg-white px-2 text-sm text-bauhaus-black">
                      <option value="">All ACT</option>
                      {PROJECT_PRESETS.map((preset) => <option key={preset.value} value={preset.value}>{preset.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-bauhaus-muted">
                    Path
                    <select name="method" defaultValue={methodFilter} className="mt-1 min-h-10 w-full rounded-md border border-bauhaus-black/15 bg-white px-2 text-sm text-bauhaus-black">
                      {METHOD_CHIPS.map((chip) => <option key={chip.value || 'all'} value={chip.value}>{chip.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-bauhaus-muted">
                    State
                    <select name="geo" defaultValue={geoFilter} className="mt-1 min-h-10 w-full rounded-md border border-bauhaus-black/15 bg-white px-2 text-sm text-bauhaus-black">
                      <option value="">All</option>
                      {STATES.map((state) => <option key={state.value} value={state.value}>{state.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-bauhaus-muted">
                    Source
                    <select name="source" defaultValue={sourceFilter} className="mt-1 min-h-10 w-full rounded-md border border-bauhaus-black/15 bg-white px-2 text-sm text-bauhaus-black">
                      <option value="">All</option>
                      {sourceOptions.map((source) => (
                        <option key={source.value} value={source.value}>
                          {source.label}{liveSourceCountByValue.has(source.value) ? ` (${liveSourceCountByValue.get(source.value)?.toLocaleString()})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-bauhaus-muted">
                    Program type
                    <select name="program_type" defaultValue={programTypeFilter} className="mt-1 min-h-10 w-full rounded-md border border-bauhaus-black/15 bg-white px-2 text-sm text-bauhaus-black">
                      <option value="">All</option>
                      {PROGRAM_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-bauhaus-muted">
                    Subject
                    <select name="classie" defaultValue={classieFilter} className="mt-1 min-h-10 w-full rounded-md border border-bauhaus-black/15 bg-white px-2 text-sm text-bauhaus-black">
                      <option value="">All subjects</option>
                      {CLASSIE_SUBJECTS.map((subject) => <option key={subject.code} value={subject.code}>{subject.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-bauhaus-muted">
                    Sort
                    <select name="sort" defaultValue={sortOrder} className="mt-1 min-h-10 w-full rounded-md border border-bauhaus-black/15 bg-white px-2 text-sm text-bauhaus-black">
                      <option value="newest">Newest</option>
                      <option value="closing_asc">Closing soon</option>
                      <option value="closing_desc">Closing last</option>
                      <option value="amount_desc">Highest amount</option>
                      <option value="amount_asc">Lowest amount</option>
                      <option value="name_asc">A-Z</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-bauhaus-muted">
                    Quality
                    <select name="quality" defaultValue={qualityFilter} className="mt-1 min-h-10 w-full rounded-md border border-bauhaus-black/15 bg-white px-2 text-sm text-bauhaus-black">
                      <option value="">All quality</option>
                      <option value="ready">Ready</option>
                      <option value="needs_dates">Needs dates</option>
                      <option value="needs_verification">Needs verification</option>
                      <option value="stale">Stale</option>
                    </select>
                  </label>
                  <div className="grid gap-2 md:grid-cols-2 xl:col-span-2">
                    <label className="text-xs font-semibold text-bauhaus-muted">
                      Min amount
                      <input name="amount_min" type="number" defaultValue={amountMin || ''} className="mt-1 min-h-10 w-full rounded-md border border-bauhaus-black/15 px-2 text-sm text-bauhaus-black" />
                    </label>
                    <label className="text-xs font-semibold text-bauhaus-muted">
                      Max amount
                      <input name="amount_max" type="number" defaultValue={amountMax || ''} className="mt-1 min-h-10 w-full rounded-md border border-bauhaus-black/15 px-2 text-sm text-bauhaus-black" />
                    </label>
                  </div>
                  <div className="flex flex-wrap items-end gap-3 xl:col-span-2">
                    <label className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-bauhaus-muted">
                      <input type="checkbox" name="hide_ongoing" value="1" defaultChecked={hideOngoing} />
                      Hide ongoing
                    </label>
                    <label className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-bauhaus-muted">
                      <input type="checkbox" name="include_research" value="1" defaultChecked={includeResearchParam} />
                      Include research feeds
                    </label>
                    <button type="submit" className="ml-auto min-h-10 rounded-md bg-bauhaus-black px-4 text-sm font-semibold text-white hover:bg-bauhaus-blue">
                      Apply
                    </button>
                  </div>
                </form>
              </div>
            </details>
          </div>
        </div>
      </section>

      {/* Semantic search banner */}
      {usedSemantic && (
        <div className="mb-4 p-3 bg-link-light border border-bauhaus-blue/30 rounded-lg">
          <span className="text-xs font-semibold text-bauhaus-blue">
            AI found {count} grants matching: &ldquo;{query}&rdquo;
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-bauhaus-black/10 bg-white">
        <div className="grid grid-cols-[minmax(0,1fr)_140px_120px] gap-3 border-b border-bauhaus-black/10 bg-bauhaus-canvas/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-bauhaus-muted max-lg:hidden">
          <div>Opportunity</div>
          <div>Amount</div>
          <div>Deadline</div>
        </div>
        {grants.map((grant) => (
          <GrantPreviewTrigger
            key={grant.id}
            grant={{
              id: grant.id,
              name: grant.name,
              provider: grant.provider,
              description: grant.description ?? null,
              amount_min: grant.amount_min,
              amount_max: grant.amount_max,
              closes_at: grant.closes_at,
              categories: grant.categories || [],
              url: grant.url ?? null,
              source: grant.source ?? null,
            }}
          >
            <div className="border-b border-bauhaus-black/10 px-3 py-3 transition-colors last:border-b-0 hover:bg-bauhaus-canvas/40">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_140px_120px]">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-bauhaus-black text-[15px]">{grant.name}</h3>
                    {grant.program_type && grant.program_type !== 'open_opportunity' && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 uppercase tracking-wider rounded flex-shrink-0 ${
                        grant.program_type === 'fellowship' ? 'bg-link-light text-bauhaus-blue' :
                        grant.program_type === 'scholarship' ? 'bg-warning-light text-bauhaus-black' :
                        grant.program_type === 'historical_award' ? 'bg-bauhaus-canvas text-bauhaus-muted' :
                        'bg-money-light text-money'
                      }`}>
                        {grant.program_type.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-bauhaus-muted mt-0.5">
                    {grant.provider}{grant.program ? ` — ${grant.program}` : ''}
                  </div>
                  {grant.description && (
                    <div className="text-sm text-bauhaus-muted/70 mt-1 line-clamp-2">
                      {grant.description}
                    </div>
                  )}
                </div>
                <div className="font-mono text-sm font-semibold tabular-nums text-bauhaus-blue">
                    {formatAmount(grant.amount_min, grant.amount_max)}
                </div>
                <div className={`text-sm font-semibold ${grant.closes_at ? 'text-bauhaus-red' : 'text-bauhaus-muted'}`}>
                  {grant.closes_at ? formatDate(grant.closes_at) : 'Ongoing'}
                  {usedSemantic && grant.similarity != null && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-bauhaus-canvas rounded-full overflow-hidden">
                        <div className="h-full bg-bauhaus-blue rounded-full" style={{ width: `${Math.round(grant.similarity * 100)}%` }}></div>
                      </div>
                      <span className="text-[10px] font-semibold text-bauhaus-muted tabular-nums">
                        {Math.round(grant.similarity * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                {projectFitLabel(grant, activeProjectPreset) && (
                  <span className="text-[11px] px-2 py-0.5 bg-link-light text-bauhaus-blue font-black rounded">
                    {projectFitLabel(grant, activeProjectPreset)}
                  </span>
                )}
                <span className="text-[11px] px-2 py-0.5 bg-bauhaus-black text-white font-medium rounded">
                  {grantSourceFamily(grant)}
                </span>
                <span className="text-[11px] px-2 py-0.5 bg-bauhaus-canvas text-bauhaus-muted font-medium rounded">
                  {grantGeographyLabel(grant)}
                </span>
                <span className={`text-[11px] px-2 py-0.5 font-medium rounded ${
                  grantQualityLabel(grant) === 'Ready'
                    ? 'bg-money-light text-money'
                    : grantQualityLabel(grant) === 'Stale'
                      ? 'bg-warning-light text-bauhaus-black'
                      : 'bg-bauhaus-canvas text-bauhaus-muted'
                }`}>
                  {grantQualityLabel(grant)}
                </span>
                {uniqueLabels(grant.categories).slice(0, 3).map(c => (
                    <span key={c} className="text-[11px] px-2 py-0.5 bg-bauhaus-canvas text-bauhaus-muted font-medium rounded">
                      {c}
                    </span>
                  ))}
                {(grant.classie_subjects ?? []).slice(0, 2).map(code => (
                    <span key={`classie-${code}`} className="text-[11px] px-2 py-0.5 bg-bauhaus-canvas text-bauhaus-muted font-medium rounded">
                      {classieSubjectLabel(code)}
                    </span>
                  ))}
                <span className="ml-auto text-[11px] font-semibold text-bauhaus-muted">
                  Open details
                </span>
              </div>
            </div>
          </GrantPreviewTrigger>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-8">
          {page > 1 && (
            <a href={`/grants?${filterQS}&page=${page - 1}`} className="px-4 py-2 text-xs font-semibold border border-bauhaus-black/20 rounded-lg text-bauhaus-black hover:bg-bauhaus-canvas transition-colors">
              Previous
            </a>
          )}
          <span className="px-4 py-2 text-xs font-medium text-bauhaus-muted">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <a href={`/grants?${filterQS}&page=${page + 1}`} className="px-4 py-2 text-xs font-semibold border border-bauhaus-black/20 rounded-lg text-bauhaus-black hover:bg-bauhaus-canvas transition-colors">
              Next
            </a>
          )}
        </div>
      )}
    </div>
    </ListPreviewProvider>
  );
}
