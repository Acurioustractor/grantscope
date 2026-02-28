import { getServiceSupabase } from '@/lib/supabase';
import { ArchitectureDiagram } from './diagram';

export const dynamic = 'force-dynamic';

async function getLiveStats() {
  try {
    const supabase = getServiceSupabase();
    const [foundations, grants, profiled, programs, communityOrgs, flows] = await Promise.all([
      supabase.from('foundations').select('*', { count: 'exact', head: true }),
      supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }),
      supabase.from('foundations').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
      supabase.from('foundation_programs').select('*', { count: 'exact', head: true }),
      supabase.from('community_orgs').select('*', { count: 'exact', head: true }),
      supabase.from('money_flows').select('*', { count: 'exact', head: true }),
    ]);

    return {
      foundations: foundations.count || 0,
      grants: grants.count || 0,
      profiled: profiled.count || 0,
      programs: programs.count || 0,
      communityOrgs: communityOrgs.count || 0,
      moneyFlows: flows.count || 0,
    };
  } catch {
    return { foundations: 0, grants: 0, profiled: 0, programs: 0, communityOrgs: 0, moneyFlows: 0 };
  }
}

export default async function HowItWorksPage() {
  const stats = await getLiveStats();

  return (
    <div>
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-900 mb-3">How GrantScope Works</h1>
        <p className="text-navy-500 max-w-2xl mx-auto leading-relaxed">
          Open-source infrastructure that scrapes, enriches, and connects Australian funding data.
          Every number on this page is live from our database.
        </p>
      </div>

      <ArchitectureDiagram stats={stats} />

      {/* Text explainer below the diagram */}
      <div className="max-w-3xl mx-auto mt-16 space-y-12">

        <section>
          <h2 className="text-xl font-bold text-navy-900 mb-3 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-money-light text-money flex items-center justify-center text-sm font-bold">1</span>
            Data Sources
          </h2>
          <p className="text-navy-600 leading-relaxed mb-4">
            We pull from 6 live sources across federal, state, and philanthropic registries.
            Every source has a dedicated scraper plugin that handles its unique format — RSS feeds,
            CKAN APIs, HTML scraping, and AI-powered web search.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { name: 'GrantConnect', detail: 'Federal grants (RSS)' },
              { name: 'QLD Grants Finder', detail: 'State grants (CKAN)' },
              { name: 'data.gov.au', detail: 'Open datasets' },
              { name: 'business.gov.au', detail: 'Business programs' },
              { name: 'ACNC Register', detail: 'Charity data' },
              { name: 'AI Web Search', detail: 'Gap-filling' },
            ].map(s => (
              <div key={s.name} className="bg-white border border-navy-200 rounded-lg px-3 py-2">
                <div className="text-sm font-semibold text-navy-900">{s.name}</div>
                <div className="text-xs text-navy-400">{s.detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-navy-900 mb-3 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-purple-light text-purple flex items-center justify-center text-sm font-bold">2</span>
            AI Enrichment
          </h2>
          <p className="text-navy-600 leading-relaxed">
            Raw registry data only tells you a foundation exists. Our AI profiler scrapes foundation
            websites, reads their annual reports, and extracts giving philosophy, focus areas,
            application tips, grant ranges, and board members. We rotate across 8 LLM providers
            (Gemini, DeepSeek, Groq, OpenAI, Anthropic, and more) using free tiers first to keep
            costs under $10/month.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-navy-900 mb-3 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-link-light text-link flex items-center justify-center text-sm font-bold">3</span>
            Living Reports
          </h2>
          <p className="text-navy-600 leading-relaxed">
            Our report engines run analysis across the entire dataset — tracing money flows from
            taxpayer to outcome, measuring power concentration (Gini coefficients, HHI indices),
            and quantifying the admin burden that structurally disadvantages small community
            organisations. Reports update automatically as new data arrives.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-navy-900 mb-3 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-navy-100 text-navy-600 flex items-center justify-center text-sm font-bold">4</span>
            Autonomous Agents
          </h2>
          <p className="text-navy-600 leading-relaxed">
            Three background agents keep the data fresh without human intervention:
            the <strong>Grant Monitor</strong> runs daily to find new grants,
            the <strong>Foundation Watcher</strong> checks websites weekly for program changes,
            and the <strong>Spend Watcher</strong> tracks government budget allocations quarterly.
            Every agent run is logged for full transparency.
          </p>
        </section>

        <section className="border-t border-navy-200 pt-8">
          <h2 className="text-xl font-bold text-navy-900 mb-3">What&apos;s Coming Next</h2>
          <div className="space-y-3">
            {[
              { name: 'State Grant Portals', detail: 'Scrapers for NSW, VIC, WA, SA, TAS grant registries', status: 'In progress' },
              { name: 'ASX200 Corporate Giving', detail: 'Map company foundations to revenue-vs-giving ratios from sustainability reports', status: 'Planned' },
              { name: 'Eligibility Matcher', detail: 'Match your organisation to grants you\'re eligible for based on focus areas, size, and location', status: 'Planned' },
              { name: 'Public API', detail: 'REST API with OpenAPI spec so anyone can build on this data', status: 'Planned' },
            ].map(item => (
              <div key={item.name} className="flex items-start gap-3 bg-white border border-navy-200 rounded-lg p-4">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-0.5 flex-shrink-0 ${
                  item.status === 'In progress' ? 'bg-warning-light text-warning' : 'bg-navy-100 text-navy-500'
                }`}>{item.status}</span>
                <div>
                  <div className="font-semibold text-navy-900 text-sm">{item.name}</div>
                  <div className="text-sm text-navy-500">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="text-center pb-8">
          <p className="text-sm text-navy-400">
            GrantScope is fully open source. All code, scrapers, and data pipelines are public.
          </p>
        </section>
      </div>
    </div>
  );
}
