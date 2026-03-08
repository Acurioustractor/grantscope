#!/usr/bin/env tsx
/**
 * Run Scraping Agents
 *
 * Orchestrates all scraping agents. Each agent checks its own schedule
 * and only runs if due. Use --force to run all regardless of schedule.
 *
 * Usage:
 *   tsx scripts/run-scraping-agents.mjs            # Run due agents
 *   tsx scripts/run-scraping-agents.mjs --force     # Force all agents
 *   tsx scripts/run-scraping-agents.mjs --agent grant-monitor  # Run specific agent
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { runAllAgents, runAgent } from '../packages/grant-engine/src/agents/agent-runner.ts';
import { createGrantMonitor } from '../packages/grant-engine/src/agents/grant-monitor.ts';
import { createFoundationWatcher } from '../packages/grant-engine/src/agents/foundation-watcher.ts';
import { createGovernmentSpendWatcher } from '../packages/grant-engine/src/agents/government-spend.ts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const force = process.argv.includes('--force');
const specificAgent = process.argv.includes('--agent')
  ? process.argv[process.argv.indexOf('--agent') + 1]
  : null;

const allAgents = [
  createGrantMonitor(),
  createFoundationWatcher(),
  createGovernmentSpendWatcher(),
];

async function main() {
  console.log('=== GrantScope Scraping Agents ===\n');

  if (specificAgent) {
    const agent = allAgents.find(a => a.id === specificAgent);
    if (!agent) {
      console.error(`Unknown agent: ${specificAgent}`);
      console.error(`Available: ${allAgents.map(a => a.id).join(', ')}`);
      process.exit(1);
    }
    console.log(`Running specific agent: ${agent.name}`);
    const result = await runAgent(supabase, agent);
    console.log('\nResult:', JSON.stringify(result, null, 2));
    return;
  }

  if (force) console.log('(Force mode — running all agents regardless of schedule)\n');

  const results = await runAllAgents(supabase, allAgents, { force });

  console.log(`\n=== Summary ===`);
  console.log(`Agents run: ${results.length}`);

  for (const r of results) {
    const icon = r.status === 'success' ? '✓' : r.status === 'partial' ? '~' : '✗';
    console.log(`  ${icon} ${r.agent_name}: ${r.items_found} found, ${r.items_new} new (${(r.duration_ms / 1000).toFixed(1)}s)`);
    if (r.errors.length) {
      for (const e of r.errors.slice(0, 3)) {
        console.log(`    ✗ ${e}`);
      }
    }
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
