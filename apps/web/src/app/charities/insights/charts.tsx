'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, CartesianGrid, Legend,
} from 'recharts';

// ── Types ──────────────────────────────────────────────

export interface SizeRow { size: string; count: number; total_revenue: number; total_expenses: number; total_assets: number; total_grants: number; total_staff: number; total_volunteers: number }
export interface StateRow { state: string; count: number; total_revenue: number }
export interface OperatingStateRow { state_name: string; count: number }
export interface PurposeRow { purpose: string; count: number }
export interface BeneficiaryRow { beneficiary: string; count: number }
export interface PbiRow { size: string; total_count: number; pbi_count: number }
export interface YearlyRow { year: number; count: number; revenue: number; expenses: number; assets: number; grants: number; staff: number; volunteers: number }
export interface TopGrantMaker { name: string; size: string; state: string; is_foundation: boolean; grants_given: number; revenue: number }

export interface SnapshotData {
  bySize: SizeRow[];
  byState: StateRow[];
  operatingStates: OperatingStateRow[];
  purposeCounts: PurposeRow[];
  beneficiaryCounts: BeneficiaryRow[];
  pbiBySize: PbiRow[];
  yearlyTrends: YearlyRow[];
  topGrantMakers: TopGrantMaker[];
}

// ── Helpers ────────────────────────────────────────────

const BAUHAUS_COLORS = ['#1040C0', '#D02020', '#F0C020', '#059669', '#7c3aed', '#f97316', '#121212', '#777777'];

function formatMoney(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function formatNum(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

function pct(part: number, total: number): string {
  if (total === 0) return '0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border-4 border-bauhaus-black p-5 bauhaus-shadow-sm my-8">
      <h3 className="text-xs font-black text-bauhaus-black uppercase tracking-widest mb-4">{title}</h3>
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bauhaus-black text-white p-3 border-0 text-xs font-bold space-y-1">
      <div className="font-black">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || '#F0C020' }} className="tabular-nums">
          {p.name}: {formatMoney(p.value)}
        </div>
      ))}
    </div>
  );
}

