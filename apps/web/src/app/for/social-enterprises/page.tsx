import { getServiceSupabase } from '@/lib/supabase';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'For Social Enterprises | GrantScope Australia',
  description: 'Australia\'s open social enterprise directory. Find peers, discover procurement opportunities, access grant funding, and get visible to buyers who want to purchase with purpose.',
};

async function getStats() {
  const supabase = getServiceSupabase();

  const [totalResult, enrichedResult, indigenousResult, disabilityResult, bcorpResult, grantsOpenResult] = await Promise.all([
    supabase.from('social_enterprises').select('*', { count: 'exact', head: true }),
    supabase.from('social_enterprises').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
    supabase.from('social_enterprises').select('*', { count: 'exact', head: true }).eq('org_type', 'indigenous_business'),
    supabase.from('social_enterprises').select('*', { count: 'exact', head: true }).eq('org_type', 'disability_enterprise'),
    supabase.from('social_enterprises').select('*', { count: 'exact', head: true }).eq('org_type', 'b_corp'),
    supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }).gt('closes_at', new Date().toISOString()),
  ]);

  return {
    total: totalResult.count || 0,
    enriched: enrichedResult.count || 0,
    indigenous: indigenousResult.count || 0,
    disability: disabilityResult.count || 0,
    bcorp: bcorpResult.count || 0,
    openGrants: grantsOpenResult.count || 0,
  };
}

