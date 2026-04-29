import { getServiceSupabase } from '@/lib/report-supabase';
import { TableOfContents } from './toc';
import { ReportCTA } from '../_components/report-cta';

export const dynamic = 'force-static';

const LIVE_REPORTS = process.env.CIVICGRAPH_LIVE_REPORTS === 'true';

const SNAPSHOT_COUNTS = {
  total: 20000,
  indigenous: 3300,
  disability: 600,
  bcorp: 740,
  enriched: 4100,
  topStates: [
    { state: 'NSW', count: 6200 },
    { state: 'VIC', count: 5200 },
    { state: 'QLD', count: 3600 },
    { state: 'WA', count: 1900 },
    { state: 'SA', count: 1300 },
  ],
};

function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className="bg-white border-4 border-bauhaus-black p-5 bauhaus-shadow-sm">
      <div className={`text-3xl sm:text-4xl font-black tabular-nums ${color || 'text-bauhaus-black'}`}>{value}</div>
      <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mt-1">{label}</div>
    </div>
  );
}

function SectionHeading({ id, number, children }: { id: string; number: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-2xl sm:text-3xl font-black text-bauhaus-black mt-16 mb-6 flex items-start gap-4 scroll-mt-24">
      <span className="text-bauhaus-red font-black text-lg mt-1">{number}</span>
      <span>{children}</span>
    </h2>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return <div className="text-base text-bauhaus-black/80 leading-relaxed font-medium space-y-4 max-w-[680px]">{children}</div>;
}

function Callout({ children, color = 'yellow' }: { children: React.ReactNode; color?: 'yellow' | 'red' | 'blue' }) {
  const bg = color === 'red' ? 'bg-bauhaus-red text-white' : color === 'blue' ? 'bg-bauhaus-blue text-white' : 'bg-bauhaus-yellow text-bauhaus-black';
  return (
    <blockquote className={`${bg} border-4 border-bauhaus-black p-6 my-8 bauhaus-shadow-sm`}>
      <div className="text-lg font-bold leading-relaxed">{children}</div>
    </blockquote>
  );
}

export default async function SocialEnterpriseReportPage() {
  if (!LIVE_REPORTS) {
    return <SocialEnterpriseReportBody {...SNAPSHOT_COUNTS} />;
  }

  const supabase = getServiceSupabase();

  const [totalResult, indigenousResult, disabilityResult, bcorpResult, enrichedResult, stateResults] = await Promise.all([
    supabase.from('social_enterprises').select('*', { count: 'exact', head: true }),
    supabase.from('social_enterprises').select('*', { count: 'exact', head: true }).eq('org_type', 'indigenous_business'),
    supabase.from('social_enterprises').select('*', { count: 'exact', head: true }).eq('org_type', 'disability_enterprise'),
    supabase.from('social_enterprises').select('*', { count: 'exact', head: true }).eq('org_type', 'b_corp'),
    supabase.from('social_enterprises').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
    Promise.all(
      ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'NT', 'TAS', 'ACT'].map(async (st) => {
        const { count } = await supabase.from('social_enterprises').select('*', { count: 'exact', head: true }).eq('state', st);
        return { state: st, count: count || 0 };
      })
    ),
  ]);

  const total = totalResult.count || 0;
  const indigenous = indigenousResult.count || 0;
  const disability = disabilityResult.count || 0;
  const bcorp = bcorpResult.count || 0;
  const enriched = enrichedResult.count || 0;
  const topStates = stateResults.sort((a, b) => b.count - a.count).slice(0, 5);

  return <SocialEnterpriseReportBody total={total} indigenous={indigenous} disability={disability} bcorp={bcorp} enriched={enriched} topStates={topStates} />;
}

