#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hours = Math.max(1, Number.parseInt(process.argv.find((arg) => arg.startsWith('--hours='))?.split('=')[1] || '6', 10));
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(message) {
  console.log(`[recover-stale-agent-runs] ${message}`);
}

async function main() {
  const cutoff = new Date(Date.now() - (hours * 60 * 60 * 1000)).toISOString();
  const { data: runs, error } = await supabase
    .from('agent_runs')
    .select('id, agent_id, started_at')
    .eq('status', 'running')
    .lt('started_at', cutoff)
    .order('started_at', { ascending: true });

  if (error) {
    throw error;
  }

  if (!runs?.length) {
    log(`No stale running agent runs older than ${hours}h.`);
    return;
  }

  log(`Found ${runs.length} stale running agent runs older than ${hours}h.`);
  if (DRY_RUN) {
    for (const run of runs) {
      log(`Would recover ${run.agent_id} (${run.id}) started ${run.started_at}`);
    }
    return;
  }

  const now = new Date().toISOString();
  for (const run of runs) {
    const { error: updateError } = await supabase
      .from('agent_runs')
      .update({
        status: 'failed',
        completed_at: now,
        errors: [{
          time: now,
          message: `Recovered stale running row older than ${hours}h`,
        }],
      })
      .eq('id', run.id);

    if (updateError) {
      throw updateError;
    }

    log(`Recovered ${run.agent_id} (${run.id})`);
  }
}

main().catch((error) => {
  console.error('[recover-stale-agent-runs] Fatal:', error.message);
  process.exit(1);
});
