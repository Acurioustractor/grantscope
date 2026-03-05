'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface HealthData {
  stats: {
    grants: { total: number; withDescription: number; enriched: number; embedded: number; open: number };
    foundations: { total: number; profiled: number; withWebsite: number; programs: number };
    community: { orgs: number };
  };
  sourceBreakdown: Array<{
    source: string;
    total: number;
    has_description: number;
    enriched: number;
    embedded: number;
    has_url: number;
  }>;
  confidenceBreakdown: Array<{ confidence: string; total: number }>;
  recentRuns: Array<{
    id: string;
    agent_name: string;
    status: string;
    items_found: number;
    items_new: number;
    items_updated: number;
    duration_ms: number;
    completed_at: string;
    errors: unknown[];
  }>;
  discoveryRuns: Array<{
    id: string;
    sources_used: string[];
    grants_discovered: number;
    grants_new: number;
    grants_updated: number;
    status: string;
    started_at: string;
    completed_at: string;
    errors: unknown[];
  }>;
  lastUpdated: string;
}

function pct(n: number, total: number): string {
  if (total === 0) return '0';
  return ((n / total) * 100).toFixed(1);
}

function pctNum(n: number, total: number): number {
  if (total === 0) return 0;
  return (n / total) * 100;
}

function timeAgo(iso: string): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(ms: number): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function StatusColor({ value, total, thresholds }: { value: number; total: number; thresholds?: [number, number] }) {
  const p = pctNum(value, total);
  const [warn, good] = thresholds ?? [50, 90];
  const color = p >= good ? 'text-green-500' : p >= warn ? 'text-yellow-500' : 'text-red-500';
  return <span className={`font-mono ${color}`}>{pct(value, total)}%</span>;
}

function BarFill({ value, total, thresholds }: { value: number; total: number; thresholds?: [number, number] }) {
  const p = Math.min(pctNum(value, total), 100);
  const [warn, good] = thresholds ?? [50, 90];
  const bg = p >= good ? 'bg-green-500' : p >= warn ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="h-2 bg-gray-200 border border-bauhaus-black/20 mt-2">
      <div className={`h-full transition-all ${bg}`} style={{ width: `${p}%` }} />
    </div>
  );
}

const PIPELINE_STAGES = [
  {
    num: 1, name: 'Discover', desc: '15 source plugins fetch grants from government portals, research APIs, and web search',
    tools: 'GrantConnect, NSW ES, QLD CKAN, ARC, NHMRC, 8 state portals, Web Search, LLM Knowledge',
    output: 'grant_opportunities',
  },
  {
    num: 2, name: 'Enrich', desc: 'Scrape grant URLs with Cheerio, extract structured data with free LLMs',
    tools: 'Cheerio → Groq → Gemini → MiniMax → DeepSeek (round-robin). Paid path: Claude Haiku',
    output: 'eligibility_criteria, target_recipients, deadline, amounts',
  },
  {
    num: 3, name: 'Profile', desc: 'Scrape foundation websites, build rich profiles with 9 LLM providers',
    tools: 'Jina Reader (free) / Firecrawl → MiniMax → Gemini-grounded → Gemini → DeepSeek → Kimi → Groq → OpenAI → Perplexity → Anthropic',
    output: 'description, philosophy, wealth_source, programs, board_members',
  },
  {
    num: 4, name: 'Sync', desc: 'Foundation programs → grant search index so private grants appear alongside government ones',
    tools: 'sync-foundation-programs.mjs',
    output: 'grant_opportunities (source: foundation_program)',
  },
  {
    num: 5, name: 'Embed', desc: 'Vector embeddings for semantic search — one vector per grant',
    tools: 'OpenAI text-embedding-3-small (1536-dim, ~$0.02/500 grants)',
    output: 'grant_opportunities.embedding',
  },
];

const BLOCKERS = [
  {
    severity: 'high' as const,
    title: 'Brisbane + QLD Arts grants unenriched (7,848)',
    desc: 'These already have descriptions from APIs but enriched_at is NULL. One SQL UPDATE fixes this.',
    fix: "UPDATE grant_opportunities SET enriched_at = now() WHERE source IN ('brisbane-grants', 'qld-arts-data') AND enriched_at IS NULL;",
  },
  {
    severity: 'high' as const,
    title: 'Foundation profiling bottleneck',
    desc: 'Pipeline profiles 5 foundations per 30-min run. At this rate, clearing the backlog takes ~36 days. Need higher batch size or parallel providers.',
    fix: 'npx tsx scripts/build-foundation-profiles.mjs --limit=100',
  },
  {
    severity: 'low' as const,
    title: 'GHL sync grants have no descriptions (121)',
    desc: 'CRM records with names but no URLs or descriptions. Neither enrichment path can help. Need web-search-based enrichment.',
    fix: null,
  },
  {
    severity: 'medium' as const,
    title: 'No freshness tracking',
    desc: 'No mechanism to detect stale/expired grants. Grants that disappear from sources are never marked as closed.',
    fix: null,
  },
];

