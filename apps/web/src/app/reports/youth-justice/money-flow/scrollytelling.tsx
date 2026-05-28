'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useYJSummary, fmtMoney, LANE_COLOR, type Lane } from '@/lib/hooks/use-yj-summary';
import { HeroScene } from './scenes/hero';
import { TanksScene } from './scenes/tanks';
import { DrainScene } from './scenes/drain';
import { CityscapeScene } from './scenes/cityscape';
import { ClosingScene } from './scenes/closing';

export function MoneyFlowScrollytelling() {
  const { data, loading, error } = useYJSummary({ topN: 600 });
  const [scrollHint, setScrollHint] = useState(true);

  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 100) setScrollHint(false);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-bauhaus-black text-white flex items-center justify-center font-mono text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-bauhaus-yellow mb-2">CivicGraph</div>
          Loading 17 years of justice spending…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 bg-bauhaus-black text-white flex items-center justify-center font-mono text-sm">
        Error: {error || 'no data'}
      </div>
    );
  }

  return (
    <div className="bg-bauhaus-black text-white font-mono">
      {/* Hide global nav on this immersive page */}
      <style>{`
        nav, .nav-bar, [data-nav] { display: none !important; }
        main { padding: 0 !important; margin: 0 !important; }
        body { background: #0a0a0a; overflow-x: hidden; }
      `}</style>

      {/* Top brand bar — minimal, fixed */}
      <div className="fixed top-0 left-0 right-0 z-50 px-6 py-3 flex items-center justify-between bg-gradient-to-b from-black/90 to-transparent pointer-events-none">
        <Link href="/reports/youth-justice" className="text-[10px] font-mono uppercase tracking-widest text-bauhaus-yellow hover:underline pointer-events-auto">
          ← Youth Justice Report
        </Link>
        <div className="text-[10px] font-mono uppercase tracking-widest text-white/50">
          CivicGraph
        </div>
      </div>

      {/* Scroll hint (vanishes after first scroll) */}
      {scrollHint && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 text-[10px] font-mono uppercase tracking-widest text-white/40 animate-pulse pointer-events-none">
          ↓ Scroll to follow the money
        </div>
      )}

      <HeroScene data={data} />
      <TanksScene data={data} />
      <DrainScene data={data} />
      <CityscapeScene data={data} />
      <ClosingScene data={data} />
    </div>
  );
}

export type { Lane };
export { fmtMoney, LANE_COLOR };
