import Link from 'next/link';
import { getServiceSupabase } from '@/lib/report-supabase';
import { safe } from '@/lib/services/utils';
import { fmt } from '@/lib/services/report-service';

export const revalidate = 3600;

type GrantSummaryRow = {
  total: number;
  open_like: number;
  future_deadline: number;
  linked_foundation: number;
};

type GrantSourceRow = {
  source: string | null;
  discovery_method: string | null;
  rows: number;
  future_deadline: number;
};

type FrontierKindRow = {
  source_kind: string;
  rows: number;
  ever_succeeded: number;
  never_succeeded: number;
  due_now: number;
  failing: number;
  latest_success: string | null;
};

type FrontierQueueRow = {
  source_kind: string;
  source_name: string;
  discovery_source: string | null;
  target_url: string;
  priority: number | null;
  failure_count: number | null;
  last_success_at: string | null;
  next_check_at: string | null;
};

type AutomationRow = {
  agent_id: string;
  interval_hours: number | null;
  enabled: boolean | null;
  last_run_at: string | null;
  priority: number | null;
  run_status: string | null;
  run_completed_at: string | null;
  run_duration_ms: number | null;
};

type FrontierSnapshotRow = {
  source_group: string;
  frontier_rows: number;
  due_now: number;
  failing: number;
  changed_recent: number;
  grant_rows: number;
  future_deadline_rows: number;
  hot_score: number;
  hot_delta: number;
  due_delta: number;
  failure_delta: number;
  changed_delta: number;
  grant_delta: number;
  has_previous_snapshot: boolean;
  latest_success_at: string | null;
  latest_change_at: string | null;
  created_at: string | null;
};

type FrontierFailureRow = {
  source_kind: string;
  source_name: string;
  discovery_source: string | null;
  target_url: string;
  failure_count: number | null;
  last_http_status: number | null;
  last_error: string | null;
};

type FoundationSummaryRow = {
  foundations: number;
  with_giving: number;
  with_website: number;
  foundation_programs: number;
  open_programs: number;
};

type LongTailFoundationRow = {
  id: string;
  name: string;
  type: string | null;
  website: string | null;
  total_giving_annual: number | null;
  program_count: number;
  frontier_rows: number;
};

type LongTailDiscoveryRow = {
  foundation_name: string;
  type: string | null;
  program_name: string;
  url: string | null;
  scraped_at: string | null;
};

function formatRelativeHours(value: string | null) {
  if (!value) return 'Never run';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const diffHours = (Date.now() - parsed.getTime()) / 3_600_000;
  if (diffHours < 1) return '<1h ago';
  return `${Math.round(diffHours)}h ago`;
}

