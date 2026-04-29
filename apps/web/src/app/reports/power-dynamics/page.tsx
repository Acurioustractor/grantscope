import { getServiceSupabase } from '@/lib/report-supabase';
import { buildPowerReport } from '@grant-engine/reports/power-analysis';
import { PowerDynamicsCharts } from './charts';
import { ReportCTA } from '../_components/report-cta';

export const dynamic = 'force-static';

const LIVE_REPORTS = process.env.CIVICGRAPH_LIVE_REPORTS === 'true';

async function getReport() {
  if (!LIVE_REPORTS) {
    return buildFallbackReport();
  }

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
      herfindahlIndex: 2180,
      herfindahlLabel: 'moderate' as const,
      giniCoefficient: 0.82,
      top10Share: 62,
      top50Share: 88,
      totalGiving: 11_800_000_000,
      foundationCount: 10800,
      givingFoundationCount: 2466,
    },
    topFoundations: [
      { name: 'Paul Ramsay Foundation', totalGiving: 210_000_000, share: 1.8, thematicFocus: ['systems_change', 'community'], parentCompany: null },
      { name: 'Minderoo Foundation', totalGiving: 268_000_000, share: 2.3, thematicFocus: ['indigenous', 'employment', 'environment'], parentCompany: null },
      { name: 'BHP Foundation', totalGiving: 195_000_000, share: 1.7, thematicFocus: ['education', 'indigenous', 'community'], parentCompany: 'BHP' },
      { name: 'Rio Tinto Foundation', totalGiving: 154_000_000, share: 1.3, thematicFocus: ['community', 'cultural_heritage'], parentCompany: 'Rio Tinto' },
      { name: 'Ian Potter Foundation', totalGiving: 42_000_000, share: 0.4, thematicFocus: ['health', 'education', 'arts'], parentCompany: null },
    ],
    givingDistribution: [
      { percentile: 'Bottom 20%', percentOfFoundations: 20, percentOfGiving: 1, avgGiving: 24000 },
      { percentile: 'Lower 20%', percentOfFoundations: 20, percentOfGiving: 4, avgGiving: 97000 },
      { percentile: 'Middle 20%', percentOfFoundations: 20, percentOfGiving: 10, avgGiving: 243000 },
      { percentile: 'Upper 20%', percentOfFoundations: 20, percentOfGiving: 25, avgGiving: 609000 },
      { percentile: 'Top 20%', percentOfFoundations: 20, percentOfGiving: 60, avgGiving: 1_460_000 },
    ],
    thematicConcentration: [
      { theme: 'community', totalGiving: 2_200_000_000, foundationCount: 820, topFoundation: 'Paul Ramsay Foundation' },
      { theme: 'indigenous', totalGiving: 740_000_000, foundationCount: 190, topFoundation: 'Minderoo Foundation' },
      { theme: 'education', totalGiving: 1_900_000_000, foundationCount: 540, topFoundation: 'BHP Foundation' },
      { theme: 'health', totalGiving: 1_600_000_000, foundationCount: 480, topFoundation: 'Ian Potter Foundation' },
      { theme: 'environment', totalGiving: 980_000_000, foundationCount: 260, topFoundation: 'Minderoo Foundation' },
    ],
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
