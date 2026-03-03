import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Architecture — GrantScope',
  description: 'GrantScope platform architecture: data sources, pipelines, APIs, and database',
};

async function getArchStats() {
  const supabase = getServiceSupabase();

  const [grants, foundations, acnc, programs, community, orgProfiles, savedGrants, discoveryRuns, moneyFlows, descriptions, embedded, profiled] = await Promise.all([
    supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }),
    supabase.from('foundations').select('*', { count: 'exact', head: true }),
    supabase.from('acnc_ais').select('*', { count: 'exact', head: true }),
    supabase.from('foundation_programs').select('*', { count: 'exact', head: true }),
    supabase.from('community_orgs').select('*', { count: 'exact', head: true }),
    supabase.from('org_profiles').select('*', { count: 'exact', head: true }),
    supabase.from('saved_grants').select('*', { count: 'exact', head: true }),
    supabase.from('grant_discovery_runs').select('*', { count: 'exact', head: true }),
    supabase.from('money_flows').select('*', { count: 'exact', head: true }),
    supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }).not('description', 'is', null),
    supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }).not('embedding', 'is', null),
    supabase.from('foundations').select('*', { count: 'exact', head: true }).not('description', 'is', null),
  ]);

  return {
    grants: grants.count || 0,
    foundations: foundations.count || 0,
    acnc: acnc.count || 0,
    programs: programs.count || 0,
    community: community.count || 0,
    orgProfiles: orgProfiles.count || 0,
    savedGrants: savedGrants.count || 0,
    discoveryRuns: discoveryRuns.count || 0,
    moneyFlows: moneyFlows.count || 0,
    descriptions: descriptions.count || 0,
    embedded: embedded.count || 0,
    profiled: profiled.count || 0,
  };
}

function fmt(n: number) {
  return n.toLocaleString('en-AU');
}

function pct(part: number, total: number) {
  if (!total) return '0';
  return ((part / total) * 100).toFixed(1);
}

