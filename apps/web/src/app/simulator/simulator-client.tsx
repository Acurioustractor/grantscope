'use client';

import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Types
interface SectorRow { sector: string; count: number; avgGiving: number; totalGiving: number }
interface GeoRow { region: string; code: string; count: number; totalGiving: number }
interface TierRow { tier: string; count: number; avgGiving: number; totalGiving: number }
interface SourceRow { source: string; count: number; totalFunding: number; type: string }

interface Props {
  sectors: SectorRow[];
  geography: GeoRow[];
  tiers: TierRow[];
  sources: SourceRow[];
}

// Win rates (heuristic, not DB-derived)
const WIN_RATES: Record<string, { label: string; base: number; avgSize: number }> = {
  foundation_small: { label: 'Small Foundation', base: 0.25, avgSize: 30000 },
  foundation_medium: { label: 'Medium Foundation', base: 0.18, avgSize: 75000 },
  foundation_large: { label: 'Large Foundation', base: 0.12, avgSize: 200000 },
  government_local: { label: 'Local Government', base: 0.35, avgSize: 15000 },
  government_state: { label: 'State Government', base: 0.15, avgSize: 100000 },
  government_federal: { label: 'Federal (ARC/NHMRC)', base: 0.08, avgSize: 500000 },
  arts_council: { label: 'Arts Council', base: 0.22, avgSize: 40000 },
  corporate: { label: 'Corporate Foundation', base: 0.20, avgSize: 25000 },
};

const PRESETS: Record<string, { sector: string; region: string }> = {
  overview: { sector: 'all', region: 'all' },
  act: { sector: 'Community', region: 'all' },
  indigenous: { sector: 'Indigenous', region: 'all' },
  arts: { sector: 'Arts', region: 'all' },
  environment: { sector: 'Environment', region: 'all' },
  health: { sector: 'Health', region: 'all' },
};

const COLORS = ['#1040C0', '#D02020', '#F0C020', '#059669', '#7c3aed', '#f97316', '#121212', '#777777', '#ef4444', '#22c55e', '#a78bfa', '#f97316'];
const TIER_COLORS = ['#059669', '#7c3aed', '#F0C020', '#f97316', '#777777'];

function fmt(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return n.toFixed(0);
}

function fmtDollar(n: number): string { return '$' + fmt(n); }

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bauhaus-black text-white p-2 border-0 text-xs font-bold">
      <div>{label}</div>
      <div className="text-bauhaus-yellow tabular-nums">{fmtDollar(payload[0].value)}</div>
    </div>
  );
}

function BarRow({ label, value, max, color, suffix }: { label: string; value: number; max: number; color: string; suffix?: string }) {
  const pct = max > 0 ? (value / max * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 text-[11px] font-bold text-bauhaus-muted truncate text-right">{label}</div>
      <div className="flex-1 h-5 bg-bauhaus-canvas border-2 border-bauhaus-black/20 relative">
        <div
          className="h-full absolute top-0 left-0 flex items-center pl-1.5"
          style={{ width: `${Math.max(2, pct)}%`, background: color }}
        >
          <span className="text-[10px] font-black text-white whitespace-nowrap">{fmtDollar(value)}</span>
        </div>
      </div>
      {suffix && <div className="w-16 text-[10px] text-bauhaus-muted font-bold text-right">{suffix}</div>}
    </div>
  );
}

