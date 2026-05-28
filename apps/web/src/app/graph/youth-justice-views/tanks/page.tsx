'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useYJSummary, fmtMoney, LANE_COLOR } from '@/lib/hooks/use-yj-summary';

export default function TanksPage() {
  const { data, loading, error } = useYJSummary({ topN: 50 });
  const [scrubYear, setScrubYear] = useState<number>(2008);
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<number | null>(null);

  // Cumulative reactive vs prevention through each year
  const cumReactive = useMemo(() => {
    if (!data) return new Map<number, number>();
    const out = new Map<number, number>();
    let cum = 0;
    for (let y = data.meta.year_range.min; y <= data.meta.year_range.max; y++) {
      const rows = data.by_year_lane.filter(r => r.year === y && r.lane === 'reactive');
      cum += rows.reduce((acc, r) => acc + r.total, 0);
      out.set(y, cum);
    }
    return out;
  }, [data]);

  const cumPrevention = useMemo(() => {
    if (!data) return new Map<number, number>();
    const out = new Map<number, number>();
    let cum = 0;
    for (let y = data.meta.year_range.min; y <= data.meta.year_range.max; y++) {
      const rows = data.by_year_lane.filter(r => r.year === y && r.lane === 'prevention');
      cum += rows.reduce((acc, r) => acc + r.total, 0);
      out.set(y, cum);
    }
    return out;
  }, [data]);

  // Default to MAX year so at-rest view shows full contrast
  useEffect(() => {
    if (data && scrubYear === 2008) setScrubYear(data.meta.year_range.max);
  }, [data, scrubYear]);

  // Play loop
  useEffect(() => {
    if (!playing || !data) return;
    const yMax = data.meta.year_range.max;
    const yMin = data.meta.year_range.min;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      if (dt > 700) {
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
    return () => { if (playRef.current) cancelAnimationFrame(playRef.current); };
  }, [playing, data]);

  const W = 1200;
  const H = 760;
  const TANK_W = 380;
  const TANK_H = 480;
  const TANK_TOP = 100;
  const TANK_BOTTOM = TANK_TOP + TANK_H;
  const LEFT_X = W / 2 - TANK_W - 60;
  const RIGHT_X = W / 2 + 60;

  const reactiveNow = data ? (cumReactive.get(scrubYear) || 0) : 0;
  const preventionNow = data ? (cumPrevention.get(scrubYear) || 0) : 0;
  const reactiveFinal = data?.totals.reactive || 1;

  // BOTH tanks share the same scale (reactive_final), so prevention looks tiny
  const scale = reactiveFinal * 1.05;
  const reactiveH = (reactiveNow / scale) * TANK_H;
  const preventionH = (preventionNow / scale) * TANK_H;

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] text-white overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-bauhaus-black border-b-4 border-bauhaus-yellow px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <Link href="/graph/youth-justice-views" className="text-[10px] font-mono text-bauhaus-yellow hover:underline">
            ← Five views
          </Link>
          <h1 className="font-black uppercase tracking-widest text-xl mt-0.5">Two Tanks</h1>
          <p className="text-[10px] font-mono text-zinc-400 mt-0.5">
            Same Y-axis scale. The contrast IS the message. Hit Play.
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
        </div>
      )}

      <div className="flex-1 flex items-center justify-center">
        {loading && <div className="font-mono text-sm text-zinc-400">Loading…</div>}
        {error && <div className="font-mono text-sm text-bauhaus-red">Error: {error}</div>}
        {data && (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
            {/* LEFT TANK — REACTIVE */}
            <g>
              <rect x={LEFT_X} y={TANK_TOP} width={TANK_W} height={TANK_H} fill="none" stroke="#444" strokeWidth={3} />
              {/* Liquid */}
              <rect
                x={LEFT_X}
                y={TANK_BOTTOM - reactiveH}
                width={TANK_W}
                height={reactiveH}
                fill={LANE_COLOR.reactive}
                style={{ transition: 'y 0.6s cubic-bezier(0.4,0,0.2,1), height 0.6s cubic-bezier(0.4,0,0.2,1)' }}
              />
              {/* Surface highlight */}
              {reactiveH > 0 && (
                <rect
                  x={LEFT_X}
                  y={TANK_BOTTOM - reactiveH - 3}
                  width={TANK_W}
                  height={6}
                  fill="#fff"
                  opacity={0.3}
                  style={{ transition: 'y 0.6s cubic-bezier(0.4,0,0.2,1)' }}
                />
              )}
              <text x={LEFT_X + TANK_W / 2} y={TANK_TOP - 30} fill="#fff" fontSize={28} fontFamily="monospace" fontWeight="900" textAnchor="middle"
                    style={{ letterSpacing: '0.2em' }}>
                REACTIVE
              </text>
              <text x={LEFT_X + TANK_W / 2} y={TANK_TOP - 8} fill={LANE_COLOR.reactive} fontSize={14} fontFamily="monospace" textAnchor="middle">
                Police · Courts · Detention
              </text>
              <text x={LEFT_X + TANK_W / 2} y={TANK_BOTTOM + 40} fill={LANE_COLOR.reactive} fontSize={42} fontFamily="monospace" fontWeight="900" textAnchor="middle">
                {fmtMoney(reactiveNow)}
              </text>
            </g>

            {/* RIGHT TANK — PREVENTION */}
            <g>
              <rect x={RIGHT_X} y={TANK_TOP} width={TANK_W} height={TANK_H} fill="none" stroke="#444" strokeWidth={3} />
              {/* Liquid */}
              <rect
                x={RIGHT_X}
                y={TANK_BOTTOM - preventionH}
                width={TANK_W}
                height={preventionH}
                fill={LANE_COLOR.prevention}
                style={{ transition: 'y 0.6s cubic-bezier(0.4,0,0.2,1), height 0.6s cubic-bezier(0.4,0,0.2,1)' }}
              />
              {/* Surface highlight */}
              {preventionH > 0 && (
                <rect
                  x={RIGHT_X}
                  y={TANK_BOTTOM - preventionH - 3}
                  width={TANK_W}
                  height={6}
                  fill="#fff"
                  opacity={0.3}
                  style={{ transition: 'y 0.6s cubic-bezier(0.4,0,0.2,1)' }}
                />
              )}
              <text x={RIGHT_X + TANK_W / 2} y={TANK_TOP - 30} fill="#fff" fontSize={28} fontFamily="monospace" fontWeight="900" textAnchor="middle"
                    style={{ letterSpacing: '0.2em' }}>
                PREVENTION
              </text>
              <text x={RIGHT_X + TANK_W / 2} y={TANK_TOP - 8} fill={LANE_COLOR.prevention} fontSize={14} fontFamily="monospace" textAnchor="middle">
                Diversion · Early intervention · Wraparound
              </text>
              <text x={RIGHT_X + TANK_W / 2} y={TANK_BOTTOM + 40} fill={LANE_COLOR.prevention} fontSize={42} fontFamily="monospace" fontWeight="900" textAnchor="middle">
                {fmtMoney(preventionNow)}
              </text>
            </g>

            {/* Center "vs" */}
            <text x={W / 2} y={H / 2 + 6} fill="#fff" fontSize={32} fontFamily="monospace" fontWeight="900" textAnchor="middle">
              vs
            </text>
            {preventionNow > 0 && (
              <text x={W / 2} y={H / 2 + 32} fill="#F0C020" fontSize={14} fontFamily="monospace" fontWeight="900" textAnchor="middle">
                {Math.round(reactiveNow / preventionNow)}× more
              </text>
            )}
          </svg>
        )}
      </div>
    </div>
  );
}
