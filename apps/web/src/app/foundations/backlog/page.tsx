import Link from 'next/link';
import { measuredGivingOrderSql } from '@/lib/foundation-giving';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface BacklogRow {
  id: string;
  name: string;
  type: string | null;
  total_giving_annual: number | null;
  board_roles: number;
  verified_grants: number;
  latest_grant_year: number | null;
  raw_grant_edges: number;
  raw_grant_datasets: number;
  current_program_count: number;
  open_program_count: number;
  application_pathway_count: number;
  latest_program_scraped_at: string | null;
  year_memory_count: number;
  verified_source_backed_count: number;
  website: string | null;
  last_scraped_at: string | null;
}

interface BacklogSearchParams {
  left?: string;
  right?: string;
  queue?: string;
  status?: string;
}

interface FoundationOption {
  id: string;
  name: string;
  type: string | null;
  total_giving_annual: number | null;
}

interface PairAlternative {
  foundationId: string;
  foundationName: string;
  foundationType: string | null;
  candidateId: string;
  candidateName: string;
  candidateType: string | null;
}

type QueueKind =
  | 'grants'
  | 'year_memory'
  | 'source_backed'
  | 'application_pathway'
  | 'recent_grants'
  | 'high_giving_low_review'
  | 'open_program_verification'
  | 'operator';

type QueueStatus = {
  key: string;
  label: string;
  detail: string;
  priority: number;
  tone: 'green' | 'amber' | 'red' | 'slate';
};

const GRANTMAKER_TYPES = [
  'private_ancillary_fund',
  'public_ancillary_fund',
  'trust',
  'corporate_foundation',
  'grantmaker',
  'foundation',
];

const BACKLOG_QUEUE_META: Record<string, { label: string; detail: string }> = {
  'missing-verified-grants': {
    label: 'Missing verified grants',
    detail: 'This compare pair sent you into the grant-evidence queue first.',
  },
  'missing-year-memory': {
    label: 'Missing year memory',
    detail: 'This compare pair needs recurring program-year memory before it becomes a stronger operational read.',
  },
  'missing-source-backed-memory': {
    label: 'Missing source-backed memory',
    detail: 'This compare pair already has some memory structure, but it still needs official provenance.',
  },
  'missing-application-pathway': {
    label: 'Missing application pathway',
    detail: 'This foundation has a public program surface, but we still need the practical access route.',
  },
  'missing-recent-grants': {
    label: 'Missing recent grants',
    detail: 'This foundation needs recent grantee evidence before anyone treats it as a current funder.',
  },
  'high-giving-low-review': {
    label: 'High giving, low review',
    detail: 'This is the priority quality queue: meaningful giving estimate, weak evidence stack.',
  },
  'open-program-needs-verification': {
    label: 'Open program needs verification',
    detail: 'This foundation has open programs that need source-backed eligibility and application checks.',
  },
  'operator-exclusions': {
    label: 'Operator exclusions',
    detail: 'This compare pair is outside the benchmark grantmaker lane and belongs in the exclusion queue for now.',
  },
};

const PAGE_QUEUE_SCAN_LIMIT = 50;

const ACTIONABLE_GRANT_PIPELINE_FOUNDATION_IDS = new Set([
  'b9e090e5-1672-48ff-815a-2a6314ebe033',
  '8f8704be-d6e8-40f3-b561-ac6630ce5b36',
  '25b80b63-416e-4aaa-b470-2f8dc6fa835f',
  '85f0de43-d004-4122-83a6-287eeecc4da9',
  'f5c80d75-6a66-4a0c-aa41-d1f3aa791f21',
  '3af6cf86-f10c-488f-941f-00ab7bbad7f8',
  '983f0037-da5f-43d4-b9ae-3ff8853d6727',
  '77be5d6c-9e0b-4467-9300-e30e4ba480ee',
  '95e902b1-9883-40da-8806-e38d202d8cdf',
  '3ef014f7-76ea-48e6-932a-7ec133cc5342',
  '4a6a3689-626b-4a26-b95c-ed67123cab36',
  '686fc5c5-d211-441b-a424-020c7ee3fb1a',
]);

const BACKLOG_QUEUE_ORDER = [
  'missing-verified-grants',
  'missing-year-memory',
  'missing-source-backed-memory',
  'missing-application-pathway',
  'missing-recent-grants',
  'high-giving-low-review',
  'open-program-needs-verification',
  'operator-exclusions',
] as const;

function buildSliceHref(params: BacklogSearchParams, queue: string) {
  const search = new URLSearchParams();
  if (params.left) search.set('left', params.left);
  if (params.right) search.set('right', params.right);
  search.set('queue', queue);
  if (params.status) search.set('status', params.status);
  return `/foundations/backlog?${search.toString()}#${queue}`;
}

function buildStatusHref(params: BacklogSearchParams, status?: string) {
  const search = new URLSearchParams();
  if (params.left) search.set('left', params.left);
  if (params.right) search.set('right', params.right);
  if (params.queue) search.set('queue', params.queue);
  if (status) search.set('status', status);

  const query = search.toString();
  const hash = params.queue ? `#${params.queue}` : '';
  return query ? `/foundations/backlog?${query}${hash}` : `/foundations/backlog${hash}`;
}

