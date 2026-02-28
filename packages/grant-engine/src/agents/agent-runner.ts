/**
 * Agent Runner — Scheduler + State Management
 *
 * Runs scraping agents on configurable schedules.
 * Each agent run is logged to Supabase for transparency.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface AgentConfig {
  id: string;
  name: string;
  schedule: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  enabled: boolean;
  execute: (supabase: SupabaseClient, log: (msg: string) => void) => Promise<AgentRunResult>;
}

export interface AgentRunResult {
  itemsFound: number;
  itemsNew: number;
  itemsUpdated: number;
  errors: string[];
}

export interface AgentRunLog {
  agent_id: string;
  agent_name: string;
  started_at: string;
  completed_at: string;
  status: 'success' | 'partial' | 'failed';
  items_found: number;
  items_new: number;
  items_updated: number;
  errors: string[];
  duration_ms: number;
}

/**
 * Check if an agent should run based on its schedule and last run time.
 */
export async function shouldRun(
  supabase: SupabaseClient,
  agentId: string,
  schedule: AgentConfig['schedule']
): Promise<boolean> {
  const { data } = await supabase
    .from('agent_runs')
    .select('completed_at')
    .eq('agent_id', agentId)
    .eq('status', 'success')
    .order('completed_at', { ascending: false })
    .limit(1);

  if (!data?.length) return true; // Never run before

  const lastRun = new Date(data[0].completed_at);
  const now = new Date();
  const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);

  const thresholds: Record<string, number> = {
    daily: 20,        // ~20 hours (allows some drift)
    weekly: 144,      // ~6 days
    monthly: 648,     // ~27 days
    quarterly: 2000,  // ~83 days
  };

  return hoursSinceLastRun >= (thresholds[schedule] || 24);
}

/**
 * Run a single agent and log the result.
 */
export async function runAgent(
  supabase: SupabaseClient,
  agent: AgentConfig
): Promise<AgentRunLog> {
  const startedAt = new Date().toISOString();
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(`[${agent.id}] ${msg}`);
    logs.push(msg);
  };

  log(`Starting ${agent.name}...`);

  let result: AgentRunResult;
  try {
    result = await agent.execute(supabase, log);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result = { itemsFound: 0, itemsNew: 0, itemsUpdated: 0, errors: [message] };
  }

  const completedAt = new Date().toISOString();
  const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

  const status = result.errors.length === 0
    ? 'success'
    : result.itemsFound > 0
      ? 'partial'
      : 'failed';

  const runLog: AgentRunLog = {
    agent_id: agent.id,
    agent_name: agent.name,
    started_at: startedAt,
    completed_at: completedAt,
    status,
    items_found: result.itemsFound,
    items_new: result.itemsNew,
    items_updated: result.itemsUpdated,
    errors: result.errors,
    duration_ms: durationMs,
  };

  // Log to Supabase (fail silently if table doesn't exist yet)
  const { error } = await supabase.from('agent_runs').insert(runLog);
  if (error) {
    console.error(`[agent-runner] Failed to log run: ${error.message}`);
  }

  log(`Completed in ${(durationMs / 1000).toFixed(1)}s — ${result.itemsFound} found, ${result.itemsNew} new, ${result.errors.length} errors`);

  return runLog;
}

/**
 * Run all enabled agents that are due based on their schedules.
 */
export async function runAllAgents(
  supabase: SupabaseClient,
  agents: AgentConfig[],
  options: { force?: boolean } = {}
): Promise<AgentRunLog[]> {
  const results: AgentRunLog[] = [];

  for (const agent of agents) {
    if (!agent.enabled) {
      console.log(`[agent-runner] Skipping ${agent.id} (disabled)`);
      continue;
    }

    const due = options.force || await shouldRun(supabase, agent.id, agent.schedule);
    if (!due) {
      console.log(`[agent-runner] Skipping ${agent.id} (not due yet)`);
      continue;
    }

    const result = await runAgent(supabase, agent);
    results.push(result);
  }

  return results;
}
