'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import type { Layer, LeafletMouseEvent, PathOptions } from 'leaflet';
import type { Feature, GeoJsonObject } from 'geojson';
import 'leaflet/dist/leaflet.css';

interface SA2Data {
  sa2_code: string;
  sa2_name: string;
  total_funding: number;
  entity_count: number;
  community_controlled_count: number;
  community_controlled_pct: number;
  external_provider_pct: number;
  need_gap: number;
  seifa_decile: number | null;
}

type MetricKey = 'total_funding' | 'community_controlled_pct' | 'external_provider_pct' | 'need_gap' | 'seifa_decile' | 'entity_count';

const METRICS: { key: MetricKey; label: string; format: (v: number) => string }[] = [
  { key: 'total_funding', label: 'Total Funding', format: formatDollars },
  { key: 'entity_count', label: 'Entities', format: (v) => v.toLocaleString() },
  { key: 'community_controlled_pct', label: 'Local Control', format: (v) => `${v}%` },
  { key: 'external_provider_pct', label: 'External Providers', format: (v) => `${v}%` },
  { key: 'need_gap', label: 'Need Gap', format: (v) => `${v}/100` },
  { key: 'seifa_decile', label: 'Disadvantage', format: (v) => `Decile ${v}` },
];

// Bauhaus-inspired diverging scale
const COLOR_SCALE = [
  '#1040C0', // bauhaus-blue (low)
  '#2E7D9B',
  '#4CB876',
  '#8BC34A',
  '#F0C020', // bauhaus-yellow (mid)
  '#E8961C',
  '#E06C18',
  '#D84315',
  '#D02020', // bauhaus-red (high)
];

