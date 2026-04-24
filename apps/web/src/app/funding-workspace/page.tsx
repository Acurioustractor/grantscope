import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getCurrentOrgProfileContext } from '@/lib/org-profile';
import { FundingWorkspaceShortlistButton } from './shortlist-button';
import { FundingWorkspaceContextForm } from './context-form';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Funding Matches — CivicGraph',
  description: 'Find grants, programs, and foundations that fit your mission, then shortlist the next move.',
};

type FundingWorkspacePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type GrantRow = {
  id: string;
  name: string;
  provider: string | null;
  description: string | null;
  amount_min: number | null;
  amount_max: number | null;
  closes_at: string | null;
  categories: string[] | null;
  focus_areas: string[] | null;
  target_recipients: string[] | null;
  geography: string | null;
  status: string | null;
  url: string | null;
  last_verified_at: string | null;
};

type FoundationRow = {
  id: string;
  name: string;
  type: string | null;
  website: string | null;
  description: string | null;
  total_giving_annual: number | null;
  thematic_focus: string[] | null;
  geographic_focus: string[] | null;
  target_recipients: string[] | null;
  open_programs: unknown;
  profile_confidence: string | null;
  giving_philosophy: string | null;
  application_tips: string | null;
};

type GrantMatch = {
  row: GrantRow;
  score: number;
  reasons: string[];
  motion: string;
  actionLabel: string;
  blocked: boolean;
  requiredGrantHits: number;
  requiredGrantMinHits: number;
};

type FoundationMatch = {
  row: FoundationRow;
  score: number;
  reasons: string[];
  motion: string;
  actionLabel: string;
  openProgramCount: number;
  savedForProject: boolean;
  tagHits: number;
};

type OrgProjectRow = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  status: string | null;
  metadata?: Record<string, unknown> | null;
};

const STATE_OPTIONS = [
  'National',
  'Queensland',
  'New South Wales',
  'Victoria',
  'Western Australia',
  'South Australia',
  'Tasmania',
  'Australian Capital Territory',
  'Northern Territory',
];

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'into',
  'is',
  'it',
  'of',
  'on',
  'or',
  'our',
  'that',
  'the',
  'their',
  'this',
  'to',
  'we',
  'with',
  'your',
  'impact',
  'infrastructure',
  'organisation',
  'organisations',
  'program',
  'programs',
  'project',
  'projects',
  'sector',
  'social',
  'system',
  'systems',
]);

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatCurrencyRange(min: number | null, max: number | null) {
  if (min && max) return `$${min.toLocaleString()}-$${max.toLocaleString()}`;
  if (max) return `Up to $${max.toLocaleString()}`;
  if (min) return `From $${min.toLocaleString()}`;
  return 'Amount not specified';
}

