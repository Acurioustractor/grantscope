#!/usr/bin/env node
/**
 * refresh-views.mjs — Refresh all GrantScope materialized views in dependency order
 *
 * Usage: node --env-file=.env scripts/refresh-views.mjs [--view mv_name] [--concurrent]
 */
import { execSync } from 'child_process';

function sql(query) {
  const dbPassword = process.env.DATABASE_PASSWORD;
  if (!dbPassword) throw new Error('DATABASE_PASSWORD not set in .env');
  const result = execSync(
    `psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -c "${query.replace(/"/g, '\\"')}"`,
    { env: { ...process.env, PGPASSWORD: dbPassword }, encoding: 'utf8', timeout: 300000, stdio: ['pipe', 'pipe', 'pipe'] }
  );
  return result.trim();
}

// Ordered by dependency: base views first, then views that depend on them
const VIEW_GROUPS = [
  // Group 1: No dependencies (can run concurrently)
  {
    concurrent: true,
    views: [
      'mv_acnc_latest',
      'mv_acnc_ais_yearly',
      'v_ato_largest_entities',
      'v_grant_stats',
      'v_grant_focus_areas',
      'v_grant_provider_summary',
    ],
  },
  // Group 2: Depend on base tables, independent of each other
  {
    concurrent: true,
    views: [
      'mv_gs_entity_stats',
      'mv_gs_donor_contractors',
      'mv_donor_contract_crossref',
      'mv_org_justice_signals',
      'mv_funding_by_postcode',
      'mv_funding_by_disadvantage',
      'mv_indigenous_funding_by_disadvantage',
      'v_austender_stats',
      'v_austender_entity_summary',
      'v_austender_procurement_by_type',
      'v_austender_supplier_tax',
      'v_austender_top_charities',
      'v_austender_top_oric',
      'mv_entity_power_index',
    ],
  },
  // Group 3: Depend on earlier views (mv_funding_deserts depends on mv_entity_power_index + mv_funding_by_lga)
  {
    concurrent: true,
    views: [
      'mv_crossref_quality',
      'mv_data_quality',
      'mv_funding_deserts',
      'mv_revolving_door',
      'mv_disability_landscape',
      'mv_board_interlocks',
      'mv_person_entity_network',
      'mv_person_influence',
      'mv_individual_donors',
      'mv_person_cross_system',
      'mv_person_network',
      'mv_trustee_grantee_overlaps',
      'mv_person_directory',
      'mv_person_entity_crosswalk',
      'mv_entity_xref',
      'mv_donor_person_crosslink',
      'mv_foundation_grantees',
    ],
  },
  // Group 4: Alma dashboard views (depend on alma tables)
  {
    concurrent: true,
    views: [
      'alma_daily_sentiment',
      'alma_dashboard_funding',
      'alma_dashboard_interventions',
      'alma_dashboard_queue',
      'alma_dashboard_sources',
      'alma_dashboard_tags',
      'alma_sentiment_program_correlation',
    ],
  },
];

function extractError(e) {
  const stderr = e.stderr || '';
  const errorLine = stderr.split('\n').find(l => l.startsWith('ERROR:'));
  if (errorLine) return errorLine.replace(/^ERROR:\s*/, '').slice(0, 80);
  if (e.status === null) return 'timeout (>5min)';
  return 'psql error (check view definition)';
}

function refreshView(name) {
  const start = performance.now();
  try {
    sql(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${name}`);
    const ms = Math.round(performance.now() - start);
    return { name, ok: true, ms };
  } catch (e) {
    // CONCURRENTLY requires unique index — fall back to non-concurrent
    if (e.message.includes('unique index') || e.message.includes('cannot refresh')) {
      try {
        sql(`REFRESH MATERIALIZED VIEW ${name}`);
        const ms = Math.round(performance.now() - start);
        return { name, ok: true, ms, note: 'non-concurrent' };
      } catch (e2) {
        return { name, ok: false, error: extractError(e2), ms: Math.round(performance.now() - start) };
      }
    }
    return { name, ok: false, error: extractError(e), ms: Math.round(performance.now() - start) };
  }
}

// Parse args
const args = process.argv.slice(2);
const singleView = args.includes('--view') ? args[args.indexOf('--view') + 1] : null;
const forceConcurrent = args.includes('--concurrent');

const totalStart = performance.now();

if (singleView) {
  console.log(`\n  Refreshing ${singleView}...\n`);
  const r = refreshView(singleView);
  const icon = r.ok ? '✅' : '❌';
  console.log(`  ${icon} ${r.name}: ${r.ok ? `${r.ms}ms` : r.error}${r.note ? ` (${r.note})` : ''}`);
  process.exit(r.ok ? 0 : 1);
}

console.log('\n  GrantScope Materialized View Refresh\n');

let totalViews = 0;
let failures = 0;

for (const group of VIEW_GROUPS) {
  const results = group.views.map(v => refreshView(v));
  for (const r of results) {
    totalViews++;
    const icon = r.ok ? '✅' : '❌';
    const detail = r.ok ? `${r.ms}ms${r.note ? ` (${r.note})` : ''}` : r.error;
    console.log(`  ${icon} ${r.name.padEnd(42)} ${detail}`);
    if (!r.ok) failures++;
  }
}

const totalMs = Math.round(performance.now() - totalStart);
console.log(`\n  ${totalViews - failures}/${totalViews} views refreshed in ${(totalMs / 1000).toFixed(1)}s\n`);
process.exit(failures > 0 ? 1 : 0);
