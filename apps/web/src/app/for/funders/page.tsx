import { getServiceSupabase } from '@/lib/supabase';
import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'What You Get | GrantScope Funder Tier',
  description: 'Everything included in your GrantScope Funder subscription — portfolio intelligence, discovery tools, benchmarking, brand visibility, and direct access to aligned organisations.',
};

async function getStats() {
  const supabase = getServiceSupabase();
  const [charities, foundations, grants, enriched, acnc] = await Promise.all([
    supabase.from('v_charity_explorer').select('*', { count: 'exact', head: true }),
    supabase.from('foundations').select('*', { count: 'exact', head: true }),
    supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }),
    supabase.from('foundations').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
    supabase.from('acnc_ais').select('*', { count: 'exact', head: true }),
  ]);
  return {
    charities: charities.count || 0,
    foundations: foundations.count || 0,
    grants: grants.count || 0,
    enriched: enriched.count || 0,
    acnc: acnc.count || 0,
  };
}

export default async function ForFundersPage() {
  let stats = { charities: 0, foundations: 0, grants: 0, enriched: 0, acnc: 0 };
  try { stats = await getStats(); } catch {}
  const fmt = (n: number) => n.toLocaleString('en-AU');

  return (
    <div className="min-h-screen bg-bauhaus-canvas">

      {/* ===== HERO ===== */}
      <section className="bg-bauhaus-black text-white min-h-[85vh] flex items-center relative overflow-hidden">
        {/* Bauhaus geometric bg */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute top-20 right-20 w-80 h-80 bg-bauhaus-yellow" />
          <div className="absolute bottom-20 left-40 w-60 h-60 border-[30px] border-white rounded-full" />
        </div>
        <div className="max-w-5xl mx-auto px-6 relative z-10">
          <p className="text-xs text-bauhaus-yellow uppercase tracking-[0.4em] font-black mb-8">
            Funder Tier — $499/month
          </p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.95] mb-8">
            BE THE FIRST
            <br />TO SEE THE
            <br /><span className="text-bauhaus-yellow">WHOLE SYSTEM.</span>
          </h1>
          <p className="text-xl md:text-2xl text-white/50 font-medium max-w-2xl mb-6">
            Nothing like this exists in Australia. You&apos;re not joining a platform —
            you&apos;re shaping how philanthropy works in this country.
          </p>
          <p className="text-sm text-white/30 max-w-xl">
            First-mover funders get founding partner status, direct input on features,
            and a front-row seat as the sector&apos;s first transparency infrastructure launches.
          </p>
          <div className="mt-12 flex flex-col sm:flex-row gap-4">
            <a
              href="mailto:hello@grantscope.au?subject=Founding%20Funder%20%E2%80%94%20interested"
              className="inline-block py-4 px-8 font-black text-sm uppercase tracking-widest border-4 border-bauhaus-yellow bg-bauhaus-yellow text-bauhaus-black bauhaus-shadow-sm transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
            >
              Become a Founding Funder
            </a>
            <Link
              href="#what-you-get"
              className="inline-block py-4 px-8 font-black text-sm uppercase tracking-widest border-4 border-white/30 text-white transition-all hover:bg-white hover:text-bauhaus-black"
            >
              See What You Get
            </Link>
          </div>
        </div>
      </section>

      {/* ===== WHY NOW ===== */}
      <section className="py-20 px-6 bg-bauhaus-yellow border-b-4 border-bauhaus-black">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-8">
            WHY FIRST MOVERS WIN
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <p className="text-sm font-medium mb-6">
                The UK built <strong>360Giving</strong> in 2015. Within 3 years, every major UK foundation
                published their grants data through it. It became the standard. The foundations
                that joined first shaped the rules, set the norms, and built reputations as
                transparency leaders.
              </p>
              <p className="text-sm font-medium mb-6">
                Australia has no equivalent. <strong>GrantScope is building it.</strong> The foundations
                and corporates that join now don&apos;t just get a tool — they get to shape the
                infrastructure that the entire sector will eventually use.
              </p>
              <p className="text-sm font-medium">
                When the media writes about philanthropic transparency in Australia — and they will —
                the founding funders are the ones who get mentioned.
              </p>
            </div>
            <div className="border-4 border-bauhaus-black bg-white p-6 bauhaus-shadow">
              <h3 className="font-black text-sm uppercase tracking-widest mb-4">Founding Funder Benefits</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="text-money font-black shrink-0">{'\u25CF'}</span>
                  <span><strong>Founding Partner badge</strong> — permanent recognition on the platform</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-money font-black shrink-0">{'\u25CF'}</span>
                  <span><strong>Feature input</strong> — direct line to the product team on what gets built next</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-money font-black shrink-0">{'\u25CF'}</span>
                  <span><strong>Launch visibility</strong> — featured in launch press, reports, and case studies</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-money font-black shrink-0">{'\u25CF'}</span>
                  <span><strong>Locked pricing</strong> — $499/mo locked for life while you remain a subscriber</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-money font-black shrink-0">{'\u25CF'}</span>
                  <span><strong>Early API access</strong> — programmatic access before public release</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== WHAT YOU GET ===== */}
      <section id="what-you-get" className="py-20 px-6 bg-white border-b-4 border-bauhaus-black scroll-mt-8">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-3 text-center">What You Get</p>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-center mb-4">
            EVERYTHING IN YOUR<br />FUNDER SUBSCRIPTION
          </h2>
          <p className="text-bauhaus-muted text-center max-w-2xl mx-auto mb-16">
            Not a list of features. A walkthrough of exactly how GrantScope
            changes the way you find, fund, and build relationships with organisations.
          </p>

          {/* Feature 1 */}
          <div className="mb-16">
            <div className="grid md:grid-cols-[1fr_2fr] gap-8 items-start">
              <div>
                <span className="text-xs font-black text-bauhaus-blue uppercase tracking-widest">01</span>
                <h3 className="text-2xl font-black mt-2">DISCOVERY ENGINE</h3>
                <p className="text-sm text-bauhaus-muted mt-2">
                  Stop waiting for applications. Find the organisations already doing the work.
                </p>
              </div>
              <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-8">
                <ul className="space-y-4 text-sm">
                  <li>
                    <strong>Search {fmt(stats.charities)}+ charities</strong> by mission alignment, geography,
                    cause area, organisation size, and financial health.
                  </li>
                  <li>
                    <strong>AI match scoring (0–100)</strong> against your giving priorities.
                    Define what you care about, and every charity gets a relevance score.
                  </li>
                  <li>
                    <strong>Find the invisible orgs.</strong> The grassroots organisations that don&apos;t
                    have grant writers or marketing budgets but have the best outcomes.
                    GrantScope surfaces them by impact, not by profile polish.
                  </li>
                  <li>
                    <strong>Proactive deal flow.</strong> New charities matching your criteria?
                    Get alerted. Don&apos;t wait for the next grant round.
                  </li>
                </ul>
                <div className="mt-4 pt-4 border-t-2 border-bauhaus-black/10">
                  <Link href="/charities" className="text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:text-bauhaus-red">
                    Try searching charities now →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="mb-16">
            <div className="grid md:grid-cols-[1fr_2fr] gap-8 items-start">
              <div>
                <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">02</span>
                <h3 className="text-2xl font-black mt-2">PORTFOLIO INTELLIGENCE</h3>
                <p className="text-sm text-bauhaus-muted mt-2">
                  See your entire giving portfolio mapped, analysed, and benchmarked.
                </p>
              </div>
              <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-8">
                <ul className="space-y-4 text-sm">
                  <li>
                    <strong>Geographic mapping.</strong> Where does your funding land? Which postcodes,
                    regions, and states? Where are the gaps? Interactive map of your entire portfolio.
                  </li>
                  <li>
                    <strong>Thematic breakdown.</strong> Health, education, environment, First Nations,
                    youth, arts — see your allocation across cause areas and how it compares to
                    sector averages.
                  </li>
                  <li>
                    <strong>Overlap analysis.</strong> Which other foundations fund the same organisations?
                    Where is the sector over-investing? Where is nobody funding at all?
                  </li>
                  <li>
                    <strong>Outcome tracking.</strong> Connect your grants to the charity&apos;s financial
                    data over time. Did your funding correlate with growth, stability, or decline?
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="mb-16">
            <div className="grid md:grid-cols-[1fr_2fr] gap-8 items-start">
              <div>
                <span className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest">03</span>
                <h3 className="text-2xl font-black mt-2">FOUNDATION SCORECARD</h3>
                <p className="text-sm text-bauhaus-muted mt-2">
                  Know where you stand. Benchmark against your peers.
                </p>
              </div>
              <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-8">
                <ul className="space-y-4 text-sm">
                  <li>
                    <strong>Giving ratio.</strong> What percentage of your assets flow out as grants?
                    How does that compare to foundations of similar size? The sector average is 5%.
                    Some are at 176%. Some are at 0%.
                  </li>
                  <li>
                    <strong>Executive compensation benchmark.</strong> How does your team&apos;s pay compare
                    to your grant output? 89% of foundations pay executives more than they distribute.
                    Where do you sit?
                  </li>
                  <li>
                    <strong>Transparency grade (A+ to F).</strong> Based on giving ratio, compensation,
                    geographic reach, thematic diversity, and public reporting. The grade is public.
                    Use it as a badge of pride.
                  </li>
                  <li>
                    <strong>Peer comparison.</strong> See how you compare to foundations of similar size,
                    geography, and focus area. Not to shame — to improve.
                  </li>
                </ul>
                <div className="mt-4 pt-4 border-t-2 border-bauhaus-black/10">
                  <Link href="/foundations" className="text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:text-bauhaus-red">
                    Browse {fmt(stats.foundations)} foundation profiles →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 4 */}
          <div className="mb-16">
            <div className="grid md:grid-cols-[1fr_2fr] gap-8 items-start">
              <div>
                <span className="text-xs font-black text-money uppercase tracking-widest">04</span>
                <h3 className="text-2xl font-black mt-2">RELATIONSHIP CRM</h3>
                <p className="text-sm text-bauhaus-muted mt-2">
                  Move from transactional grants to long-term partnerships.
                </p>
              </div>
              <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-8">
                <ul className="space-y-4 text-sm">
                  <li>
                    <strong>Track every interaction.</strong> When you first met, what you discussed,
                    what you funded, how it went. Institutional memory that survives staff turnover.
                  </li>
                  <li>
                    <strong>Funding history timeline.</strong> Every grant, every amount, every outcome —
                    mapped across years. See the full arc of a relationship, not just the current round.
                  </li>
                  <li>
                    <strong>Team-wide visibility.</strong> Your whole grants team sees the same data.
                    No more &ldquo;I think we funded them in 2019?&rdquo; No more duplicate outreach.
                  </li>
                  <li>
                    <strong>Pipeline dashboard.</strong> What&apos;s in progress? What&apos;s under review?
                    What needs follow-up? Board-ready pipeline view.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Feature 5 */}
          <div className="mb-16">
            <div className="grid md:grid-cols-[1fr_2fr] gap-8 items-start">
              <div>
                <span className="text-xs font-black text-bauhaus-blue uppercase tracking-widest">05</span>
                <h3 className="text-2xl font-black mt-2">SYSTEM INTELLIGENCE</h3>
                <p className="text-sm text-bauhaus-muted mt-2">
                  Data nobody else has. See the whole philanthropic system.
                </p>
              </div>
              <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-8">
                <ul className="space-y-4 text-sm">
                  <li>
                    <strong>{fmt(stats.acnc)} ACNC financial records.</strong> 7 years of data on every
                    registered charity. Revenue, expenses, assets, compensation. Cross-referenced
                    and searchable.
                  </li>
                  <li>
                    <strong>{fmt(stats.foundations)} foundation profiles.</strong> {fmt(stats.enriched)} AI-enriched
                    with focus areas, giving patterns, and contact information.
                  </li>
                  <li>
                    <strong>{fmt(stats.grants)} grant opportunities.</strong> 100% AI-embedded for semantic
                    search. State, federal, and private funders.
                  </li>
                  <li>
                    <strong>Living data investigations.</strong> Power dynamics, community parity, money flow,
                    access gaps — reports that update as new data comes in.
                  </li>
                </ul>
                <div className="mt-4 pt-4 border-t-2 border-bauhaus-black/10 flex gap-4 flex-wrap">
                  <Link href="/reports/big-philanthropy" className="text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:text-bauhaus-red">
                    $222B report →
                  </Link>
                  <Link href="/reports/power-dynamics" className="text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:text-bauhaus-red">
                    Power dynamics →
                  </Link>
                  <Link href="/dashboard" className="text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:text-bauhaus-red">
                    Live dashboard →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 6 */}
          <div className="mb-16">
            <div className="grid md:grid-cols-[1fr_2fr] gap-8 items-start">
              <div>
                <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">06</span>
                <h3 className="text-2xl font-black mt-2">BRAND & VISIBILITY</h3>
                <p className="text-sm text-bauhaus-muted mt-2">
                  Your giving becomes your reputation.
                </p>
              </div>
              <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-8">
                <ul className="space-y-4 text-sm">
                  <li>
                    <strong>Public foundation profile.</strong> Your giving ratio, thematic focus,
                    geographic reach, and scorecard — visible to every charity, researcher, and
                    journalist on the platform. Good data is good press.
                  </li>
                  <li>
                    <strong>Founding Funder badge.</strong> Permanent recognition as one of the first
                    to back Australia&apos;s philanthropic transparency infrastructure.
                  </li>
                  <li>
                    <strong>Featured in launch materials.</strong> When GrantScope launches publicly —
                    and the media covers it — founding funders are named. This is the kind of
                    visibility you can&apos;t buy.
                  </li>
                  <li>
                    <strong>Cross-subsidy story.</strong> Your subscription funds free access for
                    community organisations. That&apos;s a story worth telling — to your board,
                    your stakeholders, and the public.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Feature 7 */}
          <div>
            <div className="grid md:grid-cols-[1fr_2fr] gap-8 items-start">
              <div>
                <span className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest">07</span>
                <h3 className="text-2xl font-black mt-2">DATA API</h3>
                <p className="text-sm text-bauhaus-muted mt-2">
                  Programmatic access to the full dataset.
                </p>
              </div>
              <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-8">
                <ul className="space-y-4 text-sm">
                  <li>
                    <strong>REST API access.</strong> Query charities, foundations, grants, and
                    financial records programmatically. Build your own dashboards, reports,
                    and integrations.
                  </li>
                  <li>
                    <strong>Bulk export.</strong> Download datasets for internal analysis,
                    board papers, and strategy documents.
                  </li>
                  <li>
                    <strong>Webhook notifications.</strong> Get notified when new charities
                    match your criteria, when financial data updates, or when new grants
                    are published in your focus areas.
                  </li>
                  <li>
                    <strong>White-label option.</strong> Embed GrantScope data in your own
                    website or internal tools. Show your stakeholders where their money goes
                    — on your platform, with your branding.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT CHANGES THINGS ===== */}
      <section className="py-20 px-6 bg-bauhaus-black text-white">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs text-white/30 uppercase tracking-[0.3em] font-black mb-3 text-center">The Shift</p>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-center mb-16">
            HOW THIS CHANGES<br />THE WAY YOU GIVE
          </h2>

          <div className="space-y-8">
            {[
              {
                before: 'You advertise a grant round, get 500 applications, fund 12.',
                after: 'You search for aligned organisations, reach out directly, and build partnerships with the ones doing the best work.',
                label: 'FROM ADVERTISING TO DISCOVERING',
              },
              {
                before: 'You judge organisations by how well they write applications.',
                after: 'You judge them by 7 years of financial data, mission alignment, and community outcomes.',
                label: 'FROM PROSE TO PROOF',
              },
              {
                before: 'Your relationship with grantees is transactional — submit, review, fund, acquit, repeat.',
                after: 'You track every interaction across years. You know their story. They know yours. Trust compounds.',
                label: 'FROM TRANSACTIONS TO RELATIONSHIPS',
              },
              {
                before: 'You fund in isolation. No idea what other foundations are doing in the same space.',
                after: 'You see the whole system. Where money is flowing, where it\'s not, where you can have the most unique impact.',
                label: 'FROM ISOLATION TO COORDINATION',
              },
              {
                before: 'Your CSR report is a PDF with stock photos that nobody reads.',
                after: 'Your giving data is live on the platform — transparent, verifiable, and respected. Your scorecard speaks for itself.',
                label: 'FROM REPORTS TO REPUTATION',
              },
              {
                before: 'The best community orgs can\'t afford to apply. You never even know they exist.',
                after: 'Your subscription funds their free access. They\'re on the platform. You find each other.',
                label: 'FROM GATEKEEPING TO ACCESS',
              },
            ].map((item) => (
              <div key={item.label} className="border-4 border-white/10 p-8">
                <p className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-4">{item.label}</p>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-black text-white/30 uppercase tracking-widest mb-2">Before</p>
                    <p className="text-sm text-white/50 line-through">{item.before}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black text-money uppercase tracking-widest mb-2">After</p>
                    <p className="text-sm text-white/90 font-medium">{item.after}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== THE MOMENTUM ===== */}
      <section className="py-20 px-6 bg-white border-b-4 border-bauhaus-black">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center mb-4">
            THE EYEBALLS ARE COMING
          </h2>
          <p className="text-bauhaus-muted text-center max-w-2xl mx-auto mb-12">
            This is what&apos;s already built and growing. When it launches publicly,
            every charity, researcher, journalist, and policy maker in the country
            will be looking at this data — and at who helped build it.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            <div className="border-4 border-bauhaus-black p-4 bg-bauhaus-canvas text-center">
              <p className="text-2xl font-black">{fmt(stats.acnc)}</p>
              <p className="text-xs text-bauhaus-muted uppercase tracking-widest mt-1">Financial records</p>
            </div>
            <div className="border-4 border-bauhaus-black p-4 bg-bauhaus-canvas text-center">
              <p className="text-2xl font-black">{fmt(stats.foundations)}</p>
              <p className="text-xs text-bauhaus-muted uppercase tracking-widest mt-1">Foundations</p>
            </div>
            <div className="border-4 border-bauhaus-black p-4 bg-bauhaus-canvas text-center">
              <p className="text-2xl font-black">{fmt(stats.grants)}</p>
              <p className="text-xs text-bauhaus-muted uppercase tracking-widest mt-1">Grants</p>
            </div>
            <div className="border-4 border-bauhaus-black p-4 bg-bauhaus-canvas text-center">
              <p className="text-2xl font-black">6</p>
              <p className="text-xs text-bauhaus-muted uppercase tracking-widest mt-1">Live reports</p>
            </div>
          </div>

          <div className="border-4 border-bauhaus-black bg-bauhaus-yellow p-8 bauhaus-shadow">
            <h3 className="font-black text-lg mb-4">WHO WILL BE WATCHING</h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-black mb-1">60,000+ Charities</p>
                <p className="text-bauhaus-black/60">Looking for funding, checking foundation profiles, researching the system.</p>
              </div>
              <div>
                <p className="font-black mb-1">Media & Journalists</p>
                <p className="text-bauhaus-black/60">The $222B investigation is the kind of story that gets coverage. Your name is attached.</p>
              </div>
              <div>
                <p className="font-black mb-1">Government & Policy</p>
                <p className="text-bauhaus-black/60">DGR reform, giving incentives, sector regulation — policy makers need this data.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== THE NETWORK EFFECT ===== */}
      <section className="py-20 px-6 bg-bauhaus-canvas">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-black tracking-tight mb-4">
            THE MORE FUNDERS JOIN,<br />THE BETTER IT GETS FOR EVERYONE
          </h2>
          <p className="text-bauhaus-muted max-w-2xl mx-auto mb-12">
            This isn&apos;t a tool that gets worse with competition. It&apos;s infrastructure
            that gets better with participation.
          </p>

          <div className="grid md:grid-cols-3 gap-6 text-left">
            <div className="border-4 border-bauhaus-black bg-white p-6">
              <h3 className="font-black text-sm uppercase tracking-widest mb-3">For You</h3>
              <p className="text-sm text-bauhaus-muted">
                More funders = more overlap data = better coordination = less waste.
                You see where others fund and find the gaps only you can fill.
              </p>
            </div>
            <div className="border-4 border-bauhaus-black bg-white p-6">
              <h3 className="font-black text-sm uppercase tracking-widest mb-3">For Charities</h3>
              <p className="text-sm text-bauhaus-muted">
                More funders on the platform = more discovery = more relationships.
                The cross-subsidy model means every funder who joins unlocks
                free access for more community orgs.
              </p>
            </div>
            <div className="border-4 border-bauhaus-black bg-white p-6">
              <h3 className="font-black text-sm uppercase tracking-widest mb-3">For The System</h3>
              <p className="text-sm text-bauhaus-muted">
                More data = better intelligence = smarter giving = less concentration.
                The system self-corrects when everyone can see it. That&apos;s the whole point.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== INVESTMENT BREAKDOWN ===== */}
      <section className="py-20 px-6 bg-bauhaus-black text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-12">
            $499/MONTH.<br />HERE&apos;S WHAT THAT MEANS.
          </h2>

          <div className="space-y-4 text-left max-w-xl mx-auto mb-12">
            {[
              { cost: '$499', gets: 'Full platform access for your entire team (unlimited members)' },
              { cost: '$0', gets: 'Free access funded for dozens of community organisations' },
              { cost: '$0', gets: 'Discovery engine, portfolio intelligence, scorecard, CRM, API' },
              { cost: '$0', gets: 'All 6 living data investigations' },
              { cost: '$0', gets: 'Founding Funder status (locked pricing, feature input, launch visibility)' },
            ].map((item, i) => (
              <div key={i} className="flex gap-4 items-start border-4 border-white/10 p-4">
                <span className="text-lg font-black text-bauhaus-yellow whitespace-nowrap">{item.cost}</span>
                <span className="text-sm text-white/80">{item.gets}</span>
              </div>
            ))}
          </div>

          <p className="text-white/40 text-sm mb-8">
            That&apos;s less than a single grant writer&apos;s daily rate. Less than a table at a
            charity gala. Less than the catering for your last board meeting.
          </p>

          <div className="border-4 border-bauhaus-yellow p-6 max-w-xl mx-auto">
            <p className="text-lg font-bold text-bauhaus-yellow">
              And your $499 doesn&apos;t just buy you tools.
              It builds the commons. It funds free access for the organisations doing
              the hardest work. That&apos;s infrastructure, not software.
            </p>
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="py-24 px-6 bg-bauhaus-red text-white text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-6xl font-black tracking-tight mb-6 leading-[0.95]">
            BE THE FIRST.
            <br />SHAPE THE STANDARD.
            <br />BUILD THE COMMONS.
          </h2>
          <p className="text-white/70 text-lg mb-4">
            Nothing like this exists in Australia. The foundations that join now
            don&apos;t just get a tool — they get to define how philanthropic
            transparency works in this country.
          </p>
          <p className="text-white/50 text-sm mb-10">
            Limited founding funder spots. Locked pricing for life.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:hello@grantscope.au?subject=Founding%20Funder%20%E2%80%94%20interested"
              className="inline-block py-4 px-10 font-black text-sm uppercase tracking-widest border-4 border-white bg-white text-bauhaus-red bauhaus-shadow-sm transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
            >
              Become a Founding Funder
            </a>
            <Link
              href="/pricing"
              className="inline-block py-4 px-10 font-black text-sm uppercase tracking-widest border-4 border-white text-white transition-all hover:bg-white hover:text-bauhaus-red"
            >
              See All Plans
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
