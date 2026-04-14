#!/usr/bin/env node
/**
 * refresh-total-funding-mv.mjs
 * Refreshes the mv_entity_total_funding materialized view concurrently.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const db = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const run = await logStart(db, 'refresh-total-funding-mv', 'Refresh Total Funding MV');
  const runId = run?.id || null;
  try {
    console.log('Refreshing mv_entity_total_funding...');
    const { error } = await db.rpc('exec_sql', {
      query: 'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_entity_total_funding'
    });
    if (error) throw new Error(error.message);
    console.log('Done.');
    if (runId) await logComplete(db, runId, { items_found: 1, items_new: 0 });
  } catch (err) {
    console.error('Fatal:', err);
    if (runId) await logFailed(db, runId, err);
    process.exit(1);
  }
})();
