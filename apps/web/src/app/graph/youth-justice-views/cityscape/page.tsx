'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useYJSummary, fmtMoney, LANE_COLOR, LANE_LABEL, type Lane, type YJRecipient } from '@/lib/hooks/use-yj-summary';

// Isometric projection: world (x, y, z) → screen (sx, sy)
const ISO_X = 0.866; // cos(30deg)
const ISO_Y = 0.5;   // sin(30deg)
function iso(x: number, y: number, z: number) {
  return {
    sx: (x - y) * ISO_X,
    sy: (x + y) * ISO_Y - z,
  };
}

const STATES_ORDER = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT', null];

interface Tower {
  recipient: YJRecipient;
  gx: number;       // grid X (state)
  gy: number;       // grid Y (within state, sorted by funding)
  height: number;   // tower height in screen px
  color: string;
  isSpotlight: boolean;
}

export default function CityscapePage() {
  const { data, loading, error } = useYJSummary({ topN: 600 });
  const [hovered, setHovered] = useState<Tower | null>(null);
  const [laneFilter, setLaneFilter] = useState<Lane | 'all'>('all');

  const towers = useMemo<Tower[]>(() => {
    if (!data) return [];

    // Bucket by state, then take top N per state to keep grid tight
    const byState = new Map<string, YJRecipient[]>();
    for (const r of data.top_recipients) {
      const s = r.state || 'UNK';
      if (!byState.has(s)) byState.set(s, []);
      byState.get(s)!.push(r);
    }
    const TOP_PER_STATE = 24;
    for (const [k, arr] of byState) {
      arr.sort((a, b) => b.total - a.total);
      byState.set(k, arr.slice(0, TOP_PER_STATE));
    }

    // Build towers — fixed-size state blocks, 3 states per row
    const COLS_PER_STATE = 6;
    const ROWS_PER_STATE = 4; // 6×4 = 24 capped recipients
    const BLOCK_W = COLS_PER_STATE + 2; // includes inter-state gap
    const BLOCK_H = ROWS_PER_STATE + 4; // includes label + gap
    const STATES_PER_ROW = 3;

    const result: Tower[] = [];
    let stateIdx = 0;

    for (const stateCode of STATES_ORDER) {
      const stateKey = stateCode ?? 'UNK';
      const recips = byState.get(stateKey) || [];
      if (recips.length === 0) continue;

      const stateRow = Math.floor(stateIdx / STATES_PER_ROW);
      const stateCol = stateIdx % STATES_PER_ROW;
      const gxBlockStart = stateCol * BLOCK_W;
      const gyBlockStart = stateRow * BLOCK_H;

      recips.forEach((r, i) => {
        const localCol = i % COLS_PER_STATE;
        const localRow = Math.floor(i / COLS_PER_STATE);
        const heightLog = Math.log10(Math.max(1, r.total)) - 4;
        const height = Math.max(6, Math.min(560, heightLog * 90));
        const finalHeight = r.total > 1e9 ? 280 + (Math.log10(r.total / 1e9)) * 200 : height;

        result.push({
          recipient: r,
          gx: gxBlockStart + localCol,
          gy: gyBlockStart + localRow,
          height: finalHeight,
          color: LANE_COLOR[r.lane],
          isSpotlight: r.total >= 1e8,
        });
      });

      stateIdx++;
    }

    return result;
  }, [data]);

  const visibleTowers = laneFilter === 'all' ? towers : towers.filter(t => t.recipient.lane === laneFilter);

  // Compute viewBox bounds
  const bounds = useMemo(() => {
    if (towers.length === 0) return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
    const TOWER_W = 24;
    const DEPTH = 24;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const t of towers) {
      const { sx, sy } = iso(t.gx * (TOWER_W + 4), t.gy * (DEPTH + 4), t.height);
      minX = Math.min(minX, sx - TOWER_W);
      minY = Math.min(minY, sy - 20);
      maxX = Math.max(maxX, sx + TOWER_W * 2);
      const { sy: floorSy } = iso(t.gx * (TOWER_W + 4), t.gy * (DEPTH + 4), 0);
      maxY = Math.max(maxY, floorSy + DEPTH);
    }
    return { minX: minX - 40, minY: minY - 40, maxX: maxX + 80, maxY: maxY + 100 };
  }, [towers]);

  const TOWER_W = 24;
  const DEPTH = 24;

  return (
    <div className="fixed inset-0 bg-bauhaus-canvas text-bauhaus-black overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-bauhaus-black text-white border-b-4 border-bauhaus-yellow px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <Link href="/graph/youth-justice-views" className="text-[10px] font-mono text-bauhaus-yellow hover:underline">
            ← Five views
          </Link>
          <h1 className="font-black uppercase tracking-widest text-xl mt-0.5">Cityscape of Injustice</h1>
          <p className="text-[10px] font-mono text-zinc-400 mt-0.5">
            {data ? `${data.top_recipients.length} recipients · grouped by state · log-scale tower heights · 17 years cumulative` : loading ? 'Loading…' : '—'}
          </p>
        </div>
        <div className="flex gap-1">
          {(['all', 'reactive', 'community-led', 'prevention', 'unclassified'] as const).map(l => (
            <button
              key={l}
              onClick={() => setLaneFilter(l)}
              className={`px-2 py-1 text-[10px] font-mono uppercase tracking-widest border-2 ${
                laneFilter === l ? 'bg-bauhaus-yellow text-bauhaus-black border-bauhaus-yellow' : 'border-white/30 text-white/70 hover:border-white'
              }`}
              style={l !== 'all' && laneFilter !== l ? { borderColor: LANE_COLOR[l as Lane] + '80', color: LANE_COLOR[l as Lane] } : undefined}
            >
              {l === 'all' ? 'All' : LANE_LABEL[l as Lane]}
            </button>
          ))}
        </div>
      </div>

      {/* Stat bar */}
      {data && (
        <div className="bg-white border-b-4 border-bauhaus-black px-6 py-3 flex items-center gap-6 flex-shrink-0">
          {(['reactive', 'community-led', 'prevention', 'unclassified'] as Lane[]).map(lane => (
            <div key={lane} className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-bauhaus-black" style={{ background: LANE_COLOR[lane] }} />
              <div>
                <div className="font-black text-lg leading-tight">{fmtMoney(data.totals[lane])}</div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">{LANE_LABEL[lane]}</div>
              </div>
            </div>
          ))}
          <div className="ml-auto text-[10px] font-mono text-zinc-600">
            Reactive : Community-led : Prevention &nbsp;=&nbsp;
            <span className="font-black text-bauhaus-black">
              {Math.round(data.totals.reactive / Math.max(1, data.totals.prevention))}× : {Math.round(data.totals['community-led'] / Math.max(1, data.totals.prevention))}× : 1
            </span>
          </div>
        </div>
      )}

      {/* SVG cityscape */}
      <div className="flex-1 overflow-auto bg-bauhaus-canvas">
        {loading && <div className="p-8 font-mono text-sm">Loading cityscape…</div>}
        {error && <div className="p-8 font-mono text-sm text-bauhaus-red">Error: {error}</div>}

        {data && (
          <svg
            viewBox={`${bounds.minX} ${bounds.minY} ${bounds.maxX - bounds.minX} ${bounds.maxY - bounds.minY}`}
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* Sun-style lighting: front face brighter, side darker */}
              <pattern id="ground" patternUnits="userSpaceOnUse" width="40" height="40">
                <rect width="40" height="40" fill="#ECECEC" />
                <line x1="0" y1="0" x2="40" y2="0" stroke="#D8D8D8" strokeWidth="1" />
                <line x1="0" y1="0" x2="0" y2="40" stroke="#D8D8D8" strokeWidth="1" />
              </pattern>
            </defs>

            {/* Render back-to-front so towers occlude correctly */}
            {[...visibleTowers]
              .sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy))
              .map(t => {
                const baseX = t.gx * (TOWER_W + 4);
                const baseY = t.gy * (DEPTH + 4);
                const top = iso(baseX, baseY, t.height);
                const topR = iso(baseX + TOWER_W, baseY, t.height);
                const topRB = iso(baseX + TOWER_W, baseY + DEPTH, t.height);
                const topLB = iso(baseX, baseY + DEPTH, t.height);
                const bot = iso(baseX, baseY, 0);
                const botR = iso(baseX + TOWER_W, baseY, 0);
                const botRB = iso(baseX + TOWER_W, baseY + DEPTH, 0);

                // Three visible faces of the tower
                const faceFront = `${bot.sx},${bot.sy} ${botR.sx},${botR.sy} ${topR.sx},${topR.sy} ${top.sx},${top.sy}`;
                const faceRight = `${botR.sx},${botR.sy} ${botRB.sx},${botRB.sy} ${topRB.sx},${topRB.sy} ${topR.sx},${topR.sy}`;
                const faceTop = `${top.sx},${top.sy} ${topR.sx},${topR.sy} ${topRB.sx},${topRB.sy} ${topLB.sx},${topLB.sy}`;

                const isHovered = hovered?.recipient.name === t.recipient.name;
                const baseColor = t.color;
                const frontFill = isHovered ? '#000' : baseColor;
                const sideFill = isHovered ? '#222' : darken(baseColor, 0.3);
                const topFill = isHovered ? '#fff' : lighten(baseColor, 0.2);

                return (
                  <g
                    key={t.recipient.name + t.gx + t.gy}
                    onMouseEnter={() => setHovered(t)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => t.recipient.gs_id && window.open(`/entity/${t.recipient.gs_id}`, '_blank')}
                    style={{ cursor: t.recipient.gs_id ? 'pointer' : 'default' }}
                  >
                    <polygon points={faceRight} fill={sideFill} stroke="#000" strokeWidth={0.5} />
                    <polygon points={faceFront} fill={frontFill} stroke="#000" strokeWidth={0.5} />
                    <polygon points={faceTop} fill={topFill} stroke="#000" strokeWidth={0.5} />
                    {/* Spotlight label for towers > $100M */}
                    {t.isSpotlight && (
                      <text
                        x={top.sx + TOWER_W / 2 * ISO_X}
                        y={top.sy - 6}
                        fontSize={8}
                        fontWeight="bold"
                        textAnchor="middle"
                        fill="#000"
                        style={{ fontFamily: 'monospace', pointerEvents: 'none' }}
                      >
                        {fmtMoney(t.recipient.total)}
                      </text>
                    )}
                  </g>
                );
              })}

            {/* State labels — large, anchored at the front-left corner of each state block */}
            {STATES_ORDER.map(stateCode => {
              const stateKey = stateCode ?? 'UNK';
              const stateTowers = towers.filter(t => (t.recipient.state || 'UNK') === stateKey);
              if (stateTowers.length === 0) return null;
              const minGx = Math.min(...stateTowers.map(t => t.gx));
              const minGy = Math.min(...stateTowers.map(t => t.gy));
              const maxGy = Math.max(...stateTowers.map(t => t.gy));
              // Label sits BELOW each block, at front-left corner (in iso space)
              const labelGx = minGx * (TOWER_W + 4);
              const labelGy = (maxGy + 1.2) * (DEPTH + 4);
              const { sx, sy } = iso(labelGx, labelGy, 0);
              return (
                <g key={stateKey}>
                  {/* Background pill */}
                  <rect
                    x={sx - 6}
                    y={sy + 6}
                    width={48}
                    height={20}
                    fill="#121212"
                    stroke="#F0C020"
                    strokeWidth={2}
                  />
                  <text
                    x={sx + 18}
                    y={sy + 21}
                    fontSize={13}
                    fontWeight="900"
                    textAnchor="middle"
                    fill="#F0C020"
                    style={{ fontFamily: 'monospace', letterSpacing: '0.15em' }}
                  >
                    {stateKey}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-bauhaus-black text-white border-4 border-bauhaus-yellow px-4 py-3 max-w-md pointer-events-none shadow-xl">
          <div className="text-[10px] font-mono uppercase tracking-widest text-bauhaus-yellow">
            {LANE_LABEL[hovered.recipient.lane]} · {hovered.recipient.state || 'UNK'}
          </div>
          <div className="font-black text-lg leading-tight mt-1">{hovered.recipient.name}</div>
          <div className="text-xs font-mono mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="text-zinc-400">Total received</div>
            <div className="text-right font-bold text-bauhaus-yellow">{fmtMoney(hovered.recipient.total)}</div>
            <div className="text-zinc-400">Grants</div>
            <div className="text-right">{hovered.recipient.grant_count}</div>
            <div className="text-zinc-400">Years active</div>
            <div className="text-right">{hovered.recipient.first_year ?? '?'}–{hovered.recipient.last_year ?? '?'}</div>
          </div>
          {hovered.recipient.gs_id && (
            <div className="text-[10px] font-mono mt-2 text-zinc-400">Click → entity page</div>
          )}
        </div>
      )}
    </div>
  );
}

function darken(hex: string, factor: number) {
  const { r, g, b } = parseHex(hex);
  return rgbToHex(Math.round(r * (1 - factor)), Math.round(g * (1 - factor)), Math.round(b * (1 - factor)));
}
function lighten(hex: string, factor: number) {
  const { r, g, b } = parseHex(hex);
  return rgbToHex(
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
function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
