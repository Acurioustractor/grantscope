import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/services/utils';
import { fmt } from '@/lib/services/report-service';

export const revalidate = 3600;

type TrackerSummaryRow = {
  tracker_key: string;
  event_count: number;
  official_count: number;
  mirrored_count: number;
  gap_count: number;
  latest_event_date: string | null;
  first_title: string | null;
  first_summary: string | null;
};

function titleFromKey(key: string) {
  return key.replaceAll('-', ' ');
}

function sentenceCase(value: string) {
  const text = titleFromKey(value);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

async function getData() {
  const supabase = getServiceSupabase();
  const query = `
    WITH scoped AS (
      SELECT *
      FROM tracker_evidence_events
      WHERE domain = 'youth-justice'
        AND jurisdiction = 'QLD'
    ),
    ranked AS (
      SELECT
        tracker_key,
        title,
        summary,
        ROW_NUMBER() OVER (
          PARTITION BY tracker_key
          ORDER BY event_date ASC, created_at ASC
        ) AS rn
      FROM scoped
    ),
    first_ranked AS (
      SELECT tracker_key, title, summary
      FROM ranked
      WHERE rn = 1
    ),
    aggregated AS (
      SELECT
        tracker_key,
        COUNT(*)::int AS event_count,
        COUNT(*) FILTER (WHERE evidence_strength = 'official')::int AS official_count,
        COUNT(*) FILTER (WHERE mirror_status = 'mirrored')::int AS mirrored_count,
        COUNT(*) FILTER (
          WHERE mirror_status IN ('missing_from_mirror', 'external_only')
        )::int AS gap_count,
        MAX(event_date)::text AS latest_event_date
      FROM scoped
      GROUP BY tracker_key
    )
    SELECT
      a.tracker_key,
      a.event_count,
      a.official_count,
      a.mirrored_count,
      a.gap_count,
      a.latest_event_date,
      f.title AS first_title,
      f.summary AS first_summary
    FROM aggregated a
    LEFT JOIN first_ranked f ON f.tracker_key = a.tracker_key
    ORDER BY a.latest_event_date DESC NULLS LAST, a.tracker_key
  `;
  const result = await safe<TrackerSummaryRow[] | null>(
    supabase.rpc('exec_sql', { query }) as PromiseLike<{ data: TrackerSummaryRow[] | null; error: unknown }>,
    'qld tracker index',
  );
  return result ?? [];
}

export default async function QldYouthJusticeTrackersIndexPage() {
  const trackers = await getData();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <Link
          href="/reports/youth-justice/qld"
          className="text-xs font-black uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-black"
        >
          &larr; Queensland Youth Justice
        </Link>
        <div className="mb-1 mt-4 text-xs font-black uppercase tracking-widest text-bauhaus-red">Tracker Registry</div>
        <h1 className="text-3xl font-black text-bauhaus-black sm:text-4xl">QLD Youth Justice Accountability Trackers</h1>
        <p className="mt-3 max-w-4xl text-base font-medium leading-relaxed text-bauhaus-muted sm:text-lg">
          Generic tracker surfaces backed by <code>tracker_evidence_events</code>. Add a new tracker manifest and sync it, and it
          appears here automatically without another custom page.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <div className="text-2xl font-black text-emerald-700 sm:text-3xl">{fmt(trackers.length)}</div>
          <div className="mt-1 text-xs text-gray-500">Trackers registered</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-center">
          <div className="text-2xl font-black text-blue-700 sm:text-3xl">
            {fmt(trackers.reduce((sum, row) => sum + Number(row.event_count || 0), 0))}
          </div>
          <div className="mt-1 text-xs text-gray-500">Evidence events</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
          <div className="text-2xl font-black text-amber-700 sm:text-3xl">
            {fmt(trackers.reduce((sum, row) => sum + Number(row.gap_count || 0), 0))}
          </div>
          <div className="mt-1 text-xs text-gray-500">Mirror / visibility gaps</div>
        </div>
        <div className="rounded-xl border border-bauhaus-black bg-bauhaus-black p-5 text-center text-white">
          <div className="text-2xl font-black text-bauhaus-red sm:text-3xl">
            {fmt(trackers.reduce((sum, row) => sum + Number(row.mirrored_count || 0), 0))}
          </div>
          <div className="mt-1 text-xs text-white/70">Mirrored evidence rows</div>
        </div>
      </div>

      <div className="space-y-4">
        {trackers.map((tracker) => (
          <Link
            key={tracker.tracker_key}
            href={`/reports/youth-justice/qld/trackers/${tracker.tracker_key}`}
            className="group block rounded-sm border-4 border-bauhaus-black bg-white p-6 transition-transform hover:-translate-y-1"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
                  {sentenceCase(tracker.tracker_key)}
                </div>
                <h2 className="mt-2 text-2xl font-black text-bauhaus-black">
                  {tracker.first_title || sentenceCase(tracker.tracker_key)}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-bauhaus-muted">
                  {tracker.first_summary || 'Structured evidence chain ready for investigation.'}
                </p>
              </div>
              <div className="grid min-w-[240px] grid-cols-2 gap-3 text-right">
                <div className="border-2 border-bauhaus-black/10 p-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Events</div>
                  <div className="mt-1 text-xl font-black text-bauhaus-black">{fmt(tracker.event_count)}</div>
                </div>
                <div className="border-2 border-bauhaus-black/10 p-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Latest</div>
                  <div className="mt-1 text-sm font-black text-bauhaus-black">{tracker.latest_event_date || '—'}</div>
                </div>
                <div className="border-2 border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Official</div>
                  <div className="mt-1 text-xl font-black text-emerald-700">{fmt(tracker.official_count)}</div>
                </div>
                <div className="border-2 border-amber-200 bg-amber-50 p-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-amber-700">Gaps</div>
                  <div className="mt-1 text-xl font-black text-amber-700">{fmt(tracker.gap_count)}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 inline-flex text-xs font-black uppercase tracking-widest text-bauhaus-blue group-hover:underline">
              Open tracker &rarr;
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
