'use client';

import { useEffect, useState } from 'react';
import { CircleMarker, Tooltip } from 'react-leaflet';
import { useRouter } from 'next/navigation';
import { AustraliaMap } from '@/app/components/australia-map';
import { MapLegend } from '@/app/components/map-legend';

interface GapPostcode {
  postcode: string;
  state: string;
  remoteness: string;
  seifa_irsd_decile: number;
  entity_count: number;
  gap_score: number;
  lat: number | null;
  lng: number | null;
  locality: string | null;
}

function gapColor(score: number): string {
  if (score >= 70) return '#D02020';
  if (score >= 50) return '#EA580C';
  if (score >= 30) return '#F0C020';
  return '#059669';
}

function markerRadius(count: number): number {
  return Math.max(4, Math.sqrt(count) * 2.5);
}

const LEGEND_ITEMS = [
  { color: '#D02020', label: 'Critical (70+)' },
  { color: '#EA580C', label: 'High (50-69)' },
  { color: '#F0C020', label: 'Moderate (30-49)' },
  { color: '#059669', label: 'Low (<30)' },
];

export function FundingGapMap() {
  const [data, setData] = useState<GapPostcode[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/places/gaps?limit=500')
      .then(r => r.json())
      .then(res => {
        setData((res.postcodes || []).filter((p: GapPostcode) => p.lat != null && p.lng != null));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="w-full border-4 border-bauhaus-black flex items-center justify-center" style={{ height: 550 }}>
        <div className="text-bauhaus-muted font-black text-sm uppercase tracking-widest animate-pulse">
          Loading gap data...
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <AustraliaMap height={550}>
        {data.map((p) => (
          <CircleMarker
            key={p.postcode}
            center={[p.lat!, p.lng!]}
            radius={markerRadius(p.entity_count)}
            pathOptions={{
              color: gapColor(p.gap_score),
              fillColor: gapColor(p.gap_score),
              fillOpacity: 0.7,
              weight: 1,
            }}
            eventHandlers={{
              click: () => router.push(`/places/${p.postcode}`),
            }}
          >
            <Tooltip>
              <div className="text-xs">
                <div className="font-black">{p.locality || p.postcode} ({p.postcode})</div>
                <div>Gap Score: <strong>{p.gap_score}</strong></div>
                <div>SEIFA Decile: {p.seifa_irsd_decile}</div>
                <div>Remoteness: {p.remoteness || 'Unknown'}</div>
                <div>{p.entity_count} entities</div>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
      </AustraliaMap>
      <MapLegend title="Gap Score" items={LEGEND_ITEMS} />
    </div>
  );
}
