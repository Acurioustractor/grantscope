import { getServiceSupabase } from '@/lib/supabase';
import { searchGrantsSemantic } from '@grant-engine/embeddings';
import { FilterBar } from '../components/filter-bar';
import { FundingIntelligenceRail } from '../components/funding-intelligence-rail';
import { ListPreviewProvider, GrantPreviewTrigger } from '../components/list-preview';
import { dedupeGrantList, sortGrantList, type GrantListItem } from './grant-list-utils';
import { getWikiSupportProject } from '@/lib/services/wiki-support-index';

export const dynamic = 'force-dynamic';

interface Grant extends GrantListItem {
  focus_areas?: string[] | null;
  target_recipients?: string[] | null;
  geography?: string | null;
  aligned_projects?: string[] | null;
  grant_type?: string | null;
}

interface CoverageRow {
  source: string | null;
  provider: string | null;
  geography: string | null;
  status: string | null;
  application_status: string | null;
  closes_at: string | null;
  grant_type: string | null;
  updated_at: string | null;
  last_verified_at: string | null;
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

function isDueWithin(row: Pick<CoverageRow, 'closes_at'>, today: string, days: number): boolean {
  if (!row.closes_at || row.closes_at < today) return false;
  const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return row.closes_at <= cutoff;
}

function sourceFamily(row: CoverageRow): string {
  const source = normalize(row.source);
  const provider = normalize(row.provider);
  if (source === 'foundation_program') return 'Foundations';
  if (source === 'grantconnect' || source === 'business-gov-au' || source === 'data-gov-au') return 'Federal / national';
  if (source === 'arc-grants' || source === 'nhmrc') return 'Research';
  if (source.includes('public-discovered') || source.includes('brisbane') || source.includes('sunshine') || source.includes('toowoomba') || source.includes('noosa') || source.includes('lockyer') || source.includes('centralhighlands')) return 'Council / local';
  if (source.includes('nsw') || source.includes('qld') || source.includes('vic') || source.includes('wa') || source.includes('sa') || source.includes('tas') || source.includes('act') || source.includes('nt')) return 'State / territory';
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

function coverageFamilyHref(label: string, hrefFor: (updates: Record<string, string | undefined>) => string): string {
  return hrefFor({ family: label, source: '' });
}

function coverageStateHref(label: string, hrefFor: (updates: Record<string, string | undefined>) => string): string {
  const state = STATES.find((item) => item.label === label);
  return hrefFor({ geo: state?.value || '' });
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
const VERIFIED_GRANT_INDEX_COUNT = 32018;
const GRANT_LIST_CANDIDATE_LIMIT = 500;
const GRANT_COVERAGE_SAMPLE_LIMIT = 5000;

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
}

export default async function GrantsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = params.q || '';
  const category = params.category || '';
  const grantType = params.type || 'open_opportunity';
  const searchMode = params.mode || 'keyword';
  const amountMin = params.amount_min ? parseInt(params.amount_min, 10) : null;
  const amountMax = params.amount_max ? parseInt(params.amount_max, 10) : null;
  const geoFilter = params.geo || '';
  const closingFilter = params.closing || '';
  const sortOrder = params.sort || 'newest';
  const hideOngoing = params.hide_ongoing === '1';
  const sourceFilter = params.source || '';
  const programTypeFilter = params.program_type || '';
  const projectFilter = params.project || '';
  const familyFilter = params.family || '';
  const qualityFilter = params.quality || '';
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
            .select('id, program, program_type, grant_type, source, status, sources, created_at, updated_at, last_verified_at, focus_areas, target_recipients, geography, aligned_projects')
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
      const escapedQuery = query.replace(/[%_]/g, '');
      dbQuery = dbQuery.or(`name.ilike.%${escapedQuery}%,provider.ilike.%${escapedQuery}%,program.ilike.%${escapedQuery}%,description.ilike.%${escapedQuery}%,geography.ilike.%${escapedQuery}%`);
    }

