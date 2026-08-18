import { unstable_cache } from 'next/cache';
import Link from 'next/link';
import { getLiveReportSupabase } from '@/lib/report-supabase';
import { safe } from '@/lib/services/utils';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: "What's changing — CivicGraph",
  description: 'Live data feed from across the platform. Latest watchhouse snapshot, recent ingestion runs, new reports, recent feedback. Refreshed every five minutes.',
};

type AgentRun = { agent_id: string; agent_name: string | null; status: string; items_found: number | null; items_new: number | null; duration_ms: number | null; started_at: string };
type ChangesWatchhouse = {
  source_generated_at: string;
  total_people: number;
  total_adults: number;
  total_children: number;
  child_first_nations: number;
  child_over_7_days: number;
};
type ImpactReport = { abn: string; charity_name: string; report_year: number; created_at: string };
type FeedbackSummary = { c: number; with_signals: number; latest: string | null };
type SubmissionSummary = { c: number; latest: string | null };

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.floor((now - t) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

async function getChanges() {
  const supabase = getLiveReportSupabase();
  const [agentRuns, watchhouse, recentReports, feedbackSummary, submissionSummary, totals] = await Promise.all([
    safe(supabase.rpc('exec_sql', {
      query: `SELECT agent_id, agent_name, status, items_found, items_new, duration_ms, started_at::text
              FROM public.agent_runs
              WHERE started_at > NOW() - INTERVAL '7 days'
              ORDER BY started_at DESC LIMIT 30`,
    })) as Promise<AgentRun[] | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT source_generated_at::text, total_people, total_adults, total_children,
                     child_first_nations, child_over_7_days
              FROM public.v_qld_watchhouse_latest LIMIT 1`,
    })) as Promise<ChangesWatchhouse[] | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT abn, charity_name, report_year, created_at::text
              FROM public.charity_impact_reports
              WHERE created_at > NOW() - INTERVAL '30 days'
              ORDER BY created_at DESC LIMIT 10`,
    })) as Promise<ImpactReport[] | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT count(*)::int AS c,
                     COUNT(*) FILTER (WHERE value_signals IS NOT NULL)::int AS with_signals,
                     MAX(submitted_at)::text AS latest
              FROM public.report_feedback
              WHERE submitted_at > NOW() - INTERVAL '30 days'`,
    })) as Promise<FeedbackSummary[] | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT count(*)::int AS c, MAX(submitted_at)::text AS latest
              FROM public.report_submissions
              WHERE submitted_at > NOW() - INTERVAL '30 days'`,
    })) as Promise<SubmissionSummary[] | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT
                (SELECT count(*) FROM public.gs_entities)::bigint AS entities,
                (SELECT count(*) FROM public.austender_contracts)::bigint AS contracts,
                (SELECT count(*) FROM public.justice_funding)::bigint AS justice_grants,
                (SELECT count(*) FROM public.vic_grants_awarded)::bigint AS vic_grants,
                (SELECT count(*) FROM public.acnc_charities)::bigint AS charities,
                (SELECT count(*) FROM public.foundations)::bigint AS foundations,
                (SELECT count(*) FROM public.alma_interventions)::bigint AS alma_interventions`,
    })) as Promise<Array<{ entities: number; contracts: number; justice_grants: number; vic_grants: number; charities: number; foundations: number; alma_interventions: number }> | null>,
  ]);

  return {
    agentRuns: agentRuns ?? [],
    watchhouse: watchhouse?.[0] || null,
    recentReports: recentReports ?? [],
    feedback: feedbackSummary?.[0] || { c: 0, with_signals: 0, latest: null },
    submissions: submissionSummary?.[0] || { c: 0, latest: null },
    totals: totals?.[0] || null,
  };
}

/** Cost + pooler load: this page ran six queries on every request. Five minutes, not the hour
 *  used elsewhere, because this screen's whole job is to show what just changed — and the copy
 *  below says so, so the window has to stay short enough for that to remain true. */
const getChangesCached = unstable_cache(getChanges, ['changes-feed'], { revalidate: 300 });

export default async function ChangesPage() {
  const r = await getChangesCached();
  const ws = r.watchhouse;
  const fnPctChild = ws && ws.total_children > 0 ? Math.round((ws.child_first_nations / ws.total_children) * 100) : 0;

  const successRuns = r.agentRuns.filter(a => a.status === 'success');
  const totalIngestNew = successRuns.reduce((s, a) => s + (a.items_new || 0), 0);
  const lastSuccessRun = successRuns[0];

  const fmtMs = (ms: number | null) => ms == null ? '—' : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;

  return (
    <div>
      <div className="mb-10">
        <Link href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">← Reports</Link>
        <div className="text-xs font-black text-bauhaus-yellow mt-4 mb-1 uppercase tracking-widest">Live Data Feed</div>
        <h1 className="text-4xl sm:text-5xl font-black text-bauhaus-black mb-3 uppercase tracking-tight leading-tight">
          What&apos;s changing on CivicGraph
        </h1>
        <p className="text-xl text-bauhaus-muted leading-tight font-medium max-w-3xl">
          Live activity from across the platform. Watchhouse refreshes, ingestion runs, new reports, recent feedback. Refreshed every five minutes.
        </p>
      </div>

      {/* Platform stats */}
      {r.totals && (
        <section className="mb-12">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-3">Currently in CivicGraph</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Entities', n: r.totals.entities },
              { label: 'Charities', n: r.totals.charities },
              { label: 'Foundations', n: r.totals.foundations },
              { label: 'Federal contracts', n: r.totals.contracts },
              { label: 'Justice grants', n: r.totals.justice_grants },
              { label: 'VIC grants', n: r.totals.vic_grants },
              { label: 'ALMA programs', n: r.totals.alma_interventions },
            ].map((s, i) => (
              <div key={i} className="border-4 border-bauhaus-black p-3 bg-white">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{s.label}</div>
                <div className="text-xl font-black text-bauhaus-black tabular-nums">{Number(s.n).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Watchhouse — the live signal */}
      {ws && (
        <section className="mb-12 border-4 border-bauhaus-red p-6 bg-white">
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-1">Live · QLD watchhouse occupancy</div>
              <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight">In QLD watchhouses, right now</h2>
            </div>
            <div className="text-xs font-mono text-bauhaus-muted">
              Refreshed {timeAgo(ws.source_generated_at)} · auto every 12h
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest font-black text-bauhaus-muted">In custody</div>
              <div className="text-3xl font-black text-bauhaus-black tabular-nums">{ws.total_people}</div>
              <div className="text-xs font-mono text-bauhaus-muted">{ws.total_adults} adults · {ws.total_children} children</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest font-black text-bauhaus-red">Children</div>
              <div className="text-3xl font-black text-bauhaus-red tabular-nums">{ws.total_children}</div>
              <div className="text-xs font-mono text-bauhaus-muted">{ws.child_first_nations} First Nations ({fnPctChild}%)</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest font-black text-bauhaus-muted">Children &gt; 7 days</div>
              <div className="text-3xl font-black text-bauhaus-black tabular-nums">{ws.child_over_7_days}</div>
              <div className="text-xs font-mono text-bauhaus-muted">in adult cells</div>
            </div>
            <div className="flex items-end">
              <Link href="/share/qld-youth-justice" className="block w-full text-center px-4 py-3 text-xs font-black uppercase tracking-widest bg-bauhaus-black text-white border-2 border-bauhaus-black hover:bg-bauhaus-red">
                Read the report →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Activity grid: ingestion + reports + community signals */}
      <div className="grid lg:grid-cols-3 gap-6 mb-12">
        {/* Pipeline activity */}
        <section className="border-4 border-bauhaus-black p-5 bg-white">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-3">Pipeline · last 7 days</div>
          <h3 className="text-lg font-black text-bauhaus-black uppercase tracking-tight mb-3">Data ingestion</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-bauhaus-muted">Successful runs</span>
              <span className="font-black tabular-nums">{successRuns.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-bauhaus-muted">New items ingested</span>
              <span className="font-black tabular-nums">{totalIngestNew.toLocaleString()}</span>
            </div>
            {lastSuccessRun && (
              <div className="flex justify-between">
                <span className="text-bauhaus-muted">Last run</span>
                <span className="font-black">{timeAgo(lastSuccessRun.started_at)}</span>
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t-2 border-bauhaus-black space-y-1.5 text-[11px] font-mono">
            {r.agentRuns.slice(0, 8).map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className={`${a.status === 'success' ? 'text-bauhaus-blue' : a.status === 'running' ? 'text-bauhaus-yellow' : 'text-bauhaus-red'} font-black uppercase tracking-widest text-[9px] shrink-0`}>{a.status === 'success' ? '✓' : a.status === 'running' ? '~' : '!'}</span>
                <span className="truncate flex-1">{a.agent_id}</span>
                <span className="text-bauhaus-muted shrink-0">{a.items_new ? `+${a.items_new}` : ''}{a.items_new && a.duration_ms ? ' · ' : ''}{fmtMs(a.duration_ms)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Recent published reports */}
        <section className="border-4 border-bauhaus-black p-5 bg-white">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-3">Reports · last 30 days</div>
          <h3 className="text-lg font-black text-bauhaus-black uppercase tracking-tight mb-3">Published / updated</h3>
          <div className="space-y-3">
            <div className="border-2 border-bauhaus-red p-3 bg-bauhaus-canvas">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">★ Featured</div>
              <Link href="/share/qld-youth-justice" className="font-black text-bauhaus-black uppercase tracking-tight text-sm leading-tight block hover:underline">QLD Youth Justice — Money, Children, Evidence</Link>
              <div className="text-[10px] font-mono text-bauhaus-muted mt-1">Live data · refreshes 12h</div>
            </div>
            <div className="border-2 border-bauhaus-yellow p-3 bg-bauhaus-canvas">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Worked example</div>
              <Link href="/share/fecca-eccv" className="font-black text-bauhaus-black uppercase tracking-tight text-sm leading-tight block hover:underline">FECCA &amp; ECCV — Federation&apos;s Money Map</Link>
              <div className="text-[10px] font-mono text-bauhaus-muted mt-1">Updated this week</div>
            </div>
            {r.recentReports.length > 0 && (
              <div className="text-[10px] font-mono text-bauhaus-muted pt-2">
                + {r.recentReports.length} charity-impact reports re-enriched in last 30 days
              </div>
            )}
          </div>
        </section>

        {/* Community signals */}
        <section className="border-4 border-bauhaus-black p-5 bg-white">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-3">Community · last 30 days</div>
          <h3 className="text-lg font-black text-bauhaus-black uppercase tracking-tight mb-3">Inbound signals</h3>
          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between items-baseline">
                <span className="text-bauhaus-muted uppercase tracking-widest text-[10px] font-black">Feedback</span>
                <span className="text-2xl font-black text-bauhaus-black tabular-nums">{r.feedback.c}</span>
              </div>
              <div className="font-mono text-[10px] text-bauhaus-muted">
                {r.feedback.with_signals} with structured signals · last {r.feedback.latest ? timeAgo(r.feedback.latest) : '—'}
              </div>
            </div>
            <div>
              <div className="flex justify-between items-baseline">
                <span className="text-bauhaus-muted uppercase tracking-widest text-[10px] font-black">Report requests</span>
                <span className="text-2xl font-black text-bauhaus-black tabular-nums">{r.submissions.c}</span>
              </div>
              <div className="font-mono text-[10px] text-bauhaus-muted">
                {r.submissions.latest ? `last ${timeAgo(r.submissions.latest)}` : 'none yet'}
              </div>
            </div>
            <div className="pt-3 border-t-2 border-bauhaus-black space-y-2">
              <Link href="/feedback?subject=changes-page" className="block px-3 py-2 text-[11px] font-black uppercase tracking-widest bg-bauhaus-yellow text-bauhaus-black border-2 border-bauhaus-black hover:bg-bauhaus-canvas text-center">
                ★ Send feedback
              </Link>
              <Link href="/get-a-report?free=true&src=changes" className="block px-3 py-2 text-[11px] font-black uppercase tracking-widest bg-bauhaus-black text-white border-2 border-bauhaus-black hover:bg-bauhaus-red text-center">
                Request a report →
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* What's running explanation */}
      <section className="border-4 border-bauhaus-black p-6 bg-bauhaus-canvas mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-tight mb-3">What&apos;s running behind this?</h2>
        <p className="text-sm text-bauhaus-black font-medium leading-relaxed mb-3 max-w-3xl">
          CivicGraph runs ~30 ingestion + monitoring agents on schedule across ABR, ACNC, Austender, state-budget PDFs, ATO transparency, ALMA evidence, foundation grants, lobbyist registers, and the QPS watchhouse occupancy publication. When something material moves, the underlying data feeding our reports moves with it.
        </p>
        <p className="text-sm text-bauhaus-black font-medium leading-relaxed max-w-3xl">
          The dashboards above pull live from the same database used by every published report. If a number changes here, it&apos;s changed in the underlying analysis too.
        </p>
      </section>

      <section className="text-center mb-8">
        <p className="text-xs font-mono text-bauhaus-muted">CivicGraph · {new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC</p>
      </section>
    </div>
  );
}
