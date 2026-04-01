/**
 * Place Data Service — geographic data layers for place pages
 * Joins crime_stats_lga, acara_schools, ndis_participants_lga, dss_payment_demographics
 * to postcode via postcode_geo LGA/postcode keys.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Types ──────────────────────────────────────────────────────────────

export interface CrimeSummary {
  lga_name: string;
  offences: Array<{
    offence_group: string;
    total_incidents: number;
    rate_per_100k: number | null;
    two_year_trend_pct: number | null;
    ten_year_trend_pct: number | null;
  }>;
  year_period: string | null;
}

export interface SchoolProfile {
  school_name: string;
  school_type: string;
  school_sector: string;
  icsea_value: number | null;
  total_enrolments: number | null;
  indigenous_pct: number | null;
  lbote_pct: number | null;
}

export interface NdisParticipants {
  lga_name: string;
  participant_count: number;
  reporting_period: string;
  quarter_date: string | null;
}

export interface DssPaymentSummary {
  payment_type: string;
  recipient_count: number;
  indigenous_count: number | null;
  male_count: number | null;
  female_count: number | null;
  age_under_25: number | null;
  age_25_44: number | null;
  age_45_64: number | null;
  age_65_plus: number | null;
}

export interface PlaceDataLayers {
  crime: CrimeSummary | null;
  schools: SchoolProfile[];
  ndis_participants: NdisParticipants | null;
  dss_payments: DssPaymentSummary[];
}

// ── Helpers ────────────────────────────────────────────────────────────

/** Strip parenthetical suffix: "Bayside (Vic.)" → "Bayside" */
function stripLgaSuffix(lgaName: string): string {
  return lgaName.replace(/\s*\(.*?\)\s*$/, '').trim();
}

// ── Query functions ────────────────────────────────────────────────────

async function getCrimeStats(
  db: SupabaseClient,
  lgaName: string | null,
  state: string | null,
): Promise<CrimeSummary | null> {
  if (!lgaName || !state) return null;

  const cleanLga = stripLgaSuffix(lgaName);
  const { data } = await db.rpc('exec_sql', {
    query: `SELECT offence_group, SUM(incidents) as total_incidents,
              AVG(rate_per_100k) as rate_per_100k,
              AVG(two_year_trend_pct) as two_year_trend_pct,
              AVG(ten_year_trend_pct) as ten_year_trend_pct,
              MAX(year_period) as year_period
            FROM crime_stats_lga
            WHERE lga_name = '${cleanLga.replace(/'/g, "''")}' AND state = '${state}'
              AND offence_group != 'Summary'
            GROUP BY offence_group
            ORDER BY total_incidents DESC
            LIMIT 10`,
  });

  if (!data || !Array.isArray(data) || data.length === 0) return null;

  return {
    lga_name: cleanLga,
    offences: data.map((row: Record<string, unknown>) => ({
      offence_group: String(row.offence_group || ''),
      total_incidents: Number(row.total_incidents || 0),
      rate_per_100k: row.rate_per_100k != null ? Number(row.rate_per_100k) : null,
      two_year_trend_pct: row.two_year_trend_pct != null ? Number(row.two_year_trend_pct) : null,
      ten_year_trend_pct: row.ten_year_trend_pct != null ? Number(row.ten_year_trend_pct) : null,
    })),
    year_period: data[0]?.year_period ? String(data[0].year_period) : null,
  };
}

async function getSchools(
  db: SupabaseClient,
  postcode: string,
): Promise<SchoolProfile[]> {
  const { data } = await db
    .from('acara_schools')
    .select('school_name, school_type, school_sector, icsea_value, total_enrolments, indigenous_pct, lbote_pct')
    .eq('postcode', postcode)
    .order('total_enrolments', { ascending: false, nullsFirst: false })
    .limit(20);

  if (!data) return [];
  return data.map((row) => ({
    school_name: row.school_name,
    school_type: row.school_type,
    school_sector: row.school_sector,
    icsea_value: row.icsea_value,
    total_enrolments: row.total_enrolments,
    indigenous_pct: row.indigenous_pct,
    lbote_pct: row.lbote_pct,
  }));
}

