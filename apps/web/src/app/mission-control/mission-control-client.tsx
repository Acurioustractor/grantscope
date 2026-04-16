'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentTask {
  id: string;
  agent_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  params: Record<string, unknown>;
  retry_count: number;
  max_retries: number;
  error: string | null;
  created_by: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  scheduled_for: string;
}

interface AgentSchedule {
  id: string;
  agent_id: string;
  interval_hours: number;
  enabled: boolean;
  last_run_at: string | null;
  priority: number;
  params: Record<string, unknown>;
}

interface RegistryAgent {
  id: string;
  displayName: string;
  category: string;
  defaultPriority: number;
}

interface HeroData {
  totalRecords: number;
  freshnessPct: number;
  activePipelines: number;
  healthScore: number;
  tableCount: number;
  lastSync: string | null;
}

interface InventoryItem {
  key: string;
  label: string;
  table: string;
  category: string;
  count: number;
  lastUpdated: string | null;
  static: boolean;
}

interface PowerData {
  top20: Array<{
    entity_name: string;
    total_donated: number;
    total_contract_value: number;
    donation_count: number;
    contract_count: number;
  }>;
  entityTypes: Array<{ entity_type: string; count: number }>;
  donorContractorCount: number;
  totalDonated: number;
  totalContractValue: number;
}

interface AgentRun {
  id: string;
  agent_name: string;
  status: string;
  items_found: number;
  items_new: number;
  items_updated: number;
  duration_ms: number;
  completed_at: string;
}

interface Discovery {
  id: string;
  agent_id: string;
  discovery_type: string;
  severity: 'info' | 'notable' | 'significant' | 'critical';
  title: string;
  description: string | null;
  entity_ids: string[] | null;
  person_names: string[] | null;
  metadata: Record<string, unknown>;
  created_at: string;
  reviewed_at: string | null;
  dismissed: boolean;
}

interface MissionData {
  hero: HeroData;
  inventory: InventoryItem[];
  power: PowerData;
  agents: {
    recentRuns: AgentRun[];
    discoveryRuns: Array<{
      id: string;
      status: string;
      grants_discovered: number;
      grants_new: number;
      started_at: string;
    }>;
    runtimeSweeps: Array<{
      agent_id: string;
      agent_name: string;
      full_sweep_cursor: number | null;
      full_sweep_candidate_count: number | null;
      full_sweep_progress_pct: number | null;
      full_sweep_advanced_by: number | null;
      full_sweep_last_programs_found: number | null;
      full_sweep_last_inserted: number | null;
      full_sweep_last_updated: number | null;
      full_sweep_last_skipped: number | null;
      full_sweep_last_errors: number | null;
      full_sweep_last_batch_foundation_ids: string[] | null;
      full_sweep_last_batch_foundation_names: string[] | null;
      full_sweep_last_run_at: string | null;
      interval_hours: number | null;
      enabled: boolean | null;
      auto_create_task: boolean | null;
      schedule_last_run_at: string | null;
      recent_run_status: string | null;
      recent_run_completed_at: string | null;
      updated_at: string;
    }>;
  };
  frontier: {
    autoDisabled: Array<{
      id: string;
      sourceKey: string;
      sourceName: string | null;
      sourceKind: string;
      foundationId: string | null;
      foundationName: string | null;
      targetUrl: string;
      failureCount: number;
      lastHttpStatus: number | null;
      nextCheckAt: string | null;
      updatedAt: string;
      autoDisabledReason: string | null;
      autoDisabledAt: string | null;
      autoDisabledFailureCount: number;
      lastEffectiveCadenceReason: string | null;
    }>;
  };
  discoveries: Discovery[];
  lastUpdated: string;
}