function HorizontalBars({ data, colorIndex = 0, highlightItems }: {
  data: { label: string; value: number }[];
  colorIndex?: number;
  highlightItems?: string[];
}) {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => {
        const isHighlight = highlightItems?.includes(d.label);
        return (
          <div key={d.label} className="flex items-center gap-2">
            <div className="w-36 text-[11px] font-bold text-bauhaus-muted truncate text-right">{d.label}</div>
            <div className="flex-1 h-6 bg-bauhaus-canvas border-2 border-bauhaus-black/20 relative overflow-hidden">
              <div
                className="h-full absolute top-0 left-0 flex items-center pl-1.5 transition-all"
                style={{
                  width: `${Math.max((d.value / maxValue) * 100, 2)}%`,
                  background: isHighlight ? '#D02020' : BAUHAUS_COLORS[(i + colorIndex) % BAUHAUS_COLORS.length],
                }}
              >
                <span className="text-[10px] font-black text-white whitespace-nowrap">{d.value.toLocaleString()}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Individual Chart Components ────────────────────────

export function SizePyramidChart({ bySize }: { bySize: SizeRow[] }) {
  const totalCharities = bySize.reduce((sum, s) => sum + s.count, 0);
  const totalRevenue = bySize.reduce((sum, s) => sum + s.total_revenue, 0);
  const sizeOrder = ['Large', 'Medium', 'Small', 'Unknown'];
  const sorted = [...bySize].sort((a, b) => sizeOrder.indexOf(a.size) - sizeOrder.indexOf(b.size));
  const colors = ['#D02020', '#1040C0', '#F0C020'];

  return (
    <ChartCard title="Charities by Size — Count vs Revenue Share">
      <div className="space-y-4">
        {sorted.filter(s => s.size !== 'Unknown').map((s, i) => {
          const countPct = (s.count / totalCharities) * 100;
          const revPct = totalRevenue > 0 ? (s.total_revenue / totalRevenue) * 100 : 0;
          return (
            <div key={s.size}>
              <div className="flex justify-between text-xs font-black text-bauhaus-black mb-1">
                <span>{s.size} ({s.count.toLocaleString()})</span>
                <span className="tabular-nums">{pct(s.total_revenue, totalRevenue)} of revenue</span>
              </div>
              <div className="flex gap-1">
                <div className="flex-1">
                  <div className="text-[9px] font-bold text-bauhaus-muted mb-0.5">Charities</div>
                  <div className="h-7 bg-bauhaus-canvas border-2 border-bauhaus-black/20 overflow-hidden">
                    <div className="h-full flex items-center pl-1.5" style={{ width: `${Math.max(countPct, 2)}%`, background: colors[i] }}>
                      <span className="text-[10px] font-black text-white">{countPct.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-[9px] font-bold text-bauhaus-muted mb-0.5">Revenue</div>
                  <div className="h-7 bg-bauhaus-canvas border-2 border-bauhaus-black/20 overflow-hidden">
                    <div className="h-full flex items-center pl-1.5" style={{ width: `${Math.max(revPct, 2)}%`, background: colors[i] }}>
                      <span className="text-[10px] font-black text-white">{revPct.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}

export function GeographyCharts({ byState, operatingStates }: { byState: StateRow[]; operatingStates: OperatingStateRow[] }) {
  return (
    <>
      <ChartCard title="Geography — Registered State">
        <HorizontalBars
          data={byState.filter(s => s.state !== 'Unknown').slice(0, 10).map(s => ({
            label: `${s.state} (${formatMoney(s.total_revenue)})`,
            value: s.count,
          }))}
        />
      </ChartCard>
      <ChartCard title="Geography — Operating In">
        <HorizontalBars
          data={operatingStates.map(s => ({ label: s.state_name, value: s.count }))}
          colorIndex={2}
        />
      </ChartCard>
    </>
  );
}

export function PurposesChart({ purposeCounts }: { purposeCounts: PurposeRow[] }) {
  return (
    <ChartCard title="Charitable Purposes">
      <HorizontalBars
        data={purposeCounts.map(p => ({ label: p.purpose, value: p.count }))}
        highlightItems={['Reconciliation']}
      />
    </ChartCard>
  );
}

export function BeneficiariesChart({ beneficiaryCounts }: { beneficiaryCounts: BeneficiaryRow[] }) {
  return (
    <ChartCard title="Who Charities Serve — Beneficiary Groups">
      <HorizontalBars
        data={beneficiaryCounts.slice(0, 20).map(b => ({ label: b.beneficiary, value: b.count }))}
        highlightItems={['First Nations', 'LGBTIQA+']}
      />
    </ChartCard>
  );
}

export function GrantMakersChart({ topGrantMakers }: { topGrantMakers: TopGrantMaker[] }) {
  return (
    <ChartCard title="Top 20 Grant-Makers by Amount Distributed">
      <ResponsiveContainer width="100%" height={500}>
        <BarChart
          data={topGrantMakers.map(g => ({
            name: g.name.length > 35 ? g.name.slice(0, 35) + '\u2026' : g.name,
            value: g.grants_given,
            isFoundation: g.is_foundation,
          }))}
          layout="vertical"
          margin={{ left: 10, right: 10, top: 0, bottom: 0 }}
        >
          <XAxis type="number" tickFormatter={(v: number) => formatMoney(v)} tick={{ fontSize: 10, fontWeight: 700 }} />
          <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 10, fontWeight: 600 }} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="value" barSize={16} name="Grants">
            {topGrantMakers.map((g, i) => (
              <Cell key={i} fill={g.is_foundation ? '#F0C020' : '#1040C0'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-3 text-xs font-bold text-bauhaus-muted">
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-[#F0C020] border-2 border-bauhaus-black inline-block"></span> Foundation</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-[#1040C0] border-2 border-bauhaus-black inline-block"></span> Other Charity</span>
      </div>
    </ChartCard>
  );
}

export function PbiChart({ pbiBySize }: { pbiBySize: PbiRow[] }) {
  return (
    <ChartCard title="PBI Status by Charity Size">
      <div className="space-y-3">
        {pbiBySize.filter(p => p.size !== 'Unknown').map((p) => {
          const pbiPct = p.total_count > 0 ? (p.pbi_count / p.total_count) * 100 : 0;
          return (
            <div key={p.size}>
              <div className="flex justify-between text-xs font-black text-bauhaus-black mb-1">
                <span>{p.size}</span>
                <span className="tabular-nums">{p.pbi_count.toLocaleString()} / {p.total_count.toLocaleString()} ({pbiPct.toFixed(1)}%)</span>
              </div>
              <div className="h-7 bg-bauhaus-canvas border-2 border-bauhaus-black/20 overflow-hidden">
                <div
                  className="h-full flex items-center pl-1.5 bg-money"
                  style={{ width: `${Math.max(pbiPct, 2)}%` }}
                >
                  <span className="text-[10px] font-black text-white">{pbiPct.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}

export function WorkforceChart({ bySize }: { bySize: SizeRow[] }) {
  const sizeOrder = ['Large', 'Medium', 'Small'];
  const data = [...bySize]
    .filter(s => s.size !== 'Unknown')
    .sort((a, b) => sizeOrder.indexOf(a.size) - sizeOrder.indexOf(b.size))
    .map(s => ({
      name: s.size,
      'Paid Staff (FTE)': s.total_staff,
      Volunteers: s.total_volunteers,
    }));

  return (
    <ChartCard title="Workforce by Charity Size — Paid Staff vs Volunteers">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 700 }} />
          <YAxis tickFormatter={(v: number) => formatNum(v)} tick={{ fontSize: 10, fontWeight: 700 }} />
          <Tooltip
            formatter={(value, name) => [formatNum(Number(value) || 0), String(name)]}
            contentStyle={{ background: '#121212', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700 }}
            labelStyle={{ fontWeight: 900 }}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
          <Bar dataKey="Paid Staff (FTE)" fill="#1040C0" stackId="a" />
          <Bar dataKey="Volunteers" fill="#F0C020" stackId="a" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function TrendsChart({ yearlyTrends }: { yearlyTrends: YearlyRow[] }) {
  const data = yearlyTrends.map(y => ({
    year: y.year.toString(),
    Revenue: y.revenue,
    Expenses: y.expenses,
    Grants: y.grants,
    Assets: y.assets,
  }));

  return (
    <ChartCard title="Sector Financial Trends 2017–2023">
      <ResponsiveContainer width="100%" height={350}>
        <AreaChart data={data} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
          <XAxis dataKey="year" tick={{ fontSize: 12, fontWeight: 700 }} />
          <YAxis tickFormatter={(v: number) => formatMoney(v)} tick={{ fontSize: 10, fontWeight: 700 }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
          <Area type="monotone" dataKey="Revenue" stroke="#1040C0" fill="#1040C0" fillOpacity={0.15} strokeWidth={2} />
          <Area type="monotone" dataKey="Expenses" stroke="#D02020" fill="#D02020" fillOpacity={0.1} strokeWidth={2} />
          <Area type="monotone" dataKey="Assets" stroke="#059669" fill="#059669" fillOpacity={0.1} strokeWidth={2} />
          <Area type="monotone" dataKey="Grants" stroke="#F0C020" fill="#F0C020" fillOpacity={0.2} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
