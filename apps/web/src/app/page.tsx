import { getServiceSupabase } from '@/lib/supabase';
import { money, fmt } from '@/lib/format';
import { UnifiedSearch } from './components/unified-search';

export const dynamic = 'force-dynamic';

async function getDonorContractorHeadlineStats(
  supabase: ReturnType<typeof getServiceSupabase>,
) {
  const [{ count }, { data }] = await Promise.all([
    supabase.from('mv_gs_donor_contractors').select('gs_id', { count: 'exact', head: true }),
    supabase.from('mv_gs_donor_contractors').select('total_donated, total_contract_value'),
  ]);

  let totalDonated = 0;
  let totalContracts = 0;

  for (const row of data || []) {
    totalDonated += Number(row.total_donated || 0);
    totalContracts += Number(row.total_contract_value || 0);
  }

  return {
    count: count || 0,
    totalDonated,
    totalContracts,
  };
}

/** Safe count helper — returns 0 on failure instead of throwing */
async function safeCount(
  query: PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number> {
  try {
    const { count } = await query;
    return count || 0;
  } catch {
    return 0;
  }
}

async function getStats() {
  const supabase = getServiceSupabase();

  // Use 'estimated' for large tables (>100K rows) to avoid PostgREST timeouts
  const [
    totalGrants,
    totalFoundations,
    profiledFoundations,
    embeddedGrants,
    openGrants,
    totalPrograms,
    acncCharities,
    communityOrgs,
    withAmounts,
    socialEnterprises,
    totalEntities,
    totalRelationships,
    totalAustenderContracts,
    totalPoliticalDonations,
    donorContractorStats,
  ] = await Promise.all([
    safeCount(supabase.from('grant_opportunities').select('*', { count: 'exact', head: true })),
    safeCount(supabase.from('foundations').select('*', { count: 'exact', head: true })),
    safeCount(supabase.from('foundations').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null)),
    safeCount(supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }).not('embedding', 'is', null)),
    safeCount(supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }).gt('closes_at', new Date().toISOString())),
    safeCount(supabase.from('foundation_programs').select('*', { count: 'exact', head: true }).in('status', ['open', 'closed'])),
    safeCount(supabase.from('acnc_ais').select('*', { count: 'estimated', head: true })),
    safeCount(supabase.from('community_orgs').select('*', { count: 'exact', head: true })),
    safeCount(supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }).not('amount_max', 'is', null)),
    safeCount(supabase.from('social_enterprises').select('*', { count: 'exact', head: true })),
    safeCount(supabase.from('gs_entities').select('*', { count: 'estimated', head: true })),
    safeCount(supabase.from('gs_relationships').select('*', { count: 'estimated', head: true })),
    safeCount(supabase.from('austender_contracts').select('*', { count: 'estimated', head: true })),
    safeCount(supabase.from('political_donations').select('*', { count: 'estimated', head: true })),
    getDonorContractorHeadlineStats(supabase),
  ]);

  // Grants by state — fetch source column for state scrapers and count client-side
  const stateSources = ['nsw-grants','vic-grants','qld-grants','sa-grants','wa-grants','tas-grants','act-grants','nt-grants'];
  const stateCountsArr = await Promise.all(
    stateSources.map(async (src) => {
      const cnt = await safeCount(
        supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }).eq('source', src),
      );
      return { source: src, cnt };
    })
  );
  const byState = stateCountsArr.filter(s => s.cnt > 0).sort((a, b) => b.cnt - a.cnt);

  // Distinct source count — fetch a sample of sources
  let sourceCount = 0;
  try {
    const { data: sourceSample } = await supabase.from('grant_opportunities')
      .select('source')
      .limit(10000);
    sourceCount = sourceSample ? new Set(sourceSample.map((r: { source: string }) => r.source)).size : 0;
  } catch { /* fallback to 0 */ }

  // Category breakdown
  const knownCats = ['arts','community','technology','regenerative','enterprise','general','health','education','indigenous','justice','sport','research'];
  const catCountsArr = await Promise.all(
    knownCats.map(async (cat) => {
      const cnt = await safeCount(
        supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }).contains('categories', [cat]),
      );
      return { cat, cnt };
    })
  );
  const categories = catCountsArr.filter(c => c.cnt > 0).sort((a, b) => b.cnt - a.cnt).slice(0, 10);

  return {
    totalGrants,
    totalFoundations,
    profiledFoundations,
    embeddedGrants,
    openGrants,
    totalPrograms,
    acncCharities,
    communityOrgs,
    socialEnterprises,
    withAmounts,
    totalEntities,
    totalRelationships,
    totalAustenderContracts,
    totalPoliticalDonations,
    donorContractorCount: donorContractorStats.count,
    dcTotalDonated: donorContractorStats.totalDonated,
    dcTotalContracts: donorContractorStats.totalContracts,
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

export default async function HomePage() {
  let stats = {
    totalGrants: 0, totalFoundations: 0, profiledFoundations: 0,
    embeddedGrants: 0, openGrants: 0, totalPrograms: 0,
    acncCharities: 0, communityOrgs: 0, socialEnterprises: 0, withAmounts: 0,
    totalEntities: 0, totalRelationships: 0,
    totalAustenderContracts: 0, totalPoliticalDonations: 0,
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
  const heroEvidenceLine =
    stats.totalEntities > 0 && stats.totalAustenderContracts > 0 && stats.totalPoliticalDonations > 0
      ? `CivicGraph connects ${fmt(stats.totalEntities)} entities, ${fmt(stats.totalAustenderContracts)} contracts, and ${fmt(stats.totalPoliticalDonations)} donations into the decision layer for Australian public spending.`
      : 'CivicGraph connects supplier intelligence, place-based funding data, and donation signals into the decision layer for Australian public spending.';

  return (
    <div>
      {/* Hero */}
      <section className="py-16 sm:py-24">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-4">
          Decision Infrastructure for Government &amp; Social Sector
        </p>
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-bauhaus-black mb-6 tracking-tight leading-[0.9]">
          Know Who to Fund.<br />Know Who to Contract.<br /><span className="text-bauhaus-blue">Know It Worked.</span>
        </h1>
        <p className="text-lg text-bauhaus-muted max-w-xl mb-10 leading-relaxed font-medium">
          Procurement intelligence. Place-based allocation analysis. Governed proof of outcomes.{' '}
          {heroEvidenceLine}
        </p>

        <UnifiedSearch />

        <div className="flex gap-0 flex-wrap mb-6">
          <a href="/tender-intelligence" className="px-6 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-red bauhaus-shadow-sm">
            Procurement Intelligence
          </a>
          <a href="/places" className="px-6 py-3 bg-white text-bauhaus-black font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-yellow">
            Place Packs
          </a>
          <a href="/grants" className="px-6 py-3 bg-white text-bauhaus-black font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black border-l-0 hover:bg-bauhaus-blue hover:text-white">
            Search Grants
          </a>
        </div>
        <div className="flex gap-2 flex-wrap mb-6 max-w-xl">
          <span className="text-xs font-black text-bauhaus-muted uppercase tracking-widest self-center mr-1">Quick:</span>
          {[
            { label: 'Supplier discovery workflow', href: '/tender-intelligence#discover' },
            { label: 'Social procurement analyser', href: '/procurement' },
            { label: 'Intelligence pack preview', href: '/tender-intelligence#pack' },
            { label: 'Funding gaps by postcode', href: '/places' },
            { label: 'Due diligence report', href: '/reports/donor-contractors' },
          ].map(q => (
            <a
              key={q.label}
              href={q.href}
              className="text-xs px-3 py-1.5 bg-link-light text-bauhaus-blue font-bold border-2 border-bauhaus-blue/20 hover:border-bauhaus-blue transition-colors"
            >
              {q.label}
            </a>
          ))}
        </div>
      </section>

      {/* The Problem */}
      <section className="border-4 border-bauhaus-black mb-16 bg-bauhaus-black text-white">
        <div className="p-8 sm:p-12">
          <h2 className="text-2xl sm:text-3xl font-black mb-6 leading-tight">
            Every Procurement Decision Is Made With Incomplete Data
          </h2>
          <div className="space-y-4 text-base font-medium leading-relaxed text-white/85 max-w-2xl">
            <p>
              <strong className="text-bauhaus-yellow">$74 billion</strong> in government contracts awarded annually.
              Procurement officers make supplier decisions from spreadsheets.
              Commissioners allocate funding without seeing where money already flows.
              Nobody connects the contract to the community outcome.
            </p>
            <p>
              CivicGraph is the decision layer that connects supplier intelligence,
              place-based funding data, and outcome evidence &mdash; so every allocation
              decision is defensible, every renewal is justified, and every gap is visible.
            </p>
          </div>
          <div className="flex gap-4 flex-wrap mt-8">
            <a href="/tender-intelligence" className="px-6 py-3 bg-bauhaus-red text-white font-black text-xs uppercase tracking-widest border-4 border-white hover:bg-white hover:text-bauhaus-black transition-colors">
              See Procurement Intelligence
            </a>
            <a href="/for/government" className="px-6 py-3 bg-transparent text-white font-black text-xs uppercase tracking-widest border-4 border-white/40 hover:border-white hover:bg-white hover:text-bauhaus-black transition-colors">
              For Government
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
            {stats.sourceCount || 44} data sources &middot; {stats.openGrants.toLocaleString()} grants open now &middot; {stats.profiledFoundations.toLocaleString()} AI-profiled foundations &middot; Updated daily
          </p>
        </div>
      </section>

      {/* Three Product Families */}
      <section className="border-t-4 border-bauhaus-black pt-16 pb-12">
        <h2 className="text-2xl font-black text-center text-bauhaus-black mb-3">Three Products. One Decision Layer.</h2>
        <p className="text-sm text-bauhaus-muted text-center mb-10 max-w-2xl mx-auto">
          From finding the right supplier, to allocating resources where they&apos;re needed,
          to proving the investment worked. Each layer makes the next more powerful.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          <a href="/tender-intelligence" className="group border-4 border-bauhaus-black p-8 bg-white bauhaus-shadow-sm hover:bg-bauhaus-blue hover:text-white transition-colors">
            <div className="text-xs font-black text-bauhaus-blue uppercase tracking-widest mb-4 group-hover:text-bauhaus-yellow">Product 1 &mdash; Available Now</div>
            <h3 className="font-black text-bauhaus-black mb-2 text-lg group-hover:text-white">Procurement Intelligence</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed mb-4 group-hover:text-white/70">
              Discover suppliers. Check compliance. Generate bid-ready intelligence packs.
              National contract history cross-referenced with {stats.totalEntities.toLocaleString()} entities.
              Replace spreadsheets with a defensible market view.
            </p>
            <div className="flex flex-wrap gap-2">
              {['Supplier Discovery', 'Compliance', 'Intelligence Packs', 'List Enrichment'].map(t => (
                <span key={t} className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border-2 border-bauhaus-blue/20 text-bauhaus-blue group-hover:border-white/30 group-hover:text-white/80">{t}</span>
              ))}
            </div>
          </a>
          <a href="/places" className="group border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-8 bg-bauhaus-black hover:bg-bauhaus-yellow transition-colors">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-4 group-hover:text-bauhaus-black">Product 2 &mdash; Available Now</div>
            <h3 className="font-black text-white mb-2 text-lg group-hover:text-bauhaus-black">Allocation Intelligence</h3>
            <p className="text-sm text-white/70 leading-relaxed mb-4 group-hover:text-bauhaus-black/70">
              Place-based funding analysis. Gap scoring. Commissioning intelligence.
              See where money flows, where it doesn&apos;t, and where
              capability doesn&apos;t match need.
            </p>
            <div className="flex flex-wrap gap-2">
              {['Place Packs', 'Gap Analysis', 'Commissioning', 'SEIFA + Remoteness'].map(t => (
                <span key={t} className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border-2 border-white/20 text-white/60 group-hover:border-bauhaus-black/20 group-hover:text-bauhaus-black/60">{t}</span>
              ))}
            </div>
          </a>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-8 bg-bauhaus-red/10">
            <div className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-4">Product 3 &mdash; Coming Soon</div>
            <h3 className="font-black text-bauhaus-black mb-2 text-lg">Governed Proof</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed mb-4">
              Did procurement create community value? Did this commissioning strategy work?
              Rights-governed, consent-based evidence that helps defend renewals,
              justify policy, and prove long-term outcomes.
            </p>
            <div className="flex flex-wrap gap-2">
              {['Outcome Evidence', 'Community Voice', 'Renewal Defence', 'Policy Proof'].map(t => (
                <span key={t} className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border-2 border-bauhaus-red/20 text-bauhaus-red/60">{t}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="border-4 border-t-0 border-bauhaus-black bg-bauhaus-canvas p-6 text-center">
          <p className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">Together, These Create</p>
          <p className="text-lg font-black text-bauhaus-black">The Decision Layer for Australian Public Spending</p>
          <p className="text-sm text-bauhaus-muted">Who gets funded. Who gets contracted. Where services go. How allocations are justified.</p>
        </div>
      </section>

      {/* Data Sources */}
      <section className="border-t-4 border-bauhaus-black pt-16 pb-8">
        <h2 className="text-2xl font-black text-center text-bauhaus-black mb-3">Data Sources</h2>
        <p className="text-center text-sm text-bauhaus-muted mb-10 max-w-2xl mx-auto">
          CivicGraph connects {stats.sourceCount || 44} data sources across government procurement, philanthropy,
          political donations, corporate filings, and community organisations into a single market map.
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
            { name: 'ABR', color: 'bg-bauhaus-yellow' },
            { name: 'NDIS', color: 'bg-bauhaus-blue' },
            { name: 'Modern Slavery Register', color: 'bg-bauhaus-black' },
            { name: 'Lobbying Register', color: 'bg-bauhaus-blue' },
            { name: 'State Procurement', color: 'bg-bauhaus-red' },
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
        <h2 className="text-2xl font-black text-center text-bauhaus-black mb-2">CivicGraph Intelligence</h2>
        <p className="text-center text-bauhaus-muted mb-10 text-sm font-medium">Living investigations into how money flows — updated as new data arrives</p>
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
              <p className="text-sm text-bauhaus-muted group-hover:text-white/60">National charity registry analysis with longitudinal ACNC reporting and funding-flow context.</p>
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
              <p className="text-sm text-bauhaus-muted group-hover:text-white/80">A national market map for social enterprise, Indigenous business, and mission-led providers.</p>
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
