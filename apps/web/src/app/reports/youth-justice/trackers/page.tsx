import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/services/utils';
import { fmt } from '@/lib/services/report-service';
import { slugifySegment, TRACKER_STATE_META, sentenceCaseTracker } from '../tracker-meta';

export const revalidate = 3600;

type JurisdictionRow = {
  jurisdiction: string;
  tracker_count: number;
  event_count: number;
  mirrored_count: number;
  gap_count: number;
  latest_event_date: string | null;
};

type TrackerRow = {
  jurisdiction: string;
  tracker_key: string;
  event_count: number;
  official_count: number;
  mirrored_count: number;
  gap_count: number;
  latest_event_date: string | null;
  first_title: string | null;
  first_summary: string | null;
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

type SiteChangeRow = {
  jurisdiction: string;
  site_name: string;
  hot_score: number;
  hot_delta: number;
  tracker_count: number;
  mirrored_count: number;
  gap_count: number;
  mirrored_delta: number;
  gap_delta: number;
  latest_event_date: string | null;
  has_previous_snapshot: boolean;
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

async function getData() {
  const supabase = getServiceSupabase();
  const jurisdictionsQuery = `
    SELECT
      jurisdiction,
      COUNT(DISTINCT tracker_key)::int AS tracker_count,
      COUNT(*)::int AS event_count,
      COUNT(*) FILTER (WHERE mirror_status = 'mirrored')::int AS mirrored_count,
      COUNT(*) FILTER (WHERE mirror_status IN ('missing_from_mirror', 'external_only'))::int AS gap_count,
      MAX(event_date)::text AS latest_event_date
    FROM tracker_evidence_events
    WHERE domain = 'youth-justice'
    GROUP BY jurisdiction
    ORDER BY jurisdiction
  `;
  const trackersQuery = `
    WITH scoped AS (
      SELECT *
      FROM tracker_evidence_events
      WHERE domain = 'youth-justice'
    ),
    ranked AS (
      SELECT
        jurisdiction,
        tracker_key,
        title,
        summary,
        ROW_NUMBER() OVER (
          PARTITION BY jurisdiction, tracker_key
          ORDER BY event_date ASC, created_at ASC
        ) AS rn
      FROM scoped
    ),
    first_ranked AS (
      SELECT jurisdiction, tracker_key, title, summary
      FROM ranked
      WHERE rn = 1
    ),
    aggregated AS (
      SELECT
        jurisdiction,
        tracker_key,
        COUNT(*)::int AS event_count,
        COUNT(*) FILTER (WHERE evidence_strength = 'official')::int AS official_count,
        COUNT(*) FILTER (WHERE mirror_status = 'mirrored')::int AS mirrored_count,
        COUNT(*) FILTER (WHERE mirror_status IN ('missing_from_mirror', 'external_only'))::int AS gap_count,
        MAX(event_date)::text AS latest_event_date
      FROM scoped
      GROUP BY jurisdiction, tracker_key
    )
    SELECT
      a.jurisdiction,
      a.tracker_key,
      a.event_count,
      a.official_count,
      a.mirrored_count,
      a.gap_count,
      a.latest_event_date,
      f.title AS first_title,
      f.summary AS first_summary
    FROM aggregated a
    LEFT JOIN first_ranked f
      ON f.jurisdiction = a.jurisdiction
     AND f.tracker_key = a.tracker_key
    ORDER BY a.jurisdiction, a.latest_event_date DESC NULLS LAST, a.tracker_key
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
        'scrape-qgip-grants',
        'scrape-qld-hansard',
        'scrape-qld-yj-contracts',
        'refresh-youth-justice-trackers'
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
    FROM agent_schedules
    LEFT JOIN latest_runs r
      ON r.agent_id = s.agent_id
     AND r.rn = 1
    WHERE s.agent_id IN (
      'scrape-qgip-grants',
      'scrape-qld-hansard',
      'scrape-qld-yj-contracts',
      'refresh-youth-justice-trackers'
    )
    ORDER BY s.priority, s.agent_id
  `;
  const siteChangeQuery = `
    WITH latest_refresh AS (
      SELECT id
      FROM agent_runs
      WHERE agent_id = 'refresh-youth-justice-trackers'
        AND status IN ('success', 'partial')
      ORDER BY started_at DESC
      LIMIT 1
    )
    SELECT
      jurisdiction,
      site_name,
      hot_score,
      hot_delta,
      tracker_count,
      mirrored_count,
      gap_count,
      mirrored_delta,
      gap_delta,
      latest_event_date::text AS latest_event_date,
      has_previous_snapshot
    FROM tracker_site_snapshots
    WHERE run_id = (SELECT id FROM latest_refresh)
    ORDER BY
      CASE
        WHEN has_previous_snapshot AND (hot_delta <> 0 OR mirrored_delta <> 0 OR gap_delta <> 0) THEN 0
        ELSE 1
      END,
      ABS(hot_delta) DESC,
      gap_delta DESC,
      mirrored_delta DESC,
      hot_score DESC,
      site_name
    LIMIT 8
  `;

  const [jurisdictions, trackers, automations, siteChanges] = await Promise.all([
    safe<JurisdictionRow[] | null>(
      supabase.rpc('exec_sql', { query: jurisdictionsQuery }) as PromiseLike<{ data: JurisdictionRow[] | null; error: unknown }>,
      'youth justice tracker portfolio jurisdictions',
    ),
    safe<TrackerRow[] | null>(
      supabase.rpc('exec_sql', { query: trackersQuery }) as PromiseLike<{ data: TrackerRow[] | null; error: unknown }>,
      'youth justice tracker portfolio trackers',
    ),
    safe<AutomationRow[] | null>(
      supabase.rpc('exec_sql', { query: automationQuery }) as PromiseLike<{ data: AutomationRow[] | null; error: unknown }>,
      'youth justice tracker portfolio automations',
    ),
    safe<SiteChangeRow[] | null>(
      supabase.rpc('exec_sql', { query: siteChangeQuery }) as PromiseLike<{ data: SiteChangeRow[] | null; error: unknown }>,
      'youth justice tracker portfolio site changes',
    ),
  ]);

  return {
    jurisdictions: jurisdictions ?? [],
    trackers: trackers ?? [],
    automations: automations ?? [],
    siteChanges: siteChanges ?? [],
  };
}

export default async function YouthJusticeTrackerPortfolioPage() {
  const { jurisdictions, trackers, automations, siteChanges } = await getData();
  const trackerCount = trackers.length;
  const eventCount = jurisdictions.reduce((sum, row) => sum + Number(row.event_count || 0), 0);
  const mirroredCount = jurisdictions.reduce((sum, row) => sum + Number(row.mirrored_count || 0), 0);
  const gapCount = jurisdictions.reduce((sum, row) => sum + Number(row.gap_count || 0), 0);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <Link
          href="/reports/youth-justice"
          className="text-xs font-black uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-black"
        >
          &larr; Youth Justice
        </Link>
        <div className="mb-1 mt-4 text-xs font-black uppercase tracking-widest text-bauhaus-red">Tracker Portfolio</div>
        <h1 className="text-3xl font-black text-bauhaus-black sm:text-4xl">Youth Justice Accountability Portfolio</h1>
        <p className="mt-3 max-w-4xl text-base font-medium leading-relaxed text-bauhaus-muted sm:text-lg">
          One national surface for structured investigation chains. Every tracker below is sourced from <code>tracker_evidence_events</code>,
          so new manifests land here automatically after refresh.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <div className="text-2xl font-black text-emerald-700 sm:text-3xl">{fmt(jurisdictions.length)}</div>
          <div className="mt-1 text-xs text-gray-500">Active jurisdictions</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-center">
          <div className="text-2xl font-black text-blue-700 sm:text-3xl">{fmt(trackerCount)}</div>
          <div className="mt-1 text-xs text-gray-500">Registered trackers</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
          <div className="text-2xl font-black text-amber-700 sm:text-3xl">{fmt(eventCount)}</div>
          <div className="mt-1 text-xs text-gray-500">Evidence events</div>
        </div>
        <div className="rounded-xl border border-bauhaus-black bg-bauhaus-black p-5 text-center text-white">
          <div className="text-2xl font-black text-bauhaus-red sm:text-3xl">{fmt(mirroredCount)}</div>
          <div className="mt-1 text-xs text-white/70">Mirrored rows</div>
        </div>
      </div>

      <section className="mb-10 grid gap-4 xl:grid-cols-2">
        {jurisdictions.map((row) => {
          const stateKey = row.jurisdiction.toLowerCase();
          const state = TRACKER_STATE_META[stateKey];
          const stateTrackers = trackers.filter((tracker) => tracker.jurisdiction === row.jurisdiction);
          return (
            <div key={row.jurisdiction} className="rounded-sm border-4 border-bauhaus-black bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">{row.jurisdiction}</div>
                  <h2 className="mt-2 text-2xl font-black text-bauhaus-black">{state?.name || row.jurisdiction}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
                    {fmt(row.tracker_count)} tracker{row.tracker_count === 1 ? '' : 's'} • {fmt(row.event_count)} evidence events •{' '}
                    {fmt(row.gap_count)} public / mirror gaps still open.
                  </p>
                </div>
                <Link
                  href={`/reports/youth-justice/${stateKey}/trackers`}
                  className="border-2 border-bauhaus-black px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-black transition-colors hover:bg-bauhaus-black hover:text-white"
                >
                  Open {row.jurisdiction}
                </Link>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="border-2 border-blue-200 bg-blue-50 p-3 text-center">
                  <div className="text-lg font-black text-blue-700">{fmt(row.event_count)}</div>
                  <div className="text-[10px] uppercase tracking-widest text-blue-700">Events</div>
                </div>
                <div className="border-2 border-emerald-200 bg-emerald-50 p-3 text-center">
                  <div className="text-lg font-black text-emerald-700">{fmt(row.mirrored_count)}</div>
                  <div className="text-[10px] uppercase tracking-widest text-emerald-700">Mirrored</div>
                </div>
                <div className="border-2 border-amber-200 bg-amber-50 p-3 text-center">
                  <div className="text-lg font-black text-amber-700">{fmt(row.gap_count)}</div>
                  <div className="text-[10px] uppercase tracking-widest text-amber-700">Gaps</div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {stateTrackers.map((tracker) => (
                  <Link
                    key={`${tracker.jurisdiction}-${tracker.tracker_key}`}
                    href={`/reports/youth-justice/${stateKey}/trackers/${tracker.tracker_key}`}
                    className="block border-2 border-bauhaus-black/10 p-4 transition-transform hover:-translate-y-0.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="max-w-2xl">
                        <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                          {sentenceCaseTracker(tracker.tracker_key)}
                        </div>
                        <h3 className="mt-1 text-lg font-black text-bauhaus-black">
                          {tracker.first_title || sentenceCaseTracker(tracker.tracker_key)}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
                          {tracker.first_summary || 'Structured accountability chain ready.'}
                        </p>
                      </div>
                      <div className="grid min-w-[180px] grid-cols-2 gap-2 text-right">
                        <div className="border border-bauhaus-black/10 p-2">
                          <div className="text-[10px] uppercase tracking-widest text-bauhaus-muted">Events</div>
                          <div className="text-lg font-black text-bauhaus-black">{fmt(tracker.event_count)}</div>
                        </div>
                        <div className="border border-bauhaus-black/10 p-2">
                          <div className="text-[10px] uppercase tracking-widest text-bauhaus-muted">Latest</div>
                          <div className="text-xs font-black text-bauhaus-black">{tracker.latest_event_date || '—'}</div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-sm border-4 border-bauhaus-black bg-white p-6">
        <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Portfolio readout</div>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <div className="border-2 border-bauhaus-black/10 p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Mirrored rows</div>
            <div className="mt-2 text-2xl font-black text-bauhaus-black">{fmt(mirroredCount)}</div>
            <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">Rows already backed by local funding or procurement mirrors.</p>
          </div>
          <div className="border-2 border-bauhaus-black/10 p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Open gaps</div>
            <div className="mt-2 text-2xl font-black text-bauhaus-red">{fmt(gapCount)}</div>
            <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
              Places where public promise or official evidence exists but the local mirror is still thin.
            </p>
          </div>
          <div className="border-2 border-bauhaus-black/10 p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Refresh command</div>
            <div className="mt-2 text-sm font-black text-bauhaus-black">npm run tracker:refresh:portfolio</div>
            <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
              Refreshes the full youth justice tracker portfolio across all configured jurisdictions.
            </p>
          </div>
        </div>

        <div className="mt-6 border-t-2 border-bauhaus-black/10 pt-6">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red">Automation rail</div>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-bauhaus-muted">
            These are the scheduled source-chain jobs feeding the tracker portfolio. QGIP and QLD contract disclosure are now registered in
            live mode, and the tracker refresh step is now a single chained runner rather than a loose priority-based hop.
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

          {siteChanges.length > 0 ? (
            <div className="mt-6 border-t-2 border-bauhaus-black/10 pt-6">
              <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red">Latest site movement</div>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-bauhaus-muted">
                These rows are captured during the latest full source-chain refresh. They show which sites got hotter, gained mirrored
                evidence, or opened new gaps compared with the previous snapshot.
              </p>
              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                {siteChanges.map((row) => {
                  const stateKey = row.jurisdiction.toLowerCase();
                  const title =
                    row.has_previous_snapshot && (row.hot_delta !== 0 || row.mirrored_delta !== 0 || row.gap_delta !== 0)
                      ? 'Changed since last run'
                      : 'Current hot baseline';
                  return (
                    <div key={`${row.jurisdiction}-${row.site_name}`} className="border-2 border-bauhaus-black/10 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">{title}</div>
                          <div className="mt-2 text-lg font-black text-bauhaus-black">
                            {row.site_name} <span className="text-bauhaus-muted">({row.jurisdiction})</span>
                          </div>
                          <div className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
                            Score {fmt(Number(row.hot_score || 0))} • {fmt(Number(row.tracker_count || 0))} tracker
                            {Number(row.tracker_count || 0) === 1 ? '' : 's'} • {fmt(Number(row.mirrored_count || 0))} mirrored •{' '}
                            {fmt(Number(row.gap_count || 0))} gaps
                          </div>
                          <div className="mt-1 text-sm leading-relaxed text-bauhaus-muted">
                            {row.has_previous_snapshot ? (
                              <>
                                hot {row.hot_delta > 0 ? '+' : ''}
                                {fmt(Number(row.hot_delta || 0))} • mirrored {row.mirrored_delta > 0 ? '+' : ''}
                                {fmt(Number(row.mirrored_delta || 0))} • gaps {row.gap_delta > 0 ? '+' : ''}
                                {fmt(Number(row.gap_delta || 0))}
                              </>
                            ) : (
                              <>first captured snapshot • latest {row.latest_event_date || '—'}</>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/reports/youth-justice/${stateKey}/sites/${slugifySegment(row.site_name)}`}
                            className="border-2 border-bauhaus-black px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-black transition-colors hover:bg-bauhaus-black hover:text-white"
                          >
                            Open dossier
                          </Link>
                          <Link
                            href={`/reports/youth-justice/${stateKey}/sites/${slugifySegment(row.site_name)}/brief`}
                            className="border-2 border-bauhaus-blue bg-bauhaus-blue px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-blue-800"
                          >
                            Download brief
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
