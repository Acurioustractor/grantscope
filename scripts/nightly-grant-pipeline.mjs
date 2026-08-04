#!/usr/bin/env node
/**
 * Nightly grant pipeline — single orchestrator that runs the full chain:
 *   1. scrape-state-grants                          (refresh raw grant_opportunities)
 *   2. promote-grant-opportunities-to-alma          (gate-filtered promotion)
 *   3. promote-foundation-programs-to-alma          (foundation programs bridge)
 *   4. auto-classify-llm                            (LLM classifier — only new unverified)
 *   5. backfill-alma-fields                         (LLM field extraction — only new without backfill)
 *   6. verify-alma-opportunities                    (URL liveness)
 *   7. refresh-funder-context                       (relationship score refresh)
 *   8. REFRESH MATERIALIZED VIEW act_grant_recommendations
 *   9. Re-evaluate funder_blocklist from latest decisions
 *
 * Each step logs to agent_runs via the underlying script's logger. This wrapper
 * just orchestrates + provides a summary line at the end.
 *
 * Usage:
 *   node --env-file=.env scripts/nightly-grant-pipeline.mjs
 *   node --env-file=.env scripts/nightly-grant-pipeline.mjs --skip=scrape,verify
 *   node --env-file=.env scripts/nightly-grant-pipeline.mjs --dry-run
 *
 * Cron schedule: register in agent_schedules with interval_hours=24, priority=2.
 */

import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_ARG = process.argv.find((a) => a.startsWith('--skip='));
const SKIPS = new Set(SKIP_ARG ? SKIP_ARG.split('=')[1].split(',') : []);
const PHASE_ARG = process.argv.find((a) => a.startsWith('--phase='));
const PHASE = PHASE_ARG ? PHASE_ARG.split('=')[1] : 'all';

const AGENT_ID = PHASE === 'all' ? 'nightly-grant-pipeline' : `nightly-grant-pipeline-${PHASE}`;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const STEPS = [
  { key: 'scrape', label: '1. Scrape state grants', cmd: 'tsx', args: ['scripts/scrape-state-grants.mjs'], useTsx: true },
  { key: 'promote-grants', label: '2. Promote grant_opportunities → alma', cmd: 'node', args: ['--env-file=.env', 'scripts/promote-grant-opportunities-to-alma.mjs'] },
  { key: 'promote-foundations', label: '3. Promote foundation_programs → alma', cmd: 'node', args: ['--env-file=.env', 'scripts/promote-foundation-programs-to-alma.mjs'] },
  { key: 'classify', label: '4. LLM auto-classify (limit=300)', cmd: 'node', args: ['--env-file=.env', 'scripts/auto-classify-llm.mjs', '--limit=300'] },
  { key: 'backfill', label: '5. LLM field backfill (limit=300)', cmd: 'node', args: ['--env-file=.env', 'scripts/backfill-alma-fields.mjs', '--limit=300'] },
  { key: 'verify', label: '6. Verify URL liveness', cmd: 'node', args: ['--env-file=.env', 'scripts/verify-alma-opportunities.mjs'] },
  { key: 'funder-context', label: '7. Refresh funder context', cmd: 'node', args: ['--env-file=.env', 'scripts/refresh-funder-context.mjs'] },
  { key: 'refresh-mv', label: '8. Refresh act_grant_recommendations MV', cmd: 'internal', args: ['refresh-mv'] },
  { key: 'blocklist', label: '9. Re-evaluate funder_blocklist', cmd: 'internal', args: ['blocklist'] },
];

const PHASE_STEPS = {
  all: new Set(STEPS.map((step) => step.key)),
  ingest: new Set(['scrape', 'promote-grants', 'promote-foundations']),
  enrich: new Set(['classify', 'backfill', 'verify']),
  finalize: new Set(['funder-context', 'refresh-mv', 'blocklist']),
};

if (!PHASE_STEPS[PHASE]) {
  throw new Error(`Unknown --phase=${PHASE}; expected all, ingest, enrich, or finalize`);
}

function runProcess(cmd, args) {
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn(cmd === 'tsx' ? 'npx' : cmd, cmd === 'tsx' ? ['tsx', ...args] : args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (b) => (stdout += b.toString()));
    child.stderr.on('data', (b) => (stderr += b.toString()));
    child.on('exit', (code) => {
      const durationMs = Date.now() - start;
      const tail = stdout.split('\n').filter(Boolean).slice(-3).join(' | ').slice(0, 300);
      resolve({ ok: code === 0, durationMs, detail: tail || stderr.slice(-300) });
    });
  });
}