function SocialEnterpriseReportBody({
  total,
  indigenous,
  disability,
  bcorp,
  enriched,
  topStates,
}: {
  total: number;
  indigenous: number;
  disability: number;
  bcorp: number;
  enriched: number;
  topStates: Array<{ state: string; count: number }>;
}) {
  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
      </div>

      <header className="mb-12 border-b-4 border-bauhaus-black pb-12">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-3">Living Report</p>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-bauhaus-black leading-[0.95] mb-6">
          Social Enterprise<br />in <span className="text-bauhaus-red">Australia</span>
        </h1>
        <p className="text-lg text-bauhaus-muted font-medium max-w-2xl leading-relaxed mb-6">
          20,000 businesses trading for purpose. $21 billion in revenue. 300,000 jobs.
          No legal structure. No central register. No single place to find them all &mdash; until now.
        </p>
        <div className="flex flex-wrap gap-4 text-xs font-black text-bauhaus-muted uppercase tracking-widest">
          <span>Sources: FASES, ORIC, Social Traders, BuyAbility, B Corp, ACNC</span>
          <span>|</span>
          <span>Live Data &middot; {total.toLocaleString()} Records</span>
        </div>
      </header>

      {/* Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-12">
        <TableOfContents />

        <article className="min-w-0">

          {/* Key numbers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
            <Stat value="~20K" label="Social Enterprises" color="text-bauhaus-blue" />
            <Stat value="$21.3B" label="Annual Revenue" color="text-money" />
            <Stat value="300K" label="Jobs Created" color="text-bauhaus-blue" />
            <Stat value={total.toLocaleString()} label="In Our Directory" color="text-bauhaus-red" />
          </div>

          {/* ===== SECTION 1: THE INVISIBLE SECTOR ===== */}
          <SectionHeading id="invisible-sector" number="01">The Invisible Sector</SectionHeading>
          <Prose>
            <p>
              Australia has approximately 20,000 social enterprises generating $21.27 billion in
              annual revenue and employing over 300,000 people. That makes this sector larger than
              the entire Australian advertising industry. Larger than the beer industry. Larger than
              the domestic airline sector.
            </p>
            <p>
              And yet there is no official register. No dedicated legal structure. No central
              directory. If you wanted to find every social enterprise in your state &mdash; or even
              your suburb &mdash; you would need to search across a dozen fragmented directories,
              each with different definitions, different criteria, and different coverage gaps.
            </p>
            <p>
              This is the data problem that defines Australia&apos;s social enterprise sector.
              Not a lack of activity, but a lack of visibility. The enterprises exist. The revenue
              flows. The jobs are real. But the sector is structurally invisible to policymakers,
              procurement officers, investors, and the communities that could benefit most from
              finding them.
            </p>
          </Prose>

          <Callout>
            Australia has no official register of social enterprises. A $21 billion sector
            operates without the basic infrastructure that every other industry takes for granted.
          </Callout>

          {/* ===== SECTION 2: WHAT IS A SOCIAL ENTERPRISE ===== */}
          <SectionHeading id="what-is-se" number="02">What Is a Social Enterprise?</SectionHeading>
          <Prose>
            <p>
              A social enterprise is a business that trades to intentionally tackle social problems,
              improve communities, provide people with access to employment and training, or help
              the environment. The defining feature is not charity &mdash; it is trade. Social
              enterprises earn their revenue. They compete in markets. They employ staff.
            </p>
            <p>
              What makes them different from conventional businesses is structural: their
              purpose is locked in. Revenue serves mission, not shareholders. Surplus is
              reinvested into the community or the cause, not extracted as profit.
            </p>
            <p>
              Australia&apos;s social enterprise sector spans an enormous range:
            </p>
          </Prose>

          <div className="my-8 space-y-3 max-w-xl">
            {[
              { type: 'Indigenous Corporations', desc: 'Land management, language preservation, community stores, art centres, health services. Over 3,300 registered with ORIC.', count: indigenous.toLocaleString() },
              { type: 'Disability Enterprises', desc: 'Employment services and businesses providing meaningful work for people with disability. Historically called ADEs.', count: disability.toLocaleString() },
              { type: 'B Corporations', desc: 'Businesses certified against global social and environmental standards. Legally required to consider impact alongside profit.', count: bcorp.toLocaleString() },
              { type: 'Community Enterprises', desc: 'Cafes, op shops, cleaning services, catering, landscaping &mdash; businesses owned and run by communities to fund local priorities.' },
              { type: 'Cooperatives', desc: 'Member-owned businesses where governance is democratic. Agriculture, finance, housing, energy, retail.' },
            ].map((item) => (
              <div key={item.type} className="bg-white border-4 border-bauhaus-black p-4 bauhaus-shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-bauhaus-black text-sm">{item.type}</h3>
                      {item.count && (
                        <span className="text-[11px] px-1.5 py-0.5 font-black uppercase tracking-wider border-2 border-bauhaus-blue bg-link-light text-bauhaus-blue">
                          {item.count} tracked
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-bauhaus-muted font-medium mt-1">{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Prose>
            <p>
              The common thread is trade with purpose. Not grants with conditions attached.
              Not charity with power imbalances built in. Commerce structured so that economic
              activity itself creates social outcomes.
            </p>
          </Prose>

          {/* ===== SECTION 3: THE AUSTRALIAN LANDSCAPE ===== */}
          <SectionHeading id="landscape" number="03">The Australian Landscape</SectionHeading>
          <Prose>
            <p>
              The <strong className="text-bauhaus-black">Finding Australia&apos;s Social Enterprise
              Sector (FASES)</strong> study remains the most comprehensive attempt to map the sector.
              First published in 2016 and updated through the RISE program, it estimates 20,000
              social enterprises nationwide. But this number carries significant uncertainty &mdash;
              without a register, every count is an estimate.
            </p>
            <p>
              What the research does tell us is revealing. Social enterprises are predominantly
              small: 68% have fewer than 20 employees. They are concentrated in services (health,
              education, employment) but present across every industry. They are more likely than
              conventional businesses to employ people from disadvantaged backgrounds, and more
              likely to operate in regional and remote areas.
            </p>
            <p>
              The geographic distribution is uneven. Victoria has the most mature ecosystem &mdash;
              the Social Enterprise Strategy, social procurement framework, and strongest network
              infrastructure. NSW has the largest absolute numbers but less policy support. Queensland,
              Western Australia, and South Australia have growing sectors but thinner support networks.
              Tasmania and the Northern Territory punch above their weight relative to population.
            </p>
          </Prose>

          {/* Live state breakdown from our data */}
          <div className="my-8 border-4 border-bauhaus-black overflow-hidden max-w-xl">
            <div className="bg-bauhaus-black px-4 py-3">
              <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">CivicGraph Directory Coverage by State</h3>
            </div>
            <div className="p-4 space-y-2">
              {topStates.map(({ state, count }) => (
                <div key={state} className="flex items-center gap-3">
                  <span className="text-xs font-black w-8 text-right">{state}</span>
                  <div className="flex-1 h-5 bg-bauhaus-black/5 border-2 border-bauhaus-black">
                    <div
                      className="h-full bg-bauhaus-red transition-all"
                      style={{ width: `${Math.max((count / (topStates[0]?.count || 1)) * 100, 3)}%` }}
                    />
                  </div>
                  <span className="text-xs font-black tabular-nums w-12 text-right">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="border-t-4 border-bauhaus-black px-4 py-2 bg-bauhaus-canvas">
              <p className="text-[10px] text-bauhaus-muted font-bold">
                Live data from {total.toLocaleString()} directory records. Coverage weighted toward ORIC-registered Indigenous corporations.
              </p>
            </div>
          </div>

          <Prose>
            <p>
              The sector&apos;s $21.3 billion in revenue comes predominantly from trading activities
              (73%), with government contracts (14%), grants (8%), and donations (5%) making up
              the remainder. This revenue mix is the point: social enterprises are fundamentally
              different from grant-dependent charities. They trade their way to impact.
            </p>
          </Prose>

          <Callout color="blue">
            73% of social enterprise revenue comes from trading. 8% from grants.
            These are businesses, not charities with side hustles.
          </Callout>

          <ReportCTA reportSlug="social-enterprise" reportTitle="Social Enterprise in Australia" variant="inline" />

          {/* ===== SECTION 4: THE LEGAL GAP ===== */}
          <SectionHeading id="legal-gap" number="04">The Legal Gap</SectionHeading>
          <Prose>
            <p>
              Australia has no dedicated legal structure for social enterprise. This is not a
              minor technicality &mdash; it is a fundamental barrier to sector growth, investor
              confidence, and public accountability.
            </p>
            <p>
              In the UK, <strong className="text-bauhaus-black">Community Interest Companies (CICs)</strong>{' '}
              provide a legal form specifically designed for social enterprises. CICs have an
              asset lock (preventing private extraction of community assets), a community interest
              statement, and lighter regulation than charities. Over 26,000 CICs are registered.
              Canada has similar structures. The US has Benefit Corporations and L3Cs.
            </p>
            <p>
              Australian social enterprises must choose between structures that don&apos;t quite fit:
            </p>
          </Prose>

          <div className="my-8 border-4 border-bauhaus-black overflow-hidden max-w-xl">
            <div className="bg-bauhaus-black px-4 py-3">
              <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">Legal Structure Options (All Imperfect)</h3>
            </div>
            <div className="divide-y-4 divide-bauhaus-black">
              {[
                { structure: 'Company Limited by Guarantee', pro: 'Mission-locked, no shareholders', con: 'Can\'t raise equity, limited commercial flexibility' },
                { structure: 'Pty Ltd with Constitutional Clauses', pro: 'Full commercial flexibility', con: 'Mission lock depends on constitution drafting, not legally enforced' },
                { structure: 'Registered Charity (ACNC)', pro: 'Tax concessions, DGR status', con: 'Heavy compliance burden, restrictions on trading' },
                { structure: 'Indigenous Corporation (ORIC)', pro: 'Purpose-built for Aboriginal & TSI organisations', con: 'Specific governance requirements, limited to Indigenous membership' },
                { structure: 'Cooperative', pro: 'Democratic governance, profit-sharing', con: 'State-based registration, less understood by investors' },
              ].map((row) => (
                <div key={row.structure} className="p-3">
                  <div className="font-black text-sm text-bauhaus-black mb-1">{row.structure}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-xs font-medium text-money">{row.pro}</div>
                    <div className="text-xs font-medium text-bauhaus-red">{row.con}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Prose>
            <p>
              The practical consequence: a social enterprise that wants to raise investment,
              lock in its mission, trade commercially, and access tax concessions cannot do all
              four within a single legal structure. Many use hybrid models &mdash; a charity
              for DGR purposes alongside a Pty Ltd for trading &mdash; which doubles compliance
              costs and creates governance complexity.
            </p>
            <p>
              The Social Enterprise Development and Investment Funds (SEDI) program, funded
              at $100 million by the Australian Government, is the largest public investment
              in the sector&apos;s history. But SEDI intermediaries must navigate this same
              structural gap when deploying capital.
            </p>
          </Prose>

          <Callout color="red">
            The UK has 26,000 Community Interest Companies. Australia has zero equivalent.
            A $21 billion sector operates in a legal grey zone.
          </Callout>

          {/* ===== SECTION 5: INDIGENOUS ENTERPRISE ===== */}
          <SectionHeading id="indigenous-enterprise" number="05">Indigenous Enterprise</SectionHeading>
          <Prose>
            <p>
              Indigenous enterprise is not a subcategory of social enterprise. It is its own
              tradition, with its own logic, predating European settlement by tens of thousands
              of years. Trading networks, resource management systems, and economic governance
              existed across the continent long before &ldquo;social enterprise&rdquo; was coined
              in a European boardroom.
            </p>
            <p>
              The <strong className="text-bauhaus-black">Office of the Registrar of Indigenous
              Corporations (ORIC)</strong> registers over 3,300 corporations under the CATSI Act.
              These range from small community stores to major land management organisations
              controlling millions of hectares. CivicGraph tracks{' '}
              <strong className="text-bauhaus-black">{indigenous.toLocaleString()} Indigenous
              corporations</strong> in its directory &mdash; making this the largest open dataset
              of Indigenous enterprise profiles in Australia.
            </p>
            <p>
              <strong className="text-bauhaus-black">Supply Nation</strong> certifies over 6,000
              Indigenous businesses for government and corporate procurement. The federal
              Indigenous Procurement Policy (IPP) has directed{' '}
              <strong className="text-bauhaus-black">$9.5 billion in contracts</strong> to
              Indigenous businesses since 2015. This single policy has moved more money to First
              Nations communities than all philanthropic giving combined.
            </p>
            <p>
              State-based directories &mdash; <strong className="text-bauhaus-black">Kinaway</strong>{' '}
              in Victoria, <strong className="text-bauhaus-black">Black Business Finder</strong> in
              Queensland, <strong className="text-bauhaus-black">Yarnteen</strong> and regional
              networks &mdash; each maintain partial lists. None are complete. None are interoperable.
              A procurement officer in Brisbane looking for Indigenous catering services has no
              single source of truth.
            </p>
          </Prose>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 my-8">
            <Stat value={indigenous.toLocaleString()} label="Indigenous Corps Tracked" color="text-bauhaus-red" />
            <Stat value="$9.5B" label="IPP Contracts Since 2015" color="text-money" />
            <Stat value="6,000+" label="Supply Nation Certified" color="text-bauhaus-blue" />
          </div>

          <Callout>
            The Indigenous Procurement Policy has directed $9.5 billion to First Nations
            businesses. Philanthropy gives 0.5% of its funding to First Nations causes.
            Procurement works. Charity doesn&apos;t.
          </Callout>

          {/* ===== SECTION 6: SOCIAL PROCUREMENT ===== */}
          <SectionHeading id="social-procurement" number="06">Social Procurement</SectionHeading>
          <Prose>
            <p>
              Social procurement is the mechanism that converts government spending power into
              social outcomes. Every level of government buys goods and services &mdash; cleaning,
              catering, construction, consulting, IT. Social procurement policies direct some
              of that spending to businesses that deliver social value alongside commercial value.
            </p>
            <p>
              Victoria leads nationally with the <strong className="text-bauhaus-black">Social
              Procurement Framework</strong>, requiring social and environmental outcomes in all
              government procurement over $20 million. The framework creates genuine market
              access for social enterprises, disability employers, and Aboriginal businesses.
            </p>
            <p>
              NSW maintains a <strong className="text-bauhaus-black">social enterprise procurement
              list</strong> through buy.nsw, and Queensland&apos;s Buy Queensland policy includes
              social benefit criteria. But implementation varies dramatically between departments,
              agencies, and individual procurement officers.
            </p>
            <p>
              The opportunity is enormous. Federal, state, and local government procurement in
              Australia exceeds <strong className="text-bauhaus-black">$600 billion annually</strong>.
              If 5% were directed through social procurement channels, that would be $30 billion
              &mdash; ten times the annual revenue of the entire social enterprise sector.
            </p>
          </Prose>

          <Callout color="blue">
            Australian government procurement exceeds $600 billion per year.
            Redirecting 5% to social enterprises would triple the sector overnight.
          </Callout>

          <Prose>
            <p>
              The practical barrier is discovery. A procurement officer who wants to buy from
              a social enterprise has no single directory to search. They would need to check
              Social Traders, BuyAbility, Supply Nation, state network directories, and the
              ORIC register &mdash; separately, with different search interfaces, different
              data structures, and different definitions of what qualifies.
            </p>
            <p>
              This is the gap CivicGraph fills. One search. Every directory. Every state.
            </p>
          </Prose>

          {/* ===== SECTION 7: THE DATA PROBLEM ===== */}
          <SectionHeading id="data-problem" number="07">The Data Problem</SectionHeading>
          <Prose>
            <p>
              Australia&apos;s social enterprise data infrastructure is approximately 15 years
              behind the charity sector and 25 years behind the for-profit sector. ASIC
              registers every company. The ACNC registers every charity. Nobody registers
              social enterprises.
            </p>
            <p>
              The data that does exist is scattered across at least 15 directories:
            </p>
          </Prose>

          <div className="my-8 border-4 border-bauhaus-black overflow-hidden max-w-xl">
            <div className="bg-bauhaus-black px-4 py-3">
              <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">Directory Fragmentation</h3>
            </div>
            <div className="divide-y-4 divide-bauhaus-black">
              {[
                { source: 'ORIC Register', scope: '3,300+ Indigenous corporations', access: 'Open data (data.gov.au)' },
                { source: 'Social Traders', scope: '635 certified social enterprises', access: 'Public directory' },
                { source: 'B Corp Directory', scope: '~700 Australian B Corps', access: 'Public directory' },
                { source: 'BuyAbility', scope: '~600 disability enterprises', access: 'Public directory' },
                { source: 'Supply Nation', scope: '6,000+ Indigenous businesses', access: 'Partially paywalled' },
                { source: 'State Networks (6)', scope: '~730 members total', access: 'Fragmented member pages' },
                { source: 'Gov Procurement Lists', scope: '~200 approved suppliers', access: 'Scattered across portals' },
              ].map((row) => (
                <div key={row.source} className="grid grid-cols-3 text-xs">
                  <div className="p-3 font-black text-bauhaus-black">{row.source}</div>
                  <div className="p-3 font-medium text-bauhaus-muted">{row.scope}</div>
                  <div className="p-3 font-medium text-bauhaus-muted">{row.access}</div>
                </div>
              ))}
            </div>
          </div>

          <Prose>
            <p>
              Each directory uses different naming conventions, different categorisation systems,
              and different geographic coding. An enterprise listed as &ldquo;Catering &amp;
              Hospitality&rdquo; in one directory appears as &ldquo;Food Services&rdquo; in
              another and &ldquo;Employment Services &mdash; Hospitality&rdquo; in a third.
              Cross-referencing is manual. Deduplication is guesswork.
            </p>
            <p>
              The consequence is that nobody &mdash; not policymakers, not procurement officers,
              not researchers, not the sector itself &mdash; has an accurate picture of
              Australia&apos;s social enterprise landscape. Every statistic is an estimate.
              Every mapping exercise starts from scratch.
            </p>
            <p>
              <strong className="text-bauhaus-black">CivicGraph is building the register that
              doesn&apos;t exist.</strong> We aggregate every publicly available directory,
              deduplicate across sources, enrich with AI-generated profiles, and present the
              result as a single searchable, filterable directory. Open. Free. Updated continuously.
            </p>
          </Prose>

          <Callout color="red">
            15 directories. 6 state networks. 3 certification bodies. Zero interoperability.
            Every search starts from scratch. This is the infrastructure gap CivicGraph fills.
          </Callout>

          {/* ===== SECTION 8: WHY CIVICGRAPH ===== */}
          <SectionHeading id="grantscope-role" number="08">Why CivicGraph</SectionHeading>
          <Prose>
            <p>
              CivicGraph exists to make the invisible visible. We started with grants &mdash;
              aggregating {'>'}14,000 grant opportunities across every state and federal program.
              We added foundations &mdash; profiling {'>'}9,800 Australian foundations with AI
              enrichment. We mapped {'>'}64,000 charities from the ACNC register.
            </p>
            <p>
              Social enterprises are the natural next layer. The same communities that search
              CivicGraph for grant funding also need to find social enterprise partners for
              procurement, discover Indigenous businesses for supply chain diversification, and
              identify disability enterprises for government compliance.
            </p>
            <p>
              <strong className="text-bauhaus-black">Our directory currently tracks{' '}
              {total.toLocaleString()} social enterprises</strong> across all states and territories,
              aggregated from ORIC, Social Traders, BuyAbility, B Corp, Kinaway, and government
              procurement lists. {enriched.toLocaleString()} have been enriched with AI-generated
              profiles describing their activities, sectors, and impact areas.
            </p>
            <p>
              This is just the beginning. Australia&apos;s 360Giving equivalent doesn&apos;t
              exist yet. CivicGraph is building it &mdash; open data infrastructure for the
              entire social economy, not just grants.
            </p>
          </Prose>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-8">
            <Stat value={total.toLocaleString()} label="Enterprises Tracked" color="text-bauhaus-red" />
            <Stat value={enriched.toLocaleString()} label="AI-Enriched" color="text-bauhaus-blue" />
            <Stat value="6+" label="Data Sources" color="text-money" />
            <Stat value="8" label="States & Territories" color="text-bauhaus-blue" />
          </div>

          {/* ===== SECTION 9: HOW TO USE THIS PLATFORM ===== */}
          <SectionHeading id="how-to-use" number="09">How to Use This Platform</SectionHeading>
          <Prose>
            <p>
              CivicGraph&apos;s social enterprise directory is designed for five audiences,
              each with different needs:
            </p>
          </Prose>

          <div className="my-8 space-y-3 max-w-xl">
            {[
              {
                who: 'Procurement Officers',
                what: 'Search by state, sector, and certification to find approved social enterprise suppliers. Filter by org type to match your procurement framework requirements.',
                link: '/social-enterprises?org_type=disability_enterprise',
                linkText: 'Disability enterprises',
              },
              {
                who: 'Social Enterprises',
                what: 'Find peers in your sector and state. Discover certification pathways (Social Traders, B Corp, BuyAbility). Identify grant opportunities matched to your profile.',
                link: '/social-enterprises',
                linkText: 'Browse the directory',
              },
              {
                who: 'Policymakers & Researchers',
                what: 'Access the most comprehensive open dataset of Australian social enterprises. Analyse sector composition by state, type, and industry. Download data for policy research.',
                link: '/reports/social-enterprise',
                linkText: 'This report',
              },
              {
                who: 'Funders & Investors',
                what: 'Identify investment-ready social enterprises. Cross-reference with our foundation directory to find co-funders. Understand the sector landscape before deploying capital.',
                link: '/foundations',
                linkText: 'Foundation directory',
              },
              {
                who: 'Community Organisations',
                what: 'Find social enterprise partners for joint ventures or procurement. Connect with Indigenous businesses for supply chain inclusion. Explore the transition from grant dependency to earned revenue.',
                link: '/reports/community-power',
                linkText: 'Community Power Playbook',
              },
            ].map((item) => (
              <div key={item.who} className="bg-white border-4 border-bauhaus-black p-4 bauhaus-shadow-sm">
                <h3 className="font-black text-bauhaus-black text-sm mb-1">{item.who}</h3>
                <p className="text-sm text-bauhaus-muted font-medium mb-2">{item.what}</p>
                <a href={item.link} className="text-xs font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-wider">
                  {item.linkText} &rarr;
                </a>
              </div>
            ))}
          </div>

          {/* ===== SECTION 10: WHAT COMES NEXT ===== */}
          <SectionHeading id="what-next" number="10">What Comes Next</SectionHeading>
          <Prose>
            <p>
              This directory is a living dataset. As social enterprises register, change, grow,
              or close, the data updates. New sources are added as they become available.
              Enrichment improves as AI profiling matures.
            </p>
            <p>
              What the sector needs &mdash; and what CivicGraph is building toward &mdash; is
              the basic infrastructure that charities and companies already have:
            </p>
          </Prose>

          <div className="my-8 border-4 border-bauhaus-black overflow-hidden max-w-xl">
            <div className="bg-bauhaus-black px-4 py-3">
              <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">What Exists vs What&apos;s Needed</h3>
            </div>
            <div className="divide-y-4 divide-bauhaus-black">
              {[
                { exists: 'ASIC registers every company', gap: 'No register for social enterprises' },
                { exists: 'ACNC registers every charity', gap: 'No equivalent for mission-locked businesses' },
                { exists: 'ABR tracks every ABN', gap: 'No way to flag an ABN as a social enterprise' },
                { exists: 'Multiple certification bodies', gap: 'No unified certification framework' },
                { exists: 'State procurement frameworks', gap: 'No national social procurement standard' },
                { exists: 'SEDI funding ($100M)', gap: 'No legal structure to receive impact investment' },
              ].map((row, i) => (
                <div key={i} className="grid grid-cols-2">
                  <div className="p-3 bg-money-light border-r-4 border-bauhaus-black">
                    <span className="text-xs font-bold text-bauhaus-black">{row.exists}</span>
                  </div>
                  <div className="p-3 bg-bauhaus-red/5">
                    <span className="text-xs font-bold text-bauhaus-black">{row.gap}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Prose>
            <p>
              CivicGraph cannot solve the legal structure gap or create a national register.
              Those are policy decisions. But we can build the data infrastructure that makes
              the sector visible &mdash; and visibility is the precondition for everything else.
            </p>
            <p>
              If you can&apos;t count them, you can&apos;t fund them. If you can&apos;t find them,
              you can&apos;t buy from them. If you can&apos;t see them, you can&apos;t support them.
            </p>
            <p>
              <strong className="text-bauhaus-black">We&apos;re making them visible.</strong>
            </p>
          </Prose>

          <Callout color="blue">
            If you can&apos;t count them, you can&apos;t fund them. If you can&apos;t find them,
            you can&apos;t buy from them. CivicGraph is building the register that doesn&apos;t exist.
          </Callout>

          <div className="my-12 flex gap-4 flex-wrap">
            <a href="/social-enterprises" className="inline-flex items-center gap-2 px-6 py-3 font-black text-sm bg-bauhaus-red text-white uppercase tracking-widest hover:bg-bauhaus-black border-4 border-bauhaus-black bauhaus-shadow-sm">
              Browse Directory &rarr;
            </a>
            <a href="/reports/community-power" className="inline-flex items-center gap-2 px-6 py-3 font-black text-sm bg-white text-bauhaus-black uppercase tracking-widest hover:bg-bauhaus-canvas border-4 border-bauhaus-black bauhaus-shadow-sm">
              Community Power Playbook &rarr;
            </a>
            <a href="/reports/community-parity" className="inline-flex items-center gap-2 px-6 py-3 font-black text-sm bg-white text-bauhaus-black uppercase tracking-widest hover:bg-bauhaus-canvas border-4 border-bauhaus-black bauhaus-shadow-sm">
              Community Parity Report &rarr;
            </a>
          </div>

          {/* Methodology */}
          <section className="border-t-4 border-bauhaus-black pt-8 mt-16">
            <h2 className="text-sm font-black text-bauhaus-black mb-4 uppercase tracking-widest">Sources &amp; Methodology</h2>
            <div className="text-sm text-bauhaus-muted font-medium space-y-3 max-w-[680px] leading-relaxed">
              <p>
                <strong className="text-bauhaus-black">Sector estimates:</strong> Finding Australia&apos;s
                Social Enterprise Sector (FASES) 2016 and 2023 update. Social Traders Census of
                Australian Social Enterprises. RISE (Resilience, Innovation, Social Enterprise) program research.
              </p>
              <p>
                <strong className="text-bauhaus-black">Directory data:</strong> Office of the Registrar
                of Indigenous Corporations (ORIC) public register via data.gov.au. Social Traders certified
                enterprise directory. B Corp Australia directory (bcorporation.net). BuyAbility disability
                enterprise directory. Kinaway Victorian Aboriginal Chamber of Commerce.
              </p>
              <p>
                <strong className="text-bauhaus-black">Procurement data:</strong> National Indigenous
                Australians Agency (NIAA) Indigenous Procurement Policy reports. Victorian Government
                Social Procurement Framework. NSW buy.nsw social enterprise list.
              </p>
              <p>
                <strong className="text-bauhaus-black">Legal comparison:</strong> UK Community Interest
                Company (CIC) Regulator annual reports. Canadian social enterprise legislation review.
                Australian Government SEDI program guidelines.
              </p>
              <p>
                <strong className="text-bauhaus-black">Enrichment:</strong> AI-generated profiles using
                multi-provider LLM rotation (Groq, Gemini, Anthropic). Profiles are generated from
                organisation names, ORIC registration data, and website content where available.
                Confidence levels (low/medium/high) indicate data quality.
              </p>
              <p>
                <strong className="text-bauhaus-black">Limitations:</strong> No official register exists,
                so all sector-wide numbers are estimates. Directory coverage is weighted toward ORIC-registered
                Indigenous corporations ({indigenous.toLocaleString()} of {total.toLocaleString()} records).
                Social Traders and B Corp directories are partially captured due to SPA rendering limitations.
                Supply Nation data is partially paywalled. Some enterprises appear in multiple directories
                and may not be fully deduplicated.
              </p>
            </div>
          </section>
        </article>
      </div>

      <ReportCTA reportSlug="social-enterprise" reportTitle="Social Enterprise in Australia" />
    </div>
  );
}