    if (category) {
      dbQuery = dbQuery.contains('categories', [category]);
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
  const { data: coverageData } = isFastGrantIndex
    ? { data: [] as CoverageRow[] }
    : await supabase
        .from(PUBLIC_GRANTS_LIST_TABLE)
        .select('source, provider, geography, status, application_status, closes_at, grant_type, updated_at, last_verified_at')
        .or('status.is.null,status.neq.duplicate')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(GRANT_COVERAGE_SAMPLE_LIMIT);
  const coverageRows = ((coverageData || []) as CoverageRow[]);
  const openCoverageRows = coverageRows.filter((row) => isOpenishCoverage(row, today));
  const coverageFamilies = buildCountMap(openCoverageRows.map(sourceFamily));
  const coverageStates = buildCountMap(openCoverageRows.map(inferCoverageState));
  const coverageSourceCount = new Set(openCoverageRows.map((row) => row.source || row.provider || 'unknown')).size;
  const closingCounts = {
    due30: openCoverageRows.filter((row) => isDueWithin(row, today, 30)).length,
    due90: openCoverageRows.filter((row) => isDueWithin(row, today, 90)).length,
    ongoing: openCoverageRows.filter((row) => !row.closes_at).length,
  };
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
    const nextIncludeResearch = updates.include_research ?? (includeResearchParam ? '1' : '');
    if (nextIncludeResearch) next.set('include_research', nextIncludeResearch);
    return `/grants?${next.toString()}`;
  };

