import { cache } from 'react';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * Schools as the need signal for a place.
 *
 * Everything else on these pages describes money, and money is recorded against
 * whichever organisation holds it — so in remote Australia it is recorded in
 * the wrong place, in five distinct ways this codebase now documents. Schools do
 * not have that problem. A school is where its students are. ACARA publishes
 * coordinates, a council, enrolments, an Indigenous enrolment share and ICSEA
 * for every school in the country, 2025, and none of it depends on our entity
 * resolution being right.
 *
 * That makes this the only trustworthy per-place measure we hold, and — with
 * abs_indigenous_population_by_lga sitting empty — the closest thing we have to
 * an Indigenous population signal anywhere in the database.
 *
 * ICSEA is the Index of Community Socio-Educational Advantage. National mean
 * 1000, standard deviation 100. Central Desert averages 609, which is nearly
 * four standard deviations below the mean, and that number needs saying in
 * words rather than printing bare.
 */

export interface SchoolNeedSignal {
  lgaName: string;
  schools: number;
  students: number;
  /** Enrolment-weighted ICSEA. Null when no school here publishes one. */
  meanIcsea: number | null;
  /** Enrolment-weighted share of students who are Indigenous. */
  indigenousPct: number | null;
  /** The most disadvantaged school here, by ICSEA. */
  lowestIcseaSchool: { name: string; icsea: number } | null;
  schoolsWithoutIcsea: number;
}

function num(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function quoted(values: string[]): string {
  return values.map(value => `'${value.replace(/'/g, "''")}'`).join(',');
}

/**
 * How far below the national mean an ICSEA sits, in plain words.
 *
 * A reader should not have to know that the mean is 1000 and the standard
 * deviation 100 to understand that 609 is extreme.
 */
export function describeIcsea(icsea: number): string {
  const sd = (1000 - icsea) / 100;
  if (sd <= 0.5) return 'around the national average';
  if (sd < 1.5) return `about ${sd.toFixed(1)} standard deviations below the national average`;
  return `${sd.toFixed(1)} standard deviations below the national average, which is among the most disadvantaged in the country`;
}

export const getSchoolNeedSignals = cache(async function getSchoolNeedSignals(
  lgaNames: string[],
): Promise<Map<string, SchoolNeedSignal>> {
  const result = new Map<string, SchoolNeedSignal>();
  if (lgaNames.length === 0) return result;

  const db = getServiceSupabase();
  // Weighted by enrolments, not a plain average of schools. A 20-student
  // homeland school and a 900-student town high school are not equal evidence
  // about a place, and averaging them flat would say they were.
  const { data } = await db.rpc('exec_sql', {
    query: `SELECT lga_name,
                   count(*) AS schools,
                   coalesce(sum(total_enrolments),0) AS students,
                   count(*) FILTER (WHERE icsea_value IS NULL) AS without_icsea,
                   round(sum(icsea_value * total_enrolments) FILTER (WHERE icsea_value IS NOT NULL)
                         / nullif(sum(total_enrolments) FILTER (WHERE icsea_value IS NOT NULL),0)) AS mean_icsea,
                   round((sum(total_enrolments * indigenous_pct) FILTER (WHERE indigenous_pct IS NOT NULL)
                         / nullif(sum(total_enrolments) FILTER (WHERE indigenous_pct IS NOT NULL),0))::numeric,1) AS indigenous_pct
              FROM acara_schools
             WHERE lga_name IN (${quoted(lgaNames)})
             GROUP BY lga_name`,
  });
  if (!Array.isArray(data)) return result;

  const { data: lowest } = await db.rpc('exec_sql', {
    query: `SELECT DISTINCT ON (lga_name) lga_name, school_name, icsea_value
              FROM acara_schools
             WHERE lga_name IN (${quoted(lgaNames)}) AND icsea_value IS NOT NULL
             ORDER BY lga_name, icsea_value ASC`,
  });
  const lowestByLga = new Map<string, { name: string; icsea: number }>();
  for (const entry of Array.isArray(lowest) ? lowest : []) {
    const row = entry as Record<string, unknown>;
    lowestByLga.set(String(row.lga_name), {
      name: String(row.school_name ?? ''),
      icsea: num(row.icsea_value),
    });
  }

  for (const entry of data as Array<Record<string, unknown>>) {
    const lgaName = String(entry.lga_name ?? '');
    const meanIcsea = entry.mean_icsea === null ? null : num(entry.mean_icsea);
    result.set(lgaName, {
      lgaName,
      schools: num(entry.schools),
      students: num(entry.students),
      meanIcsea,
      indigenousPct: entry.indigenous_pct === null ? null : num(entry.indigenous_pct),
      lowestIcseaSchool: lowestByLga.get(lgaName) ?? null,
      schoolsWithoutIcsea: num(entry.without_icsea),
    });
  }
  return result;
});

export const getSchoolNeedSignal = cache(async function getSchoolNeedSignal(
  lgaName: string,
): Promise<SchoolNeedSignal | null> {
  const signals = await getSchoolNeedSignals([lgaName]);
  return signals.get(lgaName) ?? null;
});

/**
 * One signal for a whole region.
 *
 * Re-weighted by enrolments across councils rather than averaging the council
 * averages, which would let a council with 163 students pull as hard as one
 * with 4,687.
 */
export const getRegionSchoolNeedSignal = cache(async function getRegionSchoolNeedSignal(
  lgaNames: string[],
): Promise<SchoolNeedSignal | null> {
  const signals = [...(await getSchoolNeedSignals(lgaNames)).values()];
  if (signals.length === 0) return null;

  let students = 0;
  let schools = 0;
  let withoutIcsea = 0;
  let icseaWeight = 0;
  let icseaSum = 0;
  let indigenousWeight = 0;
  let indigenousSum = 0;
  let lowest: { name: string; icsea: number } | null = null;

  for (const signal of signals) {
    students += signal.students;
    schools += signal.schools;
    withoutIcsea += signal.schoolsWithoutIcsea;
    if (signal.meanIcsea !== null) {
      icseaSum += signal.meanIcsea * signal.students;
      icseaWeight += signal.students;
    }
    if (signal.indigenousPct !== null) {
      indigenousSum += signal.indigenousPct * signal.students;
      indigenousWeight += signal.students;
    }
    if (signal.lowestIcseaSchool && (!lowest || signal.lowestIcseaSchool.icsea < lowest.icsea)) {
      lowest = signal.lowestIcseaSchool;
    }
  }

  return {
    lgaName: lgaNames.join(', '),
    schools,
    students,
    meanIcsea: icseaWeight > 0 ? Math.round(icseaSum / icseaWeight) : null,
    indigenousPct: indigenousWeight > 0 ? Math.round((10 * indigenousSum) / indigenousWeight) / 10 : null,
    lowestIcseaSchool: lowest,
    schoolsWithoutIcsea: withoutIcsea,
  };
});
