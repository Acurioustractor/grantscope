'use client';

import { CircleMarker, Tooltip } from 'react-leaflet';
import { AustraliaMap } from '@/app/components/australia-map';
import { MapLegend } from '@/app/components/map-legend';

interface CoveragePoint {
  postcode: string;
  locality: string;
  remoteness: string;
  entity_count: number;
  lat: number;
  lng: number;
}

function remotenessColor(remoteness: string): string {
  if (remoteness.includes('Very Remote')) return '#D02020';
  if (remoteness.includes('Remote')) return '#EA580C';
  if (remoteness.includes('Outer')) return '#F0C020';
  if (remoteness.includes('Inner')) return '#059669';
  return '#1040C0'; // Major Cities
}

function markerRadius(count: number): number {
  return Math.max(4, Math.sqrt(count) * 2.5);
}

const LEGEND_ITEMS = [
  { color: '#1040C0', label: 'Major Cities' },
  { color: '#059669', label: 'Inner Regional' },
  { color: '#F0C020', label: 'Outer Regional' },
  { color: '#EA580C', label: 'Remote' },
  { color: '#D02020', label: 'Very Remote' },
];

interface CoverageMapProps {
  data: CoveragePoint[];
}

export function CoverageMap({ data }: CoverageMapProps) {
  return (
    <div className="relative">
      <AustraliaMap height={500}>
        {data.map((p, i) => (
          <CircleMarker
            key={`${p.postcode}-${i}`}
            center={[p.lat, p.lng]}
            radius={markerRadius(p.entity_count)}
            pathOptions={{
              color: remotenessColor(p.remoteness),
              fillColor: remotenessColor(p.remoteness),
              fillOpacity: 0.6,
              weight: 1,
            }}
          >
            <Tooltip>
              <div className="text-xs">
                <div className="font-black">{p.locality || p.postcode} ({p.postcode})</div>
                <div>{p.entity_count} entities</div>
                <div>{p.remoteness || 'Unknown'}</div>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
      </AustraliaMap>
      <MapLegend title="Remoteness" items={LEGEND_ITEMS} />
    </div>
  );
}
