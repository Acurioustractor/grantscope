import { getServiceSupabase } from '@/lib/supabase';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'For Foundations | GrantScope Australia',
  description: 'Australia\'s most comprehensive foundation database. Understand the landscape, compare your portfolio, discover gaps.',
};

async function getStats() {
  const supabase = getServiceSupabase();

  const [totalResult, enrichedResult, programsResult, givingResult] = await Promise.all([
    supabase.from('foundations').select('*', { count: 'exact', head: true }),
    supabase.from('foundations').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
    supabase.from('foundation_programs').select('*', { count: 'exact', head: true }),
    supabase.from('foundations').select('total_giving_annual').not('total_giving_annual', 'is', null),
  ]);

  const totalGiving = givingResult.data?.reduce((sum: number, r: { total_giving_annual: number }) => sum + (r.total_giving_annual || 0), 0) || 0;

  return {
    totalFoundations: totalResult.count || 0,
    enrichedFoundations: enrichedResult.count || 0,
    totalPrograms: programsResult.count || 0,
    totalGiving,
  };
}

async function getTopFoundations() {
  const supabase = getServiceSupabase();

  const { data } = await supabase
    .from('foundations')
    .select('id, name, total_giving_annual, focus_areas')
    .not('total_giving_annual', 'is', null)
    .order('total_giving_annual', { ascending: false })
    .limit(6);

  return data || [];
}

export default async function ForFoundationsPage() {
  let stats = { totalFoundations: 0, enrichedFoundations: 0, totalPrograms: 0, totalGiving: 0 };
  let topFoundations: Array<{ id: string; name: string; total_giving_annual: number; focus_areas: string[] | null }> = [];

  try {
    [stats, topFoundations] = await Promise.all([getStats(), getTopFoundations()]);
  } catch {
    // DB not configured
  }

  const formatMoney = (n: number) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${n.toLocaleString()}`;
  };

  return (
    <div>
      {/* Hero */}
      <section className="py-16 sm:py-24">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-4">
          For Foundations
        </p>
        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-bauhaus-black mb-6 tracking-tight leading-[0.9]">
          See Where Your<br /><span className="text-bauhaus-blue">Giving Fits.</span>
        </h1>
        <p className="text-lg text-bauhaus-muted max-w-xl mb-10 leading-relaxed font-medium">
          Australia&apos;s most comprehensive foundation database. Understand the landscape,
          compare your portfolio, discover gaps.
        </p>
        <div className="flex gap-0 flex-wrap">
          <a
            href="/foundations"
            className="px-6 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-red transition-colors"
          >
            Explore Foundations
          </a>
          <a
            href="/reports"
            className="px-6 py-3 bg-white text-bauhaus-black font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-canvas transition-colors"
          >
            View Reports
          </a>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-4 border-bauhaus-black mb-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0">
          <div className="p-6 text-center border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
            <div className="text-3xl sm:text-4xl font-black tabular-nums">{stats.totalFoundations.toLocaleString()}</div>
            <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted">Foundations Mapped</div>
          </div>
          <div className="p-6 text-center border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black bg-bauhaus-blue/5">
            <div className="text-3xl sm:text-4xl font-black tabular-nums text-bauhaus-blue">{stats.enrichedFoundations.toLocaleString()}</div>
            <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted">AI-Profiled</div>
          </div>
          <div className="p-6 text-center border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black bg-bauhaus-yellow/10">
            <div className="text-3xl sm:text-4xl font-black tabular-nums">{stats.totalPrograms.toLocaleString()}</div>
            <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted">Programs</div>
          </div>
          <div className="p-6 text-center bg-money/5">
            <div className="text-3xl sm:text-4xl font-black tabular-nums text-money">{formatMoney(stats.totalGiving)}</div>
            <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted">Annual Giving</div>
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="mb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
            <h3 className="font-black text-bauhaus-black mb-2 text-sm uppercase tracking-widest">Peer Comparison</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              See how your thematic focus, geographic reach, and giving levels compare
              to other foundations in your sector.
            </p>
          </div>
          <div className="bg-white border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
            <h3 className="font-black text-bauhaus-black mb-2 text-sm uppercase tracking-widest">Gap Analysis</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              Identify underfunded sectors, geographies, and beneficiary groups.
              Find where your giving can make the biggest difference.
            </p>
          </div>
          <div className="bg-white border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
            <h3 className="font-black text-bauhaus-black mb-2 text-sm uppercase tracking-widest">Transparency</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              Your profile is already public via ACNC. Claim it and tell your story &mdash;
              show communities what you fund and why.
            </p>
          </div>
        </div>
      </section>

      {/* How It Helps */}
      <section className="border-t-4 border-bauhaus-black pt-12 mb-16">
        <h2 className="text-2xl font-black text-bauhaus-black mb-8">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { step: '1', title: 'Search Foundations', desc: 'Find your foundation or browse by focus area, geography, or giving level.' },
            { step: '2', title: 'Compare Giving Patterns', desc: 'See how your portfolio compares to peers in the same thematic space.' },
            { step: '3', title: 'Identify Gaps', desc: 'Discover underfunded regions, sectors, and communities where your giving fits.' },
            { step: '4', title: 'Claim Your Profile', desc: 'Take ownership of your foundation page. Add context, programs, and impact data.' },
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

      {/* Data Preview — Top Foundations */}
      <section className="border-4 border-bauhaus-black mb-16">
        <div className="bg-bauhaus-red px-6 py-3">
          <h2 className="text-xs font-black text-white uppercase tracking-[0.3em]">Top Foundations by Annual Giving</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0">
          {topFoundations.length > 0 ? topFoundations.map((f, i) => (
            <a
              key={f.id}
              href={`/foundations?q=${encodeURIComponent(f.name)}`}
              className={`block px-6 py-5 hover:bg-bauhaus-canvas transition-colors ${
                i < topFoundations.length - 1 ? 'border-b-4 lg:border-b-4 border-bauhaus-black' : ''
              } ${(i % 3 !== 2 && i < topFoundations.length - 1) ? 'lg:border-r-4' : ''} ${(i % 2 !== 1) ? 'sm:border-r-4 lg:border-r-0' : ''}`}
            >
              <div className="text-2xl font-black tabular-nums text-money mb-1">{formatMoney(f.total_giving_annual)}</div>
              <div className="font-black text-sm text-bauhaus-black truncate">{f.name}</div>
              {f.focus_areas && f.focus_areas.length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {f.focus_areas.slice(0, 3).map((area) => (
                    <span key={area} className="text-[10px] font-bold text-bauhaus-muted uppercase tracking-wider px-2 py-0.5 border-2 border-bauhaus-black/10">
                      {area}
                    </span>
                  ))}
                </div>
              )}
            </a>
          )) : (
            <div className="px-6 py-8 text-center text-sm text-bauhaus-muted col-span-3">No foundation data available</div>
          )}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t-4 border-bauhaus-black pt-12 pb-8 text-center">
        <h2 className="text-2xl sm:text-3xl font-black text-bauhaus-black mb-4">Is Your Foundation Listed?</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-md mx-auto">
          Your ACNC data is already public. Claim your profile to add programs, focus areas, and impact data.
        </p>
        <a
          href="/charities/claim"
          className="inline-block px-6 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-red transition-colors"
        >
          Claim Your Foundation
        </a>
      </section>
    </div>
  );
}
