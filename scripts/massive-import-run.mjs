#!/usr/bin/env node

/**
 * Massive Import Run — Full data ingestion pipeline
 *
 * Runs all available data sources in sequence to maximize coverage.
 * Designed to be run periodically (daily for grants, weekly for profiles).
 *
 * Usage:
 *   node scripts/massive-import-run.mjs                  # Run everything
 *   node scripts/massive-import-run.mjs --step acnc      # Run specific step
 *   node scripts/massive-import-run.mjs --dry-run        # Preview only
 *   node scripts/massive-import-run.mjs --skip profiling # Skip slow profiling step
 *
 * Steps (in order):
 *   1. acnc-register  — Sync ACNC charity register (foundations table)
 *   2. acnc-financials — Import AIS financial data (acnc_ais table)
 *   3. discovery       — Run all grant discovery sources
 *   4. profiling       — AI-profile unprofiled foundations (slow, costs ~$0.05/each)
 *   5. community       — Profile community organisations

import 'dotenv/config';
 *   6. agents          — Run all scraping agents
 *   7. state-grants    — Scrape state grant portals (NSW, VIC, QLD, SA, TAS)
 *
 * Environment:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (required)
 *   FIRECRAWL_API_KEY (required for scraping)
 *   ANTHROPIC_API_KEY (required for profiling)
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

const stepArg = process.argv.find(a => a.startsWith('--step='));
const SINGLE_STEP = stepArg ? stepArg.split('=')[1] : (
  process.argv.includes('--step') ? process.argv[process.argv.indexOf('--step') + 1] : null
);

const skipArg = process.argv.find(a => a.startsWith('--skip='));
const SKIP_STEPS = new Set(
  skipArg ? skipArg.split('=')[1].split(',') : (
    process.argv.includes('--skip') ? [process.argv[process.argv.indexOf('--skip') + 1]] : []
  )
);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) { console.log(`\n${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}`); }

function runScript(cmd, label) {
  console.log(`\n>> ${label}`);
  console.log(`>> $ ${cmd}\n`);
  if (DRY_RUN) {
    console.log('  [DRY RUN — skipping]');
    return { success: true, duration: 0, output: '' };
  }
  const start = Date.now();
  try {
    const output = execSync(cmd, {
      stdio: 'inherit',
      timeout: 600000, // 10 min per step
      env: process.env,
      cwd: process.cwd(),
    });
    return { success: true, duration: Date.now() - start, output: output?.toString() || '' };
  } catch (err) {
    console.error(`  !! ${label} failed: ${err.message}`);
    return { success: false, duration: Date.now() - start, output: err.message };
  }
}

async function getStats() {
  const [f, g, fp, co, ais] = await Promise.all([
    supabase.from('foundations').select('*', { count: 'exact', head: true }),
    supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }),
    supabase.from('foundations').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
    supabase.from('community_orgs').select('*', { count: 'exact', head: true }),
    supabase.from('acnc_ais').select('*', { count: 'exact', head: true }),
  ]);
  return {
    foundations: f.count || 0,
    grants: g.count || 0,
    profiled: fp.count || 0,
    community: co.count || 0,
    acnc: ais.count || 0,
  };
}

const steps = [
  {
    id: 'acnc-register',
    label: 'Step 1: Sync ACNC Charity Register',
    cmd: 'node scripts/sync-acnc-register.mjs',
  },
  {
    id: 'acnc-financials',
    label: 'Step 2: Import ACNC AIS Financial Data (all years)',
    cmd: 'node scripts/import-acnc-financials.mjs',
  },
  {
    id: 'discovery',
    label: 'Step 3: Run Grant Discovery (all sources)',
    cmd: 'node scripts/grantscope-discovery.mjs',
  },
  {
    id: 'state-grants',
    label: 'Step 4: Scrape State Grant Portals',
    cmd: 'node scripts/scrape-state-grants.mjs',
  },
  {
    id: 'profiling',
    label: 'Step 5: AI-Profile Foundations (batch of 100)',
    cmd: 'node scripts/build-foundation-profiles.mjs --limit=100',
  },
  {
    id: 'community',
    label: 'Step 6: Profile Community Organisations',
    cmd: 'node scripts/profile-community-orgs.mjs --limit=100',
  },
  {
    id: 'agents',
    label: 'Step 7: Run All Scraping Agents',
    cmd: 'npx tsx scripts/run-scraping-agents.mjs --force',
  },
];

async function main() {
  log('MASSIVE IMPORT RUN');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log(`Single step: ${SINGLE_STEP || 'all'}`);
  console.log(`Skip: ${SKIP_STEPS.size > 0 ? [...SKIP_STEPS].join(', ') : 'none'}`);

  // Before stats
  const before = await getStats();
  console.log('\nBefore:');
  console.log(`  Foundations: ${before.foundations.toLocaleString()} (${before.profiled.toLocaleString()} profiled)`);
  console.log(`  Grants: ${before.grants.toLocaleString()}`);
  console.log(`  Community orgs: ${before.community.toLocaleString()}`);
  console.log(`  ACNC AIS records: ${before.acnc.toLocaleString()}`);

  const results = [];

  for (const step of steps) {
    if (SINGLE_STEP && step.id !== SINGLE_STEP) continue;
    if (SKIP_STEPS.has(step.id)) {
      console.log(`\n>> SKIPPING: ${step.label}`);
      continue;
    }

    log(step.label);
    const result = runScript(step.cmd, step.label);
    results.push({ ...step, ...result });
  }

  // After stats
  const after = await getStats();

  log('RESULTS');
  console.log('\nAfter:');
  console.log(`  Foundations: ${after.foundations.toLocaleString()} (${after.profiled.toLocaleString()} profiled)`);
  console.log(`  Grants: ${after.grants.toLocaleString()}`);
  console.log(`  Community orgs: ${after.community.toLocaleString()}`);
  console.log(`  ACNC AIS records: ${after.acnc.toLocaleString()}`);
  console.log('\nChanges:');
  console.log(`  Foundations: +${(after.foundations - before.foundations).toLocaleString()}`);
  console.log(`  Profiled: +${(after.profiled - before.profiled).toLocaleString()}`);
  console.log(`  Grants: +${(after.grants - before.grants).toLocaleString()}`);
  console.log(`  Community orgs: +${(after.community - before.community).toLocaleString()}`);
  console.log(`  ACNC AIS: +${(after.acnc - before.acnc).toLocaleString()}`);

  console.log('\nStep results:');
  for (const r of results) {
    const icon = r.success ? '✓' : '✗';
    const dur = (r.duration / 1000).toFixed(1);
    console.log(`  ${icon} ${r.label} (${dur}s)`);
  }

  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.log(`\n⚠ ${failed.length} step(s) failed`);
    process.exit(1);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
