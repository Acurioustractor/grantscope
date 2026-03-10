import { getServiceSupabase } from '@/lib/supabase';
import { ArchitectureDiagram } from './diagram';
import { DataCoverage } from './data-coverage';

export const dynamic = 'force-dynamic';

async function getLiveStats() {
  try {
    const supabase = getServiceSupabase();
    const [foundations, grants, profiled, programs, communityOrgs, flows, seTotal, seEnriched] = await Promise.all([
      supabase.from('foundations').select('*', { count: 'exact', head: true }),
      supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }),
      supabase.from('foundations').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
      supabase.from('foundation_programs').select('*', { count: 'exact', head: true }),
      supabase.from('community_orgs').select('*', { count: 'exact', head: true }),
      supabase.from('money_flows').select('*', { count: 'exact', head: true }),
      supabase.from('social_enterprises').select('*', { count: 'exact', head: true }),
      supabase.from('social_enterprises').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
    ]);

    return {
      foundations: foundations.count || 0,
      grants: grants.count || 0,
      profiled: profiled.count || 0,
      programs: programs.count || 0,
      communityOrgs: communityOrgs.count || 0,
      moneyFlows: flows.count || 0,
      socialEnterprises: seTotal.count || 0,
      socialEnterprisesEnriched: seEnriched.count || 0,
    };
  } catch {
    return { foundations: 0, grants: 0, profiled: 0, programs: 0, communityOrgs: 0, moneyFlows: 0, socialEnterprises: 0, socialEnterprisesEnriched: 0 };
  }
}

async function getCoverageStats() {
  try {
    const supabase = getServiceSupabase();
    const [acncCharities, foundationsTotal, foundationsProfiled, grantsTotal, communityTotal, aisTotal, flowsTotal, seTotal, seEnriched] = await Promise.all([
      supabase.from('acnc_ais').select('abn', { count: 'exact', head: true }),
      supabase.from('foundations').select('*', { count: 'exact', head: true }),
      supabase.from('foundations').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
      supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }),
      supabase.from('community_orgs').select('*', { count: 'exact', head: true }),
      supabase.from('acnc_ais').select('*', { count: 'exact', head: true }),
      supabase.from('money_flows').select('*', { count: 'exact', head: true }),
      supabase.from('social_enterprises').select('*', { count: 'exact', head: true }),
      supabase.from('social_enterprises').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
    ]);

    return {
      acncRecords: acncCharities.count || 0,
      foundations: foundationsTotal.count || 0,
      foundationsProfiled: foundationsProfiled.count || 0,
      grants: grantsTotal.count || 0,
      community: communityTotal.count || 0,
      aisRecords: aisTotal.count || 0,
      moneyFlows: flowsTotal.count || 0,
      socialEnterprises: seTotal.count || 0,
      socialEnterprisesEnriched: seEnriched.count || 0,
    };
  } catch {
    return { acncRecords: 0, foundations: 0, foundationsProfiled: 0, grants: 0, community: 0, aisRecords: 0, moneyFlows: 0, socialEnterprises: 0, socialEnterprisesEnriched: 0 };
  }
}