const IMPROVEMENTS = [
  { title: 'Embedding-based dedup', desc: 'Same grant from different sources has different URLs. Cosine similarity >0.95 would catch cross-source duplicates. 100% embedding coverage makes this low-hanging fruit.' },
  { title: 'Incremental scraping', desc: 'Every run re-fetches all grants. Use updated_at/If-Modified-Since on state APIs to only fetch newer records.' },
  { title: 'Web-search enrichment path', desc: 'For URL-less grants: name → Perplexity/Gemini search → parse result. Unblocks GHL and manual entries.' },
];

export function HealthClient() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const router = useRouter();

  const fetchData = useCallback(() => {
    fetch('/api/ops/health')
      .then((r) => {
        if (r.status === 401) { router.push('/login'); return null; }
        return r.json();
      })
      .then((d) => { if (d && !d.error) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 60s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-sm font-black text-bauhaus-muted uppercase tracking-widest animate-pulse">Loading health data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-sm font-black text-bauhaus-red uppercase tracking-widest">Failed to load health data</div>
      </div>
    );
  }

  const { stats, sourceBreakdown, confidenceBreakdown, recentRuns, discoveryRuns } = data;
  const confMap = Object.fromEntries(confidenceBreakdown.map(c => [c.confidence, c.total]));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight">Pipeline Health</h1>
          <p className="text-xs text-bauhaus-muted mt-1">
            Comprehensive view of data quality, enrichment gaps, and pipeline status
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-bauhaus-muted cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-bauhaus-red"
            />
            Auto-refresh 60s
          </label>
          <button
            onClick={fetchData}
            className="text-xs font-black uppercase tracking-wider px-3 py-1 border-2 border-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
          >
            Refresh
          </button>
          <div className="text-xs text-bauhaus-muted font-mono">
            {timeAgo(data.lastUpdated)}
          </div>
        </div>
      </div>

      {/* ===== OVERALL STATS ===== */}
      <section className="mb-10">
        <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
          Data Completeness
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total Grants" value={stats.grants.total} />
          <StatCard label="Have Description" value={stats.grants.withDescription} total={stats.grants.total} thresholds={[80, 95]} />
          <StatCard label="LLM Enriched" value={stats.grants.enriched} total={stats.grants.total} thresholds={[40, 80]} />
          <StatCard label="Embedded" value={stats.grants.embedded} total={stats.grants.total} />
          <StatCard label="Open (Future Close)" value={stats.grants.open} />
          <StatCard label="Foundation Programs" value={stats.foundations.programs} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
          <StatCard label="Foundations" value={stats.foundations.total} />
          <StatCard label="Profiled" value={stats.foundations.profiled} total={stats.foundations.total} thresholds={[30, 70]} />
          <StatCard label="Have Website" value={stats.foundations.withWebsite} total={stats.foundations.total} thresholds={[40, 70]} />
          <div className="border-4 border-bauhaus-black p-4">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-1">Profile Confidence</div>
            <div className="flex gap-2 mt-2">
              <span className="text-xs"><span className="inline-block w-2 h-2 bg-red-500 mr-1" />{(confMap['low'] ?? 0).toLocaleString()} low</span>
              <span className="text-xs"><span className="inline-block w-2 h-2 bg-yellow-500 mr-1" />{(confMap['medium'] ?? 0).toLocaleString()} med</span>
              <span className="text-xs"><span className="inline-block w-2 h-2 bg-green-500 mr-1" />{(confMap['high'] ?? 0).toLocaleString()} high</span>
            </div>
            <div className="h-2 flex mt-2 border border-bauhaus-black/20">
              {(() => {
                const t = stats.foundations.total || 1;
                return <>
                  <div className="bg-red-500 h-full" style={{ width: `${((confMap['low'] ?? 0) / t) * 100}%` }} />
                  <div className="bg-yellow-500 h-full" style={{ width: `${((confMap['medium'] ?? 0) / t) * 100}%` }} />
                  <div className="bg-green-500 h-full" style={{ width: `${((confMap['high'] ?? 0) / t) * 100}%` }} />
                </>;
              })()}
            </div>
          </div>
          <StatCard label="Community Orgs" value={stats.community.orgs} />
        </div>
      </section>

      {/* ===== SOURCE BREAKDOWN ===== */}
      <section className="mb-10">
        <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
          Source Breakdown
        </h2>
        <div className="border-4 border-bauhaus-black overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Source</th>
                <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Grants</th>
                <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Has Desc</th>
                <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Enriched</th>
                <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Embedded</th>
                <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Has URL</th>
                <th className="px-4 py-2 font-black uppercase tracking-wider text-xs">Gap</th>
              </tr>
            </thead>
            <tbody>
              {sourceBreakdown.map((s) => {
                const gap = getSourceGap(s);
                return (
                  <tr key={s.source} className="border-t-2 border-bauhaus-black/10 hover:bg-gray-50">
                    <td className="px-4 py-2 font-bold font-mono text-xs">{s.source}</td>
                    <td className="px-4 py-2 text-right font-mono">{s.total.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right"><StatusColor value={s.has_description} total={s.total} thresholds={[50, 90]} /></td>
                    <td className="px-4 py-2 text-right"><StatusColor value={s.enriched} total={s.total} thresholds={[30, 80]} /></td>
                    <td className="px-4 py-2 text-right"><StatusColor value={s.embedded} total={s.total} /></td>
                    <td className="px-4 py-2 text-right"><StatusColor value={s.has_url} total={s.total} thresholds={[50, 90]} /></td>
                    <td className="px-4 py-2 text-xs text-bauhaus-muted">{gap}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ===== PIPELINE ARCHITECTURE ===== */}
      <section className="mb-10">
        <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
          Pipeline Architecture
        </h2>
        <div className="flex flex-wrap gap-3">
          {PIPELINE_STAGES.map((stage) => (
            <div key={stage.num} className="border-4 border-bauhaus-black p-4 flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 bg-bauhaus-red text-white flex items-center justify-center text-xs font-black">
                  {stage.num}
                </span>
                <span className="font-black text-sm uppercase tracking-wider">{stage.name}</span>
              </div>
              <p className="text-xs text-bauhaus-muted leading-relaxed mb-2">{stage.desc}</p>
              <div className="text-xs font-mono text-bauhaus-muted/70 leading-relaxed">{stage.tools}</div>
              <div className="mt-2 text-xs font-mono text-green-600">{stage.output}</div>
            </div>
          ))}
        </div>
        <div className="text-xs text-bauhaus-muted mt-3">
          Orchestrated by <code className="bg-gray-100 px-1 py-0.5 border border-bauhaus-black/10">pipeline-runner.mjs</code> — runs every 30 min or <code className="bg-gray-100 px-1 py-0.5 border border-bauhaus-black/10">--once</code>
        </div>
      </section>

      {/* ===== BLOCKERS & ISSUES ===== */}
      <section className="mb-10">
        <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
          Blockers &amp; Issues
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {BLOCKERS.map((b) => (
            <div key={b.title} className={`border-4 p-4 ${
              b.severity === 'high' ? 'border-red-500' : b.severity === 'medium' ? 'border-yellow-500' : 'border-bauhaus-black/30'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 text-xs font-black uppercase tracking-wider ${
                  b.severity === 'high' ? 'bg-red-500 text-white' : b.severity === 'medium' ? 'bg-yellow-500 text-bauhaus-black' : 'bg-gray-300 text-bauhaus-black'
                }`}>
                  {b.severity}
                </span>
                <span className="font-black text-sm">{b.title}</span>
              </div>
              <p className="text-xs text-bauhaus-muted leading-relaxed">{b.desc}</p>
              {b.fix && (
                <code className="block mt-2 text-xs font-mono bg-gray-100 border border-bauhaus-black/10 p-2 break-all text-bauhaus-black/70">
                  {b.fix}
                </code>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ===== IMPROVEMENTS ===== */}
      <section className="mb-10">
        <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
          Improvement Opportunities
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {IMPROVEMENTS.map((imp) => (
            <div key={imp.title} className="border-4 border-bauhaus-blue/50 p-4">
              <div className="font-black text-sm text-bauhaus-blue mb-2">{imp.title}</div>
              <p className="text-xs text-bauhaus-muted leading-relaxed">{imp.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== RECENT RUNS ===== */}
      <section className="mb-10">
        <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
          Recent Agent Runs
        </h2>
        {recentRuns.length === 0 ? (
          <div className="border-4 border-dashed border-bauhaus-black/20 p-8 text-center">
            <div className="text-sm text-bauhaus-muted">No agent runs recorded yet</div>
          </div>
        ) : (
          <div className="border-4 border-bauhaus-black overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Agent</th>
                  <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Status</th>
                  <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Found</th>
                  <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">New</th>
                  <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Updated</th>
                  <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Duration</th>
                  <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">When</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.id} className="border-t-2 border-bauhaus-black/10">
                    <td className="px-4 py-2 font-bold">{run.agent_name}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 text-xs font-black uppercase tracking-wider ${
                        run.status === 'success' ? 'bg-green-600 text-white' :
                        run.status === 'partial' ? 'bg-yellow-500 text-bauhaus-black' :
                        run.status === 'failed' ? 'bg-red-500 text-white' :
                        'bg-gray-300 text-bauhaus-black'
                      }`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{run.items_found}</td>
                    <td className="px-4 py-2 text-right font-mono">{run.items_new}</td>
                    <td className="px-4 py-2 text-right font-mono">{run.items_updated}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs">{formatDuration(run.duration_ms)}</td>
                    <td className="px-4 py-2 text-right text-bauhaus-muted text-xs">{timeAgo(run.completed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ===== DISCOVERY RUNS ===== */}
      {discoveryRuns.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
            Recent Discovery Runs
          </h2>
          <div className="border-4 border-bauhaus-black overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Status</th>
                  <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Sources</th>
                  <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Discovered</th>
                  <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">New</th>
                  <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Updated</th>
                  <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Errors</th>
                  <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">When</th>
                </tr>
              </thead>
              <tbody>
                {discoveryRuns.map((run) => (
                  <tr key={run.id} className="border-t-2 border-bauhaus-black/10">
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 text-xs font-black uppercase tracking-wider ${
                        run.status === 'completed' ? 'bg-green-600 text-white' :
                        run.status === 'partial' ? 'bg-yellow-500 text-bauhaus-black' :
                        run.status === 'running' ? 'bg-blue-500 text-white' :
                        'bg-red-500 text-white'
                      }`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs font-mono text-bauhaus-muted max-w-[200px] truncate">
                      {(run.sources_used ?? []).join(', ')}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{run.grants_discovered}</td>
                    <td className="px-4 py-2 text-right font-mono">{run.grants_new}</td>
                    <td className="px-4 py-2 text-right font-mono">{run.grants_updated}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      {Array.isArray(run.errors) ? run.errors.length : 0}
                    </td>
                    <td className="px-4 py-2 text-right text-bauhaus-muted text-xs">{timeAgo(run.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ===== LLM PROVIDERS ===== */}
      <section className="mb-10">
        <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
          LLM Provider Strategy
        </h2>
        <div className="flex flex-wrap gap-2">
          {[
            { name: 'Groq (Llama 3.3 70B)', tier: 'free' },
            { name: 'Gemini 2.5 Flash', tier: 'free' },
            { name: 'Gemini Grounded', tier: 'free' },
            { name: 'MiniMax M2.5', tier: 'free' },
            { name: 'DeepSeek Chat', tier: 'free' },
            { name: 'Kimi (Moonshot 32K)', tier: 'free' },
            { name: 'OpenAI gpt-4o-mini', tier: 'cheap' },
            { name: 'Perplexity Sonar Pro', tier: 'paid' },
            { name: 'Anthropic Sonnet 4.5', tier: 'paid' },
          ].map((p) => (
            <span key={p.name} className={`px-3 py-1 text-xs font-mono border-2 ${
              p.tier === 'free' ? 'border-green-500 text-green-700 bg-green-50' :
              p.tier === 'cheap' ? 'border-yellow-500 text-yellow-700 bg-yellow-50' :
              'border-red-500 text-red-700 bg-red-50'
            }`}>
              {p.name}
            </span>
          ))}
        </div>
        <p className="text-xs text-bauhaus-muted mt-2">
          Round-robin with auto-disable on quota/rate errors. Cheapest providers used first. Gemini grounded provides free web search for foundation profiling.
        </p>
      </section>
    </div>
  );
}

function StatCard({ label, value, total, thresholds }: { label: string; value: number; total?: number; thresholds?: [number, number] }) {
  return (
    <div className="border-4 border-bauhaus-black p-4">
      <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-1">{label}</div>
      <div className="text-2xl font-black text-bauhaus-black">{value.toLocaleString()}</div>
      {total !== undefined && (
        <>
          <div className="text-xs text-bauhaus-muted mt-1">
            of {total.toLocaleString()} (<StatusColor value={value} total={total} thresholds={thresholds} />)
          </div>
          <BarFill value={value} total={total} thresholds={thresholds} />
        </>
      )}
    </div>
  );
}

function getSourceGap(s: { source: string; total: number; has_description: number; enriched: number; embedded: number; has_url: number }): string {
  const gaps: string[] = [];
  const descPct = pctNum(s.has_description, s.total);
  const enrichPct = pctNum(s.enriched, s.total);
  const urlPct = pctNum(s.has_url, s.total);

  if (descPct < 50) gaps.push(`${s.total - s.has_description} missing descriptions`);
  if (enrichPct < 50 && s.total > 10) gaps.push(`${s.total - s.enriched} unenriched`);
  if (urlPct < 50 && s.total > 10) gaps.push(`${s.total - s.has_url} no URL`);

  if (gaps.length === 0) {
    if (enrichPct < 90 && s.total > 10) return `${s.total - s.enriched} unenriched`;
    return '';
  }
  return gaps.join(', ');
}