async function refreshMv() {
  // exec_sql can't run DDL — it wraps input in `SELECT row_to_json(...)`.
  // Use psql directly via spawn (same pattern as scripts/refresh-views-v2.mjs).
  const start = Date.now();
  return new Promise((resolve) => {
    const password = process.env.DATABASE_PASSWORD;
    if (!password) {
      return resolve({
        ok: false,
        durationMs: Date.now() - start,
        detail: 'DATABASE_PASSWORD not set — cannot REFRESH MV',
      });
    }
    const proc = spawn(
      'psql',
      [
        '-h', 'aws-0-ap-southeast-2.pooler.supabase.com',
        '-p', '5432',
        '-U', 'postgres.tednluwflfhxyucgwigh',
        '-d', 'postgres',
        '-v', 'ON_ERROR_STOP=1',
        '-c', `SET statement_timeout = '600s'; REFRESH MATERIALIZED VIEW CONCURRENTLY act_grant_recommendations`,
      ],
      { env: { ...process.env, PGPASSWORD: password }, timeout: 630_000 }
    );
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ ok: true, durationMs: Date.now() - start, detail: 'MV refreshed (CONCURRENTLY)' });
      } else {
        const errLine = stderr.split('\n').find((l) => l.startsWith('ERROR:'));
        resolve({
          ok: false,
          durationMs: Date.now() - start,
          detail: (errLine || stderr.split('\n').filter(Boolean).pop() || `psql exit ${code}`).slice(0, 200),
        });
      }
    });
    proc.on('error', (e) =>
      resolve({ ok: false, durationMs: Date.now() - start, detail: e.message.slice(0, 200) })
    );
  });
}

async function reEvaluateBlocklist() {
  const start = Date.now();
  // Candidates: funders with 2+ passes AND 0 watches AND 0 pursues.
  // GUARD: never auto-block a funder who has ever PAID us via Xero — those are
  // real counterparties. Pass-spamming their unrelated programs shouldn't break
  // the actual relationship.
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      WITH paid_funders AS (
        SELECT DISTINCT lower(contact_name) AS funder_lower
        FROM xero_invoices
        WHERE type = 'ACCREC' AND status = 'PAID' AND contact_name IS NOT NULL
      ),
      candidates AS (
        SELECT
          a.funder_name,
          COUNT(*) FILTER (WHERE d.decision = 'passed')   AS passes,
          COUNT(*) FILTER (WHERE d.decision = 'watching') AS watches,
          COUNT(*) FILTER (WHERE d.decision = 'pursuing') AS pursues
        FROM act_grant_recommendation_decisions d
        JOIN alma_funding_opportunities a ON a.id::text = d.opportunity_id::text
        WHERE a.funder_name IS NOT NULL
        GROUP BY a.funder_name
      )
      SELECT c.funder_name, c.passes, c.watches, c.pursues
      FROM candidates c
      WHERE c.passes >= 2 AND c.watches = 0 AND c.pursues = 0
        AND NOT EXISTS (
          SELECT 1 FROM paid_funders pf WHERE pf.funder_lower = lower(c.funder_name)
        )
    `,
  });
  if (error) {
    return { ok: false, durationMs: Date.now() - start, detail: error.message.slice(0, 200) };
  }
  const rows = data ?? [];
  let inserted = 0;
  for (const r of rows) {
    const { error: upErr } = await supabase
      .from('funder_blocklist')
      .upsert(
        {
          funder_name: r.funder_name,
          reason: `auto-block: ${r.passes} passes, 0 watches/pursues (nightly re-eval)`,
          blocked_by: 'auto:nightly',
          pass_count: r.passes,
          watch_count: r.watches,
          pursue_count: r.pursues,
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'funder_name' }
      );
    if (!upErr) inserted++;
  }
  return {
    ok: true,
    durationMs: Date.now() - start,
    detail: `${inserted} funders blocklisted (${rows.length} candidates evaluated, paid-funder guard active)`,
  };
}

async function run() {
  const runRow = await logStart(supabase, AGENT_ID, 'Nightly grant pipeline orchestrator');
  const runId = runRow?.id ?? null;
  const startedAt = Date.now();

  const results = [];
  console.log(`=== Nightly grant pipeline · phase=${PHASE} · ${new Date().toISOString()} ===`);
  if (DRY_RUN) console.log('[DRY RUN — printing plan only]');

  for (const step of STEPS) {
    if (!PHASE_STEPS[PHASE].has(step.key)) continue;
    if (SKIPS.has(step.key)) {
      console.log(`SKIP  ${step.label}`);
      results.push({ step: step.key, ok: true, durationMs: 0, detail: 'skipped' });
      continue;
    }
    if (DRY_RUN) {
      console.log(`PLAN  ${step.label}  →  ${step.cmd} ${step.args.join(' ')}`);
      continue;
    }
    console.log(`RUN   ${step.label}…`);
    let result;
    if (step.cmd === 'internal' && step.args[0] === 'refresh-mv') {
      result = await refreshMv();
    } else if (step.cmd === 'internal' && step.args[0] === 'blocklist') {
      result = await reEvaluateBlocklist();
    } else {
      result = await runProcess(step.cmd, step.args);
    }
    results.push({ step: step.key, ...result });
    const flag = result.ok ? 'OK' : 'FAIL';
    console.log(`${flag.padEnd(5)} ${step.label} · ${(result.durationMs / 1000).toFixed(1)}s · ${result.detail}`);
  }

  if (!DRY_RUN) {
    const totalDuration = (Date.now() - startedAt) / 1000;
    const failures = results.filter((r) => !r.ok);
    console.log(`\n=== Pipeline complete in ${totalDuration.toFixed(1)}s · ${results.length - failures.length}/${results.length} steps ok ===`);

    if (runId) {
      await logComplete(supabase, runId, {
        items_found: results.length,
        items_new: results.filter((r) => r.ok).length,
        items_updated: failures.length,
      });
    }
    if (failures.length > 0) {
      process.exit(1);
    }
  }
}

run().catch(async (err) => {
  console.error('nightly-grant-pipeline failed:', err);
  process.exit(1);
});
