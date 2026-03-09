'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const CapitalMap = dynamic(
  () => import('./capital-map').then(m => ({ default: m.CapitalMap })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[600px] bg-bauhaus-canvas border-4 border-bauhaus-black flex items-center justify-center">
        <div className="text-bauhaus-muted font-black text-sm uppercase tracking-widest animate-pulse">
          Loading map...
        </div>
      </div>
    ),
  }
);

const MoneyFlow = dynamic(
  () => import('./money-flow').then(m => ({ default: m.MoneyFlow })),
  {
    ssr: false,
    loading: () => (
      <div className="border-4 border-bauhaus-black p-8 bg-white">
        <div className="text-bauhaus-muted font-black text-sm uppercase tracking-widest animate-pulse text-center">
          Loading flows...
        </div>
      </div>
    ),
  }
);

const NetworkGraph = dynamic(
  () => import('./network-graph').then(m => ({ default: m.NetworkGraph })),
  { ssr: false }
);

const PlaceDetail = dynamic(
  () => import('./place-detail').then(m => ({ default: m.PlaceDetail })),
  { ssr: false }
);

const DATA_SOURCES = [
  { name: 'ACNC Charity Register', records: '359,678', updated: 'Monthly' },
  { name: 'AEC Political Donations', records: '50,000+', updated: 'Annual' },
  { name: 'AusTender Contracts', records: '800,000+', updated: 'Weekly' },
  { name: 'Foundation Programs', records: '866', updated: 'Ongoing' },
  { name: 'ORIC Indigenous Corps', records: '3,000+', updated: 'Quarterly' },
  { name: 'ABS SEIFA 2021', records: '2,300 SA2s', updated: '2021 Census' },
];

interface DataHealth {
  total_entities: number;
  entities_with_postcode: number;
  entities_with_sa2: number;
  sa2_regions_with_data: number;
  sa2_regions_total: number;
  total_relationships: number;
  acnc_records: number;
  foundation_records: number;
  political_donation_records: number;
  postcode_coverage_pct: number;
  sa2_coverage_pct: number;
  map_coverage_pct: number;
  gaps: {
    entities_no_postcode: number;
    entities_postcode_no_sa2: number;
    postcodes_missing_sa2: number;
  };
}