async function getNdisParticipants(
  db: SupabaseClient,
  lgaCode: string | null,
  lgaName: string | null,
): Promise<NdisParticipants | null> {
  // Try lga_code first, fall back to lga_name ILIKE (NDIS uses suffixed names like "Alice Springs (T)")
  if (lgaCode) {
    const { data } = await db
      .from('ndis_participants_lga')
      .select('lga_name, participant_count, reporting_period, quarter_date')
      .eq('lga_code', lgaCode)
      .order('quarter_date', { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      return {
        lga_name: data[0].lga_name,
        participant_count: data[0].participant_count,
        reporting_period: data[0].reporting_period,
        quarter_date: data[0].quarter_date,
      };
    }
  }

  // Fall back to name match
  if (!lgaName) return null;
  const cleanLga = stripLgaSuffix(lgaName);
  const { data } = await db
    .from('ndis_participants_lga')
    .select('lga_name, participant_count, reporting_period, quarter_date')
    .ilike('lga_name', `${cleanLga}%`)
    .order('quarter_date', { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return null;
  return {
    lga_name: data[0].lga_name,
    participant_count: data[0].participant_count,
    reporting_period: data[0].reporting_period,
    quarter_date: data[0].quarter_date,
  };
}

async function getDssPayments(
  db: SupabaseClient,
  postcode: string,
  lgaCode: string | null,
): Promise<DssPaymentSummary[]> {
  // Prefer postcode-level data; fall back to LGA
  const AGE_COLS = `SUM(age_under_25) as age_under_25, SUM(age_25_44) as age_25_44,
              SUM(age_45_64) as age_45_64, SUM(age_65_plus) as age_65_plus`;

  const mapRow = (row: Record<string, unknown>): DssPaymentSummary => ({
    payment_type: String(row.payment_type || ''),
    recipient_count: Number(row.recipient_count || 0),
    indigenous_count: row.indigenous_count != null ? Number(row.indigenous_count) : null,
    male_count: row.male_count != null ? Number(row.male_count) : null,
    female_count: row.female_count != null ? Number(row.female_count) : null,
    age_under_25: row.age_under_25 != null ? Number(row.age_under_25) : null,
    age_25_44: row.age_25_44 != null ? Number(row.age_25_44) : null,
    age_45_64: row.age_45_64 != null ? Number(row.age_45_64) : null,
    age_65_plus: row.age_65_plus != null ? Number(row.age_65_plus) : null,
  });

  const { data: pcData } = await db.rpc('exec_sql', {
    query: `SELECT payment_type, SUM(recipient_count) as recipient_count,
              SUM(indigenous_count) as indigenous_count,
              SUM(male_count) as male_count, SUM(female_count) as female_count,
              ${AGE_COLS}
            FROM dss_payment_demographics
            WHERE geography_type = 'postcode' AND geography_code = '${postcode}'
            GROUP BY payment_type
            ORDER BY recipient_count DESC
            LIMIT 15`,
  });

  if (pcData && Array.isArray(pcData) && pcData.length > 0) {
    return pcData.map(mapRow);
  }

  // Fall back to LGA
  if (!lgaCode) return [];
  const { data: lgaData } = await db.rpc('exec_sql', {
    query: `SELECT payment_type, SUM(recipient_count) as recipient_count,
              SUM(indigenous_count) as indigenous_count,
              SUM(male_count) as male_count, SUM(female_count) as female_count,
              ${AGE_COLS}
            FROM dss_payment_demographics
            WHERE geography_type = 'lga' AND geography_code = '${lgaCode}'
            GROUP BY payment_type
            ORDER BY recipient_count DESC
            LIMIT 15`,
  });

  if (!lgaData || !Array.isArray(lgaData)) return [];
  return lgaData.map(mapRow);
}

// ── Main entry point ───────────────────────────────────────────────────

export async function getPlaceDataLayers(
  db: SupabaseClient,
  postcode: string,
  lgaName: string | null,
  lgaCode: string | null,
  state: string | null,
): Promise<PlaceDataLayers> {
  const [crime, schools, ndis_participants, dss_payments] = await Promise.all([
    getCrimeStats(db, lgaName, state).catch(() => null),
    getSchools(db, postcode).catch(() => []),
    getNdisParticipants(db, lgaCode, lgaName).catch(() => null),
    getDssPayments(db, postcode, lgaCode).catch(() => []),
  ]);

  return { crime, schools, ndis_participants, dss_payments };
}
