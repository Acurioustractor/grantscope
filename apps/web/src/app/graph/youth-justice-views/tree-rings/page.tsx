'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useYJSummary, fmtMoney, LANE_COLOR, LANE_LABEL, type Lane } from '@/lib/hooks/use-yj-summary';

const LANES: Lane[] = ['reactive', 'community-led', 'prevention', 'unclassified'];

interface RingSegment {
  year: number;
  lane: Lane;
  total: number;
  startAngle: number;
  endAngle: number;
  innerR: number;
  outerR: number;
}

export default function TreeRingsPage() {
  const { data, loading, error } = useYJSummary({ topN: 100 });
  const [hovered, setHovered] = useState<RingSegment | null>(null);

  const W = 1100;
  const H = 700;
  const CX = W / 2;
  const CY = H / 2 + 10;
  const INNER_R = 40;
  const OUTER_R = 290;

  const segments = useMemo<RingSegment[]>(() => {
    if (!data) return [];
    const yMin = data.meta.year_range.min;
    const yMax = data.meta.year_range.max;
    const yearCount = yMax - yMin + 1;
    const ringWidth = (OUTER_R - INNER_R) / yearCount;

    const out: RingSegment[] = [];
    for (let y = yMin; y <= yMax; y++) {
      const yearRows = data.by_year_lane.filter(r => r.year === y);
      const yearTotal = yearRows.reduce((acc, r) => acc + r.total, 0);
      if (yearTotal === 0) continue;

      const innerR = INNER_R + (y - yMin) * ringWidth;
      const outerR = innerR + ringWidth - 0.5; // small gap between rings

      let cumAngle = -Math.PI / 2; // start at top
      for (const lane of LANES) {
        const row = yearRows.find(r => r.lane === lane);
        if (!row || row.total === 0) continue;
        const sweep = (row.total / yearTotal) * Math.PI * 2;
        out.push({
          year: y,
          lane,
          total: row.total,
          startAngle: cumAngle,
          endAngle: cumAngle + sweep,
          innerR,
          outerR,
        });
        cumAngle += sweep;
      }
    }
    return out;
  }, [data]);

  const arcPath = (s: RingSegment) => {
    const x1 = CX + s.innerR * Math.cos(s.startAngle);
    const y1 = CY + s.innerR * Math.sin(s.startAngle);
    const x2 = CX + s.outerR * Math.cos(s.startAngle);
    const y2 = CY + s.outerR * Math.sin(s.startAngle);
    const x3 = CX + s.outerR * Math.cos(s.endAngle);
    const y3 = CY + s.outerR * Math.sin(s.endAngle);
    const x4 = CX + s.innerR * Math.cos(s.endAngle);
    const y4 = CY + s.innerR * Math.sin(s.endAngle);
    const sweep = s.endAngle - s.startAngle;
    const largeArc = sweep > Math.PI ? 1 : 0;
    return [
      `M ${x1} ${y1}`,
      `L ${x2} ${y2}`,
      `A ${s.outerR} ${s.outerR} 0 ${largeArc} 1 ${x3} ${y3}`,
      `L ${x4} ${y4}`,
      `A ${s.innerR} ${s.innerR} 0 ${largeArc} 0 ${x1} ${y1}`,
      'Z',
    ].join(' ');
  };

  // Year axis labels (every 4 years on the right side)
  const yearLabels = useMemo(() => {
    if (!data) return [];
    const yMin = data.meta.year_range.min;
    const yMax = data.meta.year_range.max;
    const yearCount = yMax - yMin + 1;
    const ringWidth = (OUTER_R - INNER_R) / yearCount;
    const labels: { year: number; r: number }[] = [];
    for (let y = yMin; y <= yMax; y += 3) {
      labels.push({ year: y, r: INNER_R + (y - yMin) * ringWidth + ringWidth / 2 });
    }
    return labels;
  }, [data]);

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] text-white overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-bauhaus-black border-b-4 border-bauhaus-yellow px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <Link href="/graph/youth-justice-views" className="text-[10px] font-mono text-bauhaus-yellow hover:underline">
            ← Five views
          </Link>
          <h1 className="font-black uppercase tracking-widest text-xl mt-0.5">Tree Rings of Spend</h1>
          <p className="text-[10px] font-mono text-zinc-400 mt-0.5">
            Each ring = one year. Each wedge size = that lane&apos;s share of the year. Watch the red wedge eat the others, ring by ring.
          </p>
        </div>
        <div className="flex gap-3">
          {LANES.map(l => (
            <div key={l} className="flex items-center gap-1.5">
              <span className="w-3 h-3 inline-block border border-white/40" style={{ background: LANE_COLOR[l] }} />
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/80">{LANE_LABEL[l]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center relative">
        {loading && <div className="font-mono text-sm text-zinc-400">Loading rings…</div>}
        {error && <div className="font-mono text-sm text-bauhaus-red">Error: {error}</div>}
        {data && (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
            {/* Center label */}
            <circle cx={CX} cy={CY} r={INNER_R} fill="#0a0a0a" stroke="#444" strokeWidth={1} />
            <text x={CX} y={CY - 4} fill="#fff" fontSize={11} fontFamily="monospace" fontWeight="900" textAnchor="middle"
                  style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Youth
            </text>
            <text x={CX} y={CY + 10} fill="#fff" fontSize={11} fontFamily="monospace" fontWeight="900" textAnchor="middle"
                  style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Justice
            </text>

            {/* Segments */}
            {segments.map((s, i) => {
              const isHovered = hovered &&
                hovered.year === s.year && hovered.lane === s.lane;
              return (
                <path
                  key={`${s.year}-${s.lane}-${i}`}
                  d={arcPath(s)}
                  fill={LANE_COLOR[s.lane]}
                  stroke="#000"
                  strokeWidth={isHovered ? 2 : 0.5}
                  opacity={hovered && !isHovered ? 0.4 : 1}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                />
              );
            })}

            {/* Year tick marks — small, on the 3 o'clock radial outside each ring */}
            {yearLabels.map(({ year, r }) => {
              const tickX = CX + r;
              return (
                <g key={year}>
                  <line x1={tickX} y1={CY - 3} x2={tickX} y2={CY + 3} stroke="#fff" strokeWidth={1} opacity={0.6} />
                </g>
              );
            })}

            {/* Year bookends — both placed outside the OUTER ring to avoid overlap */}
            <text
              x={CX}
              y={CY - OUTER_R - 18}
              fill="#fff"
              fontSize={13}
              fontFamily="monospace"
              fontWeight="900"
              textAnchor="middle"
              style={{ letterSpacing: '0.15em' }}
            >
              {data.meta.year_range.min} → {data.meta.year_range.max}
            </text>

            {/* Radial axis label at 3 o'clock */}
            <text
              x={CX + OUTER_R + 16}
              y={CY + 4}
              fill="#666"
              fontSize={10}
              fontFamily="monospace"
              fontWeight="900"
              textAnchor="start"
              style={{ letterSpacing: '0.15em', textTransform: 'uppercase' }}
            >
              ← oldest · newest →
            </text>
          </svg>
        )}

        {/* Hover tooltip */}
        {hovered && (
          <div className="absolute top-4 right-4 bg-bauhaus-black border-4 border-bauhaus-yellow px-4 py-3 max-w-xs pointer-events-none">
            <div className="text-[10px] font-mono uppercase tracking-widest text-bauhaus-yellow">
              {hovered.year} · {LANE_LABEL[hovered.lane]}
            </div>
            <div className="font-black text-2xl mt-1" style={{ color: LANE_COLOR[hovered.lane] }}>
              {fmtMoney(hovered.total)}
            </div>
          </div>
        )}
      </div>

      {/* Bottom totals strip */}
      {data && (
        <div className="bg-bauhaus-black border-t-4 border-bauhaus-yellow px-6 py-3 flex items-center justify-around font-mono text-xs flex-shrink-0">
          {LANES.map(lane => (
            <div key={lane} className="flex items-center gap-2">
              <span className="w-3 h-3 inline-block border border-white/40" style={{ background: LANE_COLOR[lane] }} />
              <span className="font-black text-base" style={{ color: LANE_COLOR[lane] }}>{fmtMoney(data.totals[lane])}</span>
              <span className="text-zinc-500 uppercase tracking-widest">{LANE_LABEL[lane]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
