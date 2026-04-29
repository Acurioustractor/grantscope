#!/usr/bin/env node
/**
 * Refresh the materialized views behind the youth justice report snapshot.
 */
import 'dotenv/config';
import { execFileSync } from 'child_process';

const VIEWS = [
  'mv_yj_report_alma_interventions',
  'mv_yj_report_alma_type_counts',
  'mv_yj_report_recipients',
  'mv_yj_report_contracts',
  'mv_yj_report_heatmap',
  'mv_yj_report_acco_gap',
  'mv_yj_report_remoteness',
  'mv_yj_report_state_programs',
  'mv_yj_report_state_program_partners',
  'mv_yj_report_state_top_orgs',
  'mv_yj_report_unfunded_programs',
  'mv_yj_report_ndis_overlay',
  'mv_yj_report_dss_payments',
  'mv_yj_report_foundations',
  'mv_yj_report_coverage',
];

function refresh(view) {
  const started = Date.now();
  const query = `SET statement_timeout = '600s'; REFRESH MATERIALIZED VIEW ${view};`;
  execFileSync('psql', [
    '-h', 'aws-0-ap-southeast-2.pooler.supabase.com',
    '-p', '5432',
    '-U', 'postgres.tednluwflfhxyucgwigh',
    '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1',
    '-c', query,
  ], {
    env: { ...process.env, PGPASSWORD: process.env.DATABASE_PASSWORD || '' },
    stdio: 'pipe',
    encoding: 'utf8',
    timeout: 620_000,
  });
  console.log(`[yj-report-cache] ${view} refreshed in ${Date.now() - started}ms`);
}

if (!process.env.DATABASE_PASSWORD) {
  console.error('[yj-report-cache] DATABASE_PASSWORD is not set');
  process.exit(1);
}

try {
  for (const view of VIEWS) refresh(view);
  console.log('[yj-report-cache] complete');
} catch (error) {
  console.error('[yj-report-cache] failed:', error.stderr || error.message);
  process.exit(1);
}
