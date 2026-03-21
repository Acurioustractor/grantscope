'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

interface CompareEntity {
  gs_id: string;
  canonical_name: string;
  entity_type: string;
  abn: string | null;
  state: string | null;
  remoteness: string | null;
  is_community_controlled: boolean;
  lga_name: string | null;
  sector: string | null;
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

interface RevolvingDoor {
  gs_id: string;
  lobbies: boolean;
  donates: boolean;
  contracts: boolean;
  receives_funding: boolean;
  influence_vectors: number;
  revolving_door_score: number;
}

interface BoardData {
  gs_id: string;
  active_board: number;
  total_board: number;
}

interface SearchResult {
  gs_id: string;
  canonical_name: string;
  entity_type: string;
  power_score: number | null;
}

function money(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

const SYSTEMS = [
  { key: 'in_procurement', label: 'Procurement', color: 'bg-blue-500' },
  { key: 'in_justice_funding', label: 'Justice', color: 'bg-amber-500' },
  { key: 'in_political_donations', label: 'Donations', color: 'bg-red-500' },
  { key: 'in_charity_registry', label: 'Charity', color: 'bg-green-500' },
  { key: 'in_foundation', label: 'Foundation', color: 'bg-purple-500' },
  { key: 'in_alma_evidence', label: 'Evidence', color: 'bg-teal-500' },
  { key: 'in_ato_transparency', label: 'ATO', color: 'bg-gray-500' },
] as const;

function BarChart({ values, maxValue, colors }: { values: number[]; maxValue: number; colors: string[] }) {
  if (maxValue === 0) return null;
  return (
    <div className="flex items-end gap-2 h-12">
      {values.map((v, i) => (
        <div
          key={i}
          className={`${colors[i % colors.length]} rounded-t-sm transition-all`}
          style={{ width: `${100 / values.length}%`, height: `${Math.max(2, (v / maxValue) * 100)}%` }}
          title={money(v)}
        />
      ))}
    </div>
  );
}

export default function ComparePage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [entities, setEntities] = useState<CompareEntity[]>([]);
  const [rdMap, setRdMap] = useState<Record<string, RevolvingDoor>>({});
  const [boardMap, setBoardMap] = useState<Record<string, BoardData>>({});
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  // Load from URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ids = params.get('ids')?.split(',').filter(Boolean);
    if (ids && ids.length >= 2) {
      setSelectedIds(ids);
    }
  }, []);

  // Fetch comparison data when IDs change
  useEffect(() => {
    if (selectedIds.length < 2) {
      setEntities([]);
      return;
    }
    setLoading(true);
    fetch(`/api/data/entity/compare?ids=${selectedIds.join(',')}`)
      .then(r => r.json())
      .then(data => {
        setEntities(data.entities || []);
        const rd: Record<string, RevolvingDoor> = {};
        for (const r of (data.revolving_door || [])) rd[r.gs_id] = r;
        setRdMap(rd);
        const b: Record<string, BoardData> = {};
        for (const r of (data.boards || [])) b[r.gs_id] = r;
        setBoardMap(b);
        setLoading(false);
        // Update URL
        const url = new URL(window.location.href);
        url.searchParams.set('ids', selectedIds.join(','));
        window.history.replaceState({}, '', url.toString());
      })
      .catch(() => setLoading(false));
  }, [selectedIds]);

  // Debounced search
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchTimeout.current = setTimeout(() => {
      fetch(`/api/data/entity/search?q=${encodeURIComponent(q)}&limit=8`)
        .then(r => r.json())
        .then(data => { setSearchResults(data.results || []); setSearching(false); })
        .catch(() => setSearching(false));
    }, 300);
  }, []);

  const addEntity = (gsId: string) => {
    if (!selectedIds.includes(gsId) && selectedIds.length < 5) {
      setSelectedIds([...selectedIds, gsId]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeEntity = (gsId: string) => {
    setSelectedIds(selectedIds.filter(id => id !== gsId));
  };

  // Find the max values for comparison bars
  const maxPower = Math.max(...entities.map(e => Number(e.power_score)), 1);
  const maxDollar = Math.max(...entities.map(e => Number(e.total_dollar_flow)), 1);
  const maxProcurement = Math.max(...entities.map(e => Number(e.procurement_dollars)), 1);

  const CARD_COLORS = ['border-blue-500', 'border-bauhaus-red', 'border-amber-500', 'border-green-500', 'border-purple-500'];

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black">
      {/* Header */}
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold uppercase tracking-widest text-bauhaus-red">CivicGraph</p>
            <div className="flex gap-2">
              <Link href="/entity" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">Search</Link>
              <Link href="/entity/top" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">Power Index</Link>
              <Link href="/map" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">Map</Link>
            </div>
          </div>
          <h1 className="text-3xl font-black uppercase tracking-wider">Entity Comparison</h1>
          <p className="text-gray-400 text-sm mt-1 max-w-2xl">
            Compare entities side-by-side across power score, dollar flow, system presence, and influence vectors.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Search to add entities */}
        <div className="mb-6 relative">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search entities to compare (min 2, max 5)..."
                className="w-full border-2 border-bauhaus-black px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-bauhaus-red"
              />
              {searching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-block w-4 h-4 border-2 border-gray-300 border-t-bauhaus-red rounded-full animate-spin" />
              )}
            </div>
          </div>

          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border-2 border-bauhaus-black shadow-lg max-h-64 overflow-y-auto">
              {searchResults.map(r => (
                <button
                  key={r.gs_id}
                  onClick={() => addEntity(r.gs_id)}
                  disabled={selectedIds.includes(r.gs_id)}
                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors flex items-center justify-between disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <div>
                    <span className="text-sm font-medium">{r.canonical_name}</span>
                    <span className="ml-2 text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-sm">{r.entity_type}</span>
                  </div>
                  {r.power_score && (
                    <span className="text-xs font-mono text-gray-400">Power: {Number(r.power_score)}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Selected entities chips */}
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {selectedIds.map((id, i) => {
                const entity = entities.find(e => e.gs_id === id);
                return (
                  <span
                    key={id}
                    className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 font-bold border-2 ${CARD_COLORS[i]} bg-white`}
                  >
                    {entity?.canonical_name || id}
                    <button onClick={() => removeEntity(id)} className="text-gray-400 hover:text-bauhaus-red ml-1">&times;</button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Comparison cards */}
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">
            <span className="inline-block w-5 h-5 border-2 border-gray-300 border-t-bauhaus-red rounded-full animate-spin mr-2" />
            Loading comparison...
          </div>
        ) : entities.length >= 2 ? (
          <div className="space-y-8">
            {/* Side-by-side cards */}
            <div className={`grid gap-4 ${entities.length === 2 ? 'grid-cols-2' : entities.length === 3 ? 'grid-cols-3' : entities.length === 4 ? 'grid-cols-4' : 'grid-cols-5'}`}>
              {entities.map((e, i) => {
                const rd = rdMap[e.gs_id];
                const board = boardMap[e.gs_id];
                return (
                  <div key={e.gs_id} className={`bg-white border-t-4 ${CARD_COLORS[i]} border-x border-b border-gray-200 shadow-sm`}>
                    {/* Name + type */}
                    <div className="p-4 border-b border-gray-100">
                      <Link href={`/entity/${encodeURIComponent(e.gs_id)}`} className="font-black text-sm uppercase tracking-wider hover:text-bauhaus-red transition-colors">
                        {e.canonical_name}
                      </Link>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-sm">{e.entity_type}</span>
                        {e.state && <span className="text-[9px] text-gray-400">{e.state}</span>}
                        {e.is_community_controlled && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-bauhaus-red/10 text-bauhaus-red rounded-sm font-bold">CC</span>
                        )}
                      </div>
                    </div>

                    {/* Power score */}
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Power Score</p>
                      <div className="flex items-end gap-2 mt-1">
                        <span className="text-2xl font-black">{Number(e.power_score)}</span>
                        <div className="flex-1 h-3 bg-gray-100 rounded-sm overflow-hidden">
                          <div
                            className="h-full bg-bauhaus-black rounded-sm transition-all"
                            style={{ width: `${(Number(e.power_score) / maxPower) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* System presence dots */}
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Systems ({e.system_count}/7)</p>
                      <div className="flex gap-1">
                        {SYSTEMS.map(s => {
                          const active = Number(e[s.key as keyof CompareEntity]) > 0;
                          return (
                            <span
                              key={s.key}
                              className={`text-[8px] px-1.5 py-0.5 font-bold uppercase tracking-wider rounded-sm ${
                                active ? `${s.color} text-white` : 'bg-gray-100 text-gray-400'
                              }`}
                            >
                              {s.label.substring(0, 3)}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Dollar flow */}
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Total Dollar Flow</p>
                      <p className="text-lg font-black text-green-700 mt-0.5">
                        {Number(e.total_dollar_flow) > 0 ? money(Number(e.total_dollar_flow)) : '$0'}
                      </p>
                      <div className="h-2 bg-gray-100 rounded-sm overflow-hidden mt-1">
                        <div
                          className="h-full bg-green-500 rounded-sm transition-all"
                          style={{ width: `${(Number(e.total_dollar_flow) / maxDollar) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Procurement */}
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Procurement</p>
                      <p className="text-sm font-black text-blue-700 mt-0.5">
                        {Number(e.procurement_dollars) > 0 ? money(Number(e.procurement_dollars)) : '—'}
                      </p>
                      <p className="text-[9px] text-gray-400">
                        {Number(e.contract_count) > 0 ? `${Number(e.contract_count)} contracts, ${e.distinct_govt_buyers} buyers` : 'No contracts'}
                      </p>
                    </div>

                    {/* Donations */}
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Political Donations</p>
                      <p className="text-sm font-black text-bauhaus-red mt-0.5">
                        {Number(e.donation_dollars) > 0 ? money(Number(e.donation_dollars)) : '—'}
                      </p>
                      <p className="text-[9px] text-gray-400">
                        {Number(e.distinct_parties_funded) > 0 ? `${e.distinct_parties_funded} parties` : 'No donations'}
                      </p>
                    </div>

                    {/* Board */}
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Board</p>
                      <p className="text-sm font-black mt-0.5">
                        {board ? `${board.active_board} active` : '—'}
                      </p>
                      <p className="text-[9px] text-gray-400">
                        {board ? `${board.total_board} total` : 'No board data'}
                      </p>
                    </div>

                    {/* Revolving Door */}
                    <div className="px-4 py-3">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Revolving Door</p>
                      {rd && Number(rd.influence_vectors) >= 2 ? (
                        <div className="mt-1">
                          <span className="text-xs font-black text-amber-700">
                            {rd.influence_vectors} vectors
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {rd.lobbies && <span className="text-[8px] px-1 py-0.5 bg-amber-100 text-amber-700 rounded-sm font-bold">Lobby</span>}
                            {rd.donates && <span className="text-[8px] px-1 py-0.5 bg-red-100 text-red-700 rounded-sm font-bold">Donate</span>}
                            {rd.contracts && <span className="text-[8px] px-1 py-0.5 bg-blue-100 text-blue-700 rounded-sm font-bold">Contract</span>}
                            {rd.receives_funding && <span className="text-[8px] px-1 py-0.5 bg-green-100 text-green-700 rounded-sm font-bold">Funded</span>}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 mt-0.5">Not flagged</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Comparison summary table */}
            <div className="bg-white border-2 border-bauhaus-black shadow-sm overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-200 bg-gray-50/50">
                    <th className="text-left py-3 pl-4 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Metric</th>
                    {entities.map((e, i) => (
                      <th key={e.gs_id} className={`text-right py-3 pr-4 font-black uppercase tracking-widest text-[10px] border-l-2 ${CARD_COLORS[i].replace('border-', 'border-l-')}`}>
                        <span className="text-gray-700">{e.canonical_name.substring(0, 20)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Power Score', key: 'power_score', fmt: (v: number) => String(v) },
                    { label: 'Systems', key: 'system_count', fmt: (v: number) => `${v}/7` },
                    { label: 'Total Dollar Flow', key: 'total_dollar_flow', fmt: (v: number) => money(v) },
                    { label: 'Procurement $', key: 'procurement_dollars', fmt: (v: number) => money(v) },
                    { label: 'Justice Funding $', key: 'justice_dollars', fmt: (v: number) => money(v) },
                    { label: 'Political Donations $', key: 'donation_dollars', fmt: (v: number) => money(v) },
                    { label: 'Contracts', key: 'contract_count', fmt: (v: number) => v.toLocaleString() },
                    { label: 'Govt Buyers', key: 'distinct_govt_buyers', fmt: (v: number) => v.toLocaleString() },
                    { label: 'Parties Funded', key: 'distinct_parties_funded', fmt: (v: number) => v.toLocaleString() },
                  ].map((row, ri) => {
                    const values = entities.map(e => Number(e[row.key as keyof CompareEntity] ?? 0));
                    const maxVal = Math.max(...values);
                    return (
                      <tr key={row.key} className={`border-b border-gray-100 ${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                        <td className="py-3 pl-4 pr-4 font-bold text-xs text-gray-500 uppercase tracking-wider">{row.label}</td>
                        {entities.map((e, i) => {
                          const val = Number(e[row.key as keyof CompareEntity] ?? 0);
                          const isMax = val === maxVal && val > 0;
                          return (
                            <td key={e.gs_id} className={`py-3 pr-4 text-right font-mono text-xs border-l border-gray-100 ${isMax ? 'font-black text-bauhaus-black' : 'text-gray-500'}`}>
                              {val > 0 ? row.fmt(val) : '—'}
                              {isMax && val > 0 && <span className="ml-1 text-bauhaus-red">&#9650;</span>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-20">
            <h2 className="text-xl font-black uppercase tracking-wider text-gray-300 mb-2">Add 2+ Entities to Compare</h2>
            <p className="text-sm text-gray-400 mb-6">Search for entities above, or use direct links from entity profiles.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                { label: 'Serco vs Broadspectrum', ids: 'AU-ABN-78061067678,AU-ABN-86768265615' },
                { label: 'Big 4 Banks', ids: 'AU-ABN-48123123124,AU-ABN-33007457141,AU-ABN-12004044937,AU-ABN-11005357522' },
              ].map(preset => (
                <button
                  key={preset.label}
                  onClick={() => setSelectedIds(preset.ids.split(','))}
                  className="text-xs px-4 py-2 border border-gray-200 bg-white hover:border-bauhaus-black transition-all font-medium"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
