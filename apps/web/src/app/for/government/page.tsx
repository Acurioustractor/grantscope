import { getServiceSupabase } from '@/lib/supabase';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'For Government | GrantScope Australia',
  description: 'Track grant programs from announcement to impact. Understand geographic distribution, sector coverage, and community reach.',
};

const GOV_SOURCES = ['nsw-grants', 'vic-grants', 'qld-grants', 'sa-grants', 'wa-grants', 'tas-grants', 'act-grants', 'nt-grants', 'grantconnect'];

const STATE_LABELS: Record<string, string> = {
  'nsw-grants': 'NSW',
  'vic-grants': 'VIC',
  'qld-grants': 'QLD',
  'sa-grants': 'SA',
  'wa-grants': 'WA',
  'tas-grants': 'TAS',
  'act-grants': 'ACT',
  'nt-grants': 'NT',
  'grantconnect': 'Federal',
};

const STATE_COLORS: Record<string, string> = {
  'nsw-grants': 'bg-bauhaus-blue',
  'vic-grants': 'bg-bauhaus-black',
  'qld-grants': 'bg-bauhaus-red',
  'sa-grants': 'bg-bauhaus-yellow',
  'wa-grants': 'bg-bauhaus-blue',
  'tas-grants': 'bg-bauhaus-red',
  'act-grants': 'bg-bauhaus-black',
  'nt-grants': 'bg-bauhaus-yellow',
  'grantconnect': 'bg-bauhaus-blue',
};

