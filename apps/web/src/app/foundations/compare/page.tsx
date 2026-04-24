import type { Metadata } from 'next';
import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Foundation Compare | CivicGraph',
  description: 'Compare two foundations across annual giving, governance, open programs, and recurring year-memory.',
};

const DEFAULT_FOUNDATION_IDS = [
  'd242967e-0e68-4367-9785-06cf0ec7485e',
  '4ee5baca-c898-4318-ae2b-d79b95379cc7',
];

const MINDEROO_FOUNDATION_ID = '8f8704be-d6e8-40f3-b561-ac6630ce5b36';
const RIO_TINTO_FOUNDATION_ID = '85f0de43-d004-4122-83a6-287eeecc4da9';
const IAN_POTTER_FOUNDATION_ID = 'b9e090e5-1672-48ff-815a-2a6314ebe033';
const ECSTRA_FOUNDATION_ID = '25b80b63-416e-4aaa-b470-2f8dc6fa835f';
const REVIEW_SET_IDS = [
  DEFAULT_FOUNDATION_IDS[0],
  DEFAULT_FOUNDATION_IDS[1],
  MINDEROO_FOUNDATION_ID,
  RIO_TINTO_FOUNDATION_ID,
  IAN_POTTER_FOUNDATION_ID,
  ECSTRA_FOUNDATION_ID,
];

const SPECIAL_ROUTE_MAP: Record<string, string> = {
  'd242967e-0e68-4367-9785-06cf0ec7485e': '/snow-foundation',
  '4ee5baca-c898-4318-ae2b-d79b95379cc7': '/foundations/prf',
  '8f8704be-d6e8-40f3-b561-ac6630ce5b36': '/foundations/minderoo',
  '85f0de43-d004-4122-83a6-287eeecc4da9': '/foundations/rio-tinto',
  'b9e090e5-1672-48ff-815a-2a6314ebe033': '/foundations/ian-potter',
  '25b80b63-416e-4aaa-b470-2f8dc6fa835f': '/foundations/ecstra',
};

const FOUNDATION_LABEL_MAP: Record<string, string> = {
  'd242967e-0e68-4367-9785-06cf0ec7485e': 'Snow',
  '4ee5baca-c898-4318-ae2b-d79b95379cc7': 'PRF',
  '8f8704be-d6e8-40f3-b561-ac6630ce5b36': 'Minderoo',
  '85f0de43-d004-4122-83a6-287eeecc4da9': 'Rio Tinto',
  'b9e090e5-1672-48ff-815a-2a6314ebe033': 'Ian Potter',
  '25b80b63-416e-4aaa-b470-2f8dc6fa835f': 'ECSTRA',
};

const CORE_BENCHMARK_IDS = REVIEW_SET_IDS;
const BACKLOG_QUEUE_LABELS: Record<string, string> = {
  'missing-verified-grants': 'Missing verified grants',
  'missing-year-memory': 'Missing year memory',
  'missing-source-backed-memory': 'Missing source-backed memory',
  'operator-exclusions': 'Operator exclusions',
};

interface SearchParams {
  ids?: string;
  left?: string;
  right?: string;
  from?: string;
  backlog_queue?: string;
  backlog_left?: string;
  backlog_right?: string;
}

interface FoundationRow {
  id: string;
  name: string;
  acnc_abn: string;
  type: string | null;
  description: string | null;
  website: string | null;
  total_giving_annual: number | null;
  thematic_focus: string[] | null;
  geographic_focus: string[] | null;
  profile_confidence: string;
  giving_philosophy: string | null;
}

interface FoundationOption {
  id: string;
  name: string;
  type: string | null;
  total_giving_annual: number | null;
}

interface ProgramYearRow {
  id: string;
  report_year: number | null;
  fiscal_year: string | null;
  summary: string | null;
  reported_amount: number | null;
  source_report_url: string | null;
  partners: Array<{ name?: string; role?: string }> | null;
  places: Array<{ name?: string; type?: string }> | null;
  metadata: Record<string, unknown> | null;
  foundation_programs:
    | {
        name: string;
        program_type: string | null;
      }
    | Array<{
        name: string;
        program_type: string | null;
      }>
    | null;
}

interface FoundationCardData {
  foundation: FoundationRow;
  openProgramCount: number;
  totalProgramCount: number;
  boardRoleCount: number;
  verifiedGrantCount: number;
  yearMemoryCount: number;
  latestProgramYears: ProgramYearRow[];
  inferredYearMemoryCount: number;
  reportBackedYearMemoryCount: number;
  reviewReadiness: 'stable' | 'developing' | 'early';
}

interface CountRow {
  count: number;
}

interface ComparePreset {
  label: string;
  left: string;
  right: string;
}

interface ComparisonHighlight {
  label: string;
  value: string;
  detail: string;
}

interface ReviewEstimate {
  status: 'ready' | 'close' | 'not_yet';
  label: string;
  detail: string;
}

interface StabilityAction {
  label: string;
  detail: string;
  href?: string;
}

interface PrimaryReviewAction {
  label: string;
  detail: string;
  href?: string;
}

interface ReviewProgress {
  completed: number;
  total: number;
  missing: string[];
}

interface PairChecklistItem {
  label: string;
  done: boolean;
  href?: string;
}

interface PairContext {
  badge: string;
  title: string;
  detail: string;
}

interface PairExecutionLane {
  label: string;
  detail: string;
  links: Array<{
    label: string;
    href: string;
  }>;
}

interface BenchmarkFit {
  label: string;
  detail: string;
}

interface TypeAlignedAlternative {
  foundationId: string;
  foundationLabel: string;
  candidateId: string;
  candidateLabel: string;
  candidateType: string | null;
}

interface PairBacklogLane {
  label: string;
  detail: string;
  href: string;
}

function isGrantmakerComparable(type: string | null | undefined) {
  return [
    'private_ancillary_fund',
    'public_ancillary_fund',
    'trust',
    'corporate_foundation',
    'grantmaker',
    'foundation',
  ].includes(type || '');
}

