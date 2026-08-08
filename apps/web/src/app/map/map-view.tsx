'use client';

import { useMemo, useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import type { FeatureCollection, Feature, Geometry } from 'geojson';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { money } from '@/lib/format';

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
  // Null when the council has no point coordinates; it still renders where a
  // boundary matches its name. Number(null) is 0, not NaN — filter nulls
  // before coercing or a coordless council drags bounds to the equator.
  lat: number | null;
  lng: number | null;
  lga_code: string;
}

type MapMetric = 'desert_score' | 'unplaced_share';

interface MapViewProps {
  features: LgaFeature[];
  selected: LgaFeature | null;
  onSelect: (f: LgaFeature) => void;
  metric?: MapMetric;
}

const STATE_ABBREV: Record<string, string> = {
  'New South Wales': 'NSW',
  'Victoria': 'VIC',
  'Queensland': 'QLD',
  'South Australia': 'SA',
  'Western Australia': 'WA',
  'Tasmania': 'TAS',
  'Northern Territory': 'NT',
  'Australian Capital Territory': 'ACT',
  'Other Territories': 'OT',
};

// Bauhaus-inspired color scale: blue (low) → green → yellow → orange → red (high)
function desertColor(score: number): string {
  if (score > 200) return '#D02020';
  if (score > 100) return '#E06C18';
  if (score > 50) return '#F0C020';
  if (score > 20) return '#4CB876';
  return '#1040C0';
}

function desertOpacity(score: number): number {
  if (score > 200) return 0.7;
  if (score > 100) return 0.6;
  if (score > 50) return 0.5;
  if (score > 20) return 0.4;
  return 0.3;
}

// Share of organisations in a council's postcodes we cannot place, 0–100
function shareColor(pct: number): string {
  if (pct >= 75) return '#D02020';
  if (pct >= 50) return '#E06C18';
  if (pct >= 25) return '#F0C020';
  if (pct >= 10) return '#4CB876';
  return '#1040C0';
}

function shareOpacity(pct: number): number {
  if (pct >= 75) return 0.7;
  if (pct >= 50) return 0.6;
  if (pct >= 25) return 0.5;
  if (pct >= 10) return 0.4;
  return 0.3;
}

function metricValue(f: LgaFeature, metric: MapMetric): number | null {
  const v = metric === 'desert_score' ? f.desert_score : f.unplaced_share;
  return v === null || v === undefined ? null : Number(v);
}

function metricColor(value: number, metric: MapMetric): string {
  return metric === 'desert_score' ? desertColor(value) : shareColor(value);
}

function metricOpacity(value: number, metric: MapMetric): number {
  return metric === 'desert_score' ? desertOpacity(value) : shareOpacity(value);
}

function tooltipHtml(data: LgaFeature): string {
  const desert = data.desert_score === null
    ? '—'
    : `<strong>${Number(data.desert_score).toFixed(1)}</strong>`;
  const funding = data.total_funding_all_sources === null
    ? ''
    : `Funding: ${money(Number(data.total_funding_all_sources))}<br/>`;
  const entities = data.indexed_entities === null
    ? ''
    : `Entities: ${data.indexed_entities}${Number(data.community_controlled_entities) > 0 ? ` (${data.community_controlled_entities} CC)` : ''}<br/>`;
  const share = data.unplaced_share === null ? '' : ` (${Number(data.unplaced_share).toFixed(0)}%)`;
  return `<div class="text-xs">
    <strong>${data.lga_name}</strong> (${data.state})<br/>
    Desert Score: ${desert}<br/>
    ${funding}${entities}Cannot place: <strong>${data.unplaced_count}</strong>${share}
  </div>`;
}

// Fit bounds when data changes
function FitBounds({ features }: { features: LgaFeature[] }) {
  const map = useMap();
  useEffect(() => {
    if (features.length === 0) return;
    const located = features.filter(f => f.lat != null && f.lng != null);
    const lats = located.map(f => Number(f.lat)).filter(v => !isNaN(v));
    const lngs = located.map(f => Number(f.lng)).filter(v => !isNaN(v));
    if (lats.length === 0) return;
    const bounds = L.latLngBounds(
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)]
    );
    map.fitBounds(bounds, { padding: [20, 20] });
  }, [features, map]);
  return null;
}

