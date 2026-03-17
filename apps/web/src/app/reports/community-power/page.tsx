import { TableOfContents } from './toc';
import { ReportCTA } from '../_components/report-cta';

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

export default function CommunityPowerPage() {
  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
      </div>

      <header className="mb-12 border-b-4 border-bauhaus-black pb-12">
        <p className="text-xs font-black text-bauhaus-blue uppercase tracking-[0.3em] mb-3">The Alternative</p>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-bauhaus-black leading-[0.95] mb-6">
          Community Power<br /><span className="text-bauhaus-blue">Playbook</span>
        </h1>
        <p className="text-lg text-bauhaus-muted font-medium max-w-2xl leading-relaxed mb-6">
          What happens when communities stop waiting for grants and build their own
          economic power? Cooperatives, revolving funds, social enterprise, timebanking,
          and the models that are already working across Australia.
        </p>
        <div className="flex flex-wrap gap-4 text-xs font-black text-bauhaus-muted uppercase tracking-widest">
          <span>Sources: BCCM, FASES, CORENA, Community Power Agency</span>
          <span>|</span>
          <span>2024 Data</span>
        </div>
      </header>

      {/* Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-12">
        <TableOfContents />

        <article className="min-w-0">

          {/* Key numbers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
            <Stat value="1,819" label="Cooperatives" color="text-bauhaus-blue" />
            <Stat value="$21.3B" label="Social Enterprise Revenue" color="text-money" />
            <Stat value="300K" label="Social Enterprise Jobs" color="text-bauhaus-blue" />
            <Stat value="$9.5B" label="Indigenous Procurement" color="text-money" />
          </div>

          {/* ===== SECTION 1: CASE FOR EXIT ===== */}
          <SectionHeading id="case-for-exit" number="01">The Case for Exit</SectionHeading>
          <Prose>
            <p>
              The grant dependency trap is well understood by every community organisation that
              has lived through it. You spend 6 months writing an application. You wait 3 months.
              You get funded for 12 months. You spend 3 months reporting. You have 6 months of
              actual program delivery. Then you start writing the next application.
            </p>
            <p>
              The <a href="/reports/community-parity" className="text-bauhaus-blue hover:text-bauhaus-red font-bold">Community Parity report</a>{' '}
              shows where the money goes: 94% to the top 10%, 0.5% to First Nations, 6% to
              grassroots. But the deeper problem isn&apos;t just allocation &mdash; it&apos;s the model
              itself. Grants create dependency. They impose external priorities. They fragment
              community energy into reporting cycles.
            </p>
            <p>
              <strong className="text-bauhaus-black">Self-determination requires economic sovereignty.</strong>{' '}
              Not just the right to choose your priorities, but the resources to pursue them
              without permission. This playbook maps the models that are already building that
              sovereignty across Australia.
            </p>
          </Prose>

          <Callout>
            The average community organisation spends 40% of its time on grant applications and
            compliance. That&apos;s time that could be spent on the actual work.
          </Callout>

          {/* ===== SECTION 2: COOPERATIVES ===== */}
          <SectionHeading id="cooperatives" number="02">Cooperatives &amp; Mutuals</SectionHeading>
          <Prose>
            <p>
              Australia has <strong className="text-bauhaus-black">1,819 cooperatives and mutuals</strong>{' '}
              employing over 76,000 people. They operate in every sector: agriculture (Norco, CBH Group),
              finance (credit unions and mutual banks), retail (co-op bookshops), housing, energy,
              and social services. The cooperative model &mdash; one member, one vote, profits
              shared &mdash; is the oldest alternative to extractive capitalism.
            </p>
            <p>
              <strong className="text-bauhaus-black">Earthworker Cooperative</strong> in the Latrobe
              Valley manufactures solar hot water systems, creating manufacturing jobs in a region
              devastated by coal plant closures. Workers own the business. Profits stay in the community.
              No grant applications required.
            </p>
            <p>
              <strong className="text-bauhaus-black">Norco</strong> is a dairy cooperative owned by
              over 300 farmer members across Northern NSW and Southeast QLD. Revenue over $750 million.
              Farmer-controlled. Profits returned to members. Operating since 1895.
            </p>
            <p>
              <strong className="text-bauhaus-black">Nundah Community Enterprises Cooperative</strong>{' '}
              in Brisbane employs people with disabilities in real businesses &mdash; a cafe, catering,
              and garden services. Not a &ldquo;sheltered workshop&rdquo; but a genuine cooperative
              where workers have ownership and voice.
            </p>
            <p>
              The Business Council of Co-operatives and Mutuals (BCCM) reports that cooperatives
              have higher survival rates than conventional businesses and generate stronger
              community outcomes per dollar of revenue. They are structurally resistant to the
              concentration problem documented in our <a href="/reports/big-philanthropy" className="text-bauhaus-blue hover:text-bauhaus-red font-bold">$222 Billion report</a>.
            </p>
          </Prose>

          <Callout color="blue">
            Cooperatives have higher 5-year survival rates than conventional businesses.
            1,819 co-ops employ 76,000+ Australians. The model works.
          </Callout>

          {/* ===== SECTION 3: SOCIAL ENTERPRISE ===== */}
          <SectionHeading id="social-enterprise" number="03">Social Enterprise</SectionHeading>
          <Prose>
            <p>
              The Finding Australia&apos;s Social Enterprise Sector (FASES) study identified
              approximately <strong className="text-bauhaus-black">20,000 social enterprises generating
              $21.27 billion in annual revenue and employing over 300,000 people</strong>. These are
              businesses with a social or environmental mission embedded in their structure &mdash;
              not charities that happen to sell things.
            </p>
            <p>
              Social enterprises span every industry: hospitality (cafes employing refugees),
              manufacturing (recycling cooperatives), services (cleaning companies employing
              people exiting homelessness), technology (digital agencies training Indigenous youth),
              and agriculture (regenerative farming enterprises).
            </p>
            <p>
              The critical difference: social enterprises generate their own revenue. They don&apos;t
              depend on grant cycles. They build assets. They create jobs that last beyond a
              funding period. When a social enterprise succeeds, the community owns the outcome.
            </p>
            <p>
              Australia lags behind the UK (which has Community Interest Companies and social
              investment tax relief) and Canada (which has social enterprise-specific legal
              structures). There is no Australian legal form for social enterprise. Mission-locked
              companies must use workarounds like constitutional clauses or dual-structure models.
            </p>
          </Prose>

          <div className="grid grid-cols-3 gap-4 my-8">
            <Stat value="20K" label="Social Enterprises" color="text-bauhaus-blue" />
            <Stat value="$21.3B" label="Annual Revenue" color="text-money" />
            <Stat value="300K" label="Jobs Created" color="text-bauhaus-blue" />
          </div>

          {/* ===== SECTION 4: COMMUNITY ENERGY ===== */}
          <SectionHeading id="community-energy" number="04">Community Energy</SectionHeading>
          <Prose>
            <p>
              Community energy is one of the most tangible examples of economic sovereignty.
              When a community owns its energy generation, the revenue stays local, the governance
              is democratic, and the transition away from fossil fuels becomes community-led
              rather than imposed.
            </p>
            <p>
              <strong className="text-bauhaus-black">CORENA</strong> (Citizens Own Renewable Energy Network
              Australia) operates a revolving fund model. They crowdfund capital from individuals,
              lend it to community organisations for solar installations, and the repayments
              (from energy savings) refill the fund for the next project. No grants. No banks.
              Community money recycling through community infrastructure.
            </p>
            <p>
              <strong className="text-bauhaus-black">Hepburn Wind</strong> in regional Victoria was
              Australia&apos;s first community-owned wind farm. 2,000 members invested to build two
              turbines generating 4.1MW. Revenue flows to a community fund. The project has
              generated over $2 million for the local community.
            </p>
            <p>
              <strong className="text-bauhaus-black">Enova Energy</strong> in Byron Bay is a
              community-owned energy retailer. 3,500 customers, 1,400 shareholders, all local.
              Profits fund community energy projects and energy hardship programs.
            </p>
            <p>
              The Community Power Agency reports that over 100 community energy groups are active
              across Australia, but regulatory barriers (grid connection costs, retailer licensing
              requirements) prevent many from scaling. Victoria and the ACT have the most
              supportive policy frameworks.
            </p>
          </Prose>

          <Callout>
            CORENA&apos;s revolving fund model: community money funds solar installations, energy
            savings repay the fund, the money cycles to the next project. No grants. No banks.
            Infinite reuse.
          </Callout>

          {/* ===== SECTION 5: TIMEBANKING ===== */}
          <SectionHeading id="timebanking" number="05">Timebanking &amp; Mutual Aid</SectionHeading>
          <Prose>
            <p>
              Timebanking is the simplest form of community economic power: one hour of your
              time equals one hour of anyone else&apos;s time, regardless of what the market values
              that work at. A lawyer&apos;s hour equals a gardener&apos;s hour. A teacher&apos;s
              hour equals a carpenter&apos;s hour.
            </p>
            <p>
              Australia has approximately <strong className="text-bauhaus-black">70 active timebanking
              communities</strong> with over 24,500 hours exchanged. The largest networks operate
              in Sydney, Melbourne, and Brisbane, but regional communities often show the highest
              per-capita engagement.
            </p>
            <p>
              Timebanks serve multiple functions beyond the exchange itself: they build social
              connection, they make invisible labour (caring, community work) visible, they
              provide economic participation for people excluded from the formal economy, and
              they demonstrate that value can be measured in something other than dollars.
            </p>
            <p>
              Mutual aid networks exploded during COVID-19 and have largely persisted. These
              informal networks of neighbours helping neighbours &mdash; sharing food, providing
              transport, offering childcare &mdash; operate entirely outside the formal economy
              and the grant-funding model. They are the oldest form of community power.
            </p>
          </Prose>

          <div className="grid grid-cols-2 gap-4 my-8 max-w-lg">
            <Stat value="70" label="Timebanking Communities" color="text-bauhaus-blue" />
            <Stat value="24,500" label="Hours Exchanged" color="text-money" />
          </div>

          {/* ===== SECTION 6: CWB ===== */}
          <SectionHeading id="cwb" number="06">Community Wealth Building</SectionHeading>
          <Prose>
            <p>
              Community Wealth Building (CWB) is a systems approach to building locally-rooted
              economic power. Originating from the &ldquo;Preston Model&rdquo; in Lancashire, UK,
              CWB uses five pillars to redirect wealth back into communities:
            </p>
          </Prose>

          <div className="my-8 space-y-3 max-w-xl">
            {[
              { number: '1', title: 'Anchor Institutions', desc: 'Redirect procurement from large anchor institutions (hospitals, universities, councils) to local businesses and social enterprises.' },
              { number: '2', title: 'Progressive Procurement', desc: 'Set social value criteria in procurement — local employment, environmental standards, living wages.' },
              { number: '3', title: 'Fair Employment', desc: 'Anchor institutions become model employers with living wages, secure work, and local hiring targets.' },
              { number: '4', title: 'Community Land & Assets', desc: 'Public land and buildings held in community ownership through land trusts and cooperatives.' },
              { number: '5', title: 'Democratic Finance', desc: 'Credit unions, community development finance institutions (CDFIs), and cooperative banks.' },
            ].map(p => (
              <div key={p.number} className="bg-white border-4 border-bauhaus-black p-4 bauhaus-shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="text-bauhaus-red font-black text-lg">{p.number}</span>
                  <div>
                    <h3 className="font-black text-bauhaus-black text-sm">{p.title}</h3>
                    <p className="text-sm text-bauhaus-muted font-medium mt-1">{p.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Prose>
            <p>
              In Preston, this approach increased local procurement by anchor institutions from 5% to
              18% in four years, redirecting over &pound;70 million into the local economy.
              Australian councils including Darebin (VIC) and the City of Sydney are beginning to
              adopt CWB principles.
            </p>
            <p>
              The relevance for community organisations is direct: rather than competing for
              grants, CWB redirects existing institutional spending toward local and social outcomes.
              The money is already flowing &mdash; CWB changes where it lands.
            </p>
          </Prose>

          <Callout color="blue">
            Preston redirected &pound;70M into the local economy by changing where anchor
            institutions spend. The money was always there &mdash; it just wasn&apos;t landing locally.
          </Callout>

          {/* ===== SECTION 7: SOCIAL PROCUREMENT ===== */}
          <SectionHeading id="social-procurement" number="07">Social Procurement</SectionHeading>
          <Prose>
            <p>
              The federal government&apos;s Indigenous Procurement Policy (IPP) has driven
              <strong className="text-bauhaus-black"> $9.5 billion in contracts to Indigenous businesses</strong>{' '}
              since 2015. It&apos;s the single most effective mechanism for directing economic
              resources to First Nations communities in Australian history &mdash; vastly
              outperforming philanthropic giving.
            </p>
            <p>
              Victoria&apos;s Social Procurement Framework requires all government procurement
              over $20 million to include social and environmental outcomes. Social enterprises,
              Aboriginal businesses, and disability employers gain guaranteed market access.
            </p>
            <p>
              The NSW Social Enterprise Procurement Guidelines and Queensland&apos;s Buy Queensland
              policy operate on similar principles. Social procurement works because it uses the
              government&apos;s existing spending power &mdash; no new money required, just better
              targeting of existing flows.
            </p>
            <p>
              For community organisations, social procurement offers a revenue stream that is:
              predictable (multi-year contracts), significant (government is Australia&apos;s largest
              buyer), and mission-aligned (social outcomes are built into the contract). It&apos;s
              the opposite of the grant trap.
            </p>
          </Prose>

          <Callout>
            The Indigenous Procurement Policy has delivered $9.5 billion to First Nations
            businesses. Philanthropy has given 0.5% of its funding. Procurement works.
            Charity doesn&apos;t.
          </Callout>

          {/* ===== SECTION 8: SHIFTING POWER ===== */}
          <SectionHeading id="shifting-power" number="08">Shifting Power Within Philanthropy</SectionHeading>
          <Prose>
            <p>
              Not all paths lead away from philanthropy. Some models work to shift power
              within the system itself. <strong className="text-bauhaus-black">Participatory
              grantmaking</strong> puts funding decisions in the hands of the communities affected,
              not program officers in Melbourne and Sydney.
            </p>
            <p>
              <strong className="text-bauhaus-black">Community Development Finance Institutions
              (CDFIs)</strong> provide capital to communities that mainstream banks won&apos;t serve.
              Many Ghali and Foresters are emerging in Australia, following models proven in the
              UK and US where CDFIs manage billions in community-directed capital.
            </p>
            <p>
              <strong className="text-bauhaus-black">Trust-based philanthropy</strong> reduces
              reporting burdens, provides multi-year unrestricted funding, and trusts organisations
              to know what their communities need. Several Australian foundations (including the
              <a href="/foundations/b9e090e5-1672-48ff-815a-2a6314ebe033" className="text-bauhaus-blue hover:text-bauhaus-red font-bold"> Ian Potter Foundation</a>)
              have moved toward more trust-based approaches.
            </p>
            <p>
              These reforms are necessary and valuable. But they still operate within a system
              where the power to give &mdash; and to stop giving &mdash; rests with the funder.
              The models above (cooperatives, social enterprise, community energy, procurement)
              build community power that doesn&apos;t depend on anyone&apos;s generosity.
            </p>
          </Prose>

          {/* ===== SECTION 9: FRAMEWORK ===== */}
          <SectionHeading id="framework" number="09">The Framework: From Dependent to Self-Sustaining</SectionHeading>
          <Prose>
            <p>
              Community economic power isn&apos;t binary. Organisations move along a spectrum from
              full grant dependency to full self-determination. The journey looks different for
              every community, but the stages are recognisable:
            </p>
          </Prose>

          <div className="my-8 max-w-xl">
            <div className="space-y-0">
              {[
                { stage: 'Dependent', color: 'bg-bauhaus-red', desc: '80%+ grant-funded. External priorities drive programs. High admin burden. Vulnerable to funding cuts.' },
                { stage: 'Transitioning', color: 'bg-bauhaus-yellow', desc: '50-80% grant-funded. Some earned revenue. Beginning to diversify. Building assets.' },
                { stage: 'Partner-Based', color: 'bg-bauhaus-blue', desc: '20-50% grant-funded. Significant earned revenue. Community-controlled assets. Grants used strategically.' },
                { stage: 'Self-Sustaining', color: 'bg-money', desc: 'Minimal or no grant dependency. Revenue from owned enterprises, assets, and procurement contracts. Community sets the agenda.' },
              ].map((s, i) => (
                <div key={s.stage} className="flex border-4 border-bauhaus-black border-b-0 last:border-b-4">
                  <div className={`${s.color} w-2 flex-shrink-0`} />
                  <div className="p-4 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-black text-bauhaus-muted uppercase tracking-widest">Stage {i + 1}</span>
                      <span className="font-black text-bauhaus-black text-sm">{s.stage}</span>
                    </div>
                    <p className="text-sm text-bauhaus-muted font-medium">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Callout color="blue">
            The goal is not to eliminate grants &mdash; it&apos;s to make them optional.
            When you can say no to a grant because you don&apos;t need it,
            you&apos;ve achieved economic sovereignty.
          </Callout>

          {/* What Exists vs What's Missing table */}
          <div className="my-8 border-4 border-bauhaus-black overflow-hidden max-w-xl">
            <div className="bg-bauhaus-black px-4 py-3">
              <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">What Exists vs What&apos;s Missing</h3>
            </div>
            <div className="divide-y-4 divide-bauhaus-black">
              {[
                { exists: 'Cooperatives Act in every state', missing: 'National cooperative development agency' },
                { exists: '20,000 social enterprises', missing: 'Legal structure for social enterprise' },
                { exists: 'Community energy groups', missing: 'Regulatory framework for community energy' },
                { exists: 'Indigenous Procurement Policy', missing: 'Social procurement targets for all govt' },
                { exists: 'CDFIs emerging', missing: 'Tax incentives for community investment' },
                { exists: 'Timebanking networks', missing: 'Recognition in welfare/tax systems' },
                { exists: 'Participatory grantmaking pilots', missing: 'Mandatory community voice in funding' },
              ].map((row, i) => (
                <div key={i} className="grid grid-cols-2">
                  <div className="p-3 bg-money-light border-r-4 border-bauhaus-black">
                    <span className="text-xs font-bold text-bauhaus-black">{row.exists}</span>
                  </div>
                  <div className="p-3 bg-bauhaus-red/5">
                    <span className="text-xs font-bold text-bauhaus-black">{row.missing}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ===== SECTION 10: STARTING POINTS ===== */}
          <SectionHeading id="starting-points" number="10">Practical Starting Points</SectionHeading>
          <Prose>
            <p>
              Economic sovereignty doesn&apos;t start with a revolution. It starts with the next
              decision. Here are 11 concrete actions for community organisations, policymakers,
              and individuals:
            </p>
          </Prose>

          <div className="my-8 space-y-2 max-w-xl">
            {[
              { who: 'Community Orgs', action: 'Audit your revenue mix. What percentage comes from grants? Set a 3-year target for earned revenue.' },
              { who: 'Community Orgs', action: 'Explore cooperative structures for any fee-for-service activity. The BCCM provides free guidance.' },
              { who: 'Community Orgs', action: 'Register as a supplier on government procurement panels (AusTender, state equivalents).' },
              { who: 'Community Orgs', action: 'Start a timebank. It costs nothing and builds social infrastructure immediately.' },
              { who: 'Policymakers', action: 'Increase mandatory payout rates for PAFs from 5% to 7%. Canada is debating 10%.' },
              { who: 'Policymakers', action: 'Create an Australian social enterprise legal structure (like UK CICs).' },
              { who: 'Policymakers', action: 'Extend social procurement targets to all government spending above $1M.' },
              { who: 'Policymakers', action: 'Fund community energy through low-interest loans, not grants.' },
              { who: 'Individuals', action: 'Move your banking to a mutual bank or credit union.' },
              { who: 'Individuals', action: 'Buy from social enterprises and cooperatives where possible.' },
              { who: 'Individuals', action: 'If you give, give to grassroots organisations directly. Use CivicGraph to find them.' },
            ].map((item, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="text-xs font-black text-bauhaus-red mt-1 w-5 text-right flex-shrink-0">{i + 1}.</span>
                <div>
                  <span className="text-xs font-black text-bauhaus-muted uppercase tracking-widest">{item.who}:</span>
                  <p className="text-sm text-bauhaus-black/80 font-medium">{item.action}</p>
                </div>
              </div>
            ))}
          </div>

          {/* PLACE critique callout */}
          <Callout color="red">
            <strong>A note on &ldquo;place-based&rdquo; approaches:</strong> Place-based funding
            is popular with governments and foundations because it sounds community-led. But when
            &ldquo;place-based&rdquo; means external funders choosing a postcode and imposing a
            coordination structure, it can replicate the very power dynamics it claims to address.
            Genuine place-based work requires community governance, not just community consultation.
          </Callout>

          <div className="my-12 flex gap-4 flex-wrap">
            <a href="/reports/community-parity" className="inline-flex items-center gap-2 px-6 py-3 font-black text-sm bg-bauhaus-black text-white uppercase tracking-widest hover:bg-bauhaus-red border-4 border-bauhaus-black bauhaus-shadow-sm">
              Community Parity Report &rarr;
            </a>
            <a href="/charities" className="inline-flex items-center gap-2 px-6 py-3 font-black text-sm bg-white text-bauhaus-black uppercase tracking-widest hover:bg-bauhaus-canvas border-4 border-bauhaus-black bauhaus-shadow-sm">
              Community Organisations &rarr;
            </a>
            <a href="/reports/big-philanthropy" className="inline-flex items-center gap-2 px-6 py-3 font-black text-sm bg-white text-bauhaus-black uppercase tracking-widest hover:bg-bauhaus-canvas border-4 border-bauhaus-black bauhaus-shadow-sm">
              $222 Billion Report &rarr;
            </a>
          </div>

          {/* Methodology */}
          <section className="border-t-4 border-bauhaus-black pt-8 mt-16">
            <h2 className="text-sm font-black text-bauhaus-black mb-4 uppercase tracking-widest">Sources &amp; Methodology</h2>
            <div className="text-sm text-bauhaus-muted font-medium space-y-3 max-w-[680px] leading-relaxed">
              <p>
                <strong className="text-bauhaus-black">Cooperatives data:</strong> Business Council of
                Co-operatives and Mutuals (BCCM) National Mutual Economy Report 2023.
              </p>
              <p>
                <strong className="text-bauhaus-black">Social enterprise data:</strong> Finding Australia&apos;s
                Social Enterprise Sector (FASES) 2016 and 2023 update. Social Traders Census of
                Australian Social Enterprises.
              </p>
              <p>
                <strong className="text-bauhaus-black">Community energy:</strong> Community Power Agency
                annual survey. CORENA public accounts. Hepburn Wind annual reports.
              </p>
              <p>
                <strong className="text-bauhaus-black">Indigenous procurement:</strong> National Indigenous
                Australians Agency (NIAA) IPP report 2023. Supply Nation certified supplier data.
              </p>
              <p>
                <strong className="text-bauhaus-black">Timebanking:</strong> Timebanking Australia
                network data. Individual timebank reported figures.
              </p>
              <p>
                <strong className="text-bauhaus-black">Limitations:</strong> Social enterprise data is
                estimated &mdash; there is no official register. Cooperative figures include inactive
                registrations. Community energy group counts include pre-operational projects.
                Timebanking hours are self-reported by individual networks.
              </p>
            </div>
          </section>
        </article>
      </div>

      <ReportCTA reportSlug="community-power" reportTitle="Community Power Playbook" />
    </div>
  );
}