function formatFoundationType(type: string | null | undefined) {
  if (!type) return 'unknown';
  return type
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function buildBenchmarkFit(card: FoundationCardData): BenchmarkFit {
  const typeLabel = formatFoundationType(card.foundation.type);

  if (!isGrantmakerComparable(card.foundation.type)) {
    return {
      label: 'Outside benchmark lane',
      detail: `${typeLabel} profile. Use this as institutional context unless a real grantmaker layer is verified.`,
    };
  }

  if (card.reviewReadiness === 'stable') {
    return {
      label: 'Benchmark-ready grantmaker',
      detail: `${typeLabel} with enough evidence depth for stable philanthropic review.`,
    };
  }

  if (card.reviewReadiness === 'developing') {
    return {
      label: 'Grantmaker in build',
      detail: `${typeLabel} with some review structure in place, but still missing part of the verified evidence stack.`,
    };
  }

  return {
    label: 'Grantmaker candidate',
    detail: `${typeLabel} profile, but still too thin for benchmark review without more verified evidence.`,
  };
}

function buildTypeAlignedAlternatives(
  cards: FoundationCardData[],
  options: FoundationOption[],
): TypeAlignedAlternative[] {
  if (cards.length < 2) return [];

  const currentIds = new Set(cards.map((card) => card.foundation.id));

  return cards.flatMap((card) => {
    if (!card.foundation.type) return [];

    const candidate = options.find((option) =>
      option.id !== card.foundation.id &&
      !currentIds.has(option.id) &&
      option.type === card.foundation.type,
    );

    if (!candidate) return [];

    return [{
      foundationId: card.foundation.id,
      foundationLabel: FOUNDATION_LABEL_MAP[card.foundation.id] || card.foundation.name,
      candidateId: candidate.id,
      candidateLabel: FOUNDATION_LABEL_MAP[candidate.id] || candidate.name,
      candidateType: candidate.type,
    }];
  });
}

function formatMoney(amount: number | null | undefined): string {
  if (amount == null) return '—';
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${Math.round(amount).toLocaleString('en-AU')}`;
}

function formatRatio(numerator: number, denominator: number) {
  if (!numerator || !denominator) return null;
  return `${(numerator / denominator).toFixed(1)}x`;
}

function labelise(value: string | null | undefined) {
  if (!value) return 'Program';
  return value.replace(/_/g, ' ');
}

function getProgramYearFoundationProgram(row: ProgramYearRow) {
  if (Array.isArray(row.foundation_programs)) return row.foundation_programs[0] ?? null;
  return row.foundation_programs ?? null;
}

function getDemoHref(foundationId: string) {
  return SPECIAL_ROUTE_MAP[foundationId] || `/foundations/${foundationId}`;
}

function buildCompareHref(left: string, right: string) {
  return `/foundations/compare?left=${left}&right=${right}`;
}

function resolveFoundationIds(pairedIds: string[], requestedIds: string[]) {
  const baseIds =
    pairedIds.length === 2
      ? pairedIds
      : requestedIds.length === 2
        ? requestedIds
        : DEFAULT_FOUNDATION_IDS;

  const [leftId, rightId] = baseIds;
  if (!leftId || !rightId) return DEFAULT_FOUNDATION_IDS;

  if (leftId !== rightId) return [leftId, rightId];

  if (leftId === DEFAULT_FOUNDATION_IDS[0]) return DEFAULT_FOUNDATION_IDS;
  if (leftId === DEFAULT_FOUNDATION_IDS[1]) return [DEFAULT_FOUNDATION_IDS[1], DEFAULT_FOUNDATION_IDS[0]];
  return [leftId, DEFAULT_FOUNDATION_IDS[0]];
}

function signalSummary(card: FoundationCardData) {
  const signals = [];
  if (card.boardRoleCount > 0) signals.push(`${card.boardRoleCount} governance roles`);
  if (card.verifiedGrantCount > 0) signals.push(`${card.verifiedGrantCount} verified grants`);
  if (card.yearMemoryCount > 0) signals.push(`${card.yearMemoryCount} year-memory rows`);
  if (card.openProgramCount > 0) signals.push(`${card.openProgramCount} open programs`);
  return signals;
}

function getPivotTargets(foundationId: string) {
  return CORE_BENCHMARK_IDS
    .filter((candidateId) => candidateId !== foundationId)
    .map((candidateId) => ({
      id: candidateId,
      label: FOUNDATION_LABEL_MAP[candidateId] || 'Benchmark',
    }));
}

function buildPairContext(cards: FoundationCardData[]): PairContext | null {
  if (cards.length < 2) return null;

  const inBenchmarkSet = cards.filter((card) => REVIEW_SET_IDS.includes(card.foundation.id)).length;
  const governanceCount = cards.filter((card) => card.boardRoleCount > 0).length;
  const grantCount = cards.filter((card) => card.verifiedGrantCount > 0).length;
  const yearMemoryCount = cards.filter((card) => card.yearMemoryCount > 0).length;
  const allNonGrantmaker = cards.every((card) => !isGrantmakerComparable(card.foundation.type));

  if (allNonGrantmaker) {
    return {
      badge: 'Operator pair',
      title: 'This pair is made up of operating institutions, not established grantmaker routes.',
      detail:
        `Use it carefully: the current types are ${cards.map((card) => formatFoundationType(card.foundation.type)).join(' and ')}, so this comparison is better for institutional profile reading than for philanthropic benchmark review.`,
    };
  }

  if (inBenchmarkSet === 2) {
    return {
      badge: 'Benchmark pair',
      title: 'This pair sits inside the live review benchmark set.',
      detail:
        'Use it to read real stability differences across proven public review routes, not just profile similarity.',
    };
  }

  if (inBenchmarkSet === 1) {
    return {
      badge: 'Bridge pair',
      title: 'This pair crosses a benchmark foundation with a non-benchmark candidate.',
      detail:
        'Use it to see what evidence is already present on the candidate side and what still separates it from the stable review set.',
    };
  }

  if (governanceCount === 2 && grantCount === 0 && yearMemoryCount === 0) {
    return {
      badge: 'Governance-first pair',
      title: 'This pair is currently legible at the governance layer, but thin everywhere else.',
      detail:
        'It is useful for shortlist or prospect comparison, but not yet for stable philanthropic review because neither side has a verified grant layer or recurring year-memory.',
    };
  }

  return {
    badge: 'Candidate pair',
    title: 'This pair is outside the benchmark set and should be treated as exploratory.',
    detail:
      'Use it to spot the next data lifts: verified grants, recurring year-memory, and source-backed program memory.',
  };
}

function buildSharedPairGaps(cards: FoundationCardData[]) {
  if (cards.length < 2) return [] as string[];

  const sharedChecks = [
    {
      label: 'Verified grant layer',
      missing: cards.every((card) => card.verifiedGrantCount === 0),
    },
    {
      label: 'Recurring year memory',
      missing: cards.every((card) => card.yearMemoryCount === 0),
    },
    {
      label: 'Verified source-backed memory',
      missing: cards.every((card) => card.reportBackedYearMemoryCount === 0),
    },
  ];

  return sharedChecks.filter((check) => check.missing).map((check) => check.label);
}

function buildBacklogHref(cards: FoundationCardData[]) {
  if (cards.length < 2) return '/foundations/backlog';

  const buildParams = (queue?: string) => {
    const params = new URLSearchParams({
      left: cards[0].foundation.id,
      right: cards[1].foundation.id,
    });
    if (queue) params.set('queue', queue);
    return params.toString();
  };
  const withPair = (queue?: string, hash?: string) =>
    `/foundations/backlog?${buildParams(queue)}${hash ? `#${hash}` : ''}`;

  if (isOperatorPair(cards)) return withPair('operator-exclusions', 'operator-exclusions');
  if (cards.every((card) => card.verifiedGrantCount === 0)) {
    return withPair('missing-verified-grants', 'missing-verified-grants');
  }
  if (cards.every((card) => card.yearMemoryCount === 0)) {
    return withPair('missing-year-memory', 'missing-year-memory');
  }
  if (cards.every((card) => card.reportBackedYearMemoryCount === 0)) {
    return withPair('missing-source-backed-memory', 'missing-source-backed-memory');
  }

  return withPair();
}

function buildBacklogLane(cards: FoundationCardData[]): PairBacklogLane {
  const href = buildBacklogHref(cards);

  if (href.endsWith('#operator-exclusions')) {
    return {
      label: 'Operator exclusions',
      detail:
        'This pair is being sent to the exclusion queue because both sides currently read as non-grantmaker institutions. Treat it as institutional context unless a real philanthropic layer emerges.',
      href,
    };
  }

  if (href.endsWith('#missing-verified-grants')) {
    return {
      label: 'Missing verified grants',
      detail:
        'This pair shares a missing grant layer, so the next useful batch queue is verified grants rather than more compare-page interpretation.',
      href,
    };
  }

  if (href.endsWith('#missing-year-memory')) {
    return {
      label: 'Missing year memory',
      detail:
        'This pair needs recurring program-year memory on both sides before it becomes a stronger operating comparison.',
      href,
    };
  }

  if (href.endsWith('#missing-source-backed-memory')) {
    return {
      label: 'Missing source-backed memory',
      detail:
        'This pair already has some year memory, but it still needs official source-backed provenance before the review can harden.',
      href,
    };
  }

  return {
    label: 'General backlog',
    detail:
      'This pair does not collapse neatly into one missing layer, so the full backlog is the right next surface.',
    href,
  };
}

function buildBacklogReturnHref(params: SearchParams) {
  if (
    params.from !== 'backlog' ||
    !params.backlog_left ||
    !params.backlog_right ||
    !params.backlog_queue
  ) {
    return null;
  }

  const search = new URLSearchParams({
    left: params.backlog_left,
    right: params.backlog_right,
    queue: params.backlog_queue,
  });

  return `/foundations/backlog?${search.toString()}#${params.backlog_queue}`;
}

function getGapHref(card: FoundationCardData, gap: 'grants' | 'year-memory' | 'source-backed') {
  if (gap === 'grants') {
    if (card.foundation.id === DEFAULT_FOUNDATION_IDS[1]) return '/foundations/prf#how-prf-funds';
    if (card.foundation.id === DEFAULT_FOUNDATION_IDS[0]) return '/snow-foundation#year-memory';
    return `${getDemoHref(card.foundation.id)}#matching-grants`;
  }

  if (card.foundation.id === DEFAULT_FOUNDATION_IDS[1]) return '/foundations/prf#program-year-memory';
  if (card.foundation.id === DEFAULT_FOUNDATION_IDS[0]) return '/snow-foundation#year-memory';
  return `${getDemoHref(card.foundation.id)}#program-history`;
}

function buildSharedPairExecutionLanes(cards: FoundationCardData[]): PairExecutionLane[] {
  if (cards.length < 2) return [];

  if (cards.every((card) => !isGrantmakerComparable(card.foundation.type))) {
    return [
      {
        label: 'Validate grantmaker fit before further review',
        detail:
          'Open both profiles first and confirm these organizations should be treated as philanthropic funders at all. If not, keep them out of the benchmark review lane and use this compare view only for institutional context.',
        links: cards.map((card) => ({
          label: FOUNDATION_LABEL_MAP[card.foundation.id] || card.foundation.name,
          href: getDemoHref(card.foundation.id),
        })),
      },
    ];
  }

  const lanes: PairExecutionLane[] = [];

  if (cards.every((card) => card.verifiedGrantCount === 0)) {
    lanes.push({
      label: 'Build the verified grant layer on both sides',
      detail:
        'Open each foundation on its grant surface and backfill real grantee or grant-relationship evidence before treating this pair as more than governance-only.',
      links: cards.map((card) => ({
        label: FOUNDATION_LABEL_MAP[card.foundation.id] || card.foundation.name,
        href: getGapHref(card, 'grants'),
      })),
    });
  }

  if (cards.every((card) => card.yearMemoryCount === 0)) {
    lanes.push({
      label: 'Seed recurring year memory on both sides',
      detail:
        'Open each foundation on program history and create year-memory rows so recurring strands can be compared as operating memory instead of profile text.',
      links: cards.map((card) => ({
        label: FOUNDATION_LABEL_MAP[card.foundation.id] || card.foundation.name,
        href: getGapHref(card, 'year-memory'),
      })),
    });
  }

  if (cards.every((card) => card.reportBackedYearMemoryCount === 0)) {
    lanes.push({
      label: 'Promote both sides to verified source-backed memory',
      detail:
        'Once year-memory exists, replace inferred or absent rows with official source-backed program memory so the pair can move toward stable review.',
      links: cards.map((card) => ({
        label: FOUNDATION_LABEL_MAP[card.foundation.id] || card.foundation.name,
        href: getGapHref(card, 'source-backed'),
      })),
    });
  }

  return lanes;
}

function buildComparisonHighlights(cards: FoundationCardData[]): ComparisonHighlight[] {
  if (cards.length < 2) return [];

  const [left, right] = cards;
  const leftGiving = left.foundation.total_giving_annual || 0;
  const rightGiving = right.foundation.total_giving_annual || 0;
  const givingLeader = leftGiving >= rightGiving ? left : right;
  const givingFollower = givingLeader.foundation.id === left.foundation.id ? right : left;
  const givingRatio = formatRatio(
    Math.max(leftGiving, rightGiving),
    Math.min(leftGiving, rightGiving),
  );

  const governanceLeader = left.boardRoleCount >= right.boardRoleCount ? left : right;
  const governanceFollower = governanceLeader.foundation.id === left.foundation.id ? right : left;

  const yearMemoryLeader = left.yearMemoryCount >= right.yearMemoryCount ? left : right;
  const yearMemoryFollower = yearMemoryLeader.foundation.id === left.foundation.id ? right : left;

  const verifiedLeader = left.verifiedGrantCount >= right.verifiedGrantCount ? left : right;
  const verifiedFollower = verifiedLeader.foundation.id === left.foundation.id ? right : left;
  const typeMismatch = left.foundation.type !== right.foundation.type;

  const highlights: ComparisonHighlight[] = [
    {
      label: 'Annual giving gap',
      value:
        leftGiving === rightGiving
          ? 'Parity'
          : `${FOUNDATION_LABEL_MAP[givingLeader.foundation.id] || givingLeader.foundation.name} leads`,
      detail:
        leftGiving === rightGiving
          ? `Both foundations currently surface ${formatMoney(leftGiving)} in annual giving.`
          : `${formatMoney(givingLeader.foundation.total_giving_annual)} vs ${formatMoney(givingFollower.foundation.total_giving_annual)}${givingRatio ? ` · ${givingRatio}` : ''}.`,
    },
    {
      label: 'Governance visibility',
      value:
        left.boardRoleCount === right.boardRoleCount
          ? 'Parity'
          : `${FOUNDATION_LABEL_MAP[governanceLeader.foundation.id] || governanceLeader.foundation.name} leads`,
      detail:
        left.boardRoleCount === right.boardRoleCount
          ? `Both sides currently expose ${left.boardRoleCount} governance roles.`
          : `${governanceLeader.boardRoleCount} roles vs ${governanceFollower.boardRoleCount}.`,
    },
    {
      label: 'Recurring year memory',
      value:
        left.yearMemoryCount === right.yearMemoryCount
          ? 'Parity'
          : `${FOUNDATION_LABEL_MAP[yearMemoryLeader.foundation.id] || yearMemoryLeader.foundation.name} leads`,
      detail:
        left.yearMemoryCount === right.yearMemoryCount
          ? `Both sides currently surface ${left.yearMemoryCount} year-memory rows.`
          : `${yearMemoryLeader.yearMemoryCount} rows vs ${yearMemoryFollower.yearMemoryCount}.`,
    },
    {
      label: 'Verified grant layer',
      value:
        left.verifiedGrantCount === right.verifiedGrantCount
          ? 'Parity'
          : `${FOUNDATION_LABEL_MAP[verifiedLeader.foundation.id] || verifiedLeader.foundation.name} leads`,
      detail:
        left.verifiedGrantCount === right.verifiedGrantCount
          ? `Both sides currently surface ${left.verifiedGrantCount} verified grant rows.`
          : `${verifiedLeader.verifiedGrantCount} verified grants vs ${verifiedFollower.verifiedGrantCount}.`,
    },
  ];

  if (typeMismatch) {
    highlights.unshift({
      label: 'Institution type',
      value: 'Type mismatch',
      detail: `${left.foundation.name} is ${formatFoundationType(left.foundation.type)} while ${right.foundation.name} is ${formatFoundationType(right.foundation.type)}.`,
    });
  }

  return highlights;
}

function sourceLabel(value: string | null | undefined) {
  if (!value) return 'Unknown source';
  return value.replace(/_/g, ' ');
}

function deriveReviewReadiness(card: FoundationCardData): FoundationCardData['reviewReadiness'] {
  if (
    card.boardRoleCount > 0 &&
    card.yearMemoryCount > 0 &&
    card.verifiedGrantCount > 0 &&
    card.reportBackedYearMemoryCount > 0
  ) {
    return 'stable';
  }

  if (card.boardRoleCount > 0 && card.yearMemoryCount > 0) {
    return 'developing';
  }

  return 'early';
}

function readinessLabel(value: FoundationCardData['reviewReadiness']) {
  if (value === 'stable') return 'Stable review';
  if (value === 'developing') return 'Developing review';
  return 'Early review';
}

function buildStabilityActions(card: FoundationCardData): StabilityAction[] {
  const actions: StabilityAction[] = [];
  const foundationRoute = getDemoHref(card.foundation.id);
  const governanceHref = card.foundation.id === DEFAULT_FOUNDATION_IDS[0] ? '/snow-foundation#governance-graph' : foundationRoute;
  const verifiedLayerHref = card.foundation.id === DEFAULT_FOUNDATION_IDS[0] ? '/snow-foundation#year-memory' : foundationRoute;

  if (card.boardRoleCount === 0) {
    actions.push({
      label: 'Backfill governance roles',
      detail: 'Add or reconcile board and leadership visibility so the foundation is legible at the people layer.',
      href: governanceHref,
    });
  }

  if (card.verifiedGrantCount === 0) {
    actions.push({
      label: 'Build the verified grant layer',
      detail: 'Link report-backed grantees or relationship rows so the review is not relying only on program surfaces.',
      href: card.foundation.id === DEFAULT_FOUNDATION_IDS[1] ? '/foundations/prf#how-prf-funds' : foundationRoute,
    });
  }

  if (card.yearMemoryCount === 0) {
    actions.push({
      label: 'Seed recurring year memory',
      detail: 'Create program-year rows so recurring strands can be reviewed across years instead of only as static profile text.',
      href: foundationRoute,
    });
  }

  if (card.inferredYearMemoryCount > 0 && card.reportBackedYearMemoryCount === 0) {
    actions.push({
      label: 'Convert inferred rows to verified source-backed rows',
      detail: `Replace the current ${card.inferredYearMemoryCount} inferred year-memory rows with official source-backed program memory.`,
      href: card.foundation.id === DEFAULT_FOUNDATION_IDS[1] ? '/foundations/prf#program-year-memory' : foundationRoute,
    });
  } else if (card.inferredYearMemoryCount > 0) {
    actions.push({
      label: 'Reduce inferred memory',
      detail: `The foundation still has ${card.inferredYearMemoryCount} inferred year-memory rows that should be verified in a later pass.`,
      href: foundationRoute,
    });
  }

  if (actions.length === 0) {
    actions.push({
      label: 'Maintain the verified layer',
      detail: 'This foundation is stable enough for review. The next job is upkeep rather than core backfill.',
      href: verifiedLayerHref,
    });
  }

  return actions;
}

function buildReviewProgress(card: FoundationCardData): ReviewProgress {
  const checks = [
    { ok: card.boardRoleCount > 0, label: 'governance visibility' },
    { ok: card.verifiedGrantCount > 0, label: 'verified grant layer' },
    { ok: card.yearMemoryCount > 0, label: 'year-memory rows' },
    { ok: card.reportBackedYearMemoryCount > 0, label: 'verified source-backed memory' },
  ];

  return {
    completed: checks.filter((check) => check.ok).length,
    total: checks.length,
    missing: checks.filter((check) => !check.ok).map((check) => check.label),
  };
}

function isOperatorPair(cards: FoundationCardData[]) {
  return cards.length >= 2 && cards.every((card) => !isGrantmakerComparable(card.foundation.type));
}

function buildInstitutionalContextChecklist(cards: FoundationCardData[]): PairChecklistItem[] {
  return cards.flatMap((card) => {
    const foundationLabel = FOUNDATION_LABEL_MAP[card.foundation.id] || card.foundation.name;

    return [
      {
        label: `${foundationLabel}: institution type classified`,
        done: Boolean(card.foundation.type),
        href: getDemoHref(card.foundation.id),
      },
      {
        label: `${foundationLabel}: governance visibility`,
        done: card.boardRoleCount > 0,
        href: getDemoHref(card.foundation.id),
      },
    ];
  });
}

function buildPrimaryReviewAction(cards: FoundationCardData[]): PrimaryReviewAction | null {
  if (cards.length === 0) return null;

  if (isOperatorPair(cards)) {
    return {
      label: 'Validate institutional fit before benchmark review',
      detail:
        'Open the two institutional profiles first. This pair belongs in contextual comparison unless you can show a real grantmaker layer on both sides.',
      href: cards[0] ? getDemoHref(cards[0].foundation.id) : undefined,
    };
  }

  const priorityOrder: Array<FoundationCardData['reviewReadiness']> = ['early', 'developing'];
  const target =
    priorityOrder
      .map((status) => cards.find((card) => card.reviewReadiness === status))
      .find(Boolean) || null;

  if (!target) {
    return {
      label: 'Review the strongest verified route',
      detail: 'This pair is stable enough for review. Use the detailed route to audit the current evidence layer and keep it maintained.',
      href: cards[0] ? getDemoHref(cards[0].foundation.id) : undefined,
    };
  }

  const [firstAction] = buildStabilityActions(target);
  if (!firstAction) return null;

  return {
    label: `${FOUNDATION_LABEL_MAP[target.foundation.id] || target.foundation.name}: ${firstAction.label}`,
    detail: firstAction.detail,
    href: firstAction.href,
  };
}

function buildPairChecklist(cards: FoundationCardData[]): PairChecklistItem[] {
  return cards.flatMap((card) => {
    const foundationLabel = FOUNDATION_LABEL_MAP[card.foundation.id] || card.foundation.name;
    const progress = buildReviewProgress(card);

    const baseChecks: PairChecklistItem[] = [
      {
        label: `${foundationLabel}: governance visibility`,
        done: card.boardRoleCount > 0,
        href: card.boardRoleCount > 0 ? getDemoHref(card.foundation.id) : buildStabilityActions(card).find((action) => action.label === 'Backfill governance roles')?.href,
      },
      {
        label: `${foundationLabel}: verified grant layer`,
        done: card.verifiedGrantCount > 0,
        href:
          card.verifiedGrantCount > 0
            ? getDemoHref(card.foundation.id)
            : buildStabilityActions(card).find((action) => action.label === 'Build the verified grant layer')?.href,
      },
      {
        label: `${foundationLabel}: verified source-backed memory`,
        done: card.reportBackedYearMemoryCount > 0,
        href:
          card.reportBackedYearMemoryCount > 0
            ? getDemoHref(card.foundation.id)
            : buildStabilityActions(card).find((action) => action.label === 'Convert inferred rows to verified source-backed rows')?.href,
      },
    ];

    if (progress.total === progress.completed && !baseChecks.some((check) => !check.done)) {
      return baseChecks;
    }

    return baseChecks;
  });
}

function buildReviewEstimate(cards: FoundationCardData[]): ReviewEstimate {
  if (cards.length < 2) {
    return {
      status: 'not_yet',
      label: 'Unclear pair',
      detail: 'The compare surface needs two valid foundations before review stability can be assessed.',
    };
  }

  if (isOperatorPair(cards)) {
    return {
      status: 'not_yet',
      label: 'Outside benchmark review lane',
      detail:
        'This pair is made up of operating institutions rather than established grantmaker routes. Treat it as institutional context unless a true philanthropic funding layer is verified on both sides.',
    };
  }

  const stableCount = cards.filter((card) => card.reviewReadiness === 'stable').length;
  const developingCount = cards.filter((card) => card.reviewReadiness === 'developing').length;

  if (stableCount === 2) {
    return {
      status: 'ready',
      label: 'Ready for stable review now',
      detail: 'Both sides have governance visibility, recurring year memory, and at least some verified source-backed evidence. This is good enough for serious review.',
    };
  }

  if (stableCount === 1 && developingCount === 1) {
    return {
      status: 'close',
      label: 'One more verification pass',
      detail: 'This pair is close. One side is already stable, while the other still needs verified source-backed program memory or verified grant evidence to stop feeling inferred.',
    };
  }

  if (developingCount === 2) {
    return {
      status: 'close',
      label: '1 to 2 focused passes',
      detail: 'Both sides are reviewable, but not fully stable. The next lift is converting inferred program memory into verified source-backed rows and filling the verified grant layer.',
    };
  }

  return {
    status: 'not_yet',
    label: 'Needs more build before stable review',
    detail: 'The current pair still lacks enough verified evidence depth. Governance and year memory exist in places, but the review would still lean too heavily on inferred data.',
  };
}

const COMPARE_PRESETS: ComparePreset[] = [
  { label: 'Snow vs PRF', left: DEFAULT_FOUNDATION_IDS[0], right: DEFAULT_FOUNDATION_IDS[1] },
  { label: 'Snow vs Minderoo', left: DEFAULT_FOUNDATION_IDS[0], right: MINDEROO_FOUNDATION_ID },
  { label: 'Snow vs Ian Potter', left: DEFAULT_FOUNDATION_IDS[0], right: IAN_POTTER_FOUNDATION_ID },
  { label: 'Snow vs ECSTRA', left: DEFAULT_FOUNDATION_IDS[0], right: ECSTRA_FOUNDATION_ID },
  { label: 'Snow vs Rio Tinto', left: DEFAULT_FOUNDATION_IDS[0], right: RIO_TINTO_FOUNDATION_ID },
  { label: 'PRF vs Minderoo', left: DEFAULT_FOUNDATION_IDS[1], right: MINDEROO_FOUNDATION_ID },
  { label: 'PRF vs Ian Potter', left: DEFAULT_FOUNDATION_IDS[1], right: IAN_POTTER_FOUNDATION_ID },
  { label: 'PRF vs ECSTRA', left: DEFAULT_FOUNDATION_IDS[1], right: ECSTRA_FOUNDATION_ID },
  { label: 'PRF vs Rio Tinto', left: DEFAULT_FOUNDATION_IDS[1], right: RIO_TINTO_FOUNDATION_ID },
  { label: 'Minderoo vs Ian Potter', left: MINDEROO_FOUNDATION_ID, right: IAN_POTTER_FOUNDATION_ID },
  { label: 'Minderoo vs ECSTRA', left: MINDEROO_FOUNDATION_ID, right: ECSTRA_FOUNDATION_ID },
  { label: 'Minderoo vs Rio Tinto', left: MINDEROO_FOUNDATION_ID, right: RIO_TINTO_FOUNDATION_ID },
  { label: 'Ian Potter vs Rio Tinto', left: IAN_POTTER_FOUNDATION_ID, right: RIO_TINTO_FOUNDATION_ID },
  { label: 'Ian Potter vs ECSTRA', left: IAN_POTTER_FOUNDATION_ID, right: ECSTRA_FOUNDATION_ID },
  { label: 'ECSTRA vs Rio Tinto', left: ECSTRA_FOUNDATION_ID, right: RIO_TINTO_FOUNDATION_ID },
];

async function getFoundationCardData(supabase: ReturnType<typeof getServiceSupabase>, foundation: FoundationRow): Promise<FoundationCardData> {
  const [openPrograms, totalPrograms, boardRoles, foundationGranteeTableCount, { data: verifiedGrantRows }, yearMemory] = await Promise.all([
    supabase
      .from('foundation_programs')
      .select('id', { count: 'exact', head: true })
      .eq('foundation_id', foundation.id)
      .eq('status', 'open'),
    supabase
      .from('foundation_programs')
      .select('id', { count: 'exact', head: true })
      .eq('foundation_id', foundation.id)
      .in('status', ['open', 'closed', 'ongoing']),
    (() => {
      const query = supabase
        .from('person_roles')
        .select('person_name', { count: 'exact', head: true })
        .is('cessation_date', null);
      return foundation.acnc_abn
        ? query.eq('company_abn', foundation.acnc_abn)
        : query.eq('company_name', foundation.name);
    })(),
    supabase
      .from('foundation_grantees')
      .select('id', { count: 'exact', head: true })
      .eq('foundation_id', foundation.id),
    supabase.rpc('exec_sql', {
      query: `SELECT COUNT(*)::int AS count
              FROM gs_relationships r
              JOIN gs_entities s ON s.id = r.source_entity_id
              WHERE s.abn = '${foundation.acnc_abn}'
                AND r.relationship_type = 'grant'
                AND r.dataset = 'foundation_grantees'`,
    }),
    supabase
      .from('foundation_program_years')
      .select('id, report_year, fiscal_year, summary, reported_amount, source_report_url, partners, places, metadata, foundation_programs(name, program_type)', { count: 'exact' })
      .eq('foundation_id', foundation.id)
      .order('report_year', { ascending: false, nullsFirst: false }),
  ]);

  const allProgramYears = (yearMemory.data || []) as ProgramYearRow[];
  const latestProgramYears = allProgramYears.slice(0, 4);
  const inferredYearMemoryCount = allProgramYears.filter((row) => {
    const source = typeof row.metadata?.source === 'string' ? row.metadata.source : null;
    return source?.includes('inferred');
  }).length;
  const reportBackedYearMemoryCount = allProgramYears.filter((row) => {
    const source = typeof row.metadata?.source === 'string' ? row.metadata.source : null;
    return !!source && !source.includes('inferred');
  }).length;
  const relationshipGrantCount = Number(((verifiedGrantRows as CountRow[] | null)?.[0]?.count) || 0);
  const verifiedGrantCount = Math.max(foundationGranteeTableCount.count || 0, relationshipGrantCount);

  const draftCard: FoundationCardData = {
    foundation,
    openProgramCount: openPrograms.count || 0,
    totalProgramCount: totalPrograms.count || 0,
    boardRoleCount: boardRoles.count || 0,
    verifiedGrantCount,
    yearMemoryCount: yearMemory.count || 0,
    latestProgramYears,
    inferredYearMemoryCount,
    reportBackedYearMemoryCount,
    reviewReadiness: 'early',
  };

  return {
    ...draftCard,
    reviewReadiness: deriveReviewReadiness(draftCard),
  };
}

export default async function FoundationComparePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const pairedIds = [params.left, params.right].map(value => value?.trim()).filter(Boolean) as string[];
  const backlogPairIds = [params.backlog_left, params.backlog_right].map(value => value?.trim()).filter(Boolean) as string[];
  const requestedIds = (params.ids || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
    .slice(0, 2);
  const foundationIds = resolveFoundationIds(pairedIds, requestedIds);
  const backlogReturnHref = buildBacklogReturnHref(params);
  const backlogQueueLabel = params.backlog_queue ? BACKLOG_QUEUE_LABELS[params.backlog_queue] || 'Backlog slice' : 'Backlog slice';
  const sourcePairHref =
    backlogPairIds.length === 2 ? buildCompareHref(backlogPairIds[0], backlogPairIds[1]) : null;

  const supabase = getServiceSupabase();
  const [{ data: foundations }, { data: foundationOptions }, { data: backlogFoundations }] = await Promise.all([
    supabase
      .from('foundations')
      .select('id, name, acnc_abn, type, description, website, total_giving_annual, thematic_focus, geographic_focus, profile_confidence, giving_philosophy')
      .in('id', foundationIds),
    supabase
      .from('foundations')
      .select('id, name, type, total_giving_annual')
      .order('total_giving_annual', { ascending: false, nullsFirst: false })
      .limit(150),
    backlogPairIds.length === 2
      ? supabase
          .from('foundations')
          .select('id, name')
          .in('id', backlogPairIds)
      : Promise.resolve({ data: [] }),
  ]);

  const orderedFoundations = foundationIds
    .map(id => (foundations || []).find(row => row.id === id))
    .filter(Boolean) as FoundationRow[];

  const cards = await Promise.all(
    orderedFoundations.map(foundation => getFoundationCardData(supabase, foundation)),
  );
  const compareOptions = (foundationOptions || []) as FoundationOption[];
  const backlogPairNames = backlogPairIds
    .map((id) => (backlogFoundations || []).find((row: { id: string; name: string }) => row.id === id)?.name)
    .filter(Boolean) as string[];
  const [leftFoundationId, rightFoundationId] = foundationIds;
  const duplicateSelectionRequested =
    pairedIds.length === 2 && pairedIds[0] === pairedIds[1];
  const highlights = buildComparisonHighlights(cards);
  const reviewEstimate = buildReviewEstimate(cards);
  const primaryReviewAction = buildPrimaryReviewAction(cards);
  const reviewProgress = cards.map((card) => ({
    foundationId: card.foundation.id,
    label: FOUNDATION_LABEL_MAP[card.foundation.id] || card.foundation.name,
    progress: buildReviewProgress(card),
  }));
  const operatorPair = isOperatorPair(cards);
  const pairChecklist = buildPairChecklist(cards);
  const institutionalContextChecklist = buildInstitutionalContextChecklist(cards);
  const pairContext = buildPairContext(cards);
  const sharedPairGaps = buildSharedPairGaps(cards);
  const sharedPairExecutionLanes = buildSharedPairExecutionLanes(cards);
  const typeAlignedAlternatives = buildTypeAlignedAlternatives(cards, compareOptions);
  const backlogHref = buildBacklogHref(cards);
  const backlogLane = buildBacklogLane(cards);
  const totalCompletedSignals = reviewProgress.reduce((sum, item) => sum + item.progress.completed, 0);
  const totalSignals = reviewProgress.reduce((sum, item) => sum + item.progress.total, 0);
  const remainingSignals = totalSignals - totalCompletedSignals;

  return (
    <div className="pb-16">
      <section className="border-b-4 border-bauhaus-black pb-10">
        <div className="text-xs font-black uppercase tracking-[0.35em] text-bauhaus-red">Public compare route</div>
        <h1 className="mt-4 text-4xl font-black leading-[0.9] text-bauhaus-black sm:text-6xl">
          Foundation
          <br />
          Compare
        </h1>
        <p className="mt-5 max-w-4xl text-lg font-medium leading-relaxed text-bauhaus-muted">
          Compare two foundations across capital scale, governance visibility, open program surface,
          and recurring year-memory. Snow and Paul Ramsay are the default pair because they show the
          current best verified case and the first non-Snow replication case side by side.
        </p>
        {backlogReturnHref ? (
          <div className="mt-5 border-l-4 border-bauhaus-blue bg-link-light/40 px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-blue">
              Opened from backlog
            </div>
            <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
              {backlogPairNames.length === 2
                ? `${backlogPairNames[0]} vs ${backlogPairNames[1]} sent you here from ${backlogQueueLabel}.`
                : `This compare view was opened from ${backlogQueueLabel}.`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
              <a
                href={backlogReturnHref}
                className="border-2 border-bauhaus-blue/25 bg-white px-3 py-2 text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
              >
                Return to backlog
              </a>
              {sourcePairHref ? (
                <a
                  href={sourcePairHref}
                  className="border-2 border-bauhaus-black/20 bg-white px-3 py-2 text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
                >
                  Open source pair
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.25em]">
          <span className="border-2 border-bauhaus-black px-3 py-2 text-bauhaus-black">Default: Snow vs PRF</span>
          <span className="border-2 border-bauhaus-blue bg-link-light px-3 py-2 text-bauhaus-blue">Reusable compare surface</span>
          <span className="border-2 border-bauhaus-red bg-bauhaus-red/5 px-3 py-2 text-bauhaus-red">Side-by-side operator view</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.22em]">
          <Link
            href={buildCompareHref(DEFAULT_FOUNDATION_IDS[0], DEFAULT_FOUNDATION_IDS[1])}
            className="border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
          >
            Reset to Snow vs PRF
          </Link>
          <Link
            href="/foundations/review-set"
            className="border-2 border-bauhaus-black/20 bg-bauhaus-canvas px-3 py-2 text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
          >
            Open review set
          </Link>
          <a
            href={backlogHref}
            className="border-2 border-bauhaus-black/20 bg-white px-3 py-2 text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
          >
            Open relevant backlog slice
          </a>
          <Link
            href={buildCompareHref(rightFoundationId, leftFoundationId)}
            className="border-2 border-bauhaus-black/20 bg-bauhaus-canvas px-3 py-2 text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
          >
            Swap sides
          </Link>
          <Link
            href="/foundations"
            className="border-2 border-bauhaus-black/20 bg-white px-3 py-2 text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
          >
            Browse directory
          </Link>
        </div>
      </section>

      <section className="mt-10 border-4 border-bauhaus-black bg-white p-6">
        <div className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red">Choose foundations</div>
        {duplicateSelectionRequested ? (
          <div className="mt-4 border-l-4 border-bauhaus-red bg-bauhaus-red/5 px-4 py-3 text-sm font-bold text-bauhaus-black">
            Duplicate selection detected. The compare view reset the right side so you still land on two different foundations.
          </div>
        ) : null}
        <div className="mt-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">Benchmark pairs</div>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
            {COMPARE_PRESETS.map((preset) => (
              <Link
                key={preset.label}
                href={buildCompareHref(preset.left, preset.right)}
                className="border-2 border-bauhaus-black/20 bg-bauhaus-canvas px-3 py-2 text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
              >
                {preset.label}
              </Link>
            ))}
          </div>
        </div>
        <form method="get" className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">Left side</div>
            <select
              name="left"
              defaultValue={leftFoundationId}
              className="w-full border-4 border-bauhaus-black bg-white px-4 py-3 text-sm font-black text-bauhaus-black focus:bg-bauhaus-yellow focus:outline-none"
            >
              {compareOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} · {formatMoney(option.total_giving_annual)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">Right side</div>
            <select
              name="right"
              defaultValue={rightFoundationId}
              className="w-full border-4 border-bauhaus-black bg-white px-4 py-3 text-sm font-black text-bauhaus-black focus:bg-bauhaus-yellow focus:outline-none"
            >
              {compareOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} · {formatMoney(option.total_giving_annual)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full border-4 border-bauhaus-black bg-bauhaus-red px-5 py-3 text-xs font-black uppercase tracking-[0.22em] text-white transition-colors hover:bg-bauhaus-black xl:w-auto"
            >
              Compare now
            </button>
          </div>
        </form>
      </section>

      {pairContext ? (
        <section className="mt-10 border-4 border-bauhaus-black bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red">Current pair</div>
              <div className="mt-2 text-2xl font-black text-bauhaus-black">{pairContext.badge}</div>
              <p className="mt-3 max-w-4xl text-sm font-medium leading-relaxed text-bauhaus-muted">
                <span className="font-black text-bauhaus-black">{pairContext.title}</span>{' '}
                {pairContext.detail}
              </p>
              {sharedPairGaps.length > 0 ? (
                <div className="mt-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">Shared gaps in this pair</div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                    {sharedPairGaps.map((gap) => (
                      <span
                        key={gap}
                        className="border-2 border-bauhaus-red/25 bg-bauhaus-red/5 px-3 py-2 text-bauhaus-red"
                      >
                        {gap}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {sharedPairExecutionLanes.length > 0 ? (
                <div className="mt-4 border-t-2 border-bauhaus-black/10 pt-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">Pair execution lane</div>
                  <div className="mt-3 space-y-3">
                    {sharedPairExecutionLanes.map((lane) => (
                      <div key={lane.label} className="border-l-4 border-bauhaus-red pl-3">
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-bauhaus-black">{lane.label}</div>
                        <p className="mt-1 text-sm font-medium leading-relaxed text-bauhaus-muted">{lane.detail}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                          {lane.links.map((link) => (
                            <Link
                              key={`${lane.label}-${link.label}`}
                              href={link.href}
                              className="border-2 border-bauhaus-black/20 bg-white px-3 py-2 text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
                            >
                              Open {link.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-4 border-t-2 border-bauhaus-black/10 pt-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">Backlog lane</div>
                <div className="mt-2 text-sm font-black uppercase tracking-[0.16em] text-bauhaus-black">
                  {backlogLane.label}
                </div>
                <p className="mt-2 max-w-4xl text-sm font-medium leading-relaxed text-bauhaus-muted">
                  {backlogLane.detail}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                  <a
                    href={backlogLane.href}
                    className="border-2 border-bauhaus-black/20 bg-white px-3 py-2 text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
                  >
                    Open {backlogLane.label}
                  </a>
                </div>
              </div>
              {operatorPair && typeAlignedAlternatives.length > 0 ? (
                <div className="mt-4 border-t-2 border-bauhaus-black/10 pt-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">Better-fit compare next</div>
                  <div className="mt-3 space-y-3">
                    {typeAlignedAlternatives.map((alternative) => (
                      <div key={`${alternative.foundationId}-${alternative.candidateId}`} className="border-l-4 border-bauhaus-blue pl-3">
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-bauhaus-black">
                          {alternative.foundationLabel} → {formatFoundationType(alternative.candidateType)}
                        </div>
                        <p className="mt-1 text-sm font-medium leading-relaxed text-bauhaus-muted">
                          Compare {alternative.foundationLabel} with {alternative.candidateLabel} instead if you want a more type-aligned read.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                          <Link
                            href={buildCompareHref(alternative.foundationId, alternative.candidateId)}
                            className="border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
                          >
                            Open {alternative.foundationLabel} vs {alternative.candidateLabel}
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
              {cards.map((card) => (
                <Link
                  key={`${card.foundation.id}-pair-route`}
                  href={getDemoHref(card.foundation.id)}
                  className="border-2 border-bauhaus-black/20 bg-white px-3 py-2 text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
                >
                  Open {FOUNDATION_LABEL_MAP[card.foundation.id] || card.foundation.name}
                </Link>
              ))}
              <Link
                href="/foundations/review-set"
                className="border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
              >
                Open benchmark set
              </Link>
              <Link
                href={buildCompareHref(DEFAULT_FOUNDATION_IDS[0], DEFAULT_FOUNDATION_IDS[1])}
                className="border-2 border-bauhaus-black/20 bg-bauhaus-canvas px-3 py-2 text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
              >
                Open strongest benchmark pair
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {highlights.length > 0 ? (
        <section className="mt-10 border-4 border-bauhaus-black bg-white p-6">
          <div className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red">At a glance</div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {highlights.map((highlight) => (
              <div key={highlight.label} className="border-2 border-bauhaus-black bg-bauhaus-canvas p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">
                  {highlight.label}
                </div>
                <div className="mt-2 text-lg font-black text-bauhaus-black">{highlight.value}</div>
                <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">{highlight.detail}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-10 border-4 border-bauhaus-black bg-white p-6">
        <div className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red">Review stability</div>
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="border-2 border-bauhaus-black bg-bauhaus-canvas p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">Current estimate</div>
            <div className="mt-2 text-2xl font-black text-bauhaus-black">{reviewEstimate.label}</div>
            <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">{reviewEstimate.detail}</p>
              <div className="mt-4 border-t-2 border-bauhaus-black/10 pt-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">Progress to stable review</div>
                {operatorPair ? (
                  <>
                    <div className="mt-2 text-lg font-black text-bauhaus-black">Not applicable to benchmark review</div>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
                      This pair sits outside the philanthropic benchmark lane, so stable-review signal math would be misleading here.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mt-2 text-lg font-black text-bauhaus-black">
                      {totalCompletedSignals}/{totalSignals} signals complete
                    </div>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
                      {remainingSignals === 0
                        ? 'No major stability gaps remain for this pair.'
                        : `${remainingSignals} stability signal${remainingSignals === 1 ? '' : 's'} still missing across the pair.`}
                    </p>
                    <div className="mt-3 h-3 w-full overflow-hidden border-2 border-bauhaus-black bg-white">
                      <div
                        className="h-full bg-bauhaus-red transition-all"
                        style={{ width: `${(totalCompletedSignals / totalSignals) * 100}%` }}
                      />
                    </div>
                  </>
                )}
            </div>
            {(operatorPair ? institutionalContextChecklist.length > 0 : pairChecklist.length > 0) ? (
              <div className="mt-4 border-t-2 border-bauhaus-black/10 pt-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">
                  {operatorPair ? 'Institutional context checks' : 'Pair checklist'}
                </div>
                <div className="mt-3 space-y-2">
                  {(operatorPair ? institutionalContextChecklist : pairChecklist).map((item) => (
                    <div key={item.label} className="flex items-start gap-3 text-sm font-medium text-bauhaus-muted">
                      <span
                        className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center border-2 text-[10px] font-black ${
                          item.done
                            ? 'border-money bg-money-light text-money'
                            : 'border-bauhaus-red bg-bauhaus-red/5 text-bauhaus-red'
                        }`}
                      >
                        {item.done ? '✓' : '•'}
                      </span>
                      {item.href ? (
                        <Link href={item.href} className="underline decoration-bauhaus-red underline-offset-4 hover:text-bauhaus-blue">
                          {item.label}
                        </Link>
                      ) : (
                        <span>{item.label}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {primaryReviewAction ? (
              <div className="mt-4 border-t-2 border-bauhaus-black/10 pt-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">Recommended next move</div>
                <div className="mt-2 text-sm font-black uppercase tracking-[0.16em] text-bauhaus-black">
                  {primaryReviewAction.label}
                </div>
                <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">{primaryReviewAction.detail}</p>
                {primaryReviewAction.href ? (
                  <Link
                    href={primaryReviewAction.href}
                    className="mt-3 inline-flex items-center border-2 border-bauhaus-red bg-bauhaus-red px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black"
                  >
                    Open next step
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {cards.map((card) => (
              <div key={`${card.foundation.id}-readiness`} className="border-2 border-bauhaus-black bg-white p-4">
                {(() => {
                  const benchmarkFit = buildBenchmarkFit(card);
                  return (
                    <div className="mb-4 border-b-2 border-bauhaus-black/10 pb-4">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">
                        Benchmark fit
                      </div>
                      <div className="mt-2 text-sm font-black uppercase tracking-[0.16em] text-bauhaus-black">
                        {benchmarkFit.label}
                      </div>
                      <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
                        {benchmarkFit.detail}
                      </p>
                    </div>
                  );
                })()}
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">
                  {FOUNDATION_LABEL_MAP[card.foundation.id] || card.foundation.name}
                </div>
                <div className="mt-2 text-lg font-black text-bauhaus-black">
                  {readinessLabel(card.reviewReadiness)}
                </div>
                <div className="mt-3 space-y-2 text-sm font-medium text-bauhaus-muted">
                  <p>Governance roles: {card.boardRoleCount}</p>
                  <p>Verified grants: {card.verifiedGrantCount}</p>
                  <p>Year memory rows: {card.yearMemoryCount}</p>
                  <p>Verified source-backed rows: {card.reportBackedYearMemoryCount}</p>
                  <p>Inferred rows: {card.inferredYearMemoryCount}</p>
                </div>
                {(() => {
                  const progress = buildReviewProgress(card);
                  const nonGrantmaker = !isGrantmakerComparable(card.foundation.type);
                  return (
                    <div className="mt-4 border-t-2 border-bauhaus-black/10 pt-4">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">
                        {nonGrantmaker ? 'Institutional context' : 'Completion'}
                      </div>
                      {nonGrantmaker ? (
                        <>
                          <div className="mt-2 text-lg font-black text-bauhaus-black">Benchmark review not applicable</div>
                          <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
                            This foundation is currently typed as {formatFoundationType(card.foundation.type)}, so the benchmark completion score is not the right readout.
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="mt-2 text-lg font-black text-bauhaus-black">
                            {progress.completed}/{progress.total} stable signals
                          </div>
                          {progress.missing.length > 0 ? (
                            <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
                              Missing: {progress.missing.join(', ')}.
                            </p>
                          ) : (
                            <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
                              No major review-stability gaps remain.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}
                <div className="mt-4 border-t-2 border-bauhaus-black/10 pt-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">What to do next</div>
                  <div className="mt-3 space-y-3">
                    {buildStabilityActions(card).map((action) => (
                      <div key={action.label} className="border-l-4 border-bauhaus-red pl-3">
                        {action.href ? (
                          <Link
                            href={action.href}
                            className="text-xs font-black uppercase tracking-[0.16em] text-bauhaus-black underline decoration-bauhaus-red underline-offset-4 transition-colors hover:text-bauhaus-blue"
                          >
                            {action.label}
                          </Link>
                        ) : (
                          <div className="text-xs font-black uppercase tracking-[0.16em] text-bauhaus-black">
                            {action.label}
                          </div>
                        )}
                        <p className="mt-1 text-sm font-medium leading-relaxed text-bauhaus-muted">{action.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-10 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {cards.map((card) => {
          const foundation = card.foundation;
          const signals = signalSummary(card);
          const pivotTargets = getPivotTargets(foundation.id);

          return (
            <div key={foundation.id} className="border-4 border-bauhaus-black bg-white">
              <div className="border-b-4 border-bauhaus-black bg-bauhaus-yellow px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-bauhaus-black">
                      {foundation.profile_confidence} confidence
                    </div>
                    <h2 className="mt-2 text-2xl font-black text-bauhaus-black">{foundation.name}</h2>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                      <span className="border-2 border-bauhaus-black/20 bg-white px-2.5 py-1 text-bauhaus-black">
                        {formatFoundationType(foundation.type)}
                      </span>
                      <span className="border-2 border-bauhaus-black/20 bg-white px-2.5 py-1 text-bauhaus-muted">
                        ABN {foundation.acnc_abn || '—'}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={getDemoHref(foundation.id)}
                    className="border-2 border-bauhaus-black px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                  >
                    Open route
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-0 border-b-4 border-bauhaus-black md:grid-cols-4">
                <div className="border-r-2 border-bauhaus-black p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">Annual giving</div>
                  <div className="mt-2 text-2xl font-black text-bauhaus-black">{formatMoney(foundation.total_giving_annual)}</div>
                </div>
                <div className="border-r-2 border-bauhaus-black p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">Open programs</div>
                  <div className="mt-2 text-2xl font-black text-bauhaus-black">{card.openProgramCount}</div>
                </div>
                <div className="border-r-2 border-bauhaus-black p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">Governance</div>
                  <div className="mt-2 text-2xl font-black text-bauhaus-black">{card.boardRoleCount}</div>
                </div>
                <div className="p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">Year memory</div>
                  <div className="mt-2 text-2xl font-black text-bauhaus-black">{card.yearMemoryCount}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-[0.95fr_1.05fr]">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-bauhaus-red">Readiness signals</div>
                  <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                    {signals.map(signal => (
                      <span key={signal} className="border-2 border-bauhaus-black px-2 py-1 text-bauhaus-black">
                        {signal}
                      </span>
                    ))}
                    {signals.length === 0 ? (
                      <span className="border-2 border-bauhaus-black/20 px-2 py-1 text-bauhaus-muted">No strong signals yet</span>
                    ) : null}
                  </div>
                  {foundation.description ? (
                    <p className="mt-4 text-sm font-medium leading-relaxed text-bauhaus-muted">
                      {foundation.description}
                    </p>
                  ) : null}
                  {foundation.giving_philosophy ? (
                    <div className="mt-4 border-l-4 border-bauhaus-red pl-3 text-sm font-bold leading-relaxed text-bauhaus-black">
                      {foundation.giving_philosophy}
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                    {(foundation.thematic_focus || []).slice(0, 4).map((focus) => (
                      <span key={focus} className="border-2 border-bauhaus-black/20 px-2 py-1 text-bauhaus-muted">
                        {focus}
                      </span>
                    ))}
                    {(foundation.geographic_focus || []).slice(0, 3).map((focus) => (
                      <span key={focus} className="border-2 border-bauhaus-blue/20 px-2 py-1 text-bauhaus-blue">
                        {focus}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
                      Pivot compare
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                      {pivotTargets.map((target) => (
                        <Link
                          key={target.id}
                          href={buildCompareHref(foundation.id, target.id)}
                          className="border-2 border-bauhaus-blue/25 bg-link-light px-2 py-1 text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
                        >
                          vs {target.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border-2 border-bauhaus-black bg-bauhaus-canvas p-4">
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-bauhaus-muted">Latest program year memory</div>
                  <div className="mt-4 space-y-3">
                    {card.latestProgramYears.map((row) => {
                      const program = getProgramYearFoundationProgram(row);
                      const source = typeof row.metadata?.source === 'string' ? row.metadata.source : null;
                      const partnerLabel = (row.partners || []).map((partner) => partner.name).filter(Boolean).join(', ');
                      const placeLabel = (row.places || []).map((place) => place.name).filter(Boolean).join(', ');

                      return (
                        <div key={row.id} className="border-b-2 border-bauhaus-black/10 pb-3 last:border-b-0 last:pb-0">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
                                {row.fiscal_year || row.report_year || 'Program year'}
                              </div>
                              <h3 className="mt-1 text-base font-black text-bauhaus-black">
                                {program?.name || 'Unnamed program'}
                              </h3>
                            </div>
                            <span className="border-2 border-bauhaus-black/20 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black">
                              {labelise(program?.program_type || 'program')}
                            </span>
                          </div>
                          {row.summary ? (
                            <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">{row.summary}</p>
                          ) : null}
                          <div className="mt-2 space-y-1 text-xs font-bold text-bauhaus-muted">
                            {partnerLabel ? <p>Partners: {partnerLabel}</p> : null}
                            {placeLabel ? <p>Places: {placeLabel}</p> : null}
                            {source ? <p>Source: {sourceLabel(source)}</p> : null}
                            {row.source_report_url ? (
                              <p>
                                Evidence:{' '}
                                <a
                                  href={row.source_report_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-bauhaus-red underline decoration-bauhaus-red underline-offset-4"
                                >
                                  open source
                                </a>
                              </p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                    {card.latestProgramYears.length === 0 ? (
                      <div className="text-sm font-medium text-bauhaus-muted">No year-memory rows available yet.</div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="mt-10 border-4 border-bauhaus-black bg-white p-6">
        <div className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red">How to use this</div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <div className="text-sm font-black text-bauhaus-black">1. Compare the capital posture</div>
            <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
              Start with annual giving, open programs, and governance visibility before you look at stories or relationships.
            </p>
          </div>
          <div>
            <div className="text-sm font-black text-bauhaus-black">2. Check year-memory depth</div>
            <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
              If recurring program rows exist, the foundation is ready for stronger portfolio tracking and annual review loops.
            </p>
          </div>
          <div>
            <div className="text-sm font-black text-bauhaus-black">3. Open the detailed route</div>
            <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
              Use the detailed demo page only after the compare view has made the differences legible.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
