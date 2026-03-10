import { getServiceSupabase } from '@/lib/supabase';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'For Researchers | CivicGraph Australia',
  description: 'Open data on how money flows through society. 99,000+ entities. 672,000 contracts. 312,000 donations. Three layers of market intelligence — all searchable, all transparent.',
};

async function getStats() {
  const supabase = getServiceSupabase();

  const [acncResult, grantsResult] = await Promise.all([
    supabase.from('acnc_ais').select('*', { count: 'exact', head: true }),
    supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }),
  ]);

  // Distinct source count
  const { data: sourceSample } = await supabase.from('grant_opportunities')
    .select('source')
    .limit(10000);
  const sourceCount = sourceSample ? new Set(sourceSample.map((r: { source: string }) => r.source)).size : 0;

  return {
    acncRecords: acncResult.count || 0,
    totalGrants: grantsResult.count || 0,
    dataSources: sourceCount,
  };
}

export default async function ForResearchersPage() {
  let stats = { acncRecords: 0, totalGrants: 0, dataSources: 0 };

  try {
    stats = await getStats();
  } catch {
    // DB not configured
  }

  const reports = [
    {
      title: '$222 Billion',
      subtitle: 'Where Australia\'s charity money actually goes',
      stat: '359,678 financial records',
      href: '/reports/big-philanthropy',
      color: 'bg-bauhaus-black',
      textColor: 'text-white',
      hoverShadow: '6px 6px 0px 0px var(--color-bauhaus-red)',
    },
    {
      title: 'Community Parity',
      subtitle: 'Who benefits, who misses out, and why',
      stat: '0.5% to First Nations',
      href: '/reports/community-parity',
      color: 'bg-bauhaus-red',
      textColor: 'text-white',
      hoverShadow: '6px 6px 0px 0px var(--color-bauhaus-black)',
    },
    {
      title: 'Power Dynamics',
      subtitle: 'Concentration, inequality, and who controls the levers',
      stat: '94% to top 10%',
      href: '/reports/power-dynamics',
      color: 'bg-white',
      textColor: 'text-bauhaus-black',
      hoverShadow: undefined,
    },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="py-16 sm:py-24">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-4">
          For Researchers
        </p>
        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-bauhaus-black mb-6 tracking-tight leading-[0.9]">
          Open Data on<br />How Money Flows<br /><span className="text-bauhaus-blue">Through Society.</span>
        </h1>
        <p className="text-lg text-bauhaus-muted max-w-xl mb-10 leading-relaxed font-medium">
          99,000+ entities. 672,000 contracts. 312,000 political donations.
          {stats.acncRecords.toLocaleString()} financial records. Three layers of market intelligence — all open.
        </p>
        <div className="flex gap-0 flex-wrap">
          <a
            href="/reports"
            className="px-6 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-red transition-colors"
          >
            View Living Reports
          </a>
          <a
            href="/dashboard"
            className="px-6 py-3 bg-white text-bauhaus-black font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-canvas transition-colors"
          >
            Explore Dashboard
          </a>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-4 border-bauhaus-black mb-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0">
          <div className="p-6 text-center border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
            <div className="text-3xl sm:text-4xl font-black tabular-nums">{stats.acncRecords.toLocaleString()}</div>
            <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted">Financial Records</div>
          </div>
          <div className="p-6 text-center border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black bg-bauhaus-blue/5">
            <div className="text-3xl sm:text-4xl font-black tabular-nums text-bauhaus-blue">{stats.dataSources}</div>
            <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted">Data Sources</div>
          </div>
          <div className="p-6 text-center border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black bg-bauhaus-yellow/10">
            <div className="text-3xl sm:text-4xl font-black tabular-nums">7</div>
            <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted">Years of History</div>
          </div>
          <div className="p-6 text-center bg-money/5">
            <div className="text-3xl sm:text-4xl font-black text-money">100%</div>
            <div className="text-xs font-black uppercase tracking-widest mt-1 text-bauhaus-muted">Open Access</div>
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="mb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
            <h3 className="font-black text-bauhaus-black mb-2 text-sm uppercase tracking-widest">Market Intelligence</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              Data-driven investigations updated as new data arrives. Procurement patterns,
              donation networks, power dynamics &mdash; all with live numbers.
            </p>
          </div>
          <div className="bg-white border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
            <h3 className="font-black text-bauhaus-black mb-2 text-sm uppercase tracking-widest">Full Transparency</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              Every number is traceable. Every methodology is documented.
              Every data source cited. We show the work.
            </p>
          </div>
          <div className="bg-white border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
            <h3 className="font-black text-bauhaus-black mb-2 text-sm uppercase tracking-widest">Build in Public</h3>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              See our pipeline, our known gaps, our methodology.
              Open source infrastructure &mdash; fork it, extend it, improve it.
            </p>
          </div>
        </div>
      </section>

      {/* How It Helps */}
      <section className="border-t-4 border-bauhaus-black pt-12 mb-16">
        <h2 className="text-2xl font-black text-bauhaus-black mb-8">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { step: '1', title: 'Browse Reports', desc: 'Start with our living investigations into funding flows, equity, and power.' },
            { step: '2', title: 'Explore Dashboard', desc: 'Interactive views across grants, foundations, charities, and financial data.' },
            { step: '3', title: 'Trace Funding Flows', desc: 'Follow the dollar from taxpayer or donor through to community impact.' },
            { step: '4', title: 'Export Data', desc: 'Download datasets, cite our methodology, and build on our open infrastructure.' },
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

      {/* Data Preview — Report Cards */}
      <section className="mb-16">
        <h2 className="text-xs font-black text-bauhaus-muted uppercase tracking-[0.3em] mb-6">Featured Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {reports.map((report) => (
            <a key={report.href} href={report.href} className="group block">
              <div
                className={`${report.color} border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1`}
                style={report.hoverShadow ? { boxShadow: report.hoverShadow } : undefined}
              >
                <div className={`text-xs font-black mb-2 uppercase tracking-widest ${report.color === 'bg-white' ? 'text-bauhaus-muted' : 'text-bauhaus-yellow'}`}>
                  {report.stat}
                </div>
                <h3 className={`text-xl font-black mb-2 ${report.textColor}`}>{report.title}</h3>
                <p className={`text-sm leading-relaxed ${report.color === 'bg-white' ? 'text-bauhaus-muted' : 'text-white/80'}`}>
                  {report.subtitle}
                </p>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t-4 border-bauhaus-black pt-12 pb-8 text-center">
        <h2 className="text-2xl sm:text-3xl font-black text-bauhaus-black mb-4">Built on Open Data</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-md mx-auto">
          Every data source, every methodology, every line of code &mdash; open and documented.
        </p>
        <div className="flex gap-0 justify-center flex-wrap">
          <a
            href="/how-it-works"
            className="px-6 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-red transition-colors"
          >
            How It Works
          </a>
          <a
            href="/architecture"
            className="px-6 py-3 bg-white text-bauhaus-black font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-canvas transition-colors"
          >
            Architecture
          </a>
        </div>
      </section>
    </div>
  );
}