interface TaskQueueResult {
  task?: Pick<AgentTask, 'id' | 'agent_id' | 'status' | 'priority' | 'created_at'>;
  existing: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
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

function ageInDays(iso: string | null): number {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

function formatDuration(ms: number): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function freshnessStatus(iso: string | null): { label: string; color: string } {
  const days = ageInDays(iso);
  if (days < 1) return { label: 'FRESH', color: 'bg-green-600 text-white' };
  if (days < 7) return { label: 'OK', color: 'bg-gray-200 text-bauhaus-black' };
  if (days < 30) return { label: 'STALE', color: 'bg-yellow-500 text-bauhaus-black' };
  return { label: 'CRITICAL', color: 'bg-red-500 text-white' };
}

const CATEGORY_COLORS: Record<string, string> = {
  entity: 'border-l-bauhaus-blue',
  funding: 'border-l-green-500',
  registry: 'border-l-purple-500',
  government: 'border-l-bauhaus-red',
  corporate: 'border-l-yellow-500',
  geographic: 'border-l-cyan-500',
  analytics: 'border-l-gray-400',
};

const PIE_COLORS = ['#E63946', '#457B9D', '#F4A261', '#2A9D8F', '#264653', '#E9C46A', '#9B2226', '#AE2012', '#BB3E03', '#CA6702'];

const SQL_TEMPLATES = [
  { label: 'Entity count by type', sql: 'SELECT entity_type, COUNT(*) as count FROM gs_entities GROUP BY entity_type ORDER BY count DESC' },
  { label: 'Top 10 donors', sql: 'SELECT entity_name, total_donated, donation_count FROM mv_gs_donor_contractors ORDER BY total_donated DESC LIMIT 10' },
  { label: 'Grants by source', sql: 'SELECT source, COUNT(*) as count FROM grant_opportunities GROUP BY source ORDER BY count DESC' },
  { label: 'Recent agent runs', sql: 'SELECT agent_name, status, items_found, items_new, completed_at FROM agent_runs ORDER BY completed_at DESC LIMIT 10' },
  { label: 'Foundation profiling progress', sql: "SELECT COUNT(*) FILTER (WHERE description IS NOT NULL) as profiled, COUNT(*) as total, ROUND(100.0 * COUNT(*) FILTER (WHERE description IS NOT NULL) / COUNT(*), 1) as pct FROM foundations" },
  { label: 'Postcodes by remoteness', sql: 'SELECT remoteness, COUNT(*) as count FROM gs_entities WHERE remoteness IS NOT NULL GROUP BY remoteness ORDER BY count DESC' },
  { label: 'Community-controlled orgs', sql: "SELECT entity_type, COUNT(*) as count FROM gs_entities WHERE is_community_controlled = true GROUP BY entity_type ORDER BY count DESC" },
  { label: 'Funding gaps (top 10)', sql: 'SELECT * FROM get_funding_gaps() LIMIT 10' },
];

const REFRESH_COMMANDS = [
  { label: 'Full Pipeline', cmd: 'node scripts/pipeline-runner.mjs --once' },
  { label: 'Entity Graph', cmd: 'node scripts/build-entity-graph.mjs' },
  { label: 'AEC Donations', cmd: 'node scripts/import-aec-donations.mjs' },
  { label: 'AusTender', cmd: 'node scripts/sync-austender-contracts.mjs' },
  { label: 'ACNC Charities', cmd: 'node scripts/sync-acnc-charities.mjs' },
  { label: 'ORIC Register', cmd: 'node scripts/import-oric-register.mjs' },
  { label: 'Mat. Views', cmd: 'node scripts/refresh-views.mjs' },
  { label: 'Foundation Profiles', cmd: 'npx tsx scripts/build-foundation-profiles.mjs --limit=50' },
];

async function enqueueMissionControlTask(agentId: string): Promise<TaskQueueResult> {
  const res = await fetch('/api/mission-control/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_id: agentId }),
  });

  const body = await res.json().catch(() => ({}));
  if (res.status === 409) {
    return {
      task: body.task,
      existing: true,
    };
  }

  if (!res.ok) {
    throw new Error(body.error || 'Failed to queue task');
  }

  return {
    task: body.task,
    existing: Boolean(body.existing),
  };
}

async function reenableFrontierRow(frontierId: string) {
  const res = await fetch(`/api/mission-control/frontier/${encodeURIComponent(frontierId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reenable' }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to re-enable frontier row');
  }

  return body.frontier;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MissionControlClient() {
  const [data, setData] = useState<MissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskQueueRefreshToken, setTaskQueueRefreshToken] = useState(0);
  const router = useRouter();

  const fetchData = useCallback(() => {
    fetch('/api/mission-control')
      .then(r => {
        if (r.status === 401) { router.push('/login'); return null; }
        return r.json();
      })
      .then(d => {
        if (d && !d.error) setData(d);
        else if (d?.error) setError(d.error);
      })
      .catch(() => setError('Failed to connect'))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleTaskQueued = useCallback(() => {
    setTaskQueueRefreshToken((current) => current + 1);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-bauhaus-black border-t-bauhaus-red animate-spin mx-auto mb-4" />
          <div className="text-sm font-black text-bauhaus-muted uppercase tracking-widest animate-pulse">
            Initialising Mission Control...
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sm font-black text-bauhaus-red uppercase tracking-widest">
          {error || 'Failed to load mission data'}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-bauhaus-black uppercase tracking-tight">Mission Control</h1>
          <p className="text-xs text-bauhaus-muted mt-1 font-mono">
            {data.hero.totalRecords.toLocaleString()} records across {data.hero.tableCount} datasets — updated {timeAgo(data.lastUpdated)}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="text-xs font-black uppercase tracking-wider px-4 py-2 border-4 border-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
        >
          Refresh
        </button>
      </div>

      {data.discoveries.length > 0 && (
        <DiscoveriesFeed discoveries={data.discoveries} onUpdate={fetchData} />
      )}
      <HeroMetrics hero={data.hero} />
      <DataInventory inventory={data.inventory} />
      <PowerConcentration power={data.power} />
      <AgentStatus agents={data.agents} />
      <SweepRuntime sweeps={data.agents.runtimeSweeps} onUpdate={fetchData} onTaskQueued={handleTaskQueued} />
      <FrontierExceptions rows={data.frontier.autoDisabled} onUpdate={fetchData} />
      <TaskQueue refreshToken={taskQueueRefreshToken} />
      <ScheduleManager />
      <SqlPlayground />
      <QuickLinks />
    </div>
  );
}

// ─── Hero Metrics ─────────────────────────────────────────────────────────────

function HeroMetrics({ hero }: { hero: HeroData }) {
  const cards = [
    { label: 'Total Records', value: hero.totalRecords.toLocaleString(), color: 'border-l-bauhaus-blue', icon: '/' },
    { label: 'Data Freshness', value: `${hero.freshnessPct}%`, color: 'border-l-green-500', sub: 'tables <7 days old' },
    { label: 'Active Pipelines', value: hero.activePipelines.toString(), color: 'border-l-yellow-500', sub: 'currently running' },
    { label: 'Health Score', value: `${hero.healthScore}%`, color: hero.healthScore >= 80 ? 'border-l-green-500' : hero.healthScore >= 50 ? 'border-l-yellow-500' : 'border-l-red-500', sub: 'success rate (7d)' },
    { label: 'Datasets', value: hero.tableCount.toString(), color: 'border-l-purple-500', sub: 'tracked tables' },
    { label: 'Last Sync', value: timeAgo(hero.lastSync), color: 'border-l-bauhaus-red', sub: hero.lastSync ? new Date(hero.lastSync).toLocaleDateString('en-AU') : '-' },
  ];

  return (
    <section className="mb-10">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map(c => (
          <div key={c.label} className={`border-4 border-bauhaus-black border-l-8 ${c.color} p-4`}>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted mb-2">{c.label}</div>
            <div className="text-2xl font-black text-bauhaus-black tabular-nums">{c.value}</div>
            {c.sub && <div className="text-[10px] text-bauhaus-muted mt-1">{c.sub}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Data Inventory ───────────────────────────────────────────────────────────

function DataInventory({ inventory }: { inventory: InventoryItem[] }) {
  const [sortBy, setSortBy] = useState<'count' | 'freshness' | 'name'>('count');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const sorted = [...inventory].sort((a, b) => {
    if (sortBy === 'count') return b.count - a.count;
    if (sortBy === 'freshness') return ageInDays(a.lastUpdated) - ageInDays(b.lastUpdated);
    return a.label.localeCompare(b.label);
  });

  const categories = ['entity', 'funding', 'registry', 'government', 'corporate', 'geographic', 'analytics'];
  const byCategory = categories.map(cat => ({
    category: cat,
    items: sorted.filter(i => i.category === cat),
    total: sorted.filter(i => i.category === cat).reduce((s, i) => s + i.count, 0),
  })).filter(g => g.items.length > 0);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted border-b-2 border-bauhaus-black pb-2">
          Data Inventory
        </h2>
        <div className="flex gap-1">
          {(['count', 'freshness', 'name'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-2 py-1 text-[10px] font-black uppercase tracking-wider border-2 transition-colors ${
                sortBy === s ? 'border-bauhaus-black bg-bauhaus-black text-white' : 'border-bauhaus-black/20 hover:border-bauhaus-black'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="border-4 border-bauhaus-black">
        {byCategory.map(group => (
          <div key={group.category}>
            <button
              onClick={() => toggleCategory(group.category)}
              className="w-full flex items-center justify-between px-4 py-2 bg-bauhaus-black/5 hover:bg-bauhaus-black/10 transition-colors border-b-2 border-bauhaus-black/10"
            >
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">
                {group.category} ({group.items.length})
              </span>
              <span className="text-xs font-mono text-bauhaus-muted">
                {group.total.toLocaleString()} records
                <span className="ml-2">{collapsedCategories.has(group.category) ? '+' : '-'}</span>
              </span>
            </button>
            {!collapsedCategories.has(group.category) && (
              <table className="w-full text-sm">
                <tbody>
                  {group.items.map(item => {
                    const status = item.static
                      ? { label: 'STATIC', color: 'bg-blue-100 text-blue-700' }
                      : freshnessStatus(item.lastUpdated);
                    return (
                      <tr key={item.key} className={`border-b border-bauhaus-black/5 hover:bg-gray-50 border-l-4 ${CATEGORY_COLORS[item.category] || ''}`}>
                        <td className="px-4 py-2 font-bold text-xs w-1/3">{item.label}</td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums w-1/6">{item.count.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-bauhaus-muted w-1/6">
                          {item.static ? 'Census 2021' : timeAgo(item.lastUpdated)}
                        </td>
                        <td className="px-4 py-2 text-center w-1/6">
                          <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-2 w-1/6">
                          <div className="h-1.5 bg-gray-200">
                            <div
                              className={`h-full transition-all ${
                                item.count > 50000 ? 'bg-bauhaus-blue' :
                                item.count > 10000 ? 'bg-green-500' :
                                item.count > 1000 ? 'bg-yellow-500' : 'bg-gray-400'
                              }`}
                              style={{ width: `${Math.min(100, (item.count / Math.max(...inventory.map(i => i.count))) * 100)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Power Concentration ──────────────────────────────────────────────────────

function PowerConcentration({ power }: { power: PowerData }) {
  const chartData = power.top20.map(e => ({
    name: e.entity_name.length > 25 ? e.entity_name.slice(0, 22) + '...' : e.entity_name,
    contracts: e.total_contract_value,
    donations: e.total_donated,
  }));

  const pieData = power.entityTypes
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(et => ({
      name: et.entity_type.replace(/_/g, ' '),
      value: et.count,
    }));

  return (
    <section className="mb-10">
      <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
        Power Concentration
      </h2>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="border-4 border-bauhaus-black p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted mb-1">Donor-Contractors</div>
          <div className="text-2xl font-black tabular-nums">{power.donorContractorCount.toLocaleString()}</div>
          <div className="text-[10px] text-bauhaus-muted">entities that both donate and hold contracts</div>
        </div>
        <div className="border-4 border-bauhaus-black border-l-8 border-l-green-500 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted mb-1">Total Donated</div>
          <div className="text-2xl font-black tabular-nums">{formatCurrency(power.totalDonated)}</div>
        </div>
        <div className="border-4 border-bauhaus-black border-l-8 border-l-bauhaus-red p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted mb-1">Total Contract Value</div>
          <div className="text-2xl font-black tabular-nums">{formatCurrency(power.totalContractValue)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 20 bar chart */}
        <div className="lg:col-span-2 border-4 border-bauhaus-black p-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted mb-4">
            Top 20 by Contract Value
          </h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" tickFormatter={(v: number) => formatCurrency(v)} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 9 }} />
                <Tooltip
                  formatter={(v) => formatCurrency(Number(v))}
                  contentStyle={{ border: '2px solid #1a1a1a', borderRadius: 0, fontSize: 12 }}
                />
                <Bar dataKey="contracts" fill="#E63946" name="Contracts" />
                <Bar dataKey="donations" fill="#457B9D" name="Donations" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[400px] flex items-center justify-center text-bauhaus-muted text-sm">No data available</div>
          )}
        </div>

        {/* Entity type pie */}
        <div className="border-4 border-bauhaus-black p-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted mb-4">
            By Entity Type
          </h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                    style={{ fontSize: 9 }}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {pieData.slice(0, 6).map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 inline-block" style={{ backgroundColor: PIE_COLORS[i] }} />
                      <span className="text-bauhaus-muted capitalize">{d.name}</span>
                    </span>
                    <span className="font-mono tabular-nums">{d.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-bauhaus-muted text-sm">No data</div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Agent Status ─────────────────────────────────────────────────────────────

function AgentStatus({ agents }: { agents: MissionData['agents'] }) {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const copyToClipboard = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <section className="mb-10">
      <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
        Agent Status
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent runs table */}
        <div className="lg:col-span-2 border-4 border-bauhaus-black overflow-x-auto">
          {agents.recentRuns.length === 0 ? (
            <div className="p-8 text-center text-sm text-bauhaus-muted">No agent runs recorded</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-[10px]">Agent</th>
                  <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-[10px]">Status</th>
                  <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-[10px]">Found</th>
                  <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-[10px]">New</th>
                  <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-[10px]">Duration</th>
                  <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-[10px]">When</th>
                </tr>
              </thead>
              <tbody>
                {agents.recentRuns.map(run => (
                  <tr key={run.id} className="border-t border-bauhaus-black/10 hover:bg-gray-50">
                    <td className="px-3 py-2 font-bold text-xs">{run.agent_name}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                        run.status === 'success' ? 'bg-green-600 text-white' :
                        run.status === 'partial' ? 'bg-yellow-500 text-bauhaus-black' :
                        run.status === 'failed' ? 'bg-red-500 text-white' :
                        run.status === 'running' ? 'bg-blue-500 text-white' :
                        'bg-gray-300 text-bauhaus-black'
                      }`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-xs">{run.items_found}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-xs">{run.items_new}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{formatDuration(run.duration_ms)}</td>
                    <td className="px-3 py-2 text-right text-bauhaus-muted text-xs">{timeAgo(run.completed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Refresh commands */}
        <div className="border-4 border-bauhaus-black p-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted mb-3">
            Refresh Commands
          </h3>
          <div className="space-y-2">
            {REFRESH_COMMANDS.map(rc => (
              <div key={rc.cmd} className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-bauhaus-muted">{rc.label}</div>
                  <code className="text-[10px] font-mono text-bauhaus-black/60 break-all">{rc.cmd}</code>
                </div>
                <button
                  onClick={() => copyToClipboard(rc.cmd)}
                  className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 border-2 flex-shrink-0 transition-colors ${
                    copiedCmd === rc.cmd
                      ? 'border-green-500 bg-green-500 text-white'
                      : 'border-bauhaus-black/20 hover:bg-bauhaus-black hover:text-white'
                  }`}
                >
                  {copiedCmd === rc.cmd ? '✓' : 'Copy'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SweepRuntime({
  sweeps,
  onUpdate,
  onTaskQueued,
}: {
  sweeps: MissionData['agents']['runtimeSweeps'];
  onUpdate: () => void;
  onTaskQueued: () => void;
}) {
  const [cursorInputs, setCursorInputs] = useState<Record<string, string>>({});
  const [updatingAgentId, setUpdatingAgentId] = useState<string | null>(null);
  const [queueingAgentId, setQueueingAgentId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [queueNotice, setQueueNotice] = useState<string | null>(null);

  const setCursor = async (agentId: string, cursor: number) => {
    setUpdatingAgentId(agentId);
    setUpdateError(null);
    try {
      const res = await fetch(`/api/mission-control/runtime-sweeps/${encodeURIComponent(agentId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cursor }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to update cursor');
      setCursorInputs(prev => ({ ...prev, [agentId]: String(cursor) }));
      onUpdate();
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Failed to update cursor');
    } finally {
      setUpdatingAgentId(null);
    }
  };

  const runSweep = async (agentId: string, agentName: string) => {
    setQueueingAgentId(agentId);
    setUpdateError(null);
    setQueueNotice(null);

    try {
      const result = await enqueueMissionControlTask(agentId);
      setQueueNotice(
        result.existing
          ? `${agentName} already has a pending or running task`
          : `${agentName} queued`
      );
      onTaskQueued();
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Failed to queue task');
    } finally {
      setQueueingAgentId(null);
    }
  };

  return (
    <section className="mb-10">
      <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
        Sweep Cursors
      </h2>

      {queueNotice && (
        <div className="mb-3 border-2 border-green-300 bg-green-50 px-3 py-2 text-xs font-mono text-green-700">
          {queueNotice}
        </div>
      )}

      {updateError && (
        <div className="mb-3 border-2 border-red-300 bg-red-50 px-3 py-2 text-xs font-mono text-red-700">
          {updateError}
        </div>
      )}

      <div className="border-4 border-bauhaus-black overflow-x-auto">
        {sweeps.length === 0 ? (
          <div className="p-8 text-center text-sm text-bauhaus-muted">No rotating sweep state recorded</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-[10px]">Sweep</th>
                <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-[10px]">Cursor</th>
                <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-[10px]">Last Batch</th>
                <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-[10px]">Last Output</th>
                <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-[10px]">Run Status</th>
                <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-[10px]">When</th>
              </tr>
            </thead>
            <tbody>
              {sweeps.map((sweep) => {
                const batchNames = Array.isArray(sweep.full_sweep_last_batch_foundation_names)
                  ? sweep.full_sweep_last_batch_foundation_names
                  : [];
                const cursor = sweep.full_sweep_cursor ?? 0;
                const candidateCount = sweep.full_sweep_candidate_count ?? 0;
                const progress = sweep.full_sweep_progress_pct ?? 0;
                const cursorInput = cursorInputs[sweep.agent_id] ?? String(cursor);
                const lastOutput = sweep.agent_id.includes('discover')
                  ? `${sweep.full_sweep_last_programs_found ?? 0} programs found`
                  : `${sweep.full_sweep_last_inserted ?? 0} inserted / ${sweep.full_sweep_last_updated ?? 0} updated`;
                const status = sweep.recent_run_status || (sweep.enabled ? 'scheduled' : 'disabled');

                return (
                  <tr key={sweep.agent_id} className="border-t border-bauhaus-black/10 hover:bg-gray-50 align-top">
                    <td className="px-3 py-3">
                      <div className="font-bold text-xs">{sweep.agent_name}</div>
                      <div className="text-[10px] text-bauhaus-muted font-mono mt-1">{sweep.agent_id}</div>
                      <div className="text-[10px] text-bauhaus-muted mt-1">
                        every {sweep.interval_hours ?? '-'}h {sweep.enabled ? '• enabled' : '• paused'}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-mono text-xs">{cursor} / {candidateCount || '-'}</div>
                      <div className="mt-2 h-2 w-28 bg-bauhaus-black/10 border border-bauhaus-black/20">
                        <div
                          className="h-full bg-bauhaus-blue"
                          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-bauhaus-muted mt-1">{progress.toFixed(1)}%</div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setCursor(sweep.agent_id, 0)}
                          disabled={updatingAgentId === sweep.agent_id}
                          className="px-2 py-1 text-[10px] font-black uppercase tracking-wider border-2 border-bauhaus-black/20 hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Reset
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={Math.max(0, candidateCount - 1)}
                          value={cursorInput}
                          onChange={(e) => setCursorInputs(prev => ({ ...prev, [sweep.agent_id]: e.target.value }))}
                          className="w-20 border-2 border-bauhaus-black/20 px-2 py-1 text-[10px] font-mono"
                        />
                        <button
                          onClick={() => {
                            const nextCursor = Number.parseInt(cursorInput, 10);
                            if (Number.isNaN(nextCursor)) {
                              setUpdateError('Cursor must be a number');
                              return;
                            }
                            void setCursor(sweep.agent_id, nextCursor);
                          }}
                          disabled={updatingAgentId === sweep.agent_id}
                          className="px-2 py-1 text-[10px] font-black uppercase tracking-wider border-2 border-bauhaus-black/20 hover:border-bauhaus-black hover:bg-bauhaus-blue hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Jump
                        </button>
                        <button
                          onClick={() => void runSweep(sweep.agent_id, sweep.agent_name)}
                          disabled={queueingAgentId === sweep.agent_id}
                          className="px-2 py-1 text-[10px] font-black uppercase tracking-wider border-2 border-bauhaus-red text-bauhaus-red hover:bg-bauhaus-red hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {queueingAgentId === sweep.agent_id ? 'Queueing...' : 'Run Now'}
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {batchNames.length === 0 ? (
                        <span className="text-bauhaus-muted">No batch yet</span>
                      ) : (
                        <div className="space-y-1">
                          {batchNames.slice(0, 3).map((name) => (
                            <div key={name} className="font-medium">{name}</div>
                          ))}
                          {batchNames.length > 3 && (
                            <div className="text-[10px] text-bauhaus-muted">+{batchNames.length - 3} more</div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <div>{lastOutput}</div>
                      <div className="text-[10px] text-bauhaus-muted mt-1">
                        advanced {sweep.full_sweep_advanced_by ?? 0} • errors {sweep.full_sweep_last_errors ?? 0}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                        status === 'success' ? 'bg-green-600 text-white' :
                        status === 'partial' ? 'bg-yellow-500 text-bauhaus-black' :
                        status === 'failed' ? 'bg-red-500 text-white' :
                        status === 'running' ? 'bg-blue-500 text-white' :
                        'bg-gray-300 text-bauhaus-black'
                      }`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-bauhaus-muted text-xs">
                      {timeAgo(sweep.full_sweep_last_run_at || sweep.recent_run_completed_at || sweep.schedule_last_run_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function FrontierExceptions({
  rows,
  onUpdate,
}: {
  rows: MissionData['frontier']['autoDisabled'];
  onUpdate: () => void;
}) {
  const [updatingRowId, setUpdatingRowId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReenable = async (rowId: string, label: string) => {
    setUpdatingRowId(rowId);
    setNotice(null);
    setError(null);
    try {
      await reenableFrontierRow(rowId);
      setNotice(`${label} re-enabled`);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to re-enable frontier row');
    } finally {
      setUpdatingRowId(null);
    }
  };

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted border-b-2 border-bauhaus-black pb-2">
          Frontier Exceptions
        </h2>
        <div className="text-[10px] font-mono text-bauhaus-muted">
          {rows.length} auto-disabled candidate{rows.length === 1 ? '' : 's'}
        </div>
      </div>

      {notice && (
        <div className="mb-3 border-2 border-green-300 bg-green-50 px-3 py-2 text-xs font-mono text-green-700">
          {notice}
        </div>
      )}

      {error && (
        <div className="mb-3 border-2 border-red-300 bg-red-50 px-3 py-2 text-xs font-mono text-red-700">
          {error}
        </div>
      )}

      <div className="border-4 border-bauhaus-black overflow-x-auto">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-bauhaus-muted">No auto-disabled frontier rows</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-[10px]">Foundation</th>
                <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-[10px]">Target</th>
                <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-[10px]">Reason</th>
                <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-[10px]">HTTP</th>
                <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-[10px]">Disabled</th>
                <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-[10px]">Next Check</th>
                <th className="text-center px-3 py-2 font-black uppercase tracking-wider text-[10px]">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-bauhaus-black/10 hover:bg-gray-50 align-top">
                  <td className="px-3 py-3">
                    <div className="font-bold text-xs">{row.foundationName || row.sourceName || 'Unknown foundation'}</div>
                    <div className="text-[10px] font-mono text-bauhaus-muted mt-1">{row.sourceKind}</div>
                  </td>
                  <td className="px-3 py-3">
                    <a
                      href={row.targetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-mono text-bauhaus-blue underline underline-offset-2 break-all"
                    >
                      {row.targetUrl}
                    </a>
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <div className="font-bold uppercase tracking-wide text-[10px] text-bauhaus-red">
                      {(row.autoDisabledReason || 'auto-disabled').replace(/_/g, ' ')}
                    </div>
                    <div className="text-[10px] text-bauhaus-muted mt-1">
                      cadence: {(row.lastEffectiveCadenceReason || 'n/a').replace(/_/g, ' ')}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <div className="font-mono">{row.lastHttpStatus ?? '-'}</div>
                    <div className="text-[10px] text-bauhaus-muted mt-1">
                      failures {row.autoDisabledFailureCount || row.failureCount || 0}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right text-xs text-bauhaus-muted">
                    {timeAgo(row.autoDisabledAt || row.updatedAt)}
                  </td>
                  <td className="px-3 py-3 text-right text-xs text-bauhaus-muted">
                    {timeAgo(row.nextCheckAt)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={() => void handleReenable(row.id, row.foundationName || row.targetUrl)}
                      disabled={updatingRowId === row.id}
                      className="px-2 py-1 text-[10px] font-black uppercase tracking-wider border-2 border-bauhaus-blue text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updatingRowId === row.id ? 'Re-enabling...' : 'Re-enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

// ─── Task Queue ──────────────────────────────────────────────────────────────

function TaskQueue({ refreshToken }: { refreshToken: number }) {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [registry, setRegistry] = useState<RegistryAgent[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [creating, setCreating] = useState(false);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);

  const fetchTasks = useCallback(() => {
    fetch('/api/mission-control/tasks?limit=30')
      .then(r => r.json())
      .then(d => { if (d.tasks) setTasks(d.tasks); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchTasks();
    fetch('/api/mission-control/registry')
      .then(r => r.json())
      .then(d => { if (d.agents) setRegistry(d.agents); })
      .catch(() => {});
  }, [fetchTasks]);

  useEffect(() => {
    const interval = setInterval(fetchTasks, 15_000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  useEffect(() => {
    if (refreshToken > 0) fetchTasks();
  }, [fetchTasks, refreshToken]);

  const createTask = async (agentId: string) => {
    setCreating(true);
    setQueueMessage(null);
    setQueueError(null);
    try {
      const result = await enqueueMissionControlTask(agentId);
      const agentName = registry.find(a => a.id === agentId)?.displayName || agentId;
      setQueueMessage(
        result.existing
          ? `${agentName} already has a pending or running task`
          : `${agentName} queued`
      );
      fetchTasks();
    } catch (err) {
      setQueueError(err instanceof Error ? err.message : 'Failed to queue task');
    }
    setCreating(false);
  };

  const cancelTask = async (taskId: string) => {
    await fetch(`/api/mission-control/tasks/${taskId}/cancel`, { method: 'POST' });
    fetchTasks();
  };

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);
  const statusCounts = {
    pending: tasks.filter(t => t.status === 'pending').length,
    running: tasks.filter(t => t.status === 'running').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
  };

  // Group registry by category for the dropdown
  const categories = [...new Set(registry.map(a => a.category))];

  return (
    <section className="mb-10">
      <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
        Task Queue
      </h2>

      {/* Status filter + create */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-1">
          {(['all', 'pending', 'running', 'completed', 'failed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-2 py-1 text-[10px] font-black uppercase tracking-wider border-2 transition-colors ${
                filter === s ? 'border-bauhaus-black bg-bauhaus-black text-white' : 'border-bauhaus-black/20 hover:border-bauhaus-black'
              }`}
            >
              {s} {s !== 'all' && statusCounts[s] > 0 ? `(${statusCounts[s]})` : ''}
            </button>
          ))}
        </div>

        {/* Quick-run dropdown */}
        <details className="relative">
          <summary className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border-2 border-bauhaus-black cursor-pointer select-none hover:bg-bauhaus-black hover:text-white transition-colors ${creating ? 'opacity-50' : ''}`}>
            Run Agent
          </summary>
          <div className="absolute right-0 top-full mt-1 z-50 bg-white border-4 border-bauhaus-black shadow-lg w-72 max-h-80 overflow-y-auto">
            {categories.map(cat => (
              <div key={cat}>
                <div className="px-3 py-1.5 bg-bauhaus-black/5 text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">
                  {cat}
                </div>
                {registry.filter(a => a.category === cat).map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => createTask(agent.id)}
                    disabled={creating}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-bauhaus-black hover:text-white transition-colors"
                  >
                    {agent.displayName}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </details>
      </div>

      {queueMessage && (
        <div className="mb-3 border-2 border-green-300 bg-green-50 px-3 py-2 text-xs font-mono text-green-700">
          {queueMessage}
        </div>
      )}

      {queueError && (
        <div className="mb-3 border-2 border-red-300 bg-red-50 px-3 py-2 text-xs font-mono text-red-700">
          {queueError}
        </div>
      )}

      {/* Task list */}
      <div className="border-4 border-bauhaus-black overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-bauhaus-muted">No tasks</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-[10px]">Agent</th>
                <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-[10px]">Status</th>
                <th className="text-center px-3 py-2 font-black uppercase tracking-wider text-[10px]">Priority</th>
                <th className="text-center px-3 py-2 font-black uppercase tracking-wider text-[10px]">Retries</th>
                <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-[10px]">Created</th>
                <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-[10px]">By</th>
                <th className="text-center px-3 py-2 font-black uppercase tracking-wider text-[10px]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(task => {
                const agentName = registry.find(a => a.id === task.agent_id)?.displayName || task.agent_id;
                return (
                  <tr key={task.id} className="border-t border-bauhaus-black/10 hover:bg-gray-50">
                    <td className="px-3 py-2 font-bold text-xs">{agentName}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                        task.status === 'completed' ? 'bg-green-600 text-white' :
                        task.status === 'running' ? 'bg-blue-500 text-white' :
                        task.status === 'pending' ? 'bg-yellow-500 text-bauhaus-black' :
                        task.status === 'failed' ? 'bg-red-500 text-white' :
                        'bg-gray-300 text-bauhaus-black'
                      }`}>
                        {task.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{task.priority}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">
                      {task.retry_count > 0 ? `${task.retry_count}/${task.max_retries}` : '-'}
                    </td>
                    <td className="px-3 py-2 text-right text-bauhaus-muted text-xs">{timeAgo(task.created_at)}</td>
                    <td className="px-3 py-2 text-right text-bauhaus-muted text-xs truncate max-w-[80px]">{task.created_by}</td>
                    <td className="px-3 py-2 text-center">
                      {(task.status === 'pending' || task.status === 'running') && (
                        <button
                          onClick={() => cancelTask(task.id)}
                          className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border border-red-400 text-red-600 hover:bg-red-500 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Error display for failed tasks */}
      {filtered.some(t => t.status === 'failed' && t.error) && (
        <div className="mt-3 space-y-2">
          {filtered.filter(t => t.status === 'failed' && t.error).slice(0, 3).map(t => (
            <div key={t.id} className="p-2 border-2 border-red-300 bg-red-50 text-xs font-mono text-red-700">
              <span className="font-bold">{t.agent_id}:</span> {t.error}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Schedule Manager ────────────────────────────────────────────────────────

function ScheduleManager() {
  const [schedules, setSchedules] = useState<AgentSchedule[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchSchedules = useCallback(() => {
    fetch('/api/mission-control/schedules')
      .then(r => r.json())
      .then(d => { if (d.schedules) setSchedules(d.schedules); })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  const toggleEnabled = async (schedule: AgentSchedule) => {
    setUpdating(schedule.id);
    try {
      await fetch(`/api/mission-control/schedules/${schedule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !schedule.enabled }),
      });
      fetchSchedules();
    } catch { /* ignore */ }
    setUpdating(null);
  };

  const updateInterval = async (schedule: AgentSchedule, hours: number) => {
    setUpdating(schedule.id);
    try {
      await fetch(`/api/mission-control/schedules/${schedule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval_hours: hours }),
      });
      fetchSchedules();
    } catch { /* ignore */ }
    setUpdating(null);
  };

  if (schedules.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
        Auto-Schedules
      </h2>

      <div className="border-4 border-bauhaus-black overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bauhaus-black text-white">
              <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-[10px]">Agent</th>
              <th className="text-center px-3 py-2 font-black uppercase tracking-wider text-[10px]">Enabled</th>
              <th className="text-center px-3 py-2 font-black uppercase tracking-wider text-[10px]">Interval</th>
              <th className="text-center px-3 py-2 font-black uppercase tracking-wider text-[10px]">Priority</th>
              <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-[10px]">Last Run</th>
              <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-[10px]">Next Due</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map(s => {
              const nextDue = s.last_run_at
                ? new Date(new Date(s.last_run_at).getTime() + s.interval_hours * 3600_000)
                : null;
              const overdue = nextDue && nextDue.getTime() < Date.now();

              return (
                <tr key={s.id} className={`border-t border-bauhaus-black/10 hover:bg-gray-50 ${!s.enabled ? 'opacity-50' : ''}`}>
                  <td className="px-3 py-2 font-bold text-xs">{s.agent_id}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => toggleEnabled(s)}
                      disabled={updating === s.id}
                      className={`w-10 h-5 rounded-full relative transition-colors ${
                        s.enabled ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        s.enabled ? 'left-5' : 'left-0.5'
                      }`} />
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <select
                      value={s.interval_hours}
                      onChange={e => updateInterval(s, parseFloat(e.target.value))}
                      disabled={updating === s.id}
                      className="text-xs font-mono border border-bauhaus-black/20 px-1 py-0.5 bg-white"
                    >
                      {[6, 12, 24, 48, 72, 168, 336, 720].map(h => (
                        <option key={h} value={h}>
                          {h < 24 ? `${h}h` : h < 168 ? `${h / 24}d` : `${(h / 168).toFixed(0)}w`}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-center font-mono text-xs">{s.priority}</td>
                  <td className="px-3 py-2 text-right text-bauhaus-muted text-xs">{timeAgo(s.last_run_at)}</td>
                  <td className="px-3 py-2 text-right text-xs">
                    {!s.enabled ? (
                      <span className="text-bauhaus-muted">disabled</span>
                    ) : nextDue ? (
                      <span className={overdue ? 'text-red-600 font-bold' : 'text-bauhaus-muted'}>
                        {overdue ? 'OVERDUE' : timeAgo(new Date(Date.now() - (nextDue.getTime() - Date.now())).toISOString())}
                      </span>
                    ) : (
                      <span className="text-yellow-600 font-bold">NOW</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── SQL Playground ───────────────────────────────────────────────────────────

function SqlPlayground() {
  const [sql, setSql] = useState('');
  const [result, setResult] = useState<{ columns: string[]; rows: Record<string, unknown>[]; rowCount: number; duration: number } | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const executeQuery = async () => {
    if (!sql.trim()) return;
    setRunning(true);
    setQueryError(null);
    setResult(null);

    try {
      const res = await fetch('/api/mission-control/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sql.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setQueryError(data.error);
      } else {
        setResult(data);
      }
    } catch {
      setQueryError('Failed to execute query');
    } finally {
      setRunning(false);
    }
  };

  const exportCsv = () => {
    if (!result || result.rows.length === 0) return;
    const header = result.columns.join(',');
    const rows = result.rows.map(row =>
      result.columns.map(col => {
        const val = row[col];
        const str = val === null ? '' : String(val);
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query-result.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="mb-10">
      <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
        SQL Playground
      </h2>

      <div className="border-4 border-bauhaus-black p-4">
        {/* Template selector */}
        <div className="flex flex-wrap gap-1 mb-3">
          {SQL_TEMPLATES.map(t => (
            <button
              key={t.label}
              onClick={() => setSql(t.sql)}
              className="px-2 py-1 text-[10px] font-black uppercase tracking-wider border-2 border-bauhaus-black/20 hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Editor */}
        <textarea
          value={sql}
          onChange={e => setSql(e.target.value)}
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              executeQuery();
            }
          }}
          placeholder="SELECT * FROM gs_entities LIMIT 10"
          className="w-full h-28 p-3 font-mono text-sm border-2 border-bauhaus-black/20 focus:border-bauhaus-black outline-none resize-y bg-gray-50"
          spellCheck={false}
        />

        {/* Controls */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <button
              onClick={executeQuery}
              disabled={running || !sql.trim()}
              className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-4 transition-colors ${
                running ? 'border-bauhaus-black/30 text-bauhaus-muted cursor-wait' :
                'border-bauhaus-black bg-bauhaus-black text-white hover:bg-bauhaus-red hover:border-bauhaus-red'
              }`}
            >
              {running ? 'Running...' : 'Execute'}
            </button>
            <span className="text-[10px] text-bauhaus-muted">
              {navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to run
            </span>
          </div>
          {result && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-bauhaus-muted">
                {result.rowCount} rows in {result.duration}ms
              </span>
              <button
                onClick={exportCsv}
                className="px-3 py-1 text-[10px] font-black uppercase tracking-wider border-2 border-bauhaus-black/20 hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
              >
                Export CSV
              </button>
            </div>
          )}
        </div>

        {/* Error */}
        {queryError && (
          <div className="mt-3 p-3 border-4 border-red-500 bg-red-50 text-sm font-mono text-red-700">
            {queryError}
          </div>
        )}

        {/* Results table */}
        {result && result.rows.length > 0 && (
          <div className="mt-3 border-2 border-bauhaus-black/20 overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="bg-bauhaus-black text-white">
                  {result.columns.map(col => (
                    <th key={col} className="text-left px-3 py-2 font-black uppercase tracking-wider text-[10px] whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i} className="border-t border-bauhaus-black/5 hover:bg-gray-50">
                    {result.columns.map(col => (
                      <td key={col} className="px-3 py-1.5 font-mono text-xs whitespace-nowrap max-w-[300px] truncate">
                        {row[col] === null ? <span className="text-bauhaus-muted italic">null</span> : String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result && result.rows.length === 0 && !queryError && (
          <div className="mt-3 p-4 text-center text-sm text-bauhaus-muted border-2 border-dashed border-bauhaus-black/20">
            Query returned 0 rows
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Discoveries Feed ─────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  significant: 'bg-orange-500 text-white',
  notable: 'bg-yellow-500 text-bauhaus-black',
  info: 'bg-gray-200 text-bauhaus-black',
};

const TYPE_LABELS: Record<string, string> = {
  board_appointment: 'Board Appointment',
  board_departure: 'Board Departure',
  new_interlock: 'New Interlock',
  funding_anomaly: 'Funding Anomaly',
  new_contract: 'New Contract',
  entity_change: 'Entity Change',
  gazette_alert: 'Gazette Alert',
  data_quality: 'Data Quality',
  pattern: 'Pattern',
};

function DiscoveriesFeed({ discoveries, onUpdate }: { discoveries: Discovery[]; onUpdate: () => void }) {
  const [filter, setFilter] = useState<string>('all');
  const [acting, setActing] = useState<string | null>(null);

  const severityCounts = {
    critical: discoveries.filter(d => d.severity === 'critical').length,
    significant: discoveries.filter(d => d.severity === 'significant').length,
    notable: discoveries.filter(d => d.severity === 'notable').length,
    info: discoveries.filter(d => d.severity === 'info').length,
  };

  const filtered = filter === 'all'
    ? discoveries
    : discoveries.filter(d => d.severity === filter);

  const unreviewed = discoveries.filter(d => !d.reviewed_at).length;

  const handleAction = async (id: string, action: 'dismiss' | 'review') => {
    setActing(id);
    try {
      await fetch(`/api/mission-control/discoveries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      onUpdate();
    } catch { /* ignore */ }
    setActing(null);
  };

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted border-b-2 border-bauhaus-red pb-2">
            Autoresearch Discoveries
          </h2>
          {unreviewed > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-bauhaus-red text-white">
              {unreviewed} new
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {(['all', 'critical', 'significant', 'notable', 'info'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-2 py-1 text-[10px] font-black uppercase tracking-wider border-2 transition-colors ${
                filter === s ? 'border-bauhaus-black bg-bauhaus-black text-white' : 'border-bauhaus-black/20 hover:border-bauhaus-black'
              }`}
            >
              {s} {s !== 'all' && severityCounts[s] > 0 ? `(${severityCounts[s]})` : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="border-4 border-bauhaus-black">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-bauhaus-muted">No discoveries matching filter</div>
        ) : (
          <div className="divide-y divide-bauhaus-black/10">
            {filtered.map(d => (
              <div
                key={d.id}
                className={`px-4 py-3 hover:bg-gray-50 transition-colors ${
                  !d.reviewed_at ? 'border-l-4 border-l-bauhaus-red' : 'border-l-4 border-l-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${SEVERITY_STYLES[d.severity]}`}>
                        {d.severity}
                      </span>
                      <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-bauhaus-black/5 text-bauhaus-muted">
                        {TYPE_LABELS[d.discovery_type] || d.discovery_type}
                      </span>
                      <span className="text-[10px] text-bauhaus-muted font-mono">
                        {d.agent_id}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-bauhaus-black">{d.title}</div>
                    {d.description && (
                      <div className="text-xs text-bauhaus-muted mt-0.5 line-clamp-2">{d.description}</div>
                    )}
                    {d.person_names && d.person_names.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {d.person_names.map(name => (
                          <span key={name} className="px-1.5 py-0.5 text-[9px] font-mono bg-bauhaus-blue/10 text-bauhaus-blue">
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-bauhaus-muted whitespace-nowrap">{timeAgo(d.created_at)}</span>
                    {!d.reviewed_at && (
                      <>
                        <button
                          onClick={() => handleAction(d.id, 'review')}
                          disabled={acting === d.id}
                          className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border border-green-500 text-green-700 hover:bg-green-500 hover:text-white transition-colors"
                        >
                          Ack
                        </button>
                        <button
                          onClick={() => handleAction(d.id, 'dismiss')}
                          disabled={acting === d.id}
                          className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border border-bauhaus-black/20 text-bauhaus-muted hover:bg-bauhaus-black hover:text-white transition-colors"
                        >
                          Dismiss
                        </button>
                      </>
                    )}
                    {d.reviewed_at && (
                      <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-green-100 text-green-700">
                        Reviewed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Quick Links ──────────────────────────────────────────────────────────────

function QuickLinks() {
  const links = [
    { href: '/power', label: 'Power Dynamics', desc: 'Map + Sankey flow analysis' },
    { href: '/ops/health', label: 'Pipeline Health', desc: 'Full data quality dashboard' },
    { href: '/entities', label: 'Entity Graph', desc: '80K entities, 50K relationships' },
    { href: '/benchmark', label: 'Benchmark', desc: 'AI quality evaluation' },
    { href: '/places', label: 'Places', desc: 'Funding gap analysis by postcode' },
    { href: '/dashboard', label: 'Dashboard', desc: 'Overview & key metrics' },
    { href: '/admin/api-usage', label: 'API Usage', desc: 'Per-org keys & rate limits' },
    { href: '/agent', label: 'Agent API', desc: 'Storefront & playground' },
  ];

  return (
    <section className="mb-10">
      <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
        Quick Links
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {links.map(link => (
          <a
            key={link.href}
            href={link.href}
            className="border-4 border-bauhaus-black p-4 hover:bg-bauhaus-black hover:text-white transition-colors group"
          >
            <div className="text-xs font-black uppercase tracking-wider group-hover:text-white">{link.label}</div>
            <div className="text-[10px] text-bauhaus-muted group-hover:text-white/70 mt-1">{link.desc}</div>
          </a>
        ))}
      </div>
    </section>
  );
}
