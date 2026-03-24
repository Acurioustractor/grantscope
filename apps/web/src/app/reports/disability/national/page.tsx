import Link from 'next/link';
import {
  getStateComparisonMetrics,
  getOutcomesMetrics,
  getOversightSummary,
  money,
  fmt,
} from '@/lib/services/report-service';

export const revalidate = 3600;

export function generateMetadata() {
  return {
    title: 'National Disability Comparison — CivicGraph',
    description: 'Compare disability services and NDIS outcomes across all Australian states and territories.',
  };
}

type ComparisonRow = { jurisdiction: string; metric_name: string; metric_value: number; metric_unit: string; period: string; cohort: string | null };
type MetricRow = { metric_name: string; metric_value: number; metric_unit: string; period: string; cohort: string | null; source: string; notes: string | null };
type OversightRow = { domain: string; total: number; implemented: number; partial: number; pending: number; rejected: number };

const JURISDICTIONS = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'NT', 'TAS', 'ACT', 'National'] as const;
const STATES = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'NT', 'TAS', 'ACT'] as const;

const COMPARISON_METRICS = [
  'rogs_dis_ndis_expenditure', 'rogs_dis_total_payments', 'rogs_dis_total_expenditure',
  'rogs_dis_participation_rate', 'rogs_dis_satisfaction_plan',
  'rogs_dis_utilisation_indigenous', 'rogs_dis_utilisation_nonindigenous',
  'rogs_dis_utilisation_metro', 'rogs_dis_utilisation_regional', 'rogs_dis_utilisation_remote',
  'rogs_dis_avg_payment_metro', 'rogs_dis_avg_payment_remote', 'rogs_dis_avg_payment_indigenous',
  'rogs_dis_autism_pct', 'rogs_dis_intellectual_pct', 'rogs_dis_psychosocial_pct',
  'rogs_dis_restrictive_physical', 'rogs_dis_restrictive_chemical', 'rogs_dis_restrictive_seclusion',
  'rogs_dis_transport_difficulty_total', 'rogs_dis_transport_difficulty_severe',
];

const METRIC_LABELS: Record<string, { label: string; format?: string; higherIsWorse?: boolean; section?: string }> = {
  rogs_dis_ndis_expenditure: { label: 'NDIS expenditure', format: 'money', section: 'Funding' },
  rogs_dis_total_payments: { label: 'Total NDIS payments ($M)', format: 'number', section: 'Funding' },
  rogs_dis_total_expenditure: { label: 'Total disability expenditure ($M)', format: 'number', section: 'Funding' },
  rogs_dis_participation_rate: { label: 'NDIS participants per 1,000 (0-64)', format: 'number', section: 'Access' },
  rogs_dis_satisfaction_plan: { label: 'Plan implementation satisfaction', format: 'pct', section: 'Access' },
  rogs_dis_utilisation_indigenous: { label: 'Indigenous utilisation rate', format: 'pct', section: 'Access' },
  rogs_dis_utilisation_nonindigenous: { label: 'Non-Indigenous utilisation rate', format: 'pct', section: 'Access' },
  rogs_dis_utilisation_metro: { label: 'Metro utilisation rate', format: 'pct', section: 'Access' },
  rogs_dis_utilisation_regional: { label: 'Regional utilisation rate', format: 'pct', section: 'Access' },
  rogs_dis_utilisation_remote: { label: 'Remote utilisation rate', format: 'pct', section: 'Access' },
  rogs_dis_avg_payment_metro: { label: 'Avg payment (metro, $K)', format: 'number', section: 'Payments' },
  rogs_dis_avg_payment_remote: { label: 'Avg payment (remote, $K)', format: 'number', section: 'Payments' },
  rogs_dis_avg_payment_indigenous: { label: 'Avg payment (Indigenous, $K)', format: 'number', section: 'Payments' },
  rogs_dis_autism_pct: { label: 'Autism %', format: 'pct', section: 'Profile' },
  rogs_dis_intellectual_pct: { label: 'Intellectual disability %', format: 'pct', section: 'Profile' },
  rogs_dis_psychosocial_pct: { label: 'Psychosocial disability %', format: 'pct', section: 'Profile' },
  rogs_dis_restrictive_physical: { label: 'Physical restraint', format: 'number', higherIsWorse: true, section: 'Restrictive Practices' },
  rogs_dis_restrictive_chemical: { label: 'Chemical restraint', format: 'number', higherIsWorse: true, section: 'Restrictive Practices' },
  rogs_dis_restrictive_seclusion: { label: 'Seclusion', format: 'number', higherIsWorse: true, section: 'Restrictive Practices' },
  rogs_dis_transport_difficulty_total: { label: 'Transport difficulty (total)', format: 'pct', section: 'Barriers' },
  rogs_dis_transport_difficulty_severe: { label: 'Transport difficulty (severe)', format: 'pct', higherIsWorse: true, section: 'Barriers' },
};

