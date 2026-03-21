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
}

interface MapViewProps {
  features: LgaFeature[];
  selected: LgaFeature | null;
  onSelect: (f: LgaFeature) => void;
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

// Fit bounds when data changes
function FitBounds({ features }: { features: LgaFeature[] }) {
  const map = useMap();
  useEffect(() => {
    if (features.length === 0) return;
    const lats = features.map(f => Number(f.lat)).filter(v => !isNaN(v));
    const lngs = features.map(f => Number(f.lng)).filter(v => !isNaN(v));
    if (lats.length === 0) return;
    const bounds = L.latLngBounds(
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)]
    );
    map.fitBounds(bounds, { padding: [20, 20] });
  }, [features, map]);
  return null;
}

export default function MapView({ features, selected, onSelect }: MapViewProps) {
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

      if (!data) {
        return {
          fillColor: '#e5e7eb',
          fillOpacity: 0.15,
          weight: 0.3,
          color: '#d1d5db',
          opacity: 0.5,
        };
      }

      const score = Number(data.desert_score);
      return {
        fillColor: desertColor(score),
        fillOpacity: isSelected ? 0.85 : desertOpacity(score),
        weight: isSelected ? 3 : 0.8,
        color: isSelected ? '#121212' : '#666',
        opacity: isSelected ? 1 : 0.4,
      };
    };
  }, [desertLookup, selected]);

  // Click handler for GeoJSON features
  const onEachFeature = useMemo(() => {
    return (feature: Feature<Geometry, { lga_name: string; state: string }>, layer: L.Layer) => {
      const { lga_name, state } = feature.properties;
      const stateAbbrev = STATE_ABBREV[state] || state;
      const data = desertLookup.get(`${lga_name}|${stateAbbrev}`) || desertLookup.get(lga_name);

      if (data) {
        (layer as L.Path).bindTooltip(
          `<div class="text-xs">
            <strong>${data.lga_name}</strong> (${data.state})<br/>
            Desert Score: <strong>${Number(data.desert_score).toFixed(1)}</strong><br/>
            Funding: ${money(Number(data.total_funding_all_sources))}<br/>
            Entities: ${data.indexed_entities}
            ${Number(data.community_controlled_entities) > 0 ? ` (${data.community_controlled_entities} CC)` : ''}
          </div>`,
          { sticky: true }
        );
        layer.on('click', () => onSelect(data));
      } else {
        (layer as L.Path).bindTooltip(
          `<div class="text-xs"><strong>${lga_name}</strong> (${stateAbbrev})<br/>No funding data</div>`,
          { sticky: true }
        );
      }
    };
  }, [desertLookup, onSelect]);

  // Compute center from features
  const center = useMemo<[number, number]>(() => {
    if (features.length === 0) return [-25.5, 134.0];
    const lats = features.map(f => Number(f.lat)).filter(v => !isNaN(v));
    const lngs = features.map(f => Number(f.lng)).filter(v => !isNaN(v));
    if (lats.length === 0) return [-25.5, 134.0];
    return [
      (Math.min(...lats) + Math.max(...lats)) / 2,
      (Math.min(...lngs) + Math.max(...lngs)) / 2,
    ];
  }, [features]);

  // Key to force GeoJSON re-render when style changes
  const geoKey = useMemo(() => `${selected?.lga_name}-${selected?.state}-${features.length}`, [selected, features]);

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

      {/* Fallback: CircleMarkers for LGAs not matched to boundaries */}
      {features.filter(f => {
        if (!geoData) return true;
        // Show circles only if no GeoJSON loaded
        return !geoData;
      }).map((f, i) => {
        const lat = Number(f.lat);
        const lng = Number(f.lng);
        if (isNaN(lat) || isNaN(lng)) return null;
        const score = Number(f.desert_score);
        return (
          <CircleMarker
            key={`circle-${f.lga_name}-${f.state}-${i}`}
            center={[lat, lng]}
            radius={Math.max(3, Math.min(Math.sqrt(score) * 1.2, 20))}
            pathOptions={{
              fillColor: desertColor(score),
              fillOpacity: 0.7,
              color: desertColor(score),
              weight: 1,
            }}
            eventHandlers={{ click: () => onSelect(f) }}
          >
            <Tooltip>
              <div className="text-xs">
                <strong>{f.lga_name}</strong> ({f.state})<br />
                Desert Score: <strong>{score.toFixed(1)}</strong>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}

      <FitBounds features={features} />
    </MapContainer>
  );
}