export default async function ArchitecturePage() {
  const s = await getArchStats();

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-8">
      {/* Header */}
      <div className="bg-bauhaus-black px-6 py-8 border-b-[6px] border-bauhaus-red">
        <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
          Architecture
        </h1>
        <p className="text-xs text-bauhaus-muted mt-1 uppercase tracking-widest">
          Data sources, pipelines, APIs, and database — live stats
        </p>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap border-b-4 border-bauhaus-black bg-white">
        {[
          { val: fmt(s.grants), label: 'Grants' },
          { val: fmt(s.foundations), label: 'Foundations' },
          { val: fmt(s.acnc), label: 'ACNC Records' },
          { val: fmt(s.programs), label: 'Programs' },
          { val: fmt(s.community), label: 'Community Orgs' },
          { val: '13', label: 'Data Sources' },
        ].map((stat) => (
          <div key={stat.label} className="flex-1 min-w-[100px] px-4 py-4 text-center border-r-3 border-bauhaus-black last:border-r-0">
            <div className="text-xl font-black">{stat.val}</div>
            <div className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-bauhaus-muted mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-10">

        {/* Pages & API Routes */}
        <Section title="Pages & API Routes">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card header="Public Pages (11)" color="bg-[#2d6a4f]">
              <RouteItem path="/" detail="Homepage + live stats" />
              <RouteItem path="/grants" detail="Search + filter all grants" />
              <RouteItem path="/grants/[id]" detail="Grant detail page" />
              <RouteItem path="/foundations" detail="Browse foundations" />
              <RouteItem path="/foundations/[id]" detail="Foundation detail" />
              <RouteItem path="/corporate" detail="Corporate giving" />
              <RouteItem path="/charities/[abn]" detail="Charity detail" />
              <RouteItem path="/simulator" detail="Application simulator" />
              <RouteItem path="/how-it-works" detail="Data coverage" />
              <RouteItem path="/process" detail="Pipeline explainer" />
              <RouteItem path="/login" detail="Team sign-in" />
            </Card>

            <Card header="Auth-Gated Pages (5)" color="bg-bauhaus-red">
              <RouteItem path="/dashboard" detail="Overview metrics" auth />
              <RouteItem path="/profile" detail="Org profile + matching" auth />
              <RouteItem path="/profile/matches" detail="Matched grants feed" auth />
              <RouteItem path="/tracker" detail="Saved grants pipeline" auth />
              <RouteItem path="/ops" detail="Operations dashboard" auth />
            </Card>

            <Card header="Reports (6)" color="bg-[#2d6a4f]">
              <RouteItem path="/reports" detail="Reports index" />
              <RouteItem path="/reports/big-philanthropy" detail="Top 50 foundations" />
              <RouteItem path="/reports/money-flow" detail="Extraction to community" />
              <RouteItem path="/reports/power-dynamics" detail="Who controls the money" />
              <RouteItem path="/reports/access-gap" detail="Regional vs metro" />
              <RouteItem path="/reports/youth-justice" detail="QLD youth justice" />
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <Card header="Search & Discovery APIs (7)" color="bg-[#457b9d]">
              <RouteItem path="GET /api/search" detail="Text search grants" />
              <RouteItem path="GET /api/search/semantic" detail="Vector similarity" />
              <RouteItem path="GET /api/discover" detail="Discovery feed" />
              <RouteItem path="GET /api/foundations" detail="Foundation listing" />
              <RouteItem path="GET /api/dashboard" detail="Dashboard metrics" />
              <RouteItem path="GET /api/data" detail="Data export (JSON)" />
              <RouteItem path="GET /api/data/export" detail="CSV/Excel export" />
            </Card>

            <Card header="Profile, Tracker & Other APIs (11)" color="bg-bauhaus-red">
              <RouteItem path="GET /api/profile" detail="Fetch org profile" auth />
              <RouteItem path="PUT /api/profile" detail="Save + embed profile" auth />
              <RouteItem path="GET /api/profile/matches" detail="Vector match grants" auth />
              <RouteItem path="GET /api/tracker" detail="Saved grants list" auth />
              <RouteItem path="PUT /api/tracker/[id]" detail="Save/update grant" auth />
              <RouteItem path="POST /api/auth/signout" detail="Sign out" />
              <RouteItem path="GET /api/reports/money-flow" detail="Money flow data" />
              <RouteItem path="GET /api/reports/youth-justice" detail="Youth justice data" />
              <RouteItem path="POST /api/chat" detail="AI grants chat" />
              <RouteItem path="POST /api/simulator" detail="Application scoring" />
              <RouteItem path="POST /api/feedback" detail="User feedback" />
            </Card>
          </div>
        </Section>

        {/* Data Pipelines */}
        <Section title="Data Pipeline — Grants">
          <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
            <FlowNode title="13 Sources" detail="NSW, VIC, QLD, SA, WA, TAS, ACT, NT, ARC, NHMRC, GrantConnect, data.gov.au, business.gov.au" borderColor="border-[#2d6a4f]" />
            <FlowArrow />
            <FlowNode title="Scrapers" detail="grant-engine/sources/* — 13 TypeScript scrapers" />
            <FlowArrow />
            <FlowNode title="Normalizer" detail="RawGrant → CanonicalGrant + dedup" />
            <FlowArrow />
            <FlowNode title="Repository" detail={`Upsert to Supabase — ${fmt(s.grants)} grants`} borderColor="border-bauhaus-red" />
            <FlowArrow />
            <FlowNode title="Embeddings" detail={`OpenAI 1536d — ${pct(s.embedded, s.grants)}% coverage`} borderColor="border-[#457b9d]" />
            <FlowArrow />
            <FlowNode title="Enrichment" detail={`LLM descriptions — ${pct(s.descriptions, s.grants)}% coverage`} borderColor="border-[#6c4f82]" />
          </div>
        </Section>

        <Section title="Data Pipeline — Foundations">
          <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
            <FlowNode title="ACNC Register" detail={`${fmt(s.acnc)} charities + annual info statements`} borderColor="border-[#2d6a4f]" />
            <FlowArrow />
            <FlowNode title="Foundation Filter" detail="Type: ancillary fund, foundation, trust" />
            <FlowArrow />
            <FlowNode title="Foundations" detail={`${fmt(s.foundations)} foundations — 34 columns`} borderColor="border-bauhaus-red" />
            <FlowArrow />
            <FlowNode title="AI Profiler" detail={`Multi-LLM (9 providers) — ${fmt(s.profiled)} profiled`} borderColor="border-[#d4651a]" />
            <FlowArrow />
            <FlowNode title="Programs Sync" detail={`${fmt(s.programs)} foundation grant programs`} borderColor="border-[#6c4f82]" />
          </div>
        </Section>

        {/* Matching Flow */}
        <Section title="Org Profile → Grant Matching">
          <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
            <FlowNode title="Org Profile" detail="Name, mission, domains, geography, projects" borderColor="border-bauhaus-red" />
            <FlowArrow />
            <FlowNode title="Embed" detail="OpenAI text-embedding-3-small — 1536 dimensions" borderColor="border-[#457b9d]" />
            <FlowArrow />
            <FlowNode title="match_grants_for_org" detail="Postgres RPC — pgvector cosine distance ≥ 0.6" borderColor="border-[#6c4f82]" />
            <FlowArrow />
            <FlowNode title="Boost" detail="Domain overlap +2.5% — max boost +5%" borderColor="border-[#d4651a]" />
            <FlowArrow />
            <FlowNode title="Fit Score" detail="0-100% ranked — top 50 matches — save to tracker" borderColor="border-[#2d6a4f]" />
          </div>
        </Section>

        {/* Database Tables */}
        <Section title="Core Database Tables">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <DbCard name="grant_opportunities" count={s.grants} cols={43} detail="embeddings, descriptions, sources" />
            <DbCard name="acnc_ais" count={s.acnc} cols={66} detail="annual info statements" />
            <DbCard name="foundations" count={s.foundations} cols={34} detail="AI profiles, confidence" />
            <DbCard name="foundation_programs" count={s.programs} cols={15} detail="open/closed programs" />
            <DbCard name="community_orgs" count={s.community} cols={18} detail="directory listings" />
            <DbCard name="money_flows" count={s.moneyFlows} cols={12} detail="extraction → community" />
            <DbCard name="org_profiles" count={s.orgProfiles} cols={19} detail="user profiles, embeddings" />
            <DbCard name="saved_grants" count={s.savedGrants} cols={10} detail="tracked grant pipeline" />
            <DbCard name="grant_discovery_runs" count={s.discoveryRuns} cols={9} detail="scraper run history" />
          </div>
        </Section>

        {/* Engine */}
        <Section title="Grant Engine (packages/grant-engine/src)">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card header="Data Sources (13 scrapers)" color="bg-[#457b9d]">
              {[
                ['nsw-grants.ts', 'ES _search API'],
                ['vic-grants.ts', 'Vic govt portal'],
                ['qld-grants.ts', 'QLD data portal'],
                ['sa-grants.ts', 'SA grants portal'],
                ['wa-grants.ts', 'WA Tenders portal'],
                ['tas-grants.ts', 'TAS grants'],
                ['act-grants.ts', 'ACT govt grants'],
                ['nt-grants.ts', 'NT grants portal'],
                ['arc-grants.ts', 'Australian Research Council'],
                ['nhmrc-grants.ts', 'NHMRC health grants'],
                ['grantconnect.ts', 'Federal GrantConnect'],
                ['data-gov-au.ts', 'data.gov.au datasets'],
                ['business-gov-au.ts', 'business.gov.au'],
              ].map(([name, detail]) => (
                <RouteItem key={name} path={name} detail={detail} />
              ))}
            </Card>

            <Card header="Engine Modules (13)" color="bg-[#d4651a]">
              {[
                ['engine.ts', 'Main orchestrator'],
                ['normalizer.ts', 'Raw → Canonical'],
                ['deduplicator.ts', 'Name/URL dedup'],
                ['embeddings.ts', 'OpenAI embeddings'],
                ['enrichment.ts', 'LLM enrichment (paid)'],
                ['enrichment-free.ts', 'Groq/free enrichment'],
                ['storage/repository.ts', 'Supabase upsert'],
                ['foundations/foundation-profiler.ts', '9-provider LLM profiler'],
                ['foundations/acnc-importer.ts', 'ACNC register sync'],
                ['foundations/community-profiler.ts', 'Community org profiler'],
                ['reports/money-flow.ts', 'Money flow analysis'],
                ['reports/power-analysis.ts', 'Power dynamics report'],
                ['reports/admin-burden.ts', 'Admin burden analysis'],
              ].map(([name, detail]) => (
                <RouteItem key={name} path={name} detail={detail} />
              ))}
            </Card>
          </div>
        </Section>

        {/* Scripts */}
        <Section title="Operational Scripts (20)">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card header="Discovery & Ingestion (9)" color="bg-bauhaus-black">
              {[
                ['grantscope-discovery.mjs', 'Main discovery runner'],
                ['scrape-state-grants.mjs', 'State-level scraping'],
                ['import-gov-grants.mjs', 'Government imports'],
                ['sync-acnc-register.mjs', 'ACNC bulk sync'],
                ['import-acnc-financials.mjs', 'ACNC annual statements'],
                ['massive-import-run.mjs', 'Full pipeline run'],
                ['pipeline-runner.mjs', 'Orchestrated pipeline'],
                ['ingest-youth-justice-data.mjs', 'QLD youth justice'],
                ['build-money-flow-data.mjs', 'Money flow reports'],
              ].map(([name, detail]) => (
                <RouteItem key={name} path={name} detail={detail} />
              ))}
            </Card>

            <Card header="Enrichment & Profiling (11)" color="bg-bauhaus-black">
              {[
                ['enrich-grants.mjs', 'Paid LLM enrichment'],
                ['enrich-grants-free.mjs', 'Free-tier enrichment'],
                ['backfill-embeddings.mjs', 'Embedding backfill'],
                ['build-foundation-profiles.mjs', 'Foundation AI profiling'],
                ['profile-vip-foundations.mjs', 'Top foundation profiles'],
                ['profile-community-orgs.mjs', 'Community org profiling'],
                ['reprofile-low-confidence.mjs', 'Re-profile low confidence'],
                ['sync-foundation-programs.mjs', 'Foundation programs sync'],
                ['sync-ghl-to-tracker.mjs', 'GHL → tracker sync'],
                ['run-scraping-agents.mjs', 'Agent-based scraping'],
                ['log-agent-run.mjs', 'Agent run logging (lib)'],
              ].map(([name, detail]) => (
                <RouteItem key={name} path={name} detail={detail} />
              ))}
            </Card>
          </div>
        </Section>

        {/* LLM Providers */}
        <Section title="Multi-Provider LLM Rotation (Foundation Profiler)">
          <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
            <ProviderNode name="Minimax" detail="Priority 1" status="ok" />
            <FlowArrow />
            <ProviderNode name="Gemini Grounded" detail="Google Search" status="ok" />
            <FlowArrow />
            <ProviderNode name="Gemini" detail="Standard" status="ok" />
            <FlowArrow />
            <ProviderNode name="DeepSeek" detail="Quota exceeded" status="warn" />
            <FlowArrow />
            <ProviderNode name="Kimi" detail="Auth error" status="warn" />
            <FlowArrow />
            <ProviderNode name="Groq" detail="Rate limited" status="warn" />
            <FlowArrow />
            <ProviderNode name="OpenAI" detail="Working" status="ok" />
            <FlowArrow />
            <ProviderNode name="Perplexity" detail="401 Auth" status="down" />
            <FlowArrow />
            <ProviderNode name="Anthropic" detail="Low credits" status="down" />
          </div>
        </Section>

        {/* Legend */}
        <div className="flex flex-wrap gap-5 p-4 bg-white border-3 border-bauhaus-black">
          <LegendItem color="bg-[#2d6a4f]" label="Public" />
          <LegendItem color="bg-bauhaus-red" label="Auth-gated" />
          <LegendItem color="bg-[#457b9d]" label="Search & APIs" />
          <LegendItem color="bg-[#6c4f82]" label="Reports" />
          <LegendItem color="bg-[#d4651a]" label="AI / LLM" />
          <LegendItem color="bg-bauhaus-black" label="Scripts & Ops" />
        </div>

      </div>
    </div>
  );
}

/* ─── Components ─── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-bauhaus-muted mb-4 pb-2 border-b-3 border-bauhaus-black">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Card({ header, color, children }: { header: string; color: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border-4 border-bauhaus-black">
      <div className={`${color} px-4 py-2.5`}>
        <h3 className="text-[10px] font-black text-white uppercase tracking-[0.15em]">{header}</h3>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function RouteItem({ path, detail, auth }: { path: string; detail: string; auth?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-b-0 text-[11px]">
      <span className="font-bold text-bauhaus-black">{path}</span>
      <span className="flex items-center gap-1.5">
        <span className="text-[10px] text-bauhaus-muted font-semibold">{detail}</span>
        {auth && (
          <span className="text-[8px] font-extrabold uppercase tracking-wider text-bauhaus-red border-2 border-bauhaus-red px-1.5 py-0.5">
            Auth
          </span>
        )}
      </span>
    </div>
  );
}

function FlowNode({ title, detail, borderColor }: { title: string; detail: string; borderColor?: string }) {
  return (
    <div className={`bg-white border-4 ${borderColor || 'border-bauhaus-black'} px-4 py-3 min-w-[130px] text-center flex-shrink-0`}>
      <div className="text-[10px] font-black uppercase tracking-wider">{title}</div>
      <div className="text-[9px] text-bauhaus-muted mt-1 whitespace-pre-line">{detail}</div>
    </div>
  );
}

function FlowArrow() {
  return <div className="flex items-center px-1 text-lg font-black text-bauhaus-black flex-shrink-0">&rarr;</div>;
}

function DbCard({ name, count, cols, detail }: { name: string; count: number; cols: number; detail: string }) {
  return (
    <div className="bg-white border-3 border-bauhaus-black p-3">
      <div className="text-[11px] font-black uppercase tracking-wide">{name}</div>
      <div className="text-lg font-black text-bauhaus-red">{fmt(count)}</div>
      <div className="text-[9px] text-bauhaus-muted">{cols} cols &middot; {detail}</div>
    </div>
  );
}

function ProviderNode({ name, detail, status }: { name: string; detail: string; status: 'ok' | 'warn' | 'down' }) {
  const styles = {
    ok: 'border-[#2d6a4f] bg-[#f0f9f4]',
    warn: 'border-[#e9c46a] bg-[#fdf8ec]',
    down: 'border-bauhaus-red bg-red-50',
  };
  return (
    <div className={`border-4 ${styles[status]} px-4 py-3 min-w-[110px] text-center flex-shrink-0`}>
      <div className="text-[10px] font-black uppercase tracking-wider">{name}</div>
      <div className="text-[9px] text-bauhaus-muted mt-1">{detail}</div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
      <div className={`w-4 h-4 ${color} border-2 border-bauhaus-black`} />
      {label}
    </div>
  );
}