function ChartCard({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border-4 border-bauhaus-black p-5 ${className}`}>
      <h3 className="text-xs font-black text-bauhaus-black uppercase tracking-widest mb-1">{title}</h3>
      {subtitle && <p className="text-[11px] text-bauhaus-muted font-medium mb-3">{subtitle}</p>}
      {children}
    </div>
  );
}

export function SimulatorClient({ sectors, geography, tiers, sources }: Props) {
  const [activeTab, setActiveTab] = useState<'flow' | 'landscape' | 'simulator' | 'gaps'>('flow');
  const [activePreset, setActivePreset] = useState('overview');
  const [sector, setSector] = useState('all');
  const [region, setRegion] = useState('all');
  const [appsPerYear, setAppsPerYear] = useState(12);
  const [avgGrantTarget, setAvgGrantTarget] = useState(50000);
  const [alignmentScore, setAlignmentScore] = useState(0.70);
  const [diversity, setDiversity] = useState(3);
  const [simCount, setSimCount] = useState(10000);

  const handlePreset = (key: string) => {
    setActivePreset(key);
    setSector(PRESETS[key].sector);
    setRegion(PRESETS[key].region);
  };

  const filteredSectors = sector === 'all' ? sectors : sectors.filter(s => s.sector.toLowerCase() === sector.toLowerCase());
  const filteredGeo = region === 'all' ? geography : geography.filter(g => g.code === region || g.region === region);

  // Monte Carlo simulation
  const simResults = useMemo(() => {
    const N = simCount;
    const sourceKeys = Object.keys(WIN_RATES);
    const selectedSources = sourceKeys.slice(0, Math.min(diversity, sourceKeys.length));
    const revenues = new Float64Array(N);
    const appsPerSource = Math.ceil(appsPerYear / selectedSources.length);

    for (let i = 0; i < N; i++) {
      let totalRev = 0;
      for (const key of selectedSources) {
        const src = WIN_RATES[key];
        const adjustedRate = Math.min(0.95, src.base * (0.5 + alignmentScore));
        for (let a = 0; a < appsPerSource; a++) {
          if (Math.random() < adjustedRate) {
            const logMean = Math.log(src.avgSize) - 0.25;
            const size = Math.exp(logMean + 0.5 * (Math.random() + Math.random() + Math.random() - 1.5));
            totalRev += Math.max(0, size);
          }
        }
      }
      revenues[i] = totalRev;
    }

    const sorted = Array.from(revenues).sort((a, b) => a - b);
    const mean = sorted.reduce((a, b) => a + b, 0) / N;
    const p10 = sorted[Math.floor(N * 0.1)];
    const p25 = sorted[Math.floor(N * 0.25)];
    const p50 = sorted[Math.floor(N * 0.5)];
    const p75 = sorted[Math.floor(N * 0.75)];
    const p90 = sorted[Math.floor(N * 0.9)];
    const winCount = sorted.filter(x => x > 0).length;
    const avgWinRate = winCount / N;

    // Histogram
    const bins = 30;
    const maxRev = sorted[Math.floor(N * 0.98)];
    const binWidth = maxRev / bins;
    const counts = new Array(bins).fill(0);
    for (const r of sorted) {
      const bin = Math.min(bins - 1, Math.floor(r / binWidth));
      if (bin >= 0) counts[bin]++;
    }
    const maxCount = Math.max(...counts);

    const histogram = counts.map((c, i) => ({
      range: `${fmtDollar(i * binWidth)} – ${fmtDollar((i + 1) * binWidth)}`,
      count: c,
      pct: (c / N * 100).toFixed(1),
      height: maxCount > 0 ? (c / maxCount * 100) : 0,
      isMean: Math.floor(mean / binWidth) === i,
    }));

    const winRates = selectedSources.map(key => ({
      label: WIN_RATES[key].label,
      rate: Math.min(0.95, WIN_RATES[key].base * (0.5 + alignmentScore)),
      avgSize: WIN_RATES[key].avgSize,
    }));

    const percentiles = [
      { label: '10th (worst)', value: p10 },
      { label: '25th', value: p25 },
      { label: 'Median', value: p50 },
      { label: '75th', value: p75 },
      { label: '90th (best)', value: p90 },
    ];

    return { mean, p10, p50, p90, avgWinRate, histogram, winRates, percentiles, maxRev, selectedSources };
  }, [appsPerYear, alignmentScore, diversity, simCount]);

  // Gap analysis
  const totalGiving = sectors.reduce((a, b) => a + b.totalGiving, 0);
  const totalCount = sectors.reduce((a, b) => a + b.count, 0);
  const avgPerFoundation = totalCount > 0 ? totalGiving / totalCount : 0;
  const gaps = sectors.map(d => ({
    ...d,
    perFoundation: d.count > 0 ? d.totalGiving / d.count : 0,
    gapRatio: avgPerFoundation > 0 ? (d.count > 0 ? d.totalGiving / d.count : 0) / avgPerFoundation : 1,
  })).sort((a, b) => a.gapRatio - b.gapRatio);

  const regionGaps = geography.map(d => ({
    ...d,
    perFoundation: d.count > 0 ? d.totalGiving / d.count : 0,
  })).sort((a, b) => a.perFoundation - b.perFoundation);

  const tabs = [
    { key: 'flow' as const, label: 'Money Flow' },
    { key: 'landscape' as const, label: 'Funding Landscape' },
    { key: 'simulator' as const, label: 'Grant Simulator' },
    { key: 'gaps' as const, label: 'Gap Analysis' },
  ];

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-2">Interactive</p>
        <h1 className="text-3xl font-black text-bauhaus-black mb-2">Grant Flow Simulator</h1>
        <p className="text-bauhaus-muted font-medium">
          {sectors.reduce((a, b) => a + b.count, 0).toLocaleString()} foundations &middot; {fmtDollar(totalGiving)} tracked
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        {/* Sidebar */}
        <div className="bg-bauhaus-canvas border-4 border-bauhaus-black p-4 space-y-5 lg:sticky lg:top-20 lg:self-start">
          {/* Presets */}
          <div>
            <h3 className="text-[11px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">Presets</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(PRESETS).map(([key]) => (
                <button
                  key={key}
                  onClick={() => handlePreset(key)}
                  className={`px-2 py-1.5 text-[11px] font-black uppercase tracking-wider border-2 border-bauhaus-black transition-all cursor-pointer ${
                    activePreset === key ? 'bg-bauhaus-black text-white' : 'bg-white text-bauhaus-black hover:bg-bauhaus-black/10'
                  }`}
                >
                  {key === 'act' ? 'ACT Focus' : key === 'indigenous' ? 'First Nations' : key.charAt(0).toUpperCase() + key.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Sector */}
          <div>
            <h3 className="text-[11px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">Focus Sector</h3>
            <select
              value={sector}
              onChange={e => { setSector(e.target.value); setActivePreset(''); }}
              className="w-full px-2 py-1.5 text-xs font-bold border-2 border-bauhaus-black bg-white focus:outline-none"
            >
              <option value="all">All Sectors</option>
              {sectors.map(s => (
                <option key={s.sector} value={s.sector}>{s.sector}</option>
              ))}
            </select>
          </div>

          {/* Region */}
          <div>
            <h3 className="text-[11px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">Geography</h3>
            <select
              value={region}
              onChange={e => { setRegion(e.target.value); setActivePreset(''); }}
              className="w-full px-2 py-1.5 text-xs font-bold border-2 border-bauhaus-black bg-white focus:outline-none"
            >
              <option value="all">All Australia</option>
              {geography.map(g => (
                <option key={g.code} value={g.region}>{g.region}</option>
              ))}
            </select>
          </div>

          {/* Simulator controls */}
          <div>
            <h3 className="text-[11px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">Simulator</h3>
            <label className="flex justify-between text-[11px] font-bold text-bauhaus-black mb-1">
              <span>Applications/year</span>
              <span className="text-bauhaus-blue tabular-nums">{appsPerYear}</span>
            </label>
            <input type="range" min={1} max={50} value={appsPerYear} onChange={e => setAppsPerYear(+e.target.value)} className="w-full accent-bauhaus-blue mb-3" />

            <label className="flex justify-between text-[11px] font-bold text-bauhaus-black mb-1">
              <span>Avg grant target</span>
              <span className="text-bauhaus-blue tabular-nums">{fmtDollar(avgGrantTarget)}</span>
            </label>
            <input type="range" min={10000} max={500000} step={5000} value={avgGrantTarget} onChange={e => setAvgGrantTarget(+e.target.value)} className="w-full accent-bauhaus-blue mb-3" />

            <label className="flex justify-between text-[11px] font-bold text-bauhaus-black mb-1">
              <span>Alignment score</span>
              <span className="text-bauhaus-blue tabular-nums">{alignmentScore.toFixed(2)}</span>
            </label>
            <input type="range" min={0.1} max={1.0} step={0.05} value={alignmentScore} onChange={e => setAlignmentScore(+e.target.value)} className="w-full accent-bauhaus-blue mb-3" />

            <label className="flex justify-between text-[11px] font-bold text-bauhaus-black mb-1">
              <span>Portfolio diversity</span>
              <span className="text-bauhaus-blue tabular-nums">{diversity} sources</span>
            </label>
            <input type="range" min={1} max={8} value={diversity} onChange={e => setDiversity(+e.target.value)} className="w-full accent-bauhaus-blue mb-3" />
          </div>

          {/* Monte Carlo */}
          <div>
            <h3 className="text-[11px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">Monte Carlo</h3>
            <label className="flex justify-between text-[11px] font-bold text-bauhaus-black mb-1">
              <span>Simulations</span>
              <span className="text-bauhaus-blue tabular-nums">{simCount.toLocaleString()}</span>
            </label>
            <input type="range" min={1000} max={50000} step={1000} value={simCount} onChange={e => setSimCount(+e.target.value)} className="w-full accent-bauhaus-blue" />
          </div>
        </div>

        {/* Main content */}
        <div>
          {/* Tabs */}
          <div className="flex gap-0 mb-5">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-2 text-xs font-black uppercase tracking-widest border-4 border-r-0 last:border-r-4 border-bauhaus-black transition-all cursor-pointer ${
                  activeTab === t.key ? 'bg-bauhaus-black text-white' : 'bg-white text-bauhaus-black hover:bg-bauhaus-canvas'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* TAB 1: Money Flow */}
          {activeTab === 'flow' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ChartCard title="Foundation Giving by Sector" subtitle={`Total ${fmtDollar(totalGiving)} tracked`} className="lg:col-span-2">
                {filteredSectors.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(200, filteredSectors.length * 32)}>
                    <BarChart data={filteredSectors} layout="vertical" margin={{ left: 10, right: 10 }}>
                      <XAxis type="number" tickFormatter={(v: number) => fmtDollar(v)} tick={{ fontSize: 10, fontWeight: 700 }} />
                      <YAxis type="category" dataKey="sector" width={100} tick={{ fontSize: 11, fontWeight: 700 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="totalGiving" barSize={18}>
                        {filteredSectors.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="py-8 text-center text-bauhaus-muted text-sm font-medium">No data for this sector</div>
                )}
              </ChartCard>

              <ChartCard title="Foundation Power Law" subtitle="Size distribution by annual giving">
                <div className="space-y-2">
                  {tiers.map((t, i) => (
                    <div key={t.tier} className="flex items-center gap-2">
                      <div className="w-28 text-[11px] font-bold text-bauhaus-muted text-right">{t.tier}</div>
                      <div className="flex-1 flex justify-center">
                        <div
                          className="h-7 flex items-center justify-center"
                          style={{
                            width: `${Math.max(15, (t.count / Math.max(...tiers.map(x => x.count))) * 100)}%`,
                            background: TIER_COLORS[i],
                          }}
                        >
                          <span className="text-[10px] font-black text-white">{t.count}</span>
                        </div>
                      </div>
                      <div className="w-16 text-[10px] text-bauhaus-muted font-bold tabular-nums text-right">{fmtDollar(t.totalGiving)}</div>
                    </div>
                  ))}
                </div>
              </ChartCard>

              <ChartCard title="Geographic Distribution" subtitle="Foundation giving by state/territory">
                <div className="space-y-1.5">
                  {filteredGeo.map(g => {
                    const max = filteredGeo[0]?.totalGiving || 1;
                    return <BarRow key={g.region} label={g.region} value={g.totalGiving} max={max} color="#7c3aed" suffix={`${g.count} fdn`} />;
                  })}
                </div>
              </ChartCard>
            </div>
          )}

          {/* TAB 2: Funding Landscape */}
          {activeTab === 'landscape' && (
            <div className="grid grid-cols-1 gap-5">
              <ChartCard title="Government vs Foundation Funding" subtitle="Total tracked funding by source">
                <div className="space-y-1.5">
                  {sources.slice(0, 10).map(s => {
                    const max = sources[0]?.totalFunding || 1;
                    return (
                      <BarRow
                        key={s.source}
                        label={s.source}
                        value={s.totalFunding}
                        max={max}
                        color={s.type === 'government' ? '#7c3aed' : '#059669'}
                        suffix={`${s.count} grants`}
                      />
                    );
                  })}
                </div>
              </ChartCard>

              <ChartCard title="Sector x Region Heatmap" subtitle="Funding density — darker = more money flowing">
                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: `80px repeat(${Math.min(geography.length, 7)}, 1fr)` }}
                >
                  {/* Header row */}
                  <div></div>
                  {geography.slice(0, 7).map(g => (
                    <div key={g.region} className="text-center text-[9px] text-bauhaus-muted font-bold truncate px-0.5">{g.region}</div>
                  ))}
                  {/* Data rows */}
                  {sectors.slice(0, 8).map((s, si) => {
                    const totalGeoGiving = geography.reduce((a, b) => a + b.totalGiving, 0);
                    return [
                      <div key={`label-${s.sector}`} className="text-[10px] text-bauhaus-muted font-bold flex items-center justify-end pr-1">{s.sector}</div>,
                      ...geography.slice(0, 7).map((g, gi) => {
                        const regionShare = totalGeoGiving > 0 ? g.totalGiving / totalGeoGiving : 0;
                        const val = s.totalGiving * regionShare;
                        const maxVal = sectors[0]?.totalGiving * (geography[0]?.totalGiving / (totalGeoGiving || 1));
                        const intensity = maxVal > 0 ? Math.pow(val / maxVal, 0.4) : 0;
                        const bg = `rgba(16, 64, 192, ${Math.max(0.05, intensity * 0.8)})`;
                        return (
                          <div
                            key={`${si}-${gi}`}
                            className="p-1 text-center border border-bauhaus-black/10"
                            style={{ background: bg }}
                            title={`${s.sector} x ${g.region}: ${fmtDollar(val)}`}
                          >
                            <div className="text-[9px] font-bold text-bauhaus-black">{fmtDollar(val)}</div>
                          </div>
                        );
                      }),
                    ];
                  })}
                </div>
              </ChartCard>
            </div>
          )}

          {/* TAB 3: Grant Simulator */}
          {activeTab === 'simulator' && (
            <div>
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-0 mb-5 border-4 border-bauhaus-black">
                <div className="bg-white p-5 text-center border-r-4 border-bauhaus-black">
                  <div className="text-2xl font-black text-bauhaus-blue tabular-nums">{fmtDollar(simResults.mean)}</div>
                  <div className="text-[11px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">Expected Annual Revenue</div>
                </div>
                <div className="bg-white p-5 text-center border-r-4 border-bauhaus-black">
                  <div className="text-2xl font-black text-bauhaus-yellow tabular-nums">{(simResults.avgWinRate * 100).toFixed(1)}%</div>
                  <div className="text-[11px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">Estimated Win Rate</div>
                </div>
                <div className="bg-white p-5 text-center">
                  <div className="text-2xl font-black text-purple tabular-nums">{fmtDollar(simResults.p90)}</div>
                  <div className="text-[11px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">90th Percentile</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Histogram */}
                <ChartCard
                  title="Revenue Distribution (Monte Carlo)"
                  subtitle={`${simCount.toLocaleString()} simulations — ${appsPerYear} apps/year, ${diversity} sources, ${(alignmentScore * 100).toFixed(0)}% alignment`}
                  className="lg:col-span-2"
                >
                  <div className="flex items-end gap-0.5 h-32">
                    {simResults.histogram.map((bin, i) => (
                      <div
                        key={i}
                        className="flex-1 transition-all relative group"
                        style={{
                          height: `${bin.height}%`,
                          background: bin.isMean ? '#F0C020' : '#1040C0',
                          minHeight: bin.count > 0 ? 2 : 0,
                        }}
                        title={`${bin.range}: ${bin.count} sims (${bin.pct}%)`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-bauhaus-muted font-bold mt-1 tabular-nums">
                    <span>$0</span>
                    <span>{fmtDollar(simResults.maxRev / 2)}</span>
                    <span>{fmtDollar(simResults.maxRev)}</span>
                  </div>
                </ChartCard>

                {/* Win rates */}
                <ChartCard title="Win Rate by Source Type" subtitle="Adjusted for alignment score">
                  <div className="space-y-1.5">
                    {simResults.winRates.map(wr => (
                      <div key={wr.label} className="flex items-center gap-2">
                        <div className="w-28 text-[11px] font-bold text-bauhaus-muted truncate text-right">{wr.label}</div>
                        <div className="flex-1 h-5 bg-bauhaus-canvas border-2 border-bauhaus-black/20 relative">
                          <div
                            className="h-full absolute top-0 left-0 flex items-center pl-1.5"
                            style={{ width: `${(wr.rate * 100)}%`, background: '#059669' }}
                          >
                            <span className="text-[10px] font-black text-white">{(wr.rate * 100).toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="w-14 text-[10px] text-bauhaus-muted font-bold tabular-nums text-right">{fmtDollar(wr.avgSize)}</div>
                      </div>
                    ))}
                  </div>
                </ChartCard>

                {/* Percentiles */}
                <ChartCard title="Revenue Confidence Intervals" subtitle="Percentile breakdown from simulation">
                  <div className="space-y-1.5">
                    {simResults.percentiles.map((p, i) => {
                      const max = simResults.p90 * 1.1;
                      const colors = ['#D02020', '#f97316', '#F0C020', '#7c3aed', '#059669'];
                      return <BarRow key={p.label} label={p.label} value={p.value} max={max} color={colors[i]} />;
                    })}
                  </div>
                </ChartCard>
              </div>
            </div>
          )}

          {/* TAB 4: Gap Analysis */}
          {activeTab === 'gaps' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ChartCard title="Funding Gaps — Where Money Isn't Going" subtitle="Per-foundation giving vs sector average" className="lg:col-span-2">
                <div className="space-y-1.5">
                  {gaps.map(d => {
                    const max = Math.max(...gaps.map(g => g.perFoundation));
                    const isUnder = d.gapRatio < 0.8;
                    const isOver = d.gapRatio > 1.5;
                    return (
                      <div key={d.sector} className="flex items-center gap-2">
                        <div className="w-28 text-[11px] font-bold text-bauhaus-muted truncate text-right">{d.sector}</div>
                        <div className="flex-1 h-5 bg-bauhaus-canvas border-2 border-bauhaus-black/20 relative">
                          <div
                            className="h-full absolute top-0 left-0 flex items-center pl-1.5"
                            style={{
                              width: `${Math.max(2, d.perFoundation / max * 100)}%`,
                              background: isUnder ? '#D02020' : isOver ? '#059669' : '#7c3aed',
                            }}
                          >
                            <span className="text-[10px] font-black text-white whitespace-nowrap">{fmtDollar(d.perFoundation)}/fdn</span>
                          </div>
                        </div>
                        <div className="w-24 text-right">
                          {isUnder && <span className="text-[10px] font-black text-bauhaus-red uppercase">Underfunded</span>}
                          {isOver && <span className="text-[10px] font-black text-money uppercase">Well Funded</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ChartCard>

              <ChartCard title="Underserved Regions" subtitle="Giving per foundation by state">
                <div className="space-y-1.5">
                  {regionGaps.map(d => {
                    const max = Math.max(...regionGaps.map(g => g.perFoundation));
                    return <BarRow key={d.region} label={d.region} value={d.perFoundation} max={max} color="#7c3aed" suffix={`${d.count} fdn`} />;
                  })}
                </div>
              </ChartCard>

              <ChartCard title="Competition Index" subtitle="Foundations per $1M of sector giving — lower = less competitive">
                <div className="space-y-1.5">
                  {sectors
                    .filter(d => d.totalGiving > 1e6)
                    .map(d => ({ ...d, competition: d.count / (d.totalGiving / 1e6) }))
                    .sort((a, b) => a.competition - b.competition)
                    .map(d => {
                      const max = Math.max(...sectors.filter(s => s.totalGiving > 1e6).map(s => s.count / (s.totalGiving / 1e6)));
                      return (
                        <div key={d.sector} className="flex items-center gap-2">
                          <div className="w-24 text-[11px] font-bold text-bauhaus-muted truncate text-right">{d.sector}</div>
                          <div className="flex-1 h-5 bg-bauhaus-canvas border-2 border-bauhaus-black/20 relative">
                            <div
                              className="h-full absolute top-0 left-0 flex items-center pl-1.5"
                              style={{
                                width: `${Math.max(2, d.competition / max * 100)}%`,
                                background: d.competition < 3 ? '#059669' : d.competition > 8 ? '#D02020' : '#F0C020',
                              }}
                            >
                              <span className="text-[10px] font-black text-white whitespace-nowrap">{d.competition.toFixed(1)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </ChartCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
