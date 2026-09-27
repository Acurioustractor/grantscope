'use client';

import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { WaRegionCoverage } from '@/lib/services/wa-transition-report';

const CENTROIDS: Record<string, [number, number]> = {
  Kimberley: [-17.5, 124.5],
  Pilbara: [-22.2, 118.5],
  Gascoyne: [-25.5, 114.5],
  'Mid West': [-28.5, 116.2],
  'Goldfields-Esperance': [-30.4, 121.2],
  Wheatbelt: [-31.5, 117.2],
  'Perth Metropolitan': [-31.95, 115.86],
  Peel: [-32.55, 115.75],
  'South West': [-33.5, 116.1],
  'Great Southern': [-34.6, 117.7],
};

export function RegionMapCanvas({ regions }: { regions: WaRegionCoverage[] }) {
  const maxContracts = Math.max(1, ...regions.map((region) => Number(region.contracts)));
  return (
    <MapContainer center={[-25.4, 121.2]} zoom={5} minZoom={4} className="h-full w-full" scrollWheelZoom>
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {regions.map((region) => {
        const point = CENTROIDS[region.region];
        if (!point) return null;
        const contracts = Number(region.contracts);
        const radius = 8 + 22 * Math.sqrt(contracts / maxContracts);
        return (
          <CircleMarker
            key={region.region}
            center={point}
            radius={radius}
            pathOptions={{ color: '#111111', weight: 3, fillColor: contracts ? '#d71920' : '#1b4fd8', fillOpacity: 0.82 }}
          >
            <Tooltip direction="top">
              <div className="min-w-48 text-xs">
                <div className="font-black uppercase">{region.region}</div>
                <div className="mt-1">{contracts.toLocaleString('en-AU')} current-window contracts</div>
                <div>{Number(region.aer_programs).toLocaleString('en-AU')} AER program signals</div>
                <div className="mt-2 max-w-56 text-[10px] text-bauhaus-muted">Regional evidence coverage only. Not demand, readiness, authority or permission to engage.</div>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