  return (
    <ListPreviewProvider>
    <div>
      <FundingIntelligenceRail
        current="grants"
        totalLabel={`${count.toLocaleString()} ${grantType === 'historical_award' ? 'historical awards' : grantType === 'all' ? 'grants and opportunities' : 'open opportunities'} in the current funding search`}
        query={query}
        theme={category || query}
        geography={geoFilter}
        trackerHref="/tracker"
      />

      <div className="mb-6">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-bold text-bauhaus-black">Grants &amp; Opportunities</h1>
            <p className="text-sm text-bauhaus-muted mt-0.5">
              {count.toLocaleString()} {grantType === 'historical_award' ? 'historical awards' : grantType === 'all' ? 'grants' : 'open opportunities'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {grantTypes.map(t => (
              <a
                key={t.value}
                href={hrefFor({ type: t.value })}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${grantType === t.value ? 'bg-bauhaus-black text-white' : 'text-bauhaus-muted hover:bg-bauhaus-canvas'}`}
              >
                {t.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {activeProjectPreset && (
        <div className="mb-4 border-2 border-bauhaus-blue bg-link-light p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-widest text-bauhaus-blue">Recommended workflow</div>
              <h2 className="mt-1 text-lg font-black text-bauhaus-black">
                Open the {activeProjectPreset.label} support workspace
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-bauhaus-muted">
                This is the raw grants browser. The full organisation-support workflow lives in the ACT workspace:
                projects, decisions, pipeline, foundations, contacts, ecosystem context, Goods/procurement routes, and next actions.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <a
                href={activeProjectPreset.orgHref}
                className="rounded-sm bg-bauhaus-blue px-4 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-bauhaus-black"
              >
                Open workspace
              </a>
              <a
                href="/start"
                className="rounded-sm border border-bauhaus-blue bg-white px-4 py-3 text-xs font-black uppercase tracking-wider text-bauhaus-blue hover:bg-bauhaus-canvas"
              >
                New support journey
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 border border-bauhaus-black/10 rounded-lg bg-white p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-black">Project area</div>
            <div className="text-xs text-bauhaus-muted mt-0.5">
              Start with the ACT lane, then narrow by state and closing date.
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <a
              href={hrefFor({ project: '', category: '' })}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${!projectFilter ? 'bg-bauhaus-black text-white' : 'bg-bauhaus-canvas text-bauhaus-muted hover:bg-bauhaus-black/10'}`}
            >
              All ACT
            </a>
            {PROJECT_PRESETS.map((preset) => (
              <a
                key={preset.value}
                href={hrefFor({ project: preset.value, category: '' })}
                title={preset.hint}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${projectFilter === preset.value ? 'bg-bauhaus-blue text-white' : 'bg-bauhaus-canvas text-bauhaus-muted hover:bg-bauhaus-black/10'}`}
              >
                {preset.label}
              </a>
            ))}
          </div>
        </div>
        {activeProjectPreset && (
          <div className="mt-2 text-xs text-bauhaus-muted">
            Prioritising {activeProjectPreset.hint}. Research-heavy feeds are hidden unless you include them.
            {activeProjectPreset.wikiTermCount > 0 ? ` ${activeProjectPreset.wikiTermCount} wiki-derived support terms are included.` : ''}
          </div>
        )}
      </div>

      {/* Search bar */}
      <form method="get" className="flex gap-2 mb-3">
        <input type="hidden" name="type" value={grantType} />
        <input type="hidden" name="mode" value={searchMode} />
        {projectFilter && <input type="hidden" name="project" value={projectFilter} />}
        {familyFilter && <input type="hidden" name="family" value={familyFilter} />}
        {qualityFilter && <input type="hidden" name="quality" value={qualityFilter} />}
        {includeResearchParam && <input type="hidden" name="include_research" value="1" />}
        {amountMin && <input type="hidden" name="amount_min" value={amountMin} />}
        {amountMax && <input type="hidden" name="amount_max" value={amountMax} />}
        {geoFilter && <input type="hidden" name="geo" value={geoFilter} />}
        {closingFilter && <input type="hidden" name="closing" value={closingFilter} />}
        <div className="flex-1 relative">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder={searchMode === 'ai' ? 'Describe what you need funding for...' : 'Search grants...'}
            className="w-full px-4 py-2.5 border border-bauhaus-black/20 rounded-lg text-sm bg-white focus:border-bauhaus-blue focus:ring-1 focus:ring-bauhaus-blue focus:outline-none placeholder:text-bauhaus-muted/50"
          />
        </div>
        <select name="category" defaultValue={category} className="px-3 py-2.5 border border-bauhaus-black/20 rounded-lg text-sm bg-white focus:outline-none">
          <option value="">All categories</option>
          {categories.map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
        <div className="flex rounded-lg overflow-hidden border border-bauhaus-black/20">
          <a
            href={hrefFor({ mode: 'keyword' })}
            className={`px-3 py-2.5 text-xs font-semibold transition-colors ${searchMode !== 'ai' ? 'bg-bauhaus-black text-white' : 'bg-white text-bauhaus-muted hover:bg-bauhaus-canvas'}`}
          >
            Keyword
          </a>
          <a
            href={hrefFor({ mode: 'ai' })}
            className={`px-3 py-2.5 text-xs font-semibold transition-colors border-l border-bauhaus-black/20 ${searchMode === 'ai' ? 'bg-bauhaus-blue text-white' : 'bg-white text-bauhaus-muted hover:bg-bauhaus-canvas'}`}
          >
            AI
          </a>
        </div>
        <button type="submit" className="px-5 py-2.5 bg-bauhaus-black text-white text-xs font-semibold rounded-lg hover:bg-bauhaus-black/80 cursor-pointer transition-colors">
          Search
        </button>
      </form>

      {/* Filters — single compact row */}
      <FilterBar>
        <form method="get" className="flex items-center gap-3 py-2 px-3 bg-bauhaus-canvas/50 border border-bauhaus-black/10 rounded-lg flex-wrap">
          <input type="hidden" name="type" value={grantType} />
          <input type="hidden" name="mode" value={searchMode} />
          {projectFilter && <input type="hidden" name="project" value={projectFilter} />}
          {familyFilter && <input type="hidden" name="family" value={familyFilter} />}
          {qualityFilter && <input type="hidden" name="quality" value={qualityFilter} />}
          {includeResearchParam && <input type="hidden" name="include_research" value="1" />}
          {query && <input type="hidden" name="q" value={query} />}
          {category && <input type="hidden" name="category" value={category} />}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-bauhaus-muted uppercase tracking-wide">Amount</span>
            <input
              type="number"
              name="amount_min"
              defaultValue={amountMin || ''}
              placeholder="Min"
              className="w-16 px-2 py-1 text-xs border border-bauhaus-black/15 rounded bg-white focus:outline-none tabular-nums"
            />
            <span className="text-bauhaus-muted/50">–</span>
            <input
              type="number"
              name="amount_max"
              defaultValue={amountMax || ''}
              placeholder="Max"
              className="w-16 px-2 py-1 text-xs border border-bauhaus-black/15 rounded bg-white focus:outline-none tabular-nums"
            />
          </div>
          <div className="w-px h-5 bg-bauhaus-black/10"></div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-bauhaus-muted uppercase tracking-wide">State / geography</span>
            <select name="geo" defaultValue={geoFilter} className="text-xs border border-bauhaus-black/15 rounded bg-white px-2 py-1 focus:outline-none">
              <option value="">All</option>
              {STATES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="w-px h-5 bg-bauhaus-black/10"></div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-bauhaus-muted uppercase tracking-wide">Source</span>
            <select name="source" defaultValue={sourceFilter} className="text-xs border border-bauhaus-black/15 rounded bg-white px-2 py-1 focus:outline-none">
              <option value="">All</option>
              {sourceOptions.map(s => (
                <option key={s.value} value={s.value}>
                  {s.label}{liveSourceCountByValue.has(s.value) ? ` (${liveSourceCountByValue.get(s.value)?.toLocaleString()})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="w-px h-5 bg-bauhaus-black/10"></div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-bauhaus-muted uppercase tracking-wide">Type</span>
            <select name="program_type" defaultValue={programTypeFilter} className="text-xs border border-bauhaus-black/15 rounded bg-white px-2 py-1 focus:outline-none">
              <option value="">All</option>
              {PROGRAM_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="w-px h-5 bg-bauhaus-black/10"></div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-bauhaus-muted uppercase tracking-wide">Closing</span>
            {[{ v: '', label: 'Upcoming' }, { v: '30', label: '30d' }, { v: '90', label: '90d' }, { v: 'ongoing', label: 'Ongoing' }, { v: 'all', label: 'All' }].map(({ v, label }) => (
              <a
                key={v}
                href={hrefFor({ closing: v })}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors ${closingFilter === v ? 'bg-bauhaus-black text-white' : 'text-bauhaus-muted hover:bg-bauhaus-black/5'}`}
              >
                {label}
              </a>
            ))}
          </div>
          <button type="submit" className="ml-auto px-3 py-1 bg-bauhaus-black text-white text-[11px] font-semibold rounded hover:bg-bauhaus-black/80 cursor-pointer transition-colors">
            Apply
          </button>
        </form>
      </FilterBar>

      {/* Sort controls — inline, subtle */}
      <div className="flex items-center gap-2 mb-4 mt-3">
        <span className="text-[11px] font-semibold text-bauhaus-muted uppercase tracking-wide">Sort</span>
        {[
          { v: 'newest', label: 'Newest' },
          { v: 'closing_asc', label: 'Closing Soon' },
          { v: 'closing_desc', label: 'Closing Last' },
          { v: 'amount_desc', label: '$ High' },
          { v: 'amount_asc', label: '$ Low' },
          { v: 'name_asc', label: 'A-Z' },
        ].map(({ v, label }) => (
          <a
            key={v}
            href={hrefFor({ sort: v })}
            className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors ${sortOrder === v ? 'bg-bauhaus-black text-white' : 'text-bauhaus-muted hover:bg-bauhaus-black/5'}`}
          >
            {label}
          </a>
        ))}
        <div className="w-px h-4 bg-bauhaus-black/10 mx-1"></div>
        <a
          href={hrefFor({ hide_ongoing: hideOngoing ? '' : '1' })}
          className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors ${hideOngoing ? 'bg-bauhaus-black text-white' : 'text-bauhaus-muted hover:bg-bauhaus-black/5'}`}
        >
          {hideOngoing ? 'Show Ongoing' : 'Hide Ongoing'}
        </a>
        <a
          href={hrefFor({ include_research: includeResearchParam ? '' : '1' })}
          className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors ${includeResearchParam ? 'bg-bauhaus-black text-white' : 'text-bauhaus-muted hover:bg-bauhaus-black/5'}`}
        >
          {includeResearchParam ? 'Research Included' : 'Include Research'}
        </a>
        <div className="w-px h-4 bg-bauhaus-black/10 mx-1"></div>
        {[
          { v: '', label: 'All Quality' },
          { v: 'ready', label: 'Ready' },
          { v: 'needs_dates', label: 'Needs Dates' },
          { v: 'needs_verification', label: 'Needs Verification' },
          { v: 'stale', label: 'Stale' },
        ].map(({ v, label }) => (
          <a
            key={v}
            href={hrefFor({ quality: v })}
            className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors ${qualityFilter === v ? 'bg-bauhaus-blue text-white' : 'text-bauhaus-muted hover:bg-bauhaus-black/5'}`}
          >
            {label}
          </a>
        ))}
      </div>

      {familyFilter && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-bauhaus-blue/20 bg-link-light px-3 py-2">
          <div className="text-xs font-semibold text-bauhaus-blue">
            Source family filter: <span className="font-black">{familyFilter}</span>
          </div>
          <a
            href={hrefFor({ family: '' })}
            className="text-[11px] font-black uppercase tracking-wider text-bauhaus-blue hover:text-bauhaus-black"
          >
            Clear
          </a>
        </div>
      )}

      {qualityFilter && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-bauhaus-blue/20 bg-link-light px-3 py-2">
          <div className="text-xs font-semibold text-bauhaus-blue">
            Data quality filter: <span className="font-black">{qualityFilter.replace(/_/g, ' ')}</span>
          </div>
          <a
            href={hrefFor({ quality: '' })}
            className="text-[11px] font-black uppercase tracking-wider text-bauhaus-blue hover:text-bauhaus-black"
          >
            Clear
          </a>
        </div>
      )}

      {sourceFilter && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-bauhaus-black/10 bg-white px-3 py-2">
          <div className="text-xs font-semibold text-bauhaus-black">
            Source filter: <span className="font-black">{sourceLabel(sourceFilter)}</span>
          </div>
          <a
            href={hrefFor({ source: '' })}
            className="text-[11px] font-black uppercase tracking-wider text-bauhaus-muted hover:text-bauhaus-black"
          >
            Clear
          </a>
        </div>
      )}

      {isFastGrantIndex && (
        <div className="mb-4 border border-bauhaus-blue/20 bg-link-light rounded-lg p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Fast grants desk</div>
              <p className="mt-1 text-sm text-bauhaus-muted">
                Showing the current ACT pipeline first so the page opens quickly. Use search, state, source, project, or quality filters to query the full {VERIFIED_GRANT_INDEX_COUNT.toLocaleString()} record grants index.
              </p>
            </div>
            <a
              href="/org/act#project-pipeline"
              className="shrink-0 rounded-sm bg-bauhaus-blue px-4 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-bauhaus-black"
            >
              Open ACT pipeline
            </a>
          </div>
        </div>
      )}

      {!isFastGrantIndex && (
      <div className="mb-4 border border-bauhaus-black/10 bg-white rounded-lg p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-black">Coverage check</div>
            <p className="mt-1 text-sm text-bauhaus-muted">
              The finder is still national. Local/council feeds are an added layer over federal, state, foundation, research, and public source discovery.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded bg-bauhaus-canvas px-2.5 py-1 text-xs font-semibold text-bauhaus-black">
                {coverageRows.length.toLocaleString()} active records
              </span>
              <span className="rounded bg-bauhaus-canvas px-2.5 py-1 text-xs font-semibold text-bauhaus-black">
                {openCoverageRows.length.toLocaleString()} open-ish
              </span>
              <span className="rounded bg-bauhaus-canvas px-2.5 py-1 text-xs font-semibold text-bauhaus-black">
                {coverageSourceCount.toLocaleString()} source groups
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                { value: '30', label: 'Due 30d', count: closingCounts.due30 },
                { value: '90', label: 'Due 90d', count: closingCounts.due90 },
                { value: 'ongoing', label: 'Ongoing', count: closingCounts.ongoing },
              ].map((item) => (
                <a
                  key={item.value}
                  href={hrefFor({ closing: item.value })}
                  className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${closingFilter === item.value ? 'bg-bauhaus-black text-white' : 'bg-bauhaus-canvas text-bauhaus-muted hover:bg-bauhaus-black hover:text-white'}`}
                  title={`Filter to ${item.label.toLowerCase()} opportunities`}
                >
                  {item.label} {item.count.toLocaleString()}
                </a>
              ))}
              {[
                { value: 'ready', label: 'Ready', count: qualityCounts.ready },
                { value: 'needs_dates', label: 'Needs dates', count: qualityCounts.needs_dates },
                { value: 'needs_verification', label: 'Needs verification', count: qualityCounts.needs_verification },
                { value: 'stale', label: 'Stale', count: qualityCounts.stale },
              ].map((item) => (
                <a
                  key={item.value}
                  href={hrefFor({ quality: item.value })}
                  className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${qualityFilter === item.value ? 'bg-bauhaus-blue text-white' : 'bg-bauhaus-canvas text-bauhaus-muted hover:bg-bauhaus-black hover:text-white'}`}
                  title={`Filter to ${item.label.toLowerCase()} records`}
                >
                  {item.label} {item.count.toLocaleString()}
                </a>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 lg:w-[780px]">
            <div>
              <div className="mb-2 text-[11px] font-black uppercase tracking-widest text-bauhaus-muted">By source family</div>
              <div className="space-y-1.5">
                {coverageFamilies.slice(0, 6).map((item) => (
                  <a
                    key={item.label}
                    href={coverageFamilyHref(item.label, hrefFor)}
                    className="flex items-center gap-2 text-xs rounded-sm hover:bg-bauhaus-canvas/70"
                    title={`Filter to ${item.label}`}
                  >
                    <span className="w-28 truncate font-semibold text-bauhaus-black">{item.label}</span>
                    <div className="h-1.5 flex-1 rounded bg-bauhaus-canvas overflow-hidden">
                      <div
                        className="h-full rounded bg-bauhaus-blue"
                        style={{ width: `${Math.max(4, Math.round((item.count / Math.max(openCoverageRows.length, 1)) * 100))}%` }}
                      />
                    </div>
                    <span className="w-12 text-right tabular-nums text-bauhaus-muted">{item.count.toLocaleString()}</span>
                  </a>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {STATES.filter((state) => state.value !== 'AU-National').map((state) => (
                  <a
                    key={state.value}
                    href={hrefFor({ geo: state.value, source: '' })}
                    className="rounded bg-bauhaus-canvas px-2 py-0.5 text-[10px] font-semibold text-bauhaus-muted hover:bg-bauhaus-black hover:text-white"
                  >
                    {state.label.replace('New South Wales', 'NSW').replace('Queensland', 'QLD').replace('Victoria', 'VIC').replace('Western Australia', 'WA').replace('South Australia', 'SA').replace('Tasmania', 'TAS').replace('Northern Territory', 'NT')}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[11px] font-black uppercase tracking-widest text-bauhaus-muted">Top live sources</div>
              <div className="space-y-1.5">
                {liveSources.slice(0, 6).map((item) => (
                  <a
                    key={item.label}
                    href={hrefFor({ source: item.label, family: '' })}
                    className="flex items-center gap-2 text-xs rounded-sm hover:bg-bauhaus-canvas/70"
                    title={`Filter to ${sourceLabel(item.label)}`}
                  >
                    <span className="w-32 truncate font-semibold text-bauhaus-black">{sourceLabel(item.label)}</span>
                    <div className="h-1.5 flex-1 rounded bg-bauhaus-canvas overflow-hidden">
                      <div
                        className="h-full rounded bg-bauhaus-black"
                        style={{ width: `${Math.max(4, Math.round((item.count / Math.max(openCoverageRows.length, 1)) * 100))}%` }}
                      />
                    </div>
                    <span className="w-12 text-right tabular-nums text-bauhaus-muted">{item.count.toLocaleString()}</span>
                  </a>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[11px] font-black uppercase tracking-widest text-bauhaus-muted">By geography signal</div>
              <div className="space-y-1.5">
                {coverageStates.slice(0, 6).map((item) => (
                  <a
                    key={item.label}
                    href={coverageStateHref(item.label, hrefFor)}
                    className="flex items-center gap-2 text-xs rounded-sm hover:bg-bauhaus-canvas/70"
                    title={`Filter to ${item.label}`}
                  >
                    <span className="w-28 truncate font-semibold text-bauhaus-black">{item.label}</span>
                    <div className="h-1.5 flex-1 rounded bg-bauhaus-canvas overflow-hidden">
                      <div
                        className="h-full rounded bg-bauhaus-red"
                        style={{ width: `${Math.max(4, Math.round((item.count / Math.max(openCoverageRows.length, 1)) * 100))}%` }}
                      />
                    </div>
                    <span className="w-12 text-right tabular-nums text-bauhaus-muted">{item.count.toLocaleString()}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Semantic search banner */}
      {usedSemantic && (
        <div className="mb-4 p-3 bg-link-light border border-bauhaus-blue/30 rounded-lg">
          <span className="text-xs font-semibold text-bauhaus-blue">
            AI found {count} grants matching: &ldquo;{query}&rdquo;
          </span>
        </div>
      )}

      <div className="space-y-2">
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
            <div className="bg-white border border-bauhaus-black/10 rounded-lg p-4 sm:px-5 transition-all hover:border-bauhaus-blue/30 hover:shadow-sm group-hover:bg-bauhaus-blue group-hover:text-white group-hover:border-bauhaus-blue">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-bauhaus-black text-[15px] group-hover:text-white">{grant.name}</h3>
                    {grant.program_type && grant.program_type !== 'open_opportunity' && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 uppercase tracking-wider rounded flex-shrink-0 ${
                        grant.program_type === 'fellowship' ? 'bg-link-light text-bauhaus-blue' :
                        grant.program_type === 'scholarship' ? 'bg-warning-light text-bauhaus-black' :
                        grant.program_type === 'historical_award' ? 'bg-bauhaus-canvas text-bauhaus-muted' :
                        'bg-money-light text-money'
                      } group-hover:bg-white/20 group-hover:text-white`}>
                        {grant.program_type.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-bauhaus-muted mt-0.5 group-hover:text-white/70">
                    {grant.provider}{grant.program ? ` — ${grant.program}` : ''}
                  </div>
                  {grant.description && (
                    <div className="text-sm text-bauhaus-muted/70 mt-1 line-clamp-1 group-hover:text-white/50">
                      {grant.description}
                    </div>
                  )}
                </div>
                <div className="sm:text-right sm:ml-4 flex-shrink-0">
                  <div className="text-sm font-bold text-bauhaus-blue tabular-nums group-hover:text-bauhaus-yellow">
                    {formatAmount(grant.amount_min, grant.amount_max)}
                  </div>
                  <div className={`text-xs mt-0.5 font-medium ${grant.closes_at ? 'text-bauhaus-red' : 'text-bauhaus-muted'} group-hover:text-white/70`}>
                    {grant.closes_at ? `Closes ${formatDate(grant.closes_at)}` : 'Ongoing'}
                  </div>
                  {usedSemantic && grant.similarity != null && (
                    <div className="flex items-center gap-1.5 mt-1 justify-end">
                      <div className="w-16 h-1.5 bg-bauhaus-canvas rounded-full overflow-hidden">
                        <div className="h-full bg-bauhaus-blue group-hover:bg-bauhaus-yellow rounded-full" style={{ width: `${Math.round(grant.similarity * 100)}%` }}></div>
                      </div>
                      <span className="text-[10px] font-semibold text-bauhaus-muted group-hover:text-white/50 tabular-nums">
                        {Math.round(grant.similarity * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                {projectFitLabel(grant, activeProjectPreset) && (
                  <span className="text-[11px] px-2 py-0.5 bg-link-light text-bauhaus-blue font-black rounded group-hover:bg-white/20 group-hover:text-white">
                    {projectFitLabel(grant, activeProjectPreset)}
                  </span>
                )}
                <span className="text-[11px] px-2 py-0.5 bg-bauhaus-black text-white font-medium rounded group-hover:bg-white/20">
                  {grantSourceFamily(grant)}
                </span>
                <span className="text-[11px] px-2 py-0.5 bg-bauhaus-canvas text-bauhaus-muted font-medium rounded group-hover:bg-white/20 group-hover:text-white">
                  {grantGeographyLabel(grant)}
                </span>
                <span className={`text-[11px] px-2 py-0.5 font-medium rounded group-hover:bg-white/20 group-hover:text-white ${
                  grantQualityLabel(grant) === 'Ready'
                    ? 'bg-money-light text-money'
                    : grantQualityLabel(grant) === 'Stale'
                      ? 'bg-warning-light text-bauhaus-black'
                      : 'bg-bauhaus-canvas text-bauhaus-muted'
                }`}>
                  {grantQualityLabel(grant)}
                </span>
                {uniqueLabels(grant.categories).map(c => (
                    <span key={c} className="text-[11px] px-2 py-0.5 bg-bauhaus-canvas text-bauhaus-muted font-medium rounded group-hover:bg-white/20 group-hover:text-white">
                      {c}
                    </span>
                  ))}
                <span className="ml-auto text-[11px] font-semibold text-bauhaus-muted group-hover:text-white/70">
                  Open details &rarr;
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