function buildBacklogQuery(comparableTypes: string, filter: string) {
  return `WITH rel AS (
            SELECT r.source_entity_id, COUNT(*)::int AS relationship_grants
            FROM gs_relationships r
            WHERE r.relationship_type = 'grant'
              AND r.dataset = 'foundation_grantees'
            GROUP BY r.source_entity_id
          ),
          fg AS (
            SELECT
              foundation_id,
              COUNT(*)::int AS canonical_grants,
              MAX(grant_year)::int AS latest_grant_year
            FROM foundation_grantees
            GROUP BY foundation_id
          ),
          board AS (
            SELECT
              COALESCE(NULLIF(company_abn, ''), company_name) AS foundation_key,
              COUNT(*)::int AS board_roles
            FROM person_roles
            WHERE cessation_date IS NULL
            GROUP BY COALESCE(NULLIF(company_abn, ''), company_name)
          ),
          programs AS (
            SELECT
              foundation_id,
              COUNT(*)::int AS current_program_count,
              COUNT(*) FILTER (WHERE status = 'open')::int AS open_program_count,
              COUNT(*) FILTER (
                WHERE COALESCE(application_process, '') <> ''
                   OR COALESCE(application_mode, '') <> ''
                   OR url IS NOT NULL
                   OR COALESCE(cardinality(source_urls), 0) > 0
              )::int AS application_pathway_count,
              MAX(scraped_at) AS latest_program_scraped_at
            FROM foundation_programs
            WHERE status IN ('open', 'ongoing', 'closed')
            GROUP BY foundation_id
          ),
          raw_rel AS (
            SELECT
              source_entity_id,
              COUNT(*)::int AS raw_grant_edges,
              COUNT(DISTINCT dataset)::int AS raw_grant_datasets
            FROM gs_relationships
            WHERE relationship_type = 'grant'
              AND dataset <> 'foundation_grantees'
            GROUP BY source_entity_id
          ),
          yrs AS (
            SELECT
              foundation_id,
              COUNT(*)::int AS year_memory_count,
              COUNT(*) FILTER (
                WHERE source_report_url IS NOT NULL
                   OR (
                     COALESCE(metadata->>'source', '') <> ''
                     AND COALESCE(metadata->>'source', '') NOT ILIKE '%inferred%'
                   )
              )::int AS verified_source_backed_count
            FROM foundation_program_years
            GROUP BY foundation_id
          ),
          candidate_rows AS (
            SELECT
              f.id,
              f.name,
              f.type,
              f.total_giving_annual,
              f.website,
              f.last_scraped_at,
              COALESCE(board.board_roles, 0) AS board_roles,
              GREATEST(
                COALESCE(fg.canonical_grants, 0),
                COALESCE(rel.relationship_grants, 0)
              ) AS verified_grants,
              fg.latest_grant_year,
              COALESCE(raw_rel.raw_grant_edges, 0) AS raw_grant_edges,
              COALESCE(raw_rel.raw_grant_datasets, 0) AS raw_grant_datasets,
              COALESCE(programs.current_program_count, 0) AS current_program_count,
              COALESCE(programs.open_program_count, 0) AS open_program_count,
              COALESCE(programs.application_pathway_count, 0) AS application_pathway_count,
              programs.latest_program_scraped_at,
              COALESCE(yrs.year_memory_count, 0) AS year_memory_count,
              COALESCE(yrs.verified_source_backed_count, 0) AS verified_source_backed_count
            FROM foundations f
            LEFT JOIN rel ON rel.source_entity_id = f.gs_entity_id
            LEFT JOIN fg ON fg.foundation_id = f.id
            LEFT JOIN board ON board.foundation_key = COALESCE(NULLIF(f.acnc_abn, ''), f.name)
            LEFT JOIN programs ON programs.foundation_id = f.id
            LEFT JOIN raw_rel ON raw_rel.source_entity_id = f.gs_entity_id
            LEFT JOIN yrs ON yrs.foundation_id = f.id
            WHERE f.total_giving_annual IS NOT NULL
          )
          SELECT *
          FROM candidate_rows
          WHERE ${filter}
          -- #390: total_giving_annual is revenue for three types and a placeholder for 90% of
          -- the rest. Demote rather than exclude, so nothing leaves the backlog.
          ORDER BY ${measuredGivingOrderSql()}
          LIMIT ${PAGE_QUEUE_SCAN_LIMIT}`;
}

function formatMoney(amount: number | null | undefined): string {
  if (amount == null) return '—';
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${Math.round(amount).toLocaleString('en-AU')}`;
}

function formatType(type: string | null | undefined): string {
  if (!type) return 'Unknown';
  return type
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function isGrantmakerComparable(type: string | null | undefined) {
  return GRANTMAKER_TYPES.includes(type || '');
}

function buildPairAlternatives(
  pairRows: FoundationOption[],
  options: FoundationOption[],
): PairAlternative[] {
  const currentIds = new Set(pairRows.map((row) => row.id));

  return pairRows.flatMap((row) => {
    if (!row.type) return [];

    const candidate = options.find((option) =>
      option.id !== row.id &&
      !currentIds.has(option.id) &&
      option.type === row.type,
    );

    if (!candidate) return [];

    return [{
      foundationId: row.id,
      foundationName: row.name,
      foundationType: row.type,
      candidateId: candidate.id,
      candidateName: candidate.name,
      candidateType: candidate.type,
    }];
  });
}

function queueHref(row: BacklogRow, queue: QueueKind) {
  if (queue === 'grants') return `/foundations/${row.id}#matching-grants`;
  if (queue === 'year_memory' || queue === 'source_backed' || queue === 'recent_grants' || queue === 'open_program_verification') return `/foundations/${row.id}#program-history`;
  if (queue === 'application_pathway') return `/foundations/${row.id}#programs-opportunities`;
  if (queue === 'high_giving_low_review') return `/foundations/${row.id}`;
  return `/foundations/compare?left=${row.id}&right=d242967e-0e68-4367-9785-06cf0ec7485e`;
}

