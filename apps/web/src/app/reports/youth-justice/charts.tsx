'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line,
} from 'recharts';
import type { YouthJusticeReport } from './page';

function formatDollars(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

const STATE_COLORS: Record<string, string> = {
  QLD: '#dc2626',
  NSW: '#2563eb',
  VIC: '#1d4ed8',
  NT: '#d97706',
  SA: '#059669',
  WA: '#7c3aed',
  TAS: '#0891b2',
  ACT: '#6b7280',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 10-Year Spending Trend by State
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SpendingTrend({ report }: { report: YouthJusticeReport }) {
  // Pivot: one row per financial year, one column per state
  const yearMap = new Map<string, Record<string, number>>();

  for (const entry of report.spendingTimeSeries) {
    if (!yearMap.has(entry.financial_year)) {
      yearMap.set(entry.financial_year, { year: 0 } as Record<string, number>);
    }
    const row = yearMap.get(entry.financial_year)!;
    row[entry.state] = entry.total;
  }

  const data = Array.from(yearMap.entries())
    .map(([fy, row]) => ({ fy, ...row }))
    .sort((a, b) => a.fy.localeCompare(b.fy));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-lg font-black mb-1">Youth Justice Spending by State</h3>
      <p className="text-sm text-gray-500 mb-4">10-year ROGS total expenditure trend, 2015-16 to 2024-25</p>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="fy" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
          <YAxis tickFormatter={formatDollars} />
          <Tooltip formatter={(value) => formatDollars(Number(value))} />
          <Legend />
          {Object.entries(STATE_COLORS).map(([state, color]) => (
            <Line
              key={state}
              type="monotone"
              dataKey={state}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Detention vs Community Split by State
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function DetentionVsCommunity({ report }: { report: YouthJusticeReport }) {
  const data = report.stateTotals.map((st) => ({
    state: st.state,
    Detention: st.detention_10yr,
    Community: st.community_10yr,
  }));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-lg font-black mb-1">Detention vs Community Spending</h3>
      <p className="text-sm text-gray-500 mb-4">10-year cumulative split — every state spends more on locking up than keeping out</p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="state" />
          <YAxis tickFormatter={formatDollars} />
          <Tooltip formatter={(value) => formatDollars(Number(value))} />
          <Legend />
          <Bar dataKey="Detention" fill="#dc2626" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Community" fill="#059669" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Growth Rate Comparison
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function GrowthComparison({ report }: { report: YouthJusticeReport }) {
  const data = report.stateTotals.map((st) => ({
    state: st.state,
    'Growth %': st.growth_pct,
    'Latest Year ($M)': Math.round(st.latest_year / 1_000_000),
  }));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-lg font-black mb-1">Spending Growth Since 2015-16</h3>
      <p className="text-sm text-gray-500 mb-4">Percentage increase in total youth justice expenditure</p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickFormatter={(v: number) => `${v}%`} />
          <YAxis type="category" dataKey="state" width={40} tick={{ fontSize: 13, fontWeight: 700 }} />
          <Tooltip formatter={(value, name) => name === 'Growth %' ? `${value}%` : `$${value}M`} />
          <Bar dataKey="Growth %" fill="#d97706" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ALMA Intervention Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function AlmaBreakdown({ report }: { report: YouthJusticeReport }) {
  const typeCounts = new Map<string, number>();
  for (const intervention of report.almaInterventions) {
    typeCounts.set(intervention.type, (typeCounts.get(intervention.type) || 0) + 1);
  }

  const data = Array.from(typeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-lg font-black mb-1">What Works: ALMA Intervention Types</h3>
      <p className="text-sm text-gray-500 mb-4">Distribution of evidence-based youth justice alternatives</p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 140 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" />
          <YAxis type="category" dataKey="type" width={140} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Cross-System: Youth Justice Spend vs NDIS Budget
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CrossSystemSpend({ report }: { report: YouthJusticeReport }) {
  // Match NDIS data to youth justice state totals
  const data = report.ndisOverlay.map((ndis) => {
    const yj = report.stateTotals.find(s => s.state === ndis.state);
    return {
      state: ndis.state,
      'Youth Justice (10yr)': yj?.total_10yr || 0,
      'NDIS Budget (annual)': ndis.ndis_budget,
    };
  }).sort((a, b) => b['NDIS Budget (annual)'] - a['NDIS Budget (annual)']);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-lg font-black mb-1">Youth Justice vs NDIS Spend</h3>
      <p className="text-sm text-gray-500 mb-4">10-year youth justice total alongside annual NDIS budget — same communities, different systems</p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="state" />
          <YAxis tickFormatter={formatDollars} />
          <Tooltip formatter={(value) => formatDollars(Number(value))} />
          <Legend />
          <Bar dataKey="Youth Justice (10yr)" fill="#dc2626" radius={[4, 4, 0, 0]} />
          <Bar dataKey="NDIS Budget (annual)" fill="#7c3aed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NDIS Disability Type Breakdown by State
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function DisabilityBreakdown({ report }: { report: YouthJusticeReport }) {
  const data = report.ndisOverlay
    .map((row) => ({
      state: row.state,
      Autism: row.autism,
      Intellectual: row.intellectual,
      Psychosocial: row.psychosocial,
    }))
    .sort((a, b) => (b.Autism + b.Intellectual + b.Psychosocial) - (a.Autism + a.Intellectual + a.Psychosocial));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-lg font-black mb-1">NDIS Youth by Disability Type</h3>
      <p className="text-sm text-gray-500 mb-4">Young NDIS participants by primary disability — these overlap heavily with youth justice cohorts</p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="state" />
          <YAxis tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
          <Tooltip formatter={(value) => Number(value).toLocaleString()} />
          <Legend />
          <Bar dataKey="Autism" fill="#3b82f6" stackId="a" />
          <Bar dataKey="Intellectual" fill="#8b5cf6" stackId="a" />
          <Bar dataKey="Psychosocial" fill="#f59e0b" stackId="a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main Export
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function YouthJusticeCharts({ report }: { report: YouthJusticeReport }) {
  return (
    <div className="flex flex-col gap-6">
      <SpendingTrend report={report} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DetentionVsCommunity report={report} />
        <GrowthComparison report={report} />
      </div>
      <AlmaBreakdown report={report} />
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LGA-Level Cross-System Overlap
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type LgaOverlapRow = {
  lga: string;
  dsp: number;
  jobseeker: number;
  youthAllowance: number;
  lowIcsea: number;
  avgIcsea: number;
  indigenousPct: number;
};

function LgaOverlapChart({ data }: { data: LgaOverlapRow[] }) {
  // Sort by DSP recipients descending — the most burdened communities first
  const sorted = [...data]
    .sort((a, b) => b.dsp - a.dsp)
    .slice(0, 12);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-lg font-black mb-1">Same Places, Multiple Systems</h3>
      <p className="text-sm text-gray-500 mb-4">
        Disability pensions + JobSeeker + Youth Allowance recipients in the same LGAs with high school disadvantage
      </p>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={sorted} layout="vertical" margin={{ left: 120 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
          <YAxis type="category" dataKey="lga" width={120} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => Number(value).toLocaleString()} />
          <Legend />
          <Bar dataKey="dsp" name="Disability Pension" fill="#dc2626" stackId="a" />
          <Bar dataKey="jobseeker" name="JobSeeker" fill="#d97706" stackId="a" />
          <Bar dataKey="youthAllowance" name="Youth Allowance" fill="#3b82f6" stackId="a" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CrossSystemCharts({ report, lgaOverlap }: { report: YouthJusticeReport; lgaOverlap: LgaOverlapRow[] }) {
  return (
    <div className="flex flex-col gap-6">
      {lgaOverlap.length > 0 && <LgaOverlapChart data={lgaOverlap} />}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CrossSystemSpend report={report} />
        <DisabilityBreakdown report={report} />
      </div>
    </div>
  );
}