async function getStats() {
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();

  // Total gov grants
  const govCountPromises = GOV_SOURCES.map(async (src) => {
    const { count } = await supabase.from('grant_opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('source', src);
    return count || 0;
  });
  const govCounts = await Promise.all(govCountPromises);
  const totalGovGrants = govCounts.reduce((a, b) => a + b, 0);

  // States with grants
  const statesWithGrants = govCounts.filter(c => c > 0).length;

  // Open gov grants
  const openCountPromises = GOV_SOURCES.map(async (src) => {
    const { count } = await supabase.from('grant_opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('source', src)
      .gt('closes_at', now);
    return count || 0;
  });
  const openCounts = await Promise.all(openCountPromises);
  const openGovGrants = openCounts.reduce((a, b) => a + b, 0);

  // Open funding amount
  const openFundingPromises = GOV_SOURCES.map(async (src) => {
    const { data } = await supabase.from('grant_opportunities')
      .select('amount_max')
      .eq('source', src)
      .gt('closes_at', now)
      .not('amount_max', 'is', null);
    return data?.reduce((sum: number, r: { amount_max: number }) => sum + (r.amount_max || 0), 0) || 0;
  });
  const openFundingAmounts = await Promise.all(openFundingPromises);
  const openFundingTotal = openFundingAmounts.reduce((a, b) => a + b, 0);

  return { totalGovGrants, statesWithGrants, openGovGrants, openFundingTotal };
}

async function getByState() {
  const supabase = getServiceSupabase();

  const stateCountsArr = await Promise.all(
    GOV_SOURCES.map(async (src) => {
      const { count } = await supabase.from('grant_opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('source', src);
      return { source: src, cnt: count || 0 };
    })
  );

  return stateCountsArr.filter(s => s.cnt > 0).sort((a, b) => b.cnt - a.cnt);
}

export default async function ForGovernmentPage() {
  let stats = { totalGovGrants: 0, statesWithGrants: 0, openGovGrants: 0, openFundingTotal: 0 };
  let byState: Array<{ source: string; cnt: number }> = [];

  try {
    [stats, byState] = await Promise.all([getStats(), getByState()]);
  } catch {
    // DB not configured
  }

  const maxCnt = byState.length ? Math.max(...byState.map(s => s.cnt)) : 1;

  const formatMoney = (n: number) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${n.toLocaleString()}`;
  };

  return (
    <div>
      {/* Hero */}
      <section className="py-16 sm:py-24">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-4">
          For Government
        </p>
        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-bauhaus-black mb-6 tracking-tight leading-[0.9]">
          See How Public<br />Funding Reaches<br /><span className="text-bauhaus-blue">Communities.</span>
        </h1>
        <p className="text-lg text-bauhaus-muted max-w-xl mb-10 leading-relaxed font-medium">
          Track grant programs from announcement to impact. Understand geographic distribution,
          sector coverage, and community reach.
        </p>
        <div className="flex gap-0 flex-wrap">
          <a
            href="/dashboard"
            className="px-6 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-red transition-colors"
          >
            View Dashboard
          </a>
          <a
            href="/reports"
            className="px-6 py-3 bg-white text-bauhaus-black font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-canvas transition-colors"
          >
            Grant Program Insights
          </a>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-4 border-bauhaus-black mb-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0">
          <div className="p-6 text-center border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
            <div className="text-3xl sm:text-4xl font-black tabular-nums">{stats.totalGovGrants.toLocaleString()}</div>
            <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted">Government Grants</div>
          </div>
          <div className="p-6 text-center border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black bg-bauhaus-blue/5">
            <div className="text-3xl sm:text-4xl font-black tabular-nums text-bauhaus-blue">{stats.statesWithGrants}</div>
            <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted">States Covered</div>
          </div>
          <div className="p-6 text-center border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black bg-bauhaus-yellow/10">
            <div className="text-3xl sm:text-4xl font-black tabular-nums">{stats.openGovGrants.toLocaleString()}</div>
            <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted">Currently Open</div>
          </div>
          <div className="p-6 text-center bg-money/5">
            <div className="text-3xl sm:text-4xl font-black tabular-nums text-money">{formatMoney(stats.openFundingTotal)}</div>
            <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted">Open Funding</div>
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="mb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
            <h3 className="font-black text-bauhaus-black mb-2 text-sm uppercase tracking-widest">Program Tracking</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              See how your programs are discovered and where funding flows geographically.
              Track reach and uptake across regions.
            </p>
          </div>
          <div className="bg-white border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
            <h3 className="font-black text-bauhaus-black mb-2 text-sm uppercase tracking-widest">Gap Analysis</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              Identify regions, sectors, and communities underserved by current programs.
              See where funding doesn&apos;t reach.
            </p>
          </div>
          <div className="bg-white border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
            <h3 className="font-black text-bauhaus-black mb-2 text-sm uppercase tracking-widest">Cross-Jurisdictional</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              Compare federal, state, and local programs side-by-side.
              Understand overlaps, gaps, and complementary funding.
            </p>
          </div>
        </div>
      </section>

      {/* How It Helps */}
      <section className="border-t-4 border-bauhaus-black pt-12 mb-16">
        <h2 className="text-2xl font-black text-bauhaus-black mb-8">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { step: '1', title: 'Search Government Grants', desc: 'Find all programs across federal, state, and local government.' },
            { step: '2', title: 'Filter by State & Sector', desc: 'Drill into specific jurisdictions, policy areas, and target beneficiaries.' },
            { step: '3', title: 'Analyse Distribution', desc: 'See geographic spread, sector concentration, and funding gaps.' },
            { step: '4', title: 'Identify Gaps', desc: 'Discover underserved communities and sectors where new programs could help.' },
          ].map((item) => (
            <div key={item.step} className="flex gap-4">
              <div className="w-10 h-10 bg-bauhaus-black text-white font-black text-lg flex items-center justify-center flex-shrink-0">
                {item.step}
              </div>
              <div>
                <h3 className="font-black text-sm text-bauhaus-black mb-1">{item.title}</h3>
                <p className="text-sm text-bauhaus-muted leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Data Preview — Grants by State */}
      <section className="border-4 border-bauhaus-black mb-16">
        <div className="bg-bauhaus-blue px-6 py-3">
          <h2 className="text-xs font-black text-white uppercase tracking-[0.3em]">Government Grants by Jurisdiction</h2>
        </div>
        <div className="p-6 space-y-3">
          {byState.length > 0 ? byState.map(({ source, cnt }) => (
            <div key={source} className="flex items-center gap-3">
              <span className="text-xs font-black w-14 text-right tabular-nums">{STATE_LABELS[source] || source}</span>
              <div className="flex-1 h-6 bg-bauhaus-black/5 border-2 border-bauhaus-black relative">
                <div
                  className={`h-full ${STATE_COLORS[source] || 'bg-bauhaus-blue'} transition-all`}
                  style={{ width: `${Math.max((cnt / maxCnt) * 100, 2)}%` }}
                />
              </div>
              <span className="text-xs font-black tabular-nums w-14 text-right">{cnt.toLocaleString()}</span>
            </div>
          )) : (
            <p className="text-sm text-bauhaus-muted text-center py-4">No government grant data available</p>
          )}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t-4 border-bauhaus-black pt-12 pb-8 text-center">
        <h2 className="text-2xl sm:text-3xl font-black text-bauhaus-black mb-4">Make Your Grants Easier to Find</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-md mx-auto">
          GrantScope aggregates and structures grant data so communities can find your programs.
          Get in touch to improve your program&apos;s discoverability.
        </p>
        <a
          href="mailto:hello@grantscope.au"
          className="inline-block px-6 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-red transition-colors"
        >
          Contact Us
        </a>
      </section>
    </div>
  );
}
