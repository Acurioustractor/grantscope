import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getStateDomainFunding,
  getOutcomesMetrics,
  getPolicyTimeline,
  getOversightSummary,
  getCrossDomainOrgs,
  getAlmaCount,
  money,
  fmt,
} from '@/lib/services/report-service';
import { getServiceSupabase } from '@/lib/report-supabase';
import { safe } from '@/lib/services/utils';

export const revalidate = 3600;

const STATE_META: Record<string, { name: string; description: string }> = {
  qld: { name: 'Queensland', description: 'Cross-system view of youth justice, child protection, disability, and education funding and outcomes across Queensland.' },
  nsw: { name: 'New South Wales', description: 'Cross-system view spanning youth justice, child protection, disability, and education across NSW — Australia\'s largest human services jurisdiction.' },
  vic: { name: 'Victoria', description: 'Cross-domain intelligence across youth justice, child protection, disability, and education in Victoria.' },
  wa: { name: 'Western Australia', description: 'Cross-system funding and outcomes across youth justice, child protection, disability, and education in WA.' },
  sa: { name: 'South Australia', description: 'Cross-domain view of youth justice, child protection, disability, and education in South Australia.' },
  nt: { name: 'Northern Territory', description: 'Cross-system intelligence across the NT — where disadvantage is deepest and systems most intertwined.' },
  tas: { name: 'Tasmania', description: 'Cross-domain view of human services funding and outcomes in Tasmania.' },
  act: { name: 'Australian Capital Territory', description: 'Cross-system view of human services in the ACT — small jurisdiction, tight connections.' },
};

const STATES = Object.keys(STATE_META);

export function generateStaticParams() {
  return STATES.map(state => ({ state }));
}

export function generateMetadata({ params }: { params: Promise<{ state: string }> }) {
  return params.then(({ state }) => {
    const meta = STATE_META[state.toLowerCase()];
    if (!meta) return { title: 'Not Found' };
    return { title: `${meta.name} — Cross-Domain Intelligence — CivicGraph` };
  });
}

type PolicyRow = {
  event_date: string; title: string; description: string;
  event_type: string; severity: string; source: string | null;
  impact_summary: string | null; metadata: Record<string, unknown> | null;
};

type SchoolRow = {
  total_schools: number; avg_icsea: number; total_enrolments: number;
  avg_indigenous_pct: number; low_icsea_schools: number;
};

type MetricRow = {
  metric_name: string; metric_value: number; metric_unit: string;
  period: string; cohort: string | null; source: string; notes: string | null;
};

const DOMAINS = [
  { key: 'youth-justice', label: 'Youth Justice', color: 'red', href: 'youth-justice' },
  { key: 'child-protection', label: 'Child Protection', color: 'amber', href: 'child-protection' },
  { key: 'disability', label: 'Disability', color: 'blue', href: 'disability' },
  { key: 'education', label: 'Education', color: 'emerald', href: 'education' },
] as const;

