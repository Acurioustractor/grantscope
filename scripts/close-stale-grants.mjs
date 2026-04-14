#!/usr/bin/env node

/**
 * Close Stale Grants Agent
 *
 * Automatically closes grants that:
 * 1. Have passed their `closes_at` deadline.
 * 2. Are from external scraping pipelines but haven't been seen (`last_verified_at`) in 14 days.
 *
 * Excludes manual sources from the 14-day rule to prevent destroying CRM data.
 *
 * Usage:
 *   node --env-file=.env scripts/close-stale-grants.mjs
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log(`=== Close Stale Grants Agent ${DRY_RUN ? '(DRY RUN)' : ''} ===`);

  const runId = DRY_RUN ? null : (await logStart(supabase, 'close-stale-grants', 'Close Stale Grants'))?.id;

  try {
    const query = `
      WITH past_deadline AS (
        SELECT id FROM grant_opportunities 
        WHERE status = 'open' 
          AND closes_at < CURRENT_DATE
      ),
      missing_from_source AS (
        SELECT id FROM grant_opportunities
        WHERE status = 'open'
          AND source NOT IN ('manual', 'manual_entry', 'ghl_sync')
          AND last_verified_at < NOW() - INTERVAL '14 days'
      ),
      to_close AS (
        SELECT id, 'past_deadline' as reason FROM past_deadline
        UNION
        SELECT id, 'missing_from_source' FROM missing_from_source
      )
      SELECT id, reason FROM to_close
    `;

    const { data: results, error } = await supabase.rpc('exec_sql', { query });

    if (error) {
      throw new Error(`SQL Execution failed: ${error.message}`);
    }

    if (!results || results.length === 0) {
      console.log('No stale grants found linking to close.');
      if (runId) await logComplete(supabase, runId, { items_found: 0, items_new: 0 });
      return;
    }

    console.log(`Found ${results.length} stale grants requiring closure.`);

    if (DRY_RUN) {
      for (const row of results.slice(0, 10)) {
         console.log(`  Would close ${row.id} (${row.reason})`);
      }
      return;
    }

    let closed = 0;
    // Process in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < results.length; i += BATCH_SIZE) {
      const batchIds = results.slice(i, i + BATCH_SIZE).map(r => r.id);
      
      const { error: updateError } = await supabase
        .from('grant_opportunities')
        .update({ status: 'closed' })
        .in('id', batchIds);

      if (!updateError) {
        closed += batchIds.length;
      } else {
        console.error(`Failed to close batch: ${updateError.message}`);
      }
    }

    console.log(`Successfully closed ${closed} stale grants.`);

    if (runId) {
      await logComplete(supabase, runId, {
        items_found: results.length,
        items_updated: closed,
      });
    }

  } catch (err) {
    console.error('Fatal:', err);
    if (runId) await logFailed(supabase, runId, err);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
