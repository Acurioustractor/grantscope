'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { fmt, money } from '@/lib/format';

const MapView = dynamic(() => import('@/app/map/map-view'), { ssr: false });

type LgaFeature = {
  lga_name: string;
  state: string;
  remoteness: string;
  avg_irsd_decile: number;
  avg_irsd_score: number;
  indexed_entities: number;
  community_controlled_entities: number;
  total_funding_all_sources: number;
  desert_score: number;
  lat: number;
  lng: number;
  lga_code: string;
};

type Summary = {
  total_lgas: number;
  severe_deserts: number;
  avg_desert_score: string;
  max_desert_score: string;
};

type AtlasLocalEntity = {
  gs_id: string;
  canonical_name: string;
  entity_type: string;
  power_score: number | null;
  system_count: number | null;
  is_community_controlled: boolean;
};

type AtlasData = {
  stats: {
    fundingDeserts: number;
    peopleMapped: number;
    boardInterlocks: number;
    totalTracked: number;
  };
  topDeserts: Array<{
    lga_name: string;
    state: string;
    remoteness: string | null;
    desert_score: number;
    total_funding_all_sources: number;
    indexed_entities: number;
    community_controlled_entities: number;
  }>;
  powerHolders: Array<{
    canonical_name: string;
    entity_type: string;
    state: string | null;
    system_count: number;
    power_score: number;
    total_dollar_flow: number;
    procurement_dollars: number;
    justice_dollars: number;
    donation_dollars: number;
    is_community_controlled: boolean;
  }>;
  topSuppliers: Array<{
    supplier_name: string;
    supplier_abn: string | null;
    total_value: number;
    buyer_count: number;
  }>;
  flowDomains: Array<{
    domain: string;
    total_amount: number;
    flow_count: number;
  }>;
};

