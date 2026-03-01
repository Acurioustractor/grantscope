'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface OpsData {
  health: {
    grants: { total: number; embedded: number; enriched: number; open: number };
    foundations: { total: number; profiled: number; withWebsite: number; programs: number };
    community: { orgs: number; acncRecords: number };
  };
  recentRuns: AgentRun[];
  lastUpdated: string;
}

interface AgentRun {
  id: string;
  agent_id: string;
  agent_name: string;
  started_at: string;
  completed_at: string;
  status: string;
  items_found: number;
  items_new: number;
  items_updated: number;
  duration_ms: number;
  errors: unknown[];
}

const TOOL_INVENTORY = [
  { stage: 'Grant Discovery', tools: '15 source plugins (Cheerio, GrantConnect API, ARC API, CKAN)', cost: 'Free' },
  { stage: 'Grant Enrichment', tools: 'Cheerio + Groq/Gemini/DeepSeek/Minimax (auto-rotate)', cost: 'Free' },
  { stage: 'Grant Embedding', tools: 'OpenAI text-embedding-3-small', cost: '~$0.02/500' },
  { stage: 'Foundation Profiling', tools: 'Firecrawl + 9 LLM providers (Gemini-grounded first)', cost: '~$0.05/ea' },
  { stage: 'ACNC Import', tools: 'data.gov.au CSV parser', cost: 'Free' },
];

const QUICK_ACTIONS = [
  { label: 'Enrich Grants (Free)', cmd: 'node --env-file=.env scripts/enrich-grants-free.mjs --limit=100', desc: 'Scrape + extract with free LLMs' },
  { label: 'Profile Foundations', cmd: 'node --env-file=.env scripts/build-foundation-profiles.mjs --limit=20', desc: 'AI-profile un-enriched foundations' },
  { label: 'Backfill Embeddings', cmd: 'node --env-file=.env scripts/backfill-embeddings.mjs --limit=500', desc: 'Generate missing vectors' },
  { label: 'Run Discovery', cmd: 'node --env-file=.env scripts/grantscope-discovery.mjs', desc: 'Full multi-source grant discovery' },
  { label: 'Sync ACNC', cmd: 'node --env-file=.env scripts/sync-acnc-register.mjs', desc: 'Download + update ACNC register' },
];

function pct(n: number, total: number): string {
  if (total === 0) return '0';
  return ((n / total) * 100).toFixed(1);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function HealthCard({ label, value, total, sub }: { label: string; value: number; total: number; sub?: string }) {
  const percent = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="border-4 border-bauhaus-black p-5">
      <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">{label}</div>
      <div className="text-3xl font-black text-bauhaus-black">{value.toLocaleString()}</div>
      <div className="text-sm text-bauhaus-muted mt-1">
        of {total.toLocaleString()} ({pct(value, total)}%)
      </div>
      {sub && <div className="text-xs text-bauhaus-muted mt-1">{sub}</div>}
      <div className="mt-3 h-2 bg-gray-200 border border-bauhaus-black/20">
        <div
          className="h-full transition-all"
          style={{
            width: `${Math.min(percent, 100)}%`,
            backgroundColor: percent > 90 ? '#22c55e' : percent > 50 ? '#eab308' : '#ef4444',
          }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    success: 'bg-green-600 text-white',
    partial: 'bg-yellow-500 text-bauhaus-black',
    failed: 'bg-bauhaus-red text-white',
    running: 'bg-bauhaus-blue text-white',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-black uppercase tracking-wider ${colors[status] ?? 'bg-gray-300 text-bauhaus-black'}`}>
      {status}
    </span>
  );
}

export function OpsClient() {
  const [data, setData] = useState<OpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/ops')
      .then((r) => {
        if (r.status === 401) { router.push('/login'); return null; }
        return r.json();
      })
      .then((d) => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  function copyCmd(cmd: string) {
    navigator.clipboard.writeText(cmd);
    setCopied(cmd);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-sm font-black text-bauhaus-muted uppercase tracking-widest">Loading ops...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-sm font-black text-bauhaus-red uppercase tracking-widest">Failed to load ops data</div>
      </div>
    );
  }

  const { health, recentRuns } = data;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight">Data Operations</h1>
        <div className="text-xs text-bauhaus-muted font-mono">
          Updated {timeAgo(data.lastUpdated)}
        </div>
      </div>

      {/* Pipeline Health */}
      <section className="mb-10">
        <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
          Pipeline Health
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <HealthCard
            label="Grants Embedded"
            value={health.grants.embedded}
            total={health.grants.total}
          />
          <HealthCard
            label="Grants Enriched"
            value={health.grants.enriched}
            total={health.grants.total}
            sub={`${health.grants.open} with future close dates`}
          />
          <HealthCard
            label="Foundations Profiled"
            value={health.foundations.profiled}
            total={health.foundations.total}
            sub={`${health.foundations.withWebsite} have websites · ${health.foundations.programs} programs`}
          />
          <div className="border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Community Orgs</div>
            <div className="text-3xl font-black text-bauhaus-black">{health.community.orgs.toLocaleString()}</div>
            <div className="text-sm text-bauhaus-muted mt-1">AI-profiled</div>
            <div className="text-xs text-bauhaus-muted mt-2">
              {health.community.acncRecords.toLocaleString()} ACNC records (multi-year)
            </div>
          </div>
        </div>
      </section>

      {/* Tool Inventory */}
      <section className="mb-10">
        <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
          Tool Inventory
        </h2>
        <div className="border-4 border-bauhaus-black overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Stage</th>
                <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Tools</th>
                <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Cost</th>
              </tr>
            </thead>
            <tbody>
              {TOOL_INVENTORY.map((row) => (
                <tr key={row.stage} className="border-t-2 border-bauhaus-black/10">
                  <td className="px-4 py-3 font-bold">{row.stage}</td>
                  <td className="px-4 py-3 text-bauhaus-muted">{row.tools}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{row.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent Agent Runs */}
      <section className="mb-10">
        <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
          Recent Agent Runs
        </h2>
        {recentRuns.length === 0 ? (
          <div className="border-4 border-dashed border-bauhaus-black/20 p-8 text-center">
            <div className="text-sm text-bauhaus-muted">No agent runs yet. Run a job below to get started.</div>
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
                  <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Duration</th>
                  <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">When</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.id} className="border-t-2 border-bauhaus-black/10">
                    <td className="px-4 py-3 font-bold">{run.agent_name}</td>
                    <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                    <td className="px-4 py-3 text-right font-mono">{run.items_found}</td>
                    <td className="px-4 py-3 text-right font-mono">{run.items_new}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{formatDuration(run.duration_ms)}</td>
                    <td className="px-4 py-3 text-right text-bauhaus-muted text-xs">{timeAgo(run.completed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <section className="mb-10">
        <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
          Quick Actions
        </h2>
        <p className="text-xs text-bauhaus-muted mb-4">
          Copy a command and run it locally. Each script logs to agent_runs so results appear above.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {QUICK_ACTIONS.map((action) => (
            <div key={action.label} className="border-4 border-bauhaus-black p-4">
              <div className="font-black text-sm uppercase tracking-wide mb-1">{action.label}</div>
              <div className="text-xs text-bauhaus-muted mb-3">{action.desc}</div>
              <button
                onClick={() => copyCmd(action.cmd)}
                className="w-full text-left font-mono text-xs bg-gray-100 border-2 border-bauhaus-black/20 px-3 py-2 hover:bg-bauhaus-black hover:text-white transition-colors cursor-pointer break-all"
              >
                {copied === action.cmd ? 'Copied!' : action.cmd}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
