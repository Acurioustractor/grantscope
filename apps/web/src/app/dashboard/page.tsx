import { getServiceSupabase } from '@/lib/supabase';
import { DashboardCharts } from './charts';
import { FundingGapMapLoader } from './funding-gap-map-loader';

export const dynamic = 'force-dynamic';

function formatMoney(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

interface SectorRow {
  sector: string;
  count: number;
  total_giving: number;
}

interface GeoRow {
  geo: string;
  count: number;
  total_giving: number;
}

interface TopFoundation {
  name: string;
  total_giving_annual: number;
  type: string | null;
  profile_confidence: string;
}

interface ClosingGrant {
  id: string;
  name: string;
  provider: string;
  closes_at: string;
  amount_max: number | null;
}

interface SourceRow {
  source: string;
  count: number;
}

async function getDashboardData() {
  const supabase = getServiceSupabase();

  const [
    grantsResult,
    foundationsResult,
    profiledResult,
    embeddedResult,
    communityResult,
    socialEnterprisesResult,
    topFoundationsResult,
    closingSoonResult,
  ] = await Promise.all([
    supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }),
    supabase.from('foundations').select('*', { count: 'exact', head: true }),
    supabase.from('foundations').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
    supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }).not('embedding', 'is', null),
    supabase.from('community_orgs').select('*', { count: 'exact', head: true }),
    supabase.from('social_enterprises').select('*', { count: 'exact', head: true }),
    supabase
      .from('foundations')
      .select('name, total_giving_annual, type, profile_confidence')
      .not('total_giving_annual', 'is', null)
      .order('total_giving_annual', { ascending: false })
      .limit(15),
    supabase
      .from('grant_opportunities')
      .select('id, name, provider, closes_at, amount_max')
      .gt('closes_at', new Date().toISOString())
      .lt('closes_at', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('closes_at', { ascending: true })
      .limit(10),
  ]);

  // Sector distribution — query foundations with thematic_focus, aggregate client-side
  const { data: foundationsWithFocus } = await supabase
    .from('foundations')
    .select('thematic_focus, total_giving_annual')
    .not('thematic_focus', 'is', null)
    .not('total_giving_annual', 'is', null)
    .limit(5000);

  const sectorMap = new Map<string, { count: number; total_giving: number }>();
  for (const f of foundationsWithFocus || []) {
    for (const sector of (f.thematic_focus as string[]) || []) {
      const existing = sectorMap.get(sector) || { count: 0, total_giving: 0 };
      existing.count++;
      existing.total_giving += (f.total_giving_annual as number) || 0;
      sectorMap.set(sector, existing);
    }
  }
  const sectors: SectorRow[] = Array.from(sectorMap.entries())
    .map(([sector, data]) => ({ sector, ...data }))
    .sort((a, b) => b.total_giving - a.total_giving)
    .slice(0, 12);

  // Geographic distribution
  const { data: foundationsWithGeo } = await supabase
    .from('foundations')
    .select('geographic_focus, total_giving_annual')
    .not('geographic_focus', 'is', null)
    .not('total_giving_annual', 'is', null)
    .limit(5000);

  const geoMap = new Map<string, { count: number; total_giving: number }>();
  for (const f of foundationsWithGeo || []) {
    for (const geo of (f.geographic_focus as string[]) || []) {
      const existing = geoMap.get(geo) || { count: 0, total_giving: 0 };
      existing.count++;
      existing.total_giving += (f.total_giving_annual as number) || 0;
      geoMap.set(geo, existing);
    }
  }
  // Normalize geo labels and merge duplicates (e.g. "international" → "International")
  const AU_STATES: Record<string, string> = {
    'AU-National': 'National (AU)',
    'AU-NSW': 'New South Wales',
    'AU-VIC': 'Victoria',
    'AU-QLD': 'Queensland',
    'AU-WA': 'Western Australia',
    'AU-SA': 'South Australia',
    'AU-TAS': 'Tasmania',
    'AU-NT': 'Northern Territory',
    'AU-ACT': 'ACT',
    'NZ-National': 'New Zealand',
  };
  const normalizedGeoMap = new Map<string, { count: number; total_giving: number }>();
  for (const [raw, data] of geoMap.entries()) {
    const label = AU_STATES[raw] || (raw.charAt(0).toUpperCase() + raw.slice(1));
    const existing = normalizedGeoMap.get(label) || { count: 0, total_giving: 0 };
    existing.count += data.count;
    existing.total_giving += data.total_giving;
    normalizedGeoMap.set(label, existing);
  }
  const sortedGeo = Array.from(normalizedGeoMap.entries())
    .map(([geo, data]) => ({ geo, ...data }))
    .sort((a, b) => b.total_giving - a.total_giving);
  // Top 10 + aggregate the rest as "Other"
  const top10 = sortedGeo.slice(0, 10);
  const rest = sortedGeo.slice(10);
  if (rest.length > 0) {
    top10.push({
      geo: `Other (${rest.length})`,
      count: rest.reduce((s, r) => s + r.count, 0),
      total_giving: rest.reduce((s, r) => s + r.total_giving, 0),
    });
  }
  const geography: GeoRow[] = top10;

  // Source coverage
  const { data: grantSources } = await supabase
    .from('grant_opportunities')
    .select('source')
    .limit(5000);

  const sourceMap = new Map<string, number>();
  for (const g of grantSources || []) {
    const source = (g.source as string) || 'Unknown';
    sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
  }
  const sources: SourceRow[] = Array.from(sourceMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  // Total $ tracked from foundations
  const { data: totalGivingResult } = await supabase
    .from('foundations')
    .select('total_giving_annual')
    .not('total_giving_annual', 'is', null)
    .limit(10000);

  const totalDollarsTracked = (totalGivingResult || []).reduce(
    (sum, f) => sum + ((f.total_giving_annual as number) || 0),
    0
  );

  return {
    stats: {
      totalGrants: grantsResult.count || 0,
      totalFoundations: foundationsResult.count || 0,
      profiledFoundations: profiledResult.count || 0,
      embeddedGrants: embeddedResult.count || 0,
      communityOrgs: communityResult.count || 0,
      socialEnterprises: socialEnterprisesResult.count || 0,
      totalDollarsTracked,
    },
    sectors,
    geography,
    topFoundations: (topFoundationsResult.data || []) as TopFoundation[],
    closingSoon: (closingSoonResult.data || []) as ClosingGrant[],
    sources,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const { stats } = data;

  const profiledPct = stats.totalFoundations > 0
    ? Math.round((stats.profiledFoundations / stats.totalFoundations) * 100)
    : 0;
  const embeddedPct = stats.totalGrants > 0
    ? Math.round((stats.embeddedGrants / stats.totalGrants) * 100)
    : 0;

  const heroStats = [
    { label: 'Total Grants', value: stats.totalGrants.toLocaleString(), color: 'bg-bauhaus-blue' },
    { label: 'Foundations', value: stats.totalFoundations.toLocaleString(), color: 'bg-bauhaus-red' },
    { label: 'Foundations Profiled', value: `${profiledPct}%`, sub: `${stats.profiledFoundations.toLocaleString()} of ${stats.totalFoundations.toLocaleString()}`, color: 'bg-money' },
    { label: 'Grants Embedded', value: `${embeddedPct}%`, sub: `${stats.embeddedGrants.toLocaleString()} of ${stats.totalGrants.toLocaleString()}`, color: 'bg-bauhaus-yellow' },
    { label: 'Community Orgs', value: stats.communityOrgs.toLocaleString(), color: 'bg-purple' },
    { label: 'Social Enterprises', value: stats.socialEnterprises.toLocaleString(), color: 'bg-bauhaus-red' },
    { label: 'Total $ Tracked', value: formatMoney(stats.totalDollarsTracked), color: 'bg-bauhaus-black' },
  ];

  return (
    <div>
      <div className="mb-10">
        <p className="text-xs font-black text-bauhaus-blue uppercase tracking-[0.3em] mb-2">Data Observatory</p>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-2">The Full Picture</h1>
        <p className="text-bauhaus-muted font-medium">
          Live data health, enrichment progress, and key insights across Australian funding flows
        </p>
      </div>

      {/* Hero stats */}
      <div className="flex flex-wrap mb-12 border-4 border-bauhaus-black">
        {heroStats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white p-4 text-center flex-1 min-w-[140px] border-r-4 border-b-4 border-bauhaus-black last:border-r-0 [&:nth-last-child(-n+1)]:border-b-0 lg:[&]:border-b-0"
          >
            <div className={`w-3 h-3 ${stat.color} mx-auto mb-2`}></div>
            <div className="text-2xl font-black tabular-nums text-bauhaus-black">
              {stat.value}
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mt-1">
              {stat.label}
            </div>
            {stat.sub && (
              <div className="text-[10px] text-bauhaus-muted mt-0.5 font-medium">{stat.sub}</div>
            )}
          </div>
        ))}
      </div>

      {/* Community Capital Map */}
      <section className="mb-12">
        <h2 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
          Community Capital Map
        </h2>
        <p className="text-xs text-bauhaus-muted font-medium mb-3 max-w-2xl">
          SA2-level view of funding distribution, disadvantage, and community control across Australia.
          Use the tabs to switch between metrics. Click any region to explore its full profile on the Power Map page.
        </p>
        <FundingGapMapLoader />
      </section>

      {/* Charts */}
      <DashboardCharts
        sectors={data.sectors}
        geography={data.geography}
        topFoundations={data.topFoundations}
        closingSoon={data.closingSoon}
        sources={data.sources}
        profiledPct={profiledPct}
        embeddedPct={embeddedPct}
        profiledCount={stats.profiledFoundations}
        embeddedCount={stats.embeddedGrants}
        totalFoundations={stats.totalFoundations}
        totalGrants={stats.totalGrants}
      />
    </div>
  );
}
