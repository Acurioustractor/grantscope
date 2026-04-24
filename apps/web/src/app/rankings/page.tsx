'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { money } from '@/lib/format';

interface RankedCharity {
  abn: string;
  name: string;
  gs_id: string;
  entity_type: string;
  sector: string | null;
  state: string | null;
  charity_size: string | null;
  is_community_controlled: boolean;
  revenue: number;
  expenses: number;
  assets: number;
  fte: number;
  volunteers: number;
  vol_fte_ratio: number;
  rev_per_fte: number;
  cagr: number;
  network_connections: number;
  score_composite: number;
  score_revenue: number;
  score_growth: number;
  score_leverage: number;
  score_efficiency: number;
  score_network: number;
  score_health: number;
  rank_composite: number;
  rank_revenue: number;
  rank_growth: number;
  total_ranked: number;
}

const SORTS = [
  { key: 'score_composite', label: 'Composite' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'cagr', label: 'Growth' },
  { key: 'fte', label: 'FTE' },
  { key: 'volunteers', label: 'Volunteers' },
  { key: 'vol_fte_ratio', label: 'Vol:FTE' },
  { key: 'rev_per_fte', label: 'Rev/FTE' },
  { key: 'network_connections', label: 'Network' },
  { key: 'assets', label: 'Assets' },
];

const STATES = ['ALL', 'NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];
const SIZES = ['ALL', 'Small', 'Medium', 'Large'];

const DIMENSIONS = [
  { key: 'score_revenue', label: 'Rev', color: 'bg-green-500' },
  { key: 'score_growth', label: 'Growth', color: 'bg-blue-500' },
  { key: 'score_leverage', label: 'Lever', color: 'bg-purple-500' },
  { key: 'score_efficiency', label: 'Effic', color: 'bg-amber-500' },
  { key: 'score_network', label: 'Net', color: 'bg-red-500' },
  { key: 'score_health', label: 'Hlth', color: 'bg-teal-500' },
] as const;

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="w-full h-1.5 bg-gray-100" title={`${score.toFixed(0)}/100`}>
      <div className={`h-full ${color} transition-all`} style={{ width: `${Math.min(100, score)}%` }} />
    </div>
  );
}

function Percentile({ rank, total }: { rank: number; total: number }) {
  const pct = ((total - rank + 1) / total * 100).toFixed(1);
  return (
    <span className="text-[10px] font-bold text-bauhaus-blue">
      Top {pct}%
    </span>
  );
}

