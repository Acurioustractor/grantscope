'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ResponsiveContainer, Cell,
} from 'recharts';

/* ── Design tokens ── */
const PALETTE = {
  primary: '#D02020',
  secondary: '#1040C0',
  accent: '#F0C020',
  success: '#059669',
  muted: '#94a3b8',
  text: '#334155',
  gridLine: '#f1f5f9',
  gridDash: '#e2e8f0',
};

const STATE_COLORS: Record<string, string> = {
  QLD: '#D02020', NSW: '#1040C0', VIC: '#059669', WA: '#d97706',
  SA: '#7c3aed', NT: '#ea580c', TAS: '#0891b2', ACT: '#64748b',
};

const AXIS_STYLE = { fontSize: 11, fill: '#64748b', fontFamily: 'inherit' };
const GRID_PROPS = { strokeDasharray: '3 3', stroke: PALETTE.gridDash, strokeOpacity: 0.7 };

/* ── Custom tooltip container ── */
function ChartTooltipContent({ active, payload, label, formatter }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
  formatter: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-bauhaus-black/10 shadow-lg px-3 py-2 text-xs">
      {label && <p className="font-bold text-bauhaus-black mb-1">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-bauhaus-muted">{p.name}:</span>
          <span className="font-bold text-bauhaus-black">{formatter(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function moneyFmt(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

/* ── Funding by Program Bar Chart ── */
export function FundingByProgramChart({ data }: { data: Array<{ program_name: string; total: number }> }) {
  if (!data.length) return null;
  const chartData = data.slice(0, 10).map(d => ({
    name: d.program_name.length > 35 ? d.program_name.slice(0, 33) + '...' : d.program_name,
    total: d.total,
  }));

  return (
    <div className="w-full h-[320px] bg-white border border-bauhaus-black/6 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 24, top: 4, bottom: 4 }}>
          <CartesianGrid {...GRID_PROPS} horizontal={false} />
          <XAxis type="number" tickFormatter={moneyFmt} tick={AXIS_STYLE} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={200} tick={{ ...AXIS_STYLE, fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltipContent formatter={moneyFmt} />} />
          <Bar dataKey="total" fill={PALETTE.primary} radius={[0, 3, 3, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── State Comparison Bar Chart ── */
export function StateComparisonChart({
  data,
  metricKey,
  label,
  format = 'number',
  highlightState,
}: {
  data: Array<{ jurisdiction: string; metric_value: number }>;
  metricKey: string;
  label: string;
  format?: 'number' | 'money' | 'pct' | 'ratio';
  highlightState?: string;
}) {
  if (!data.length) return null;

  const formatValue = (v: number) => {
    if (format === 'money') return moneyFmt(v);
    if (format === 'pct') return `${v.toFixed(1)}%`;
    if (format === 'ratio') return `${v.toFixed(1)}x`;
    return v.toLocaleString();
  };

  return (
    <div className="w-full h-[220px]">
      <p className="text-[10px] font-bold uppercase tracking-wider text-bauhaus-muted mb-3">{label}</p>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ bottom: 5, left: -10, right: 4 }}>
          <CartesianGrid {...GRID_PROPS} vertical={false} />
          <XAxis dataKey="jurisdiction" tick={{ ...AXIS_STYLE, fontWeight: 600 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatValue} tick={{ ...AXIS_STYLE, fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltipContent formatter={formatValue} />} />
          <Bar dataKey="metric_value" radius={[3, 3, 0, 0]} barSize={28}>
            {data.map((entry) => (
              <Cell
                key={entry.jurisdiction}
                fill={entry.jurisdiction === highlightState ? PALETTE.primary : STATE_COLORS[entry.jurisdiction] || PALETTE.muted}
                opacity={highlightState && entry.jurisdiction !== highlightState ? 0.3 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Time Series Line Chart ── */
export function TimeSeriesChart({
  data,
  lines,
  xKey = 'period',
  label,
  format = 'money',
}: {
  data: Array<Record<string, unknown>>;
  lines: Array<{ dataKey: string; color: string; label: string }>;
  xKey?: string;
  label?: string;
  format?: 'money' | 'number' | 'pct';
}) {
  if (!data.length) return null;

  const formatValue = (v: number) => {
    if (format === 'money') return moneyFmt(v);
    if (format === 'pct') return `${v.toFixed(1)}%`;
    return v.toLocaleString();
  };

  return (
    <div className="w-full h-[260px]">
      {label && <p className="text-[10px] font-bold uppercase tracking-wider text-bauhaus-muted mb-3">{label}</p>}
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey={xKey} tick={{ ...AXIS_STYLE, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatValue} tick={{ ...AXIS_STYLE, fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltipContent formatter={formatValue} />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />
          {lines.map(line => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.color}
              strokeWidth={2}
              dot={{ r: 3, fill: line.color, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
              name={line.label}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Funding by LGA with SEIFA color coding ── */
export function LgaFundingChart({ data }: { data: Array<{ lga_name: string; total_funding: number; seifa_decile: number | null }> }) {
  if (!data.length) return null;
  const chartData = data.slice(0, 12).map(d => ({
    name: d.lga_name.length > 25 ? d.lga_name.slice(0, 23) + '...' : d.lga_name,
    funding: d.total_funding,
    seifa: d.seifa_decile,
  }));

  const seifaColor = (d: number | null) => {
    if (d == null) return PALETTE.muted;
    if (d <= 3) return PALETTE.primary;  // most disadvantaged
    if (d <= 6) return '#d97706';        // moderate
    return PALETTE.success;              // least disadvantaged
  };

  return (
    <div className="w-full h-[320px] bg-white border border-bauhaus-black/6 p-4">
      <div className="flex items-center gap-4 mb-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-bauhaus-muted">Funding by LGA</p>
        <div className="flex items-center gap-3 text-[9px] text-bauhaus-muted">
          <span className="flex items-center gap-1"><span className="w-2 h-2" style={{ background: PALETTE.primary }} /> SEIFA 1-3</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2" style={{ background: '#d97706' }} /> SEIFA 4-6</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2" style={{ background: PALETTE.success }} /> SEIFA 7-10</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 24, top: 0, bottom: 0 }}>
          <CartesianGrid {...GRID_PROPS} horizontal={false} />
          <XAxis type="number" tickFormatter={moneyFmt} tick={AXIS_STYLE} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={160} tick={{ ...AXIS_STYLE, fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltipContent formatter={moneyFmt} />} />
          <Bar dataKey="funding" radius={[0, 3, 3, 0]} barSize={16}>
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={seifaColor(entry.seifa)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
