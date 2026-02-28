import { getServiceSupabase } from '@/lib/supabase';
import { buildPowerReport } from '@grantscope/engine/src/reports/power-analysis';
import { PowerDynamicsCharts } from './charts';

export const dynamic = 'force-dynamic';

async function getReport() {
  try {
    const supabase = getServiceSupabase();
    return await buildPowerReport(supabase);
  } catch {
    return buildFallbackReport();
  }
}

function buildFallbackReport() {
  return {
    metrics: {
      herfindahlIndex: 0,
      herfindahlLabel: 'unknown' as const,
      giniCoefficient: 0,
      top10Share: 0,
      top50Share: 0,
      totalGiving: 0,
      foundationCount: 0,
      givingFoundationCount: 0,
    },
    topFoundations: [],
    givingDistribution: [
      { percentile: 'Bottom 20%', percentOfFoundations: 20, percentOfGiving: 1, avgGiving: 0 },
      { percentile: 'Lower 20%', percentOfFoundations: 20, percentOfGiving: 4, avgGiving: 0 },
      { percentile: 'Middle 20%', percentOfFoundations: 20, percentOfGiving: 10, avgGiving: 0 },
      { percentile: 'Upper 20%', percentOfFoundations: 20, percentOfGiving: 25, avgGiving: 0 },
      { percentile: 'Top 20%', percentOfFoundations: 20, percentOfGiving: 60, avgGiving: 0 },
    ],
    thematicConcentration: [],
  };
}

export default async function PowerDynamicsPage() {
  const report = await getReport();

  return (
    <div>
      <div className="mb-8">
        <a href="/reports" className="text-sm text-navy-500 hover:text-navy-900 transition-colors">&larr; All reports</a>
        <div className="text-xs font-bold text-purple mt-4 mb-1 uppercase tracking-wider">Living Report</div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-900 mb-3">
          Power Dynamics in Australian Philanthropy
        </h1>
        <p className="text-navy-500 text-base sm:text-lg max-w-2xl leading-relaxed">
          {report.metrics.givingFoundationCount > 0
            ? `Analyzing ${report.metrics.givingFoundationCount.toLocaleString()} foundations with giving data. The top 10 control ${report.metrics.top10Share}% of all tracked philanthropic giving.`
            : 'Foundation data loading. Run profiling scripts to populate giving data.'}
        </p>
      </div>

      <PowerDynamicsCharts report={report} />
    </div>
  );
}
