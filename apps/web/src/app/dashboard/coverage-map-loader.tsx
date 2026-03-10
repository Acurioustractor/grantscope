'use client';

import dynamic from 'next/dynamic';

interface CoveragePoint {
  postcode: string;
  locality: string;
  remoteness: string;
  entity_count: number;
  lat: number;
  lng: number;
}

const CoverageMap = dynamic(() => import('./coverage-map').then(m => ({ default: m.CoverageMap })), {
  ssr: false,
  loading: () => (
    <div className="w-full border-4 border-bauhaus-black flex items-center justify-center" style={{ height: 500 }}>
      <div className="text-bauhaus-muted font-black text-sm uppercase tracking-widest animate-pulse">
        Loading map...
      </div>
    </div>
  ),
});

export function CoverageMapLoader({ data }: { data: CoveragePoint[] }) {
  return <CoverageMap data={data} />;
}
