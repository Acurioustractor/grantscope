import { getServiceSupabase } from '@/lib/supabase';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'For Community Organisations | GrantScope Australia',
  description: 'Find grants, track applications, and discover foundations that fund work like yours. Every government grant, foundation program, and funding opportunity — searchable, current, and built for you.',
};

async function getStats() {
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();
  const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString();

  const [openResult, closingSoonResult, foundationsResult] = await Promise.all([
    supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }).gt('closes_at', now),
    supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }).gt('closes_at', now).lt('closes_at', thirtyDays),
    supabase.from('foundations').select('*', { count: 'exact', head: true }),
  ]);

  return {
    openGrants: openResult.count || 0,
    closingSoon: closingSoonResult.count || 0,
    totalFoundations: foundationsResult.count || 0,
  };
}

async function getClosingSoon() {
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();

  const { data } = await supabase
    .from('grant_opportunities')
    .select('id, title, source, amount_max, closes_at')
    .gt('closes_at', now)
    .order('closes_at', { ascending: true })
    .limit(5);

  return data || [];
}

export default async function ForCommunityPage() {
  let stats = { openGrants: 0, closingSoon: 0, totalFoundations: 0 };
  let closingSoon: Array<{ id: string; title: string; source: string; amount_max: number | null; closes_at: string }> = [];

  try {
    [stats, closingSoon] = await Promise.all([getStats(), getClosingSoon()]);
  } catch {
    // DB not configured
  }

  return (
    <div>
      {/* Hero */}
      <section className="py-16 sm:py-24">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-4">
          For Community Organisations
        </p>
        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-bauhaus-black mb-6 tracking-tight leading-[0.9]">
          Stop Searching.<br /><span className="text-bauhaus-blue">Start Applying.</span>
        </h1>
        <p className="text-lg text-bauhaus-muted max-w-xl mb-10 leading-relaxed font-medium">
          Every government grant, foundation program, and funding opportunity &mdash; searchable,
          current, and built for you.
        </p>
        <div className="flex gap-0 flex-wrap">
          <a
            href="/grants"
            className="px-6 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-red transition-colors"
          >
            Search Grants Now
          </a>
          <a
            href="/profile"
            className="px-6 py-3 bg-white text-bauhaus-black font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-canvas transition-colors"
          >
            Create Your Profile
          </a>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-4 border-bauhaus-black mb-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-0">
          <div className="p-6 text-center border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black bg-bauhaus-blue/5">
            <div className="text-3xl sm:text-4xl font-black tabular-nums text-bauhaus-blue">{stats.openGrants.toLocaleString()}</div>
            <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted">Open Grants</div>
          </div>
          <div className="p-6 text-center border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black bg-bauhaus-red/5">
            <div className="text-3xl sm:text-4xl font-black tabular-nums text-bauhaus-red">{stats.closingSoon.toLocaleString()}</div>
            <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted">Closing This Month</div>
          </div>
          <div className="p-6 text-center">
            <div className="text-3xl sm:text-4xl font-black tabular-nums">{stats.totalFoundations.toLocaleString()}</div>
            <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted">Foundations Mapped</div>
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="mb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
            <h3 className="font-black text-bauhaus-black mb-2 text-sm uppercase tracking-widest">Find Your Grants</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              AI-powered semantic search matches grants to your mission. No more keyword guessing &mdash;
              describe what you do and find what fits.
            </p>
          </div>
          <div className="bg-white border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
            <h3 className="font-black text-bauhaus-black mb-2 text-sm uppercase tracking-widest">Track Applications</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              Save grants, add notes, track stages from discovered to submitted to approved.
              Never miss a deadline again.
            </p>
          </div>
          <div className="bg-white border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
            <h3 className="font-black text-bauhaus-black mb-2 text-sm uppercase tracking-widest">Learn the Landscape</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              See who funds work like yours. Discover foundations, funding patterns,
              and which organisations are giving in your sector.
            </p>
          </div>
        </div>
      </section>

      {/* How It Helps */}
      <section className="border-t-4 border-bauhaus-black pt-12 mb-16">
        <h2 className="text-2xl font-black text-bauhaus-black mb-8">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { step: '1', title: 'Create Your Profile', desc: 'Tell us about your organisation, mission, and the communities you serve.' },
            { step: '2', title: 'AI Matches Grants', desc: 'Our semantic search finds grants that match your work — not just your keywords.' },
            { step: '3', title: 'Save & Track', desc: 'Build a pipeline of opportunities. Track each one from discovery to submission.' },
            { step: '4', title: 'Get Deadline Alerts', desc: 'Never miss a closing date. Get notified when new matching grants appear.' },
          ].map((item) => (
            <div key={item.step} className="flex gap-4">
              <div className="w-10 h-10 bg-bauhaus-black text-white font-black text-lg flex items-center justify-center flex-shrink-0">
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

      {/* Data Preview — Grants Closing Soonest */}
      <section className="border-4 border-bauhaus-black mb-16">
        <div className="bg-bauhaus-black px-6 py-3">
          <h2 className="text-xs font-black text-white uppercase tracking-[0.3em]">Closing Soon</h2>
        </div>
        <div className="divide-y-4 divide-bauhaus-black">
          {closingSoon.length > 0 ? closingSoon.map((grant) => (
            <a key={grant.id} href={`/grants?q=${encodeURIComponent(grant.title)}`} className="block px-6 py-4 hover:bg-bauhaus-canvas transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-black text-sm text-bauhaus-black truncate">{grant.title}</div>
                  <div className="text-xs text-bauhaus-muted font-medium mt-0.5">{grant.source}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  {grant.amount_max && (
                    <div className="text-sm font-black tabular-nums text-money">${grant.amount_max.toLocaleString()}</div>
                  )}
                  <div className="text-xs font-bold text-bauhaus-red tabular-nums">
                    {new Date(grant.closes_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
              </div>
            </a>
          )) : (
            <div className="px-6 py-8 text-center text-sm text-bauhaus-muted">No grants data available</div>
          )}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t-4 border-bauhaus-black pt-12 pb-8 text-center">
        <h2 className="text-2xl sm:text-3xl font-black text-bauhaus-black mb-6">Find Your Funding</h2>
        <form action="/grants" method="get" className="max-w-lg mx-auto flex gap-0">
          <input
            type="text"
            name="q"
            placeholder="What does your organisation do?"
            className="flex-1 px-5 py-3.5 text-sm font-bold border-4 border-bauhaus-black bg-white focus:bg-bauhaus-yellow focus:outline-none placeholder:text-bauhaus-muted placeholder:normal-case"
          />
          <button
            type="submit"
            className="px-7 py-3.5 text-sm font-black bg-bauhaus-black text-white uppercase tracking-widest hover:bg-bauhaus-red cursor-pointer border-4 border-bauhaus-black"
          >
            Search
          </button>
        </form>
      </section>
    </div>
  );
}
