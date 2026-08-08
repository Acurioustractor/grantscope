'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { money } from '@/lib/format';
import {
  DEFAULT_ATLAS_LAYER_KEY,
  getAtlasLayer,
  isLiveLayer,
  visibleAtlasLayers,
  type AtlasFeature,
  type AtlasLiveLayer,
} from '@/lib/atlas/layers';

// Lazy-load the map to avoid SSR issues with Leaflet
const AtlasMap = dynamic(() => import('./atlas-map'), { ssr: false });

// This is the public surface: org and withheld layers never reach it.
const LAYERS = visibleAtlasLayers('public');

const STATES = ['ALL', 'NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

export default function AtlasClient() {
  const [features, setFeatures] = useState<AtlasFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [stateFilter, setStateFilter] = useState('ALL');
  const [selected, setSelected] = useState<AtlasFeature | null>(null);
  // The layer being read (caveat card) can be declared; the layer being
  // painted (the map) is always the last live pick.
  const [activeKey, setActiveKey] = useState(DEFAULT_ATLAS_LAYER_KEY);
  const [mapKey, setMapKey] = useState(DEFAULT_ATLAS_LAYER_KEY);

  // One fetch: the API returns every council and both metrics in one payload.
  // The state filter slices client-side.
  useEffect(() => {
    fetch('/api/data/map')
      .then(r => r.json())
      .then(data => {
        setFeatures(data.features || []);
        setLoading(false);
      })
      .catch(() => {
        setFailed(true);
        setLoading(false);
      });
  }, []);

  const activeLayer = getAtlasLayer(activeKey) ?? LAYERS[0];
  const mapLayer = (getAtlasLayer(mapKey) ?? LAYERS[0]) as AtlasLiveLayer;

  function pickLayer(key: string) {
    setActiveKey(key);
    const layer = getAtlasLayer(key);
    if (layer && isLiveLayer(layer)) setMapKey(key);
  }

  const filtered = useMemo(
    () => (stateFilter === 'ALL' ? features : features.filter(f => f.state === stateFilter)),
    [features, stateFilter]
  );

  const undrawn = useMemo(() => filtered.filter(f => f.lat === null).length, [filtered]);

  const otherLiveLayers = useMemo(
    () => LAYERS.filter(isLiveLayer).filter(l => l.key !== mapLayer.key),
    [mapLayer.key]
  );

  return (
    <div className="fixed inset-0 z-0 bg-bauhaus-canvas">
      {/* The map is the page. Everything else overlays it. */}
      <div className="absolute inset-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="bg-white border-4 border-bauhaus-black px-6 py-4 shadow-[8px_8px_0_0_#121212] flex items-center gap-3">
              <span className="inline-block w-5 h-5 border-2 border-gray-300 border-t-bauhaus-red rounded-full animate-spin" />
              <span className="text-sm font-bold uppercase tracking-widest">Loading the Atlas</span>
            </div>
          </div>
        ) : failed ? (
          <div className="flex items-center justify-center h-full">
            <div className="bg-white border-4 border-bauhaus-black px-6 py-4 shadow-[8px_8px_0_0_#121212] max-w-sm">
              <p className="text-sm font-bold uppercase tracking-widest text-bauhaus-red">The map data did not load</p>
              <p className="text-sm text-gray-600 mt-2">Refresh to try again. If it keeps failing, the data service is down, not your connection.</p>
            </div>
          </div>
        ) : (
          <AtlasMap
            features={filtered}
            layer={mapLayer}
            selected={selected}
            onSelect={setSelected}
          />
        )}
      </div>

      {/* Left rail: what you are looking at, and what it contains */}
      <div className="absolute left-4 top-20 z-[900] w-[min(22rem,calc(100vw-2rem))] max-h-[calc(100dvh-6.5rem)] overflow-y-auto space-y-4 pr-1">
        {/* Brand + layer picker */}
        <div className="bg-white border-4 border-bauhaus-black shadow-[8px_8px_0_0_#121212] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-bauhaus-red">CivicGraph</p>
          <h1 className="text-2xl font-black uppercase tracking-wider leading-none mt-1">The Atlas</h1>
          <p className="text-xs text-gray-500 mt-2">
            Every layer carries what its number contains.
          </p>

          <div className="mt-4 space-y-1.5">
            {LAYERS.map(layer => {
              const active = layer.key === activeKey;
              const declared = !isLiveLayer(layer);
              return (
                <button
                  key={layer.key}
                  onClick={() => pickLayer(layer.key)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider transition-colors border-2 ${
                    active
                      ? 'bg-bauhaus-red border-bauhaus-red text-white'
                      : declared
                        ? 'bg-white border-dashed border-gray-300 text-gray-400 hover:border-bauhaus-yellow'
                        : 'bg-white border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white'
                  }`}
                >
                  <span>{layer.name}</span>
                  {declared && (
                    <span className={`shrink-0 text-[9px] px-1.5 py-0.5 border ${active ? 'border-white/60 text-white' : 'border-bauhaus-yellow bg-bauhaus-yellow/20 text-bauhaus-black'}`}>
                      Not yet held
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* State filter */}
          <div className="mt-4 flex flex-wrap gap-1">
            {STATES.map(s => (
              <button
                key={s}
                onClick={() => { setStateFilter(s); setSelected(null); }}
                className={`text-[10px] px-2 py-1 font-bold uppercase tracking-wider transition-colors ${
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

        {/* The caveat, attached to the number — not a help page */}
        <div className="bg-white border-4 border-bauhaus-black shadow-[8px_8px_0_0_#121212] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-bauhaus-red">
            What this number contains
          </p>
          <h2 className="text-base font-black uppercase tracking-wider mt-1">{activeLayer.name}</h2>
          <p className="text-[11px] text-gray-400 uppercase tracking-wider">{activeLayer.unit}</p>
          <p className="text-sm text-gray-700 leading-relaxed mt-3">{activeLayer.caveat}</p>

          {!isLiveLayer(activeLayer) && (
            <div className="mt-3 border-2 border-bauhaus-yellow bg-bauhaus-yellow/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest">Declared, not held</p>
              <p className="text-xs text-gray-700 mt-1">{activeLayer.waitingOn}</p>
              <p className="text-xs text-gray-500 mt-2">
                The map is still showing {mapLayer.name.toLowerCase()}.
              </p>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Honest at: <span className="text-bauhaus-black">{activeLayer.honestAt}</span> level
            </p>
            <p className="text-xs text-gray-500 mt-1">{activeLayer.honestAtNote}</p>
          </div>
        </div>
      </div>

      {/* Legend for the painted layer */}
      {!loading && !failed && (
        <div className="absolute left-4 bottom-4 z-[900] bg-white border-2 border-bauhaus-black p-3 w-[min(15rem,calc(100vw-2rem))]">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2">{mapLayer.name}</p>
          <div className="space-y-1">
            {mapLayer.scale.map(stop => (
              <div key={stop.min} className="flex items-center gap-2 text-[11px] text-gray-600">
                <span className="inline-block w-3.5 h-3.5 border border-bauhaus-black/30 shrink-0" style={{ backgroundColor: stop.color, opacity: 0.85 }} />
                <span>{stop.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              <span className="inline-block w-3.5 h-3.5 border border-gray-300 shrink-0" style={{ backgroundColor: '#e5e7eb' }} />
              <span>{mapLayer.noDataLabel}</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 leading-snug">
            {filtered.length} councils{undrawn > 0 ? `; ${undrawn} hold no coordinates and render only where a boundary name matches` : ''}.
          </p>
        </div>
      )}

      {/* Selected place — the numbers, with the caveat one glance away */}
      {selected && (
        <div className="absolute right-4 top-20 z-[900] w-[min(20rem,calc(100vw-2rem))] max-h-[calc(100dvh-6.5rem)] overflow-y-auto">
          <div className="bg-white border-4 border-bauhaus-black shadow-[8px_8px_0_0_#121212] p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-black text-lg uppercase tracking-wider leading-tight">{selected.lga_name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selected.state}{selected.remoteness ? ` · ${selected.remoteness}` : ''}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="shrink-0 w-7 h-7 border-2 border-bauhaus-black font-black hover:bg-bauhaus-black hover:text-white transition-colors"
              >
                ×
              </button>
            </div>

            <div className="mt-4 flex justify-between items-baseline">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{mapLayer.name}</span>
              <span className="text-3xl font-black">
                {(() => {
                  const v = mapLayer.value(selected);
                  return v === null ? '—' : mapLayer.format(v);
                })()}
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {otherLiveLayers.map(layer => {
                const v = layer.value(selected);
                return (
                  <div key={layer.key} className="flex justify-between items-baseline">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{layer.name}</span>
                    <span className="text-sm font-black">{v === null ? '—' : layer.format(v)}</span>
                  </div>
                );
              })}
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Recorded funding</span>
                <span className="text-sm font-black text-green-700">
                  {selected.total_funding_all_sources === null ? '—' : money(Number(selected.total_funding_all_sources))}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">SEIFA decile</span>
                <span className="text-sm font-black">{selected.avg_irsd_decile ?? '—'}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Entities</span>
                <span className="text-sm font-black">{selected.indexed_entities ?? '—'}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Community controlled</span>
                <span className="text-sm font-black">{selected.community_controlled_entities ?? '—'}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Cannot place</span>
                <span className={`text-sm font-black ${Number(selected.unplaced_share) >= 50 ? 'text-bauhaus-red' : ''}`}>
                  {selected.unplaced_count}
                  {selected.unplaced_share !== null && (
                    <span className="text-xs font-bold text-gray-400 ml-1">({Number(selected.unplaced_share).toFixed(0)}%)</span>
                  )}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-gray-400 mt-4 pt-3 border-t border-gray-200 leading-snug">
              {mapLayer.honestAtNote}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
