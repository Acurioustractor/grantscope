import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { goodsImpactData, type GoodsImpactData } from './goodsImpactData';

// Goods impact film. 60s, vertical 1080x1920. Type-driven: no community footage,
// no invented imagery. Every number traces to goodsImpactData (sourced).
// Palette: stone + emerald (ACT visual system). Real Utopia photos can be layered
// behind later scenes once consent for that use is confirmed.

const STONE_900 = '#1c1917';
const STONE_800 = '#292524';
const STONE_100 = '#f5f5f4';
const STONE_400 = '#a8a29e';
const EMERALD = '#10b981';
const FONT = 'Geist, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const fmt = (n: number) => n.toLocaleString('en-AU');

const fadeIn = (frame: number, start = 0, dur = 18) =>
  interpolate(frame, [start, start + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

// Scene wrapper: fades in at start, out near the end of its own sequence window.
const Scene: React.FC<{ durationInFrames: number; children: React.ReactNode }> = ({ durationInFrames, children }) => {
  const frame = useCurrentFrame();
  const opacity = Math.min(fadeIn(frame, 0, 18), fadeIn(durationInFrames - frame, 0, 18));
  return <AbsoluteFill style={{ opacity, justifyContent: 'center', alignItems: 'center', padding: 96 }}>{children}</AbsoluteFill>;
};

const Kicker: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ color: EMERALD, fontSize: 38, fontWeight: 800, letterSpacing: 6, textTransform: 'uppercase' }}>{children}</div>
);

const CountUp: React.FC<{ value: number; suffix?: string }> = ({ value, suffix }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 50 });
  const n = Math.round(interpolate(p, [0, 1], [0, value]));
  return (
    <div style={{ color: STONE_100, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
      <div style={{ fontSize: 210 }}>{fmt(n)}</div>
      {suffix ? <div style={{ fontSize: 70, color: STONE_400, fontWeight: 700, marginTop: 16 }}>{suffix}</div> : null}
    </div>
  );
};

const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const y = interpolate(spring({ frame, fps, config: { damping: 200 }, durationInFrames: 40 }), [0, 1], [40, 0]);
  return (
    <div style={{ transform: `translateY(${y}px)`, textAlign: 'center' }}>
      <div style={{ color: STONE_100, fontSize: 130, fontWeight: 800, lineHeight: 1 }}>Goods<br />on Country</div>
      <div style={{ color: EMERALD, fontSize: 46, fontWeight: 700, marginTop: 40 }}>Beds and washing machines, On Country.</div>
    </div>
  );
};

const BigStat: React.FC<{ kicker: string; value: number; suffix: string; sub?: string }> = ({ kicker, value, suffix, sub }) => (
  <div style={{ textAlign: 'center' }}>
    <Kicker>{kicker}</Kicker>
    <div style={{ height: 40 }} />
    <CountUp value={value} suffix={suffix} />
    {sub ? <div style={{ color: STONE_400, fontSize: 48, fontWeight: 600, marginTop: 36 }}>{sub}</div> : null}
  </div>
);

const Communities: React.FC<{ data: GoodsImpactData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const top = Math.max(...data.communities.map((c) => c.beds));
  return (
    <div style={{ width: '100%' }}>
      <Kicker>Where the beds go next</Kicker>
      <div style={{ height: 56 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        {data.communities.map((c, i) => {
          const start = 20 + i * 22;
          const reveal = fadeIn(frame, start, 16);
          const barW = interpolate(reveal, [0, 1], [0, (c.beds / top) * 100]);
          return (
            <div key={c.name} style={{ opacity: reveal }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', color: STONE_100, fontSize: 44, fontWeight: 700 }}>
                <span>{c.name} <span style={{ color: STONE_400, fontSize: 30 }}>{c.state}</span></span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(c.beds)}</span>
              </div>
              <div style={{ height: 14, background: STONE_800, borderRadius: 7, marginTop: 12 }}>
                <div style={{ height: '100%', width: `${barW}%`, background: EMERALD, borderRadius: 7 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Closing: React.FC = () => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ color: STONE_100, fontSize: 72, fontWeight: 800, lineHeight: 1.15 }}>Built On Country.<br />Owned On Country.</div>
    <div style={{ color: EMERALD, fontSize: 44, fontWeight: 700, marginTop: 48 }}>Goods on Country</div>
  </div>
);

export const GoodsImpact: React.FC<{ data?: GoodsImpactData }> = ({ data = goodsImpactData }) => {
  return (
    <AbsoluteFill style={{ background: STONE_900, fontFamily: FONT }}>
      <Sequence durationInFrames={120}><Scene durationInFrames={120}><Title /></Scene></Sequence>
      <Sequence from={120} durationInFrames={240}><Scene durationInFrames={240}><BigStat kicker="The need" value={data.need.beds} suffix="beds" sub={`across ${data.need.communities} priority communities`} /></Scene></Sequence>
      <Sequence from={360} durationInFrames={240}><Scene durationInFrames={240}><BigStat kicker="Delivered so far" value={data.delivered.beds} suffix="beds" sub={`and ${data.delivered.washers} washing machines`} /></Scene></Sequence>
      <Sequence from={600} durationInFrames={240}><Scene durationInFrames={240}><BigStat kicker="The gap" value={data.gap.beds} suffix="beds to go" sub="this is the job" /></Scene></Sequence>
      <Sequence from={840} durationInFrames={600}><Scene durationInFrames={600}><Communities data={data} /></Scene></Sequence>
      <Sequence from={1440} durationInFrames={360}><Scene durationInFrames={360}><Closing /></Scene></Sequence>
    </AbsoluteFill>
  );
};
