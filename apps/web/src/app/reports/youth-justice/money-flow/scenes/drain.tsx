'use client';

import { fmtMoney, LANE_COLOR, type YJSummary } from '@/lib/hooks/use-yj-summary';
import { useScrollProgress } from '../hooks';

interface DrainLayer {
  id: string;
  label: string;
  sub: string;
  color: string;
  textOnLight?: boolean;
  value: number;
}

export function DrainScene({ data }: { data: YJSummary }) {
  const { ref, progress } = useScrollProgress<HTMLDivElement>();

  const t = data.totals;
  const reactiveExternalShare = 0.3; // estimate — same as the drain page

  const layers: DrainLayer[] = [
    {
      id: 'total',
      label: 'TOTAL YOUTH JUSTICE SPEND',
      sub: '17 years · all sources',
      color: '#FFFFFF',
      textOnLight: true,
      value: t.all,
    },
    {
      id: 'reactive',
      label: 'CAPTURED BY REACTIVE SYSTEMS',
      sub: 'Police · Courts · Detention · Supervision',
      color: LANE_COLOR.reactive,
      value: t.reactive,
    },
    {
      id: 'external',
      label: 'ROUTED TO EXTERNAL DELIVERY',
      sub: '~30% — contractors, primes, consultancies',
      color: '#A02020',
      value: t.reactive * reactiveExternalShare,
    },
    {
      id: 'community',
      label: 'REACHES COMMUNITY-LED ORGS',
      sub: 'Aboriginal-controlled · community charities',
      color: LANE_COLOR['community-led'],
      textOnLight: true,
      value: t['community-led'],
    },
    {
      id: 'prevention',
      label: 'SPENT ON ACTUAL PREVENTION',
      sub: 'Diversion · early intervention · wraparound',
      color: LANE_COLOR.prevention,
      value: t.prevention,
    },
  ];

  // Each layer reveals at a fraction of scroll progress.
  // Scene goes from p=0..1 across ~340vh of scroll.
  // Layers reveal between p=0.10 and p=0.85.
  const revealThresholds = [0.10, 0.25, 0.40, 0.55, 0.70];
  const closingThreshold = 0.88;

  // Width scaling: log scale so the smallest layer is still visible
  const minVal = 1e7;
  const maxVal = layers[0].value;
  const widthFor = (v: number) => {
    const tt = Math.log10(Math.max(minVal, v)) - Math.log10(minVal);
    const ttMax = Math.log10(maxVal) - Math.log10(minVal);
    return 80 + (820 * tt) / ttMax; // 80..900
  };

  return (
    <section ref={ref} className="relative" style={{ minHeight: '420vh' }}>
      <div className="sticky top-0 h-screen w-full flex items-center bg-[#0a0a0a] overflow-hidden">
        <div className="w-full max-w-7xl mx-auto px-6 grid md:grid-cols-12 gap-8 items-center">
          {/* Left narrative — sticky text that updates with progress */}
          <div className="md:col-span-4 space-y-6">
            <div className="text-[10px] uppercase tracking-[0.3em] text-bauhaus-yellow">
              Chapter 02 · The drain
            </div>
            <h2 className="font-black text-3xl md:text-5xl leading-tight">
              Money pours in.
              <br />
              <span className="text-white/50">Almost none</span> reaches the kid.
            </h2>
            <div className="text-base text-white/70 leading-relaxed space-y-3">
              <p>
                Watch the pipe narrow at every layer. Each step is a real loss — money that{' '}
                <em>could</em> have gone to prevention or community-led work, but didn&apos;t.
              </p>
            </div>

            {/* Active layer card — updates as user scrolls */}
            {progress > 0.1 && (() => {
              // Find currently active layer
              let activeIdx = 0;
              for (let i = 0; i < revealThresholds.length; i++) {
                if (progress >= revealThresholds[i]) activeIdx = i;
              }
              const layer = layers[activeIdx];
              const next = layers[activeIdx + 1];
              const lossAmount = next ? layer.value - next.value : 0;
              const lossPct = next ? (lossAmount / layer.value) * 100 : 0;
              return (
                <div
                  key={activeIdx}
                  className="border-l-4 pl-4 py-3 transition-all duration-500"
                  style={{ borderColor: layer.color }}
                >
                  <div className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-1">
                    Layer {activeIdx + 1}
                  </div>
                  <div className="font-black text-xl tracking-tight" style={{ color: layer.color }}>
                    {layer.label}
                  </div>
                  <div className="font-black text-3xl md:text-4xl mt-1 tabular-nums">
                    {fmtMoney(layer.value)}
                  </div>
                  {next && lossAmount > 0 && (
                    <div className="text-sm text-white/50 mt-2 font-mono">
                      <span style={{ color: layer.color }}>−{fmtMoney(lossAmount)}</span>{' '}
                      lost before reaching the next layer
                      <span className="text-white/30"> ({lossPct.toFixed(0)}%)</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Right — the funnel SVG — 8 cols */}
          <div className="md:col-span-8 h-[85vh] max-h-[820px] flex items-center justify-center">
            <svg viewBox="0 0 1000 800" className="w-full h-full">
              {layers.map((layer, i) => {
                const reveal = progress > revealThresholds[i] ? 1 : 0;
                if (reveal === 0) return null;

                const next = layers[i + 1];
                const wTop = widthFor(layer.value);
                const wBot = next ? widthFor(next.value) : wTop * 0.5;
                const yTop = 60 + i * 140;
                const yMid = yTop + 90;
                const yBot = yMid + 50;
                const cx = 500;

                const bodyPath = `M ${cx - wTop / 2} ${yTop} L ${cx + wTop / 2} ${yTop} L ${cx + wTop / 2} ${yMid} L ${cx - wTop / 2} ${yMid} Z`;
                const connectPath = next
                  ? `M ${cx - wTop / 2} ${yMid} L ${cx + wTop / 2} ${yMid} L ${cx + wBot / 2} ${yBot} L ${cx - wBot / 2} ${yBot} Z`
                  : '';

                const lossAmount = next ? layer.value - next.value : 0;
                const lossPct = next && layer.value > 0 ? (lossAmount / layer.value) * 100 : 0;

                const animOffset = reveal === 1 ? 0 : 30;
                const animOpacity = reveal;

                return (
                  <g
                    key={layer.id}
                    style={{
                      opacity: animOpacity,
                      transform: `translateY(${animOffset}px)`,
                      transition: 'all 700ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    <path d={bodyPath} fill={layer.color} stroke="#000" strokeWidth={2} />
                    {next && (
                      <path d={connectPath} fill={layer.color} opacity={0.45} stroke="#000" strokeWidth={1} />
                    )}

                    <text
                      x={cx}
                      y={yTop + 35}
                      fill={layer.textOnLight ? '#000' : '#fff'}
                      fontSize={16}
                      fontWeight={900}
                      textAnchor="middle"
                      style={{ letterSpacing: '0.1em' }}
                    >
                      {layer.label}
                    </text>
                    <text
                      x={cx}
                      y={yTop + 65}
                      fill={layer.textOnLight ? '#222' : '#fff'}
                      fontSize={32}
                      fontWeight={900}
                      textAnchor="middle"
                    >
                      {fmtMoney(layer.value)}
                    </text>
                    <text
                      x={cx}
                      y={yTop + 82}
                      fill={layer.textOnLight ? '#444' : 'rgba(255,255,255,0.65)'}
                      fontSize={11}
                      textAnchor="middle"
                    >
                      {layer.sub}
                    </text>

                    {/* Loss label, anchored at right */}
                    {next && lossAmount > 0 && (
                      <g>
                        <text
                          x={970}
                          y={yMid + 26}
                          fill={layer.color}
                          fontSize={20}
                          fontWeight={900}
                          textAnchor="end"
                        >
                          −{fmtMoney(lossAmount)}
                        </text>
                        <text
                          x={970}
                          y={yMid + 44}
                          fill="#888"
                          fontSize={11}
                          textAnchor="end"
                        >
                          ({lossPct.toFixed(0)}% lost)
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Closing line */}
              {progress > closingThreshold && (
                <g
                  style={{
                    opacity: Math.min(1, (progress - closingThreshold) / 0.05),
                    transition: 'opacity 500ms ease',
                  }}
                >
                  <text
                    x={500}
                    y={780}
                    fill="#F0C020"
                    fontSize={18}
                    fontWeight={900}
                    textAnchor="middle"
                    style={{ letterSpacing: '0.1em' }}
                  >
                    OF EVERY $100 IN: ${(t.prevention / t.all * 100).toFixed(2)} REACHES PREVENTION
                  </text>
                </g>
              )}
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
