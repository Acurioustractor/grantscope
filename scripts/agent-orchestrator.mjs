#!/usr/bin/env node

/**
 * Agent Orchestrator — replaces pipeline-runner.mjs
 *
 * Long-lived process that:
 *   1. Polls agent_tasks for pending work (claim_next_task RPC)
 *   2. Executes scripts via child_process.execFile
 *   3. Auto-creates tasks from agent_schedules when freshness thresholds exceeded
 *   4. Handles retries with exponential backoff
 *   5. Graceful shutdown on SIGTERM/SIGINT
 *
 * Usage:
 *   node --env-file=.env scripts/agent-orchestrator.mjs [--concurrency=2] [--once]
 *
 * Designed to run under PM2 or systemd.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { execFile } from 'child_process';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { AGENTS } from './lib/agent-registry.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[orchestrator] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Config ──────────────────────────────────────────────────────────────────

const concurrencyArg = process.argv.find(a => a.startsWith('--concurrency='));
const CONCURRENCY = concurrencyArg ? parseInt(concurrencyArg.split('=')[1], 10) : 2;
const ONCE = process.argv.includes('--once');

const POLL_INTERVAL_MS = 10_000;       // 10s
const SCHEDULER_INTERVAL_MS = 300_000; // 5min
const BACKOFF_BASE_MS = 60_000;        // 1min base for exponential backoff

// ─── State ───────────────────────────────────────────────────────────────────

let shuttingDown = false;
const activeChildren = new Map(); // taskId → ChildProcess

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

// ─── Crash Recovery ──────────────────────────────────────────────────────────

async function recoverStuckTasks() {
  const { data, error } = await supabase
    .from('agent_tasks')
    .update({ status: 'pending', started_at: null })
    .eq('status', 'running')
    .select('id, agent_id');

  if (error) {
    console.error('[orchestrator] Crash recovery failed:', error.message);
    return;
  }
  if (data && data.length > 0) {
    console.log(`[${timestamp()}] Recovered ${data.length} stuck tasks:`, data.map(t => t.agent_id).join(', '));
  }
}

// ─── Task Execution ──────────────────────────────────────────────────────────

async function executeTask(task) {
  const agent = AGENTS[task.agent_id];
  if (!agent) {
    console.error(`[${timestamp()}] Unknown agent: ${task.agent_id}`);
    await supabase
      .from('agent_tasks')
      .update({ status: 'failed', completed_at: new Date().toISOString(), error: `Unknown agent: ${task.agent_id}` })
      .eq('id', task.id);
    return;
  }

  // Merge task params into command args
  const cmd = [...agent.command];
  const params = task.params || {};
  if (params.limit) cmd.push(`--limit=${params.limit}`);
  if (params.concurrency) cmd.push(`--concurrency=${params.concurrency}`);
  if (params.batchSize) cmd.push(`--batch-size=${params.batchSize}`);

  // Log start to agent_runs
  const run = await logStart(supabase, task.agent_id, agent.displayName);
  if (run.id) {
    await supabase
      .from('agent_tasks')
      .update({ run_id: run.id })
      .eq('id', task.id);
  }

  console.log(`[${timestamp()}] Executing: ${agent.displayName} (task=${task.id.slice(0, 8)}, priority=${task.priority}, retry=${task.retry_count})`);

  return new Promise((resolve) => {
    const timeout = agent.timeoutMs || 600_000;
    const child = execFile(cmd[0], cmd.slice(1), {
      timeout,
      maxBuffer: 10 * 1024 * 1024,
      env: process.env,
    }, async (err, stdout, stderr) => {
      activeChildren.delete(task.id);

      if (shuttingDown) {
        // Task was killed during shutdown — reset to pending
        await supabase
          .from('agent_tasks')
          .update({ status: 'pending', started_at: null })
          .eq('id', task.id);
        if (run.id) await logFailed(supabase, run.id, 'Shutdown — task reset to pending');
        resolve();
        return;
      }

      if (err) {
        const msg = err.killed ? `Timed out after ${timeout / 1000}s` : err.message;
        console.error(`[${timestamp()}] FAILED: ${agent.displayName} — ${msg}`);
        if (stdout) {
          const lines = stdout.trim().split('\n').slice(-3);
          console.log(lines.join('\n'));
        }

        // Retry logic
        if (task.retry_count < task.max_retries) {
          const backoff = BACKOFF_BASE_MS * Math.pow(4, task.retry_count); // 1m, 4m, 16m
          const nextRun = new Date(Date.now() + backoff).toISOString();
          await supabase
            .from('agent_tasks')
            .update({
              status: 'pending',
              started_at: null,
              retry_count: task.retry_count + 1,
              scheduled_for: nextRun,
              error: msg,
            })
            .eq('id', task.id);
          console.log(`[${timestamp()}] Retry ${task.retry_count + 1}/${task.max_retries} scheduled for ${nextRun}`);
        } else {
          await supabase
            .from('agent_tasks')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              error: msg,
            })
            .eq('id', task.id);
        }

        if (run.id) await logFailed(supabase, run.id, msg);
      } else {
        // Success
        const lines = stdout.trim().split('\n');
        const tail = lines.slice(-3).join('\n');
        if (tail) console.log(tail);
        if (stderr) {
          const errLines = stderr.trim().split('\n').slice(-2);
          if (errLines[0]) console.error(errLines.join('\n'));
        }

        await supabase
          .from('agent_tasks')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            error: null,
          })
          .eq('id', task.id);

        // Parse stats from stdout if available (look for JSON on last line)
        let stats = {};
        try {
          const lastLine = lines[lines.length - 1];
          if (lastLine && lastLine.startsWith('{')) {
            stats = JSON.parse(lastLine);
          }
        } catch { /* ignore */ }

        if (run.id) await logComplete(supabase, run.id, stats);
        console.log(`[${timestamp()}] Completed: ${agent.displayName}`);
      }

      resolve();
    });

    activeChildren.set(task.id, child);
  });
}

