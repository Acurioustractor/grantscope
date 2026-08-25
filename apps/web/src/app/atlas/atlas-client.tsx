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
  isRegionLayer,
  visibleAtlasLayers,
  type AtlasFeature,
  type AtlasLiveLayer,
  type AtlasPoint,
  type AtlasSurface,
} from '@/lib/atlas/layers';
import { RHD_REGIONS } from '@/lib/services/rhd-signal';
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
  beyondCouncilRows,
  reasonRows,
  scopeReasonRows,
  totalOf,
  type StateReasonCount,
} from '@/lib/atlas/reasons';
import { stampFamilyRows, stampLabel } from '@/lib/atlas/stamps';
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
  is_community_controlled: boolean | null;
  /** The placement stamp — how this organisation got its council. */
  lga_source: string | null;
}

/** The /api/data/place/[code] payload: one council's live joins, keyed by
 * LGA code. Every count in here is a real answer — the joins ran. */
interface PlaceDetail {
  lga_code: string;
  org_count: number;
  cc_count: number;
  money: {
    grants: { records: number; total: number };
    justice: { records: number; total: number };
    contracts: { records: number; total: number };
  };
  alma_linked: number;
  stamps: Record<string, number>;
  orgs: RailEntity[];
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
  // The live why-tally behind every "cannot place" number: (state, reason,
  // count) rows, scoped client-side to the state filter or a selection.
  const [reasonTally, setReasonTally] = useState<StateReasonCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [stateFilter, setStateFilter] = useState('ALL');
  const [selected, setSelected] = useState<AtlasFeature | null>(null);
  const [selectedRegionKey, setSelectedRegionKey] = useState<string | null>(null);
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
  // The selected place's live joins. Null while nothing is selected, while
  // loading, or after a failure — detailFailed tells those apart.
  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailFailed, setDetailFailed] = useState(false);
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
        setReasonTally(data.summary?.unplaced_reasons || []);
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
    if (layer && isRegionLayer(layer)) {
      setStateFilter('NT');
      setSelected(null);
      setSelectedRegionKey(selectedRegionKey ?? Object.keys(RHD_REGIONS)[0] ?? null);
    } else {
      setSelectedRegionKey(null);
    }
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

  // Fetch the selected place's live joins, keyed by LGA code — who is placed
  // here, the money reaching them, what the Australian Living Map of
  // Alternatives links here, and the stamps behind the placements. The
  // cancelled flag stops a slow response landing under the wrong header.
  useEffect(() => {
    if (!selected) {
      setDetail(null);
      setDetailFailed(false);
      return;
    }
    if (!selected.lga_code) {
      // A council without an LGA code in our records cannot be live-joined.
      setDetail(null);
      setDetailFailed(true);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    setDetailFailed(false);
    fetch(`/api/data/place/${encodeURIComponent(selected.lga_code)}`)
      .then(r => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(data => {
        if (cancelled) return;
        setDetail(data);
        setLoadingDetail(false);
      })
      .catch(() => {
        if (cancelled) return;
        setDetail(null);
        setDetailFailed(true);
        setLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const filtered = useMemo(
    () => (stateFilter === 'ALL' ? features : features.filter(f => f.state === stateFilter)),
    [features, stateFilter]
  );

  const undrawn = useMemo(() => filtered.filter(f => f.lat === null).length, [filtered]);

  // Unplaced-orgs is excluded from the generic metric rows: its story is the
  // How-sure breakdown on the place panel, not one more percentage.
  const otherLiveLayers = useMemo(
    () =>
      LAYERS.filter(isChoroplethLayer).filter(
        l => l.key !== mapLayer.key && l.key !== 'unplaced-orgs'
      ),
    [LAYERS, mapLayer.key]
  );

  // The active layer's points, when it is point-grain and this surface holds
  // data for it. A public instance passes no points, so nothing renders.
  const activePointLayer = isPointLayer(activeLayer) ? activeLayer : null;
  const activeRegionLayer = isRegionLayer(activeLayer) ? activeLayer : null;
  const selectedRegion = selectedRegionKey ? RHD_REGIONS[selectedRegionKey] ?? null : null;
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
            regionLayer={activeRegionLayer}
            selectedRegionKey={selectedRegionKey}
            onSelectRegion={setSelectedRegionKey}
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

          {activeRegionLayer && selectedRegion && (
            <div className="mt-3 border-2 border-bauhaus-black bg-white p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-bauhaus-red">
                Selected health region
              </p>
              <h3 className="mt-1 text-sm font-black uppercase tracking-wider">
                {selectedRegion.region}
              </h3>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-bauhaus-muted">First Nations cases</p>
                  <p className="text-lg font-black tabular-nums">{selectedRegion.firstNationsCases.toLocaleString('en-AU')}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-bauhaus-muted">Prevalence</p>
                  <p className="text-lg font-black tabular-nums">{activeRegionLayer.format(selectedRegion.firstNationsRatePer100k)}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-bauhaus-muted">Non-Indigenous cases</p>
                  <p className="font-black tabular-nums">{selectedRegion.nonIndigenousCases.toLocaleString('en-AU')}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-bauhaus-muted">Rate disparity</p>
                  <p className="font-black tabular-nums">{selectedRegion.rateRatio}×</p>
                </div>
              </div>
              <p className="mt-2 text-[10px] leading-snug text-bauhaus-muted">{selectedRegion.boundaryNote}</p>
              <p className="mt-2 text-[9px] uppercase tracking-widest text-bauhaus-muted">
                As at {selectedRegion.asAt} · AIHW table {selectedRegion.sourceTable}
              </p>
            </div>
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
                  {activeRegionLayer
                    ? `${Object.keys(RHD_REGIONS).length} health regions with held observations.`
                    : `${filtered.length} councils${undrawn > 0 ? `; ${undrawn} hold no coordinates and render only where a boundary name matches` : ''}.`}
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

          {/* The live why behind every number here: not one red percentage
              but the six reason codes, read from the database and scoped to
              the state filter. Uncertainty qualifies every layer, so this
              block travels with all of them. */}
          {(() => {
            const scoped = scopeReasonRows(reasonTally, stateFilter);
            if (scoped.length === 0) return null;
            return (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Cannot be placed{stateFilter !== 'ALL' ? ` · ${stateFilter}` : ''}
                </p>
                <p className="text-xs text-gray-600 mt-1 leading-snug">
                  {totalOf(scoped).toLocaleString()} organisations
                  {stateFilter !== 'ALL' ? ` recorded in ${stateFilter}` : ''} sit on no
                  council&apos;s count. Why, counted live:
                </p>
                <div className="mt-2 space-y-1">
                  {scoped.map(r => (
                    <div key={r.code} className="flex justify-between items-baseline gap-2 text-[11px]">
                      <span className="text-gray-600">{r.label}</span>
                      <span className="font-black tabular-nums">{r.n.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 leading-snug">
                  An organisation with no postcode, or one we do not recognise, can appear
                  under no council at all. The rest count toward every council sharing
                  their postcode — never sum them.
                </p>
              </div>
            );
          })()}
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

              {/* The other map layers' readings for this place. The panel's
                  own sections below carry the live joins; these rows are the
                  cached choropleth payload, and each formats through its
                  layer so the caveat-bearing registry stays the only voice. */}
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
              </div>

              {loadingDetail && (
                <div className="mt-4 pt-3 border-t border-gray-200 flex items-center gap-2 text-gray-400 text-xs">
                  <span className="inline-block w-3 h-3 border-2 border-gray-300 border-t-bauhaus-red rounded-full animate-spin" />
                  Joining the registers live…
                </div>
              )}
              {detailFailed && (
                <p className="mt-4 pt-3 border-t border-gray-200 text-xs text-bauhaus-red leading-snug">
                  The live joins did not load. Everything above is the cached map payload;
                  nothing below can be shown honestly without the join.
                </p>
              )}

              {/* WHO'S HERE — live from the entity graph, keyed by LGA code.
                  Each organisation carries the stamp that placed it, so the
                  list never claims more certainty than the evidence holds. */}
              {detail && (
                <div className="mt-4 pt-3 border-t-2 border-bauhaus-black">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-bauhaus-red">
                    Who&apos;s here
                  </p>
                  <p className="text-xs text-gray-600 mt-1 leading-snug">
                    <span className="font-black">{detail.org_count.toLocaleString()}</span>{' '}
                    organisations placed in this council,{' '}
                    <span className="font-black">{detail.cc_count.toLocaleString()}</span> of them
                    community-controlled — live from the register joins, counted at each
                    organisation&apos;s registered address.
                  </p>
                  {detail.orgs.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {detail.orgs.map(e => (
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
                          {/* The placement stamp, in plain words: how we know
                              this organisation belongs to this council. */}
                          {e.lga_source && (
                            <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">
                              placed: {stampLabel(e.lga_source)}
                            </p>
                          )}
                        </Link>
                      ))}
                      {detail.org_count > detail.orgs.length && (
                        <p className="text-[10px] text-gray-400 leading-snug px-1">
                          Showing the {detail.orgs.length} with the largest recorded financial
                          footprint of {detail.org_count.toLocaleString()} placed here.
                        </p>
                      )}
                    </div>
                  )}
                  {detail.org_count === 0 && (
                    <p className="text-xs text-gray-500 mt-2 leading-snug">
                      No organisation in our records is placed in this council. Check the
                      cannot-place count below before reading that as empty.
                    </p>
                  )}
                </div>
              )}

              {/* MONEY REACHING HERE — three live joins, each named with its
                  source and record count. GrantConnect leads because it is
                  the richest vein; the choropleth's Recorded money reads an
                  older pipeline and the two are never a sum. */}
              {detail && (
                <div className="mt-4 pt-3 border-t-2 border-bauhaus-black">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-bauhaus-red">
                    Money reaching here
                  </p>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="text-[11px] text-gray-600">
                        Federal grants
                        <span className="text-gray-400"> · {detail.money.grants.records.toLocaleString()} GrantConnect awards</span>
                      </span>
                      <span className="text-sm font-black tabular-nums text-green-700">
                        {money(detail.money.grants.total)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="text-[11px] text-gray-600">
                        Justice programs
                        <span className="text-gray-400"> · {detail.money.justice.records.toLocaleString()} records</span>
                      </span>
                      <span className="text-sm font-black tabular-nums text-green-700">
                        {money(detail.money.justice.total)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="text-[11px] text-gray-600">
                        Contracts
                        <span className="text-gray-400"> · {detail.money.contracts.records.toLocaleString()} on AusTender</span>
                      </span>
                      <span className="text-sm font-black tabular-nums text-green-700">
                        {money(detail.money.contracts.total)}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2 leading-snug">
                    Live joins to organisations placed here, counted where each recipient is
                    registered — money for this place can sit recorded elsewhere, and a
                    program run from here can serve places far beyond it.
                  </p>
                </div>
              )}

              {/* WHAT WORKS HERE — the Australian Living Map of Alternatives.
                  Zero is a real answer about our linking, said out loud,
                  never dressed up or hidden. */}
              {detail && (
                <div className="mt-4 pt-3 border-t-2 border-bauhaus-black">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-bauhaus-red">
                    What works here
                  </p>
                  {detail.alma_linked > 0 ? (
                    <p className="text-xs text-gray-600 mt-1 leading-snug">
                      <span className="font-black">{detail.alma_linked.toLocaleString()}</span>{' '}
                      {detail.alma_linked === 1 ? 'intervention' : 'interventions'} in the
                      Australian Living Map of Alternatives{' '}
                      {detail.alma_linked === 1 ? 'is' : 'are'} linked to organisations placed
                      here. Counts are linkage, not effectiveness.
                    </p>
                  ) : (
                    <p className="text-xs text-gray-600 mt-1 leading-snug">
                      No intervention in the Australian Living Map of Alternatives is linked to
                      an organisation placed here yet. That is a gap in our linking — most
                      documented interventions are not tied to an organisation yet — not a
                      verdict on what this community does.
                    </p>
                  )}
                </div>
              )}

              {/* How sure are we, for this council: the live reasons, not one
                  red percentage. Counts include every organisation whose
                  postcode touches this council, so the same organisation
                  counts toward every council sharing it — never summed. */}
              {(() => {
                const rows = reasonRows(selected.unplaced_reasons);
                const total = Number(selected.unplaced_count) || 0;
                const share =
                  selected.unplaced_share === null ? null : Number(selected.unplaced_share);
                const severe = share !== null && share >= 50;
                const beyond = beyondCouncilRows(reasonTally, selected.state);
                const beyondParts = beyond.map(r =>
                  r.code === 'no_postcode'
                    ? `${r.n.toLocaleString()} hold no postcode`
                    : r.code === 'unknown_postcode'
                      ? `${r.n.toLocaleString()} hold a postcode we do not recognise`
                      : `${r.n.toLocaleString()} ${r.label}`
                );
                return (
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      How sure are we
                    </p>
                    {total > 0 ? (
                      <>
                        <p
                          className={`text-xs mt-1 leading-snug ${severe ? 'text-bauhaus-red' : 'text-gray-600'}`}
                        >
                          {total.toLocaleString()} organisations that might be here cannot be
                          tied to one council
                          {share !== null
                            ? ` — ${share.toFixed(0)}% of everything this council might hold`
                            : ''}
                          .{severe ? ' Read every number on this panel gently.' : ''}
                        </p>
                        {rows.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {rows.map(r => (
                              <div
                                key={r.code}
                                className="flex justify-between items-baseline gap-2 text-[11px]"
                              >
                                <span className="text-gray-600">{r.label}</span>
                                <span className="font-black tabular-nums">
                                  {r.n.toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-xs mt-1 text-gray-600 leading-snug">
                        Every organisation recorded in this council&apos;s postcodes is placed.
                      </p>
                    )}
                    {/* And the ones we DID place: the evidence families, so
                        "placed" is never one flat count either. */}
                    {(() => {
                      const families = stampFamilyRows(detail?.stamps);
                      if (families.length === 0) return null;
                      return (
                        <div className="mt-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            How the placed were placed
                          </p>
                          <div className="mt-1.5 space-y-1">
                            {families.map(f => (
                              <div key={f.key} className="flex justify-between items-baseline gap-2 text-[11px]">
                                <span className="text-gray-600">{f.label}</span>
                                <span className="font-black tabular-nums">{f.n.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1.5 leading-snug">
                            Each organisation above carries its exact evidence. An address is
                            the surest; postcode geometry only says &quot;almost certainly this
                            council&quot;.
                          </p>
                        </div>
                      );
                    })()}
                    {beyondParts.length > 0 && (
                      <p className="text-[10px] text-gray-400 mt-2 leading-snug">
                        In {selected.state} records, {beyondParts.join(' and ')} — none of
                        them can appear under any council.
                      </p>
                    )}
                  </div>
                );
              })()}

              {selectedPage && (
                <Link
                  href={`/place/council/${selectedPage.slug}`}
                  className="mt-4 block border-2 border-bauhaus-black bg-bauhaus-black text-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-center hover:bg-white hover:text-bauhaus-black transition-colors"
                >
                  Read the full place page →
                </Link>
              )}

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
              {activeRegionLayer ? (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-bauhaus-muted mb-2">
                    Health regions held
                  </p>
                  <div className="space-y-2">
                    {Object.entries(RHD_REGIONS).map(([key, region]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedRegionKey(key)}
                        className={`w-full border-2 px-3 py-2 text-left transition-colors cursor-pointer ${
                          selectedRegionKey === key
                            ? 'border-bauhaus-red bg-bauhaus-red text-white'
                            : 'border-bauhaus-black bg-white hover:bg-bauhaus-black hover:text-white'
                        }`}
                      >
                        <span className="block text-[11px] font-black uppercase tracking-wider">{region.region}</span>
                        <span className="mt-1 block text-xs tabular-nums">
                          {activeRegionLayer.format(region.firstNationsRatePer100k)}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] leading-snug text-bauhaus-muted">
                    These are health-service observations. Council search and rankings return when you choose a council layer.
                  </p>
                </>
              ) : (
                <>
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
                </>
              )}
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
