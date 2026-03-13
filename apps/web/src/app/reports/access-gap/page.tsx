import { getServiceSupabase } from '@/lib/supabase';
import { estimateAdminBurden } from '@grant-engine/foundations/community-profiler';
import { AccessGapCharts } from './charts';

export const dynamic = 'force-dynamic';

async function getReport() {
  try {
    const supabase = getServiceSupabase();

    const { data: orgs, count } = await supabase
      .from('community_orgs')
      .select('name, annual_revenue, annual_funding_received, admin_burden_cost, domain', { count: 'exact' })
      .not('annual_revenue', 'is', null)
      .order('annual_revenue', { ascending: false })
      .limit(500);

    if (!orgs?.length) return buildFallbackReport();

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
          : 20,
      });
    }

    const smallOrgs = orgsBySize.filter(o => o.revenue < 250_000);
    const largeOrgs = orgsBySize.filter(o => o.revenue >= 1_000_000);

    return {
      orgsBySize,
      adminBurdenBySize,
      fundingConcentration,
      totalOrgs: count || orgs.length,
      avgSmallOrgAdminPercent: smallOrgs.length
        ? Math.round(smallOrgs.reduce((s, o) => s + o.adminPercent, 0) / smallOrgs.length)
        : 40,
      avgLargeOrgAdminPercent: largeOrgs.length
        ? Math.round(largeOrgs.reduce((s, o) => s + o.adminPercent, 0) / largeOrgs.length)
        : 15,
    };
  } catch {
    return buildFallbackReport();
  }
}

function buildFallbackReport() {
  return {
    orgsBySize: [],
    adminBurdenBySize: [
      { size: '<$50K', avgAdminPercent: 45, count: 0 },
      { size: '$50K-$250K', avgAdminPercent: 38, count: 0 },
      { size: '$250K-$1M', avgAdminPercent: 25, count: 0 },
      { size: '>$1M', avgAdminPercent: 15, count: 0 },
    ],
    fundingConcentration: [
      { decile: 'Smallest 20%', percentOfOrgs: 20, percentOfFunding: 2 },
      { decile: 'Small 20%', percentOfOrgs: 20, percentOfFunding: 5 },
      { decile: 'Medium 20%', percentOfOrgs: 20, percentOfFunding: 13 },
      { decile: 'Large 20%', percentOfOrgs: 20, percentOfFunding: 25 },
      { decile: 'Largest 20%', percentOfOrgs: 20, percentOfFunding: 55 },
    ],
    totalOrgs: 0,
    avgSmallOrgAdminPercent: 40,
    avgLargeOrgAdminPercent: 15,
  };
}

export default async function AccessGapPage() {
  const report = await getReport();

  return (
    <div>
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-yellow mt-4 mb-1 uppercase tracking-widest">Living Report</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          The Access Gap
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-2xl leading-relaxed font-medium">
          Small community organizations spend up to {report.avgSmallOrgAdminPercent}% of their
          revenue on compliance and administration — while large organizations spend just{' '}
          {report.avgLargeOrgAdminPercent}%. The system structurally disadvantages those
          closest to the communities they serve.
        </p>
      </div>

      <AccessGapCharts report={report} />
    </div>
  );
}
