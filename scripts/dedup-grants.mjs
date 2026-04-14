#!/usr/bin/env node

/**
 * Grant Deduplication Agent
 *
 * Uses pgvector cosine similarity to detect semantically identical
 * grants across different portals/sources (e.g. State portal vs GrantConnect).
 * Marks the less-complete duplicate as `status = 'duplicate'`.
 *
 * Usage:
 *   node --env-file=.env scripts/dedup-grants.mjs
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
  console.log(`=== Grant Deduplication Agent ${DRY_RUN ? '(DRY RUN)' : ''} ===`);

  const runId = DRY_RUN ? null : (await logStart(supabase, 'dedup-grants', 'Dedup Grants (Semantic)'))?.id;

  try {
    console.log('Finding semantic duplicates among open grants...');

    // 1 - (a <=> b) is the cosine similarity. > 0.95 is extremely similar.
    // We only dedup 'open' grants to avoid massive computations on historical data.
    const query = `
      WITH pairs AS (
        SELECT 
          a.id as id_a, 
          b.id as id_b,
          COALESCE(LENGTH(a.description), 0) as len_a,
          COALESCE(LENGTH(b.description), 0) as len_b,
          1 - (a.embedding <=> b.embedding) as similarity
        FROM grant_opportunities a
        JOIN grant_opportunities b ON a.id < b.id 
        WHERE a.status = 'open' 
          AND b.status = 'open'
          AND a.created_at > (NOW() - INTERVAL '3 days')
          AND a.embedding IS NOT NULL
          AND b.embedding IS NOT NULL
          AND 1 - (a.embedding <=> b.embedding) > 0.95
      ),
      duplicates AS (
        SELECT 
          CASE WHEN len_a >= len_b THEN id_b ELSE id_a END as duplicate_id,
          CASE WHEN len_a >= len_b THEN id_a ELSE id_b END as survivor_id,
          similarity
        FROM pairs
      )
      SELECT duplicate_id, survivor_id, similarity 
      FROM duplicates
    `;

    const { data: results, error } = await supabase.rpc('exec_sql', { query });

    if (error) {
      throw new Error(`SQL Execution failed: ${error.message}`);
    }

    if (!results || results.length === 0) {
      console.log('No cross-source duplicates found.');
      if (runId) await logComplete(supabase, runId, { items_found: 0, items_new: 0 });
      return;
    }

    console.log(`Found ${results.length} duplicate pairs.`);

    if (DRY_RUN) {
      for (const row of results.slice(0, 10)) {
         console.log(`  Would mark ${row.duplicate_id} as duplicate of ${row.survivor_id} (sim: ${row.similarity.toFixed(3)})`);
      }
      return;
    }

    let marked = 0;
    for (const row of results) {
      const { error: updateError } = await supabase
        .from('grant_opportunities')
        .update({ status: 'duplicate' })
        .eq('id', row.duplicate_id);

      if (!updateError) {
        marked++;
      } else {
        console.error(`Failed to mark duplicate ${row.duplicate_id}: ${updateError.message}`);
      }
    }

    console.log(`Successfully marked ${marked} grants as duplicate.`);

    if (runId) {
      await logComplete(supabase, runId, {
        items_found: results.length,
        items_updated: marked,
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
