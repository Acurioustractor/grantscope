import Link from 'next/link';
import {
  getStateComparisonMetrics,
  getCtgTrend,
  getOutcomesMetrics,
  money,
  fmt,
} from '@/lib/services/report-service';
import { StateComparisonChart, TimeSeriesChart } from '../../_components/report-charts';

export const revalidate = 3600;

export function generateMetadata() {
  return {
    title: 'National Youth Justice Comparison — CivicGraph',
    description: 'Compare youth justice outcomes across all Australian states and territories.',
  };
}

type ComparisonRow = { jurisdiction: string; metric_name: string; metric_value: number; metric_unit: string; period: string; cohort: string | null };
type CtgRow = { rate: number; period: string; notes: string | null };
type MetricRow = { metric_name: string; metric_value: number; metric_unit: string; period: string; cohort: string | null; source: string; notes: string | null };

const JURISDICTIONS = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'NT', 'TAS', 'ACT', 'National'] as const;
const STATES = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'NT', 'TAS', 'ACT'] as const;

const COMPARISON_METRICS = [
  'detention_rate_per_10k', 'avg_daily_detention', 'indigenous_overrepresentation_ratio',
  'ctg_target11_indigenous_detention_rate', 'avg_days_in_detention', 'cost_per_day_detention',
  'pct_unsentenced', 'detention_5yr_trend_pct',
  'rogs_yj_recidivism_12m', 'rogs_yj_deaths_in_custody',
  'rogs_cost_per_day_community',
];

async function getData() {
  const [comparison, qldCtg, nswCtg, vicCtg, waCtg, ntCtg, nationalMetrics] = await Promise.all([
    getStateComparisonMetrics(COMPARISON_METRICS),
    getCtgTrend('QLD'),
    getCtgTrend('NSW'),
    getCtgTrend('VIC'),
    getCtgTrend('WA'),
    getCtgTrend('NT'),
    getOutcomesMetrics('National'),
  ]);

  return {
    comparison: (comparison as ComparisonRow[] | null) || [],
    ctgTrends: {
      QLD: (qldCtg as CtgRow[] | null) || [],
      NSW: (nswCtg as CtgRow[] | null) || [],
      VIC: (vicCtg as CtgRow[] | null) || [],
      WA: (waCtg as CtgRow[] | null) || [],
      NT: (ntCtg as CtgRow[] | null) || [],
    },
    national: (nationalMetrics as MetricRow[] | null) || [],
  };
}

