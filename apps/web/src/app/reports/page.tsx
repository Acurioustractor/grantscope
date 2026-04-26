import { ReportCTA } from './_components/report-cta';

export default function ReportsPage() {
  return (
    <div>
      <div className="mb-10">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-2">CivicGraph Intelligence</p>
        <h1 className="text-3xl font-black text-bauhaus-black mb-2">Market Intelligence Reports</h1>
        <p className="text-bauhaus-muted font-medium max-w-2xl">
          Data-driven investigations into how money flows through society &mdash; grants, contracts,
          donations, and procurement. Start anywhere &mdash; each report links to the others.
        </p>
      </div>

      {/* Reading order guide */}
      <div className="bg-bauhaus-canvas border-4 border-bauhaus-black p-5 mb-10 bauhaus-shadow-sm max-w-2xl">
        <p className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-3">Investigation Reading Order</p>
        <ol className="space-y-2 text-sm font-medium text-bauhaus-black/80">
          <li className="flex gap-2">
            <span className="text-bauhaus-red font-black">1.</span>
            <span><a href="/reports/big-philanthropy" className="font-bold text-bauhaus-blue hover:text-bauhaus-red">$222 Billion</a> &mdash; Where does Australia&apos;s charity money actually go?</span>
          </li>
          <li className="flex gap-2">
            <span className="text-bauhaus-red font-black">2.</span>
            <span><a href="/reports/community-parity" className="font-bold text-bauhaus-blue hover:text-bauhaus-red">Community Parity</a> &mdash; Who benefits, who misses out, and why</span>
          </li>
          <li className="flex gap-2">
            <span className="text-bauhaus-red font-black">3.</span>
            <span><a href="/reports/funding-equity" className="font-bold text-bauhaus-blue hover:text-bauhaus-red">Funding Equity</a> &mdash; The most disadvantaged postcodes get 12.9% of charity income. The least get 46%.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-bauhaus-red font-black">4.</span>
            <span><a href="/reports/power-dynamics" className="font-bold text-bauhaus-blue hover:text-bauhaus-red">Power Dynamics</a> &mdash; Concentration, inequality, and who controls the levers</span>
          </li>
          <li className="flex gap-2">
            <span className="text-bauhaus-red font-black">5.</span>
            <span><a href="/reports/community-power" className="font-bold text-bauhaus-blue hover:text-bauhaus-red">Community Power Playbook</a> &mdash; The alternative: what communities are building</span>
          </li>
          <li className="flex gap-2">
            <span className="text-bauhaus-red font-black">6.</span>
            <span><a href="/reports/social-enterprise" className="font-bold text-bauhaus-blue hover:text-bauhaus-red">Social Enterprise in Australia</a> &mdash; The invisible $21 billion sector and the register that doesn&apos;t exist</span>
          </li>
          <li className="flex gap-2">
            <span className="text-bauhaus-red font-black">7.</span>
            <span><a href="/reports/philanthropy" className="font-bold text-bauhaus-blue hover:text-bauhaus-red">Foundation Intelligence</a> &mdash; Who funds what, who watches, and what works</span>
          </li>
        </ol>
      </div>

      <section className="mb-6">
        <a href="/reports/civicgraph-thesis" className="group block">
          <div className="bg-white border-4 border-bauhaus-black p-8 transition-all group-hover:-translate-y-1" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-red)' }}>
            <div className="text-xs font-black text-bauhaus-red mb-2 uppercase tracking-widest">Company Memo — New</div>
            <h3 className="text-2xl font-black text-bauhaus-black mb-3">The CivicGraph Investor Memo</h3>
            <p className="text-base text-bauhaus-muted leading-relaxed mb-4 max-w-3xl">
              A shorter 2–3 page case for why CivicGraph can become the intelligence layer for grants,
              foundation prospecting, and institutional relationship discovery in the Australian social sector.
            </p>
            <div className="flex gap-6 text-bauhaus-muted/60 text-sm font-bold">
              <span>Why this market</span>
              <span>&middot;</span>
              <span>Why this wedge</span>
              <span>&middot;</span>
              <span>Why it can be a business</span>
            </div>
          </div>
        </a>
      </section>

      <section className="mb-6">
        <a href="/reports/why-grant-search-is-not-enough" className="group block">
          <div className="bg-bauhaus-canvas border-4 border-bauhaus-black p-8 transition-all group-hover:-translate-y-1" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-blue)' }}>
            <div className="text-xs font-black text-bauhaus-blue mb-2 uppercase tracking-widest">Broad Essay — New</div>
            <h3 className="text-2xl font-black text-bauhaus-black mb-3">Why Grant Search Is Not Enough</h3>
            <p className="text-base text-bauhaus-muted leading-relaxed mb-4 max-w-3xl">
              A broader article on why the next useful category is an intelligence layer for funding,
              not just a larger grants database. Written to work as CivicGraph publishing and as an
              Empathy Ledger syndication piece.
            </p>
            <div className="flex gap-6 text-bauhaus-muted/60 text-sm font-bold">
              <span>Workflow to power</span>
              <span>&middot;</span>
              <span>Money and voice</span>
              <span>&middot;</span>
              <span>Public discussion frame</span>
            </div>
          </div>
        </a>
      </section>

      {/* ===== DOMAIN INTELLIGENCE ===== */}
      <section className="mb-12">
        <div className="mb-5">
          <h2 className="text-xl font-black text-bauhaus-black mb-1">Domain Intelligence</h2>
          <p className="text-sm text-bauhaus-muted font-medium">
            ROGS, AIHW, ACARA &amp; ALMA data across youth justice, child protection, disability, and education.
            State deep-dives, national comparisons, and cross-domain analysis.
          </p>
        </div>

        {/* State Dashboards row */}
        <div className="bg-gray-50 border-4 border-bauhaus-black p-5 mb-5">
          <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-3">Cross-Domain State Dashboards</div>
          <div className="flex flex-wrap gap-2">
            {['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'].map(s => (
              <a key={s} href={`/reports/${s.toLowerCase()}`}
                className="text-sm font-black uppercase tracking-wider px-4 py-2 border-2 border-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors">
                {s}
              </a>
            ))}
          </div>
        </div>

        {/* Domain grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-red-50 border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black text-red-600 mb-1 uppercase tracking-widest">Youth Justice</div>
            <a href="/reports/youth-justice" className="block">
              <h3 className="text-lg font-black text-bauhaus-black mb-1 hover:text-red-600 transition-colors">Who gets locked up, who profits, what works</h3>
            </a>
            <p className="text-xs text-bauhaus-muted">Detention, recidivism, CtG Target 11, ROGS 17A, ALMA evidence</p>
            <div className="flex gap-3 mt-3">
              <a href="/reports/youth-justice/national" className="text-[10px] font-bold text-red-600 hover:underline">National &rarr;</a>
              <span className="text-[10px] text-gray-300">|</span>
              <a href="/reports/youth-justice/qld" className="text-[10px] font-bold text-red-600 hover:underline">QLD &rarr;</a>
              <a href="/reports/youth-justice/qld/tracker" className="text-[10px] font-bold text-red-600 hover:underline">QLD tracker &rarr;</a>
              <a href="/reports/youth-justice/qld/trackers" className="text-[10px] font-bold text-red-600 hover:underline">QLD trackers &rarr;</a>
              <a href="/reports/youth-justice/trackers" className="text-[10px] font-bold text-red-600 hover:underline">Portfolio &rarr;</a>
              <a href="/reports/youth-justice/qld/crime-prevention-schools" className="text-[10px] font-bold text-red-600 hover:underline">QLD investigation &rarr;</a>
              <a href="/reports/youth-justice/nsw" className="text-[10px] font-bold text-red-600 hover:underline">NSW &rarr;</a>
              <a href="/reports/youth-justice/nt" className="text-[10px] font-bold text-red-600 hover:underline">NT &rarr;</a>
            </div>
          </div>

          <div className="bg-amber-50 border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black text-amber-600 mb-1 uppercase tracking-widest">Child Protection</div>
            <a href="/reports/child-protection" className="block">
              <h3 className="text-lg font-black text-bauhaus-black mb-1 hover:text-amber-600 transition-colors">Out-of-home care, family safety, the pipeline</h3>
            </a>
            <p className="text-xs text-bauhaus-muted">Notifications, substantiations, OOHC, resubstantiation, ROGS 16A</p>
            <div className="flex gap-3 mt-3">
              <a href="/reports/child-protection/national" className="text-[10px] font-bold text-amber-600 hover:underline">National &rarr;</a>
              <span className="text-[10px] text-gray-300">|</span>
              <a href="/reports/child-protection/nsw" className="text-[10px] font-bold text-amber-600 hover:underline">NSW &rarr;</a>
              <a href="/reports/child-protection/qld" className="text-[10px] font-bold text-amber-600 hover:underline">QLD &rarr;</a>
              <a href="/reports/child-protection/vic" className="text-[10px] font-bold text-amber-600 hover:underline">VIC &rarr;</a>
            </div>
          </div>

          <div className="bg-blue-50 border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black text-blue-600 mb-1 uppercase tracking-widest">Disability</div>
            <a href="/reports/disability" className="block">
              <h3 className="text-lg font-black text-bauhaus-black mb-1 hover:text-blue-600 transition-colors">NDIS markets, thin supply, who delivers</h3>
            </a>
            <p className="text-xs text-bauhaus-muted">Participation, expenditure, satisfaction, restrictive practices, ROGS 15A</p>
            <div className="flex gap-3 mt-3">
              <a href="/reports/disability/national" className="text-[10px] font-bold text-blue-600 hover:underline">National &rarr;</a>
              <span className="text-[10px] text-gray-300">|</span>
              <a href="/reports/disability/nsw" className="text-[10px] font-bold text-blue-600 hover:underline">NSW &rarr;</a>
              <a href="/reports/disability/qld" className="text-[10px] font-bold text-blue-600 hover:underline">QLD &rarr;</a>
              <a href="/reports/disability/sa" className="text-[10px] font-bold text-blue-600 hover:underline">SA &rarr;</a>
            </div>
          </div>

          <div className="bg-emerald-50 border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black text-emerald-600 mb-1 uppercase tracking-widest">Education</div>
            <a href="/reports/education" className="block">
              <h3 className="text-lg font-black text-bauhaus-black mb-1 hover:text-emerald-600 transition-colors">Schools, funding, outcomes, and the crossover</h3>
            </a>
            <p className="text-xs text-bauhaus-muted">Attendance, retention, enrolments, ICSEA, expenditure, ROGS 4A</p>
            <div className="flex gap-3 mt-3">
              <a href="/reports/education/national" className="text-[10px] font-bold text-emerald-600 hover:underline">National &rarr;</a>
              <span className="text-[10px] text-gray-300">|</span>
              <a href="/reports/education/nsw" className="text-[10px] font-bold text-emerald-600 hover:underline">NSW &rarr;</a>
              <a href="/reports/education/nt" className="text-[10px] font-bold text-emerald-600 hover:underline">NT &rarr;</a>
              <a href="/reports/education/vic" className="text-[10px] font-bold text-emerald-600 hover:underline">VIC &rarr;</a>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FLAGSHIP: CONVERGENCE ===== */}
      <section className="mb-6">
        <a href="/reports/reallocation-atlas" className="group block">
          <div className="border-4 border-bauhaus-black bg-white p-8 transition-all group-hover:-translate-y-1" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-blue)' }}>
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-blue">Place × Power × Action — NEW FLAGSHIP</div>
            <h3 className="mb-3 text-2xl font-black text-bauhaus-black">The Reallocation Atlas</h3>
            <p className="mb-4 text-base leading-relaxed text-bauhaus-muted">
              A place-first operating surface for Australia. See where money is thin, who captures the flow,
              where community-controlled alternatives already exist, and what even a small reallocation could
              unlock in local contracts, grants, philanthropy, and community-owned production.
            </p>
            <div className="flex gap-6 text-sm font-bold text-bauhaus-muted/70">
              <span>Funding-desert map</span>
              <span>&middot;</span>
              <span>Power corridor</span>
              <span>&middot;</span>
              <span>Community-led reallocation model</span>
            </div>
          </div>
        </a>
      </section>

      <section className="mb-6">
        <a href="/reports/convergence" className="group block">
          <div className="bg-bauhaus-red border-4 border-bauhaus-black p-8 transition-all group-hover:-translate-y-1" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-black)' }}>
            <div className="text-xs font-black text-bauhaus-yellow mb-2 uppercase tracking-widest">Cross-System Investigation &mdash; FLAGSHIP</div>
            <h3 className="text-2xl font-black text-white mb-3">One Child. Five Systems. Zero Coordination.</h3>
            <p className="text-base text-white/80 leading-relaxed mb-4">
              The same communities appear in every government system &mdash; child protection, youth justice,
              disability, education, welfare. Money flows to maintain systems, not to help people.
              Community-controlled organisations have the evidence. They get the crumbs.
            </p>
            <div className="flex gap-6 text-white/60 text-sm font-bold">
              <span>5 systems cross-referenced</span>
              <span>&middot;</span>
              <span>1,951 LGAs scored</span>
              <span>&middot;</span>
              <span>ALMA evidence mapped to funding</span>
            </div>
          </div>
        </a>
      </section>

      {/* ===== FLAGSHIP: FOUNDATION INTELLIGENCE ===== */}
      <section className="mb-6">
        <a href="/reports/philanthropy" className="group block">
          <div className="bg-bauhaus-black border-4 border-bauhaus-black p-8 transition-all group-hover:-translate-y-1" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-yellow, #f5a623)' }}>
            <div className="text-xs font-black text-bauhaus-yellow mb-2 uppercase tracking-widest">Foundation Intelligence &mdash; NEW</div>
            <h3 className="text-2xl font-black text-white mb-3">Who Funds What. Who Watches. What Works.</h3>
            <p className="text-base text-white/80 leading-relaxed mb-4">
              2,466 Australian foundations scored on transparency, need alignment, evidence-backed
              funding, and geographic reach. $11.8B in annual giving &mdash; but how much reaches
              communities that need it most? Trustee&ndash;grantee board overlaps revealed.
            </p>
            <div className="flex gap-6 text-white/60 text-sm font-bold">
              <span>2,466 foundations scored</span>
              <span>&middot;</span>
              <span>5,036 grantee links traced</span>
              <span>&middot;</span>
              <span>72 revolving door overlaps</span>
            </div>
          </div>
        </a>
      </section>

      <section className="mb-6">
        <a href="/reports/grant-frontier" className="group block">
          <div className="bg-white border-4 border-bauhaus-black p-8 transition-all group-hover:-translate-y-1" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-blue)' }}>
            <div className="text-xs font-black text-bauhaus-blue mb-2 uppercase tracking-widest">Operations Surface — NEW</div>
            <h3 className="text-2xl font-black text-bauhaus-black mb-3">Grant Source Control Surface</h3>
            <p className="text-base text-bauhaus-muted leading-relaxed mb-4">
              The live ingestion rail behind CivicGraph grants. See which grant feeds dominate, which foundation queues are still cold,
              which frontier URLs are due now, and whether the discovery agents are actually doing the work.
            </p>
            <div className="flex gap-6 text-bauhaus-muted/60 text-sm font-bold">
              <span>30K+ grant rows</span>
              <span>&middot;</span>
              <span>50K+ frontier URLs</span>
              <span>&middot;</span>
              <span>Automation rail</span>
            </div>
          </div>
        </a>
      </section>

      {/* ===== FLAGSHIP: TRIPLE PLAY ===== */}
      <section className="mb-6">
        <a href="/reports/triple-play" className="group block">
          <div className="bg-bauhaus-black border-4 border-bauhaus-black p-8 transition-all group-hover:-translate-y-1" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-red)' }}>
            <div className="text-xs font-black text-bauhaus-yellow mb-2 uppercase tracking-widest">Cross-Dataset Investigation — NEW</div>
            <h3 className="text-2xl font-black text-white mb-3">Donate. Lobby. Win. Pay No Tax.</h3>
            <p className="text-base text-white/80 leading-relaxed mb-4">
              The Triple Play: entities that donate to political parties, lobby government ministers,
              win billions in contracts, and pay minimal tax. Five public datasets cross-referenced by ABN
              to reveal the system as a whole.
            </p>
            <div className="flex gap-6 text-white/60 text-sm font-bold">
              <span>446 donor-contractors</span>
              <span>&middot;</span>
              <span>$358M donated &rarr; $35B in contracts</span>
              <span>&middot;</span>
              <span>53,000+ crossover alerts</span>
            </div>
          </div>
        </a>
      </section>

      {/* ===== FLAGSHIP: IPP SCOREBOARD ===== */}
      <section className="mb-6">
        <a href="/reports/ipp-scoreboard" className="group block">
          <div className="bg-white border-4 border-bauhaus-black p-8 transition-all group-hover:-translate-y-1" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-red)' }}>
            <div className="text-xs font-black text-bauhaus-red mb-2 uppercase tracking-widest">Procurement Investigation &mdash; NEW</div>
            <h3 className="text-2xl font-black text-bauhaus-black mb-3">The IPP Scoreboard</h3>
            <p className="text-base text-bauhaus-muted leading-relaxed mb-4">
              Indigenous Procurement Policy was set in 2015 with a 3% target. In 2025, only 33 of 278
              federal+state agencies hit it. National share: 1.06%. Many agencies awarded $50M+ in
              contracts at zero Indigenous spend &mdash; named, ranked.
            </p>
            <div className="flex gap-6 text-bauhaus-muted/60 text-sm font-bold">
              <span>278 agencies in 2025</span>
              <span>&middot;</span>
              <span>$65.4B contract spend</span>
              <span>&middot;</span>
              <span>1.06% Indigenous share</span>
            </div>
          </div>
        </a>
      </section>

      {/* ===== FLAGSHIP: DOUBLE-DIPPERS ===== */}
      <section className="mb-6">
        <a href="/reports/double-dippers" className="group block">
          <div className="bg-white border-4 border-bauhaus-black p-8 transition-all group-hover:-translate-y-1" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-blue)' }}>
            <div className="text-xs font-black text-bauhaus-blue mb-2 uppercase tracking-widest">Cross-Channel Investigation &mdash; NEW</div>
            <h3 className="text-2xl font-black text-bauhaus-black mb-3">The Double-Dippers</h3>
            <p className="text-base text-bauhaus-muted leading-relaxed mb-4">
              4,218 Australian entities receive both government grants AND government contracts.
              Two separate funding channels, one combined relationship with the public purse.
              Total: $678 billion across the dataset.
            </p>
            <div className="flex gap-6 text-bauhaus-muted/60 text-sm font-bold">
              <span>4,218 cross-channel orgs</span>
              <span>&middot;</span>
              <span>$40.9B grants + $637.9B contracts</span>
              <span>&middot;</span>
              <span>215 community-controlled</span>
            </div>
          </div>
        </a>
      </section>

      {/* ===== FLAGSHIP: PROCUREMENT OLIGOPOLY ===== */}
      <section className="mb-6">
        <a href="/reports/procurement-oligopoly" className="group block">
          <div className="bg-white border-4 border-bauhaus-black p-8 transition-all group-hover:-translate-y-1" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-red)' }}>
            <div className="text-xs font-black text-bauhaus-red mb-2 uppercase tracking-widest">Procurement Investigation &mdash; NEW</div>
            <h3 className="text-2xl font-black text-bauhaus-black mb-3">The Procurement Oligopoly</h3>
            <p className="text-base text-bauhaus-muted leading-relaxed mb-4">
              100 entities (0.18% of all suppliers) receive 59% of all federal procurement dollars.
              Defence dominates, but the concentration extends across IT, construction, consulting, and services.
              Cross-referenced with political donations and lobbying registrations.
            </p>
            <div className="flex gap-6 text-bauhaus-muted/60 text-sm font-bold">
              <span>55,000+ unique suppliers</span>
              <span>&middot;</span>
              <span>$1.1T in contracts</span>
              <span>&middot;</span>
              <span>44 of top 100 also donate</span>
            </div>
          </div>
        </a>
      </section>

      {/* ===== FLAGSHIP: POWER CONCENTRATION ===== */}
      <section className="mb-6">
        <a href="/reports/power-concentration" className="group block">
          <div className="bg-bauhaus-black border-4 border-bauhaus-black p-8 transition-all group-hover:-translate-y-1" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-blue)' }}>
            <div className="text-xs font-black text-bauhaus-yellow mb-2 uppercase tracking-widest">Cross-System Investigation — NEW</div>
            <h3 className="text-2xl font-black text-white mb-3">Cross-System Power Concentration</h3>
            <p className="text-base text-white/80 leading-relaxed mb-4">
              82,967 entities scored across 7 public datasets. Who appears everywhere,
              who holds power across systems, who gets watched but never funded, and where
              the funding deserts are.
            </p>
            <div className="flex gap-6 text-white/60 text-sm font-bold">
              <span>7 datasets cross-referenced</span>
              <span>&middot;</span>
              <span>$918B tracked &rarr; 4,726 revolving door entities</span>
              <span>&middot;</span>
              <span>931 severe funding deserts</span>
            </div>
          </div>
        </a>
      </section>

      {/* ===== FLAGSHIP: TAX TRANSPARENCY ===== */}
      <section className="mb-6">
        <a href="/reports/tax-transparency" className="group block">
          <div className="bg-white border-4 border-bauhaus-black p-8 transition-all group-hover:-translate-y-1" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-red)' }}>
            <div className="text-xs font-black text-bauhaus-red mb-2 uppercase tracking-widest">Cross-Dataset Investigation &mdash; NEW</div>
            <h3 className="text-2xl font-black text-bauhaus-black mb-3">Tax Transparency: Contracts vs Tax</h3>
            <p className="text-base text-bauhaus-muted leading-relaxed mb-4">
              Who gets government contracts &mdash; and how much tax do they pay?
              ATO tax transparency data cross-referenced with 770K+ AusTender contracts by ABN.
              Billions in public money flowing to entities paying minimal tax.
            </p>
            <div className="flex gap-6 text-bauhaus-muted/60 text-sm font-bold">
              <span>26K+ ATO records</span>
              <span>&middot;</span>
              <span>770K+ contracts</span>
              <span>&middot;</span>
              <span>Matched by ABN</span>
            </div>
          </div>
        </a>
      </section>

      {/* ===== FLAGSHIP: TEMPORAL ANALYSIS ===== */}
      <section className="mb-6">
        <a href="/reports/timing" className="group block">
          <div className="bg-white border-4 border-bauhaus-black p-8 transition-all group-hover:-translate-y-1" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-blue)' }}>
            <div className="text-xs font-black text-bauhaus-red mb-2 uppercase tracking-widest">Temporal Analysis — NEW</div>
            <h3 className="text-2xl font-black text-bauhaus-black mb-3">Donate Today, Win Tomorrow.</h3>
            <p className="text-base text-bauhaus-muted leading-relaxed mb-4">
              Statistical correlation of political donation timing against government contract awards.
              189,937 temporal matches reveal how quickly donors become contractors &mdash;
              23,530 contracts awarded within 90 days of a donation.
            </p>
            <div className="flex gap-6 text-bauhaus-muted/60 text-sm font-bold">
              <span>189,937 temporal matches</span>
              <span>&middot;</span>
              <span>$180B in correlated contracts</span>
              <span>&middot;</span>
              <span>134 entities</span>
            </div>
          </div>
        </a>
      </section>

      {/* ===== FLAGSHIP: POLITICAL MONEY ===== */}
      <section className="mb-6">
        <a href="/reports/political-money" className="group block">
          <div className="bg-bauhaus-red border-4 border-bauhaus-black p-8 transition-all group-hover:-translate-y-1" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-black)' }}>
            <div className="text-xs font-black text-bauhaus-yellow mb-2 uppercase tracking-widest">Cross-Dataset Investigation — NEW</div>
            <h3 className="text-2xl font-black text-white mb-3">Political Money</h3>
            <p className="text-base text-white/80 leading-relaxed mb-4">
              Who funds Australian politics &mdash; and what do they get in return?
              312K donation records cross-referenced against 770K government contracts.
              $21.9B in tracked political donations. The donor-to-contractor pipeline, exposed.
            </p>
            <div className="flex gap-6 text-white/60 text-sm font-bold">
              <span>312K donation records</span>
              <span>&middot;</span>
              <span>35K unique donors</span>
              <span>&middot;</span>
              <span>27 years of disclosure data</span>
            </div>
          </div>
        </a>
      </section>

      {/* ===== FLAGSHIP: DONOR-CONTRACTORS ===== */}
      <section className="mb-12">
        <a href="/reports/donor-contractors" className="group block">
          <div className="bg-bauhaus-red border-4 border-bauhaus-black p-8 transition-all group-hover:-translate-y-1" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-black)' }}>
            <div className="text-xs font-black text-bauhaus-yellow mb-2 uppercase tracking-widest">Entity Graph Investigation</div>
            <h3 className="text-2xl font-black text-white mb-3">Donate. Win Contracts. Repeat.</h3>
            <p className="text-base text-white/80 leading-relaxed mb-4">
              446 entities donate to political parties AND hold government contracts.
              $358M donated. $35.3B received. AEC donation records cross-referenced
              with AusTender contracts across 138,000 entities by ABN.
            </p>
            <div className="flex gap-6 text-white/60 text-sm font-bold">
              <span>446 donor-contractors</span>
              <span>&middot;</span>
              <span>138,000 entities</span>
              <span>&middot;</span>
              <span>296,000+ relationships</span>
            </div>
          </div>
        </a>
      </section>

      {/* ===== SECTION A: THE PROBLEM ===== */}
      <section className="mb-12">
        <div className="mb-5">
          <h2 className="text-xl font-black text-bauhaus-black mb-1">The Problem</h2>
          <p className="text-sm text-bauhaus-muted font-medium">Investigations into how Australia&apos;s funding system works &mdash; and who it works for.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <a href="/reports/big-philanthropy" className="group block sm:col-span-2">
            <div className="bg-bauhaus-black border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-red)' }}>
              <div className="text-xs font-black text-bauhaus-yellow mb-2 uppercase tracking-widest">Data Investigation</div>
              <h3 className="text-xl font-black text-white mb-2">Where Does Australia&apos;s $222 Billion Go?</h3>
              <p className="text-sm text-bauhaus-muted leading-relaxed">
                An investigation into 359,678 charity financial records across 7 years, revealing
                the concentration of philanthropic power. 53,207 charities. ACNC AIS data 2017-2023.
              </p>
            </div>
          </a>

          <a href="/reports/community-parity" className="group block sm:col-span-2">
            <div className="bg-bauhaus-red border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm">
              <div className="text-xs font-black text-bauhaus-yellow mb-2 uppercase tracking-widest">New Investigation</div>
              <h3 className="text-xl font-black text-white mb-2">Big Philanthropy &amp; Community Parity</h3>
              <p className="text-sm text-white/80 leading-relaxed">
                0.5% to First Nations. 12% to women &amp; girls. 94% to the top 10%.
                How philanthropy concentrates power, who it leaves behind, and what the tax system enables.
              </p>
            </div>
          </a>

          <a href="/reports/power-dynamics" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-black group-hover:text-white">
              <div className="text-xs font-black text-purple mb-2 uppercase tracking-widest group-hover:text-bauhaus-yellow">Live</div>
              <h3 className="text-xl font-black text-bauhaus-black mb-2 group-hover:text-white">Power Dynamics</h3>
              <p className="text-sm text-bauhaus-muted leading-relaxed group-hover:text-white/80">
                Who controls Australia&apos;s philanthropy? HHI concentration,
                Gini inequality, and funding distribution analysis.
              </p>
            </div>
          </a>

          <a href="/reports/philanthropy-power" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-red group-hover:text-white">
              <div className="text-xs font-black text-bauhaus-red mb-2 uppercase tracking-widest group-hover:text-bauhaus-yellow">New</div>
              <h3 className="text-xl font-black text-bauhaus-black mb-2 group-hover:text-white">Philanthropy Gatekeepers</h3>
              <p className="text-sm text-bauhaus-muted leading-relaxed group-hover:text-white/80">
                Which foundations are actually approachable, which keep capital opaque, and where theme and geography discipline concentrate philanthropic power.
              </p>
            </div>
          </a>

          <a href="/reports/funding-equity" className="group block sm:col-span-2">
            <div className="bg-bauhaus-yellow border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-red)' }}>
              <div className="text-xs font-black text-bauhaus-black mb-2 uppercase tracking-widest">New Investigation</div>
              <h3 className="text-xl font-black text-bauhaus-black mb-2">Funding Equity: Who Gets What</h3>
              <p className="text-sm text-bauhaus-black/70 leading-relaxed">
                12.9% of charity income reaches the most disadvantaged postcodes.
                46% flows to the least disadvantaged. Political donations, government contracts,
                and SEIFA disadvantage data — connected for the first time.
              </p>
            </div>
          </a>

          <a href="/reports/access-gap" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-yellow">
              <div className="text-xs font-black text-bauhaus-yellow mb-2 uppercase tracking-widest group-hover:text-bauhaus-black">Live</div>
              <h3 className="text-xl font-black text-bauhaus-black mb-2">The Access Gap</h3>
              <p className="text-sm text-bauhaus-muted leading-relaxed group-hover:text-bauhaus-black/70">
                Small orgs spend 40% on admin. Large orgs spend 15%.
                The structural barriers to community funding.
              </p>
            </div>
          </a>

          <a href="/charities/insights" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-black group-hover:text-white">
              <div className="text-xs font-black text-money mb-2 uppercase tracking-widest group-hover:text-bauhaus-yellow">New</div>
              <h3 className="text-xl font-black text-bauhaus-black mb-2 group-hover:text-white">Charity Sector Insights</h3>
              <p className="text-sm text-bauhaus-muted leading-relaxed group-hover:text-white/80">
                The anatomy of {(64473).toLocaleString()} charities. Size pyramid, geography,
                purposes, beneficiaries, grant-makers, and 7-year financial trends.
              </p>
            </div>
          </a>

          <a href="/reports/money-flow" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-blue group-hover:text-white">
              <div className="text-xs font-black text-bauhaus-blue mb-2 uppercase tracking-widest group-hover:text-bauhaus-yellow">Live</div>
              <h3 className="text-xl font-black text-bauhaus-black mb-2 group-hover:text-white">Follow the Dollar</h3>
              <p className="text-sm text-bauhaus-muted leading-relaxed group-hover:text-white/80">
                Trace funding flows from taxpayer to outcome across all domains.
                Interactive flow diagrams for every tracked program.
              </p>
            </div>
          </a>
        </div>
      </section>

      {/* ===== SECTION B: CASE STUDIES ===== */}
      <section className="mb-12">
        <div className="mb-5">
          <h2 className="text-xl font-black text-bauhaus-black mb-1">Case Studies</h2>
          <p className="text-sm text-bauhaus-muted font-medium">Specific domain investigations where the data tells a story.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <a href="/reports/youth-justice" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-red group-hover:text-white">
              <div className="text-xs font-black text-bauhaus-red mb-2 uppercase tracking-widest group-hover:text-bauhaus-yellow">Flagship</div>
              <h3 className="text-xl font-black text-bauhaus-black mb-2 group-hover:text-white">Youth Justice: 5 Cities</h3>
              <p className="text-sm text-bauhaus-muted leading-relaxed group-hover:text-white/80">
                $9.2B on youth justice across QLD, NSW, NT, SA, WA. Detention gets 2x community budgets.
                Cross-system scan linking school disadvantage, spending, and what works.
              </p>
            </div>
          </a>

          <a href="/reports/ndis-market" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-blue group-hover:text-white">
              <div className="text-xs font-black text-bauhaus-blue mb-2 uppercase tracking-widest group-hover:text-bauhaus-yellow">New</div>
              <h3 className="text-xl font-black text-bauhaus-black mb-2 group-hover:text-white">NDIS Market Power</h3>
              <p className="text-sm text-bauhaus-muted leading-relaxed group-hover:text-white/80">
                10,335 active providers. Thin regional supply. Heavy payment concentration in remote Core markets.
                See where disability service provision is fragile and where a few providers capture the flow.
              </p>
            </div>
          </a>

          <a href="/reports/child-protection" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-red group-hover:text-white">
              <div className="text-xs font-black text-bauhaus-red mb-2 uppercase tracking-widest group-hover:text-bauhaus-yellow">New</div>
              <h3 className="text-xl font-black text-bauhaus-black mb-2 group-hover:text-white">Child Protection</h3>
              <p className="text-sm text-bauhaus-muted leading-relaxed group-hover:text-white/80">
                $4.1B+ in child protection, out-of-home care, and child safety funding mapped.
                Cross-referenced with youth justice, NDIS, and education — the pipeline made visible.
              </p>
            </div>
          </a>
        </div>
      </section>

      {/* ===== SECTION C: THE ALTERNATIVE ===== */}
      <section className="mb-12">
        <div className="mb-5">
          <h2 className="text-xl font-black text-bauhaus-black mb-1">The Alternative</h2>
          <p className="text-sm text-bauhaus-muted font-medium">What community-led economic power looks like &mdash; and what&apos;s already working.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <a href="/reports/community-power" className="group block sm:col-span-2">
            <div className="bg-bauhaus-blue border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-yellow)' }}>
              <div className="text-xs font-black text-bauhaus-yellow mb-2 uppercase tracking-widest">New Report</div>
              <h3 className="text-xl font-black text-white mb-2">Community Power Playbook</h3>
              <p className="text-sm text-white/80 leading-relaxed">
                Cooperatives, revolving funds, social enterprise, timebanking, and the models that
                are already building community economic sovereignty across Australia.
                1,819 co-ops. 20,000 social enterprises. $21.3B in revenue.
              </p>
            </div>
          </a>

          <a href="/reports/social-enterprise" className="group block sm:col-span-2">
            <div className="bg-white border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-red group-hover:text-white">
              <div className="text-xs font-black text-bauhaus-red mb-2 uppercase tracking-widest group-hover:text-bauhaus-yellow">New Report</div>
              <h3 className="text-xl font-black text-bauhaus-black mb-2 group-hover:text-white">Social Enterprise in Australia</h3>
              <p className="text-sm text-bauhaus-muted leading-relaxed group-hover:text-white/80">
                20,000 businesses trading for purpose. $21 billion in revenue. 300,000 jobs.
                No legal structure. No central register. The landscape, the gaps, and why CivicGraph
                is building the directory that doesn&apos;t exist.
              </p>
            </div>
          </a>
        </div>
      </section>

      <ReportCTA
        reportSlug="reports-index"
        reportTitle="CivicGraph Intelligence Reports"
        pdfDescription="Get our latest research as formatted PDFs — ready for board papers, grant applications, or policy briefs."
      />

      {/* ===== SECTION D: INFRASTRUCTURE ===== */}
      <section className="mb-12">
        <div className="mb-5">
          <h2 className="text-xl font-black text-bauhaus-black mb-1">Infrastructure</h2>
          <p className="text-sm text-bauhaus-muted font-medium">How the data platform works and how we measure quality.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <a href="/reports/data-quality" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-black group-hover:text-white">
              <div className="text-xs font-black text-green-600 mb-2 uppercase tracking-widest group-hover:text-bauhaus-yellow">Live</div>
              <h3 className="text-xl font-black text-bauhaus-black mb-2 group-hover:text-white">Data Quality Scorecard</h3>
              <p className="text-sm text-bauhaus-muted leading-relaxed group-hover:text-white/80">
                Live completeness metrics and cross-reference linkage rates across
                all datasets. Real-time transparency on what we know and what&apos;s missing.
              </p>
            </div>
          </a>

          <a href="/reports/power-map" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-blue group-hover:text-white">
              <div className="text-xs font-black text-bauhaus-blue mb-2 uppercase tracking-widest group-hover:text-bauhaus-yellow">Deep Research</div>
              <h3 className="text-xl font-black text-bauhaus-black mb-2 group-hover:text-white">Australia&apos;s Power Map</h3>
              <p className="text-sm text-bauhaus-muted leading-relaxed group-hover:text-white/80">
                How open data can reshape who holds power. The concentration of economic
                and political influence, and the case for radical transparency.
              </p>
            </div>
          </a>
        </div>
      </section>
    </div>
  );
}
