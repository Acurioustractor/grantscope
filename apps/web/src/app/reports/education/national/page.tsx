import Link from 'next/link';
import {
  getStateComparisonMetrics,
  getOutcomesMetrics,
  money,
  fmt,
} from '@/lib/services/report-service';
import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/services/utils';

export const revalidate = 3600;

export function generateMetadata() {
  return {
    title: 'National Education Comparison — CivicGraph',
    description: 'Compare education outcomes across all Australian states and territories.',
  };
}

type ComparisonRow = { jurisdiction: string; metric_name: string; metric_value: number; metric_unit: string; period: string; cohort: string | null };
type MetricRow = { metric_name: string; metric_value: number; metric_unit: string; period: string; cohort: string | null; source: string; notes: string | null };
type SchoolRow = {
  state: string; total_schools: number; avg_icsea: number;
  total_enrolments: number; avg_indigenous_pct: number;
  low_icsea_schools: number; gov_schools: number; non_gov_schools: number;
};

const JURISDICTIONS = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'NT', 'TAS', 'ACT', 'National'] as const;
const STATES = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'NT', 'TAS', 'ACT'] as const;

const COMPARISON_METRICS = [
  'rogs_edu_total_enrolments', 'rogs_edu_primary_enrolments', 'rogs_edu_secondary_enrolments',
  'rogs_edu_ratio_primary',
  'rogs_edu_participation_15yo', 'rogs_edu_participation_16yo', 'rogs_edu_participation_17yo',
  'rogs_edu_vet_completion_pct',
  'rogs_edu_attendance_all', 'rogs_edu_retention_yr12',
  'rogs_edu_disability_supplementary', 'rogs_edu_disability_substantial', 'rogs_edu_disability_extensive',
];

const METRIC_LABELS: Record<string, { label: string; format?: string; higherIsWorse?: boolean }> = {
  rogs_edu_total_enrolments: { label: 'Total enrolments', format: 'number' },
  rogs_edu_primary_enrolments: { label: 'Primary enrolments', format: 'number' },
  rogs_edu_secondary_enrolments: { label: 'Secondary enrolments', format: 'number' },
  rogs_edu_ratio_primary: { label: 'Student-teacher ratio (primary)', format: 'ratio' },
  rogs_edu_participation_15yo: { label: 'Participation rate 15yo', format: 'pct' },
  rogs_edu_participation_16yo: { label: 'Participation rate 16yo', format: 'pct' },
  rogs_edu_participation_17yo: { label: 'Participation rate 17yo', format: 'pct', higherIsWorse: false },
  rogs_edu_vet_completion_pct: { label: 'VET completion rate', format: 'pct' },
  rogs_edu_attendance_all: { label: 'Attendance rate (Yr 1-10)', format: 'pct' },
  rogs_edu_retention_yr12: { label: 'Year 12 retention rate', format: 'pct' },
  rogs_edu_disability_supplementary: { label: 'Disability adj. (supplementary)', format: 'pct' },
  rogs_edu_disability_substantial: { label: 'Disability adj. (substantial)', format: 'pct' },
  rogs_edu_disability_extensive: { label: 'Disability adj. (extensive)', format: 'pct' },
};

