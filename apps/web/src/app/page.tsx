import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function getStats() {
  const supabase = getServiceSupabase();

  const [
    grantsResult,
    foundationsResult,
    profiledResult,
    embeddedResult,
    openResult,
    programsResult,
    acncResult,
    communityResult,
    withAmountsResult,
    socialEnterprisesResult,
    entitiesResult,
    relationshipsResult,
    donorContractorsResult,
  ] = await Promise.all([
    supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }),
    supabase.from('foundations').select('*', { count: 'exact', head: true }),
    supabase.from('foundations').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
    supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }).not('embedding', 'is', null),
    supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }).gt('closes_at', new Date().toISOString()),
    supabase.from('foundation_programs').select('*', { count: 'exact', head: true }),
    supabase.from('acnc_ais').select('*', { count: 'exact', head: true }),
    supabase.from('community_orgs').select('*', { count: 'exact', head: true }),
    supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }).not('amount_max', 'is', null),
    supabase.from('social_enterprises').select('*', { count: 'exact', head: true }),
    supabase.from('gs_entities').select('*', { count: 'exact', head: true }),
    supabase.from('gs_relationships').select('*', { count: 'exact', head: true }),
    supabase.from('mv_gs_donor_contractors').select('total_donated, total_contract_value').order('total_donated', { ascending: false }).limit(200),
  ]);

  // Grants by state — fetch source column for state scrapers and count client-side
  const stateSources = ['nsw-grants','vic-grants','qld-grants','sa-grants','wa-grants','tas-grants','act-grants','nt-grants'];
  const stateCountsArr = await Promise.all(
    stateSources.map(async (src) => {
      const { count } = await supabase.from('grant_opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('source', src);
      return { source: src, cnt: count || 0 };
    })
  );
  const byState = stateCountsArr.filter(s => s.cnt > 0).sort((a, b) => b.cnt - a.cnt);

  // Distinct source count — fetch a sample of sources
  const { data: sourceSample } = await supabase.from('grant_opportunities')
    .select('source')
    .limit(10000);
  const sourceCount = sourceSample ? new Set(sourceSample.map((r: { source: string }) => r.source)).size : 0;

  // Category breakdown — use the categories view if it exists, otherwise hardcode from known data
  // PostgREST can't do unnest+group by, so we'll use known category list and count each
  const knownCats = ['arts','community','technology','regenerative','enterprise','general','health','education','indigenous','justice','sport','research'];
  const catCountsArr = await Promise.all(
    knownCats.map(async (cat) => {
      const { count } = await supabase.from('grant_opportunities')
        .select('*', { count: 'exact', head: true })
        .contains('categories', [cat]);
      return { cat, cnt: count || 0 };
    })
  );
  const categories = catCountsArr.filter(c => c.cnt > 0).sort((a, b) => b.cnt - a.cnt).slice(0, 10);

  // Aggregate donor-contractor stats
  const dcRows = (donorContractorsResult.data || []) as Array<{ total_donated: string; total_contract_value: string }>;
  let dcTotalDonated = 0, dcTotalContracts = 0;
  for (const dc of dcRows) {
    dcTotalDonated += Number(dc.total_donated);
    dcTotalContracts += Number(dc.total_contract_value);
  }

  return {
    totalGrants: grantsResult.count || 0,
    totalFoundations: foundationsResult.count || 0,
    profiledFoundations: profiledResult.count || 0,
    embeddedGrants: embeddedResult.count || 0,
    openGrants: openResult.count || 0,
    totalPrograms: programsResult.count || 0,
    acncCharities: acncResult.count || 0,
    communityOrgs: communityResult.count || 0,
    socialEnterprises: socialEnterprisesResult.count || 0,
    withAmounts: withAmountsResult.count || 0,
    totalEntities: entitiesResult.count || 0,
    totalRelationships: relationshipsResult.count || 0,
    donorContractorCount: dcRows.length,
    dcTotalDonated,
    dcTotalContracts,
    byState,
    sourceCount,
    categories,
  };
}

const STATE_LABELS: Record<string, string> = {
  'nsw-grants': 'NSW',
  'vic-grants': 'VIC',
  'qld-grants': 'QLD',
  'sa-grants': 'SA',
  'wa-grants': 'WA',
  'tas-grants': 'TAS',
  'act-grants': 'ACT',
  'nt-grants': 'NT',
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
};