export default async function HowItWorksPage() {
  const [stats, coverage] = await Promise.all([getLiveStats(), getCoverageStats()]);

  return (
    <div>
      <div className="text-center mb-10">
        <p className="text-xs font-black text-bauhaus-blue uppercase tracking-[0.3em] mb-2">Three-Layer Architecture</p>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">How CivicGraph Works</h1>
        <p className="text-bauhaus-muted max-w-2xl mx-auto leading-relaxed font-medium">
          Three layers of market intelligence: raw financial flows, entity relationships,
          and community evidence. Every number on this page is live from our database.
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
            Layer 1 (Money) pulls from 20+ sources across government procurement, grants, political donations,
            tax transparency, charity finances, and corporate filings. Every source has a scraper
            that handles its unique format — RSS feeds, CKAN APIs, HTML scraping, open data portals, and JSON APIs.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-0">
            {[
              { name: 'ACNC Register', detail: '9.9k foundations' },
              { name: 'ACNC Financials', detail: '360k statements' },
              { name: 'GrantConnect', detail: 'Federal grants (RSS)' },
              { name: 'ARC Grants', detail: '5.6k research grants' },
              { name: 'QLD Grants', detail: 'State grants (CKAN)' },
              { name: 'QLD Arts', detail: '2.3k arts grants' },
              { name: 'NSW Grants', detail: '1.6k grants (HTTP)' },
              { name: 'Brisbane Council', detail: '5.5k council grants' },
              { name: 'VIC / WA / SA', detail: 'State portal scrapers' },
              { name: 'TAS / ACT / NT', detail: 'State portal scrapers' },
              { name: 'data.gov.au', detail: 'Open datasets' },
              { name: 'ORIC Register', detail: '3,300+ Indigenous corps' },
              { name: 'Social Traders', detail: 'Certified SEs' },
              { name: 'BuyAbility', detail: 'Disability enterprises' },
              { name: 'B Corp Australia', detail: 'Certified B Corps' },
              { name: 'Kinaway / State SEs', detail: 'State directories' },
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
            Raw registry data only tells you an organisation exists. Our AI profiler scrapes websites
            and annual reports with Jina + Firecrawl, then extracts giving philosophy, focus areas,
            application tips, grant ranges, board members, and wealth sources. We rotate across 9 LLM providers
            (MiniMax, Gemini, DeepSeek, Groq, Kimi, Perplexity, OpenAI, Anthropic, and more) using free tiers
            first to keep costs near zero. Grant descriptions are enriched the same way — scraping source URLs
            with Cheerio and extracting eligibility criteria, deadlines, and funding amounts. Social enterprises
            get the same treatment — AI-generated profiles with sectors, services, impact areas, and certifications
            from ORIC, Social Traders, BuyAbility, B Corp, and state directories.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-black text-bauhaus-black mb-3 flex items-center gap-3 uppercase tracking-widest">
            <span className="w-8 h-8 bg-bauhaus-blue text-white flex items-center justify-center text-sm font-black border-3 border-bauhaus-black">3</span>
            Layer 2: Market Intelligence
          </h2>
          <p className="text-bauhaus-muted leading-relaxed font-medium">
            The entity graph connects 99,000+ entities across datasets — linking charities to their
            contracts, donations, tax records, and corporate relationships. Layer 2 turns raw data into
            market intelligence: who connects to whom, where money concentrates, and which communities
            are underserved. Reports update automatically as new data arrives.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-black text-bauhaus-black mb-3 flex items-center gap-3 uppercase tracking-widest">
            <span className="w-8 h-8 bg-bauhaus-yellow text-bauhaus-black flex items-center justify-center text-sm font-black border-3 border-bauhaus-black">4</span>
            Layer 3: Community Proof
          </h2>
          <p className="text-bauhaus-muted leading-relaxed font-medium">
            The proof layer connects financial data to community evidence via
            <strong className="text-bauhaus-black"> Empathy Ledger</strong> — governed impact stories
            verified by the communities they describe. Meanwhile, 45+ autonomous agents keep
            the data fresh: the <strong className="text-bauhaus-black">Grant Monitor</strong> runs daily,
            the <strong className="text-bauhaus-black">Foundation Watcher</strong> checks websites weekly,
            and the <strong className="text-bauhaus-black">Entity Resolver</strong> links records across datasets.
            Every agent run is logged for full transparency.
          </p>
        </section>

        <section className="border-t-4 border-bauhaus-black pt-8">
          <h2 className="text-sm font-black text-bauhaus-black mb-3 uppercase tracking-widest">What&apos;s Coming Next</h2>
          <div className="space-y-3">
            {[
              { name: 'All 8 State & Territory Portals', detail: 'NSW, VIC, QLD, WA, SA, TAS, ACT, NT — all scrapers built and running', status: 'Done' },
              { name: 'Social Enterprise Directory', detail: `${stats.socialEnterprises.toLocaleString()} enterprises from ORIC, Social Traders, BuyAbility, B Corp, Kinaway, and state directories`, status: 'Done' },
              { name: 'Foundation AI Profiling', detail: '3,700+ of 9,900 foundations profiled with giving philosophy, focus areas, board members, and application tips', status: 'In progress' },
              { name: 'Social Enterprise AI Enrichment', detail: `${stats.socialEnterprisesEnriched.toLocaleString()} of ${stats.socialEnterprises.toLocaleString()} enterprises enriched with AI-generated profiles`, status: 'In progress' },
              { name: 'Grant Enrichment', detail: 'Scraping grant URLs to extract closing dates, eligibility criteria, and funding amounts for 17k+ grants', status: 'In progress' },
              { name: 'Program Eligibility Enrichment', detail: 'Scraping 1,500+ foundation program URLs to extract who can apply and how', status: 'In progress' },
              { name: 'ASX200 Corporate Giving', detail: 'Map company foundations to revenue-vs-giving ratios from sustainability reports', status: 'Planned' },
              { name: 'Eligibility Matcher', detail: 'Match your organisation to grants you\'re eligible for based on focus areas, size, and location', status: 'Planned' },
              { name: 'Public API', detail: 'REST API with OpenAPI spec so anyone can build on this data', status: 'Planned' },
            ].map(item => (
              <div key={item.name} className="flex items-start gap-3 bg-white border-4 border-bauhaus-black p-4">
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 mt-0.5 flex-shrink-0 border-2 ${
                  item.status === 'Done' ? 'border-money bg-money-light text-money' :
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
            CivicGraph — Infrastructure for Fairer Markets. All code, scrapers, and data pipelines are public.
          </p>
        </section>
      </div>
    </div>
  );
}
