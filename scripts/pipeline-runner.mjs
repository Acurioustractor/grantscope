#!/usr/bin/env node

/**
 * GrantScope Pipeline Runner
 *
 * Runs the full data pipeline on a configurable interval:
 *   1. Source frontier sync
 *   2. Grant-source frontier polling
 *   3. Foundation frontier polling
 *   4. Grant Discovery (all sources)
 *   5. Grant source-identity reconciliation
 *   6. State grant scraping
 *   7. Grant deadline refresh
 *   8. Grant semantics reconciliation
 *   9. Grant enrichment (free LLMs)
 *  10. Foundation profiling
 *  11. Foundation program discovery + stale rescan
 *  12. Foundation relationship extraction
 *  13. Foundation Programs → Grant Search sync
 *  14. Incremental Non-Foundation Embeddings
 *  15. Grant Source Identity Health Check
 *  16. Grant Semantics Health Check
 *
 * Each step logs to agent_runs so the /ops dashboard shows real-time progress.
 *
 * Usage:
 *   node --env-file=.env scripts/pipeline-runner.mjs [--interval=30] [--once]
 *
 * Options:
 *   --interval=N   Minutes between runs (default: 30)
 *   --once         Run once and exit (no loop)
 *   --skip=a,b     Skip specific steps (frontier,frontier-poll,foundation-frontier-poll,discovery,source-identity,state,deadlines,semantics,enrich,profile,foundation-discovery,foundation-relationships,sync,embed,source-identity-health,semantics-health)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const intervalArg = process.argv.find(a => a.startsWith('--interval='));
const INTERVAL_MIN = intervalArg ? parseInt(intervalArg.split('=')[1], 10) : 30;
const ONCE = process.argv.includes('--once');

const skipArg = process.argv.find(a => a.startsWith('--skip='));
const SKIP = new Set(skipArg ? skipArg.split('=')[1].split(',') : []);

const STEPS = [
  {
    id: 'frontier',
    name: 'Source Frontier Sync',
    cmd: ['node', '--env-file=.env', 'scripts/sync-source-frontier.mjs'],
    timeout: 300_000,
  },
  {
    id: 'frontier-poll',
    name: 'Grant Source Frontier Poll',
    cmd: ['node', '--env-file=.env', 'scripts/poll-source-frontier.mjs', '--kinds=grant_source_page', '--limit=20', '--concurrency=5'],
    timeout: 300_000,
  },
  {
    id: 'foundation-frontier-poll',
    name: 'Foundation Frontier Poll',
    cmd: ['node', '--env-file=.env', 'scripts/poll-source-frontier.mjs', '--kinds=foundation_homepage,foundation_known_page,foundation_candidate_page,foundation_program_page', '--limit=100', '--concurrency=8'],
    timeout: 600_000,
  },
  {
    id: 'discovery',
    name: 'Grant Discovery',
    cmd: ['npx', 'tsx', 'scripts/grantscope-discovery.mjs', '--frontier-window-hours=24', '--frontier-fallback-count=4'],
    timeout: 600_000, // 10 min
  },
  {
    id: 'source-identity',
    name: 'Grant Source Identity Reconciliation',
    cmd: ['node', '--env-file=.env', 'scripts/reconcile-grant-source-identity.mjs', '--apply', '--limit=100'],
    timeout: 300_000,
  },
  {
    id: 'state',
    name: 'State Grant Discovery',
    cmd: ['node', '--env-file=.env', 'scripts/scrape-state-grants.mjs'],
    timeout: 900_000,
  },
  {
    id: 'deadlines',
    name: 'Grant Deadline Refresh',
    cmd: ['node', '--env-file=.env', 'scripts/scrape-grant-deadlines.mjs', '--apply', '--limit=100'],
    timeout: 900_000,
  },
  {
    id: 'semantics',
    name: 'Grant Semantics Reconciliation',
    cmd: ['node', '--env-file=.env', 'scripts/reconcile-grant-semantics.mjs', '--apply', '--limit=150'],
    timeout: 900_000,
  },
  {
    id: 'enrich',
    name: 'Grant Enrichment',
    cmd: ['npx', 'tsx', 'scripts/enrich-grants-free.mjs', '--limit=100'],
    timeout: 600_000,
  },
  {
    id: 'profile',
    name: 'Foundation Profiling',
    cmd: ['npx', 'tsx', 'scripts/build-foundation-profiles.mjs', '--limit=25', '--concurrency=5'],
    timeout: 1_200_000, // 20 min
  },
  {
    id: 'foundation-discovery',
    name: 'Foundation Program Refresh',
    cmd: ['node', '--env-file=.env', 'scripts/discover-foundation-programs.mjs', '--limit=40', '--concurrency=2', '--refresh-existing', '--rescan-days=14'],
    timeout: 1_200_000,
  },
  {
    id: 'foundation-relationships',
    name: 'Foundation Relationship Extraction',
    cmd: ['node', '--env-file=.env', 'scripts/extract-foundation-relationships.mjs', '--limit=15', '--concurrency=2', '--max-pages=6', '--frontier-window-hours=168', '--refresh-days=30'],
    timeout: 1_200_000,
  },
  {
    id: 'sync',
    name: 'Sync Foundation Programs',
    cmd: ['node', '--env-file=.env', 'scripts/sync-foundation-programs.mjs', '--cleanup-invalid', '--priority-only', '--frontier-window-hours=72'],
    timeout: 120_000, // 2 min
  },
  {
    id: 'embed',
    name: 'Incremental Embeddings',
    cmd: ['node', '--env-file=.env', 'scripts/backfill-embeddings.mjs', '--batch-size', '100', '--limit=100', '--exclude-sources=foundation_program'],
    timeout: 300_000, // 5 min
  },
  {
    id: 'source-identity-health',
    name: 'Grant Source Identity Health Check',
    cmd: ['node', '--env-file=.env', 'scripts/check-grant-source-identity-health.mjs', '--max-blank-source-id=0', '--max-canonical-mismatch=0'],
    timeout: 120_000,
  },
  {
    id: 'semantics-health',
    name: 'Grant Semantics Health Check',
    cmd: ['node', '--env-file=.env', 'scripts/check-grant-semantics-health.mjs', '--max-status-null=0', '--max-application-status-null=0', '--max-open-past-deadline=0'],
    timeout: 120_000,
  },
];

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

async function runStep(step) {
  console.log(`\n[${ timestamp()}] Starting: ${step.name}`);
  const start = Date.now();

  try {
    const { stdout, stderr } = await execFileAsync(step.cmd[0], step.cmd.slice(1), {
      timeout: step.timeout,
      maxBuffer: 10 * 1024 * 1024,
      env: process.env,
    });

    const duration = ((Date.now() - start) / 1000).toFixed(1);
    // Show last few lines of output
    const lines = stdout.trim().split('\n');
    const tail = lines.slice(-5).join('\n');
    console.log(tail);
    if (stderr) console.error(stderr.trim().split('\n').slice(-3).join('\n'));
    console.log(`[${timestamp()}] Done: ${step.name} (${duration}s)`);
    return { success: true, duration };
  } catch (err) {
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    const msg = err.killed ? `Timed out after ${step.timeout / 1000}s` : err.message;
    console.error(`[${timestamp()}] FAILED: ${step.name} (${duration}s) — ${msg}`);
    // Show stdout/stderr if available
    if (err.stdout) {
      const lines = err.stdout.trim().split('\n').slice(-5);
      console.log(lines.join('\n'));
    }
    return { success: false, duration, error: msg };
  }
}

async function runPipeline() {
  console.log('='.repeat(60));
  console.log(`[${timestamp()}] Pipeline Run Starting`);
  console.log(`  Steps: ${STEPS.filter(s => !SKIP.has(s.id)).map(s => s.id).join(' → ')}`);
  if (SKIP.size > 0) console.log(`  Skipping: ${[...SKIP].join(', ')}`);
  console.log('='.repeat(60));

  const results = [];

  for (const step of STEPS) {
    if (SKIP.has(step.id)) {
      console.log(`\n[${timestamp()}] Skipping: ${step.name}`);
      continue;
    }
    const result = await runStep(step);
    results.push({ step: step.name, ...result });
  }

  console.log('\n' + '='.repeat(60));
  console.log(`[${timestamp()}] Pipeline Complete`);
  for (const r of results) {
    const icon = r.success ? 'OK' : 'FAIL';
    console.log(`  [${icon}] ${r.step} (${r.duration}s)`);
  }
  console.log('='.repeat(60));

  return results;
}

async function main() {
  await runPipeline();

  if (ONCE) {
    console.log('\n--once flag set, exiting.');
    return;
  }

  console.log(`\nNext run in ${INTERVAL_MIN} minutes. Press Ctrl+C to stop.`);

  setInterval(async () => {
    await runPipeline();
    console.log(`\nNext run in ${INTERVAL_MIN} minutes. Press Ctrl+C to stop.`);
  }, INTERVAL_MIN * 60 * 1000);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
