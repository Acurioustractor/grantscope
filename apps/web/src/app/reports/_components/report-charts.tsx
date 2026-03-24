'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ResponsiveContainer, Cell,
} from 'recharts';

const COLORS = {
  red: '#D02020',
  blue: '#1040C0',
  yellow: '#F0C020',
  emerald: '#059669',
  muted: '#777777',
  black: '#121212',
};

const STATE_COLORS: Record<string, string> = {
  QLD: '#D02020', NSW: '#1040C0', VIC: '#059669', WA: '#F0C020',
  SA: '#7c3aed', NT: '#ea580c', TAS: '#0891b2', ACT: '#777777',
};

/* ── Funding by Program Bar Chart ── */
export function FundingByProgramChart({ data }: { data: Array<{ program_name: string; total: number }> }) {
  if (!data.length) return null;
  const chartData = data.slice(0, 10).map(d => ({
    name: d.program_name.length > 30 ? d.program_name.slice(0, 28) + '…' : d.program_name,
    total: d.total,
  }));

  return (
    <div className="w-full h-[320px] mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis type="number" tickFormatter={(v: number) => v >= 1e6 ? `$${(v / 1e6).toFixed(0)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v}`} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => [`$${Number(v ?? 0).toLocaleString()}`, 'Funding']} />
          <Bar dataKey="total" fill={COLORS.red} radius={[0, 4, 4, 0]} />
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
    if (format === 'money') return v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${v.toLocaleString()}`;
    if (format === 'pct') return `${v.toFixed(1)}%`;
    if (format === 'ratio') return `${v.toFixed(1)}x`;
    return v.toLocaleString();
  };

  return (
    <div className="w-full h-[240px]">
      <p className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">{label}</p>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis dataKey="jurisdiction" tick={{ fontSize: 11, fontWeight: 700 }} />
          <YAxis tickFormatter={formatValue} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v) => [formatValue(Number(v ?? 0)), label]} />
          <Bar dataKey="metric_value" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.jurisdiction}
                fill={entry.jurisdiction === highlightState ? COLORS.red : STATE_COLORS[entry.jurisdiction] || COLORS.muted}
                opacity={highlightState && entry.jurisdiction !== highlightState ? 0.4 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Time Series Line Chart (ROGS expenditure over years) ── */
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
    if (format === 'money') return v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(0)}M` : `$${(v / 1e3).toFixed(0)}K`;
    if (format === 'pct') return `${v.toFixed(1)}%`;
    return v.toLocaleString();
  };

  return (
    <div className="w-full h-[280px]">
      {label && <p className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">{label}</p>}
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 10, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis dataKey={xKey} tick={{ fontSize: 10 }} />
          <YAxis tickFormatter={formatValue} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v, name) => [formatValue(Number(v ?? 0)), String(name)]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {lines.map(line => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.color}
              strokeWidth={2}
              dot={{ r: 3 }}
              name={line.label}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Funding by LGA horizontal bar with SEIFA color coding ── */
export function LgaFundingChart({ data }: { data: Array<{ lga_name: string; total_funding: number; seifa_decile: number | null }> }) {
  if (!data.length) return null;
  const chartData = data.slice(0, 12).map(d => ({
    name: d.lga_name.length > 25 ? d.lga_name.slice(0, 23) + '…' : d.lga_name,
    funding: d.total_funding,
    seifa: d.seifa_decile,
  }));

  return (
    <div className="w-full h-[320px] mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis type="number" tickFormatter={(v: number) => v >= 1e6 ? `$${(v / 1e6).toFixed(0)}M` : `$${(v / 1e3).toFixed(0)}K`} tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v) => [`$${Number(v ?? 0).toLocaleString()}`, 'Funding']} />
          <Bar dataKey="funding" radius={[0, 4, 4, 0]}>
            {chartData.map((entry) => (
              <Cell
                key={entry.name}
                fill={entry.seifa != null && entry.seifa <= 3 ? COLORS.red : entry.seifa != null && entry.seifa <= 6 ? COLORS.yellow : COLORS.emerald}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
