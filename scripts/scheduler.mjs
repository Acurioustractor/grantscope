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
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { getAgent } from './lib/agent-registry.mjs';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.argv.includes('--dry-run');
const ONLY_ARG = process.argv.find(arg => arg.startsWith('--only='));
const ONLY_AGENTS = ONLY_ARG
  ? ONLY_ARG.replace('--only=', '').split(',').map(a => a.trim()).filter(Boolean)
  : null;
const MAX_ARG = process.argv.find(arg => arg.startsWith('--max='));
const MAX_AGENTS = MAX_ARG ? Math.max(1, Number.parseInt(MAX_ARG.replace('--max=', ''), 10) || 0) : null;
const LOG_DIR = new URL('../logs', import.meta.url).pathname;

function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function log(msg) {
  const line = `[${ts()}] ${msg}`;
  console.log(line);
}

function splitArgs(rawArgs) {
  if (!rawArgs || typeof rawArgs !== 'string') return [];
  const matches = rawArgs.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return matches.map((arg) => arg.replace(/^"|"$/g, ''));
}

// Auto-discover agent scripts by convention: scripts/${agentId}.mjs
// Override map for agents whose script name differs from agent_id
const AGENT_SCRIPT_OVERRIDES = {
};

function resolveScript(agentId) {
  if (AGENT_SCRIPT_OVERRIDES[agentId]) return AGENT_SCRIPT_OVERRIDES[agentId];
  const path = `scripts/${agentId}.mjs`;
  return existsSync(path) ? path : null;
}

function resolveCommand(schedule) {
  const registryAgent = getAgent(schedule.agent_id);
  const scheduleArgs = splitArgs(schedule.params?.args);

  if (registryAgent?.command?.length) {
    return {
      command: [...registryAgent.command, ...scheduleArgs],
      timeoutMs: registryAgent.timeoutMs || 600000,
      source: 'registry',
    };
  }

  const scriptPath = resolveScript(schedule.agent_id);
  if (!scriptPath) return null;

  return {
    command: [process.execPath, '--env-file=.env', scriptPath, ...scheduleArgs],
    timeoutMs: 600000,
    source: 'script-fallback',
  };
}

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
  let due = (data || []).filter(schedule => {
    // Gate on the last ATTEMPT, not the last success — that is what stops retry thrash.
    // last_run_at means "work succeeded" and must not be used for this.
    if (!schedule.last_scheduled_at) return true; // never attempted
    const lastAttempt = new Date(schedule.last_scheduled_at).getTime();
    const intervalMs = (schedule.interval_hours || 24) * 3600000;
    return now - lastAttempt >= intervalMs;
  });

  if (ONLY_AGENTS?.length) {
    due = due.filter(schedule => ONLY_AGENTS.includes(schedule.agent_id));
  }
  if (MAX_AGENTS && due.length > MAX_AGENTS) {
    due = due.slice(0, MAX_AGENTS);
  }
  return due;
}

async function runAgent(schedule) {
  const resolved = resolveCommand(schedule);
  if (!resolved) {
    log(`  No executable command found for: ${schedule.agent_id}`);
    return false;
  }

  const [rawBin, ...args] = resolved.command;
  // Resolve bare 'node'/'npx' to absolute path — cron PATH doesn't include nvm
  const bin = rawBin === 'node' ? process.execPath
    : rawBin === 'npx' ? process.execPath.replace(/\/node$/, '/npx')
    : rawBin;
  log(`  Running: ${schedule.agent_id} via ${resolved.source}`);
  log(`    ${[bin, ...args].join(' ')}`);
  const startTime = Date.now();

  try {
    const result = spawnSync(bin, args, {
      encoding: 'utf-8',
      timeout: resolved.timeoutMs,
      maxBuffer: 50 * 1024 * 1024,
      cwd: process.cwd(),
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      const errOutput = (result.stderr || result.stdout || '').trim();
      throw new Error(errOutput || `Process exited with status ${result.status}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`  Done: ${schedule.agent_id} (${duration}s)`);

    // Log last few lines of output
    const lines = `${result.stdout || ''}\n${result.stderr || ''}`.trim().split('\n');
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

/**
 * Two stamps, two meanings. last_scheduled_at records the attempt and drives the interval
 * gate (so a failing agent still cannot thrash); last_run_at records SUCCESS and is what
 * any freshness reading should trust. Writing one value for both is what let four schedules
 * claim they had run this week when agent_runs said June.
 */
async function updateStamps(agentId, succeeded) {
  const patch = { last_scheduled_at: new Date().toISOString() };
  if (succeeded) patch.last_run_at = patch.last_scheduled_at;

  const { error } = await supabase
    .from('agent_schedules')
    .update(patch)
    .eq('agent_id', agentId);

  if (error) log(`  Failed to update schedule stamps: ${error.message}`);
}

async function cleanupStaleRuns() {
  const cutoff = new Date(Date.now() - 4 * 3600000).toISOString();
  const { data, error } = await supabase
    .from('agent_runs')
    .update({ status: 'timed_out', completed_at: new Date().toISOString() })
    .eq('status', 'running')
    .lt('started_at', cutoff)
    .select('id');

  if (error) {
    log(`Stale run cleanup error: ${error.message}`);
    return;
  }
  const count = data?.length || 0;
  if (count > 0) {
    log(`Cleaned up ${count} stale agent run(s) (running > 4h)`);
  }
}

async function main() {
  log('CivicGraph Scheduler');
  log('═'.repeat(40));

  await cleanupStaleRuns();

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
    await updateStamps(schedule.agent_id, ok);
    if (!ok) log(`  Marked last_scheduled_at (not last_run_at) to avoid retry thrash.`);
  }

  log(`\nScheduler complete`);
}

main().catch(err => {
  log(`Fatal: ${err.message}`);
  process.exit(1);
});
