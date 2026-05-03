export type ReviewSweepProject = 'Goods' | 'JusticeHub' | 'Empathy Ledger';

export type ReviewSweepGrantRow = {
  id: string;
  stage: string;
  grant: {
    id: string;
    name: string | null;
    provider: string | null;
    amount_min?: number | null;
    amount_max?: number | null;
    closes_at: string | null;
    categories: string[] | null;
    url: string | null;
    updated_at: string | null;
    focus_areas: string[] | null;
    description: string | null;
    source: string | null;
    fit_score?: number | null;
    relevance_score?: number | null;
  } | null;
};

export type ReviewSweepStatus = {
  total: number;
  machinePass: number;
  humanReady: number;
  expired: number;
  stale: number;
  missingUrl: number;
  noDeadline: number;
  wikiCandidates: number;
  onlineFrontier: number;
};

export type ReviewSweepResult = ReviewSweepStatus & {
  machinePassIds: string[];
  expiredIds: string[];
  wikiCandidateIds: string[];
};

export const REVIEW_SWEEP_PROJECT_KEYWORDS: Record<ReviewSweepProject, string[]> = {
  Goods: [
    'goods',
    'medical equipment',
    'supplies',
    'health equity',
    'remote',
    'regional',
    'rural',
    'indigenous',
    'aboriginal',
    'first nations',
    'manufacturing',
    'circular',
    'infrastructure',
    'equipment',
    'housing',
    'laundry',
    'washing',
    'mattress',
    'bed',
    'procurement',
  ],
  JusticeHub: [
    'justice',
    'youth',
    'children',
    'child',
    'diversion',
    'legal',
    'crime',
    'community safety',
    'first nations',
    'aboriginal',
    'indigenous',
    'social justice',
    'welfare',
    'family',
    'violence',
  ],
  'Empathy Ledger': [
    'story',
    'stories',
    'storytelling',
    'media',
    'arts',
    'culture',
    'creative',
    'voice',
    'lived experience',
    'advocacy',
    'human rights',
    'data',
    'digital',
    'privacy',
    'community voice',
  ],
};

export function classifyReviewSweep(
  rows: ReviewSweepGrantRow[],
  options?: {
    now?: Date;
    staleBefore?: Date;
    onlineFrontier?: number;
  }
): ReviewSweepResult {
  const nowMs = (options?.now ?? new Date()).getTime();
  const staleBeforeMs = (options?.staleBefore ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).getTime();
  const discoveredRows = rows.filter((item) => item.stage === 'discovered' && item.grant);
  const machinePassIds = new Set<string>();
  const expiredIds = new Set<string>();
  const wikiCandidateIds = new Set<string>();

  const markMachinePass = (item: ReviewSweepGrantRow, shouldMark: boolean) => {
    if (shouldMark) machinePassIds.add(item.id);
    return shouldMark;
  };

  const expired = discoveredRows.filter((item) => {
    const closesAt = item.grant?.closes_at ? new Date(item.grant.closes_at).getTime() : null;
    const isExpired = !!closesAt && closesAt < nowMs;
    if (isExpired) expiredIds.add(item.id);
    return markMachinePass(item, isExpired);
  }).length;

  const stale = discoveredRows.filter((item) => {
    const updatedAt = item.grant?.updated_at ? new Date(item.grant.updated_at).getTime() : null;
    return markMachinePass(item, !!updatedAt && updatedAt < staleBeforeMs);
  }).length;

  const missingUrl = discoveredRows.filter((item) =>
    markMachinePass(item, !item.grant?.url)
  ).length;

  const noDeadline = discoveredRows.filter((item) =>
    markMachinePass(item, !item.grant?.closes_at)
  ).length;

  const projectKeywords = Object.values(REVIEW_SWEEP_PROJECT_KEYWORDS).flat();
  const wikiCandidates = discoveredRows.filter((item) => {
    const grant = item.grant;
    const text = [
      grant?.name,
      grant?.provider,
      grant?.description,
      grant?.source,
      ...(Array.isArray(grant?.categories) ? grant.categories : []),
      ...(Array.isArray(grant?.focus_areas) ? grant.focus_areas : []),
    ].filter(Boolean).join(' ').toLowerCase();
    const isCandidate = projectKeywords.some((keyword) => text.includes(keyword));
    if (isCandidate) wikiCandidateIds.add(item.id);
    return isCandidate;
  }).length;

  return {
    total: discoveredRows.length,
    machinePass: machinePassIds.size,
    humanReady: Math.max(0, discoveredRows.length - machinePassIds.size),
    expired,
    stale,
    missingUrl,
    noDeadline,
    wikiCandidates,
    onlineFrontier: options?.onlineFrontier ?? 0,
    machinePassIds: Array.from(machinePassIds),
    expiredIds: Array.from(expiredIds),
    wikiCandidateIds: Array.from(wikiCandidateIds),
  };
}