export function PowerPageClient() {
  const [selectedSA2, setSelectedSA2] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [health, setHealth] = useState<DataHealth | null>(null);

  useEffect(() => {
    fetch('/api/power/health').then(r => r.json()).then(d => {
      if (!d.error) setHealth(d);
    }).catch(() => {});
  }, []);

  return (
    <>
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <div className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-2">
          Investigation
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-bauhaus-black leading-tight">
          Where the Money Goes
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium mt-3">
          Mapping Australia&apos;s funding flows — from taxpayers and corporations through foundations
          and government programs to communities. Who benefits, who misses out, and who decides.
        </p>
      </div>

      {/* Community Capital Map — full width */}
      <section className="px-4 sm:px-6 lg:px-8 pb-12">
        <div className="max-w-7xl mx-auto">
          <div className="mb-3">
            <h2 className="text-2xl font-black text-bauhaus-black">Community Capital Map</h2>
            <p className="text-sm text-bauhaus-muted font-medium mt-1">
              SA2-level view of funding distribution, disadvantage, and community control across Australia.
              Click a region to explore.
            </p>
          </div>
          <CapitalMap onSelectSA2={setSelectedSA2} />
        </div>
      </section>

      {/* Follow the Money — Sankey */}
      <section className="px-4 sm:px-6 lg:px-8 pb-12">
        <div className="max-w-7xl mx-auto">
          <div className="mb-3">
            <h2 className="text-2xl font-black text-bauhaus-black">Follow the Money</h2>
            <p className="text-sm text-bauhaus-muted font-medium mt-1">
              Trace funding flows from source to outcome. Hover to highlight connections.
            </p>
          </div>
          <MoneyFlow />
        </div>
      </section>

      {/* Power Network — appears when entity selected */}
      {selectedEntity && (
        <section className="px-4 sm:px-6 lg:px-8 pb-12">
          <div className="max-w-7xl mx-auto">
            <NetworkGraph
              gsId={selectedEntity}
              onClose={() => setSelectedEntity(null)}
            />
          </div>
        </section>
      )}

      {/* Community Voice placeholder */}
      <section className="px-4 sm:px-6 lg:px-8 pb-12">
        <div className="max-w-7xl mx-auto">
          <div className="border-4 border-dashed border-bauhaus-black/20 bg-bauhaus-canvas p-8 text-center">
            <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">Coming Soon</div>
            <h3 className="text-xl font-black text-bauhaus-black mb-2">Community Voice</h3>
            <p className="text-sm text-bauhaus-muted font-medium max-w-lg mx-auto">
              Community priorities and lived experience data — because the numbers only tell half the story.
              Communities own their narratives.
            </p>
          </div>
        </div>
      </section>

      {/* Data Health + Sources */}
      <section className="px-4 sm:px-6 lg:px-8 pb-12">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-xl font-black text-bauhaus-black mb-3">Data Coverage</h2>

          {/* Live health metrics */}
          {health && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <div className="border-2 border-bauhaus-black p-3 text-center">
                <div className="text-lg font-black text-bauhaus-black">{health.total_entities.toLocaleString()}</div>
                <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-wider">Entities</div>
              </div>
              <div className="border-2 border-bauhaus-black p-3 text-center">
                <div className="text-lg font-black text-bauhaus-black">{health.total_relationships.toLocaleString()}</div>
                <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-wider">Relationships</div>
              </div>
              <div className="border-2 border-bauhaus-black p-3 text-center">
                <div className="text-lg font-black" style={{ color: health.map_coverage_pct >= 50 ? '#059669' : '#D02020' }}>
                  {health.sa2_regions_with_data}/{health.sa2_regions_total}
                </div>
                <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-wider">SA2 Regions ({health.map_coverage_pct}%)</div>
              </div>
              <div className="border-2 border-bauhaus-black p-3 text-center">
                <div className="text-lg font-black" style={{ color: health.sa2_coverage_pct >= 60 ? '#059669' : '#E8961C' }}>
                  {health.sa2_coverage_pct}%
                </div>
                <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-wider">Entity Geocoverage</div>
              </div>
            </div>
          )}

          {/* Coverage gaps */}
          {health && health.gaps.entities_no_postcode > 0 && (
            <div className="border-2 border-bauhaus-black/20 bg-bauhaus-canvas p-3 mb-4">
              <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">Data Gaps</div>
              <div className="flex flex-wrap gap-3 text-xs font-medium text-bauhaus-muted">
                <span>{health.gaps.entities_no_postcode.toLocaleString()} entities without postcode</span>
                <span className="text-bauhaus-black/20">|</span>
                <span>{health.gaps.entities_postcode_no_sa2.toLocaleString()} postcodes unmapped to SA2</span>
                <span className="text-bauhaus-black/20">|</span>
                <span>{health.gaps.postcodes_missing_sa2.toLocaleString()} postcodes without SA2 code</span>
              </div>
            </div>
          )}

          {/* Data sources table */}
          <div className="border-4 border-bauhaus-black bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest">Source</th>
                  <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest">Records</th>
                  <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest">Updated</th>
                </tr>
              </thead>
              <tbody>
                {DATA_SOURCES.map((ds, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                    <td className="px-4 py-2 font-bold text-bauhaus-black">{ds.name}</td>
                    <td className="px-4 py-2 text-bauhaus-muted font-medium">{ds.records}</td>
                    <td className="px-4 py-2 text-bauhaus-muted font-medium">{ds.updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Place detail panel */}
      <PlaceDetail
        sa2Code={selectedSA2}
        onClose={() => setSelectedSA2(null)}
        onSelectEntity={(gsId) => {
          setSelectedEntity(gsId);
          setSelectedSA2(null);
        }}
      />
    </>
  );
}
