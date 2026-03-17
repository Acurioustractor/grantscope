import { getServiceSupabase } from '@/lib/supabase';
import { buildPowerReport } from '@grant-engine/reports/power-analysis';
import { PowerDynamicsCharts } from './charts';
import { ReportCTA } from '../_components/report-cta';

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
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-purple mt-4 mb-1 uppercase tracking-widest">Living Report</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Power Dynamics in Australian Philanthropy
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-2xl leading-relaxed font-medium">
          {report.metrics.givingFoundationCount > 0
            ? `Analyzing ${report.metrics.givingFoundationCount.toLocaleString()} foundations with giving data. The top 10 control ${report.metrics.top10Share}% of all tracked philanthropic giving.`
            : 'Foundation data loading. Run profiling scripts to populate giving data.'}
        </p>
      </div>

      <PowerDynamicsCharts report={report} />

      <ReportCTA reportSlug="power-dynamics" reportTitle="Power Dynamics Report" />
    </div>
  );
}
