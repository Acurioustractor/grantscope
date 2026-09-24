import { unstable_cache } from 'next/cache';
import { getServiceSupabase } from '@/lib/report-supabase';
import { AccessGapCharts } from './charts';

export const dynamic = 'force-dynamic';

type Coverage = { rows: number; withRevenue: number; withFunding: number };

async function countRows(column?: string): Promise<number> {
  const supabase = getServiceSupabase();
  let q = supabase.from('community_orgs').select('*', { count: 'exact', head: true });
  if (column) q = q.not(column, 'is', null);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// Errors throw, so unstable_cache never keeps a failed read for an hour.
async function getReport() {
  const [rows, withRevenue, withFunding] = await Promise.all([
    countRows(), countRows('annual_revenue'), countRows('annual_funding_received'),
  ]);
  const coverage: Coverage = { rows, withRevenue, withFunding };

  // Admin share needs revenue and the funding split needs funding received. Without both there is
  // nothing to measure. Until 2026-09-24 this path returned hard-coded figures (40% small, 15%
  // large, a 2/5/13/25/55 funding split) that the page rendered as findings. On that date
  // community_orgs held 1,250 rows and no revenue or funding figure, so every visitor saw them.
  if (withRevenue === 0 || withFunding === 0) return { measured: false as const, coverage };

  const supabase = getServiceSupabase();
  const { data: orgs, error } = await supabase
    .from('community_orgs')
    .select('name, annual_revenue, annual_funding_received, admin_burden_cost, domain')
    .not('annual_revenue', 'is', null)
    .order('annual_revenue', { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  if (!orgs?.length) return { measured: false as const, coverage };

  const orgsBySize = orgs.map(o => ({
    name: o.name,
    revenue: Number(o.annual_revenue) || 0,
    fundingReceived: Number(o.annual_funding_received) || 0,
    adminPercent: o.annual_revenue && o.admin_burden_cost
      ? Math.round((Number(o.admin_burden_cost) / Number(o.annual_revenue)) * 100)
      : 0,
    domain: o.domain || [],
  }));

  const tiers = [
    { size: '<$50K', min: 0, max: 50_000 },
    { size: '$50K-$250K', min: 50_000, max: 250_000 },
    { size: '$250K-$1M', min: 250_000, max: 1_000_000 },
    { size: '>$1M', min: 1_000_000, max: Infinity },
  ];

  const adminBurdenBySize = tiers.map(tier => {
    const inTier = orgsBySize.filter(o => o.revenue >= tier.min && o.revenue < tier.max);
    const avgAdmin = inTier.length
      ? Math.round(inTier.reduce((s, o) => s + o.adminPercent, 0) / inTier.length)
      : 0;
    return { size: tier.size, avgAdminPercent: avgAdmin, count: inTier.length };
  });

  const sorted = [...orgsBySize].sort((a, b) => a.revenue - b.revenue);
  const chunkSize = Math.ceil(sorted.length / 5);
  const fundingConcentration = [];
  const totalFunding = sorted.reduce((s, o) => s + o.fundingReceived, 0);

  for (let i = 0; i < 5; i++) {
    const chunk = sorted.slice(i * chunkSize, (i + 1) * chunkSize);
    const labels = ['Smallest 20%', 'Small 20%', 'Medium 20%', 'Large 20%', 'Largest 20%'];
    fundingConcentration.push({
      decile: labels[i],
      percentOfOrgs: 20,
      percentOfFunding: totalFunding > 0
        ? Math.round((chunk.reduce((s, o) => s + o.fundingReceived, 0) / totalFunding) * 100)
        : 0,
    });
  }

  const smallOrgs = orgsBySize.filter(o => o.revenue < 250_000);
  const largeOrgs = orgsBySize.filter(o => o.revenue >= 1_000_000);

  if (!smallOrgs.length || !largeOrgs.length) return { measured: false as const, coverage };

  return {
    measured: true as const,
    coverage,
    orgsBySize,
    adminBurdenBySize,
    fundingConcentration,
    totalOrgs: withRevenue,
    avgSmallOrgAdminPercent: Math.round(smallOrgs.reduce((s, o) => s + o.adminPercent, 0) / smallOrgs.length),
    avgLargeOrgAdminPercent: Math.round(largeOrgs.reduce((s, o) => s + o.adminPercent, 0) / largeOrgs.length),
  };
}

/** Cost + pooler load: this page was force-dynamic with no caching, so every request ran
 *  its query. The report's underlying data changes nightly at most. */
const getReportCached = unstable_cache(getReport, ['reports-access-gap-v2'], { revalidate: 3600 });

const count = (n: number) => (n === 0 ? 'none' : n.toLocaleString());

export default async function AccessGapPage() {
  const report = await getReportCached();

  return (
    <div>
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-yellow mt-4 mb-1 uppercase tracking-widest">Living Report</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          The Access Gap
        </h1>
        {report.measured ? (
          <p className="text-bauhaus-muted text-base sm:text-lg max-w-2xl leading-relaxed font-medium">
            Small community organisations spend an average of {report.avgSmallOrgAdminPercent}% of their
            revenue on compliance and administration. Large organisations spend{' '}
            {report.avgLargeOrgAdminPercent}%. The system structurally disadvantages those
            closest to the communities they serve.
          </p>
        ) : (
          <p className="text-bauhaus-muted text-base sm:text-lg max-w-2xl leading-relaxed font-medium">
            Do small community organisations lose more of their revenue to compliance and
            administration than large ones? This page is built to answer that. It cannot yet.
          </p>
        )}
      </div>

      {report.measured ? (
        <AccessGapCharts report={report} />
      ) : (
        <div className="border-4 border-bauhaus-black bg-white p-6 max-w-2xl">
          <div className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-3">Not measured yet</div>
          <p className="text-sm text-bauhaus-black leading-relaxed mb-3">
            The answer needs each organisation&apos;s revenue and the funding it receives. The register
            this page reads holds {report.coverage.rows.toLocaleString()} community organisations:{' '}
            {count(report.coverage.withRevenue)} have a revenue figure and{' '}
            {count(report.coverage.withFunding)} have a funding figure.
          </p>
          <p className="text-sm text-bauhaus-muted leading-relaxed">
            Earlier versions of this page said small organisations spend 40% on admin and large ones 15%.
            Those numbers were placeholders written into the code. Nothing measured them, so they are
            gone until the data is in.
          </p>
        </div>
      )}
    </div>
  );
}
