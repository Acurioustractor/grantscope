'use client';

import { useState, useMemo } from 'react';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type HeatmapRow = {
  lga_name: string;
  state: string;
  population: number;
  low_icsea: number;
  avg_icsea: number;
  schools: number;
  indigenous_pct: number;
  dsp_rate: number;
  jobseeker_rate: number;
  youth_allowance_rate: number;
  cost_per_day: number;
  recidivism_pct: number | null;
  indigenous_rate_ratio: number;
  detention_indigenous_pct: number;
  ndis_rate: number;
  crime_rate: number;
  alma_count: number;
};

type PipelineStats = {
  avgLowIcsea: number;
  avgIndigenousPct: number;
  avgNdisRate: number;
  avgDspRate: number;
  avgJobseekerRate: number;
  avgYouthAllowanceRate: number;
  avgRecidivism: number | null;
  avgIndigenousRatio: number;
  avgCrimeRate: number;
  avgCostPerDay: number;
  totalLgas: number;
  totalPopulation: number;
  serviceDeserts: number;
};

export const ALL_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

const STATE_NAMES: Record<string, string> = {
  ACT: 'ACT', NSW: 'NSW', NT: 'NT', QLD: 'QLD',
  SA: 'SA', TAS: 'TAS', VIC: 'VIC', WA: 'WA',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Scoring: LGA-specific indicators weighted 2x
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type Scores = {
  lowIcsea: number;
  icsea: number;
  indigenous: number;
  dsp: number;
  jobseeker: number;
  youthAllowance: number;
  costPerDay: number;
  recidivism: number;
  indRatio: number;
  detIndPct: number;
  crime: number;
  ndis: number;
};

// LGA-specific = 2x weight, state-level = 1x weight
const WEIGHTS: Record<keyof Scores, number> = {
  lowIcsea: 2,       // LGA-specific
  icsea: 2,          // LGA-specific
  indigenous: 2,     // LGA-specific
  dsp: 2,            // LGA-specific
  jobseeker: 2,      // LGA-specific
  youthAllowance: 2, // LGA-specific
  ndis: 2,           // LGA-specific
  crime: 2,          // LGA-specific
  costPerDay: 1,     // State-level
  recidivism: 1,     // State-level
  indRatio: 1,       // State-level
  detIndPct: 1,      // State-level
};

export function computeScored(rows: HeatmapRow[]) {
  const maxOf = (arr: number[]) => Math.max(...arr, 1);
  const minOf = (arr: number[]) => Math.min(...arr);

  const maxLowIcsea = maxOf(rows.map(r => r.low_icsea));
  const maxIndigPct = maxOf(rows.map(r => r.indigenous_pct));
  const maxDsp = maxOf(rows.map(r => r.dsp_rate));
  const maxJobseeker = maxOf(rows.map(r => r.jobseeker_rate));
  const maxYouthAllowance = maxOf(rows.map(r => r.youth_allowance_rate));
  const minIcsea = minOf(rows.filter(r => r.avg_icsea > 0).map(r => r.avg_icsea).concat([1100]));
  const maxIcsea = maxOf(rows.map(r => r.avg_icsea));
  const maxCostPerDay = maxOf(rows.map(r => r.cost_per_day));
  const maxRecidivism = maxOf(rows.filter(r => r.recidivism_pct !== null).map(r => r.recidivism_pct!).concat([1]));
  const maxIndRatio = maxOf(rows.map(r => r.indigenous_rate_ratio));
  const maxDetIndPct = maxOf(rows.map(r => r.detention_indigenous_pct));
  const maxCrime = maxOf(rows.filter(r => r.crime_rate > 0).map(r => r.crime_rate).concat([1]));
  const maxNdis = maxOf(rows.map(r => r.ndis_rate));

  return rows.map(r => {
    const icseaScore = maxIcsea > minIcsea && r.avg_icsea > 0 ? (maxIcsea - r.avg_icsea) / (maxIcsea - minIcsea) : 0;
    const scores: Scores = {
      lowIcsea: r.low_icsea / maxLowIcsea,
      icsea: icseaScore,
      indigenous: r.indigenous_pct / maxIndigPct,
      dsp: r.dsp_rate / maxDsp,
      jobseeker: r.jobseeker_rate / maxJobseeker,
      youthAllowance: r.youth_allowance_rate / maxYouthAllowance,
      costPerDay: r.cost_per_day / maxCostPerDay,
      recidivism: r.recidivism_pct !== null ? r.recidivism_pct / maxRecidivism : 0,
      indRatio: r.indigenous_rate_ratio / maxIndRatio,
      detIndPct: r.detention_indigenous_pct / maxDetIndPct,
      crime: r.crime_rate / maxCrime,
      ndis: r.ndis_rate / maxNdis,
    };

    // Weighted average: LGA-specific 2x, state-level 1x
    let weightedSum = 0;
    let totalWeight = 0;
    for (const [key, score] of Object.entries(scores) as [keyof Scores, number][]) {
      const w = WEIGHTS[key];
      weightedSum += score * w;
      totalWeight += w;
    }
    const burden = totalWeight > 0 ? weightedSum / totalWeight : 0;

    return { ...r, scores, burden };
  }).sort((a, b) => b.burden - a.burden);
}

export function computePipelineStats(rows: HeatmapRow[]): PipelineStats {
  const n = rows.length || 1;
  const withRecidivism = rows.filter(r => r.recidivism_pct !== null);
  const withCrime = rows.filter(r => r.crime_rate > 0);
  return {
    avgLowIcsea: Math.round(rows.reduce((s, r) => s + r.low_icsea, 0) / n * 10) / 10,
    avgIndigenousPct: Math.round(rows.reduce((s, r) => s + r.indigenous_pct, 0) / n * 10) / 10,
    avgNdisRate: Math.round(rows.reduce((s, r) => s + r.ndis_rate, 0) / n),
    avgDspRate: Math.round(rows.reduce((s, r) => s + r.dsp_rate, 0) / n),
    avgJobseekerRate: Math.round(rows.reduce((s, r) => s + r.jobseeker_rate, 0) / n),
    avgYouthAllowanceRate: Math.round(rows.reduce((s, r) => s + r.youth_allowance_rate, 0) / n),
    avgRecidivism: withRecidivism.length > 0 ? Math.round(withRecidivism.reduce((s, r) => s + r.recidivism_pct!, 0) / withRecidivism.length) : null,
    avgIndigenousRatio: Math.round(rows.reduce((s, r) => s + r.indigenous_rate_ratio, 0) / n * 10) / 10,
    avgCrimeRate: withCrime.length > 0 ? Math.round(withCrime.reduce((s, r) => s + r.crime_rate, 0) / withCrime.length) : 0,
    avgCostPerDay: Math.round(rows.reduce((s, r) => s + r.cost_per_day, 0) / n),
    totalLgas: rows.length,
    totalPopulation: rows.reduce((s, r) => s + r.population, 0),
    serviceDeserts: rows.filter(r => r.alma_count === 0).length,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Heat color utilities
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const heatColor = (v: number) => {
  const g = Math.round(240 - v * 200);
  const b = Math.round(240 - v * 200);
  return `rgb(220, ${g}, ${b})`;
};

const heatText = (v: number) =>
  v > 0.6 ? 'text-red-900 font-bold' : v > 0.3 ? 'text-red-800' : 'text-gray-700';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pipeline Flow Component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PIPELINE_STAGES = [
  {
    num: 1,
    label: 'School',
    sublabel: 'Exclusion & Disadvantage',
    color: 'bg-amber-500',
    borderColor: 'border-amber-500',
    textColor: 'text-amber-700',
    bgColor: 'bg-amber-50',
    getStats: (s: PipelineStats) => [
      { label: 'Avg low-ICSEA schools', value: s.avgLowIcsea.toFixed(1) },
      { label: 'Avg Indigenous %', value: `${s.avgIndigenousPct}%` },
    ],
    narrative: 'It starts here. Schools in these communities are some of the most under-resourced in the country. When a child is excluded, they don\'t disappear — they enter the next system.',
  },
  {
    num: 2,
    label: 'Disability',
    sublabel: 'NDIS & Unmet Need',
    color: 'bg-purple-500',
    borderColor: 'border-purple-500',
    textColor: 'text-purple-700',
    bgColor: 'bg-purple-50',
    getStats: (s: PipelineStats) => [
      { label: 'NDIS participants /1K', value: String(s.avgNdisRate) },
    ],
    narrative: 'Young people with disabilities — cognitive, psychosocial, intellectual — are wildly overrepresented in youth justice. Many were never diagnosed, never supported, never given a plan.',
  },
  {
    num: 3,
    label: 'Welfare',
    sublabel: 'Poverty & Payment Dependency',
    color: 'bg-blue-500',
    borderColor: 'border-blue-500',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-50',
    getStats: (s: PipelineStats) => [
      { label: 'DSP /1K pop', value: String(s.avgDspRate) },
      { label: 'JobSeeker /1K', value: String(s.avgJobseekerRate) },
      { label: 'Youth Allowance /1K', value: String(s.avgYouthAllowanceRate) },
    ],
    narrative: 'The families in these communities are on welfare payments at rates far above the national average. Poverty is not a moral failing — it\'s a predictor of every other system contact.',
  },
  {
    num: 4,
    label: 'Child Protection',
    sublabel: 'State-Level Indicators',
    color: 'bg-orange-500',
    borderColor: 'border-orange-500',
    textColor: 'text-orange-700',
    bgColor: 'bg-orange-50',
    getStats: () => [
      { label: 'Data gap', value: 'State-level only' },
    ],
    narrative: 'Child protection data is not published at LGA level in any state. We know from state-level data that the same communities appear. This is a deliberate blind spot — and we name it.',
  },
  {
    num: 5,
    label: 'Youth Justice',
    sublabel: 'Detention & Recidivism',
    color: 'bg-red-600',
    borderColor: 'border-red-600',
    textColor: 'text-red-700',
    bgColor: 'bg-red-50',
    getStats: (s: PipelineStats) => [
      { label: 'Avg $/day detention', value: `$${s.avgCostPerDay.toLocaleString()}` },
      { label: 'Avg recidivism', value: s.avgRecidivism !== null ? `${s.avgRecidivism}%` : '—' },
      { label: 'Indigenous over-rep', value: `${s.avgIndigenousRatio}x` },
    ],
    narrative: 'The end of the pipeline. By now the system has failed this child at every stage. We spend more per day to lock them up than it would cost to house, mentor, and train them.',
  },
];

function PipelineFlow({ stats, stateFilter }: { stats: PipelineStats; stateFilter: string }) {
  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider">The Pipeline</h2>
        <span className="text-xs font-bold text-bauhaus-muted">
          {stateFilter === 'ALL' ? 'National' : stateFilter} — {stats.totalLgas} LGAs, {stats.totalPopulation.toLocaleString()} people
        </span>
      </div>

      <div className="space-y-0">
        {PIPELINE_STAGES.map((stage, i) => {
          const stageStats = stage.getStats(stats);
          return (
            <div key={stage.num} className="relative">
              {/* Connector line */}
              {i < PIPELINE_STAGES.length - 1 && (
                <div className="absolute left-6 top-full w-0.5 h-4 bg-gray-300 z-10" />
              )}

              <div className={`border-l-4 ${stage.borderColor} ${stage.bgColor} p-5 rounded-r-sm`}>
                <div className="flex items-start gap-4">
                  {/* Stage number */}
                  <div className={`${stage.color} text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0`}>
                    {stage.num}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <h3 className={`font-black text-base ${stage.textColor} uppercase tracking-wider`}>{stage.label}</h3>
                      <span className="text-xs text-gray-500">{stage.sublabel}</span>
                    </div>

                    <p className="text-sm text-gray-600 leading-relaxed mb-3 max-w-2xl">
                      {stage.narrative}
                    </p>

                    {/* Stats chips */}
                    <div className="flex flex-wrap gap-2">
                      {stageStats.map(s => (
                        <span key={s.label} className="text-xs font-mono bg-white border border-gray-200 rounded px-2 py-1">
                          <span className="font-bold">{s.value}</span>
                          <span className="text-gray-400 ml-1">{s.label}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Spacer for connector */}
              {i < PIPELINE_STAGES.length - 1 && <div className="h-4" />}
            </div>
          );
        })}
      </div>

      {/* Service desert callout */}
      {stats.serviceDeserts > 0 && (
        <div className="mt-6 border-2 border-dashed border-red-300 bg-red-50/50 rounded-sm p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">&#9888;</span>
            <div>
              <div className="font-black text-sm text-red-800 uppercase tracking-wider mb-1">Service Deserts</div>
              <p className="text-sm text-red-700">
                <span className="font-bold">{stats.serviceDeserts} of {stats.totalLgas} LGAs</span> have zero documented
                youth justice interventions in ALMA. These communities have the most need and the least help.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Heatmap Table Component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function HeatmapTable({ rows }: { rows: HeatmapRow[] }) {
  const hasCrimeData = rows.some(r => r.crime_rate > 0);
  const scored = useMemo(() => computeScored(rows).slice(0, 50), [rows]);

  const heatCell = (val: string | number, score: number, border = false) => (
    <td
      className={`px-2 py-2 text-right font-mono text-[11px] border-b border-gray-100 ${border ? 'border-l border-gray-200' : ''}`}
      style={{ backgroundColor: heatColor(score) }}
    >
      <span className={heatText(score)}>{typeof val === 'number' ? val.toLocaleString() : val}</span>
    </td>
  );

  return (
    <div className="overflow-x-auto border-4 border-bauhaus-black rounded-sm mb-8">
      <table className="w-full text-sm" style={{ minWidth: 1400 }}>
        <thead>
          <tr className="bg-bauhaus-black text-white text-left">
            <th className="px-2 py-3 font-black uppercase tracking-wider text-[10px]" colSpan={2}>Place</th>
            <th className="px-2 py-3 font-black uppercase tracking-wider text-[10px] text-center border-l border-gray-600" colSpan={3}>Education</th>
            <th className="px-2 py-3 font-black uppercase tracking-wider text-[10px] text-center border-l border-gray-600" colSpan={3}>Welfare</th>
            <th className="px-2 py-3 font-black uppercase tracking-wider text-[10px] text-center border-l border-gray-600" colSpan={4}>Youth Justice <span className="font-normal text-gray-400">(state)</span></th>
            <th className="px-2 py-3 font-black uppercase tracking-wider text-[10px] text-center border-l border-gray-600">NDIS</th>
            {hasCrimeData && <th className="px-2 py-3 font-black uppercase tracking-wider text-[10px] text-center border-l border-gray-600">Crime</th>}
            <th className="px-2 py-3 font-black uppercase tracking-wider text-[10px] text-center border-l border-gray-600">ALMA</th>
            <th className="px-2 py-3 font-black uppercase tracking-wider text-[10px] text-center border-l border-gray-600">All</th>
          </tr>
          <tr className="bg-gray-800 text-gray-300 text-left text-[9px]">
            <th className="px-2 py-1 font-bold uppercase tracking-wider">LGA</th>
            <th className="px-2 py-1 font-bold uppercase tracking-wider w-8">ST</th>
            <th className="px-2 py-1 font-bold uppercase tracking-wider text-right border-l border-gray-600">Low ICSEA</th>
            <th className="px-2 py-1 font-bold uppercase tracking-wider text-right">ICSEA</th>
            <th className="px-2 py-1 font-bold uppercase tracking-wider text-right">Indig %</th>
            <th className="px-2 py-1 font-bold uppercase tracking-wider text-right border-l border-gray-600">DSP /1K</th>
            <th className="px-2 py-1 font-bold uppercase tracking-wider text-right">JobSeek /1K</th>
            <th className="px-2 py-1 font-bold uppercase tracking-wider text-right">Youth A. /1K</th>
            <th className="px-2 py-1 font-bold uppercase tracking-wider text-right border-l border-gray-600">$/Day</th>
            <th className="px-2 py-1 font-bold uppercase tracking-wider text-right">Recid %</th>
            <th className="px-2 py-1 font-bold uppercase tracking-wider text-right">Indig Ratio</th>
            <th className="px-2 py-1 font-bold uppercase tracking-wider text-right">Det Indig %</th>
            <th className="px-2 py-1 font-bold uppercase tracking-wider text-right border-l border-gray-600">NDIS /1K</th>
            {hasCrimeData && <th className="px-2 py-1 font-bold uppercase tracking-wider text-right border-l border-gray-600">Rate/100K</th>}
            <th className="px-2 py-1 font-bold uppercase tracking-wider text-right border-l border-gray-600">Intrvns</th>
            <th className="px-2 py-1 font-bold uppercase tracking-wider text-center border-l border-gray-600">Score</th>
          </tr>
        </thead>
        <tbody>
          {scored.map((row) => (
            <tr key={row.lga_name} className={row.alma_count === 0 && row.burden > 0.4 ? 'bg-red-50/30' : ''}>
              <td className="px-2 py-2 font-bold text-xs border-b border-gray-100 whitespace-nowrap">
                {row.lga_name}
                {row.alma_count === 0 && row.burden > 0.4 && (
                  <span className="ml-1 text-[9px] text-red-500" title="Service desert — no documented ALMA interventions">&#9888;</span>
                )}
              </td>
              <td className="px-2 py-2 text-[10px] text-gray-500 border-b border-gray-100">{row.state}</td>
              {heatCell(row.low_icsea, row.scores.lowIcsea, true)}
              {heatCell(row.avg_icsea || '—', row.scores.icsea)}
              {heatCell(`${Math.round(row.indigenous_pct)}%`, row.scores.indigenous)}
              {heatCell(row.dsp_rate, row.scores.dsp, true)}
              {heatCell(row.jobseeker_rate, row.scores.jobseeker)}
              {heatCell(row.youth_allowance_rate, row.scores.youthAllowance)}
              {heatCell(`$${row.cost_per_day.toLocaleString()}`, row.scores.costPerDay, true)}
              {heatCell(row.recidivism_pct !== null ? `${row.recidivism_pct}%` : '—', row.scores.recidivism)}
              {heatCell(`${row.indigenous_rate_ratio}x`, row.scores.indRatio)}
              {heatCell(`${row.detention_indigenous_pct}%`, row.scores.detIndPct)}
              {heatCell(row.ndis_rate, row.scores.ndis, true)}
              {hasCrimeData && heatCell(row.crime_rate > 0 ? row.crime_rate : '—', row.scores.crime, true)}
              <td className="px-2 py-2 text-right font-mono text-[11px] border-b border-gray-100 border-l border-gray-200">
                {row.alma_count > 0 ? (
                  <span className="text-emerald-600 font-bold">{row.alma_count}</span>
                ) : (
                  <span className="text-red-400">0</span>
                )}
              </td>
              <td
                className="px-2 py-2 text-center font-mono text-xs font-black border-b border-gray-100 border-l border-gray-200"
                style={{ backgroundColor: heatColor(row.burden) }}
              >
                <span className={heatText(row.burden)}>{Math.round(row.burden * 100)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// State Comparison Cards
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function StateCards({ rows, onSelectState, activeState }: {
  rows: HeatmapRow[];
  onSelectState: (state: string) => void;
  activeState: string;
}) {
  const stateData = useMemo(() => {
    const byState = new Map<string, HeatmapRow[]>();
    for (const row of rows) {
      const existing = byState.get(row.state) || [];
      existing.push(row);
      byState.set(row.state, existing);
    }
    return ALL_STATES.map(state => {
      const stateRows = byState.get(state) || [];
      const n = stateRows.length || 1;
      const withCrime = stateRows.filter(r => r.crime_rate > 0);
      return {
        state,
        lgas: stateRows.length,
        population: stateRows.reduce((s, r) => s + r.population, 0),
        avgDspRate: Math.round(stateRows.reduce((s, r) => s + r.dsp_rate, 0) / n),
        avgCostPerDay: Math.round(stateRows.reduce((s, r) => s + r.cost_per_day, 0) / n),
        recidivism: stateRows[0]?.recidivism_pct ?? null,
        indigenousRatio: Math.round(stateRows.reduce((s, r) => s + r.indigenous_rate_ratio, 0) / n * 10) / 10,
        avgCrimeRate: withCrime.length > 0 ? Math.round(withCrime.reduce((s, r) => s + r.crime_rate, 0) / withCrime.length) : null,
        serviceDeserts: stateRows.filter(r => r.alma_count === 0).length,
      };
    }).filter(s => s.lgas > 0);
  }, [rows]);

  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-black text-bauhaus-muted uppercase tracking-wider">By State</h2>
        {activeState !== 'ALL' && (
          <button
            onClick={() => onSelectState('ALL')}
            className="text-[10px] font-bold text-bauhaus-red uppercase tracking-wider hover:underline"
          >
            Clear filter
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {stateData.map(s => (
          <button
            key={s.state}
            onClick={() => onSelectState(activeState === s.state ? 'ALL' : s.state)}
            className={`text-left border-2 rounded-sm p-3 transition-all ${
              activeState === s.state
                ? 'border-bauhaus-black bg-gray-50 shadow-sm'
                : 'border-gray-200 hover:border-gray-400'
            }`}
          >
            <div className="font-black text-base">{s.state}</div>
            <div className="text-[10px] text-gray-500 mb-2">{s.lgas} LGAs</div>
            <div className="space-y-0.5 text-[10px] font-mono">
              <div>DSP <span className="font-bold">{s.avgDspRate}</span>/1K</div>
              <div>Recid <span className="font-bold">{s.recidivism !== null ? `${s.recidivism}%` : '—'}</span></div>
              <div>Indig <span className="font-bold">{s.indigenousRatio}x</span></div>
              {s.serviceDeserts > 0 && (
                <div className="text-red-500">&#9888; {s.serviceDeserts} deserts</div>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main Export
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function FollowTheChild({ rows }: { rows: HeatmapRow[] }) {
  const [stateFilter, setStateFilter] = useState('ALL');

  const filteredRows = useMemo(
    () => stateFilter === 'ALL' ? rows : rows.filter(r => r.state === stateFilter),
    [rows, stateFilter]
  );

  const stats = useMemo(() => computePipelineStats(filteredRows), [filteredRows]);

  return (
    <>
      <PipelineFlow stats={stats} stateFilter={stateFilter} />
      <StateCards rows={rows} onSelectState={setStateFilter} activeState={stateFilter} />

      <section className="mb-10">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-1">Cross-System Overlap</h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          {filteredRows.length} LGAs {stateFilter !== 'ALL' ? `in ${STATE_NAMES[stateFilter] || stateFilter}` : 'across Australia'} — same places, same young people, different government systems.
          Each cell shows intensity relative to the worst LGA. When an entire row is dark, every system is failing that community simultaneously.
          {' '}Showing top 50 by weighted burden score.
          {' '}<span className="text-red-500">&#9888;</span> = service desert (zero documented ALMA interventions).
        </p>

        {filteredRows.length > 0 ? (
          <HeatmapTable rows={filteredRows} />
        ) : (
          <p className="text-sm text-gray-400 italic">No data for {stateFilter}.</p>
        )}
      </section>
    </>
  );
}