export default async function NationalComparisonPage() {
  const data = await getData();

  // Build lookup map
  const comp: Record<string, Record<string, number>> = {};
  for (const row of data.comparison) {
    if (!comp[row.metric_name]) comp[row.metric_name] = {};
    comp[row.metric_name][row.jurisdiction] = row.metric_value;
  }
  const cv = (metric: string, jur: string) => comp[metric]?.[jur] ?? null;

  // National headline metrics
  const nm = (name: string) => data.national.find(r => r.metric_name === name && !r.cohort)?.metric_value ?? null;

  // Rank states by metric (returns position 1-N, lower = worse for "bad" metrics)
  function rankStates(metric: string, higherIsWorse: boolean): Record<string, number> {
    const vals = STATES.map(s => ({ s, v: cv(metric, s) })).filter(x => x.v !== null);
    vals.sort((a, b) => higherIsWorse ? b.v! - a.v! : a.v! - b.v!);
    const ranks: Record<string, number> = {};
    vals.forEach((x, i) => { ranks[x.s] = i + 1; });
    return ranks;
  }

  const detentionRanks = rankStates('detention_rate_per_10k', true);
  const costRanks = rankStates('cost_per_day_detention', true);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <Link href="/reports/youth-justice" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; Youth Justice Reports
        </Link>
        <div className="flex items-center gap-3 mt-4 mb-1">
          <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">National Comparison</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Australian Youth Justice: State by State
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          How does each state and territory perform on youth detention, costs, Indigenous overrepresentation,
          and Closing the Gap targets? All data from the same period (2023-24) for direct comparison.
        </p>
      </div>

      {/* National Headlines */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-red-600">{nm('avg_daily_detention')?.toLocaleString() ?? '—'}</div>
          <div className="text-xs text-gray-500 mt-1">Children in detention daily</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-red-600">{nm('indigenous_overrepresentation_ratio')}x</div>
          <div className="text-xs text-gray-500 mt-1">Indigenous overrepresentation</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-amber-600">${nm('cost_per_day_detention')?.toLocaleString() ?? '—'}</div>
          <div className="text-xs text-gray-500 mt-1">Cost per day (detention)</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-gray-700">{nm('pct_unsentenced') ?? '—'}%</div>
          <div className="text-xs text-gray-500 mt-1">Unsentenced (remand)</div>
        </div>
      </div>

      {/* Visual comparisons — the story at a glance */}
      {(() => {
        const chartMetrics: Array<{ metric: string; label: string; format: 'number' | 'money' | 'pct' | 'ratio' }> = [
          { metric: 'detention_rate_per_10k', label: 'Detention rate per 10,000 young people', format: 'number' },
          { metric: 'indigenous_overrepresentation_ratio', label: 'First Nations overrepresentation ratio', format: 'ratio' },
          { metric: 'cost_per_day_detention', label: 'Cost per day in detention', format: 'money' },
        ];
        return (
          <section className="mb-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {chartMetrics.map(({ metric, label, format }) => {
              const chartData = STATES
                .map(s => ({ jurisdiction: s, metric_value: cv(metric, s) ?? 0 }))
                .filter(d => d.metric_value > 0);
              if (chartData.length < 3) return null;
              return (
                <div key={metric} className="border-2 border-bauhaus-black/10 bg-white p-4">
                  <StateComparisonChart data={chartData} metricKey={metric} label={label} format={format} />
                </div>
              );
            })}
          </section>
        );
      })()}

      {/* CTG Trend — Closing the Gap detention rates over time */}
      {(() => {
        const trendStates = Object.entries(data.ctgTrends).filter(([, rows]) => rows.length >= 2);
        if (trendStates.length === 0) return null;
        // Merge into a single dataset keyed by period
        const periods = new Set<string>();
        for (const [, rows] of trendStates) rows.forEach(r => periods.add(r.period));
        const merged = Array.from(periods).sort().map(period => {
          const point: Record<string, unknown> = { period };
          for (const [state, rows] of trendStates) {
            const row = rows.find(r => r.period === period);
            if (row) point[state] = row.rate;
          }
          return point;
        });
        const colors: Record<string, string> = { QLD: '#D02020', NSW: '#1040C0', VIC: '#059669', WA: '#F0C020', NT: '#ea580c' };
        return (
          <section className="mb-12 border-2 border-bauhaus-black/10 bg-white p-6">
            <TimeSeriesChart
              data={merged}
              lines={trendStates.map(([state]) => ({ dataKey: state, color: colors[state] || '#777', label: state }))}
              xKey="period"
              label="Closing the Gap — Indigenous detention rate trend"
              format="number"
            />
          </section>
        );
      })()}

      {/* Full Comparison Table */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-red pb-2">
          Full Comparison
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          AIHW Youth Justice 2023-24 &amp; ROGS 2026. Click a state to see its tracker.
        </p>

        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-bauhaus-black">
                <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Metric</th>
                {JURISDICTIONS.map(j => (
                  <th key={j} className="text-right py-2 font-black uppercase tracking-wider text-xs">
                    {j === 'National' ? j : (
                      <Link href={`/reports/youth-justice/${j.toLowerCase()}`} className="text-bauhaus-blue hover:underline">{j}</Link>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Detention rate (per 10K)', metric: 'detention_rate_per_10k', highlight: true },
                { label: 'Avg daily detention', metric: 'avg_daily_detention', highlight: false },
                { label: 'Indigenous overrepresentation', metric: 'indigenous_overrepresentation_ratio', highlight: true, suffix: 'x' },
                { label: 'First Nations rate (per 10K)', metric: 'ctg_target11_indigenous_detention_rate', highlight: false },
                { label: 'Avg days in detention', metric: 'avg_days_in_detention', highlight: true },
                { label: 'Cost per day (detention)', metric: 'cost_per_day_detention', highlight: false, prefix: '$' },
                { label: '% unsentenced (remand)', metric: 'pct_unsentenced', highlight: true, suffix: '%' },
                { label: '5-year trend', metric: 'detention_5yr_trend_pct', highlight: false, suffix: '%', signed: true },
                { label: 'Recidivism (12 months)', metric: 'rogs_yj_recidivism_12m', highlight: true, suffix: '%' },
                { label: 'Deaths in custody', metric: 'rogs_yj_deaths_in_custody', highlight: false },
                { label: 'Cost per day (community)', metric: 'rogs_cost_per_day_community', highlight: false, prefix: '$' },
              ].map((row) => {
                const vals = JURISDICTIONS.map(j => cv(row.metric, j));
                const stateVals = STATES.map(j => cv(row.metric, j)).filter((v): v is number => v !== null);
                const maxVal = stateVals.length > 0 ? Math.max(...stateVals) : null;
                const minVal = stateVals.length > 0 ? Math.min(...stateVals) : null;
                return (
                  <tr key={row.metric} className={`border-b border-gray-200 ${row.highlight ? 'bg-red-50' : ''}`}>
                    <td className="py-2 font-medium">{row.label}</td>
                    {JURISDICTIONS.map((j, ji) => {
                      const v = vals[ji];
                      const isNational = j === 'National';
                      const isMax = v === maxVal && !isNational;
                      const isMin = v === minVal && !isNational;
                      let cls = 'py-2 text-right';
                      if (isMax && row.metric !== 'cost_per_day_detention') cls += ' text-red-600 font-bold';
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
      </section>

      {/* Closing the Gap Trends */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-red pb-2">
          Closing the Gap: Target 11 by State
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          First Nations detention rate per 10,000 (ages 10-17). Target: 30% reduction by 2031.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(Object.entries(data.ctgTrends) as [string, CtgRow[]][]).map(([state, trend]) => {
            if (trend.length === 0) return null;
            const first = trend[0];
            const last = trend[trend.length - 1];
            const isWorsening = last.rate > first.rate;
            const change = ((last.rate - first.rate) / first.rate * 100).toFixed(0);
            return (
              <div key={state} className="border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <Link href={`/reports/youth-justice/${state.toLowerCase()}`} className="text-sm font-black text-bauhaus-blue hover:underline uppercase tracking-wider">
                    {state}
                  </Link>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    isWorsening ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {isWorsening ? 'WORSENING' : 'IMPROVING'} ({change}%)
                  </span>
                </div>
                <div className="space-y-1.5">
                  {trend.map((y) => (
                    <div key={y.period} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 w-14 shrink-0">{y.period}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div className={`rounded-full h-2 ${y.rate > 35 ? 'bg-red-500' : y.rate > 25 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                          style={{ width: `${Math.min((y.rate / 50) * 100, 100)}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-gray-700 w-6 text-right">{y.rate}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* State Scorecards */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
          State Scorecards
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          Each state ranked on key metrics. Rank 1 = worst performing.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STATES.map(s => {
            const detRate = cv('detention_rate_per_10k', s);
            const dailyDet = cv('avg_daily_detention', s);
            const overrep = cv('indigenous_overrepresentation_ratio', s);
            const cost = cv('cost_per_day_detention', s);
            const rank = detentionRanks[s];
            return (
              <Link key={s} href={`/reports/youth-justice/${s.toLowerCase()}/tracker`}
                className="border border-gray-200 rounded-xl p-4 hover:border-bauhaus-blue transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-black text-lg text-bauhaus-black">{s}</span>
                  {rank && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      rank <= 2 ? 'bg-red-100 text-red-700' :
                      rank <= 4 ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      #{rank}
                    </span>
                  )}
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Rate</span>
                    <span className="font-bold">{detRate ?? '—'}/10K</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Daily</span>
                    <span className="font-bold">{dailyDet ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Overrep.</span>
                    <span className="font-bold">{overrep ? `${overrep}x` : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Cost/day</span>
                    <span className="font-bold">{cost ? `$${cost.toLocaleString()}` : '—'}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <div className="text-xs text-gray-400 text-center pb-8">
        Data from CivicGraph outcomes_metrics database. Sources: AIHW Youth Justice in Australia 2023-24, ROGS 2026 Table 17A, Closing the Gap Dashboard.
        All metrics for 2023-24 financial year unless noted.
      </div>
    </div>
  );
}
