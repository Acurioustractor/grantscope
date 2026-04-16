#!/usr/bin/env node

/**
 * Snapshot Data Catalog
 *
 * Runs snapshot_data_catalog() and logs into agent_runs.
 *
 * Usage:
 *   node --env-file=.env scripts/snapshot-data-catalog.mjs
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[snapshot-data-catalog] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const run = await logStart(supabase, 'snapshot-data-catalog', 'Snapshot Data Catalog');

  try {
    const { error: catalogError } = await supabase
      .from('data_catalog')
      .select('table_name')
      .limit(1);
    if (catalogError) {
      throw new Error(`data_catalog table not found or inaccessible: ${catalogError.message}`);
    }

    const { data, error } = await supabase.rpc('snapshot_data_catalog');
    if (error) throw error;

    const insertedCount =
      typeof data === 'number'
        ? data
        : Array.isArray(data)
          ? Number(data[0]?.snapshot_data_catalog ?? 0)
          : Number(data ?? 0);
    console.log(`[snapshot-data-catalog] Snapshot complete: ${insertedCount} table snapshots inserted`);

    await logComplete(supabase, run.id, {
      items_found: insertedCount,
      items_new: insertedCount,
      items_updated: 0,
      status: 'success',
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message)
        : String(error);
    console.error(`[snapshot-data-catalog] Failed: ${message}`);
    await logFailed(supabase, run.id, message);
    process.exit(1);
  }
}

main();
