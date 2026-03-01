import { getServiceSupabase } from '@/lib/supabase';
import { ArchitectureDiagram } from './diagram';
import { DataCoverage } from './data-coverage';

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

async function getCoverageStats() {
  try {
    const supabase = getServiceSupabase();
    const [acncCharities, foundationsTotal, foundationsProfiled, grantsTotal, communityTotal, aisTotal, flowsTotal] = await Promise.all([
      supabase.from('acnc_ais').select('abn', { count: 'exact', head: true }),
      supabase.from('foundations').select('*', { count: 'exact', head: true }),
      supabase.from('foundations').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
      supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }),
      supabase.from('community_orgs').select('*', { count: 'exact', head: true }),
      supabase.from('acnc_ais').select('*', { count: 'exact', head: true }),
      supabase.from('money_flows').select('*', { count: 'exact', head: true }),
    ]);

    return {
      acncRecords: acncCharities.count || 0,
      foundations: foundationsTotal.count || 0,
      foundationsProfiled: foundationsProfiled.count || 0,
      grants: grantsTotal.count || 0,
      community: communityTotal.count || 0,
      aisRecords: aisTotal.count || 0,
      moneyFlows: flowsTotal.count || 0,
    };
  } catch {
    return { acncRecords: 0, foundations: 0, foundationsProfiled: 0, grants: 0, community: 0, aisRecords: 0, moneyFlows: 0 };
  }
}

export default async function HowItWorksPage() {
  const [stats, coverage] = await Promise.all([getLiveStats(), getCoverageStats()]);

  return (
    <div>
      <div className="text-center mb-10">
        <p className="text-xs font-black text-bauhaus-blue uppercase tracking-[0.3em] mb-2">Architecture</p>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">How GrantScope Works</h1>
        <p className="text-bauhaus-muted max-w-2xl mx-auto leading-relaxed font-medium">
          Open-source infrastructure that scrapes, enriches, and connects Australian funding data.
          Every number on this page is live from our database.
        </p>
      </div>

      <ArchitectureDiagram stats={stats} />

      <DataCoverage coverage={coverage} />

      <div className="max-w-3xl mx-auto mt-16 space-y-12">

        <section>
          <h2 className="text-sm font-black text-bauhaus-black mb-3 flex items-center gap-3 uppercase tracking-widest">
            <span className="w-8 h-8 bg-money text-white flex items-center justify-center text-sm font-black border-3 border-bauhaus-black">1</span>
            Data Sources
          </h2>
          <p className="text-bauhaus-muted leading-relaxed mb-4 font-medium">
            We pull from 10+ live sources across federal, state, and philanthropic registries.
            Every source has a dedicated scraper plugin that handles its unique format — RSS feeds,
            CKAN APIs, HTML scraping, open data portals, and AI-powered web search.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-0">
            {[
              { name: 'ACNC Register', detail: '9.8k foundations' },
              { name: 'ACNC Financials', detail: '359k statements' },
              { name: 'GrantConnect', detail: 'Federal grants (RSS)' },
              { name: 'QLD Grants', detail: 'State grants (CKAN)' },
              { name: 'QLD Arts', detail: '3.8k arts grants' },
              { name: 'NSW Grants', detail: 'Direct HTTP scrape' },
              { name: 'Brisbane Council', detail: '5.5k council grants' },
              { name: 'data.gov.au', detail: 'Open datasets' },
              { name: 'business.gov.au', detail: 'Business programs' },
              { name: 'AI Web Search', detail: 'Gap-filling' },
            ].map(s => (
              <div key={s.name} className="bg-white border-4 border-bauhaus-black px-3 py-2 -mt-[4px] -ml-[4px]">
                <div className="text-sm font-black text-bauhaus-black">{s.name}</div>
                <div className="text-xs text-bauhaus-muted font-medium">{s.detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-black text-bauhaus-black mb-3 flex items-center gap-3 uppercase tracking-widest">
            <span className="w-8 h-8 bg-bauhaus-red text-white flex items-center justify-center text-sm font-black border-3 border-bauhaus-black rounded-full">2</span>
            AI Enrichment
          </h2>
          <p className="text-bauhaus-muted leading-relaxed font-medium">
            Raw registry data only tells you a foundation exists. Our AI profiler scrapes foundation
            websites, reads their annual reports, and extracts giving philosophy, focus areas,
            application tips, grant ranges, and board members. We rotate across 8 LLM providers
            (Gemini, DeepSeek, Groq, OpenAI, Anthropic, and more) using free tiers first to keep
            costs under $10/month.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-black text-bauhaus-black mb-3 flex items-center gap-3 uppercase tracking-widest">
            <span className="w-8 h-8 bg-bauhaus-blue text-white flex items-center justify-center text-sm font-black border-3 border-bauhaus-black">3</span>
            Living Reports
          </h2>
          <p className="text-bauhaus-muted leading-relaxed font-medium">
            Our report engines run analysis across the entire dataset — tracing money flows from
            taxpayer to outcome, measuring power concentration (Gini coefficients, HHI indices),
            and quantifying the admin burden that structurally disadvantages small community
            organisations. Reports update automatically as new data arrives.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-black text-bauhaus-black mb-3 flex items-center gap-3 uppercase tracking-widest">
            <span className="w-8 h-8 bg-bauhaus-yellow text-bauhaus-black flex items-center justify-center text-sm font-black border-3 border-bauhaus-black">4</span>
            Autonomous Agents
          </h2>
          <p className="text-bauhaus-muted leading-relaxed font-medium">
            Three background agents keep the data fresh without human intervention:
            the <strong className="text-bauhaus-black">Grant Monitor</strong> runs daily to find new grants,
            the <strong className="text-bauhaus-black">Foundation Watcher</strong> checks websites weekly for program changes,
            and the <strong className="text-bauhaus-black">Spend Watcher</strong> tracks government budget allocations quarterly.
            Every agent run is logged for full transparency.
          </p>
        </section>

        <section className="border-t-4 border-bauhaus-black pt-8">
          <h2 className="text-sm font-black text-bauhaus-black mb-3 uppercase tracking-widest">What&apos;s Coming Next</h2>
          <div className="space-y-3">
            {[
              { name: 'State Grant Portals', detail: 'Scrapers for NSW, VIC, WA, SA, TAS grant registries', status: 'In progress' },
              { name: 'ASX200 Corporate Giving', detail: 'Map company foundations to revenue-vs-giving ratios from sustainability reports', status: 'Planned' },
              { name: 'Eligibility Matcher', detail: 'Match your organisation to grants you\'re eligible for based on focus areas, size, and location', status: 'Planned' },
              { name: 'Public API', detail: 'REST API with OpenAPI spec so anyone can build on this data', status: 'Planned' },
            ].map(item => (
              <div key={item.name} className="flex items-start gap-3 bg-white border-4 border-bauhaus-black p-4">
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 mt-0.5 flex-shrink-0 border-2 ${
                  item.status === 'In progress' ? 'border-bauhaus-yellow bg-warning-light text-bauhaus-black' : 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted'
                }`}>{item.status}</span>
                <div>
                  <div className="font-black text-bauhaus-black text-sm">{item.name}</div>
                  <div className="text-sm text-bauhaus-muted font-medium">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="text-center pb-8">
          <p className="text-sm text-bauhaus-muted font-bold uppercase tracking-widest">
            GrantScope is fully open source. All code, scrapers, and data pipelines are public.
          </p>
        </section>
      </div>
    </div>
  );
}
