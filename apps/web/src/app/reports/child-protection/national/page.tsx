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
    title: 'National Child Protection Comparison — CivicGraph',
    description: 'Compare child protection outcomes across all Australian states and territories.',
  };
}

type ComparisonRow = { jurisdiction: string; metric_name: string; metric_value: number; metric_unit: string; period: string; cohort: string | null };
type MetricRow = { metric_name: string; metric_value: number; metric_unit: string; period: string; cohort: string | null; source: string; notes: string | null };
type OversightRow = { domain: string; total: number; implemented: number; partial: number; pending: number; rejected: number };

const JURISDICTIONS = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'NT', 'TAS', 'ACT', 'National'] as const;
const STATES = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'NT', 'TAS', 'ACT'] as const;

const COMPARISON_METRICS = [
  'rogs_cp_notifications', 'rogs_cp_notifications_indigenous',
  'rogs_cp_substantiations', 'rogs_cp_substantiations_indigenous',
  'rogs_cp_substantiation_rate',
  'rogs_cp_oohc_on_orders', 'rogs_cp_oohc_no_order',
  'rogs_cp_kinship_households', 'rogs_cp_foster_households',
  'rogs_cp_kinship_placement_pct',
  'rogs_cp_protective_expenditure', 'rogs_cp_care_expenditure',
  'rogs_cp_expenditure_per_child',
  'rogs_cp_resubstantiation_12m',
];

const METRIC_LABELS: Record<string, { label: string; format?: string; higherIsWorse?: boolean }> = {
  rogs_cp_notifications: { label: 'Notifications', format: 'number', higherIsWorse: true },
  rogs_cp_notifications_indigenous: { label: 'Indigenous notifications', format: 'number', higherIsWorse: true },
  rogs_cp_substantiations: { label: 'Substantiations', format: 'number', higherIsWorse: true },
  rogs_cp_substantiations_indigenous: { label: 'Indigenous substantiations', format: 'number', higherIsWorse: true },
  rogs_cp_substantiation_rate: { label: 'Substantiation rate', format: 'pct' },
  rogs_cp_oohc_on_orders: { label: 'Children in OOHC (on orders)', format: 'number', higherIsWorse: true },
  rogs_cp_oohc_no_order: { label: 'Children in OOHC (no order)', format: 'number' },
  rogs_cp_kinship_households: { label: 'Kinship care households', format: 'number' },
  rogs_cp_foster_households: { label: 'Foster carer households', format: 'number' },
  rogs_cp_kinship_placement_pct: { label: 'Children placed with kin', format: 'number' },
  rogs_cp_protective_expenditure: { label: 'Protective intervention spend', format: 'money' },
  rogs_cp_care_expenditure: { label: 'Care services spend', format: 'money' },
  rogs_cp_expenditure_per_child: { label: 'Intensive family support spend', format: 'money' },
  rogs_cp_resubstantiation_12m: { label: 'Re-substantiation within 12m', format: 'pct', higherIsWorse: true },
};

async function getData() {
  const [comparison, nationalMetrics, oversight] = await Promise.all([
    getStateComparisonMetrics(COMPARISON_METRICS, 'child-protection'),
    getOutcomesMetrics('National', 'child-protection'),
    getOversightSummary('National'),
  ]);

  return {
    comparison: (comparison as ComparisonRow[] | null) || [],
    national: (nationalMetrics as MetricRow[] | null) || [],
    oversight: ((oversight as OversightRow[] | null) || []).find(o => o.domain === 'child-protection') || null,
  };
}

function formatValue(v: number, format?: string): string {
  if (format === 'money') return money(v);
  return v.toLocaleString();
}

