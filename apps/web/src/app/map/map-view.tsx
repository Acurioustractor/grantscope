'use client';

import { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

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

// Bauhaus-inspired color scale: blue (low) → yellow (mid) → red (high)
function desertColor(score: number): string {
  if (score > 200) return '#D02020'; // bauhaus-red
  if (score > 100) return '#E06C18';
  if (score > 50) return '#F0C020'; // bauhaus-yellow
  if (score > 20) return '#4CB876';
  return '#1040C0'; // bauhaus-blue
}

function desertRadius(score: number, entities: number): number {
  // Base radius from desert score, boosted slightly by entity count
  const base = Math.sqrt(Math.max(score, 1)) * 1.2;
  const entityBoost = Math.log2(Math.max(entities, 1) + 1) * 0.5;
  return Math.max(3, Math.min(base + entityBoost, 25));
}

function money(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

export default function MapView({ features, selected, onSelect }: MapViewProps) {
  // Compute bounds from data, default to Australia
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

  return (
    <MapContainer
      center={center}
      zoom={5}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      {features.map((f, i) => {
        const lat = Number(f.lat);
        const lng = Number(f.lng);
        if (isNaN(lat) || isNaN(lng)) return null;

        const score = Number(f.desert_score);
        const isSelected = selected?.lga_name === f.lga_name && selected?.state === f.state;

        return (
          <CircleMarker
            key={`${f.lga_name}-${f.state}-${i}`}
            center={[lat, lng]}
            radius={desertRadius(score, Number(f.indexed_entities))}
            pathOptions={{
              fillColor: desertColor(score),
              fillOpacity: isSelected ? 0.95 : 0.7,
              color: isSelected ? '#121212' : desertColor(score),
              weight: isSelected ? 3 : 1,
              opacity: isSelected ? 1 : 0.8,
            }}
            eventHandlers={{
              click: () => onSelect(f),
            }}
          >
            <Tooltip>
              <div className="text-xs">
                <strong>{f.lga_name}</strong> ({f.state})<br />
                Desert Score: <strong>{score.toFixed(1)}</strong><br />
                Funding: {money(Number(f.total_funding_all_sources))}<br />
                Entities: {f.indexed_entities}
                {Number(f.community_controlled_entities) > 0 && (
                  <> ({f.community_controlled_entities} community-controlled)</>
                )}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
