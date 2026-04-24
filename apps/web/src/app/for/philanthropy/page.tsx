import { getServiceSupabase } from '@/lib/supabase';
import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'For Philanthropy | CivicGraph Australia',
  description: 'CivicGraph maps how money flows through society — grants, contracts, donations, and procurement. Three layers of market intelligence for fairer allocation.',
};

async function getStats() {
  const supabase = getServiceSupabase();

  const [
    foundationsResult,
    enrichedResult,
    grantsResult,
    charitiesResult,
    programsResult,
    givingResult,
    acncResult,
  ] = await Promise.all([
    supabase.from('foundations').select('*', { count: 'exact', head: true }),
    supabase.from('foundations').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
    supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }),
    supabase.from('v_charity_explorer').select('*', { count: 'exact', head: true }),
    supabase.from('foundation_programs').select('*', { count: 'exact', head: true }).in('status', ['open', 'closed']),
    supabase.from('foundations').select('total_giving_annual').not('total_giving_annual', 'is', null),
    supabase.from('acnc_ais').select('*', { count: 'exact', head: true }),
  ]);

  const totalGiving = givingResult.data?.reduce((sum: number, r: { total_giving_annual: number }) => sum + (r.total_giving_annual || 0), 0) || 0;

  return {
    foundations: foundationsResult.count || 0,
    enriched: enrichedResult.count || 0,
    grants: grantsResult.count || 0,
    charities: charitiesResult.count || 0,
    programs: programsResult.count || 0,
    totalGiving,
    acncRecords: acncResult.count || 0,
  };
}

function Stat({ value, label, sub, color }: { value: string; label: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
      <div className={`text-3xl sm:text-4xl font-black tabular-nums ${color || 'text-bauhaus-black'}`}>{value}</div>
      <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mt-1">{label}</div>
      {sub && <div className="text-xs text-bauhaus-muted mt-2">{sub}</div>}
    </div>
  );
}

function ReportCard({ href, number, title, subtitle, color }: {
  href: string; number: string; title: string; subtitle: string; color: string;
}) {
  return (
    <Link
      href={href}
      className={`block border-4 border-bauhaus-black p-6 bg-white bauhaus-shadow-sm transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none group`}
    >
      <span className={`text-xs font-black uppercase tracking-widest ${color}`}>{number}</span>
      <h3 className="text-lg font-black mt-2 group-hover:text-bauhaus-red transition-colors">{title}</h3>
      <p className="text-sm text-bauhaus-muted mt-1">{subtitle}</p>
    </Link>
  );
}

