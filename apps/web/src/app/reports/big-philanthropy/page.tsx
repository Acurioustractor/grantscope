import { TableOfContents } from './toc';

// Foundation IDs for internal links
const FOUNDATIONS = {
  paulRamsay: '4ee5baca-c898-4318-ae2b-d79b95379cc7',
  minderoo: 'd4e26474-932a-4cbc-ae5b-33ff11bfdcf5',
  ianPotter: 'b9e090e5-1672-48ff-815a-2a6314ebe033',
  snowMedical: '43e43c0f-7d97-4940-8677-0dddb3cb88c2',
  myer: '5fd1a683-544f-46bd-bd27-7aeb04fa75e5',
  timFairfax: '5cb27568-8820-441c-a536-e88b5b4d9cea',
  pratt: 'd3196a73-e510-4838-96bc-c4de842a9f8d',
  lowy: 'd2f02b4c-dbd6-4aa3-b8a8-a5a888de1c4e',
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

export default async function BigPhilanthropyPage() {
  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
      </div>

      <header className="mb-12 border-b-4 border-bauhaus-black pb-12">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-3">Data Investigation</p>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-bauhaus-black leading-[0.95] mb-6">
          Where Does Australia&apos;s<br /><span className="text-bauhaus-blue">$222 Billion</span> Go?
        </h1>
        <p className="text-lg text-bauhaus-muted font-medium max-w-2xl leading-relaxed mb-6">
          An investigation into 359,678 charity financial records across 7 years,
          revealing who gives, who receives, and the growing concentration of
          philanthropic power in Australia.
        </p>
        <div className="flex flex-wrap gap-4 text-xs font-black text-bauhaus-muted uppercase tracking-widest">
          <span>Source: ACNC Annual Information Statements</span>
          <span>|</span>
          <span>53,207 charities</span>
          <span>|</span>
          <span>2017&ndash;2023</span>
        </div>
      </header>

      {/* Layout: TOC sidebar + content */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-12">

        {/* Sticky TOC */}
        <TableOfContents />

        {/* Main content */}
        <article className="min-w-0">

          {/* Key numbers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
            <Stat value="$222B" label="Total Revenue (2023)" color="text-bauhaus-blue" />
            <Stat value="$11.3B" label="Grants Distributed" color="text-money" />
            <Stat value="$494B" label="Assets Held" />
            <Stat value="90.3%" label="Top 10% Share" color="text-bauhaus-red" />
          </div>

          {/* ===== SECTION 1: THE SCALE ===== */}
          <SectionHeading id="scale" number="01">The Scale of the Sector</SectionHeading>
          <Prose>
            <p>
              Australia&apos;s charity sector is enormous. In 2023, the 53,207 charities registered
              with the <a href="https://www.acnc.gov.au" target="_blank" rel="noopener noreferrer" className="text-bauhaus-blue hover:text-bauhaus-red font-bold">Australian Charities and Not-for-profits Commission (ACNC)</a> reported
              a combined revenue of <strong className="text-bauhaus-black">$222 billion</strong> &mdash;
              more than the GDP of New Zealand. They held <strong className="text-bauhaus-black">$494 billion in assets</strong>,
              employed millions of staff, and engaged 3.9 million volunteers.
            </p>
            <p>
              But where does all that money go? The ACNC requires every registered charity to
              submit an Annual Information Statement (AIS) each year. These filings are published
              as open data on <a href="https://data.gov.au" target="_blank" rel="noopener noreferrer" className="text-bauhaus-blue hover:text-bauhaus-red font-bold">data.gov.au</a>.
              We imported all 359,678 records spanning 2017&ndash;2023 to find out.
            </p>
            <p>
              The answer is not straightforward. Of that $222 billion, only <strong className="text-bauhaus-black">$11.3 billion</strong> was
              reported as grants and donations &mdash; money flowing out to other organisations or
              individuals. The majority goes to employee costs ($118 billion), service delivery,
              and asset growth.
            </p>
          </Prose>

          <Callout>
            The charity sector holds almost half a trillion dollars in assets. Only 2.3% of annual
            revenue flows out as grants.
          </Callout>

          {/* ===== SECTION 2: CONCENTRATION ===== */}
          <SectionHeading id="concentration" number="02">The 90/10 Concentration Problem</SectionHeading>
          <Prose>
            <p>
              The most striking finding in the data is how concentrated giving is. Of the 30,166
              charities that reported distributing donations in 2023, the <strong className="text-bauhaus-black">top 10%
              captured 90.3% of all donation dollars</strong>. The bottom 50% shared less than 0.004%.
            </p>
            <p>
              This isn&apos;t static &mdash; it&apos;s getting worse. In 2017, the top 10% share was
              86.7%. By 2023, it had climbed to 90.3%, a steady march toward greater concentration.
              The Gini coefficient for charitable giving in Australia sits at approximately 0.96 &mdash;
              higher than the most unequal economies on earth.
            </p>
            <p>
              To visualise this: if you lined up all 30,000+ charities from smallest to largest
              and walked halfway down the line, you&apos;d have covered organisations that collectively
              received less than $500,000. The last 3,000 charities in that line received
              over $10 billion.
            </p>
          </Prose>

          {/* Concentration trend inline */}
          <div className="my-8 bg-white border-4 border-bauhaus-black p-6 bauhaus-shadow-sm max-w-xl">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-4">Top 10% Share of Donations Over Time</p>
            <div className="space-y-2">
              {[
                { year: '2017', pct: 86.7 },
                { year: '2018', pct: 87.5 },
                { year: '2019', pct: 88.3 },
                { year: '2020', pct: 88.9 },
                { year: '2021', pct: 88.4 },
                { year: '2022', pct: 87.4 },
                { year: '2023', pct: 90.3 },
              ].map(d => (
                <div key={d.year} className="flex items-center gap-3">
                  <span className="text-xs font-black text-bauhaus-muted w-8">{d.year}</span>
                  <div className="flex-1 h-7 border-2 border-bauhaus-black bg-bauhaus-canvas overflow-hidden">
                    <div
                      className={`h-full ${d.year === '2023' ? 'bg-bauhaus-red' : 'bg-bauhaus-yellow'}`}
                      style={{ width: `${d.pct}%` }}
                    />
                  </div>
                  <span className={`text-xs font-black w-12 text-right ${d.year === '2023' ? 'text-bauhaus-red' : 'text-bauhaus-black'}`}>{d.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          <Callout color="red">
            The Gini coefficient for Australian charitable giving is approximately 0.96. For context,
            the most unequal country on earth by income (South Africa) has a Gini of 0.63.
          </Callout>

          {/* ===== SECTION 3: ASSET GIANTS ===== */}
          <SectionHeading id="assets" number="03">The Asset Giants</SectionHeading>
          <Prose>
            <p>
              The 30 largest asset holders in the charity sector control over $130 billion.
              But who are they? The answer may surprise you &mdash; only two are philanthropic
              foundations. The rest are <strong className="text-bauhaus-black">universities, religious institutions,
              and hospitals</strong>.
            </p>
            <p>
              The University of Melbourne tops the list at $12 billion, followed by the University
              of Sydney at $10.1 billion. The Wildlife Land Fund sits at $8.5 billion in assets
              with zero dollars in grants distributed. <F id={FOUNDATIONS.minderoo}>Minderoo Foundation</F> appears
              at #4 with $7.6 billion in assets &mdash; up from $640 million in 2017 &mdash; but
              a giving ratio of just 3.1%.
            </p>
            <p>
              Monash University, UNSW, ANU, and UQ all appear in the top 15.
              These institutions are technically charities, but their &ldquo;grants&rdquo; often include
              research passthrough funding &mdash; money that comes in from government and gets
              redistributed to researchers, not to the community. The line between charity and
              enterprise blurs considerably at this scale.
            </p>
            <p>
              Religious organisations hold significant assets too. The Catholic Church entities,
              Anglican Diocese trusts, and Uniting Church bodies collectively control billions.
              Their &ldquo;grants&rdquo; often include internal transfers between entities within
              the same denomination.
            </p>
          </Prose>

          <div className="my-8 p-4 bg-bauhaus-canvas border-4 border-bauhaus-black">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Explore the full data</p>
            <div className="flex gap-3 flex-wrap">
              <a href="/foundations" className="text-sm font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-wider">All Foundations &rarr;</a>
              <a href="/corporate" className="text-sm font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-wider">Corporate Giving &rarr;</a>
            </div>
          </div>

          {/* ===== SECTION 4: THE SCORECARD ===== */}
          <SectionHeading id="scorecard" number="04">The Philanthropy Scorecard</SectionHeading>
          <Prose>
            <p>
              Not all foundations are created equal. We scored Australia&apos;s eight most
              prominent private foundations on a simple metric: how much of their revenue
              actually flows out as grants? The results range from exemplary to concerning.
            </p>
          </Prose>

          {/* Foundation profiles */}
          <div className="space-y-8 my-8">

            {/* Paul Ramsay */}
            <div className="bg-white border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-black text-bauhaus-black">
                    <F id={FOUNDATIONS.paulRamsay}>Paul Ramsay Foundation</F>
                  </h3>
                  <p className="text-sm text-bauhaus-muted font-medium">Australia&apos;s largest private foundation. Endowed by the late Paul Ramsay (Ramsay Health Care).</p>
                </div>
                <span className="text-2xl font-black text-money bg-money-light border-3 border-money w-12 h-12 flex items-center justify-center flex-shrink-0">A+</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div><div className="text-lg font-black text-money">$184M</div><div className="text-xs font-bold text-bauhaus-muted uppercase">Grants (2023)</div></div>
                <div><div className="text-lg font-black">$3.0B</div><div className="text-xs font-bold text-bauhaus-muted uppercase">Assets</div></div>
                <div><div className="text-lg font-black text-money">176%</div><div className="text-xs font-bold text-bauhaus-muted uppercase">Giving Ratio</div></div>
                <div><div className="text-lg font-black">$1.7M</div><div className="text-xs font-bold text-bauhaus-muted uppercase">KMP Pay</div></div>
              </div>
              <Prose>
                <p>
                  A giving ratio above 100% means the foundation is drawing down its endowment &mdash;
                  spending more on grants than it earns in revenue. This is exactly what a well-run
                  foundation should do: deploy capital for impact rather than hoard it.
                  Paul Ramsay gave $184 million in 2023 while earning only $104 million in revenue,
                  a ratio of 176%. The foundation focuses on breaking cycles of disadvantage,
                  particularly in education and employment for young Australians.
                </p>
              </Prose>
            </div>

            {/* Minderoo */}
            <div className="bg-white border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-black text-bauhaus-black">
                    <F id={FOUNDATIONS.minderoo}>Minderoo Foundation</F>
                  </h3>
                  <p className="text-sm text-bauhaus-muted font-medium">Andrew &ldquo;Twiggy&rdquo; Forrest &amp; Nicola Forrest. Iron ore wealth (Fortescue Metals).</p>
                </div>
                <span className="text-2xl font-black text-bauhaus-red bg-bauhaus-red/10 border-3 border-bauhaus-red w-12 h-12 flex items-center justify-center flex-shrink-0">D</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div><div className="text-lg font-black">$156M</div><div className="text-xs font-bold text-bauhaus-muted uppercase">Grants (2023)</div></div>
                <div><div className="text-lg font-black">$7.6B</div><div className="text-xs font-bold text-bauhaus-muted uppercase">Assets</div></div>
                <div><div className="text-lg font-black text-bauhaus-red">3.1%</div><div className="text-xs font-bold text-bauhaus-muted uppercase">Giving Ratio</div></div>
                <div><div className="text-lg font-black">$3.4M</div><div className="text-xs font-bold text-bauhaus-muted uppercase">KMP Pay</div></div>
              </div>
              <Prose>
                <p>
                  Minderoo is Australia&apos;s most visible foundation, but the numbers tell a
                  complex story. Assets have grown from $640 million in 2017 to $7.6 billion
                  in 2023 &mdash; a 12x increase driven largely by Fortescue share price growth.
                  But the giving ratio has fallen to just 3.1%, meaning only 3 cents of every
                  dollar earned flows out as grants.
                </p>
                <p>
                  The $3.4 million in KMP compensation is the highest among the foundations
                  profiled. Minderoo&apos;s work spans oceans, fire resilience, modern slavery,
                  and early childhood &mdash; ambitious programs, but the foundation is primarily
                  growing its asset base rather than deploying it.
                </p>
              </Prose>
            </div>

            {/* Ian Potter */}
            <div className="bg-white border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-black text-bauhaus-black">
                    <F id={FOUNDATIONS.ianPotter}>The Ian Potter Foundation</F>
                  </h3>
                  <p className="text-sm text-bauhaus-muted font-medium">Est. 1964. One of Australia&apos;s most iconic foundations. Stock market wealth.</p>
                </div>
                <span className="text-2xl font-black text-money bg-money-light border-3 border-money w-12 h-12 flex items-center justify-center flex-shrink-0">A</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div><div className="text-lg font-black text-money">$46M</div><div className="text-xs font-bold text-bauhaus-muted uppercase">Grants (2023)</div></div>
                <div><div className="text-lg font-black">$888M</div><div className="text-xs font-bold text-bauhaus-muted uppercase">Assets</div></div>
                <div><div className="text-lg font-black text-money">112%</div><div className="text-xs font-bold text-bauhaus-muted uppercase">Giving Ratio</div></div>
                <div><div className="text-lg font-black">$0</div><div className="text-xs font-bold text-bauhaus-muted uppercase">KMP Pay</div></div>
              </div>
              <Prose>
                <p>
                  The gold standard for Australian philanthropy. Ian Potter has maintained a consistent
                  ~5% payout rate across decades, giving $46 million in 2023 against $888 million in
                  assets. The foundation reports $0 in KMP compensation &mdash; either the executives
                  are paid through a separate entity or they volunteer their time.
                </p>
                <p>
                  Ian Potter focuses on arts, environment, science, education, health, and community
                  wellbeing. Their grants typically range from $50K to $500K, and they&apos;re known for
                  funding innovative programs that others won&apos;t touch.
                </p>
              </Prose>
            </div>

            {/* Snow Medical */}
            <div className="bg-white border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-black text-bauhaus-black">
                    <F id={FOUNDATIONS.snowMedical}>Snow Medical Research Foundation</F>
                  </h3>
                  <p className="text-sm text-bauhaus-muted font-medium">Terry Snow (Canberra Airport). Focus on medical research.</p>
                </div>
                <span className="text-2xl font-black text-money bg-money-light border-3 border-money w-12 h-12 flex items-center justify-center flex-shrink-0">A+</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div><div className="text-lg font-black text-money">$35M</div><div className="text-xs font-bold text-bauhaus-muted uppercase">Grants (2023)</div></div>
                <div><div className="text-lg font-black">$421M</div><div className="text-xs font-bold text-bauhaus-muted uppercase">Assets</div></div>
                <div><div className="text-lg font-black text-money">295%</div><div className="text-xs font-bold text-bauhaus-muted uppercase">Giving Ratio</div></div>
                <div><div className="text-lg font-black">$0</div><div className="text-xs font-bold text-bauhaus-muted uppercase">KMP Pay</div></div>
              </div>
              <Prose>
                <p>
                  Snow Medical has the highest giving ratio of any major Australian foundation at
                  295%, meaning it&apos;s deploying nearly three times its annual revenue as grants.
                  With zero KMP compensation reported and a laser focus on medical research,
                  Snow represents the purest form of philanthropic intent in the Australian landscape.
                </p>
              </Prose>
            </div>

            {/* Myer */}
            <div className="bg-white border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-black text-bauhaus-black">
                    <F id={FOUNDATIONS.myer}>The Myer Foundation</F>
                  </h3>
                  <p className="text-sm text-bauhaus-muted font-medium">Sidney Myer family. Retail dynasty, est. 1959.</p>
                </div>
                <span className="text-2xl font-black text-bauhaus-blue bg-link-light border-3 border-bauhaus-blue w-12 h-12 flex items-center justify-center flex-shrink-0">B</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div><div className="text-lg font-black">$8M</div><div className="text-xs font-bold text-bauhaus-muted uppercase">Grants (2023)</div></div>
                <div><div className="text-lg font-black">$333M</div><div className="text-xs font-bold text-bauhaus-muted uppercase">Assets</div></div>
                <div><div className="text-lg font-black">57%</div><div className="text-xs font-bold text-bauhaus-muted uppercase">Giving Ratio</div></div>
                <div><div className="text-lg font-black">$1.1M</div><div className="text-xs font-bold text-bauhaus-muted uppercase">KMP Pay</div></div>
              </div>
              <Prose>
                <p>
                  A solid, long-standing foundation with a respectable giving ratio. The Myer
                  Foundation is one of Australia&apos;s oldest and has given hundreds of millions
                  over its lifetime. The 57% ratio means it gives more than half its revenue &mdash;
                  good, but not exceptional. At $8 million in annual grants against $333 million
                  in assets, there&apos;s an argument for higher payout.
                </p>
              </Prose>
            </div>

            {/* Pratt */}
            <div className="bg-white border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-black text-bauhaus-black">
                    <F id={FOUNDATIONS.pratt}>The Pratt Foundation</F>
                  </h3>
                  <p className="text-sm text-bauhaus-muted font-medium">Pratt family (Visy Industries). Packaging and recycling wealth.</p>
                </div>
                <span className="text-2xl font-black text-money bg-money-light border-3 border-money w-12 h-12 flex items-center justify-center flex-shrink-0">A+</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div><div className="text-lg font-black text-money">$21M</div><div className="text-xs font-bold text-bauhaus-muted uppercase">Grants (2023)</div></div>
                <div><div className="text-lg font-black">$21M</div><div className="text-xs font-bold text-bauhaus-muted uppercase">Assets</div></div>
                <div><div className="text-lg font-black text-money">100%+</div><div className="text-xs font-bold text-bauhaus-muted uppercase">Giving Ratio</div></div>
                <div><div className="text-lg font-black">$0</div><div className="text-xs font-bold text-bauhaus-muted uppercase">KMP Pay</div></div>
              </div>
              <Prose>
                <p>
                  The Pratt Foundation operates as a near-perfect pass-through vehicle &mdash; money
                  comes in from the family and goes straight out as grants. With assets roughly
                  equal to annual giving and zero KMP compensation, this is philanthropy in its
                  purest operational form. The foundation focuses on education, the arts,
                  Indigenous support, and healthcare.
                </p>
              </Prose>
            </div>

            {/* Lowy */}
            <div className="bg-white border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-black text-bauhaus-black">
                    <F id={FOUNDATIONS.lowy}>Lowy Foundation</F>
                  </h3>
                  <p className="text-sm text-bauhaus-muted font-medium">Frank Lowy family. Westfield shopping centres.</p>
                </div>
                <span className="text-2xl font-black text-bauhaus-red bg-bauhaus-red/10 border-3 border-bauhaus-red w-12 h-12 flex items-center justify-center flex-shrink-0">F</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div><div className="text-lg font-black text-bauhaus-red">$0</div><div className="text-xs font-bold text-bauhaus-muted uppercase">Grants (2023)</div></div>
                <div><div className="text-lg font-black">$76M</div><div className="text-xs font-bold text-bauhaus-muted uppercase">Assets</div></div>
                <div><div className="text-lg font-black text-bauhaus-red">0%</div><div className="text-xs font-bold text-bauhaus-muted uppercase">Giving Ratio</div></div>
                <div><div className="text-lg font-black">$1.5M</div><div className="text-xs font-bold text-bauhaus-muted uppercase">KMP Pay</div></div>
              </div>
              <Prose>
                <p>
                  The most troubling profile in our scorecard. The Lowy Foundation reported zero
                  dollars in grants distributed in 2023 while holding $76 million in assets and
                  paying $1.5 million in KMP compensation. The Lowy Institute (the family&apos;s
                  policy think tank) may receive funding through other channels, but based on
                  ACNC filings alone, this is a foundation that pays executives while giving nothing.
                </p>
              </Prose>
            </div>
          </div>

          <div className="my-8 p-4 bg-bauhaus-canvas border-4 border-bauhaus-black">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-1">
              KMP = Key Management Personnel &mdash; the ACNC term for a charity&apos;s senior executives
              and directors. All charities must report total KMP compensation in their Annual Information Statement.
            </p>
          </div>

          {/* ===== SECTION 5: EXECUTIVE PAY ===== */}
          <SectionHeading id="executive-pay" number="05">The Executive Pay Question</SectionHeading>
          <Prose>
            <p>
              KMP compensation data only became available in the AIS from 2022. The results
              are striking: <strong className="text-bauhaus-black">89% of charities that reported KMP data paid
              their executives more than they distributed in grants</strong>.
            </p>
            <p>
              Total executive compensation across the sector: <strong className="text-bauhaus-black">$3.75 billion</strong>.
              To be fair, many charities are service-delivery organisations where executive
              talent is essential &mdash; hospitals, universities, and aged care providers need
              qualified leaders. But the ratio of pay-to-grants is still worth examining.
            </p>
            <p>
              The most extreme cases tell a story. Little Company of Mary (Calvary Health Care)
              paid $17.5 million in KMP compensation against $0.5 million in grants &mdash; a
              34:1 ratio. RMIT University paid $9.9 million against $4 million in grants.
              Meanwhile, <F id={FOUNDATIONS.paulRamsay}>Paul Ramsay Foundation</F> paid $1.7 million
              in KMP against $184 million in grants &mdash; a 1:108 ratio in favour of giving.
            </p>
          </Prose>

          <Callout color="blue">
            89% of charities with KMP data paid their executives more than they gave in grants.
            Total sector-wide executive compensation: $3.75 billion.
          </Callout>

          {/* ===== SECTION 6: REVENUE DEPENDENCY ===== */}
          <SectionHeading id="revenue" number="06">Follow the Money: Revenue Dependency</SectionHeading>
          <Prose>
            <p>
              Where charities get their money matters as much as how they spend it. The funding
              model shapes everything &mdash; priorities, autonomy, and vulnerability to cuts.
            </p>
            <p>
              <strong className="text-bauhaus-black">Large charities</strong> (5,628 organisations, $209 billion in revenue)
              get 49% of their income from government. They are, in effect, outsourced government
              service providers. Only 7% comes from donations.
            </p>
            <p>
              <strong className="text-bauhaus-black">Small charities</strong> (39,460 organisations, $3.3 billion in revenue)
              are the mirror image. They receive just 17% from government and depend on donations
              for 38% of their income. These are your local community groups, grassroots organisations,
              and volunteer-run services. They are closest to the communities they serve, yet
              furthest from stable funding.
            </p>
            <p>
              <strong className="text-bauhaus-black">Medium charities</strong> (8,116 organisations, $9.6 billion) sit in
              between &mdash; 35% government, 22% donations &mdash; and are increasingly squeezed
              from both sides.
            </p>
          </Prose>

          {/* Revenue bars */}
          <div className="my-8 max-w-xl space-y-4">
            {[
              { label: 'Large (5,628 charities)', govt: 49, earned: 34, donations: 7, other: 10 },
              { label: 'Medium (8,116 charities)', govt: 35, earned: 30, donations: 22, other: 13 },
              { label: 'Small (39,460 charities)', govt: 17, earned: 25, donations: 38, other: 20 },
            ].map(row => (
              <div key={row.label}>
                <p className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">{row.label}</p>
                <div className="flex h-10 border-4 border-bauhaus-black overflow-hidden">
                  <div style={{ width: `${row.govt}%` }} className="bg-bauhaus-yellow flex items-center justify-center text-[10px] font-black text-bauhaus-black">{row.govt}%</div>
                  <div style={{ width: `${row.earned}%` }} className="bg-bauhaus-blue flex items-center justify-center text-[10px] font-black text-white">{row.earned}%</div>
                  <div style={{ width: `${row.donations}%` }} className="bg-bauhaus-red flex items-center justify-center text-[10px] font-black text-white">{row.donations}%</div>
                  <div style={{ width: `${row.other}%` }} className="bg-bauhaus-black flex items-center justify-center text-[10px] font-black text-white">{row.other}%</div>
                </div>
              </div>
            ))}
            <div className="flex gap-4 flex-wrap text-xs font-bold text-bauhaus-muted">
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-bauhaus-yellow border-2 border-bauhaus-black inline-block"></span> Govt</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-bauhaus-blue border-2 border-bauhaus-black inline-block"></span> Earned</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-bauhaus-red border-2 border-bauhaus-black inline-block"></span> Donations</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-bauhaus-black border-2 border-bauhaus-black inline-block"></span> Other</span>
            </div>
          </div>

          <div className="my-8 p-4 bg-bauhaus-canvas border-4 border-bauhaus-black">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Explore further</p>
            <div className="flex gap-3 flex-wrap">
              <a href="/community" className="text-sm font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-wider">Community Organisations &rarr;</a>
              <a href="/reports/access-gap" className="text-sm font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-wider">The Access Gap Report &rarr;</a>
            </div>
          </div>

          {/* ===== SECTION 7: SMALL SQUEEZE ===== */}
          <SectionHeading id="squeeze" number="07">The Small Charity Squeeze</SectionHeading>
          <Prose>
            <p>
              While large charities posted a <strong className="text-bauhaus-black">$13.7 billion surplus</strong> in
              2023, medium charities went into deficit for the first time, posting
              a <strong className="text-bauhaus-red">-$1.84 billion loss</strong>.
            </p>
            <p>
              The asset gap tells an even starker story. Large charities grew their assets
              from $241 billion to $425 billion between 2017 and 2023 &mdash; a 76% increase.
              Small charities grew from $10 billion to $35 billion. In absolute terms,
              the gap widened by nearly $150 billion.
            </p>
            <p>
              What does this mean in practice? It means that the organisations closest to
              communities &mdash; the ones running youth programs, food banks, cultural events,
              and crisis services &mdash; are operating with shrinking margins while the sector&apos;s
              largest players accumulate unprecedented wealth.
            </p>
            <p>
              The <a href="/reports/access-gap" className="text-bauhaus-blue hover:text-bauhaus-red font-bold">Access Gap report</a> digs
              deeper into this dynamic, examining how compliance costs and admin burden
              disproportionately affect small organisations.
            </p>
          </Prose>

          <div className="grid grid-cols-2 gap-4 my-8 max-w-lg">
            <Stat value="-$1.84B" label="Medium deficit (2023)" color="text-bauhaus-red" />
            <Stat value="+$13.7B" label="Large surplus (2023)" color="text-money" />
          </div>

          {/* ===== SECTION 8: THE QUESTION ===== */}
          <SectionHeading id="question" number="08">The Question</SectionHeading>
          <Prose>
            <p>
              Is a system that holds $494 billion in assets while distributing $11.3 billion
              in grants really working for the communities it claims to serve?
            </p>
            <p>
              This is not a rhetorical question. The data says that concentration is increasing,
              that executive pay dwarfs grant-making in most charities, that small organisations
              are being squeezed, and that billions sit in endowments growing rather than
              being deployed.
            </p>
            <p>
              But the data also shows genuine models of excellence. Foundations like{' '}
              <F id={FOUNDATIONS.paulRamsay}>Paul Ramsay</F>,{' '}
              <F id={FOUNDATIONS.ianPotter}>Ian Potter</F>,{' '}
              <F id={FOUNDATIONS.snowMedical}>Snow Medical</F>, and{' '}
              <F id={FOUNDATIONS.pratt}>Pratt</F>{' '}
              demonstrate that it&apos;s possible to run a foundation that prioritises giving
              over asset growth, that keeps executive costs low, and that deploys capital
              for impact.
            </p>
            <p>
              The difference between an A+ and an F on our scorecard isn&apos;t about wealth &mdash;
              it&apos;s about intent. And in a sector that enjoys tax-deductible status as a
              public benefit, intent should be visible, measurable, and accountable.
            </p>
            <p>
              This data is public. Published by the ACNC under CC BY 4.0. Every number
              can be verified, queried, and challenged. Transparency isn&apos;t just about
              publishing data &mdash; it&apos;s about making it legible.
            </p>
          </Prose>

          <div className="my-12 flex gap-4 flex-wrap">
            <a href="/foundations" className="inline-flex items-center gap-2 px-6 py-3 font-black text-sm bg-bauhaus-black text-white uppercase tracking-widest hover:bg-bauhaus-red border-4 border-bauhaus-black bauhaus-shadow-sm">
              Explore All Foundations &rarr;
            </a>
            <a href="/reports/power-dynamics" className="inline-flex items-center gap-2 px-6 py-3 font-black text-sm bg-white text-bauhaus-black uppercase tracking-widest hover:bg-bauhaus-canvas border-4 border-bauhaus-black bauhaus-shadow-sm">
              Power Dynamics Report &rarr;
            </a>
          </div>

          {/* Methodology */}
          <section className="border-t-4 border-bauhaus-black pt-8 mt-16">
            <h2 className="text-sm font-black text-bauhaus-black mb-4 uppercase tracking-widest">Methodology</h2>
            <div className="text-sm text-bauhaus-muted font-medium space-y-3 max-w-[680px] leading-relaxed">
              <p>
                <strong className="text-bauhaus-black">Data source:</strong> 359,678 Annual Information Statement (AIS) records
                from the ACNC, covering 2017&ndash;2023. Retrieved via CKAN API from data.gov.au. All figures in AUD.
              </p>
              <p>
                <strong className="text-bauhaus-black">Giving ratio</strong> = grants distributed / total revenue.
                A ratio above 100% indicates endowment drawdown. <strong className="text-bauhaus-black">KMP</strong> (Key Management Personnel)
                compensation data is only available from 2022&ndash;2023 AIS filings.
              </p>
              <p>
                <strong className="text-bauhaus-black">Limitations:</strong> All data is self-reported by charities.
                University &ldquo;grants&rdquo; often include research passthrough funding.
                Religious organisations may classify internal transfers between entities as grants.
                Foundation giving may flow through related entities not captured in a single AIS filing.
              </p>
              <p>
                <strong className="text-bauhaus-black">Scorecard grades:</strong> A+ = giving ratio &gt;100% with low KMP.
                A = ratio &gt;50% with strong track record. B = ratio 25&ndash;50%.
                C = ratio 10&ndash;25%. D = ratio &lt;10%. F = 0% giving with material KMP pay.
              </p>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
