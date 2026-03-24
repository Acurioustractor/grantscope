import { Fragment } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getBudgetCommitments,
  getBudgetTotals,
  getTopOrgs,
  getProgramsWithPartners,
  getTrackerLeadership,
  getTrackerInterlocks,
  getTrackerDonations,
  getFundingByLga,
  getEvidenceCoverage,
  getAlmaInterventions,
  getAlmaCount,
  getHansardMentions,
  getYjLobbyingConnections,
  getYjRevolvingDoor,
  getOutcomesMetrics,
  getStateComparisonMetrics,
  getCtgTrend,
  getPolicyTimeline,
  getOversightData,
  money,
  fmt,
} from '@/lib/services/report-service';

export const revalidate = 3600;

const STATE_META: Record<string, { name: string; abbr: string }> = {
  qld: { name: 'Queensland', abbr: 'QLD' },
  nsw: { name: 'New South Wales', abbr: 'NSW' },
  vic: { name: 'Victoria', abbr: 'VIC' },
  wa: { name: 'Western Australia', abbr: 'WA' },
  sa: { name: 'South Australia', abbr: 'SA' },
  nt: { name: 'Northern Territory', abbr: 'NT' },
  tas: { name: 'Tasmania', abbr: 'TAS' },
  act: { name: 'Australian Capital Territory', abbr: 'ACT' },
};

export function generateStaticParams() {
  return Object.keys(STATE_META).map(state => ({ state }));
}

export function generateMetadata({ params }: { params: Promise<{ state: string }> }) {
  return params.then(({ state }) => {
    const meta = STATE_META[state.toLowerCase()];
    if (!meta) return { title: 'Not Found' };
    return {
      title: `${meta.name} Youth Justice Accountability Tracker — CivicGraph`,
      description: `Track ${meta.name} youth justice outcomes, funding, leadership, evidence, and political context.`,
    };
  });
}

type BudgetRow = { program_name: string; amount: number | null; financial_year: string; source: string };
type BudgetTotal = { program_name: string; amount: number; financial_year: string };
type OrgRow = { recipient_name: string; recipient_abn: string | null; state: string | null; grants: number; total: number; gs_id: string | null };
type LeaderRow = { recipient_name: string; recipient_abn: string | null; gs_id: string | null; is_community_controlled: boolean | null; total_funded: number; directors: string };
type InterlockRow = { person_name: string; board_count: number; organisations: string };
type DonationRow = { donor_name: string; donation_to: string; total: number; records: number; from_fy: string; to_fy: string };
type LgaRow = { lga_name: string; state: string; orgs: number; total_funding: number; seifa_decile: number | null };
type CoverageRow = { total_interventions: number; with_evidence: number; without_evidence: number; coverage_pct: number };
type AlmaRow = { name: string; type: string | null; evidence_level: string | null; geography: string | null; portfolio_score: number | null };
type HansardRow = { speaker_name: string; speaker_party: string | null; speaker_electorate: string | null; sitting_date: string; subject: string | null; excerpt: string };
type LobbyRow = { canonical_name: string; gs_id: string | null; lobbyist_name: string | null; client_name: string | null; relationship_type: string };
type RevolvingDoorRow = {
  canonical_name: string; revolving_door_score: number; influence_vectors: number;
  total_donated: number; total_contracts: number; total_funded: number;
  parties_funded: string; distinct_buyers: number; is_community_controlled: boolean;
};
type PartnerRow = { program_name: string; recipient_name: string; recipient_abn: string | null; total: number | null; grants: number; gs_id: string | null; is_community_controlled: boolean | null };
type MetricRow = { metric_name: string; metric_value: number; metric_unit: string; period: string; cohort: string | null; source: string; notes: string | null };
type ComparisonRow = { jurisdiction: string; metric_name: string; metric_value: number; metric_unit: string; period: string; cohort: string | null };
type CtgRow = { rate: number; period: string; notes: string | null };
type PolicyRow = { event_date: string; title: string; description: string; event_type: string; severity: string; source: string | null; impact_summary: string | null; metadata: Record<string, unknown> | null };
type OversightRow = { oversight_body: string; report_title: string; report_date: string; report_url: string | null; recommendation_number: string; recommendation_text: string; status: string; status_notes: string | null; severity: string | null };

const COMPARISON_METRICS = [
  'detention_rate_per_10k', 'avg_daily_detention', 'indigenous_overrepresentation_ratio',
  'ctg_target11_indigenous_detention_rate', 'avg_days_in_detention', 'cost_per_day_detention',
  'pct_unsentenced', 'detention_5yr_trend_pct',
];

async function getTrackerData(abbr: string) {
  const [
    budgetCommitments, budgetTotals, topOrgs, programPartners,
    leadership, interlocks, donations, lgaFunding,
    evidenceCoverage, almaInterventions, almaCount,
    hansard, lobbying, revolvingDoor,
    outcomes, comparison, ctgTrend, policyTimeline, oversight,
  ] = await Promise.all([
    getBudgetCommitments(abbr),
    getBudgetTotals(abbr),
    getTopOrgs('youth-justice', 25, abbr),
    getProgramsWithPartners('youth-justice', abbr, { namedOnly: true }),
    getTrackerLeadership(abbr, 'youth-justice', 20),
    getTrackerInterlocks(abbr, 'youth-justice', 15),
    getTrackerDonations(abbr, 'youth-justice', 15),
    getFundingByLga('youth-justice', 20, abbr),
    getEvidenceCoverage('youth-justice', abbr),
    getAlmaInterventions('youth-justice', 15, abbr),
    getAlmaCount('youth-justice', abbr),
    getHansardMentions(abbr, 15),
    getYjLobbyingConnections('youth-justice', abbr),
    getYjRevolvingDoor('youth-justice', 10, abbr),
    getOutcomesMetrics(abbr),
    getStateComparisonMetrics(COMPARISON_METRICS),
    getCtgTrend(abbr),
    getPolicyTimeline(abbr),
    getOversightData(abbr),
  ]);

  const partnersByProgram: Record<string, PartnerRow[]> = {};
  const rawPartners = (programPartners as PartnerRow[] | null) || [];
  for (const p of rawPartners) {
    if (!partnersByProgram[p.program_name]) partnersByProgram[p.program_name] = [];
    partnersByProgram[p.program_name].push(p);
  }

  return {
    budgetCommitments: (budgetCommitments as BudgetRow[] | null) || [],
    budgetTotals: (budgetTotals as BudgetTotal[] | null) || [],
    topOrgs: (topOrgs as OrgRow[] | null) || [],
    partnersByProgram,
    leadership: (leadership as LeaderRow[] | null) || [],
    interlocks: (interlocks as InterlockRow[] | null) || [],
    donations: (donations as DonationRow[] | null) || [],
    lgaFunding: (lgaFunding as LgaRow[] | null) || [],
    coverage: ((evidenceCoverage as CoverageRow[] | null) || [])[0] || null,
    almaInterventions: (almaInterventions as AlmaRow[] | null) || [],
    almaCount,
    hansard: (hansard as HansardRow[] | null) || [],
    lobbying: (lobbying as LobbyRow[] | null) || [],
    revolvingDoor: (revolvingDoor as RevolvingDoorRow[] | null) || [],
    outcomes: (outcomes as MetricRow[] | null) || [],
    comparison: (comparison as ComparisonRow[] | null) || [],
    ctgTrend: (ctgTrend as CtgRow[] | null) || [],
    policyTimeline: (policyTimeline as PolicyRow[] | null) || [],
    oversight: (oversight as OversightRow[] | null) || [],
  };
}