function automationStatus(row: AutomationRow) {
  if (!row.enabled) {
    return {
      label: 'Paused',
      tone: 'border-gray-300 bg-gray-100 text-gray-700',
    };
  }
  if (!row.last_run_at) {
    return {
      label: 'Pending first run',
      tone: 'border-bauhaus-blue bg-blue-50 text-bauhaus-blue',
    };
  }
  const parsed = new Date(row.last_run_at);
  const interval = Number(row.interval_hours || 24);
  const diffHours = (Date.now() - parsed.getTime()) / 3_600_000;
  if (diffHours > interval * 1.2) {
    return {
      label: 'Overdue',
      tone: 'border-red-200 bg-red-50 text-red-700',
    };
  }
  return {
    label: 'Healthy',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
}

function pct(numerator: number, denominator: number) {
  if (!denominator) return '0%';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function labelKind(value: string) {
  return value.replaceAll('_', ' ');
}

function labelSourceGroup(value: string) {
  return value.replaceAll('-', ' ').replaceAll('_', ' ');
}

async function getData() {
  const supabase = getServiceSupabase();
  const grantSummaryQuery = `
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE COALESCE(status, '') IN ('open', 'opening_soon', 'active'))::int AS open_like,
      COUNT(*) FILTER (WHERE COALESCE(deadline, closes_at) >= CURRENT_DATE)::int AS future_deadline,
      COUNT(*) FILTER (WHERE foundation_id IS NOT NULL)::int AS linked_foundation
    FROM grant_opportunities
  `;
  const grantSourcesQuery = `
    SELECT
      source,
      discovery_method,
      COUNT(*)::int AS rows,
      COUNT(*) FILTER (WHERE COALESCE(deadline, closes_at) >= CURRENT_DATE)::int AS future_deadline
    FROM grant_opportunities
    GROUP BY source, discovery_method
    ORDER BY rows DESC
    LIMIT 12
  `;
  const frontierKindsQuery = `
    SELECT
      source_kind,
      COUNT(*)::int AS rows,
      COUNT(*) FILTER (WHERE last_success_at IS NOT NULL)::int AS ever_succeeded,
      COUNT(*) FILTER (WHERE last_success_at IS NULL)::int AS never_succeeded,
      COUNT(*) FILTER (WHERE next_check_at <= NOW())::int AS due_now,
      COUNT(*) FILTER (WHERE failure_count > 0)::int AS failing,
      MAX(last_success_at)::text AS latest_success
    FROM source_frontier
    GROUP BY source_kind
    ORDER BY rows DESC
  `;
  const frontierQueueQuery = `
    SELECT
      source_kind,
      source_name,
      discovery_source,
      target_url,
      priority,
      failure_count,
      last_success_at::text AS last_success_at,
      next_check_at::text AS next_check_at
    FROM source_frontier
    WHERE enabled = true
    ORDER BY
      CASE WHEN next_check_at <= NOW() THEN 0 ELSE 1 END,
      priority DESC NULLS LAST,
      next_check_at ASC NULLS FIRST,
      failure_count DESC NULLS LAST
    LIMIT 16
  `;
  const automationQuery = `
    WITH latest_runs AS (
      SELECT
        agent_id,
        status,
        completed_at::text AS completed_at,
        duration_ms,
        ROW_NUMBER() OVER (
          PARTITION BY agent_id
          ORDER BY started_at DESC
        ) AS rn
      FROM agent_runs
      WHERE agent_id IN (
        'sync-source-frontier',
        'poll-source-frontier',
        'poll-foundation-frontier',
        'discover-foundation-programs-long-tail',
        'snapshot-grant-frontier',
        'sync-foundation-programs',
        'import-gov-grants'
      )
    )
    SELECT
      s.agent_id,
      s.interval_hours,
      s.enabled,
      s.last_run_at::text,
      s.priority,
      r.status AS run_status,
      r.completed_at AS run_completed_at,
      r.duration_ms AS run_duration_ms
    FROM agent_schedules s
    LEFT JOIN latest_runs r
      ON r.agent_id = s.agent_id
     AND r.rn = 1
    WHERE s.agent_id IN (
      'sync-source-frontier',
      'poll-source-frontier',
      'poll-foundation-frontier',
      'discover-foundation-programs-long-tail',
      'snapshot-grant-frontier',
      'sync-foundation-programs',
      'import-gov-grants'
    )
    ORDER BY s.priority, s.agent_id
  `;
  const snapshotQuery = `
    WITH latest AS (
      SELECT DISTINCT ON (source_group)
        source_group,
        frontier_rows,
        due_now,
        failing,
        changed_recent,
        grant_rows,
        future_deadline_rows,
        hot_score,
        hot_delta,
        due_delta,
        failure_delta,
        changed_delta,
        grant_delta,
        has_previous_snapshot,
        latest_success_at::text AS latest_success_at,
        latest_change_at::text AS latest_change_at,
        created_at::text AS created_at
      FROM grant_frontier_source_snapshots
      ORDER BY source_group, created_at DESC
    )
    SELECT *
    FROM latest
    ORDER BY
      CASE
        WHEN has_previous_snapshot
          AND (hot_delta <> 0 OR due_delta <> 0 OR failure_delta <> 0 OR changed_delta <> 0 OR grant_delta <> 0)
          THEN 0
        ELSE 1
      END,
      hot_score DESC,
      source_group
    LIMIT 12
  `;
  const failureQuery = `
    SELECT
      source_kind,
      source_name,
      discovery_source,
      target_url,
      failure_count,
      last_http_status,
      last_error
    FROM source_frontier
    WHERE failure_count > 0
    ORDER BY failure_count DESC, updated_at DESC
    LIMIT 12
  `;
  const foundationSummaryQuery = `
    SELECT
      (SELECT COUNT(*)::int FROM foundations) AS foundations,
      (SELECT COUNT(*)::int FROM foundations WHERE total_giving_annual IS NOT NULL) AS with_giving,
      (SELECT COUNT(*)::int FROM foundations WHERE website IS NOT NULL) AS with_website,
      (SELECT COUNT(*)::int FROM foundation_programs) AS foundation_programs,
      (SELECT COUNT(*)::int FROM foundation_programs WHERE status = 'open') AS open_programs
  `;
  const longTailFoundersQuery = `
    WITH program_counts AS (
      SELECT foundation_id, COUNT(*)::int AS program_count
      FROM foundation_programs
      GROUP BY foundation_id
    )
    SELECT
      f.id::text AS id,
      f.name,
      f.type,
      f.website,
      f.total_giving_annual,
      COALESCE(pc.program_count, 0)::int AS program_count,
      COUNT(sf.id)::int AS frontier_rows
    FROM foundations f
    LEFT JOIN program_counts pc
      ON pc.foundation_id = f.id
    LEFT JOIN source_frontier sf
      ON sf.foundation_id = f.id
    WHERE f.website IS NOT NULL
      AND COALESCE(pc.program_count, 0) = 0
      AND (
        COALESCE(f.total_giving_annual, 0) >= 25000000
        OR f.type IN (
          'university',
          'primary_health_network',
          'community_foundation',
          'education_body',
          'research_body',
          'indigenous_organisation',
          'public_ancillary_fund',
          'private_ancillary_fund',
          'legal_aid'
        )
      )
    GROUP BY f.id, f.name, f.type, f.website, f.total_giving_annual, pc.program_count
    ORDER BY f.total_giving_annual DESC NULLS LAST, f.name
    LIMIT 14
  `;
  const longTailDiscoveryQuery = `
    SELECT
      f.name AS foundation_name,
      f.type,
      p.name AS program_name,
      p.url,
      p.scraped_at::text AS scraped_at
    FROM foundation_programs p
    JOIN foundations f
      ON f.id = p.foundation_id
    WHERE EXISTS (
      SELECT 1
      FROM source_frontier sf
      WHERE sf.foundation_id = f.id
        AND sf.metadata->>'long_tail_priority' = 'true'
    )
    ORDER BY p.scraped_at DESC NULLS LAST, f.name, p.name
    LIMIT 10
  `;

  const [grantSummary, grantSources, frontierKinds, frontierQueue, automations, snapshots, failures, foundationSummary, longTailFounders, longTailDiscoveries] = await Promise.all([
    safe<GrantSummaryRow[] | null>(
      supabase.rpc('exec_sql', { query: grantSummaryQuery }) as PromiseLike<{ data: GrantSummaryRow[] | null; error: unknown }>,
      'grant frontier summary',
    ),
    safe<GrantSourceRow[] | null>(
      supabase.rpc('exec_sql', { query: grantSourcesQuery }) as PromiseLike<{ data: GrantSourceRow[] | null; error: unknown }>,
      'grant frontier sources',
    ),
    safe<FrontierKindRow[] | null>(
      supabase.rpc('exec_sql', { query: frontierKindsQuery }) as PromiseLike<{ data: FrontierKindRow[] | null; error: unknown }>,
      'grant frontier kinds',
    ),
    safe<FrontierQueueRow[] | null>(
      supabase.rpc('exec_sql', { query: frontierQueueQuery }) as PromiseLike<{ data: FrontierQueueRow[] | null; error: unknown }>,
      'grant frontier queue',
    ),
    safe<AutomationRow[] | null>(
      supabase.rpc('exec_sql', { query: automationQuery }) as PromiseLike<{ data: AutomationRow[] | null; error: unknown }>,
      'grant frontier automations',
    ),
    safe<FrontierSnapshotRow[] | null>(
      supabase.rpc('exec_sql', { query: snapshotQuery }) as PromiseLike<{ data: FrontierSnapshotRow[] | null; error: unknown }>,
      'grant frontier snapshots',
    ),
    safe<FrontierFailureRow[] | null>(
      supabase.rpc('exec_sql', { query: failureQuery }) as PromiseLike<{ data: FrontierFailureRow[] | null; error: unknown }>,
      'grant frontier failures',
    ),
    safe<FoundationSummaryRow[] | null>(
      supabase.rpc('exec_sql', { query: foundationSummaryQuery }) as PromiseLike<{ data: FoundationSummaryRow[] | null; error: unknown }>,
      'grant frontier foundations',
    ),
    safe<LongTailFoundationRow[] | null>(
      supabase.rpc('exec_sql', { query: longTailFoundersQuery }) as PromiseLike<{ data: LongTailFoundationRow[] | null; error: unknown }>,
      'grant frontier long tail foundations',
    ),
    safe<LongTailDiscoveryRow[] | null>(
      supabase.rpc('exec_sql', { query: longTailDiscoveryQuery }) as PromiseLike<{ data: LongTailDiscoveryRow[] | null; error: unknown }>,
      'grant frontier long tail discoveries',
    ),
  ]);

  return {
    grantSummary: grantSummary?.[0] || { total: 0, open_like: 0, future_deadline: 0, linked_foundation: 0 },
    grantSources: grantSources ?? [],
    frontierKinds: frontierKinds ?? [],
    frontierQueue: frontierQueue ?? [],
    automations: automations ?? [],
    snapshots: snapshots ?? [],
    failures: failures ?? [],
    longTailFounders: longTailFounders ?? [],
    longTailDiscoveries: longTailDiscoveries ?? [],
    foundationSummary: foundationSummary?.[0] || {
      foundations: 0,
      with_giving: 0,
      with_website: 0,
      foundation_programs: 0,
      open_programs: 0,
    },
  };
}

export default async function GrantFrontierPage() {
  const { grantSummary, grantSources, frontierKinds, frontierQueue, automations, snapshots, failures, foundationSummary, longTailFounders, longTailDiscoveries } = await getData();
  const totalFrontierRows = frontierKinds.reduce((sum, row) => sum + Number(row.rows || 0), 0);
  const totalDueNow = frontierKinds.reduce((sum, row) => sum + Number(row.due_now || 0), 0);
  const totalNeverSucceeded = frontierKinds.reduce((sum, row) => sum + Number(row.never_succeeded || 0), 0);
  const totalFailing = frontierKinds.reduce((sum, row) => sum + Number(row.failing || 0), 0);
  const blindspots = [...frontierKinds]
    .sort((a, b) => b.never_succeeded - a.never_succeeded || b.rows - a.rows)
    .slice(0, 3);
  const changedSnapshots = snapshots.filter(
    (row) => row.has_previous_snapshot && (row.hot_delta !== 0 || row.due_delta !== 0 || row.failure_delta !== 0 || row.changed_delta !== 0 || row.grant_delta !== 0),
  );
  const baselineSnapshots = snapshots.filter((row) => !row.has_previous_snapshot);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <Link
          href="/reports"
          className="text-xs font-black uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-black"
        >
          &larr; Reports
        </Link>
        <div className="mb-1 mt-4 text-xs font-black uppercase tracking-widest text-bauhaus-red">Grant Frontier</div>
        <h1 className="text-3xl font-black text-bauhaus-black sm:text-4xl">Grant Source Control Surface</h1>
        <p className="mt-3 max-w-4xl text-base font-medium leading-relaxed text-bauhaus-muted sm:text-lg">
          This is the live operating view for how new grants get into CivicGraph: government feeds, foundation pages, frontier queues,
          and the automation rail that decides whether the system is growing or just sitting on latent URLs.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/grants"
            className="border-2 border-bauhaus-black px-4 py-2 text-xs font-black uppercase tracking-wider text-bauhaus-black transition-colors hover:bg-bauhaus-black hover:text-white"
          >
            Open grants
          </Link>
          <Link
            href="/foundations"
            className="border-2 border-bauhaus-blue bg-bauhaus-blue px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-blue-800"
          >
            Open foundations
          </Link>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <div className="text-2xl font-black text-emerald-700 sm:text-3xl">{fmt(grantSummary.total)}</div>
          <div className="mt-1 text-xs text-gray-500">Grant rows</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-center">
          <div className="text-2xl font-black text-blue-700 sm:text-3xl">{fmt(grantSummary.future_deadline)}</div>
          <div className="mt-1 text-xs text-gray-500">Future deadlines</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
          <div className="text-2xl font-black text-amber-700 sm:text-3xl">{fmt(totalFrontierRows)}</div>
          <div className="mt-1 text-xs text-gray-500">Frontier URLs</div>
        </div>
        <div className="rounded-xl border border-bauhaus-black bg-bauhaus-black p-5 text-center text-white">
          <div className="text-2xl font-black text-bauhaus-red sm:text-3xl">{fmt(totalDueNow)}</div>
          <div className="mt-1 text-xs text-white/70">Due frontier checks</div>
        </div>
      </div>

      <section className="mb-8 rounded-sm border-4 border-bauhaus-black bg-white p-6">
        <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-red">What this tells us</div>
        <h2 className="text-2xl font-black text-bauhaus-black">Where the grant machine is strong and where it is barely switched on</h2>
        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          <div className="border-2 border-bauhaus-black/10 p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Government feed base</div>
            <div className="mt-2 text-2xl font-black text-bauhaus-black">{fmt(grantSummary.open_like)}</div>
            <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
              rows currently marked open-like. The grant table already has scale; the main gap is freshness and breadth, not raw existence.
            </p>
          </div>
          <div className="border-2 border-blue-200 bg-blue-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-blue-700">Foundation linkage</div>
            <div className="mt-2 text-2xl font-black text-bauhaus-black">{fmt(grantSummary.linked_foundation)}</div>
            <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
              grant rows already linked to a foundation, with {fmt(foundationSummary.open_programs)} open structured foundation programs sitting
              behind {fmt(foundationSummary.with_website)} foundation websites.
            </p>
          </div>
          <div className="border-2 border-amber-200 bg-amber-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-700">Untouched frontier</div>
            <div className="mt-2 text-2xl font-black text-bauhaus-black">{fmt(totalNeverSucceeded)}</div>
            <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
              frontier rows have never succeeded yet. This is the clearest answer to “what haven’t we tried?” — most of the frontier exists,
              but has barely been harvested.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-sm border-4 border-bauhaus-black bg-white p-6">
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-red">Underworked queues</div>
          <h2 className="text-2xl font-black text-bauhaus-black">What we still have barely touched</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {blindspots.map((row) => (
              <div key={row.source_kind} className="rounded-sm border-2 border-bauhaus-black/10 p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">{labelKind(row.source_kind)}</div>
                <div className="mt-2 text-2xl font-black text-bauhaus-black">{fmt(row.rows)}</div>
                <div className="mt-2 text-xs leading-relaxed text-bauhaus-muted">
                  {fmt(row.never_succeeded)} never succeeded • {fmt(row.ever_succeeded)} touched • {fmt(row.due_now)} due now
                </div>
                <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-amber-700">
                  {pct(row.never_succeeded, row.rows)} still cold
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-sm border-4 border-bauhaus-black bg-white p-6">
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-red">Foundation base</div>
          <h2 className="text-2xl font-black text-bauhaus-black">How much philanthropic surface we can still convert</h2>
          <div className="mt-5 space-y-3">
            <div className="border-2 border-bauhaus-black/10 p-4">
              <div className="text-sm font-black text-bauhaus-black">{fmt(foundationSummary.foundations)} foundations</div>
              <div className="mt-1 text-xs text-bauhaus-muted">{fmt(foundationSummary.with_giving)} with giving data</div>
            </div>
            <div className="border-2 border-bauhaus-black/10 p-4">
              <div className="text-sm font-black text-bauhaus-black">{fmt(foundationSummary.with_website)} with websites</div>
              <div className="mt-1 text-xs text-bauhaus-muted">the raw homepage pool available for frontier harvesting</div>
            </div>
            <div className="border-2 border-emerald-200 bg-emerald-50 p-4">
              <div className="text-sm font-black text-bauhaus-black">{fmt(foundationSummary.foundation_programs)} structured programs</div>
              <div className="mt-1 text-xs text-bauhaus-muted">{fmt(foundationSummary.open_programs)} currently marked open</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-sm border-4 border-bauhaus-black bg-white p-6">
        <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-red">Automation rail</div>
        <h2 className="text-2xl font-black text-bauhaus-black">Which grant discovery agents are actually live</h2>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-bauhaus-muted">
          These are the rails that decide whether the grants system keeps expanding or just sits on yesterday’s rows.
        </p>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {automations.map((row) => {
            const status = automationStatus(row);
            return (
              <div key={row.agent_id} className="border-2 border-bauhaus-black/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">{row.agent_id}</div>
                    <div className="mt-2 text-sm font-black text-bauhaus-black">
                      Every {fmt(Number(row.interval_hours || 0))}h • priority {fmt(Number(row.priority || 0))}
                    </div>
                    <div className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
                      Last run: {formatRelativeHours(row.last_run_at)}
                    </div>
                    <div className="mt-1 text-sm leading-relaxed text-bauhaus-muted">
                      Last result: {row.run_status || 'No run record yet'}
                      {row.run_completed_at ? ` • completed ${formatRelativeHours(row.run_completed_at)}` : ''}
                      {row.run_duration_ms ? ` • ${Math.round(row.run_duration_ms / 1000)}s` : ''}
                    </div>
                  </div>
                  <div className={`rounded-sm border px-3 py-2 text-[10px] font-black uppercase tracking-widest ${status.tone}`}>
                    {status.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-8 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-sm border-4 border-bauhaus-black bg-white p-6">
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-red">Source movement</div>
          <h2 className="text-2xl font-black text-bauhaus-black">
            {changedSnapshots.length > 0 ? 'Which grant source families moved most recently' : 'First grant frontier baseline'}
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-bauhaus-muted">
            This is the beginning of the same control-loop we built for youth justice: source families that are changing, getting blocked, or
            sitting cold despite being high-value.
          </p>
          <div className="mt-5 space-y-3">
            {(changedSnapshots.length > 0 ? changedSnapshots : baselineSnapshots).slice(0, 8).map((row) => (
              <div key={row.source_group} className="rounded-sm border-2 border-bauhaus-black/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">{labelSourceGroup(row.source_group)}</div>
                    <div className="mt-2 text-lg font-black text-bauhaus-black">
                      score {fmt(row.hot_score)} • {fmt(row.frontier_rows)} frontier rows
                    </div>
                    <div className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
                      {fmt(row.due_now)} due now • {fmt(row.failing)} failing • {fmt(row.changed_recent)} changed in 7d • {fmt(row.grant_rows)} grant rows
                    </div>
                    <div className="mt-1 text-xs leading-relaxed text-bauhaus-muted">
                      latest success {row.latest_success_at || 'never'} • latest content change {row.latest_change_at || 'not detected yet'}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 text-[10px] font-black uppercase tracking-widest">
                    {row.has_previous_snapshot ? (
                      <>
                        <span className="rounded-sm border border-bauhaus-black/10 bg-bauhaus-muted/5 px-2 py-1 text-bauhaus-muted">
                          hot {row.hot_delta > 0 ? '+' : ''}{fmt(row.hot_delta)}
                        </span>
                        <span className="rounded-sm border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">
                          due {row.due_delta > 0 ? '+' : ''}{fmt(row.due_delta)} • fail {row.failure_delta > 0 ? '+' : ''}{fmt(row.failure_delta)}
                        </span>
                      </>
                    ) : (
                      <span className="rounded-sm border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700">first captured snapshot</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-sm border-4 border-bauhaus-black bg-white p-6">
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-red">Blocked frontier</div>
          <h2 className="text-2xl font-black text-bauhaus-black">Which specific URLs are failing right now</h2>
          <div className="mt-5 space-y-3">
            {failures.length > 0 ? (
              failures.map((row) => (
                <div key={`${row.source_kind}-${row.target_url}`} className="rounded-sm border-2 border-bauhaus-black/10 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
                    {labelKind(row.source_kind)} • {row.discovery_source || 'unknown source'}
                  </div>
                  <div className="mt-2 text-base font-black text-bauhaus-black">{row.source_name}</div>
                  <div className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
                    HTTP {row.last_http_status || '—'} • {fmt(Number(row.failure_count || 0))} failures
                  </div>
                  <div className="mt-1 text-xs leading-relaxed text-bauhaus-muted">{row.last_error || 'No error detail recorded'}</div>
                  <a
                    href={row.target_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex text-[10px] font-black uppercase tracking-widest text-bauhaus-blue hover:underline"
                  >
                    Open failing URL &rarr;
                  </a>
                </div>
              ))
            ) : (
              <div className="rounded-sm border-2 border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-700">
                No failing frontier URLs are currently recorded.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mb-8 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-sm border-4 border-bauhaus-black bg-white p-6">
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-red">Current intake mix</div>
          <h2 className="text-2xl font-black text-bauhaus-black">Where grant rows are actually coming from</h2>
          <div className="mt-5 space-y-3">
            {grantSources.map((row) => (
              <div key={`${row.source || 'unknown'}-${row.discovery_method || 'unknown'}`} className="rounded-sm border-2 border-bauhaus-black/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-bauhaus-black">{row.source || 'unknown'}</div>
                    <div className="mt-1 text-xs text-bauhaus-muted">{row.discovery_method || 'no discovery method recorded'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-bauhaus-black">{fmt(row.rows)}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                      {fmt(row.future_deadline)} future deadline
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-sm border-4 border-bauhaus-black bg-white p-6">
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-red">Frontier pressure</div>
          <h2 className="text-2xl font-black text-bauhaus-black">What the crawler should work next</h2>
          <div className="mt-5 space-y-3">
            {frontierQueue.map((row) => (
              <div key={`${row.source_kind}-${row.target_url}`} className="rounded-sm border-2 border-bauhaus-black/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-3xl">
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">{labelKind(row.source_kind)}</div>
                    <div className="mt-2 text-base font-black text-bauhaus-black">{row.source_name}</div>
                    <div className="mt-1 text-xs leading-relaxed text-bauhaus-muted">
                      {row.discovery_source || 'unknown source'} • next check {row.next_check_at || 'not scheduled'} • last success{' '}
                      {row.last_success_at || 'never'}
                    </div>
                    <a
                      href={row.target_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-[10px] font-black uppercase tracking-widest text-bauhaus-blue hover:underline"
                    >
                      Open source URL &rarr;
                    </a>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="rounded-sm border border-bauhaus-black/10 bg-bauhaus-muted/5 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                      priority {fmt(Number(row.priority || 0))}
                    </span>
                    <span className="rounded-sm border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                      {fmt(Number(row.failure_count || 0))} failures
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-sm border-4 border-bauhaus-black bg-white p-6">
        <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-red">High-value uncovered funders</div>
        <h2 className="text-2xl font-black text-bauhaus-black">Which long-tail funders still have zero structured programs</h2>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-bauhaus-muted">
          This is the cleanest national expansion queue right now: funders with websites, money, and likely program surfaces, but no structured
          program rows yet. The frontier now seeds extra candidate paths for this set.
        </p>
        <div className="mt-5 grid gap-3 xl:grid-cols-2">
          {longTailFounders.map((row) => (
            <div key={row.id} className="rounded-sm border-2 border-bauhaus-black/10 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-3xl">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">{row.type || 'unknown type'}</div>
                  <div className="mt-2 text-base font-black text-bauhaus-black">{row.name}</div>
                  <div className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
                    {row.total_giving_annual ? `${fmt(Number(row.total_giving_annual))}/yr giving` : 'giving not recorded'} • {fmt(row.frontier_rows)} frontier rows • {fmt(row.program_count)} structured programs
                  </div>
                </div>
                {row.website ? (
                  <a
                    href={row.website.startsWith('http') ? row.website : `https://${row.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-sm border border-bauhaus-blue bg-blue-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue hover:underline"
                  >
                    Open website
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-sm border-4 border-bauhaus-black bg-white p-6">
        <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-red">Long-tail discovery hits</div>
        <h2 className="text-2xl font-black text-bauhaus-black">What the new long-tail rail has already turned into structured programs</h2>
        <div className="mt-5 space-y-3">
          {longTailDiscoveries.length > 0 ? (
            longTailDiscoveries.map((row) => (
              <div key={`${row.foundation_name}-${row.program_name}-${row.scraped_at || 'none'}`} className="rounded-sm border-2 border-bauhaus-black/10 p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">{row.type || 'unknown type'}</div>
                <div className="mt-2 text-base font-black text-bauhaus-black">{row.program_name}</div>
                <div className="mt-1 text-sm leading-relaxed text-bauhaus-muted">
                  {row.foundation_name} • scraped {row.scraped_at || 'unknown'}
                </div>
                {row.url ? (
                  <a
                    href={row.url.startsWith('http') ? row.url : `https://${row.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex text-[10px] font-black uppercase tracking-widest text-bauhaus-blue hover:underline"
                  >
                    Open program URL &rarr;
                  </a>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-sm border-2 border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
              No structured programs from the long-tail rail yet. The discovery agent is now targeted at this queue; this panel will start to fill as those runs land.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