function formatDollars(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function getColor(value: number, _min: number, _max: number, breaks: number[]): string {
  for (let i = breaks.length - 1; i >= 0; i--) {
    if (value >= breaks[i]) return COLOR_SCALE[Math.min(i, COLOR_SCALE.length - 1)];
  }
  return COLOR_SCALE[0];
}

function computeBreaks(values: number[]): number[] {
  if (values.length === 0) return [0];
  const sorted = [...values].sort((a, b) => a - b);
  // Quantile breaks — divide data into equal-sized bins
  return COLOR_SCALE.map((_, i) => {
    const idx = Math.floor((i / COLOR_SCALE.length) * sorted.length);
    return sorted[Math.min(idx, sorted.length - 1)];
  });
}

interface CapitalMapProps {
  onSelectSA2: (sa2Code: string) => void;
}

export function CapitalMap({ onSelectSA2 }: CapitalMapProps) {
  const [geoData, setGeoData] = useState<GeoJsonObject | null>(null);
  const [mapData, setMapData] = useState<SA2Data[]>([]);
  const [metric, setMetric] = useState<MetricKey>('entity_count');
  const [loading, setLoading] = useState(true);
  const [hoveredSA2, setHoveredSA2] = useState<SA2Data | null>(null);
  const geoJsonRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/geo/sa2-2021.json').then(r => r.json()),
      fetch('/api/power/map-data').then(r => r.json()),
    ]).then(([geo, data]) => {
      // Add unique IDs to features to prevent duplicate key warnings
      if (geo?.features) {
        geo.features.forEach((f: any, i: number) => {
          if (f.properties) f.properties._uid = i;
        });
      }
      setGeoData(geo);
      setMapData(data.features || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const dataLookup = useMemo(() => {
    const map = new Map<string, SA2Data>();
    for (const d of mapData) map.set(d.sa2_code, d);
    return map;
  }, [mapData]);

  // Metrics where 0 is a meaningful value (not "no data")
  const zeroIsMeaningful = metric === 'need_gap' || metric === 'seifa_decile'
    || metric === 'external_provider_pct' || metric === 'community_controlled_pct';

  const { min, max, breaks } = useMemo(() => {
    const values = mapData.map(d => {
      const v = d[metric];
      return typeof v === 'number' ? v : 0;
    }).filter(v => zeroIsMeaningful ? v >= 0 : v > 0);
    return {
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 1,
      breaks: computeBreaks(values),
    };
  }, [mapData, metric, zeroIsMeaningful]);

  const currentMetric = METRICS.find(m => m.key === metric)!;

  const style = useCallback((feature: Feature | undefined): PathOptions => {
    const code = feature?.properties?.SA2_CODE21;
    const data = code ? dataLookup.get(code) : null;
    const value = data ? (data[metric] as number | null) : null;
    const hasData = data != null;

    let fillColor = '#f5f5f5'; // no data at all
    if (hasData && value != null && (value > 0 || zeroIsMeaningful)) {
      fillColor = getColor(value, min, max, breaks);
    } else if (hasData) {
      fillColor = '#ddd'; // has entity data but zero for this metric
    }

    return {
      fillColor,
      weight: hasData ? 0.8 : 0.3,
      opacity: hasData ? 0.8 : 0.4,
      color: hasData ? '#333' : '#bbb',
      fillOpacity: hasData ? 0.75 : 0.3,
    };
  }, [dataLookup, metric, min, max, breaks, zeroIsMeaningful]);

  const onEachFeature = useCallback((feature: Feature, layer: Layer) => {
    layer.on({
      mouseover: (e: LeafletMouseEvent) => {
        const code = feature.properties?.SA2_CODE21;
        const data = code ? dataLookup.get(code) : null;
        if (data) setHoveredSA2(data);
        const target = e.target;
        target.setStyle({ weight: 2, color: '#121212', fillOpacity: 0.9 });
        target.bringToFront();
      },
      mouseout: (e: LeafletMouseEvent) => {
        setHoveredSA2(null);
        const target = e.target;
        if (geoJsonRef.current) geoJsonRef.current.resetStyle(target);
      },
      click: () => {
        const code = feature.properties?.SA2_CODE21;
        if (code) onSelectSA2(code);
      },
    });
  }, [dataLookup, onSelectSA2]);

  if (loading) {
    return (
      <div className="w-full h-[600px] bg-bauhaus-canvas border-4 border-bauhaus-black flex items-center justify-center">
        <div className="text-bauhaus-muted font-black text-sm uppercase tracking-widest animate-pulse">
          Loading map data...
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Metric toggle */}
      <div className="flex flex-wrap gap-1 mb-3">
        {METRICS.map(m => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`px-3 py-1.5 text-xs font-black uppercase tracking-widest border-2 transition-colors ${
              metric === m.key
                ? 'bg-bauhaus-black text-white border-bauhaus-black'
                : 'bg-white text-bauhaus-black border-bauhaus-black/20 hover:border-bauhaus-black'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Map */}
      <div className="border-4 border-bauhaus-black relative" style={{ height: '600px' }}>
        <MapContainer
          center={[-28, 134]}
          zoom={4}
          style={{ height: '100%', width: '100%', background: '#F0F0F0' }}
          scrollWheelZoom={true}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
          />
          {geoData && (
            <GeoJSON
              ref={(ref) => { geoJsonRef.current = ref; }}
              key={metric}
              data={geoData}
              style={style}
              onEachFeature={onEachFeature}
            />
          )}
        </MapContainer>

        {/* Hover tooltip */}
        {hoveredSA2 && (
          <div className="absolute top-4 right-4 bg-white border-3 border-bauhaus-black p-3 shadow-[4px_4px_0_0_#121212] z-[1000] max-w-xs">
            <div className="font-black text-sm text-bauhaus-black">{hoveredSA2.sa2_name}</div>
            <div className="text-xs text-bauhaus-muted font-bold mt-1">
              {currentMetric.label}: {currentMetric.format((hoveredSA2[metric] as number) ?? 0)}
            </div>
            <div className="text-xs text-bauhaus-muted mt-0.5">
              {hoveredSA2.entity_count} entities &middot; {hoveredSA2.community_controlled_pct}% local
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white border-2 border-bauhaus-black p-2 z-[1000]">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">
            {currentMetric.label}
          </div>
          <div className="flex items-center gap-0">
            {COLOR_SCALE.map((color, i) => (
              <div key={i} className="w-5 h-3" style={{ backgroundColor: color }} />
            ))}
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[9px] font-bold text-bauhaus-muted">{currentMetric.format(min)}</span>
            <span className="text-[9px] font-bold text-bauhaus-muted">{currentMetric.format(max)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