const STATES = ['ALL', 'NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

function domainLabel(domain: string): string {
  return domain.replace(/_/g, ' ');
}

function percentage(numerator: number, denominator: number): string {
  if (!denominator) return '0%';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function priorityReasons(feature: LgaFeature | null, localCommunityCount: number): string[] {
  if (!feature) return [];

  const reasons: string[] = [];

  if (feature.desert_score >= 150) reasons.push('extreme under-allocation signal');
  else if (feature.desert_score >= 100) reasons.push('severe funding-desert pressure');

  if (feature.total_funding_all_sources <= 250_000) reasons.push('very low recorded funding base');
  if (feature.community_controlled_entities <= 2) reasons.push('thin visible community-controlled footprint');
  if (localCommunityCount > 0) reasons.push(`${localCommunityCount} community-controlled organisations already present`);
  if (feature.remoteness.includes('Very Remote')) reasons.push('very remote logistics and service burden');

  return reasons.slice(0, 4);
}

function statTone(value: number, warnThreshold: number): string {
  return value >= warnThreshold ? 'text-bauhaus-red' : 'text-bauhaus-black';
}

export function ReallocationAtlasClient({ atlasData }: { atlasData: AtlasData }) {
  const [features, setFeatures] = useState<LgaFeature[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingMap, setLoadingMap] = useState(true);
  const [stateFilter, setStateFilter] = useState('ALL');
  const [selected, setSelected] = useState<LgaFeature | null>(null);
  const [localEntities, setLocalEntities] = useState<AtlasLocalEntity[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [shiftPct, setShiftPct] = useState(10);
  const [communityCapturePct, setCommunityCapturePct] = useState(60);

  useEffect(() => {
    let ignore = false;
    setLoadingMap(true);

    const url = stateFilter === 'ALL' ? '/api/data/map' : `/api/data/map?state=${stateFilter}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (ignore) return;
        const nextFeatures = (data.features || []) as LgaFeature[];
        setFeatures(nextFeatures);
        setSummary(data.summary || null);
        setSelected((current) => {
          if (!nextFeatures.length) return null;
          if (current) {
            const retained = nextFeatures.find(
              (feature) => feature.lga_name === current.lga_name && feature.state === current.state,
            );
            if (retained) return retained;
          }
          const defaultFeature =
            nextFeatures.find((feature) =>
              atlasData.topDeserts.some(
                (desert) => desert.lga_name === feature.lga_name && desert.state === feature.state,
              ),
            ) || nextFeatures[0];
          return defaultFeature;
        });
        setLoadingMap(false);
      })
      .catch(() => {
        if (ignore) return;
        setLoadingMap(false);
      });

    return () => {
      ignore = true;
    };
  }, [atlasData.topDeserts, stateFilter]);

  useEffect(() => {
    if (!selected) {
      setLocalEntities([]);
      return;
    }

    let ignore = false;
    setLoadingEntities(true);

    fetch(`/api/data/entity/search?lga=${encodeURIComponent(selected.lga_name)}&limit=12`)
      .then((res) => res.json())
      .then((data) => {
        if (ignore) return;
        setLocalEntities((data.results || []) as AtlasLocalEntity[]);
        setLoadingEntities(false);
      })
      .catch(() => {
        if (ignore) return;
        setLocalEntities([]);
        setLoadingEntities(false);
      });

    return () => {
      ignore = true;
    };
  }, [selected]);

  const localCommunityEntities = useMemo(
    () => localEntities.filter((entity) => entity.is_community_controlled),
    [localEntities],
  );

  const topPressurePlaces = useMemo(() => features.slice(0, 6), [features]);

  const reasons = useMemo(
    () => priorityReasons(selected, localCommunityEntities.length),
    [localCommunityEntities.length, selected],
  );

  const maxFlowAmount = useMemo(
    () => Math.max(...atlasData.flowDomains.map((domain) => domain.total_amount), 1),
    [atlasData.flowDomains],
  );

  const maxSupplierValue = useMemo(
    () => Math.max(...atlasData.topSuppliers.map((supplier) => supplier.total_value), 1),
    [atlasData.topSuppliers],
  );

  const maxPowerScore = useMemo(
    () => Math.max(...atlasData.powerHolders.map((holder) => holder.power_score), 1),
    [atlasData.powerHolders],
  );

  const nationalShift = atlasData.stats.totalTracked * (shiftPct / 100);
  const communityDirected = nationalShift * (communityCapturePct / 100);
  const localShift = (selected?.total_funding_all_sources || 0) * (shiftPct / 100);
  const localDirected = localShift * (communityCapturePct / 100);
  const perLocalCommunityOrg = localCommunityEntities.length
    ? localDirected / localCommunityEntities.length
    : 0;
  const selectedGoodsHref = selected
    ? `/goods-workspace?lga=${encodeURIComponent(selected.lga_name)}&state=${encodeURIComponent(selected.state)}&mode=need-led&ntOnly=${selected.state === 'NT' ? 'true' : 'false'}`
    : '/goods-workspace';
  const selectedPowerGraphHref = selected
    ? `/graph?mode=power&state=${encodeURIComponent(selected.state)}`
    : '/graph?mode=power';
  const selectedEntityHref = selected
    ? `/entity?q=${encodeURIComponent(selected.lga_name)}`
    : '/entity';

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 min-[1900px]:grid-cols-4">
        <div className="border-4 border-bauhaus-black bg-bauhaus-black p-5 text-white">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow">Tracked Dollars</div>
          <div className="mt-3 text-4xl font-black">{money(atlasData.stats.totalTracked)}</div>
          <div className="mt-2 text-sm font-bold text-white/70">2025 cross-system money flows</div>
        </div>
        <div className="border-4 border-bauhaus-black bg-white p-5">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted">Funding-Desert Places</div>
          <div className="mt-3 text-4xl font-black text-bauhaus-red">{fmt(atlasData.stats.fundingDeserts)}</div>
          <div className="mt-2 text-sm font-bold text-bauhaus-muted">LGAs where need outruns allocation</div>
        </div>
        <div className="border-4 border-bauhaus-black bg-white p-5">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted">People in the Power Graph</div>
          <div className="mt-3 text-4xl font-black text-bauhaus-blue">{fmt(atlasData.stats.peopleMapped)}</div>
          <div className="mt-2 text-sm font-bold text-bauhaus-muted">board, foundation, donation, contract and justice actors</div>
        </div>
        <div className="border-4 border-bauhaus-black bg-white p-5">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted">Board Interlocks</div>
          <div className="mt-3 text-4xl font-black text-bauhaus-black">{fmt(atlasData.stats.boardInterlocks)}</div>
          <div className="mt-2 text-sm font-bold text-bauhaus-muted">repeat people connecting systems together</div>
        </div>
      </section>

      <section className="grid gap-6 min-[1900px]:grid-cols-[minmax(0,1.7fr)_minmax(300px,360px)]">
        <div className="space-y-4">
          <div className="border-4 border-bauhaus-black bg-white">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-bauhaus-black px-5 py-4">
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Place-First Atlas</div>
                <h2 className="text-2xl font-black text-bauhaus-black">Where power and under-allocation collide</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {STATES.map((state) => (
                  <button
                    key={state}
                    onClick={() => setStateFilter(state)}
                    className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                      stateFilter === state
                        ? 'bg-bauhaus-black text-white'
                        : 'border-2 border-bauhaus-black bg-white text-bauhaus-black hover:bg-bauhaus-canvas'
                    }`}
                  >
                    {state}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative h-[520px] bg-bauhaus-canvas lg:h-[620px] 2xl:h-[680px]">
              {selected && (
                <div className="absolute left-4 top-4 z-[500] max-w-md border-4 border-bauhaus-black bg-white p-4 shadow-[8px_8px_0_0_var(--color-bauhaus-black)]">
                  <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Priority place</div>
                  <div className="mt-1 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-2xl font-black text-bauhaus-black">{selected.lga_name}</h3>
                      <p className="text-sm font-bold text-bauhaus-muted">
                        {selected.state} • {selected.remoteness}
                      </p>
                    </div>
                    <div className={`text-right text-3xl font-black ${statTone(selected.desert_score, 100)}`}>
                      {selected.desert_score.toFixed(1)}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {reasons.map((reason) => (
                      <span
                        key={reason}
                        className="border-2 border-bauhaus-black px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-black"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {loadingMap ? (
                <div className="flex h-full items-center justify-center text-sm font-bold text-bauhaus-muted">
                  Loading reallocation atlas...
                </div>
              ) : (
                <MapView features={features} selected={selected} onSelect={setSelected} />
              )}
            </div>

            <div className="grid gap-0 border-t-4 border-bauhaus-black bg-white md:grid-cols-3">
              <div className="border-b-4 border-bauhaus-black p-4 md:border-b-0 md:border-r-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Filtered LGAs</div>
                <div className="mt-2 text-3xl font-black text-bauhaus-black">{fmt(summary?.total_lgas || features.length)}</div>
              </div>
              <div className="border-b-4 border-bauhaus-black p-4 md:border-b-0 md:border-r-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Severe deserts</div>
                <div className="mt-2 text-3xl font-black text-bauhaus-red">{fmt(summary?.severe_deserts || 0)}</div>
              </div>
              <div className="p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Average desert score</div>
                <div className="mt-2 text-3xl font-black text-bauhaus-black">{summary?.avg_desert_score || '0'}</div>
              </div>
            </div>
          </div>

          <div className="border-4 border-bauhaus-black bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red">Pressure Front</div>
                <h3 className="text-xl font-black text-bauhaus-black">Top places that need a different deal</h3>
              </div>
              <div className="text-sm font-bold text-bauhaus-muted">
                Click any place to move the atlas focus
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {topPressurePlaces.map((feature) => {
                const isActive = selected?.lga_name === feature.lga_name && selected?.state === feature.state;
                return (
                  <button
                    key={`${feature.lga_name}-${feature.state}`}
                    onClick={() => setSelected(feature)}
                    className={`border-4 p-4 text-left transition-transform hover:-translate-y-0.5 ${
                      isActive
                        ? 'border-bauhaus-red bg-bauhaus-red text-white'
                        : 'border-bauhaus-black bg-white text-bauhaus-black'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-black uppercase">{feature.lga_name}</div>
                        <div className={`text-xs font-black uppercase tracking-widest ${isActive ? 'text-white/70' : 'text-bauhaus-muted'}`}>
                          {feature.state} • {feature.remoteness}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black">{feature.desert_score.toFixed(1)}</div>
                        <div className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-white/70' : 'text-bauhaus-muted'}`}>
                          score
                        </div>
                      </div>
                    </div>
                    <div className={`mt-3 text-sm font-bold ${isActive ? 'text-white/85' : 'text-bauhaus-muted'}`}>
                      {money(feature.total_funding_all_sources)} recorded • {fmt(feature.community_controlled_entities)} community-controlled
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="space-y-4 min-[1900px]:sticky min-[1900px]:top-24 min-[1900px]:self-start">
          <div className="border-4 border-bauhaus-black bg-white p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Selected place dossier</div>
            {selected ? (
              <div className="mt-3 space-y-4">
                <div>
                  <h3 className="text-2xl font-black text-bauhaus-black">{selected.lga_name}</h3>
                  <p className="text-sm font-bold text-bauhaus-muted">
                    {selected.state} • {selected.remoteness}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="border-2 border-bauhaus-black p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Desert score</div>
                    <div className={`mt-2 text-2xl font-black ${statTone(selected.desert_score, 100)}`}>
                      {selected.desert_score.toFixed(1)}
                    </div>
                  </div>
                  <div className="border-2 border-bauhaus-black p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Recorded funding</div>
                    <div className="mt-2 text-2xl font-black text-bauhaus-black">{money(selected.total_funding_all_sources)}</div>
                  </div>
                  <div className="border-2 border-bauhaus-black p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Indexed entities</div>
                    <div className="mt-2 text-2xl font-black text-bauhaus-black">{fmt(selected.indexed_entities)}</div>
                  </div>
                  <div className="border-2 border-bauhaus-black p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Community-controlled</div>
                    <div className="mt-2 text-2xl font-black text-bauhaus-blue">{fmt(selected.community_controlled_entities)}</div>
                  </div>
                </div>
                <div className="border-2 border-bauhaus-black bg-bauhaus-canvas p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Why this place matters</div>
                  <ul className="mt-3 space-y-2 text-sm font-medium text-bauhaus-black/80">
                    {reasons.map((reason) => (
                      <li key={reason}>• {reason}</li>
                    ))}
                  </ul>
                </div>

                <div className="border-2 border-bauhaus-black p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Place action rail</div>
                  <div className="mt-3 grid gap-3">
                    <Link
                      href={selectedGoodsHref}
                      prefetch={false}
                      className="border-2 border-bauhaus-black p-3 transition-colors hover:bg-bauhaus-canvas"
                    >
                      <div className="font-black text-bauhaus-black">Open Goods workflow for {selected.lga_name}</div>
                      <div className="mt-1 text-sm font-medium text-bauhaus-muted">
                        Jump into buyer, partner, and capital work with this place pre-focused.
                      </div>
                    </Link>
                    <Link
                      href={selectedPowerGraphHref}
                      prefetch={false}
                      className="border-2 border-bauhaus-black p-3 transition-colors hover:bg-bauhaus-canvas"
                    >
                      <div className="font-black text-bauhaus-black">Audit power holders in {selected.state}</div>
                      <div className="mt-1 text-sm font-medium text-bauhaus-muted">
                        Trace the cross-system entities and interlocks shaping this jurisdiction.
                      </div>
                    </Link>
                    <Link
                      href={selectedEntityHref}
                      prefetch={false}
                      className="border-2 border-bauhaus-black p-3 transition-colors hover:bg-bauhaus-canvas"
                    >
                      <div className="font-black text-bauhaus-black">Search entities linked to {selected.lga_name}</div>
                      <div className="mt-1 text-sm font-medium text-bauhaus-muted">
                        Check who is already visible in the entity graph before you route capital or procurement.
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-sm font-bold text-bauhaus-muted">Select a place on the map to open the dossier.</div>
            )}
          </div>

          <div className="border-4 border-bauhaus-black bg-white p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red">Illustrative scenario</div>
            <h3 className="mt-1 text-xl font-black text-bauhaus-black">What if money actually moved?</h3>
            <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
              This is a policy and procurement thought tool, not a forecast. It shows the order of magnitude if a small share of currently tracked flows was deliberately redirected into community-led delivery.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                  <span>Reallocation share</span>
                  <span>{shiftPct}%</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={25}
                  step={1}
                  value={shiftPct}
                  onChange={(event) => setShiftPct(Number(event.target.value))}
                  className="w-full accent-bauhaus-red"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                  <span>Share captured by community-led delivery</span>
                  <span>{communityCapturePct}%</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={100}
                  step={5}
                  value={communityCapturePct}
                  onChange={(event) => setCommunityCapturePct(Number(event.target.value))}
                  className="w-full accent-bauhaus-blue"
                />
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="border-2 border-bauhaus-black bg-bauhaus-black p-4 text-white">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow">National shift</div>
                <div className="mt-2 text-3xl font-black">{money(nationalShift)}</div>
                <div className="mt-1 text-sm font-bold text-white/70">of tracked 2025 flows moved differently</div>
              </div>
              <div className="border-2 border-bauhaus-black p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Community-directed slice</div>
                <div className="mt-2 text-2xl font-black text-bauhaus-blue">{money(communityDirected)}</div>
                <div className="mt-1 text-sm font-bold text-bauhaus-muted">flowing into community-led vehicles instead of incumbents</div>
              </div>
              <div className="border-2 border-bauhaus-black p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Selected-place shift</div>
                <div className="mt-2 text-2xl font-black text-bauhaus-black">{money(localDirected)}</div>
                <div className="mt-1 text-sm font-bold text-bauhaus-muted">
                  {selected ? `${selected.lga_name} at the same settings` : 'Select a place to see local impact'}
                </div>
              </div>
              {selected && localCommunityEntities.length > 0 && (
                <div className="border-2 border-bauhaus-black p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Per local community-controlled organisation</div>
                  <div className="mt-2 text-2xl font-black text-bauhaus-red">{money(perLocalCommunityOrg)}</div>
                  <div className="mt-1 text-sm font-bold text-bauhaus-muted">
                    if directed evenly across currently visible community-controlled organisations
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-4 border-bauhaus-black bg-white p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Local community-controlled stack</div>
            <h3 className="mt-1 text-xl font-black text-bauhaus-black">What already exists on the ground</h3>
            {loadingEntities ? (
              <div className="mt-4 text-sm font-bold text-bauhaus-muted">Loading local entity graph...</div>
            ) : localCommunityEntities.length > 0 ? (
              <div className="mt-4 space-y-3">
                {localCommunityEntities.slice(0, 6).map((entity) => (
                  <div key={entity.gs_id} className="border-2 border-bauhaus-black p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-black text-bauhaus-black">{entity.canonical_name}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                          {entity.entity_type}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-bauhaus-blue">{entity.system_count || 0}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">systems</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 border-2 border-bauhaus-black bg-bauhaus-canvas p-4 text-sm font-medium text-bauhaus-black/80">
                No community-controlled organisations surfaced yet in the current local entity search. That is either a real gap or a signal to enrich local data harder before procurement decisions are made.
              </div>
            )}
          </div>
        </aside>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="border-4 border-bauhaus-black bg-white p-5">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red">Flow bands</div>
          <h3 className="mt-1 text-xl font-black text-bauhaus-black">Where the tracked dollars sit</h3>
          <div className="mt-5 space-y-3">
            {atlasData.flowDomains.map((domain) => (
              <div key={domain.domain}>
                <div className="mb-1 flex items-baseline justify-between gap-4">
                  <div className="font-black uppercase text-bauhaus-black">{domainLabel(domain.domain)}</div>
                  <div className="text-sm font-bold text-bauhaus-muted">
                    {money(domain.total_amount)} • {fmt(domain.flow_count)} flows
                  </div>
                </div>
                <div className="h-4 border-2 border-bauhaus-black bg-bauhaus-canvas">
                  <div
                    className="h-full bg-bauhaus-red"
                    style={{ width: `${Math.max((domain.total_amount / maxFlowAmount) * 100, 6)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-4 border-bauhaus-black bg-white p-5">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Power corridor</div>
          <h3 className="mt-1 text-xl font-black text-bauhaus-black">Who sits across the most systems</h3>
          <div className="mt-5 space-y-3">
            {atlasData.powerHolders.map((holder) => (
              <div key={holder.canonical_name} className="border-2 border-bauhaus-black p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-black text-bauhaus-black">{holder.canonical_name}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                      {holder.entity_type} {holder.state ? `• ${holder.state}` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-bauhaus-red">{holder.power_score}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">power</div>
                  </div>
                </div>
                <div className="mt-3 h-3 border-2 border-bauhaus-black bg-bauhaus-canvas">
                  <div
                    className="h-full bg-bauhaus-blue"
                    style={{ width: `${Math.max((holder.power_score / maxPowerScore) * 100, 10)}%` }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                  <span className="border border-bauhaus-black px-2 py-1">{holder.system_count} systems</span>
                  <span className="border border-bauhaus-black px-2 py-1">{money(holder.procurement_dollars)} procurement</span>
                  <span className="border border-bauhaus-black px-2 py-1">{money(holder.justice_dollars)} justice</span>
                  <span className="border border-bauhaus-black px-2 py-1">{money(holder.donation_dollars)} donations</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-4 border-bauhaus-black bg-white p-5">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red">Procurement choke points</div>
          <h3 className="mt-1 text-xl font-black text-bauhaus-black">Who absorbs the biggest contract volume</h3>
          <div className="mt-5 space-y-3">
            {atlasData.topSuppliers.map((supplier) => (
              <div key={`${supplier.supplier_name}-${supplier.supplier_abn || 'na'}`} className="border-2 border-bauhaus-black p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-black text-bauhaus-black">{supplier.supplier_name}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                      {supplier.buyer_count} public buyers
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-bauhaus-black">{money(supplier.total_value)}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">total</div>
                  </div>
                </div>
                <div className="mt-3 h-3 border-2 border-bauhaus-black bg-bauhaus-canvas">
                  <div
                    className="h-full bg-bauhaus-red"
                    style={{ width: `${Math.max((supplier.total_value / maxSupplierValue) * 100, 10)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="border-4 border-bauhaus-black bg-bauhaus-black p-6 text-white">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow">Why this matters</div>
          <h3 className="mt-2 text-2xl font-black">The atlas is not a dashboard. It is a reallocation argument.</h3>
          <div className="mt-4 space-y-3 text-sm font-medium leading-relaxed text-white/85">
            <p>
              It links four things that usually stay separate: place, money, incumbency, and local alternatives.
              That is the core move if you want to make community-led change fundable instead of ornamental.
            </p>
            <p>
              The real value is not that you can point at underinvestment. It is that you can point at a place,
              name the current choke points, name the existing community-led vehicles, and show the order of
              magnitude if even a thin slice of procurement or philanthropy shifted.
            </p>
          </div>
        </div>

        <div className="border-4 border-bauhaus-black bg-white p-6">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">What to do next</div>
          <div className="mt-4 grid gap-3">
            <Link href={selectedGoodsHref} prefetch={false} className="border-4 border-bauhaus-black p-4 transition-colors hover:bg-bauhaus-canvas">
              <div className="text-lg font-black text-bauhaus-black">Open Goods Workspace</div>
              <div className="mt-1 text-sm font-medium text-bauhaus-muted">
                Turn {selected ? selected.lga_name : 'pressure places'} into buyer, partner, and capital targets.
              </div>
            </Link>
            <Link href="/reports/power-network" prefetch={false} className="border-4 border-bauhaus-black p-4 transition-colors hover:bg-bauhaus-canvas">
              <div className="text-lg font-black text-bauhaus-black">Open Power Network</div>
              <div className="mt-1 text-sm font-medium text-bauhaus-muted">
                Trace the people and interlocks connecting contracts, boards, and funding.
              </div>
            </Link>
            <Link href={selectedPowerGraphHref} prefetch={false} className="border-4 border-bauhaus-black p-4 transition-colors hover:bg-bauhaus-canvas">
              <div className="text-lg font-black text-bauhaus-black">Open Network Graph</div>
              <div className="mt-1 text-sm font-medium text-bauhaus-muted">
                Inspect the live cross-system relationship graph underneath the atlas.
              </div>
            </Link>
          </div>
          <div className="mt-4 text-xs font-black uppercase tracking-widest text-bauhaus-muted">
            Current local community-controlled share: {selected ? percentage(localCommunityEntities.length, Math.max(localEntities.length, 1)) : '0%'}
          </div>
        </div>
      </section>
    </div>
  );
}