export default function MapView({ features, selected, onSelect, metric = 'desert_score' }: MapViewProps) {
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);
  const [geoLoading, setGeoLoading] = useState(true);

  // Load GeoJSON boundaries
  useEffect(() => {
    fetch('/data/lga-boundaries.geojson')
      .then(r => r.json())
      .then((data: FeatureCollection) => {
        setGeoData(data);
        setGeoLoading(false);
      })
      .catch(() => setGeoLoading(false));
  }, []);

  // Build lookup from lga_name+state → desert data
  const desertLookup = useMemo(() => {
    const map = new Map<string, LgaFeature>();
    for (const f of features) {
      map.set(`${f.lga_name}|${f.state}`, f);
      // Also index by just lga_name for fuzzy matching
      if (!map.has(f.lga_name)) {
        map.set(f.lga_name, f);
      }
    }
    return map;
  }, [features]);

  // Style function for GeoJSON polygons
  const style = useMemo(() => {
    return (feature: Feature<Geometry, { lga_name: string; state: string }> | undefined) => {
      if (!feature?.properties) return { fillColor: '#ccc', fillOpacity: 0.1, weight: 0.5, color: '#999' };
      const { lga_name, state } = feature.properties;
      const stateAbbrev = STATE_ABBREV[state] || state;
      const data = desertLookup.get(`${lga_name}|${stateAbbrev}`) || desertLookup.get(lga_name);
      const isSelected = selected?.lga_name === data?.lga_name && selected?.state === data?.state;

      const value = data ? metricValue(data, metric) : null;

      if (!data || value === null) {
        return {
          fillColor: '#e5e7eb',
          fillOpacity: 0.15,
          weight: 0.3,
          color: '#d1d5db',
          opacity: 0.5,
        };
      }

      return {
        fillColor: metricColor(value, metric),
        fillOpacity: isSelected ? 0.85 : metricOpacity(value, metric),
        weight: isSelected ? 3 : 0.8,
        color: isSelected ? '#121212' : '#666',
        opacity: isSelected ? 1 : 0.4,
      };
    };
  }, [desertLookup, selected, metric]);

  // Click handler for GeoJSON features
  const onEachFeature = useMemo(() => {
    return (feature: Feature<Geometry, { lga_name: string; state: string }>, layer: L.Layer) => {
      const { lga_name, state } = feature.properties;
      const stateAbbrev = STATE_ABBREV[state] || state;
      const data = desertLookup.get(`${lga_name}|${stateAbbrev}`) || desertLookup.get(lga_name);

      if (data) {
        (layer as L.Path).bindTooltip(tooltipHtml(data), { sticky: true });
        layer.on('click', () => onSelect(data));
      } else {
        (layer as L.Path).bindTooltip(
          `<div class="text-xs"><strong>${lga_name}</strong> (${stateAbbrev})<br/>No data held</div>`,
          { sticky: true }
        );
      }
    };
  }, [desertLookup, onSelect]);

  // Compute center from features
  const center = useMemo<[number, number]>(() => {
    if (features.length === 0) return [-25.5, 134.0];
    const located = features.filter(f => f.lat != null && f.lng != null);
    const lats = located.map(f => Number(f.lat)).filter(v => !isNaN(v));
    const lngs = located.map(f => Number(f.lng)).filter(v => !isNaN(v));
    if (lats.length === 0) return [-25.5, 134.0];
    return [
      (Math.min(...lats) + Math.max(...lats)) / 2,
      (Math.min(...lngs) + Math.max(...lngs)) / 2,
    ];
  }, [features]);

  // Key to force GeoJSON re-render when style changes
  const geoKey = useMemo(
    () => `${selected?.lga_name}-${selected?.state}-${features.length}-${metric}`,
    [selected, features, metric]
  );

  return (
    <MapContainer
      center={center}
      zoom={5}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
      />

      {/* GeoJSON choropleth layer */}
      {geoData && !geoLoading && (
        <GeoJSON
          key={geoKey}
          data={geoData}
          style={style}
          onEachFeature={onEachFeature}
        />
      )}

      {/* Labels tile layer on top of polygons */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
        pane="tooltipPane"
      />

      {/* Fallback: CircleMarkers when no GeoJSON loaded */}
      {features.filter(() => !geoData).map((f, i) => {
        if (f.lat == null || f.lng == null) return null;
        const lat = Number(f.lat);
        const lng = Number(f.lng);
        if (isNaN(lat) || isNaN(lng)) return null;
        const value = metricValue(f, metric);
        if (value === null) return null;
        return (
          <CircleMarker
            key={`circle-${f.lga_name}-${f.state}-${i}`}
            center={[lat, lng]}
            radius={Math.max(3, Math.min(Math.sqrt(value) * 1.2, 20))}
            pathOptions={{
              fillColor: metricColor(value, metric),
              fillOpacity: 0.7,
              color: metricColor(value, metric),
              weight: 1,
            }}
            eventHandlers={{ click: () => onSelect(f) }}
          >
            <Tooltip>
              <div className="text-xs">
                <strong>{f.lga_name}</strong> ({f.state})<br />
                {metric === 'desert_score' ? 'Desert Score' : 'Unplaced share'}: <strong>{value.toFixed(1)}{metric === 'unplaced_share' ? '%' : ''}</strong>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}

      <FitBounds features={features} />
    </MapContainer>
  );
}
