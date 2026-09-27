'use client';

import dynamic from 'next/dynamic';
import type { WaRegionCoverage } from '@/lib/services/wa-transition-report';

const RegionMapCanvas = dynamic(() => import('./region-map-canvas').then((module) => module.RegionMapCanvas), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-bauhaus-canvas text-xs font-black uppercase tracking-widest">Loading regional evidence</div>,
});

export function RegionMap({ regions }: { regions: WaRegionCoverage[] }) {
  return <RegionMapCanvas regions={regions} />;
}
