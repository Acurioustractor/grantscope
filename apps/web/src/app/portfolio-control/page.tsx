import { redirect } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Portfolio Control — CivicGraph',
  description: 'Weekly operating cockpit across Goods, procurement, grants/foundations, trust, and sidecar lanes.',
};

type SqlRow = Record<string, string | number | boolean | null>;

function toNumber(value: string | number | boolean | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function runRow(query: string): Promise<SqlRow | null> {
  const db = getServiceSupabase();
  const { data, error } = await db.rpc('exec_sql', { query });
  if (error) {
    console.error('[portfolio-control] query failed', { query, error: error.message });
    return null;
  }
  if (!Array.isArray(data) || data.length === 0) return null;
  return (data[0] as SqlRow) || null;
}

async function runCount(query: string, column = 'count'): Promise<number | null> {
  const row = await runRow(query);
  if (!row) return null;
  return toNumber(row[column] ?? null);
}

function formatInt(value: number | null): string {
  if (value === null) return '—';
  return value.toLocaleString('en-AU');
}

function formatPct(value: number | null, digits = 1): string {
  if (value === null || Number.isNaN(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

function statusTone(level: 'good' | 'watch' | 'risk') {
  if (level === 'good') {
    return 'bg-green-100 text-green-900 border-green-300';
  }
  if (level === 'watch') {
    return 'bg-yellow-100 text-yellow-900 border-yellow-300';
  }
  return 'bg-red-100 text-red-900 border-red-300';
}

function metricStatus(value: number | null, goodAt: number, watchAt: number): 'good' | 'watch' | 'risk' {
  if (value === null) return 'watch';
  if (value >= goodAt) return 'good';
  if (value >= watchAt) return 'watch';
  return 'risk';
}

export default async function PortfolioControlPage() {
  await requireAdminPage('/portfolio-control');

  const authDb = await createSupabaseServer();
  const {
    data: { user },
  } = await authDb.auth.getUser();

  if (!user) {
    redirect('/login?next=%2Fportfolio-control');
  }

  const [
    entitiesTotal,
    lowSourceEntities,
    grantsOpen,
    grantsTotal,
    grantsMissingDeadlines,
    foundationsTotal,
    foundationsProfiled,
    foundationsOpenPrograms,
    shortlistsTotal,
    shortlistItemsTotal,
    shortlistPriority,
    shortlistReviewing,
    procurementTasksOpen,
    procurementTasksDue48h,
    workflowRuns7d,
    packExports30d,
    goodsCommunities,
    goodsBuyers,
    goodsHighFitBuyers,
    goodsSignalsOpen,
    ntCoverageGaps,
    orgProfiles,
    payingProfiles,
    apiKeys,
    alertPreferences,
    discoveriesOpen,
    enrichmentCandidates,
    sn13Candidates,
    sn13Pending,
    buildEntityGraphFailed30d,
    agentHealthRow,
  ] = await Promise.all([
    runCount('SELECT COUNT(*)::int AS count FROM gs_entities'),
    runCount('SELECT COUNT(*)::int AS count FROM gs_entities WHERE COALESCE(source_count, 0) <= 1'),
    runCount(`
      SELECT COUNT(*)::int AS count
      FROM grant_opportunities
      WHERE (status IS NULL OR LOWER(status) NOT IN ('closed', 'archived'))
      AND (closes_at IS NULL OR closes_at >= CURRENT_DATE)
    `),
    runCount('SELECT COUNT(*)::int AS count FROM grant_opportunities'),
    runCount('SELECT COUNT(*)::int AS count FROM grant_opportunities WHERE closes_at IS NULL'),
    runCount('SELECT COUNT(*)::int AS count FROM foundations'),
    runCount("SELECT COUNT(*)::int AS count FROM foundations WHERE TRIM(COALESCE(description, '')) <> ''"),
    runCount('SELECT COUNT(*)::int AS count FROM foundations WHERE COALESCE(open_programs, 0) > 0'),
    runCount('SELECT COUNT(*)::int AS count FROM procurement_shortlists'),
    runCount('SELECT COUNT(*)::int AS count FROM procurement_shortlist_items'),
    runCount("SELECT COUNT(*)::int AS count FROM procurement_shortlist_items WHERE decision_tag = 'priority'"),
    runCount("SELECT COUNT(*)::int AS count FROM procurement_shortlist_items WHERE decision_tag = 'reviewing'"),
    runCount(`
      SELECT COUNT(*)::int AS count
      FROM procurement_tasks
      WHERE LOWER(COALESCE(status, 'open')) NOT IN ('done', 'completed', 'cancelled', 'resolved')
    `),
    runCount(`
      SELECT COUNT(*)::int AS count
      FROM procurement_tasks
      WHERE due_at IS NOT NULL
      AND due_at <= NOW() + INTERVAL '48 hours'
      AND LOWER(COALESCE(status, 'open')) NOT IN ('done', 'completed', 'cancelled', 'resolved')
    `),
    runCount(`
      SELECT COUNT(*)::int AS count
      FROM procurement_workflow_runs
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `),
    runCount(`
      SELECT COUNT(*)::int AS count
      FROM procurement_pack_exports
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `),
    runCount("SELECT COUNT(*)::int AS count FROM goods_communities WHERE state IN ('NT', 'QLD')"),
    runCount('SELECT COUNT(*)::int AS count FROM goods_procurement_entities'),
    runCount('SELECT COUNT(*)::int AS count FROM goods_procurement_entities WHERE COALESCE(fit_score, 0) >= 70'),
    runCount(`
      SELECT COUNT(*)::int AS count
      FROM goods_procurement_signals
      WHERE LOWER(COALESCE(status, 'open')) NOT IN ('resolved', 'closed', 'done')
    `),
    runCount(`
      SELECT COUNT(*)::int AS count
      FROM v_nt_community_procurement_summary
      WHERE needs_postcode_enrichment = true
      OR COALESCE(buyer_match_count, 0) = 0
    `),
    runCount('SELECT COUNT(*)::int AS count FROM org_profiles'),
    runCount(`
      SELECT COUNT(*)::int AS count
      FROM org_profiles
      WHERE LOWER(COALESCE(subscription_plan, 'community')) NOT IN ('community', 'free', 'none')
    `),
    runCount('SELECT COUNT(*)::int AS count FROM api_keys'),
    runCount('SELECT COUNT(*)::int AS count FROM alert_preferences'),
    runCount('SELECT COUNT(*)::int AS count FROM discoveries WHERE dismissed = false AND reviewed_at IS NULL'),
    runCount('SELECT COUNT(*)::int AS count FROM enrichment_candidates'),
    runCount("SELECT COUNT(*)::int AS count FROM enrichment_candidates WHERE source = 'sn13_ondemand'"),
    runCount("SELECT COUNT(*)::int AS count FROM enrichment_candidates WHERE source = 'sn13_ondemand' AND status = 'pending'"),
    runCount(`
      SELECT COUNT(*)::int AS count
      FROM agent_runs
      WHERE agent_name = 'Build Entity Graph'
      AND status = 'failed'
      AND completed_at >= NOW() - INTERVAL '30 days'
    `),
    runRow(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'success')::int AS success_count,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_count,
        COUNT(*)::int AS total_count
      FROM agent_runs
      WHERE completed_at >= NOW() - INTERVAL '7 days'
    `),
  ]);

  const multiSourceEntities = entitiesTotal !== null && lowSourceEntities !== null
    ? Math.max(0, entitiesTotal - lowSourceEntities)
    : null;
  const sourceCoveragePct = entitiesTotal && multiSourceEntities !== null
    ? (multiSourceEntities / entitiesTotal) * 100
    : null;
  const grantsMissingDeadlinePct = grantsTotal && grantsMissingDeadlines !== null
    ? (grantsMissingDeadlines / grantsTotal) * 100
    : null;
  const foundationProfilePct = foundationsTotal && foundationsProfiled !== null
    ? (foundationsProfiled / foundationsTotal) * 100
    : null;
  const paidProfilePct = orgProfiles && payingProfiles !== null
    ? (payingProfiles / orgProfiles) * 100
    : null;

  const successCount = toNumber(agentHealthRow?.success_count ?? null) ?? 0;
  const failedCount = toNumber(agentHealthRow?.failed_count ?? null) ?? 0;
  const totalCount = toNumber(agentHealthRow?.total_count ?? null) ?? 0;
  const agentHealthPct = totalCount > 0 ? (successCount / totalCount) * 100 : null;

  const risks: string[] = [];
  const actions: string[] = [];
  const wins: string[] = [];

  if ((procurementTasksDue48h ?? 0) > 0) {
    risks.push(`${formatInt(procurementTasksDue48h)} procurement tasks are due in 48h.`);
    actions.push('Clear due procurement tasks and assign owners in Decision Desk before new discovery runs.');
  } else {
    wins.push('No procurement tasks are currently due within 48h.');
  }

  if ((buildEntityGraphFailed30d ?? 0) > 0) {
    risks.push(`Build Entity Graph failed ${formatInt(buildEntityGraphFailed30d)} times in the last 30 days.`);
    actions.push('Stabilise Build Entity Graph reliability before scaling additional enrichment work.');
  }

  if ((sn13Candidates ?? 0) === 0) {
    risks.push('SN13 enrichment lane has produced zero candidates so far.');
    actions.push('Run SN13 worker on a constrained cohort and review acceptance rate this week.');
  } else {
    wins.push(`SN13 lane has ${formatInt(sn13Candidates)} staged candidates (${formatInt(sn13Pending)} pending review).`);
  }

  if ((grantsMissingDeadlinePct ?? 0) > 50) {
    risks.push(`${formatPct(grantsMissingDeadlinePct)} of grant records are missing deadlines.`);
    actions.push('Prioritise deadline enrichment and dedup quality for grants before ranking refinements.');
  }

  if ((foundationProfilePct ?? 0) < 35) {
    risks.push(`Foundation profiling coverage is low at ${formatPct(foundationProfilePct)}.`);
    actions.push('Increase profiled foundations with a targeted nightly profile run.');
  } else {
    wins.push(`Foundation profile coverage is ${formatPct(foundationProfilePct)}.`);
  }

  if ((goodsHighFitBuyers ?? 0) < 25) {
    risks.push(`High-fit buyer pool is only ${formatInt(goodsHighFitBuyers)} entities.`);
    actions.push('Expand NT/QLD buyer scraping (store networks, housing, AMS, councils) this sprint.');
  } else {
    wins.push(`Goods buyer pipeline has ${formatInt(goodsHighFitBuyers)} high-fit targets.`);
  }

  if ((agentHealthPct ?? 0) < 80) {
    risks.push(`Agent health is ${formatPct(agentHealthPct)} over 7 days.`);
  } else {
    wins.push(`Agent health is ${formatPct(agentHealthPct)} over 7 days.`);
  }

  const trustLaneTone = metricStatus(sourceCoveragePct, 15, 8);
  const procurementLaneTone = (procurementTasksDue48h ?? 0) === 0 ? 'good' : (procurementTasksDue48h ?? 0) <= 5 ? 'watch' : 'risk';
  const grantsLaneTone = metricStatus(foundationProfilePct, 40, 25);
  const goodsLaneTone = metricStatus(goodsHighFitBuyers, 50, 20);
  const sidecarLaneTone = (sn13Candidates ?? 0) > 0 ? 'good' : 'risk';

  return (
    <div className="max-w-[1400px] mx-auto p-6 space-y-6">
      <div className="border border-black bg-white">
        <div className="border-b border-black p-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-600">Portfolio Control</p>
            <h1 className="text-3xl font-black tracking-tight text-black mt-1">Operating Cockpit</h1>
            <p className="text-sm text-gray-700 mt-2 max-w-3xl">
              One weekly control surface across Goods, procurement, grants/foundations, data trust, and sidecar experimentation.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest font-semibold text-gray-500">Allocation Rule</p>
            <p className="text-lg font-black">70 / 20 / 10</p>
            <p className="text-xs text-gray-600">Core Revenue / Moat / Sidecar</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-0 divide-x divide-y md:divide-y-0 divide-black border-t border-black">
          <MetricCell label="Entities" value={formatInt(entitiesTotal)} />
          <MetricCell label="Multi-Source Coverage" value={formatPct(sourceCoveragePct)} />
          <MetricCell label="Open Grants" value={formatInt(grantsOpen)} />
          <MetricCell label="Profiled Foundations" value={formatPct(foundationProfilePct)} />
          <MetricCell label="Shortlist Items" value={formatInt(shortlistItemsTotal)} />
          <MetricCell label="High-Fit Buyers" value={formatInt(goodsHighFitBuyers)} />
          <MetricCell label="Agent Health (7d)" value={formatPct(agentHealthPct)} />
          <MetricCell label="Paying Profile % " value={formatPct(paidProfilePct)} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrackCard
          title="Tier 1: Goods Buyer + Capital Engine"
          tone={goodsLaneTone}
          linkHref="/goods-workspace"
          linkLabel="Open Goods Workspace"
          metrics={[
            { label: 'Communities (NT/QLD)', value: formatInt(goodsCommunities) },
            { label: 'Buyer Targets', value: formatInt(goodsBuyers) },
            { label: 'High-Fit Buyers', value: formatInt(goodsHighFitBuyers) },
            { label: 'Open Signals', value: formatInt(goodsSignalsOpen) },
            { label: 'NT Coverage Gaps', value: formatInt(ntCoverageGaps) },
          ]}
        />

        <TrackCard
          title="Tier 1: Procurement Operating System"
          tone={procurementLaneTone}
          linkHref="/tender-intelligence"
          linkLabel="Open Tender Intelligence"
          metrics={[
            { label: 'Shortlists', value: formatInt(shortlistsTotal) },
            { label: 'Priority Items', value: formatInt(shortlistPriority) },
            { label: 'Reviewing Items', value: formatInt(shortlistReviewing) },
            { label: 'Open Tasks', value: formatInt(procurementTasksOpen) },
            { label: 'Due in 48h', value: formatInt(procurementTasksDue48h) },
            { label: 'Workflow Runs (7d)', value: formatInt(workflowRuns7d) },
            { label: 'Pack Exports (30d)', value: formatInt(packExports30d) },
          ]}
        />

        <TrackCard
          title="Tier 1: Grants + Foundations Conversion"
          tone={grantsLaneTone}
          linkHref="/grants"
          linkLabel="Open Grants"
          metrics={[
            { label: 'Total Grants', value: formatInt(grantsTotal) },
            { label: 'Open Grants', value: formatInt(grantsOpen) },
            { label: 'Missing Deadlines', value: formatPct(grantsMissingDeadlinePct) },
            { label: 'Foundations', value: formatInt(foundationsTotal) },
            { label: 'Profiled Foundations', value: formatInt(foundationsProfiled) },
            { label: 'Open Programs', value: formatInt(foundationsOpenPrograms) },
          ]}
        />

        <TrackCard
          title="Tier 2: Trust + Data Quality Moat"
          tone={trustLaneTone}
          linkHref="/mission-control"
          linkLabel="Open Mission Control"
          metrics={[
            { label: 'Low-Source Entities', value: formatInt(lowSourceEntities) },
            { label: 'Multi-Source Entities', value: formatInt(multiSourceEntities) },
            { label: 'Candidate Queue', value: formatInt(enrichmentCandidates) },
            { label: 'Open Discoveries', value: formatInt(discoveriesOpen) },
            { label: 'Build Entity Graph Fails (30d)', value: formatInt(buildEntityGraphFailed30d) },
          ]}
        />

        <TrackCard
          title="Tier 3: Bittensor Sidecar (Optionality)"
          tone={sidecarLaneTone}
          linkHref="/mission-control"
          linkLabel="Open Sidecar Control"
          metrics={[
            { label: 'SN13 Candidates', value: formatInt(sn13Candidates) },
            { label: 'SN13 Pending Review', value: formatInt(sn13Pending) },
            { label: 'API Keys Issued', value: formatInt(apiKeys) },
            { label: 'Alert Preferences', value: formatInt(alertPreferences) },
          ]}
        />

        <TrackCard
          title="Revenue Readiness"
          tone={metricStatus(paidProfilePct, 10, 3)}
          linkHref="/pricing"
          linkLabel="Open Pricing"
          metrics={[
            { label: 'Org Profiles', value: formatInt(orgProfiles) },
            { label: 'Paying Profiles', value: formatInt(payingProfiles) },
            { label: 'Paid Conversion', value: formatPct(paidProfilePct) },
            { label: 'Pack Exports (30d)', value: formatInt(packExports30d) },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <ListCard
          title="Top Risks Right Now"
          badgeClass="bg-red-100 text-red-900 border-red-300"
          badgeLabel={`${risks.length} risks`}
          items={risks.length > 0 ? risks : ['No critical risks detected from current thresholds.']}
        />
        <ListCard
          title="Next 7 Days"
          badgeClass="bg-blue-100 text-blue-900 border-blue-300"
          badgeLabel={`${actions.length} actions`}
          items={actions.length > 0 ? actions : ['No immediate corrective actions suggested.']}
        />
        <ListCard
          title="Working Signals"
          badgeClass="bg-green-100 text-green-900 border-green-300"
          badgeLabel={`${wins.length} wins`}
          items={wins.length > 0 ? wins : ['No positive signal yet — focus on trust and delivery basics.']}
        />
      </div>

      <div className="border border-black bg-white p-4">
        <p className="text-xs text-gray-600 font-mono">
          Generated {new Date().toLocaleString('en-AU')} · logged in as {user.email}
        </p>
      </div>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 bg-white">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className="text-2xl font-black text-black mt-2 leading-none">{value}</p>
    </div>
  );
}

function TrackCard({
  title,
  tone,
  linkHref,
  linkLabel,
  metrics,
}: {
  title: string;
  tone: 'good' | 'watch' | 'risk';
  linkHref: string;
  linkLabel: string;
  metrics: Array<{ label: string; value: string }>;
}) {
  return (
    <section className="border border-black bg-white">
      <div className="p-4 border-b border-black flex items-start justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-wider text-black">{title}</h2>
        <span className={`text-[10px] uppercase tracking-wider font-black px-2 py-1 border ${statusTone(tone)}`}>
          {tone}
        </span>
      </div>
      <div className="p-4 space-y-2">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{metric.label}</span>
            <span className="font-black text-black">{metric.value}</span>
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-black">
        <a
          href={linkHref}
          className="inline-flex items-center border border-black px-3 py-1.5 text-xs font-black uppercase tracking-wider hover:bg-black hover:text-white transition-colors"
        >
          {linkLabel}
        </a>
      </div>
    </section>
  );
}

function ListCard({
  title,
  badgeLabel,
  badgeClass,
  items,
}: {
  title: string;
  badgeLabel: string;
  badgeClass: string;
  items: string[];
}) {
  return (
    <section className="border border-black bg-white">
      <div className="p-4 border-b border-black flex items-center justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-wider text-black">{title}</h2>
        <span className={`text-[10px] uppercase tracking-wider font-black px-2 py-1 border ${badgeClass}`}>
          {badgeLabel}
        </span>
      </div>
      <ul className="p-4 space-y-3">
        {items.map((item) => (
          <li key={item} className="text-sm text-gray-800 leading-relaxed">• {item}</li>
        ))}
      </ul>
    </section>
  );
}