async function getSchoolsByState() {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT state,
              COUNT(*)::int as total_schools,
              ROUND(AVG(icsea_value))::int as avg_icsea,
              SUM(total_enrolments)::int as total_enrolments,
              ROUND(AVG(indigenous_pct)::numeric, 1)::float as avg_indigenous_pct,
              COUNT(*) FILTER (WHERE icsea_value < 900)::int as low_icsea_schools,
              COUNT(*) FILTER (WHERE school_sector = 'Government')::int as gov_schools,
              COUNT(*) FILTER (WHERE school_sector != 'Government')::int as non_gov_schools
       FROM acara_schools
       GROUP BY state
       ORDER BY total_enrolments DESC`,
  })) as Promise<SchoolRow[] | null>;
}

async function getData() {
  const [comparison, nationalMetrics, schools] = await Promise.all([
    getStateComparisonMetrics(COMPARISON_METRICS, 'education'),
    getOutcomesMetrics('National', 'education'),
    getSchoolsByState(),
  ]);

  return {
    comparison: (comparison as ComparisonRow[] | null) || [],
    national: (nationalMetrics as MetricRow[] | null) || [],
    schools: (schools as SchoolRow[] | null) || [],
  };
}

function formatValue(v: number, format?: string): string {
  if (format === 'money') return money(v);
  if (format === 'pct') return `${v}%`;
  if (format === 'ratio') return `${v}:1`;
  return v.toLocaleString();
}

export default async function NationalEducationComparisonPage() {
  const data = await getData();

  const comp: Record<string, Record<string, number>> = {};
  for (const row of data.comparison) {
    if (!comp[row.metric_name]) comp[row.metric_name] = {};
    const existing = comp[row.metric_name][row.jurisdiction];
    if (existing === undefined || row.cohort === 'all') {
      comp[row.metric_name][row.jurisdiction] = row.metric_value;
    }
  }
  const cv = (metric: string, jur: string) => comp[metric]?.[jur] ?? null;

  const nm = (name: string) => data.national.find(r => r.metric_name === name)?.metric_value ?? null;

  // School totals
  const totalSchools = data.schools.reduce((s, r) => s + r.total_schools, 0);
  const totalStudents = data.schools.reduce((s, r) => s + r.total_enrolments, 0);
  const totalLowIcsea = data.schools.reduce((s, r) => s + r.low_icsea_schools, 0);
  const avgIcsea = data.schools.length > 0
    ? Math.round(data.schools.reduce((s, r) => s + r.avg_icsea * r.total_schools, 0) / totalSchools)
    : null;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <Link href="/reports/education" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; Education Reports
        </Link>
        <div className="flex items-center gap-3 mt-4 mb-1">
          <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">National Comparison</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Australian Education: State by State
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          How does each state compare on school outcomes, ICSEA scores, participation rates,
          and educational disadvantage? ACARA + ROGS 2026 data.
        </p>
      </div>

      {/* National Headlines */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-emerald-600">{fmt(totalSchools)}</div>
          <div className="text-xs text-gray-500 mt-1">Schools nationally</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-blue-600">{totalStudents > 0 ? `${(totalStudents / 1_000_000).toFixed(1)}M` : '—'}</div>
          <div className="text-xs text-gray-500 mt-1">Total enrolments</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-red-600">{fmt(totalLowIcsea)}</div>
          <div className="text-xs text-gray-500 mt-1">Schools below ICSEA 900</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-gray-700">{avgIcsea ?? '—'}</div>
          <div className="text-xs text-gray-500 mt-1">Weighted avg ICSEA</div>
        </div>
      </div>

      {/* School Landscape Table */}
      {data.schools.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-emerald-500 pb-2">
            School Landscape by State
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">
            ACARA MySchool data — school counts, ICSEA scores, disadvantage indicators.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-bauhaus-black">
                  <th className="text-left py-2 font-black uppercase tracking-wider text-xs">State</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Schools</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Students</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Avg ICSEA</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">&lt;900 ICSEA</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Indigenous %</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Gov / Non-Gov</th>
                </tr>
              </thead>
              <tbody>
                {data.schools.map(s => {
                  const lowPct = s.total_schools > 0 ? Math.round((s.low_icsea_schools / s.total_schools) * 100) : 0;
                  return (
                    <tr key={s.state} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-2">
                        <Link href={`/reports/education/${s.state.toLowerCase()}`} className="font-black text-bauhaus-blue hover:underline">{s.state}</Link>
                      </td>
                      <td className="py-2 text-right">{fmt(s.total_schools)}</td>
                      <td className="py-2 text-right">{fmt(s.total_enrolments)}</td>
                      <td className="py-2 text-right">
                        <span className={s.avg_icsea < 950 ? 'text-red-600 font-bold' : ''}>{s.avg_icsea}</span>
                      </td>
                      <td className="py-2 text-right">
                        <span className={lowPct > 15 ? 'text-red-600 font-bold' : ''}>
                          {fmt(s.low_icsea_schools)} ({lowPct}%)
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <span className={s.avg_indigenous_pct > 10 ? 'text-amber-600 font-bold' : ''}>
                          {s.avg_indigenous_pct}%
                        </span>
                      </td>
                      <td className="py-2 text-right text-gray-600">{fmt(s.gov_schools)} / {fmt(s.non_gov_schools)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ROGS Comparison Table */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-emerald-500 pb-2">
          Outcomes Comparison (ROGS 2026)
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          Participation, enrolments, student-teacher ratios, and VET completion.
        </p>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-bauhaus-black">
                <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Metric</th>
                {JURISDICTIONS.map(j => (
                  <th key={j} className="text-right py-2 font-black uppercase tracking-wider text-xs">
                    {j === 'National' ? j : (
                      <Link href={`/reports/education/${j.toLowerCase()}`} className="text-bauhaus-blue hover:underline">{j}</Link>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_METRICS.map(metric => {
                const meta = METRIC_LABELS[metric];
                if (!meta) return null;
                const vals = JURISDICTIONS.map(j => cv(metric, j));
                if (vals.every(v => v === null)) return null;
                const stateVals = STATES.map(j => cv(metric, j)).filter((v): v is number => v !== null);
                const maxVal = stateVals.length > 0 ? Math.max(...stateVals) : null;
                const minVal = stateVals.length > 0 ? Math.min(...stateVals) : null;
                const isParticipation = metric.includes('participation');
                return (
                  <tr key={metric} className={`border-b border-gray-200 ${isParticipation ? 'bg-emerald-50' : ''}`}>
                    <td className="py-2 font-medium">{meta.label}</td>
                    {JURISDICTIONS.map((j, ji) => {
                      const v = vals[ji];
                      const isNational = j === 'National';
                      const isMax = v === maxVal && !isNational;
                      const isMin = v === minVal && !isNational;
                      let cls = 'py-2 text-right';
                      // For participation, higher is better; for ratio, lower is better
                      if (isParticipation && isMax) cls += ' text-emerald-600 font-bold';
                      else if (isParticipation && isMin) cls += ' text-red-600 font-bold';
                      else if (isNational) cls += ' font-bold';
                      return <td key={j} className={cls}>{v !== null ? formatValue(v, meta.format) : '—'}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* State Scorecards */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
          State Scorecards
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STATES.map(s => {
            const school = data.schools.find(r => r.state === s);
            const participation = cv('rogs_edu_participation_17yo', s);
            const vet = cv('rogs_edu_vet_completion_pct', s);
            return (
              <Link key={s} href={`/reports/education/${s.toLowerCase()}`}
                className="border border-gray-200 rounded-xl p-4 hover:border-emerald-400 transition-colors">
                <span className="font-black text-lg text-bauhaus-black">{s}</span>
                <div className="space-y-1 text-xs mt-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Schools</span>
                    <span className="font-bold">{school ? fmt(school.total_schools) : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg ICSEA</span>
                    <span className={`font-bold ${school && school.avg_icsea < 950 ? 'text-red-600' : ''}`}>{school?.avg_icsea ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">17yo part.</span>
                    <span className="font-bold">{participation != null ? `${participation}%` : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">VET comp.</span>
                    <span className="font-bold">{vet != null ? `${vet}%` : '—'}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="text-xs text-gray-400 text-center pb-8">
        Data from CivicGraph. Sources: ACARA MySchool 2023, ROGS 2026 Tables 4A/4B.
      </div>
    </div>
  );
}
