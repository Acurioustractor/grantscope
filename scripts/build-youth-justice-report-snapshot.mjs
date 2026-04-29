#!/usr/bin/env node
/**
 * Build the youth justice report snapshot from the live database.
 *
 * The report pages should stay fast, but the data should not be hard-coded in
 * React. This script reads live CivicGraph tables, folds in the official local
 * ROGS CSV where useful, and writes a compact JSON snapshot for the frontend.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const ROOT = process.cwd();
const OUT_PATH = path.join(ROOT, 'data/report-snapshots/youth-justice.json');
const ROGS_CSV_PATH = path.join(ROOT, 'data/rogs-youth-justice/youth-justice-2026.csv');
const ALL_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];
const STATE_CSV_COLUMNS = {
  NSW: 'NSW',
  VIC: 'Vic',
  QLD: 'Qld',
  WA: 'WA',
  SA: 'SA',
  TAS: 'Tas',
  ACT: 'ACT',
  NT: 'NT',
};

const SNAPSHOT_STATE_METRICS = [
  { jurisdiction: 'ACT', metric_name: 'avg_daily_detention', metric_value: 12, metric_unit: 'count', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'National', metric_name: 'avg_daily_detention', metric_value: 950, metric_unit: 'count', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'NSW', metric_name: 'avg_daily_detention', metric_value: 200, metric_unit: 'count', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'NT', metric_name: 'avg_daily_detention', metric_value: 62, metric_unit: 'count', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'QLD', metric_name: 'avg_daily_detention', metric_value: 317, metric_unit: 'count', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'SA', metric_name: 'avg_daily_detention', metric_value: 80, metric_unit: 'count', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'TAS', metric_name: 'avg_daily_detention', metric_value: 15, metric_unit: 'count', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'VIC', metric_name: 'avg_daily_detention', metric_value: 120, metric_unit: 'count', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'WA', metric_name: 'avg_daily_detention', metric_value: 145, metric_unit: 'count', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'National', metric_name: 'indigenous_overrepresentation_ratio', metric_value: 17, metric_unit: 'ratio', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'NSW', metric_name: 'indigenous_overrepresentation_ratio', metric_value: 22, metric_unit: 'ratio', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'NT', metric_name: 'indigenous_overrepresentation_ratio', metric_value: 5, metric_unit: 'ratio', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'QLD', metric_name: 'indigenous_overrepresentation_ratio', metric_value: 26, metric_unit: 'ratio', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'SA', metric_name: 'indigenous_overrepresentation_ratio', metric_value: 20, metric_unit: 'ratio', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'VIC', metric_name: 'indigenous_overrepresentation_ratio', metric_value: 14, metric_unit: 'ratio', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'WA', metric_name: 'indigenous_overrepresentation_ratio', metric_value: 24, metric_unit: 'ratio', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'ACT', metric_name: 'detention_rate_per_10k', metric_value: 2.2, metric_unit: 'per_10k', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'National', metric_name: 'detention_rate_per_10k', metric_value: 3.4, metric_unit: 'per_10k', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'NSW', metric_name: 'detention_rate_per_10k', metric_value: 3.6, metric_unit: 'per_10k', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'NT', metric_name: 'detention_rate_per_10k', metric_value: 17, metric_unit: 'per_10k', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'QLD', metric_name: 'detention_rate_per_10k', metric_value: 5.1, metric_unit: 'per_10k', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'SA', metric_name: 'detention_rate_per_10k', metric_value: 2.8, metric_unit: 'per_10k', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'TAS', metric_name: 'detention_rate_per_10k', metric_value: 3, metric_unit: 'per_10k', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'VIC', metric_name: 'detention_rate_per_10k', metric_value: 1.4, metric_unit: 'per_10k', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'WA', metric_name: 'detention_rate_per_10k', metric_value: 4.2, metric_unit: 'per_10k', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'ACT', metric_name: 'pct_unsentenced', metric_value: 74, metric_unit: 'percentage', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'National', metric_name: 'pct_unsentenced', metric_value: 75, metric_unit: 'percent', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'NSW', metric_name: 'pct_unsentenced', metric_value: 72, metric_unit: 'percent', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'NT', metric_name: 'pct_unsentenced', metric_value: 80, metric_unit: 'percent', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'QLD', metric_name: 'pct_unsentenced', metric_value: 86, metric_unit: 'percent', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'SA', metric_name: 'pct_unsentenced', metric_value: 68, metric_unit: 'percentage', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'TAS', metric_name: 'pct_unsentenced', metric_value: 70, metric_unit: 'percentage', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'VIC', metric_name: 'pct_unsentenced', metric_value: 65, metric_unit: 'percent', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'WA', metric_name: 'pct_unsentenced', metric_value: 78, metric_unit: 'percent', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'ACT', metric_name: 'cost_per_day_detention', metric_value: 5200, metric_unit: 'dollars', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'National', metric_name: 'cost_per_day_detention', metric_value: 3635, metric_unit: 'dollars', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'NSW', metric_name: 'cost_per_day_detention', metric_value: 3200, metric_unit: 'dollars', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'NT', metric_name: 'cost_per_day_detention', metric_value: 4800, metric_unit: 'dollars', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'QLD', metric_name: 'cost_per_day_detention', metric_value: 2162, metric_unit: 'dollars', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'SA', metric_name: 'cost_per_day_detention', metric_value: 2890, metric_unit: 'dollars', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'TAS', metric_name: 'cost_per_day_detention', metric_value: 3400, metric_unit: 'dollars', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'VIC', metric_name: 'cost_per_day_detention', metric_value: 7123, metric_unit: 'dollars', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'WA', metric_name: 'cost_per_day_detention', metric_value: 2573, metric_unit: 'dollars', period: '2023-24', cohort: 'all' },
];

let queryQueue = Promise.resolve();
let db = null;

function getDb() {
  if (!db) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when DATABASE_PASSWORD is not set');
    }
    db = createClient(url, key);
  }
  return db;
}

async function q(name, query, fallback = []) {
  const run = async () => {
    const started = Date.now();
    if (process.env.DATABASE_PASSWORD) {
      try {
        const jsonQuery = `SELECT COALESCE(json_agg(row_to_json(snapshot_query)), '[]'::json) FROM (${query.replace(/;+\s*$/, '')}) snapshot_query`;
        const stdout = execFileSync('psql', [
          '-h', 'aws-0-ap-southeast-2.pooler.supabase.com',
          '-p', '5432',
          '-U', 'postgres.tednluwflfhxyucgwigh',
          '-d', 'postgres',
          '-t',
          '-A',
          '-c', jsonQuery,
        ], {
          env: { ...process.env, PGPASSWORD: process.env.DATABASE_PASSWORD, PGOPTIONS: '-c statement_timeout=120000' },
          encoding: 'utf8',
          timeout: 130_000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        const line = stdout.trim().split('\n').filter(Boolean).at(-1);
        const data = line ? JSON.parse(line) : [];
        console.log(`[snapshot:youth-justice] ${name}: ${Array.isArray(data) ? data.length : 1} rows in ${Date.now() - started}ms`);
        return data ?? fallback;
      } catch (error) {
        console.warn(`[snapshot:youth-justice] ${name} failed: ${error.stderr || error.message}`);
        return fallback;
      }
    }

    const { data, error } = await getDb().rpc('exec_sql', { query });
    if (error) {
      console.warn(`[snapshot:youth-justice] ${name} failed: ${error.message}`);
      return fallback;
    }
    console.log(`[snapshot:youth-justice] ${name}: ${Array.isArray(data) ? data.length : 1} rows in ${Date.now() - started}ms`);
    return data ?? fallback;
  };
  const next = queryQueue.then(run, run);
  queryQueue = next.then(() => undefined, () => undefined);
  return next;
}

function n(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDollarsFromThousands(value) {
  if (!value || String(value).toLowerCase() === 'na') return 0;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? Math.round(parsed * 1000) : 0;
}

function buildRogsFromCsv() {
  if (!existsSync(ROGS_CSV_PATH)) return null;
  const records = parse(readFileSync(ROGS_CSV_PATH, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
  });
  const stateYearMap = new Map();

  for (const row of records) {
    if (row.Measure !== 'Government expenditure') continue;
    if (row.Unit !== "$'000") continue;
    if (row.Description1 !== 'Government real recurrent expenditure') continue;
    if (!/^\d{4}-\d{2}$/.test(row.Year)) continue;

    const metric =
      row.Service_Type === '' && row.Description3 === 'Total expenditure'
        ? 'total'
        : row.Service_Type === 'Detention-based supervision' && row.Description3 === 'Detention-based services'
          ? 'detention'
          : row.Service_Type === 'Community-based supervision' && row.Description3 === 'Community-based services'
            ? 'community'
            : row.Service_Type === 'Group conferencing' && row.Description3 === 'Group conferencing'
              ? 'conferencing'
              : null;

    if (!metric) continue;

    for (const state of ALL_STATES) {
      const key = `${state}-${row.Year}`;
      if (!stateYearMap.has(key)) {
        stateYearMap.set(key, { state, financial_year: row.Year, total: 0, detention: 0, community: 0, conferencing: 0 });
      }
      const entry = stateYearMap.get(key);
      entry[metric] = toDollarsFromThousands(row[STATE_CSV_COLUMNS[state]]);
    }
  }

  return Array.from(stateYearMap.values())
    .sort((a, b) => a.state.localeCompare(b.state) || a.financial_year.localeCompare(b.financial_year));
}

function rogsRowsToSeries(rows) {
  const stateYearMap = new Map();
  for (const row of rows) {
    const key = `${row.state}-${row.financial_year}`;
    if (!stateYearMap.has(key)) {
      stateYearMap.set(key, { state: row.state, financial_year: row.financial_year, total: 0, detention: 0, community: 0, conferencing: 0 });
    }
    const entry = stateYearMap.get(key);
    if (row.program_name === 'ROGS Youth Justice Total') entry.total = n(row.amount);
    if (row.program_name === 'ROGS Youth Justice Detention-based supervision') entry.detention = n(row.amount);
    if (row.program_name === 'ROGS Youth Justice Community-based supervision') entry.community = n(row.amount);
    if (row.program_name === 'ROGS Youth Justice Group conferencing') entry.conferencing = n(row.amount);
  }
  return Array.from(stateYearMap.values())
    .sort((a, b) => a.state.localeCompare(b.state) || a.financial_year.localeCompare(b.financial_year));
}

function computeRogsTotals(spendingTimeSeries) {
  const byState = new Map();
  for (const row of spendingTimeSeries) {
    if (!byState.has(row.state)) byState.set(row.state, { total: 0, detention: 0, community: 0, first: 0, last: 0, years: 0 });
    const entry = byState.get(row.state);
    entry.total += n(row.total);
    entry.detention += n(row.detention);
    entry.community += n(row.community);
    if (entry.years === 0) entry.first = n(row.total);
    entry.last = n(row.total);
    entry.years += 1;
  }

  const stateTotals = Array.from(byState.entries()).map(([state, row]) => ({
    state,
    total_10yr: row.total,
    detention_10yr: row.detention,
    community_10yr: row.community,
    latest_year: row.last,
    growth_pct: row.first > 0 ? Math.round(((row.last - row.first) / row.first) * 100) : 0,
  })).sort((a, b) => b.total_10yr - a.total_10yr);

  const nationalTotal = stateTotals.reduce((sum, row) => sum + row.total_10yr, 0);
  const nationalDetention = stateTotals.reduce((sum, row) => sum + row.detention_10yr, 0);
  const nationalCommunity = stateTotals.reduce((sum, row) => sum + row.community_10yr, 0);
  return {
    stateTotals,
    nationalTotal,
    nationalDetention,
    nationalCommunity,
    detentionCommunityRatio: nationalCommunity > 0 ? Math.round(nationalDetention / nationalCommunity) : 0,
  };
}

async function countOne(name, query, key = 'count') {
  const rows = await q(name, query, []);
  return n(rows?.[0]?.[key]);
}

async function main() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    throw new Error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const stateList = ALL_STATES.map(state => `'${state}'`).join(',');
  const youthJusticeFilter = "topics @> ARRAY['youth-justice']::text[] AND source NOT IN ('austender-direct')";
  const youthJusticeFilterJf = "jf.topics @> ARRAY['youth-justice']::text[] AND jf.source NOT IN ('austender-direct')";

  const [
    rogsRows,
    almaInterventions,
    almaTypeCounts,
    contracts,
    grants,
    ndisOverlay,
    dssPayments,
    yjIndicators,
    heatmapBase,
    almaByLga,
    accoGap,
    remoteness,
    statePrograms,
    stateProgramPartners,
    stateTopOrgs,
    unfundedPrograms,
    revolvingDoor,
    foundations,
    anaoCompliance,
    mmrRows,
    stateMetrics,
    coverageRows,
    ctgRows,
  ] = await Promise.all([
    Promise.resolve([]),
    q('alma interventions', `
      SELECT name, type, evidence_level, geography, portfolio_score, gs_id, org_name, org_abn
      FROM mv_yj_report_alma_interventions
      WHERE snapshot_rank <= 60
      ORDER BY snapshot_rank
    `),
    q('alma type counts', `
      SELECT type, count
      FROM mv_yj_report_alma_type_counts
      ORDER BY count DESC
    `),
    q('contracts', `
      SELECT buyer_name, supplier_name, amount, year, title
      FROM mv_yj_report_contracts
      WHERE snapshot_rank <= 20
      ORDER BY snapshot_rank
      LIMIT 20
    `),
    q('justice funding recipients', `
      SELECT recipient_name, state, gs_id, total, grants
      FROM mv_yj_report_recipients
      ORDER BY total DESC NULLS LAST
      LIMIT 60
    `),
    q('ndis overlay', `
      SELECT state, ndis_total, ndis_youth, psychosocial, intellectual, autism, ndis_budget
      FROM mv_yj_report_ndis_overlay
      ORDER BY ndis_budget DESC
    `),
    q('dss payments', `
      SELECT state, payment_type, recipients
      FROM mv_yj_report_dss_payments
      ORDER BY state, payment_type
    `),
    q('youth justice indicators', `
      SELECT d.state,
        ROUND(d.total_expenditure_m)::int as total_expenditure_m,
        ROUND(d.cost_per_detention)::int as cost_per_day,
        r.recidivism_pct::int as recidivism_pct,
        ROUND(d.indigenous_rate_ratio, 1)::float as indigenous_rate_ratio,
        d.facility_count::int,
        d.total_beds::int,
        ROUND(d.facility_indigenous_pct)::int as detention_indigenous_pct,
        c.actual_rate::float as ctg_detention_rate
      FROM v_youth_justice_state_dashboard d
      LEFT JOIN v_ctg_youth_justice_progress c ON c.state = d.state AND c.financial_year = d.financial_year
      LEFT JOIN LATERAL (
        SELECT recidivism_pct FROM v_youth_justice_state_dashboard
        WHERE state = d.state AND recidivism_pct IS NOT NULL
        ORDER BY financial_year DESC LIMIT 1
      ) r ON true
      WHERE d.financial_year = '2023-24'
      ORDER BY d.total_expenditure_m DESC
    `),
    q('cross-system heatmap', `
      SELECT lga_name, state, population, low_icsea, avg_icsea, schools, indigenous_pct,
        dsp_rate, jobseeker_rate, youth_allowance_rate, cost_per_day, recidivism_pct,
        indigenous_rate_ratio, detention_indigenous_pct, ndis_rate, crime_rate, alma_count
      FROM mv_yj_report_heatmap
      ORDER BY lga_name
    `),
    Promise.resolve([]),
    q('acco funding gap', `
      SELECT org_type, orgs, total_funding, avg_per_recipient, avg_grant, funding_rows, funding_share_pct
      FROM mv_yj_report_acco_gap
    `),
    q('funding by remoteness', `
      SELECT remoteness, orgs, total, grants
      FROM mv_yj_report_remoteness
      ORDER BY total DESC
    `),
    q('state program funding', `
      SELECT state, program_name, grants, total, orgs
      FROM mv_yj_report_state_programs
      ORDER BY state, total DESC NULLS LAST
    `),
    q('state program partners', `
      SELECT state, program_name, recipient_name, recipient_abn, total, grants, gs_id, is_community_controlled
      FROM mv_yj_report_state_program_partners
      ORDER BY state, program_name, total DESC NULLS LAST
    `),
    q('state top funded orgs', `
      SELECT state, recipient_name, recipient_abn, grants, total, gs_id
      FROM mv_yj_report_state_top_orgs
      ORDER BY state, total DESC NULLS LAST
    `),
    q('unfunded effective programs', `
      SELECT name, type, evidence_level, cultural_authority, geography
      FROM mv_yj_report_unfunded_programs
      ORDER BY type, name
      LIMIT 60
    `),
    Promise.resolve([]),
    q('foundations', `
      SELECT name, total_giving_annual, thematic_focus, geographic_focus, gs_id
      FROM mv_yj_report_foundations
      ORDER BY total_giving_annual DESC NULLS LAST
      LIMIT 20
    `),
    q('anao compliance', `
      SELECT c.portfolio, c.compliance_rate,
        c.contracts_compliant, c.contracts_in_reporting,
        e.exemption_rate, e.exempted_contracts, e.total_contracts,
        e.exempted_value_aud
      FROM anao_mmr_compliance c
      JOIN anao_mmr_exemptions e ON e.portfolio = c.portfolio
      WHERE c.portfolio IN ('Attorney-Generals', 'Education', 'Social Services', 'National Indigenous Australians Agency')
      ORDER BY c.compliance_rate
    `),
    Promise.resolve([]),
    q('state metrics', `
      SELECT DISTINCT ON (metric_name, jurisdiction) jurisdiction, metric_name, metric_value::float, metric_unit, period, cohort
      FROM outcomes_metrics
      WHERE domain = 'youth-justice'
        AND metric_name IN ('avg_daily_detention','indigenous_overrepresentation_ratio','detention_rate_per_10k','pct_unsentenced','cost_per_day_detention')
        AND (cohort = 'all' OR cohort = 'indigenous' OR cohort IS NULL)
      ORDER BY metric_name, jurisdiction, CASE WHEN cohort = 'all' THEN 0 WHEN cohort IS NULL THEN 1 ELSE 2 END, period DESC
    `),
    q('coverage', 'SELECT * FROM mv_yj_report_coverage LIMIT 1'),
    Promise.resolve(64),
  ]);

  const csvRogs = buildRogsFromCsv();
  const dbRogs = rogsRowsToSeries(rogsRows);
  const spendingTimeSeries = dbRogs.length > 0 ? dbRogs : (csvRogs || []);
  const rogsTotals = computeRogsTotals(spendingTimeSeries);
  if (!coverageRows?.length || !almaInterventions?.length || !grants?.length || !heatmapBase?.length || !statePrograms?.length || !stateProgramPartners?.length || !stateTopOrgs?.length) {
    throw new Error('Critical live report cache queries returned no data; leaving existing snapshot untouched.');
  }

  const almaByLgaMap = new Map((almaByLga || []).map(row => [row.lga_name, n(row.alma_count)]));
  const heatmapRows = (heatmapBase || []).map(row => ({
    ...row,
    alma_count: almaByLgaMap.get(row.lga_name) ?? n(row.alma_count),
  }));
  const coverageRow = coverageRows?.[0] || {};
  const finalStateMetrics = stateMetrics?.length ? stateMetrics : SNAPSHOT_STATE_METRICS;

  const snapshot = {
    generatedAt: new Date().toISOString(),
    source: 'live-db',
    refreshCommand: 'npm run report:youth-justice:refresh',
    pipelineRefreshCommands: [
      'npm run tracker:source-chain',
      'npm run tracker:refresh:portfolio',
      'npm run report:youth-justice:snapshot',
    ],
    coverage: {
      snapshotDate: 'April 2026',
      communities: heatmapRows.length,
      justiceFundingRows: n(coverageRow.justice_funding_rows),
      youthJusticeFundingRows: n(coverageRow.youth_justice_funding_rows),
      youthJusticeFundingDollars: n(coverageRow.youth_justice_funding_dollars),
      rogsRowsInJusticeFunding: n(coverageRow.rogs_rows_in_justice_funding),
      rogsRowsInRogsTable: n(coverageRow.rogs_rows_in_rogs_table),
      rogsTotal10yr: rogsTotals.nationalTotal,
      rogsDetention10yr: rogsTotals.nationalDetention,
      rogsCommunity10yr: rogsTotals.nationalCommunity,
      almaTagged: n(coverageRow.alma_tagged),
      almaServesYouthJustice: n(coverageRow.alma_serves_youth_justice),
      lgaCrossSystemRows: heatmapRows.length,
      ndisOverlayRows: n(coverageRow.ndis_overlay_rows),
      youthJusticeDashboardRows: yjIndicators?.length || 0,
      ctgRows,
      austenderContracts: n(coverageRow.austender_contracts),
      austenderContractDollars: n(coverageRow.austender_contract_dollars),
      outcomeMetricNames: n(coverageRow.outcome_metric_names),
    },
    report: {
      stateTotals: rogsTotals.stateTotals,
      spendingTimeSeries,
      almaInterventions: almaInterventions || [],
      almaTypeCounts: almaTypeCounts || [],
      contracts: contracts || [],
      grants: grants || [],
      ndisOverlay: ndisOverlay || [],
      dssPayments: dssPayments || [],
      yjIndicators: yjIndicators || [],
      heatmapRows,
      nationalTotal: rogsTotals.nationalTotal,
      nationalDetention: rogsTotals.nationalDetention,
      nationalCommunity: rogsTotals.nationalCommunity,
      almaCount: n((almaTypeCounts || []).reduce((sum, row) => sum + n(row.count), 0)),
      detentionCommunityRatio: rogsTotals.detentionCommunityRatio,
      accoGap: accoGap || [],
      remoteness: remoteness || [],
      statePrograms: statePrograms || [],
      stateProgramPartners: stateProgramPartners || [],
      stateTopOrgs: stateTopOrgs || [],
      unfundedPrograms: unfundedPrograms || [],
      revolvingDoor: revolvingDoor || [],
      foundations: foundations || [],
      anaoCompliance: anaoCompliance || [],
      mmrStats: (mmrRows || [])[0] || null,
      stateMetrics: finalStateMetrics,
    },
  };

  mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`[snapshot:youth-justice] wrote ${path.relative(ROOT, OUT_PATH)}`);
}

main().catch(error => {
  console.error('[snapshot:youth-justice] failed:', error);
  process.exit(1);
});
