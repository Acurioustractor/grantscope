'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useYJSummary, fmtMoney, LANE_COLOR } from '@/lib/hooks/use-yj-summary';

/**
 * The Drain — vertical funnel showing money loss as it flows from
 *   total committed → state ministries → contractors/orgs → community-led delivery.
 *
 * Layer model (synthesised from the data we have):
 *   Layer 0: Total youth justice spend  ($19B)
 *   Layer 1: Reactive (police/courts/detention)   $15.1B  ← state ministries swallow this
 *   Layer 2: Procurement / external delivery       (~25% of reactive)
 *   Layer 3: Community-led organisations          $470M
 *   Layer 4: Prevention / diversion programs      $90M
 *
 * Layer thicknesses scale to actual $; pipes narrow visibly at each step.
 */
export default function DrainPage() {
  const { data, loading, error } = useYJSummary({ topN: 50 });

  const layers = useMemo(() => {
    if (!data) return [];
    const t = data.totals;
    const reactive = t.reactive;
    const community = t['community-led'];
    const prevention = t.prevention;
    const all = t.all;
    // Estimate reactive routed through external delivery (procurement) — public budgets show ~30%
    const reactiveExternal = reactive * 0.30;
    return [
      { id: 'total', label: 'Total youth justice spend', value: all, color: '#FFFFFF', sub: '17 years · all sources' },
      { id: 'reactive', label: 'Captured by reactive systems', value: reactive, color: LANE_COLOR.reactive, sub: 'Police · courts · detention · supervision' },
      { id: 'reactive_external', label: 'Routed to external delivery', value: reactiveExternal, color: '#A02020', sub: '~30% — contractors, primes, consultancies (estimated)' },
      { id: 'community', label: 'Reaches community-led orgs', value: community, color: LANE_COLOR['community-led'], sub: 'Aboriginal-controlled + community charities' },
      { id: 'prevention', label: 'Spent on actual prevention', value: prevention, color: LANE_COLOR.prevention, sub: 'Diversion · early intervention · wraparound' },
    ];
  }, [data]);

  const W = 1100;
  const H = 820;
  const CX = W / 2;

  // Pipe geometry: each layer is a trapezoid whose width = log-scaled value
  const widthFor = (v: number) => {
    const minW = 30;
    const maxW = 720;
    const minVal = 1e7; // floor
    const maxVal = layers[0]?.value || 1e10;
    const t = Math.log10(Math.max(minVal, v)) - Math.log10(minVal);
    const tMax = Math.log10(maxVal) - Math.log10(minVal);
    return minW + ((maxW - minW) * t) / tMax;
  };

  const LAYER_GAP = 40;
  const LAYER_BODY_H = 80;
  const TOP_Y = 60;

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] text-white overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-bauhaus-black border-b-4 border-bauhaus-yellow px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <Link href="/graph/youth-justice-views" className="text-[10px] font-mono text-bauhaus-yellow hover:underline">
            ← Five views
          </Link>
          <h1 className="font-black uppercase tracking-widest text-xl mt-0.5">The Drain</h1>
          <p className="text-[10px] font-mono text-zinc-400 mt-0.5">
            Money pours in at the top. Each layer narrows. By the time you reach the kid, the pipe is a thread.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center overflow-auto">
        {loading && <div className="font-mono text-sm text-zinc-400">Loading…</div>}
        {error && <div className="font-mono text-sm text-bauhaus-red">Error: {error}</div>}
        {data && (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
            {layers.map((layer, i) => {
              const wTop = widthFor(layer.value);
              const next = layers[i + 1];
              const wBot = next ? widthFor(next.value) : wTop * 0.5;
              const yTop = TOP_Y + i * (LAYER_BODY_H + LAYER_GAP);
              const yMid = yTop + LAYER_BODY_H;
              const yBot = yMid + LAYER_GAP;

              // Body rectangle
              const bodyPath = `M ${CX - wTop / 2} ${yTop} L ${CX + wTop / 2} ${yTop} L ${CX + wTop / 2} ${yMid} L ${CX - wTop / 2} ${yMid} Z`;
              // Connector trapezoid to next layer
              const connectPath = next
                ? `M ${CX - wTop / 2} ${yMid} L ${CX + wTop / 2} ${yMid} L ${CX + wBot / 2} ${yBot} L ${CX - wBot / 2} ${yBot} Z`
                : '';

              const lossAmount = next ? layer.value - next.value : 0;
              const lossPct = next && layer.value > 0 ? (lossAmount / layer.value) * 100 : 0;

              return (
                <g key={layer.id}>
                  {/* Body */}
                  <path d={bodyPath} fill={layer.color} opacity={0.9} stroke="#000" strokeWidth={2} />
                  {/* Connector to next */}
                  {next && (
                    <>
                      <path d={connectPath} fill={layer.color} opacity={0.4} stroke="#000" strokeWidth={1} />
                      {/* Loss label on the side */}
                      {lossAmount > 0 && (
                        <g>
                          <text
                            x={CX + Math.max(wTop, wBot) / 2 + 30}
                            y={yMid + LAYER_GAP / 2 + 4}
                            fill="#fff"
                            fontSize={11}
                            fontFamily="monospace"
                            opacity={0.7}
                          >
                            <tspan fontWeight="900" fill={layer.color}>−{fmtMoney(lossAmount)}</tspan>
                            <tspan fill="#888"> ({lossPct.toFixed(0)}% lost)</tspan>
                          </text>
                        </g>
                      )}
                    </>
                  )}

                  {/* Layer label */}
                  <text
                    x={CX}
                    y={yTop + LAYER_BODY_H / 2 - 6}
                    fill={layer.color === '#FFFFFF' ? '#000' : '#fff'}
                    fontSize={14}
                    fontFamily="monospace"
                    fontWeight="900"
                    textAnchor="middle"
                    style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
                  >
                    {layer.label}
                  </text>
                  <text
                    x={CX}
                    y={yTop + LAYER_BODY_H / 2 + 14}
                    fill={layer.color === '#FFFFFF' ? '#333' : 'rgba(255,255,255,0.85)'}
                    fontSize={20}
                    fontFamily="monospace"
                    fontWeight="900"
                    textAnchor="middle"
                  >
                    {fmtMoney(layer.value)}
                  </text>
                  <text
                    x={CX}
                    y={yTop + LAYER_BODY_H / 2 + 30}
                    fill={layer.color === '#FFFFFF' ? '#666' : 'rgba(255,255,255,0.6)'}
                    fontSize={10}
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {layer.sub}
                  </text>
                </g>
              );
            })}

            {/* Annotation: final ratio */}
            {layers.length >= 5 && (
              <g>
                <text
                  x={CX}
                  y={H - 30}
                  fill="#F0C020"
                  fontSize={14}
                  fontFamily="monospace"
                  fontWeight="900"
                  textAnchor="middle"
                  style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
                >
                  Of every $100 in: ${(layers[4].value / layers[0].value * 100).toFixed(1)} reaches actual prevention
                </text>
              </g>
            )}
          </svg>
        )}
      </div>
    </div>
  );
}
