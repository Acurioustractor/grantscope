'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { money } from '@/lib/format';

interface SectorOverview {
  name: string;
  entities: number;
  cc: number;
  states: number;
  types: string[];
}

interface SectorEntity {
  gs_id: string;
  canonical_name: string;
  abn: string | null;
  entity_type: string;
  state: string | null;
  lga_name: string | null;
  is_community_controlled: boolean;
  power_score: number | null;
  system_count: number | null;
  total_dollar_flow: number | null;
}

interface SectorDetail {
  sector: string;
  entities: SectorEntity[];
  stats: { total: number; community_controlled: number; states: number; lgas: number } | null;
  byState: Array<{ state: string; count: number }>;
  byType: Array<{ entity_type: string; count: number }>;
  topPowered: SectorEntity[];
}

const STATES = ['ALL', 'NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

export default function SectorPage() {
  const [sectors, setSectors] = useState<SectorOverview[]>([]);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [detail, setDetail] = useState<SectorDetail | null>(null);
  const [stateFilter, setStateFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  // Load sector overview
  useEffect(() => {
    fetch('/api/data/sector')
      .then(r => r.json())
      .then(d => { setSectors(d.sectors || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Load sector detail
  useEffect(() => {
    if (!selectedSector) { setDetail(null); return; }
    setDetailLoading(true);
    const params = new URLSearchParams({ sector: selectedSector });
    if (stateFilter !== 'ALL') params.set('state', stateFilter);
    fetch(`/api/data/sector?${params}`)
      .then(r => r.json())
      .then(d => { setDetail(d); setDetailLoading(false); })
      .catch(() => setDetailLoading(false));
  }, [selectedSector, stateFilter]);

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black">
      {/* Header */}
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold uppercase tracking-widest text-bauhaus-red">CivicGraph</p>
            <div className="flex gap-2">
              <Link href="/entity" className="text-xs text-gray-400 hover:text-white border border-gray-600 px-3 py-1">Entity Search</Link>
              <Link href="/entity/top" className="text-xs text-gray-400 hover:text-white border border-gray-600 px-3 py-1">Power Index</Link>
              <Link href="/map" className="text-xs text-gray-400 hover:text-white border border-gray-600 px-3 py-1">Map</Link>
            </div>
          </div>
          <h1 className="text-3xl font-black uppercase tracking-wider">Sector Intelligence</h1>
          <p className="text-gray-400 text-sm mt-1">
            Drill into any sector — see who operates, how much flows, and where power concentrates.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {loading ? (
          <div className="flex items-center gap-2 text-gray-400">
            <span className="inline-block w-5 h-5 border-2 border-gray-300 border-t-bauhaus-red rounded-full animate-spin" />
            Loading sectors...
          </div>
        ) : selectedSector ? (
          // Sector detail view
          <div>
            <button onClick={() => { setSelectedSector(null); setStateFilter('ALL'); }} className="text-xs text-gray-400 hover:text-bauhaus-red mb-4 underline">
              All Sectors
            </button>

            <h2 className="text-2xl font-black uppercase tracking-wider mb-2">{selectedSector}</h2>

            {/* State filter */}
            <div className="flex items-center gap-1 mb-6">
              {STATES.map(s => (
                <button
                  key={s}
                  onClick={() => setStateFilter(s)}
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

            {detailLoading ? (
              <div className="flex items-center gap-2 text-gray-400">
                <span className="inline-block w-5 h-5 border-2 border-gray-300 border-t-bauhaus-red rounded-full animate-spin" />
                Loading...
              </div>
            ) : detail ? (
              <div className="space-y-8">
                {/* Stats */}
                {detail.stats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border-2 border-bauhaus-black p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Entities</p>
                      <p className="text-3xl font-black mt-1">{detail.stats.total.toLocaleString()}</p>
                    </div>
                    <div className="bg-white border border-gray-200 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Community Controlled</p>
                      <p className="text-2xl font-black mt-1 text-bauhaus-red">{detail.stats.community_controlled.toLocaleString()}</p>
                    </div>
                    <div className="bg-white border border-gray-200 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">States</p>
                      <p className="text-2xl font-black mt-1">{detail.stats.states}</p>
                    </div>
                    <div className="bg-white border border-gray-200 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">LGAs</p>
                      <p className="text-2xl font-black mt-1">{detail.stats.lgas}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* By State */}
                  {detail.byState.length > 0 && (
                    <div className="bg-white border border-gray-200 p-4">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">By State</h3>
                      <div className="space-y-2">
                        {detail.byState.map(s => (
                          <div key={s.state} className="flex items-center justify-between text-xs">
                            <span className="font-medium">{s.state}</span>
                            <span className="font-mono text-gray-500">{s.count.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* By Type */}
                  {detail.byType.length > 0 && (
                    <div className="bg-white border border-gray-200 p-4">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">By Entity Type</h3>
                      <div className="space-y-2">
                        {detail.byType.map(t => (
                          <div key={t.entity_type} className="flex items-center justify-between text-xs">
                            <span className="font-medium">{t.entity_type}</span>
                            <span className="font-mono text-gray-500">{t.count.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Powered */}
                  {detail.topPowered.length > 0 && (
                    <div className="bg-white border-2 border-bauhaus-black p-4">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Highest Power Score</h3>
                      <div className="space-y-2">
                        {detail.topPowered.map(e => (
                          <Link
                            key={e.gs_id}
                            href={`/entity/${encodeURIComponent(e.gs_id)}`}
                            className="flex items-center justify-between text-xs hover:bg-gray-50 px-1 py-1 -mx-1 transition-colors group"
                          >
                            <span className="font-medium truncate group-hover:text-bauhaus-red transition-colors">{e.canonical_name}</span>
                            <span className="font-mono font-bold text-gray-500 shrink-0 ml-2">{Number(e.power_score).toFixed(0)}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Entity list */}
                <section>
                  <h3 className="text-lg font-black uppercase tracking-widest mb-3">
                    Entities
                    <span className="text-xs font-normal text-gray-400 ml-2 normal-case tracking-normal">
                      Showing {detail.entities.length} of {detail.stats?.total.toLocaleString() ?? '?'}
                    </span>
                  </h3>
                  <div className="bg-white border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-4 py-2">Name</th>
                          <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-4 py-2">Type</th>
                          <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-4 py-2">State</th>
                          <th className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 px-4 py-2">Power</th>
                          <th className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 px-4 py-2">Dollar Flow</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.entities.map((e, i) => (
                          <tr key={e.gs_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-2 text-xs font-medium">
                              <Link href={`/entity/${encodeURIComponent(e.gs_id)}`} className="text-bauhaus-blue hover:underline">
                                {e.canonical_name}
                              </Link>
                              {e.is_community_controlled && (
                                <span className="text-[9px] px-1.5 py-0.5 bg-bauhaus-red/10 text-bauhaus-red rounded-sm ml-2">CC</span>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <span className="text-[9px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-sm">{e.entity_type}</span>
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-400">{e.state ?? '—'}</td>
                            <td className="px-4 py-2 text-xs text-right font-mono font-bold">
                              {e.power_score ? Number(e.power_score).toFixed(0) : '—'}
                            </td>
                            <td className="px-4 py-2 text-xs text-right font-mono text-green-700">
                              {e.total_dollar_flow ? money(Number(e.total_dollar_flow)) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        ) : (
          // Sector overview grid
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sectors.map(s => (
              <button
                key={s.name}
                onClick={() => setSelectedSector(s.name)}
                className="bg-white border-2 border-gray-200 hover:border-bauhaus-black p-5 text-left transition-all group"
              >
                <h3 className="font-black text-lg uppercase tracking-wider group-hover:text-bauhaus-red transition-colors">
                  {s.name}
                </h3>
                <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                  <span><strong className="text-bauhaus-black">{s.entities.toLocaleString()}</strong> entities</span>
                  {s.cc > 0 && <span><strong className="text-bauhaus-red">{s.cc}</strong> CC</span>}
                  <span>{s.states} states</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.types.slice(0, 4).map(t => (
                    <span key={t} className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-sm">{t}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
