import { getServiceSupabase } from '@/lib/supabase';
import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'For Corporates & Sponsors | CivicGraph Australia',
  description: 'Supplier discovery, social procurement, and impact partnerships. CivicGraph maps 99,000+ entities so corporates can find aligned partners by data, not by pitch deck.',
};

async function getStats() {
  const supabase = getServiceSupabase();
  const [charitiesResult, foundationsResult, grantsResult] = await Promise.all([
    supabase.from('v_charity_explorer').select('*', { count: 'exact', head: true }),
    supabase.from('foundations').select('*', { count: 'exact', head: true }),
    supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }),
  ]);
  return {
    charities: charitiesResult.count || 0,
    foundations: foundationsResult.count || 0,
    grants: grantsResult.count || 0,
  };
}

export default async function ForCorporatePage() {
  let stats = { charities: 0, foundations: 0, grants: 0 };
  try { stats = await getStats(); } catch {}

  const fmtNum = (n: number) => n.toLocaleString('en-AU');

  return (
    <div className="min-h-screen bg-bauhaus-canvas">

      {/* ===== HERO ===== */}
      <section className="bg-bauhaus-black text-white min-h-[80vh] flex items-center">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-xs text-white/30 uppercase tracking-[0.4em] font-black mb-8">
            For companies, sponsors & high-net-worth individuals
          </p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.95] mb-8">
            YOU WANT
            <br />TO GIVE.
            <br /><span className="text-bauhaus-yellow">YOU DON&apos;T KNOW</span>
            <br /><span className="text-bauhaus-yellow">WHO TO.</span>
          </h1>
          <p className="text-xl md:text-2xl text-white/50 font-medium max-w-2xl mb-12">
            There are {fmtNum(stats.charities)}+ charities in Australia. Which ones are doing
            the work that aligns with what you care about? Which ones will use your money well?
            How do you even find out?
          </p>
          <Link
            href="#the-problem"
            className="inline-block py-4 px-8 font-black text-sm uppercase tracking-widest border-4 border-bauhaus-yellow bg-bauhaus-yellow text-bauhaus-black bauhaus-shadow-sm transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
          >
            We Built The Answer
          </Link>
        </div>
      </section>

      {/* ===== THE PROBLEM ===== */}
      <section id="the-problem" className="py-20 px-6 bg-white border-b-4 border-bauhaus-black scroll-mt-8">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-3">The Problem</p>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-12">
            THE CURRENT SYSTEM<br />DOESN&apos;T WORK FOR ANYONE.
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-canvas">
              <h3 className="text-xl font-black mb-4">IF YOU&apos;RE A COMPANY</h3>
              <ul className="space-y-4 text-sm">
                <li className="flex gap-3">
                  <span className="text-bauhaus-red font-black shrink-0">✕</span>
                  <span>You get pitched by charities who are good at pitching, not necessarily good at impact</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-bauhaus-red font-black shrink-0">✕</span>
                  <span>Your sponsorship decisions are based on who your CEO golfs with, not data</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-bauhaus-red font-black shrink-0">✕</span>
                  <span>You have no way to verify claims about impact before you write the cheque</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-bauhaus-red font-black shrink-0">✕</span>
                  <span>Your CSR report says &ldquo;we gave $2M to charity&rdquo; but can&apos;t say what changed</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-bauhaus-red font-black shrink-0">✕</span>
                  <span>You&apos;re spending more on the gala dinner than you give to the cause</span>
                </li>
              </ul>
            </div>

            <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-canvas">
              <h3 className="text-xl font-black mb-4">IF YOU&apos;RE A WEALTHY INDIVIDUAL</h3>
              <ul className="space-y-4 text-sm">
                <li className="flex gap-3">
                  <span className="text-bauhaus-red font-black shrink-0">✕</span>
                  <span>You want to give but every charity looks the same from the outside</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-bauhaus-red font-black shrink-0">✕</span>
                  <span>You can&apos;t tell which organisations are efficient and which are bloated</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-bauhaus-red font-black shrink-0">✕</span>
                  <span>Nobody shows you the small, effective orgs that don&apos;t have marketing budgets</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-bauhaus-red font-black shrink-0">✕</span>
                  <span>Your financial advisor knows investments but not philanthropy</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-bauhaus-red font-black shrink-0">✕</span>
                  <span>You end up giving to the biggest names, not the best organisations</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 border-4 border-bauhaus-black bg-bauhaus-yellow p-8 bauhaus-shadow-sm">
            <p className="text-lg font-bold">
              The result? 94% of donations go to 10% of organisations. The big charities
              with the big marketing budgets get the money. The grassroots organisations doing
              transformative work in communities stay invisible. Not because they&apos;re not
              brilliant — because nobody knows they exist.
            </p>
          </div>
        </div>
      </section>

      {/* ===== THE SOLUTION ===== */}
      <section className="py-20 px-6 bg-bauhaus-black text-white">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs text-white/30 uppercase tracking-[0.3em] font-black mb-3">The Solution</p>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-6">
            SEARCH BY IMPACT.<br />NOT BY PITCH DECK.
          </h2>
          <p className="text-white/50 text-lg max-w-2xl mb-16">
            CivicGraph maps 99,000+ entities across grants, contracts, and corporate filings.
            Find suppliers, partners, and aligned organisations by data — not by who
            your CEO golfs with. Procurement intelligence meets social impact.
          </p>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="border-4 border-white/20 p-8">
              <span className="text-4xl mb-4 block">🔍</span>
              <h3 className="font-black text-bauhaus-yellow mb-3 text-lg">DISCOVER</h3>
              <p className="text-sm text-white/70 mb-4">
                Search {fmtNum(stats.charities)}+ charities by what they do, where they
                work, who they serve, and their track record. Filter by cause area,
                geography, organisation size, and financial health.
              </p>
              <p className="text-xs text-white/40">
                Find the women&apos;s shelter in regional QLD that runs on $200K/year and
                has better outcomes than the $10M national charity. They exist. We help
                you find them.
              </p>
            </div>
            <div className="border-4 border-white/20 p-8">
              <span className="text-4xl mb-4 block">📊</span>
              <h3 className="font-black text-bauhaus-yellow mb-3 text-lg">EVALUATE</h3>
              <p className="text-sm text-white/70 mb-4">
                Every charity on CivicGraph has 7 years of ACNC financial data. Revenue,
                expenses, assets, executive compensation, volunteer numbers. Real numbers,
                not brochures.
              </p>
              <p className="text-xs text-white/40">
                See how much actually reaches programs vs admin. Compare efficiency across
                similar organisations. Know exactly where your dollar goes before it leaves
                your account.
              </p>
            </div>
            <div className="border-4 border-white/20 p-8">
              <span className="text-4xl mb-4 block">🤝</span>
              <h3 className="font-black text-bauhaus-yellow mb-3 text-lg">CONNECT</h3>
              <p className="text-sm text-white/70 mb-4">
                Don&apos;t just write a cheque. Build a relationship. Track your giving history,
                see outcomes over time, and understand the real impact of your support.
              </p>
              <p className="text-xs text-white/40">
                The best giving relationships are long-term partnerships, not one-off
                sponsorships. CivicGraph helps you build them with data and trust.
              </p>
            </div>
          </div>

          <div className="text-center">
            <Link
              href="/charities"
              className="inline-block py-4 px-8 font-black text-sm uppercase tracking-widest border-4 border-bauhaus-yellow bg-bauhaus-yellow text-bauhaus-black bauhaus-shadow-sm transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
            >
              Search {fmtNum(stats.charities)}+ Charities Now
            </Link>
          </div>
        </div>
      </section>

      {/* ===== WHAT YOU CAN SEE ===== */}
      <section className="py-20 px-6 bg-white border-b-4 border-bauhaus-black">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center mb-4">
            WHAT YOU&apos;LL SEE ON EVERY CHARITY PROFILE
          </h2>
          <p className="text-bauhaus-muted text-center max-w-2xl mx-auto mb-12">
            Real financial data from ACNC filings. Not what the charity tells you about
            themselves — what the numbers tell you.
          </p>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              {
                title: 'FINANCIAL HEALTH',
                items: ['Revenue trend (7 years)', 'Expense breakdown', 'Asset growth vs grant output', 'Surplus/deficit history'],
              },
              {
                title: 'EFFICIENCY',
                items: ['Program spending ratio', 'Admin overhead', 'Executive compensation', 'Volunteer-to-staff ratio'],
              },
              {
                title: 'IMPACT PROFILE',
                items: ['Mission statement', 'Geographic coverage', 'Communities served', 'Cause areas & themes'],
              },
              {
                title: 'TRANSPARENCY',
                items: ['ACNC compliance history', 'DGR status', 'ABN verification', 'Public reporting quality'],
              },
            ].map((card) => (
              <div key={card.title} className="border-4 border-bauhaus-black p-6 bg-bauhaus-canvas">
                <h3 className="font-black text-sm uppercase tracking-widest mb-4">{card.title}</h3>
                <ul className="space-y-2">
                  {card.items.map((item) => (
                    <li key={item} className="flex gap-2 text-sm">
                      <span className="text-money font-black text-xs mt-0.5">{'\u25CF'}</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FOR SPONSORS ===== */}
      <section className="py-20 px-6 bg-bauhaus-canvas">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-3 text-center">For Sponsors</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center mb-4">
            SPONSORSHIP THAT ACTUALLY MEANS SOMETHING
          </h2>
          <p className="text-bauhaus-muted text-center max-w-2xl mx-auto mb-12">
            Your logo on a banner doesn&apos;t change lives. Aligned partnership with the right
            organisation does. Here&apos;s how to find the right fit.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="border-4 border-bauhaus-black bg-white p-8 bauhaus-shadow-sm">
              <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue mb-4">Step 1</p>
              <h3 className="font-black text-lg mb-3">DEFINE WHAT YOU CARE ABOUT</h3>
              <p className="text-sm text-bauhaus-muted">
                Youth justice? Mental health? First Nations? Regional communities?
                Environmental? Education? Start with what matters to your team, your
                customers, or your community.
              </p>
            </div>
            <div className="border-4 border-bauhaus-black bg-white p-8 bauhaus-shadow-sm">
              <p className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-4">Step 2</p>
              <h3 className="font-black text-lg mb-3">SEARCH BY ALIGNMENT</h3>
              <p className="text-sm text-bauhaus-muted">
                CivicGraph&apos;s AI matches organisations to your values. Not who&apos;s
                loudest — who&apos;s most aligned. Filter by geography, cause area,
                size, financial health, and track record.
              </p>
            </div>
            <div className="border-4 border-bauhaus-black bg-white p-8 bauhaus-shadow-sm">
              <p className="text-xs font-black uppercase tracking-widest text-money mb-4">Step 3</p>
              <h3 className="font-black text-lg mb-3">BUILD A REAL PARTNERSHIP</h3>
              <p className="text-sm text-bauhaus-muted">
                Reach out directly. No middlemen. Track the relationship over time.
                See the outcomes. Tell your stakeholders a real story about real impact —
                not a logo on a banner.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== THE UNCOMFORTABLE TRUTH ===== */}
      <section className="py-20 px-6 bg-bauhaus-black text-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center mb-12">
            THE UNCOMFORTABLE TRUTH<br />ABOUT CORPORATE GIVING
          </h2>

          <div className="space-y-6 mb-12">
            {[
              {
                stat: '$1.1B',
                fact: 'of Australian corporate giving comes from mining, gambling, and fossil fuel companies.',
                implication: 'Communities have a right to know where their support originates.',
              },
              {
                stat: '70%',
                fact: 'of corporate sponsorships go to sport, arts, and events — not to disadvantaged communities.',
                implication: 'There\'s nothing wrong with that. But call it marketing, not philanthropy.',
              },
              {
                stat: '< 3%',
                fact: 'of corporate social investment reaches First Nations communities directly.',
                implication: 'Despite Reconciliation Action Plans being standard across the ASX200.',
              },
            ].map((item) => (
              <div key={item.stat} className="border-4 border-white/20 p-6 grid md:grid-cols-[120px_1fr] gap-4">
                <p className="text-4xl font-black text-bauhaus-yellow">{item.stat}</p>
                <div>
                  <p className="text-sm text-white/80 font-bold">{item.fact}</p>
                  <p className="text-xs text-white/40 mt-2">{item.implication}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-4 border-bauhaus-yellow bg-bauhaus-yellow text-bauhaus-black p-8">
            <p className="text-lg font-bold">
              This isn&apos;t about shaming anyone. It&apos;s about visibility. When you can see the
              whole system — where money comes from, where it goes, where it doesn&apos;t —
              you can make better decisions. That&apos;s good for companies, good for communities,
              good for everyone.
            </p>
          </div>

          <div className="text-center mt-8">
            <Link
              href="/corporate"
              className="inline-block py-3 px-6 font-black text-xs uppercase tracking-widest border-4 border-white bg-white text-bauhaus-black bauhaus-shadow-sm transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
            >
              Explore Corporate Giving Data →
            </Link>
          </div>
        </div>
      </section>

      {/* ===== YOUR BRAND ===== */}
      <section className="py-20 px-6 bg-white border-b-4 border-bauhaus-black">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
            YOUR GIVING IS YOUR BRAND
          </h2>
          <p className="text-bauhaus-muted max-w-2xl mx-auto mb-12">
            In a world of greenwashing and virtue signalling, real giving — to the right
            organisations, for the right reasons, with real outcomes — is a competitive advantage.
          </p>

          <div className="grid md:grid-cols-3 gap-6 text-left">
            <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-canvas">
              <h3 className="font-black text-sm uppercase tracking-widest mb-3">For Your Customers</h3>
              <p className="text-sm text-bauhaus-muted">
                Show them exactly where their money goes. Not a CSR page with stock photos —
                real data on real organisations with real outcomes.
              </p>
            </div>
            <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-canvas">
              <h3 className="font-black text-sm uppercase tracking-widest mb-3">For Your Team</h3>
              <p className="text-sm text-bauhaus-muted">
                People want to work for companies that give a shit. Let your team choose
                the charities you support. Use CivicGraph to make it data-driven,
                not politics-driven.
              </p>
            </div>
            <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-canvas">
              <h3 className="font-black text-sm uppercase tracking-widest mb-3">For Your Board</h3>
              <p className="text-sm text-bauhaus-muted">
                Portfolio analytics on every dollar given. Geography, cause area, outcomes,
                efficiency. Board-ready reporting that proves ROI on social investment.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PRICING TEASER ===== */}
      <section className="py-16 px-6 bg-bauhaus-canvas">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-black tracking-tight mb-4">GET STARTED</h2>
          <p className="text-bauhaus-muted mb-8">
            Search charities for free. Upgrade when you need portfolio tracking,
            AI matching, and team access.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 max-w-xl mx-auto mb-8">
            <div className="border-4 border-bauhaus-black bg-white p-6">
              <p className="text-xs font-black uppercase tracking-widest">Free</p>
              <p className="text-3xl font-black mt-1">$0</p>
              <p className="text-xs text-bauhaus-muted mt-2">Search charities, view profiles, explore data</p>
            </div>
            <div className="border-4 border-bauhaus-black bg-bauhaus-yellow p-6">
              <p className="text-xs font-black uppercase tracking-widest">Funder</p>
              <p className="text-3xl font-black mt-1">$499<span className="text-sm">/mo</span></p>
              <p className="text-xs mt-2">Portfolio tracking, AI matching, deal flow, API</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="inline-block py-3 px-8 font-black text-sm uppercase tracking-widest border-4 border-bauhaus-black bg-bauhaus-black text-white transition-all hover:bg-bauhaus-yellow hover:text-bauhaus-black"
            >
              Start Free
            </Link>
            <Link
              href="/pricing"
              className="inline-block py-3 px-8 font-black text-sm uppercase tracking-widest border-4 border-bauhaus-black bg-white bauhaus-shadow-sm transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
            >
              See All Plans →
            </Link>
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="py-20 px-6 bg-bauhaus-red text-white text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-6 leading-[0.95]">
            STOP GUESSING.
            <br />START GIVING WITH DATA.
          </h2>
          <p className="text-white/70 text-lg mb-10">
            {fmtNum(stats.charities)}+ charities. 7 years of financial data.
            AI-powered matching. Find the organisations that align with what you care about —
            not just the ones with the best pitch decks.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/charities"
              className="inline-block py-4 px-10 font-black text-sm uppercase tracking-widest border-4 border-white bg-white text-bauhaus-red bauhaus-shadow-sm transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
            >
              Search Charities
            </Link>
            <a
              href="mailto:hello@civicgraph.au?subject=Corporate%20giving%20enquiry"
              className="inline-block py-4 px-10 font-black text-sm uppercase tracking-widest border-4 border-white text-white transition-all hover:bg-white hover:text-bauhaus-red"
            >
              Talk to Us
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
