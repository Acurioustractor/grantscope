import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function getStats() {
  const supabase = getServiceSupabase();

  const [grantsResult, foundationsResult, profiledResult] = await Promise.all([
    supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }),
    supabase.from('foundations').select('*', { count: 'exact', head: true }),
    supabase.from('foundations').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
  ]);

  return {
    totalGrants: grantsResult.count || 0,
    totalFoundations: foundationsResult.count || 0,
    profiledFoundations: profiledResult.count || 0,
  };
}

export default async function HomePage() {
  let stats = { totalGrants: 0, totalFoundations: 0, profiledFoundations: 0 };
  try {
    stats = await getStats();
  } catch {
    // DB not yet configured
  }

  return (
    <div>
      {/* Hero */}
      <section className="py-16 sm:py-24">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-4">
          Funding Transparency Platform
        </p>
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-bauhaus-black mb-6 tracking-tight leading-[0.9]">
          Where Does<br />Australia&apos;s<br /><span className="text-bauhaus-blue">Funding Go?</span>
        </h1>
        <p className="text-lg text-bauhaus-muted max-w-xl mb-10 leading-relaxed font-medium">
          Every government grant, every foundation, every corporate giving program
          — searchable, current, and free. Open-source funding transparency.
        </p>

        <form action="/grants" method="get" className="max-w-xl flex gap-0 mb-6">
          <input
            type="text"
            name="q"
            placeholder="Search grants, foundations, programs..."
            className="flex-1 px-5 py-3.5 text-sm font-bold border-4 border-bauhaus-black bg-white focus:bg-bauhaus-yellow focus:outline-none uppercase tracking-wider placeholder:text-bauhaus-muted placeholder:normal-case placeholder:tracking-normal"
          />
          <button
            type="submit"
            className="px-7 py-3.5 text-sm font-black bg-bauhaus-black text-white uppercase tracking-widest hover:bg-bauhaus-red cursor-pointer border-4 border-bauhaus-black"
          >
            Search
          </button>
        </form>
        <div className="flex gap-0 mb-6">
          <a href="/dashboard" className="px-6 py-3 bg-bauhaus-blue text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-black bauhaus-shadow-sm">
            Explore the Data
          </a>
        </div>
        <div className="flex gap-2 flex-wrap mb-6 max-w-xl">
          <span className="text-xs font-black text-bauhaus-muted uppercase tracking-widest self-center mr-1">Try AI:</span>
          {[
            'Find grants for First Nations arts in QLD',
            'What foundations fund environmental regeneration?',
            'Grants for youth mental health programs',
          ].map(q => (
            <a
              key={q}
              href={`/grants?mode=semantic&q=${encodeURIComponent(q)}`}
              className="text-xs px-3 py-1.5 bg-link-light text-bauhaus-blue font-bold border-2 border-bauhaus-blue/20 hover:border-bauhaus-blue transition-colors"
            >
              &ldquo;{q}&rdquo;
            </a>
          ))}
        </div>
        <p className="text-xs text-bauhaus-muted uppercase tracking-widest font-bold">
          Data from ACNC, GrantConnect, data.gov.au, QLD Grants Finder
        </p>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-0 max-w-3xl mb-20 border-4 border-bauhaus-black">
        <a href="/grants" className="group block border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
          <div className="bg-white p-6 text-center transition-all group-hover:bg-bauhaus-blue group-hover:text-white">
            <div className="text-3xl sm:text-4xl font-black tabular-nums group-hover:text-white">{stats.totalGrants.toLocaleString()}</div>
            <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted group-hover:text-white/70">Government Grants</div>
          </div>
        </a>
        <a href="/foundations" className="group block border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
          <div className="bg-white p-6 text-center transition-all group-hover:bg-bauhaus-red group-hover:text-white">
            <div className="text-3xl sm:text-4xl font-black tabular-nums group-hover:text-white">{stats.totalFoundations.toLocaleString()}</div>
            <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted group-hover:text-white/70">Foundations &amp; Trusts</div>
            {stats.profiledFoundations > 0 && (
              <div className="text-xs font-bold text-bauhaus-blue mt-1 group-hover:text-white/80">{stats.profiledFoundations} with AI profiles</div>
            )}
          </div>
        </a>
        <a href="/corporate" className="group block">
          <div className="bg-white p-6 text-center transition-all group-hover:bg-bauhaus-yellow">
            <div className="text-3xl sm:text-4xl font-black">ASX200</div>
            <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted">Corporate Giving</div>
          </div>
        </a>
      </section>

      {/* Three pillars */}
      <section className="border-t-4 border-bauhaus-black pt-16 pb-12">
        <h2 className="text-2xl font-black text-center text-bauhaus-black mb-10">Three Layers of Funding Intelligence</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          <div className="border-4 border-bauhaus-black p-8 bg-white bauhaus-shadow-sm">
            <div className="w-12 h-12 bg-bauhaus-blue flex items-center justify-center mb-4 border-3 border-bauhaus-black">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="square" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="font-black text-bauhaus-black mb-2 text-sm tracking-widest">Government Grants</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              Federal, state, and local grants from GrantConnect, data.gov.au,
              QLD Grants Finder, and business.gov.au. Updated daily.
            </p>
          </div>
          <div className="border-4 border-l-0 border-bauhaus-black p-8 bg-white bauhaus-shadow-sm">
            <div className="w-12 h-12 bg-bauhaus-red flex items-center justify-center mb-4 border-3 border-bauhaus-black rounded-full">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="square" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-black text-bauhaus-black mb-2 text-sm tracking-widest">Philanthropic Foundations</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              ACNC register data on every Australian foundation, PAF, and trust.
              Giving profiles, open programs, and focus areas.
            </p>
          </div>
          <div className="border-4 border-l-0 border-bauhaus-black p-8 bg-white bauhaus-shadow-sm">
            <div className="w-12 h-12 bg-bauhaus-yellow flex items-center justify-center mb-4 border-3 border-bauhaus-black">
              <svg className="w-6 h-6 text-bauhaus-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="square" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <h3 className="font-black text-bauhaus-black mb-2 text-sm tracking-widest">Corporate Transparency</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              ASX200 company foundations mapped to giving vs revenue.
              Who gives what, and is it enough?
            </p>
          </div>
        </div>
      </section>

      {/* Reports teasers */}
      <section className="border-t-4 border-bauhaus-black pt-16 pb-8">
        <h2 className="text-2xl font-black text-center text-bauhaus-black mb-2">Living Reports</h2>
        <p className="text-center text-bauhaus-muted mb-10 text-sm font-medium">Data-driven investigations, updated as new data arrives</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
          <a href="/reports/youth-justice" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-5 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-red group-hover:text-white">
              <div className="text-xs font-black text-bauhaus-red mb-1 uppercase tracking-widest group-hover:text-bauhaus-yellow">Flagship</div>
              <h3 className="font-black text-bauhaus-black mb-1 group-hover:text-white">QLD Youth Justice</h3>
              <p className="text-sm text-bauhaus-muted group-hover:text-white/80">$343M/year on detention. $1.3M per child. 73% reoffend.</p>
            </div>
          </a>
          <a href="/reports/money-flow" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-5 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-blue group-hover:text-white">
              <div className="text-xs font-black text-bauhaus-blue mb-1 uppercase tracking-widest group-hover:text-bauhaus-yellow">Live</div>
              <h3 className="font-black text-bauhaus-black mb-1 group-hover:text-white">Follow the Dollar</h3>
              <p className="text-sm text-bauhaus-muted group-hover:text-white/80">Trace funding flows from taxpayer to outcome.</p>
            </div>
          </a>
          <a href="/reports/access-gap" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-5 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-yellow">
              <div className="text-xs font-black text-bauhaus-yellow mb-1 uppercase tracking-widest group-hover:text-bauhaus-black">Live</div>
              <h3 className="font-black text-bauhaus-black mb-1">The Access Gap</h3>
              <p className="text-sm text-bauhaus-muted group-hover:text-bauhaus-black/70">Small orgs spend 40% on admin. Large orgs spend 15%.</p>
            </div>
          </a>
          <a href="/reports/power-dynamics" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-5 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-black group-hover:text-white">
              <div className="text-xs font-black text-purple mb-1 uppercase tracking-widest group-hover:text-bauhaus-yellow">Live</div>
              <h3 className="font-black text-bauhaus-black mb-1 group-hover:text-white">Power Dynamics</h3>
              <p className="text-sm text-bauhaus-muted group-hover:text-white/80">Who controls Australia&apos;s philanthropy?</p>
            </div>
          </a>
        </div>
      </section>
    </div>
  );
}
