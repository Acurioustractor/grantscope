#!/usr/bin/env node
// Drive bridge_civicscope_to_act_fuzzy in batches via psql until done.
// Each call processes p_batch_limit canonical_entities, persists matches
// that pass p_min_similarity, returns (inserted, batch_size, last_id, done).

import { spawnSync } from 'child_process';

const password = process.env.DATABASE_PASSWORD;
if (!password) {
  console.error('DATABASE_PASSWORD not set');
  process.exit(1);
}

const BATCH_LIMIT = Number(process.env.BATCH_LIMIT || 500);
const MIN_SIM = Number(process.env.MIN_SIM || 0.70);
const MAX_BATCHES = Number(process.env.MAX_BATCHES || 100);

const psqlArgs = [
  '-h', 'aws-0-ap-southeast-2.pooler.supabase.com',
  '-p', '5432',
  '-U', 'postgres.tednluwflfhxyucgwigh',
  '-d', 'postgres',
  '-t', // tuples only
  '-A', // unaligned
  '-F', '|',
];

function runBatch(cursor) {
  const cursorArg = cursor ? `'${cursor}'::uuid` : 'NULL::uuid';
  const sql = `SET statement_timeout = '4min';
    SELECT rows_inserted || '|' || batch_processed || '|' || COALESCE(last_id::text, '') || '|' || done
    FROM bridge_civicscope_to_act_fuzzy(${BATCH_LIMIT}, ${cursorArg}, ${MIN_SIM});`;

  const res = spawnSync('psql', [...psqlArgs, '-c', sql], {
    env: { ...process.env, PGPASSWORD: password },
    encoding: 'utf8',
  });

  if (res.status !== 0) {
    return { error: res.stderr || res.stdout || 'psql failed' };
  }

  const line = res.stdout.trim().split('\n').find((l) => l.includes('|'));
  if (!line) return { error: `no result row: ${res.stdout}` };
  const [inserted, processed, lastId, done] = line.split('|');
  // psql -A outputs booleans as "t"/"f", but some configurations emit "true"/"false".
  // Also bail if no rows processed or no cursor — there's nothing more to advance.
  const doneNormalised = done?.trim().toLowerCase();
  return {
    inserted: Number(inserted),
    processed: Number(processed),
    lastId: lastId || null,
    done: doneNormalised === 't' || doneNormalised === 'true' || Number(processed) === 0 || !lastId,
  };
}

let cursor = null;
let totalInserted = 0;
let totalProcessed = 0;
let batchNum = 0;
const start = Date.now();

console.log(`bridge_fuzzy: batch=${BATCH_LIMIT}, min_sim=${MIN_SIM}, max_batches=${MAX_BATCHES}`);

while (batchNum < MAX_BATCHES) {
  batchNum++;
  const batchStart = Date.now();
  const r = runBatch(cursor);
  const elapsedMs = Date.now() - batchStart;

  if (r.error) {
    console.error(`batch ${batchNum} failed (${elapsedMs}ms):`, r.error.slice(0, 200));
    break;
  }

  totalInserted += r.inserted;
  totalProcessed += r.processed;

  console.log(
    `batch ${String(batchNum).padStart(3, '0')}: processed=${r.processed} inserted=${r.inserted} ` +
      `last=${r.lastId ? r.lastId.slice(0, 8) : 'null'} ${elapsedMs}ms`
  );

  if (r.done) {
    console.log('done.');
    break;
  }
  cursor = r.lastId;
}

const totalSec = ((Date.now() - start) / 1000).toFixed(1);
console.log(
  `\ntotal: ${totalInserted} fuzzy matches inserted from ${totalProcessed} candidates in ${totalSec}s`
);
