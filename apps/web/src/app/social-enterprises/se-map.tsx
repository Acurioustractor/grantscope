'use client';

import { CircleMarker, Popup } from 'react-leaflet';
import { AustraliaMap } from '@/app/components/australia-map';
import { MapLegend } from '@/app/components/map-legend';

export interface SEMapPoint {
  postcode: string;
  locality: string;
  lat: number;
  lng: number;
  count: number;
  dominant_type: string;
  enterprises: { id: string; name: string; org_type: string }[];
}

function orgTypeColor(type: string): string {
  switch (type) {
    case 'indigenous_business': return '#D02020';
    case 'social_enterprise': return '#1040C0';
    case 'b_corp': return '#059669';
    case 'disability_enterprise': return '#F0C020';
    case 'cooperative': return '#777777';
    default: return '#1040C0';
  }
}

function markerRadius(count: number): number {
  return Math.max(4, Math.sqrt(count) * 2.5);
}

const LEGEND_ITEMS = [
  { color: '#D02020', label: 'Indigenous Business' },
  { color: '#1040C0', label: 'Social Enterprise' },
  { color: '#059669', label: 'B Corp' },
  { color: '#F0C020', label: 'Disability Enterprise' },
  { color: '#777777', label: 'Cooperative' },
];

interface SEMapProps {
  data: SEMapPoint[];
}

export function SEMap({ data }: SEMapProps) {
  return (
    <div className="relative">
      <AustraliaMap height={550}>
        {data.map((p) => (
          <CircleMarker
            key={p.postcode}
            center={[p.lat, p.lng]}
            radius={markerRadius(p.count)}
            pathOptions={{
              color: orgTypeColor(p.dominant_type),
              fillColor: orgTypeColor(p.dominant_type),
              fillOpacity: 0.7,
              weight: 1,
            }}
          >
            <Popup>
              <div className="text-xs max-w-[200px]">
                <div className="font-black text-sm mb-1">{p.locality || p.postcode} ({p.postcode})</div>
                <div className="text-gray-500 mb-2">{p.count} enterprise{p.count !== 1 ? 's' : ''}</div>
                <div className="space-y-1 max-h-[150px] overflow-y-auto">
                  {p.enterprises.slice(0, 10).map((e) => (
                    <a
                      key={e.id}
                      href={`/social-enterprises/${e.id}`}
                      className="block text-blue-600 hover:underline leading-tight"
                    >
                      {e.name}
                    </a>
                  ))}
                  {p.enterprises.length > 10 && (
                    <div className="text-gray-400">+{p.enterprises.length - 10} more</div>
                  )}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </AustraliaMap>
      <MapLegend title="Enterprise Type" items={LEGEND_ITEMS} />
    </div>
  );
}
