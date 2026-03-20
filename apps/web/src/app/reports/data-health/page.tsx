import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Data Health | CivicGraph',
  description: 'Coverage and completeness metrics across 7 data systems powering CivicGraph.',
};

/* ─── Formatting helpers ──────────────────────────── */

function fmt(n: number): string { return n.toLocaleString(); }

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function linkageColor(pct: number): string {
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 50) return 'bg-yellow-500';
  return 'bg-bauhaus-red';
}

function linkageTextColor(pct: number): string {
  if (pct >= 80) return 'text-green-600';
  if (pct >= 50) return 'text-yellow-600';
  return 'text-bauhaus-red';
}

function agentStatusColor(status: string, startedAt: string | null): string {
  if (status === 'failed' || status === 'error') return 'text-bauhaus-red';
  if (!startedAt) return 'text-bauhaus-muted';
  const ms = Date.now() - new Date(startedAt).getTime();
  if (ms < 86400000) return 'text-green-600'; // < 24h
  return 'text-yellow-600'; // > 24h
}

function agentStatusDot(status: string, startedAt: string | null): string {
  if (status === 'failed' || status === 'error') return 'bg-bauhaus-red';
  if (!startedAt) return 'bg-gray-300';
  const ms = Date.now() - new Date(startedAt).getTime();
  if (ms < 86400000) return 'bg-green-500';
  return 'bg-yellow-500';
}

/* ─── Types ───────────────────────────────────────── */

interface EntityStats {
  total: number;
  with_abn: number;
  without_abn: number;
  abn_pct: number;
  community_controlled: number;
  by_type: { entity_type: string; count: string }[];
  by_state: { state: string; count: string }[];
}

interface RelStats {
  total: number;
  by_type: { relationship_type: string; count: string }[];
  by_dataset: { dataset: string; count: string }[];
}

interface LinkageStats {
  total: number;
  linked: number;
  unlinked: number;
  pct_linked: number;
}

interface AlmaStats extends LinkageStats {
  by_type: { type: string; count: string }[];
  evidence_records: number;
  outcome_records: number;
}

interface FoundationStats {
  total: number;
  with_abn: number;
  abn_pct: number;
  grant_opportunities: number;
}

interface ContractStats {
  total: number;
  with_abn: number;
  abn_pct: number;
}

interface AgentRun {
  agent_name: string;
  status: string;
  started_at: string | null;
  items_found: string | number;
  items_new: string | number;
  duration_ms: string | number;
}

/* ─── safe() wrapper ──────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safe<T = any>(p: PromiseLike<T>, ms = 12000): Promise<T | { data: null; error: string }> {
  const fallback = { data: null, error: 'timeout' };
  return Promise.race([
    Promise.resolve(p),
    new Promise<{ data: null; error: string }>(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/* ─── Data fetching ───────────────────────────────── */