export default function RankingsPage() {
  const [data, setData] = useState<RankedCharity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('score_composite');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [sizeFilter, setSizeFilter] = useState('ALL');
  const [ccOnly, setCcOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const limit = 50;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(page * limit),
      sort: sortBy,
    });
    if (stateFilter !== 'ALL') params.set('state', stateFilter);
    if (sizeFilter !== 'ALL') params.set('size', sizeFilter);
    if (ccOnly) params.set('cc', 'true');
    if (search) params.set('q', search);

    fetch(`/api/data/rankings?${params}`)
      .then(r => r.json())
      .then(d => {
        setData(d.results || []);
        setTotal(d.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sortBy, stateFilter, sizeFilter, ccOnly, search, page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(0);
  };

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black">
      {/* Header */}
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold uppercase tracking-widest text-bauhaus-red">CivicGraph</p>
            <div className="flex gap-2">
              <Link href="/entity/top" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">Power Index</Link>
              <Link href="/charities" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">Charities</Link>
              <Link href="/power" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">Power</Link>
            </div>
          </div>
          <h1 className="text-3xl font-black uppercase tracking-wider">Charity Rankings</h1>
          <p className="text-gray-400 text-sm mt-1 max-w-2xl">
            {total.toLocaleString()} charities scored across 6 dimensions — revenue, growth, leverage, efficiency, network connections, and financial health.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="mx-auto max-w-7xl px-4 py-4 space-y-3">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-0">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search by name..."
            className="flex-1 max-w-xs px-4 py-2 border-4 border-bauhaus-black text-sm font-bold bg-white focus:bg-bauhaus-yellow focus:outline-none"
          />
          <button type="submit" className="px-4 py-2 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red border-4 border-bauhaus-black cursor-pointer">
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); setSearchInput(''); setPage(0); }}
              className="px-3 py-2 text-xs font-bold text-gray-500 hover:text-bauhaus-red border-4 border-l-0 border-bauhaus-black cursor-pointer"
            >
              Clear
            </button>
          )}
        </form>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1">
            {STATES.map(s => (
              <button
                key={s}
                onClick={() => { setStateFilter(s); setPage(0); }}
                className={`text-[10px] px-3 py-1.5 font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  stateFilter === s
                    ? 'bg-bauhaus-black text-white'
                    : 'bg-white text-gray-500 border border-gray-200 hover:border-bauhaus-black'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mr-1">Size:</span>
            {SIZES.map(s => (
              <button
                key={s}
                onClick={() => { setSizeFilter(s); setPage(0); }}
                className={`text-[10px] px-2 py-1 font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  sizeFilter === s
                    ? 'bg-bauhaus-black text-white'
                    : 'bg-white text-gray-500 border border-gray-200 hover:border-bauhaus-black'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <button
            onClick={() => { setCcOnly(!ccOnly); setPage(0); }}
            className={`text-[10px] px-3 py-1 font-bold uppercase tracking-wider transition-all cursor-pointer ${
              ccOnly ? 'bg-bauhaus-red text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-bauhaus-black'
            }`}
          >
            Community Controlled
          </button>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mr-1">Sort:</span>
          {SORTS.map(s => (
            <button
              key={s.key}
              onClick={() => { setSortBy(s.key); setPage(0); }}
              className={`text-[10px] px-2 py-1 font-bold uppercase tracking-wider transition-all cursor-pointer ${
                sortBy === s.key
                  ? 'bg-bauhaus-black text-white'
                  : 'bg-white text-gray-500 border border-gray-200 hover:border-bauhaus-black'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="mx-auto max-w-7xl px-4 pb-8">
        <div className="bg-white border-2 border-bauhaus-black shadow-sm overflow-x-auto">
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
                  <th className="text-left py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Charity</th>
                  <th className="text-right py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Score</th>
                  <th className="text-center py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400 w-48">Dimensions</th>
                  <th className="text-right py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Revenue</th>
                  <th className="text-right py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Growth</th>
                  <th className="text-right py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">FTE</th>
                  <th className="text-right py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Network</th>
                  <th className="text-left py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">State</th>
                </tr>
              </thead>
              <tbody>
                {data.map((c, i) => {
                  const rank = page * limit + i + 1;
                  const isExpanded = expanded === c.abn;
                  return (
                    <tr key={c.abn} className="group">
                      <td colSpan={9} className="p-0">
                        <div
                          className={`grid grid-cols-[40px_1fr_80px_192px_100px_70px_60px_60px_50px] items-center border-b border-gray-100 hover:bg-blue-50/30 transition-colors cursor-pointer ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                          onClick={() => setExpanded(isExpanded ? null : c.abn)}
                        >
                          <div className="py-3 pl-4 pr-2 text-xs text-gray-400 font-mono">{rank}</div>
                          <div className="py-3 pr-4">
                            <Link
                              href={`/entity/${encodeURIComponent(c.gs_id)}`}
                              className="font-medium text-bauhaus-blue hover:underline"
                              onClick={e => e.stopPropagation()}
                            >
                              {c.name}
                            </Link>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 border border-gray-200">
                                {c.charity_size || '?'}
                              </span>
                              {c.is_community_controlled && (
                                <span className="text-[9px] px-1.5 py-0.5 bg-bauhaus-red/10 text-bauhaus-red font-bold">CC</span>
                              )}
                              <Percentile rank={Number(c.rank_composite)} total={Number(c.total_ranked)} />
                            </div>
                          </div>
                          <div className="py-3 pr-4 text-right font-mono font-black text-lg">{Number(c.score_composite).toFixed(1)}</div>
                          <div className="py-3 pr-4 space-y-0.5">
                            {DIMENSIONS.map(d => (
                              <ScoreBar key={d.key} score={Number(c[d.key as keyof RankedCharity])} color={d.color} />
                            ))}
                          </div>
                          <div className="py-3 pr-4 text-right font-mono text-green-700">
                            {Number(c.revenue) > 0 ? money(Number(c.revenue)) : '-'}
                          </div>
                          <div className="py-3 pr-4 text-right font-mono text-blue-600">
                            {Number(c.cagr) !== 0 ? `${Number(c.cagr).toFixed(0)}%` : '-'}
                          </div>
                          <div className="py-3 pr-4 text-right font-mono text-gray-500">
                            {Number(c.fte) > 0 ? Number(c.fte).toLocaleString() : '-'}
                          </div>
                          <div className="py-3 pr-4 text-right font-mono text-gray-500">
                            {Number(c.network_connections) > 0 ? c.network_connections : '-'}
                          </div>
                          <div className="py-3 pr-4 text-xs text-gray-500">{c.state ?? '-'}</div>
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="border-b-2 border-bauhaus-black bg-gray-50 px-6 py-4">
                            <div className="grid grid-cols-3 gap-6">
                              {/* Score breakdown */}
                              <div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Score Breakdown</h4>
                                <div className="space-y-1.5">
                                  {DIMENSIONS.map(d => (
                                    <div key={d.key} className="flex items-center gap-2">
                                      <span className="text-[10px] w-12 text-gray-500 font-bold">{d.label}</span>
                                      <div className="flex-1 h-2 bg-gray-200">
                                        <div className={`h-full ${d.color}`} style={{ width: `${Math.min(100, Number(c[d.key as keyof RankedCharity]))}%` }} />
                                      </div>
                                      <span className="text-[10px] font-mono w-8 text-right">{Number(c[d.key as keyof RankedCharity]).toFixed(0)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Financials */}
                              <div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Financials (FY2023)</h4>
                                <div className="space-y-1 text-xs">
                                  <div className="flex justify-between"><span className="text-gray-500">Revenue</span><span className="font-mono font-bold">{money(Number(c.revenue))}</span></div>
                                  <div className="flex justify-between"><span className="text-gray-500">Expenses</span><span className="font-mono">{money(Number(c.expenses))}</span></div>
                                  <div className="flex justify-between"><span className="text-gray-500">Assets</span><span className="font-mono">{money(Number(c.assets))}</span></div>
                                  <div className="flex justify-between"><span className="text-gray-500">5yr CAGR</span><span className="font-mono text-blue-600">{Number(c.cagr).toFixed(1)}%</span></div>
                                </div>
                              </div>

                              {/* Workforce */}
                              <div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Workforce</h4>
                                <div className="space-y-1 text-xs">
                                  <div className="flex justify-between"><span className="text-gray-500">FTE Staff</span><span className="font-mono font-bold">{Number(c.fte).toLocaleString()}</span></div>
                                  <div className="flex justify-between"><span className="text-gray-500">Volunteers</span><span className="font-mono">{Number(c.volunteers).toLocaleString()}</span></div>
                                  <div className="flex justify-between"><span className="text-gray-500">Vol:FTE Ratio</span><span className="font-mono">{Number(c.vol_fte_ratio).toFixed(1)}:1</span></div>
                                  <div className="flex justify-between"><span className="text-gray-500">Rev/FTE</span><span className="font-mono">{money(Number(c.rev_per_fte))}</span></div>
                                  <div className="flex justify-between"><span className="text-gray-500">Network</span><span className="font-mono">{c.network_connections} connections</span></div>
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 flex gap-2">
                              <Link
                                href={`/entity/${encodeURIComponent(c.gs_id)}`}
                                className="text-[10px] px-3 py-1.5 bg-bauhaus-blue text-white font-bold uppercase tracking-wider hover:bg-bauhaus-black transition-colors"
                              >
                                Full Profile
                              </Link>
                              <Link
                                href={`/charities/${c.abn}`}
                                className="text-[10px] px-3 py-1.5 bg-white text-bauhaus-black font-bold uppercase tracking-wider border border-gray-300 hover:border-bauhaus-black transition-colors"
                              >
                                Charity Detail
                              </Link>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Dimension legend */}
        <div className="flex items-center gap-3 mt-3 text-[10px] text-gray-400">
          <span className="font-bold uppercase tracking-wider">Dimensions:</span>
          {DIMENSIONS.map(d => (
            <span key={d.key} className="flex items-center gap-1">
              <span className={`w-2 h-2 ${d.color}`} />
              {d.label}
            </span>
          ))}
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="text-xs px-4 py-2 border border-gray-200 bg-white hover:border-bauhaus-black transition-all disabled:opacity-30 disabled:cursor-not-allowed font-bold uppercase tracking-wider cursor-pointer"
            >
              Previous
            </button>
            <span className="text-xs text-gray-500">
              Page {page + 1} of {Math.ceil(total / limit)}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={(page + 1) * limit >= total}
              className="text-xs px-4 py-2 border border-gray-200 bg-white hover:border-bauhaus-black transition-all disabled:opacity-30 disabled:cursor-not-allowed font-bold uppercase tracking-wider cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