function parseDirectors(json: string): Array<{ name: string; role: string }> {
  try { return JSON.parse(json); } catch { return []; }
}

function parseOrgs(json: string): Array<{ canonical_name: string; abn: string }> {
  try { return JSON.parse(json); } catch { return []; }
}

/** Look up a metric value from the outcomes array */
function m(metrics: MetricRow[], name: string, cohort?: string): number | null {
  const c = cohort ?? 'all';
  const row = metrics.find(r => r.metric_name === name && r.cohort === c);
  if (!row && !cohort) {
    const alt = metrics.find(r => r.metric_name === name && r.cohort === 'indigenous');
    return alt?.metric_value ?? null;
  }
  return row?.metric_value ?? null;
}

function fmtDate(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-red-500',
  significant: 'bg-amber-500',
  moderate: 'bg-blue-400',
  positive: 'bg-emerald-500',
};

const BODY_LABELS: Record<string, string> = {
  'qld-audit-office': 'QLD Audit Office',
  'qld-ombudsman': 'QLD Ombudsman',
  'qld-sentencing-advisory-council': 'Sentencing Advisory Council',
  'qld-human-rights-commissioner': 'Human Rights Commissioner',
  'nsw-inspector-custodial-services': 'NSW Inspector of Custodial Services',
  'nsw-ombudsman': 'NSW Ombudsman',
  'vic-commission-children-young-people': 'VIC Commission for Children & Young People',
  'vic-ombudsman': 'VIC Ombudsman',
  'wa-inspector-custodial-services': 'WA Inspector of Custodial Services',
  'nt-children-commissioner': 'NT Children\'s Commissioner',
  'sa-guardian-children-young-people': 'SA Guardian for Children & Young People',
};