function formatCompactCurrency(value: number | null) {
  if (!value) return 'Amount not listed';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDeadline(date: string | null) {
  if (!date) return 'No closing date listed';
  return new Date(date).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function toArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function countOpenPrograms(value: unknown) {
  if (!Array.isArray(value)) return 0;
  return value.length;
}

function shortText(value: string | null | undefined, maxLength = 180) {
  if (!value) return '';
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildMissionTokens(...values: string[]) {
  const raw = values
    .flatMap((value) => value.split(/[,\n/]+/g))
    .flatMap((value) => value.split(/\s+/g))
    .map((value) => value.trim().toLowerCase())
    .map((value) => value.replace(/[^a-z0-9&-]/g, ''))
    .filter((value) => value.length >= 3)
    .filter((value) => !STOP_WORDS.has(value));

  return Array.from(new Set(raw)).slice(0, 10);
}

function orgTypeTerms(orgType: string) {
  const normalized = orgType.toLowerCase();
  if (normalized === 'oric') {
    return ['indigenous', 'aboriginal', 'torres', 'community', 'controlled'];
  }
  if (normalized === 'charity') {
    return ['charity', 'community', 'social', 'not-for-profit'];
  }
  if (normalized === 'social enterprise') {
    return ['social', 'enterprise', 'employment', 'community'];
  }
  if (normalized === 'community group') {
    return ['community', 'place', 'local'];
  }
  return [];
}

function projectIntentTerms(project: OrgProjectRow | null) {
  const metadata = project?.metadata ?? {};
  const terms: string[] = [];

  if (metadata && typeof metadata === 'object' && 'creative' in metadata && metadata.creative === true) {
    terms.push('creative', 'arts', 'culture', 'documentary', 'film', 'media', 'narrative', 'storytelling');
  }

  const pillar = typeof metadata?.pillar === 'string' ? metadata.pillar.toLowerCase() : '';
  if (pillar === 'justice') {
    terms.push('justice', 'legal', 'incarceration', 'alternatives', 'community');
  }
  if (pillar === 'enterprise') {
    terms.push('enterprise', 'employment', 'marketplace', 'procurement', 'buyers');
  }
  if (pillar === 'technology') {
    terms.push('technology', 'data', 'measurement', 'accountability', 'infrastructure');
  }

  const fundingTags = Array.isArray(metadata?.funding_tags)
    ? metadata.funding_tags.filter((item): item is string => typeof item === 'string')
    : [];
  terms.push(...fundingTags);

  return Array.from(new Set(terms));
}

function projectProfileSummary(project: OrgProjectRow | null) {
  const metadata = project?.metadata ?? {};
  const profileSummary =
    typeof metadata?.profile_summary === 'string' ? metadata.profile_summary.trim() : '';
  const fundingBrief =
    typeof metadata?.funding_brief === 'string' ? metadata.funding_brief.trim() : '';

  return profileSummary || fundingBrief || [project?.name, project?.description].filter(Boolean).join('. ').trim();
}

function legacyProjectMission(project: OrgProjectRow | null) {
  return [project?.name, project?.description].filter(Boolean).join('. ').trim();
}

function projectMetadataList(project: OrgProjectRow | null, key: string) {
  const metadata = project?.metadata ?? {};
  return Array.isArray(metadata?.[key])
    ? metadata[key].filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function projectFundingBrief(project: OrgProjectRow | null) {
  const metadata = project?.metadata ?? {};
  return typeof metadata?.funding_brief === 'string' ? metadata.funding_brief.trim() : '';
}

function projectPriorityTerms(project: OrgProjectRow | null) {
  const proofPoints = projectMetadataList(project, 'proof_points');
  const fundingTags = projectMetadataList(project, 'funding_tags');
  const fundingBrief = projectFundingBrief(project);

  return Array.from(
    new Set([
      ...buildMissionTokens(fundingBrief, proofPoints.join(' ')),
      ...fundingTags.map((tag) => tag.toLowerCase()),
    ])
  ).slice(0, 12);
}

function projectFundingTags(project: OrgProjectRow | null) {
  const metadata = project?.metadata ?? {};
  return Array.isArray(metadata?.funding_tags)
    ? metadata.funding_tags.filter((item): item is string => typeof item === 'string').map((item) => item.toLowerCase())
    : [];
}

function projectPreferredFoundationTypes(project: OrgProjectRow | null) {
  const metadata = project?.metadata ?? {};
  const preferred = new Set<string>();

  if (metadata && typeof metadata === 'object' && 'creative' in metadata && metadata.creative === true) {
    preferred.add('arts_culture');
    preferred.add('philanthropic_foundation');
    preferred.add('corporate_foundation');
    preferred.add('community_foundation');
    preferred.add('grantmaker');
    preferred.add('trust');
  }

  const pillar = typeof metadata?.pillar === 'string' ? metadata.pillar.toLowerCase() : '';
  if (pillar === 'justice') {
    preferred.add('philanthropic_foundation');
    preferred.add('grantmaker');
    preferred.add('trust');
    preferred.add('indigenous_organisation');
  }
  if (pillar === 'enterprise') {
    preferred.add('corporate_foundation');
    preferred.add('community_foundation');
    preferred.add('philanthropic_foundation');
    preferred.add('grantmaker');
  }
  if (pillar === 'technology') {
    preferred.add('philanthropic_foundation');
    preferred.add('corporate_foundation');
    preferred.add('grantmaker');
    preferred.add('trust');
  }

  const explicitPreferred = Array.isArray(metadata?.preferred_foundation_types)
    ? metadata.preferred_foundation_types.filter((item): item is string => typeof item === 'string')
    : [];
  for (const type of explicitPreferred) preferred.add(type.toLowerCase());

  return preferred;
}

function projectBlockedFoundationTypes(project: OrgProjectRow | null) {
  const metadata = project?.metadata ?? {};
  const blocked = new Set<string>();

  if (metadata && typeof metadata === 'object' && 'creative' in metadata && metadata.creative === true) {
    blocked.add('university');
    blocked.add('research_body');
    blocked.add('primary_health_network');
    blocked.add('hospital');
    blocked.add('service_delivery');
    blocked.add('legal_aid');
  }

  const explicitBlocked = Array.isArray(metadata?.blocked_foundation_types)
    ? metadata.blocked_foundation_types.filter((item): item is string => typeof item === 'string')
    : [];
  for (const type of explicitBlocked) blocked.add(type.toLowerCase());

  return blocked;
}

function projectBlockedFoundationNames(project: OrgProjectRow | null) {
  return new Set(
    projectMetadataList(project, 'blocked_foundation_names').map((item) => item.toLowerCase())
  );
}

function projectBlockedGrantTerms(project: OrgProjectRow | null) {
  return projectMetadataList(project, 'blocked_grant_terms').map((item) => item.toLowerCase());
}

function projectBlockedGrantProviderTerms(project: OrgProjectRow | null) {
  return projectMetadataList(project, 'blocked_grant_provider_terms').map((item) => item.toLowerCase());
}

function projectBlockedGrantNames(project: OrgProjectRow | null) {
  return new Set(projectMetadataList(project, 'blocked_grant_names').map((item) => item.toLowerCase()));
}

function projectRequiredGrantTerms(project: OrgProjectRow | null) {
  return projectMetadataList(project, 'required_grant_terms').map((item) => item.toLowerCase());
}

function projectRequiredGrantMinHits(project: OrgProjectRow | null) {
  const value = project?.metadata && typeof project.metadata === 'object' ? project.metadata.required_grant_min_hits : null;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function scoreText(text: string, tokens: string[]) {
  let score = 0;
  const reasons: string[] = [];

  for (const token of tokens) {
    if (!text.includes(token)) continue;
    score += 1;
    reasons.push(token);
  }

  return { score, reasons };
}

function countOverlap(values: Array<string | null | undefined>, tokens: string[]) {
  const haystack = values
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return tokens.filter((token) => haystack.includes(token)).length;
}

function foundationTypeWeight(type: string | null | undefined) {
  switch ((type ?? '').toLowerCase()) {
    case 'philanthropic_foundation':
    case 'private_ancillary_fund':
    case 'public_ancillary_fund':
    case 'corporate_foundation':
    case 'community_foundation':
    case 'grantmaker':
    case 'trust':
      return 4;
    case 'arts_culture':
    case 'animal_welfare':
    case 'environmental':
    case 'health_charity':
    case 'indigenous_organisation':
    case 'international_aid':
      return 2;
    case 'education_body':
    case 'hospital':
    case 'legal_aid':
    case 'peak_body':
    case 'primary_health_network':
    case 'research_body':
    case 'service_delivery':
    case 'university':
      return -3;
    default:
      return 0;
  }
}

function foundationTypeAdjustment(type: string | null | undefined, preferredTypes: Set<string>, blockedTypes: Set<string>) {
  const normalized = (type ?? '').toLowerCase();
  if (!normalized) return 0;
  if (blockedTypes.has(normalized)) return -8;
  if (preferredTypes.has(normalized)) return 5;
  return 0;
}

function geographyMatches(value: string | string[] | null | undefined, state: string) {
  if (!value || !state || state === 'National') return false;
  const haystack = Array.isArray(value) ? value.join(' ').toLowerCase() : value.toLowerCase();
  const target = state.toLowerCase();
  const aliases = new Map<string, string[]>([
    ['queensland', ['qld']],
    ['new south wales', ['nsw']],
    ['victoria', ['vic']],
    ['western australia', ['wa']],
    ['south australia', ['sa']],
    ['tasmania', ['tas']],
    ['australian capital territory', ['act']],
    ['northern territory', ['nt']],
  ]);

  if (haystack.includes(target) || haystack.includes('national') || haystack.includes('australia')) return true;
  return (aliases.get(target) ?? []).some((alias) => haystack.includes(alias));
}

function buildGrantReasons(row: GrantRow, scoreTerms: string[], state: string, keywordHits: number, categoryHits: number) {
  const reasons: string[] = [];
  const focus = [...(row.focus_areas ?? []), ...(row.categories ?? [])];
  const matchedFocus = focus.filter((item) => scoreTerms.some((term) => item.toLowerCase().includes(term)));

  if (matchedFocus.length > 0) {
    reasons.push(`Fits ${matchedFocus.slice(0, 2).join(' and ')}`);
  } else if (keywordHits >= 2) {
    reasons.push(`${keywordHits} mission keyword matches`);
  } else if (categoryHits > 0) {
    reasons.push(`${categoryHits} thematic matches`);
  }

  if (state && geographyMatches(row.geography, state)) {
    reasons.push(`Works for ${state}`);
  }

  if (row.closes_at) {
    reasons.push(`Open until ${formatDeadline(row.closes_at)}`);
  } else if (row.last_verified_at) {
    reasons.push(`Still being tracked as live`);
  }

  return reasons.slice(0, 3);
}

function buildGrantReasonsWithPriority(
  row: GrantRow,
  scoreTerms: string[],
  priorityTerms: string[],
  state: string,
  keywordHits: number,
  categoryHits: number,
  priorityHits: number,
) {
  const reasons = buildGrantReasons(row, scoreTerms, state, keywordHits, categoryHits);
  if (priorityTerms.length > 0 && priorityHits > 0 && !reasons.some((reason) => reason.includes('project-fit'))) {
    reasons.unshift(`${priorityHits} project-fit signals`);
  }
  return reasons.slice(0, 3);
}

function buildFoundationReasons(
  row: FoundationRow,
  scoreTerms: string[],
  state: string,
  openProgramCount: number,
  keywordHits: number,
  projectBoosted: boolean,
) {
  const reasons: string[] = [];
  const matchedFocus = (row.thematic_focus ?? []).filter((item) =>
    scoreTerms.some((term) => item.toLowerCase().includes(term))
  );

  if (projectBoosted) {
    reasons.push('Already shortlisted for this project');
  }

  if (matchedFocus.length > 0) {
    reasons.push(`Funds ${matchedFocus.slice(0, 2).join(' and ')}`);
  } else if (keywordHits >= 2) {
    reasons.push(`${keywordHits} mission keyword matches`);
  }

  if (state && geographyMatches(row.geographic_focus, state)) {
    reasons.push(`Works in ${state}`);
  }

  if (openProgramCount > 0) {
    reasons.push(`${openProgramCount} open program${openProgramCount === 1 ? '' : 's'} found`);
  } else {
    reasons.push('Better approached by intro than cold application');
  }

  return reasons.slice(0, 3);
}

function buildFoundationReasonsWithPriority(
  row: FoundationRow,
  scoreTerms: string[],
  priorityTerms: string[],
  state: string,
  openProgramCount: number,
  keywordHits: number,
  projectBoosted: boolean,
  priorityHits: number,
) {
  const reasons = buildFoundationReasons(row, scoreTerms, state, openProgramCount, keywordHits, projectBoosted);
  if (priorityTerms.length > 0 && priorityHits > 0 && !projectBoosted && !reasons.some((reason) => reason.includes('project-fit'))) {
    reasons.unshift(`${priorityHits} project-fit signals`);
  }
  return reasons.slice(0, 3);
}

function scoreGrant(
  row: GrantRow,
  scoreTerms: string[],
  priorityTerms: string[],
  blockedGrantNames: Set<string>,
  blockedGrantTerms: string[],
  blockedGrantProviderTerms: string[],
  requiredGrantTerms: string[],
  requiredGrantMinHits: number,
  state: string,
  orgType: string
): GrantMatch {
  const text = [
    row.name,
    row.description,
    ...(row.categories ?? []),
    ...(row.focus_areas ?? []),
    ...(row.target_recipients ?? []),
    row.geography,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const { score: keywordHits } = scoreText(text, scoreTerms);
  const categoryHits = countOverlap([...(row.categories ?? []), ...(row.focus_areas ?? []), ...(row.target_recipients ?? [])], scoreTerms);
  const priorityHits = priorityTerms.length > 0
    ? countOverlap(
        [
          row.description,
          ...(row.categories ?? []),
          ...(row.focus_areas ?? []),
          ...(row.target_recipients ?? []),
        ],
        priorityTerms,
      )
    : 0;
  const blockedByName = blockedGrantNames.has(row.name.toLowerCase());
  const blockedByTerm = blockedGrantTerms.some((term) => text.includes(term));
  const blockedByProvider = blockedGrantProviderTerms.some((term) =>
    (row.provider ?? '').toLowerCase().includes(term)
  );
  const blocked = blockedByName || blockedByTerm || blockedByProvider;
  const requiredGrantHits = requiredGrantTerms.length > 0
    ? countOverlap(
        [
          row.name,
          row.description,
          ...(row.categories ?? []),
          ...(row.focus_areas ?? []),
          ...(row.target_recipients ?? []),
        ],
        requiredGrantTerms,
      )
    : 0;
  let score = categoryHits * 5 + keywordHits * 2 + priorityHits * 4;

  if (state && geographyMatches(row.geography, state)) score += 3;
  if (orgType && (row.target_recipients ?? []).some((entry) => entry.toLowerCase().includes(orgType.toLowerCase()))) {
    score += 2;
  }
  if (row.closes_at) {
    const days = Math.ceil((new Date(row.closes_at).getTime() - Date.now()) / 86400000);
    if (days >= 0 && days <= 30) score += 2;
    else if (days > 30 && days <= 90) score += 1;
  } else if (row.last_verified_at) {
    score += 1;
  }
  if (blocked) score -= 12;
  if (requiredGrantTerms.length > 0 && requiredGrantHits < requiredGrantMinHits) score -= 10;
  else if (requiredGrantHits > 0) score += requiredGrantHits * 3;

  return {
    row,
    score,
    reasons: buildGrantReasonsWithPriority(row, scoreTerms, priorityTerms, state, keywordHits, categoryHits, priorityHits),
    motion: row.closes_at ? 'Draft the application and confirm eligibility now.' : 'Check the guidance and shortlist it for follow-up.',
    actionLabel: row.closes_at ? 'Apply now' : 'Watch',
    blocked,
    requiredGrantHits,
    requiredGrantMinHits,
  };
}

function scoreFoundation(
  row: FoundationRow,
  scoreTerms: string[],
  priorityTerms: string[],
  state: string,
  orgType: string,
  savedForProject: boolean,
  preferredTypes: Set<string>,
  blockedTypes: Set<string>,
  blockedNames: Set<string>,
  requiredTags: string[],
): FoundationMatch {
  const openProgramCount = countOpenPrograms(row.open_programs);
  const text = [
    row.name,
    row.description,
    row.giving_philosophy,
    row.application_tips,
    ...(row.thematic_focus ?? []),
    ...(row.geographic_focus ?? []),
    ...(row.target_recipients ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const { score: keywordHits } = scoreText(text, scoreTerms);
  const thematicHits = countOverlap([...(row.thematic_focus ?? []), ...(row.target_recipients ?? [])], scoreTerms);
  const priorityHits = priorityTerms.length > 0
    ? countOverlap(
        [
          row.description,
          row.giving_philosophy,
          row.application_tips,
          ...(row.thematic_focus ?? []),
          ...(row.target_recipients ?? []),
        ],
        priorityTerms,
      )
    : 0;
  const tagHits = requiredTags.length > 0
    ? countOverlap(
        [
          row.description,
          row.giving_philosophy,
          row.application_tips,
          ...(row.thematic_focus ?? []),
          ...(row.target_recipients ?? []),
        ],
        requiredTags,
      )
    : 0;
  let score = thematicHits * 5 + keywordHits * 2 + priorityHits * 4;

  if (state && geographyMatches(row.geographic_focus, state)) score += 3;
  if (orgType && (row.target_recipients ?? []).some((entry) => entry.toLowerCase().includes(orgType.toLowerCase()))) {
    score += 2;
  }
  score += foundationTypeWeight(row.type);
  score += foundationTypeAdjustment(row.type, preferredTypes, blockedTypes);
  if (openProgramCount > 0) score += 2;
  if (row.profile_confidence === 'high') score += 1;
  if (row.total_giving_annual && row.total_giving_annual > 1_000_000) score += 1;
  if (savedForProject) score += 8;
  if (blockedNames.has(row.name.toLowerCase()) && !savedForProject) score -= 10;
  if (requiredTags.length > 0 && tagHits === 0 && !savedForProject) score -= 6;

  return {
    row,
    score,
    reasons: buildFoundationReasonsWithPriority(
      row,
      scoreTerms,
      priorityTerms,
      state,
      openProgramCount,
      keywordHits,
      savedForProject,
      priorityHits,
    ),
    motion: openProgramCount > 0
      ? 'Start with the live program page, then shortlist the best-fit program.'
      : 'Lead with a short intro note and a tight mission-fit case, not a generic ask.',
    actionLabel: openProgramCount > 0 ? 'Open program' : 'Build relationship',
    openProgramCount,
    savedForProject,
    tagHits,
  };
}

function prioritizeSaved(matches: FoundationMatch[]) {
  return [...matches].sort((a, b) => {
    if (a.savedForProject !== b.savedForProject) return a.savedForProject ? -1 : 1;
    return b.score - a.score;
  });
}

function shouldShowFoundation(
  match: FoundationMatch,
  effectiveMission: string,
  blockedTypes: Set<string>,
  blockedNames: Set<string>,
  requiredTags: string[],
) {
  const normalizedType = (match.row.type ?? '').toLowerCase();
  if (match.savedForProject) return true;
  if (blockedNames.has(match.row.name.toLowerCase())) return false;
  if (blockedTypes.has(normalizedType)) return false;
  if (requiredTags.length > 0 && match.tagHits === 0) return false;
  if (!effectiveMission) return true;
  return match.score >= 7;
}

function chooseKeywords(mission: string, theme: string, lens: string, orgType: string, extraTerms: string[] = []) {
  const terms = buildMissionTokens(mission, theme, lens, ...orgTypeTerms(orgType), ...extraTerms);
  return terms.length > 0 ? terms : ['community', 'youth', 'place'];
}

function searchLabel(state: string, orgType: string) {
  const parts = [];
  if (state) parts.push(state);
  if (orgType) parts.push(orgType);
  return parts.length > 0 ? parts.join(' · ') : 'Any Australian organisation';
}

function shouldShowGrant(match: GrantMatch, effectiveMission: string) {
  if (match.blocked) return false;
  if (match.requiredGrantMinHits > 0 && match.requiredGrantHits < match.requiredGrantMinHits) return false;
  if (!effectiveMission) return true;
  return match.score >= 6;
}

function normalizeOrgType(value: string | null | undefined) {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'oric' || normalized === 'indigenous_corp') return 'ORIC';
  if (normalized === 'charity' || normalized === 'nfp') return 'Charity';
  if (normalized === 'social enterprise' || normalized === 'social_enterprise') return 'Social enterprise';
  if (normalized === 'community group' || normalized === 'collective' || normalized === 'cooperative') {
    return 'Community group';
  }
  return titleCase(normalized);
}

function inferStateFromGeography(values: string[] | null | undefined) {
  const focus = toArray(values).map((entry) => entry.toLowerCase());
  if (focus.length === 0) return '';
  if (focus.some((entry) => entry.includes('national') || entry.includes('australia'))) {
    return 'National';
  }

  return (
    STATE_OPTIONS.find((option) => {
      const lower = option.toLowerCase();
      return focus.some((entry) => entry.includes(lower));
    }) ?? ''
  );
}

function EmptyLane({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-2 border-dashed border-bauhaus-black/20 bg-bauhaus-canvas p-5">
      <div className="text-sm font-black uppercase tracking-[0.18em] text-bauhaus-muted">{title}</div>
      <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-bauhaus-muted">{body}</p>
    </div>
  );
}

export default async function FundingWorkspacePage({ searchParams }: FundingWorkspacePageProps) {
  const [resolvedParams, authClient] = await Promise.all([
    searchParams
      ? searchParams
      : Promise.resolve({} as Record<string, string | string[] | undefined>),
    createSupabaseServer(),
  ]);
  const serviceDb = getServiceSupabase();
  const explicitOrgSlug = firstParam(resolvedParams.org).trim();
  const projectSlug = firstParam(resolvedParams.project).trim();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  const orgContext = user ? await getCurrentOrgProfileContext(serviceDb, user.id) : null;
  const implicitProjectProfile =
    !orgContext?.profile && !explicitOrgSlug && projectSlug
      ? (
          await serviceDb
            .from('org_projects')
            .select(`
              slug,
              name,
              description,
              org_profile:org_profile_id(
                id,
                name,
                slug,
                abn,
                subscription_plan,
                org_type,
                geographic_focus,
                mission,
                description
              )
            `)
            .eq('slug', projectSlug)
            .maybeSingle()
        ).data
      : null;
  const explicitProfile =
    !orgContext?.profile && explicitOrgSlug && process.env.NODE_ENV !== 'production'
      ? (
          await serviceDb
            .from('org_profiles')
            .select('id, name, slug, abn, subscription_plan, org_type, geographic_focus, mission, description')
            .eq('slug', explicitOrgSlug)
            .maybeSingle()
        ).data
      : null;
  const implicitProfile = Array.isArray(implicitProjectProfile?.org_profile)
    ? implicitProjectProfile?.org_profile[0]
    : implicitProjectProfile?.org_profile;
  const profile = orgContext?.profile ?? explicitProfile ?? implicitProfile ?? null;

  const mission = firstParam(resolvedParams.mission).trim();
  const theme = firstParam(resolvedParams.theme).trim();
  const lens = firstParam(resolvedParams.lens).trim();
  const state = firstParam(resolvedParams.state).trim();
  const orgType = firstParam(resolvedParams.org_type).trim();

  const profileMission = (profile?.mission || profile?.description || '').trim();
  const profileState = inferStateFromGeography(profile?.geographic_focus);
  const profileOrgType = normalizeOrgType(profile?.org_type);

  const [{ data: grantsData }, { data: foundationsData }, { data: projectsData }] = await Promise.all([
    serviceDb
      .from('grant_opportunities')
      .select('id, name, provider, description, amount_min, amount_max, closes_at, categories, focus_areas, target_recipients, geography, status, url, last_verified_at')
      .or(`closes_at.gte.${new Date().toISOString().slice(0, 10)},and(closes_at.is.null,last_verified_at.gte.${new Date(Date.now() - 180 * 86400000).toISOString()})`)
      .not('status', 'in', '(closed,archived)')
      .order('closes_at', { ascending: true, nullsFirst: false })
      .limit(200),
    serviceDb
      .from('foundations')
      .select('id, name, type, website, description, total_giving_annual, thematic_focus, geographic_focus, target_recipients, open_programs, profile_confidence, giving_philosophy, application_tips')
      .not('enriched_at', 'is', null)
      .order('total_giving_annual', { ascending: false, nullsFirst: false })
      .limit(220),
    profile
      ? serviceDb
          .from('org_projects')
          .select('id, name, slug, description, status, metadata')
          .eq('org_profile_id', profile.id)
          .order('sort_order', { ascending: true, nullsFirst: false })
          .order('name', { ascending: true })
      : Promise.resolve({ data: [] as OrgProjectRow[] }),
  ]);

  const projects = (projectsData ?? []) as OrgProjectRow[];
  const selectedProject = projects.find((project) => project.slug === projectSlug) ?? null;
  const projectMission = projectProfileSummary(selectedProject);
  const staleLegacyMission =
    Boolean(mission) && Boolean(selectedProject) && mission === legacyProjectMission(selectedProject);
  const manualMission = staleLegacyMission ? '' : mission;
  const fundingBrief =
    projectFundingBrief(selectedProject);
  const proofPoints = projectMetadataList(selectedProject, 'proof_points');
  const sourcePaths = projectMetadataList(selectedProject, 'source_paths');
  const visibleFundingTags = projectMetadataList(selectedProject, 'funding_tags').slice(0, 8);
  const priorityTerms = projectPriorityTerms(selectedProject);
  const currentContextLabel = selectedProject
    ? `${selectedProject.name} · ${profile?.name ?? 'Project context'}`
    : profile?.name ?? 'Any Australian organisation';

  const { data: savedProjectFoundations } = selectedProject
    ? await serviceDb
        .from('org_project_foundations')
        .select('foundation_id')
        .eq('org_project_id', selectedProject.id)
    : { data: [] as Array<{ foundation_id: string }> };
  const savedFoundationIds = new Set((savedProjectFoundations ?? []).map((row) => row.foundation_id));
  const baseFoundationRows = (foundationsData ?? []) as FoundationRow[];
  const missingSavedFoundationIds = [...savedFoundationIds].filter(
    (foundationId) => !baseFoundationRows.some((row) => row.id === foundationId)
  );
  const { data: savedFoundationRows } = missingSavedFoundationIds.length > 0
    ? await serviceDb
        .from('foundations')
        .select('id, name, type, website, description, total_giving_annual, thematic_focus, geographic_focus, target_recipients, open_programs, profile_confidence, giving_philosophy, application_tips')
        .in('id', missingSavedFoundationIds)
    : { data: [] as FoundationRow[] };
  const mergedFoundationRows = [
    ...baseFoundationRows,
    ...((savedFoundationRows ?? []) as FoundationRow[]),
  ];

  const effectiveMission =
    manualMission || [theme, lens].filter(Boolean).map(titleCase).join(' ') || projectMission || profileMission;
  const effectiveState = state || profileState;
  const effectiveOrgType = orgType || profileOrgType;
  const requiredFundingTags = projectFundingTags(selectedProject);
  const preferredFoundationTypes = projectPreferredFoundationTypes(selectedProject);
  const blockedFoundationTypes = projectBlockedFoundationTypes(selectedProject);
  const blockedFoundationNames = projectBlockedFoundationNames(selectedProject);
  const blockedGrantTerms = projectBlockedGrantTerms(selectedProject);
  const blockedGrantProviderTerms = projectBlockedGrantProviderTerms(selectedProject);
  const blockedGrantNames = projectBlockedGrantNames(selectedProject);
  const requiredGrantTerms = projectRequiredGrantTerms(selectedProject);
  const requiredGrantMinHits = projectRequiredGrantMinHits(selectedProject);
  const scoreTerms = chooseKeywords(
    effectiveMission,
    theme,
    lens,
    effectiveOrgType,
    [...projectIntentTerms(selectedProject), ...priorityTerms]
  );
  const appliedProfileDefaults = [
    !manualMission && projectMission ? 'Project brief' : null,
    !manualMission && !projectMission && profileMission ? 'Mission' : null,
    !state && profileState ? 'State' : null,
    !orgType && profileOrgType ? 'Organisation type' : null,
  ].filter(Boolean) as string[];

  const grantMatches = ((grantsData ?? []) as GrantRow[])
    .map((row) =>
      scoreGrant(
        row,
        scoreTerms,
        priorityTerms,
        blockedGrantNames,
        blockedGrantTerms,
        blockedGrantProviderTerms,
        requiredGrantTerms,
        requiredGrantMinHits,
        effectiveState,
        effectiveOrgType
      )
    )
    .filter((match) => shouldShowGrant(match, effectiveMission))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const foundationMatches = mergedFoundationRows
    .map((row) =>
      scoreFoundation(
        row,
        scoreTerms,
        priorityTerms,
        effectiveState,
        effectiveOrgType,
        savedFoundationIds.has(row.id),
        preferredFoundationTypes,
        blockedFoundationTypes,
        blockedFoundationNames,
        requiredFundingTags,
      )
    )
    .sort((a, b) => b.score - a.score);
  const visibleFoundationMatches = foundationMatches.filter(
    (match) => shouldShowFoundation(match, effectiveMission, blockedFoundationTypes, blockedFoundationNames, requiredFundingTags)
  );

  const openProgramMatches = prioritizeSaved(visibleFoundationMatches.filter((match) => match.openProgramCount > 0)).slice(0, 4);
  const relationshipMatches = prioritizeSaved(visibleFoundationMatches.filter((match) => match.openProgramCount === 0)).slice(0, 4);
  const projectIsFoundationLed =
    Boolean(selectedProject) &&
    grantMatches.length === 0 &&
    (openProgramMatches.length > 0 || relationshipMatches.length > 0);
  const recommendedApproach = projectIsFoundationLed
    ? {
        label: 'Recommended approach',
        title: 'Foundation-led right now',
        body:
          openProgramMatches.length > 0
            ? `Start with open foundation programs first, then work relationship-led funders for ${selectedProject?.name ?? 'this project'}.`
            : `Start with relationship-led foundations for ${selectedProject?.name ?? 'this project'}. There is no credible live grant lane right now.`,
        tone: 'border-bauhaus-blue bg-link-light text-bauhaus-blue',
      }
    : grantMatches.length > 0
      ? {
          label: 'Recommended approach',
          title: 'Grant-led first',
          body:
            openProgramMatches.length > 0 || relationshipMatches.length > 0
              ? 'Use the strongest live grant first, then support it with foundation outreach.'
              : 'Work the live grant lane first. It currently looks stronger than the foundation lanes.',
          tone: 'border-bauhaus-black bg-white text-bauhaus-black',
        }
      : openProgramMatches.length > 0 || relationshipMatches.length > 0
        ? {
            label: 'Recommended approach',
            title: 'Foundation-led',
            body: 'The current signal is stronger in the foundation lanes than in grants.',
            tone: 'border-bauhaus-red bg-bauhaus-red/5 text-bauhaus-red',
          }
        : null;
  const quickStarts = [
    grantMatches[0]
      ? {
          title: grantMatches[0].row.name,
          lane: 'Open now',
          href: `/grants/${grantMatches[0].row.id}`,
          action: grantMatches[0].actionLabel,
          nextMove: grantMatches[0].motion,
          tone: 'border-bauhaus-black bg-white text-bauhaus-black',
        }
      : null,
    openProgramMatches[0]
      ? {
          title: openProgramMatches[0].row.name,
          lane: 'Open programs',
          href: `/foundations/${openProgramMatches[0].row.id}`,
          action: openProgramMatches[0].actionLabel,
          nextMove: openProgramMatches[0].motion,
          tone: 'border-bauhaus-blue bg-link-light text-bauhaus-blue',
        }
      : null,
    relationshipMatches[0]
      ? {
          title: relationshipMatches[0].row.name,
          lane: 'Relationship-led',
          href: `/foundations/${relationshipMatches[0].row.id}`,
          action: relationshipMatches[0].actionLabel,
          nextMove: relationshipMatches[0].motion,
          tone: 'border-bauhaus-red bg-bauhaus-red/5 text-bauhaus-red',
        }
      : null,
  ].filter(Boolean) as Array<{
    title: string;
    lane: string;
    href: string;
    action: string;
    nextMove: string;
    tone: string;
  }>;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="border-b-4 border-bauhaus-black p-6 md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-bauhaus-red">Funding Matches</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-black uppercase tracking-tight text-bauhaus-black md:text-5xl">
              Find Grants, Programs, And Philanthropists That Fit Your Mission
            </h1>
            <p className="mt-4 max-w-3xl text-base font-medium leading-relaxed text-bauhaus-muted">
              This is the minimal funding workspace for smaller organisations: define the mission, get a ranked shortlist,
              and decide the next move. No giant map. No heavy process.
            </p>

            {profile ? (
              <div className="mt-6 border-2 border-bauhaus-black bg-white p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">
                      Using organisation profile
                    </div>
                    <div className="mt-2 text-lg font-black uppercase tracking-tight text-bauhaus-black">{profile.name}</div>
                    <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-bauhaus-muted">
                      {selectedProject
                        ? `Currently matching for ${selectedProject.name} inside ${profile.name}. ${appliedProfileDefaults.length > 0
                            ? `Loaded ${appliedProfileDefaults.join(', ').toLowerCase()} from the organisation and project context.`
                            : 'Your current URL or form values are overriding the saved defaults.'}`
                        : appliedProfileDefaults.length > 0
                          ? `Loaded ${appliedProfileDefaults.join(', ').toLowerCase()} from this organisation profile. You can still override them below.`
                          : 'This organisation profile is available, but the current search is using your manual values from the URL or form.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {profile.org_type ? (
                      <span className="border-2 border-bauhaus-black/15 bg-bauhaus-canvas px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black">
                        {normalizeOrgType(profile.org_type)}
                      </span>
                    ) : null}
                    {profile.geographic_focus?.length ? (
                      <span className="border-2 border-bauhaus-black/15 bg-bauhaus-canvas px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black">
                        {profile.geographic_focus.slice(0, 2).join(' · ')}
                      </span>
                    ) : null}
                    <Link
                      href={profile.slug ? `/org/${profile.slug}` : '/org'}
                      className="border-2 border-bauhaus-black px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black hover:bg-bauhaus-black hover:text-white"
                    >
                      Open org
                    </Link>
                    {selectedProject && profile.slug && selectedProject.slug ? (
                      <Link
                        href={`/org/${profile.slug}/${selectedProject.slug}`}
                        className="border-2 border-bauhaus-blue px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
                      >
                        Open project
                      </Link>
                    ) : null}
                    <Link
                      href="/profile"
                      className="border-2 border-bauhaus-black/20 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black hover:border-bauhaus-black"
                    >
                      Edit profile
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 border-2 border-dashed border-bauhaus-black/20 bg-bauhaus-canvas p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">No organisation profile loaded</div>
                <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-bauhaus-muted">
                  This page works as a generic matcher, but it gets better once you set up your organisation profile and let the workspace preload your mission, geography, and organisation type.
                </p>
                {process.env.NODE_ENV !== 'production' ? (
                  <p className="mt-2 max-w-2xl text-[11px] font-medium leading-relaxed text-bauhaus-muted">
                    Local testing: add <span className="font-black text-bauhaus-black">?org=act</span> to preload a known org without signing in.
                  </p>
                ) : null}
                <div className="mt-3">
                  <Link href="/profile" className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red underline underline-offset-4">
                    Create or update profile
                  </Link>
                </div>
              </div>
            )}

            <FundingWorkspaceContextForm
              initialMission={effectiveMission}
              rawMission={manualMission}
              initialState={effectiveState}
              initialOrgType={effectiveOrgType}
              profileMission={profileMission}
              projects={projects}
              selectedProjectSlug={selectedProject?.slug ?? ''}
            />

            {selectedProject && (projectMission || fundingBrief || proofPoints.length > 0 || sourcePaths.length > 0) ? (
              <div className="mt-6 border-2 border-bauhaus-black bg-bauhaus-canvas p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">Compiled project brief</div>
                <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-bauhaus-black">
                  {projectMission}
                </p>
                {fundingBrief && fundingBrief !== projectMission ? (
                  <p className="mt-3 max-w-3xl text-sm font-medium leading-relaxed text-bauhaus-muted">
                    {fundingBrief}
                  </p>
                ) : null}
                {visibleFundingTags.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.14em]">
                    {visibleFundingTags.map((tag) => (
                      <span key={tag} className="border-2 border-bauhaus-blue bg-link-light px-2.5 py-2 text-bauhaus-blue">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                {proofPoints.length > 0 ? (
                  <div className="mt-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">Proof points</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.14em]">
                      {proofPoints.slice(0, 4).map((point) => (
                        <span key={point} className="border-2 border-bauhaus-black/15 bg-white px-2.5 py-2 text-bauhaus-black">
                          {point}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {sourcePaths.length > 0 ? (
                  <p className="mt-4 text-[11px] font-medium leading-relaxed text-bauhaus-muted">
                    Source-backed from ACT wiki: {sourcePaths.length} source{sourcePaths.length === 1 ? '' : 's'} linked to this project profile.
                  </p>
                ) : null}
              </div>
            ) : null}

            {recommendedApproach ? (
              <div className={`mt-6 border-2 p-4 ${recommendedApproach.tone}`}>
                <div className="text-[10px] font-black uppercase tracking-[0.18em]">
                  {recommendedApproach.label}
                </div>
                <div className="mt-2 text-lg font-black uppercase tracking-tight">
                  {recommendedApproach.title}
                </div>
                <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed opacity-90">
                  {recommendedApproach.body}
                </p>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.16em]">
              <span className="border-2 border-bauhaus-black/20 bg-white px-3 py-2 text-bauhaus-black">
                {searchLabel(effectiveState, effectiveOrgType)}
              </span>
              {profile ? (
                <span className="border-2 border-bauhaus-red bg-bauhaus-red/5 px-3 py-2 text-bauhaus-red">
                  {profile.name}
                </span>
              ) : null}
              {selectedProject ? (
                <span className="border-2 border-bauhaus-black bg-white px-3 py-2 text-bauhaus-black">
                  {selectedProject.name}
                </span>
              ) : null}
              <span className="border-2 border-bauhaus-black/15 bg-bauhaus-canvas px-3 py-2 text-bauhaus-black">
                {currentContextLabel}
              </span>
              {scoreTerms.map((term) => (
                <span key={term} className="border-2 border-bauhaus-blue bg-link-light px-3 py-2 text-bauhaus-blue">
                  {term}
                </span>
              ))}
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-3">
              <div className="border-2 border-bauhaus-black bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">Open now</div>
                <div className="mt-2 text-3xl font-black uppercase tracking-tight text-bauhaus-black">{grantMatches.length}</div>
                <p className="mt-2 text-sm font-medium text-bauhaus-muted">
                  {projectIsFoundationLed
                    ? `${selectedProject?.name ?? 'This project'} looks foundation-led right now, not grant-led.`
                    : 'Current grants and time-bound opportunities that look usable now.'}
                </p>
              </div>
              <div className="border-2 border-bauhaus-blue bg-link-light p-4 text-bauhaus-blue">
                <div className="text-[10px] font-black uppercase tracking-[0.18em]">Open programs</div>
                <div className="mt-2 text-3xl font-black uppercase tracking-tight">{openProgramMatches.length}</div>
                <p className="mt-2 text-sm font-medium opacity-80">Foundations that appear to have a live program surface, not just a general profile.</p>
              </div>
              <div className="border-2 border-bauhaus-red bg-bauhaus-red/5 p-4 text-bauhaus-red">
                <div className="text-[10px] font-black uppercase tracking-[0.18em]">Relationship-led</div>
                <div className="mt-2 text-3xl font-black uppercase tracking-tight">{relationshipMatches.length}</div>
                <p className="mt-2 text-sm font-medium opacity-80">Foundations that look mission-aligned but need a tighter intro path than a cold application.</p>
              </div>
            </div>

            {quickStarts.length > 0 ? (
              <div className="mt-8 border-2 border-bauhaus-black bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">Start here</div>
                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  {quickStarts.map((item) => (
                    <Link key={item.href} href={item.href} className={`border-2 p-4 transition-colors hover:bg-bauhaus-black hover:text-white ${item.tone}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[10px] font-black uppercase tracking-[0.16em]">{item.lane}</div>
                        <div className="border-2 border-current px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em]">
                          {item.action}
                        </div>
                      </div>
                      <div className="mt-3 text-base font-black uppercase tracking-tight">{item.title}</div>
                      <p className="mt-3 text-sm font-medium leading-relaxed opacity-80">{item.nextMove}</p>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-0 xl:grid-cols-[1.05fr_1fr_1fr]">
            <section className="border-b-4 border-bauhaus-black p-6 xl:border-b-0 xl:border-r-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">Lane one</p>
                  <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-bauhaus-black">Open now</h2>
                </div>
                <Link href="/grants" className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black underline underline-offset-4">
                  Open grants search
                </Link>
              </div>
              <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-bauhaus-muted">
                These are the grants worth checking first if you want a live application route rather than a relationship process.
              </p>

              <div className="mt-6 space-y-4">
                {grantMatches.length === 0 ? (
                  <EmptyLane
                    title={projectIsFoundationLed ? 'No credible grant lane right now' : 'No live grant matches'}
                    body={
                      projectIsFoundationLed
                        ? `${selectedProject?.name ?? 'This project'} currently looks stronger as an open-program or relationship-led foundation play. Skip the grant hunt for now and work the foundation lanes instead.`
                        : 'Try a broader mission phrase or remove the geography filter. If nothing shows up, the better next move is likely a relationship-led foundation rather than an application.'
                    }
                  />
                ) : (
                  grantMatches.map((match) => (
                    <div key={match.row.id} className="border-2 border-bauhaus-black bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">Grant</div>
                          <Link href={`/grants/${match.row.id}`} className="mt-2 block text-lg font-black uppercase tracking-tight text-bauhaus-black hover:text-bauhaus-red">
                            {match.row.name}
                          </Link>
                          <p className="mt-1 text-sm font-medium text-bauhaus-muted">{match.row.provider ?? 'Provider not listed'}</p>
                        </div>
                        <div className="text-right">
                          <div className="border-2 border-bauhaus-black/15 bg-bauhaus-canvas px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black">
                            {formatCurrencyRange(match.row.amount_min, match.row.amount_max)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.14em]">
                        {match.reasons.map((reason) => (
                          <span key={reason} className="border-2 border-bauhaus-blue bg-link-light px-2.5 py-2 text-bauhaus-blue">
                            {reason}
                          </span>
                        ))}
                      </div>

                      <p className="mt-4 text-sm font-medium leading-relaxed text-bauhaus-black">
                        {shortText(match.row.description, 170) || 'No description listed yet.'}
                      </p>

                      <div className="mt-4 border-t-2 border-bauhaus-black/10 pt-4">
                        <div className="mb-2 inline-flex border-2 border-bauhaus-black px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-bauhaus-black">
                          {match.actionLabel}
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">Best next move</div>
                        <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-black">{match.motion}</p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <FundingWorkspaceShortlistButton
                          kind="grant"
                          itemId={match.row.id}
                          orgProfileId={profile?.id}
                          orgSlug={profile?.slug}
                          projectId={selectedProject?.id}
                          projectSlug={selectedProject?.slug}
                          projectName={selectedProject?.name}
                          itemName={match.row.name}
                          providerName={match.row.provider}
                          deadline={match.row.closes_at}
                          amountDisplay={formatCurrencyRange(match.row.amount_min, match.row.amount_max)}
                          amountNumeric={match.row.amount_max ?? match.row.amount_min}
                        />
                        <Link href={`/grants/${match.row.id}`} className="border-2 border-bauhaus-black px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black hover:bg-bauhaus-black hover:text-white">
                          Open grant
                        </Link>
                        {match.row.url ? (
                          <a href={match.row.url} target="_blank" rel="noreferrer" className="border-2 border-bauhaus-black/20 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black hover:border-bauhaus-black">
                            Source
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="border-b-4 border-bauhaus-black p-6 xl:border-b-0 xl:border-r-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue">Lane two</p>
                  <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-bauhaus-black">Open programs</h2>
                </div>
                <Link href="/foundations" className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black underline underline-offset-4">
                  Open foundations
                </Link>
              </div>
              <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-bauhaus-muted">
                These funders look like they have an actual program surface now, which is the closest thing to an apply-now route on the foundation side.
              </p>

              <div className="mt-6 space-y-4">
                {openProgramMatches.length === 0 ? (
                  <EmptyLane
                    title="No open programs surfaced"
                    body="That usually means the stronger move is relationship-first rather than a form-led application. Check the right-hand lane instead of forcing an application route."
                  />
                ) : (
                  openProgramMatches.map((match) => (
                    <div key={match.row.id} className="border-2 border-bauhaus-blue bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue">Foundation program</div>
                          <Link href={`/foundations/${match.row.id}`} className="mt-2 block text-lg font-black uppercase tracking-tight text-bauhaus-black hover:text-bauhaus-blue">
                            {match.row.name}
                          </Link>
                          <p className="mt-1 text-sm font-medium text-bauhaus-muted">{formatCompactCurrency(match.row.total_giving_annual)} annual giving</p>
                        </div>
                        <div className="border-2 border-bauhaus-blue bg-link-light px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-blue">
                          {match.openProgramCount} program{match.openProgramCount === 1 ? '' : 's'}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.14em]">
                        {match.reasons.map((reason) => (
                          <span key={reason} className="border-2 border-bauhaus-blue bg-link-light px-2.5 py-2 text-bauhaus-blue">
                            {reason}
                          </span>
                        ))}
                      </div>

                      <p className="mt-4 text-sm font-medium leading-relaxed text-bauhaus-black">
                        {shortText(match.row.description, 170) || 'No description listed yet.'}
                      </p>

                      <div className="mt-4 border-t-2 border-bauhaus-black/10 pt-4">
                        <div className="mb-2 inline-flex border-2 border-bauhaus-blue px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-bauhaus-blue">
                          {match.actionLabel}
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">Best next move</div>
                        <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-black">{match.motion}</p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <FundingWorkspaceShortlistButton
                          kind="foundation"
                          itemId={match.row.id}
                          orgProfileId={profile?.id}
                          orgSlug={profile?.slug}
                          projectId={selectedProject?.id}
                          projectSlug={selectedProject?.slug}
                          projectName={selectedProject?.name}
                        />
                        <Link href={`/foundations/${match.row.id}`} className="border-2 border-bauhaus-blue px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white">
                          Open profile
                        </Link>
                        {match.row.website ? (
                          <a href={match.row.website} target="_blank" rel="noreferrer" className="border-2 border-bauhaus-black/20 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black hover:border-bauhaus-black">
                            Website
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">Lane three</p>
                  <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-bauhaus-black">Relationship-led</h2>
                </div>
                <Link href="/foundations/tracker" className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black underline underline-offset-4">
                  Open foundation tracker
                </Link>
              </div>
              <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-bauhaus-muted">
                These are the foundations that look mission-aligned but usually need a short intro path, proof, and a clearer first conversation rather than a cold application.
              </p>

              <div className="mt-6 space-y-4">
                {relationshipMatches.length === 0 ? (
                  <EmptyLane
                    title="No relationship-led foundations surfaced"
                    body="Try a broader mission phrase or remove the state filter. If this still stays empty, the better move may be to start in grants and grow proof first."
                  />
                ) : (
                  relationshipMatches.map((match) => (
                    <div key={match.row.id} className="border-2 border-bauhaus-red bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">Foundation</div>
                          <Link href={`/foundations/${match.row.id}`} className="mt-2 block text-lg font-black uppercase tracking-tight text-bauhaus-black hover:text-bauhaus-red">
                            {match.row.name}
                          </Link>
                          <p className="mt-1 text-sm font-medium text-bauhaus-muted">{formatCompactCurrency(match.row.total_giving_annual)} annual giving</p>
                        </div>
                        <div className="border-2 border-bauhaus-red bg-bauhaus-red/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-red">
                          Relationship-led
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.14em]">
                        {match.reasons.map((reason) => (
                          <span key={reason} className="border-2 border-bauhaus-red bg-bauhaus-red/5 px-2.5 py-2 text-bauhaus-red">
                            {reason}
                          </span>
                        ))}
                      </div>

                      <p className="mt-4 text-sm font-medium leading-relaxed text-bauhaus-black">
                        {shortText(match.row.description, 170) || 'No description listed yet.'}
                      </p>

                      <div className="mt-4 border-t-2 border-bauhaus-black/10 pt-4">
                        <div className="mb-2 inline-flex border-2 border-bauhaus-red px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-bauhaus-red">
                          {match.actionLabel}
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">Best next move</div>
                        <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-black">{match.motion}</p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <FundingWorkspaceShortlistButton
                          kind="foundation"
                          itemId={match.row.id}
                          orgProfileId={profile?.id}
                          orgSlug={profile?.slug}
                          projectId={selectedProject?.id}
                          projectSlug={selectedProject?.slug}
                          projectName={selectedProject?.name}
                        />
                        <Link href={`/foundations/${match.row.id}`} className="border-2 border-bauhaus-red px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-red hover:bg-bauhaus-red hover:text-white">
                          Open profile
                        </Link>
                        {match.row.website ? (
                          <a href={match.row.website} target="_blank" rel="noreferrer" className="border-2 border-bauhaus-black/20 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black hover:border-bauhaus-black">
                            Website
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