// ─── Poll Loop ───────────────────────────────────────────────────────────────

async function pollOnce() {
  if (shuttingDown) return;

  try {
    const { data, error } = await supabase.rpc('claim_next_task', {
      p_concurrency_limit: CONCURRENCY,
    });

    if (error) {
      console.error('[orchestrator] claim_next_task error:', error.message);
      return;
    }

    if (data && data.length > 0) {
      const task = data[0];
      // Fire and forget — executeTask manages its own completion
      executeTask(task).catch(err => {
        console.error(`[orchestrator] Unhandled error in executeTask:`, err);
      });
    }
  } catch (err) {
    console.error('[orchestrator] Poll error:', err.message);
  }
}

// ─── Auto-Scheduler ──────────────────────────────────────────────────────────

async function runScheduler() {
  if (shuttingDown) return;

  try {
    const { data: schedules, error } = await supabase
      .from('agent_schedules')
      .select('*')
      .eq('enabled', true)
      .eq('auto_create_task', true);

    if (error || !schedules) {
      console.error('[orchestrator] Scheduler error:', error?.message);
      return;
    }

    for (const schedule of schedules) {
      const thresholdMs = schedule.interval_hours * 3600_000;
      const lastRun = schedule.last_run_at ? new Date(schedule.last_run_at).getTime() : 0;
      const elapsed = Date.now() - lastRun;

      if (elapsed < thresholdMs) continue;

      // Check if there's already a pending/running task for this agent
      const { count } = await supabase
        .from('agent_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('agent_id', schedule.agent_id)
        .in('status', ['pending', 'running']);

      if (count && count > 0) continue;

      // Create a new task
      const { error: insertError } = await supabase
        .from('agent_tasks')
        .insert({
          agent_id: schedule.agent_id,
          priority: schedule.priority,
          params: schedule.params || {},
          created_by: 'scheduler',
        });

      if (insertError) {
        console.error(`[orchestrator] Failed to create task for ${schedule.agent_id}:`, insertError.message);
        continue;
      }

      // Update last_run_at
      await supabase
        .from('agent_schedules')
        .update({ last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', schedule.id);

      console.log(`[${timestamp()}] Scheduler created task: ${schedule.agent_id}`);
    }
  } catch (err) {
    console.error('[orchestrator] Scheduler error:', err.message);
  }
}

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[${timestamp()}] ${signal} received — shutting down gracefully`);

  // Kill active children
  for (const [taskId, child] of activeChildren) {
    console.log(`[${timestamp()}] Killing child for task ${taskId.slice(0, 8)}`);
    child.kill('SIGTERM');
  }

  // Wait briefly for children to exit
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Reset any still-running tasks to pending
  const { data } = await supabase
    .from('agent_tasks')
    .update({ status: 'pending', started_at: null })
    .eq('status', 'running')
    .select('id');

  if (data && data.length > 0) {
    console.log(`[${timestamp()}] Reset ${data.length} running tasks to pending`);
  }

  console.log(`[${timestamp()}] Shutdown complete`);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log(`[${timestamp()}] Agent Orchestrator Starting`);
  console.log(`  Concurrency: ${CONCURRENCY}`);
  console.log(`  Registered agents: ${Object.keys(AGENTS).length}`);
  console.log(`  Poll interval: ${POLL_INTERVAL_MS / 1000}s`);
  console.log(`  Scheduler interval: ${SCHEDULER_INTERVAL_MS / 1000}s`);
  console.log('='.repeat(60));

  // Recover stuck tasks from previous crash
  await recoverStuckTasks();

  // Run scheduler immediately
  await runScheduler();

  if (ONCE) {
    // Poll once and run any available task, then exit
    await pollOnce();
    // Wait for any active tasks to complete
    while (activeChildren.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log(`[${timestamp()}] --once mode, exiting.`);
    return;
  }

  // Main loop
  const pollTimer = setInterval(pollOnce, POLL_INTERVAL_MS);
  const schedulerTimer = setInterval(runScheduler, SCHEDULER_INTERVAL_MS);

  // Keep process alive
  process.on('exit', () => {
    clearInterval(pollTimer);
    clearInterval(schedulerTimer);
  });
}

main().catch(err => {
  console.error('[orchestrator] Fatal error:', err);
  process.exit(1);
});