function queueStatus(row: BacklogRow, queue: QueueKind): QueueStatus {
  if (queue === 'grants') {
    if (ACTIONABLE_GRANT_PIPELINE_FOUNDATION_IDS.has(row.id)) {
      return {
        key: 'actionable',
        label: 'Actionable now',
        detail: 'A verified-grant pipeline already exists for this foundation.',
        priority: 0,
        tone: 'green',
      };
    }

    if (row.raw_grant_edges > 0) {
      return {
        key: 'blocked_pipeline',
        label: 'Blocked on pipeline',
        detail: `Raw grant dataset exists (${row.raw_grant_edges} edges across ${row.raw_grant_datasets} dataset${row.raw_grant_datasets === 1 ? '' : 's'}), but no canonical backfill pipeline is configured yet.`,
        priority: 1,
        tone: 'amber',
      };
    }

    return {
      key: 'blocked_raw_data',
      label: 'Blocked on raw data',
      detail: 'No raw grant dataset exists yet for canonical verified-grant backfill.',
      priority: 2,
      tone: 'red',
    };
  }

  if (queue === 'year_memory') {
    if (row.current_program_count > 0) {
      return {
        key: 'actionable',
        label: 'Actionable now',
        detail: `Seedable current program rows are present (${row.current_program_count}).`,
        priority: 0,
        tone: 'green',
      };
    }

    return {
      key: 'blocked_public_surface',
      label: 'Blocked on public program surface',
      detail: 'No current public program surface was found to seed program-year memory.',
      priority: 1,
      tone: 'red',
    };
  }

  if (queue === 'source_backed') {
    return {
      key: 'needs_provenance',
      label: 'Needs provenance pass',
      detail: 'Program memory exists, but official provenance is still missing.',
      priority: 0,
      tone: 'amber',
    };
  }

  if (queue === 'application_pathway') {
    if (row.current_program_count > 0) {
      return {
        key: 'needs_application_pathway',
        label: 'Needs access route',
        detail: `Program rows exist (${row.current_program_count}), but application mode, contact route, or source URL still needs extraction.`,
        priority: 0,
        tone: 'amber',
      };
    }

    return {
      key: 'blocked_public_surface',
      label: 'Blocked on public program surface',
      detail: 'No program row exists yet, so the application pathway cannot be extracted cleanly.',
      priority: 1,
      tone: 'red',
    };
  }

  if (queue === 'recent_grants') {
    if (row.latest_grant_year) {
      return {
        key: 'stale_recent_grants',
        label: 'Stale grant layer',
        detail: `Latest verified grant year is ${row.latest_grant_year}; refresh annual reports or public grant databases for newer examples.`,
        priority: 0,
        tone: 'amber',
      };
    }

    return {
      key: 'missing_recent_grants',
      label: 'No recent grants',
      detail: 'No verified grant year is available. Extract recent grantees, amounts, and source URLs before using this as a funder lead.',
      priority: 1,
      tone: 'red',
    };
  }

  if (queue === 'high_giving_low_review') {
    return {
      key: 'needs_foundation_review',
      label: 'Needs review build',
      detail: 'High annual giving estimate but fewer than two review layers. Build governance, recent grants, program memory, and source-backed evidence before ranking it highly.',
      priority: 0,
      tone: 'amber',
    };
  }

  if (queue === 'open_program_verification') {
    if (row.application_pathway_count > 0) {
      return {
        key: 'needs_provenance',
        label: 'Needs source check',
        detail: `Open program rows exist (${row.open_program_count}) and have an access route, but source-backed memory or latest verification is still thin.`,
        priority: 0,
        tone: 'amber',
      };
    }

    return {
      key: 'needs_application_pathway',
      label: 'Needs access route',
      detail: `Open program rows exist (${row.open_program_count}), but eligibility and application route need source-backed extraction.`,
      priority: 0,
      tone: 'red',
    };
  }

  return {
    key: 'outside_benchmark_lane',
    label: 'Outside benchmark lane',
    detail: 'This foundation currently sits outside the benchmark grantmaker lane.',
    priority: 0,
    tone: 'slate',
  };
}

function sortBacklogRows(rows: BacklogRow[], queue: QueueKind, statusFilter?: string) {
  return [...rows]
    .filter((row) => !statusFilter || queueStatus(row, queue).key === statusFilter)
    .sort((left, right) => {
      const leftStatus = queueStatus(left, queue);
      const rightStatus = queueStatus(right, queue);

      if (leftStatus.priority !== rightStatus.priority) {
        return leftStatus.priority - rightStatus.priority;
      }

      return (right.total_giving_annual || 0) - (left.total_giving_annual || 0);
    })
    .slice(0, 12);
}

function countRowsByStatus(rows: BacklogRow[], queue: QueueKind) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = queueStatus(row, queue).key;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function statusToneClassName(tone: QueueStatus['tone']) {
  if (tone === 'green') return 'border-bauhaus-blue/25 bg-link-light text-bauhaus-blue';
  if (tone === 'amber') return 'border-bauhaus-red/25 bg-bauhaus-red/5 text-bauhaus-red';
  if (tone === 'red') return 'border-bauhaus-red bg-white text-bauhaus-red';
  return 'border-bauhaus-black/20 bg-white text-bauhaus-black';
}