export default async function ForPhilanthropyPage() {
  let stats = { foundations: 0, enriched: 0, grants: 0, charities: 0, programs: 0, totalGiving: 0, acncRecords: 0 };
  try {
    stats = await getStats();
  } catch (e) {
    console.error('Failed to load philanthropy stats:', e);
  }

  const fmtNum = (n: number) => n.toLocaleString('en-AU');
  const fmtMoney = (n: number) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
    return `$${fmtNum(n)}`;
  };

  return (
    <div className="min-h-screen bg-bauhaus-canvas">

      {/* ===== ACT 1: THE OPENING TRUTH ===== */}
      <section className="bg-bauhaus-black text-white min-h-[85vh] flex items-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 border-[40px] border-white rounded-full" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-white" />
          <div className="absolute top-1/2 right-1/3 w-0 h-0 border-l-[120px] border-l-transparent border-r-[120px] border-r-transparent border-b-[200px] border-b-white" />
        </div>
        <div className="max-w-5xl mx-auto px-6 relative z-10">
          <p className="text-xs text-white/30 uppercase tracking-[0.4em] font-black mb-8">
            A living investigation into Australia&apos;s philanthropic system
          </p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.95] mb-8">
            <span className="text-bauhaus-yellow">{fmtNum(stats.acncRecords)}</span>
            {' '}FINANCIAL RECORDS.
            <br />
            <span className="text-bauhaus-red">{fmtNum(stats.foundations)}</span>
            {' '}FOUNDATIONS.
            <br />
            <span className="text-bauhaus-blue">ONE QUESTION.</span>
          </h1>
          <p className="text-2xl md:text-3xl text-white/60 font-medium max-w-3xl">
            Where does the money go?
          </p>
          <div className="mt-16 flex flex-col sm:flex-row gap-4">
            <Link
              href="#the-data"
              className="inline-block py-4 px-8 font-black text-sm uppercase tracking-widest border-4 border-bauhaus-yellow bg-bauhaus-yellow text-bauhaus-black bauhaus-shadow-sm transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
            >
              See the Data
            </Link>
            <Link
              href="/reports/big-philanthropy"
              className="inline-block py-4 px-8 font-black text-sm uppercase tracking-widest border-4 border-white/30 text-white transition-all hover:bg-white hover:text-bauhaus-black"
            >
              Read the Full Investigation
            </Link>
          </div>
        </div>
      </section>

      {/* ===== ACT 2: THE NUMBERS ===== */}
      <section id="the-data" className="py-20 px-6 bg-white border-b-4 border-bauhaus-black scroll-mt-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-3">The System At A Glance</p>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4">
            AUSTRALIA&apos;S $222 BILLION CHARITY SECTOR
          </h2>
          <p className="text-bauhaus-muted max-w-2xl mb-12">
            We imported every ACNC filing from 2017 to 2023. Cross-referenced with ATO data,
            corporate filings, and public grant disclosures. Here&apos;s what we found.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            <Stat value="$222B" label="Sector Revenue" sub="More than New Zealand's GDP" color="text-bauhaus-blue" />
            <Stat value="$494B" label="Assets Held" sub="In foundations & endowments" />
            <Stat value="90.3%" label="To Top 10%" sub="Of all charitable revenue" color="text-bauhaus-red" />
            <Stat value="$11.3B" label="Grants Distributed" sub="2.3% of total revenue" color="text-money" />
          </div>

          <div className="border-4 border-bauhaus-black bg-bauhaus-yellow p-8 bauhaus-shadow-sm mb-8">
            <p className="text-lg font-bold">
              The charity sector holds almost half a trillion dollars in assets.
              Only 2.3% of annual revenue flows out as grants. The rest goes to salaries,
              operations, and growing the endowment. The question isn&apos;t whether philanthropy
              is generous — it&apos;s whether the system is working.
            </p>
          </div>

          <div className="text-center">
            <Link
              href="/reports/big-philanthropy"
              className="inline-block py-3 px-6 font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black bg-white bauhaus-shadow-sm transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
            >
              Read: Where Does Australia&apos;s $222 Billion Go? →
            </Link>
          </div>
        </div>
      </section>

      {/* ===== ACT 3: THE CONCENTRATION CRISIS ===== */}
      <section className="py-20 px-6 bg-bauhaus-black text-white">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs text-white/30 uppercase tracking-[0.3em] font-black mb-3">The Concentration Crisis</p>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-12">
            94% OF DONATIONS GO TO<br />
            <span className="text-bauhaus-red">10% OF ORGANISATIONS.</span>
          </h2>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="border-4 border-white/20 p-6">
              <p className="text-4xl font-black text-bauhaus-yellow">0.5%</p>
              <p className="text-sm font-bold mt-2">To First Nations</p>
              <p className="text-xs text-white/50 mt-2">
                Despite being 3.8% of the population. For every $1 spent on
                non-Indigenous Australians, First Nations communities get 13 cents.
              </p>
            </div>
            <div className="border-4 border-white/20 p-6">
              <p className="text-4xl font-black text-bauhaus-red">12%</p>
              <p className="text-sm font-bold mt-2">To Women & Girls</p>
              <p className="text-xs text-white/50 mt-2">
                Half the population. 12% of philanthropic funding.
                The numbers speak for themselves.
              </p>
            </div>
            <div className="border-4 border-white/20 p-6">
              <p className="text-4xl font-black text-white">-$144M</p>
              <p className="text-sm font-bold mt-2">Smallest 16,000 Charities</p>
              <p className="text-xs text-white/50 mt-2">
                The grassroots organisations closest to community collectively
                lost $144 million last year. They subsidise the sector with unpaid labour.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <div className="border-4 border-white/20 p-6">
              <p className="text-4xl font-black text-bauhaus-yellow">$2.5B</p>
              <p className="text-sm font-bold mt-2">Annual Tax Subsidy</p>
              <p className="text-xs text-white/50 mt-2">
                Taxpayer money through DGR deductions. 82% of this public subsidy
                flows to the top 10% of organisations.
              </p>
            </div>
            <div className="border-4 border-white/20 p-6">
              <p className="text-4xl font-black text-bauhaus-red">89%</p>
              <p className="text-sm font-bold mt-2">Pay Executives More Than They Grant</p>
              <p className="text-xs text-white/50 mt-2">
                89% of foundations pay their executives more than they distribute
                in grants. The data is public. We just made it visible.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/reports/power-dynamics"
              className="inline-block py-3 px-6 font-black text-xs uppercase tracking-widest border-4 border-white bg-white text-bauhaus-black bauhaus-shadow-sm transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
            >
              Read: Power Dynamics Report →
            </Link>
            <Link
              href="/reports/community-parity"
              className="inline-block py-3 px-6 font-black text-xs uppercase tracking-widest border-4 border-white/30 text-white transition-all hover:bg-white hover:text-bauhaus-black"
            >
              Read: Community Parity Report →
            </Link>
          </div>
        </div>
      </section>

      {/* ===== ACT 4: THE MONEY TRAIL ===== */}
      <section className="py-20 px-6 bg-white border-b-4 border-bauhaus-black">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-3">Follow The Money</p>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4">
            FROM EXTRACTION TO COMMUNITY
          </h2>
          <p className="text-bauhaus-muted max-w-2xl mb-12">
            For the first time in Australia, you can trace funding from its origin —
            through foundations and grant programs — to the communities it reaches.
            Or doesn&apos;t reach.
          </p>

          <div className="flex flex-col gap-0 mb-8">
            {[
              { label: 'SOURCE', desc: 'Mining royalties, property wealth, family trusts, corporate profits, investment returns', color: 'bg-bauhaus-black text-white', stat: '$1.1B from ethically contested sources' },
              { label: 'FOUNDATION', desc: 'Private foundations, corporate giving programs, community trusts, PAFs & PuAFs', color: 'bg-bauhaus-yellow', stat: `${fmtNum(stats.foundations)} foundations profiled` },
              { label: 'PROGRAMS', desc: 'Grant rounds, scholarships, sponsorships, partnerships, impact investments', color: 'bg-bauhaus-blue text-white', stat: `${fmtNum(stats.programs)} programs mapped` },
              { label: 'GRANTS', desc: 'Individual grants with amounts, eligibility, timelines, and outcomes', color: 'bg-money text-white', stat: `${fmtNum(stats.grants)} opportunities indexed` },
              { label: 'COMMUNITY', desc: 'The organisations and people doing the work on the ground', color: 'bg-bauhaus-red text-white', stat: `${fmtNum(stats.charities)} community orgs` },
            ].map((step, i) => (
              <div key={step.label}>
                <div className={`${step.color} p-6 border-4 border-bauhaus-black`}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest mb-1">{step.label}</p>
                      <p className="text-sm opacity-80">{step.desc}</p>
                    </div>
                    <p className="text-xs font-black uppercase tracking-widest opacity-60 whitespace-nowrap">{step.stat}</p>
                  </div>
                </div>
                {i < 4 && (
                  <div className="flex justify-center py-1">
                    <span className="text-lg font-black text-bauhaus-muted">↓</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link
              href="/reports/money-flow"
              className="inline-block py-3 px-6 font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black bg-white bauhaus-shadow-sm transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
            >
              Read: Money Flow Report →
            </Link>
          </div>
        </div>
      </section>

      {/* ===== ACT 5: WHAT THIS MEANS FOR YOU ===== */}
      <section className="py-20 px-6 bg-bauhaus-canvas">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-3 text-center">What This Means For You</p>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-center mb-4">
            WHETHER YOU GIVE OR RECEIVE,
            <br />THE SYSTEM AFFECTS YOU.
          </h2>
          <p className="text-bauhaus-muted max-w-2xl mx-auto text-center mb-16">
            CivicGraph isn&apos;t a search engine. It&apos;s infrastructure for fairer markets —
            three layers connecting money, entities, and community evidence. Here&apos;s what it changes.
          </p>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* For Foundations */}
            <div className="border-4 border-bauhaus-black bg-white p-8 bauhaus-shadow">
              <h3 className="text-xl font-black mb-6 text-bauhaus-yellow bg-bauhaus-black p-3 -mx-8 -mt-8 border-b-4 border-bauhaus-black">
                <span className="px-5">IF YOU&apos;RE A FOUNDATION</span>
              </h3>
              <ul className="space-y-4 text-sm">
                <li>
                  <strong className="text-bauhaus-black">See your scorecard.</strong>
                  <span className="text-bauhaus-muted"> Giving ratio, executive pay benchmarks, geographic reach, thematic coverage. How do you compare to your peers?</span>
                </li>
                <li>
                  <strong className="text-bauhaus-black">Find who you&apos;re missing.</strong>
                  <span className="text-bauhaus-muted"> The best community organisations don&apos;t have grant writers. They have Elders, practitioners, and youth workers too busy doing the work to fill in your 47-page form. Search by impact, not prose.</span>
                </li>
                <li>
                  <strong className="text-bauhaus-black">See the whole system.</strong>
                  <span className="text-bauhaus-muted"> Where does your funding overlap with other foundations? Which communities are invisible? Where is nobody giving at all?</span>
                </li>
                <li>
                  <strong className="text-bauhaus-black">Build your brand through transparency.</strong>
                  <span className="text-bauhaus-muted"> In a world where every ACNC filing is public, your reputation is what the data says. Be on the right side of it.</span>
                </li>
              </ul>
              <div className="mt-6 flex gap-3">
                <Link href="/for/foundations" className="text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:text-bauhaus-red border-b-2 border-bauhaus-blue/30 hover:border-bauhaus-red transition-colors">
                  Foundations →
                </Link>
                <Link href="/foundations" className="text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:text-bauhaus-red border-b-2 border-bauhaus-blue/30 hover:border-bauhaus-red transition-colors">
                  Browse {fmtNum(stats.foundations)} Foundations →
                </Link>
              </div>
            </div>

            {/* For Corporate */}
            <div className="border-4 border-bauhaus-black bg-white p-8 bauhaus-shadow">
              <h3 className="text-xl font-black mb-6 text-white bg-bauhaus-blue p-3 -mx-8 -mt-8 border-b-4 border-bauhaus-black">
                <span className="px-5">IF YOU&apos;RE A CORPORATE</span>
              </h3>
              <ul className="space-y-4 text-sm">
                <li>
                  <strong className="text-bauhaus-black">Your CSR is visible.</strong>
                  <span className="text-bauhaus-muted"> We track ASX200 corporate giving — what you fund, where, how much. Stakeholders, journalists, and communities can see the full picture.</span>
                </li>
                <li>
                  <strong className="text-bauhaus-black">Discover aligned partners.</strong>
                  <span className="text-bauhaus-muted"> Stop fielding random grant applications. Search {fmtNum(stats.charities)}+ charities by mission alignment, geography, and proven track record.</span>
                </li>
                <li>
                  <strong className="text-bauhaus-black">Move from transactional to relational.</strong>
                  <span className="text-bauhaus-muted"> The grant application process is adversarial by design. CivicGraph enables mutual discovery — find each other based on real alignment, build partnerships over time.</span>
                </li>
                <li>
                  <strong className="text-bauhaus-black">Prove real impact.</strong>
                  <span className="text-bauhaus-muted"> Portfolio analytics show where your dollars land — geography, community served, outcomes achieved. Not a CSR report. Real data.</span>
                </li>
              </ul>
              <div className="mt-6">
                <Link href="/corporate" className="text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:text-bauhaus-red border-b-2 border-bauhaus-blue/30 hover:border-bauhaus-red transition-colors">
                  Corporate Giving →
                </Link>
              </div>
            </div>

            {/* For Community */}
            <div className="border-4 border-bauhaus-black bg-white p-8 bauhaus-shadow">
              <h3 className="text-xl font-black mb-6 text-white bg-money p-3 -mx-8 -mt-8 border-b-4 border-bauhaus-black">
                <span className="px-5">IF YOU&apos;RE A COMMUNITY ORG</span>
              </h3>
              <ul className="space-y-4 text-sm">
                <li>
                  <strong className="text-bauhaus-black">Find every grant you&apos;re eligible for.</strong>
                  <span className="text-bauhaus-muted"> AI scores {fmtNum(stats.grants)}+ grants against your mission statement. Stop searching. Start matching.</span>
                </li>
                <li>
                  <strong className="text-bauhaus-black">Write better applications, faster.</strong>
                  <span className="text-bauhaus-muted"> AI drafts in your voice, tailored to the funder&apos;s language. Not a template. A real draft that sounds like your community.</span>
                </li>
                <li>
                  <strong className="text-bauhaus-black">Track every relationship.</strong>
                  <span className="text-bauhaus-muted"> Every conversation, every application, every outcome with each foundation. Build trust over years, not rounds.</span>
                </li>
                <li>
                  <strong className="text-bauhaus-black">Use it free. Forever.</strong>
                  <span className="text-bauhaus-muted"> Community orgs under $500K revenue pay nothing. Funded by foundations and corporates who believe in equitable access.</span>
                </li>
              </ul>
              <div className="mt-6 flex gap-3">
                <Link href="/for/community" className="text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:text-bauhaus-red border-b-2 border-bauhaus-blue/30 hover:border-bauhaus-red transition-colors">
                  Community Orgs →
                </Link>
                <Link href="/grants" className="text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:text-bauhaus-red border-b-2 border-bauhaus-blue/30 hover:border-bauhaus-red transition-colors">
                  Search {fmtNum(stats.grants)} Grants →
                </Link>
              </div>
            </div>

            {/* For Government & Researchers */}
            <div className="border-4 border-bauhaus-black bg-white p-8 bauhaus-shadow">
              <h3 className="text-xl font-black mb-6 text-bauhaus-black bg-bauhaus-canvas p-3 -mx-8 -mt-8 border-b-4 border-bauhaus-black">
                <span className="px-5">IF YOU&apos;RE IN GOVERNMENT OR RESEARCH</span>
              </h3>
              <ul className="space-y-4 text-sm">
                <li>
                  <strong className="text-bauhaus-black">System-level visibility.</strong>
                  <span className="text-bauhaus-muted"> Where is philanthropic money flowing? Where are the gaps? What&apos;s the overlap between public and private funding? Data that doesn&apos;t exist anywhere else.</span>
                </li>
                <li>
                  <strong className="text-bauhaus-black">Living reports, not static PDFs.</strong>
                  <span className="text-bauhaus-muted"> Our data investigations update as new filings come in. Power dynamics, community parity, money flow — always current.</span>
                </li>
                <li>
                  <strong className="text-bauhaus-black">Open data infrastructure.</strong>
                  <span className="text-bauhaus-muted"> API access to {fmtNum(stats.acncRecords)} financial records, {fmtNum(stats.foundations)} foundation profiles, and {fmtNum(stats.grants)} grant opportunities.</span>
                </li>
                <li>
                  <strong className="text-bauhaus-black">Inform policy with evidence.</strong>
                  <span className="text-bauhaus-muted"> DGR reform, giving incentives, sector regulation — every policy question can be answered with real data.</span>
                </li>
              </ul>
              <div className="mt-6 flex gap-3">
                <Link href="/for/government" className="text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:text-bauhaus-red border-b-2 border-bauhaus-blue/30 hover:border-bauhaus-red transition-colors">
                  Government →
                </Link>
                <Link href="/for/researchers" className="text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:text-bauhaus-red border-b-2 border-bauhaus-blue/30 hover:border-bauhaus-red transition-colors">
                  Researchers →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== ACT 6: THE INVESTIGATIONS ===== */}
      <section className="py-20 px-6 bg-bauhaus-black text-white">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs text-white/30 uppercase tracking-[0.3em] font-black mb-3 text-center">Living Data Investigations</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center mb-4">
            THE REPORTS
          </h2>
          <p className="text-center text-white/50 mb-12 max-w-2xl mx-auto">
            Not static PDFs. Living investigations powered by {fmtNum(stats.acncRecords)} financial records
            that update as new data comes in. Click through to explore the full analysis.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ReportCard
              href="/reports/big-philanthropy"
              number="01"
              title="Where Does $222 Billion Go?"
              subtitle="359,678 charity records. 7 years. The full picture of Australia's charity sector."
              color="text-bauhaus-blue"
            />
            <ReportCard
              href="/reports/power-dynamics"
              number="02"
              title="Power Dynamics"
              subtitle="Concentration, inequality, and the Gini coefficient of Australian philanthropy."
              color="text-bauhaus-red"
            />
            <ReportCard
              href="/reports/community-parity"
              number="03"
              title="Community Parity"
              subtitle="Who benefits, who misses out, and the communities invisible to funders."
              color="text-bauhaus-yellow"
            />
            <ReportCard
              href="/reports/community-power"
              number="04"
              title="Community Power"
              subtitle="Alternatives to grant dependency. What happens when communities control the money."
              color="text-money"
            />
            <ReportCard
              href="/reports/money-flow"
              number="05"
              title="Money Flow"
              subtitle="Trace funding from mining, finance, and property through foundations to community."
              color="text-bauhaus-blue"
            />
            <ReportCard
              href="/reports/access-gap"
              number="06"
              title="Access Gap"
              subtitle="The tools gap between large and small organisations. Who can afford to fundraise."
              color="text-bauhaus-red"
            />
          </div>
        </div>
      </section>

      {/* ===== ACT 7: THE PLATFORM ===== */}
      <section className="py-20 px-6 bg-white border-b-4 border-bauhaus-black">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-3 text-center">The Platform</p>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-center mb-4">
            EXPLORE THE DATA YOURSELF
          </h2>
          <p className="text-bauhaus-muted text-center max-w-2xl mx-auto mb-12">
            Every number on this page links to live data. Search foundations, browse grants,
            explore charity finances, run simulations. It&apos;s all open.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { href: '/foundations', title: 'FOUNDATIONS', desc: `Search ${fmtNum(stats.foundations)} foundations by giving area, size, and geography. AI-enriched profiles with giving ratios and scorecards.`, stat: `${fmtNum(stats.enriched)} AI-enriched` },
              { href: '/grants', title: 'GRANTS', desc: `${fmtNum(stats.grants)} grant opportunities from state, federal, and private funders. 100% AI-embedded for semantic search.`, stat: 'AI match scoring' },
              { href: '/charities', title: 'CHARITIES', desc: `${fmtNum(stats.charities)}+ community organisations with ACNC financial data, mission profiles, and geographic coverage.`, stat: '7 years of data' },
              { href: '/corporate', title: 'CORPORATE', desc: 'ASX200 corporate giving mapped. Who gives, how much, where it goes, and what it means.', stat: 'Full transparency' },
              { href: '/dashboard', title: 'DASHBOARD', desc: 'System-level metrics. Sector revenue, concentration indices, giving ratios, and trends over time.', stat: 'Updated daily' },
              { href: '/simulator', title: 'SIMULATOR', desc: 'Model funding scenarios. What happens if giving ratios increase? If concentration decreases? Play with the numbers.', stat: 'Interactive' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="border-4 border-bauhaus-black bg-bauhaus-canvas p-6 transition-all hover:bg-bauhaus-black hover:text-white group bauhaus-shadow-sm hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
              >
                <p className="text-xs font-black uppercase tracking-widest text-bauhaus-muted group-hover:text-white/50 mb-1">{item.stat}</p>
                <h3 className="text-lg font-black mb-2">{item.title}</h3>
                <p className="text-sm text-bauhaus-muted group-hover:text-white/70">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ACT 8: CROSS-SUBSIDY ===== */}
      <section className="py-20 px-6 bg-bauhaus-canvas">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
            THE MODEL
          </h2>
          <p className="text-bauhaus-muted max-w-2xl mx-auto mb-12">
            The organisations doing the hardest work in the hardest places shouldn&apos;t also
            have to pay for the tools to find funding. So we built a different model.
          </p>

          <div className="border-4 border-bauhaus-black bg-white p-10 bauhaus-shadow max-w-3xl mx-auto mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center mb-8">
              <div>
                <p className="text-5xl font-black text-bauhaus-blue">$499</p>
                <p className="text-xs text-bauhaus-muted uppercase tracking-widest mt-2">Funder pays /month</p>
              </div>
              <div className="flex items-center justify-center">
                <div className="text-3xl font-black text-bauhaus-muted">=</div>
              </div>
              <div>
                <p className="text-5xl font-black text-money">$0</p>
                <p className="text-xs text-bauhaus-muted uppercase tracking-widest mt-2">Community uses free</p>
              </div>
            </div>
            <p className="text-sm text-bauhaus-muted max-w-xl mx-auto">
              Foundations and corporates already have the budgets. And they get a better
              product because more community orgs on the platform means better data, better discovery,
              and better outcomes for everyone.
            </p>
          </div>

          <div className="grid sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { name: 'Community', price: 'Free', desc: 'Grassroots NFPs, First Nations orgs' },
              { name: 'Professional', price: '$49/mo', desc: 'Established NFPs, social enterprises' },
              { name: 'Organisation', price: '$199/mo', desc: 'Peak bodies, multi-program orgs' },
              { name: 'Funder', price: '$499/mo', desc: 'Foundations, corporate, government' },
            ].map((t) => (
              <div key={t.name} className="border-4 border-bauhaus-black bg-white p-4 text-left">
                <p className="text-xs font-black uppercase tracking-widest">{t.name}</p>
                <p className="text-2xl font-black mt-1">{t.price}</p>
                <p className="text-xs text-bauhaus-muted mt-1">{t.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <Link
              href="/pricing"
              className="inline-block py-3 px-6 font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black bg-white bauhaus-shadow-sm transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
            >
              Full Pricing & Features →
            </Link>
          </div>
        </div>
      </section>

      {/* ===== ACT 9: THE BIG WHY ===== */}
      <section className="py-24 px-6 bg-bauhaus-black text-white">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs text-white/30 uppercase tracking-[0.3em] font-black mb-8">The Big Why</p>
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tight mb-8 leading-[0.95]">
            AUSTRALIA HAS NO
            <br /><span className="text-bauhaus-yellow">360GIVING.</span>
          </h2>
          <p className="text-lg text-white/50 mb-6">
            The UK has <a href="https://www.threesixtygiving.org" target="_blank" rel="noopener noreferrer" className="text-bauhaus-yellow hover:text-white border-b border-bauhaus-yellow/30 hover:border-white transition-colors">360Giving</a> — open data on every grant.
            The US has <a href="https://candid.org" target="_blank" rel="noopener noreferrer" className="text-bauhaus-yellow hover:text-white border-b border-bauhaus-yellow/30 hover:border-white transition-colors">Candid</a>.
            Australia has nothing.
          </p>
          <p className="text-lg text-white/50 mb-6">
            We didn&apos;t wait for government to build it. We didn&apos;t wait for the
            sector to agree on a standard. We built it with the data that already exists —
            public filings that nobody had bothered to aggregate, analyse, and make accessible.
          </p>
          <p className="text-xl text-white/80 font-bold mt-8 mb-4">
            This isn&apos;t a grant search engine.
          </p>
          <p className="text-2xl md:text-3xl text-bauhaus-yellow font-black">
            It&apos;s infrastructure for fairer markets.
          </p>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="py-20 px-6 bg-bauhaus-red text-white text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-6 leading-[0.95]">
            THE SYSTEM CHANGES
            <br />WHEN EVERYONE CAN SEE IT.
          </h2>
          <p className="text-white/70 text-lg mb-10">
            Whether you give or receive, the data is yours.
            Join the platform that makes the invisible visible.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-block py-4 px-10 font-black text-sm uppercase tracking-widest border-4 border-white bg-white text-bauhaus-red bauhaus-shadow-sm transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
            >
              Get Started Free
            </Link>
            <a
              href="mailto:hello@civicgraph.au?subject=Partnership%20enquiry"
              className="inline-block py-4 px-10 font-black text-sm uppercase tracking-widest border-4 border-white text-white transition-all hover:bg-white hover:text-bauhaus-red"
            >
              Partner With Us
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