const DOMAIN_COLORS: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  'youth-justice': { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', badge: 'bg-red-100 text-red-700' },
  'child-protection': { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
  'disability': { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
  'education': { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
  'ndis': { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
  'family-services': { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700' },
  'indigenous': { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700' },
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  legislation: 'bg-blue-100 text-blue-700',
  inquiry: 'bg-red-100 text-red-700',
  report: 'bg-amber-100 text-amber-700',
  framework: 'bg-emerald-100 text-emerald-700',
  budget: 'bg-purple-100 text-purple-700',
  announcement: 'bg-gray-100 text-gray-700',
  amendment: 'bg-blue-100 text-blue-700',
  facility: 'bg-orange-100 text-orange-700',
  election: 'bg-pink-100 text-pink-700',
  human_rights_override: 'bg-red-100 text-red-800',
};

const STATUS_COLORS: Record<string, string> = {
  implemented: 'bg-emerald-100 text-emerald-700',
  partially_implemented: 'bg-amber-100 text-amber-700',
  pending: 'bg-gray-100 text-gray-600',
  accepted: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  superseded: 'bg-gray-100 text-gray-500',
  unknown: 'bg-gray-100 text-gray-400',
};

async function getSchoolSummary(stateCode: string) {
  const supabase = getServiceSupabase();
  const sc = stateCode.toUpperCase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT COUNT(*)::int as total_schools,
              ROUND(AVG(icsea_value))::int as avg_icsea,
              SUM(total_enrolments)::int as total_enrolments,
              ROUND(AVG(indigenous_pct)::numeric, 1)::float as avg_indigenous_pct,
              COUNT(*) FILTER (WHERE icsea_value < 900)::int as low_icsea_schools
       FROM acara_schools WHERE state = '${sc}'`,
  })) as Promise<SchoolRow[] | null>;
}

async function getStateReport(stateCode: string) {
  const sc = stateCode.toUpperCase();

  const [
    domainFunding,
    yjOutcomes, cpOutcomes, disOutcomes, eduOutcomes,
    yjPolicy, cpPolicy, disPolicy, eduPolicy,
    natYjPolicy, natCpPolicy, natDisPolicy, natEduPolicy,
    oversightSummary,
    crossDomainOrgs,
    yjAlma, cpAlma, disAlma,
    schoolSummary,
  ] = await Promise.all([
    getStateDomainFunding(sc),
    getOutcomesMetrics(sc, 'youth-justice'),
    getOutcomesMetrics(sc, 'child-protection'),
    getOutcomesMetrics(sc, 'disability'),
    getOutcomesMetrics(sc, 'education'),
    getPolicyTimeline(sc, 'youth-justice'),
    getPolicyTimeline(sc, 'child-protection'),
    getPolicyTimeline(sc, 'disability'),
    getPolicyTimeline(sc, 'education'),
    getPolicyTimeline('National', 'youth-justice'),
    getPolicyTimeline('National', 'child-protection'),
    getPolicyTimeline('National', 'disability'),
    getPolicyTimeline('National', 'education'),
    getOversightSummary(sc),
    getCrossDomainOrgs(sc),
    getAlmaCount('youth-justice', sc),
    getAlmaCount('child-protection', sc),
    getAlmaCount('ndis', sc),
    getSchoolSummary(sc),
  ]);

  // Merge all policy events and tag with domain
  const tagPolicy = (rows: PolicyRow[] | null, domain: string, jurisdiction: string) =>
    (rows || []).map(r => ({ ...r, domain, jurisdiction }));

  const allPolicy = [
    ...tagPolicy(yjPolicy, 'youth-justice', sc),
    ...tagPolicy(cpPolicy, 'child-protection', sc),
    ...tagPolicy(disPolicy, 'disability', sc),
    ...tagPolicy(eduPolicy, 'education', sc),
    ...tagPolicy(natYjPolicy, 'youth-justice', 'National'),
    ...tagPolicy(natCpPolicy, 'child-protection', 'National'),
    ...tagPolicy(natDisPolicy, 'disability', 'National'),
    ...tagPolicy(natEduPolicy, 'education', 'National'),
  ].sort((a, b) => b.event_date.localeCompare(a.event_date));

  // Build outcomes by domain
  const outcomes: Record<string, MetricRow[]> = {
    'youth-justice': (yjOutcomes || []) as MetricRow[],
    'child-protection': (cpOutcomes || []) as MetricRow[],
    'disability': (disOutcomes || []) as MetricRow[],
    'education': (eduOutcomes || []) as MetricRow[],
  };

  return {
    domainFunding,
    outcomes,
    policyTimeline: allPolicy,
    oversight: (oversightSummary || []) as Array<{ domain: string; total: number; implemented: number; partial: number; pending: number; rejected: number }>,
    crossDomainOrgs,
    almaByDomain: {
      'youth-justice': yjAlma,
      'child-protection': cpAlma,
      'disability': disAlma,
    } as Record<string, number>,
    school: ((schoolSummary as SchoolRow[] | null) || [])[0] || null,
  };
}

export default async function CrossDomainStatePage({ params }: { params: Promise<{ state: string }> }) {
  const { state: stateParam } = await params;
  const stateKey = stateParam.toLowerCase();
  const meta = STATE_META[stateKey];
  if (!meta) notFound();

  const stateCode = stateKey.toUpperCase();
  const report = await getStateReport(stateCode);

  // Metric lookup helper
  const m = (domain: string, name: string): number | null => {
    const rows = report.outcomes[domain] || [];
    const row = rows.find(r => r.metric_name === name && (r.cohort === 'all' || r.cohort === null));
    return row?.metric_value ?? rows.find(r => r.metric_name === name)?.metric_value ?? null;
  };

  // Domain funding sorted by total
  const domainCards = report.domainFunding?.domains
    .filter(d => d.total > 0 || d.grants > 0)
    .sort((a, b) => b.total - a.total) ?? [];

  // Oversight totals
  const oversightTotals = report.oversight.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      implemented: acc.implemented + r.implemented,
      partial: acc.partial + r.partial,
      pending: acc.pending + r.pending,
    }),
    { total: 0, implemented: 0, partial: 0, pending: 0 }
  );
  const implementationRate = oversightTotals.total
    ? Math.round(((oversightTotals.implemented + oversightTotals.partial * 0.5) / oversightTotals.total) * 100)
    : 0;

  // Key metrics per domain for the scorecard
  type ScorecardMetric = { label: string; value: string | null; alert?: boolean };
  const scorecard: Record<string, ScorecardMetric[]> = {
    'youth-justice': [
      { label: 'Detention rate', value: m('youth-justice', 'detention_rate_per_10k') != null ? `${m('youth-justice', 'detention_rate_per_10k')}/10K` : null },
      { label: 'Daily detention', value: m('youth-justice', 'avg_daily_detention')?.toLocaleString() ?? null },
      { label: 'First Nations overrep.', value: m('youth-justice', 'indigenous_overrepresentation_ratio') != null ? `${m('youth-justice', 'indigenous_overrepresentation_ratio')}x` : null, alert: (m('youth-justice', 'indigenous_overrepresentation_ratio') ?? 0) > 15 },
      { label: 'Recidivism (12m)', value: m('youth-justice', 'rogs_yj_recidivism_12m') != null ? `${m('youth-justice', 'rogs_yj_recidivism_12m')}%` : null, alert: (m('youth-justice', 'rogs_yj_recidivism_12m') ?? 0) > 60 },
    ],
    'child-protection': [
      { label: 'Notifications', value: m('child-protection', 'rogs_cp_notifications')?.toLocaleString() ?? null },
      { label: 'Substantiation rate', value: m('child-protection', 'rogs_cp_substantiation_rate') != null ? `${m('child-protection', 'rogs_cp_substantiation_rate')}%` : null },
      { label: 'Children in OOHC', value: m('child-protection', 'rogs_cp_oohc_on_orders')?.toLocaleString() ?? null },
      { label: 'Resubstantiation', value: m('child-protection', 'rogs_cp_resubstantiation_12m') != null ? `${m('child-protection', 'rogs_cp_resubstantiation_12m')}%` : null, alert: (m('child-protection', 'rogs_cp_resubstantiation_12m') ?? 0) > 15 },
    ],
    'disability': [
      { label: 'NDIS participation', value: m('disability', 'rogs_dis_participation_rate') != null ? `${m('disability', 'rogs_dis_participation_rate')}/1K` : null },
      { label: 'NDIS expenditure', value: m('disability', 'rogs_dis_ndis_expenditure') != null ? money(m('disability', 'rogs_dis_ndis_expenditure')!) : null },
      { label: 'Plan satisfaction', value: m('disability', 'rogs_dis_satisfaction_plan') != null ? `${m('disability', 'rogs_dis_satisfaction_plan')}%` : null },
      { label: 'Indigenous utilisation', value: m('disability', 'rogs_dis_utilisation_indigenous') != null ? `${m('disability', 'rogs_dis_utilisation_indigenous')}%` : null },
    ],
    'education': [
      { label: 'Attendance', value: m('education', 'rogs_edu_attendance_all') != null ? `${m('education', 'rogs_edu_attendance_all')}%` : null, alert: (m('education', 'rogs_edu_attendance_all') ?? 100) < 80 },
      { label: 'Year 12 retention', value: m('education', 'rogs_edu_retention_yr12') != null ? `${m('education', 'rogs_edu_retention_yr12')}%` : null },
      { label: 'Avg ICSEA', value: report.school?.avg_icsea != null ? String(report.school.avg_icsea) : null, alert: (report.school?.avg_icsea ?? 1000) < 950 },
      { label: 'Low-ICSEA schools', value: report.school?.low_icsea_schools?.toLocaleString() ?? null },
    ],
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <Link href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; Reports
        </Link>
        <div className="flex items-center gap-3 mt-4 mb-2">
          <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">Cross-Domain Intelligence</span>
          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-bauhaus-black text-white">{stateCode}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          {meta.name}
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          {meta.description}
        </p>

        {/* Domain quick links */}
        <div className="flex flex-wrap gap-2 mt-4">
          {DOMAINS.map(d => (
            <Link
              key={d.key}
              href={`/reports/${d.href}/${stateKey}`}
              className={`text-[10px] font-bold ${DOMAIN_COLORS[d.key].badge} px-2 py-1 rounded uppercase tracking-wider hover:opacity-80 transition-opacity`}
            >
              {d.label}
            </Link>
          ))}
        </div>

        {/* State navigation */}
        <div className="flex flex-wrap gap-2 mt-4">
          {STATES.map(s => (
            <Link
              key={s}
              href={`/reports/${s}`}
              className={`text-xs font-black uppercase tracking-wider px-3 py-1.5 border-2 border-bauhaus-black rounded transition-colors ${s === stateKey ? 'bg-bauhaus-black text-white' : 'hover:bg-bauhaus-black hover:text-white'}`}
            >
              {s.toUpperCase()}
            </Link>
          ))}
        </div>
      </div>

      {/* Headline Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-gray-800">{money(report.domainFunding?.grandTotal ?? 0)}</div>
          <div className="text-xs text-gray-500 mt-1">Total Justice Funding</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-gray-800">{fmt(report.domainFunding?.totalOrgs ?? 0)}</div>
          <div className="text-xs text-gray-500 mt-1">Funded Organisations</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-gray-800">{report.crossDomainOrgs.length}</div>
          <div className="text-xs text-gray-500 mt-1">Cross-Domain Orgs</div>
        </div>
        <div className={`rounded-xl p-5 text-center ${implementationRate < 40 ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <div className={`text-2xl sm:text-3xl font-black ${implementationRate < 40 ? 'text-red-600' : 'text-emerald-600'}`}>{implementationRate}%</div>
          <div className="text-xs text-gray-500 mt-1">Oversight Implementation</div>
        </div>
      </div>

      {/* Domain Funding Breakdown */}
      {domainCards.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-4 border-b-4 border-bauhaus-red pb-2">
            Funding by Domain
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {domainCards.map(d => {
              const colors = DOMAIN_COLORS[d.topic] || DOMAIN_COLORS['youth-justice'];
              const domainDef = DOMAINS.find(dd => dd.key === d.topic);
              const href = domainDef ? `/reports/${domainDef.href}/${stateKey}` : null;
              const pct = report.domainFunding?.grandTotal
                ? Math.round((d.total / report.domainFunding.grandTotal) * 100)
                : 0;
              return (
                <div key={d.topic} className={`${colors.bg} ${colors.border} border rounded-xl p-5`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-black ${colors.text} uppercase tracking-wider`}>{d.label}</span>
                    <span className="text-[10px] font-bold text-gray-400">{pct}%</span>
                  </div>
                  <div className="text-2xl font-black text-gray-800">{money(d.total)}</div>
                  <div className="text-xs text-gray-500 mt-1">{fmt(d.grants)} grants &middot; {fmt(d.orgs)} orgs</div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3">
                    <div className={`${colors.text.replace('text-', 'bg-')} rounded-full h-1.5`} style={{ width: `${pct}%` }} />
                  </div>
                  {href && (
                    <Link href={href} className={`text-[10px] ${colors.text} font-bold mt-2 inline-block hover:underline`}>
                      View deep dive &rarr;
                    </Link>
                  )}
                </div>
              );
            })}
            {/* Education card — no justice_funding, uses school data */}
            {report.school && (
              <div className={`${DOMAIN_COLORS.education.bg} ${DOMAIN_COLORS.education.border} border rounded-xl p-5`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-black ${DOMAIN_COLORS.education.text} uppercase tracking-wider`}>Education</span>
                  <span className="text-[10px] font-bold text-gray-400">schools</span>
                </div>
                <div className="text-2xl font-black text-gray-800">{fmt(report.school.total_schools)}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {fmt(report.school.total_enrolments)} students &middot; avg ICSEA {report.school.avg_icsea}
                </div>
                {report.school.low_icsea_schools > 0 && (
                  <div className="text-xs text-red-600 font-bold mt-1">
                    {fmt(report.school.low_icsea_schools)} schools below ICSEA 900
                  </div>
                )}
                <Link href={`/reports/education/${stateKey}`} className={`text-[10px] ${DOMAIN_COLORS.education.text} font-bold mt-2 inline-block hover:underline`}>
                  View deep dive &rarr;
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Domain Scorecard */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-4 border-b-4 border-bauhaus-black pb-2">
          Domain Scorecard
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">Key metrics from each domain — AIHW, ROGS, ACARA. Gaps indicate missing data, not missing problems.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DOMAINS.map(d => {
            const metrics = scorecard[d.key] || [];
            const hasData = metrics.some(mm => mm.value !== null);
            if (!hasData) return null;
            const colors = DOMAIN_COLORS[d.key];
            const almaCount = report.almaByDomain[d.key === 'disability' ? 'disability' : d.key] ?? 0;
            return (
              <div key={d.key} className={`${colors.bg} ${colors.border} border rounded-xl p-5`}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-black ${colors.text} uppercase tracking-wider`}>{d.label}</span>
                  {almaCount > 0 && (
                    <span className="text-[10px] font-bold bg-white/60 text-gray-600 px-1.5 py-0.5 rounded">{almaCount} ALMA</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {metrics.filter(mm => mm.value !== null).map(mm => (
                    <div key={mm.label} className="text-center bg-white/50 rounded-lg p-2">
                      <div className={`text-lg font-black ${mm.alert ? 'text-red-600' : 'text-gray-800'}`}>{mm.value}</div>
                      <div className="text-[10px] text-gray-500">{mm.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }).filter(Boolean)}
        </div>
      </section>

      {/* Cross-Domain Organisations */}
      {report.crossDomainOrgs.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-red pb-2">
            Cross-Domain Organisations
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">
            Organisations operating across 2+ policy domains in {meta.name} — the connective tissue between systems.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-bauhaus-black">
                  <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Organisation</th>
                  <th className="text-center py-2 font-black uppercase tracking-wider text-xs">Domains</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Total Funding</th>
                </tr>
              </thead>
              <tbody>
                {report.crossDomainOrgs.map((org, i) => (
                  <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-2">
                      <Link href={`/entity/${org.gs_id}`} className="font-medium text-bauhaus-blue hover:underline">
                        {org.canonical_name}
                      </Link>
                      {org.is_community_controlled && (
                        <span className="ml-1.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded uppercase">ACCO</span>
                      )}
                    </td>
                    <td className="py-2 text-center">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {org.domain_labels.map((dl: string, j: number) => {
                          const domainKey = org.domains[j];
                          const c = DOMAIN_COLORS[domainKey] || { badge: 'bg-gray-100 text-gray-700' };
                          return (
                            <span key={j} className={`text-[9px] font-bold ${c.badge} px-1.5 py-0.5 rounded uppercase`}>
                              {dl}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-2 text-right font-bold">{money(org.total_funding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Oversight Implementation Dashboard */}
      {report.oversight.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
            Oversight Implementation
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">
            How well {meta.name} is implementing oversight recommendations across all domains.
          </p>

          {/* Overall bar */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold">{oversightTotals.implemented + oversightTotals.partial} of {oversightTotals.total} recommendations progressed</span>
              <span className={`text-sm font-black ${implementationRate < 40 ? 'text-red-600' : 'text-emerald-600'}`}>{implementationRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden flex">
              {oversightTotals.total > 0 && (
                <>
                  <div className="bg-emerald-500 h-3" style={{ width: `${(oversightTotals.implemented / oversightTotals.total) * 100}%` }} />
                  <div className="bg-amber-400 h-3" style={{ width: `${(oversightTotals.partial / oversightTotals.total) * 100}%` }} />
                  <div className="bg-gray-300 h-3" style={{ width: `${(oversightTotals.pending / oversightTotals.total) * 100}%` }} />
                </>
              )}
            </div>
            <div className="flex gap-4 text-[10px] text-gray-500 mt-2">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Implemented ({oversightTotals.implemented})</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Partial ({oversightTotals.partial})</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> Pending ({oversightTotals.pending})</span>
            </div>
          </div>

          {/* Per-domain breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {report.oversight.map(ov => {
              const colors = DOMAIN_COLORS[ov.domain] || DOMAIN_COLORS['youth-justice'];
              const domainLabel = DOMAINS.find(d => d.key === ov.domain)?.label || ov.domain;
              const rate = ov.total ? Math.round(((ov.implemented + ov.partial * 0.5) / ov.total) * 100) : 0;
              return (
                <div key={ov.domain} className={`${colors.bg} ${colors.border} border rounded-xl p-4`}>
                  <div className={`text-[10px] font-black ${colors.text} uppercase tracking-wider mb-2`}>{domainLabel}</div>
                  <div className="text-xl font-black text-gray-800">{rate}%</div>
                  <div className="text-[10px] text-gray-500">{ov.implemented} done, {ov.partial} partial, {ov.pending} pending</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{ov.total} total recommendations</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Combined Policy Timeline */}
      {report.policyTimeline.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
            Policy Timeline
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">
            Key policy events across all domains affecting {meta.name}. National events marked separately.
          </p>
          <div className="space-y-0">
            {report.policyTimeline.slice(0, 30).map((ev, i) => {
              const domainColors = DOMAIN_COLORS[ev.domain] || { badge: 'bg-gray-100 text-gray-700' };
              const typeColor = EVENT_TYPE_COLORS[ev.event_type] || 'bg-gray-100 text-gray-700';
              return (
                <div key={i} className="flex gap-3 py-3 border-b border-gray-100 hover:bg-gray-50/50">
                  <div className="flex-shrink-0 w-20 text-right">
                    <div className="text-xs font-bold text-gray-600">{ev.event_date.slice(0, 4)}</div>
                    <div className="text-[10px] text-gray-400">{ev.event_date.slice(5, 10)}</div>
                  </div>
                  <div className="flex-shrink-0 w-1 rounded-full bg-gray-200 relative">
                    <div className={`absolute top-2 -left-1 w-3 h-3 rounded-full border-2 border-white ${ev.severity === 'critical' ? 'bg-red-500' : ev.severity === 'significant' ? 'bg-amber-500' : 'bg-gray-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <span className={`text-[9px] font-bold ${domainColors.badge} px-1.5 py-0.5 rounded uppercase`}>
                        {DOMAINS.find(d => d.key === ev.domain)?.label || ev.domain}
                      </span>
                      <span className={`text-[9px] font-bold ${typeColor} px-1.5 py-0.5 rounded uppercase`}>{ev.event_type}</span>
                      {ev.jurisdiction === 'National' && (
                        <span className="text-[9px] font-bold bg-gray-800 text-white px-1.5 py-0.5 rounded uppercase">National</span>
                      )}
                    </div>
                    <div className="text-sm font-bold text-gray-800">{ev.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{ev.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {report.policyTimeline.length > 30 && (
            <div className="text-xs text-gray-400 italic mt-2">Showing 30 of {report.policyTimeline.length} events</div>
          )}
        </section>
      )}

      {/* Domain Deep Dive Links */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-4 border-b-4 border-bauhaus-black pb-2">
          Domain Deep Dives
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DOMAINS.map(d => {
            const colors = DOMAIN_COLORS[d.key];
            const metricCount = (report.outcomes[d.key] || []).length;
            return (
              <Link
                key={d.key}
                href={`/reports/${d.href}/${stateKey}`}
                className={`${colors.bg} ${colors.border} border rounded-xl p-5 hover:shadow-md transition-shadow block`}
              >
                <div className={`text-xs font-black ${colors.text} uppercase tracking-wider mb-1`}>{d.label}</div>
                <div className="text-lg font-black text-gray-800">{meta.name} {d.label}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {metricCount > 0 ? `${metricCount} outcome metrics` : 'Funding, programmes & organisations'}
                  {report.almaByDomain[d.key === 'disability' ? 'disability' : d.key] > 0 &&
                    ` · ${report.almaByDomain[d.key === 'disability' ? 'disability' : d.key]} ALMA interventions`
                  }
                </div>
                <div className={`text-[10px] ${colors.text} font-bold mt-2`}>View full report &rarr;</div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Graph CTA */}
      <section className="mb-12">
        <div className="bg-bauhaus-black text-white rounded-xl p-6 flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Network Graph</div>
            <div className="text-lg font-black">Explore {meta.name} cross-domain funding flows</div>
            <p className="text-sm text-gray-400 mt-1">Interactive force-directed graph showing organisations, programs, and connections</p>
          </div>
          <Link
            href={`/graph?preset=${encodeURIComponent(stateCode + ' Youth Justice')}`}
            className="bg-bauhaus-red text-white font-black uppercase tracking-wider text-sm px-5 py-3 rounded hover:bg-red-700 transition-colors whitespace-nowrap"
          >
            Open Graph
          </Link>
        </div>
      </section>
    </div>
  );
}
