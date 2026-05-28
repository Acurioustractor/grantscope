'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useYJSummary, fmtMoney, LANE_COLOR, LANE_LABEL, type Lane } from '@/lib/hooks/use-yj-summary';

const LANES: Lane[] = ['reactive', 'community-led', 'prevention', 'unclassified'];

export default function MoneyRiverPage() {
  const { data, loading, error } = useYJSummary({ topN: 100 });
  const [scrubYear, setScrubYear] = useState<number>(2008);
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<number | null>(null);

  // Aggregate cumulative totals up to each year, by lane
  const cumByYearLane = useMemo(() => {
    if (!data) return new Map<number, Record<Lane, number>>();
    const out = new Map<number, Record<Lane, number>>();
    const yMin = data.meta.year_range.min;
    const yMax = data.meta.year_range.max;
    let cum: Record<Lane, number> = { reactive: 0, prevention: 0, 'community-led': 0, unclassified: 0 };
    for (let y = yMin; y <= yMax; y++) {
      const yearRows = data.by_year_lane.filter(r => r.year === y);
      for (const r of yearRows) {
        cum[r.lane] = (cum[r.lane] || 0) + r.total;
      }
      out.set(y, { ...cum });
    }
    return out;
  }, [data]);

  // Default to MAX year so at-rest view shows the full story
  useEffect(() => {
    if (data && scrubYear === 2008) {
      setScrubYear(data.meta.year_range.max);
    }
  }, [data, scrubYear]);

  // Play loop
  useEffect(() => {
    if (!playing || !data) return;
    const yMax = data.meta.year_range.max;
    const yMin = data.meta.year_range.min;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      if (dt > 600) {
        last = now;
        setScrubYear(y => {
          if (y >= yMax) {
            setPlaying(false);
            return yMin;
          }
          return y + 1;
        });
      }
      playRef.current = requestAnimationFrame(tick);
    };
    playRef.current = requestAnimationFrame(tick);
    return () => {
      if (playRef.current) cancelAnimationFrame(playRef.current);
    };
  }, [playing, data]);

  const W = 1200;
  const H = 580;
  const PILLAR_W = 180;
  const PILLAR_GAP = 60;
  const PILLAR_COUNT = LANES.length;
  const PILLAR_AREA_W = PILLAR_COUNT * PILLAR_W + (PILLAR_COUNT - 1) * PILLAR_GAP;
  const PILLAR_X_START = (W - PILLAR_AREA_W) / 2;
  const PILLAR_BOTTOM = H - 30;
  const PILLAR_TOP = 70;
  const PILLAR_HEIGHT = PILLAR_BOTTOM - PILLAR_TOP;

  // Max y-axis = total reactive (always the biggest)
  const maxScale = data ? data.totals.reactive * 1.05 : 1;

  const currentTotals = data ? cumByYearLane.get(scrubYear) || { reactive: 0, prevention: 0, 'community-led': 0, unclassified: 0 } : null;

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] text-white overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-bauhaus-black border-b-4 border-bauhaus-yellow px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <Link href="/graph/youth-justice-views" className="text-[10px] font-mono text-bauhaus-yellow hover:underline">
            ← Five views
          </Link>
          <h1 className="font-black uppercase tracking-widest text-xl mt-0.5">Money River</h1>
          <p className="text-[10px] font-mono text-zinc-400 mt-0.5">
            Cumulative spend per lane, year by year. Hit Play to watch 17 years of money pour in.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => { setScrubYear(data?.meta.year_range.min ?? 2008); setPlaying(true); }}
            disabled={!data || playing}
            className="border-2 border-bauhaus-yellow bg-bauhaus-yellow text-bauhaus-black font-black uppercase tracking-widest text-xs px-4 py-2 hover:bg-white disabled:opacity-50"
          >
            ▶ Play
          </button>
          <button
            onClick={() => setPlaying(false)}
            disabled={!playing}
            className="border-2 border-white text-white font-black uppercase tracking-widest text-xs px-4 py-2 hover:bg-white hover:text-black disabled:opacity-30"
          >
            ⏸ Pause
          </button>
        </div>
      </div>

      {/* Year scrubber */}
      {data && (
        <div className="bg-bauhaus-black/80 px-6 py-3 border-b border-zinc-800 flex items-center gap-4 flex-shrink-0">
          <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">YEAR</div>
          <div className="font-black text-3xl text-bauhaus-yellow w-24">{scrubYear}</div>
          <input
            type="range"
            min={data.meta.year_range.min}
            max={data.meta.year_range.max}
            value={scrubYear}
            onChange={e => { setScrubYear(parseInt(e.target.value, 10)); setPlaying(false); }}
            className="flex-1 accent-bauhaus-yellow"
          />
          <div className="font-mono text-xs text-zinc-500 w-20 text-right">
            {data.meta.year_range.min}–{data.meta.year_range.max}
          </div>
        </div>
      )}

      {/* SVG */}
      <div className="flex-1 flex items-center justify-center">
        {loading && <div className="font-mono text-sm text-zinc-400">Loading…</div>}
        {error && <div className="font-mono text-sm text-bauhaus-red">Error: {error}</div>}
        {data && currentTotals && (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
            {/* Axis */}
            <line x1={50} y1={PILLAR_BOTTOM} x2={W - 50} y2={PILLAR_BOTTOM} stroke="#444" strokeWidth={1} />

            {/* Pillars */}
            {LANES.map((lane, i) => {
              const x = PILLAR_X_START + i * (PILLAR_W + PILLAR_GAP);
              const value = currentTotals[lane] || 0;
              const fillH = (value / maxScale) * PILLAR_HEIGHT;
              const fillY = PILLAR_BOTTOM - fillH;
              const finalValue = data.totals[lane];
              const finalH = (finalValue / maxScale) * PILLAR_HEIGHT;
              const ghostY = PILLAR_BOTTOM - finalH;

              return (
                <g key={lane}>
                  {/* Pillar outline (full height) */}
                  <rect
                    x={x}
                    y={PILLAR_TOP}
                    width={PILLAR_W}
                    height={PILLAR_HEIGHT}
                    fill="none"
                    stroke="#2a2a2a"
                    strokeWidth={2}
                  />
                  {/* Final-value ghost line (where it ends up by 2025) */}
                  <line
                    x1={x - 10}
                    y1={ghostY}
                    x2={x + PILLAR_W + 10}
                    y2={ghostY}
                    stroke={LANE_COLOR[lane]}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    opacity={0.5}
                  />
                  <text
                    x={x + PILLAR_W + 14}
                    y={ghostY + 4}
                    fill={LANE_COLOR[lane]}
                    fontSize={10}
                    fontFamily="monospace"
                    opacity={0.7}
                  >
                    {fmtMoney(finalValue)}
                  </text>
                  {/* Filled liquid */}
                  <rect
                    x={x}
                    y={fillY}
                    width={PILLAR_W}
                    height={fillH}
                    fill={LANE_COLOR[lane]}
                    style={{ transition: 'y 0.5s, height 0.5s' }}
                  />
                  {/* Liquid surface highlight */}
                  {fillH > 0 && (
                    <rect
                      x={x}
                      y={fillY - 2}
                      width={PILLAR_W}
                      height={4}
                      fill="#fff"
                      opacity={0.3}
                      style={{ transition: 'y 0.5s' }}
                    />
                  )}
                </g>
              );
            })}

            {/* Title overlay */}
            <text x={W / 2} y={45} fill="#fff" fontSize={20} fontFamily="monospace" fontWeight="900" textAnchor="middle"
                  style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              CUMULATIVE SPEND THROUGH {scrubYear}
            </text>
          </svg>
        )}
      </div>

      {/* Lane label row — kept OUT of SVG so it can never be clipped */}
      {data && currentTotals && (
        <div className="bg-bauhaus-black border-t-2 border-zinc-800 px-6 py-4 grid grid-cols-4 gap-4 flex-shrink-0">
          {LANES.map(lane => (
            <div key={lane} className="text-center">
              <div className="font-mono text-[11px] uppercase tracking-widest text-white/70" style={{ letterSpacing: '0.18em' }}>
                {LANE_LABEL[lane]}
              </div>
              <div className="font-mono font-black text-2xl mt-1" style={{ color: LANE_COLOR[lane] }}>
                {fmtMoney(currentTotals[lane] || 0)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer ratio */}
      {data && currentTotals && (
        <div className="bg-bauhaus-black border-t-4 border-bauhaus-yellow px-6 py-4 font-mono text-xs flex justify-center gap-8 flex-shrink-0">
          <div>
            <span className="text-zinc-500">Reactive:Prevention ratio &nbsp;</span>
            <span className="font-black text-bauhaus-yellow text-base">
              {currentTotals.prevention > 0 ? Math.round(currentTotals.reactive / currentTotals.prevention) : '∞'}×
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Reactive:Community-led &nbsp;</span>
            <span className="font-black text-bauhaus-yellow text-base">
              {currentTotals['community-led'] > 0 ? Math.round(currentTotals.reactive / currentTotals['community-led']) : '∞'}×
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Total spent &nbsp;</span>
            <span className="font-black text-white text-base">
              {fmtMoney(Object.values(currentTotals).reduce((a, b) => a + b, 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