export default async function NationalCPComparisonPage() {
  const data = await getData();

  // Build lookup map
  const comp: Record<string, Record<string, number>> = {};
  for (const row of data.comparison) {
    if (!comp[row.metric_name]) comp[row.metric_name] = {};
    const existing = comp[row.metric_name][row.jurisdiction];
    if (existing === undefined || row.cohort === 'all') {
      comp[row.metric_name][row.jurisdiction] = row.metric_value;
    }
  }
  const cv = (metric: string, jur: string) => comp[metric]?.[jur] ?? null;

  // National headline metrics
  const nm = (name: string) => data.national.find(r => r.metric_name === name)?.metric_value ?? null;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <Link href="/reports/child-protection" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; Child Protection Reports
        </Link>
        <div className="flex items-center gap-3 mt-4 mb-1">
          <span className="text-xs font-black text-amber-600 uppercase tracking-widest">National Comparison</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Australian Child Protection: State by State
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          How does each state and territory perform on child protection notifications, substantiations,
          out-of-home care, and family support? ROGS 2026 data for direct comparison.
        </p>
      </div>

      {/* National Headlines */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-amber-600">{nm('rogs_cp_notifications')?.toLocaleString() ?? '—'}</div>
          <div className="text-xs text-gray-500 mt-1">National notifications</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-red-600">{nm('rogs_cp_substantiations')?.toLocaleString() ?? '—'}</div>
          <div className="text-xs text-gray-500 mt-1">Substantiations</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-blue-600">{nm('rogs_cp_oohc_on_orders')?.toLocaleString() ?? '—'}</div>
          <div className="text-xs text-gray-500 mt-1">Children in OOHC</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-emerald-600">{nm('rogs_cp_kinship_households')?.toLocaleString() ?? '—'}</div>
          <div className="text-xs text-gray-500 mt-1">Kinship care households</div>
        </div>
      </div>

      {/* Full Comparison Table */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-amber-500 pb-2">
          Full Comparison
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          ROGS 2026 child protection data. Click a state to see its deep dive.
        </p>

        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-bauhaus-black">
                <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Metric</th>
                {JURISDICTIONS.map(j => (
                  <th key={j} className="text-right py-2 font-black uppercase tracking-wider text-xs">
                    {j === 'National' ? j : (
                      <Link href={`/reports/child-protection/${j.toLowerCase()}`} className="text-bauhaus-blue hover:underline">{j}</Link>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_METRICS.map((metric) => {
                const meta = METRIC_LABELS[metric];
                if (!meta) return null;
                const vals = JURISDICTIONS.map(j => cv(metric, j));
                if (vals.every(v => v === null)) return null;
                const stateVals = STATES.map(j => cv(metric, j)).filter((v): v is number => v !== null);
                const maxVal = stateVals.length > 0 ? Math.max(...stateVals) : null;
                const minVal = stateVals.length > 0 ? Math.min(...stateVals) : null;
                const isIndigenous = metric.includes('indigenous');
                return (
                  <tr key={metric} className={`border-b border-gray-200 ${isIndigenous ? 'bg-red-50' : ''}`}>
                    <td className="py-2 font-medium">{meta.label}</td>
                    {JURISDICTIONS.map((j, ji) => {
                      const v = vals[ji];
                      const isNational = j === 'National';
                      const isMax = v === maxVal && !isNational && meta.higherIsWorse;
                      let cls = 'py-2 text-right';
                      if (isMax) cls += ' text-red-600 font-bold';
                      else if (v === minVal && !isNational && meta.higherIsWorse) cls += ' text-emerald-600 font-bold';
                      else if (isNational) cls += ' font-bold';
                      const display = v !== null ? formatValue(v, meta.format) : '—';
                      return <td key={j} className={cls}>{display}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* State Scorecards */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
          State Scorecards
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STATES.map(s => {
            const notif = cv('rogs_cp_notifications', s);
            const subs = cv('rogs_cp_substantiations', s);
            const oohc = cv('rogs_cp_oohc_on_orders', s);
            const kinship = cv('rogs_cp_kinship_households', s);
            return (
              <Link key={s} href={`/reports/child-protection/${s.toLowerCase()}`}
                className="border border-gray-200 rounded-xl p-4 hover:border-amber-400 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-black text-lg text-bauhaus-black">{s}</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Notifications</span>
                    <span className="font-bold">{notif?.toLocaleString() ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Substantiations</span>
                    <span className="font-bold">{subs?.toLocaleString() ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">OOHC</span>
                    <span className="font-bold">{oohc?.toLocaleString() ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Kinship</span>
                    <span className="font-bold">{kinship?.toLocaleString() ?? '—'}</span>
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
            National Oversight
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

      {/* Footer */}
      <div className="text-xs text-gray-400 text-center pb-8">
        Data from CivicGraph outcomes_metrics database. Sources: ROGS 2026, AIHW Child Protection Australia 2022-23.
      </div>
    </div>
  );
}
