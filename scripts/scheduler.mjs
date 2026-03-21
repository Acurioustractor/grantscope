#!/usr/bin/env node
/**
 * scheduler.mjs — Cron-triggered agent scheduler
 *
 * Checks agent_schedules for due agents and runs them sequentially.
 * Designed to be called by cron/launchd every hour.
 *
 * Usage:
 *   node --env-file=.env scripts/scheduler.mjs
 *   node --env-file=.env scripts/scheduler.mjs --dry-run
 *
 * Cron example (every hour):
 *   0 * * * * cd /Users/benknight/Code/grantscope && node --env-file=.env scripts/scheduler.mjs >> logs/scheduler.log 2>&1
 *
 * launchd: see com.civicgraph.scheduler.plist
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, appendFileSync } from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.argv.includes('--dry-run');
const LOG_DIR = new URL('../logs', import.meta.url).pathname;

function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function log(msg) {
  const line = `[${ts()}] ${msg}`;
  console.log(line);
}

// Known agent scripts — maps agent_id to script path
const AGENT_SCRIPTS = {
  'watch-board-changes': 'scripts/watch-board-changes.mjs',
  'enrich-grants-free': 'scripts/enrich-grants-free.mjs',
  'scrape-acnc-people': 'scripts/scrape-acnc-people.mjs',
  'link-entities-mega': 'scripts/link-entities-mega.mjs',
  'refresh-views': 'scripts/refresh-views.mjs',
  'link-corporate-groups': 'scripts/link-corporate-groups.mjs',
};

async function getDueAgents() {
  const { data, error } = await supabase
    .from('agent_schedules')
    .select('*')
    .eq('enabled', true)
    .order('priority', { ascending: true });

  if (error) {
    log(`Error fetching schedules: ${error.message}`);
    return [];
  }

  const now = Date.now();
  return (data || []).filter(schedule => {
    if (!schedule.last_run_at) return true; // never run
    const lastRun = new Date(schedule.last_run_at).getTime();
    const intervalMs = (schedule.interval_hours || 24) * 3600000;
    return now - lastRun >= intervalMs;
  });
}

async function runAgent(schedule) {
  const scriptPath = AGENT_SCRIPTS[schedule.agent_id];
  if (!scriptPath) {
    log(`  Unknown agent: ${schedule.agent_id} — no script mapped`);
    return false;
  }

  if (!existsSync(scriptPath)) {
    log(`  Script not found: ${scriptPath}`);
    return false;
  }

  log(`  Running: ${schedule.agent_id} (${scriptPath})`);
  const startTime = Date.now();

  try {
    const args = schedule.params?.args || '';
    const result = execSync(
      `node --env-file=.env ${scriptPath} ${args}`,
      {
        encoding: 'utf-8',
        timeout: 600000, // 10 min max per agent
        maxBuffer: 50 * 1024 * 1024,
        cwd: process.cwd(),
      }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`  Done: ${schedule.agent_id} (${duration}s)`);

    // Log last few lines of output
    const lines = result.trim().split('\n');
    const tail = lines.slice(-3);
    for (const line of tail) {
      log(`    ${line.slice(0, 120)}`);
    }

    return true;
  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`  Failed: ${schedule.agent_id} (${duration}s) — ${err.message?.slice(0, 100)}`);
    return false;
  }
}

async function updateLastRun(agentId) {
  const { error } = await supabase
    .from('agent_schedules')
    .update({ last_run_at: new Date().toISOString() })
    .eq('agent_id', agentId);

  if (error) log(`  Failed to update last_run_at: ${error.message}`);
}

async function main() {
  log('CivicGraph Scheduler');
  log('═'.repeat(40));

  const dueAgents = await getDueAgents();
  log(`${dueAgents.length} agents due for execution`);

  if (dueAgents.length === 0) {
    log('Nothing to run. Exiting.');
    return;
  }

  for (const schedule of dueAgents) {
    const intervalHrs = schedule.interval_hours || 24;
    const lastRun = schedule.last_run_at
      ? `${((Date.now() - new Date(schedule.last_run_at).getTime()) / 3600000).toFixed(1)}h ago`
      : 'never';
    log(`\n  ${schedule.agent_id} (every ${intervalHrs}h, last: ${lastRun})`);

    if (DRY_RUN) {
      log('  [DRY RUN] Would run this agent');
      continue;
    }

    const ok = await runAgent(schedule);
    if (ok) {
      await updateLastRun(schedule.agent_id);
    }
  }

  log(`\nScheduler complete`);
}

main().catch(err => {
  log(`Fatal: ${err.message}`);
  process.exit(1);
});
