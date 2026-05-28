'use client';

import { fmtMoney, LANE_COLOR, type Lane, type YJSummary } from '@/lib/hooks/use-yj-summary';
import { useScrollProgress, useInView } from '../hooks';
import { useMemo } from 'react';

const ISO_X = 0.866;
const ISO_Y = 0.5;
const STATES_ORDER = ['VIC', 'WA', 'SA', 'ACT', 'QLD', 'NSW', 'NT', 'TAS'];

interface Tower {
  name: string;
  state: string;
  lane: Lane;
  value: number;
  gx: number;
  gy: number;
  fullHeight: number;
}

export function CityscapeScene({ data }: { data: YJSummary }) {
  const { ref, progress } = useScrollProgress<HTMLDivElement>();
  const { ref: viewRef, inView } = useInView<HTMLDivElement>(0.2);

  const towers = useMemo<Tower[]>(() => {
    const byState = new Map<string, typeof data.top_recipients>();
    for (const r of data.top_recipients) {
      const s = r.state || 'UNK';
      if (!byState.has(s)) byState.set(s, []);
      byState.get(s)!.push(r);
    }
    for (const arr of byState.values()) arr.sort((a, b) => b.total - a.total);

    const TOP_PER_STATE = 18;
    const COLS = 6;
    const STATES_PER_ROW = 4;
    const BLOCK_W = COLS + 2;
    const BLOCK_H = 4 + 4;

    const result: Tower[] = [];
    let stateIdx = 0;
    for (const stateCode of STATES_ORDER) {
      const recips = (byState.get(stateCode) || []).slice(0, TOP_PER_STATE);
      if (recips.length === 0) continue;

      const stateRow = Math.floor(stateIdx / STATES_PER_ROW);
      const stateCol = stateIdx % STATES_PER_ROW;
      const gxStart = stateCol * BLOCK_W;
      const gyStart = stateRow * BLOCK_H;

      recips.forEach((r, i) => {
        const localCol = i % COLS;
        const localRow = Math.floor(i / COLS);
        const heightLog = Math.log10(Math.max(1, r.total)) - 4;
        let h = Math.max(8, Math.min(420, heightLog * 70));
        if (r.total > 1e9) h = 220 + Math.log10(r.total / 1e9) * 160;
        result.push({
          name: r.name,
          state: stateCode,
          lane: r.lane,
          value: r.total,
          gx: gxStart + localCol,
          gy: gyStart + localRow,
          fullHeight: h,
        });
      });
      stateIdx++;
    }
    return result;
  }, [data]);

  // Animated tower heights — reveal as user scrolls
  // Towers grow 0..fullHeight as progress goes 0.05..0.65
  const growStart = 0.05;
  const growEnd = 0.65;
  const growT = Math.max(0, Math.min(1, (progress - growStart) / (growEnd - growStart)));

  const TOWER_W = 22;
  const DEPTH = 22;

  // Compute viewBox
  const bounds = useMemo(() => {
    if (towers.length === 0) return { minX: 0, minY: 0, w: 1000, h: 700 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const t of towers) {
      const baseX = t.gx * (TOWER_W + 4);
      const baseY = t.gy * (DEPTH + 4);
      const top = iso(baseX, baseY, t.fullHeight);
      const bot = iso(baseX + TOWER_W, baseY + DEPTH, 0);
      minX = Math.min(minX, top.sx - TOWER_W);
      minY = Math.min(minY, top.sy - 30);
      maxX = Math.max(maxX, bot.sx + TOWER_W);
      maxY = Math.max(maxY, bot.sy + DEPTH);
    }
    return {
      minX: minX - 40,
      minY: minY - 40,
      w: maxX - minX + 100,
      h: maxY - minY + 100,
    };
  }, [towers]);

  return (
    <section ref={ref} className="relative" style={{ minHeight: '300vh' }}>
      <div ref={viewRef} className="sticky top-0 h-screen w-full bg-[#0a0a0a] overflow-hidden flex items-center">
        <div className="w-full h-full max-w-7xl mx-auto px-6 grid md:grid-cols-12 gap-8 items-center">
          {/* Left narrative */}
          <div className="md:col-span-4 space-y-6 z-10">
            <div className="text-[10px] uppercase tracking-[0.3em] text-bauhaus-yellow">
              Chapter 03 · The skyline
            </div>
            <h2 className="font-black text-3xl md:text-5xl leading-tight">
              Five towers.
              <br />
              <span className="text-white/50">A prairie of</span>{' '}
              <span style={{ color: LANE_COLOR['community-led'] }}>everyone else</span>.
            </h2>
            <div className="text-base text-white/70 leading-relaxed space-y-3">
              <p>
                Each tower is one organisation. Height = total dollars received over 17 years.
                Color = where the money lands — <span style={{ color: LANE_COLOR.reactive }}>reactive</span>,{' '}
                <span style={{ color: LANE_COLOR['community-led'] }}>community-led</span>,{' '}
                <span style={{ color: LANE_COLOR.prevention }}>prevention</span>, or unclassified.
              </p>
              <p>
                Look at where the skyscrapers are. Then look at the prairie next door.
              </p>
            </div>

            {/* Stat callout — top reactive recipient */}
            {(() => {
              const top = [...data.top_recipients].sort((a, b) => b.total - a.total)[0];
              if (!top) return null;
              return (
                <div
                  className="bg-gradient-to-br from-bauhaus-red/20 to-transparent border-l-4 border-bauhaus-red pl-4 py-3"
                  style={{
                    opacity: progress > 0.3 ? 1 : 0,
                    transform: progress > 0.3 ? 'translateX(0)' : 'translateX(-20px)',
                    transition: 'all 600ms ease',
                  }}
                >
                  <div className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-1">
                    Tallest tower
                  </div>
                  <div className="font-black text-lg leading-tight">{top.name}</div>
                  <div className="text-xs text-white/50 mt-1">{top.state}</div>
                  <div className="font-black text-3xl mt-2 text-bauhaus-red tabular-nums">
                    {fmtMoney(top.total)}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Right — cityscape SVG */}
          <div className="md:col-span-8 h-[85vh] max-h-[820px]">
            <svg
              viewBox={`${bounds.minX} ${bounds.minY} ${bounds.w} ${bounds.h}`}
              className="w-full h-full"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Sort back-to-front for correct occlusion */}
              {[...towers]
                .sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy))
                .map(t => {
                  const baseX = t.gx * (TOWER_W + 4);
                  const baseY = t.gy * (DEPTH + 4);
                  const h = t.fullHeight * growT;

                  const top = iso(baseX, baseY, h);
                  const topR = iso(baseX + TOWER_W, baseY, h);
                  const topRB = iso(baseX + TOWER_W, baseY + DEPTH, h);
                  const topLB = iso(baseX, baseY + DEPTH, h);
                  const bot = iso(baseX, baseY, 0);
                  const botR = iso(baseX + TOWER_W, baseY, 0);
                  const botRB = iso(baseX + TOWER_W, baseY + DEPTH, 0);

                  const front = `${bot.sx},${bot.sy} ${botR.sx},${botR.sy} ${topR.sx},${topR.sy} ${top.sx},${top.sy}`;
                  const right = `${botR.sx},${botR.sy} ${botRB.sx},${botRB.sy} ${topRB.sx},${topRB.sy} ${topR.sx},${topR.sy}`;
                  const topF = `${top.sx},${top.sy} ${topR.sx},${topR.sy} ${topRB.sx},${topRB.sy} ${topLB.sx},${topLB.sy}`;

                  const baseColor = LANE_COLOR[t.lane] || LANE_COLOR.unclassified;
                  return (
                    <g key={`${t.name}-${t.gx}-${t.gy}`}>
                      <polygon points={right} fill={darken(baseColor, 0.35)} stroke="#000" strokeWidth={0.4} />
                      <polygon points={front} fill={baseColor} stroke="#000" strokeWidth={0.4} />
                      <polygon points={topF} fill={lighten(baseColor, 0.25)} stroke="#000" strokeWidth={0.4} />
                      {/* Money tag for billion-dollar towers */}
                      {t.fullHeight > 200 && growT > 0.9 && (
                        <text
                          x={top.sx + (TOWER_W / 2) * ISO_X}
                          y={top.sy - 6}
                          fontSize={10}
                          fontWeight={900}
                          fill="#fff"
                          textAnchor="middle"
                          style={{ fontFamily: 'monospace', pointerEvents: 'none' }}
                        >
                          {fmtMoney(t.value)}
                        </text>
                      )}
                    </g>
                  );
                })}

              {/* State labels */}
              {STATES_ORDER.map(stateCode => {
                const stateTowers = towers.filter(t => t.state === stateCode);
                if (stateTowers.length === 0) return null;
                const minGx = Math.min(...stateTowers.map(t => t.gx));
                const minGy = Math.min(...stateTowers.map(t => t.gy));
                const maxGy = Math.max(...stateTowers.map(t => t.gy));
                const labelGx = minGx * (TOWER_W + 4);
                const labelGy = (maxGy + 1.2) * (DEPTH + 4);
                const { sx, sy } = iso(labelGx, labelGy, 0);
                return (
                  <g key={stateCode}>
                    <rect x={sx - 4} y={sy + 6} width={42} height={18} fill="#121212" stroke="#F0C020" strokeWidth={1.5} />
                    <text
                      x={sx + 17}
                      y={sy + 19}
                      fontSize={11}
                      fontWeight={900}
                      textAnchor="middle"
                      fill="#F0C020"
                      style={{ fontFamily: 'monospace', letterSpacing: '0.15em' }}
                    >
                      {stateCode}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

// Iso projection helpers
function iso(x: number, y: number, z: number) {
  return { sx: (x - y) * ISO_X, sy: (x + y) * ISO_Y - z };
}
function darken(hex: string, factor: number) {
  const { r, g, b } = parseHex(hex);
  return rgb(Math.round(r * (1 - factor)), Math.round(g * (1 - factor)), Math.round(b * (1 - factor)));
}
function lighten(hex: string, factor: number) {
  const { r, g, b } = parseHex(hex);
  return rgb(
    Math.round(r + (255 - r) * factor),
    Math.round(g + (255 - g) * factor),
    Math.round(b + (255 - b) * factor),
  );
}
function parseHex(hex: string) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
function rgb(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