function QueueSection({
  id,
  title,
  detail,
  rows,
  queue,
  active,
  statusSummary,
}: {
  id: string;
  title: string;
  detail: string;
  rows: BacklogRow[];
  queue: QueueKind;
  active?: boolean;
  statusSummary: Array<{ key: string; label: string; tone: QueueStatus['tone']; count: number; href: string; active: boolean }>;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-24 p-6 ${active ? 'border-4 border-bauhaus-red bg-bauhaus-red/5' : 'border-4 border-bauhaus-black bg-white'}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red">{title}</div>
        {active ? (
          <span className="border-2 border-bauhaus-red bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-red">
            Active slice
          </span>
        ) : null}
      </div>
      <p className="mt-3 max-w-4xl text-sm font-medium leading-relaxed text-bauhaus-muted">{detail}</p>
      <div className="mt-4">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">Queue status mix</div>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
          {statusSummary.map((status) => (
            <a
              key={status.key}
              href={status.href}
              className={`border-2 px-2.5 py-1 transition-colors ${
                status.active
                  ? 'border-2 border-bauhaus-red bg-white text-bauhaus-red'
                  : `${statusToneClassName(status.tone)} hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white`
              }`}
            >
              {status.label} ({status.count})
            </a>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="mt-5 border-2 border-dashed border-bauhaus-black/20 bg-bauhaus-canvas p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
            No foundations match this status filter in this queue.
          </div>
        </div>
      ) : (
      <div className="mt-5 grid gap-4">
        {rows.map((row, index) => (
          <div key={row.id} className="border-2 border-bauhaus-black/15 bg-bauhaus-canvas p-4">
            {(() => {
              const status = queueStatus(row, queue);
              const statusClassName = statusToneClassName(status.tone);

              return (
                <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">
                  #{index + 1} · {formatType(row.type)}
                </div>
                <div className="mt-1 text-lg font-black text-bauhaus-black">{row.name}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className={`border-2 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${statusClassName}`}>
                  {status.label}
                </div>
                <div className="border-2 border-bauhaus-red/25 bg-bauhaus-red/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">
                  {formatMoney(row.total_giving_annual)}
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
              <span className="border-2 border-bauhaus-black/20 px-2.5 py-1 text-bauhaus-black">
                {row.board_roles} governance
              </span>
              <span className="border-2 border-bauhaus-black/20 px-2.5 py-1 text-bauhaus-black">
                {row.verified_grants} verified grants
              </span>
              <span className="border-2 border-bauhaus-black/20 px-2.5 py-1 text-bauhaus-black">
                {row.year_memory_count} year memory
              </span>
              <span className="border-2 border-bauhaus-black/20 px-2.5 py-1 text-bauhaus-black">
                {row.verified_source_backed_count} source-backed
              </span>
              <span className="border-2 border-bauhaus-black/20 px-2.5 py-1 text-bauhaus-black">
                {row.open_program_count} open programs
              </span>
              <span className="border-2 border-bauhaus-black/20 px-2.5 py-1 text-bauhaus-black">
                {row.application_pathway_count} access routes
              </span>
              <span className="border-2 border-bauhaus-black/20 px-2.5 py-1 text-bauhaus-black">
                Latest grant {row.latest_grant_year || 'unknown'}
              </span>
            </div>
            <p className="mt-4 max-w-3xl text-sm font-medium leading-relaxed text-bauhaus-muted">
              <span className="font-black uppercase tracking-[0.14em] text-bauhaus-black">Blocked:</span>{' '}
              {status.detail}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
              <Link
                href={queueHref(row, queue)}
                className="border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
              >
                Open next step
              </Link>
              <Link
                href={`/foundations/${row.id}`}
                className="border-2 border-bauhaus-black/20 bg-white px-3 py-2 text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
              >
                Open profile
              </Link>
            </div>
                </>
              );
            })()}
          </div>
        ))}
      </div>
      )}
    </section>
  );
}

export default async function FoundationsBacklogPage({ searchParams }: { searchParams: Promise<BacklogSearchParams> }) {
  const params = await searchParams;
  const activeStatus = params.status || null;
  const supabase = getServiceSupabase();
  const comparableTypes = GRANTMAKER_TYPES.map((type) => `'${type}'`).join(',');
  const [
    missingVerifiedGrantsResult,
    missingYearMemoryResult,
    missingSourceBackedResult,
    missingApplicationPathwayResult,
    missingRecentGrantsResult,
    highGivingLowReviewResult,
    openProgramVerificationResult,
    operatorExclusionsResult,
  ] =
    await Promise.all([
      supabase.rpc('exec_sql', {
        query: buildBacklogQuery(
          comparableTypes,
          `type IN (${comparableTypes}) AND board_roles > 0 AND verified_grants = 0`,
        ),
      }),
      supabase.rpc('exec_sql', {
        query: buildBacklogQuery(
          comparableTypes,
          `type IN (${comparableTypes}) AND board_roles > 0 AND year_memory_count = 0`,
        ),
      }),
      supabase.rpc('exec_sql', {
        query: buildBacklogQuery(
          comparableTypes,
          `type IN (${comparableTypes}) AND year_memory_count > 0 AND verified_source_backed_count = 0`,
        ),
      }),
      supabase.rpc('exec_sql', {
        query: buildBacklogQuery(
          comparableTypes,
          `type IN (${comparableTypes}) AND current_program_count > 0 AND application_pathway_count = 0`,
        ),
      }),
      supabase.rpc('exec_sql', {
        query: buildBacklogQuery(
          comparableTypes,
          `type IN (${comparableTypes}) AND (latest_grant_year IS NULL OR latest_grant_year < EXTRACT(YEAR FROM CURRENT_DATE)::int - 3)`,
        ),
      }),
      supabase.rpc('exec_sql', {
        query: buildBacklogQuery(
          comparableTypes,
          `type IN (${comparableTypes}) AND total_giving_annual >= 5000000 AND ((board_roles > 0)::int + (verified_grants > 0)::int + (year_memory_count > 0)::int + (verified_source_backed_count > 0)::int) <= 1`,
        ),
      }),
      supabase.rpc('exec_sql', {
        query: buildBacklogQuery(
          comparableTypes,
          `type IN (${comparableTypes}) AND open_program_count > 0 AND (application_pathway_count = 0 OR verified_source_backed_count = 0)`,
        ),
      }),
      supabase.rpc('exec_sql', {
        query: buildBacklogQuery(
          comparableTypes,
          `(type IS NULL OR type NOT IN (${comparableTypes})) AND board_roles > 0`,
        ),
      }),
    ]);

  const missingVerifiedGrantsRows = (missingVerifiedGrantsResult.data || []) as BacklogRow[];
  const missingYearMemoryRows = (missingYearMemoryResult.data || []) as BacklogRow[];
  const missingSourceBackedRows = (missingSourceBackedResult.data || []) as BacklogRow[];
  const missingApplicationPathwayRows = (missingApplicationPathwayResult.data || []) as BacklogRow[];
  const missingRecentGrantsRows = (missingRecentGrantsResult.data || []) as BacklogRow[];
  const highGivingLowReviewRows = (highGivingLowReviewResult.data || []) as BacklogRow[];
  const openProgramVerificationRows = (openProgramVerificationResult.data || []) as BacklogRow[];
  const operatorExclusionsRows = (operatorExclusionsResult.data || []) as BacklogRow[];
  const missingVerifiedGrants = sortBacklogRows(
    missingVerifiedGrantsRows,
    'grants',
    activeStatus || undefined,
  );
  const missingYearMemory = sortBacklogRows(
    missingYearMemoryRows,
    'year_memory',
    activeStatus || undefined,
  );
  const missingSourceBacked = sortBacklogRows(
    missingSourceBackedRows,
    'source_backed',
    activeStatus || undefined,
  );
  const missingApplicationPathway = sortBacklogRows(
    missingApplicationPathwayRows,
    'application_pathway',
    activeStatus || undefined,
  );
  const missingRecentGrants = sortBacklogRows(
    missingRecentGrantsRows,
    'recent_grants',
    activeStatus || undefined,
  );
  const highGivingLowReview = sortBacklogRows(
    highGivingLowReviewRows,
    'high_giving_low_review',
    activeStatus || undefined,
  );
  const openProgramVerification = sortBacklogRows(
    openProgramVerificationRows,
    'open_program_verification',
    activeStatus || undefined,
  );
  const operatorExclusions = sortBacklogRows(
    operatorExclusionsRows,
    'operator',
    activeStatus || undefined,
  );
  const rowsByQueue = {
    'missing-verified-grants': { rows: missingVerifiedGrantsRows, queue: 'grants' as const },
    'missing-year-memory': { rows: missingYearMemoryRows, queue: 'year_memory' as const },
    'missing-source-backed-memory': { rows: missingSourceBackedRows, queue: 'source_backed' as const },
    'missing-application-pathway': { rows: missingApplicationPathwayRows, queue: 'application_pathway' as const },
    'missing-recent-grants': { rows: missingRecentGrantsRows, queue: 'recent_grants' as const },
    'high-giving-low-review': { rows: highGivingLowReviewRows, queue: 'high_giving_low_review' as const },
    'open-program-needs-verification': { rows: openProgramVerificationRows, queue: 'open_program_verification' as const },
    'operator-exclusions': { rows: operatorExclusionsRows, queue: 'operator' as const },
  };
  const statusCountScope = params.queue && params.queue in rowsByQueue
    ? [rowsByQueue[params.queue as keyof typeof rowsByQueue]]
    : Object.values(rowsByQueue);
  const statusCounts = statusCountScope.reduce<Record<string, number>>((acc, item) => {
    const counts = countRowsByStatus(item.rows, item.queue);
    Object.entries(counts).forEach(([key, value]) => {
      acc[key] = (acc[key] || 0) + value;
    });
    return acc;
  }, {});
  const totalStatusCount = statusCountScope.reduce((sum, item) => sum + item.rows.length, 0);
  const comparePairIds = [params.left, params.right].filter(Boolean) as string[];
  const compareBackHref =
    comparePairIds.length === 2 ? `/foundations/compare?left=${comparePairIds[0]}&right=${comparePairIds[1]}` : null;
  const activeQueueMeta = params.queue ? BACKLOG_QUEUE_META[params.queue] : null;
  const pairSlicePivots = comparePairIds.length === 2
    ? BACKLOG_QUEUE_ORDER.map((queue) => ({
        queue,
        label: BACKLOG_QUEUE_META[queue].label,
        href: buildSliceHref(params, queue),
        active: params.queue === queue,
      }))
    : [];
  const statusChips = [
    { key: null, label: 'All statuses', count: totalStatusCount },
    { key: 'actionable', label: 'Actionable now', count: statusCounts.actionable || 0 },
    { key: 'blocked_raw_data', label: 'Blocked on raw data', count: statusCounts.blocked_raw_data || 0 },
    { key: 'blocked_pipeline', label: 'Blocked on pipeline', count: statusCounts.blocked_pipeline || 0 },
    { key: 'blocked_public_surface', label: 'Blocked on public program surface', count: statusCounts.blocked_public_surface || 0 },
    { key: 'needs_provenance', label: 'Needs provenance pass', count: statusCounts.needs_provenance || 0 },
    { key: 'needs_application_pathway', label: 'Needs access route', count: statusCounts.needs_application_pathway || 0 },
    { key: 'missing_recent_grants', label: 'No recent grants', count: statusCounts.missing_recent_grants || 0 },
    { key: 'stale_recent_grants', label: 'Stale grant layer', count: statusCounts.stale_recent_grants || 0 },
    { key: 'needs_foundation_review', label: 'Needs review build', count: statusCounts.needs_foundation_review || 0 },
    { key: 'outside_benchmark_lane', label: 'Outside benchmark lane', count: statusCounts.outside_benchmark_lane || 0 },
  ] as const;
  const queueStatusSummaries = {
    grants: [
      {
        key: 'actionable',
        label: 'Actionable now',
        tone: 'green' as const,
        count: countRowsByStatus(missingVerifiedGrantsRows, 'grants').actionable || 0,
        href: buildStatusHref({ ...params, queue: 'missing-verified-grants' }, 'actionable'),
        active: params.queue === 'missing-verified-grants' && activeStatus === 'actionable',
      },
      {
        key: 'blocked_pipeline',
        label: 'Blocked on pipeline',
        tone: 'amber' as const,
        count: countRowsByStatus(missingVerifiedGrantsRows, 'grants').blocked_pipeline || 0,
        href: buildStatusHref({ ...params, queue: 'missing-verified-grants' }, 'blocked_pipeline'),
        active: params.queue === 'missing-verified-grants' && activeStatus === 'blocked_pipeline',
      },
      {
        key: 'blocked_raw_data',
        label: 'Blocked on raw data',
        tone: 'red' as const,
        count: countRowsByStatus(missingVerifiedGrantsRows, 'grants').blocked_raw_data || 0,
        href: buildStatusHref({ ...params, queue: 'missing-verified-grants' }, 'blocked_raw_data'),
        active: params.queue === 'missing-verified-grants' && activeStatus === 'blocked_raw_data',
      },
    ],
    year_memory: [
      {
        key: 'actionable',
        label: 'Actionable now',
        tone: 'green' as const,
        count: countRowsByStatus(missingYearMemoryRows, 'year_memory').actionable || 0,
        href: buildStatusHref({ ...params, queue: 'missing-year-memory' }, 'actionable'),
        active: params.queue === 'missing-year-memory' && activeStatus === 'actionable',
      },
      {
        key: 'blocked_public_surface',
        label: 'Blocked on public program surface',
        tone: 'red' as const,
        count: countRowsByStatus(missingYearMemoryRows, 'year_memory').blocked_public_surface || 0,
        href: buildStatusHref({ ...params, queue: 'missing-year-memory' }, 'blocked_public_surface'),
        active: params.queue === 'missing-year-memory' && activeStatus === 'blocked_public_surface',
      },
    ],
    source_backed: [
      {
        key: 'needs_provenance',
        label: 'Needs provenance pass',
        tone: 'amber' as const,
        count: countRowsByStatus(missingSourceBackedRows, 'source_backed').needs_provenance || 0,
        href: buildStatusHref({ ...params, queue: 'missing-source-backed-memory' }, 'needs_provenance'),
        active: params.queue === 'missing-source-backed-memory' && activeStatus === 'needs_provenance',
      },
    ],
    application_pathway: [
      {
        key: 'needs_application_pathway',
        label: 'Needs access route',
        tone: 'amber' as const,
        count: countRowsByStatus(missingApplicationPathwayRows, 'application_pathway').needs_application_pathway || 0,
        href: buildStatusHref({ ...params, queue: 'missing-application-pathway' }, 'needs_application_pathway'),
        active: params.queue === 'missing-application-pathway' && activeStatus === 'needs_application_pathway',
      },
      {
        key: 'blocked_public_surface',
        label: 'Blocked on public program surface',
        tone: 'red' as const,
        count: countRowsByStatus(missingApplicationPathwayRows, 'application_pathway').blocked_public_surface || 0,
        href: buildStatusHref({ ...params, queue: 'missing-application-pathway' }, 'blocked_public_surface'),
        active: params.queue === 'missing-application-pathway' && activeStatus === 'blocked_public_surface',
      },
    ],
    recent_grants: [
      {
        key: 'stale_recent_grants',
        label: 'Stale grant layer',
        tone: 'amber' as const,
        count: countRowsByStatus(missingRecentGrantsRows, 'recent_grants').stale_recent_grants || 0,
        href: buildStatusHref({ ...params, queue: 'missing-recent-grants' }, 'stale_recent_grants'),
        active: params.queue === 'missing-recent-grants' && activeStatus === 'stale_recent_grants',
      },
      {
        key: 'missing_recent_grants',
        label: 'No recent grants',
        tone: 'red' as const,
        count: countRowsByStatus(missingRecentGrantsRows, 'recent_grants').missing_recent_grants || 0,
        href: buildStatusHref({ ...params, queue: 'missing-recent-grants' }, 'missing_recent_grants'),
        active: params.queue === 'missing-recent-grants' && activeStatus === 'missing_recent_grants',
      },
    ],
    high_giving_low_review: [
      {
        key: 'needs_foundation_review',
        label: 'Needs review build',
        tone: 'amber' as const,
        count: countRowsByStatus(highGivingLowReviewRows, 'high_giving_low_review').needs_foundation_review || 0,
        href: buildStatusHref({ ...params, queue: 'high-giving-low-review' }, 'needs_foundation_review'),
        active: params.queue === 'high-giving-low-review' && activeStatus === 'needs_foundation_review',
      },
    ],
    open_program_verification: [
      {
        key: 'needs_provenance',
        label: 'Needs source check',
        tone: 'amber' as const,
        count: countRowsByStatus(openProgramVerificationRows, 'open_program_verification').needs_provenance || 0,
        href: buildStatusHref({ ...params, queue: 'open-program-needs-verification' }, 'needs_provenance'),
        active: params.queue === 'open-program-needs-verification' && activeStatus === 'needs_provenance',
      },
      {
        key: 'needs_application_pathway',
        label: 'Needs access route',
        tone: 'red' as const,
        count: countRowsByStatus(openProgramVerificationRows, 'open_program_verification').needs_application_pathway || 0,
        href: buildStatusHref({ ...params, queue: 'open-program-needs-verification' }, 'needs_application_pathway'),
        active: params.queue === 'open-program-needs-verification' && activeStatus === 'needs_application_pathway',
      },
    ],
    operator: [
      {
        key: 'outside_benchmark_lane',
        label: 'Outside benchmark lane',
        tone: 'slate' as const,
        count: countRowsByStatus(operatorExclusionsRows, 'operator').outside_benchmark_lane || 0,
        href: buildStatusHref({ ...params, queue: 'operator-exclusions' }, 'outside_benchmark_lane'),
        active: params.queue === 'operator-exclusions' && activeStatus === 'outside_benchmark_lane',
      },
    ],
  };
  let comparePairNames: string[] = [];
  let comparePairRows: FoundationOption[] = [];
  let pairAlternatives: PairAlternative[] = [];

  if (comparePairIds.length === 2) {
    const [{ data: pairRows }, { data: compareOptions }] = await Promise.all([
      supabase
        .from('foundations')
        .select('id, name, type, total_giving_annual')
        .in('id', comparePairIds),
      supabase
        .from('foundations')
        .select('id, name, type, total_giving_annual')
        .order('total_giving_annual', { ascending: false, nullsFirst: false })
        .limit(150),
    ]);

    comparePairRows = comparePairIds
      .map((id) => (pairRows || []).find((row) => row.id === id))
      .filter(Boolean) as FoundationOption[];

    comparePairNames = comparePairRows
      .map((row) => row.name)
      .filter(Boolean) as string[];

    if (
      comparePairRows.length === 2 &&
      comparePairRows.every((row) => !isGrantmakerComparable(row.type))
    ) {
      pairAlternatives = buildPairAlternatives(comparePairRows, (compareOptions || []) as FoundationOption[]);
    }
  }

  return (
    <div className="pb-16">
      <section className="border-b-4 border-bauhaus-black pb-10">
        <Link
          href="/foundations"
          className="text-xs font-black uppercase tracking-[0.35em] text-bauhaus-muted transition-colors hover:text-bauhaus-black"
        >
          ← Back to foundations
        </Link>
        <div className="mt-4 text-xs font-black uppercase tracking-[0.35em] text-bauhaus-red">Reviewability backlog</div>
        <h1 className="mt-4 text-4xl font-black leading-[0.9] text-bauhaus-black sm:text-6xl">
          Batch upgrade
          <br />
          queue
        </h1>
        <p className="mt-5 max-w-4xl text-lg font-medium leading-relaxed text-bauhaus-muted">
          This is the compounding work surface: rank the highest-value foundations by missing layer,
          batch the real upgrade jobs, and separate non-grantmaker institutions out of the benchmark lane.
        </p>
        {compareBackHref ? (
          <div className="mt-5 border-l-4 border-bauhaus-blue bg-link-light/40 px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-blue">Opened from compare pair</div>
            <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
              {comparePairNames.length === 2
                ? `${comparePairNames[0]} vs ${comparePairNames[1]} sent you here.`
                : 'A live compare pair sent you here.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
              <a
                href={compareBackHref}
                className="border-2 border-bauhaus-blue/25 bg-white px-3 py-2 text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
              >
                Return to compare
              </a>
            </div>
          </div>
        ) : null}
        {activeQueueMeta ? (
          <div className="mt-5 border-l-4 border-bauhaus-red bg-bauhaus-red/5 px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-red">Current backlog slice</div>
            <div className="mt-2 text-sm font-black uppercase tracking-[0.16em] text-bauhaus-black">
              {activeQueueMeta.label}
            </div>
            <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">{activeQueueMeta.detail}</p>
            {params.queue ? (
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                <a
                  href={`#${params.queue}`}
                  className="border-2 border-bauhaus-red/25 bg-white px-3 py-2 text-bauhaus-red transition-colors hover:border-bauhaus-red hover:bg-bauhaus-red hover:text-white"
                >
                  Jump to active slice
                </a>
              </div>
            ) : null}
            {pairSlicePivots.length > 1 ? (
              <div className="mt-4 border-t-2 border-bauhaus-black/10 pt-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">
                  Keep this pair, change slice
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                  {pairSlicePivots.map((pivot) => (
                    <a
                      key={pivot.queue}
                      href={pivot.href}
                      className={`px-3 py-2 transition-colors ${
                        pivot.active
                          ? 'border-2 border-bauhaus-red bg-white text-bauhaus-red'
                          : 'border-2 border-bauhaus-black/20 bg-white text-bauhaus-black hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white'
                      }`}
                    >
                      {pivot.label}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
            {pairAlternatives.length > 0 ? (
              <div className="mt-4 border-t-2 border-bauhaus-black/10 pt-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">
                  Better-fit compare next
                </div>
                <div className="mt-3 space-y-3">
                  {pairAlternatives.map((alternative) => (
                    <div key={`${alternative.foundationId}-${alternative.candidateId}`} className="border-l-4 border-bauhaus-blue pl-3">
                      <div className="text-xs font-black uppercase tracking-[0.16em] text-bauhaus-black">
                        {alternative.foundationName} → {formatType(alternative.candidateType)}
                      </div>
                      <p className="mt-1 text-sm font-medium leading-relaxed text-bauhaus-muted">
                        Compare {alternative.foundationName} with {alternative.candidateName} instead if you want a more type-aligned read from this backlog lane.
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                        <a
                          href={`/foundations/compare?left=${alternative.foundationId}&right=${alternative.candidateId}&from=backlog&backlog_queue=${params.queue || 'operator-exclusions'}&backlog_left=${params.left || ''}&backlog_right=${params.right || ''}`}
                          className="border-2 border-bauhaus-blue/25 bg-white px-3 py-2 text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
                        >
                          Open {alternative.foundationName} vs {alternative.candidateName}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.25em]">
          <span className="border-2 border-bauhaus-black px-3 py-2 text-bauhaus-black">
            {missingVerifiedGrants.length} grant-layer targets
          </span>
          <span className="border-2 border-bauhaus-blue bg-link-light px-3 py-2 text-bauhaus-blue">
            {missingYearMemory.length} year-memory targets
          </span>
          <span className="border-2 border-bauhaus-yellow bg-warning-light px-3 py-2 text-bauhaus-black">
            {missingApplicationPathway.length} access-route targets
          </span>
          <span className="border-2 border-bauhaus-black/20 bg-white px-3 py-2 text-bauhaus-black">
            {highGivingLowReview.length} high-giving low-review targets
          </span>
          <span className="border-2 border-bauhaus-red bg-bauhaus-red/5 px-3 py-2 text-bauhaus-red">
            {operatorExclusions.length} operator exclusions
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.22em]">
          <Link
            href="/foundations/review-set"
            className="border-2 border-bauhaus-black/20 bg-bauhaus-canvas px-3 py-2 text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
          >
            Open review set
          </Link>
          <Link
            href="/foundations/compare"
            className="border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
          >
            Open compare surface
          </Link>
        </div>
        <div className="mt-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">Jump to backlog slice</div>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
            <a
              href={comparePairIds.length === 2 ? buildSliceHref(params, 'missing-verified-grants') : '#missing-verified-grants'}
              className={`px-3 py-2 transition-colors ${
                params.queue === 'missing-verified-grants'
                  ? 'border-2 border-bauhaus-red bg-white text-bauhaus-red'
                  : 'border-2 border-bauhaus-black/20 bg-white text-bauhaus-black hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white'
              }`}
            >
              Missing verified grants
            </a>
            <a
              href={comparePairIds.length === 2 ? buildSliceHref(params, 'missing-year-memory') : '#missing-year-memory'}
              className={`px-3 py-2 transition-colors ${
                params.queue === 'missing-year-memory'
                  ? 'border-2 border-bauhaus-red bg-white text-bauhaus-red'
                  : 'border-2 border-bauhaus-blue/25 bg-link-light text-bauhaus-blue hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white'
              }`}
            >
              Missing year memory
            </a>
            <a
              href={comparePairIds.length === 2 ? buildSliceHref(params, 'missing-source-backed-memory') : '#missing-source-backed-memory'}
              className={`px-3 py-2 transition-colors ${
                params.queue === 'missing-source-backed-memory'
                  ? 'border-2 border-bauhaus-red bg-white text-bauhaus-red'
                  : 'border-2 border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white'
              }`}
            >
              Missing source-backed memory
            </a>
            <a
              href={comparePairIds.length === 2 ? buildSliceHref(params, 'missing-application-pathway') : '#missing-application-pathway'}
              className={`px-3 py-2 transition-colors ${
                params.queue === 'missing-application-pathway'
                  ? 'border-2 border-bauhaus-red bg-white text-bauhaus-red'
                  : 'border-2 border-bauhaus-yellow bg-warning-light text-bauhaus-black hover:bg-bauhaus-yellow'
              }`}
            >
              Missing application pathway
            </a>
            <a
              href={comparePairIds.length === 2 ? buildSliceHref(params, 'missing-recent-grants') : '#missing-recent-grants'}
              className={`px-3 py-2 transition-colors ${
                params.queue === 'missing-recent-grants'
                  ? 'border-2 border-bauhaus-red bg-white text-bauhaus-red'
                  : 'border-2 border-bauhaus-black/20 bg-white text-bauhaus-black hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white'
              }`}
            >
              Missing recent grants
            </a>
            <a
              href={comparePairIds.length === 2 ? buildSliceHref(params, 'high-giving-low-review') : '#high-giving-low-review'}
              className={`px-3 py-2 transition-colors ${
                params.queue === 'high-giving-low-review'
                  ? 'border-2 border-bauhaus-red bg-white text-bauhaus-red'
                  : 'border-2 border-bauhaus-blue/25 bg-link-light text-bauhaus-blue hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white'
              }`}
            >
              High giving low review
            </a>
            <a
              href={comparePairIds.length === 2 ? buildSliceHref(params, 'open-program-needs-verification') : '#open-program-needs-verification'}
              className={`px-3 py-2 transition-colors ${
                params.queue === 'open-program-needs-verification'
                  ? 'border-2 border-bauhaus-red bg-white text-bauhaus-red'
                  : 'border-2 border-money/25 bg-money-light text-money hover:border-money hover:bg-money hover:text-white'
              }`}
            >
              Open program verification
            </a>
            <a
              href={comparePairIds.length === 2 ? buildSliceHref(params, 'operator-exclusions') : '#operator-exclusions'}
              className={`px-3 py-2 transition-colors ${
                params.queue === 'operator-exclusions'
                  ? 'border-2 border-bauhaus-red bg-white text-bauhaus-red'
                  : 'border-2 border-bauhaus-red/25 bg-bauhaus-red/5 text-bauhaus-red hover:border-bauhaus-red hover:bg-bauhaus-red hover:text-white'
              }`}
            >
              Operator exclusions
            </a>
          </div>
        </div>
        <div className="mt-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">Filter by queue status</div>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
            {statusChips.map((chip) => {
              const active = activeStatus === chip.key || (!activeStatus && chip.key === null);
              return (
                <a
                  key={chip.label}
                  href={buildStatusHref(params, chip.key || undefined)}
                  className={`px-3 py-2 transition-colors ${
                    active
                      ? 'border-2 border-bauhaus-red bg-white text-bauhaus-red'
                      : 'border-2 border-bauhaus-black/20 bg-white text-bauhaus-black hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white'
                  }`}
                >
                  {chip.label} ({chip.count})
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <div className="mt-10 grid gap-6">
        <QueueSection
          id="missing-verified-grants"
          title="Missing verified grants"
          detail="Highest-capital grantmaker-like foundations with governance visibility but no canonical verified grant layer. This is the fastest queue for making compare and review surfaces more truthful."
          rows={missingVerifiedGrants}
          queue="grants"
          active={params.queue === 'missing-verified-grants'}
          statusSummary={queueStatusSummaries.grants}
        />

        <QueueSection
          id="missing-year-memory"
          title="Missing year memory"
          detail="Grantmaker-like foundations that already have governance visibility but no recurring program-year layer yet. This queue compounds compare quality once seeded."
          rows={missingYearMemory}
          queue="year_memory"
          active={params.queue === 'missing-year-memory'}
          statusSummary={queueStatusSummaries.year_memory}
        />

        <QueueSection
          id="missing-source-backed-memory"
          title="Missing source-backed memory"
          detail="Foundations with year-memory rows already present, but still missing official source-backed provenance. This is the cleanup queue after initial seeding."
          rows={missingSourceBacked}
          queue="source_backed"
          active={params.queue === 'missing-source-backed-memory'}
          statusSummary={queueStatusSummaries.source_backed}
        />

        <QueueSection
          id="missing-application-pathway"
          title="Missing application pathway"
          detail="Foundations with program rows but no clear public access route yet. Extract application mode, contact route, eligibility, source URLs, and decision-cycle hints."
          rows={missingApplicationPathway}
          queue="application_pathway"
          active={params.queue === 'missing-application-pathway'}
          statusSummary={queueStatusSummaries.application_pathway}
        />

        <QueueSection
          id="missing-recent-grants"
          title="Missing recent grants"
          detail="Grantmaker-like foundations with no recent verified grantee layer. Use annual reports, grants databases, or impact reports to add current grantees, amounts, years, and source URLs."
          rows={missingRecentGrants}
          queue="recent_grants"
          active={params.queue === 'missing-recent-grants'}
          statusSummary={queueStatusSummaries.recent_grants}
        />

        <QueueSection
          id="high-giving-low-review"
          title="High giving, low review"
          detail="High-annual-giving foundations with weak review depth. Work these first when improving the public directory because each evidence upgrade changes the most visible funder list."
          rows={highGivingLowReview}
          queue="high_giving_low_review"
          active={params.queue === 'high-giving-low-review'}
          statusSummary={queueStatusSummaries.high_giving_low_review}
        />

        <QueueSection
          id="open-program-needs-verification"
          title="Open program needs verification"
          detail="Open foundation programs should not be treated as actionable until eligibility, application route, source URL, and latest checked date are visible."
          rows={openProgramVerification}
          queue="open_program_verification"
          active={params.queue === 'open-program-needs-verification'}
          statusSummary={queueStatusSummaries.open_program_verification}
        />

        <QueueSection
          id="operator-exclusions"
          title="Operator exclusions"
          detail="High-visibility institutions that should not be pushed through the philanthropic benchmark lane without stronger evidence that they are real grantmakers. Use this queue to avoid bad comparisons."
          rows={operatorExclusions}
          queue="operator"
          active={params.queue === 'operator-exclusions'}
          statusSummary={queueStatusSummaries.operator}
        />
      </div>
    </div>
  );
}
