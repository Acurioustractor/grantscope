'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface TopEntity {
  gs_id: string;
  canonical_name: string;
  entity_type: string;
  abn: string | null;
  state: string | null;
  remoteness: string | null;
  is_community_controlled: boolean;
  lga_name: string | null;
  system_count: number;
  power_score: number;
  in_procurement: number;
  in_justice_funding: number;
  in_political_donations: number;
  in_charity_registry: number;
  in_foundation: number;
  in_alma_evidence: number;
  in_ato_transparency: number;
  procurement_dollars: number;
  justice_dollars: number;
  donation_dollars: number;
  total_dollar_flow: number;
  contract_count: number;
  distinct_govt_buyers: number;
  distinct_parties_funded: number;
  charity_size: string | null;
}

function money(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

const SYSTEMS = [
  { key: 'procurement', col: 'in_procurement', label: 'Procurement', color: 'bg-blue-500' },
  { key: 'justice', col: 'in_justice_funding', label: 'Justice', color: 'bg-amber-500' },
  { key: 'donations', col: 'in_political_donations', label: 'Donations', color: 'bg-red-500' },
  { key: 'charity', col: 'in_charity_registry', label: 'Charity', color: 'bg-green-500' },
  { key: 'foundation', col: 'in_foundation', label: 'Foundation', color: 'bg-purple-500' },
  { key: 'alma', col: 'in_alma_evidence', label: 'Evidence', color: 'bg-teal-500' },
  { key: 'ato', col: 'in_ato_transparency', label: 'ATO', color: 'bg-gray-500' },
] as const;

const STATES = ['ALL', 'NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];
const SORTS = [
  { key: 'power_score', label: 'Power Score' },
  { key: 'total_dollar_flow', label: 'Dollar Flow' },
  { key: 'system_count', label: 'System Count' },
  { key: 'procurement_dollars', label: 'Procurement $' },
  { key: 'donation_dollars', label: 'Donations $' },
];

const MIN_SYSTEMS_OPTIONS = [1, 2, 3, 4, 5];

export default function TopEntitiesPage() {
  const [entities, setEntities] = useState<TopEntity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState('ALL');
  const [systemFilter, setSystemFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('power_score');
  const [minSystems, setMinSystems] = useState(1);
  const [ccOnly, setCcOnly] = useState(false);
  const [page, setPage] = useState(0);
  const limit = 50;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit), sort: sortBy, min_systems: String(minSystems) });
    if (stateFilter !== 'ALL') params.set('state', stateFilter);
    if (systemFilter) params.set('system', systemFilter);
    if (ccOnly) params.set('cc', 'true');

    fetch(`/api/data/entity/top?${params}`)
      .then(r => r.json())
      .then(data => {
        setEntities(data.results || []);
        setTotal(data.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [stateFilter, systemFilter, sortBy, minSystems, ccOnly, page]);

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black">
      {/* Header */}
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold uppercase tracking-widest text-bauhaus-red">CivicGraph</p>
            <div className="flex gap-2">
              <Link href="/entity" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">Search</Link>
              <Link href="/map" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">Map</Link>
              <Link href="/graph" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">Graph</Link>
            </div>
          </div>
          <h1 className="text-3xl font-black uppercase tracking-wider">Power Index</h1>
          <p className="text-gray-400 text-sm mt-1 max-w-2xl">
            82,000+ entities scored across 7 government systems. Power score reflects cross-system
            presence and dollar flow — procurement, justice funding, political donations, charity, foundations, evidence, and ATO.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="mx-auto max-w-7xl px-4 py-4 space-y-3">
        {/* State filter */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1">
            {STATES.map(s => (
              <button
                key={s}
                onClick={() => { setStateFilter(s); setPage(0); }}
                className={`text-[10px] px-3 py-1.5 font-bold uppercase tracking-wider transition-all ${
                  stateFilter === s
                    ? 'bg-bauhaus-black text-white'
                    : 'bg-white text-gray-500 border border-gray-200 hover:border-bauhaus-black'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400">
            <strong className="text-bauhaus-black">{total.toLocaleString()}</strong> entities
          </span>
        </div>

        {/* System filter + sort + min systems */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mr-1">System:</span>
            <button
              onClick={() => { setSystemFilter(null); setPage(0); }}
              className={`text-[10px] px-2 py-1 font-bold uppercase tracking-wider transition-all ${
                !systemFilter ? 'bg-bauhaus-black text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-bauhaus-black'
              }`}
            >
              All
            </button>
            {SYSTEMS.map(s => (
              <button
                key={s.key}
                onClick={() => { setSystemFilter(systemFilter === s.key ? null : s.key); setPage(0); }}
                className={`text-[10px] px-2 py-1 font-bold uppercase tracking-wider transition-all ${
                  systemFilter === s.key ? `${s.color} text-white` : 'bg-white text-gray-500 border border-gray-200 hover:border-bauhaus-black'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mr-1">Sort:</span>
            {SORTS.map(s => (
              <button
                key={s.key}
                onClick={() => { setSortBy(s.key); setPage(0); }}
                className={`text-[10px] px-2 py-1 font-bold uppercase tracking-wider transition-all ${
                  sortBy === s.key ? 'bg-bauhaus-black text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-bauhaus-black'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mr-1">Min&nbsp;Sys:</span>
            {MIN_SYSTEMS_OPTIONS.map(n => (
              <button
                key={n}
                onClick={() => { setMinSystems(n); setPage(0); }}
                className={`text-[10px] w-6 h-6 font-bold transition-all ${
                  minSystems === n ? 'bg-bauhaus-black text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-bauhaus-black'
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <button
            onClick={() => { setCcOnly(!ccOnly); setPage(0); }}
            className={`text-[10px] px-3 py-1 font-bold uppercase tracking-wider transition-all ${
              ccOnly ? 'bg-bauhaus-red text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-bauhaus-black'
            }`}
          >
            Community Controlled
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="mx-auto max-w-7xl px-4 pb-8">
        <div className="bg-white border-2 border-bauhaus-black shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400">
              <span className="inline-block w-5 h-5 border-2 border-gray-300 border-t-bauhaus-red rounded-full animate-spin mr-2" />
              Loading...
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-50/50">
                  <th className="text-left py-3 pl-4 pr-2 font-black uppercase tracking-widest text-[10px] text-gray-400 w-10">#</th>
                  <th className="text-left py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Entity</th>
                  <th className="text-left py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Type</th>
                  <th className="text-center py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Systems</th>
                  <th className="text-right py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Power</th>
                  <th className="text-right py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Dollar Flow</th>
                  <th className="text-right py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Contracts</th>
                  <th className="text-left py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">State</th>
                </tr>
              </thead>
              <tbody>
                {entities.map((e, i) => (
                  <tr
                    key={e.gs_id}
                    className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                  >
                    <td className="py-3 pl-4 pr-2 text-xs text-gray-400 font-mono">{page * limit + i + 1}</td>
                    <td className="py-3 pr-4">
                      <Link href={`/entity/${encodeURIComponent(e.gs_id)}`} className="font-medium text-bauhaus-blue hover:underline">
                        {e.canonical_name}
                      </Link>
                      {e.is_community_controlled && (
                        <span className="ml-2 text-[9px] px-1.5 py-0.5 bg-bauhaus-red/10 text-bauhaus-red rounded-sm font-bold">CC</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-sm border border-gray-200">
                        {e.entity_type}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center justify-center gap-0.5">
                        {SYSTEMS.map(s => {
                          const active = Number(e[s.col as keyof TopEntity]) > 0;
                          return (
                            <span
                              key={s.key}
                              className={`w-2.5 h-2.5 rounded-full transition-all ${active ? s.color : 'bg-gray-200'}`}
                              title={`${s.label}: ${active ? 'Yes' : 'No'}`}
                            />
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right font-mono font-bold">{Number(e.power_score)}</td>
                    <td className="py-3 pr-4 text-right font-mono text-green-700">
                      {Number(e.total_dollar_flow) > 0 ? money(Number(e.total_dollar_flow)) : '—'}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-gray-500">
                      {Number(e.contract_count) > 0 ? Number(e.contract_count).toLocaleString() : '—'}
                    </td>
                    <td className="py-3 pr-4 text-xs text-gray-500">{e.state ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="text-xs px-4 py-2 border border-gray-200 bg-white hover:border-bauhaus-black transition-all disabled:opacity-30 disabled:cursor-not-allowed font-bold uppercase tracking-wider"
            >
              Previous
            </button>
            <span className="text-xs text-gray-500">
              Page {page + 1} of {Math.ceil(total / limit)}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={(page + 1) * limit >= total}
              className="text-xs px-4 py-2 border border-gray-200 bg-white hover:border-bauhaus-black transition-all disabled:opacity-30 disabled:cursor-not-allowed font-bold uppercase tracking-wider"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
