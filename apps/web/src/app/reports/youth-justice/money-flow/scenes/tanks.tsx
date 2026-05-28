'use client';

import { fmtMoney, LANE_COLOR, type YJSummary } from '@/lib/hooks/use-yj-summary';
import { useScrollProgress } from '../hooks';
import { useMemo } from 'react';

export function TanksScene({ data }: { data: YJSummary }) {
  const { ref, progress } = useScrollProgress<HTMLDivElement>();

  // Build cumulative trajectories for reactive vs prevention by year
  const { years, reactiveCum, preventionCum } = useMemo(() => {
    const yMin = data.meta.year_range.min;
    const yMax = data.meta.year_range.max;
    const years: number[] = [];
    const reactiveCum: number[] = [];
    const preventionCum: number[] = [];
    let r = 0;
    let p = 0;
    for (let y = yMin; y <= yMax; y++) {
      const rRow = data.by_year_lane.find(d => d.year === y && d.lane === 'reactive');
      const pRow = data.by_year_lane.find(d => d.year === y && d.lane === 'prevention');
      if (rRow) r += rRow.total;
      if (pRow) p += pRow.total;
      years.push(y);
      reactiveCum.push(r);
      preventionCum.push(p);
    }
    return { years, reactiveCum, preventionCum };
  }, [data]);

  // Map scroll progress to year index. We give the user a "settling" period at the start.
  const start = 0.05;
  const end = 0.85;
  const t = Math.max(0, Math.min(1, (progress - start) / (end - start)));
  const yearIdx = Math.min(years.length - 1, Math.floor(t * years.length));
  const currentYear = years[yearIdx] ?? years[0];
  const reactiveNow = reactiveCum[yearIdx] ?? 0;
  const preventionNow = preventionCum[yearIdx] ?? 0;

  const reactiveFinal = data.totals.reactive;
  const scale = reactiveFinal * 1.05;
  const reactiveFill = (reactiveNow / scale) * 100;
  const preventionFill = (preventionNow / scale) * 100;
  const ratio = preventionNow > 0 ? Math.round(reactiveNow / preventionNow) : 0;

  return (
    <section ref={ref} className="relative" style={{ minHeight: '320vh' }}>
      <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden bg-[#0a0a0a]">
        <div className="w-full max-w-7xl mx-auto px-6 grid md:grid-cols-12 gap-8 items-center">
          {/* Left narrative — 5 cols */}
          <div className="md:col-span-5 space-y-6">
            <div className="text-[10px] uppercase tracking-[0.3em] text-bauhaus-yellow">
              Chapter 01 · The split
            </div>
            <h2 className="font-black text-3xl md:text-5xl leading-tight">
              Two tanks. <span className="text-bauhaus-red">Same scale.</span>
            </h2>
            <div className="text-base md:text-lg text-white/70 leading-relaxed space-y-4">
              <p>
                Both tanks measure the same thing — Australian government spend on youth justice. The left is{' '}
                <span className="text-bauhaus-red font-bold">reactive</span> (police, courts,
                detention, supervision). The right is{' '}
                <span className="text-bauhaus-blue font-bold">prevention</span> (diversion, early
                intervention, wraparound).
              </p>
              <p>
                Watch what happens as the years pour in.
              </p>
            </div>

            <div className="pt-6 border-t-2 border-white/10">
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2">
                Year
              </div>
              <div className="font-black text-5xl md:text-6xl text-bauhaus-yellow tabular-nums">
                {currentYear}
              </div>
            </div>

            {ratio > 0 && (
              <div
                className="bg-gradient-to-r from-bauhaus-red/20 to-transparent border-l-4 border-bauhaus-red pl-4 py-2"
                style={{
                  opacity: progress > 0.5 ? 1 : 0,
                  transition: 'opacity 600ms ease',
                }}
              >
                <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">
                  By {currentYear}
                </div>
                <div className="font-black text-2xl md:text-3xl">
                  <span className="text-bauhaus-red">{ratio}×</span>{' '}
                  <span className="text-white/70">more on reactive</span>
                </div>
              </div>
            )}
          </div>

          {/* Right — the tanks — 7 cols */}
          <div className="md:col-span-7 grid grid-cols-2 gap-6 h-[80vh] max-h-[700px]">
            {/* Reactive tank */}
            <div className="flex flex-col">
              <div className="text-center mb-3">
                <div className="font-black text-xl md:text-2xl tracking-widest" style={{ color: LANE_COLOR.reactive }}>
                  REACTIVE
                </div>
                <div className="text-[10px] text-white/40 uppercase tracking-widest mt-1">
                  Police · Courts · Detention
                </div>
              </div>
              <div className="flex-1 relative border-4 border-white/30 overflow-hidden bg-black">
                {/* Liquid */}
                <div
                  className="absolute bottom-0 left-0 right-0"
                  style={{
                    height: `${reactiveFill}%`,
                    background: `linear-gradient(180deg, ${LANE_COLOR.reactive} 0%, #8a1010 100%)`,
                    boxShadow: `0 -2px 20px ${LANE_COLOR.reactive}`,
                    transition: 'height 200ms linear',
                  }}
                />
                {/* Surface highlight */}
                {reactiveFill > 0 && (
                  <div
                    className="absolute left-0 right-0 h-1 bg-white/40"
                    style={{
                      bottom: `${reactiveFill}%`,
                      transition: 'bottom 200ms linear',
                    }}
                  />
                )}
                {/* Scale ticks */}
                {[0.25, 0.5, 0.75].map(p => (
                  <div
                    key={p}
                    className="absolute right-0 w-2 h-px bg-white/30"
                    style={{ bottom: `${p * 100}%` }}
                  />
                ))}
              </div>
              <div className="text-center mt-3">
                <div className="font-black text-3xl md:text-4xl tabular-nums" style={{ color: LANE_COLOR.reactive }}>
                  {fmtMoney(reactiveNow)}
                </div>
              </div>
            </div>

            {/* Prevention tank */}
            <div className="flex flex-col">
              <div className="text-center mb-3">
                <div className="font-black text-xl md:text-2xl tracking-widest" style={{ color: LANE_COLOR.prevention }}>
                  PREVENTION
                </div>
                <div className="text-[10px] text-white/40 uppercase tracking-widest mt-1">
                  Diversion · Early intervention
                </div>
              </div>
              <div className="flex-1 relative border-4 border-white/30 overflow-hidden bg-black">
                <div
                  className="absolute bottom-0 left-0 right-0"
                  style={{
                    height: `${preventionFill}%`,
                    background: `linear-gradient(180deg, ${LANE_COLOR.prevention} 0%, #0820a0 100%)`,
                    boxShadow: `0 -2px 20px ${LANE_COLOR.prevention}`,
                    transition: 'height 200ms linear',
                  }}
                />
                {preventionFill > 0 && (
                  <div
                    className="absolute left-0 right-0 h-1 bg-white/40"
                    style={{
                      bottom: `${preventionFill}%`,
                      transition: 'bottom 200ms linear',
                    }}
                  />
                )}
                {[0.25, 0.5, 0.75].map(p => (
                  <div
                    key={p}
                    className="absolute right-0 w-2 h-px bg-white/30"
                    style={{ bottom: `${p * 100}%` }}
                  />
                ))}
              </div>
              <div className="text-center mt-3">
                <div className="font-black text-3xl md:text-4xl tabular-nums" style={{ color: LANE_COLOR.prevention }}>
                  {fmtMoney(preventionNow)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
