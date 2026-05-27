import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';

// Vertical 1080×1920 (TikTok / Reels / Shorts)
const W = 1080;
const H = 1920;
const CX = W / 2;

const LAYERS = [
  { id: 'total',       label: 'TOTAL YOUTH JUSTICE SPEND',  value: 19_000_000_000, sub: '17 years · all sources',                       color: '#FFFFFF', textOnLight: true },
  { id: 'reactive',    label: 'CAPTURED BY REACTIVE SYSTEMS', value: 15_100_000_000, sub: 'Police · courts · detention · supervision',  color: '#D02020' },
  { id: 'external',    label: 'ROUTED TO EXTERNAL DELIVERY', value:  4_500_000_000,  sub: '~30% — contractors, primes, consultancies',  color: '#A02020' },
  { id: 'community',   label: 'REACHES COMMUNITY-LED ORGS',  value:    472_000_000,  sub: 'Aboriginal-controlled + community charities', color: '#F0C020', textOnLight: true },
  { id: 'prevention',  label: 'SPENT ON ACTUAL PREVENTION',  value:     85_700_000,  sub: 'Diversion · early intervention · wraparound', color: '#1040C0' },
];

function fmtMoney(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

// Pipe widths: scale by sqrt of value to keep visible disparity but readable
function widthFor(v: number): number {
  const minW = 80;
  const maxW = 900;
  const minVal = 1e7;
  const maxVal = LAYERS[0].value;
  const t = Math.log10(Math.max(minVal, v)) - Math.log10(minVal);
  const tMax = Math.log10(maxVal) - Math.log10(minVal);
  return minW + ((maxW - minW) * t) / tMax;
}

const LAYER_BODY_H = 180;
const LAYER_GAP = 90;
const TOP_Y = 220;

export const Drain: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Each layer reveals in turn, with overlap
  // Layer i starts at frame i*30, lasts 30 frames to fully appear
  const layerProgress = (i: number) => {
    const start = 18 + i * 36;
    return spring({
      frame: frame - start,
      fps,
      config: { damping: 18, mass: 0.7 },
    });
  };

  // Money counter ticks up 0→value over 30 frames after layer reveal
  const counterValue = (i: number, target: number) => {
    const start = 24 + i * 36;
    const t = interpolate(frame - start, [0, 28], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    // Ease-out for nicer counter feel
    const eased = 1 - Math.pow(1 - t, 3);
    return target * eased;
  };

  // Closing line reveal at frame 240
  const closingProgress = spring({ frame: frame - 240, fps, config: { damping: 20 } });
  const ratioPulse = interpolate(
    Math.sin(((frame - 280) / fps) * Math.PI * 2),
    [-1, 1], [0.96, 1.04],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ background: '#0a0a0a', fontFamily: 'monospace' }}>
      {/* Top branding */}
      <div style={{
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        textAlign: 'center',
        color: '#F0C020',
        fontWeight: 900,
        letterSpacing: '0.3em',
        fontSize: 28,
      }}>
        CIVICGRAPH · YOUTH JUSTICE
      </div>
      <div style={{
        position: 'absolute',
        top: 110,
        left: 0,
        right: 0,
        textAlign: 'center',
        color: '#fff',
        fontWeight: 900,
        fontSize: 56,
        letterSpacing: '0.05em',
      }}>
        WHERE THE MONEY LANDS
      </div>

      {/* Funnel */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        style={{ position: 'absolute', inset: 0 }}
      >
        {LAYERS.map((layer, i) => {
          const progress = Math.min(1, Math.max(0, layerProgress(i)));
          if (progress <= 0.01) return null;

          const next = LAYERS[i + 1];
          const wTop = widthFor(layer.value);
          const wBot = next ? widthFor(next.value) : wTop * 0.5;
          const yTop = TOP_Y + i * (LAYER_BODY_H + LAYER_GAP);
          const yMid = yTop + LAYER_BODY_H;
          const yBot = yMid + LAYER_GAP;

          const bodyOpacity = progress;
          const bodyOffset = (1 - progress) * 30;

          const bodyPath = `M ${CX - wTop / 2} ${yTop + bodyOffset} L ${CX + wTop / 2} ${yTop + bodyOffset} L ${CX + wTop / 2} ${yMid + bodyOffset} L ${CX - wTop / 2} ${yMid + bodyOffset} Z`;
          const connectPath = next
            ? `M ${CX - wTop / 2} ${yMid + bodyOffset} L ${CX + wTop / 2} ${yMid + bodyOffset} L ${CX + wBot / 2} ${yBot} L ${CX - wBot / 2} ${yBot} Z`
            : '';

          const lossAmount = next ? layer.value - next.value : 0;
          const lossPct = next && layer.value > 0 ? (lossAmount / layer.value) * 100 : 0;

          // Connector reveals on a delay after the body
          const nextProgress = next ? Math.min(1, Math.max(0, layerProgress(i + 1))) : 0;
          const connectorOpacity = nextProgress * 0.9;

          return (
            <g key={layer.id} opacity={bodyOpacity}>
              <path d={bodyPath} fill={layer.color} stroke="#000" strokeWidth={3} />

              {/* Body label */}
              <text
                x={CX}
                y={yTop + bodyOffset + LAYER_BODY_H / 2 - 18}
                fill={layer.textOnLight ? '#000' : '#fff'}
                fontSize={26}
                fontWeight={900}
                textAnchor="middle"
                style={{ letterSpacing: '0.1em' }}
              >
                {layer.label}
              </text>
              <text
                x={CX}
                y={yTop + bodyOffset + LAYER_BODY_H / 2 + 32}
                fill={layer.textOnLight ? '#222' : '#fff'}
                fontSize={56}
                fontWeight={900}
                textAnchor="middle"
              >
                {fmtMoney(counterValue(i, layer.value))}
              </text>
              <text
                x={CX}
                y={yTop + bodyOffset + LAYER_BODY_H / 2 + 60}
                fill={layer.textOnLight ? '#444' : 'rgba(255,255,255,0.7)'}
                fontSize={20}
                textAnchor="middle"
              >
                {layer.sub}
              </text>

              {/* Connector — only after next layer starts revealing */}
              {next && (
                <g opacity={connectorOpacity}>
                  <path d={connectPath} fill={layer.color} opacity={0.5} stroke="#000" strokeWidth={2} />
                  {/* Loss label — anchored at right edge so it never overflows */}
                  {lossAmount > 0 && (
                    <>
                      <text
                        x={W - 30}
                        y={yMid + LAYER_GAP / 2 + 4}
                        fill={layer.color}
                        fontSize={32}
                        fontWeight={900}
                        textAnchor="end"
                      >
                        −{fmtMoney(lossAmount)}
                      </text>
                      <text
                        x={W - 30}
                        y={yMid + LAYER_GAP / 2 + 32}
                        fill="#888"
                        fontSize={20}
                        textAnchor="end"
                      >
                        ({lossPct.toFixed(0)}% lost)
                      </text>
                    </>
                  )}
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Closing line */}
      <div style={{
        position: 'absolute',
        bottom: 90,
        left: 0,
        right: 0,
        textAlign: 'center',
        opacity: Math.min(1, closingProgress),
        transform: `scale(${closingProgress >= 1 ? ratioPulse : closingProgress})`,
        transformOrigin: 'center',
      }}>
        <div style={{ color: '#F0C020', fontSize: 36, fontWeight: 900, letterSpacing: '0.1em', marginBottom: 12 }}>
          OF EVERY $100 IN
        </div>
        <div style={{ color: '#fff', fontSize: 96, fontWeight: 900, letterSpacing: '0.02em' }}>
          $0.50
        </div>
        <div style={{ color: '#1040C0', fontSize: 32, fontWeight: 900, letterSpacing: '0.1em', marginTop: 12 }}>
          REACHES ACTUAL PREVENTION
        </div>
      </div>

      {/* Footer source */}
      <div style={{
        position: 'absolute',
        bottom: 24,
        left: 0,
        right: 0,
        textAlign: 'center',
        color: '#555',
        fontSize: 18,
        letterSpacing: '0.15em',
      }}>
        DATA · CIVICGRAPH.ORG · justice_funding 2008–2025
      </div>
    </AbsoluteFill>
  );
};
