#!/usr/bin/env node
/**
 * refresh-views.mjs — Refresh all GrantScope materialized views in dependency order
 *
 * Usage: node --env-file=.env scripts/refresh-views.mjs [--view mv_name] [--concurrent]
 */
import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

function sql(query, { timeout = 300000 } = {}) {
  const dbPassword = process.env.DATABASE_PASSWORD;
  if (!dbPassword) throw new Error('DATABASE_PASSWORD not set in .env');
  // Set statement_timeout in the same session to override Supabase pooler defaults
  const stmtTimeout = Math.round(timeout / 1000);
  const fullQuery = `SET statement_timeout = '${stmtTimeout}s'; ${query}`;
  const result = execSync(
    `psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -c "${fullQuery.replace(/"/g, '\\"')}"`,
    { env: { ...process.env, PGPASSWORD: dbPassword }, encoding: 'utf8', timeout: timeout + 10000, stdio: ['pipe', 'pipe', 'pipe'] }
  );
  return result.trim();
}

async function sqlAsync(query, { timeout = 300000 } = {}) {
  const dbPassword = process.env.DATABASE_PASSWORD;
  if (!dbPassword) throw new Error('DATABASE_PASSWORD not set in .env');
  const stmtTimeout = Math.round(timeout / 1000);
  const fullQuery = `SET statement_timeout = '${stmtTimeout}s'; ${query}`;
  const { stdout } = await execAsync(
    `psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -c "${fullQuery.replace(/"/g, '\\"')}"`,
    { env: { ...process.env, PGPASSWORD: dbPassword }, encoding: 'utf8', timeout: timeout + 10000 }
  );
  return stdout.trim();
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
      'mv_funding_by_lga',
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
      // mv_entity_xref replaced by entity_xref table — use refresh-entity-xref.mjs
      'mv_donor_person_crosslink',
      'mv_foundation_grantees',
      'mv_charity_network',
    ],
  },
  // Group 4: Foundation intelligence + charity rankings (depend on Group 3)
  {
    concurrent: true,
    views: [
      'mv_trustee_grantee_chain',
      'mv_foundation_need_alignment',
      'mv_evidence_backed_funding',
      'mv_foundation_scores',
      'mv_foundation_regranting',
      'mv_foundation_trends',
      'mv_foundation_readiness',
      'mv_funding_outcomes_summary',
      'mv_charity_rankings',
      'mv_board_power',
    ],
  },
  // Group 5: Alma dashboard views (depend on alma tables)
  {
    concurrent: true,
    views: [
      'alma_daily_sentiment',
      'alma_dashboard_funding',
      'alma_dashboard_interventions',
      'alma_dashboard_queue',
      'alma_sentiment_program_correlation',
    ],
  },
];

function extractError(e) {
  const stderr = e.stderr || '';
  const errorLine = stderr.split('\n').find(l => l.startsWith('ERROR:'));
  if (errorLine) return errorLine.replace(/^ERROR:\s*/, '').slice(0, 80);
  if (e.status === null) return 'timeout';
  return 'psql error (check view definition)';
}

// Views that need extended timeout (heavy joins on 1M+ row tables)
const HEAVY_VIEWS = new Set([
  'mv_gs_donor_contractors',
  'mv_donor_contract_crossref',
  'v_austender_supplier_tax',
  'v_austender_top_charities',
  'mv_entity_power_index',
  'mv_person_entity_network',
  'mv_person_entity_crosswalk',
  'mv_funding_by_postcode',
]);

async function refreshView(name) {
  const timeout = HEAVY_VIEWS.has(name) ? 600000 : 300000;
  const start = performance.now();
  try {
    await sqlAsync(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${name}`, { timeout });
    const ms = Math.round(performance.now() - start);
    return { name, ok: true, ms };
  } catch (e) {
    // CONCURRENTLY requires unique index — fall back to non-concurrent
    if (e.message?.includes('unique index') || e.message?.includes('cannot refresh') ||
        e.stderr?.includes('unique index') || e.stderr?.includes('cannot refresh')) {
      try {
        await sqlAsync(`REFRESH MATERIALIZED VIEW ${name}`, { timeout });
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
  const r = await refreshView(singleView);
  const icon = r.ok ? '✅' : '❌';
  console.log(`  ${icon} ${r.name}: ${r.ok ? `${r.ms}ms` : r.error}${r.note ? ` (${r.note})` : ''}`);
  process.exit(r.ok ? 0 : 1);
}

console.log('\n  GrantScope Materialized View Refresh\n');

let totalViews = 0;
let failures = 0;

for (const group of VIEW_GROUPS) {
  // Run views within each group in parallel, wait for all to complete before next group
  const results = await Promise.all(group.views.map(v => refreshView(v)));
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
