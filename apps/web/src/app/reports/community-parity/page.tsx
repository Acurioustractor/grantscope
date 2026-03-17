import { TableOfContents } from './toc';
import { ReportCTA } from '../_components/report-cta';

const FOUNDATIONS = {
  paulRamsay: '4ee5baca-c898-4318-ae2b-d79b95379cc7',
  minderoo: 'd4e26474-932a-4cbc-ae5b-33ff11bfdcf5',
  ianPotter: 'b9e090e5-1672-48ff-815a-2a6314ebe033',
  pratt: 'd3196a73-e510-4838-96bc-c4de842a9f8d',
} as const;

function F({ id, children }: { id: string; children: React.ReactNode }) {
  return <a href={`/foundations/${id}`} className="text-bauhaus-blue hover:text-bauhaus-red font-bold border-b-2 border-bauhaus-blue/30 hover:border-bauhaus-red/50 transition-colors">{children}</a>;
}

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

export default function CommunityParityPage() {
  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
      </div>

      <header className="mb-12 border-b-4 border-bauhaus-black pb-12">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-3">Data Investigation</p>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-bauhaus-black leading-[0.95] mb-6">
          Big Philanthropy &amp;<br /><span className="text-bauhaus-red">Community Parity</span>
        </h1>
        <p className="text-lg text-bauhaus-muted font-medium max-w-2xl leading-relaxed mb-6">
          How Australia&apos;s philanthropic system concentrates power, who it leaves behind,
          and why the communities doing the hardest work receive the least funding.
        </p>
        <div className="flex flex-wrap gap-4 text-xs font-black text-bauhaus-muted uppercase tracking-widest">
          <span>Sources: ACNC, ATO, AIHW, Philanthropy Australia</span>
          <span>|</span>
          <span>2023 Data</span>
        </div>
      </header>

      {/* Layout: TOC sidebar + content */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-12">
        <TableOfContents />

        <article className="min-w-0">

          {/* Key numbers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
            <Stat value="0.5%" label="To First Nations" color="text-bauhaus-red" />
            <Stat value="12%" label="To Women & Girls" color="text-bauhaus-red" />
            <Stat value="94%" label="To Top 10% of Charities" color="text-bauhaus-black" />
            <Stat value="-$144M" label="Small Charity Net Loss" color="text-bauhaus-red" />
          </div>

          {/* ===== SECTION 1: CONCENTRATION ===== */}
          <SectionHeading id="concentration" number="01">The Concentration Problem</SectionHeading>
          <Prose>
            <p>
              Australia has over 53,000 registered charities, yet <strong className="text-bauhaus-black">94% of all charitable
              donations flow to just 10% of organisations</strong>. The number of Australians donating
              $2 or more has dropped by 1.1 million since 2016, even as total giving has increased.
              Money is concentrating. Donors are disappearing. The system is eating itself.
            </p>
            <p>
              The top recipients are overwhelmingly universities, hospitals, and large established
              institutions. These are not the organisations running community centres in remote
              towns or delivering culturally appropriate services to First Nations communities.
              The organisations closest to the ground receive the least.
            </p>
            <p>
              Between 2017 and 2023, the Gini coefficient for charitable donations in Australia
              rose from approximately 0.94 to 0.96 &mdash; making philanthropy more unequal than
              the most unequal economy on earth. This is not a bug. It is the design.
            </p>
          </Prose>

          <Callout color="red">
            1.1 million fewer Australians donate $2+ per year compared to 2016.
            The donor base is shrinking even as total giving grows &mdash; wealth concentrates.
          </Callout>

          {/* ===== SECTION 2: TAX STRUCTURES ===== */}
          <SectionHeading id="tax-structures" number="02">Tax-Advantaged Structures</SectionHeading>
          <Prose>
            <p>
              Australia&apos;s philanthropic infrastructure runs on three primary tax-advantaged
              vehicles: <strong className="text-bauhaus-black">Private Ancillary Funds (PAFs)</strong>,{' '}
              <strong className="text-bauhaus-black">Public Ancillary Funds (PuAFs)</strong>, and{' '}
              <strong className="text-bauhaus-black">community foundations</strong>. In the 2021-22
              financial year, these vehicles collectively held <strong className="text-bauhaus-black">$10.2 billion
              in assets</strong> but distributed only <strong className="text-bauhaus-black">$4.65 billion</strong>.
            </p>
            <p>
              PAFs are the dominant vehicle. There are over 1,900 PAFs in Australia, required to
              distribute just 5% of their corpus annually. This means a wealthy donor gets an
              immediate tax deduction, but the money may sit in an investment vehicle for decades.
              Some PAFs have existed for 20+ years while distributing the bare minimum.
            </p>
            <p>
              PuAFs (which include community foundations) must distribute 4% annually. The gap
              between contributions received ($10.2B) and amounts distributed ($4.65B) is growing.
              Every year, the tax-advantaged pool grows faster than the money flowing to the community.
            </p>
            <p>
              Donor-Advised Fund equivalents are emerging in Australia, following the US pattern where
              Fidelity Charitable became the nation&apos;s largest &ldquo;charity&rdquo; by holding
              $50 billion in assets &mdash; with no legal obligation to ever distribute.
            </p>
          </Prose>

          <div className="grid grid-cols-2 gap-4 my-8 max-w-lg">
            <Stat value="$10.2B" label="Contributed to Vehicles" color="text-bauhaus-blue" />
            <Stat value="$4.65B" label="Actually Distributed" color="text-money" />
          </div>

          <Callout>
            For every dollar contributed to tax-advantaged philanthropic vehicles, only 46 cents
            has been distributed. The rest grows the fund &mdash; not the community.
          </Callout>

          {/* ===== SECTION 3: WHO MISSES OUT ===== */}
          <SectionHeading id="who-misses-out" number="03">Who Misses Out</SectionHeading>
          <Prose>
            <p>
              The concentration of philanthropic power has clear losers.{' '}
              <strong className="text-bauhaus-red">First Nations communities receive 0.5% of
              philanthropic funding</strong> despite representing 3.8% of the population and facing
              the most severe disadvantage on virtually every measure. The AIHW reports a 8.6-year
              life expectancy gap for men and 7.8 years for women.
            </p>
            <p>
              <strong className="text-bauhaus-red">Women and girls receive just 12% of direct
              grant funding</strong>. Gender-lens investing and targeted women&apos;s funding is growing,
              but from a base so low that &ldquo;growth&rdquo; is almost meaningless in absolute terms.
            </p>
            <p>
              <strong className="text-bauhaus-red">Grassroots organisations receive approximately 6%
              of philanthropic funding</strong> despite being the primary service delivery mechanism for
              marginalised communities. The 16,000+ extra-small charities (revenue under $250K)
              posted a collective net loss of $144 million in 2023 &mdash; they are literally going
              backwards.
            </p>
            <p>
              Regional and remote communities are systematically underfunded relative to metro
              areas. Disability-led organisations receive a fraction of what large disability
              service providers receive. LGBTQIA+ organisations operate on shoestring budgets.
              The pattern is consistent: the further you are from institutional power, the less
              funding you receive.
            </p>
          </Prose>

          {/* Equity bar chart */}
          <div className="my-8 bg-white border-4 border-bauhaus-black p-6 bauhaus-shadow-sm max-w-xl">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-4">Philanthropic Funding Share vs Population Share</p>
            <div className="space-y-4">
              {[
                { label: 'First Nations', funding: 0.5, population: 3.8, color: 'bg-bauhaus-red' },
                { label: 'Women & Girls', funding: 12, population: 51, color: 'bg-bauhaus-red' },
                { label: 'Grassroots Orgs', funding: 6, population: null, color: 'bg-bauhaus-yellow' },
                { label: 'Top 10% Charities', funding: 94, population: null, color: 'bg-bauhaus-black' },
              ].map(d => (
                <div key={d.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-bauhaus-black">{d.label}</span>
                    <span className="text-xs font-black text-bauhaus-muted">
                      {d.funding}% of funding{d.population ? ` / ${d.population}% of population` : ''}
                    </span>
                  </div>
                  <div className="h-6 border-2 border-bauhaus-black bg-bauhaus-canvas overflow-hidden">
                    <div className={`h-full ${d.color}`} style={{ width: `${Math.min(d.funding, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Callout color="red">
            First Nations people are 3.8% of the population but receive 0.5% of philanthropic
            funding. Women are 51% of the population but receive 12% of direct grants.
            The gap between need and funding is a chasm.
          </Callout>

          {/* ===== SECTION 4: REPUTATION CLEANSING ===== */}
          <SectionHeading id="reputation" number="04">Reputation Cleansing</SectionHeading>
          <Prose>
            <p>
              Corporate philanthropy in Australia is worth approximately $1.8 billion annually.
              But <strong className="text-bauhaus-black">an estimated $1.1 billion comes from
              companies whose core operations raise serious ethical questions</strong> &mdash;
              fossil fuel extraction, gambling, tobacco, alcohol, and mining companies with poor
              environmental records.
            </p>
            <p>
              The pattern is well-documented internationally as &ldquo;reputation laundering&rdquo;
              or &ldquo;philanthropic washing.&rdquo; A mining company causing environmental damage
              in one postcode funds a conservation program in another. A gambling company contributing
              to problem gambling funds addiction research. The giving is real; the net social impact
              is questionable.
            </p>
            <p>
              In Australia, the Minerals Council of Australia members collectively gave ~$450 million
              in 2022-23. Woodside Energy&apos;s foundation operates alongside a company that is one of
              Australia&apos;s largest carbon emitters. BHP Foundation funds community resilience
              programs in regions where BHP mining operations are the primary cause of environmental stress.
            </p>
            <p>
              This is not to say corporate giving should stop &mdash; it&apos;s to say that
              philanthropy used as a reputational offset for extractive business practices should
              be recognised for what it is. The community organisations receiving these grants
              often have no alternative funding source, creating a dependency on the very companies
              causing harm.
            </p>
          </Prose>

          <div className="grid grid-cols-2 gap-4 my-8 max-w-lg">
            <Stat value="$1.8B" label="Corporate Giving" color="text-bauhaus-blue" />
            <Stat value="$1.1B" label="From Ethically Dubious Sources" color="text-bauhaus-red" />
          </div>

          <div className="my-8 p-4 bg-bauhaus-canvas border-4 border-bauhaus-black">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Explore the data</p>
            <div className="flex gap-3 flex-wrap">
              <a href="/corporate" className="text-sm font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-wider">Corporate Giving &rarr;</a>
              <a href="/foundations" className="text-sm font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-wider">All Foundations &rarr;</a>
            </div>
          </div>

          {/* ===== SECTION 5: POLITICAL INFLUENCE ===== */}
          <SectionHeading id="political" number="05">Political Influence</SectionHeading>
          <Prose>
            <p>
              Philanthropy and political power are deeply entangled in Australia.{' '}
              <strong className="text-bauhaus-black">Approximately 35% of political donations above
              the disclosure threshold remain effectively undisclosed</strong> due to loopholes in
              federal disclosure laws. The threshold before disclosure is required sits at $16,900
              (2023-24) &mdash; compared to $200 in Canada and zero in the UK.
            </p>
            <p>
              Major philanthropic donors frequently sit on government advisory boards. Foundation
              leaders populate the boards of universities, hospitals, and cultural institutions that
              receive their grants. The interlocking directorate pattern &mdash; where a small group
              of individuals hold multiple board positions across foundations, charities, and
              government bodies &mdash; is a feature, not a bug.
            </p>
            <p>
              Fossil fuel companies provide philanthropic funding to institutions that shape
              public policy on energy and climate. Mining companies fund Indigenous programs while
              lobbying against Indigenous land rights. The same families that benefit from
              tax-advantaged philanthropy fund political campaigns and shape the regulatory
              environment.
            </p>
            <p>
              The result is a system where philanthropic power reinforces political power,
              which reinforces economic power. Community organisations receiving grants from these
              structures are implicitly expected not to bite the hand that feeds them &mdash;
              limiting advocacy, constraining ambition, and maintaining the status quo.
            </p>
          </Prose>

          <Callout color="blue">
            Australia&apos;s political donation disclosure threshold is $16,900.
            Canada&apos;s is $200. The UK&apos;s is zero. What can&apos;t be seen can&apos;t be
            scrutinised.
          </Callout>

          {/* ===== SECTION 6: THE TAX QUESTION ===== */}
          <SectionHeading id="tax-question" number="06">The Tax Question</SectionHeading>
          <Prose>
            <p>
              Australia abolished inheritance tax in 1979. The top 10% of Australians now hold
              over 44% of all household wealth &mdash; and the trend is accelerating. Without an
              inheritance tax, without a broad-based wealth tax, and with generous tax deductions
              for philanthropic giving, the system effectively allows the wealthy to direct
              public resources toward their preferred causes rather than through democratic processes.
            </p>
            <p>
              Tax-deductible giving costs the federal budget an estimated $2.5 billion per year in
              foregone revenue. This is public money &mdash; it would otherwise be collected as tax
              and allocated through the budget process. Instead, it flows according to the preferences
              of individual donors, disproportionately toward institutions that already serve the
              wealthy (universities, hospitals, arts organisations).
            </p>
            <p>
              The Productivity Commission&apos;s 2010 report on the not-for-profit sector recommended
              tighter payout rules for ancillary funds. Philanthropy Australia lobbied successfully
              against this. The minimum payout rate for PAFs was actually reduced from 5% of corpus
              to 5% of market value &mdash; allowing foundations to distribute even less during
              market downturns when community need is greatest.
            </p>
            <p>
              Meanwhile, the conversation about increasing the mandatory payout rate (as proposed
              in Canada with the &ldquo;Senators Spending Rule&rdquo;) has gained no traction in
              Australia. The philanthropic sector effectively self-regulates on distribution,
              with predictable results.
            </p>
          </Prose>

          <div className="grid grid-cols-2 gap-4 my-8 max-w-lg">
            <Stat value="44%+" label="Wealth Held by Top 10%" />
            <Stat value="$2.5B" label="Tax Foregone on Giving" color="text-bauhaus-red" />
          </div>

          <Callout>
            Australia abolished inheritance tax in 1979. Every other comparable economy (UK, US,
            Canada, Japan, Germany) retains one. Philanthropy has become a way to direct
            public resources without democratic accountability.
          </Callout>

          {/* ===== SECTION 7: WHAT NOW ===== */}
          <SectionHeading id="what-now" number="07">What Now</SectionHeading>
          <Prose>
            <p>
              None of this is inevitable. The system is designed, and it can be redesigned.
              But reform requires seeing the system clearly first. That&apos;s what this data
              infrastructure exists to enable.
            </p>
            <p>
              <strong className="text-bauhaus-black">For community organisations:</strong> The
              data on who funds what, and what strings are attached, should be visible. When you
              know that your funder&apos;s parent company is lobbying against your advocacy goals,
              you can make informed decisions about the trade-offs.
            </p>
            <p>
              <strong className="text-bauhaus-black">For policymakers:</strong> Mandatory minimum
              payout rates, tighter disclosure requirements, and an honest conversation about the
              cost of tax-deductible giving are overdue. The $2.5 billion in foregone tax revenue
              should be delivering equitable outcomes.
            </p>
            <p>
              <strong className="text-bauhaus-black">For donors:</strong> Direct giving to
              grassroots organisations, First Nations-led initiatives, and community-controlled
              services has the highest impact per dollar. The infrastructure to find and fund
              these organisations is what CivicGraph is building.
            </p>
            <p>
              <strong className="text-bauhaus-black">For everyone:</strong> The alternative exists.
              Community-led models that build genuine economic power &mdash; cooperatives, community
              energy, social enterprise, timebanking &mdash; are already working in Australia.
              They just need to be visible.
            </p>
          </Prose>

          <div className="my-12 flex gap-4 flex-wrap">
            <a href="/reports/community-power" className="inline-flex items-center gap-2 px-6 py-3 font-black text-sm bg-bauhaus-black text-white uppercase tracking-widest hover:bg-bauhaus-red border-4 border-bauhaus-black bauhaus-shadow-sm">
              Community Power Playbook &rarr;
            </a>
            <a href="/reports/big-philanthropy" className="inline-flex items-center gap-2 px-6 py-3 font-black text-sm bg-white text-bauhaus-black uppercase tracking-widest hover:bg-bauhaus-canvas border-4 border-bauhaus-black bauhaus-shadow-sm">
              $222 Billion Report &rarr;
            </a>
            <a href="/foundations" className="inline-flex items-center gap-2 px-6 py-3 font-black text-sm bg-white text-bauhaus-black uppercase tracking-widest hover:bg-bauhaus-canvas border-4 border-bauhaus-black bauhaus-shadow-sm">
              Explore {'>'}9,800 Foundations &rarr;
            </a>
          </div>

          {/* Methodology */}
          <section className="border-t-4 border-bauhaus-black pt-8 mt-16">
            <h2 className="text-sm font-black text-bauhaus-black mb-4 uppercase tracking-widest">Sources &amp; Methodology</h2>
            <div className="text-sm text-bauhaus-muted font-medium space-y-3 max-w-[680px] leading-relaxed">
              <p>
                <strong className="text-bauhaus-black">Data sources:</strong> ACNC Annual Information Statements (359,678 records, 2017-2023),
                ATO Tax Statistics, AIHW Closing the Gap reports, Philanthropy Australia PuAF/PAF survey data,
                JBWere NAB Charitable Giving Index, Australian Electoral Commission disclosure data.
              </p>
              <p>
                <strong className="text-bauhaus-black">First Nations funding figure (0.5%):</strong> Derived from
                Philanthropy Australia analysis and confirmed by multiple sector reports. Refers to targeted
                philanthropic funding; government program funding (e.g. NIAA) is separate.
              </p>
              <p>
                <strong className="text-bauhaus-black">Corporate reputation estimate ($1.1B):</strong> Based on
                cross-referencing corporate giving data with companies flagged for environmental, gambling,
                or other ethical concerns in ASX corporate responsibility reports. Methodology is indicative,
                not exhaustive.
              </p>
              <p>
                <strong className="text-bauhaus-black">Limitations:</strong> Philanthropic funding figures are
                approximations drawn from multiple sources with different definitions of &ldquo;giving.&rdquo;
                Gender and First Nations funding breakdowns rely on sector surveys with limited sample sizes.
                Political donation data is constrained by disclosure thresholds.
              </p>
            </div>
          </section>
        </article>
      </div>

      <ReportCTA reportSlug="community-parity" reportTitle="Community Parity Report" />
    </div>
  );
}
