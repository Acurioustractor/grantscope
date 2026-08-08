'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { money } from '@/lib/format';

// Lazy-load map to avoid SSR issues with Leaflet
const MapView = dynamic(() => import('./map-view'), { ssr: false });

interface LgaFeature {
  lga_name: string;
  state: string;
  remoteness: string | null;
  avg_irsd_decile: number | null;
  avg_irsd_score: number | null;
  indexed_entities: number | null;
  community_controlled_entities: number | null;
  total_funding_all_sources: number | null;
  desert_score: number | null;
  unplaced_count: number;
  placed_count: number;
  unplaced_share: number | null;
  lat: number | null;
  lng: number | null;
  lga_code: string;
}

interface Summary {
  total_lgas: number;
  severe_deserts: number;
  avg_desert_score: string;
  max_desert_score: string;
  high_uncertainty_lgas: number;
  undrawn_lgas: number;
}

export type MapMetric = 'desert_score' | 'unplaced_share';

const STATES = ['ALL', 'NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];
const REMOTENESS_ORDER = ['Major Cities of Australia', 'Inner Regional Australia', 'Outer Regional Australia', 'Remote Australia', 'Very Remote Australia'];

const METRIC_COPY: Record<MapMetric, { title: string; description: string }> = {
  desert_score: {
    title: 'Funding Desert Map',
    description:
      'Where disadvantage is highest but funding is lowest. Each area is an LGA scored by SEIFA disadvantage vs actual funding received across all government systems.',
  },
  unplaced_share: {
    title: 'Unplaced Organisations',
    description:
      'Organisations registered in a council’s postcodes that our records cannot tie to any council. A postcode can span several councils, so an unplaced organisation counts toward each place it might belong to. The higher the share, the less certain everything else on this map is.',
  },
};

export default function FundingDesertMapPage() {
  const [features, setFeatures] = useState<LgaFeature[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState('ALL');
  const [metric, setMetric] = useState<MapMetric>('desert_score');
  const [selected, setSelected] = useState<LgaFeature | null>(null);
  const [lgaEntities, setLgaEntities] = useState<Array<{
    gs_id: string; canonical_name: string; entity_type: string;
    power_score: number | null; system_count: number | null;
    is_community_controlled: boolean;
  }>>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);

  // Fetch entities when LGA is selected
  useEffect(() => {
    if (!selected) { setLgaEntities([]); return; }
    setLoadingEntities(true);
    fetch(`/api/data/entity/search?lga=${encodeURIComponent(selected.lga_name)}&limit=10`)
      .then(r => r.json())
      .then(data => { setLgaEntities(data.results || []); setLoadingEntities(false); })
      .catch(() => { setLgaEntities([]); setLoadingEntities(false); });
  }, [selected]);

  // The API returns both metrics in one payload; switching metric costs no fetch.
  useEffect(() => {
    setLoading(true);
    const url = stateFilter === 'ALL'
      ? '/api/data/map'
      : `/api/data/map?state=${stateFilter}`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        setFeatures(data.features || []);
        setSummary(data.summary || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [stateFilter]);

  // Stats by remoteness — desert stats, so only rows that carry a score
  const remotenessBuckets = useMemo(() => {
    const buckets = new Map<string, { count: number; avgDesert: number; avgFunding: number; totalEntities: number }>();
    for (const f of features) {
      if (f.desert_score === null) continue;
      const r = f.remoteness || 'Unknown';
      const b = buckets.get(r) || { count: 0, avgDesert: 0, avgFunding: 0, totalEntities: 0 };
      b.count++;
      b.avgDesert += Number(f.desert_score);
      b.avgFunding += Number(f.total_funding_all_sources ?? 0);
      b.totalEntities += Number(f.indexed_entities ?? 0);
      buckets.set(r, b);
    }
    for (const [, b] of buckets) {
      b.avgDesert /= b.count;
      b.avgFunding /= b.count;
    }
    return [...buckets.entries()]
      .sort((a, b) => {
        const ai = REMOTENESS_ORDER.indexOf(a[0]);
        const bi = REMOTENESS_ORDER.indexOf(b[0]);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
  }, [features]);

  // Top-10 list for the active metric
  const topFeatures = useMemo(() => {
    if (metric === 'desert_score') {
      return features.filter(f => f.desert_score !== null).slice(0, 10);
    }
    return [...features]
      .sort((a, b) => Number(b.unplaced_count) - Number(a.unplaced_count))
      .slice(0, 10);
  }, [features, metric]);

  const copy = METRIC_COPY[metric];

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black">
      {/* Header */}
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold uppercase tracking-widest text-bauhaus-red">
              CivicGraph
            </p>
            <div className="flex gap-2">
              <Link href="/entity" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">
                Entity Search
              </Link>
              <Link href="/graph" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">
                Graph
              </Link>
            </div>
          </div>
          <h1 className="text-3xl font-black uppercase tracking-wider">
            {copy.title}
          </h1>
          <p className="text-gray-400 text-sm mt-1 max-w-2xl">
            {copy.description}
          </p>
        </div>
      </div>

      {/* Controls + Summary */}
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Metric toggle */}
            <div className="flex items-center gap-1">
              {([
                ['desert_score', 'Funding deserts'],
                ['unplaced_share', 'Unplaced orgs'],
              ] as Array<[MapMetric, string]>).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={`text-[10px] px-3 py-1.5 font-bold uppercase tracking-wider transition-all ${
                    metric === m
                      ? 'bg-bauhaus-red text-white'
                      : 'bg-white text-gray-500 border border-gray-200 hover:border-bauhaus-red'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* State filter */}
            <div className="flex items-center gap-1">
              {STATES.map(s => (
                <button
                  key={s}
                  onClick={() => { setStateFilter(s); setSelected(null); }}
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
          </div>

          {/* Summary stats */}
          {summary && (
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span><strong className="text-bauhaus-black">{summary.total_lgas}</strong> LGAs</span>
              {metric === 'desert_score' ? (
                <>
                  <span><strong className="text-bauhaus-red">{summary.severe_deserts}</strong> severe deserts</span>
                  <span>Avg score <strong className="text-bauhaus-black">{summary.avg_desert_score}</strong></span>
                </>
              ) : (
                <span><strong className="text-bauhaus-red">{summary.high_uncertainty_lgas}</strong> mostly unplaceable</span>
              )}
            </div>
          )}
        </div>
        {summary && summary.undrawn_lgas > 0 && (
          <p className="mt-2 text-xs text-gray-400">
            {summary.undrawn_lgas} councils hold data but no point coordinates in our records; they appear only where a map boundary matches their name.
          </p>
        )}
      </div>

      {/* Map + Detail panel */}
      <div className="mx-auto max-w-7xl px-4 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Map */}
          <div className="lg:col-span-2 bg-white border-2 border-bauhaus-black" style={{ height: 600 }}>
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <span className="inline-block w-5 h-5 border-2 border-gray-300 border-t-bauhaus-red rounded-full animate-spin mr-2" />
                Loading map data...
              </div>
            ) : (
              <MapView
                features={features}
                selected={selected}
                onSelect={setSelected}
                metric={metric}
              />
            )}
          </div>

          {/* Detail panel */}
          <div className="space-y-4">
            {selected ? (
              <>
                <div className="bg-white border-2 border-bauhaus-black p-4">
                  <h3 className="font-black text-lg uppercase tracking-wider">{selected.lga_name}</h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span>{selected.state}</span>
                    <span>{selected.remoteness ?? ''}</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Desert Score</span>
                      <span className={`text-2xl font-black ${Number(selected.desert_score) > 100 ? 'text-bauhaus-red' : 'text-bauhaus-black'}`}>
                        {selected.desert_score === null ? '—' : Number(selected.desert_score).toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Funding</span>
                      <span className="text-lg font-black text-green-700">
                        {selected.total_funding_all_sources === null ? '—' : money(Number(selected.total_funding_all_sources))}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">SEIFA Decile</span>
                      <span className="text-lg font-black">{selected.avg_irsd_decile ?? '—'}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Entities</span>
                      <span className="text-lg font-black">{selected.indexed_entities ?? '—'}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Community Controlled</span>
                      <span className="text-lg font-black">{selected.community_controlled_entities ?? '—'}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Unplaced in its postcodes</span>
                      <span className={`text-lg font-black ${Number(selected.unplaced_share) >= 50 ? 'text-bauhaus-red' : 'text-bauhaus-black'}`}>
                        {selected.unplaced_count}
                        {selected.unplaced_share !== null && (
                          <span className="text-xs font-bold text-gray-400 ml-1.5">({Number(selected.unplaced_share).toFixed(0)}%)</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Entities in this LGA */}
                <div className="bg-white border border-gray-200 p-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                    Top Entities in {selected.lga_name}
                  </h3>
                  {loadingEntities ? (
                    <div className="flex items-center gap-2 text-gray-400 text-xs">
                      <span className="inline-block w-3 h-3 border-2 border-gray-300 border-t-bauhaus-red rounded-full animate-spin" />
                      Loading...
                    </div>
                  ) : lgaEntities.length > 0 ? (
                    <div className="space-y-1.5">
                      {lgaEntities.map((e) => (
                        <Link
                          key={e.gs_id}
                          href={`/entity/${encodeURIComponent(e.gs_id)}`}
                          className="block text-xs hover:bg-gray-50 px-1 py-1 transition-colors group"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate group-hover:text-bauhaus-red transition-colors">
                              {e.canonical_name}
                            </span>
                            {e.power_score && Number(e.power_score) > 0 && (
                              <span className="font-mono font-bold text-gray-500 shrink-0">
                                {Number(e.power_score).toFixed(0)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-sm">{e.entity_type}</span>
                            {e.is_community_controlled && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-bauhaus-red/10 text-bauhaus-red rounded-sm">CC</span>
                            )}
                            {e.system_count && Number(e.system_count) > 1 && (
                              <span className="text-[9px] text-gray-400">{e.system_count} sys</span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">No indexed entities in this LGA.</p>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  {metric === 'desert_score'
                    ? 'Desert score = disadvantage x (1 / funding). Higher = more underserved.'
                    : 'Unplaced = registered in this council’s postcodes but not placeable to any council. A shared postcode counts toward every council it touches.'}
                </p>
              </>
            ) : (
              <div className="bg-white border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Click an area on the map to see LGA details.</p>
              </div>
            )}

            {/* Remoteness breakdown */}
            <div className="bg-white border border-gray-200 p-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">By Remoteness</h3>
              <div className="space-y-2">
                {remotenessBuckets.map(([name, data]) => (
                  <div key={name} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 truncate max-w-32">{name.replace(' of Australia', '').replace(' Australia', '')}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400">{data.count} LGAs</span>
                      <span className={`font-mono font-bold ${data.avgDesert > 50 ? 'text-bauhaus-red' : 'text-gray-600'}`}>
                        {data.avgDesert.toFixed(0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 10 for the active metric */}
            <div className="bg-white border border-gray-200 p-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                {metric === 'desert_score' ? 'Worst Funding Deserts' : 'Most Unplaced Organisations'}
              </h3>
              <div className="space-y-1.5">
                {topFeatures.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => setSelected(f)}
                    className="w-full flex items-center justify-between text-xs hover:bg-gray-50 px-1 py-0.5 transition-colors text-left"
                  >
                    <span className="font-medium truncate max-w-40">{f.lga_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">{f.state}</span>
                      {metric === 'desert_score' ? (
                        <span className="font-mono font-bold text-bauhaus-red">{Number(f.desert_score).toFixed(0)}</span>
                      ) : (
                        <span className="font-mono font-bold text-bauhaus-red">
                          {f.unplaced_count}
                          {f.unplaced_share !== null && (
                            <span className="text-gray-400 font-normal"> ({Number(f.unplaced_share).toFixed(0)}%)</span>
                          )}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
