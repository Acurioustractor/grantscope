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
      <section className="text-center py-16 sm:py-24">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-navy-900 mb-4 tracking-tight">
          Where does Australia&apos;s<br className="hidden sm:block" /> funding go?
        </h1>
        <p className="text-lg sm:text-xl text-navy-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Every government grant, every foundation, every corporate giving program
          — searchable, current, and free. Open-source funding transparency.
        </p>

        <form action="/grants" method="get" className="max-w-xl mx-auto flex gap-2 mb-6">
          <input
            type="text"
            name="q"
            placeholder="Search grants, foundations, programs..."
            className="flex-1 px-5 py-3.5 text-base border-2 border-navy-200 rounded-lg focus:border-link focus:outline-none transition-colors bg-white"
          />
          <button
            type="submit"
            className="px-7 py-3.5 text-base font-semibold bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors cursor-pointer"
          >
            Search
          </button>
        </form>
        <p className="text-xs text-navy-400">
          Data from ACNC, GrantConnect, data.gov.au, QLD Grants Finder
        </p>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-3xl mx-auto mb-20">
        <a href="/grants" className="group block">
          <div className="bg-white border border-navy-200 rounded-xl p-6 text-center transition-all group-hover:border-link group-hover:shadow-md">
            <div className="text-3xl sm:text-4xl font-extrabold text-link tabular-nums">{stats.totalGrants.toLocaleString()}</div>
            <div className="text-sm text-navy-500 mt-1">Government Grants</div>
          </div>
        </a>
        <a href="/foundations" className="group block">
          <div className="bg-white border border-navy-200 rounded-xl p-6 text-center transition-all group-hover:border-money group-hover:shadow-md">
            <div className="text-3xl sm:text-4xl font-extrabold text-money tabular-nums">{stats.totalFoundations.toLocaleString()}</div>
            <div className="text-sm text-navy-500 mt-1">Foundations &amp; Trusts</div>
            {stats.profiledFoundations > 0 && (
              <div className="text-xs text-money mt-1">{stats.profiledFoundations} with AI profiles</div>
            )}
          </div>
        </a>
        <a href="/corporate" className="group block">
          <div className="bg-white border border-navy-200 rounded-xl p-6 text-center transition-all group-hover:border-warning group-hover:shadow-md">
            <div className="text-3xl sm:text-4xl font-extrabold text-warning">ASX200</div>
            <div className="text-sm text-navy-500 mt-1">Corporate Giving</div>
          </div>
        </a>
      </section>

      {/* Three pillars */}
      <section className="border-t border-navy-200 pt-16 pb-12">
        <h2 className="text-2xl font-bold text-center text-navy-900 mb-10">Three layers of funding intelligence</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-link-light flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-link" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="font-semibold text-navy-900 mb-2">Government Grants</h3>
            <p className="text-sm text-navy-500 leading-relaxed">
              Federal, state, and local grants from GrantConnect, data.gov.au,
              QLD Grants Finder, and business.gov.au. Updated daily.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-money-light flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-money" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-navy-900 mb-2">Philanthropic Foundations</h3>
            <p className="text-sm text-navy-500 leading-relaxed">
              ACNC register data on every Australian foundation, PAF, and trust.
              Giving profiles, open programs, and focus areas.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-warning-light flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <h3 className="font-semibold text-navy-900 mb-2">Corporate Transparency</h3>
            <p className="text-sm text-navy-500 leading-relaxed">
              ASX200 company foundations mapped to giving vs revenue.
              Who gives what, and is it enough?
            </p>
          </div>
        </div>
      </section>

      {/* Reports teasers */}
      <section className="border-t border-navy-200 pt-16 pb-8">
        <h2 className="text-2xl font-bold text-center text-navy-900 mb-2">Living Reports</h2>
        <p className="text-center text-navy-500 mb-10">Data-driven investigations, updated as new data arrives</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
          <a href="/reports/youth-justice" className="group block bg-white border-2 border-danger rounded-xl p-5 hover:shadow-md transition-all">
            <div className="text-xs font-bold text-danger mb-1 uppercase tracking-wide">Flagship</div>
            <h3 className="font-bold text-navy-900 mb-1">QLD Youth Justice</h3>
            <p className="text-sm text-navy-500">$343M/year on detention. $1.3M per child. 73% reoffend.</p>
          </a>
          <a href="/reports/money-flow" className="group block bg-white border-2 border-link rounded-xl p-5 hover:shadow-md transition-all">
            <div className="text-xs font-bold text-link mb-1 uppercase tracking-wide">Live</div>
            <h3 className="font-bold text-navy-900 mb-1">Follow the Dollar</h3>
            <p className="text-sm text-navy-500">Trace funding flows from taxpayer to outcome.</p>
          </a>
          <a href="/reports/access-gap" className="group block bg-white border-2 border-warning rounded-xl p-5 hover:shadow-md transition-all">
            <div className="text-xs font-bold text-warning mb-1 uppercase tracking-wide">Live</div>
            <h3 className="font-bold text-navy-900 mb-1">The Access Gap</h3>
            <p className="text-sm text-navy-500">Small orgs spend 40% on admin. Large orgs spend 15%.</p>
          </a>
          <a href="/reports/power-dynamics" className="group block bg-white border-2 border-purple rounded-xl p-5 hover:shadow-md transition-all">
            <div className="text-xs font-bold text-purple mb-1 uppercase tracking-wide">Live</div>
            <h3 className="font-bold text-navy-900 mb-1">Power Dynamics</h3>
            <p className="text-sm text-navy-500">Who controls Australia&apos;s philanthropy?</p>
          </a>
        </div>
      </section>
    </div>
  );
}