export default async function StateTrackerPage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  const meta = STATE_META[state.toLowerCase()];
  if (!meta) notFound();

  const abbr = meta.abbr;
  const data = await getTrackerData(abbr);

  const latestTotal = data.budgetTotals[0];
  const programItems = data.budgetCommitments.filter(b => b.amount);
  const totalOrgs = new Set(data.topOrgs.map(o => o.recipient_name)).size;
  const om = data.outcomes;

  // Build comparison lookup
  const comp: Record<string, Record<string, number>> = {};
  for (const row of data.comparison) {
    if (!comp[row.metric_name]) comp[row.metric_name] = {};
    const existing = comp[row.metric_name][row.jurisdiction];
    if (existing === undefined || row.cohort === 'all') {
      comp[row.metric_name][row.jurisdiction] = row.metric_value;
    }
  }
  const cv = (metric: string, jur: string) => comp[metric]?.[jur] ?? null;

  // Group oversight by body
  const oversightByBody: Record<string, OversightRow[]> = {};
  for (const r of data.oversight) {
    if (!oversightByBody[r.oversight_body]) oversightByBody[r.oversight_body] = [];
    oversightByBody[r.oversight_body].push(r);
  }

  // Split policy events
  const hrOverrides = data.policyTimeline.filter(e => e.event_type === 'human_rights_override');
  const timelineEvents = data.policyTimeline.filter(e => e.event_type !== 'human_rights_override');

  // Check what data sections are available
  const hasOutcomes = om.length > 0;
  const hasBudget = programItems.length > 0 || data.budgetTotals.length > 0;
  const hasOrgs = data.topOrgs.length > 0;
  const hasLeadership = data.leadership.length > 0;
  const hasLga = data.lgaFunding.length > 0;
  const hasEvidence = data.almaInterventions.length > 0 || data.coverage !== null;
  const hasPolitical = data.hansard.length > 0 || data.lobbying.length > 0 || data.donations.length > 0 || data.revolvingDoor.length > 0;
  const hasOversight = data.oversight.length > 0 || data.policyTimeline.length > 0;
  const hasCtg = data.ctgTrend.length > 0;

  // Count available sections for numbering
  let sectionNum = 0;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <Link href={`/reports/youth-justice/${state}`} className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; {meta.name} Youth Justice
        </Link>
        <div className="flex items-center gap-3 mt-4 mb-1">
          <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">Accountability Tracker</span>
          <span className="text-[10px] font-bold text-white bg-bauhaus-black px-2 py-0.5 rounded-sm uppercase tracking-wider">{abbr}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          {meta.name} Youth Justice Tracker
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          What did the {abbr} government promise, who got the money, who runs those organisations,
          what&rsquo;s their track record, and what&rsquo;s the political context?
        </p>
      </div>

      {/* Headline Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-red-600">
            {m(om, 'avg_daily_detention') ?? (latestTotal ? money(latestTotal.amount) : '—')}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {m(om, 'avg_daily_detention') !== null ? 'Avg daily detention' : latestTotal ? `${latestTotal.financial_year} Budget` : 'Budget'}
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-red-600">
            {m(om, 'indigenous_overrepresentation_ratio') ? `${m(om, 'indigenous_overrepresentation_ratio')}x` : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-1">Indigenous overrepresentation</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-amber-600">
            {m(om, 'cost_per_day_detention') ? `$${m(om, 'cost_per_day_detention')!.toLocaleString()}` : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-1">Cost per day (detention)</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-gray-700">
            {m(om, 'pct_unsentenced') ? `${m(om, 'pct_unsentenced')}%` : data.coverage ? `${data.coverage.coverage_pct}%` : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {m(om, 'pct_unsentenced') !== null ? 'Unsentenced (remand)' : 'Evidence Coverage'}
          </div>
        </div>
      </div>

      {/* Editorial Summary */}
      {hasOutcomes && (
        <div className="bg-gray-900 text-white rounded-xl p-6 mb-10 leading-relaxed">
          <h2 className="text-lg font-black uppercase tracking-wider mb-3">The Story in Three Numbers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="border-l-4 border-red-500 pl-3">
              <div className="text-2xl font-black text-red-400">
                {m(om, 'cost_per_day_detention') ? `$${fmt(Math.round(m(om, 'cost_per_day_detention')! * 365))}` : '—'}
              </div>
              <div className="text-xs text-gray-400">per child per year in detention</div>
            </div>
            <div className="border-l-4 border-amber-500 pl-3">
              <div className="text-2xl font-black text-amber-400">
                {m(om, 'pct_unsentenced') ?? m(om, 'rogs_yj_recidivism_12m') ?? '—'}%
              </div>
              <div className="text-xs text-gray-400">
                {m(om, 'pct_unsentenced') !== null ? 'unsentenced (on remand)' : 'reoffend within 12 months'}
              </div>
            </div>
            <div className="border-l-4 border-emerald-500 pl-3">
              <div className="text-2xl font-black text-emerald-400">
                {m(om, 'detention_rate_per_10k') ?? '—'}/10K
              </div>
              <div className="text-xs text-gray-400">youth detention rate</div>
            </div>
          </div>
          <p className="text-sm text-gray-300">
            {meta.name} detains {m(om, 'avg_daily_detention') ?? '—'} children on an average day
            at ${m(om, 'cost_per_day_detention')?.toLocaleString() ?? '—'}/day.
            {m(om, 'indigenous_overrepresentation_ratio')
              ? ` First Nations young people are ${m(om, 'indigenous_overrepresentation_ratio')}x overrepresented in detention.`
              : ''}
            {m(om, 'pct_unsentenced')
              ? ` ${m(om, 'pct_unsentenced')}% of those detained haven't been sentenced — they're on remand.`
              : ''}
            {m(om, 'detention_5yr_trend_pct') !== null
              ? ` Detention numbers have ${m(om, 'detention_5yr_trend_pct')! > 0 ? `increased ${m(om, 'detention_5yr_trend_pct')}%` : `decreased ${Math.abs(m(om, 'detention_5yr_trend_pct')!)}%`} over 5 years.`
              : ''}
          </p>
        </div>
      )}

      {/* Outcomes Reality Check */}
      {hasOutcomes && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-red pb-2">
            The Numbers That Matter
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">
            Source: outcomes_metrics database — AIHW, ROGS, state reports.
          </p>

          {/* Key Outcome Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {[
              { name: 'avg_daily_detention', label: 'Avg daily detention', color: 'red' as const },
              { name: 'pct_first_nations_in_detention', label: 'First Nations in detention', color: 'red' as const, suffix: '%' },
              { name: 'indigenous_overrepresentation_ratio', label: 'Indigenous detention rate ratio', color: 'red' as const, suffix: 'x' },
              { name: 'rogs_yj_recidivism_12m', label: 'Recidivism (12 months)', color: 'red' as const, suffix: '%' },
              { name: 'pct_disability_in_detention', label: 'Have a disability', color: 'amber' as const, suffix: '%' },
              { name: 'pct_unsentenced', label: 'Unsentenced (remand)', color: 'amber' as const, suffix: '%' },
            ].filter(stat => m(om, stat.name) !== null).map((stat) => {
              const val = m(om, stat.name);
              const bgClass = stat.color === 'red' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200';
              const textClass = stat.color === 'red' ? 'text-red-600' : 'text-amber-600';
              return (
                <div key={stat.name} className={`${bgClass} border rounded-xl p-4 text-center`}>
                  <div className={`text-xl sm:text-2xl font-black ${textClass}`}>
                    {val !== null ? `${val}${stat.suffix || ''}` : '—'}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1 leading-tight">{stat.label}</div>
                </div>
              );
            })}
          </div>

          {/* Cost Comparison */}
          {(m(om, 'cost_per_day_detention') !== null || m(om, 'rogs_cost_per_day_detention') !== null) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="border-2 border-red-300 rounded-xl p-5">
                <div className="text-xs font-black text-red-500 uppercase tracking-wider mb-1">Detention</div>
                <div className="text-3xl font-black text-red-600">
                  ${(m(om, 'cost_per_day_detention') ?? m(om, 'rogs_cost_per_day_detention'))?.toLocaleString() ?? '—'}
                  <span className="text-sm font-bold text-gray-400">/day</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {m(om, 'cost_per_day_detention') ? `$${fmt(Math.round(m(om, 'cost_per_day_detention')! * 365))} per child per year` : '—'}
                </div>
              </div>
              <div className="border-2 border-emerald-300 rounded-xl p-5">
                <div className="text-xs font-black text-emerald-500 uppercase tracking-wider mb-1">Community Supervision</div>
                <div className="text-3xl font-black text-emerald-600">
                  ${(m(om, 'cost_per_day_community') ?? m(om, 'rogs_cost_per_day_community'))?.toLocaleString() ?? '—'}
                  <span className="text-sm font-bold text-gray-400">/day</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {m(om, 'cost_per_day_detention') && m(om, 'cost_per_day_community')
                    ? `${(m(om, 'cost_per_day_detention')! / m(om, 'cost_per_day_community')!).toFixed(1)}x cheaper — and better outcomes`
                    : m(om, 'rogs_cost_per_day_detention') && m(om, 'rogs_cost_per_day_community')
                    ? `${(m(om, 'rogs_cost_per_day_detention')! / m(om, 'rogs_cost_per_day_community')!).toFixed(1)}x cheaper`
                    : '—'}
                </div>
              </div>
            </div>
          )}

          {/* Watch-house Crisis (QLD-specific data, but adaptive) */}
          {m(om, 'watchhouse_stays') !== null && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
              <h3 className="text-sm font-black text-bauhaus-black uppercase tracking-wider mb-3">Watch-house Crisis</h3>
              <p className="text-xs text-gray-500 mb-3">Children held in adult police watch-houses.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="text-center">
                  <div className="text-2xl font-black text-gray-800">{m(om, 'watchhouse_stays')?.toLocaleString() ?? '—'}</div>
                  <div className="text-[10px] text-gray-500">Total stays</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-black text-red-600">{m(om, 'watchhouse_pct_first_nations') ?? '—'}%</div>
                  <div className="text-[10px] text-gray-500">First Nations</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-black text-amber-600">{m(om, 'watchhouse_stays_8_14_days')?.toLocaleString() ?? '—'}</div>
                  <div className="text-[10px] text-gray-500">Held 8-14 days</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-black text-red-600">{m(om, 'watchhouse_stays_15plus_days')?.toLocaleString() ?? '—'}</div>
                  <div className="text-[10px] text-gray-500">Held 15+ days</div>
                </div>
              </div>
            </div>
          )}

          {/* Socioeconomic Profile (if SEIFA data available) */}
          {m(om, 'detention_seifa_q1') !== null && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
              <h3 className="text-sm font-black text-bauhaus-black uppercase tracking-wider mb-3">Who&rsquo;s in Detention?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-bold text-gray-600 mb-2">By Socioeconomic Quintile</h4>
                  {[
                    { label: 'Most disadvantaged (Q1)', metric: 'detention_seifa_q1' },
                    { label: 'Q2', metric: 'detention_seifa_q2' },
                    { label: 'Q3', metric: 'detention_seifa_q3' },
                    { label: 'Q4', metric: 'detention_seifa_q4' },
                    { label: 'Least disadvantaged (Q5)', metric: 'detention_seifa_q5' },
                  ].map((q) => {
                    const count = m(om, q.metric);
                    const total = [1,2,3,4,5].reduce((s, n) => s + (m(om, `detention_seifa_q${n}`) ?? 0), 0);
                    const pct = count && total ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={q.metric} className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] text-gray-600 w-40 shrink-0">{q.label}</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                          <div className="bg-red-400 rounded-full h-2.5" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-700 w-8 text-right">{count ?? '—'}</span>
                      </div>
                    );
                  })}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-600 mb-2">Key Facts</h4>
                  <ul className="space-y-1.5 text-xs text-gray-700">
                    {m(om, 'avg_days_on_remand') !== null && (
                      <li className="flex gap-2"><span className="font-black text-red-500 shrink-0">&bull;</span>Avg {m(om, 'avg_days_on_remand')} days on remand before resolution</li>
                    )}
                    {m(om, 'use_of_force_incidents') !== null && (
                      <li className="flex gap-2"><span className="font-black text-red-500 shrink-0">&bull;</span>{m(om, 'use_of_force_incidents')?.toLocaleString()} use-of-force incidents</li>
                    )}
                    {m(om, 'self_harm_incidents') !== null && (
                      <li className="flex gap-2"><span className="font-black text-red-500 shrink-0">&bull;</span>{m(om, 'self_harm_incidents')} self-harm incidents in detention</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ROGS Detail (available for all states) */}
          {m(om, 'rogs_avg_daily_detention') !== null && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
              <h3 className="text-sm font-black text-bauhaus-black uppercase tracking-wider mb-3">ROGS 2026 — System Snapshot</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { name: 'rogs_avg_daily_detention', label: 'Daily detention' },
                  { name: 'rogs_avg_daily_community', label: 'Daily community' },
                  { name: 'rogs_detention_beds', label: 'Detention beds' },
                  { name: 'rogs_detention_utilisation', label: 'Utilisation', suffix: '%' },
                ].filter(s => m(om, s.name) !== null).map(s => (
                  <div key={s.name} className="text-center">
                    <div className="text-xl font-black text-gray-800">{m(om, s.name)?.toLocaleString()}{s.suffix || ''}</div>
                    <div className="text-[10px] text-gray-500">{s.label}</div>
                  </div>
                ))}
              </div>
              {(m(om, 'rogs_indigenous_detention') !== null || m(om, 'rogs_detention_males') !== null) && (
                <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {m(om, 'rogs_indigenous_detention') !== null && (
                    <div className="text-center">
                      <div className="text-lg font-black text-red-600">{m(om, 'rogs_indigenous_detention')}</div>
                      <div className="text-[10px] text-gray-500">Indigenous in detention</div>
                    </div>
                  )}
                  {m(om, 'rogs_indigenous_community') !== null && (
                    <div className="text-center">
                      <div className="text-lg font-black text-amber-600">{m(om, 'rogs_indigenous_community')}</div>
                      <div className="text-[10px] text-gray-500">Indigenous in community</div>
                    </div>
                  )}
                  {m(om, 'rogs_detention_males') !== null && (
                    <div className="text-center">
                      <div className="text-lg font-black text-gray-700">{m(om, 'rogs_detention_males')}</div>
                      <div className="text-[10px] text-gray-500">Males</div>
                    </div>
                  )}
                  {m(om, 'rogs_detention_females') !== null && (
                    <div className="text-center">
                      <div className="text-lg font-black text-gray-700">{m(om, 'rogs_detention_females')}</div>
                      <div className="text-[10px] text-gray-500">Females</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Court Pipeline (QLD-specific data, but adaptive) */}
          {m(om, 'court_finalised_appearances') !== null && (
            <>
              <h3 className="text-sm font-black text-bauhaus-black uppercase tracking-wider mb-3 mt-6">Court Pipeline</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-gray-800">{m(om, 'court_finalised_appearances')?.toLocaleString() ?? '—'}</div>
                  <div className="text-[10px] text-gray-500 mt-1">Finalised appearances</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-gray-800">{m(om, 'court_finalised_charges')?.toLocaleString() ?? '—'}</div>
                  <div className="text-[10px] text-gray-500 mt-1">Finalised charges</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-red-600">{m(om, 'court_pct_first_nations_defendants') ?? '—'}%</div>
                  <div className="text-[10px] text-gray-500 mt-1">Defendants are First Nations</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-red-600">{m(om, 'court_breach_bail_convictions')?.toLocaleString() ?? '—'}</div>
                  <div className="text-[10px] text-gray-500 mt-1">Breach of bail convictions</div>
                </div>
              </div>

              {/* Sentencing */}
              {m(om, 'court_sentence_reprimand_pct') !== null && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
                  <h4 className="text-xs font-black text-bauhaus-black uppercase tracking-wider mb-3">Sentencing Outcomes</h4>
                  <div className="space-y-2">
                    {[
                      { label: 'Reprimand / minor', metric: 'court_sentence_reprimand_pct', color: 'bg-emerald-400' },
                      { label: 'Probation', metric: 'court_sentence_probation_pct', color: 'bg-blue-400' },
                      { label: 'Detention', metric: 'court_sentence_detention_pct', color: 'bg-red-500' },
                    ].map((s) => {
                      const pct = m(om, s.metric);
                      return (
                        <div key={s.metric} className="flex items-center gap-3">
                          <span className="text-xs text-gray-600 w-36 shrink-0">{s.label}</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-3">
                            <div className={`${s.color} rounded-full h-3`} style={{ width: `${pct ?? 0}%` }} />
                          </div>
                          <span className="text-xs font-bold text-gray-700 w-16 text-right">{pct ?? '—'}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Diversion */}
              {m(om, 'court_rj_referrals') !== null && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="border border-gray-200 rounded-xl p-5">
                    <h4 className="text-xs font-black text-bauhaus-black uppercase tracking-wider mb-2">Restorative Justice</h4>
                    <div className="text-2xl font-black text-blue-600 mb-1">{m(om, 'court_rj_referrals')?.toLocaleString() ?? '—'}</div>
                    <div className="text-xs text-gray-500">Young people referred to RJ</div>
                    {m(om, 'court_rj_conferences') !== null && (
                      <div className="text-xs text-gray-500 mt-1">{m(om, 'court_rj_conferences')?.toLocaleString()} participated in conferences</div>
                    )}
                  </div>
                  {m(om, 'court_processing_magistrates_days') !== null && (
                    <div className="border border-gray-200 rounded-xl p-5">
                      <h4 className="text-xs font-black text-bauhaus-black uppercase tracking-wider mb-2">Processing Time</h4>
                      <div className="space-y-2 mt-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">Magistrates Court</span>
                          <span className="font-bold">{m(om, 'court_processing_magistrates_days') ?? '—'} days avg</span>
                        </div>
                        {m(om, 'court_processing_childrens_court_days') !== null && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">Childrens Court</span>
                            <span className="font-bold text-amber-600">{m(om, 'court_processing_childrens_court_days')} days avg</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Policy Timeline */}
          {timelineEvents.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-black text-bauhaus-black uppercase tracking-wider mb-3">Policy Timeline</h3>
              <div className="space-y-3">
                {timelineEvents.map((e, i) => (
                  <div key={i} className="flex gap-3">
                    <div className={`shrink-0 w-2 rounded-full ${SEVERITY_COLOR[e.severity] || 'bg-gray-400'}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{fmtDate(e.event_date)}</span>
                        <span className="text-sm font-bold text-gray-800">{e.title}</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">{e.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* State Comparison Table — always shows (all states have data) */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-red pb-2">
          How {abbr} Compares
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          {meta.name} vs other states — AIHW Youth Justice 2023-24 &amp; ROGS 2026.
        </p>

        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-bauhaus-black">
                <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Metric</th>
                {['QLD', 'NSW', 'VIC', 'WA', 'NT', 'National'].map(j => (
                  <th key={j} className="text-right py-2 font-black uppercase tracking-wider text-xs">
                    {j === abbr ? <span className="text-bauhaus-red">{j}</span> : j}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Detention rate (per 10K)', metric: 'detention_rate_per_10k', highlight: true },
                { label: 'Avg daily detention count', metric: 'avg_daily_detention', highlight: false },
                { label: 'Indigenous overrepresentation', metric: 'indigenous_overrepresentation_ratio', highlight: true, suffix: 'x' },
                { label: 'First Nations detention rate (per 10K)', metric: 'ctg_target11_indigenous_detention_rate', highlight: false },
                { label: 'Avg days in detention', metric: 'avg_days_in_detention', highlight: true },
                { label: 'Cost per day (detention)', metric: 'cost_per_day_detention', highlight: false, prefix: '$' },
                { label: '% unsentenced (remand)', metric: 'pct_unsentenced', highlight: true, suffix: '%' },
                { label: '5-year trend (detention)', metric: 'detention_5yr_trend_pct', highlight: false, suffix: '%', signed: true },
              ].map((row) => {
                const jurisdictions = ['QLD', 'NSW', 'VIC', 'WA', 'NT', 'National'];
                const vals = jurisdictions.map(j => cv(row.metric, j));
                const nonNull = vals.filter((v): v is number => v !== null);
                const stateVals = nonNull.filter((_, idx) => jurisdictions[idx] !== 'National');
                const maxVal = stateVals.length > 0 ? Math.max(...stateVals) : null;
                const minVal = stateVals.length > 0 ? Math.min(...stateVals) : null;
                return (
                  <tr key={row.metric} className={`border-b border-gray-200 ${row.highlight ? 'bg-red-50' : ''}`}>
                    <td className="py-2 font-medium">{row.label}</td>
                    {jurisdictions.map((j, ji) => {
                      const v = vals[ji];
                      const isThisState = j === abbr;
                      const isNational = j === 'National';
                      const isMax = v === maxVal && !isNational;
                      const isMin = v === minVal && !isNational;
                      let cls = 'py-2 text-right';
                      if (isThisState) cls += ' font-black text-red-600';
                      else if (isMax && row.metric !== 'cost_per_day_detention') cls += ' text-red-600 font-bold';
                      else if (isMin) cls += ' text-emerald-600 font-bold';
                      else if (isNational) cls += ' font-bold';
                      const display = v !== null
                        ? `${row.signed && v > 0 ? '+' : ''}${row.prefix || ''}${row.metric === 'cost_per_day_detention' ? v.toLocaleString() : v}${row.suffix || ''}`
                        : '—';
                      return <td key={j} className={cls}>{display}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="text-[10px] text-gray-400 italic">
          Data from outcomes_metrics database. Sources: AIHW Youth Justice in Australia 2023-24, ROGS 2026 Table 17A.
        </div>
      </section>

      {/* CTG Scorecard */}
      {hasCtg && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-red pb-2">
            Closing the Gap: Target 11
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">
            Reduce rate of Aboriginal and Torres Strait Islander young people (10-17) in detention by 30% by 2031.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className={`border-2 rounded-xl p-5 text-center ${
              data.ctgTrend[0].rate < data.ctgTrend[data.ctgTrend.length - 1].rate
                ? 'bg-red-50 border-red-300' : 'bg-emerald-50 border-emerald-300'
            }`}>
              <div className="text-xs font-black uppercase tracking-wider mb-1 text-gray-500">{abbr} Status</div>
              <div className={`text-2xl font-black ${
                data.ctgTrend[0].rate < data.ctgTrend[data.ctgTrend.length - 1].rate ? 'text-red-600' : 'text-emerald-600'
              }`}>
                {data.ctgTrend[0].rate < data.ctgTrend[data.ctgTrend.length - 1].rate ? 'WORSENING' : 'IMPROVING'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {data.ctgTrend[data.ctgTrend.length - 1].rate} per 10K (was {data.ctgTrend[0].rate} in {data.ctgTrend[0].period.split('-')[0]})
              </div>
            </div>
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 text-center">
              <div className="text-xs font-black text-amber-500 uppercase tracking-wider mb-1">National Status</div>
              <div className="text-2xl font-black text-amber-600">
                {cv('ctg_target11_indigenous_detention_rate', 'National') !== null ? 'NO CHANGE' : '—'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {cv('ctg_target11_indigenous_detention_rate', 'National') ?? '—'} per 10K
              </div>
            </div>
            <div className="bg-gray-50 border-2 border-gray-300 rounded-xl p-5 text-center">
              <div className="text-xs font-black text-gray-500 uppercase tracking-wider mb-1">Target (2031)</div>
              <div className="text-2xl font-black text-gray-600">-30%</div>
              <div className="text-xs text-gray-500 mt-1">Need 22.3 per 10K nationally</div>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
            <h3 className="text-sm font-black text-bauhaus-black uppercase tracking-wider mb-3">
              {abbr} First Nations Detention Rate Trend
            </h3>
            <div className="space-y-2">
              {data.ctgTrend.map((y, i) => (
                <div key={y.period} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-16 shrink-0">{y.period}</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-3">
                    <div className={`rounded-full h-3 ${y.rate > 35 ? 'bg-red-500' : y.rate > 25 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                      style={{ width: `${(y.rate / 50) * 100}%` }} />
                  </div>
                  <span className="text-xs font-bold text-gray-700 w-8 text-right">{y.rate}</span>
                  {y.notes && <span className="text-[10px] text-gray-400 w-28">{y.notes}</span>}
                  {i === 0 && !y.notes && <span className="text-[10px] text-blue-500 w-28">Baseline</span>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Oversight & Accountability */}
      {hasOversight && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-red pb-2">
            Oversight &amp; Accountability
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">
            What oversight bodies have found — and whether anyone listened.
          </p>

          {hrOverrides.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
              <h3 className="text-sm font-black text-red-600 uppercase tracking-wider mb-3">Human Rights Act Overrides</h3>
              <div className="space-y-3">
                {hrOverrides.map((o, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="shrink-0 w-2 h-2 rounded-full bg-red-500 mt-1.5" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{fmtDate(o.event_date)}</span>
                        <span className="text-xs font-bold text-gray-800">{o.title}</span>
                        {o.metadata && (o.metadata as Record<string, string>).duration && (
                          <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">
                            {(o.metadata as Record<string, string>).duration}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">{o.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(oversightByBody).length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {Object.entries(oversightByBody).map(([body, recs]) => (
                <div key={body} className="border border-gray-200 rounded-xl p-5">
                  <h4 className="text-xs font-black text-bauhaus-black uppercase tracking-wider mb-2">
                    {BODY_LABELS[body] || body.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </h4>
                  {recs[0]?.report_title && (
                    <div className="text-[10px] text-gray-400 mb-2">
                      {recs[0].report_url ? (
                        <a href={recs[0].report_url} className="text-bauhaus-blue underline" target="_blank" rel="noopener">{recs[0].report_title}</a>
                      ) : recs[0].report_title}
                    </div>
                  )}
                  <ul className="space-y-1.5 text-xs text-gray-700">
                    {recs.slice(0, 4).map((r, i) => (
                      <li key={i} className="flex gap-2">
                        <span className={`font-bold shrink-0 ${
                          r.status === 'not_implemented' || r.status === 'rejected' ? 'text-red-500' :
                          r.status === 'partial' || r.status === 'partially_implemented' ? 'text-amber-500' :
                          r.status === 'implemented' ? 'text-emerald-500' : 'text-gray-400'
                        }`}>&bull;</span>
                        <span>{r.recommendation_text}</span>
                      </li>
                    ))}
                    {recs.length > 4 && (
                      <li className="text-[10px] text-gray-400">+{recs.length - 4} more recommendations</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Budget Commitments */}
      {hasBudget && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
            {++sectionNum}. Budget Commitments
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">Current-term programs from {abbr} Budget Service Delivery Statements.</p>

          {data.budgetTotals.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-4">
              {data.budgetTotals.map((t, i) => (
                <div key={i} className="bg-gray-100 border border-gray-200 rounded-lg px-4 py-2">
                  <span className="text-xs font-bold text-gray-500 uppercase">{t.financial_year}</span>
                  <span className="ml-2 text-sm font-black">{money(t.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {programItems.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-bauhaus-black">
                    <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Program / Delivery Partner</th>
                    <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Amount</th>
                    <th className="text-right py-2 font-black uppercase tracking-wider text-xs">FY</th>
                  </tr>
                </thead>
                <tbody>
                  {programItems.map((b, i) => {
                    const budgetKey = b.program_name.toLowerCase();
                    const budgetWords = budgetKey.split(/\s+/).slice(0, 2).join(' ');
                    const partners: PartnerRow[] = [];
                    const seen = new Set<string>();
                    for (const [progName, rows] of Object.entries(data.partnersByProgram)) {
                      const pk = progName.toLowerCase();
                      if (pk.includes(budgetKey) || budgetKey.includes(pk)
                        || pk.split(/\s+/).slice(0, 2).join(' ') === budgetWords) {
                        for (const r of rows) {
                          const key = r.recipient_name;
                          if (!seen.has(key)) { seen.add(key); partners.push(r); }
                        }
                      }
                    }
                    const shown = partners.slice(0, 10);
                    const remaining = partners.length - shown.length;
                    return (
                      <Fragment key={i}>
                        <tr className="border-b border-gray-200 bg-gray-50/80">
                          <td className="py-2 font-bold">{b.program_name}</td>
                          <td className="py-2 text-right font-black">{money(b.amount)}</td>
                          <td className="py-2 text-right text-gray-600">{b.financial_year}</td>
                        </tr>
                        {shown.map((pt, j) => (
                          <tr key={`${i}-${j}`} className="border-b border-gray-100 hover:bg-blue-50/50">
                            <td className="py-1.5 pl-6">
                              <span className="text-gray-400 mr-1.5">&rarr;</span>
                              {pt.gs_id ? (
                                <Link href={`/entity/${pt.gs_id}`} className="text-bauhaus-blue hover:underline">{pt.recipient_name}</Link>
                              ) : (
                                <span className="text-gray-700">{pt.recipient_name}</span>
                              )}
                              {pt.is_community_controlled && (
                                <span className="ml-1.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded uppercase">ACCO</span>
                              )}
                            </td>
                            <td className="py-1.5 text-right">{money(pt.total)}</td>
                            <td />
                          </tr>
                        ))}
                        {remaining > 0 && (
                          <tr className="border-b border-gray-200">
                            <td className="py-1.5 pl-6 text-xs text-gray-400 italic" colSpan={3}>+ {remaining} more delivery partners</td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Who Gets the Money */}
      {hasOrgs && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
            {++sectionNum}. Who Gets the Money
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">Top funded organisations across all {abbr} youth justice programs.</p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-bauhaus-black">
                  <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Organisation</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Grants</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.topOrgs.map((o, i) => (
                  <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-2">
                      {o.gs_id ? (
                        <Link href={`/entity/${o.gs_id}`} className="font-medium text-bauhaus-blue hover:underline">{o.recipient_name}</Link>
                      ) : (
                        <span className="font-medium">{o.recipient_name}</span>
                      )}
                    </td>
                    <td className="py-2 text-right text-gray-600">{fmt(o.grants)}</td>
                    <td className="py-2 text-right font-bold">{money(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Who Runs It */}
      {hasLeadership && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
            {++sectionNum}. Who Runs It
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">Board and leadership for top funded {abbr} youth justice organisations.</p>

          <div className="space-y-4">
            {data.leadership.map((org, i) => {
              const directors = parseDirectors(org.directors);
              return (
                <div key={i} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      {org.gs_id ? (
                        <Link href={`/entity/${org.gs_id}`} className="font-bold text-bauhaus-blue hover:underline">{org.recipient_name}</Link>
                      ) : (
                        <span className="font-bold">{org.recipient_name}</span>
                      )}
                      {org.is_community_controlled && (
                        <span className="ml-2 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase">ACCO</span>
                      )}
                    </div>
                    <span className="text-sm font-bold text-gray-600">{money(org.total_funded)}</span>
                  </div>
                  {directors.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {directors.slice(0, 8).map((d, j) => (
                        <span key={j} className="text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                          {d.name}{d.role ? ` (${d.role})` : ''}
                        </span>
                      ))}
                      {directors.length > 8 && <span className="text-[11px] text-gray-400">+{directors.length - 8} more</span>}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 italic">No leadership data</span>
                  )}
                </div>
              );
            })}
          </div>

          {data.interlocks.length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-black text-bauhaus-muted uppercase tracking-wider mb-3">Board Interlocks</h3>
              <p className="text-xs text-gray-500 mb-3">People serving on boards of multiple {abbr} youth justice funded organisations.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-bauhaus-black">
                      <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Person</th>
                      <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Boards</th>
                      <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Organisations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.interlocks.map((il, i) => {
                      const orgs = parseOrgs(il.organisations);
                      return (
                        <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="py-2 font-medium">{il.person_name}</td>
                          <td className="py-2 text-right font-bold">{il.board_count}</td>
                          <td className="py-2 text-gray-600 text-xs">
                            {orgs.length > 0 ? orgs.map(o => o.canonical_name).join(', ') : il.organisations.substring(0, 200)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Where the Money Goes */}
      {hasLga && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
            {++sectionNum}. Where the Money Goes
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">Funding by Local Government Area with SEIFA disadvantage overlay.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-bauhaus-black">
                  <th className="text-left py-2 font-black uppercase tracking-wider text-xs">LGA</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Orgs</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Total Funding</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">SEIFA</th>
                </tr>
              </thead>
              <tbody>
                {data.lgaFunding.map((l, i) => (
                  <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-2 font-medium">{l.lga_name}</td>
                    <td className="py-2 text-right text-gray-600">{l.orgs}</td>
                    <td className="py-2 text-right font-bold">{money(l.total_funding)}</td>
                    <td className="py-2 text-right">
                      {l.seifa_decile != null ? (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          l.seifa_decile <= 3 ? 'bg-red-100 text-red-700' :
                          l.seifa_decile <= 6 ? 'bg-amber-100 text-amber-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>{l.seifa_decile}</span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Evidence & Accountability */}
      {hasEvidence && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
            {++sectionNum}. Evidence &amp; Accountability
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">
            Australian Living Map of Alternatives (ALMA) evidence for {abbr} youth justice programs.
          </p>

          {data.coverage && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-4">
              <div className="flex items-center gap-4 mb-3">
                <span className="text-sm font-bold">{data.coverage.with_evidence} of {data.coverage.total_interventions} interventions have formal evidence</span>
                <span className="text-sm font-black text-emerald-600">{data.coverage.coverage_pct}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-emerald-500 rounded-full h-3 transition-all" style={{ width: `${data.coverage.coverage_pct}%` }} />
              </div>
            </div>
          )}

          {data.almaInterventions.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.almaInterventions.map((a, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 hover:border-bauhaus-blue transition-colors">
                  <div className="font-bold text-sm mb-1">{a.name}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {a.type && <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase">{a.type}</span>}
                    {a.evidence_level && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase">{a.evidence_level}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Political Context */}
      {hasPolitical && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
            {++sectionNum}. Political Context
          </h2>

          {data.hansard.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-black text-bauhaus-muted uppercase tracking-wider mb-3">{abbr} Hansard Mentions</h3>
              <div className="space-y-3">
                {data.hansard.map((h, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm">{h.speaker_name}</span>
                      {h.speaker_party && <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded uppercase">{h.speaker_party}</span>}
                      {h.speaker_electorate && <span className="text-[10px] text-gray-500">{h.speaker_electorate}</span>}
                      <span className="text-[10px] text-gray-400 ml-auto">{h.sitting_date}</span>
                    </div>
                    {h.subject && <div className="text-xs font-bold text-bauhaus-blue mb-1">{h.subject}</div>}
                    <div className="text-xs text-gray-600 leading-relaxed">{h.excerpt}...</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.lobbying.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-black text-bauhaus-muted uppercase tracking-wider mb-3">Federal Lobbying Connections</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-bauhaus-black">
                      <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Entity</th>
                      <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Lobbyist</th>
                      <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Client</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lobbying.map((l, i) => (
                      <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="py-2">
                          {l.gs_id ? (
                            <Link href={`/entity/${l.gs_id}`} className="font-medium text-bauhaus-blue hover:underline">{l.canonical_name}</Link>
                          ) : (
                            <span className="font-medium">{l.canonical_name}</span>
                          )}
                        </td>
                        <td className="py-2 text-gray-600">{l.lobbyist_name || '—'}</td>
                        <td className="py-2 text-gray-600">{l.client_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.revolvingDoor.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-black text-bauhaus-muted uppercase tracking-wider mb-3">Revolving Door</h3>
              <p className="text-xs text-gray-500 mb-3">Organisations with multiple influence vectors: donations, contracts, lobbying, funding.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-bauhaus-black">
                      <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Organisation</th>
                      <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Score</th>
                      <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Donated</th>
                      <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Contracts</th>
                      <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Funded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.revolvingDoor.map((r, i) => (
                      <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="py-2 font-medium">
                          {r.canonical_name}
                          {r.is_community_controlled && (
                            <span className="ml-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded uppercase">ACCO</span>
                          )}
                        </td>
                        <td className="py-2 text-right font-bold">{r.revolving_door_score}</td>
                        <td className="py-2 text-right text-gray-600">{money(r.total_donated)}</td>
                        <td className="py-2 text-right text-gray-600">{money(r.total_contracts)}</td>
                        <td className="py-2 text-right text-gray-600">{money(r.total_funded)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.donations.length > 0 && (
            <div>
              <h3 className="text-sm font-black text-bauhaus-muted uppercase tracking-wider mb-3">Political Donations by Funded Orgs</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-bauhaus-black">
                      <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Donor</th>
                      <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Recipient</th>
                      <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Total</th>
                      <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Period</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.donations.map((d, i) => (
                      <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="py-2 font-medium">{d.donor_name}</td>
                        <td className="py-2 text-gray-600">{d.donation_to}</td>
                        <td className="py-2 text-right font-bold">{money(d.total)}</td>
                        <td className="py-2 text-right text-gray-500 text-xs">{d.from_fy}&ndash;{d.to_fy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Graph Link */}
      <section className="mb-12">
        <div className="bg-bauhaus-black text-white rounded-xl p-6 flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Network Graph</div>
            <div className="text-lg font-black">Follow the Dollar: {abbr} Youth Justice</div>
            <p className="text-sm text-gray-400 mt-1">Trace funding flows from budget to recipients, contracts, and lobbying connections</p>
          </div>
          <Link
            href={`/graph?preset=${encodeURIComponent(`${abbr} Youth Justice`)}`}
            className="bg-bauhaus-red text-white font-black uppercase tracking-wider text-sm px-5 py-3 rounded hover:bg-red-700 transition-colors whitespace-nowrap"
          >
            Open Graph
          </Link>
        </div>
      </section>

      {/* National Comparison Link */}
      <section className="mb-12 text-center">
        <Link href="/reports/youth-justice/national"
          className="inline-block border-2 border-bauhaus-black text-bauhaus-black font-black uppercase tracking-wider text-sm px-6 py-3 rounded hover:bg-bauhaus-black hover:text-white transition-colors">
          View National Comparison &rarr;
        </Link>
      </section>

      {/* Footer */}
      <div className="text-xs text-gray-400 text-center pb-8">
        Data sources: AIHW Youth Justice 2023-24, ROGS 2026, Closing the Gap Dashboard, state reports, ACNC, AusTender, ALMA, Hansard, Federal Lobbying Register, AEC Donations.
        All metrics for 2023-24 unless noted.
      </div>
    </div>
  );
}
