import { getServiceSupabase } from '@/lib/supabase';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'For Government | CivicGraph Australia',
  description: 'Procurement intelligence, grant program tracking, and supplier discovery. CivicGraph connects $74B in government contracts to community outcomes.',
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
          For Procurement Officers, Commissioners &amp; Program Managers
        </p>
        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-bauhaus-black mb-6 tracking-tight leading-[0.9]">
          Find the Right<br />Supplier. Fund the<br /><span className="text-bauhaus-blue">Right Place.</span>
        </h1>
        <p className="text-lg text-bauhaus-muted max-w-xl mb-10 leading-relaxed font-medium">
          672,000 contracts. 99,000 entities. 2,900 postcodes analysed. CivicGraph replaces
          spreadsheets and manual research with decision infrastructure — from supplier
          discovery to place-based allocation to outcome evidence.
        </p>
        <div className="flex gap-0 flex-wrap">
          <a
            href="/tender-intelligence"
            className="px-6 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-red transition-colors"
          >
            Tender Intelligence
          </a>
          <a
            href="/places"
            className="px-6 py-3 bg-white text-bauhaus-black font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-yellow transition-colors"
          >
            Place Packs
          </a>
          <a
            href="mailto:hello@civicgraph.au?subject=Government%20enquiry"
            className="px-6 py-3 bg-white text-bauhaus-black font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black border-l-0 hover:bg-bauhaus-blue hover:text-white transition-colors"
          >
            Talk to Us
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

      {/* Three Product Families for Government */}
      <section className="mb-16">
        <h2 className="text-xl font-black text-bauhaus-black mb-6 uppercase tracking-wider">Three Products for Government Decision-Makers</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          <a href="/tender-intelligence" className="group bg-bauhaus-blue border-4 border-bauhaus-black p-6 hover:bg-bauhaus-black transition-colors">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Product 1</div>
            <h3 className="font-black text-white mb-2 text-lg">Procurement Intelligence</h3>
            <p className="text-sm text-white/70 leading-relaxed mb-3">
              Discover suppliers across 99K entities. Check compliance from 20+ data sources.
              Generate bid-ready intelligence packs. Meet Indigenous procurement targets with verified data.
            </p>
            <span className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest group-hover:text-white">Try Now &rarr;</span>
          </a>
          <a href="/places" className="group bg-bauhaus-black border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 hover:bg-bauhaus-yellow transition-colors">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2 group-hover:text-bauhaus-black">Product 2</div>
            <h3 className="font-black text-white mb-2 text-lg group-hover:text-bauhaus-black">Allocation Intelligence</h3>
            <p className="text-sm text-white/70 leading-relaxed mb-3 group-hover:text-bauhaus-black/70">
              Place-based funding analysis across 2,900 postcodes. Gap scoring by SEIFA disadvantage
              and remoteness. See where money flows and where capability doesn&apos;t match need.
            </p>
            <span className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest group-hover:text-bauhaus-black">Explore Places &rarr;</span>
          </a>
          <div className="bg-bauhaus-red/10 border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6">
            <div className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-2">Product 3 &mdash; Coming</div>
            <h3 className="font-black text-bauhaus-black mb-2 text-lg">Governed Proof</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed mb-3">
              Did procurement create community value? Did this commissioning strategy work?
              Rights-governed outcome evidence for renewal defence and policy justification.
            </p>
            <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">Register Interest &rarr;</span>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="border-t-4 border-bauhaus-black pt-12 mb-16">
        <h2 className="text-2xl font-black text-bauhaus-black mb-8">Workflow</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { step: '1', title: 'Discover Suppliers', desc: 'Search by entity type, geography, Indigenous status, contract history, and compliance signals.' },
            { step: '2', title: 'Score Compliance', desc: 'Cross-reference ACNC, ATO, ASIC, ORIC data. Generate risk and capability profiles.' },
            { step: '3', title: 'Analyse Places', desc: 'See funding by postcode, remoteness, SEIFA. Identify gaps between need and provision.' },
            { step: '4', title: 'Defend Decisions', desc: 'Export intelligence packs, place reports, and outcome evidence for audit and renewal.' },
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
        <h2 className="text-2xl sm:text-3xl font-black text-bauhaus-black mb-4">
          Default Infrastructure for<br />Procurement &amp; Allocation Decisions
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-lg mx-auto">
          CivicGraph is not a grant search engine. It&apos;s the decision layer that
          connects who gets funded, who gets contracted, and where services go
          — with the data to defend every allocation.
        </p>
        <div className="flex gap-0 flex-wrap justify-center">
          <a
            href="/tender-intelligence"
            className="px-6 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-red transition-colors"
          >
            Try Procurement Intelligence
          </a>
          <a
            href="mailto:hello@civicgraph.au?subject=Government%20enquiry"
            className="px-6 py-3 bg-white text-bauhaus-black font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-canvas transition-colors"
          >
            Talk to Us
          </a>
        </div>
      </section>
    </div>
  );
}