const CAT_LABELS: Record<string, string> = {
  arts: 'Arts & Culture',
  community: 'Community',
  technology: 'Technology',
  regenerative: 'Environment',
  enterprise: 'Business',
  general: 'General',
  health: 'Health',
  education: 'Education',
  indigenous: 'First Nations',
  justice: 'Justice',
  sport: 'Sport',
  research: 'Research',
  disaster_relief: 'Disaster Relief',
};

function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

export default async function HomePage() {
  let stats = {
    totalGrants: 0, totalFoundations: 0, profiledFoundations: 0,
    embeddedGrants: 0, openGrants: 0, totalPrograms: 0,
    acncCharities: 0, communityOrgs: 0, socialEnterprises: 0, withAmounts: 0,
    totalEntities: 0, totalRelationships: 0,
    donorContractorCount: 0, dcTotalDonated: 0, dcTotalContracts: 0,
    byState: null as Array<{ source: string; cnt: number }> | null,
    sourceCount: 0,
    categories: null as Array<{ cat: string; cnt: number }> | null,
  };
  try {
    stats = await getStats();
  } catch {
    // DB not yet configured
  }

  // unused after homepage cleanup: embeddedPct, maxStateCnt, maxCatCnt

  return (
    <div>
      {/* Hero */}
      <section className="py-16 sm:py-24">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-4">
          Open Funding Intelligence
        </p>
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-bauhaus-black mb-6 tracking-tight leading-[0.9]">
          Where Does<br />Australia&apos;s<br /><span className="text-bauhaus-blue">Funding Go?</span>
        </h1>
        <p className="text-lg text-bauhaus-muted max-w-xl mb-10 leading-relaxed font-medium">
          Every government grant, every foundation, every corporate giving program
          — searchable, current, and free. Australia&apos;s open grants infrastructure.
        </p>

        <form action="/grants" method="get" className="max-w-xl flex gap-0 mb-6">
          <input
            type="text"
            name="q"
            placeholder="Search grants, foundations, programs..."
            className="flex-1 px-5 py-3.5 text-sm font-bold border-4 border-bauhaus-black bg-white focus:bg-bauhaus-yellow focus:outline-none uppercase tracking-wider placeholder:text-bauhaus-muted placeholder:normal-case placeholder:tracking-normal"
          />
          <button
            type="submit"
            className="px-7 py-3.5 text-sm font-black bg-bauhaus-black text-white uppercase tracking-widest hover:bg-bauhaus-red cursor-pointer border-4 border-bauhaus-black"
          >
            Search
          </button>
        </form>
        <div className="flex gap-0 mb-6">
          <a href="/dashboard" className="px-6 py-3 bg-bauhaus-blue text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-black bauhaus-shadow-sm">
            Explore the Data
          </a>
        </div>
        <div className="flex gap-2 flex-wrap mb-6 max-w-xl">
          <span className="text-xs font-black text-bauhaus-muted uppercase tracking-widest self-center mr-1">Try AI:</span>
          {[
            'Find grants for First Nations arts in QLD',
            'What foundations fund environmental regeneration?',
            'Grants for youth mental health programs',
          ].map(q => (
            <a
              key={q}
              href={`/grants?mode=semantic&q=${encodeURIComponent(q)}`}
              className="text-xs px-3 py-1.5 bg-link-light text-bauhaus-blue font-bold border-2 border-bauhaus-blue/20 hover:border-bauhaus-blue transition-colors"
            >
              &ldquo;{q}&rdquo;
            </a>
          ))}
        </div>
      </section>

      {/* Why This Exists */}
      <section className="border-4 border-bauhaus-black mb-16 bg-bauhaus-black text-white">
        <div className="p-8 sm:p-12">
          <h2 className="text-2xl sm:text-3xl font-black mb-6 leading-tight">
            Why This Exists
          </h2>
          <div className="space-y-4 text-base font-medium leading-relaxed text-white/85 max-w-2xl">
            <p>
              <strong className="text-bauhaus-yellow">94%</strong> of charitable donations in Australia go to just 10% of organisations.
              First Nations communities receive <strong className="text-bauhaus-yellow">0.5%</strong> of philanthropic funding.
              Women and girls get <strong className="text-bauhaus-yellow">12%</strong>.
              The 16,000 smallest charities posted a collective net loss of <strong className="text-bauhaus-yellow">$144 million</strong> last year.
            </p>
            <p>
              GrantScope makes the invisible visible &mdash; tracing where money flows, who holds
              power, and what communities actually need. Every number is live. Every data source is open.
            </p>
          </div>
          <div className="flex gap-4 flex-wrap mt-8">
            <a href="/reports/community-parity" className="px-6 py-3 bg-bauhaus-red text-white font-black text-xs uppercase tracking-widest border-4 border-white hover:bg-white hover:text-bauhaus-black transition-colors">
              Read the Investigation
            </a>
            <a href="/reports/community-power" className="px-6 py-3 bg-transparent text-white font-black text-xs uppercase tracking-widest border-4 border-white/40 hover:border-white hover:bg-white hover:text-bauhaus-black transition-colors">
              Explore Alternatives
            </a>
          </div>
        </div>
      </section>

      {/* Entity Graph — the flagship finding */}
      {stats.donorContractorCount > 0 && (
        <section className="mb-16">
          <a href="/reports/donor-contractors" className="group block">
            <div className="border-4 border-bauhaus-black bg-bauhaus-red transition-all group-hover:-translate-y-1" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-black)' }}>
              <div className="p-8 sm:p-12">
                <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-3">Entity Graph Investigation</div>
                <h2 className="text-2xl sm:text-4xl font-black text-white mb-4 leading-tight">
                  {stats.donorContractorCount} Entities Donate to Political Parties<br />
                  AND Hold Government Contracts
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
                  <div>
                    <div className="text-3xl sm:text-4xl font-black text-white">{money(stats.dcTotalDonated)}</div>
                    <div className="text-white/60 text-sm font-bold mt-1">donated to parties</div>
                  </div>
                  <div>
                    <div className="text-3xl sm:text-4xl font-black text-white">{money(stats.dcTotalContracts)}</div>
                    <div className="text-white/60 text-sm font-bold mt-1">received in contracts</div>
                  </div>
                  <div>
                    <div className="text-3xl sm:text-4xl font-black text-bauhaus-yellow">
                      {stats.dcTotalDonated > 0 ? `${Math.round(stats.dcTotalContracts / stats.dcTotalDonated)}x` : '—'}
                    </div>
                    <div className="text-white/60 text-sm font-bold mt-1">return per dollar donated</div>
                  </div>
                </div>
                <p className="text-white/70 text-sm font-medium max-w-2xl mb-4">
                  Built from {stats.totalEntities.toLocaleString()} entities and {stats.totalRelationships.toLocaleString()} relationships
                  — cross-referencing AEC political donations, AusTender contracts, ACNC charities,
                  ORIC Indigenous corporations, ATO tax data, and ASIC company records by ABN.
                </p>
                <span className="inline-block px-6 py-2.5 bg-white text-bauhaus-black font-black text-xs uppercase tracking-widest group-hover:bg-bauhaus-yellow transition-colors">
                  Read the Full Investigation &rarr;
                </span>
              </div>
            </div>
          </a>
        </section>
      )}

      {/* Live Stats — clean, 5 numbers only */}
      <section className="border-4 border-bauhaus-black mb-16">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-0">
          <a href="/grants" className="group border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
            <div className="p-6 text-center transition-all group-hover:bg-bauhaus-blue group-hover:text-white">
              <div className="text-3xl sm:text-4xl font-black tabular-nums">{stats.totalGrants.toLocaleString()}</div>
              <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted group-hover:text-white/70">Grants</div>
            </div>
          </a>
          <a href="/foundations" className="group border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
            <div className="p-6 text-center transition-all group-hover:bg-bauhaus-red group-hover:text-white">
              <div className="text-3xl sm:text-4xl font-black tabular-nums">{stats.totalFoundations.toLocaleString()}</div>
              <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted group-hover:text-white/70">Foundations</div>
            </div>
          </a>
          <a href="/charities" className="group border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
            <div className="p-6 text-center transition-all group-hover:bg-bauhaus-black group-hover:text-white">
              <div className="text-3xl sm:text-4xl font-black tabular-nums">{stats.acncCharities.toLocaleString()}</div>
              <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted group-hover:text-white/70">Charities</div>
            </div>
          </a>
          <a href="/entities" className="group border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
            <div className="p-6 text-center transition-all group-hover:bg-bauhaus-yellow">
              <div className="text-3xl sm:text-4xl font-black tabular-nums">{stats.totalEntities.toLocaleString()}</div>
              <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted group-hover:text-bauhaus-black">Entities</div>
            </div>
          </a>
          <a href="/reports" className="group">
            <div className="p-6 text-center transition-all group-hover:bg-bauhaus-red group-hover:text-white">
              <div className="text-3xl sm:text-4xl font-black tabular-nums">{stats.totalRelationships.toLocaleString()}</div>
              <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted group-hover:text-white/70">Relationships</div>
            </div>
          </a>
        </div>
        <div className="border-t-4 border-bauhaus-black p-3 bg-bauhaus-canvas text-center">
          <p className="text-[11px] text-bauhaus-muted font-bold">
            {stats.sourceCount} data sources &middot; {stats.openGrants.toLocaleString()} grants open now &middot; {stats.profiledFoundations.toLocaleString()} AI-profiled foundations &middot; Updated daily
          </p>
        </div>
      </section>

      {/* Three pillars */}
      <section className="border-t-4 border-bauhaus-black pt-16 pb-12">
        <h2 className="text-2xl font-black text-center text-bauhaus-black mb-10">Four Layers of Funding Intelligence</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-0">
          <div className="border-4 border-bauhaus-black p-8 bg-white bauhaus-shadow-sm">
            <div className="w-12 h-12 bg-bauhaus-blue flex items-center justify-center mb-4 border-3 border-bauhaus-black">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="square" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="font-black text-bauhaus-black mb-2 text-sm tracking-widest">Government Grants</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              All 8 states and territories, GrantConnect, data.gov.au,
              and business.gov.au — {stats.sourceCount} data sources, updated daily.
            </p>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-8 bg-white bauhaus-shadow-sm">
            <div className="w-12 h-12 bg-bauhaus-red flex items-center justify-center mb-4 border-3 border-bauhaus-black rounded-full">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="square" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-black text-bauhaus-black mb-2 text-sm tracking-widest">Philanthropic Foundations</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              {stats.totalFoundations.toLocaleString()} foundations from the ACNC register.
              {stats.profiledFoundations.toLocaleString()} with AI-generated giving profiles.
              {stats.totalPrograms.toLocaleString()} active programs mapped.
            </p>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-8 bg-white bauhaus-shadow-sm">
            <div className="w-12 h-12 bg-bauhaus-yellow flex items-center justify-center mb-4 border-3 border-bauhaus-black">
              <svg className="w-6 h-6 text-bauhaus-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="square" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <h3 className="font-black text-bauhaus-black mb-2 text-sm tracking-widest">Corporate Transparency</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              ASX200 company foundations mapped to giving vs revenue.
              Who gives what, and is it enough?
            </p>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-8 bg-bauhaus-black bauhaus-shadow-sm">
            <div className="w-12 h-12 bg-bauhaus-red flex items-center justify-center mb-4 border-3 border-white rounded-full">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="square" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h3 className="font-black text-white mb-2 text-sm tracking-widest">Entity Graph</h3>
            <p className="text-sm text-white/70 leading-relaxed">
              {stats.totalEntities.toLocaleString()} entities, {stats.totalRelationships.toLocaleString()} relationships.
              Donations, contracts, grants, and corporate data — connected by ABN.
            </p>
          </div>
        </div>
      </section>

      {/* Data Sources */}
      <section className="border-t-4 border-bauhaus-black pt-16 pb-8">
        <h2 className="text-2xl font-black text-center text-bauhaus-black mb-3">Data Sources</h2>
        <p className="text-center text-sm text-bauhaus-muted mb-10 max-w-2xl mx-auto">
          GrantScope aggregates data from {stats.sourceCount} sources across every level of Australian government,
          the ACNC charity register ({stats.acncCharities.toLocaleString()} records), and philanthropic databases.
        </p>
        <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto mb-12">
          {[
            { name: 'GrantConnect', color: 'bg-bauhaus-blue' },
            { name: 'ACNC', color: 'bg-bauhaus-red' },
            { name: 'data.gov.au', color: 'bg-bauhaus-black' },
            { name: 'NSW.gov.au', color: 'bg-bauhaus-blue' },
            { name: 'QLD Grants', color: 'bg-bauhaus-red' },
            { name: 'VIC.gov.au', color: 'bg-bauhaus-black' },
            { name: 'SA.gov.au', color: 'bg-bauhaus-yellow' },
            { name: 'WA.gov.au', color: 'bg-bauhaus-blue' },
            { name: 'TAS.gov.au', color: 'bg-bauhaus-red' },
            { name: 'NT.gov.au', color: 'bg-bauhaus-yellow' },
            { name: 'ACT.gov.au', color: 'bg-bauhaus-black' },
            { name: 'ARC', color: 'bg-bauhaus-blue' },
            { name: 'NHMRC', color: 'bg-bauhaus-red' },
            { name: 'business.gov.au', color: 'bg-bauhaus-black' },
            { name: 'ORIC', color: 'bg-bauhaus-red' },
            { name: 'AusTender', color: 'bg-bauhaus-blue' },
            { name: 'ASIC', color: 'bg-bauhaus-black' },
            { name: 'ATO', color: 'bg-bauhaus-yellow' },
            { name: 'ASX', color: 'bg-bauhaus-red' },
            { name: 'AEC Donations', color: 'bg-bauhaus-red' },
            { name: 'Modern Slavery Register', color: 'bg-bauhaus-black' },
            { name: 'Lobbying Register', color: 'bg-bauhaus-blue' },
          ].map(src => (
            <span key={src.name} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-bauhaus-black">
              <span className={`w-2.5 h-2.5 ${src.color} border border-bauhaus-black`} />
              {src.name}
            </span>
          ))}
        </div>
      </section>

      {/* Reports teasers */}
      <section className="border-t-4 border-bauhaus-black pt-16 pb-8">
        <h2 className="text-2xl font-black text-center text-bauhaus-black mb-2">Living Reports</h2>
        <p className="text-center text-bauhaus-muted mb-10 text-sm font-medium">Data-driven investigations, updated as new data arrives</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
          <a href="/reports/donor-contractors" className="group block sm:col-span-2 lg:col-span-3">
            <div className="bg-bauhaus-red border-4 border-bauhaus-black p-5 transition-all group-hover:-translate-y-1" style={{ boxShadow: '6px 6px 0px 0px var(--color-bauhaus-black)' }}>
              <div className="text-xs font-black text-bauhaus-yellow mb-1 uppercase tracking-widest">Entity Graph Investigation</div>
              <h3 className="font-black text-white mb-1">Donate. Win Contracts. Repeat.</h3>
              <p className="text-sm text-white/80">{stats.donorContractorCount} entities donated {money(stats.dcTotalDonated)} to political parties and received {money(stats.dcTotalContracts)} in government contracts.</p>
            </div>
          </a>
          <a href="/reports/big-philanthropy" className="group block sm:col-span-2 lg:col-span-3">
            <div className="bg-bauhaus-black border-4 border-bauhaus-black p-5 transition-all group-hover:-translate-y-1" style={{ boxShadow: '6px 6px 0px 0px var(--color-bauhaus-red)' }}>
              <div className="text-xs font-black text-bauhaus-yellow mb-1 uppercase tracking-widest">Data Investigation</div>
              <h3 className="font-black text-white mb-1">Where Does Australia&apos;s $222 Billion Go?</h3>
              <p className="text-sm text-bauhaus-muted group-hover:text-white/60">359,678 charity records. 53,207 charities. 7 years of ACNC data.</p>
            </div>
          </a>
          <a href="/reports/community-parity" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-5 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-red group-hover:text-white">
              <div className="text-xs font-black text-bauhaus-red mb-1 uppercase tracking-widest group-hover:text-bauhaus-yellow">New</div>
              <h3 className="font-black text-bauhaus-black mb-1 group-hover:text-white">Community Parity</h3>
              <p className="text-sm text-bauhaus-muted group-hover:text-white/80">0.5% to First Nations. 12% to women. Who misses out.</p>
            </div>
          </a>
          <a href="/reports/community-power" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-5 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-blue group-hover:text-white">
              <div className="text-xs font-black text-bauhaus-blue mb-1 uppercase tracking-widest group-hover:text-bauhaus-yellow">New</div>
              <h3 className="font-black text-bauhaus-black mb-1 group-hover:text-white">Community Power Playbook</h3>
              <p className="text-sm text-bauhaus-muted group-hover:text-white/80">Co-ops, social enterprise, and alternatives to grants.</p>
            </div>
          </a>
          <a href="/reports/social-enterprise" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-5 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-red group-hover:text-white">
              <div className="text-xs font-black text-bauhaus-red mb-1 uppercase tracking-widest group-hover:text-bauhaus-yellow">New</div>
              <h3 className="font-black text-bauhaus-black mb-1 group-hover:text-white">Social Enterprise in Australia</h3>
              <p className="text-sm text-bauhaus-muted group-hover:text-white/80">20,000 businesses. $21B revenue. No register. Until now.</p>
            </div>
          </a>
          <a href="/reports/youth-justice" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-5 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-red group-hover:text-white">
              <div className="text-xs font-black text-bauhaus-red mb-1 uppercase tracking-widest group-hover:text-bauhaus-yellow">Flagship</div>
              <h3 className="font-black text-bauhaus-black mb-1 group-hover:text-white">QLD Youth Justice</h3>
              <p className="text-sm text-bauhaus-muted group-hover:text-white/80">$343M/year on detention. $1.3M per child. 73% reoffend.</p>
            </div>
          </a>
          <a href="/reports/power-dynamics" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-5 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-black group-hover:text-white">
              <div className="text-xs font-black text-purple mb-1 uppercase tracking-widest group-hover:text-bauhaus-yellow">Live</div>
              <h3 className="font-black text-bauhaus-black mb-1 group-hover:text-white">Power Dynamics</h3>
              <p className="text-sm text-bauhaus-muted group-hover:text-white/80">Who controls Australia&apos;s philanthropy?</p>
            </div>
          </a>
          <a href="/reports/access-gap" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-5 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-yellow">
              <div className="text-xs font-black text-bauhaus-yellow mb-1 uppercase tracking-widest group-hover:text-bauhaus-black">Live</div>
              <h3 className="font-black text-bauhaus-black mb-1">The Access Gap</h3>
              <p className="text-sm text-bauhaus-muted group-hover:text-bauhaus-black/70">Small orgs spend 40% on admin. Large orgs spend 15%.</p>
            </div>
          </a>
          <a href="/reports/money-flow" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-5 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-blue group-hover:text-white">
              <div className="text-xs font-black text-bauhaus-blue mb-1 uppercase tracking-widest group-hover:text-bauhaus-yellow">Live</div>
              <h3 className="font-black text-bauhaus-black mb-1 group-hover:text-white">Follow the Dollar</h3>
              <p className="text-sm text-bauhaus-muted group-hover:text-white/80">Trace funding flows from taxpayer to outcome.</p>
            </div>
          </a>
          <a href="/reports/state-of-the-nation" className="group block sm:col-span-2 lg:col-span-3">
            <div className="bg-bauhaus-red border-4 border-bauhaus-black p-5 transition-all group-hover:-translate-y-1" style={{ boxShadow: '6px 6px 0px 0px var(--color-bauhaus-black)' }}>
              <div className="text-xs font-black text-bauhaus-yellow mb-1 uppercase tracking-widest">Live Data</div>
              <h3 className="font-black text-white mb-1">State of the Nation</h3>
              <p className="text-sm text-white/80">Every entity in Australia — charities, companies, Indigenous corporations, contracts, tax data. Live numbers.</p>
            </div>
          </a>
          <a href="/reports/power-map" className="group block sm:col-span-2 lg:col-span-3">
            <div className="bg-white border-4 border-bauhaus-black p-5 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-black group-hover:text-white">
              <div className="text-xs font-black text-bauhaus-black mb-1 uppercase tracking-widest group-hover:text-bauhaus-yellow">Deep Research</div>
              <h3 className="font-black text-bauhaus-black mb-1 group-hover:text-white">Australia&apos;s Power Map</h3>
              <p className="text-sm text-bauhaus-muted group-hover:text-white/80">How open data can reshape who holds power. Concentration, procurement, tax, and the case for radical transparency.</p>
            </div>
          </a>
        </div>
      </section>
    </div>
  );
}
