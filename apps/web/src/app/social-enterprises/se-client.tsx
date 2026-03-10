'use client';

import { useState } from 'react';
import nextDynamic from 'next/dynamic';
import type { SEMapPoint } from './se-map';

const SEMap = nextDynamic(() => import('./se-map').then(m => ({ default: m.SEMap })), {
  ssr: false,
  loading: () => (
    <div className="w-full border-4 border-bauhaus-black flex items-center justify-center" style={{ height: 550 }}>
      <div className="text-bauhaus-muted font-black text-sm uppercase tracking-widest animate-pulse">
        Loading map...
      </div>
    </div>
  ),
});

interface SEClientProps {
  mapData: SEMapPoint[];
  listContent: React.ReactNode;
}

export function SEClient({ mapData, listContent }: SEClientProps) {
  const [view, setView] = useState<'list' | 'map'>('list');

  return (
    <>
      {/* View toggle */}
      <div className="flex gap-0 mb-4">
        <button
          onClick={() => setView('list')}
          className={`px-4 py-2 text-xs font-black uppercase tracking-widest border-4 border-bauhaus-black transition-colors ${
            view === 'list'
              ? 'bg-bauhaus-black text-white'
              : 'bg-white text-bauhaus-black hover:bg-bauhaus-canvas'
          }`}
        >
          List View
        </button>
        <button
          onClick={() => setView('map')}
          className={`px-4 py-2 text-xs font-black uppercase tracking-widest border-4 border-l-0 border-bauhaus-black transition-colors ${
            view === 'map'
              ? 'bg-bauhaus-black text-white'
              : 'bg-white text-bauhaus-black hover:bg-bauhaus-canvas'
          }`}
        >
          Map View
        </button>
      </div>

      {view === 'map' ? (
        <SEMap data={mapData} />
      ) : (
        listContent
      )}
    </>
  );
}
