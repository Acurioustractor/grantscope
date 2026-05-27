import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

const W = 1080;
const H = 1920;

const REACTIVE_FINAL = 15_100_000_000;
const PREVENTION_FINAL = 85_700_000;
const YEAR_MIN = 2008;
const YEAR_MAX = 2025;

// Per-year cumulative reactive trajectory (approximate from data, normalised to final $15.1B).
// Captures the slow ramp in early years and explosive growth post-2018.
const REACTIVE_CUM_NORM = [
  0.00, 0.02, 0.05, 0.08, 0.11, 0.14, 0.17, 0.21,
  0.26, 0.32, 0.39, 0.47, 0.55, 0.64, 0.74, 0.85,
  0.97, 1.00,
];
// Prevention starts late and stays tiny — most growth in last 5 years.
const PREVENTION_CUM_NORM = [
  0.00, 0.00, 0.00, 0.00, 0.00, 0.01, 0.03, 0.07,
  0.13, 0.22, 0.34, 0.46, 0.61, 0.72, 0.83, 0.94,
  1.00, 1.00,
];

function fmtMoney(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function trajectoryAt(arr: number[], t: number) {
  // t ∈ [0, 1] maps to arr index
  const idx = t * (arr.length - 1);
  const i0 = Math.floor(idx);
  const i1 = Math.min(arr.length - 1, i0 + 1);
  return lerp(arr[i0], arr[i1], idx - i0);
}

export const Tanks: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Title 0-45, year scrub 60-360, hold 360-450
  const titleProgress = spring({ frame: frame - 0, fps, config: { damping: 18 } });
  const tankProgress = spring({ frame: frame - 30, fps, config: { damping: 16 } });

  // Year scrubbing
  const scrubT = interpolate(frame, [60, 360], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const currentYear = Math.round(YEAR_MIN + scrubT * (YEAR_MAX - YEAR_MIN));
  const reactiveNow = REACTIVE_FINAL * trajectoryAt(REACTIVE_CUM_NORM, scrubT);
  const preventionNow = PREVENTION_FINAL * trajectoryAt(PREVENTION_CUM_NORM, scrubT);

  // Geometry
  const TANK_W = 380;
  const TANK_H = 900;
  const LEFT_X = 90;
  const RIGHT_X = W - 90 - TANK_W;
  const TANK_TOP = 480;
  const TANK_BOTTOM = TANK_TOP + TANK_H;

  // Both tanks share REACTIVE_FINAL as their max, so prevention will be a sliver
  const scale = REACTIVE_FINAL * 1.05;
  const reactiveH = (reactiveNow / scale) * TANK_H;
  const preventionH = (preventionNow / scale) * TANK_H;

  // Closing flash 380-450
  const closingProgress = spring({ frame: frame - 380, fps, config: { damping: 20 } });
  const closingPulse = interpolate(
    Math.sin(((frame - 400) / fps) * Math.PI * 2),
    [-1, 1], [0.96, 1.04],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const ratio = preventionNow > 0 ? Math.round(reactiveNow / preventionNow) : 0;

  return (
    <AbsoluteFill style={{ background: '#0a0a0a', fontFamily: 'monospace' }}>
      {/* Title */}
      <div style={{
        position: 'absolute',
        top: 80,
        left: 0,
        right: 0,
        textAlign: 'center',
        opacity: Math.min(1, titleProgress),
        transform: `translateY(${(1 - Math.min(1, titleProgress)) * -20}px)`,
      }}>
        <div style={{ color: '#F0C020', fontSize: 28, fontWeight: 900, letterSpacing: '0.3em' }}>
          CIVICGRAPH · YOUTH JUSTICE
        </div>
        <div style={{ color: '#fff', fontSize: 64, fontWeight: 900, marginTop: 10, letterSpacing: '0.05em' }}>
          REACTIVE vs PREVENTION
        </div>
        <div style={{ color: '#888', fontSize: 26, marginTop: 14, letterSpacing: '0.1em' }}>
          17 YEARS · SAME SCALE · NO TRICKS
        </div>
      </div>

      {/* Year scrub — bottom of header area, well above tanks */}
      <div style={{
        position: 'absolute',
        top: 290,
        left: 0,
        right: 0,
        textAlign: 'center',
        opacity: Math.min(1, tankProgress),
      }}>
        <div style={{ color: '#888', fontSize: 18, letterSpacing: '0.3em' }}>YEAR</div>
        <div style={{ color: '#F0C020', fontSize: 64, fontWeight: 900, lineHeight: 1, marginTop: 4 }}>
          {currentYear}
        </div>
      </div>

      {/* Tanks */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        style={{ position: 'absolute', inset: 0 }}
      >
        <g opacity={Math.min(1, tankProgress)}>
          {/* LEFT TANK — REACTIVE */}
          <rect x={LEFT_X} y={TANK_TOP} width={TANK_W} height={TANK_H} fill="none" stroke="#444" strokeWidth={4} />
          <rect x={LEFT_X} y={TANK_BOTTOM - reactiveH} width={TANK_W} height={reactiveH} fill="#D02020" />
          {reactiveH > 0 && (
            <rect x={LEFT_X} y={TANK_BOTTOM - reactiveH - 4} width={TANK_W} height={8} fill="#fff" opacity={0.4} />
          )}
          <text x={LEFT_X + TANK_W / 2} y={TANK_TOP - 60} fill="#fff" fontSize={42} fontWeight={900} textAnchor="middle"
                style={{ letterSpacing: '0.2em' }}>
            REACTIVE
          </text>
          <text x={LEFT_X + TANK_W / 2} y={TANK_TOP - 25} fill="#D02020" fontSize={20} textAnchor="middle">
            Police · Courts · Detention
          </text>
          <text x={LEFT_X + TANK_W / 2} y={TANK_BOTTOM + 60} fill="#D02020" fontSize={56} fontWeight={900} textAnchor="middle">
            {fmtMoney(reactiveNow)}
          </text>

          {/* RIGHT TANK — PREVENTION */}
          <rect x={RIGHT_X} y={TANK_TOP} width={TANK_W} height={TANK_H} fill="none" stroke="#444" strokeWidth={4} />
          <rect x={RIGHT_X} y={TANK_BOTTOM - preventionH} width={TANK_W} height={preventionH} fill="#1040C0" />
          {preventionH > 0 && (
            <rect x={RIGHT_X} y={TANK_BOTTOM - preventionH - 4} width={TANK_W} height={8} fill="#fff" opacity={0.4} />
          )}
          <text x={RIGHT_X + TANK_W / 2} y={TANK_TOP - 60} fill="#fff" fontSize={42} fontWeight={900} textAnchor="middle"
                style={{ letterSpacing: '0.2em' }}>
            PREVENTION
          </text>
          <text x={RIGHT_X + TANK_W / 2} y={TANK_TOP - 25} fill="#1040C0" fontSize={20} textAnchor="middle">
            Diversion · Early Intervention
          </text>
          <text x={RIGHT_X + TANK_W / 2} y={TANK_BOTTOM + 60} fill="#1040C0" fontSize={56} fontWeight={900} textAnchor="middle">
            {fmtMoney(preventionNow)}
          </text>

          {/* Center "vs" */}
          <text x={W / 2} y={TANK_TOP + TANK_H / 2 - 10} fill="#fff" fontSize={64} fontWeight={900} textAnchor="middle">
            vs
          </text>
          {ratio > 0 && (
            <text x={W / 2} y={TANK_TOP + TANK_H / 2 + 30} fill="#F0C020" fontSize={28} fontWeight={900} textAnchor="middle">
              {ratio}× more
            </text>
          )}
        </g>
      </svg>

      {/* Closing flash */}
      {closingProgress > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 90,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: Math.min(1, closingProgress),
          transform: `scale(${closingProgress >= 1 ? closingPulse : closingProgress})`,
          transformOrigin: 'center',
        }}>
          <div style={{ color: '#fff', fontSize: 40, fontWeight: 900, letterSpacing: '0.1em' }}>
            FOR EVERY $1 ON PREVENTION
          </div>
          <div style={{ color: '#D02020', fontSize: 96, fontWeight: 900, marginTop: 10 }}>
            ${ratio}
          </div>
          <div style={{ color: '#fff', fontSize: 32, fontWeight: 900, letterSpacing: '0.1em', marginTop: 4 }}>
            ON LOCKING KIDS UP
          </div>
        </div>
      )}

      {/* Footer */}
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
