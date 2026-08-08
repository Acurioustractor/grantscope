'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { money } from '@/lib/format';
import {
  ATLAS_GROUP_LABELS,
  ATLAS_GROUP_ORDER,
  DEFAULT_ATLAS_LAYER_KEY,
  getAtlasLayer,
  isChoroplethLayer,
  isLiveLayer,
  isPointLayer,
  visibleAtlasLayers,
  type AtlasFeature,
  type AtlasLiveLayer,
  type AtlasPoint,
  type AtlasSurface,
} from '@/lib/atlas/layers';
import {
  buildAtlasUrl,
  councilCsv,
  councilJson,
  exportFilename,
  parseAtlasUrl,
  placeSlug,
  resolvePlace,
} from '@/lib/atlas/share';
import {
  ATLAS_STORY,
  ATLAS_STORY_MEASURED_AT,
  getStoryStep,
  storyStepIndex,
  type AtlasStoryStep,
} from '@/lib/atlas/story';

// Lazy-load the map to avoid SSR issues with Leaflet
const AtlasMap = dynamic(() => import('./atlas-map'), { ssr: false });

const STATES = ['ALL', 'NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

/** A council that has a full /place/council/[slug] prose page. */
export interface CouncilPageLink {
  slug: string;
  lgaName: string;
  state: string | null;
}

interface AtlasClientProps {
  councilPages: CouncilPageLink[];
  /** Which consent tiers render here. 'public' (default) shows public layers
   * only; 'org' adds org-tier layers. Withheld renders nowhere. */
  surface?: AtlasSurface;
  /** Point-layer data, keyed by layer key. Only a server component that sits
   * behind the right gate may pass this — it is how org data stays org-side. */
  pointsByLayer?: Partial<Record<string, AtlasPoint[]>>;
  /** Server-fed lines shown under a layer's caveat (e.g. canon figures that
   * must not ship in the public registry bundle). */
  layerNotes?: Partial<Record<string, string>>;
  /** Layer to open on. Falls back to the default when it is not visible here. */
  initialLayerKey?: string;
  /** Escape hatch for chromeless surfaces (the org workspace has no global
   * nav above the Atlas). */
  backLink?: { href: string; label: string };
}

interface RailEntity {
  gs_id: string;
  canonical_name: string;
  entity_type: string;
  power_score: number | null;
  system_count: number | null;
  is_community_controlled: boolean;
}

function downloadFile(name: string, mime: string, text: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AtlasClient({
  councilPages,
  surface = 'public',
  pointsByLayer,
  layerNotes,
  initialLayerKey,
  backLink,
}: AtlasClientProps) {
  // The one sanctioned filter: org and withheld layers never reach a public
  // instance of this component.
  const LAYERS = useMemo(() => visibleAtlasLayers(surface), [surface]);

  const [features, setFeatures] = useState<AtlasFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [stateFilter, setStateFilter] = useState('ALL');
  const [selected, setSelected] = useState<AtlasFeature | null>(null);
  // The layer being read (caveat card) can be declared or point-grain; the
  // layer painting the choropleth is always the last choropleth pick.
  const [activeKey, setActiveKey] = useState(() => {
    const initial = initialLayerKey ? getAtlasLayer(initialLayerKey) : null;
    return initial && visibleAtlasLayers(surface).some(l => l.key === initial.key)
      ? initial.key
      : DEFAULT_ATLAS_LAYER_KEY;
  });
  const [mapKey, setMapKey] = useState(DEFAULT_ATLAS_LAYER_KEY);
  const [query, setQuery] = useState('');
  const [entities, setEntities] = useState<RailEntity[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [copied, setCopied] = useState(false);
  // The right rail docks open and can be hidden; selecting a place reopens
  // it, because a selection with nowhere to land is a dead click.
  const [railOpen, setRailOpen] = useState(true);
  // Story mode: index into ATLAS_STORY, or null when browsing freely.
  const [storyIdx, setStoryIdx] = useState<number | null>(null);
  // URL state only starts writing after the inbound URL has been applied.
  const urlReady = useRef(false);

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
  const story = storyIdx !== null ? ATLAS_STORY[storyIdx] : null;

  function pickLayer(key: string) {
    setActiveKey(key);
    const layer = getAtlasLayer(key);
    if (layer && isChoroplethLayer(layer)) setMapKey(key);
  }

  function selectPlace(f: AtlasFeature) {
    setSelected(f);
    setQuery('');
    setRailOpen(true);
    // A selection hidden by the state filter would be invisible — follow it.
    if (stateFilter !== 'ALL' && f.state !== stateFilter) setStateFilter(f.state);
  }

  // A story step is a saved view plus a paragraph: apply the view.
  function applyStoryStep(step: AtlasStoryStep, all: AtlasFeature[]) {
    pickLayer(step.view.layerKey);
    setStateFilter(step.view.state ?? 'ALL');
    setQuery('');
    if (step.view.place) {
      setSelected(resolvePlace(all, step.view.place, step.view.pst, step.view.state));
    } else {
      setSelected(null);
    }
  }

  function enterStory(idx: number) {
    const step = ATLAS_STORY[idx];
    if (!step) return;
    setStoryIdx(idx);
    applyStoryStep(step, features);
  }

  function moveStory(delta: number) {
    if (storyIdx === null) return;
    const next = storyIdx + delta;
    if (next < 0 || next >= ATLAS_STORY.length) return;
    enterStory(next);
  }

  function exitStory() {
    setStoryIdx(null);
  }

  // Apply the inbound URL once the payload exists: a link IS the presentation.
  useEffect(() => {
    if (loading || urlReady.current) return;
    const wanted = parseAtlasUrl(window.location.search);
    // A story link defines the whole view; the other params stay unread.
    if (wanted.story) {
      const idx = storyStepIndex(wanted.story);
      const step = getStoryStep(wanted.story);
      if (step && idx >= 0) {
        setStoryIdx(idx);
        applyStoryStep(step, features);
        urlReady.current = true;
        return;
      }
    }
    if (wanted.layerKey && LAYERS.some(l => l.key === wanted.layerKey)) {
      pickLayer(wanted.layerKey);
    }
    let nextFilter = stateFilter;
    if (wanted.state && STATES.includes(wanted.state)) {
      nextFilter = wanted.state;
      setStateFilter(wanted.state);
    }
    if (wanted.place) {
      const place = resolvePlace(features, wanted.place, wanted.pst, nextFilter);
      if (place) {
        setSelected(place);
        if (nextFilter !== 'ALL' && place.state !== nextFilter) setStateFilter(place.state);
      }
    }
    urlReady.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, features]);

  // Reflect the current view into the URL without navigating.
  useEffect(() => {
    if (!urlReady.current) return;
    const url = buildAtlasUrl({
      layerKey: activeKey,
      defaultLayerKey: DEFAULT_ATLAS_LAYER_KEY,
      stateFilter,
      selected,
      story: storyIdx !== null ? ATLAS_STORY[storyIdx].id : null,
    });
    window.history.replaceState(null, '', url);
  }, [activeKey, stateFilter, selected, storyIdx]);

  // In a room the presenter holds arrow keys, not a mouse.
  useEffect(() => {
    if (storyIdx === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        moveStory(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        moveStory(-1);
      } else if (e.key === 'Escape') {
        exitStory();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyIdx]);

  // Fetch the selected place's top entities — the same endpoint the boxed
  // /map panel used.
  useEffect(() => {
    if (!selected) {
      setEntities([]);
      return;
    }
    setLoadingEntities(true);
    fetch(`/api/data/entity/search?lga=${encodeURIComponent(selected.lga_name)}&limit=10`)
      .then(r => r.json())
      .then(data => {
        setEntities(data.results || []);
        setLoadingEntities(false);
      })
      .catch(() => {
        setEntities([]);
        setLoadingEntities(false);
      });
  }, [selected]);

  const filtered = useMemo(
    () => (stateFilter === 'ALL' ? features : features.filter(f => f.state === stateFilter)),
    [features, stateFilter]
  );

  const undrawn = useMemo(() => filtered.filter(f => f.lat === null).length, [filtered]);

  const otherLiveLayers = useMemo(
    () => LAYERS.filter(isChoroplethLayer).filter(l => l.key !== mapLayer.key),
    [LAYERS, mapLayer.key]
  );

  // The active layer's points, when it is point-grain and this surface holds
  // data for it. A public instance passes no points, so nothing renders.
  const activePointLayer = isPointLayer(activeLayer) ? activeLayer : null;
  const activePoints = useMemo(
    () => (activePointLayer ? pointsByLayer?.[activePointLayer.key] ?? [] : []),
    [activePointLayer, pointsByLayer]
  );

  // Search over every council we hold, not just the filtered view.
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const starts: AtlasFeature[] = [];
    const contains: AtlasFeature[] = [];
    for (const f of features) {
      const name = f.lga_name.toLowerCase();
      if (name.startsWith(q)) starts.push(f);
      else if (name.includes(q)) contains.push(f);
    }
    return [...starts, ...contains].slice(0, 8);
  }, [features, query]);

  const topPlaces = useMemo(() => {
    return [...filtered]
      .map(f => ({ f, v: mapLayer.value(f) }))
      .filter((x): x is { f: AtlasFeature; v: number } => x.v !== null)
      .sort((a, b) => b.v - a.v)
      .slice(0, 10);
  }, [filtered, mapLayer]);

  // The full prose page for the selected council, when one exists.
  const selectedPage = useMemo(() => {
    if (!selected) return null;
    const slug = placeSlug(selected.lga_name);
    const candidates = councilPages.filter(c => c.slug === slug);
    if (candidates.length === 0) return null;
    return (
      candidates.find(c => (c.state ?? '').toUpperCase() === selected.state) ?? candidates[0]
    );
  }, [selected, councilPages]);

  function copyLink() {
    const url =
      window.location.origin +
      buildAtlasUrl({
        layerKey: activeKey,
        defaultLayerKey: DEFAULT_ATLAS_LAYER_KEY,
        stateFilter,
        selected,
        story: storyIdx !== null ? ATLAS_STORY[storyIdx].id : null,
      });
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="fixed inset-0 z-0 bg-bauhaus-canvas flex">
      {/* CENTER — the map between the rails. isolate traps Leaflet's
          internal z-indexes so the docked rails paint above its edges. */}
      <div className="relative flex-1 min-w-0 order-2 isolate">
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
            onSelect={selectPlace}
            pointLayer={activePointLayer}
            points={activePoints}
          />
        )}
      </div>

      {/* Escape hatch for chromeless surfaces (org workspace) */}
      {backLink && (
        <Link
          href={backLink.href}
          className="absolute right-4 top-4 z-[950] bg-white border-2 border-bauhaus-black px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
        >
          ← {backLink.label}
        </Link>
      )}

      {/* Reopen tab when the right rail is hidden */}
      {!story && !railOpen && !loading && !failed && (
        <button
          onClick={() => setRailOpen(true)}
          className="absolute right-0 top-24 z-[900] bg-bauhaus-black text-white px-1.5 py-4 text-[10px] font-bold uppercase tracking-widest [writing-mode:vertical-rl] hover:bg-bauhaus-red transition-colors cursor-pointer"
        >
          Place rail ◂
        </button>
      )}
      </div>

      {/* LEFT — the locked rail: what you are looking at, what it contains.
          Story mode clears the stage: the paragraph does this job there. */}
      {!story && (
      <aside className="order-1 relative z-10 hidden md:block w-[21rem] shrink-0 bg-white border-r-4 border-bauhaus-black overflow-y-auto pt-20 px-4 pb-6">
        {/* Brand + layer picker */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-bauhaus-red">CivicGraph</p>
          <h1 className="text-2xl font-black uppercase tracking-wider leading-none mt-1">The Atlas</h1>
          <p className="text-xs text-gray-500 mt-2">
            Every layer carries what its number contains.
          </p>

          <p className="mt-4 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Layers · pick one to switch the map
          </p>
          {ATLAS_GROUP_ORDER.map(groupKey => {
            const groupLayers = LAYERS.filter(l => l.group === groupKey);
            if (groupLayers.length === 0) return null;
            return (
              <div key={groupKey} className="mb-2.5">
                <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-gray-300">
                  {ATLAS_GROUP_LABELS[groupKey]}
                </p>
                <div className="space-y-1.5">
                  {groupLayers.map(layer => {
                    const active = layer.key === activeKey;
                    const declared = !isLiveLayer(layer);
                    return (
                      <button
                        key={layer.key}
                        onClick={() => pickLayer(layer.key)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider transition-colors border-2 cursor-pointer ${
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
              </div>
            );
          })}

          {/* State filter */}
          <p className="mt-4 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            State
          </p>
          <div className="flex flex-wrap gap-1">
            {STATES.map(s => (
              <button
                key={s}
                onClick={() => { setStateFilter(s); setSelected(null); }}
                className={`text-[10px] px-2 py-1 font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  stateFilter === s
                    ? 'bg-bauhaus-black text-white'
                    : 'bg-white text-gray-500 border border-gray-200 hover:border-bauhaus-black'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* The URL always mirrors the view, so the link IS the presentation */}
          <button
            onClick={copyLink}
            className="mt-4 w-full border-2 border-bauhaus-black px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors cursor-pointer"
          >
            {copied ? 'Link copied' : 'Copy link to this view'}
          </button>

          {/* The fixed sequence for a room */}
          <button
            onClick={() => enterStory(0)}
            className="mt-2 w-full border-2 border-bauhaus-blue text-bauhaus-blue px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:bg-bauhaus-blue hover:text-white transition-colors cursor-pointer"
          >
            Story mode · tell it in a room
          </button>

          {/* The caveat, attached to the number — same card, one explanation
              (Ben 2026-08-09: separate floating boxes read as clutter) */}
          <div className="mt-4 pt-4 border-t-2 border-bauhaus-black">
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

          {/* Server-fed note: figures that belong to this surface only */}
          {layerNotes?.[activeLayer.key] && (
            <p className="mt-3 border-l-4 border-bauhaus-blue pl-3 text-xs text-gray-600">
              {layerNotes[activeLayer.key]}
            </p>
          )}

          {/* The colour scale lives WITH the caveat: what the number contains
              and what the colours mean are one explanation. */}
          {(() => {
            const legendLayer = isLiveLayer(activeLayer) ? activeLayer : mapLayer;
            return (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                  Colours{legendLayer.key !== activeLayer.key ? ` · still showing ${legendLayer.name.toLowerCase()}` : ''}
                </p>
                <div className="space-y-1">
                  {legendLayer.scale.map(stop => (
                    <div key={stop.min} className="flex items-center gap-2 text-[11px] text-gray-600">
                      <span
                        className="inline-block w-3.5 h-3.5 border border-bauhaus-black/30 shrink-0"
                        style={{ backgroundColor: stop.color, opacity: 0.85 }}
                      />
                      <span>{stop.label}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    <span className="inline-block w-3.5 h-3.5 border border-gray-300 shrink-0" style={{ backgroundColor: '#e5e7eb' }} />
                    <span>{legendLayer.noDataLabel}</span>
                  </div>
                </div>
                {legendLayer.scaleNote && (
                  <p className="text-[10px] text-gray-400 mt-1.5 leading-snug">{legendLayer.scaleNote}</p>
                )}
                {isPointLayer(legendLayer) && (
                  <p className="text-[10px] text-gray-400 mt-1.5 leading-snug">
                    Drawn as circles over the {mapLayer.name.toLowerCase()} choropleth.
                  </p>
                )}
                <p className="text-[10px] text-gray-400 mt-1.5 leading-snug">
                  {filtered.length} councils{undrawn > 0 ? `; ${undrawn} hold no coordinates and render only where a boundary name matches` : ''}.
                </p>
              </div>
            );
          })()}

          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Honest at: <span className="text-bauhaus-black">{activeLayer.honestAt}</span> level
            </p>
            <p className="text-xs text-gray-500 mt-1">{activeLayer.honestAtNote}</p>
          </div>
          </div>
        </div>
      </aside>
      )}

      {/* Right rail: the door to every place. Search when nothing is chosen,
          the place's numbers when something is. On small screens the rail
          appears only for a selection. Story mode clears it. */}
      {!loading && !failed && !story && railOpen && (
        <aside className="order-3 relative z-10 hidden sm:block w-[min(20rem,85vw)] shrink-0 bg-white border-l-4 border-bauhaus-black overflow-y-auto pt-20 px-4 pb-6">
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setRailOpen(false)}
              className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-bauhaus-black transition-colors cursor-pointer"
            >
              Hide ▸
            </button>
          </div>
          {selected ? (
            <div>
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
                  className="shrink-0 w-7 h-7 border-2 border-bauhaus-black font-black hover:bg-bauhaus-black hover:text-white transition-colors cursor-pointer"
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

              {/* Uncertainty travels with every number, on every layer */}
              {Number(selected.unplaced_share) >= 50 && (
                <p className="mt-2 text-[11px] text-bauhaus-red leading-snug">
                  Half or more of what might be here cannot be placed — read every
                  number on this panel gently.
                </p>
              )}

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

              {selectedPage && (
                <Link
                  href={`/place/council/${selectedPage.slug}`}
                  className="mt-4 block border-2 border-bauhaus-black bg-bauhaus-black text-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-center hover:bg-white hover:text-bauhaus-black transition-colors"
                >
                  Read the full place page →
                </Link>
              )}

              {/* Top entities — the same endpoint the boxed /map panel used */}
              <div className="mt-4 pt-3 border-t border-gray-200">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  Top entities here
                </p>
                {loadingEntities ? (
                  <div className="flex items-center gap-2 text-gray-400 text-xs">
                    <span className="inline-block w-3 h-3 border-2 border-gray-300 border-t-bauhaus-red rounded-full animate-spin" />
                    Loading…
                  </div>
                ) : entities.length > 0 ? (
                  <div className="space-y-1">
                    {entities.map(e => (
                      <Link
                        key={e.gs_id}
                        href={`/entity/${encodeURIComponent(e.gs_id)}`}
                        className="block text-xs hover:bg-gray-50 px-1 py-1 transition-colors group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate group-hover:text-bauhaus-red transition-colors">
                            {e.canonical_name}
                          </span>
                          {e.power_score !== null && Number(e.power_score) > 0 && (
                            <span className="font-mono font-bold text-gray-500 shrink-0">
                              {Number(e.power_score).toFixed(0)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500">{e.entity_type}</span>
                          {e.is_community_controlled && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-bauhaus-red/10 text-bauhaus-red">CC</span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No indexed entities placed in this council.</p>
                )}
              </div>

              {/* Take the data — the caveats travel inside the files */}
              <div className="mt-4 pt-3 border-t border-gray-200">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  Take the data
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => downloadFile(`${exportFilename(selected)}.csv`, 'text/csv', councilCsv(selected))}
                    className="flex-1 border-2 border-bauhaus-black px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors cursor-pointer"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() =>
                      downloadFile(
                        `${exportFilename(selected)}.json`,
                        'application/json',
                        JSON.stringify({ generated_at: new Date().toISOString(), ...councilJson(selected) }, null, 2)
                      )
                    }
                    className="flex-1 border-2 border-bauhaus-black px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors cursor-pointer"
                  >
                    JSON
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-2 leading-snug">
                  Every layer's caveat ships inside the file. All councils at once:{' '}
                  <a href="/api/data/map" target="_blank" rel="noopener noreferrer" className="underline hover:text-bauhaus-black">
                    GET /api/data/map
                  </a>
                  .
                </p>
              </div>

              <p className="text-[11px] text-gray-400 mt-4 pt-3 border-t border-gray-200 leading-snug">
                {mapLayer.honestAtNote}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Find a place</p>
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Council name…"
                className="w-full border-2 border-bauhaus-black px-3 py-2 text-sm focus:outline-none focus:border-bauhaus-blue"
              />
              {query.trim().length >= 2 && (
                <div className="mt-2 space-y-0.5">
                  {searchResults.length > 0 ? (
                    searchResults.map(f => (
                      <button
                        key={`${f.lga_name}|${f.state}`}
                        onClick={() => selectPlace(f)}
                        className="w-full flex items-center justify-between gap-2 text-xs px-1 py-1 hover:bg-gray-50 text-left transition-colors cursor-pointer"
                      >
                        <span className="font-medium truncate">{f.lga_name}</span>
                        <span className="text-gray-400 shrink-0">{f.state}</span>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400 px-1 py-1">
                      No council by that name in our records.
                    </p>
                  )}
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-gray-200">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  Highest: {mapLayer.name}
                </p>
                <div className="space-y-1">
                  {topPlaces.map(({ f, v }) => (
                    <button
                      key={`${f.lga_name}|${f.state}`}
                      onClick={() => selectPlace(f)}
                      className="w-full flex items-center justify-between gap-2 text-xs px-1 py-0.5 hover:bg-gray-50 text-left transition-colors cursor-pointer"
                    >
                      <span className="font-medium truncate">{f.lga_name}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-gray-400">{f.state}</span>
                        <span className="font-mono font-bold text-bauhaus-red">{mapLayer.format(v)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>
      )}

      {/* Story mode: one map state, one paragraph, read aloud. */}
      {story && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[950] w-[min(46rem,calc(100vw-2rem))]">
          <div className="bg-white border-4 border-bauhaus-black shadow-[8px_8px_0_0_#121212] p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-bauhaus-red">
                Story · {storyIdx! + 1} / {ATLAS_STORY.length}
              </p>
              <div className="flex items-center gap-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest hidden sm:block">
                  Measured {ATLAS_STORY_MEASURED_AT} · public registers
                </p>
                <button
                  onClick={exitStory}
                  aria-label="Exit story mode"
                  className="shrink-0 w-7 h-7 border-2 border-bauhaus-black font-black hover:bg-bauhaus-black hover:text-white transition-colors cursor-pointer"
                >
                  ×
                </button>
              </div>
            </div>

            <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider leading-tight mt-2">
              {story.title}
            </h2>
            <p className="text-base md:text-lg leading-relaxed mt-3">{story.paragraph}</p>

            {/* What the colours behind this sentence mean */}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              {mapLayer.scale.map(stop => (
                <span key={stop.min} className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gray-500">
                  <span className="inline-block w-3 h-3 border border-bauhaus-black/30" style={{ backgroundColor: stop.color, opacity: 0.85 }} />
                  {stop.label}
                </span>
              ))}
            </div>

            {story.cannotSay && (
              <div className="mt-4 border-l-4 border-bauhaus-red pl-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-bauhaus-red">
                  What we cannot say
                </p>
                <p className="text-sm text-gray-600 mt-1">{story.cannotSay}</p>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                onClick={() => moveStory(-1)}
                disabled={storyIdx === 0}
                className="border-2 border-bauhaus-black px-4 py-2 text-[10px] font-bold uppercase tracking-widest cursor-pointer disabled:opacity-30 disabled:cursor-default hover:enabled:bg-bauhaus-black hover:enabled:text-white transition-colors"
              >
                ← Back
              </button>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest hidden md:block">
                Arrow keys move · Esc leaves
              </p>
              {storyIdx === ATLAS_STORY.length - 1 ? (
                <button
                  onClick={exitStory}
                  className="border-2 border-bauhaus-black bg-bauhaus-black text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-white hover:text-bauhaus-black transition-colors cursor-pointer"
                >
                  Open the Atlas →
                </button>
              ) : (
                <button
                  onClick={() => moveStory(1)}
                  className="border-2 border-bauhaus-black bg-bauhaus-black text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-white hover:text-bauhaus-black transition-colors cursor-pointer"
                >
                  Next →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