export default async function ForSocialEnterprisesPage() {
  let stats = { total: 0, enriched: 0, indigenous: 0, disability: 0, bcorp: 0, openGrants: 0 };

  try {
    stats = await getStats();
  } catch {
    // DB not configured
  }

  return (
    <div>
      {/* Hero */}
      <section className="py-16 sm:py-24">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-4">
          For Social Enterprises
        </p>
        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-bauhaus-black mb-6 tracking-tight leading-[0.9]">
          Get Visible.<br /><span className="text-bauhaus-red">Get Found.</span>
        </h1>
        <p className="text-lg text-bauhaus-muted max-w-xl mb-10 leading-relaxed font-medium">
          Australia has no central register for social enterprises. GrantScope is building it &mdash;
          open, free, and designed so procurement officers, funders, and communities can find you.
        </p>
        <div className="flex gap-0 flex-wrap">
          <a
            href="/social-enterprises"
            className="px-6 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-red transition-colors"
          >
            Browse the Directory
          </a>
          <a
            href="/reports/social-enterprise"
            className="px-6 py-3 bg-white text-bauhaus-black font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-canvas transition-colors"
          >
            Read the Report
          </a>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-4 border-bauhaus-black mb-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0">
          <div className="p-6 text-center border-b-4 sm:border-b-0 border-r-4 border-bauhaus-black bg-bauhaus-red/5">
            <div className="text-3xl sm:text-4xl font-black tabular-nums text-bauhaus-red">{stats.total.toLocaleString()}</div>
            <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted">Enterprises Listed</div>
          </div>
          <div className="p-6 text-center border-b-4 sm:border-b-0 border-r-4 border-bauhaus-black">
            <div className="text-3xl sm:text-4xl font-black tabular-nums text-bauhaus-blue">{stats.indigenous.toLocaleString()}</div>
            <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted">Indigenous Corps</div>
          </div>
          <div className="p-6 text-center border-r-4 border-bauhaus-black">
            <div className="text-3xl sm:text-4xl font-black tabular-nums">{stats.disability.toLocaleString()}</div>
            <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted">Disability Enterprises</div>
          </div>
          <div className="p-6 text-center">
            <div className="text-3xl sm:text-4xl font-black tabular-nums text-money">{stats.openGrants.toLocaleString()}</div>
            <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted">Open Grants</div>
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="mb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
            <h3 className="font-black text-bauhaus-black mb-2 text-sm uppercase tracking-widest">Get Discovered</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              Procurement officers searching for social enterprise suppliers find you here.
              Your profile is visible to government buyers, corporates, and funders who want
              to purchase with purpose.
            </p>
          </div>
          <div className="bg-white border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
            <h3 className="font-black text-bauhaus-black mb-2 text-sm uppercase tracking-widest">Find Grant Funding</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              Search {stats.openGrants.toLocaleString()} open grants matched to your sector
              and mission. Track applications from discovery to submission. Access funding
              intelligence designed for purpose-driven businesses.
            </p>
          </div>
          <div className="bg-white border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
            <h3 className="font-black text-bauhaus-black mb-2 text-sm uppercase tracking-widest">Connect with Peers</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              Find social enterprises in your state, sector, and certification pathway.
              Discover who else is doing the work. Build partnerships across the ecosystem.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t-4 border-bauhaus-black pt-12 mb-16">
        <h2 className="text-2xl font-black text-bauhaus-black mb-8">How GrantScope Supports Social Enterprises</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { step: '1', title: 'You\'re Already Listed', desc: 'If you\'re registered with ORIC, Social Traders, BuyAbility, or B Corp, you\'re in our directory. We aggregate automatically.' },
            { step: '2', title: 'AI Enriches Your Profile', desc: 'We scrape your website and use AI to generate a rich profile — sectors, services, impact areas — so buyers can find you by what you do.' },
            { step: '3', title: 'Search for Funding', desc: 'Use semantic search across 14,000+ grants. Describe your mission and find opportunities that match — not just keywords, but meaning.' },
            { step: '4', title: 'Track & Apply', desc: 'Save grants, set deadline alerts, and build your funding pipeline. Monitor foundation giving patterns to time your approaches.' },
          ].map((item) => (
            <div key={item.step} className="flex gap-4">
              <div className="w-10 h-10 bg-bauhaus-red text-white font-black text-lg flex items-center justify-center flex-shrink-0">
                {item.step}
              </div>
              <div>
                <h3 className="font-black text-sm text-bauhaus-black mb-1">{item.title}</h3>
                <p className="text-sm text-bauhaus-muted leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Who Benefits */}
      <section className="border-t-4 border-bauhaus-black pt-12 mb-16">
        <h2 className="text-2xl font-black text-bauhaus-black mb-8">Built for Every Type of Social Enterprise</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl">
          {[
            { type: 'Indigenous Corporations', count: stats.indigenous, desc: 'ORIC-registered corporations managing land, culture, health, and community development across every state and territory.', color: 'border-l-bauhaus-red' },
            { type: 'Disability Enterprises', count: stats.disability, desc: 'Businesses creating meaningful employment for people with disability. Listed on BuyAbility and state procurement panels.', color: 'border-l-bauhaus-yellow' },
            { type: 'B Corporations', count: stats.bcorp, desc: 'Certified B Corps meeting global standards for social and environmental performance, accountability, and transparency.', color: 'border-l-money' },
            { type: 'Community Enterprises', count: null, desc: 'Cafes, cleaning services, catering, landscaping — community-owned businesses that reinvest surplus into local priorities.', color: 'border-l-bauhaus-blue' },
          ].map((item) => (
            <div key={item.type} className={`bg-white border-4 border-bauhaus-black ${item.color} border-l-8 p-5`}>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-black text-sm text-bauhaus-black">{item.type}</h3>
                {item.count !== null && item.count > 0 && (
                  <span className="text-[11px] px-1.5 py-0.5 font-black uppercase tracking-wider border-2 border-bauhaus-blue bg-link-light text-bauhaus-blue">
                    {item.count.toLocaleString()} listed
                  </span>
                )}
              </div>
              <p className="text-sm text-bauhaus-muted leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The Bigger Picture */}
      <section className="bg-bauhaus-black border-4 border-bauhaus-black p-8 mb-16" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-red)' }}>
        <h2 className="text-2xl font-black text-white mb-4">The Bigger Picture</h2>
        <div className="text-white/80 font-medium leading-relaxed space-y-4 max-w-2xl">
          <p>
            Australia has ~20,000 social enterprises generating $21 billion in revenue and 300,000 jobs.
            But there is no official register, no dedicated legal structure, and no single directory
            where all of them can be found.
          </p>
          <p>
            GrantScope is building the infrastructure that doesn&apos;t exist. We aggregate every
            publicly available directory, deduplicate across sources, and enrich with AI-generated
            profiles. Open. Free. Updated continuously.
          </p>
          <p>
            Because if procurement officers can&apos;t find you, they can&apos;t buy from you.
            And if funders can&apos;t see you, they can&apos;t support you.
          </p>
        </div>
        <div className="flex gap-4 flex-wrap mt-6">
          <a href="/reports/social-enterprise" className="px-5 py-2.5 bg-bauhaus-red text-white font-black text-xs uppercase tracking-widest border-2 border-bauhaus-red hover:bg-white hover:text-bauhaus-black transition-colors">
            Read the Full Report
          </a>
          <a href="/reports/community-power" className="px-5 py-2.5 bg-transparent text-white/80 font-black text-xs uppercase tracking-widest border-2 border-white/30 hover:border-white hover:text-white transition-colors">
            Community Power Playbook
          </a>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t-4 border-bauhaus-black pt-12 pb-8 text-center">
        <h2 className="text-2xl sm:text-3xl font-black text-bauhaus-black mb-4">Find Your People</h2>
        <p className="text-bauhaus-muted font-medium mb-8 max-w-lg mx-auto">
          Search the directory by state, sector, type, or certification. Find peers, partners, and opportunities.
        </p>
        <form action="/social-enterprises" method="get" className="max-w-lg mx-auto flex gap-0">
          <input
            type="text"
            name="q"
            placeholder="Search social enterprises..."
            className="flex-1 px-5 py-3.5 text-sm font-bold border-4 border-bauhaus-black bg-white focus:bg-bauhaus-yellow focus:outline-none placeholder:text-bauhaus-muted placeholder:normal-case"
          />
          <button
            type="submit"
            className="px-7 py-3.5 text-sm font-black bg-bauhaus-red text-white uppercase tracking-widest hover:bg-bauhaus-black cursor-pointer border-4 border-bauhaus-black"
          >
            Search
          </button>
        </form>
      </section>
    </div>
  );
}