async function getData(): Promise<{
  entities: EntityStats;
  relationships: RelStats;
  justice: LinkageStats;
  alma: AlmaStats;
  foundations: FoundationStats;
  contracts: ContractStats;
  agents: AgentRun[];
  latestAgentRun: string | null;
}> {
  const db = getServiceSupabase();

  const [
    entityStatsResult,
    entityByTypeResult,
    entityByStateResult,
    relTotalResult,
    relByTypeResult,
    relByDatasetResult,
    justiceLinkageResult,
    almaStatsResult,
    almaByTypeResult,
    almaEvidenceResult,
    almaOutcomesResult,
    foundationStatsResult,
    grantOpResult,
    contractStatsResult,
    agentHealthResult,
  ] = await Promise.all([
    safe(db.rpc('exec_sql', {
      query: `SELECT
        COUNT(*) as total,
        COUNT(abn) as with_abn,
        COUNT(*) - COUNT(abn) as without_abn,
        COUNT(CASE WHEN is_community_controlled THEN 1 END) as community_controlled,
        ROUND(COUNT(abn)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as abn_pct
      FROM gs_entities`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT entity_type, COUNT(*) as count FROM gs_entities GROUP BY entity_type ORDER BY count DESC`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT COALESCE(state, 'Unknown') as state, COUNT(*) as count FROM gs_entities GROUP BY state ORDER BY count DESC`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT COUNT(*) as total FROM gs_relationships`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT relationship_type, COUNT(*) as count FROM gs_relationships GROUP BY relationship_type ORDER BY count DESC`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT dataset, COUNT(*) as count FROM gs_relationships GROUP BY dataset ORDER BY count DESC`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT
        COUNT(*) as total,
        COUNT(gs_entity_id) as linked,
        COUNT(*) - COUNT(gs_entity_id) as unlinked,
        ROUND(COUNT(gs_entity_id)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as pct_linked
      FROM justice_funding`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT
        COUNT(*) as total,
        COUNT(gs_entity_id) as linked,
        COUNT(*) - COUNT(gs_entity_id) as unlinked,
        ROUND(COUNT(gs_entity_id)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as pct_linked
      FROM alma_interventions`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT type, COUNT(*) as count FROM alma_interventions GROUP BY type ORDER BY count DESC`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT COUNT(*) as total FROM alma_evidence`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT COUNT(*) as total FROM alma_outcomes`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT
        COUNT(*) as total,
        COUNT(acnc_abn) as with_abn,
        ROUND(COUNT(acnc_abn)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as abn_pct
      FROM foundations`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT COUNT(*) as total FROM grant_opportunities`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT
        COUNT(*) as total,
        COUNT(supplier_abn) as with_abn,
        ROUND(COUNT(supplier_abn)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as abn_pct
      FROM austender_contracts`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT DISTINCT ON (agent_name)
        agent_name, status, started_at, items_found, items_new, duration_ms
      FROM agent_runs
      ORDER BY agent_name, started_at DESC`,
    })),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parse = (r: any) => r?.data ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parseFirst = (r: any) => (r?.data ?? [])[0] ?? {};

  const es = parseFirst(entityStatsResult);
  const jl = parseFirst(justiceLinkageResult);
  const as_ = parseFirst(almaStatsResult);
  const fs = parseFirst(foundationStatsResult);
  const go = parseFirst(grantOpResult);
  const cs = parseFirst(contractStatsResult);
  const agents = parse(agentHealthResult) as AgentRun[];

  // Find most recent agent run
  let latestAgentRun: string | null = null;
  for (const a of agents) {
    if (a.started_at && (!latestAgentRun || a.started_at > latestAgentRun)) {
      latestAgentRun = a.started_at;
    }
  }

  return {
    entities: {
      total: Number(es.total ?? 0),
      with_abn: Number(es.with_abn ?? 0),
      without_abn: Number(es.without_abn ?? 0),
      abn_pct: Number(es.abn_pct ?? 0),
      community_controlled: Number(es.community_controlled ?? 0),
      by_type: parse(entityByTypeResult),
      by_state: parse(entityByStateResult),
    },
    relationships: {
      total: Number(parseFirst(relTotalResult).total ?? 0),
      by_type: parse(relByTypeResult),
      by_dataset: parse(relByDatasetResult),
    },
    justice: {
      total: Number(jl.total ?? 0),
      linked: Number(jl.linked ?? 0),
      unlinked: Number(jl.unlinked ?? 0),
      pct_linked: Number(jl.pct_linked ?? 0),
    },
    alma: {
      total: Number(as_.total ?? 0),
      linked: Number(as_.linked ?? 0),
      unlinked: Number(as_.unlinked ?? 0),
      pct_linked: Number(as_.pct_linked ?? 0),
      by_type: parse(almaByTypeResult),
      evidence_records: Number(parseFirst(almaEvidenceResult).total ?? 0),
      outcome_records: Number(parseFirst(almaOutcomesResult).total ?? 0),
    },
    foundations: {
      total: Number(fs.total ?? 0),
      with_abn: Number(fs.with_abn ?? 0),
      abn_pct: Number(fs.abn_pct ?? 0),
      grant_opportunities: Number(go.total ?? 0),
    },
    contracts: {
      total: Number(cs.total ?? 0),
      with_abn: Number(cs.with_abn ?? 0),
      abn_pct: Number(cs.abn_pct ?? 0),
    },
    agents,
    latestAgentRun,
  };
}

/* ─── Progress bar component ──────────────────────── */

function ProgressBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs font-bold text-bauhaus-muted">{label}</span>
        <span className={`text-sm font-black ${linkageTextColor(pct)}`}>{pct}%</span>
      </div>
      <div className="w-full bg-gray-100 h-3">
        <div
          className={`h-3 transition-all ${linkageColor(pct)}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────── */

export default async function DataHealthPage() {
  const d = await getData();

  // Calculate max entity type count for bar sizing
  const maxTypeCount = d.entities.by_type.length > 0
    ? Math.max(...d.entities.by_type.map(t => Number(t.count)))
    : 1;

  // Calculate max state count for bar sizing
  const maxStateCount = d.entities.by_state.length > 0
    ? Math.max(...d.entities.by_state.map(s => Number(s.count)))
    : 1;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-blue mt-4 mb-1 uppercase tracking-widest">Platform Infrastructure</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Data Health
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          Coverage and completeness across 7 data systems. {fmt(d.entities.total)} entities,{' '}
          {fmt(d.relationships.total)} relationships, {fmt(d.contracts.total)} contracts.
          Real-time transparency on what we have and what is missing.
        </p>
      </div>

      {/* ── Hero Stats Row ──────────────────────── */}
      <section className="mb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
          <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-black text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Entities</div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(d.entities.total)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">{d.entities.abn_pct}% have ABN</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 border-bauhaus-black p-6 bg-bauhaus-blue text-white">
            <div className="text-xs font-black text-blue-200 uppercase tracking-widest mb-2">Relationships</div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(d.relationships.total)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">{d.relationships.by_type.length} types</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Contracts</div>
            <div className="text-3xl sm:text-4xl font-black text-bauhaus-black">{fmt(d.contracts.total)}</div>
            <div className="text-bauhaus-muted/60 text-xs font-bold mt-2">{d.contracts.abn_pct}% with supplier ABN</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-red text-white">
            <div className="text-xs font-black text-red-200 uppercase tracking-widest mb-2">Data Freshness</div>
            <div className="text-3xl sm:text-4xl font-black">{relativeTime(d.latestAgentRun)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">last agent run</div>
          </div>
        </div>
      </section>

      {/* ── Section 1: Entity Coverage ──────────── */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Entity Coverage
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          {fmt(d.entities.total)} entities resolved across all datasets.{' '}
          {fmt(d.entities.with_abn)} ({d.entities.abn_pct}%) have an Australian Business Number.{' '}
          {fmt(d.entities.community_controlled)} are community-controlled organisations.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Entity type distribution */}
          <div className="border-4 border-bauhaus-black p-6 bg-white">
            <h3 className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-4">By Entity Type</h3>
            {d.entities.by_type.slice(0, 10).map(t => (
              <div key={t.entity_type} className="flex items-center gap-3 mb-2">
                <div className="w-28 text-xs font-bold text-bauhaus-black text-right shrink-0 truncate" title={t.entity_type}>
                  {t.entity_type || 'Unknown'}
                </div>
                <div className="flex-1 h-5 bg-gray-100 relative">
                  <div
                    className="h-full bg-bauhaus-black transition-all"
                    style={{ width: `${(Number(t.count) / maxTypeCount) * 100}%` }}
                  />
                </div>
                <div className="w-16 text-xs font-mono font-bold text-right shrink-0">{fmt(Number(t.count))}</div>
              </div>
            ))}
          </div>

          {/* State distribution */}
          <div className="border-4 border-l-0 max-lg:border-l-4 max-lg:border-t-0 border-bauhaus-black p-6 bg-white">
            <h3 className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-4">By State</h3>
            {d.entities.by_state.slice(0, 10).map(s => (
              <div key={s.state} className="flex items-center gap-3 mb-2">
                <div className="w-20 text-xs font-bold text-bauhaus-black text-right shrink-0">{s.state}</div>
                <div className="flex-1 h-5 bg-gray-100 relative">
                  <div
                    className="h-full bg-bauhaus-blue transition-all"
                    style={{ width: `${(Number(s.count) / maxStateCount) * 100}%` }}
                  />
                </div>
                <div className="w-16 text-xs font-mono font-bold text-right shrink-0">{fmt(Number(s.count))}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ABN coverage bar */}
        <div className="border-4 border-t-0 border-bauhaus-black p-6 bg-bauhaus-canvas">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-black text-bauhaus-black">{d.entities.abn_pct}%</div>
              <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mt-1">ABN Coverage</div>
              <div className="text-sm text-bauhaus-muted mt-1">{fmt(d.entities.with_abn)} of {fmt(d.entities.total)}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-green-600">{fmt(d.entities.community_controlled)}</div>
              <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mt-1">Community-Controlled</div>
              <div className="text-sm text-bauhaus-muted mt-1">
                {d.entities.total > 0 ? ((d.entities.community_controlled / d.entities.total) * 100).toFixed(1) : 0}% of total
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-bauhaus-red">{fmt(d.entities.without_abn)}</div>
              <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mt-1">Without ABN</div>
              <div className="text-sm text-bauhaus-muted mt-1">unresolvable by ABN match</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Linkage Rates ───────────── */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Linkage Rates
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          How well each dataset is linked to the central entity graph.
          Green = 80%+ linked, yellow = 50-80%, red = below 50%.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0">
          {/* Justice Funding */}
          <div className="border-4 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-3">Justice Funding</div>
            <div className={`text-4xl font-black ${linkageTextColor(d.justice.pct_linked)} mb-1`}>
              {d.justice.pct_linked}%
            </div>
            <div className="text-sm text-bauhaus-muted mb-3">
              {fmt(d.justice.linked)} of {fmt(d.justice.total)} linked
            </div>
            <ProgressBar pct={d.justice.pct_linked} label="Entity linkage" />
            <div className="mt-2 text-xs text-bauhaus-muted">
              {fmt(d.justice.unlinked)} unlinked records
            </div>
          </div>

          {/* ALMA */}
          <div className="border-4 border-l-0 max-sm:border-l-4 max-sm:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-3">ALMA Interventions</div>
            <div className={`text-4xl font-black ${linkageTextColor(d.alma.pct_linked)} mb-1`}>
              {d.alma.pct_linked}%
            </div>
            <div className="text-sm text-bauhaus-muted mb-3">
              {fmt(d.alma.linked)} of {fmt(d.alma.total)} linked
            </div>
            <ProgressBar pct={d.alma.pct_linked} label="Entity linkage" />
            <div className="mt-2 text-xs text-bauhaus-muted">
              {fmt(d.alma.evidence_records)} evidence + {fmt(d.alma.outcome_records)} outcomes
            </div>
          </div>

          {/* Foundations */}
          <div className="border-4 border-l-0 max-sm:border-l-4 max-sm:border-t-0 max-lg:border-l-4 max-lg:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-3">Foundations</div>
            <div className={`text-4xl font-black ${linkageTextColor(d.foundations.abn_pct)} mb-1`}>
              {d.foundations.abn_pct}%
            </div>
            <div className="text-sm text-bauhaus-muted mb-3">
              {fmt(d.foundations.with_abn)} of {fmt(d.foundations.total)} with ABN
            </div>
            <ProgressBar pct={d.foundations.abn_pct} label="ABN coverage" />
            <div className="mt-2 text-xs text-bauhaus-muted">
              {fmt(d.foundations.grant_opportunities)} grant opportunities
            </div>
          </div>

          {/* Contracts */}
          <div className="border-4 border-l-0 max-sm:border-l-4 max-sm:border-t-0 max-lg:border-l-4 max-lg:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-3">AusTender</div>
            <div className={`text-4xl font-black ${linkageTextColor(d.contracts.abn_pct)} mb-1`}>
              {d.contracts.abn_pct}%
            </div>
            <div className="text-sm text-bauhaus-muted mb-3">
              {fmt(d.contracts.with_abn)} of {fmt(d.contracts.total)} with ABN
            </div>
            <ProgressBar pct={d.contracts.abn_pct} label="Supplier ABN coverage" />
          </div>
        </div>
      </section>

      {/* ── Section 3: Relationship Network ────── */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Relationship Network
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          {fmt(d.relationships.total)} edges connecting entities across datasets.
          Breakdown by relationship type and source dataset.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* By relationship type */}
          <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Relationship Type</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Count</th>
                </tr>
              </thead>
              <tbody>
                {d.relationships.by_type.map((r, i) => (
                  <tr key={r.relationship_type} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-bold text-bauhaus-black">{r.relationship_type}</td>
                    <td className="p-3 text-right font-mono font-black">{fmt(Number(r.count))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* By dataset */}
          <div className="border-4 border-l-0 max-lg:border-l-4 max-lg:border-t-0 border-bauhaus-black bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-blue text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Dataset</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Count</th>
                </tr>
              </thead>
              <tbody>
                {d.relationships.by_dataset.map((r, i) => (
                  <tr key={r.dataset} className={i % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}>
                    <td className="p-3 font-bold text-bauhaus-black">{r.dataset}</td>
                    <td className="p-3 text-right font-mono font-black">{fmt(Number(r.count))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Section 4: Agent Status ────────────── */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Agent Status
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Latest run per data pipeline agent. Green = successful in last 24h,
          yellow = successful but stale ({'>'}24h), red = failed.
        </p>

        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Agent</th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-xs">Status</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Last Run</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Found</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">New</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">Duration</th>
              </tr>
            </thead>
            <tbody>
              {d.agents
                .sort((a, b) => {
                  // Sort: failed first, then by recency
                  if (a.status === 'failed' && b.status !== 'failed') return -1;
                  if (b.status === 'failed' && a.status !== 'failed') return 1;
                  return (b.started_at ?? '').localeCompare(a.started_at ?? '');
                })
                .map((a, i) => (
                <tr key={a.agent_name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-3">
                    <div className="font-bold text-bauhaus-black">{a.agent_name}</div>
                  </td>
                  <td className="p-3 text-center">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`inline-block w-2 h-2 rounded-full ${agentStatusDot(a.status, a.started_at)}`} />
                      <span className={`text-xs font-black uppercase ${agentStatusColor(a.status, a.started_at)}`}>
                        {a.status}
                      </span>
                    </span>
                  </td>
                  <td className="p-3 text-right text-xs font-bold text-bauhaus-muted">
                    {relativeTime(a.started_at)}
                  </td>
                  <td className="p-3 text-right font-mono hidden sm:table-cell">
                    {Number(a.items_found) > 0 ? fmt(Number(a.items_found)) : '-'}
                  </td>
                  <td className="p-3 text-right font-mono hidden sm:table-cell">
                    {Number(a.items_new) > 0 ? (
                      <span className="text-green-600 font-bold">+{fmt(Number(a.items_new))}</span>
                    ) : '-'}
                  </td>
                  <td className="p-3 text-right font-mono text-bauhaus-muted hidden md:table-cell">
                    {Number(a.duration_ms) > 0 ? `${(Number(a.duration_ms) / 1000).toFixed(1)}s` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Section 5: Data Gaps ───────────────── */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-black text-white">
          <h2 className="text-lg font-black mb-6 text-bauhaus-yellow uppercase tracking-widest">
            Data Gaps
          </h2>
          <p className="text-sm text-white/80 mb-8 max-w-2xl leading-relaxed">
            Key areas where data completeness can be improved. Each gap represents
            records that cannot be fully cross-referenced or may be missing from analyses.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Entities without ABN */}
            <div className="border border-white/20 p-6">
              <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">
                Entities Without ABN
              </div>
              <div className="text-4xl font-black text-bauhaus-red mb-2">
                {fmt(d.entities.without_abn)}
              </div>
              <div className="text-sm text-white/60">
                {d.entities.total > 0 ? ((d.entities.without_abn / d.entities.total) * 100).toFixed(1) : 0}% of all entities
              </div>
              <div className="mt-3 text-xs text-white/40">
                Cannot be cross-referenced by ABN. Rely on name matching only.
              </div>
            </div>

            {/* Justice records without linkage */}
            <div className="border border-white/20 p-6">
              <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">
                Unlinked Justice Records
              </div>
              <div className="text-4xl font-black text-bauhaus-red mb-2">
                {fmt(d.justice.unlinked)}
              </div>
              <div className="text-sm text-white/60">
                {d.justice.total > 0 ? ((d.justice.unlinked / d.justice.total) * 100).toFixed(1) : 0}% of justice funding
              </div>
              <div className="mt-3 text-xs text-white/40">
                Funding records not matched to any entity in the graph.
              </div>
            </div>

            {/* ALMA without entity linkage */}
            <div className="border border-white/20 p-6">
              <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">
                Unlinked ALMA Interventions
              </div>
              <div className="text-4xl font-black text-bauhaus-red mb-2">
                {fmt(d.alma.unlinked)}
              </div>
              <div className="text-sm text-white/60">
                {d.alma.total > 0 ? ((d.alma.unlinked / d.alma.total) * 100).toFixed(1) : 0}% of interventions
              </div>
              <div className="mt-3 text-xs text-white/40">
                Evidence programs not linked to an entity. May miss network analysis.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ALMA Breakdown */}
      {d.alma.by_type.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
            ALMA Intervention Types
          </h2>
          <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
            Australian Living Map of Alternatives: {fmt(d.alma.total)} interventions,{' '}
            {fmt(d.alma.evidence_records)} evidence records, {fmt(d.alma.outcome_records)} outcomes.
          </p>
          <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-teal-600 text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Intervention Type</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Count</th>
                </tr>
              </thead>
              <tbody>
                {d.alma.by_type.map((t, i) => (
                  <tr key={t.type} className={i % 2 === 0 ? 'bg-white' : 'bg-teal-50/30'}>
                    <td className="p-3 font-bold text-bauhaus-black">{t.type || 'Unknown'}</td>
                    <td className="p-3 text-right font-mono font-black">{fmt(Number(t.count))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Source & API Link */}
      <section className="mb-8">
        <div className="border-4 border-bauhaus-black p-6 bg-white text-center">
          <p className="text-sm text-bauhaus-muted font-bold mb-3">
            All metrics computed in real-time from the CivicGraph database.
            Updated {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <a
              href="/api/data/data-health"
              className="inline-block px-6 py-2 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
            >
              Raw Data API
            </a>
            <a
              href="/reports/data-quality"
              className="inline-block px-6 py-2 bg-white text-bauhaus-black border-2 border-bauhaus-black font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
            >
              Data Quality Scorecard
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