async function getData() {
  const [comparison, nationalMetrics, oversight] = await Promise.all([
    getStateComparisonMetrics(COMPARISON_METRICS, 'disability'),
    getOutcomesMetrics('National', 'disability'),
    getOversightSummary('National'),
  ]);

  return {
    comparison: (comparison as ComparisonRow[] | null) || [],
    national: (nationalMetrics as MetricRow[] | null) || [],
    oversight: ((oversight as OversightRow[] | null) || []).find(o => o.domain === 'disability') || null,
  };
}

function formatValue(v: number, format?: string): string {
  if (format === 'money') return money(v);
  if (format === 'pct') return `${v}%`;
  return v.toLocaleString();
}

export default async function NationalDisabilityComparisonPage() {
  const data = await getData();

  const comp: Record<string, Record<string, number>> = {};
  for (const row of data.comparison) {
    if (!comp[row.metric_name]) comp[row.metric_name] = {};
    const existing = comp[row.metric_name][row.jurisdiction];
    if (existing === undefined || row.cohort === 'all') {
      comp[row.metric_name][row.jurisdiction] = row.metric_value;
    }
  }
  const cv = (metric: string, jur: string) => comp[metric]?.[jur] ?? null;

  const nm = (name: string) => data.national.find(r => r.metric_name === name)?.metric_value ?? null;

  // Group metrics by section
  const sections = [...new Set(Object.values(METRIC_LABELS).map(m => m.section).filter(Boolean))] as string[];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <Link href="/reports/disability" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; Disability Reports
        </Link>
        <div className="flex items-center gap-3 mt-4 mb-1">
          <span className="text-xs font-black text-blue-600 uppercase tracking-widest">National Comparison</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Australian Disability Services: State by State
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          How does each state compare on NDIS expenditure, utilisation rates, restrictive practices,
          and access barriers? ROGS 2026 data for direct comparison.
        </p>
      </div>

      {/* National Headlines */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-blue-600">{nm('rogs_dis_ndis_expenditure') != null ? money(nm('rogs_dis_ndis_expenditure')!) : '—'}</div>
          <div className="text-xs text-gray-500 mt-1">National NDIS expenditure</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-red-600">{nm('rogs_dis_restrictive_physical')?.toLocaleString() ?? '—'}</div>
          <div className="text-xs text-gray-500 mt-1">Physical restraints</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-amber-600">{nm('rogs_dis_utilisation_remote') != null ? `${nm('rogs_dis_utilisation_remote')}%` : '—'}</div>
          <div className="text-xs text-gray-500 mt-1">Remote utilisation rate</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-emerald-600">{nm('rogs_dis_utilisation_indigenous') != null ? `${nm('rogs_dis_utilisation_indigenous')}%` : '—'}</div>
          <div className="text-xs text-gray-500 mt-1">Indigenous utilisation rate</div>
        </div>
      </div>

      {/* Comparison Tables by Section */}
      {sections.map(section => {
        const sectionMetrics = COMPARISON_METRICS.filter(m => METRIC_LABELS[m]?.section === section);
        const hasData = sectionMetrics.some(m => JURISDICTIONS.some(j => cv(m, j) !== null));
        if (!hasData) return null;
        const isRestrictive = section === 'Restrictive Practices';
        return (
          <section key={section} className="mb-12">
            <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-blue-500 pb-2">
              {section}
            </h2>
            {isRestrictive && (
              <p className="text-sm text-bauhaus-muted mb-4">
                Reported uses of restrictive practices on NDIS participants. The Disability Royal Commission recommended phasing these out.
              </p>
            )}
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-bauhaus-black">
                    <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Metric</th>
                    {JURISDICTIONS.map(j => (
                      <th key={j} className="text-right py-2 font-black uppercase tracking-wider text-xs">
                        {j === 'National' ? j : (
                          <Link href={`/reports/disability/${j.toLowerCase()}`} className="text-bauhaus-blue hover:underline">{j}</Link>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sectionMetrics.map(metric => {
                    const meta = METRIC_LABELS[metric];
                    if (!meta) return null;
                    const vals = JURISDICTIONS.map(j => cv(metric, j));
                    if (vals.every(v => v === null)) return null;
                    const stateVals = STATES.map(j => cv(metric, j)).filter((v): v is number => v !== null);
                    const maxVal = stateVals.length > 0 ? Math.max(...stateVals) : null;
                    const minVal = stateVals.length > 0 ? Math.min(...stateVals) : null;
                    return (
                      <tr key={metric} className={`border-b border-gray-200 ${isRestrictive ? 'bg-red-50' : ''}`}>
                        <td className="py-2 font-medium">{meta.label}</td>
                        {JURISDICTIONS.map((j, ji) => {
                          const v = vals[ji];
                          const isNational = j === 'National';
                          const isMax = v === maxVal && !isNational;
                          const isMin = v === minVal && !isNational;
                          let cls = 'py-2 text-right';
                          if (isMax && meta.higherIsWorse) cls += ' text-red-600 font-bold';
                          else if (isMin && meta.higherIsWorse) cls += ' text-emerald-600 font-bold';
                          else if (isNational) cls += ' font-bold';
                          return <td key={j} className={cls}>{v !== null ? formatValue(v, meta.format) : '—'}</td>;
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {/* State Scorecards */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
          State Scorecards
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STATES.map(s => {
            const ndis = cv('rogs_dis_ndis_expenditure', s);
            const indigUtil = cv('rogs_dis_utilisation_indigenous', s);
            const physical = cv('rogs_dis_restrictive_physical', s);
            const transport = cv('rogs_dis_transport_difficulty_total', s);
            return (
              <Link key={s} href={`/reports/disability/${s.toLowerCase()}`}
                className="border border-gray-200 rounded-xl p-4 hover:border-blue-400 transition-colors">
                <span className="font-black text-lg text-bauhaus-black">{s}</span>
                <div className="space-y-1 text-xs mt-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">NDIS spend</span>
                    <span className="font-bold">{ndis != null ? money(ndis) : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Indig. util.</span>
                    <span className="font-bold">{indigUtil != null ? `${indigUtil}%` : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Restraints</span>
                    <span className="font-bold">{physical?.toLocaleString() ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Transport</span>
                    <span className="font-bold">{transport != null ? `${transport}%` : '—'}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Oversight */}
      {data.oversight && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
            Disability Royal Commission Oversight
          </h2>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold">{data.oversight.implemented + data.oversight.partial} of {data.oversight.total} recommendations progressed</span>
              <span className={`text-sm font-black ${data.oversight.implemented + data.oversight.partial < data.oversight.total / 2 ? 'text-red-600' : 'text-emerald-600'}`}>
                {data.oversight.total ? Math.round(((data.oversight.implemented + data.oversight.partial * 0.5) / data.oversight.total) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden flex">
              <div className="bg-emerald-500 h-3" style={{ width: `${(data.oversight.implemented / data.oversight.total) * 100}%` }} />
              <div className="bg-amber-400 h-3" style={{ width: `${(data.oversight.partial / data.oversight.total) * 100}%` }} />
            </div>
            <div className="flex gap-4 text-[10px] text-gray-500 mt-2">
              <span>Implemented: {data.oversight.implemented}</span>
              <span>Partial: {data.oversight.partial}</span>
              <span>Pending: {data.oversight.pending}</span>
            </div>
          </div>
        </section>
      )}

      <div className="text-xs text-gray-400 text-center pb-8">
        Data from CivicGraph outcomes_metrics database. Sources: ROGS 2026, AIHW People with Disability, Disability Royal Commission.
      </div>
    </div>
  );
}
